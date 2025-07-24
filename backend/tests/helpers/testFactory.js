const { faker } = require('faker');
const jwt = require('jsonwebtoken');

/**
 * Generate a test session with realistic data
 */
function createTestSession(overrides = {}) {
  const sessionId = faker.string.uuid();
  const userId = faker.string.uuid();
  
  return {
    id: sessionId,
    userId,
    status: 'active',
    currentSection: 'overview',
    progress: {
      overview: { completed: true, score: 85 },
      requirements: { completed: false, score: 0 },
      technical: { completed: false, score: 0 },
      timeline: { completed: false, score: 0 }
    },
    metadata: {
      projectName: faker.company.name(),
      industry: faker.company.buzzNoun(),
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Generate test conversation messages
 */
function createTestMessages(count = 5, sessionId = null) {
  const messages = [];
  const testSessionId = sessionId || faker.string.uuid();
  
  for (let i = 0; i < count; i++) {
    const isUser = i % 2 === 0;
    
    messages.push({
      id: faker.string.uuid(),
      sessionId: testSessionId,
      type: isUser ? 'user' : 'assistant',
      content: isUser 
        ? faker.lorem.sentence()
        : faker.lorem.paragraphs(2),
      metadata: {
        timestamp: new Date(Date.now() - (count - i) * 60000).toISOString(),
        section: 'overview',
        confidence: isUser ? null : faker.number.float({ min: 0.7, max: 0.95 })
      },
      createdAt: new Date(Date.now() - (count - i) * 60000),
      updatedAt: new Date(Date.now() - (count - i) * 60000)
    });
  }
  
  return messages;
}

/**
 * Generate test user with authentication token
 */
function createTestUser(overrides = {}) {
  const userId = faker.string.uuid();
  const email = faker.internet.email();
  
  const user = {
    id: userId,
    email,
    name: faker.person.fullName(),
    role: 'user',
    preferences: {
      theme: 'light',
      notifications: true,
      language: 'en'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
  
  // Generate JWT token
  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      role: user.role 
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '24h' }
  );
  
  return {
    user,
    token,
    authHeader: `Bearer ${token}`
  };
}

/**
 * Generate complete PRD test data
 */
function createTestPRD(sessionId = null) {
  const testSessionId = sessionId || faker.string.uuid();
  
  return {
    sessionId: testSessionId,
    sections: {
      overview: {
        id: faker.string.uuid(),
        sessionId: testSessionId,
        sectionType: 'overview',
        content: {
          projectName: faker.company.name(),
          description: faker.lorem.paragraphs(3),
          objectives: [
            faker.lorem.sentence(),
            faker.lorem.sentence(),
            faker.lorem.sentence()
          ],
          stakeholders: [
            {
              name: faker.person.fullName(),
              role: 'Product Manager',
              responsibilities: faker.lorem.sentence()
            },
            {
              name: faker.person.fullName(),
              role: 'Engineering Lead',
              responsibilities: faker.lorem.sentence()
            }
          ]
        },
        status: 'completed',
        version: 1,
        qualityScore: faker.number.int({ min: 75, max: 95 }),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      requirements: {
        id: faker.string.uuid(),
        sessionId: testSessionId,
        sectionType: 'requirements',
        content: {
          functional: [
            {
              id: faker.string.uuid(),
              title: faker.lorem.words(4),
              description: faker.lorem.paragraph(),
              priority: 'high',
              acceptance: [faker.lorem.sentence(), faker.lorem.sentence()]
            },
            {
              id: faker.string.uuid(),
              title: faker.lorem.words(4),
              description: faker.lorem.paragraph(),
              priority: 'medium',
              acceptance: [faker.lorem.sentence()]
            }
          ],
          nonFunctional: [
            {
              category: 'Performance',
              requirements: [faker.lorem.sentence(), faker.lorem.sentence()]
            },
            {
              category: 'Security',
              requirements: [faker.lorem.sentence()]
            }
          ]
        },
        status: 'in_progress',
        version: 1,
        qualityScore: faker.number.int({ min: 60, max: 85 }),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
  };
}

/**
 * Generate test API response data
 */
function createTestAPIResponse(type = 'success', data = null) {
  const responses = {
    success: {
      success: true,
      data: data || { message: 'Operation completed successfully' },
      timestamp: new Date().toISOString()
    },
    error: {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: faker.lorem.sentence(),
        details: data || {}
      },
      timestamp: new Date().toISOString()
    },
    validation: {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          field: faker.lorem.word(),
          message: faker.lorem.sentence()
        }
      },
      timestamp: new Date().toISOString()
    }
  };
  
  return responses[type] || responses.success;
}

/**
 * Generate test AI service response
 */
function createTestAIResponse(overrides = {}) {
  return {
    content: faker.lorem.paragraphs(2),
    confidence: faker.number.float({ min: 0.7, max: 0.95 }),
    suggestions: [
      faker.lorem.sentence(),
      faker.lorem.sentence()
    ],
    metadata: {
      model: 'gpt-4',
      tokens: faker.number.int({ min: 100, max: 500 }),
      processingTime: faker.number.int({ min: 500, max: 3000 })
    },
    ...overrides
  };
}

/**
 * Generate test validation result
 */
function createTestValidation(isValid = true, overrides = {}) {
  if (isValid) {
    return {
      isValid: true,
      score: faker.number.int({ min: 80, max: 100 }),
      suggestions: [],
      ...overrides
    };
  }
  
  return {
    isValid: false,
    score: faker.number.int({ min: 30, max: 70 }),
    errors: [
      {
        field: faker.lorem.word(),
        message: faker.lorem.sentence(),
        severity: 'error'
      }
    ],
    suggestions: [
      faker.lorem.sentence(),
      faker.lorem.sentence()
    ],
    ...overrides
  };
}

/**
 * Create multiple test entities at once
 */
function createTestBatch(factory, count = 5, overrides = {}) {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(factory({ ...overrides, index: i }));
  }
  return items;
}

module.exports = {
  createTestSession,
  createTestMessages,
  createTestUser,
  createTestPRD,
  createTestAPIResponse,
  createTestAIResponse,
  createTestValidation,
  createTestBatch,
  faker
};