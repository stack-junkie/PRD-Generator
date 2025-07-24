/**
 * Conversation Controller
 * Manages chat interactions, section validation, and progression
 */

// Import dependencies
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class ConversationController {
  constructor(models = null, services = null) {
    // Dependency injection for models
    this.models = models || require('../models');
    this.UserSession = this.models.UserSession;
    this.ConversationMessage = this.models.ConversationMessage;
    this.Section = this.models.Section;
    this.Question = this.models.Question;
    this.Response = this.models.Response;
    
    // Initialize services
    const ValidationEngine = require('../services/ValidationEngine');
    const QualityScorer = require('../services/QualityScorer');
    const ConversationManager = require('../services/ConversationManager');
    
    this.validationEngine = services?.validationEngine || new ValidationEngine();
    this.qualityScorer = services?.qualityScorer || new QualityScorer();
    this.conversationManager = services?.conversationManager || 
      new ConversationManager(this.validationEngine, this.qualityScorer);
    
    // JWT secret for WebSocket tokens
    this.jwtSecret = process.env.JWT_SECRET || 'prd-maker-secret-key';
  }
  
  /**
   * Process user message through ConversationManager
   * @param {string} sessionId - Session ID
   * @param {Object} messageData - Message data (message, sectionId, etc.)
   * @returns {Promise<Object>} Processing result with AI response
   */
  async processMessage(sessionId, messageData) {
    const startTime = Date.now();
    logger.info('Processing message', { 
      sessionId, 
      sectionId: messageData.sectionId,
      messageLength: messageData.message.length 
    });
    
    try {
      // Validate session exists and is active
      const session = await this.UserSession.findOne({
        where: { 
          sessionId,
          status: 'active'
        }
      });
      
      if (!session) {
        throw new Error(`Session not found or inactive: ${sessionId}`);
      }
      
      // Get the section
      const section = await this.Section.findOne({
        where: {
          sessionId,
          name: messageData.sectionId
        }
      });
      
      if (!section) {
        throw new Error(`Section not found: ${messageData.sectionId}`);
      }
      
      // Store user message
      const userMessage = await this.ConversationMessage.create({
        id: uuidv4(),
        sessionId,
        role: 'user',
        content: messageData.message,
        metadata: {
          section: messageData.sectionId,
          questionId: messageData.questionId || null,
          timestamp: messageData.timestamp || new Date(),
          userAgent: messageData.userAgent || null,
          ipAddress: messageData.ipAddress || null
        },
        createdAt: new Date()
      });
      
      // Initialize conversation manager state if needed
      if (!this.conversationManager.state.currentSection) {
        this.conversationManager.initializeSection(messageData.sectionId, messageData.context || {});
      }
      
      // Process message through conversation manager
      const questionContext = {
        fieldName: messageData.questionId || 'default',
        section: messageData.sectionId
      };
      
      const processingResult = await this.conversationManager.processUserInput(
        messageData.message,
        messageData.sectionId,
        questionContext
      );
      
      // Prepare AI response based on processing result
      const aiResponse = this.generateAIResponse(processingResult, messageData);
      
      // Store AI response message
      const assistantMessage = await this.ConversationMessage.create({
        id: uuidv4(),
        sessionId,
        role: 'assistant',
        content: aiResponse,
        metadata: {
          section: messageData.sectionId,
          questionId: messageData.questionId || null,
          validation: processingResult.validation,
          sectionComplete: processingResult.sectionComplete,
          nextAction: processingResult.nextAction,
          processingTime: Date.now() - startTime
        },
        createdAt: new Date()
      });
      
      // Update section state based on processing
      await this.updateSectionState(section, processingResult, messageData);
      
      // Check if we need to update session state
      if (processingResult.sectionComplete) {
        await this.updateSessionProgress(session, messageData.sectionId);
      }
      
      // Calculate token usage (simplified)
      const tokensUsed = {
        prompt: Math.ceil(messageData.message.length / 4),
        completion: Math.ceil(aiResponse.length / 4),
        total: Math.ceil((messageData.message.length + aiResponse.length) / 4)
      };
      
      // Return processing result
      return {
        messageId: assistantMessage.id,
        aiResponse,
        validation: processingResult.validation,
        sectionComplete: processingResult.sectionComplete,
        nextSteps: this.determineNextSteps(processingResult),
        context: processingResult.context,
        suggestions: this.generateSuggestions(processingResult, messageData),
        followUpQuestions: this.generateFollowUpQuestions(processingResult, messageData),
        processedAt: new Date(),
        processingTime: Date.now() - startTime,
        tokensUsed
      };
    } catch (error) {
      logger.error('Error processing message', {
        error: error.message,
        stack: error.stack,
        sessionId,
        sectionId: messageData.sectionId
      });
      throw error;
    }
  }
  
  /**
   * Generate AI response based on processing result
   * @private
   * @param {Object} result - Processing result
   * @param {Object} messageData - Original message data
   * @returns {string} AI response
   */
  generateAIResponse(result, messageData) {
    // Basic response generation
    // In a real implementation, this would use an LLM or template system
    let response = '';
    
    if (result.validation && !result.validation.passed) {
      response += `I noticed some issues with your response:\n`;
      result.validation.issues.forEach(issue => {
        response += `- ${issue}\n`;
      });
      response += `\nPlease provide more details to address these points.`;
    } else if (result.sectionComplete) {
      response += `Great! We've completed the "${messageData.sectionId}" section. `;
      response += `Here's a summary of what we've covered:\n\n`;
      
      // Add section summary
      Object.entries(result.context.currentResponses).forEach(([key, value]) => {
        response += `- ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}\n`;
      });
      
      response += `\nWould you like to proceed to the next section?`;
    } else {
      response += `Thanks for your input about "${messageData.questionId || 'this topic'}". `;
      
      if (result.nextAction === 'followup') {
        response += `Could you elaborate a bit more? `;
        if (result.validation.suggestions && result.validation.suggestions.length > 0) {
          response += `Consider: ${result.validation.suggestions[0]}`;
        }
      } else {
        response += `That's helpful information. `;
        response += `Let's continue with the next question for this section.`;
      }
    }
    
    return response;
  }
  
  /**
   * Update section state based on processing result
   * @private
   * @param {Object} section - Section model instance
   * @param {Object} result - Processing result
   * @param {Object} messageData - Original message data
   */
  async updateSectionState(section, result, messageData) {
    // Update section content if needed
    if (result.response && messageData.questionId) {
      let sectionContent = section.sectionContent ? JSON.parse(section.sectionContent) : {};
      sectionContent[messageData.questionId] = result.response;
      
      await section.update({
        sectionContent: JSON.stringify(sectionContent),
        validationState: {
          ...section.validationState,
          questionStates: {
            ...(section.validationState.questionStates || {}),
            [messageData.questionId]: {
              answered: true,
              validation: result.validation,
              timestamp: new Date()
            }
          }
        }
      });
    }
    
    // Update completion status if section is complete
    if (result.sectionComplete && !section.completionStatus) {
      await section.update({
        completionStatus: true,
        validationState: {
          ...section.validationState,
          overallComplete: true,
          completedAt: new Date()
        }
      });
    }
  }
  
  /**
   * Update session progress when section completes
   * @private
   * @param {Object} session - UserSession model instance
   * @param {string} completedSectionId - Completed section ID
   */
  async updateSessionProgress(session, completedSectionId) {
    // Get all sections to calculate progress
    const sections = await this.Section.findAll({
      where: { sessionId: session.sessionId }
    });
    
    const completedCount = sections.filter(s => s.completionStatus).length;
    const totalSections = sections.length;
    
    // Find next section index
    const sectionOrder = [
      'introduction', 'goals', 'audience', 'userStories', 
      'requirements', 'metrics', 'questions'
    ];
    
    const currentIndex = sectionOrder.indexOf(completedSectionId);
    const nextIndex = currentIndex + 1;
    
    // Update session
    await session.update({
      currentSection: nextIndex < sectionOrder.length ? nextIndex : currentIndex,
      lastActive: new Date()
    });
  }
  
  /**
   * Determine next steps based on processing result
   * @private
   * @param {Object} result - Processing result
   * @returns {Object} Next steps instructions
   */
  determineNextSteps(result) {
    if (result.sectionComplete) {
      return {
        action: 'complete_section',
        nextSection: this.getNextSection(result.context.currentSection),
        suggestions: [
          'Review section content before proceeding',
          'Move to next section',
          'Export current progress'
        ]
      };
    }
    
    if (result.nextAction === 'followup') {
      return {
        action: 'refine_response',
        suggestions: result.validation.suggestions || [],
        questionId: result.questionId
      };
    }
    
    return {
      action: 'continue',
      suggestions: [
        'Continue with next question',
        'Review previous responses',
        'Request help with current question'
      ]
    };
  }
  
  /**
   * Get the next section name
   * @private
   * @param {string} currentSection - Current section name
   * @returns {string} Next section name
   */
  getNextSection(currentSection) {
    const sectionOrder = [
      'introduction', 'goals', 'audience', 'userStories', 
      'requirements', 'metrics', 'questions'
    ];
    
    const currentIndex = sectionOrder.indexOf(currentSection);
    if (currentIndex < 0 || currentIndex >= sectionOrder.length - 1) {
      return null;
    }
    
    return sectionOrder[currentIndex + 1];
  }
  
  /**
   * Generate context-specific suggestions
   * @private
   * @param {Object} result - Processing result
   * @param {Object} messageData - Original message data
   * @returns {Array} Suggestions
   */
  generateSuggestions(result, messageData) {
    // Basic suggestions generation
    const suggestions = [];
    
    if (result.validation && !result.validation.passed) {
      suggestions.push(...(result.validation.suggestions || []));
    } else if (messageData.sectionId === 'introduction') {
      suggestions.push(
        'Describe your product in more detail',
        'Explain who your target users are',
        'Mention key competitors'
      );
    } else if (messageData.sectionId === 'goals') {
      suggestions.push(
        'Add specific, measurable goals',
        'Include business objectives',
        'Consider different timeframes (short vs long term)'
      );
    } else if (messageData.sectionId === 'requirements') {
      suggestions.push(
        'Add functional requirements',
        'Consider non-functional requirements like performance',
        'Prioritize requirements (must-have vs nice-to-have)'
      );
    }
    
    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }
  
  /**
   * Generate follow-up questions
   * @private
   * @param {Object} result - Processing result
   * @param {Object} messageData - Original message data
   * @returns {Array} Follow-up questions
   */
  generateFollowUpQuestions(result, messageData) {
    // Basic follow-up questions generation
    const questions = [];
    
    if (messageData.sectionId === 'introduction') {
      questions.push(
        'What problem does your product solve?',
        'Who are your main competitors?',
        'What makes your product unique?'
      );
    } else if (messageData.sectionId === 'goals') {
      questions.push(
        'What metrics will you use to measure success?',
        'What is your timeline for achieving these goals?',
        'How do these goals align with your business strategy?'
      );
    } else if (messageData.sectionId === 'audience') {
      questions.push(
        'What are the key demographics of your users?',
        'What are their primary pain points?',
        'How tech-savvy are your target users?'
      );
    }
    
    return questions.slice(0, 2); // Limit to 2 questions
  }
  
  /**
   * Retrieve conversation history
   * @param {string} sessionId - Session ID
   * @param {Object} options - Query options (limit, offset, etc.)
   * @returns {Promise<Object>} Paginated messages
   */
  async getMessages(sessionId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      sectionId = null,
      includeMetadata = false
    } = options;
    
    logger.info('Retrieving messages', { sessionId, limit, offset, sectionId });
    
    try {
      // Build query conditions
      const where = { sessionId };
      
      if (sectionId) {
        where['metadata.section'] = sectionId;
      }
      
      // Get messages with pagination
      const { count, rows } = await this.ConversationMessage.findAndCountAll({
        where,
        order: [['createdAt', 'ASC']],
        limit,
        offset
      });
      
      // Format messages for response
      const messages = rows.map(message => {
        const formattedMessage = {
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt
        };
        
        if (includeMetadata) {
          formattedMessage.metadata = message.metadata;
        }
        
        return formattedMessage;
      });
      
      return {
        messages,
        totalCount: count,
        hasMore: offset + messages.length < count
      };
    } catch (error) {
      logger.error('Error retrieving messages', {
        error: error.message,
        stack: error.stack,
        sessionId
      });
      throw error;
    }
  }
  
  /**
   * Validate section completion
   * @param {string} sessionId - Session ID
   * @param {string} sectionId - Section ID
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateSection(sessionId, sectionId, options = {}) {
    const {
      forceValidation = false,
      includeDetails = true,
      includeSuggestions = true
    } = options;
    
    logger.info('Validating section', { sessionId, sectionId, forceValidation });
    
    try {
      // Get section data
      const section = await this.Section.findOne({
        where: {
          sessionId,
          name: sectionId
        }
      });
      
      if (!section) {
        return null;
      }
      
      // Parse section content
      let sectionResponses = {};
      if (section.sectionContent) {
        try {
          sectionResponses = JSON.parse(section.sectionContent);
        } catch (e) {
          logger.warn('Error parsing section content', {
            error: e.message,
            sectionId,
            content: section.sectionContent
          });
        }
      }
      
      // Use validation engine to validate section
      const validationResult = this.validationEngine.validateSection(
        sectionId,
        sectionResponses
      );
      
      // Calculate quality scores if requested
      let qualityScores = null;
      if (this.qualityScorer && includeDetails) {
        qualityScores = await this.qualityScorer.scoreSection(
          sectionId,
          sectionResponses
        );
      }
      
      // Determine if section can proceed
      const canProceedToNext = forceValidation || 
        validationResult.overall || 
        (section.validationState && section.validationState.userConsent);
      
      // Calculate completion percentage
      const questions = Object.keys(this.conversationManager.sectionQuestions[sectionId] || {});
      const answeredQuestions = Object.keys(sectionResponses).length;
      const completionPercentage = questions.length > 0 ? 
        Math.round((answeredQuestions / questions.length) * 100) : 0;
      
      // Update section validation state
      await section.update({
        validationState: {
          ...section.validationState,
          lastValidated: new Date(),
          overallComplete: validationResult.overall,
          forceValidated: forceValidation,
          completionPercentage
        }
      });
      
      // Return validation result
      const result = {
        valid: validationResult.overall,
        sectionId,
        validatedAt: new Date(),
        canProceedToNext,
        completionPercentage
      };
      
      if (includeDetails) {
        result.details = validationResult.details;
        result.missingRequired = validationResult.missingRequired || [];
        result.qualityScores = qualityScores;
      }
      
      if (includeSuggestions) {
        result.suggestions = this.generateValidationSuggestions(
          sectionId,
          validationResult,
          sectionResponses
        );
      }
      
      return result;
    } catch (error) {
      logger.error('Error validating section', {
        error: error.message,
        stack: error.stack,
        sessionId,
        sectionId
      });
      throw error;
    }
  }
  
  /**
   * Generate validation-specific suggestions
   * @private
   * @param {string} sectionId - Section ID
   * @param {Object} validation - Validation result
   * @param {Object} responses - Section responses
   * @returns {Array} Suggestions
   */
  generateValidationSuggestions(sectionId, validation, responses) {
    const suggestions = [];
    
    // Add suggestions based on missing required fields
    if (validation.missingRequired && validation.missingRequired.length > 0) {
      validation.missingRequired.forEach(field => {
        suggestions.push(`Add information about "${field}"`);
      });
    }
    
    // Add suggestions based on section-specific requirements
    if (sectionId === 'introduction' && !responses.problemStatement) {
      suggestions.push('Clearly state the problem your product solves');
    } else if (sectionId === 'goals' && (!responses.businessObjectives || !responses.successMetrics)) {
      suggestions.push('Define clear business objectives and success metrics');
    } else if (sectionId === 'audience' && !responses.userNeeds) {
      suggestions.push('Describe your users\' key needs and pain points');
    }
    
    // Add general improvement suggestions if section is technically valid
    if (validation.overall) {
      suggestions.push(
        'Review for clarity and completeness',
        'Consider adding concrete examples',
        'Ensure alignment with overall product vision'
      );
    }
    
    return suggestions;
  }
  
  /**
   * Get section details and responses
   * @param {string} sessionId - Session ID
   * @param {string} sectionId - Section ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Section data
   */
  async getSection(sessionId, sectionId, options = {}) {
    const {
      includeValidation = true,
      includeHistory = false,
      includeQuestions = false
    } = options;
    
    logger.info('Retrieving section', { sessionId, sectionId });
    
    try {
      // Get section data
      const section = await this.Section.findOne({
        where: {
          sessionId,
          name: sectionId
        }
      });
      
      if (!section) {
        return null;
      }
      
      // Parse section content
      let responses = {};
      if (section.sectionContent) {
        try {
          responses = JSON.parse(section.sectionContent);
        } catch (e) {
          logger.warn('Error parsing section content', {
            error: e.message,
            sectionId,
            content: section.sectionContent
          });
        }
      }
      
      // Build result object
      const result = {
        sectionId: section.name,
        name: section.name,
        status: section.completionStatus ? 'completed' : 'in_progress',
        responses,
        createdAt: section.createdAt,
        updatedAt: section.updatedAt
      };
      
      // Add validation state if requested
      if (includeValidation) {
        result.validationState = section.validationState;
        
        // If section is not yet validated, do a validation
        if (!section.validationState || !section.validationState.lastValidated) {
          const validation = await this.validateSection(sessionId, sectionId, {
            includeDetails: true,
            includeSuggestions: true
          });
          
          if (validation) {
            result.validationState = {
              ...section.validationState,
              lastValidated: validation.validatedAt,
              details: validation.details,
              completionPercentage: validation.completionPercentage
            };
          }
        }
      }
      
      // Add section progress
      result.progress = {
        completionPercentage: 
          section.validationState?.completionPercentage || 0,
        isComplete: section.completionStatus
      };
      
      // Add questions if requested
      if (includeQuestions) {
        result.questions = this.conversationManager.sectionQuestions[sectionId] || [];
        
        // Mark questions as answered based on responses
        result.questions = result.questions.map(question => ({
          ...question,
          answered: !!responses[question.fieldName]
        }));
      }
      
      // Add conversation history if requested
      if (includeHistory) {
        const history = await this.getMessages(sessionId, {
          sectionId,
          limit: 20,
          includeMetadata: false
        });
        
        result.conversationHistory = history.messages;
      }
      
      // Add draft content (in Markdown format)
      result.draft = this.generateSectionDraft(sectionId, responses);
      
      return result;
    } catch (error) {
      logger.error('Error retrieving section', {
        error: error.message,
        stack: error.stack,
        sessionId,
        sectionId
      });
      throw error;
    }
  }
  
  /**
   * Generate draft content for a section
   * @private
   * @param {string} sectionId - Section ID
   * @param {Object} responses - Section responses
   * @returns {string} Markdown draft
   */
  generateSectionDraft(sectionId, responses) {
    let draft = '';
    
    // Generate section-specific markdown
    switch (sectionId) {
      case 'introduction':
        draft = `# Introduction\n\n`;
        if (responses.productDescription) {
          draft += `## Product Description\n\n${responses.productDescription}\n\n`;
        }
        if (responses.problemStatement) {
          draft += `## Problem Statement\n\n${responses.problemStatement}\n\n`;
        }
        if (responses.targetMarket) {
          draft += `## Target Market\n\n${responses.targetMarket}\n\n`;
        }
        break;
        
      case 'goals':
        draft = `# Goals and Objectives\n\n`;
        if (responses.businessObjectives) {
          draft += `## Business Objectives\n\n${responses.businessObjectives}\n\n`;
        }
        if (responses.successMetrics) {
          draft += `## Success Metrics\n\n${responses.successMetrics}\n\n`;
        }
        break;
        
      case 'audience':
        draft = `# Target Audience\n\n`;
        if (responses.primaryUsers) {
          draft += `## Primary Users\n\n${responses.primaryUsers}\n\n`;
        }
        if (responses.userNeeds) {
          draft += `## User Needs and Pain Points\n\n${responses.userNeeds}\n\n`;
        }
        break;
        
      case 'userStories':
        draft = `# User Stories\n\n`;
        if (responses.coreStories) {
          draft += responses.coreStories
            .split('\n')
            .map(story => `- ${story}`)
            .join('\n');
        }
        break;
        
      case 'requirements':
        draft = `# Requirements\n\n`;
        if (responses.functionalReqs) {
          draft += `## Functional Requirements\n\n${responses.functionalReqs}\n\n`;
        }
        if (responses.nonFunctionalReqs) {
          draft += `## Non-Functional Requirements\n\n${responses.nonFunctionalReqs}\n\n`;
        }
        break;
        
      case 'metrics':
        draft = `# Success Metrics\n\n`;
        if (responses.kpis) {
          draft += `## Key Performance Indicators\n\n${responses.kpis}\n\n`;
        }
        break;
        
      case 'questions':
        draft = `# Open Questions\n\n`;
        if (responses.openQuestions) {
          draft += responses.openQuestions
            .split('\n')
            .map(question => `- ${question}`)
            .join('\n');
        }
        break;
        
      default:
        draft = `# ${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}\n\n`;
        
        // Generic handling for any responses
        Object.entries(responses).forEach(([key, value]) => {
          const title = key.replace(/([A-Z])/g, ' $1').trim();
          draft += `## ${title.charAt(0).toUpperCase() + title.slice(1)}\n\n${value}\n\n`;
        });
    }
    
    return draft;
  }
  
  /**
   * Update section content directly
   * @param {string} sessionId - Session ID
   * @param {string} sectionId - Section ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated section
   */
  async updateSection(sessionId, sectionId, updateData) {
    logger.info('Updating section', { 
      sessionId, 
      sectionId, 
      updateType: Object.keys(updateData).join(',')
    });
    
    try {
      // Get section
      const section = await this.Section.findOne({
        where: {
          sessionId,
          name: sectionId
        }
      });
      
      if (!section) {
        return null;
      }
      
      // Update section based on provided data
      const updates = {};
      
      // Handle responses update
      if (updateData.responses) {
        let currentContent = {};
        if (section.sectionContent) {
          try {
            currentContent = JSON.parse(section.sectionContent);
          } catch (e) {
            logger.warn('Error parsing existing section content', {
              error: e.message,
              sectionId
            });
          }
        }
        
        // Merge new responses with existing ones
        const mergedContent = {
          ...currentContent,
          ...updateData.responses
        };
        
        updates.sectionContent = JSON.stringify(mergedContent);
      }
      
      // Handle direct draft updates
      if (updateData.draft) {
        // Store draft in metadata or related field
        if (!section.validationState) {
          section.validationState = {};
        }
        
        updates.validationState = {
          ...section.validationState,
          draft: updateData.draft,
          updatedByUser: true,
          lastEdited: new Date()
        };
      }
      
      // Handle metadata updates
      if (updateData.metadata) {
        if (!section.validationState) {
          section.validationState = {};
        }
        
        updates.validationState = {
          ...section.validationState,
          metadata: {
            ...(section.validationState.metadata || {}),
            ...updateData.metadata
          }
        };
      }
      
      // Update the section
      if (Object.keys(updates).length > 0) {
        await section.update(updates);
        
        // Add system message about the update
        await this.ConversationMessage.create({
          id: uuidv4(),
          sessionId,
          role: 'system',
          content: `Section "${sectionId}" updated directly by user.`,
          metadata: {
            section: sectionId,
            updateType: Object.keys(updateData).join(','),
            updatedAt: new Date(),
            updatedBy: updateData.updatedBy || 'user'
          },
          createdAt: new Date()
        });
        
        // Get updated section data
        return this.getSection(sessionId, sectionId, {
          includeValidation: true,
          includeQuestions: true
        });
      }
      
      return null;
    } catch (error) {
      logger.error('Error updating section', {
        error: error.message,
        stack: error.stack,
        sessionId,
        sectionId
      });
      throw error;
    }
  }
  
  /**
   * Get section conversation history
   * @param {string} sessionId - Session ID
   * @param {string} sectionId - Section ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Section history
   */
  async getSectionHistory(sessionId, sectionId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      includeValidation = false
    } = options;
    
    try {
      // Use getMessages with section filter
      const history = await this.getMessages(sessionId, {
        limit,
        offset,
        sectionId,
        includeMetadata: includeValidation
      });
      
      return history;
    } catch (error) {
      logger.error('Error retrieving section history', {
        error: error.message,
        stack: error.stack,
        sessionId,
        sectionId
      });
      throw error;
    }
  }
  
  /**
   * Mark section as complete and transition to next
   * @param {string} sessionId - Session ID
   * @param {string} sectionId - Section ID
   * @param {Object} options - Completion options
   * @returns {Promise<Object>} Completion result
   */
  async completeSection(sessionId, sectionId, options = {}) {
    const {
      forceComplete = false,
      generateSummary = true
    } = options;
    
    logger.info('Completing section', { sessionId, sectionId, forceComplete });
    
    try {
      // Validate section can be completed
      const validation = await this.validateSection(sessionId, sectionId, {
        forceValidation: forceComplete,
        includeDetails: true
      });
      
      if (!validation) {
        return {
          success: false,
          error: 'Section not found',
          details: null
        };
      }
      
      if (!validation.canProceedToNext && !forceComplete) {
        return {
          success: false,
          error: 'Section validation failed',
          details: validation.details
        };
      }
      
      // Get section data
      const section = await this.Section.findOne({
        where: {
          sessionId,
          name: sectionId
        }
      });
      
      // Mark section as complete
      await section.update({
        completionStatus: true,
        validationState: {
          ...section.validationState,
          overallComplete: true,
          userConsent: true,
          completedAt: new Date()
        }
      });
      
      // Update conversation manager state
      this.conversationManager.completeSection(sectionId);
      
      // Determine next section
      const nextSectionId = this.getNextSection(sectionId);
      
      // Update session progress
      const session = await this.UserSession.findOne({
        where: { sessionId }
      });
      
      await this.updateSessionProgress(session, sectionId);
      
      // Generate section summary
      let summary = null;
      if (generateSummary) {
        summary = await this.generateSectionSummary(sessionId, sectionId, section);
      }
      
      // Initialize next section if available
      let nextSection = null;
      if (nextSectionId) {
        // Find next section
        nextSection = await this.Section.findOne({
          where: {
            sessionId,
            name: nextSectionId
          }
        });
        
        // Initialize conversation manager for next section
        if (nextSection) {
          this.conversationManager.initializeSection(nextSectionId, {
            previousSections: this.conversationManager.getPreviousSectionsData()
          });
        }
      }
      
      // Get session progress
      const progress = this.conversationManager.calculateProgress();
      
      // Return completion result
      return {
        success: true,
        completedSection: {
          sectionId,
          completedAt: new Date()
        },
        nextSection: nextSection ? {
          sectionId: nextSection.name,
          name: nextSection.name,
          questions: this.conversationManager.sectionQuestions[nextSectionId] || []
        } : null,
        summary,
        progress,
        completedAt: new Date()
      };
    } catch (error) {
      logger.error('Error completing section', {
        error: error.message,
        stack: error.stack,
        sessionId,
        sectionId
      });
      
      return {
        success: false,
        error: error.message,
        details: { stack: error.stack }
      };
    }
  }
  
  /**
   * Generate summary for a completed section
   * @private
   * @param {string} sessionId - Session ID
   * @param {string} sectionId - Section ID
   * @param {Object} section - Section model instance
   * @returns {Promise<Object>} Section summary
   */
  async generateSectionSummary(sessionId, sectionId, section) {
    try {
      // Parse section content
      let responses = {};
      if (section.sectionContent) {
        try {
          responses = JSON.parse(section.sectionContent);
        } catch (e) {
          logger.warn('Error parsing section content for summary', {
            error: e.message,
            sectionId
          });
        }
      }
      
      // Generate draft content
      const draft = this.generateSectionDraft(sectionId, responses);
      
      // Create summary message
      const summaryMessage = await this.ConversationMessage.create({
        id: uuidv4(),
        sessionId,
        role: 'assistant',
        content: `Section "${sectionId}" completed successfully. Here's a summary:\n\n${draft}`,
        metadata: {
          section: sectionId,
          summary: true,
          completedAt: new Date()
        },
        createdAt: new Date()
      });
      
      // Return summary data
      return {
        sectionId,
        content: draft,
        messageId: summaryMessage.id,
        responses: Object.keys(responses).length,
        completedAt: new Date()
      };
    } catch (error) {
      logger.warn('Error generating section summary', {
        error: error.message,
        sectionId
      });
      
      return {
        sectionId,
        content: `Section "${sectionId}" completed.`,
        error: error.message
      };
    }
  }
  
  /**
   * Get current conversation context
   * @param {string} sessionId - Session ID
   * @param {Object} options - Context options
   * @returns {Promise<Object>} Conversation context
   */
  async getConversationContext(sessionId, options = {}) {
    const {
      includeHistory = false,
      compressed = false,
      maxMessages = 50
    } = options;
    
    logger.info('Retrieving conversation context', { sessionId, includeHistory });
    
    try {
      // Get session data
      const session = await this.UserSession.findOne({
        where: { sessionId }
      });
      
      if (!session) {
        return null;
      }
      
      // Get sections data
      const sections = await this.Section.findAll({
        where: { sessionId },
        order: [['id', 'ASC']]
      });
      
      // Parse section content and build responses
      const responses = {};
      const previousSections = {};
      
      sections.forEach(section => {
        if (section.sectionContent) {
          try {
            const content = JSON.parse(section.sectionContent);
            responses[section.name] = content;
            
            if (section.completionStatus) {
              previousSections[section.name] = content;
            }
          } catch (e) {
            logger.warn('Error parsing section content for context', {
              error: e.message,
              section: section.name
            });
          }
        }
      });
      
      // Get conversation history if requested
      let conversationHistory = [];
      if (includeHistory) {
        const history = await this.getMessages(sessionId, {
          limit: maxMessages,
          includeMetadata: true
        });
        
        conversationHistory = history.messages;
        
        // Compress history if requested
        if (compressed) {
          conversationHistory = this.conversationManager.compressConversation(conversationHistory);
        }
      }
      
      // Calculate progress
      const completedSections = sections.filter(s => s.completionStatus).length;
      const progress = {
        completedSections,
        totalSections: sections.length,
        percentComplete: Math.round((completedSections / sections.length) * 100)
      };
      
      // Build context object
      return {
        sessionId,
        currentSection: this.conversationManager.state.currentSection || 
          session.currentSection ? sections[session.currentSection]?.name : null,
        previousSections,
        currentResponses: this.conversationManager.state.currentSection ? 
          responses[this.conversationManager.state.currentSection] || {} : {},
        conversationHistory,
        progress,
        sessionMetadata: {
          projectName: session.projectName,
          createdAt: session.createdAt,
          lastActive: session.lastActive
        },
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error retrieving conversation context', {
        error: error.message,
        stack: error.stack,
        sessionId
      });
      throw error;
    }
  }
  
  /**
   * Generate token for WebSocket connection
   * @param {string} sessionId - Session ID
   * @param {Object} options - Token options
   * @returns {Promise<Object>} Token data
   */
  async generateWebSocketToken(sessionId, options = {}) {
    const {
      expiresIn = '1h',
      permissions = ['read'],
      clientInfo = {}
    } = options;
    
    logger.info('Generating WebSocket token', { sessionId, expiresIn });
    
    try {
      // Validate session exists
      const session = await this.UserSession.findOne({
        where: { 
          sessionId,
          status: 'active'
        }
      });
      
      if (!session) {
        throw new Error(`Session not found or inactive: ${sessionId}`);
      }
      
      // Generate JWT token
      const payload = {
        sessionId,
        permissions,
        clientInfo: {
          userAgent: clientInfo.userAgent || null,
          ipAddress: clientInfo.ipAddress || null,
          timestamp: new Date()
        }
      };
      
      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn
      });
      
      // Calculate expiration time
      const expiresAt = new Date();
      if (expiresIn.endsWith('h')) {
        expiresAt.setHours(expiresAt.getHours() + parseInt(expiresIn));
      } else if (expiresIn.endsWith('m')) {
        expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(expiresIn));
      } else if (expiresIn.endsWith('s')) {
        expiresAt.setSeconds(expiresAt.getSeconds() + parseInt(expiresIn));
      } else {
        // Default to 1 hour
        expiresAt.setHours(expiresAt.getHours() + 1);
      }
      
      return {
        token,
        expiresAt,
        sessionId,
        permissions
      };
    } catch (error) {
      logger.error('Error generating WebSocket token', {
        error: error.message,
        stack: error.stack,
        sessionId
      });
      throw error;
    }
  }
}

module.exports = ConversationController;