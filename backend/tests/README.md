# Test Infrastructure Documentation

This document describes the updated test infrastructure for the PRD Generator backend.

## Overview

The test infrastructure has been completely updated with:
- Modern Jest configuration
- Comprehensive test utilities and helpers
- Database mocking and setup
- Service mocking capabilities
- API testing helpers
- Proper test isolation and cleanup

## Test Scripts

The following npm scripts are available:

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

## Configuration Files

### [`jest.config.js`](../jest.config.js)
Main Jest configuration for unit and integration tests:
- Uses Node.js test environment
- Includes coverage reporting
- Sets up proper module path mapping
- Configures test timeouts and cleanup

### [`jest.e2e.config.js`](../jest.e2e.config.js)
Separate configuration for end-to-end tests:
- Runs tests in sequence (`runInBand: true`)
- Longer timeout for complex operations
- Separate coverage directory

### [`.env.test`](../.env.test)
Test environment variables:
- Database configuration for tests
- Mock API keys and secrets
- Disabled rate limiting
- Test-specific settings

## Test Helpers

### Database Helper ([`testDatabase.js`](./helpers/testDatabase.js))

Manages test database setup and cleanup:

```javascript
const { setupTestDatabase, clearDatabase, seedDatabase } = require('./helpers/testDatabase');

// Setup test database
await setupTestDatabase();

// Clear all data between tests
await clearDatabase();

// Seed with test data
await seedDatabase({
  User: [{ name: 'Test User', email: 'test@example.com' }],
  Session: [{ userId: 'user-id', status: 'active' }]
});
```

### Test Factory ([`testFactory.js`](./helpers/testFactory.js))

Generates realistic test data:

```javascript
const { createTestSession, createTestUser, createTestPRD } = require('./helpers/testFactory');

// Create test session
const session = createTestSession({ status: 'active' });

// Create test user with auth token
const { user, token, authHeader } = createTestUser();

// Create complete PRD data
const prd = createTestPRD(sessionId);
```

### Mock Services ([`mockServices.js`](./helpers/mockServices.js))

Provides mocked versions of external services:

```javascript
const { mockAIService, mockValidationEngine, mockRedisClient } = require('./helpers/mockServices');

// Mock AI service with predictable responses
const aiService = mockAIService();
aiService.setResponse('test prompt', { content: 'test response' });

// Mock validation engine
const validator = mockValidationEngine();
const result = await validator.validate(data, 'prd-section');

// Mock Redis client
const redis = mockRedisClient();
await redis.set('key', 'value');
```

### API Helper ([`apiHelper.js`](./helpers/apiHelper.js))

Simplifies API endpoint testing:

```javascript
const { createAPIHelper } = require('./helpers/apiHelper');

const api = createAPIHelper(app);
api.setDefaultUser(); // Creates test user automatically

// Make authenticated requests
const response = await api.get('/api/sessions');
api.assertSuccess(response);

// Test validation errors
const errorResponse = await api.post('/api/sessions', {});
api.assertValidationError(errorResponse, 'userId');
```

## Test Structure

```
tests/
├── setup.js              # Main test setup
├── jest.setup.js          # Jest environment setup
├── e2e.setup.js          # E2E test setup
├── helpers/              # Test utilities
│   ├── testDatabase.js   # Database helpers
│   ├── testFactory.js    # Test data generation
│   ├── mockServices.js   # Service mocks
│   └── apiHelper.js      # API testing utilities
├── unit/                 # Unit tests
│   ├── controllers/
│   ├── services/
│   ├── utils/
│   └── websocket/
└── integration/          # Integration tests
    ├── api.test.js
    ├── workflow.test.js
    └── aiService.test.js
```

## Writing Tests

### Unit Test Example

```javascript
const { createTestSession } = require('../helpers/testFactory');
const { mockSessionManager } = require('../helpers/mockServices');

describe('SessionController', () => {
  let sessionManager;
  
  beforeEach(() => {
    sessionManager = mockSessionManager();
  });
  
  test('should create session', async () => {
    const testSession = createTestSession();
    sessionManager.createSession.mockResolvedValue(testSession);
    
    const result = await sessionController.create(req, res);
    
    expect(sessionManager.createSession).toHaveBeenCalled();
    expect(result.id).toBe(testSession.id);
  });
});
```

### Integration Test Example

```javascript
const { createAPIHelper } = require('../helpers/apiHelper');
const { setupTestDatabase, clearDatabase } = require('../helpers/testDatabase');

describe('Session API Integration', () => {
  let api;
  
  beforeAll(async () => {
    await setupTestDatabase();
    api = createAPIHelper(app);
    api.setDefaultUser();
  });
  
  beforeEach(async () => {
    await clearDatabase();
  });
  
  test('should create and retrieve session', async () => {
    // Create session
    const createResponse = await api.post('/api/sessions', {
      metadata: { projectName: 'Test Project' }
    });
    api.assertSuccess(createResponse, 201);
    
    // Retrieve session
    const sessionId = createResponse.body.data.id;
    const getResponse = await api.get(`/api/sessions/${sessionId}`);
    api.assertSuccess(getResponse);
    
    expect(getResponse.body.data.metadata.projectName).toBe('Test Project');
  });
});
```

### E2E Test Example

```javascript
const { createAPIHelper, testPatterns } = require('../helpers/apiHelper');
const { createTestUser } = require('../helpers/testFactory');

describe('Full Workflow E2E', () => {
  let api;
  
  beforeEach(() => {
    api = createAPIHelper(app);
    api.setDefaultUser();
  });
  
  test('complete PRD generation workflow', async () => {
    // Test full CRUD workflow
    const results = await testPatterns.testCRUD(
      api,
      '/api/sessions',
      { metadata: { projectName: 'E2E Test' } },
      { currentSection: 'requirements' }
    );
    
    expect(results.create.body.data.metadata.projectName).toBe('E2E Test');
    expect(results.update.body.data.currentSection).toBe('requirements');
  });
});
```

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on other tests
2. **Data Cleanup**: Use `clearDatabase()` between tests to ensure clean state
3. **Mock External Services**: Use provided mocks for AI services, Redis, etc.
4. **Realistic Test Data**: Use test factories to generate consistent, realistic data
5. **Proper Assertions**: Use the API helper assertion methods for consistent error checking
6. **Environment Variables**: Use `.env.test` for test-specific configuration

## Dependencies

The following testing dependencies have been added:

- **jest-extended**: Additional Jest matchers
- **supertest**: HTTP endpoint testing
- **nock**: HTTP request mocking
- **faker**: Test data generation
- **factory-bot**: Test data factories
- **redis-mock**: In-memory Redis for testing
- **msw**: API mocking service worker

## Troubleshooting

### Common Issues

1. **Database Connection Errors**: Ensure test database is properly configured in `.env.test`
2. **Mock Not Working**: Check that mocks are reset between tests using `resetAllMocks()`
3. **Timeout Errors**: Increase timeout in Jest configuration or individual tests
4. **Memory Leaks**: Ensure proper cleanup in `afterEach` and `afterAll` hooks

### Debug Mode

To run tests with debug output:

```bash
DEBUG=test:* npm test
```

### Coverage Reports

Coverage reports are generated in the `coverage/` directory. Open `coverage/lcov-report/index.html` in a browser to view detailed coverage information.