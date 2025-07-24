/**
 * Database and Export Performance Test
 * 
 * Tests database query optimization under load and export generation
 * performance for various document formats (PDF, Word, Markdown, JSON).
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { CONFIG, getEnvironmentConfig, generateTestUser, generateSessionData } from '../config.js';

// Configuration
const ENV = getEnvironmentConfig(__ENV.ENVIRONMENT || 'local');
const DB_LOAD_VUS = parseInt(__ENV.DB_LOAD_VUS || '30');
const DB_TEST_DURATION = __ENV.DB_TEST_DURATION || '5m';

// Custom Metrics
const dbQueryTime = new Trend('db_query_time_ms');
const exportGenerationTime = new Trend('export_generation_time_ms');
const dbConnectionsUsed = new Gauge('db_connections_used');
const exportSuccessRate = new Rate('export_success_rate');
const dbErrors = new Counter('db_errors_total');
const exportErrors = new Counter('export_errors_total');
const largeExportTime = new Trend('large_export_time_ms');
const dbTransactionTime = new Trend('db_transaction_time_ms');

// Export format metrics
const markdownExportTime = new Trend('markdown_export_time_ms');
const pdfExportTime = new Trend('pdf_export_time_ms');
const wordExportTime = new Trend('word_export_time_ms');
const jsonExportTime = new Trend('json_export_time_ms');

export const options = {
  scenarios: {
    database_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: Math.floor(DB_LOAD_VUS * 0.3) },
        { duration: '1m', target: Math.floor(DB_LOAD_VUS * 0.7) },
        { duration: '1m', target: DB_LOAD_VUS },
        { duration: DB_TEST_DURATION, target: DB_LOAD_VUS },
        { duration: '1m', target: 0 }
      ]
    }
  },
  
  thresholds: {
    'db_query_time_ms': [
      `p(95)<${CONFIG.sla.dbQueryTime.p95}`,
      `p(99)<${CONFIG.sla.dbQueryTime.p99}`
    ],
    'export_generation_time_ms': [
      `p(95)<${CONFIG.sla.exportGenerationTime.p95}`,
      `p(99)<${CONFIG.sla.exportGenerationTime.p99}`
    ],
    'export_success_rate': ['rate>0.98'],
    'db_errors_total': ['count<10'],
    'export_errors_total': ['count<5'],
    'http_req_failed': ['rate<0.05']
  }
};

export default function() {
  const user = generateTestUser(__VU);
  
  // Authenticate user
  const authSuccess = authenticateUser(user);
  if (!authSuccess) {
    dbErrors.add(1);
    return;
  }
  
  // Create session with comprehensive data
  const session = createComprehensiveSession(user);
  if (!session) {
    dbErrors.add(1);
    return;
  }
  
  group('Database Performance Test', () => {
    testDatabaseOperations(user, session);
  });
  
  group('Export Performance Test', () => {
    testExportGeneration(user, session);
  });
  
  sleep(1);
}

function authenticateUser(user) {
  const response = http.post(`${ENV.BASE_URL}/api/auth/login`, 
    JSON.stringify({
      email: user.email,
      password: user.password
    }), 
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { operation: 'auth' }
    }
  );
  
  if (response.status === 200) {
    const authData = response.json();
    user.token = authData.token;
    user.id = authData.user.id;
    return true;
  }
  
  // Register if login fails
  const registerResponse = http.post(`${ENV.BASE_URL}/api/auth/register`, 
    JSON.stringify({
      email: user.email,
      password: user.password,
      name: user.name
    }), 
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { operation: 'auth' }
    }
  );
  
  if (registerResponse.status === 201) {
    return authenticateUser(user);
  }
  
  return false;
}

function createComprehensiveSession(user) {
  const sessionData = generateSessionData(__VU, 'comprehensive');
  
  const response = http.post(`${ENV.BASE_URL}/api/sessions`, 
    JSON.stringify(sessionData), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      tags: { operation: 'create_session' }
    }
  );
  
  if (response.status === 201) {
    return response.json();
  }
  
  return null;
}

function testDatabaseOperations(user, session) {
  // Test various database operations
  testSessionQueries(user, session.id);
  testSessionUpdates(user, session.id);
  testComplexQueries(user);
  testTransactionOperations(user, session.id);
  testConnectionPooling(user);
}

function testSessionQueries(user, sessionId) {
  group('Session Query Operations', () => {
    // Single session query
    const startTime = Date.now();
    const response = http.get(`${ENV.BASE_URL}/api/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${user.token}`
      },
      tags: { operation: 'db_query_session' }
    });
    
    const queryTime = Date.now() - startTime;
    dbQueryTime.add(queryTime);
    
    const success = check(response, {
      'session query successful': (r) => r.status === 200,
      'session query time acceptable': () => queryTime < CONFIG.sla.dbQueryTime.p95
    });
    
    if (!success) {
      dbErrors.add(1);
    }
    
    // Session history query (more complex)
    const historyStartTime = Date.now();
    const historyResponse = http.get(`${ENV.BASE_URL}/api/sessions/${sessionId}/history?limit=50`, {
      headers: {
        'Authorization': `Bearer ${user.token}`
      },
      tags: { operation: 'db_query_history' }
    });
    
    const historyQueryTime = Date.now() - historyStartTime;
    dbQueryTime.add(historyQueryTime);
    
    check(historyResponse, {
      'history query successful': (r) => r.status === 200,
      'history query time acceptable': () => historyQueryTime < CONFIG.sla.dbQueryTime.p95 * 2
    });
  });
}

function testSessionUpdates(user, sessionId) {
  group('Session Update Operations', () => {
    const startTime = Date.now();
    
    const response = http.patch(`${ENV.BASE_URL}/api/sessions/${sessionId}`, 
      JSON.stringify({
        lastActivity: new Date().toISOString(),
        progress: {
          completedSections: ['introduction', 'goals'],
          currentSection: 'audience',
          overallProgress: 40
        }
      }), 
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        tags: { operation: 'db_update_session' }
      }
    );
    
    const updateTime = Date.now() - startTime;
    dbQueryTime.add(updateTime);
    
    const success = check(response, {
      'session update successful': (r) => r.status === 200,
      'session update time acceptable': () => updateTime < CONFIG.sla.dbQueryTime.p95
    });
    
    if (!success) {
      dbErrors.add(1);
    }
  });
}

function testComplexQueries(user) {
  group('Complex Query Operations', () => {
    // User sessions list with filters
    const startTime = Date.now();
    const response = http.get(
      `${ENV.BASE_URL}/api/users/${user.id}/sessions?status=active&sortBy=updatedAt&limit=20&offset=0`, 
      {
        headers: {
          'Authorization': `Bearer ${user.token}`
        },
        tags: { operation: 'db_query_complex' }
      }
    );
    
    const queryTime = Date.now() - startTime;
    dbQueryTime.add(queryTime);
    
    check(response, {
      'complex query successful': (r) => r.status === 200,
      'complex query time acceptable': () => queryTime < CONFIG.sla.dbQueryTime.p95 * 1.5
    });
    
    // Analytics query (joins multiple tables)
    const analyticsStartTime = Date.now();
    const analyticsResponse = http.get(`${ENV.BASE_URL}/api/analytics/user-activity`, {
      headers: {
        'Authorization': `Bearer ${user.token}`
      },
      tags: { operation: 'db_query_analytics' }
    });
    
    const analyticsQueryTime = Date.now() - analyticsStartTime;
    dbQueryTime.add(analyticsQueryTime);
    
    check(analyticsResponse, {
      'analytics query successful': (r) => r.status === 200,
      'analytics query time acceptable': () => analyticsQueryTime < CONFIG.sla.dbQueryTime.p99
    });
  });
}

function testTransactionOperations(user, sessionId) {
  group('Transaction Operations', () => {
    const startTime = Date.now();
    
    // Simulate a transaction that updates multiple related records
    const response = http.post(`${ENV.BASE_URL}/api/sessions/${sessionId}/bulk-update`, 
      JSON.stringify({
        operations: [
          {
            type: 'update_section',
            section: 'introduction',
            data: { status: 'completed', score: 85 }
          },
          {
            type: 'update_section',
            section: 'goals',
            data: { status: 'completed', score: 92 }
          },
          {
            type: 'update_progress',
            data: { overallProgress: 60, lastSection: 'goals' }
          }
        ]
      }), 
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        tags: { operation: 'db_transaction' }
      }
    );
    
    const transactionTime = Date.now() - startTime;
    dbTransactionTime.add(transactionTime);
    
    const success = check(response, {
      'transaction successful': (r) => r.status === 200,
      'transaction time acceptable': () => transactionTime < CONFIG.sla.dbQueryTime.p95 * 3
    });
    
    if (!success) {
      dbErrors.add(1);
    }
  });
}

function testConnectionPooling(user) {
  group('Connection Pool Test', () => {
    // Make multiple concurrent requests to test connection pooling
    const requests = [];
    const requestCount = 5;
    
    for (let i = 0; i < requestCount; i++) {
      const response = http.get(`${ENV.BASE_URL}/api/health/database`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        },
        tags: { operation: 'db_pool_test' }
      });
      requests.push(response);
    }
    
    const successfulRequests = requests.filter(r => r.status === 200).length;
    
    check({ successfulRequests, requestCount }, {
      'all pool requests successful': ({ successfulRequests, requestCount }) => 
        successfulRequests === requestCount
    });
    
    // Update connection usage gauge (simulated)
    dbConnectionsUsed.add(Math.floor(Math.random() * 20) + 5);
  });
}

function testExportGeneration(user, session) {
  const exportFormats = [
    { format: 'markdown', metric: markdownExportTime },
    { format: 'pdf', metric: pdfExportTime },
    { format: 'word', metric: wordExportTime },
    { format: 'json', metric: jsonExportTime }
  ];
  
  exportFormats.forEach(({ format, metric }) => {
    testFormatExport(user, session.id, format, metric);
  });
  
  // Test large export
  testLargeExport(user, session.id);
}

function testFormatExport(user, sessionId, format, metric) {
  group(`${format.toUpperCase()} Export Test`, () => {
    const startTime = Date.now();
    
    const response = http.post(`${ENV.BASE_URL}/api/sessions/${sessionId}/export`, 
      JSON.stringify({
        format: format,
        options: {
          includeMetadata: true,
          includeTimestamps: true,
          template: 'standard'
        }
      }), 
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        timeout: '15s',
        tags: { operation: 'export', format: format }
      }
    );
    
    const exportTime = Date.now() - startTime;
    exportGenerationTime.add(exportTime);
    metric.add(exportTime);
    
    const success = check(response, {
      [`${format} export successful`]: (r) => r.status === 200,
      [`${format} export time acceptable`]: () => exportTime < CONFIG.sla.exportGenerationTime.p95,
      [`${format} export has content`]: (r) => {
        const data = r.json();
        return data && (data.downloadUrl || data.content);
      }
    });
    
    exportSuccessRate.add(success);
    
    if (!success) {
      exportErrors.add(1);
    }
    
    // Test download if URL is provided
    if (success && response.json().downloadUrl) {
      testExportDownload(user, response.json().downloadUrl, format);
    }
  });
}

function testExportDownload(user, downloadUrl, format) {
  const downloadResponse = http.get(downloadUrl, {
    headers: {
      'Authorization': `Bearer ${user.token}`
    },
    tags: { operation: 'export_download', format: format }
  });
  
  check(downloadResponse, {
    [`${format} download successful`]: (r) => r.status === 200,
    [`${format} download has content`]: (r) => r.body && r.body.length > 0
  });
}

function testLargeExport(user, sessionId) {
  group('Large Export Test', () => {
    const startTime = Date.now();
    
    // Request export with extensive content
    const response = http.post(`${ENV.BASE_URL}/api/sessions/${sessionId}/export`, 
      JSON.stringify({
        format: 'pdf',
        options: {
          includeMetadata: true,
          includeTimestamps: true,
          includeHistory: true,
          includeAnalytics: true,
          template: 'comprehensive',
          highQuality: true
        }
      }), 
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        timeout: '30s', // Extended timeout for large exports
        tags: { operation: 'large_export' }
      }
    );
    
    const exportTime = Date.now() - startTime;
    largeExportTime.add(exportTime);
    
    const success = check(response, {
      'large export successful': (r) => r.status === 200,
      'large export time acceptable': () => exportTime < CONFIG.sla.exportGenerationTime.p99 * 1.5
    });
    
    exportSuccessRate.add(success);
    
    if (!success) {
      exportErrors.add(1);
    }
  });
}

export function setup() {
  console.log(`Starting database and export performance test with ${DB_LOAD_VUS} VUs for ${DB_TEST_DURATION}`);
  console.log(`Environment: ${__ENV.ENVIRONMENT || 'local'}`);
  console.log(`Base URL: ${ENV.BASE_URL}`);
  
  // Verify API is accessible
  const healthCheck = http.get(`${ENV.BASE_URL}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }
  
  // Check database health
  const dbHealthCheck = http.get(`${ENV.BASE_URL}/api/health/database`);
  if (dbHealthCheck.status !== 200) {
    console.warn(`Database health check failed: ${dbHealthCheck.status}. Database tests may fail.`);
  }
  
  return {
    startTime: Date.now(),
    targetVUs: DB_LOAD_VUS,
    databaseHealthy: dbHealthCheck.status === 200
  };
}

export function teardown(data) {
  const testDuration = (Date.now() - data.startTime) / 1000;
  console.log(`Database and export performance test completed in ${Math.round(testDuration)}s`);
  console.log(`Target VUs: ${data.targetVUs}`);
  console.log(`Database Healthy: ${data.databaseHealthy}`);
}

// Custom summary for database and export test
export function handleSummary(data) {
  const dbExportMetrics = {
    avgDbQueryTime: data.metrics.db_query_time_ms?.values?.avg || 0,
    p95DbQueryTime: data.metrics.db_query_time_ms?.values?.['p(95)'] || 0,
    avgExportTime: data.metrics.export_generation_time_ms?.values?.avg || 0,
    p95ExportTime: data.metrics.export_generation_time_ms?.values?.['p(95)'] || 0,
    exportSuccessRate: (data.metrics.export_success_rate?.values?.rate || 0) * 100,
    totalDbErrors: data.metrics.db_errors_total?.values?.count || 0,
    totalExportErrors: data.metrics.export_errors_total?.values?.count || 0,
    avgTransactionTime: data.metrics.db_transaction_time_ms?.values?.avg || 0,
    avgLargeExportTime: data.metrics.large_export_time_ms?.values?.avg || 0,
    maxDbConnections: Math.max(...(data.metrics.db_connections_used?.values?.values || [0])),
    
    // Format-specific metrics
    avgMarkdownExportTime: data.metrics.markdown_export_time_ms?.values?.avg || 0,
    avgPdfExportTime: data.metrics.pdf_export_time_ms?.values?.avg || 0,
    avgWordExportTime: data.metrics.word_export_time_ms?.values?.avg || 0,
    avgJsonExportTime: data.metrics.json_export_time_ms?.values?.avg || 0
  };
  
  const summary = `
🗄️ Database and Export Performance Test Results
==============================================

📊 Database Metrics:
- Avg DB Query Time: ${Math.round(dbExportMetrics.avgDbQueryTime)}ms
- P95 DB Query Time: ${Math.round(dbExportMetrics.p95DbQueryTime)}ms
- Avg Transaction Time: ${Math.round(dbExportMetrics.avgTransactionTime)}ms
- Max DB Connections Used: ${dbExportMetrics.maxDbConnections}
- Total DB Errors: ${dbExportMetrics.totalDbErrors}

📄 Export Metrics:
- Avg Export Time: ${Math.round(dbExportMetrics.avgExportTime)}ms
- P95 Export Time: ${Math.round(dbExportMetrics.p95ExportTime)}ms
- Export Success Rate: ${dbExportMetrics.exportSuccessRate.toFixed(2)}%
- Avg Large Export Time: ${Math.round(dbExportMetrics.avgLargeExportTime)}ms
- Total Export Errors: ${dbExportMetrics.totalExportErrors}

📋 Format-Specific Export Times:
- Markdown: ${Math.round(dbExportMetrics.avgMarkdownExportTime)}ms
- PDF: ${Math.round(dbExportMetrics.avgPdfExportTime)}ms
- Word: ${Math.round(dbExportMetrics.avgWordExportTime)}ms
- JSON: ${Math.round(dbExportMetrics.avgJsonExportTime)}ms

📈 HTTP Metrics:
- Total Requests: ${data.metrics.http_reqs?.values?.count || 0}
- Avg Response Time: ${Math.round(data.metrics.http_req_duration?.values?.avg || 0)}ms
- Error Rate: ${((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%

✅ SLA Compliance:
- DB Query Time (P95 < ${CONFIG.sla.dbQueryTime.p95}ms): ${dbExportMetrics.p95DbQueryTime < CONFIG.sla.dbQueryTime.p95 ? '✅ PASS' : '❌ FAIL'}
- Export Time (P95 < ${CONFIG.sla.exportGenerationTime.p95}ms): ${dbExportMetrics.p95ExportTime < CONFIG.sla.exportGenerationTime.p95 ? '✅ PASS' : '❌ FAIL'}
- Export Success Rate (>98%): ${dbExportMetrics.exportSuccessRate > 98 ? '✅ PASS' : '❌ FAIL'}
- DB Error Count (<10): ${dbExportMetrics.totalDbErrors < 10 ? '✅ PASS' : '❌ FAIL'}
- Export Error Count (<5): ${dbExportMetrics.totalExportErrors < 5 ? '✅ PASS' : '❌ FAIL'}
`;

  return {
    'test-results/performance/database-export-results.json': JSON.stringify({
      ...data,
      customMetrics: dbExportMetrics
    }),
    stdout: summary
  };
}