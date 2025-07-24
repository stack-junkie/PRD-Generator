/**
 * SessionManager Service
 * Manages session state across Redis cache and database
 * Provides atomic operations for session data
 */

const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { sequelize } = require('../models');

class SessionManager {
  constructor(models = null, config = {}) {
    // Dependency injection for models
    this.models = models || require('../models');
    this.UserSession = this.models.UserSession;
    this.Section = this.models.Section;
    this.PRDDocument = this.models.PRDDocument;
    this.ConversationMessage = this.models.ConversationMessage;
    
    // Default section structure
    this.sectionStructure = [
      'introduction',
      'goals',
      'audience',
      'userStories',
      'requirements',
      'metrics',
      'questions'
    ];

    // Redis client configuration
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || '',
      db: process.env.REDIS_DB || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      ...config.redis
    };

    // Session TTL in Redis (default: 1 day)
    this.sessionTTL = config.sessionTTL || 86400;
    
    // Initialize Redis client
    this._initRedisClient();
  }

  /**
   * Initialize Redis client
   * @private
   */
  _initRedisClient() {
    try {
      this.redis = new Redis(this.redisConfig);
      
      this.redis.on('error', (err) => {
        logger.error('Redis connection error:', err);
        // Fallback to in-memory cache if Redis is unavailable
        this._initFallbackCache();
      });
      
      this.redis.on('connect', () => {
        logger.info('Redis connected successfully');
        this.useRedis = true;
      });
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      // Fallback to in-memory cache
      this._initFallbackCache();
    }
  }

  /**
   * Initialize fallback in-memory cache using node-cache
   * @private
   */
  _initFallbackCache() {
    logger.warn('Using in-memory cache as Redis fallback');
    const NodeCache = require('node-cache');
    this.fallbackCache = new NodeCache({ stdTTL: this.sessionTTL });
    this.useRedis = false;
  }

  /**
   * Set cache value with TTL
   * @private
   * @param {string} key - Cache key
   * @param {Object} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   */
  async _setCacheValue(key, value, ttl = this.sessionTTL) {
    try {
      const serialized = JSON.stringify(value);
      
      if (this.useRedis) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        this.fallbackCache.set(key, serialized, ttl);
      }
      
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Get cached value
   * @private
   * @param {string} key - Cache key
   * @returns {Promise<Object|null>} Cached value or null
   */
  async _getCacheValue(key) {
    try {
      let serialized;
      
      if (this.useRedis) {
        serialized = await this.redis.get(key);
      } else {
        serialized = this.fallbackCache.get(key);
      }
      
      if (!serialized) {
        return null;
      }
      
      return JSON.parse(serialized);
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Delete cached value
   * @private
   * @param {string} key - Cache key
   */
  async _deleteCacheValue(key) {
    try {
      if (this.useRedis) {
        await this.redis.del(key);
      } else {
        this.fallbackCache.del(key);
      }
      
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Generate session cache key
   * @private
   * @param {string} sessionId - Session ID
   * @returns {string} Cache key
   */
  _getSessionCacheKey(sessionId) {
    return `session:${sessionId}`;
  }

  /**
   * Generate session state cache key
   * @private
   * @param {string} sessionId - Session ID
   * @returns {string} Cache key
   */
  _getSessionStateCacheKey(sessionId) {
    return `session:state:${sessionId}`;
  }

  /**
   * Initialize a new session
   * @param {Object} sessionData - Session creation data
   * @returns {Promise<Object>} Created session with state
   */
  async initializeSession(sessionData) {
    logger.info('Initializing new session', { projectName: sessionData.projectName });
    
    // Generate session ID if not provided
    const sessionId = sessionData.sessionId || uuidv4();
    
    // Start a database transaction
    const transaction = await sequelize.transaction();
    
    try {
      // Create the user session
      const session = await this.UserSession.create({
        sessionId,
        projectName: sessionData.projectName,
        description: sessionData.description || '',
        currentSection: 0,
        createdAt: new Date(),
        lastActive: new Date(),
        status: 'active',
        userId: sessionData.userId || null
      }, { transaction });
      
      // Initialize section records
      await this._initializeSections(sessionId, transaction);
      
      // Create initial PRD document
      await this.PRDDocument.create({
        sessionId,
        sections: {},
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          version: '1.0.0',
          template: sessionData.template || 'basic'
        }
      }, { transaction });
      
      // Add system message to conversation
      await this.ConversationMessage.create({
        sessionId,
        role: 'system',
        content: `Session created for project: ${sessionData.projectName}`,
        metadata: {
          event: 'session_created',
          template: sessionData.template || 'basic'
        },
        createdAt: new Date()
      }, { transaction });
      
      // Commit transaction
      await transaction.commit();
      
      // Prepare session state for cache
      const sessionState = {
        sessionId,
        currentSection: 0,
        lastActivity: new Date().toISOString(),
        validationStates: {},
        contextCache: {}
      };
      
      // Cache session state in Redis
      await this._setCacheValue(
        this._getSessionStateCacheKey(sessionId),
        sessionState,
        this.sessionTTL
      );
      
      // Return the session data with initial state
      return {
        sessionId,
        projectName: session.projectName,
        template: sessionData.template || 'basic',
        description: session.description,
        createdAt: session.createdAt,
        currentSection: session.currentSection,
        progress: {
          currentSection: 0,
          totalSections: this.sectionStructure.length,
          percentComplete: 0
        },
        state: sessionState
      };
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      
      logger.error('Error initializing session', {
        error: error.message,
        stack: error.stack,
        projectName: sessionData.projectName
      });
      throw error;
    }
  }

  /**
   * Initialize section records for a session
   * @private
   * @param {string} sessionId - Session ID
   * @param {Transaction} transaction - Sequelize transaction
   */
  async _initializeSections(sessionId, transaction) {
    try {
      // Create section records for each section in the structure
      const sectionPromises = this.sectionStructure.map((name, index) => {
        return this.Section.create({
          sessionId,
          name,
          completionStatus: false,
          sectionContent: '',
          validationState: {
            overallComplete: false,
            questionStates: {},
            userConsent: false
          }
        }, { transaction });
      });
      
      await Promise.all(sectionPromises);
    } catch (error) {
      logger.error('Error initializing sections', {
        error: error.message,
        sessionId
      });
      throw error;
    }
  }

  /**
   * Get session by ID from cache or database
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session data
   */
  async getSession(sessionId) {
    logger.info('Retrieving session', { sessionId, source: 'cache-first' });
    
    try {
      // Try to get from cache first
      const cachedSession = await this._getCacheValue(this._getSessionCacheKey(sessionId));
      
      if (cachedSession) {
        logger.debug('Session retrieved from cache', { sessionId });
        
        // Refresh TTL on access
        await this._setCacheValue(
          this._getSessionCacheKey(sessionId),
          cachedSession,
          this.sessionTTL
        );
        
        return cachedSession;
      }
      
      // If not in cache, get from database
      const dbSession = await this._getSessionFromDB(sessionId);
      
      if (!dbSession) {
        return null;
      }
      
      // Cache the session for future requests
      await this._setCacheValue(
        this._getSessionCacheKey(sessionId),
        dbSession,
        this.sessionTTL
      );
      
      return dbSession;
    } catch (error) {
      logger.error('Error retrieving session', {
        error: error.message,
        stack: error.stack,
        sessionId
      });
      throw error;
    }
  }

  /**
   * Get session state from cache
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session state
   */
  async getSessionState(sessionId) {
    logger.debug('Retrieving session state', { sessionId });
    
    try {
      // Get from cache
      const state = await this._getCacheValue(this._getSessionStateCacheKey(sessionId));
      
      if (!state) {
        // If no state in cache, create default state
        const defaultState = {
          sessionId,
          currentSection: 0,
          lastActivity: new Date().toISOString(),
          validationStates: {},
          contextCache: {}
        };
        
        // Save default state to cache
        await this._setCacheValue(
          this._getSessionStateCacheKey(sessionId),
          defaultState,
          this.sessionTTL
        );
        
        return defaultState;
      }
      
      return state;
    } catch (error) {
      logger.error('Error retrieving session state', {
        error: error.message,
        sessionId
      });
      return null;
    }
  }

  /**
   * Update session state in cache
   * @param {string} sessionId - Session ID
   * @param {Object} updates - State updates
   * @returns {Promise<Object|null>} Updated session state
   */
  async updateSessionState(sessionId, updates) {
    logger.debug('Updating session state', { sessionId, updateFields: Object.keys(updates) });
    
    try {
      // Get current state
      const currentState = await this.getSessionState(sessionId);
      
      if (!currentState) {
        return null;
      }
      
      // Update state
      const newState = {
        ...currentState,
        ...updates,
        lastActivity: new Date().toISOString()
      };
      
      // Save to cache
      await this._setCacheValue(
        this._getSessionStateCacheKey(sessionId),
        newState,
        this.sessionTTL
      );
      
      return newState;
    } catch (error) {
      logger.error('Error updating session state', {
        error: error.message,
        sessionId
      });
      return null;
    }
  }

  /**
   * Get session from database with related data
   * @private
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session data
   */
  async _getSessionFromDB(sessionId) {
    try {
      // Get the session record
      const session = await this.UserSession.findOne({
        where: { sessionId },
        include: [
          {
            model: this.Section,
            as: 'completedSections'
          }
        ]
      });
      
      if (!session) {
        return null;
      }
      
      // Get sections data
      const sections = await this.Section.findAll({
        where: { sessionId },
        order: [['id', 'ASC']]
      });
      
      // Convert to response format
      const completedSections = sections
        .filter(section => section.completionStatus)
        .map(section => section.name);
      
      // Get responses data
      const responses = {};
      sections.forEach(section => {
        if (section.sectionContent) {
          responses[section.name] = { content: section.sectionContent };
        }
      });
      
      // Calculate progress
      const progress = {
        completedSections: completedSections.length,
        totalSections: this.sectionStructure.length,
        percentComplete: Math.round((completedSections.length / this.sectionStructure.length) * 100)
      };
      
      return {
        sessionId: session.sessionId,
        projectName: session.projectName,
        description: session.description,
        currentSection: session.currentSection,
        completedSections,
        responses,
        progress,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt || session.lastActive,
        lastActive: session.lastActive,
        status: session.status,
        metadata: {
          template: session.template || 'basic'
        }
      };
    } catch (error) {
      logger.error('Error getting session from DB', {
        error: error.message,
        sessionId
      });
      throw error;
    }
  }

  /**
   * Update session metadata and refresh cache
   * @param {string} sessionId - Session ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>} Updated session data
   */
  async updateSession(sessionId, updateData) {
    logger.info('Updating session', { sessionId, updateFields: Object.keys(updateData) });
    
    try {
      // Start a transaction
      const transaction = await sequelize.transaction();
      
      try {
        const session = await this.UserSession.findOne({
          where: { sessionId },
          transaction
        });
        
        if (!session) {
          await transaction.rollback();
          return null;
        }
        
        // Update allowed fields
        const allowedFields = ['projectName', 'description', 'lastActive', 'currentSection'];
        const updateFields = {};
        
        allowedFields.forEach(field => {
          if (updateData[field] !== undefined) {
            updateFields[field] = updateData[field];
          }
        });
        
        // Always update lastActive
        updateFields.lastActive = updateData.lastActive || new Date();
        
        // Update the session
        await session.update(updateFields, { transaction });
        
        // Commit transaction
        await transaction.commit();
        
        // Get updated session
        const updatedSession = await this._getSessionFromDB(sessionId);
        
        // Update cache
        if (updatedSession) {
          await this._setCacheValue(
            this._getSessionCacheKey(sessionId),
            updatedSession,
            this.sessionTTL
          );
          
          // Update session state in cache
          await this.updateSessionState(sessionId, {
            currentSection: updatedSession.currentSection,
          });
        }
        
        return updatedSession;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      logger.error('Error updating session', {
        error: error.message,
        stack: error.stack,
        sessionId
      });
      throw error;
    }
  }

  /**
   * Update last accessed timestamp
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} Success indicator
   */
  async updateLastAccessed(sessionId) {
    try {
      // Update in database
      const success = await this._updateLastAccessedInDB(sessionId);
      
      if (success) {
        // Update in cache
        await this.updateSessionState(sessionId, {
          lastActivity: new Date().toISOString()
        });
      }
      
      return success;
    } catch (error) {
      logger.error('Error updating last accessed', {
        error: error.message,
        sessionId
      });
      return false;
    }
  }

  /**
   * Update last accessed timestamp in database
   * @private
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} Success indicator
   */
  async _updateLastAccessedInDB(sessionId) {
    try {
      const session = await this.UserSession.findOne({
        where: { sessionId }
      });
      
      if (!session) {
        return false;
      }
      
      await session.update({ lastActive: new Date() });
      return true;
    } catch (error) {
      logger.error('Error updating last accessed in DB', {
        error: error.message,
        sessionId
      });
      return false;
    }
  }
  
  /**
   * Validate session existence and status
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session basic info or null if invalid
   */
  async validateSession(sessionId) {
    logger.debug('Validating session', { sessionId });
    
    try {
      // Try to get from cache first
      const cachedState = await this._getCacheValue(this._getSessionStateCacheKey(sessionId));
      
      if (cachedState) {
        // Update last activity
        await this.updateSessionState(sessionId, {
          lastActivity: new Date().toISOString()
        });
        
        return {
          sessionId,
          valid: true,
          currentSection: cachedState.currentSection
        };
      }
      
      // Not in cache, check database
      const session = await this.UserSession.findOne({
        where: { 
          sessionId,
          status: 'active'
        },
        attributes: ['sessionId', 'currentSection', 'lastActive']
      });
      
      if (!session) {
        return null;
      }
      
      // Session exists in DB but not in cache, initialize cache
      const defaultState = {
        sessionId,
        currentSection: session.currentSection,
        lastActivity: new Date().toISOString(),
        validationStates: {},
        contextCache: {}
      };
      
      await this._setCacheValue(
        this._getSessionStateCacheKey(sessionId),
        defaultState,
        this.sessionTTL
      );
      
      // Update last accessed
      await this._updateLastAccessedInDB(sessionId);
      
      return {
        sessionId,
        valid: true,
        currentSection: session.currentSection
      };
    } catch (error) {
      logger.error('Error validating session', {
        error: error.message,
        sessionId
      });
      return null;
    }
  }
  
  /**
   * Close Redis connection
   */
  async closeConnection() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

module.exports = SessionManager;