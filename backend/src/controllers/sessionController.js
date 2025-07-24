/**
 * Session Controller
 * Handles all session CRUD operations for PRD generator
 */

// Import dependencies
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger'); // Assuming a winston-based logger

class SessionController {
  constructor(models = null) {
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
  }

  /**
   * Create a new PRD session
   * @param {Object} sessionData - Session creation data
   * @returns {Promise<Object>} Created session data
   */
  async createSession(sessionData) {
    logger.info('Creating new session', { projectName: sessionData.projectName });
    
    try {
      // Create the user session
      const session = await this.UserSession.create({
        sessionId: uuidv4(),
        projectName: sessionData.projectName,
        description: sessionData.description || '',
        currentSection: 0,
        createdAt: new Date(),
        lastActive: new Date(),
        status: 'active',
        userId: sessionData.userId || null
      });
      
      // Initialize section records for this session
      await this.initializeSections(session.sessionId);
      
      // Create initial PRD document
      await this.PRDDocument.create({
        sessionId: session.sessionId,
        sections: {},
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          version: '1.0.0',
          template: sessionData.template || 'basic'
        }
      });
      
      // Add system message to conversation
      await this.ConversationMessage.create({
        sessionId: session.sessionId,
        role: 'system',
        content: `Session created for project: ${sessionData.projectName}`,
        metadata: {
          event: 'session_created',
          template: sessionData.template || 'basic'
        },
        createdAt: new Date()
      });
      
      // Return the created session with additional metadata
      return {
        sessionId: session.sessionId,
        projectName: session.projectName,
        template: sessionData.template || 'basic',
        description: session.description,
        createdAt: session.createdAt,
        currentSection: session.currentSection,
        progress: {
          currentSection: 0,
          totalSections: this.sectionStructure.length,
          percentComplete: 0
        }
      };
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
        logger.warn('Session not found', { sessionId });
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
      
      // Get responses data - could be expanded in a real implementation
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
      const session = await this.UserSession.findOne({
        where: { sessionId }
      });
      
      if (!session) {
        logger.warn('Session not found for update', { sessionId });
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
      await session.update(updateFields);
      
      // Return updated session data
      return {
        sessionId: session.sessionId,
        projectName: session.projectName,
        description: session.description,
        updatedAt: new Date(),
        lastActive: session.lastActive,
        currentSection: session.currentSection,
        status: session.status
      };
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
      const session = await this.UserSession.findOne({
        where: { sessionId }
      });
      
      if (!session) {
        return false;
      }
      
      await session.update({ lastActive: new Date() });
      return true;
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
      const session = await this.UserSession.findOne({
        where: { sessionId },
        attributes: ['sessionId', 'currentSection', 'lastActive', 'status']
      });
      
      if (!session) {
        return null;
      }
      
      // Calculate basic progress info
      const sections = await this.Section.findAll({
        where: { sessionId },
        attributes: ['name', 'completionStatus']
      });
      
      const completedSections = sections.filter(s => s.completionStatus).length;
      const progress = {
        completedSections,
        totalSections: this.sectionStructure.length,
        percentComplete: Math.round((completedSections / this.sectionStructure.length) * 100)
      };
      
      // Check if session is still active (within 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const isActive = session.lastActive > thirtyDaysAgo;
      
      return {
        sessionId: session.sessionId,
        status: session.status,
        currentSection: session.currentSection,
        progress,
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
}

module.exports = SessionController;