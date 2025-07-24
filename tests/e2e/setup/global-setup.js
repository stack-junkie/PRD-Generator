/**
 * Global Setup for E2E Tests
 * Runs once before all tests
 */

const { APIHelper } = require('../utils/APIHelper');
const { TestDataManager } = require('../utils/TestDataManager');

async function globalSetup(config) {
  console.log('🚀 Starting E2E test global setup...');
  
  const testData = new TestDataManager();
  const testConfig = testData.getTestConfig();
  const apiHelper = new APIHelper(testConfig.apiURL);
  
  try {
    // Wait for services to be ready
    console.log('⏳ Waiting for services to be ready...');
    await waitForServices(testConfig);
    
    // Verify API health
    console.log('🏥 Checking API health...');
    const health = await apiHelper.checkHealth();
    console.log('✅ API health check passed:', health.status);
    
    // Set up test database
    console.log('🗄️  Setting up test database...');
    await setupTestDatabase();
    
    // Create test user accounts if needed
    console.log('👤 Setting up test users...');
    await setupTestUsers(apiHelper);
    
    // Initialize test data
    console.log('📊 Initializing test data...');
    await initializeTestData(apiHelper);
    
    // Set up performance monitoring
    console.log('📈 Setting up performance monitoring...');
    await setupPerformanceMonitoring();
    
    console.log('✅ Global setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error.message);
    process.exit(1);
  }
}

/**
 * Wait for all required services to be ready
 */
async function waitForServices(config, maxRetries = 30) {
  const axios = require('axios');
  
  const services = [
    { name: 'Frontend', url: config.baseURL },
    { name: 'Backend API', url: config.apiURL + '/api/health' },
  ];
  
  for (const service of services) {
    console.log(`⏳ Waiting for ${service.name} at ${service.url}...`);
    
    let retries = 0;
    while (retries < maxRetries) {
      try {
        await axios.get(service.url, { timeout: 5000 });
        console.log(`✅ ${service.name} is ready`);
        break;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          throw new Error(`${service.name} failed to start after ${maxRetries} retries`);
        }
        console.log(`⏳ ${service.name} not ready, retrying... (${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}

/**
 * Set up test database
 */
async function setupTestDatabase() {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    // Run database migrations
    console.log('🔄 Running database migrations...');
    await execAsync('cd backend && npm run db:migrate');
    
    // Clear existing test data
    console.log('🧹 Clearing existing test data...');
    await execAsync('cd backend && npx sequelize-cli db:seed:undo:all');
    
    // Seed test data
    console.log('🌱 Seeding test data...');
    await execAsync('cd backend && npm run db:seed');
    
    console.log('✅ Test database setup completed');
  } catch (error) {
    throw new Error(`Database setup failed: ${error.message}`);
  }
}

/**
 * Set up test users
 */
async function setupTestUsers(apiHelper) {
  const testUsers = [
    {
      email: 'test.user@example.com',
      password: 'TestPassword123!',
      name: 'Test User',
      role: 'user'
    },
    {
      email: 'test.admin@example.com',
      password: 'AdminPassword123!',
      name: 'Test Admin',
      role: 'admin'
    }
  ];
  
  for (const user of testUsers) {
    try {
      // Try to authenticate first (user might already exist)
      await apiHelper.authenticate({
        email: user.email,
        password: user.password
      });
      console.log(`✅ Test user ${user.email} already exists`);
    } catch (error) {
      // User doesn't exist, create them
      try {
        const response = await apiHelper.client.post('/api/auth/register', user);
        console.log(`✅ Created test user: ${user.email}`);
      } catch (createError) {
        console.warn(`⚠️  Failed to create test user ${user.email}: ${createError.message}`);
      }
    }
  }
}

/**
 * Initialize common test data
 */
async function initializeTestData(apiHelper) {
  const testData = new TestDataManager();
  
  try {
    // Create sample sessions for testing
    const sampleSessions = [
      testData.getCompleteSessionData(),
      testData.getPartialSessionData(),
      testData.getMinimalSessionData()
    ];
    
    for (let i = 0; i < sampleSessions.length; i++) {
      const session = await apiHelper.createSession({
        name: `Sample Session ${i + 1}`,
        type: 'template',
        data: sampleSessions[i]
      });
      console.log(`✅ Created sample session: ${session.id}`);
    }
    
  } catch (error) {
    console.warn(`⚠️  Failed to initialize test data: ${error.message}`);
  }
}

/**
 * Set up performance monitoring
 */
async function setupPerformanceMonitoring() {
  // Set up performance tracking globals
  global.performanceMetrics = {
    testStartTime: Date.now(),
    testResults: [],
    apiResponseTimes: []
  };
  
  // Create performance report directory
  const fs = require('fs').promises;
  const path = require('path');
  
  const perfDir = path.join(__dirname, '../../../test-results/performance');
  
  try {
    await fs.mkdir(perfDir, { recursive: true });
    console.log('✅ Performance monitoring directory created');
  } catch (error) {
    console.warn(`⚠️  Failed to create performance directory: ${error.message}`);
  }
  
  // Set up environment variables for performance tracking
  process.env.PERFORMANCE_TRACKING = 'true';
  process.env.PERF_REPORT_DIR = perfDir;
}

module.exports = globalSetup;