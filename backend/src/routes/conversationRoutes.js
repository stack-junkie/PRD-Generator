const express = require('express');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const Joi = require('joi');
const ConversationController = require('../controllers/ConversationController');
const { validateRequest, validateSession, validateSectionAccess, errorHandler, requestLogger, asyncHandler } = require('../middleware');

const router = express.Router();

// Initialize DOMPurify for server-side sanitization
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Rate limiting for conversation endpoints
const conversationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // More generous for conversation flow
  message: {
    error: 'Too many conversation requests from this IP, please try again later.',
    code: 'CONVERSATION_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply compression for large context responses
router.use(compression({
  filter: (req, res) => {
    // Compress responses for context and section endpoints
    if (req.path.includes('/context') || req.path.includes('/sections')) {
      return true;
    }
    return compression.filter(req, res);
  },
  threshold: 1024 // Only compress responses > 1KB
}));

// Apply rate limiting and logging
router.use(conversationRateLimit);
router.use(requestLogger);

// Validation schemas
const messageSchema = Joi.object({
  message: Joi.string()
    .min(1)
    .max(5000)
    .trim()
    .required()
    .messages({
      'string.empty': 'Message cannot be empty',
      'string.min': 'Message must be at least 1 character long',
      'string.max': 'Message must not exceed 5000 characters',
      'any.required': 'Message is required'
    }),
  sectionId: Joi.string()
    .valid('introduction', 'goals', 'audience', 'userStories', 'requirements', 'metrics', 'questions')
    .required()
    .messages({
      'any.only': 'Invalid section ID',
      'any.required': 'Section ID is required'
    }),
  questionId: Joi.string()
    .optional()
    .messages({
      'string.base': 'Question ID must be a string'
    }),
  context: Joi.object()
    .optional()
    .messages({
      'object.base': 'Context must be a valid object'
    })
});

const sectionUpdateSchema = Joi.object({
  responses: Joi.object()
    .optional()
    .messages({
      'object.base': 'Responses must be a valid object'
    }),
  draft: Joi.string()
    .max(10000)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Draft must not exceed 10000 characters'
    }),
  metadata: Joi.object()
    .optional()
    .messages({
      'object.base': 'Metadata must be a valid object'
    })
});

const sessionParamSchema = Joi.object({
  sessionId: Joi.string()
    .uuid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'Session ID must be a valid UUID',
      'any.required': 'Session ID is required'
    })
});

const sectionParamSchema = Joi.object({
  sessionId: Joi.string()
    .uuid({ version: ['uuidv4'] })
    .required(),
  sectionId: Joi.string()
    .valid('introduction', 'goals', 'audience', 'userStories', 'requirements', 'metrics', 'questions')
    .required()
    .messages({
      'any.only': 'Invalid section ID',
      'any.required': 'Section ID is required'
    })
});

// Conversation controller instance
const conversationController = new ConversationController();

// Message sanitization middleware
const sanitizeMessage = (req, res, next) => {
  if (req.body.message) {
    // Remove potentially dangerous HTML/script content
    req.body.message = purify.sanitize(req.body.message, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });
    
    // Additional sanitization for common XSS patterns
    req.body.message = req.body.message
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
  next();
};

/**
 * POST /api/sessions/:sessionId/messages
 * Processes user message in conversation
 */
router.post('/:sessionId/messages',
  validateRequest(sessionParamSchema, 'params'),
  validateRequest(messageSchema),
  validateSession,
  sanitizeMessage,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { message, sectionId, questionId, context = {} } = req.body;

    // Process message through conversation manager
    const result = await conversationController.processMessage(sessionId, {
      message,
      sectionId,
      questionId,
      context,
      timestamp: new Date(),
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    });

    // Log message processing
    req.logger = req.logger || {};
    req.logger.sessionId = sessionId;
    req.logger.sectionId = sectionId;
    req.logger.action = 'message_processed';
    req.logger.messageLength = message.length;

    res.json({
      success: true,
      data: {
        messageId: result.messageId,
        aiResponse: result.aiResponse,
        validation: result.validation,
        sectionComplete: result.sectionComplete,
        nextSteps: result.nextSteps,
        context: result.context,
        suggestions: result.suggestions,
        followUpQuestions: result.followUpQuestions
      },
      meta: {
        processedAt: result.processedAt,
        processingTime: result.processingTime,
        tokensUsed: result.tokensUsed
      }
    });
  })
);

/**
 * GET /api/sessions/:sessionId/context
 * Retrieves current conversation context
 */
router.get('/:sessionId/context',
  validateRequest(sessionParamSchema, 'params'),
  validateSession,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const includeHistory = req.query.includeHistory === 'true';
    const compressed = req.query.compressed === 'true';

    // Get conversation context
    const context = await conversationController.getConversationContext(sessionId, {
      includeHistory,
      compressed,
      maxMessages: parseInt(req.query.maxMessages) || 50
    });

    if (!context) {
      return res.status(404).json({
        success: false,
        error: 'Session context not found',
        code: 'CONTEXT_NOT_FOUND'
      });
    }

    // Log context retrieval
    req.logger = req.logger || {};
    req.logger.sessionId = sessionId;
    req.logger.action = 'context_retrieved';
    req.logger.compressed = compressed;

    res.json({
      success: true,
      data: {
        sessionId: context.sessionId,
        currentSection: context.currentSection,
        previousSections: context.previousSections,
        currentResponses: context.currentResponses,
        conversationHistory: context.conversationHistory,
        progress: context.progress,
        sessionMetadata: context.sessionMetadata,
        lastUpdated: context.lastUpdated
      },
      meta: {
        compressed,
        messageCount: context.conversationHistory?.length || 0,
        contextSize: JSON.stringify(context).length
      }
    });
  })
);

/**
 * POST /api/sessions/:sessionId/sections/:sectionId/validate
 * Validates current section responses
 */
router.post('/:sessionId/sections/:sectionId/validate',
  validateRequest(sectionParamSchema, 'params'),
  validateSession,
  validateSectionAccess,
  asyncHandler(async (req, res) => {
    const { sessionId, sectionId } = req.params;
    const forceValidation = req.query.force === 'true';

    // Validate section
    const validation = await conversationController.validateSection(sessionId, sectionId, {
      forceValidation,
      includeDetails: true,
      includeSuggestions: true
    });

    if (!validation) {
      return res.status(404).json({
        success: false,
        error: 'Section not found or cannot be validated',
        code: 'SECTION_VALIDATION_FAILED'
      });
    }

    // Log validation
    req.logger = req.logger || {};
    req.logger.sessionId = sessionId;
    req.logger.sectionId = sectionId;
    req.logger.action = 'section_validated';
    req.logger.valid = validation.valid;

    res.json({
      success: true,
      data: {
        valid: validation.valid,
        sectionId: validation.sectionId,
        details: validation.details,
        suggestions: validation.suggestions,
        missingRequired: validation.missingRequired,
        qualityScores: validation.qualityScores,
        completionPercentage: validation.completionPercentage,
        canProceedToNext: validation.canProceedToNext
      },
      meta: {
        validatedAt: validation.validatedAt,
        forceValidation
      }
    });
  })
);

/**
 * GET /api/sessions/:sessionId/sections/:sectionId
 * Retrieves section details and progress
 */
router.get('/:sessionId/sections/:sectionId',
  validateRequest(sectionParamSchema, 'params'),
  validateSession,
  validateSectionAccess,
  asyncHandler(async (req, res) => {
    const { sessionId, sectionId } = req.params;
    const includeValidation = req.query.includeValidation !== 'false';
    const includeHistory = req.query.includeHistory === 'true';

    // Get section data
    const section = await conversationController.getSection(sessionId, sectionId, {
      includeValidation,
      includeHistory,
      includeQuestions: true
    });

    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found',
        code: 'SECTION_NOT_FOUND'
      });
    }

    // Log section retrieval
    req.logger = req.logger || {};
    req.logger.sessionId = sessionId;
    req.logger.sectionId = sectionId;
    req.logger.action = 'section_retrieved';

    res.json({
      success: true,
      data: {
        sectionId: section.sectionId,
        name: section.name,
        description: section.description,
        questions: section.questions,
        responses: section.responses,
        validationState: section.validationState,
        progress: section.progress,
        status: section.status,
        conversationHistory: section.conversationHistory,
        draft: section.draft,
        metadata: section.metadata,
        createdAt: section.createdAt,
        updatedAt: section.updatedAt
      },
      meta: {
        questionCount: section.questions?.length || 0,
        responseCount: Object.keys(section.responses || {}).length,
        completionPercentage: section.progress?.completionPercentage || 0
      }
    });
  })
);

/**
 * PUT /api/sessions/:sessionId/sections/:sectionId
 * Updates section content directly
 */
router.put('/:sessionId/sections/:sectionId',
  validateRequest(sectionParamSchema, 'params'),
  validateRequest(sectionUpdateSchema),
  validateSession,
  validateSectionAccess,
  asyncHandler(async (req, res) => {
    const { sessionId, sectionId } = req.params;
    const { responses, draft, metadata } = req.body;

    // Update section
    const updatedSection = await conversationController.updateSection(sessionId, sectionId, {
      responses,
      draft,
      metadata,
      updatedBy: 'user', // vs 'ai'
      updatedAt: new Date()
    });

    if (!updatedSection) {
      return res.status(404).json({
        success: false,
        error: 'Section not found or cannot be updated',
        code: 'SECTION_UPDATE_FAILED'
      });
    }

    // Log section update
    req.logger = req.logger || {};
    req.logger.sessionId = sessionId;
    req.logger.sectionId = sectionId;
    req.logger.action = 'section_updated';
    req.logger.updateType = responses ? 'responses' : (draft ? 'draft' : 'metadata');

    res.json({
      success: true,
      data: {
        sectionId: updatedSection.sectionId,
        responses: updatedSection.responses,
        draft: updatedSection.draft,
        metadata: updatedSection.metadata,
        updatedAt: updatedSection.updatedAt,
        validationState: updatedSection.validationState,
        progress: updatedSection.progress
      },
      message: 'Section updated successfully'
    });
  })
);

/**
 * GET /api/sessions/:sessionId/sections/:sectionId/history
 * Retrieves section conversation history
 */
router.get('/:sessionId/sections/:sectionId/history',
  validateRequest(sectionParamSchema, 'params'),
  validateSession,
  validateSectionAccess,
  asyncHandler(async (req, res) => {
    const { sessionId, sectionId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const includeValidation = req.query.includeValidation === 'true';

    // Get section history
    const history = await conversationController.getSectionHistory(sessionId, sectionId, {
      limit,
      offset,
      includeValidation
    });

    // Log history retrieval
    req.logger = req.logger || {};
    req.logger.sessionId = sessionId;
    req.logger.sectionId = sectionId;
    req.logger.action = 'section_history_retrieved';

    res.json({
      success: true,
      data: {
        sectionId,
        messages: history.messages,
        totalCount: history.totalCount,
        hasMore: history.hasMore
      },
      meta: {
        limit,
        offset,
        count: history.messages.length
      }
    });
  })
);

/**
 * POST /api/sessions/:sessionId/sections/:sectionId/complete
 * Marks section as complete and transitions to next
 */
router.post('/:sessionId/sections/:sectionId/complete',
  validateRequest(sectionParamSchema, 'params'),
  validateSession,
  validateSectionAccess,
  asyncHandler(async (req, res) => {
    const { sessionId, sectionId } = req.params;
    const forceComplete = req.query.force === 'true';

    // Complete section
    const result = await conversationController.completeSection(sessionId, sectionId, {
      forceComplete,
      generateSummary: true
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'SECTION_COMPLETION_FAILED',
        details: result.details
      });
    }

    // Log section completion
    req.logger = req.logger || {};
    req.logger.sessionId = sessionId;
    req.logger.sectionId = sectionId;
    req.logger.action = 'section_completed';
    req.logger.forced = forceComplete;

    res.json({
      success: true,
      data: {
        completedSection: result.completedSection,
        nextSection: result.nextSection,
        summary: result.summary,
        progress: result.progress,
        completedAt: result.completedAt
      },
      message: `Section ${sectionId} completed successfully`
    });
  })
);

/**
 * WebSocket upgrade preparation endpoint
 * GET /api/sessions/:sessionId/ws-token
 * Generates token for WebSocket connection
 */
router.get('/:sessionId/ws-token',
  validateRequest(sessionParamSchema, 'params'),
  validateSession,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    // Generate WebSocket token (for future real-time updates)
    const wsToken = await conversationController.generateWebSocketToken(sessionId, {
      expiresIn: '1h',
      permissions: ['read', 'write'],
      clientInfo: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    res.json({
      success: true,
      data: {
        token: wsToken.token,
        expiresAt: wsToken.expiresAt,
        wsUrl: `${process.env.WS_BASE_URL}/conversations/${sessionId}`
      },
      message: 'WebSocket token generated successfully'
    });
  })
);

// Error handling middleware
router.use(errorHandler);

module.exports = router;