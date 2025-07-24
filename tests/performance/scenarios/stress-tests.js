/**
 * Stress Test Scenarios
 * 
 * Comprehensive stress testing including spike testing, endurance testing,
 * volume testing, and breakpoint testing to find system limits and ensure
 * stability under extreme conditions.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { CONFIG, getEnvironmentConfig, generateTestUser, generateSessionData, getRandomResponse } from '../config.js';

// Configuration
const ENV = getEnvironmentConfig(__ENV.ENVIRONMENT || 'local');
const STRESS_TEST_TYPE = __ENV.STRESS_TEST_TYPE || 'spike'; // spike, endurance, volume, breakpoint
const MAX_VUS = parseInt(__ENV.MAX_VUS || '500');
const ENDURANCE_DURATION = __ENV.ENDURANCE_DURATION || '30m';

// Custom Metrics
const stressErrors = new Counter('stress_errors_total');
const systemRecoveryTime = new Trend('system_recovery_time_ms');
const peakResponseTime = new Trend('peak_response_time_ms');
const resourceExhaustion = new Counter('resource_exhaustion_count');
const concurrentConnections = new Gauge('concurrent_connections');
const memoryPressure = new Gauge('memory_pressure_indicator');
const errorSpike = new Counter('error_spike_count');
const recoverySuccess = new Rate('recovery_success_rate');

// Scenario Configurations
const stressScenarios = {
  spike: {
    executor: 'ramping-vus',
    startVUs: 10,
    stages: [
      { duration: '1m', target: 10 },     // Normal load
      { duration: '30s', target: 200 },   // Rapid spike to high load
      { duration: '2m', target: 200 },    // Maintain high load
      { duration: '30s', target: 10 },    // Rapid drop
      { duration: '2m', target: 10 },     // Recovery period
      { duration: '30s', target: 300 },   // Second spike - higher
      { duration: '1m', target: 300 },    // Maintain peak
      { duration: '1m', target: 0 }       // Complete drop
    ]
  },
  
  endurance: {
    executor: 'constant-vus',
    vus: 50,
    duration: ENDURANCE_DURATION
  },
  
  volume: {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: [
      { duration: '2m', target: 20 },
      { duration: '10m', target: 20 }
    ]
  },
  
  breakpoint: {
    executor: 'ramping-arrival-rate',
    startRate: 1,
    timeUnit: '1s',
    preAllocatedVUs: 50,
    maxVUs: MAX_VUS,
    stages: [
      { duration: '2m', target: 10 },
      { duration: '2m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '2m', target: 400 },
      { duration: '2m', target: 500 }
    ]
  }
};

export const options = {
  scenarios: {
    [STRESS_TEST_TYPE]: stressScenarios[STRESS_TEST_TYPE]
  },
  
  thresholds: {
    // Relaxed thresholds for stress testing
    'http_req_duration': ['p(95)<2000'], // 2 seconds max under stress
    'http_req_failed': ['rate<0.5'],     // 50% max failure rate allowed
    'stress_errors_total': ['count<1000'],
    'recovery_success_rate': ['rate>0.8'] // 80% recovery success rate
  }
};

export default function() {
  const user = generateTestUser(__VU);
  concurrentConnections.add(1);
  
  // Track memory pressure (simulated)
  memoryPressure.add(Math.random() * 100);
  
  try {
    switch (STRESS_TEST_TYPE) {
      case 'spike':
        spikeTestScenario(user);
        break;
      case 'endurance':
        enduranceTestScenario(user);
        break;
      case 'volume':
        volumeTestScenario(user);
        break;
      case 'breakpoint':
        breakpointTestScenario(user);
        break;
      default:
        spikeTestScenario(user);
    }
  } catch (error) {
    stressErrors.add(1);
  } finally {
    concurrentConnections.add(-1);
  }
  
  sleep(Math.random() * 2); // Random sleep to create realistic traffic patterns
}

function spikeTestScenario(user) {
  group('Spike Test Scenario', () => {
    // Simulate rapid user behavior during spike
    const operations = [
      () => rapidAuthentication(user),
      () => rapidSessionCreation(user),
      () => rapidMessageSubmission(user),
      () => rapidStatusChecks(user)
    ];
    
    operations.forEach(operation => {
      const startTime = Date.now();
      const success = operation();
      const duration = Date.now() - startTime;
      
      peakResponseTime.add(duration);
      
      if (!success) {
        stressErrors.add(1);
        errorSpike.add(1);
      }
      
      // No sleep during spike to maximize load
    });
    
    // Test system recovery
    testSystemRecovery(user);
  });
}

function enduranceTestScenario(user) {
  group('Endurance Test Scenario', () => {
    // Authenticate once for the entire duration
    const authSuccess = authenticateUser(user);
    if (!authSuccess) {
      stressErrors.add(1);
      return;
    }
    
    // Create a session for sustained operations
    const session = createSession(user);
    if (!session) {
      stressErrors.add(1);
      return;
    }
    
    // Perform sustained operations
    sustainedOperations(user, session);
    
    // Check for memory leaks or degradation
    checkSystemHealth(user);
  });
}

function volumeTestScenario(user) {
  group('Volume Test Scenario', () => {
    // Test with large data volumes
    const authSuccess = authenticateUser(user);
    if (!authSuccess) {
      stressErrors.add(1);
      return;
    }
    
    // Create session with extensive data
    const largeSession = createLargeDataSession(user);
    if (!largeSession) {
      stressErrors.add(1);
      return;
    }
    
    // Process large volumes of data
    processLargeDataVolume(user, largeSession);
    
    // Test export with large data
    testLargeDataExport(user, largeSession.id);
  });
}

function breakpointTestScenario(user) {
  group('Breakpoint Test Scenario', () => {
    // Find system breaking point with rapid requests
    const requests = [];
    const requestCount = 10;
    
    for (let i = 0; i < requestCount; i++) {
      const success = rapidAPICall(user, i);
      requests.push(success);
      
      if (!success) {
        resourceExhaustion.add(1);
      }
    }
    
    const successRate = requests.filter(r => r).length / requestCount;
    if (successRate < 0.5) {
      // System is likely at breaking point
      resourceExhaustion.add(1);
    }
  });
}

function rapidAuthentication(user) {
  const response = http.post(`${ENV.BASE_URL}/api/auth/login`, 
    JSON.stringify({
      email: user.email,
      password: user.password
    }), 
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '5s',
      tags: { operation: 'rapid_auth' }
    }
  );
  
  if (response.status === 200) {
    const authData = response.json();
    user.token = authData.token;
    user.id = authData.user.id;
    return true;
  }
  
  // Quick registration attempt
  const registerResponse = http.post(`${ENV.BASE_URL}/api/auth/register`, 
    JSON.stringify({
      email: user.email,
      password: user.password,
      name: user.name
    }), 
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '5s',
      tags: { operation: 'rapid_register' }
    }
  );
  
  return registerResponse.status === 201;
}

function rapidSessionCreation(user) {
  if (!user.token) return false;
  
  const sessionData = {
    name: `Stress Test Session ${__VU}_${Date.now()}`,
    type: 'stress_test'
  };
  
  const response = http.post(`${ENV.BASE_URL}/api/sessions`, 
    JSON.stringify(sessionData), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      timeout: '5s',
      tags: { operation: 'rapid_session_create' }
    }
  );
  
  return response.status === 201;
}

function rapidMessageSubmission(user) {
  if (!user.token) return false;
  
  const response = http.post(`${ENV.BASE_URL}/api/messages/quick`, 
    JSON.stringify({
      content: 'Stress test message',
      priority: 'high'
    }), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      timeout: '3s',
      tags: { operation: 'rapid_message' }
    }
  );
  
  return response.status === 200 || response.status === 202;
}

function rapidStatusChecks(user) {
  if (!user.token) return false;
  
  const response = http.get(`${ENV.BASE_URL}/api/health/user`, {
    headers: {
      'Authorization': `Bearer ${user.token}`
    },
    timeout: '2s',
    tags: { operation: 'rapid_status' }
  });
  
  return response.status === 200;
}

function testSystemRecovery(user) {
  // Wait a moment and test if system can recover
  sleep(2);
  
  const recoveryStartTime = Date.now();
  const response = http.get(`${ENV.BASE_URL}/api/health`, {
    timeout: '10s',
    tags: { operation: 'recovery_test' }
  });
  
  const recoveryTime = Date.now() - recoveryStartTime;
  systemRecoveryTime.add(recoveryTime);
  
  const recovered = check(response, {
    'system recovery successful': (r) => r.status === 200
  });
  
  recoverySuccess.add(recovered);
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

function createSession(user) {
  const sessionData = generateSessionData(__VU, 'standard');
  
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
  
  return response.status === 201 ? response.json() : null;
}

function sustainedOperations(user, session) {
  // Perform operations continuously during endurance test
  const operations = [
    () => updateSession(user, session.id),
    () => submitMessage(user, session.id),
    () => checkSessionStatus(user, session.id),
    () => getSessionHistory(user, session.id)
  ];
  
  // Cycle through operations multiple times
  for (let cycle = 0; cycle < 5; cycle++) {
    operations.forEach((operation, index) => {
      const success = operation();
      if (!success) {
        stressErrors.add(1);
      }
      
      // Small delay between operations
      sleep(0.1);
    });
  }
}

function updateSession(user, sessionId) {
  const response = http.patch(`${ENV.BASE_URL}/api/sessions/${sessionId}`, 
    JSON.stringify({
      lastActivity: new Date().toISOString(),
      tags: ['endurance-test']
    }), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      tags: { operation: 'update_session' }
    }
  );
  
  return response.status === 200;
}

function submitMessage(user, sessionId) {
  const response = http.post(`${ENV.BASE_URL}/api/sessions/${sessionId}/messages`, 
    JSON.stringify({
      content: getRandomResponse('medium'),
      section: 'general'
    }), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      tags: { operation: 'submit_message' }
    }
  );
  
  return response.status === 200;
}

function checkSessionStatus(user, sessionId) {
  const response = http.get(`${ENV.BASE_URL}/api/sessions/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${user.token}`
    },
    tags: { operation: 'check_status' }
  });
  
  return response.status === 200;
}

function getSessionHistory(user, sessionId) {
  const response = http.get(`${ENV.BASE_URL}/api/sessions/${sessionId}/history`, {
    headers: {
      'Authorization': `Bearer ${user.token}`
    },
    tags: { operation: 'get_history' }
  });
  
  return response.status === 200;
}

function checkSystemHealth(user) {
  const healthChecks = [
    `${ENV.BASE_URL}/api/health`,
    `${ENV.BASE_URL}/api/health/database`,
    `${ENV.BASE_URL}/api/health/memory`,
    `${ENV.BASE_URL}/api/health/disk`
  ];
  
  healthChecks.forEach(url => {
    const response = http.get(url, {
      headers: user.token ? { 'Authorization': `Bearer ${user.token}` } : {},
      tags: { operation: 'health_check' }
    });
    
    if (response.status !== 200) {
      stressErrors.add(1);
    }
  });
}

function createLargeDataSession(user) {
  const largeSessionData = generateSessionData(__VU, 'comprehensive');
  
  // Add extensive additional data
  largeSessionData.extensiveData = {
    requirements: new Array(50).fill(0).map((_, i) => 
      `Requirement ${i}: ${getRandomResponse('long')}`
    ),
    userStories: new Array(30).fill(0).map((_, i) => 
      `User Story ${i}: ${getRandomResponse('medium')}`
    ),
    technicalSpecs: new Array(20).fill(0).map((_, i) => 
      `Technical Spec ${i}: ${getRandomResponse('technical')}`
    )
  };
  
  const response = http.post(`${ENV.BASE_URL}/api/sessions`, 
    JSON.stringify(largeSessionData), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      timeout: '15s', // Extended timeout for large data
      tags: { operation: 'create_large_session' }
    }
  );
  
  return response.status === 201 ? response.json() : null;
}

function processLargeDataVolume(user, session) {
  // Process large amounts of data
  const dataChunks = 10;
  
  for (let i = 0; i < dataChunks; i++) {
    const largeData = {
      chunkId: i,
      data: getRandomResponse('long').repeat(5), // Very large content
      metadata: {
        timestamp: new Date().toISOString(),
        size: 'large',
        processingTime: Date.now()
      }
    };
    
    const response = http.post(`${ENV.BASE_URL}/api/sessions/${session.id}/data/process`, 
      JSON.stringify(largeData), 
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        timeout: '20s',
        tags: { operation: 'process_large_data' }
      }
    );
    
    if (response.status !== 200) {
      stressErrors.add(1);
    }
  }
}

function testLargeDataExport(user, sessionId) {
  const response = http.post(`${ENV.BASE_URL}/api/sessions/${sessionId}/export`, 
    JSON.stringify({
      format: 'pdf',
      includeAllData: true,
      highQuality: true
    }), 
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      timeout: '30s',
      tags: { operation: 'large_data_export' }
    }
  );
  
  return response.status === 200;
}

function rapidAPICall(user, index) {
  const endpoints = [
    '/api/health',
    '/api/sessions',
    '/api/users/me',
    '/api/system/status'
  ];
  
  const endpoint = endpoints[index % endpoints.length];
  const response = http.get(`${ENV.BASE_URL}${endpoint}`, {
    headers: user.token ? { 'Authorization': `Bearer ${user.token}` } : {},
    timeout: '1s', // Very short timeout to stress system
    tags: { operation: 'rapid_api_call' }
  });
  
  return response.status === 200;
}

export function setup() {
  console.log(`Starting stress test: ${STRESS_TEST_TYPE}`);
  console.log(`Max VUs: ${MAX_VUS}`);
  console.log(`Environment: ${__ENV.ENVIRONMENT || 'local'}`);
  console.log(`Base URL: ${ENV.BASE_URL}`);
  
  if (STRESS_TEST_TYPE === 'endurance') {
    console.log(`Endurance Duration: ${ENDURANCE_DURATION}`);
  }
  
  // Verify API is accessible before stress testing
  const healthCheck = http.get(`${ENV.BASE_URL}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }
  
  return {
    startTime: Date.now(),
    testType: STRESS_TEST_TYPE,
    maxVUs: MAX_VUS
  };
}

export function teardown(data) {
  const testDuration = (Date.now() - data.startTime) / 1000;
  console.log(`Stress test (${data.testType}) completed in ${Math.round(testDuration)}s`);
  console.log(`Max VUs: ${data.maxVUs}`);
  
  // Final health check to see if system recovered
  const finalHealthCheck = http.get(`${ENV.BASE_URL}/api/health`);
  console.log(`Final system health: ${finalHealthCheck.status === 200 ? 'HEALTHY' : 'DEGRADED'}`);
}

// Custom summary for stress tests
export function handleSummary(data) {
  const stressMetrics = {
    testType: STRESS_TEST_TYPE,
    totalStressErrors: data.metrics.stress_errors_total?.values?.count || 0,
    avgSystemRecoveryTime: data.metrics.system_recovery_time_ms?.values?.avg || 0,
    avgPeakResponseTime: data.metrics.peak_response_time_ms?.values?.avg || 0,
    p99PeakResponseTime: data.metrics.peak_response_time_ms?.values?.['p(99)'] || 0,
    resourceExhaustionCount: data.metrics.resource_exhaustion_count?.values?.count || 0,
    maxConcurrentConnections: Math.max(...(data.metrics.concurrent_connections?.values?.values || [0])),
    maxMemoryPressure: Math.max(...(data.metrics.memory_pressure_indicator?.values?.values || [0])),
    errorSpikeCount: data.metrics.error_spike_count?.values?.count || 0,
    recoverySuccessRate: (data.metrics.recovery_success_rate?.values?.rate || 0) * 100
  };
  
  const testDuration = data.state.testRunDuration / 1000;
  const avgRPS = (data.metrics.http_reqs?.values?.count || 0) / testDuration;
  const peakErrorRate = ((data.metrics.http_req_failed?.values?.rate || 0) * 100);
  
  const summary = `
💥 Stress Test Results - ${STRESS_TEST_TYPE.toUpperCase()}
=======================================

🎯 Test Configuration:
- Test Type: ${STRESS_TEST_TYPE}
- Duration: ${Math.round(testDuration)}s
- Max VUs: ${MAX_VUS}
- Total Requests: ${data.metrics.http_reqs?.values?.count || 0}
- Average RPS: ${avgRPS.toFixed(2)}

🔥 Stress Metrics:
- Total Stress Errors: ${stressMetrics.totalStressErrors}
- Error Spike Count: ${stressMetrics.errorSpikeCount}
- Resource Exhaustion: ${stressMetrics.resourceExhaustionCount}
- Max Concurrent Connections: ${stressMetrics.maxConcurrentConnections}
- Max Memory Pressure: ${Math.round(stressMetrics.maxMemoryPressure)}%

⚡ Performance Under Stress:
- Avg Peak Response Time: ${Math.round(stressMetrics.avgPeakResponseTime)}ms
- P99 Peak Response Time: ${Math.round(stressMetrics.p99PeakResponseTime)}ms
- Peak Error Rate: ${peakErrorRate.toFixed(2)}%
- Avg Recovery Time: ${Math.round(stressMetrics.avgSystemRecoveryTime)}ms
- Recovery Success Rate: ${stressMetrics.recoverySuccessRate.toFixed(2)}%

📊 HTTP Metrics:
- Avg Response Time: ${Math.round(data.metrics.http_req_duration?.values?.avg || 0)}ms
- P95 Response Time: ${Math.round(data.metrics.http_req_duration?.values?.['p(95)'] || 0)}ms
- Overall Error Rate: ${peakErrorRate.toFixed(2)}%

🏥 System Resilience:
- System Recovery Rate: ${stressMetrics.recoverySuccessRate > 80 ? '✅ GOOD' : '⚠️ NEEDS IMPROVEMENT'}
- Error Handling: ${stressMetrics.totalStressErrors < 100 ? '✅ GOOD' : '⚠️ HIGH ERROR COUNT'}
- Resource Management: ${stressMetrics.resourceExhaustionCount < 5 ? '✅ GOOD' : '⚠️ RESOURCE ISSUES'}
- Peak Performance: ${stressMetrics.p99PeakResponseTime < 5000 ? '✅ ACCEPTABLE' : '⚠️ SLOW UNDER STRESS'}
`;

  return {
    'test-results/performance/stress-test-results.json': JSON.stringify({
      ...data,
      customMetrics: stressMetrics,
      avgRPS: avgRPS,
      testConfiguration: {
        type: STRESS_TEST_TYPE,
        maxVUs: MAX_VUS,
        duration: testDuration
      }
    }),
    stdout: summary
  };
}