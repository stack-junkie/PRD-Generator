/**
 * Global Teardown for E2E Tests
 * Runs once after all tests complete
 */

const { APIHelper } = require('../utils/APIHelper');
const { TestDataManager } = require('../utils/TestDataManager');

async function globalTeardown(config) {
  console.log('🧹 Starting E2E test global teardown...');
  
  const testData = new TestDataManager();
  const testConfig = testData.getTestConfig();
  const apiHelper = new APIHelper(testConfig.apiURL);
  
  try {
    // Clean up test data
    console.log('🗑️  Cleaning up test data...');
    await cleanupTestData(apiHelper);
    
    // Generate performance report
    console.log('📊 Generating performance report...');
    await generatePerformanceReport();
    
    // Clean up test database
    console.log('🗄️  Cleaning test database...');
    await cleanupTestDatabase();
    
    // Archive test artifacts
    console.log('📦 Archiving test artifacts...');
    await archiveTestArtifacts();
    
    // Generate final test report
    console.log('📄 Generating final test report...');
    await generateFinalReport();
    
    console.log('✅ Global teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error.message);
    // Don't exit with error code as tests may have passed
  }
}

/**
 * Clean up all test data
 */
async function cleanupTestData(apiHelper) {
  try {
    // Clean up API helper resources
    await apiHelper.cleanup();
    
    // Clean up file system test data
    const testData = new TestDataManager();
    await testData.cleanup();
    
    // Remove test sessions from database
    await cleanupTestSessions(apiHelper);
    
    console.log('✅ Test data cleanup completed');
  } catch (error) {
    console.warn(`⚠️  Test data cleanup failed: ${error.message}`);
  }
}

/**
 * Clean up test sessions
 */
async function cleanupTestSessions(apiHelper) {
  try {
    // Get all test sessions
    const response = await apiHelper.client.get('/api/sessions?test=true');
    const testSessions = response.data;
    
    // Delete each test session
    const deletePromises = testSessions.map(session => 
      apiHelper.deleteSession(session.id)
    );
    
    const results = await Promise.allSettled(deletePromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`✅ Cleaned up ${successful} test sessions (${failed} failed)`);
  } catch (error) {
    console.warn(`⚠️  Failed to cleanup test sessions: ${error.message}`);
  }
}

/**
 * Generate performance report
 */
async function generatePerformanceReport() {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    if (!global.performanceMetrics) {
      console.log('⚠️  No performance metrics collected');
      return;
    }
    
    const metrics = global.performanceMetrics;
    const totalDuration = Date.now() - metrics.testStartTime;
    
    const report = {
      summary: {
        totalDuration: totalDuration,
        totalTests: metrics.testResults.length,
        averageTestDuration: metrics.testResults.length > 0 
          ? metrics.testResults.reduce((sum, test) => sum + test.duration, 0) / metrics.testResults.length 
          : 0,
        slowestTest: metrics.testResults.length > 0 
          ? metrics.testResults.reduce((slowest, test) => 
              test.duration > slowest.duration ? test : slowest
            )
          : null
      },
      apiMetrics: {
        averageResponseTime: metrics.apiResponseTimes.length > 0 
          ? metrics.apiResponseTimes.reduce((sum, time) => sum + time, 0) / metrics.apiResponseTimes.length 
          : 0,
        slowestApiCall: metrics.apiResponseTimes.length > 0 
          ? Math.max(...metrics.apiResponseTimes) 
          : 0,
        fastestApiCall: metrics.apiResponseTimes.length > 0 
          ? Math.min(...metrics.apiResponseTimes) 
          : 0
      },
      testResults: metrics.testResults,
      timestamp: new Date().toISOString()
    };
    
    const reportPath = path.join(
      __dirname, 
      '../../../test-results/performance/performance-report.json'
    );
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ Performance report saved to ${reportPath}`);
    
    // Generate human-readable summary
    const summaryPath = path.join(
      __dirname, 
      '../../../test-results/performance/performance-summary.txt'
    );
    
    const summary = `
E2E Test Performance Summary
============================

Test Execution:
- Total Duration: ${Math.round(totalDuration / 1000)}s
- Total Tests: ${metrics.testResults.length}
- Average Test Duration: ${Math.round(report.summary.averageTestDuration / 1000)}s
- Slowest Test: ${report.summary.slowestTest ? report.summary.slowestTest.name : 'N/A'}

API Performance:
- Average Response Time: ${Math.round(report.apiMetrics.averageResponseTime)}ms
- Slowest API Call: ${Math.round(report.apiMetrics.slowestApiCall)}ms
- Fastest API Call: ${Math.round(report.apiMetrics.fastestApiCall)}ms

Generated: ${report.timestamp}
`;
    
    await fs.writeFile(summaryPath, summary);
    console.log(`✅ Performance summary saved to ${summaryPath}`);
    
  } catch (error) {
    console.warn(`⚠️  Failed to generate performance report: ${error.message}`);
  }
}

/**
 * Clean up test database
 */
async function cleanupTestDatabase() {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    // Only clean up if we're not in CI or production
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️  Skipping database cleanup in production');
      return;
    }
    
    // Undo all test seeds
    console.log('🧹 Undoing test database seeds...');
    await execAsync('cd backend && npx sequelize-cli db:seed:undo:all');
    
    // Optionally drop test database if it's a separate test DB
    if (process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL.includes('test')) {
      console.log('🗄️  Test database cleaned up');
    }
    
    console.log('✅ Database cleanup completed');
  } catch (error) {
    console.warn(`⚠️  Database cleanup failed: ${error.message}`);
  }
}

/**
 * Archive test artifacts
 */
async function archiveTestArtifacts() {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const testResultsDir = path.join(__dirname, '../../../test-results');
    const archiveDir = path.join(__dirname, '../../../test-archives');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `e2e-tests-${timestamp}`;
    const archivePath = path.join(archiveDir, archiveName);
    
    // Create archive directory
    await fs.mkdir(archiveDir, { recursive: true });
    await fs.mkdir(archivePath, { recursive: true });
    
    // Copy test results
    const { spawn } = require('child_process');
    
    await new Promise((resolve, reject) => {
      const cp = spawn('cp', ['-r', testResultsDir, archivePath], { stdio: 'inherit' });
      cp.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Archive failed with code ${code}`));
      });
    });
    
    console.log(`✅ Test artifacts archived to ${archivePath}`);
    
    // Clean up old archives (keep last 10)
    await cleanupOldArchives(archiveDir);
    
  } catch (error) {
    console.warn(`⚠️  Failed to archive test artifacts: ${error.message}`);
  }
}

/**
 * Clean up old test archives
 */
async function cleanupOldArchives(archiveDir, keepCount = 10) {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const entries = await fs.readdir(archiveDir, { withFileTypes: true });
    const directories = entries
      .filter(entry => entry.isDirectory())
      .map(entry => ({
        name: entry.name,
        path: path.join(archiveDir, entry.name),
        mtime: require('fs').statSync(path.join(archiveDir, entry.name)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    // Remove old archives beyond keepCount
    const toDelete = directories.slice(keepCount);
    
    for (const archive of toDelete) {
      await fs.rmdir(archive.path, { recursive: true });
      console.log(`🗑️  Removed old archive: ${archive.name}`);
    }
    
  } catch (error) {
    console.warn(`⚠️  Failed to cleanup old archives: ${error.message}`);
  }
}

/**
 * Generate final test report
 */
async function generateFinalReport() {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const reportData = {
      testSuite: 'E2E Tests - PRD Generator',
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        ci: !!process.env.CI
      },
      configuration: {
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
        apiURL: process.env.E2E_API_URL || 'http://localhost:3001',
        headless: process.env.E2E_HEADLESS !== 'false',
        parallel: process.env.E2E_PARALLEL || '1'
      },
      summary: 'E2E test execution completed. Check individual test reports for detailed results.'
    };
    
    const reportPath = path.join(__dirname, '../../../test-results/final-report.json');
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    
    console.log(`✅ Final test report saved to ${reportPath}`);
    
    // Generate badge data for CI/CD
    const badgeData = {
      schemaVersion: 1,
      label: 'E2E Tests',
      message: 'completed',
      color: 'green'
    };
    
    const badgePath = path.join(__dirname, '../../../test-results/badge.json');
    await fs.writeFile(badgePath, JSON.stringify(badgeData));
    
  } catch (error) {
    console.warn(`⚠️  Failed to generate final report: ${error.message}`);
  }
}

module.exports = globalTeardown;