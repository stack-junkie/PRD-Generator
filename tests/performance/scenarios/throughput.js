/**
 * Message Processing Throughput Test
 * 
 * Tests the system's ability to process messages at high throughput,
 * measuring requests per second, queue processing times, and system
 * capacity under sustained load.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { CONFIG, getEnvironmentConfig, generateTestUser, getRandomResponse } from '../config.js';

// Configuration
const ENV = getEnvironmentConfig(__ENV.ENVIRONMENT || 'local');
const TARGET_RPS = parseInt(__ENV.TARGET_RPS || '50'); // Requests per second
const TEST_DURATION = __ENV.TEST_DURATION || '5m';
const MAX_VUS = parseInt(__ENV.MAX_VUS || '100');

// Custom Metrics
const messagesProcessed = new Counter('messages_processed_total');
const messageQueueTime = new Trend('message_queue_time');
const messageProcessingRate = new Rate('message_processing_success');
const throughputErrors = new Counter('throughput_errors');
const currentRPS = new Gauge('current_requests_per_second');
const queueDepth = new Gauge('message_queue_depth');
const processingLatency = new Trend('processing_latency');

export const options = {
  scenarios: {
    throughput_test: {
      executor: 'constant-arrival-rate',
      rate: TARGET_RPS,
      timeUnit: '1s',
      duration: TEST_DURATION,
      preAllocatedVUs: Math.min(20, MAX_VUS),
      maxVUs: MAX_VUS
    }
  },
  
  thresholds: {
    'http_req_duration': [`p(95)<${CONFIG.sla.apiResponseTime.p95}`],
    'message_processing_success': ['rate>0.98'],
    'throughput_errors': ['count<100'],
    'processing_latency': [`p(95)<${CONFIG.sla.apiResponseTime.p95 * 2}`],
    'http_req_failed': ['rate<0.02']
  }
};

// Shared test data
let authenticatedUsers = [];
let sessionPool = [];

export default function() {
  // Get or create authenticated user
  const user = getAuthenticatedUser();
  if (!user) {
    throughputErrors.add(1);
    return;
  }
  
  // Get or create session
  const session = getSession(user);
  if (!session) {
    throughputErrors.add(1);
    return;
  }
  
  group('Message Throughput Test', () => {
    const success = processMessageBatch(user, session);
    messageProcessingRate.add(success);
    
    if (!success) {
      throughputErrors.add(1);
    }
  });
  
  // Update RPS gauge
  currentRPS.add(1);
}

function getAuthenticatedUser() {
  // Reuse existing authenticated users to reduce auth overhead
  if (authenticatedUsers.length > 0) {
    return authenticatedUsers[Math.floor(Math.random() * authenticatedUsers.length)];
  }
  
  // Create new authenticated user
  const user = generateTestUser(__VU + Date.now());
  const success = authenticateUser(user);
  
  if (success) {
    authenticatedUsers.push(user);
    return user;
  }
  
  return null;
}

function authenticateUser(user) {
  // Try login first
  let response = http.post(`${ENV.BASE_URL}/api/auth/login`, 
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
  response = http.post(`${ENV.BASE_URL}/api/auth/register`, 
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
  
  if (response.status === 201) {
    return authenticateUser(user);
  }
  
  return false;
}

function getSession(user) {
  // Reuse existing sessions to focus on message processing
  const userSessions = sessionPool.filter(s => s.userId === user.id);
  if (userSessions.length > 0) {
    return userSessions[Math.floor(Math.random() * userSessions.length)];
  }
  
  // Create new session
  const sessionData = {
    name: `Throughput Test Session ${Date.now()}`,
    type: 'throughput_test'
  };
  
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
    const session = response.json();
    session.userId = user.id;
    sessionPool.push(session);
    return session;
  }
  
  return null;
}

function processMessageBatch(user, session) {
  const batchSize = Math.floor(Math.random() * 3) + 1; // 1-3 messages per batch
  const results = [];
  
  for (let i = 0; i < batchSize; i++) {
    const result = processMessage(user, session, i);
    results.push(result);
  }
  
  const successCount = results.filter(r => r).length;
  messagesProcessed.add(successCount);
  
  return successCount === batchSize;
}

function processMessage(user, session, messageIndex) {
  const sections = ['introduction', 'goals', 'audience', 'user_stories', 'requirements'];
  const section = sections[Math.floor(Math.random() * sections.length)];
  const message = getRandomResponse('medium');
  
  const startTime = Date.now();
  const queueStartTime = Date.now();
  
  // Simulate queue time by adding artificial delay
  sleep(Math.random() * 0.1); // 0-100ms queue simulation
  const queueTime = Date.now() - queueStartTime;
  messageQueueTime.add(queueTime);
  
  const response = http.post(`${ENV.BASE_URL}/api/sessions/${session.id}/responses`, 
    JSON.stringify({
      section: section,
      response: message,
      messageId: `throughput_${Date.now()}_${messageIndex}`,
      timestamp: new Date().toISOString(),
      priority: 'normal'
    }), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      tags: { 
        operation: 'process_message',
        section: section,
        batch_index: messageIndex
      }
    }
  );
  
  const totalTime = Date.now() - startTime;
  processingLatency.add(totalTime);
  
  const success = check(response, {
    'message processed successfully': (r) => r.status === 200,
    'processing time acceptable': () => totalTime < CONFIG.sla.apiResponseTime.p95 * 2
  });
  
  // Simulate processing feedback
  if (success && Math.random() > 0.7) {
    // 30% chance to get processing status
    checkProcessingStatus(user, session.id, response.json()?.messageId);
  }
  
  return success;
}

function checkProcessingStatus(user, sessionId, messageId) {
  if (!messageId) return false;
  
  const response = http.get(`${ENV.BASE_URL}/api/sessions/${sessionId}/messages/${messageId}/status`, {
    headers: {
      'Authorization': `Bearer ${user.token}`
    },
    tags: { operation: 'check_status' }
  });
  
  return check(response, {
    'status check successful': (r) => r.status === 200
  });
}

// Specialized throughput scenarios
export function burstThroughputTest() {
  group('Burst Throughput Test', () => {
    const user = getAuthenticatedUser();
    const session = getSession(user);
    
    if (!user || !session) {
      throughputErrors.add(1);
      return;
    }
    
    // Send burst of messages rapidly
    const burstSize = 10;
    const startTime = Date.now();
    
    for (let i = 0; i < burstSize; i++) {
      const success = processMessage(user, session, i);
      if (!success) {
        throughputErrors.add(1);
      }
    }
    
    const burstTime = Date.now() - startTime;
    const burstRPS = (burstSize / burstTime) * 1000;
    
    check({ burstRPS }, {
      'burst processing rate acceptable': ({ burstRPS }) => burstRPS > TARGET_RPS * 0.8
    });
  });
}

export function sustainedThroughputTest() {
  group('Sustained Throughput Test', () => {
    const user = getAuthenticatedUser();
    const session = getSession(user);
    
    if (!user || !session) {
      throughputErrors.add(1);
      return;
    }
    
    // Process messages at steady rate
    const duration = 30; // 30 seconds
    const interval = 1000 / TARGET_RPS; // milliseconds between requests
    const startTime = Date.now();
    let processedCount = 0;
    
    while ((Date.now() - startTime) < (duration * 1000)) {
      const success = processMessage(user, session, processedCount);
      if (success) {
        processedCount++;
      } else {
        throughputErrors.add(1);
      }
      
      sleep(interval / 1000); // Convert to seconds for k6
    }
    
    const actualDuration = (Date.now() - startTime) / 1000;
    const actualRPS = processedCount / actualDuration;
    
    check({ actualRPS }, {
      'sustained RPS achieved': ({ actualRPS }) => actualRPS >= TARGET_RPS * 0.9
    });
  });
}

export function setup() {
  console.log(`Starting throughput test - Target: ${TARGET_RPS} RPS for ${TEST_DURATION}`);
  console.log(`Environment: ${__ENV.ENVIRONMENT || 'local'}`);
  console.log(`Base URL: ${ENV.BASE_URL}`);
  
  // Verify API is accessible
  const healthCheck = http.get(`${ENV.BASE_URL}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }
  
  // Pre-authenticate some users and create sessions
  console.log('Pre-authenticating users and creating sessions...');
  
  for (let i = 0; i < Math.min(10, MAX_VUS); i++) {
    const user = generateTestUser(`setup_${i}`);
    const authSuccess = authenticateUser(user);
    
    if (authSuccess) {
      authenticatedUsers.push(user);
      
      // Create a few sessions per user
      for (let j = 0; j < 2; j++) {
        const session = getSession(user);
        if (session) {
          sessionPool.push(session);
        }
      }
    }
  }
  
  console.log(`Pre-authenticated ${authenticatedUsers.length} users`);
  console.log(`Pre-created ${sessionPool.length} sessions`);
  
  return {
    startTime: Date.now(),
    targetRPS: TARGET_RPS,
    preAuthUsers: authenticatedUsers.length,
    preSessions: sessionPool.length
  };
}

export function teardown(data) {
  const testDuration = (Date.now() - data.startTime) / 1000;
  console.log(`Throughput test completed in ${Math.round(testDuration)}s`);
  console.log(`Target RPS: ${data.targetRPS}`);
  console.log(`Pre-authenticated users: ${data.preAuthUsers}`);
  console.log(`Pre-created sessions: ${data.preSessions}`);
  
  // Cleanup test sessions
  console.log('Cleaning up test sessions...');
  sessionPool.forEach(session => {
    const user = authenticatedUsers.find(u => u.id === session.userId);
    if (user) {
      http.delete(`${ENV.BASE_URL}/api/sessions/${session.id}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
    }
  });
}

// Custom summary for throughput test
export function handleSummary(data) {
  const throughputMetrics = {
    totalMessagesProcessed: data.metrics.messages_processed_total?.values?.count || 0,
    avgMessageQueueTime: data.metrics.message_queue_time?.values?.avg || 0,
    avgProcessingLatency: data.metrics.processing_latency?.values?.avg || 0,
    messageProcessingSuccessRate: (data.metrics.message_processing_success?.values?.rate || 0) * 100,
    totalThroughputErrors: data.metrics.throughput_errors?.values?.count || 0,
    peakRPS: Math.max(...(data.metrics.current_requests_per_second?.values?.values || [0]))
  };
  
  const testDuration = data.state.testRunDuration / 1000;
  const actualRPS = (data.metrics.http_reqs?.values?.count || 0) / testDuration;
  
  const summary = `
🚀 Message Processing Throughput Test Results
============================================

📊 Throughput Metrics:
- Target RPS: ${TARGET_RPS}
- Actual RPS: ${actualRPS.toFixed(2)}
- Peak RPS: ${throughputMetrics.peakRPS}
- Total Messages Processed: ${throughputMetrics.totalMessagesProcessed}
- Message Success Rate: ${throughputMetrics.messageProcessingSuccessRate.toFixed(2)}%
- Total Throughput Errors: ${throughputMetrics.totalThroughputErrors}

⏱️ Latency Metrics:
- Avg Queue Time: ${Math.round(throughputMetrics.avgMessageQueueTime)}ms
- Avg Processing Latency: ${Math.round(throughputMetrics.avgProcessingLatency)}ms
- P95 HTTP Duration: ${Math.round(data.metrics.http_req_duration?.values?.['p(95)'] || 0)}ms

📈 HTTP Metrics:
- Total Requests: ${data.metrics.http_reqs?.values?.count || 0}
- Avg Response Time: ${Math.round(data.metrics.http_req_duration?.values?.avg || 0)}ms
- Error Rate: ${((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%

✅ Performance Targets:
- RPS Target (${TARGET_RPS}): ${actualRPS >= TARGET_RPS * 0.9 ? '✅ PASS' : '❌ FAIL'} (${((actualRPS / TARGET_RPS) * 100).toFixed(1)}%)
- Message Success Rate (>98%): ${throughputMetrics.messageProcessingSuccessRate > 98 ? '✅ PASS' : '❌ FAIL'}
- Processing Latency (P95 < ${CONFIG.sla.apiResponseTime.p95 * 2}ms): ${(data.metrics.processing_latency?.values?.['p(95)'] || 0) < CONFIG.sla.apiResponseTime.p95 * 2 ? '✅ PASS' : '❌ FAIL'}
- HTTP Error Rate (<2%): ${((data.metrics.http_req_failed?.values?.rate || 0) * 100) < 2 ? '✅ PASS' : '❌ FAIL'}
`;

  return {
    'test-results/performance/throughput-results.json': JSON.stringify({
      ...data,
      customMetrics: throughputMetrics,
      actualRPS: actualRPS,
      targetRPS: TARGET_RPS
    }),
    stdout: summary
  };
}