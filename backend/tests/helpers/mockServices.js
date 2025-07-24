const redis = require('redis-mock');
const { createTestAIResponse, createTestValidation } = require('./testFactory');

/**
 * Mock AI Service with predictable responses
 */
function mockAIService() {
  const mockResponses = new Map();
  
  const aiService = {
    // Set predefined response for specific input
    setResponse: (input, response) => {
      mockResponses.set(input, response);
    },
    
    // Generate response based on input
    generateResponse: jest.fn(async (prompt, context = {}) => {
      // Check for predefined response
      if (mockResponses.has(prompt)) {
        return mockResponses.get(prompt);
      }
      
      // Generate default response based on context
      const response = createTestAIResponse({
        content: `AI response for: ${prompt.substring(0, 50)}...`,
        confidence: 0.85,
        metadata: {
          ...context,
          model: 'mock-gpt-4',
          tokens: prompt.length * 0.75,
          processingTime: 1000
        }
      });
      
      return response;
    }),
    
    // Mock streaming response
    generateStreamResponse: jest.fn(async function* (prompt, context = {}) {
      const response = await this.generateResponse(prompt, context);
      const chunks = response.content.split(' ');
      
      for (const chunk of chunks) {
        yield {
          content: chunk + ' ',
          done: false
        };
        // Simulate streaming delay
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      yield {
        content: '',
        done: true,
        metadata: response.metadata
      };
    }),
    
    // Mock conversation analysis
    analyzeConversation: jest.fn(async (messages) => {
      return {
        sentiment: 'positive',
        topics: ['requirements', 'technical', 'timeline'],
        completeness: 0.75,
        suggestions: [
          'Consider adding more technical details',
          'Clarify user acceptance criteria'
        ]
      };
    }),
    
    // Reset all mocks
    reset: () => {
      mockResponses.clear();
      aiService.generateResponse.mockClear();
      aiService.generateStreamResponse.mockClear();
      aiService.analyzeConversation.mockClear();
    }
  };
  
  return aiService;
}

/**
 * Mock Validation Engine with consistent validation
 */
function mockValidationEngine() {
  const validationRules = new Map();
  
  const validationEngine = {
    // Set custom validation rule
    setRule: (field, rule) => {
      validationRules.set(field, rule);
    },
    
    // Validate data
    validate: jest.fn(async (data, schema) => {
      const errors = [];
      const suggestions = [];
      
      // Apply custom rules
      for (const [field, rule] of validationRules) {
        if (data[field] && !rule(data[field])) {
          errors.push({
            field,
            message: `Validation failed for ${field}`,
            severity: 'error'
          });
        }
      }
      
      // Default validation logic
      if (schema === 'prd-section') {
        if (!data.content || data.content.length < 10) {
          errors.push({
            field: 'content',
            message: 'Content is too short',
            severity: 'error'
          });
        }
        
        if (!data.sectionType) {
          errors.push({
            field: 'sectionType',
            message: 'Section type is required',
            severity: 'error'
          });
        }
      }
      
      const isValid = errors.length === 0;
      const score = isValid ? 85 : Math.max(30, 85 - (errors.length * 15));
      
      return createTestValidation(isValid, {
        score,
        errors,
        suggestions: isValid ? suggestions : [
          'Review the validation errors above',
          'Ensure all required fields are provided'
        ]
      });
    }),
    
    // Validate PRD section
    validateSection: jest.fn(async (section) => {
      return validationEngine.validate(section, 'prd-section');
    }),
    
    // Calculate quality score
    calculateQualityScore: jest.fn(async (data) => {
      const validation = await validationEngine.validate(data, 'prd-section');
      return validation.score;
    }),
    
    // Reset all mocks
    reset: () => {
      validationRules.clear();
      validationEngine.validate.mockClear();
      validationEngine.validateSection.mockClear();
      validationEngine.calculateQualityScore.mockClear();
    }
  };
  
  return validationEngine;
}

/**
 * Mock Redis Client using redis-mock
 */
function mockRedisClient() {
  const client = redis.createClient();
  
  // Add custom methods for testing
  client.flushTestData = async () => {
    await client.flushall();
  };
  
  client.getTestData = async (pattern = '*') => {
    const keys = await client.keys(pattern);
    const data = {};
    
    for (const key of keys) {
      data[key] = await client.get(key);
    }
    
    return data;
  };
  
  return client;
}

/**
 * Mock Session Manager
 */
function mockSessionManager() {
  const sessions = new Map();
  
  const sessionManager = {
    createSession: jest.fn(async (userId, metadata = {}) => {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const session = {
        id: sessionId,
        userId,
        status: 'active',
        currentSection: 'overview',
        progress: {},
        metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      sessions.set(sessionId, session);
      return session;
    }),
    
    getSession: jest.fn(async (sessionId) => {
      return sessions.get(sessionId) || null;
    }),
    
    updateSession: jest.fn(async (sessionId, updates) => {
      const session = sessions.get(sessionId);
      if (!session) return null;
      
      const updatedSession = {
        ...session,
        ...updates,
        updatedAt: new Date()
      };
      
      sessions.set(sessionId, updatedSession);
      return updatedSession;
    }),
    
    deleteSession: jest.fn(async (sessionId) => {
      return sessions.delete(sessionId);
    }),
    
    listSessions: jest.fn(async (userId) => {
      return Array.from(sessions.values()).filter(s => s.userId === userId);
    }),
    
    // Test utilities
    getTestSessions: () => Array.from(sessions.values()),
    clearTestSessions: () => sessions.clear(),
    
    // Reset all mocks
    reset: () => {
      sessions.clear();
      sessionManager.createSession.mockClear();
      sessionManager.getSession.mockClear();
      sessionManager.updateSession.mockClear();
      sessionManager.deleteSession.mockClear();
      sessionManager.listSessions.mockClear();
    }
  };
  
  return sessionManager;
}

/**
 * Mock WebSocket Manager
 */
function mockWebSocketManager() {
  const connections = new Map();
  const events = [];
  
  const wsManager = {
    addConnection: jest.fn((sessionId, socket) => {
      connections.set(sessionId, socket);
    }),
    
    removeConnection: jest.fn((sessionId) => {
      connections.delete(sessionId);
    }),
    
    broadcast: jest.fn((sessionId, event, data) => {
      events.push({ sessionId, event, data, timestamp: new Date() });
      
      const socket = connections.get(sessionId);
      if (socket && socket.emit) {
        socket.emit(event, data);
      }
    }),
    
    broadcastToAll: jest.fn((event, data) => {
      for (const [sessionId, socket] of connections) {
        if (socket && socket.emit) {
          socket.emit(event, data);
        }
      }
      events.push({ event, data, broadcast: true, timestamp: new Date() });
    }),
    
    // Test utilities
    getConnections: () => Array.from(connections.keys()),
    getEvents: () => [...events],
    clearEvents: () => events.length = 0,
    
    // Reset all mocks
    reset: () => {
      connections.clear();
      events.length = 0;
      wsManager.addConnection.mockClear();
      wsManager.removeConnection.mockClear();
      wsManager.broadcast.mockClear();
      wsManager.broadcastToAll.mockClear();
    }
  };
  
  return wsManager;
}

/**
 * Create all mock services at once
 */
function createMockServices() {
  return {
    aiService: mockAIService(),
    validationEngine: mockValidationEngine(),
    redisClient: mockRedisClient(),
    sessionManager: mockSessionManager(),
    webSocketManager: mockWebSocketManager()
  };
}

/**
 * Reset all mock services
 */
function resetAllMocks() {
  const services = createMockServices();
  Object.values(services).forEach(service => {
    if (service.reset) {
      service.reset();
    }
  });
}

module.exports = {
  mockAIService,
  mockValidationEngine,
  mockRedisClient,
  mockSessionManager,
  mockWebSocketManager,
  createMockServices,
  resetAllMocks
};