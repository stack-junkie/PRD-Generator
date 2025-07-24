/**
 * Socket Manager Unit Tests
 * 
 * These tests verify that the SocketManager correctly:
 * - Initializes a Socket.IO server
 * - Handles session rooms
 * - Manages socket authentication
 * - Sends real-time messages and updates
 */

const { Server } = require('socket.io');
const { createServer } = require('http');
const Client = require('socket.io-client');
const SocketManager = require('../../../src/websocket/socketManager');

// Mock dependencies
jest.mock('socket.io');
jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn(() => ({}))
}));

describe('SocketManager', () => {
  let httpServer;
  let socketManager;
  let mockRedisClient;
  let mockLogger;
  let mockIo;
  let mockSocket;

  beforeEach(() => {
    // Create mock dependencies
    httpServer = createServer();
    mockRedisClient = {
      duplicate: jest.fn(() => mockRedisClient)
    };
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    };
    
    // Mock Socket.IO server
    mockSocket = {
      id: 'socket-id-123',
      join: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      on: jest.fn(),
      sessionId: null,
      userId: null
    };
    
    mockIo = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      close: jest.fn()
    };
    
    Server.mockImplementation(() => mockIo);
    
    // Create socket manager instance
    socketManager = new SocketManager({
      httpServer,
      redisClient: mockRedisClient,
      logger: mockLogger
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize a Socket.IO server with correct options', () => {
      expect(Server).toHaveBeenCalledWith(httpServer, expect.objectContaining({
        cors: expect.any(Object)
      }));
      expect(mockLogger.info).toHaveBeenCalledWith('WebSocket server initialized');
    });

    it('should handle initialization errors', () => {
      Server.mockImplementationOnce(() => {
        throw new Error('Server initialization failed');
      });

      expect(() => {
        new SocketManager({
          httpServer,
          redisClient: mockRedisClient,
          logger: mockLogger
        });
      }).toThrow('Server initialization failed');
      
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('connection handling', () => {
    it('should set up event listeners on new connections', () => {
      const connectionHandler = Server.mock.calls[0][1];
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
      
      // Simulate a connection
      const handleConnection = mockIo.on.mock.calls[0][1];
      handleConnection(mockSocket);
      
      // Should set up join-session and disconnect handlers
      expect(mockSocket.on).toHaveBeenCalledWith('join-session', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('session management', () => {
    it('should handle joining a session', () => {
      // Get the join session handler
      mockIo.on.mock.calls[0][1](mockSocket);
      const joinSessionHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join-session')[1];
      
      const sessionData = { sessionId: 'session-123', userId: 'user-456' };
      const mockCallback = jest.fn();
      
      // Call the handler
      joinSessionHandler(sessionData, mockCallback);
      
      // Verify the socket joined the room
      expect(mockSocket.join).toHaveBeenCalledWith('session:session-123');
      expect(mockSocket.sessionId).toBe('session-123');
      expect(mockSocket.userId).toBe('user-456');
      
      // Verify the callback was called with success
      expect(mockCallback).toHaveBeenCalledWith({ success: true });
      
      // Verify other users were notified
      expect(mockSocket.to).toHaveBeenCalledWith('session:session-123');
      expect(mockSocket.to().emit).toHaveBeenCalledWith('user-joined', expect.objectContaining({
        userId: 'user-456'
      }));
    });

    it('should handle join session errors', () => {
      // Get the join session handler
      mockIo.on.mock.calls[0][1](mockSocket);
      const joinSessionHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join-session')[1];
      
      const sessionData = { userId: 'user-456' }; // Missing sessionId
      const mockCallback = jest.fn();
      
      // Call the handler
      joinSessionHandler(sessionData, mockCallback);
      
      // Verify error handling
      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('Session ID is required')
      });
    });
  });

  describe('messaging functionality', () => {
    beforeEach(() => {
      // Setup a session
      socketManager.sessions.set('session-123', new Set(['socket-id-123']));
    });

    it('should send message chunks to a session', () => {
      const messageData = {
        content: 'Test message chunk',
        messageId: 'message-123'
      };
      
      socketManager.sendMessageChunk('session-123', messageData);
      
      expect(mockIo.to).toHaveBeenCalledWith('session:session-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith('message-chunk', expect.objectContaining({
        content: 'Test message chunk',
        messageId: 'message-123'
      }));
    });

    it('should send validation updates to a session', () => {
      const validationData = {
        section: 'introduction',
        valid: true,
        errors: []
      };
      
      socketManager.sendValidationUpdate('session-123', validationData);
      
      expect(mockIo.to).toHaveBeenCalledWith('session:session-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith('validation-update', expect.objectContaining({
        section: 'introduction',
        valid: true
      }));
    });

    it('should send section completion notifications', () => {
      const completionData = {
        section: 'introduction',
        nextSection: 'features'
      };
      
      socketManager.sendSectionComplete('session-123', completionData);
      
      expect(mockIo.to).toHaveBeenCalledWith('session:session-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith('section-complete', expect.objectContaining({
        section: 'introduction',
        nextSection: 'features'
      }));
    });

    it('should send error messages', () => {
      const errorData = {
        message: 'Test error message',
        code: 'TEST_ERROR'
      };
      
      socketManager.sendError('session-123', errorData);
      
      expect(mockIo.to).toHaveBeenCalledWith('session:session-123');
      expect(mockIo.to().emit).toHaveBeenCalledWith('error', expect.objectContaining({
        message: 'Test error message',
        code: 'TEST_ERROR'
      }));
    });
  });

  describe('session tracking', () => {
    it('should track active sessions and connections', () => {
      // Setup some sessions
      socketManager.sessions.set('session-1', new Set(['socket-1', 'socket-2']));
      socketManager.sessions.set('session-2', new Set(['socket-3']));
      
      expect(socketManager.getSessionConnectionCount('session-1')).toBe(2);
      expect(socketManager.getSessionConnectionCount('session-2')).toBe(1);
      expect(socketManager.getSessionConnectionCount('non-existent')).toBe(0);
      
      expect(socketManager.getActiveSessions()).toEqual(['session-1', 'session-2']);
    });
  });

  describe('disconnection', () => {
    it('should handle socket disconnections', () => {
      // Setup a connection and session
      mockIo.on.mock.calls[0][1](mockSocket);
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      
      // Setup session data
      mockSocket.sessionId = 'session-123';
      mockSocket.userId = 'user-456';
      socketManager.sessions.set('session-123', new Set(['socket-id-123', 'other-socket']));
      
      // Call the disconnect handler
      disconnectHandler();
      
      // Verify session cleanup
      expect(socketManager.sessions.get('session-123').has('socket-id-123')).toBe(false);
      expect(socketManager.sessions.get('session-123').size).toBe(1);
      
      // Verify other users were notified
      expect(mockSocket.to).toHaveBeenCalledWith('session:session-123');
      expect(mockSocket.to().emit).toHaveBeenCalledWith('user-left', expect.objectContaining({
        userId: 'user-456'
      }));
    });

    it('should clean up empty sessions', () => {
      // Setup a connection and session
      mockIo.on.mock.calls[0][1](mockSocket);
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      
      // Setup session data with only one user
      mockSocket.sessionId = 'session-123';
      mockSocket.userId = 'user-456';
      socketManager.sessions.set('session-123', new Set(['socket-id-123']));
      
      // Call the disconnect handler
      disconnectHandler();
      
      // Verify session was completely removed
      expect(socketManager.sessions.has('session-123')).toBe(false);
    });
  });

  describe('server close', () => {
    it('should close the Socket.IO server', () => {
      socketManager.close();
      expect(mockIo.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('WebSocket server closed');
    });
  });
});