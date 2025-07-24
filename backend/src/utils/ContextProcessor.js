/**
 * Context processing utilities for conversation management
 */

class ContextProcessor {
  constructor() {
    this.contextTypes = {
      USER_INFO: 'userInfo',
      PRODUCT_DETAILS: 'productDetails',
      BUSINESS_CONTEXT: 'businessContext',
      TECHNICAL_REQUIREMENTS: 'technicalRequirements'
    };
  }

  /**
   * Extract context from conversation messages
   * @param {Array} messages - Array of conversation messages
   * @returns {Object} - Extracted context object
   */
  extractContext(messages) {
    if (!Array.isArray(messages)) {
      return {};
    }

    const context = {
      userInfo: {},
      productDetails: {},
      businessContext: {},
      technicalRequirements: {},
      mentions: []
    };

    messages.forEach(message => {
      if (typeof message.content === 'string') {
        // Extract user information
        this._extractUserInfo(message.content, context.userInfo);
        
        // Extract product details
        this._extractProductDetails(message.content, context.productDetails);
        
        // Extract business context
        this._extractBusinessContext(message.content, context.businessContext);
        
        // Extract technical requirements
        this._extractTechnicalRequirements(message.content, context.technicalRequirements);
        
        // Extract mentions and key terms
        this._extractMentions(message.content, context.mentions);
      }
    });

    return context;
  }

  /**
   * Merge previous and current contexts
   * @param {Object} previousContext - Previous conversation context
   * @param {Object} currentContext - Current conversation context
   * @returns {Object} - Merged context object
   */
  mergeContexts(previousContext, currentContext) {
    if (!previousContext) return currentContext || {};
    if (!currentContext) return previousContext || {};

    return {
      userInfo: { ...previousContext.userInfo, ...currentContext.userInfo },
      productDetails: { ...previousContext.productDetails, ...currentContext.productDetails },
      businessContext: { ...previousContext.businessContext, ...currentContext.businessContext },
      technicalRequirements: { ...previousContext.technicalRequirements, ...currentContext.technicalRequirements },
      mentions: [...(previousContext.mentions || []), ...(currentContext.mentions || [])]
    };
  }

  /**
   * Get context summary for AI prompts
   * @param {Object} context - Context object
   * @returns {string} - Context summary string
   */
  getContextSummary(context) {
    if (!context) return '';

    const summaryParts = [];

    if (Object.keys(context.userInfo || {}).length > 0) {
      summaryParts.push(`User: ${JSON.stringify(context.userInfo)}`);
    }

    if (Object.keys(context.productDetails || {}).length > 0) {
      summaryParts.push(`Product: ${JSON.stringify(context.productDetails)}`);
    }

    if (Object.keys(context.businessContext || {}).length > 0) {
      summaryParts.push(`Business: ${JSON.stringify(context.businessContext)}`);
    }

    if (Object.keys(context.technicalRequirements || {}).length > 0) {
      summaryParts.push(`Technical: ${JSON.stringify(context.technicalRequirements)}`);
    }

    return summaryParts.join('\n');
  }

  // Private helper methods
  _extractUserInfo(content, userInfo) {
    // Extract user role, company, team info
    const roleMatch = content.match(/(?:I am|I'm)\s+(?:a|an)?\s*([^.]+)/i);
    if (roleMatch) {
      userInfo.role = roleMatch[1].trim();
    }
  }

  _extractProductDetails(content, productDetails) {
    // Extract product name, type, platform info
    const productMatch = content.match(/(?:product|app|service|platform)\s+(?:called|named)\s+([^.]+)/i);
    if (productMatch) {
      productDetails.name = productMatch[1].trim();
    }
  }

  _extractBusinessContext(content, businessContext) {
    // Extract industry, market, business model info
    const industryMatch = content.match(/(?:industry|market|sector):\s*([^.]+)/i);
    if (industryMatch) {
      businessContext.industry = industryMatch[1].trim();
    }
  }

  _extractTechnicalRequirements(content, technicalRequirements) {
    // Extract tech stack, platform, integration requirements
    const techMatch = content.match(/(?:using|built with|technology|stack):\s*([^.]+)/i);
    if (techMatch) {
      technicalRequirements.stack = techMatch[1].trim();
    }
  }

  _extractMentions(content, mentions) {
    // Extract @mentions, #hashtags, or key terms
    const mentionMatches = content.match(/@\w+/g);
    if (mentionMatches) {
      mentions.push(...mentionMatches);
    }
  }
}

module.exports = ContextProcessor;