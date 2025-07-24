/**
 * useAI Hook - AI Interaction Management
 * 
 * Comprehensive hook for managing AI service communication with streaming support,
 * retry logic, caching, and state management integration.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { io } from 'socket.io-client';

// Constants
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'http://localhost:3001';
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second
const REQUEST_TIMEOUT = 30000; // 30 seconds
const TYPING_INDICATOR_DELAY = 500; // 500ms
const SOCKET_RECONNECT_DELAY = 3000; // 3 seconds
const SOCKET_MAX_RECONNECT_ATTEMPTS = 5;

// Message types
const MESSAGE_TYPES = {
  USER: 'user',
  AI: 'ai',
  SYSTEM: 'system',
  ERROR: 'error'
};

// Request states
const REQUEST_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  STREAMING: 'streaming',
  SUCCESS: 'success',
  ERROR: 'error',
  CANCELLED: 'cancelled'
};

// Connection states
const CONNECTION_STATES = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  ERROR: 'error'
};

// Error types
const ERROR_TYPES = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  VALIDATION: 'validation',
  RATE_LIMIT: 'rate_limit',
  SERVER: 'server',
  WEBSOCKET: 'websocket'
};

/**
 * Custom hook for AI interactions
 * @param {string} sessionId - Unique session identifier
 * @param {string} section - Current PRD section
 * @param {Object} options - Configuration options
 */
export const useAI = (sessionId, section, options = {}) => {
  const {
    enableStreaming = true,
    enableCaching = true,
    enableRetry = true,
    maxRetries = MAX_RETRIES,
    retryDelay = RETRY_DELAY_BASE,
    timeout = REQUEST_TIMEOUT,
    enablePersistence = true
  } = options;

  // Global state
  const { 
    conversations, 
    setConversation, 
    addMessage, 
    updateMessage,
    networkStatus,
    aiSettings 
  } = useStore();

  // Local state
  const [state, setState] = useState({
    isLoading: false,
    isStreaming: false,
    error: null,
    typingIndicator: false,
    progress: 0,
    connectionState: CONNECTION_STATES.DISCONNECTED
  });

  // Refs for cleanup and cancellation
  const abortControllerRef = useRef(null);
  const socketRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const messageQueueRef = useRef([]);

  // Get current conversation
  const conversation = conversations[sessionId] || {
    id: sessionId,
    section,
    messages: [],
    context: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Message history for current session and section
  const messages = useMemo(() => {
    return conversation.messages.filter(msg => 
      !msg.section || msg.section === section
    );
  }, [conversation.messages, section]);

  // Cache for responses
  const cacheRef = useRef(new Map());

  /**
   * Generate cache key for requests
   */
  const getCacheKey = useCallback((message, context) => {
    const contextHash = JSON.stringify({
      section,
      sessionId,
      context: context || conversation.context,
      aiSettings
    });
    return `${message}_${btoa(contextHash).slice(0, 16)}`;
  }, [section, sessionId, conversation.context, aiSettings]);

  /**
   * Network status checker
   */
  const isOnline = useMemo(() => {
    return networkStatus?.online !== false && navigator.onLine;
  }, [networkStatus]);

  /**
   * Create abort controller for request cancellation
   */
  const createAbortController = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current;
  }, []);

  /**
   * Update typing indicator
   */
  const setTypingIndicator = useCallback((isTyping) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, typingIndicator: true }));
      }, TYPING_INDICATOR_DELAY);
    } else {
      setState(prev => ({ ...prev, typingIndicator: false }));
    }
  }, []);

  /**
   * Exponential backoff retry logic
   */
  const calculateRetryDelay = useCallback((attempt) => {
    return retryDelay * Math.pow(2, attempt) + Math.random() * 1000;
  }, [retryDelay]);

  /**
   * Error classification
   */
  const classifyError = useCallback((error) => {
    if (error.name === 'AbortError') {
      return { type: ERROR_TYPES.CANCELLED, retriable: false };
    }
    if (error.name === 'TimeoutError') {
      return { type: ERROR_TYPES.TIMEOUT, retriable: true };
    }
    if (error.status === 429) {
      return { type: ERROR_TYPES.RATE_LIMIT, retriable: true };
    }
    if (error.status >= 500) {
      return { type: ERROR_TYPES.SERVER, retriable: true };
    }
    if (error.status >= 400) {
      return { type: ERROR_TYPES.VALIDATION, retriable: false };
    }
    if (!isOnline) {
      return { type: ERROR_TYPES.NETWORK, retriable: true };
    }
    return { type: ERROR_TYPES.SERVER, retriable: true };
  }, [isOnline]);

  /**
   * Create optimistic message
   */
  const createOptimisticMessage = useCallback((content, type = MESSAGE_TYPES.AI) => {
    return {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date().toISOString(),
      section,
      sessionId,
      isOptimistic: true,
      isStreaming: type === MESSAGE_TYPES.AI
    };
  }, [section, sessionId]);

  /**
   * Socket.IO connection initialization
   */
  const initializeSocket = useCallback(() => {
    if (!enableStreaming) {
      return Promise.resolve(null);
    }

    // If socket already exists and is connected, return it
    if (socketRef.current?.connected) {
      return Promise.resolve(socketRef.current);
    }

    setState(prev => ({ ...prev, connectionState: CONNECTION_STATES.CONNECTING }));

    return new Promise((resolve, reject) => {
      try {
        // Create Socket.IO instance
        const socket = io(WS_BASE_URL, {
          reconnection: true,
          reconnectionAttempts: SOCKET_MAX_RECONNECT_ATTEMPTS,
          reconnectionDelay: SOCKET_RECONNECT_DELAY,
          timeout: timeout,
          autoConnect: true,
          transports: ['websocket', 'polling']
        });

        socketRef.current = socket;

        // Connection event handlers
        socket.on('connect', () => {
          console.log('Socket.IO connected');
          setState(prev => ({ ...prev, connectionState: CONNECTION_STATES.CONNECTED }));
          reconnectAttemptsRef.current = 0;

          // Join session room
          socket.emit('join-session', { sessionId, userId: 'user' }, (response) => {
            if (response.success) {
              console.log(`Joined session room: ${sessionId}`);
            } else {
              console.error(`Failed to join session room: ${response.error}`);
            }
          });

          resolve(socket);
        });

        socket.on('connect_error', (error) => {
          console.error('Socket.IO connection error:', error);
          setState(prev => ({ 
            ...prev, 
            connectionState: CONNECTION_STATES.ERROR,
            error: {
              message: `WebSocket connection error: ${error.message}`,
              type: ERROR_TYPES.WEBSOCKET,
              timestamp: new Date().toISOString()
            }
          }));

          // Only reject on initial connection
          if (reconnectAttemptsRef.current === 0) {
            reject(error);
          }
        });

        socket.on('disconnect', (reason) => {
          console.log(`Socket.IO disconnected: ${reason}`);
          setState(prev => ({ ...prev, connectionState: CONNECTION_STATES.DISCONNECTED }));

          // Don't attempt to reconnect if explicitly closed
          if (reason === 'io client disconnect') {
            return;
          }

          // Custom reconnection logic
          if (reconnectAttemptsRef.current < SOCKET_MAX_RECONNECT_ATTEMPTS) {
            const delay = calculateRetryDelay(reconnectAttemptsRef.current);
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${SOCKET_MAX_RECONNECT_ATTEMPTS})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++;
              socket.connect();
            }, delay);
          }
        });

        // Event handlers
        socket.on('message-chunk', (data) => {
          handleMessageChunk(data);
        });

        socket.on('validation-update', (data) => {
          handleValidationUpdate(data);
        });

        socket.on('section-complete', (data) => {
          handleSectionComplete(data);
        });

        socket.on('user-joined', (data) => {
          console.log(`User joined: ${data.userId} at ${data.timestamp}`);
          // Could update UI to show other users in the session
        });

        socket.on('user-left', (data) => {
          console.log(`User left: ${data.userId} at ${data.timestamp}`);
          // Could update UI to show other users in the session
        });

        socket.on('error', (data) => {
          console.error('Socket.IO error:', data);
          setState(prev => ({ 
            ...prev, 
            error: {
              message: data.message || 'WebSocket error',
              type: ERROR_TYPES.WEBSOCKET,
              timestamp: new Date().toISOString()
            }
          }));
        });

      } catch (error) {
        console.error('Failed to initialize Socket.IO:', error);
        setState(prev => ({ 
          ...prev, 
          connectionState: CONNECTION_STATES.ERROR,
          error: {
            message: `WebSocket initialization error: ${error.message}`,
            type: ERROR_TYPES.WEBSOCKET,
            timestamp: new Date().toISOString()
          }
        }));
        reject(error);
      }
    });
  }, [enableStreaming, sessionId, timeout, calculateRetryDelay]);

  /**
   * Handle message chunks from WebSocket
   */
  const handleMessageChunk = useCallback((data) => {
    const { content, messageId, metadata = {}, isLast = false } = data;

    setState(prev => ({ ...prev, isStreaming: true }));
    setTypingIndicator(false);

    // Find existing message or create a new one
    const existingMessageIndex = messages.findIndex(msg => 
      msg.id === messageId || 
      (msg.type === MESSAGE_TYPES.AI && msg.isStreaming)
    );

    if (existingMessageIndex >= 0) {
      // Update existing streaming message
      const message = messages[existingMessageIndex];
      const updatedContent = message.content + (content || '');
      
      updateMessage(sessionId, message.id, {
        content: updatedContent,
        isStreaming: !isLast,
        metadata: { ...message.metadata, ...metadata }
      });
    } else {
      // Create a new message for the first chunk
      const newMessage = {
        id: messageId || `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: MESSAGE_TYPES.AI,
        content: content || '',
        timestamp: new Date().toISOString(),
        section,
        sessionId,
        isStreaming: !isLast,
        metadata
      };
      
      addMessage(sessionId, newMessage);
    }

    // If this is the last chunk, update state
    if (isLast) {
      setState(prev => ({ ...prev, isStreaming: false }));
    }
  }, [messages, sessionId, section, updateMessage, addMessage, setTypingIndicator]);

  /**
   * Handle validation updates from WebSocket
   */
  const handleValidationUpdate = useCallback((data) => {
    const { section: updatedSection, valid, errors, messages: validationMessages } = data;
    
    // Update conversation context with validation data
    setConversation(sessionId, {
      ...conversation,
      context: {
        ...conversation.context,
        validation: {
          ...(conversation.context.validation || {}),
          [updatedSection]: { valid, errors, messages: validationMessages }
        }
      },
      updatedAt: new Date().toISOString()
    });
    
    // Could add a system message about validation
    if (!valid && validationMessages?.length) {
      const systemMessage = createOptimisticMessage(
        `Validation for ${updatedSection}: ${validationMessages.join('. ')}`,
        MESSAGE_TYPES.SYSTEM
      );
      addMessage(sessionId, systemMessage);
    }
  }, [sessionId, conversation, setConversation, createOptimisticMessage, addMessage]);

  /**
   * Handle section completion events from WebSocket
   */
  const handleSectionComplete = useCallback((data) => {
    const { section: completedSection, nextSection } = data;
    
    // Update conversation context
    setConversation(sessionId, {
      ...conversation,
      context: {
        ...conversation.context,
        completedSections: [
          ...(conversation.context.completedSections || []),
          completedSection
        ],
        currentSection: nextSection
      },
      updatedAt: new Date().toISOString()
    });
    
    // Add system message about section completion
    const systemMessage = createOptimisticMessage(
      `Section "${completedSection}" completed! ${nextSection ? `Moving to "${nextSection}"` : 'All sections completed!'}`,
      MESSAGE_TYPES.SYSTEM
    );
    addMessage(sessionId, systemMessage);
  }, [sessionId, conversation, setConversation, createOptimisticMessage, addMessage]);

  /**
   * Send message via REST API
   */
  const sendRestMessage = useCallback(async (message, context, retryCount = 0) => {
    const controller = createAbortController();
    
    try {
      const response = await fetch(`${API_BASE_URL}/ai/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId,
          section,
          context: context || conversation.context,
          settings: aiSettings
        }),
        signal: controller.signal,
        timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      const result = await response.json();
      return result;

    } catch (error) {
      const errorInfo = classifyError(error);
      
      if (errorInfo.retriable && enableRetry && retryCount < maxRetries) {
        const delay = calculateRetryDelay(retryCount);
        console.log(`Retrying request in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        
        await new Promise(resolve => {
          retryTimeoutRef.current = setTimeout(resolve, delay);
        });
        
        return sendRestMessage(message, context, retryCount + 1);
      }
      
      throw error;
    }
  }, [
    sessionId, section, conversation.context, aiSettings, timeout,
    enableRetry, maxRetries, createAbortController, classifyError, calculateRetryDelay
  ]);

  /**
   * Send message via Socket.IO streaming
   */
  const sendSocketMessage = useCallback(async (message, context, messageId) => {
    try {
      const socket = await initializeSocket();
      if (!socket) {
        throw new Error('WebSocket initialization failed');
      }
      
      return new Promise((resolve, reject) => {
        let streamingComplete = false;
        let accumulatedResponse = '';
        const responseMetadata = {};
        
        // Set up timeout
        const timeoutId = setTimeout(() => {
          if (!streamingComplete) {
            reject(new Error('Streaming response timeout'));
          }
        }, timeout);
        
        // Set up message handler
        const onMessageChunk = (data) => {
          if (data.sessionId !== sessionId) return;
          
          accumulatedResponse += data.content || '';
          Object.assign(responseMetadata, data.metadata || {});
          
          if (data.isLast) {
            streamingComplete = true;
            cleanup();
            resolve({
              content: accumulatedResponse,
              messageId: data.messageId || messageId,
              metadata: responseMetadata
            });
          }
        };
        
        // Set up error handler
        const onError = (data) => {
          if (data.sessionId !== sessionId) return;
          cleanup();
          reject(new Error(data.message || 'Streaming error'));
        };
        
        // Clean up event listeners
        const cleanup = () => {
          clearTimeout(timeoutId);
          socket.off('message-chunk', onMessageChunk);
          socket.off('error', onError);
        };
        
        // Add event listeners
        socket.on('message-chunk', onMessageChunk);
        socket.on('error', onError);
        
        // Send the message
        socket.emit('message', {
          message,
          sessionId,
          section,
          context: context || conversation.context,
          settings: aiSettings
        });
      });
      
    } catch (error) {
      console.warn('Socket.IO streaming failed, falling back to REST:', error);
      throw error;
    }
  }, [
    initializeSocket, sessionId, section, conversation.context,
    aiSettings, timeout
  ]);

  /**
   * Main send message function
   */
  const sendMessage = useCallback(async (message, options = {}) => {
    const {
      useCache = enableCaching,
      forceRefresh = false,
      context = null,
      optimistic = true
    } = options;

    // Validate input
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new Error('Message is required and must be a non-empty string');
    }

    // Check network status
    if (!isOnline) {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    // Check cache
    const cacheKey = getCacheKey(message, context);
    if (useCache && !forceRefresh && cacheRef.current.has(cacheKey)) {
      const cachedResponse = cacheRef.current.get(cacheKey);
      console.log('Using cached response');
      return cachedResponse;
    }

    // Add user message
    const userMessage = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: MESSAGE_TYPES.USER,
      content: message.trim(),
      timestamp: new Date().toISOString(),
      section,
      sessionId
    };

    addMessage(sessionId, userMessage);

    // Create optimistic AI response
    let optimisticMessage = null;
    if (optimistic) {
      optimisticMessage = createOptimisticMessage('');
      addMessage(sessionId, optimisticMessage);
    }

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null,
      progress: 0
    }));

    setTypingIndicator(true);

    try {
      let result;
      
      // Try streaming first, fall back to REST
      if (enableStreaming) {
        try {
          result = await sendSocketMessage(message, context, optimisticMessage?.id);
        } catch (streamError) {
          console.warn('Streaming failed, falling back to REST API:', streamError);
          result = await sendRestMessage(message, context);
        }
      } else {
        result = await sendRestMessage(message, context);
      }

      // Update or create AI response message
      const aiMessage = {
        id: optimisticMessage?.id || result.messageId || `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: MESSAGE_TYPES.AI,
        content: result.content || result.message,
        timestamp: new Date().toISOString(),
        section,
        sessionId,
        metadata: result.metadata,
        isOptimistic: false,
        isStreaming: false
      };

      if (optimisticMessage) {
        updateMessage(sessionId, optimisticMessage.id, aiMessage);
      } else {
        addMessage(sessionId, aiMessage);
      }

      // Update conversation context
      if (result.context) {
        setConversation(sessionId, {
          ...conversation,
          context: { ...conversation.context, ...result.context },
          updatedAt: new Date().toISOString()
        });
      }

      // Cache the response
      if (useCache) {
        cacheRef.current.set(cacheKey, result);
        
        // Limit cache size
        if (cacheRef.current.size > 100) {
          const firstKey = cacheRef.current.keys().next().value;
          cacheRef.current.delete(firstKey);
        }
      }

      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        isStreaming: false,
        progress: 100
      }));

      setTypingIndicator(false);

      return result;

    } catch (error) {
      console.error('AI request failed:', error);
      
      // Remove optimistic message on error
      if (optimisticMessage) {
        updateMessage(sessionId, optimisticMessage.id, {
          type: MESSAGE_TYPES.ERROR,
          content: 'Failed to get AI response. Please try again.',
          error: error.message,
          isOptimistic: false,
          isStreaming: false
        });
      }

      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        isStreaming: false,
        error: {
          message: error.message,
          type: classifyError(error).type,
          timestamp: new Date().toISOString()
        }
      }));

      setTypingIndicator(false);
      throw error;
    }
  }, [
    enableCaching, isOnline, getCacheKey, addMessage, createOptimisticMessage,
    section, sessionId, enableStreaming, sendSocketMessage, sendRestMessage,
    updateMessage, setConversation, conversation, setTypingIndicator, classifyError
  ]);

  /**
   * Stream message function (alias for streaming mode)
   */
  const streamMessage = useCallback((message, options = {}) => {
    return sendMessage(message, { ...options, optimistic: true });
  }, [sendMessage]);

  /**
   * Retry last failed message
   */
  const retry = useCallback(() => {
    if (!state.error) return Promise.resolve();

    const lastUserMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.type === MESSAGE_TYPES.USER);

    if (!lastUserMessage) {
      return Promise.reject(new Error('No message to retry'));
    }

    return sendMessage(lastUserMessage.content, { forceRefresh: true });
  }, [state.error, messages, sendMessage]);

  /**
   * Cancel current request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    setState(prev => ({ 
      ...prev, 
      isLoading: false,
      isStreaming: false,
      error: null
    }));

    setTypingIndicator(false);
  }, [setTypingIndicator]);

  /**
   * Manually connect to WebSocket
   */
  const connect = useCallback(() => {
    return initializeSocket();
  }, [initializeSocket]);

  /**
   * Manually disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    setState(prev => ({ 
      ...prev, 
      connectionState: CONNECTION_STATES.DISCONNECTED 
    }));
  }, []);

  /**
   * Clear conversation history
   */
  const clearMessages = useCallback(() => {
    setConversation(sessionId, {
      ...conversation,
      messages: [],
      context: {},
      updatedAt: new Date().toISOString()
    });
    
    // Clear cache for this session
    const keysToDelete = Array.from(cacheRef.current.keys()).filter(key => 
      key.includes(sessionId)
    );
    keysToDelete.forEach(key => cacheRef.current.delete(key));
  }, [sessionId, conversation, setConversation]);

  /**
   * Get conversation statistics
   */
  const getStats = useCallback(() => {
    const userMessages = messages.filter(msg => msg.type === MESSAGE_TYPES.USER);
    const aiMessages = messages.filter(msg => msg.type === MESSAGE_TYPES.AI);
    const errors = messages.filter(msg => msg.type === MESSAGE_TYPES.ERROR);

    return {
      totalMessages: messages.length,
      userMessages: userMessages.length,
      aiMessages: aiMessages.length,
      errors: errors.length,
      cacheSize: cacheRef.current.size,
      isConnected: socketRef.current?.connected,
      connectionState: state.connectionState,
      lastActivity: messages[messages.length - 1]?.timestamp
    };
  }, [messages, state.connectionState]);

  // Auto-connect to WebSocket on mount
  useEffect(() => {
    if (enableStreaming) {
      initializeSocket().catch(error => {
        console.warn('Initial WebSocket connection failed:', error);
      });
    }
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [enableStreaming, initializeSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Reconnect WebSocket on network status change
  useEffect(() => {
    if (isOnline && state.connectionState === CONNECTION_STATES.DISCONNECTED && enableStreaming) {
      initializeSocket().catch(error => {
        console.warn('WebSocket reconnection failed:', error);
      });
    }
  }, [isOnline, state.connectionState, enableStreaming, initializeSocket]);

  // Auto-save conversation on changes
  useEffect(() => {
    if (enablePersistence && messages.length > 0) {
      const timeoutId = setTimeout(() => {
        localStorage.setItem(`ai_conversation_${sessionId}`, JSON.stringify({
          conversation,
          timestamp: new Date().toISOString()
        }));
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [enablePersistence, sessionId, conversation, messages.length]);

  // Return hook interface
  return {
    // Core functions
    sendMessage,
    streamMessage,
    retry,
    cancel,
    clearMessages,

    // WebSocket control
    connect,
    disconnect,

    // State
    isLoading: state.isLoading,
    isStreaming: state.isStreaming,
    error: state.error,
    messages,
    conversation,
    typingIndicator: state.typingIndicator,
    progress: state.progress,
    connectionState: state.connectionState,
    isConnected: state.connectionState === CONNECTION_STATES.CONNECTED,

    // Utilities
    getStats,
    isOnline,

    // Configuration
    config: {
      enableStreaming,
      enableCaching,
      enableRetry,
      maxRetries,
      timeout
    }
  };
};

// TypeScript definitions (for projects using TypeScript)
export const AI_TYPES = {
  MESSAGE_TYPES,
  REQUEST_STATES,
  ERROR_TYPES,
  CONNECTION_STATES
};

// Default export
export default useAI;