/**
 * WebSocket Manager
 * 
 * This module handles WebSocket connections using Socket.IO.
 * It provides real-time communication capabilities for:
 * - Streaming AI responses
 * - Sending validation updates
 * - Notifying about section completions
 * - Supporting collaborative editing
 * 
 * @module websocket/socketManager
 */

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');

/**
 * SocketManager class for handling WebSocket connections
 */
class SocketManager {
  /**
   * Create a SocketManager instance
   * @param {Object} options - Configuration options
   * @param {Object} options.httpServer - HTTP server instance to attach Socket.IO to
   * @param {Object} options.redisClient - Redis client instance
   * @param {Object} options.pubClient - Redis publisher client (optional)
   * @param {Object} options.logger - Logger instance
   */
  constructor({ httpServer, redisClient, pubClient, logger }) {
    this.httpServer = httpServer;
    this.redisClient = redisClient;
    this.pubClient = pubClient || redisClient.duplicate();
    this.logger = logger;
    this.io = null;
    this.sessions = new Map(); // Track active sessions and their users
    
    this.initialize();
  }

  /**
   * Initialize the Socket.IO server
   */
  initialize() {
    try {
      // Create Socket.IO server with CORS configuration
      this.io = new Server(this.httpServer, {
        cors: {
          origin: process.env.ALLOWED_ORIGINS.split(','),
          methods: ['GET', 'POST'],
          credentials: true
        },
        // Add adapter for horizontal scaling (when using multiple server instances)
        // adapter: createAdapter(this.pubClient, this.redisClient)
      });

      // Set up connection handler
      this.io.on('connection', this.handleConnection.bind(this));
      
      this.logger.info('WebSocket server initialized');
    } catch (error) {
      this.logger.error(`Error initializing WebSocket server: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle new socket connections
   * @param {Object} socket - Socket.IO socket instance
   */
  handleConnection(socket) {
    this.logger.info(`New WebSocket connection: ${socket.id}`);

    // Handle session joining
    socket.on('join-session', this.handleJoinSession.bind(this, socket));
    
    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });

    // Handle errors
    socket.on('error', (error) => {
      this.logger.error(`Socket error: ${error.message}`, { socketId: socket.id });
    });
  }

  /**
   * Handle a user joining a session
   * @param {Object} socket - Socket.IO socket instance
   * @param {Object} data - Join session data
   * @param {string} data.sessionId - Session ID to join
   * @param {string} data.userId - User ID (optional)
   * @param {Function} callback - Acknowledgement callback
   */
  handleJoinSession(socket, { sessionId, userId }, callback) {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      // Authenticate user (in a real app, you would validate the session ID)
      // For now, we'll trust the provided sessionId
      
      // Join the session room
      const roomName = `session:${sessionId}`;
      socket.join(roomName);
      
      // Store user data
      socket.sessionId = sessionId;
      socket.userId = userId || socket.id;
      
      // Update sessions map
      if (!this.sessions.has(sessionId)) {
        this.sessions.set(sessionId, new Set());
      }
      this.sessions.get(sessionId).add(socket.id);
      
      this.logger.info(`Socket ${socket.id} joined session ${sessionId}`);
      
      // Notify other users in the session
      socket.to(roomName).emit('user-joined', {
        userId: socket.userId,
        timestamp: new Date()
      });
      
      // Send acknowledgement if callback provided
      if (callback && typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      this.logger.error(`Error joining session: ${error.message}`, { socketId: socket.id });
      
      // Send error if callback provided
      if (callback && typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  }

  /**
   * Handle socket disconnection
   * @param {Object} socket - Socket.IO socket instance
   */
  handleDisconnect(socket) {
    this.logger.info(`WebSocket disconnected: ${socket.id}`);
    
    // Remove from sessions
    if (socket.sessionId && this.sessions.has(socket.sessionId)) {
      const sessionUsers = this.sessions.get(socket.sessionId);
      sessionUsers.delete(socket.id);
      
      // If no users left in session, clean up
      if (sessionUsers.size === 0) {
        this.sessions.delete(socket.sessionId);
      } else {
        // Notify other users in the session
        const roomName = `session:${socket.sessionId}`;
        socket.to(roomName).emit('user-left', {
          userId: socket.userId || socket.id,
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Send a message chunk to a specific session
   * @param {string} sessionId - Session ID
   * @param {Object} data - Message data
   */
  sendMessageChunk(sessionId, data) {
    try {
      const roomName = `session:${sessionId}`;
      this.io.to(roomName).emit('message-chunk', {
        ...data,
        timestamp: new Date()
      });
      
      this.logger.debug(`Sent message chunk to session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error sending message chunk: ${error.message}`, { sessionId });
    }
  }

  /**
   * Send a validation update to a specific session
   * @param {string} sessionId - Session ID
   * @param {Object} data - Validation data
   */
  sendValidationUpdate(sessionId, data) {
    try {
      const roomName = `session:${sessionId}`;
      this.io.to(roomName).emit('validation-update', {
        ...data,
        timestamp: new Date()
      });
      
      this.logger.debug(`Sent validation update to session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error sending validation update: ${error.message}`, { sessionId });
    }
  }

  /**
   * Send a section completion notification to a specific session
   * @param {string} sessionId - Session ID
   * @param {Object} data - Section completion data
   */
  sendSectionComplete(sessionId, data) {
    try {
      const roomName = `session:${sessionId}`;
      this.io.to(roomName).emit('section-complete', {
        ...data,
        timestamp: new Date()
      });
      
      this.logger.info(`Sent section completion notification to session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error sending section completion: ${error.message}`, { sessionId });
    }
  }

  /**
   * Send an error message to a specific session
   * @param {string} sessionId - Session ID
   * @param {Object} data - Error data
   */
  sendError(sessionId, data) {
    try {
      const roomName = `session:${sessionId}`;
      this.io.to(roomName).emit('error', {
        ...data,
        timestamp: new Date()
      });
      
      this.logger.error(`Sent error to session ${sessionId}: ${data.message}`);
    } catch (error) {
      this.logger.error(`Error sending error notification: ${error.message}`, { sessionId });
    }
  }

  /**
   * Get active connections count for a session
   * @param {string} sessionId - Session ID
   * @returns {number} Number of active connections
   */
  getSessionConnectionCount(sessionId) {
    if (!this.sessions.has(sessionId)) {
      return 0;
    }
    return this.sessions.get(sessionId).size;
  }

  /**
   * Get all active sessions
   * @returns {Array} Array of session IDs
   */
  getActiveSessions() {
    return Array.from(this.sessions.keys());
  }

  /**
   * Close all connections and shut down the server
   */
  close() {
    if (this.io) {
      this.io.close();
      this.logger.info('WebSocket server closed');
    }
  }
}

module.exports = SocketManager;