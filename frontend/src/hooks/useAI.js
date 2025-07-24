/**
 * useAI Hook - AI Interaction Management
 * 
 * Comprehensive hook for managing AI service communication with streaming support,
 * retry logic, caching, and state management integration.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore } from '../store/useStore';

// Constants
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second
const REQUEST_TIMEOUT = 30000; // 30 seconds
const TYPING_INDICATOR_DELAY = 500; // 500ms

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
    progress: 0
  });

  // Refs for cleanup and cancellation
  const abortControllerRef = useRef(null);
  const websocketRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
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
   * WebSocket streaming implementation
   */
  const initializeWebSocket = useCallback(() => {
    if (!enableStreaming || websocketRef.current?.readyState === WebSocket.OPEN) {
      return Promise.resolve(websocketRef.current);
    }

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(`${WS_BASE_URL}/ai/stream`);
        websocketRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          resolve(ws);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          websocketRef.current = null;
        };

      } catch (error) {
        reject(error);
      }
    });
  }, [enableStreaming]);

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
   * Send message via WebSocket streaming
   */
  const sendStreamMessage = useCallback(async (message, context) => {
    try {
      const ws = await initializeWebSocket();
      
      return new Promise((resolve, reject) => {
        let accumulatedResponse = '';
        let messageId = null;

        const messageHandler = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'start':
                messageId = data.messageId;
                setState(prev => ({ ...prev, isStreaming: true }));
                setTypingIndicator(false);
                break;
                
              case 'chunk':
                accumulatedResponse += data.content;
                if (messageId) {
                  updateMessage(sessionId, messageId, {
                    content: accumulatedResponse,
                    isStreaming: true
                  });
                }
                break;
                
              case 'end':
                setState(prev => ({ ...prev, isStreaming: false }));
                if (messageId) {
                  updateMessage(sessionId, messageId, {
                    content: accumulatedResponse,
                    isStreaming: false,
                    isOptimistic: false
                  });
                }
                ws.removeEventListener('message', messageHandler);
                resolve({
                  content: accumulatedResponse,
                  messageId,
                  metadata: data.metadata
                });
                break;
                
              case 'error':
                setState(prev => ({ ...prev, isStreaming: false }));
                ws.removeEventListener('message', messageHandler);
                reject(new Error(data.message));
                break;
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.addEventListener('message', messageHandler);
        
        // Send the message
        ws.send(JSON.stringify({
          type: 'message',
          message,
          sessionId,
          section,
          context: context || conversation.context,
          settings: aiSettings
        }));

        // Timeout handling
        const timeoutId = setTimeout(() => {
          ws.removeEventListener('message', messageHandler);
          reject(new Error('Streaming timeout'));
        }, timeout);

        // Clear timeout on completion
        const originalResolve = resolve;
        const originalReject = reject;
        
        resolve = (...args) => {
          clearTimeout(timeoutId);
          originalResolve(...args);
        };
        
        reject = (...args) => {
          clearTimeout(timeoutId);
          originalReject(...args);
        };
      });
      
    } catch (error) {
      console.warn('WebSocket streaming failed, falling back to REST:', error);
      throw error;
    }
  }, [
    initializeWebSocket, sessionId, section, conversation.context, 
    aiSettings, timeout, updateMessage, setTypingIndicator
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
          result = await sendStreamMessage(message, context);
        } catch (streamError) {
          console.warn('Streaming failed, falling back to REST API:', streamError);
          result = await sendRestMessage(message, context);
        }
      } else {
        result = await sendRestMessage(message, context);
      }

      // Update or create AI response message
      const aiMessage = {
        id: optimisticMessage?.id || `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    section, sessionId, enableStreaming, sendStreamMessage, sendRestMessage,
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
      isConnected: websocketRef.current?.readyState === WebSocket.OPEN,
      lastActivity: messages[messages.length - 1]?.timestamp
    };
  }, [messages]);

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
      
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

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

    // State
    isLoading: state.isLoading,
    isStreaming: state.isStreaming,
    error: state.error,
    messages,
    conversation,
    typingIndicator: state.typingIndicator,
    progress: state.progress,

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
  ERROR_TYPES
};

// Default export
export default useAI;