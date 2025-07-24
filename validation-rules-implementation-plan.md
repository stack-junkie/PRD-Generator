# Validation Rules Implementation Plan

This document outlines the implementation plan for the `backend/src/config/validationRules.js` file, which will define comprehensive validation rules for all PRD sections.

## File Structure

The file will export a frozen object containing validation rules for each PRD section. The structure will be:

```javascript
const validationRules = {
  introduction: {
    // Introduction section rules
  },
  goals: {
    // Goals section rules
  },
  // ... other sections
};

// Freeze the object to prevent modifications
Object.freeze(validationRules);

module.exports = validationRules;
```

## Validation Rule Types

We'll implement several types of validation rules:

1. **Length Validation**: Min/max character counts
2. **Required Elements**: Must contain specific keywords or concepts
3. **Format Validation**: Must follow specific formats (e.g., user stories)
4. **Count Validation**: Minimum number of items required
5. **Content Validation**: Specific content requirements (e.g., must include numbers)

## Section-Specific Validation Rules

### 1. Introduction/Overview Rules

```javascript
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
}
```

### 2. Goals/Objectives Rules

```javascript
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
}
```

### 3. Target Audience Rules

```javascript
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
}
```

### 4. User Stories Rules

```javascript
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
}
```

### 5. Functional Requirements Rules

```javascript
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
}
```

### 6. Success Metrics Rules

```javascript
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
}
```

### 7. Open Questions Rules

```javascript
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
```

## Helper Functions

The file will also include helper functions for common validation tasks:

```javascript
// Helper functions (internal, not exported)
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
    // Implementation details...
  }
};
```

## Implementation Notes

1. The validation rules should be comprehensive but flexible enough to accommodate different types of PRDs.
2. Error messages should be clear and actionable.
3. The object should be frozen to prevent accidental modifications.
4. The file should be well-documented with comments explaining each validation rule.
5. The validation rules should align with the data models defined in the project.

## Usage Example

```javascript
const validationRules = require('../config/validationRules');

// Validate product description
function validateProductDescription(description) {
  const rules = validationRules.introduction.productDescription;
  
  if (description.length < rules.minLength) {
    return {
      valid: false,
      error: rules.errorMessages.tooShort
    };
  }
  
  if (description.length > rules.maxLength) {
    return {
      valid: false,
      error: rules.errorMessages.tooLong
    };
  }
  
  // Check for required elements
  const hasRequiredElements = helpers.containsRequiredElements(
    description, 
    rules.requiredElements
  );
  
  if (!hasRequiredElements) {
    return {
      valid: false,
      error: rules.errorMessages.missingElements
    };
  }
  
  return { valid: true };
}
```

## Next Steps

1. Implement the `validationRules.js` file according to this plan
2. Create unit tests for each validation rule
3. Integrate with the ValidationEngine service
4. Document the validation rules for developers