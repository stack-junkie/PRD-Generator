const request = require('supertest');
const { createTestUser } = require('./testFactory');

/**
 * API Helper for testing HTTP endpoints
 */
class APIHelper {
  constructor(app) {
    this.app = app;
    this.defaultUser = null;
    this.defaultToken = null;
  }

  /**
   * Set default user for authenticated requests
   */
  setDefaultUser(user = null) {
    if (!user) {
      const testUser = createTestUser();
      this.defaultUser = testUser.user;
      this.defaultToken = testUser.token;
    } else {
      this.defaultUser = user.user || user;
      this.defaultToken = user.token;
    }
    return this;
  }

  /**
   * Make authenticated request with token
   */
  authenticatedRequest(method, endpoint, token = null) {
    const authToken = token || this.defaultToken;
    
    if (!authToken) {
      throw new Error('No authentication token available. Call setDefaultUser() first.');
    }

    return request(this.app)
      [method.toLowerCase()](endpoint)
      .set('Authorization', `Bearer ${authToken}`)
      .set('Content-Type', 'application/json');
  }

  /**
   * GET request with authentication
   */
  get(endpoint, token = null) {
    return this.authenticatedRequest('GET', endpoint, token);
  }

  /**
   * POST request with authentication
   */
  post(endpoint, data = {}, token = null) {
    return this.authenticatedRequest('POST', endpoint, token).send(data);
  }

  /**
   * PUT request with authentication
   */
  put(endpoint, data = {}, token = null) {
    return this.authenticatedRequest('PUT', endpoint, token).send(data);
  }

  /**
   * DELETE request with authentication
   */
  delete(endpoint, token = null) {
    return this.authenticatedRequest('DELETE', endpoint, token);
  }

  /**
   * PATCH request with authentication
   */
  patch(endpoint, data = {}, token = null) {
    return this.authenticatedRequest('PATCH', endpoint, token).send(data);
  }

  /**
   * Unauthenticated request
   */
  public(method, endpoint) {
    return request(this.app)[method.toLowerCase()](endpoint);
  }

  /**
   * Wait for async response with timeout
   */
  async waitForResponse(requestPromise, timeout = 5000) {
    return Promise.race([
      requestPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      )
    ]);
  }

  /**
   * Assert validation error format
   */
  assertValidationError(response, expectedField = null) {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(response.body.error).toHaveProperty('message');
    
    if (expectedField) {
      expect(response.body.error).toHaveProperty('details');
      expect(response.body.error.details).toHaveProperty('field', expectedField);
    }
    
    return response;
  }

  /**
   * Assert successful response format
   */
  assertSuccess(response, expectedStatus = 200) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('timestamp');
    
    return response;
  }

  /**
   * Assert error response format
   */
  assertError(response, expectedStatus = 500, expectedCode = null) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('message');
    
    if (expectedCode) {
      expect(response.body.error).toHaveProperty('code', expectedCode);
    }
    
    return response;
  }

  /**
   * Assert unauthorized response
   */
  assertUnauthorized(response) {
    return this.assertError(response, 401, 'UNAUTHORIZED');
  }

  /**
   * Assert forbidden response
   */
  assertForbidden(response) {
    return this.assertError(response, 403, 'FORBIDDEN');
  }

  /**
   * Assert not found response
   */
  assertNotFound(response) {
    return this.assertError(response, 404, 'NOT_FOUND');
  }

  /**
   * Test session endpoints
   */
  async testSessionEndpoints() {
    const results = {};
    
    // Test create session
    results.create = await this.post('/api/sessions', {
      metadata: { projectName: 'Test Project' }
    });
    
    if (results.create.status === 201) {
      const sessionId = results.create.body.data.id;
      
      // Test get session
      results.get = await this.get(`/api/sessions/${sessionId}`);
      
      // Test update session
      results.update = await this.put(`/api/sessions/${sessionId}`, {
        currentSection: 'requirements'
      });
      
      // Test delete session
      results.delete = await this.delete(`/api/sessions/${sessionId}`);
    }
    
    return results;
  }

  /**
   * Test conversation endpoints
   */
  async testConversationEndpoints(sessionId) {
    const results = {};
    
    // Test send message
    results.sendMessage = await this.post(`/api/conversations/${sessionId}/messages`, {
      content: 'Test message',
      type: 'user'
    });
    
    // Test get messages
    results.getMessages = await this.get(`/api/conversations/${sessionId}/messages`);
    
    // Test get conversation summary
    results.getSummary = await this.get(`/api/conversations/${sessionId}/summary`);
    
    return results;
  }

  /**
   * Simulate file upload
   */
  uploadFile(endpoint, fieldName, filePath, additionalFields = {}) {
    const req = request(this.app)
      .post(endpoint)
      .set('Authorization', `Bearer ${this.defaultToken}`);
    
    // Add file
    req.attach(fieldName, filePath);
    
    // Add additional fields
    Object.entries(additionalFields).forEach(([key, value]) => {
      req.field(key, value);
    });
    
    return req;
  }

  /**
   * Test WebSocket connection (mock)
   */
  mockWebSocketConnection(sessionId) {
    const events = [];
    const mockSocket = {
      emit: jest.fn((event, data) => {
        events.push({ event, data, timestamp: new Date() });
      }),
      on: jest.fn(),
      disconnect: jest.fn()
    };
    
    return {
      socket: mockSocket,
      events,
      getEvents: () => [...events],
      clearEvents: () => events.length = 0
    };
  }

  /**
   * Batch test multiple endpoints
   */
  async batchTest(tests) {
    const results = {};
    
    for (const [name, testFn] of Object.entries(tests)) {
      try {
        results[name] = await testFn(this);
      } catch (error) {
        results[name] = { error: error.message };
      }
    }
    
    return results;
  }

  /**
   * Performance test helper
   */
  async performanceTest(endpoint, method = 'GET', data = null, iterations = 100) {
    const times = [];
    const errors = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      
      try {
        let response;
        if (data) {
          response = await this[method.toLowerCase()](endpoint, data);
        } else {
          response = await this[method.toLowerCase()](endpoint);
        }
        
        const duration = Date.now() - start;
        times.push(duration);
        
        if (response.status >= 400) {
          errors.push({ iteration: i, status: response.status, body: response.body });
        }
      } catch (error) {
        errors.push({ iteration: i, error: error.message });
      }
    }
    
    return {
      iterations,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      successRate: ((iterations - errors.length) / iterations) * 100,
      errors
    };
  }

  /**
   * Reset helper state
   */
  reset() {
    this.defaultUser = null;
    this.defaultToken = null;
  }
}

/**
 * Create API helper instance
 */
function createAPIHelper(app) {
  return new APIHelper(app);
}

/**
 * Common test patterns
 */
const testPatterns = {
  // Test CRUD operations
  async testCRUD(apiHelper, endpoint, createData, updateData) {
    const results = {};
    
    // Create
    results.create = await apiHelper.post(endpoint, createData);
    apiHelper.assertSuccess(results.create, 201);
    
    const resourceId = results.create.body.data.id;
    
    // Read
    results.read = await apiHelper.get(`${endpoint}/${resourceId}`);
    apiHelper.assertSuccess(results.read);
    
    // Update
    results.update = await apiHelper.put(`${endpoint}/${resourceId}`, updateData);
    apiHelper.assertSuccess(results.update);
    
    // Delete
    results.delete = await apiHelper.delete(`${endpoint}/${resourceId}`);
    apiHelper.assertSuccess(results.delete, 204);
    
    return results;
  },
  
  // Test authentication requirements
  async testAuthRequired(apiHelper, endpoint, method = 'GET', data = null) {
    const originalToken = apiHelper.defaultToken;
    apiHelper.defaultToken = null;
    
    let response;
    try {
      if (data) {
        response = await apiHelper[method.toLowerCase()](endpoint, data);
      } else {
        response = await apiHelper[method.toLowerCase()](endpoint);
      }
    } finally {
      apiHelper.defaultToken = originalToken;
    }
    
    apiHelper.assertUnauthorized(response);
    return response;
  }
};

module.exports = {
  APIHelper,
  createAPIHelper,
  testPatterns
};