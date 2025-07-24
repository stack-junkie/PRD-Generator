/**
 * Session Controller
 * Handles all session CRUD operations for PRD generator
 */

// Import dependencies
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger'); // Assuming a winston-based logger
const SessionManager = require('../services/SessionManager');

class SessionController {
  constructor(models = null, config = {}) {
    // Dependency injection for models
    this.models = models || require('../models');
    this.UserSession = this.models.UserSession;
    this.Section = this.models.Section;
    this.PRDDocument = this.models.PRDDocument;
    this.ConversationMessage = this.models.ConversationMessage;
    
    // Initialize the SessionManager service
    this.sessionManager = new SessionManager(models, config);
    
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
  }

  /**
   * Create a new PRD session
   * @param {Object} sessionData - Session creation data
   * @returns {Promise<Object>} Created session data
   */
  async createSession(sessionData) {
    logger.info('Creating new session', { projectName: sessionData.projectName });
    
    try {
      // Use SessionManager to initialize a new session with all related data
      // This handles DB transactions, section initialization, and Redis caching
      const sessionResult = await this.sessionManager.initializeSession(sessionData);
      
      // Return the created session data
      // We'll exclude the internal state from the API response
      const { state, ...sessionResponse } = sessionResult;
      
      return sessionResponse;
    } catch (error) {
      logger.error('Error creating session', {
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
   */
  async initializeSections(sessionId) {
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
        });
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
   * Get session by ID with all related data
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session data with related entities
   */
  async getSession(sessionId) {
    logger.info('Retrieving session', { sessionId });
    
    try {
      // Use SessionManager to get session data (cache-first approach)
      const session = await this.sessionManager.getSession(sessionId);
      
      if (!session) {
        logger.warn('Session not found', { sessionId });
        return null;
      }
      
      return session;
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
   * Update session metadata
   * @param {string} sessionId - Session ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated session data
   */
  async updateSession(sessionId, updateData) {
    logger.info('Updating session', { sessionId, updateFields: Object.keys(updateData) });
    
    try {
      // Use SessionManager to update session (handles DB & cache updates)
      const updatedSession = await this.sessionManager.updateSession(sessionId, updateData);
      
      if (!updatedSession) {
        logger.warn('Session not found for update', { sessionId });
        return null;
      }
      
      return updatedSession;
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
      // Use SessionManager to update last accessed timestamp
      // This updates both DB and cache
      const success = await this.sessionManager.updateLastAccessed(sessionId);
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
   * Soft delete a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Deleted session data
   */
  async deleteSession(sessionId) {
    logger.info('Deleting session', { sessionId });
    
    try {
      const session = await this.UserSession.findOne({
        where: { sessionId }
      });
      
      if (!session) {
        logger.warn('Session not found for deletion', { sessionId });
        return null;
      }
      
      // Soft delete - update status and record deletion time
      await session.update({
        status: 'archived',
        lastActive: new Date(),
      });
      
      // Add system message about deletion
      await this.ConversationMessage.create({
        sessionId,
        role: 'system',
        content: 'Session marked for deletion. Will be permanently removed after 30 days.',
        metadata: {
          event: 'session_deleted',
          deletedAt: new Date()
        },
        createdAt: new Date()
      });
      
      return {
        sessionId: session.sessionId,
        deletedAt: new Date(),
        status: 'archived'
      };
    } catch (error) {
      logger.error('Error deleting session', {
        error: error.message,
        stack: error.stack,
        sessionId
      });
      throw error;
    }
  }
  
  /**
   * List sessions with pagination
   * @param {Object} options - List options (userId, limit, offset, etc.)
   * @returns {Promise<Object>} Paginated sessions list
   */
  async listSessions(options = {}) {
    const { 
      userId = null,
      limit = 10,
      offset = 0,
      status = 'active',
      sortBy = 'lastActive',
      sortDir = 'DESC'
    } = options;
    
    logger.info('Listing sessions', { userId, limit, offset, status });
    
    try {
      // Build query conditions
      const where = {};
      
      if (userId) {
        where.userId = userId;
      }
      
      if (status) {
        where.status = status;
      }
      
      // Query with pagination
      const { count, rows } = await this.UserSession.findAndCountAll({
        where,
        limit,
        offset,
        order: [[sortBy, sortDir]],
      });
      
      // Format response
      const sessions = rows.map(session => ({
        sessionId: session.sessionId,
        projectName: session.projectName,
        createdAt: session.createdAt,
        lastActive: session.lastActive,
        status: session.status,
        currentSection: session.currentSection
      }));
      
      return {
        sessions,
        pagination: {
          total: count,
          limit,
          offset,
          hasMore: offset + rows.length < count
        }
      };
    } catch (error) {
      logger.error('Error listing sessions', {
        error: error.message,
        stack: error.stack,
        userId
      });
      throw error;
    }
  }
  
  /**
   * Export session data in specified format
   * @param {string} sessionId - Session ID
   * @param {string} format - Export format (json or csv)
   * @returns {Promise<Object|string>} Exported data
   */
  async exportSession(sessionId, format = 'json') {
    logger.info('Exporting session', { sessionId, format });
    
    try {
      // Get complete session data
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return null;
      }
      
      // Get all conversation messages
      const messages = await this.ConversationMessage.findAll({
        where: { sessionId },
        order: [['createdAt', 'ASC']]
      });
      
      // Compile export data
      const exportData = {
        sessionInfo: {
          sessionId: session.sessionId,
          projectName: session.projectName,
          description: session.description,
          createdAt: session.createdAt,
          lastActive: session.lastActive,
          status: session.status
        },
        progress: session.progress,
        sections: session.completedSections,
        responses: session.responses,
        conversation: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt,
          metadata: msg.metadata
        })),
        exportedAt: new Date()
      };
      
      // Format based on requested type
      if (format === 'json') {
        return exportData;
      } else if (format === 'csv') {
        // Simple CSV conversion for demo
        // In a real implementation, would use a CSV library
        let csv = 'SessionId,ProjectName,Description,CreatedAt,Status\n';
        csv += `${session.sessionId},${session.projectName},"${session.description}",${session.createdAt},${session.status}\n\n`;
        
        csv += 'Section,Status,Content\n';
        for (const section of this.sectionStructure) {
          const completed = session.completedSections.includes(section);
          const content = session.responses[section]?.content || '';
          csv += `${section},${completed ? 'Completed' : 'Incomplete'},"${content.replace(/"/g, '""')}"\n`;
        }
        
        return csv;
      }
      
      return null;
    } catch (error) {
      logger.error('Error exporting session', {
        error: error.message,
        stack: error.stack,
        sessionId,
        format
      });
      throw error;
    }
  }
  
  /**
   * Get session status and basic info
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session status
   */
  async getSessionStatus(sessionId) {
    try {
      // First validate session existence
      const validation = await this.sessionManager.validateSession(sessionId);
      
      if (!validation) {
        return null;
      }
      
      // Get full session data
      const session = await this.sessionManager.getSession(sessionId);
      
      if (!session) {
        return null;
      }
      
      // Check if session is still active (within 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const isActive = new Date(session.lastActive) > thirtyDaysAgo;
      
      return {
        sessionId: session.sessionId,
        status: session.status,
        currentSection: session.currentSection,
        progress: session.progress,
        lastActive: session.lastActive,
        isActive
      };
    } catch (error) {
      logger.error('Error getting session status', {
        error: error.message,
        sessionId
      });
      throw error;
    }
  }
  
  /**
   * Restore a soft-deleted session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Restored session data
   */
  async restoreSession(sessionId) {
    logger.info('Restoring session', { sessionId });
    
    try {
      const session = await this.UserSession.findOne({
        where: { sessionId }
      });
      
      if (!session || session.status !== 'archived') {
        logger.warn('Session not found or not archived', { sessionId, status: session?.status });
        return null;
      }
      
      // Update status back to active
      await session.update({
        status: 'active',
        lastActive: new Date()
      });
      
      // Add system message about restoration
      await this.ConversationMessage.create({
        sessionId,
        role: 'system',
        content: 'Session has been restored.',
        metadata: {
          event: 'session_restored',
          restoredAt: new Date()
        },
        createdAt: new Date()
      });
      
      return {
        sessionId: session.sessionId,
        status: 'active',
        restoredAt: new Date()
      };
    } catch (error) {
      logger.error('Error restoring session', {
        error: error.message,
        stack: error.stack,
        sessionId
      });
      throw error;
    }
  }
  
  /**
   * Close Redis connection on server shutdown
   */
  async closeConnections() {
    await this.sessionManager.closeConnection();
  }
}

module.exports = SessionController;