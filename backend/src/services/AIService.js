const OpenAI = require('openai');
const crypto = require('crypto');

class AIService {
  constructor(config = {}) {
    // Configuration with defaults
    this.config = {
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      model: config.model || 'gpt-4-turbo-preview',
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.7,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      rateLimitPerSession: config.rateLimitPerSession || 100,
      rateLimitWindow: config.rateLimitWindow || 3600000, // 1 hour in ms
      cacheEnabled: config.cacheEnabled !== false,
      cacheTTL: config.cacheTTL || 1800000, // 30 minutes in ms
      tokenBudgetPerSection: config.tokenBudgetPerSection || 8000,
      contentFilterEnabled: config.contentFilterEnabled !== false,
      ...config
    };

    // Initialize OpenAI client
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({
      apiKey: this.config.apiKey
    });

    // Initialize internal state
    this.responseCache = new Map();
    this.tokenUsage = new Map();
    this.rateLimitTracking = new Map();
    this.sessionUsage = new Map();

    // Token counting approximation (GPT-4 tokens ≈ words * 1.3)
    this.tokenMultiplier = {
      'gpt-4': 1.3,
      'gpt-4-turbo-preview': 1.3,
      'gpt-3.5-turbo': 1.2
    };

    // Initialize prompt templates
    this.promptTemplates = this._initializePromptTemplates();

    // Cleanup intervals
    this._setupCleanupIntervals();
  }

  _initializePromptTemplates() {
    return {
      introduction: {
        system: `You are an expert product manager helping create a comprehensive Product Requirements Document (PRD). 

Your role is to extract and structure key information about the product introduction section. Focus on:
- Product description and core value proposition
- Problem statement and market need
- Target market and user base
- High-level solution approach

Provide specific, actionable feedback and ask clarifying questions when information is vague or incomplete. Keep responses concise but thorough.`,
        examples: [
          {
            user: "We're building a task management app for small teams.",
            assistant: "Great start! I'd like to understand more about your task management app:\n\n1. **Problem Focus**: What specific pain points do small teams face with current task management solutions?\n2. **Target Users**: What defines a 'small team' for you (size, industry, work style)?\n3. **Core Differentiation**: How will your app be different from existing solutions like Asana, Trello, or Notion?\n4. **Value Proposition**: What's the main benefit teams will get from switching to your solution?\n\nThis will help me provide better guidance on structuring your PRD introduction."
          }
        ],
        temperature: 0.7,
        maxTokens: 1500
      },

      goals: {
        system: `You are an expert product strategist helping define clear business objectives and success metrics for a PRD.

Focus on extracting and structuring:
- Primary business objectives and goals
- Success metrics and KPIs
- Timeline and milestones
- Success criteria for each objective

Help users think strategically about measurable outcomes and realistic timelines. Challenge vague goals and push for specific, measurable objectives.`,
        examples: [
          {
            user: "We want to increase user engagement and grow our user base.",
            assistant: "Those are important high-level goals! Let's make them more specific and measurable:\n\n**For User Engagement:**\n- What specific engagement metrics matter most? (DAU, session duration, feature adoption?)\n- What's your current baseline and target improvement?\n- Over what timeframe?\n\n**For User Growth:**\n- What's your target user acquisition rate?\n- Which user segments are you prioritizing?\n- What's your customer acquisition cost (CAC) goal?\n\n**Additional Questions:**\n- What business metrics tie to these goals (revenue, retention, etc.)?\n- How will you measure success monthly vs. quarterly?\n- What are the key milestones that indicate you're on track?\n\nThis will help create actionable, measurable objectives for your PRD."
          }
        ],
        temperature: 0.6,
        maxTokens: 1500
      },

      audience: {
        system: `You are a user research expert helping define target audiences and user personas for a PRD.

Focus on extracting and structuring:
- Primary and secondary user personas
- User demographics and psychographics
- User needs, pain points, and motivations
- User journey and behavior patterns
- Market segmentation

Help users think deeply about their users and avoid assumptions. Push for data-driven insights and specific user characteristics.`,
        examples: [
          {
            user: "Our target audience is professionals who need better productivity tools.",
            assistant: "Let's get more specific about your target professionals:\n\n**Demographics:**\n- What industries or job functions? (marketing, engineering, consulting?)\n- Company size preference? (startup, mid-size, enterprise?)\n- Experience level? (junior, senior, management?)\n\n**Current Behavior:**\n- What productivity tools do they currently use?\n- What's their typical workflow or workday like?\n- How tech-savvy are they?\n\n**Pain Points:**\n- What specific productivity challenges do they face?\n- What solutions have they tried that didn't work?\n- What would make them switch to a new tool?\n\n**Decision Making:**\n- Who influences their tool choices?\n- What's their budget for productivity tools?\n- How do they typically discover new solutions?\n\nThis detailed persona will strengthen your PRD's user focus."
          }
        ],
        temperature: 0.7,
        maxTokens: 1500
      },

      userStories: {
        system: `You are a product owner expert helping create comprehensive user stories and workflows for a PRD.

Focus on extracting and structuring:
- Core user stories in proper format (As a... I want... So that...)
- User journey mapping and key workflows
- Edge cases and error scenarios
- Acceptance criteria for each story
- Story prioritization and dependencies

Help users think through complete user experiences and identify gaps in their user story coverage.`,
        examples: [
          {
            user: "Users should be able to create and manage tasks in our app.",
            assistant: "Let's break down task management into specific user stories:\n\n**Core Task Creation:**\n- As a team member, I want to create a new task with title and description, so that I can capture work that needs to be done\n- As a task creator, I want to set due dates and priorities, so that my team understands urgency and timing\n\n**Questions to explore:**\n1. **Task Details**: What information is essential vs. optional when creating tasks?\n2. **Assignment**: How do users assign tasks to team members?\n3. **Organization**: How do users categorize or group related tasks?\n4. **Status Tracking**: What states can tasks have? (To Do, In Progress, Done, etc.)\n5. **Collaboration**: How do team members communicate about tasks?\n\n**Workflow Questions:**\n- What's the complete journey from task creation to completion?\n- How do users handle task dependencies?\n- What happens when tasks are overdue?\n\nThis will help us create comprehensive user stories for your PRD."
          }
        ],
        temperature: 0.7,
        maxTokens: 1500
      },

      requirements: {
        system: `You are a technical product expert helping define comprehensive functional and non-functional requirements for a PRD.

Focus on extracting and structuring:
- Functional requirements (what the system must do)
- Non-functional requirements (performance, security, usability)
- Technical constraints and dependencies
- Integration requirements
- Compliance and regulatory needs

Help users think systematically about requirements and identify potential gaps or conflicts.`,
        examples: [
          {
            user: "The app needs to handle user authentication and data storage.",
            assistant: "Let's detail those requirements more specifically:\n\n**Authentication Requirements:**\n- What authentication methods? (email/password, SSO, social login?)\n- Password complexity requirements?\n- Multi-factor authentication needed?\n- Session management and timeout policies?\n\n**Data Storage Requirements:**\n- What types of data need to be stored?\n- Data retention policies?\n- Backup and recovery requirements?\n- Data encryption at rest and in transit?\n\n**Additional Considerations:**\n**Performance:**\n- Expected user load and concurrent users?\n- Response time requirements?\n- Uptime requirements (99.9%?)?\n\n**Security:**\n- Data privacy compliance (GDPR, CCPA)?\n- User data access controls?\n- Audit logging requirements?\n\n**Integration:**\n- Third-party services to integrate with?\n- API requirements for external access?\n\nThis systematic approach ensures comprehensive requirements coverage."
          }
        ],
        temperature: 0.6,
        maxTokens: 1500
      },

      metrics: {
        system: `You are a data analytics expert helping define comprehensive success metrics and KPIs for a PRD.

Focus on extracting and structuring:
- Key Performance Indicators (KPIs) aligned with business goals
- User behavior metrics and analytics
- Business metrics (revenue, growth, retention)
- Technical performance metrics
- Measurement methodology and tracking plan

Help users establish baseline metrics, set realistic targets, and create actionable measurement frameworks.`,
        examples: [
          {
            user: "We want to track user engagement and app performance.",
            assistant: "Let's define specific, measurable metrics:\n\n**User Engagement Metrics:**\n- **Daily/Monthly Active Users (DAU/MAU)**: What's your current baseline and target?\n- **Session Metrics**: Average session duration, sessions per user?\n- **Feature Adoption**: Which features indicate engaged users?\n- **Retention Rates**: Day 1, Day 7, Day 30 retention targets?\n\n**App Performance Metrics:**\n- **Load Times**: Target response times for key actions?\n- **Error Rates**: Acceptable error thresholds?\n- **Uptime**: Availability targets (99.9%?)?\n- **Crash Rates**: Mobile app stability metrics?\n\n**Business Impact Metrics:**\n- How do engagement metrics tie to business outcomes?\n- What's the relationship between usage and revenue?\n- Customer acquisition cost (CAC) and lifetime value (LTV)?\n\n**Measurement Plan:**\n- What analytics tools will you use?\n- How often will you review these metrics?\n- Who's responsible for tracking and reporting?\n\nThis creates a comprehensive measurement framework for your PRD."
          }
        ],
        temperature: 0.6,
        maxTokens: 1500
      },

      questions: {
        system: `You are a strategic product consultant helping identify and prioritize open questions and concerns for a PRD.

Focus on extracting and structuring:
- Technical feasibility questions
- Market and competitive uncertainties
- Resource and timeline concerns
- Risk assessment and mitigation strategies
- Decision points that need stakeholder input

Help users surface important questions they might not have considered and prioritize which questions need answers before moving forward.`,
        examples: [
          {
            user: "We're not sure about our go-to-market strategy and technical architecture decisions.",
            assistant: "Great awareness of these key uncertainties! Let's structure these open questions:\n\n**Go-to-Market Questions:**\n- **Pricing Strategy**: What pricing model will resonate with your target users?\n- **Distribution Channels**: How will users discover and adopt your product?\n- **Competitive Response**: How might competitors react to your launch?\n- **Launch Strategy**: Phased rollout vs. full launch?\n\n**Technical Architecture Questions:**\n- **Scalability**: What architecture supports your growth projections?\n- **Technology Stack**: Build vs. buy decisions for key components?\n- **Performance**: Can your architecture handle peak usage scenarios?\n- **Integration**: How complex are third-party integrations?\n\n**Prioritization Framework:**\n- **Critical Path**: Which questions block development progress?\n- **Risk Level**: Which uncertainties pose the highest risk?\n- **Decision Timeline**: When do you need answers to each question?\n\n**Next Steps:**\n- What research or testing could answer these questions?\n- Who are the key stakeholders to involve in decisions?\n- What's your timeline for resolving these open items?\n\nThis structured approach helps prioritize and tackle your open questions systematically."
          }
        ],
        temperature: 0.7,
        maxTokens: 1500
      }
    };
  }

  /**
   * Generate AI response for given prompt and options
   */
  async generateResponse(prompt, options = {}) {
    try {
      // Validate and prepare options
      const processedOptions = this._processOptions(options);
      
      // Check rate limits
      this._checkRateLimit(processedOptions.sessionId);
      
      // Check cache first
      if (this.config.cacheEnabled) {
        const cachedResponse = this._getCachedResponse(prompt, processedOptions);
        if (cachedResponse) {
          this._logActivity('cache_hit', { prompt: prompt.substring(0, 100) });
          return cachedResponse;
        }
      }

      // Content filtering
      if (this.config.contentFilterEnabled) {
        const filterResult = this._filterContent(prompt);
        if (!filterResult.safe) {
          throw new Error(`Content filter violation: ${filterResult.reason}`);
        }
      }

      // Prepare messages for API call
      const messages = this._buildMessages(prompt, processedOptions);
      
      // Token counting and optimization
      const tokenCount = this.countTokens(messages);
      if (tokenCount > processedOptions.maxTokens) {
        const optimizedMessages = this._optimizeMessages(messages, processedOptions.maxTokens);
        if (this.countTokens(optimizedMessages) > processedOptions.maxTokens) {
          throw new Error('Prompt too long even after optimization');
        }
        messages.splice(0, messages.length, ...optimizedMessages);
      }

      // Make API call with retry logic
      const response = await this._makeAPICallWithRetry(messages, processedOptions);
      
      // Process and validate response
      const processedResponse = this._processResponse(response, processedOptions);
      
      // Cache response
      if (this.config.cacheEnabled) {
        this._cacheResponse(prompt, processedOptions, processedResponse);
      }
      
      // Track usage
      this._trackUsage(processedOptions.sessionId, response.usage);
      
      // Log activity
      this._logActivity('generate_response', {
        sessionId: processedOptions.sessionId,
        section: processedOptions.section,
        tokenCount,
        responseTokens: response.usage?.completion_tokens || 0
      });

      return processedResponse;

    } catch (error) {
      this._logActivity('generate_response_error', {
        error: error.message,
        sessionId: options.sessionId,
        section: options.section
      });
      
      // Return fallback response for certain errors
      if (this._shouldUseFallback(error)) {
        return this._getFallbackResponse(options.section);
      }
      
      throw error;
    }
  }

  /**
   * Stream AI response with real-time chunks
   */
  async streamResponse(prompt, onChunk, options = {}) {
    try {
      const processedOptions = { ...this._processOptions(options), stream: true };
      
      // Similar validation as generateResponse
      this._checkRateLimit(processedOptions.sessionId);
      
      if (this.config.contentFilterEnabled) {
        const filterResult = this._filterContent(prompt);
        if (!filterResult.safe) {
          throw new Error(`Content filter violation: ${filterResult.reason}`);
        }
      }

      const messages = this._buildMessages(prompt, processedOptions);
      const tokenCount = this.countTokens(messages);
      
      if (tokenCount > processedOptions.maxTokens) {
        const optimizedMessages = this._optimizeMessages(messages, processedOptions.maxTokens);
        messages.splice(0, messages.length, ...optimizedMessages);
      }

      // Stream API call
      const stream = await this.openai.chat.completions.create({
        model: processedOptions.model,
        messages: messages,
        max_tokens: processedOptions.maxTokens,
        temperature: processedOptions.temperature,
        stream: true
      });

      let fullResponse = '';
      let tokenUsage = { prompt_tokens: tokenCount, completion_tokens: 0 };

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullResponse += delta;
          tokenUsage.completion_tokens += this.countTokens(delta);
          
          // Call chunk handler
          onChunk({
            content: delta,
            fullContent: fullResponse,
            done: false
          });
        }

        // Check if stream is done
        if (chunk.choices[0]?.finish_reason) {
          onChunk({
            content: '',
            fullContent: fullResponse,
            done: true,
            finishReason: chunk.choices[0].finish_reason
          });
          break;
        }
      }

      // Track usage
      this._trackUsage(processedOptions.sessionId, tokenUsage);
      
      this._logActivity('stream_response', {
        sessionId: processedOptions.sessionId,
        section: processedOptions.section,
        totalTokens: tokenUsage.prompt_tokens + tokenUsage.completion_tokens
      });

      return {
        content: fullResponse,
        usage: tokenUsage
      };

    } catch (error) {
      this._logActivity('stream_response_error', {
        error: error.message,
        sessionId: options.sessionId
      });
      
      // Send error to chunk handler
      onChunk({
        content: '',
        fullContent: '',
        done: true,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Count tokens in text (approximation)
   */
  countTokens(input) {
    if (typeof input === 'string') {
      const words = input.split(/\s+/).length;
      const multiplier = this.tokenMultiplier[this.config.model] || 1.3;
      return Math.ceil(words * multiplier);
    } else if (Array.isArray(input)) {
      // Count tokens in messages array
      return input.reduce((total, message) => {
        return total + this.countTokens(message.content || '');
      }, 0);
    }
    return 0;
  }

  /**
   * Optimize prompt to fit within token limits
   */
  optimizePrompt(prompt, maxTokens) {
    const currentTokens = this.countTokens(prompt);
    
    if (currentTokens <= maxTokens) {
      return prompt;
    }

    // Simple truncation strategy - in production, use more sophisticated methods
    const ratio = maxTokens / currentTokens;
    const targetLength = Math.floor(prompt.length * ratio * 0.9); // 10% buffer
    
    // Try to truncate at sentence boundaries
    const sentences = prompt.split(/[.!?]+/);
    let optimized = '';
    
    for (const sentence of sentences) {
      if ((optimized + sentence).length <= targetLength) {
        optimized += sentence + '.';
      } else {
        break;
      }
    }
    
    return optimized || prompt.substring(0, targetLength);
  }

  /**
   * Get token usage statistics
   */
  getTokenUsage(sessionId = null) {
    if (sessionId) {
      return this.sessionUsage.get(sessionId) || {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        requestCount: 0
      };
    }
    
    // Return aggregate usage
    const aggregate = {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requestCount: 0,
      activeSessions: this.sessionUsage.size
    };
    
    for (const usage of this.sessionUsage.values()) {
      aggregate.totalTokens += usage.totalTokens;
      aggregate.promptTokens += usage.promptTokens;
      aggregate.completionTokens += usage.completionTokens;
      aggregate.requestCount += usage.requestCount;
    }
    
    return aggregate;
  }

  /**
   * Clear caches and reset usage tracking
   */
  clearCache() {
    this.responseCache.clear();
    this._logActivity('cache_cleared');
  }

  resetUsageTracking(sessionId = null) {
    if (sessionId) {
      this.sessionUsage.delete(sessionId);
      this.rateLimitTracking.delete(sessionId);
    } else {
      this.sessionUsage.clear();
      this.rateLimitTracking.clear();
    }
    this._logActivity('usage_tracking_reset', { sessionId });
  }

  // Private methods

  _processOptions(options) {
    const section = options.section || 'general';
    const template = this.promptTemplates[section] || this.promptTemplates.introduction;
    
    return {
      sessionId: options.sessionId || 'default',
      section: section,
      model: options.model || this.config.model,
      maxTokens: options.maxTokens || template.maxTokens || this.config.maxTokens,
      temperature: options.temperature ?? template.temperature ?? this.config.temperature,
      context: options.context || {},
      stream: options.stream || false
    };
  }

  _checkRateLimit(sessionId) {
    const now = Date.now();
    const sessionLimits = this.rateLimitTracking.get(sessionId) || { count: 0, windowStart: now };
    
    // Reset window if expired
    if (now - sessionLimits.windowStart > this.config.rateLimitWindow) {
      sessionLimits.count = 0;
      sessionLimits.windowStart = now;
    }
    
    if (sessionLimits.count >= this.config.rateLimitPerSession) {
      throw new Error(`Rate limit exceeded for session ${sessionId}`);
    }
    
    sessionLimits.count++;
    this.rateLimitTracking.set(sessionId, sessionLimits);
  }

  _getCachedResponse(prompt, options) {
    const cacheKey = this._generateCacheKey(prompt, options);
    const cached = this.responseCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
      return cached.response;
    }
    
    if (cached) {
      this.responseCache.delete(cacheKey);
    }
    
    return null;
  }

  _cacheResponse(prompt, options, response) {
    const cacheKey = this._generateCacheKey(prompt, options);
    this.responseCache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });
  }

  _generateCacheKey(prompt, options) {
    const keyData = {
      prompt: prompt.substring(0, 200),
      section: options.section,
      model: options.model,
      temperature: options.temperature
    };
    
    return crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  _filterContent(content) {
    // Simple content filtering - in production, use more sophisticated filtering
    const flaggedPatterns = [
      /hack|crack|exploit/i,
      /malware|virus|trojan/i,
      /illegal|criminal|fraud/i
    ];
    
    for (const pattern of flaggedPatterns) {
      if (pattern.test(content)) {
        return { safe: false, reason: 'Potentially harmful content detected' };
      }
    }
    
    return { safe: true };
  }

  _buildMessages(prompt, options) {
    const template = this.promptTemplates[options.section];
    const messages = [];
    
    // Add system message
    if (template?.system) {
      messages.push({
        role: 'system',
        content: template.system
      });
    }
    
    // Add context if available
    if (options.context?.previousSections) {
      const contextSummary = this._buildContextSummary(options.context);
      if (contextSummary) {
        messages.push({
          role: 'system',
          content: `Previous PRD sections context:\n${contextSummary}`
        });
      }
    }
    
    // Add examples if available
    if (template?.examples) {
      for (const example of template.examples) {
        messages.push({ role: 'user', content: example.user });
        messages.push({ role: 'assistant', content: example.assistant });
      }
    }
    
    // Add current user prompt
    messages.push({
      role: 'user',
      content: prompt
    });
    
    return messages;
  }

  _buildContextSummary(context) {
    if (!context.previousSections) return '';
    
    const summaries = [];
    
    for (const [section, data] of Object.entries(context.previousSections)) {
      if (data && typeof data === 'object') {
        const summary = Object.entries(data)
          .map(([key, value]) => `${key}: ${String(value).substring(0, 100)}`)
          .join('\n');
        summaries.push(`${section}:\n${summary}`);
      }
    }
    
    return summaries.join('\n\n');
  }

  _optimizeMessages(messages, maxTokens) {
    // Simple optimization: keep system message and recent messages
    if (messages.length <= 2) return messages;
    
    const systemMessages = messages.filter(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');
    
    // Keep most recent user message and some history
    const optimized = [...systemMessages];
    let currentTokens = this.countTokens(optimized);
    
    for (let i = userMessages.length - 1; i >= 0; i--) {
      const messageTokens = this.countTokens(userMessages[i].content);
      if (currentTokens + messageTokens <= maxTokens * 0.8) { // Leave room for response
        optimized.splice(-1, 0, userMessages[i]);
        currentTokens += messageTokens;
      } else {
        break;
      }
    }
    
    return optimized;
  }

  async _makeAPICallWithRetry(messages, options) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.openai.chat.completions.create({
          model: options.model,
          messages: messages,
          max_tokens: options.maxTokens,
          temperature: options.temperature,
          stream: options.stream || false
        });
        
        return response;
        
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error.status === 400 || error.status === 401 || error.status === 403) {
          throw error;
        }
        
        if (attempt < this.config.maxRetries) {
          const delay = Math.min(
            this.config.retryDelay * Math.pow(2, attempt - 1),
            10000
          );
          
          this._logActivity('api_retry', {
            attempt,
            delay,
            error: error.message
          });
          
          await this._sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  _processResponse(response, options) {
    const content = response.choices[0]?.message?.content || '';
    
    return {
      content: content.trim(),
      model: options.model,
      usage: response.usage,
      finishReason: response.choices[0]?.finish_reason,
      timestamp: new Date().toISOString()
    };
  }

  _shouldUseFallback(error) {
    // Use fallback for network errors, rate limits, etc.
    return error.code === 'ENOTFOUND' || 
           error.status === 429 || 
           error.status >= 500;
  }

  _getFallbackResponse(section) {
    const fallbacks = {
      introduction: "I'm currently unable to provide specific guidance due to a service issue. Please describe your product's main purpose, target users, and the key problem it solves. I'll help you structure this information once service is restored.",
      goals: "I'm experiencing a service issue. Please outline your main business objectives and how you plan to measure success. Include specific metrics and timelines where possible.",
      audience: "Service temporarily unavailable. Please describe your target users, their demographics, current tools they use, and main pain points you're addressing.",
      userStories: "I'm currently unable to provide detailed guidance. Please describe the main actions users will take in your product and what they hope to accomplish.",
      requirements: "Service issue detected. Please list the core functionality your product needs, any technical constraints, and integration requirements.",
      metrics: "I'm temporarily unable to assist. Please describe what success looks like for your product and how you plan to measure user engagement and business impact.",
      questions: "Service temporarily down. Please list any concerns, unknowns, or decisions that need to be made before moving forward with development."
    };
    
    return {
      content: fallbacks[section] || "I'm currently experiencing a service issue. Please provide your input and I'll assist you once service is restored.",
      model: this.config.model,
      usage: { prompt_tokens: 0, completion_tokens: 50, total_tokens: 50 },
      finishReason: 'fallback',
      timestamp: new Date().toISOString(),
      isFallback: true
    };
  }

  _trackUsage(sessionId, usage) {
    if (!usage) return;
    
    const sessionUsage = this.sessionUsage.get(sessionId) || {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requestCount: 0
    };
    
    sessionUsage.totalTokens += usage.total_tokens || 0;
    sessionUsage.promptTokens += usage.prompt_tokens || 0;
    sessionUsage.completionTokens += usage.completion_tokens || 0;
    sessionUsage.requestCount += 1;
    
    this.sessionUsage.set(sessionId, sessionUsage);
  }

  _setupCleanupIntervals() {
    // Clean up cache every 30 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.responseCache.entries()) {
        if (now - cached.timestamp > this.config.cacheTTL) {
          this.responseCache.delete(key);
        }
      }
    }, 1800000);
    
    // Clean up rate limit tracking every hour
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, limits] of this.rateLimitTracking.entries()) {
        if (now - limits.windowStart > this.config.rateLimitWindow) {
          this.rateLimitTracking.delete(sessionId);
        }
      }
    }, 3600000);
  }

  _logActivity(event, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      service: 'AIService',
      ...data
    };
    
    // In production, integrate with your logging system
    console.log(JSON.stringify(logEntry));
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AIService;