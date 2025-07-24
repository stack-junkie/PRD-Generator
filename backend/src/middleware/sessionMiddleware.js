/**
 * Session Middleware
 * Provides middleware functions for session validation and activity tracking
 */

const SessionManager = require('../services/SessionManager');
const logger = require('../utils/logger');

// Initialize SessionManager instance
const sessionManager = new SessionManager();

/**
 * Middleware to validate session existence and status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateSession = async (req, res, next) => {
  const sessionId = req.params.sessionId || req.body.sessionId || req.query.sessionId;
  
  if (!sessionId) {
    logger.warn('Session validation failed: No sessionId provided');
    return res.status(400).json({
      success: false,
      error: 'Session ID is required'
    });
  }
  
  try {
    // Use SessionManager to validate the session
    const validation = await sessionManager.validateSession(sessionId);
    
    if (!validation) {
      logger.warn('Session validation failed: Invalid or expired session', { sessionId });
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired session'
      });
    }
    
    // Add session data to request for downstream use
    req.sessionId = sessionId;
    req.sessionData = validation;
    
    next();
  } catch (error) {
    logger.error('Session validation error', {
      error: error.message,
      stack: error.stack,
      sessionId
    });
    
    return res.status(500).json({
      success: false,
      error: 'Session validation failed'
    });
  }
};

/**
 * Middleware to automatically update session activity timestamp
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const updateSessionActivity = async (req, res, next) => {
  const sessionId = req.sessionId || req.params.sessionId || req.body.sessionId || req.query.sessionId;
  
  if (!sessionId) {
    // If no sessionId, just continue
    return next();
  }
  
  try {
    // Use SessionManager to update last accessed timestamp
    // We don't wait for this to complete to avoid delaying the response
    sessionManager.updateLastAccessed(sessionId)
      .catch(err => {
        logger.error('Error updating session activity', {
          error: err.message,
          sessionId
        });
      });
    
    // Continue with request processing
    next();
  } catch (error) {
    // Log error but continue with request
    logger.error('Session activity update error', {
      error: error.message,
      sessionId
    });
    next();
  }
};

/**
 * Apply session validation and activity tracking to a route
 * @param {Object} router - Express router
 * @param {string} path - Route path
 * @param {Function} handler - Route handler
 * @param {string} method - HTTP method (get, post, put, delete)
 */
const withSessionValidation = (router, path, handler, method = 'get') => {
  router[method](path, validateSession, updateSessionActivity, handler);
};

module.exports = {
  validateSession,
  updateSessionActivity,
  withSessionValidation
};