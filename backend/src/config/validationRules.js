/**
 * Validation Rules Configuration
 * 
 * This file defines comprehensive validation rules for all PRD sections.
 * These rules are used by the ValidationEngine to validate user responses.
 */

/**
 * Helper functions for validation (internal use only)
 */
const helpers = {
  // Check if text contains required elements
  containsRequiredElements(text, elements) {
    const lowerText = text.toLowerCase();
    return elements.every(element => lowerText.includes(element.toLowerCase()));
  },
  
  // Check if text matches a pattern
  matchesPattern(text, pattern) {
    return pattern.test(text);
  },
  
  // Check if text contains numbers
  containsNumbers(text) {
    return /\d+/.test(text);
  },
  
  // Calculate specificity score (0-100)
  calculateSpecificity(text) {
    // Count specific markers
    const specificityMarkers = [
      /\d+/, // Numbers
      /specifically|exactly|precisely/, // Specific language
      /"[^"]+"/, // Quoted values
      /\b(?:will|must|shall)\b/, // Definitive language
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i, // Months
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i, // Days
      /\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\b/, // Dates
      /\b(?:[A-Z][a-z]+ )+[A-Z][a-z]+\b/, // Proper nouns
      /\b[A-Z]{2,}\b/ // Acronyms
    ];
    
    const markerCount = specificityMarkers.filter(marker => 
      marker.test(text)
    ).length;
    
    return Math.min((markerCount / specificityMarkers.length) * 150, 100);
  }
};

/**
 * Validation rules for all PRD sections
 */
const validationRules = {
  /**
   * Introduction/Overview Section Rules
   */
  introduction: {
    productDescription: {
      minLength: 50,
      maxLength: 500,
      requiredElements: ['what', 'who', 'why'],
      qualityThreshold: 75,
      errorMessages: {
        tooShort: 'Product description must be at least 50 characters',
        tooLong: 'Product description must be at most 500 characters',
        missingElements: 'Product description must explain what the product is, who it\'s for, and why it exists'
      }
    },
    problemStatement: {
      minLength: 30,
      requiredElements: ['problem', 'impact', 'frequency'],
      qualityThreshold: 80,
      errorMessages: {
        tooShort: 'Problem statement must be at least 30 characters',
        missingElements: 'Problem statement must describe the problem, its impact, and how frequently it occurs'
      }
    },
    valueProposition: {
      minLength: 20,
      maxLength: 100,
      requiredElements: ['benefit', 'differentiator'],
      qualityThreshold: 85,
      errorMessages: {
        tooShort: 'Value proposition must be at least 20 characters',
        tooLong: 'Value proposition must be at most 100 characters',
        missingElements: 'Value proposition must highlight the benefit and what makes it different'
      }
    },
    scope: {
      requiresInScope: true,
      requiresOutOfScope: true,
      errorMessages: {
        missingInScope: 'Must include in-scope items',
        missingOutOfScope: 'Must include out-of-scope items'
      }
    }
  },

  /**
   * Goals/Objectives Section Rules
   */
  goals: {
    businessObjectives: {
      minCount: 2,
      requiredElements: ['metric', 'target', 'timeframe'],
      qualityThreshold: 90,
      errorMessages: {
        tooFew: 'At least 2 business objectives are required',
        missingElements: 'Each objective must include a metric, target value, and timeframe'
      }
    },
    smartCriteria: {
      required: ['specific', 'measurable', 'achievable', 'relevant', 'timebound'],
      qualityThreshold: 85,
      errorMessages: {
        missingCriteria: 'Goals must be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)'
      }
    },
    metrics: {
      requiresNumbers: true,
      errorMessages: {
        missingNumbers: 'Business metrics must include specific numbers'
      }
    },
    timeframes: {
      required: true,
      errorMessages: {
        missing: 'Timeframes must be specified for each goal'
      }
    }
  },

  /**
   * Target Audience Section Rules
   */
  audience: {
    primaryPersona: {
      required: true,
      minCount: 1,
      errorMessages: {
        missing: 'At least one primary persona is required'
      }
    },
    demographics: {
      required: true,
      errorMessages: {
        missing: 'Demographics information is required for each persona'
      }
    },
    painPoints: {
      required: true,
      errorMessages: {
        missing: 'Pain points must be identified for each persona'
      }
    },
    marketSize: {
      required: true,
      requiresNumbers: true,
      errorMessages: {
        missing: 'Market size estimation is required',
        missingNumbers: 'Market size must include specific numbers'
      }
    },
    useCases: {
      required: true,
      minSpecificity: 70,
      errorMessages: {
        missing: 'Use cases are required',
        notSpecific: 'Use cases must be specific and detailed'
      }
    }
  },

  /**
   * User Stories Section Rules
   */
  userStories: {
    format: {
      pattern: /^As a .+, I want .+, so that .+\.$/,
      errorMessages: {
        invalidFormat: 'User stories must follow the format: "As a..., I want..., so that..."'
      }
    },
    acceptanceCriteria: {
      required: true,
      errorMessages: {
        missing: 'Acceptance criteria are required for each user story'
      }
    },
    priority: {
      required: true,
      allowedValues: ['high', 'medium', 'low', 'must-have', 'should-have', 'could-have', 'won\'t-have'],
      errorMessages: {
        missing: 'Priority level must be set for each user story',
        invalidValue: 'Priority must be one of: high, medium, low, must-have, should-have, could-have, won\'t-have'
      }
    },
    minimumCount: {
      value: 5,
      errorMessages: {
        tooFew: 'At least 5 user stories are required for MVP'
      }
    }
  },

  /**
   * Functional Requirements Section Rules
   */
  requirements: {
    featureSpecifications: {
      minDetailLevel: 80,
      errorMessages: {
        notDetailed: 'Feature specifications must be detailed and comprehensive'
      }
    },
    technicalConstraints: {
      required: true,
      errorMessages: {
        missing: 'Technical constraints must be noted'
      }
    },
    integrationPoints: {
      required: true,
      errorMessages: {
        missing: 'Integration points must be specified'
      }
    },
    dataSchemas: {
      requiredForDataFeatures: true,
      errorMessages: {
        missing: 'Data schemas are required for data-related features'
      }
    }
  },

  /**
   * Success Metrics Section Rules
   */
  metrics: {
    kpis: {
      measurable: true,
      errorMessages: {
        notMeasurable: 'KPIs must be measurable'
      }
    },
    baselineValues: {
      required: true,
      errorMessages: {
        missing: 'Baseline values are required for each metric'
      }
    },
    targetValues: {
      required: true,
      errorMessages: {
        missing: 'Target values are required for each metric'
      }
    },
    measurementMethods: {
      required: true,
      errorMessages: {
        missing: 'Measurement methods must be specified for each metric'
      }
    }
  },

  /**
   * Open Questions Section Rules
   */
  questions: {
    considerations: {
      minCount: 3,
      errorMessages: {
        tooFew: 'At least 3 considerations are required'
      }
    },
    riskAssessment: {
      required: true,
      errorMessages: {
        missing: 'Risk assessment is required'
      }
    },
    futurePhases: {
      required: true,
      errorMessages: {
        missing: 'Future phases should be mentioned'
      }
    }
  }
};

// Freeze the object to prevent modifications
Object.freeze(validationRules);

module.exports = validationRules;