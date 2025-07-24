/**
 * Concurrent Users Performance Test
 * 
 * Tests the system's ability to handle multiple simultaneous users
 * performing various operations including session creation, message
 * processing, and PRD generation.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { CONFIG, getEnvironmentConfig, generateTestUser, generateSessionData, getRandomResponse } from '../config.js';

// Configuration
const ENV = getEnvironmentConfig(__ENV.ENVIRONMENT || 'local');
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '100');
const RAMP_DURATION = __ENV.RAMP_DURATION || '2m';
const STEADY_DURATION = __ENV.STEADY_DURATION || '5m';

// Custom Metrics
const concurrentSessions = new Gauge('concurrent_sessions_active');
const sessionCreateTime = new Trend('session_create_time');
const messageProcessTime = new Trend('message_process_time');
const userOperationsRate = new Rate('user_operations_success');
const concurrentErrors = new Counter('concurrent_errors');

export const options = {
  scenarios: {
    concurrent_users: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: RAMP_DURATION, target: Math.floor(TARGET_VUS * 0.3) },
        { duration: RAMP_DURATION, target: Math.floor(TARGET_VUS * 0.7) },
        { duration: RAMP_DURATION, target: TARGET_VUS },
        { duration: STEADY_DURATION, target: TARGET_VUS },
        { duration: RAMP_DURATION, target: Math.floor(TARGET_VUS * 0.5) },
        { duration: RAMP_DURATION, target: 0 }
      ]
    }
  },
  
  thresholds: {
    'http_req_duration': [`p(95)<${CONFIG.sla.apiResponseTime.p95}`],
    'session_create_time': [`p(95)<${CONFIG.sla.apiResponseTime.p95 * 2}`],
    'message_process_time': [`p(95)<${CONFIG.sla.aiResponseTime.p95}`],
    'user_operations_success': ['rate>0.95'],
    'concurrent_errors': ['count<50'],
    'http_req_failed': ['rate<0.05']
  }
};

export default function() {
  const userId = __VU; // Virtual User ID
  const user = generateTestUser(userId);
  
  concurrentSessions.add(1);
  
  group('Concurrent User Session', () => {
    // Authenticate user
    const authSuccess = authenticateUser(user);
    if (!authSuccess) {
      concurrentErrors.add(1);
      return;
    }
    
    // Create session
    const session = createUserSession(user);
    if (!session) {
      concurrentErrors.add(1);
      return;
    }
    
    // Perform concurrent operations
    performConcurrentOperations(user, session);
    
    // Cleanup
    cleanupUserSession(user, session.id);
  });
  
  concurrentSessions.add(-1);
  sleep(1);
}

function authenticateUser(user) {
  const startTime = Date.now();
  
  // Try to login first
  let response = http.post(`${ENV.BASE_URL}/api/auth/login`, 
    JSON.stringify({
      email: user.email,
      password: user.password
    }), 
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { operation: 'login' }
    }
  );
  
  if (response.status === 200) {
    const authData = response.json();
    user.token = authData.token;
    user.id = authData.user.id;
    
    const success = check(response, {
      'user login successful': (r) => r.status === 200
    });
    
    userOperationsRate.add(success);
    return success;
  }
  
  // If login fails, try to register
  response = http.post(`${ENV.BASE_URL}/api/auth/register`, 
    JSON.stringify({
      email: user.email,
      password: user.password,
      name: user.name
    }), 
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { operation: 'register' }
    }
  );
  
  if (response.status === 201) {
    // Login after successful registration
    return authenticateUser(user);
  }
  
  const success = check(response, {
    'user registration successful': (r) => r.status === 201
  });
  
  userOperationsRate.add(success);
  return success;
}

function createUserSession(user) {
  const startTime = Date.now();
  const sessionData = generateSessionData(__VU);
  
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
  
  const duration = Date.now() - startTime;
  sessionCreateTime.add(duration);
  
  const success = check(response, {
    'session created successfully': (r) => r.status === 201,
    'session has valid id': (r) => r.json() && r.json().id
  });
  
  userOperationsRate.add(success);
  
  if (success) {
    return response.json();
  }
  
  return null;
}

function performConcurrentOperations(user, session) {
  const operations = [
    () => submitMessage(user, session.id, 'introduction'),
    () => submitMessage(user, session.id, 'goals'),
    () => updateSessionProgress(user, session.id),
    () => getSessionStatus(user, session.id),
    () => validateSection(user, session.id, 'introduction'),
    () => submitMessage(user, session.id, 'audience'),
    () => getSessionHistory(user, session.id),
    () => updateSessionMetadata(user, session.id)
  ];
  
  // Execute operations with random timing to simulate real user behavior
  operations.forEach((operation, index) => {
    const success = operation();
    userOperationsRate.add(success);
    
    if (!success) {
      concurrentErrors.add(1);
    }
    
    // Random sleep between operations (0.5-2 seconds)
    sleep(Math.random() * 1.5 + 0.5);
  });
  
  // Attempt PRD generation if session is complete enough
  if (Math.random() > 0.5) { // 50% chance
    attemptPrdGeneration(user, session.id);
  }
}

function submitMessage(user, sessionId, section) {
  const startTime = Date.now();
  const response = getRandomResponse('medium');
  
  const httpResponse = http.post(`${ENV.BASE_URL}/api/sessions/${sessionId}/responses`, 
    JSON.stringify({
      section: section,
      response: response,
      timestamp: new Date().toISOString()
    }), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      tags: { operation: 'submit_message', section: section }
    }
  );
  
  const duration = Date.now() - startTime;
  messageProcessTime.add(duration);
  
  return check(httpResponse, {
    [`message submitted to ${section}`]: (r) => r.status === 200
  });
}

function updateSessionProgress(user, sessionId) {
  const response = http.patch(`${ENV.BASE_URL}/api/sessions/${sessionId}`, 
    JSON.stringify({
      lastActivity: new Date().toISOString(),
      currentSection: 'goals'
    }), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      tags: { operation: 'update_progress' }
    }
  );
  
  return check(response, {
    'session progress updated': (r) => r.status === 200
  });
}

function getSessionStatus(user, sessionId) {
  const response = http.get(`${ENV.BASE_URL}/api/sessions/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${user.token}`
    },
    tags: { operation: 'get_status' }
  });
  
  return check(response, {
    'session status retrieved': (r) => r.status === 200,
    'status has valid structure': (r) => {
      const data = r.json();
      return data && data.id && data.progress !== undefined;
    }
  });
}

function validateSection(user, sessionId, section) {
  const response = http.post(`${ENV.BASE_URL}/api/sessions/${sessionId}/validate/${section}`, 
    JSON.stringify({}), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      tags: { operation: 'validate_section', section: section }
    }
  );
  
  return check(response, {
    [`${section} section validated`]: (r) => r.status === 200
  });
}

function getSessionHistory(user, sessionId) {
  const response = http.get(`${ENV.BASE_URL}/api/sessions/${sessionId}/history`, {
    headers: {
      'Authorization': `Bearer ${user.token}`
    },
    tags: { operation: 'get_history' }
  });
  
  return check(response, {
    'session history retrieved': (r) => r.status === 200
  });
}

function updateSessionMetadata(user, sessionId) {
  const response = http.patch(`${ENV.BASE_URL}/api/sessions/${sessionId}/metadata`, 
    JSON.stringify({
      tags: ['performance-test', 'concurrent-user'],
      priority: 'normal'
    }), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      tags: { operation: 'update_metadata' }
    }
  );
  
  return check(response, {
    'session metadata updated': (r) => r.status === 200
  });
}

function attemptPrdGeneration(user, sessionId) {
  const startTime = Date.now();
  
  const response = http.post(`${ENV.BASE_URL}/api/sessions/${sessionId}/generate`, 
    JSON.stringify({}), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      timeout: '15s', // Extended timeout for PRD generation
      tags: { operation: 'generate_prd' }
    }
  );
  
  const duration = Date.now() - startTime;
  
  const success = check(response, {
    'PRD generation initiated': (r) => r.status === 200 || r.status === 202,
    'PRD generation completed in time': () => duration < CONFIG.sla.exportGenerationTime.p99
  });
  
  userOperationsRate.add(success);
  return success;
}

function cleanupUserSession(user, sessionId) {
  // Optional cleanup - mark session as test session for later cleanup
  http.patch(`${ENV.BASE_URL}/api/sessions/${sessionId}`, 
    JSON.stringify({
      tags: ['performance-test', 'cleanup-required'],
      status: 'completed'
    }), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      tags: { operation: 'cleanup' }
    }
  );
}

export function setup() {
  console.log(`Starting concurrent users test with ${TARGET_VUS} users`);
  console.log(`Environment: ${__ENV.ENVIRONMENT || 'local'}`);
  console.log(`Base URL: ${ENV.BASE_URL}`);
  
  // Verify API is accessible
  const healthCheck = http.get(`${ENV.BASE_URL}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }
  
  return {
    startTime: Date.now(),
    targetVUs: TARGET_VUS
  };
}

export function teardown(data) {
  const testDuration = Date.now() - data.startTime;
  console.log(`Concurrent users test completed in ${Math.round(testDuration / 1000)}s`);
  console.log(`Target VUs: ${data.targetVUs}`);
}

// Custom summary for concurrent users test
export function handleSummary(data) {
  const concurrentMetrics = {
    maxConcurrentSessions: Math.max(...(data.metrics.concurrent_sessions_active?.values?.values || [0])),
    avgSessionCreateTime: data.metrics.session_create_time?.values?.avg || 0,
    avgMessageProcessTime: data.metrics.message_process_time?.values?.avg || 0,
    operationSuccessRate: (data.metrics.user_operations_success?.values?.rate || 0) * 100,
    totalConcurrentErrors: data.metrics.concurrent_errors?.values?.count || 0
  };
  
  const summary = `
🚀 Concurrent Users Test Results
===============================

👥 Concurrency Metrics:
- Max Concurrent Sessions: ${concurrentMetrics.maxConcurrentSessions}
- Avg Session Create Time: ${Math.round(concurrentMetrics.avgSessionCreateTime)}ms
- Avg Message Process Time: ${Math.round(concurrentMetrics.avgMessageProcessTime)}ms
- Operation Success Rate: ${concurrentMetrics.operationSuccessRate.toFixed(2)}%
- Total Concurrent Errors: ${concurrentMetrics.totalConcurrentErrors}

📊 HTTP Metrics:
- Total Requests: ${data.metrics.http_reqs?.values?.count || 0}
- Avg Response Time: ${Math.round(data.metrics.http_req_duration?.values?.avg || 0)}ms
- P95 Response Time: ${Math.round(data.metrics.http_req_duration?.values?.['p(95)'] || 0)}ms
- Error Rate: ${((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%

✅ SLA Compliance:
- API Response Time (P95 < ${CONFIG.sla.apiResponseTime.p95}ms): ${(data.metrics.http_req_duration?.values?.['p(95)'] || 0) < CONFIG.sla.apiResponseTime.p95 ? '✅ PASS' : '❌ FAIL'}
- Operation Success Rate (> 95%): ${concurrentMetrics.operationSuccessRate > 95 ? '✅ PASS' : '❌ FAIL'}
- Error Rate (< 5%): ${((data.metrics.http_req_failed?.values?.rate || 0) * 100) < 5 ? '✅ PASS' : '❌ FAIL'}
`;

  return {
    'test-results/performance/concurrent-users-results.json': JSON.stringify({
      ...data,
      customMetrics: concurrentMetrics
    }),
    stdout: summary
  };
}