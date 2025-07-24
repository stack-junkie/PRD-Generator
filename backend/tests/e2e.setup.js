// E2E test setup file
const { setupTestDatabase, clearDatabase, closeDatabase } = require('./helpers/testDatabase');
const { createMockServices, resetAllMocks } = require('./helpers/mockServices');

// Global test services
global.testServices = null;

// Setup before all e2e tests
beforeAll(async () => {
  // Setup test database
  await setupTestDatabase();
  
  // Create mock services
  global.testServices = createMockServices();
  
  // Set longer timeout for e2e tests
  jest.setTimeout(30000);
}, 30000);

// Cleanup after all e2e tests
afterAll(async () => {
  // Close database connection
  await closeDatabase();
  
  // Reset all mocks
  if (global.testServices) {
    resetAllMocks();
  }
}, 10000);

// Reset between e2e tests
beforeEach(async () => {
  // Clear database data
  await clearDatabase();
  
  // Reset mock services
  if (global.testServices) {
    resetAllMocks();
  }
}, 10000);