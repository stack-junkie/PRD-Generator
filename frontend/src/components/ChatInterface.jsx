import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FixedSizeList as List } from 'react-window';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ClipboardIcon, CheckIcon, ArrowPathIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useAI } from '../hooks/useAI';
import { useTheme } from '../hooks/useTheme';
import ErrorBoundary from './ErrorBoundary';

const MESSAGE_HEIGHT = 120; // Approximate height for virtualization
const MAX_CHAR_COUNT = 5000;

const ChatInterface = ({ section, onSectionComplete, context }) => {
  const { isDarkMode } = useTheme();
  const { sendMessage, isProcessing, error, retryLastMessage } = useAI();
  
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [validationState, setValidationState] = useState({});
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const containerRef = useRef(null);

  // Section-specific placeholders
  const placeholders = {
    introduction: "Describe your product, the problem it solves, and who it's for...",
    goals: "What are your main business objectives and how will you measure success?",
    audience: "Who are your primary users and what are their key needs?",
    userStories: "Describe the main user stories and workflows...",
    requirements: "What are the functional and non-functional requirements?",
    metrics: "What key performance indicators will you track?",
    questions: "What open questions or concerns remain?"
  };

  // Initialize messages from context
  useEffect(() => {
    if (context?.conversationHistory) {
      setMessages(context.conversationHistory);
    }
  }, [context?.conversationHistory]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle scroll to show/hide scroll button
  const handleScroll = useCallback(({ scrollOffset, scrollUpdateWasRequested }) => {
    if (!scrollUpdateWasRequested && containerRef.current) {
      const { scrollHeight, clientHeight } = containerRef.current;
      const isNearBottom = scrollOffset + clientHeight >= scrollHeight - 100;
      setShowScrollButton(!isNearBottom);
    }
  }, []);

  // Handle input changes
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    if (value.length <= MAX_CHAR_COUNT) {
      setInputValue(value);
      
      // Auto-expand textarea
      const textarea = e.target;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, []);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      section
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      const response = await sendMessage(inputValue.trim(), section, context);
      
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.aiResponse,
        timestamp: new Date(),
        section,
        validation: response.validation,
        sectionComplete: response.sectionComplete,
        nextSteps: response.nextSteps,
        suggestions: response.suggestions
      };

      setMessages(prev => [...prev, aiMessage]);
      setValidationState(response.validation || {});

      // Check if section is complete
      if (response.sectionComplete && onSectionComplete) {
        onSectionComplete(section, response);
      }

    } catch (error) {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'error',
        content: 'Sorry, there was an error processing your message. Please try again.',
        timestamp: new Date(),
        section,
        error: true
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  }, [inputValue, isProcessing, sendMessage, section, context, onSectionComplete]);

  // Retry message
  const handleRetry = useCallback(async (messageIndex) => {
    try {
      // Find the user message that led to this error
      const userMessage = messages[messageIndex - 1];
      if (!userMessage || userMessage.role !== 'user') return;

      // Remove error message
      setMessages(prev => prev.slice(0, messageIndex));

      const response = await retryLastMessage(userMessage.content, section, context);
      
      const aiMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.aiResponse,
        timestamp: new Date(),
        section,
        validation: response.validation,
        sectionComplete: response.sectionComplete,
        nextSteps: response.nextSteps,
        suggestions: response.suggestions
      };

      setMessages(prev => [...prev, aiMessage]);
      setValidationState(response.validation || {});

      if (response.sectionComplete && onSectionComplete) {
        onSectionComplete(section, response);
      }

    } catch (error) {
      console.error('Retry failed:', error);
    }
  }, [messages, retryLastMessage, section, context, onSectionComplete]);

  // Copy code block
  const handleCopyCode = useCallback(async (code, messageId) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  }, []);

  // Custom markdown components
  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (!inline && language) {
        const code = String(children).replace(/\n$/, '');
        const messageId = node.position?.start?.line || 'unknown';
        
        return (
          <div className="relative group">
            <button
              onClick={() => handleCopyCode(code, messageId)}
              className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-gray-700 hover:bg-gray-600 text-white"
              title="Copy code"
            >
              {copiedMessageId === messageId ? (
                <CheckIcon className="w-4 h-4" />
              ) : (
                <ClipboardIcon className="w-4 h-4" />
              )}
            </button>
            <SyntaxHighlighter
              style={isDarkMode ? vscDarkPlus : prism}
              language={language}
              PreTag="div"
              className="rounded-md"
              {...props}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        );
      }
      
      return (
        <code 
          className={`px-1 py-0.5 rounded text-sm ${
            isDarkMode 
              ? 'bg-gray-700 text-gray-200' 
              : 'bg-gray-100 text-gray-800'
          }`}
          {...props}
        >
          {children}
        </code>
      );
    }
  }), [isDarkMode, handleCopyCode, copiedMessageId]);

  // Render individual message
  const MessageItem = React.memo(({ index, style }) => {
    const message = messages[index];
    if (!message) return null;

    const isUser = message.role === 'user';
    const isError = message.role === 'error';
    const isAI = message.role === 'assistant';

    return (
      <div style={style} className="px-4 py-2">
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-3xl rounded-lg px-4 py-3 group relative ${
              isUser
                ? isDarkMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500 text-white'
                : isError
                ? isDarkMode
                  ? 'bg-red-900 text-red-100 border border-red-700'
                  : 'bg-red-50 text-red-800 border border-red-200'
                : isDarkMode
                ? 'bg-gray-800 text-gray-100 border border-gray-700'
                : 'bg-white text-gray-900 border border-gray-200'
            }`}
          >
            {/* Message content */}
            <div className="message-content">
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : isError ? (
                <div>
                  <p className="mb-2">{message.content}</p>
                  <button
                    onClick={() => handleRetry(index)}
                    className="flex items-center gap-2 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    Retry
                  </button>
                </div>
              ) : (
                <div>
                  <ReactMarkdown components={markdownComponents}>
                    {message.content}
                  </ReactMarkdown>
                  
                  {/* Validation feedback */}
                  {message.validation && (
                    <div className={`mt-3 p-3 rounded-md text-sm ${
                      message.validation.passed
                        ? isDarkMode
                          ? 'bg-green-900 text-green-100 border border-green-700'
                          : 'bg-green-50 text-green-800 border border-green-200'
                        : isDarkMode
                        ? 'bg-yellow-900 text-yellow-100 border border-yellow-700'
                        : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                    }`}>
                      <div className="font-medium mb-1">
                        {message.validation.passed ? '✓ Good response' : '⚠ Could be improved'}
                      </div>
                      {message.validation.suggestions && message.validation.suggestions.length > 0 && (
                        <ul className="list-disc list-inside space-y-1">
                          {message.validation.suggestions.map((suggestion, i) => (
                            <li key={i}>{suggestion}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Suggestions */}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className={`mt-3 p-3 rounded-md text-sm ${
                      isDarkMode
                        ? 'bg-blue-900 text-blue-100 border border-blue-700'
                        : 'bg-blue-50 text-blue-800 border border-blue-200'
                    }`}>
                      <div className="font-medium mb-2">💡 Suggestions:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {message.suggestions.map((suggestion, i) => (
                          <li key={i}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Timestamp (show on hover) */}
            <div className="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    );
  });

  MessageItem.displayName = 'MessageItem';

  return (
    <ErrorBoundary>
      <div className={`flex flex-col h-full ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        {/* Section header */}
        <div className={`px-6 py-4 border-b ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700 text-gray-100' 
            : 'bg-white border-gray-200 text-gray-900'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold capitalize">
                {section.replace(/([A-Z])/g, ' $1').trim()}
              </h2>
              {context?.progress && (
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-32 h-2 rounded-full ${
                    isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                  }`}>
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${context.progress.percentComplete}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500">
                    {context.progress.percentComplete}%
                  </span>
                </div>
              )}
            </div>
            
            {validationState.score && (
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                validationState.score >= 80
                  ? 'bg-green-100 text-green-800'
                  : validationState.score >= 60
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                Score: {validationState.score}/100
              </div>
            )}
          </div>
        </div>

        {/* Messages container */}
        <div className="flex-1 relative" ref={containerRef}>
          {messages.length > 0 ? (
            <List
              ref={listRef}
              height={containerRef.current?.clientHeight || 400}
              itemCount={messages.length}
              itemSize={MESSAGE_HEIGHT}
              onScroll={handleScroll}
              className="scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent"
            >
              {MessageItem}
            </List>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className={`text-6xl mb-4 ${
                  isDarkMode ? 'text-gray-600' : 'text-gray-300'
                }`}>
                  💬
                </div>
                <p className={`text-lg mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Start the conversation
                </p>
                <p className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Share your thoughts about this section
                </p>
              </div>
            </div>
          )}

          {/* Scroll to bottom button */}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className={`absolute bottom-4 right-4 p-2 rounded-full shadow-lg transition-all ${
                isDarkMode
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              ↓
            </button>
          )}
        </div>

        {/* Input area */}
        <div className={`px-6 py-4 border-t ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholders[section] || "Type your message..."}
                disabled={isProcessing}
                className={`w-full px-4 py-3 pr-16 rounded-lg border resize-none transition-all ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-blue-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                rows={1}
                style={{ minHeight: '52px', maxHeight: '200px' }}
              />
              
              {/* Character count */}
              <div className={`absolute bottom-2 right-12 text-xs ${
                inputValue.length > MAX_CHAR_COUNT * 0.9
                  ? 'text-red-500'
                  : isDarkMode
                  ? 'text-gray-400'
                  : 'text-gray-500'
              }`}>
                {inputValue.length}/{MAX_CHAR_COUNT}
              </div>
            </div>

            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing}
              className={`p-3 rounded-lg transition-all ${
                !inputValue.trim() || isProcessing
                  ? isDarkMode
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <PaperAirplaneIcon className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Typing indicator */}
          {isProcessing && (
            <div className={`mt-3 flex items-center gap-2 text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>AI is thinking...</span>
            </div>
          )}

          {/* Keyboard shortcuts hint */}
          <div className={`mt-2 text-xs ${
            isDarkMode ? 'text-gray-500' : 'text-gray-400'
          }`}>
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

ChatInterface.propTypes = {
  section: PropTypes.oneOf([
    'introduction',
    'goals', 
    'audience',
    'userStories',
    'requirements',
    'metrics',
    'questions'
  ]).isRequired,
  onSectionComplete: PropTypes.func,
  context: PropTypes.shape({
    conversationHistory: PropTypes.array,
    progress: PropTypes.shape({
      percentComplete: PropTypes.number,
      currentSection: PropTypes.string,
      completedSections: PropTypes.number,
      totalSections: PropTypes.number
    }),
    sessionMetadata: PropTypes.object,
    previousSections: PropTypes.object,
    currentResponses: PropTypes.object
  })
};

ChatInterface.defaultProps = {
  onSectionComplete: null,
  context: {}
};

export default ChatInterface;