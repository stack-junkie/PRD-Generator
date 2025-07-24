/**
 * Unit tests for SessionManager service
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { v4: uuidv4 } = require('uuid');

// Mocks
const mockRedis = {
  setex: sinon.stub().resolves('OK'),
  get: sinon.stub(),
  del: sinon.stub().resolves(1),
  on: sinon.stub(),
  quit: sinon.stub().resolves()
};

// Mock Node-Cache for fallback
const mockNodeCache = {
  set: sinon.stub().returns(true),
  get: sinon.stub(),
  del: sinon.stub().returns(true)
};

// Mock models
const mockUserSession = {
  create: sinon.stub(),
  findOne: sinon.stub(),
  findAndCountAll: sinon.stub(),
  update: sinon.stub()
};

const mockSection = {
  create: sinon.stub(),
  findAll: sinon.stub()
};

const mockPRDDocument = {
  create: sinon.stub()
};

const mockConversationMessage = {
  create: sinon.stub(),
  findAll: sinon.stub()
};

const mockSequelize = {
  transaction: sinon.stub()
};

// Mock Redis module
jest.mock('ioredis', () => {
  return function() {
    return mockRedis;
  };
});

// Mock node-cache module
jest.mock('node-cache', () => {
  return function() {
    return mockNodeCache;
  };
});

// Import after mocks are set up
const SessionManager = require('../../../src/services/SessionManager');

describe('SessionManager', () => {
  let sessionManager;
  let mockTransaction;
  
  beforeEach(() => {
    // Reset all stubs
    sinon.reset();
    
    // Setup transaction mock
    mockTransaction = {
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves()
    };
    mockSequelize.transaction.resolves(mockTransaction);
    
    // Create test session manager with mocked dependencies
    sessionManager = new SessionManager({
      sequelize: mockSequelize,
      UserSession: mockUserSession,
      Section: mockSection,
      PRDDocument: mockPRDDocument,
      ConversationMessage: mockConversationMessage
    });
    
    // Simulate Redis connection
    sessionManager.redis = mockRedis;
    sessionManager.useRedis = true;
  });
  
  describe('initializeSession', () => {
    it('should create a new session with transaction', async () => {
      // Setup session data
      const sessionData = {
        projectName: 'Test Project',
        description: 'Test Description',
        template: 'basic'
      };
      
      // Setup mock responses
      const sessionId = uuidv4();
      const createdAt = new Date();
      
      const mockSessionResponse = {
        sessionId,
        projectName: sessionData.projectName,
        description: sessionData.description,
        currentSection: 0,
        createdAt,
        lastActive: createdAt
      };
      
      mockUserSession.create.resolves(mockSessionResponse);
      mockSection.create.resolves({});
      mockPRDDocument.create.resolves({});
      mockConversationMessage.create.resolves({});
      mockRedis.setex.resolves('OK');
      
      // Call the method
      const result = await sessionManager.initializeSession(sessionData);
      
      // Assertions
      expect(mockSequelize.transaction.calledOnce).to.be.true;
      expect(mockUserSession.create.calledOnce).to.be.true;
      expect(mockPRDDocument.create.calledOnce).to.be.true;
      expect(mockConversationMessage.create.calledOnce).to.be.true;
      expect(mockTransaction.commit.calledOnce).to.be.true;
      expect(mockRedis.setex.calledOnce).to.be.true;
      
      // Check result structure
      expect(result).to.have.property('sessionId');
      expect(result).to.have.property('projectName', sessionData.projectName);
      expect(result).to.have.property('template', sessionData.template);
      expect(result).to.have.property('state');
      expect(result.state).to.have.property('sessionId');
      expect(result.state).to.have.property('currentSection', 0);
      expect(result.state).to.have.property('lastActivity');
      expect(result.state).to.have.property('validationStates');
      expect(result.state).to.have.property('contextCache');
    });
    
    it('should rollback transaction on error', async () => {
      // Setup session data
      const sessionData = {
        projectName: 'Test Project'
      };
      
      // Setup mock to throw error
      mockUserSession.create.rejects(new Error('Database error'));
      
      // Call the method and expect error
      try {
        await sessionManager.initializeSession(sessionData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Database error');
        expect(mockTransaction.rollback.calledOnce).to.be.true;
        expect(mockTransaction.commit.called).to.be.false;
      }
    });
  });
  
  describe('getSession', () => {
    it('should retrieve session from cache if available', async () => {
      const sessionId = uuidv4();
      const cachedSession = {
        sessionId,
        projectName: 'Cached Project',
        currentSection: 1
      };
      
      // Setup Redis mock to return cached session
      mockRedis.get.resolves(JSON.stringify(cachedSession));
      
      // Call the method
      const result = await sessionManager.getSession(sessionId);
      
      // Assertions
      expect(mockRedis.get.calledOnce).to.be.true;
      expect(mockUserSession.findOne.called).to.be.false; // Should not query DB
      expect(result).to.deep.equal(cachedSession);
    });
    
    it('should retrieve session from database if not in cache', async () => {
      const sessionId = uuidv4();
      
      // Setup Redis mock to return null (cache miss)
      mockRedis.get.resolves(null);
      
      // Setup DB mocks
      const dbSession = {
        sessionId,
        projectName: 'DB Project',
        description: 'From Database',
        currentSection: 2,
        createdAt: new Date(),
        lastActive: new Date(),
        status: 'active'
      };
      
      mockUserSession.findOne.resolves(dbSession);
      
      const sections = [
        { name: 'introduction', completionStatus: true, sectionContent: 'Intro content' },
        { name: 'goals', completionStatus: false, sectionContent: '' }
      ];
      
      mockSection.findAll.resolves(sections);
      
      // Call the method
      const result = await sessionManager.getSession(sessionId);
      
      // Assertions
      expect(mockRedis.get.calledOnce).to.be.true;
      expect(mockUserSession.findOne.calledOnce).to.be.true;
      expect(mockSection.findAll.calledOnce).to.be.true;
      expect(mockRedis.setex.calledOnce).to.be.true; // Should cache the result
      
      // Check result structure
      expect(result).to.have.property('sessionId', sessionId);
      expect(result).to.have.property('projectName', 'DB Project');
      expect(result).to.have.property('completedSections').that.includes('introduction');
      expect(result).to.have.property('responses').that.has.property('introduction');
    });
  });
  
  describe('updateSessionState', () => {
    it('should update session state in cache', async () => {
      const sessionId = uuidv4();
      const currentState = {
        sessionId,
        currentSection: 1,
        lastActivity: new Date().toISOString(),
        validationStates: {},
        contextCache: {}
      };
      
      const updates = {
        currentSection: 2,
        validationStates: { introduction: true }
      };
      
      // Setup mock to return current state
      mockRedis.get.resolves(JSON.stringify(currentState));
      
      // Call the method
      const result = await sessionManager.updateSessionState(sessionId, updates);
      
      // Assertions
      expect(mockRedis.get.calledOnce).to.be.true;
      expect(mockRedis.setex.calledOnce).to.be.true;
      
      // Check result structure
      expect(result).to.have.property('sessionId', sessionId);
      expect(result).to.have.property('currentSection', 2);
      expect(result.validationStates).to.have.property('introduction', true);
      expect(result).to.have.property('lastActivity');
    });
  });
  
  describe('validateSession', () => {
    it('should validate and update session from cache', async () => {
      const sessionId = uuidv4();
      const cachedState = {
        sessionId,
        currentSection: 2,
        lastActivity: new Date().toISOString(),
        validationStates: {},
        contextCache: {}
      };
      
      // Setup mock
      mockRedis.get.resolves(JSON.stringify(cachedState));
      
      // Call the method
      const result = await sessionManager.validateSession(sessionId);
      
      // Assertions
      expect(mockRedis.get.calledOnce).to.be.true;
      expect(mockRedis.setex.calledOnce).to.be.true; // Updates last activity
      expect(mockUserSession.findOne.called).to.be.false; // Should not query DB
      
      // Check result
      expect(result).to.have.property('valid', true);
      expect(result).to.have.property('sessionId', sessionId);
      expect(result).to.have.property('currentSection', 2);
    });
    
    it('should validate from database if not in cache', async () => {
      const sessionId = uuidv4();
      
      // Setup cache miss
      mockRedis.get.resolves(null);
      
      // Setup DB hit
      mockUserSession.findOne.resolves({
        sessionId,
        currentSection: 3,
        lastActive: new Date()
      });
      
      // Call the method
      const result = await sessionManager.validateSession(sessionId);
      
      // Assertions
      expect(mockRedis.get.calledOnce).to.be.true;
      expect(mockUserSession.findOne.calledOnce).to.be.true;
      expect(mockRedis.setex.calledOnce).to.be.true; // Should cache the state
      
      // Check result
      expect(result).to.have.property('valid', true);
      expect(result).to.have.property('sessionId', sessionId);
      expect(result).to.have.property('currentSection', 3);
    });
    
    it('should return null for invalid session', async () => {
      const sessionId = uuidv4();
      
      // Setup cache miss
      mockRedis.get.resolves(null);
      
      // Setup DB miss
      mockUserSession.findOne.resolves(null);
      
      // Call the method
      const result = await sessionManager.validateSession(sessionId);
      
      // Assertions
      expect(mockRedis.get.calledOnce).to.be.true;
      expect(mockUserSession.findOne.calledOnce).to.be.true;
      expect(result).to.be.null;
    });
  });
  
  describe('Redis fallback', () => {
    it('should use node-cache when Redis fails', async () => {
      // Create a new session manager that simulates Redis failure
      const failingSessionManager = new SessionManager({
        sequelize: mockSequelize,
        UserSession: mockUserSession,
        Section: mockSection,
        PRDDocument: mockPRDDocument,
        ConversationMessage: mockConversationMessage
      });
      
      // Simulate Redis failure
      failingSessionManager.useRedis = false;
      failingSessionManager.fallbackCache = mockNodeCache;
      
      const sessionId = uuidv4();
      const testData = { test: 'data' };
      
      // Test cache set
      await failingSessionManager._setCacheValue('test-key', testData);
      expect(mockNodeCache.set.calledOnce).to.be.true;
      
      // Setup mock for get
      mockNodeCache.get.returns(JSON.stringify(testData));
      
      // Test cache get
      const result = await failingSessionManager._getCacheValue('test-key');
      expect(mockNodeCache.get.calledOnce).to.be.true;
      expect(result).to.deep.equal(testData);
    });
  });
});