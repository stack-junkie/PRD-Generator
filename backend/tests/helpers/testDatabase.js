const { Sequelize } = require('sequelize');

let sequelize;
let testDb;

/**
 * Setup test database connection and schema
 */
async function setupTestDatabase() {
  try {
    // Create test database connection
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:', // In-memory database for tests
      logging: false, // Disable SQL logging in tests
      define: {
        timestamps: true,
        underscored: true,
      },
    });

    // Test the connection
    await sequelize.authenticate();
    
    // Sync all models (create tables)
    await sequelize.sync({ force: true });
    
    testDb = sequelize;
    return sequelize;
  } catch (error) {
    console.error('Unable to setup test database:', error);
    throw error;
  }
}

/**
 * Clear all data from test database
 */
async function clearDatabase() {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  try {
    // Get all model names
    const models = Object.keys(testDb.models);
    
    // Disable foreign key checks for cleanup
    await testDb.query('PRAGMA foreign_keys = OFF');
    
    // Truncate all tables
    for (const modelName of models) {
      await testDb.models[modelName].destroy({
        where: {},
        truncate: true,
        cascade: true,
      });
    }
    
    // Re-enable foreign key checks
    await testDb.query('PRAGMA foreign_keys = ON');
  } catch (error) {
    console.error('Error clearing test database:', error);
    throw error;
  }
}

/**
 * Seed database with test fixtures
 */
async function seedDatabase(fixtures = {}) {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  try {
    const seededData = {};
    
    // Seed data in dependency order
    const seedOrder = ['User', 'Session', 'ConversationMessage', 'PRDSection'];
    
    for (const modelName of seedOrder) {
      if (fixtures[modelName] && testDb.models[modelName]) {
        const data = Array.isArray(fixtures[modelName]) 
          ? fixtures[modelName] 
          : [fixtures[modelName]];
        
        seededData[modelName] = await testDb.models[modelName].bulkCreate(data, {
          returning: true,
        });
      }
    }
    
    return seededData;
  } catch (error) {
    console.error('Error seeding test database:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (testDb) {
    try {
      await testDb.close();
      testDb = null;
      sequelize = null;
    } catch (error) {
      console.error('Error closing test database:', error);
      throw error;
    }
  }
}

/**
 * Get test database instance
 */
function getTestDatabase() {
  return testDb;
}

/**
 * Execute raw SQL query on test database
 */
async function executeQuery(sql, options = {}) {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }
  
  return testDb.query(sql, options);
}

/**
 * Create a transaction for test isolation
 */
async function createTransaction() {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }
  
  return testDb.transaction();
}

module.exports = {
  setupTestDatabase,
  clearDatabase,
  seedDatabase,
  closeDatabase,
  getTestDatabase,
  executeQuery,
  createTransaction,
};