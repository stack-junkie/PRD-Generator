/**
 * API Helper for E2E Tests
 * Provides utility functions for direct API interactions during testing
 */

const axios = require('axios');

class APIHelper {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL: baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Track created resources for cleanup
    this.createdSessions = [];
    this.authTokens = new Map();
  }

  /**
   * Create a new session via API
   */
  async createSession(initialData = {}) {
    try {
      const response = await this.client.post('/api/sessions', {
        metadata: {
          testSession: true,
          createdAt: new Date().toISOString(),
          ...initialData
        }
      });
      
      const session = response.data;
      this.createdSessions.push(session.id);
      
      return session;
    } catch (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    try {
      const response = await this.client.get(`/api/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get session ${sessionId}: ${error.message}`);
    }
  }

  /**
   * Update session data
   */
  async updateSession(sessionId, data) {
    try {
      const response = await this.client.put(`/api/sessions/${sessionId}`, data);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update session ${sessionId}: ${error.message}`);
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId) {
    try {
      await this.client.delete(`/api/sessions/${sessionId}`);
      
      // Remove from tracking
      const index = this.createdSessions.indexOf(sessionId);
      if (index > -1) {
        this.createdSessions.splice(index, 1);
      }
      
      return true;
    } catch (error) {
      console.warn(`Failed to delete session ${sessionId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Submit response to a session
   */
  async submitResponse(sessionId, sectionName, responseData) {
    try {
      const response = await this.client.post(
        `/api/sessions/${sessionId}/responses`,
        {
          section: sectionName,
          ...responseData
        }
      );
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to submit response: ${error.message}`);
    }
  }

  /**
   * Get session responses
   */
  async getSessionResponses(sessionId) {
    try {
      const response = await this.client.get(`/api/sessions/${sessionId}/responses`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get session responses: ${error.message}`);
    }
  }

  /**
   * Generate PRD for session
   */
  async generatePRD(sessionId) {
    try {
      const response = await this.client.post(`/api/sessions/${sessionId}/generate-prd`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to generate PRD: ${error.message}`);
    }
  }

  /**
   * Get generated PRD
   */
  async getPRD(sessionId, format = 'markdown') {
    try {
      const response = await this.client.get(
        `/api/sessions/${sessionId}/prd?format=${format}`
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get PRD: ${error.message}`);
    }
  }

  /**
   * Expire a session (for timeout testing)
   */
  async expireSession(sessionId) {
    try {
      await this.client.post(`/api/sessions/${sessionId}/expire`);
      return true;
    } catch (error) {
      console.warn(`Failed to expire session ${sessionId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate response quality
   */
  async validateResponse(sessionId, sectionName, responseText) {
    try {
      const response = await this.client.post(
        `/api/sessions/${sessionId}/validate`,
        {
          section: sectionName,
          response: responseText
        }
      );
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to validate response: ${error.message}`);
    }
  }

  /**
   * Get session progress
   */
  async getSessionProgress(sessionId) {
    try {
      const response = await this.client.get(`/api/sessions/${sessionId}/progress`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get session progress: ${error.message}`);
    }
  }

  /**
   * Create multiple sessions for load testing
   */
  async createMultipleSessions(count = 10) {
    const sessions = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const session = await this.createSession({
          testBatch: `load-test-${Date.now()}`,
          sessionIndex: i
        });
        sessions.push(session);
      } catch (error) {
        console.warn(`Failed to create session ${i}: ${error.message}`);
      }
    }
    
    return sessions;
  }

  /**
   * Authenticate user (if auth is required)
   */
  async authenticate(credentials) {
    try {
      const response = await this.client.post('/api/auth/login', credentials);
      const { token, user } = response.data;
      
      // Store token for future requests
      this.authTokens.set(user.id, token);
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      return { token, user };
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Check API health
   */
  async checkHealth() {
    try {
      const response = await this.client.get('/api/health');
      return response.data;
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  /**
   * Get system metrics
   */
  async getMetrics() {
    try {
      const response = await this.client.get('/api/metrics');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }

  /**
   * Wait for session to reach specific state
   */
  async waitForSessionState(sessionId, targetState, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const session = await this.getSession(sessionId);
        
        if (session.status === targetState) {
          return session;
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        // Continue trying unless timeout reached
        if (Date.now() - startTime >= timeout) {
          throw new Error(`Timeout waiting for session ${sessionId} to reach state ${targetState}`);
        }
      }
    }
    
    throw new Error(`Timeout waiting for session ${sessionId} to reach state ${targetState}`);
  }

  /**
   * Simulate network delay
   */
  async addNetworkDelay(delayMs = 1000) {
    this.client.defaults.timeout = this.client.defaults.timeout + delayMs;
    
    // Add interceptor to simulate delay
    this.client.interceptors.request.use(async (config) => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return config;
    });
  }

  /**
   * Remove network delay
   */
  removeNetworkDelay() {
    this.client.defaults.timeout = 10000;
    
    // Clear interceptors
    this.client.interceptors.request.clear();
  }

  /**
   * Simulate API error
   */
  async simulateError(endpoint, errorCode = 500) {
    const originalMethod = this.client.get;
    
    this.client.get = async (url, config) => {
      if (url.includes(endpoint)) {
        throw {
          response: {
            status: errorCode,
            data: { error: 'Simulated error' }
          }
        };
      }
      return originalMethod.call(this.client, url, config);
    };
  }

  /**
   * Reset API simulation
   */
  resetSimulation() {
    // Recreate client to clear any modifications
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Bulk operations for performance testing
   */
  async bulkCreateSessions(sessionData, count = 100) {
    const promises = Array.from({ length: count }, () => 
      this.createSession(sessionData)
    );
    
    try {
      const results = await Promise.allSettled(promises);
      
      const successful = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
      
      const failed = results
        .filter(r => r.status === 'rejected')
        .map(r => r.reason.message);
      
      return { successful, failed };
    } catch (error) {
      throw new Error(`Bulk session creation failed: ${error.message}`);
    }
  }

  /**
   * Clean up all created resources
   */
  async cleanup() {
    const deletePromises = this.createdSessions.map(sessionId => 
      this.deleteSession(sessionId)
    );
    
    try {
      await Promise.allSettled(deletePromises);
      this.createdSessions = [];
      this.authTokens.clear();
    } catch (error) {
      console.warn('Error during cleanup:', error.message);
    }
  }

  /**
   * Get API response times for performance monitoring
   */
  async measureResponseTimes(endpoints, iterations = 5) {
    const results = {};
    
    for (const endpoint of endpoints) {
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
          await this.client.get(endpoint);
          times.push(Date.now() - startTime);
        } catch (error) {
          times.push(-1); // Mark as failed
        }
        
        // Brief pause between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const validTimes = times.filter(t => t > 0);
      results[endpoint] = {
        average: validTimes.length ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : -1,
        min: validTimes.length ? Math.min(...validTimes) : -1,
        max: validTimes.length ? Math.max(...validTimes) : -1,
        successRate: (validTimes.length / iterations) * 100
      };
    }
    
    return results;
  }

  /**
   * Set request headers for testing
   */
  setHeaders(headers) {
    Object.assign(this.client.defaults.headers.common, headers);
  }

  /**
   * Get current request configuration
   */
  getConfig() {
    return {
      baseURL: this.client.defaults.baseURL,
      timeout: this.client.defaults.timeout,
      headers: this.client.defaults.headers.common
    };
  }
}

module.exports = { APIHelper };