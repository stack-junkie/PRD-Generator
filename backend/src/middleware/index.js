/**
 * Middleware exports
 * Centralizes all middleware functions for easy importing
 */

const { validateSession, updateSessionActivity, withSessionValidation } = require('./sessionMiddleware');

// Validation middleware for request validation
const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'body' ? req.body : 
                 source === 'params' ? req.params : 
                 source === 'query' ? req.query : req.body;
    
    const { error, value } = schema.validate(data, { abortEarly: false });
    
    if (error) {
      const details = error.details.map(detail => ({
        message: detail.message,
        path: detail.path
      }));
      
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details,
        code: 'VALIDATION_ERROR'
      });
    }
    
    // Replace the request data with the validated data
    if (source === 'body') req.body = value;
    if (source === 'params') req.params = value;
    if (source === 'query') req.query = value;
    
    next();
  };
};

// Request logger middleware
const requestLogger = (req, res, next) => {
  req.requestStartTime = Date.now();
  
  // Log on response finish
  res.on('finish', () => {
    const logger = require('../utils/logger');
    const responseTime = Date.now() - req.requestStartTime;
    
    logger.info('Request processed', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      ...(req.logger || {}),
    });
  });
  
  next();
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  const logger = require('../utils/logger');
  
  logger.error('Error in request', {
    error: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    ...(req.logger || {}),
  });
  
  // Default error response
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: err.code || 'SERVER_ERROR'
  });
};

module.exports = {
  validateSession,
  updateSessionActivity,
  withSessionValidation,
  validateRequest,
  requestLogger,
  errorHandler
};