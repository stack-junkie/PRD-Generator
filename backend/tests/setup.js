// Test setup for backend
const { setupTestDatabase } = require('./helpers/database');
const { clearRedis } = require('./helpers/redis');

// Setup before all tests
beforeAll(async () => {
  await setupTestDatabase();
});

// Cleanup after all tests
afterAll(async () => {
  await clearRedis();
});

// Reset between tests
beforeEach(() => {
  jest.clearAllMocks();
});