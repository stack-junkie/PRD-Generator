class ValidationEngine {
  constructor(validationRules) {
    if (!validationRules) {
      throw new Error('Validation rules are required');
    }
    
    if (Object.keys(validationRules).length === 0) {
      throw new Error('Validation rules cannot be empty');
    }

    // Validate rule structure
    this.validateRuleStructure(validationRules);
    
    this.rules = validationRules;
  }

  validateRuleStructure(rules) {
    for (const [sectionName, sectionRules] of Object.entries(rules)) {
      for (const [fieldName, fieldRules] of Object.entries(sectionRules)) {
        if (typeof fieldRules !== 'object' || fieldRules === null) {
          throw new Error('Invalid rule structure');
        }
      }
    }
  }

  validateSection(sectionName, responses) {
    if (!this.rules[sectionName]) {
      throw new Error(`Unknown section: ${sectionName}`);
    }

    const sectionRules = this.rules[sectionName];
    const details = {};
    const missingRequired = [];
    const suggestions = [];
    let overallPassed = true;

    // Check for missing required fields
    for (const fieldName of Object.keys(sectionRules)) {
      if (!responses[fieldName]) {
        missingRequired.push(fieldName);
        overallPassed = false;
      }
    }

    // Validate provided responses
    for (const [fieldName, response] of Object.entries(responses)) {
      if (sectionRules[fieldName]) {
        const validation = this.validateField(response, sectionRules[fieldName]);
        details[fieldName] = validation;
        
        if (!validation.passed) {
          overallPassed = false;
          suggestions.push(...validation.suggestions);
        }
      }
    }

    return {
      overall: overallPassed,
      details,
      missingRequired,
      suggestions
    };
  }

  validateField(response, rules) {
    const issues = [];
    const suggestions = [];
    
    // Handle null/undefined responses
    if (response === null || response === undefined) {
      response = '';
    }
    
    // Convert non-string responses to string
    if (typeof response !== 'string') {
      response = String(response);
    }

    // Length validation
    if (rules.minLength && response.length < rules.minLength) {
      issues.push(`Response too short (min: ${rules.minLength} chars)`);
      suggestions.push('Please provide more detail');
    }

    if (rules.maxLength && response.length > rules.maxLength) {
      issues.push(`Response too long (max: ${rules.maxLength} chars)`);
      suggestions.push('Please be more concise');
    }

    // Required elements validation
    if (rules.requiredElements) {
      const missingElements = [];
      for (const element of rules.requiredElements) {
        if (!this.containsElement(response, element)) {
          missingElements.push(element);
        }
      }
      
      if (missingElements.length > 0) {
        issues.push(`Missing required elements: ${missingElements.join(', ')}`);
        suggestions.push(`Please include information about: ${missingElements.join(', ')}`);
      }
    }

    // Calculate quality score
    const score = this.calculateQualityScore(response, rules);
    
    // Check quality threshold
    const passed = issues.length === 0 && (!rules.qualityThreshold || score >= rules.qualityThreshold);

    if (!passed && score < (rules.qualityThreshold || 70)) {
      suggestions.push('Consider adding more specific details and concrete examples');
    }

    return {
      passed,
      score,
      issues,
      suggestions
    };
  }

  calculateQualityScore(response, rules) {
    if (!response || typeof response !== 'string') {
      return 0;
    }

    if (response.length === 0) {
      return 0;
    }

    let score = 0;
    const factors = [];

    // Length factor (0-25 points)
    const idealLength = Math.min(rules.maxLength || 200, 200);
    const lengthRatio = Math.min(response.length / idealLength, 1);
    const lengthScore = lengthRatio * 25;
    factors.push(lengthScore);

    // Completeness factor (0-25 points)
    let completenessScore = 20; // Base score
    if (rules.requiredElements) {
      const presentElements = rules.requiredElements.filter(element => 
        this.containsElement(response, element)
      );
      const completenessRatio = presentElements.length / rules.requiredElements.length;
      completenessScore = Math.max(20, completenessRatio * 25); // Ensure minimum score
    }
    factors.push(completenessScore);

    // Specificity factor (0-25 points)
    const specificityScore = this.calculateSpecificityScore(response);
    factors.push(specificityScore);

    // Clarity factor (0-25 points)
    const clarityScore = this.calculateClarityScore(response);
    factors.push(clarityScore);

    // Calculate weighted average
    score = factors.reduce((sum, factor) => sum + factor, 0);
    
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  calculateSpecificityScore(response) {
    // Look for specific indicators
    const specificIndicators = [
      /\d+/, // Numbers
      /\$\d+/, // Dollar amounts
      /\d+%/, // Percentages
      /(daily|weekly|monthly|annually)/i, // Time periods
      /(users?|customers?|professionals?|teams?)/i, // User types
      /(mobile|web|SaaS|platform|application)/i // Platform types
    ];

    const vaguePhrases = [
      /(some|many|various|several|stuff|things|people|users)/gi,
      /(good|bad|nice|great|awesome)/gi,
      /(might|maybe|probably|possibly)/gi
    ];

    let specificityScore = 18; // Higher base score

    // Add points for specific indicators
    specificIndicators.forEach(pattern => {
      if (pattern.test(response)) {
        specificityScore += 3; // More generous scoring
      }
    });

    // Subtract points for vague phrases
    vaguePhrases.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        specificityScore -= matches.length;
      }
    });

    return Math.max(0, Math.min(25, specificityScore));
  }

  calculateClarityScore(response) {
    let clarityScore = 18; // Higher base score

    // Check for proper sentence structure
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 1) {
      clarityScore += 3;
    }

    // Check for logical connectors
    const connectors = /(because|therefore|however|furthermore|additionally|first|second|third)/gi;
    const connectorMatches = response.match(connectors);
    if (connectorMatches) {
      clarityScore += Math.min(connectorMatches.length * 2, 5);
    }

    // Penalize for poor grammar indicators
    const poorGrammarIndicators = [
      /\b(dont|doesnt|wont|cant)\b/gi, // Missing apostrophes
      /\byeah\b/gi, // Informal language
      /\.{2,}/g, // Multiple periods
      /\s{2,}/g // Multiple spaces
    ];

    poorGrammarIndicators.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        clarityScore -= matches.length;
      }
    });

    return Math.max(0, Math.min(25, clarityScore));
  }

  containsElement(response, element) {
    if (!response || typeof response !== 'string') {
      return false;
    }

    const lowerResponse = response.toLowerCase();
    const lowerElement = element.toLowerCase();

    // Direct word match
    const wordBoundaryRegex = new RegExp(`\\b${lowerElement}\\b`, 'i');
    if (wordBoundaryRegex.test(response)) {
      return true;
    }

    // Conceptual matching
    const conceptMappings = {
      'who': ['users', 'customers', 'professionals', 'teams', 'people', 'audience', 'target'],
      'what': ['application', 'app', 'platform', 'tool', 'product', 'service', 'solution'],
      'why': ['because', 'benefit', 'value', 'improve', 'solve', 'problem', 'purpose', 'reason'],
      'problem': ['challenge', 'issue', 'difficulty', 'struggle', 'pain point'],
      'impact': ['effect', 'result', 'consequence', 'outcome', 'cost'],
      'metric': ['measure', 'kpi', 'target', 'goal', 'percentage', '%'],
      'target': ['goal', 'objective', 'aim'],
      'timeframe': ['timeline', 'deadline', 'schedule', 'time', 'months', 'weeks', 'days']
    };

    if (conceptMappings[lowerElement]) {
      for (const concept of conceptMappings[lowerElement]) {
        if (lowerResponse.includes(concept)) {
          return true;
        }
      }
    }

    return false;
  }
}

module.exports = ValidationEngine;