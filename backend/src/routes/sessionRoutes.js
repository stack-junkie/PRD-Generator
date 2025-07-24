const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const SessionController = require('../controllers/SessionController');
const { validateRequest, validateSession, errorHandler, requestLogger } = require('../middleware');

const router = express.Router();

// Rate limiting: 100 requests per hour per IP
const sessionRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: {
    error: 'Too many session requests from this IP, please try again after an hour.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all session routes
router.use(sessionRateLimit);

// Apply request logging to all routes
router.use(requestLogger);

// Validation schemas
const createSessionSchema = Joi.object({
  projectName: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .required()
    .messages({
      'string.empty': 'Project name is required',
      'string.min': 'Project name must be at least 1 character long',
      'string.max': 'Project name must not exceed 100 characters'
    }),
  template: Joi.string()
    .valid('basic', 'saas', 'mobile', 'enterprise', 'startup')
    .optional()
    .messages({
      'any.only': 'Template must be one of: basic, saas, mobile, enterprise, startup'
    }),
  description: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description must not exceed 500 characters'
    })
});

const updateSessionSchema = Joi.object({
  projectName: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .optional()
    .messages({
      'string.empty': 'Project name cannot be empty',
      'string.min': 'Project name must be at least 1 character long',
      'string.max': 'Project name must not exceed 100 characters'
    }),
  lastActive: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'lastActive must be a valid ISO date'
    }),
  description: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description must not exceed 500 characters'
    }),
  metadata: Joi.object()
    .optional()
    .messages({
      'object.base': 'Metadata must be a valid object'
    })
});

const sessionIdSchema = Joi.object({
  sessionId: Joi.string()
    .uuid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'Session ID must be a valid UUID',
      'any.required': 'Session ID is required'
    })
});

// Session controller instance
const sessionController = new SessionController();

/**
 * POST /api/sessions
 * Creates a new PRD session
 */
router.post('/', 
  validateRequest(createSessionSchema),
  async (req, res, next) => {
    try {
      const { projectName, template = 'basic', description = '' } = req.body;
      
      // Create new session
      const sessionData = await sessionController.createSession({
        projectName,
        template,
        description,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        createdAt: new Date()
      });

      // Log session creation
      req.logger = req.logger || {};
      req.logger.sessionId = sessionData.sessionId;
      req.logger.action = 'session_created';

      res.status(201).json({
        success: true,
        data: {
          sessionId: sessionData.sessionId,
          projectName: sessionData.projectName,
          template: sessionData.template,
          createdAt: sessionData.createdAt,
          currentSection: sessionData.currentSection,
          progress: sessionData.progress
        },
        message: 'Session created successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sessions/:sessionId
 * Retrieves session state and progress
 */
router.get('/:sessionId',
  validateRequest(sessionIdSchema, 'params'),
  validateSession,
  async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      
      // Retrieve session data
      const sessionData = await sessionController.getSession(sessionId);

      if (!sessionData) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        });
      }

      // Update last accessed timestamp
      await sessionController.updateLastAccessed(sessionId);

      // Log session access
      req.logger = req.logger || {};
      req.logger.sessionId = sessionId;
      req.logger.action = 'session_retrieved';

      res.json({
        success: true,
        data: {
          sessionId: sessionData.sessionId,
          projectName: sessionData.projectName,
          template: sessionData.template,
          description: sessionData.description,
          currentSection: sessionData.currentSection,
          completedSections: sessionData.completedSections,
          responses: sessionData.responses,
          progress: sessionData.progress,
          createdAt: sessionData.createdAt,
          updatedAt: sessionData.updatedAt,
          lastActive: sessionData.lastActive,
          status: sessionData.status,
          metadata: sessionData.metadata
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/sessions/:sessionId
 * Updates session metadata
 */
router.put('/:sessionId',
  validateRequest(sessionIdSchema, 'params'),
  validateRequest(updateSessionSchema),
  validateSession,
  async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const updateData = {
        ...req.body,
        updatedAt: new Date(),
        lastActive: new Date()
      };

      // Update session
      const updatedSession = await sessionController.updateSession(sessionId, updateData);

      if (!updatedSession) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        });
      }

      // Log session update
      req.logger = req.logger || {};
      req.logger.sessionId = sessionId;
      req.logger.action = 'session_updated';

      res.json({
        success: true,
        data: {
          sessionId: updatedSession.sessionId,
          projectName: updatedSession.projectName,
          description: updatedSession.description,
          updatedAt: updatedSession.updatedAt,
          lastActive: updatedSession.lastActive
        },
        message: 'Session updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/sessions/:sessionId
 * Soft deletes a session
 */
router.delete('/:sessionId',
  validateRequest(sessionIdSchema, 'params'),
  validateSession,
  async (req, res, next) => {
    try {
      const { sessionId } = req.params;

      // Soft delete session
      const deletedSession = await sessionController.deleteSession(sessionId);

      if (!deletedSession) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        });
      }

      // Log session deletion
      req.logger = req.logger || {};
      req.logger.sessionId = sessionId;
      req.logger.action = 'session_deleted';

      res.json({
        success: true,
        data: {
          sessionId: deletedSession.sessionId,
          deletedAt: deletedSession.deletedAt,
          status: deletedSession.status
        },
        message: 'Session deleted successfully. Data will be permanently removed after 30 days.'
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sessions/:sessionId/export
 * Exports session data as JSON
 */
router.get('/:sessionId/export',
  validateRequest(sessionIdSchema, 'params'),
  validateSession,
  async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const format = req.query.format || 'json';

      if (!['json', 'csv'].includes(format)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid export format. Supported formats: json, csv',
          code: 'INVALID_FORMAT'
        });
      }

      // Get full session data for export
      const exportData = await sessionController.exportSession(sessionId, format);

      if (!exportData) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        });
      }

      // Set appropriate headers for download
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `prd-session-${sessionId}-${timestamp}.${format}`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.json({
          success: true,
          data: exportData,
          exportedAt: new Date(),
          format: 'json'
        });
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.send(exportData);
      }

      // Log session export
      req.logger = req.logger || {};
      req.logger.sessionId = sessionId;
      req.logger.action = 'session_exported';
      req.logger.format = format;

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sessions/:sessionId/status
 * Gets session status and basic info
 */
router.get('/:sessionId/status',
  validateRequest(sessionIdSchema, 'params'),
  validateSession,
  async (req, res, next) => {
    try {
      const { sessionId } = req.params;

      const statusData = await sessionController.getSessionStatus(sessionId);

      if (!statusData) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: {
          sessionId: statusData.sessionId,
          status: statusData.status,
          currentSection: statusData.currentSection,
          progress: statusData.progress,
          lastActive: statusData.lastActive,
          isActive: statusData.isActive
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/sessions/:sessionId/restore
 * Restores a soft-deleted session
 */
router.post('/:sessionId/restore',
  validateRequest(sessionIdSchema, 'params'),
  async (req, res, next) => {
    try {
      const { sessionId } = req.params;

      const restoredSession = await sessionController.restoreSession(sessionId);

      if (!restoredSession) {
        return res.status(404).json({
          success: false,
          error: 'Session not found or cannot be restored',
          code: 'SESSION_NOT_FOUND'
        });
      }

      // Log session restoration
      req.logger = req.logger || {};
      req.logger.sessionId = sessionId;
      req.logger.action = 'session_restored';

      res.json({
        success: true,
        data: {
          sessionId: restoredSession.sessionId,
          status: restoredSession.status,
          restoredAt: restoredSession.restoredAt
        },
        message: 'Session restored successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// Error handling middleware
router.use(errorHandler);

module.exports = router;