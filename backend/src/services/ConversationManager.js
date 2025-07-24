class ConversationManager {
  constructor(validationEngine, qualityScorer = null, promptGenerator = null, contextProcessor = null) {
    if (!validationEngine) {
      throw new Error('ValidationEngine is required');
    }

    this.validationEngine = validationEngine;
    this.qualityScorer = qualityScorer;
    this.promptGenerator = promptGenerator;
    this.contextProcessor = contextProcessor;

    // Initialize conversation state
    this.state = {
      currentSection: null,
      responses: {},
      attemptCounts: {},
      completedSections: [],
      sessionMetadata: {
        startTime: new Date(),
        lastActivity: new Date(),
        totalQuestions: 0,
        totalResponses: 0
      }
    };

    // Section configuration
    this.sectionQuestions = {
      introduction: [
        { id: 'productDescription', text: 'What product are you building and who is it for?', fieldName: 'productDescription' },
        { id: 'problemStatement', text: 'What problem does your product solve?', fieldName: 'problemStatement' },
        { id: 'targetMarket', text: 'Who is your target market?', fieldName: 'targetMarket' }
      ],
      goals: [
        { id: 'businessObjectives', text: 'What are your main business objectives?', fieldName: 'businessObjectives' },
        { id: 'successMetrics', text: 'How will you measure success?', fieldName: 'successMetrics' }
      ],
      audience: [
        { id: 'primaryUsers', text: 'Who are your primary users?', fieldName: 'primaryUsers' },
        { id: 'userNeeds', text: 'What are their key needs and pain points?', fieldName: 'userNeeds' }
      ],
      userStories: [
        { id: 'coreStories', text: 'What are the main user stories?', fieldName: 'coreStories' }
      ],
      requirements: [
        { id: 'functionalReqs', text: 'What are the functional requirements?', fieldName: 'functionalReqs' },
        { id: 'nonFunctionalReqs', text: 'What are the non-functional requirements?', fieldName: 'nonFunctionalReqs' }
      ],
      metrics: [
        { id: 'kpis', text: 'What are your key performance indicators?', fieldName: 'kpis' }
      ],
      questions: [
        { id: 'openQuestions', text: 'What open questions remain?', fieldName: 'openQuestions' }
      ]
    };
  }

  initializeSection(sectionName, context = {}) {
    if (!this.sectionQuestions[sectionName]) {
      throw new Error(`Unknown section: ${sectionName}`);
    }

    this.state.currentSection = sectionName;
    this.state.lastActivity = new Date();

    // Initialize section responses if not exists
    if (!this.state.responses[sectionName]) {
      this.state.responses[sectionName] = {};
    }

    // Get questions for this section
    let questions = this.sectionQuestions[sectionName];

    // Filter out already answered questions if context is provided
    if (context.previousSections) {
      questions = questions.filter(q => {
        // Check if this question was already answered in previous sections
        for (const [prevSection, responses] of Object.entries(context.previousSections)) {
          if (responses[q.fieldName] && responses[q.fieldName].length > 0) {
            // Copy the response to current section
            this.state.responses[sectionName][q.fieldName] = responses[q.fieldName];
            return false; // Skip this question
          }
        }
        return true;
      });
    }

    this.state.sessionMetadata.totalQuestions += questions.length;

    return {
      section: sectionName,
      questions: questions,
      context: this.buildContext(),
      progress: this.calculateProgress()
    };
  }

  async processUserInput(response, sectionName, questionContext) {
    if (!response || typeof response !== 'string') {
      throw new Error('Response is required and must be a string');
    }

    if (!sectionName) {
      throw new Error('Section name is required');
    }

    if (!questionContext || !questionContext.fieldName) {
      throw new Error('Question context with fieldName is required');
    }

    const fieldName = questionContext.fieldName;
    this.state.lastActivity = new Date();
    this.state.sessionMetadata.totalResponses++;

    // Initialize section and attempt tracking
    if (!this.state.responses[sectionName]) {
      this.state.responses[sectionName] = {};
    }

    if (!this.state.attemptCounts[sectionName]) {
      this.state.attemptCounts[sectionName] = {};
    }

    if (!this.state.attemptCounts[sectionName][fieldName]) {
      this.state.attemptCounts[sectionName][fieldName] = 0;
    }

    // Increment attempt count
    this.state.attemptCounts[sectionName][fieldName]++;

    // Store the response
    this.state.responses[sectionName][fieldName] = response;

    // Get validation rules for this field
    const validationRules = this.validationEngine.rules[sectionName]?.[fieldName];
    let validation = { passed: true, score: 100, issues: [], suggestions: [] };

    if (validationRules) {
      validation = this.validationEngine.validateField(response, validationRules);
    }

    // Determine next action
    const shouldFollowUp = this.shouldAskFollowUp(validation);
    const canProceed = this.canProceedToNext(sectionName);
    const extractedData = this.extractDataFromResponse(response, fieldName);

    let nextAction = 'continue';
    if (shouldFollowUp && this.state.attemptCounts[sectionName][fieldName] < 2) {
      nextAction = 'followup';
    } else if (canProceed.canProceed) {
      nextAction = 'complete_section';
    }

    return {
      response: response,
      validation: validation,
      sectionComplete: canProceed.canProceed,
      extractedData: extractedData,
      nextAction: nextAction,
      context: this.buildContext(),
      attempts: this.state.attemptCounts[sectionName][fieldName]
    };
  }

  shouldAskFollowUp(validation) {
    if (!validation.passed) {
      return true;
    }

    // Ask follow-up if score is below 75 (even if validation passed)
    if (validation.score < 75) {
      return true;
    }

    return false;
  }

  canProceedToNext(sectionName) {
    const sectionResponses = this.state.responses[sectionName] || {};
    
    // Use validation engine to check section completeness
    const sectionValidation = this.validationEngine.validateSection(sectionName, sectionResponses);
    
    return {
      canProceed: sectionValidation.overall,
      missingFields: sectionValidation.missingRequired || [],
      validationDetails: sectionValidation.details || {}
    };
  }

  compressConversation(messages) {
    if (!Array.isArray(messages)) {
      return [];
    }

    const compressed = [];
    const completedSections = new Set(this.state.completedSections);

    for (const message of messages) {
      // Keep all messages from current section
      if (message.section === this.state.currentSection) {
        compressed.push(message);
        continue;
      }

      // For completed sections, keep only summary information
      if (message.section && completedSections.has(message.section)) {
        // Skip detailed messages from completed sections
        if (message.role === 'user' && message.content && message.content.length > 100) {
          // Create a compressed version
          compressed.push({
            ...message,
            content: message.content.substring(0, 100) + '... [compressed]',
            compressed: true
          });
        } else if (message.role === 'assistant' && !message.summary) {
          // Skip non-summary assistant messages from completed sections
          continue;
        } else {
          compressed.push(message);
        }
      } else {
        compressed.push(message);
      }
    }

    return compressed;
  }

  buildContext() {
    return {
      previousSections: this.getPreviousSectionsData(),
      currentResponses: this.state.responses[this.state.currentSection] || {},
      sessionMetadata: this.state.sessionMetadata,
      progress: this.calculateProgress()
    };
  }

  getPreviousSectionsData() {
    const previousData = {};
    
    for (const sectionName of this.state.completedSections) {
      if (this.state.responses[sectionName]) {
        previousData[sectionName] = this.state.responses[sectionName];
      }
    }

    return previousData;
  }

  calculateProgress() {
    const totalSections = Object.keys(this.sectionQuestions).length;
    const completedSections = this.state.completedSections.length;
    const currentProgress = this.state.currentSection ? 1 : 0;

    return {
      completedSections: completedSections,
      totalSections: totalSections,
      currentSection: this.state.currentSection,
      percentComplete: Math.round(((completedSections + (currentProgress * 0.5)) / totalSections) * 100)
    };
  }

  extractDataFromResponse(response, fieldName) {
    // Basic data extraction - can be enhanced with more sophisticated NLP
    const extractedData = {
      fieldName: fieldName,
      content: response,
      length: response.length,
      wordCount: response.split(/\s+/).length,
      timestamp: new Date()
    };

    // Extract specific patterns based on field type
    switch (fieldName) {
      case 'productDescription':
        extractedData.entities = this.extractProductEntities(response);
        break;
      case 'problemStatement':
        extractedData.problems = this.extractProblems(response);
        break;
      case 'targetMarket':
        extractedData.demographics = this.extractDemographics(response);
        break;
      case 'successMetrics':
        extractedData.metrics = this.extractMetrics(response);
        break;
      default:
        extractedData.keywords = this.extractKeywords(response);
    }

    return extractedData;
  }

  extractProductEntities(response) {
    const entities = {
      who: [],
      what: [],
      why: []
    };

    // Simple pattern matching - can be enhanced
    const whoPatterns = /(?:for|helps|users?|customers?|professionals?|people|teams?)\s+([^.,;]+)/gi;
    const whatPatterns = /(?:app|application|platform|tool|product|service|solution)\s+([^.,;]+)/gi;
    const whyPatterns = /(?:because|to|for|benefit|improve|solve|help)\s+([^.,;]+)/gi;

    let match;
    while ((match = whoPatterns.exec(response)) !== null) {
      entities.who.push(match[1].trim());
    }

    while ((match = whatPatterns.exec(response)) !== null) {
      entities.what.push(match[1].trim());
    }

    while ((match = whyPatterns.exec(response)) !== null) {
      entities.why.push(match[1].trim());
    }

    return entities;
  }

  extractProblems(response) {
    const problems = [];
    const problemPatterns = /(?:problem|issue|challenge|difficulty|struggle|pain\s+point)\s*:?\s*([^.,;]+)/gi;
    
    let match;
    while ((match = problemPatterns.exec(response)) !== null) {
      problems.push(match[1].trim());
    }

    return problems;
  }

  extractDemographics(response) {
    const demographics = {};
    
    // Age patterns
    const agePattern = /(\d+)-(\d+)\s+year/gi;
    const ageMatch = agePattern.exec(response);
    if (ageMatch) {
      demographics.ageRange = `${ageMatch[1]}-${ageMatch[2]}`;
    }

    // Role patterns
    const rolePattern = /(professionals?|developers?|managers?|students?|entrepreneurs?)/gi;
    const roleMatches = response.match(rolePattern);
    if (roleMatches) {
      demographics.roles = [...new Set(roleMatches.map(r => r.toLowerCase()))];
    }

    return demographics;
  }

  extractMetrics(response) {
    const metrics = [];
    
    // Percentage patterns
    const percentagePattern = /(\d+)%/g;
    let match;
    while ((match = percentagePattern.exec(response)) !== null) {
      metrics.push({ type: 'percentage', value: match[1] });
    }

    // Dollar amount patterns
    const dollarPattern = /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g;
    while ((match = dollarPattern.exec(response)) !== null) {
      metrics.push({ type: 'currency', value: match[1] });
    }

    // Number patterns
    const numberPattern = /(\d+(?:,\d{3})*)\s+([a-zA-Z]+)/g;
    while ((match = numberPattern.exec(response)) !== null) {
      metrics.push({ type: 'count', value: match[1], unit: match[2] });
    }

    return metrics;
  }

  extractKeywords(response) {
    // Simple keyword extraction - remove common words
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    
    const words = response.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word));

    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Return top keywords
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));
  }

  completeSection(sectionName) {
    if (!this.state.completedSections.includes(sectionName)) {
      this.state.completedSections.push(sectionName);
    }
    
    if (this.state.currentSection === sectionName) {
      this.state.currentSection = null;
    }
  }

  getState() {
    return {
      ...this.state,
      context: this.buildContext()
    };
  }

  resetState() {
    this.state = {
      currentSection: null,
      responses: {},
      attemptCounts: {},
      completedSections: [],
      sessionMetadata: {
        startTime: new Date(),
        lastActivity: new Date(),
        totalQuestions: 0,
        totalResponses: 0
      }
    };
  }
}

module.exports = ConversationManager;