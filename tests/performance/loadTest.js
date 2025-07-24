/**
 * K6 Performance Test Suite for PRD Generator
 * 
 * This comprehensive performance test suite validates the PRD Generator application
 * under various load conditions including concurrent users, throughput testing,
 * and stress scenarios.
 * 
 * Usage:
 * k6 run tests/performance/loadTest.js
 * k6 run --env SCENARIO=concurrent tests/performance/loadTest.js
 * k6 run --env SCENARIO=ai-response tests/performance/loadTest.js
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const FRONTEND_URL = __ENV.FRONTEND_URL || 'http://localhost:3000';
const SCENARIO = __ENV.SCENARIO || 'default';
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '100');
const DURATION = __ENV.DURATION || '5m';

// Performance targets (SLA thresholds)
const PERFORMANCE_TARGETS = {
  API_RESPONSE_TIME: 200,        // < 200ms for non-AI endpoints
  AI_RESPONSE_TIME: 3000,        // < 3s for AI responses
  EXPORT_GENERATION_TIME: 5000,  // < 5s for export generation
  ERROR_RATE: 0.1,               // < 0.1% error rate
  UPTIME: 99.9                   // 99.9% uptime
};

// =============================================================================
// CUSTOM METRICS
// =============================================================================

const customMetrics = {
  // API Performance Metrics
  apiResponseTime: new Trend('api_response_time'),
  aiResponseTime: new Trend('ai_response_time'),
  exportGenerationTime: new Trend('export_generation_time'),
  dbQueryTime: new Trend('db_query_time'),
  
  // Business Metrics
  sessionsCreated: new Counter('sessions_created'),
  sectionsCompleted: new Counter('sections_completed'),
  prdsGenerated: new Counter('prds_generated'),
  exportsGenerated: new Counter('exports_generated'),
  
  // Error Metrics
  apiErrors: new Counter('api_errors'),
  aiErrors: new Counter('ai_errors'),
  timeoutErrors: new Counter('timeout_errors'),
  
  // Resource Metrics
  concurrentSessions: new Gauge('concurrent_sessions'),
  memoryUsage: new Gauge('memory_usage_mb'),
  cpuUtilization: new Gauge('cpu_utilization_percent'),
  dbConnections: new Gauge('db_connections'),
  
  // Token Usage Metrics
  inputTokens: new Counter('input_tokens'),
  outputTokens: new Counter('output_tokens'),
  tokenCost: new Counter('token_cost_usd')
};

// =============================================================================
// TEST DATA
// =============================================================================

const testData = {
  users: generateTestUsers(TARGET_VUS),
  sessions: generateSessionData(),
  responses: generateResponseData(),
  largeContent: generateLargeContent()
};

function generateTestUsers(count) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push({
      email: `loadtest.user${i}@example.com`,
      password: 'LoadTest123!',
      name: `Load Test User ${i}`,
      id: null,
      token: null
    });
  }
  return users;
}

function generateSessionData() {
  return {
    complete: {
      introduction: {
        productName: 'Advanced Analytics Platform',
        description: 'A comprehensive analytics platform for enterprise data visualization and insights.',
        vision: 'To democratize data analytics across all business units.',
        scope: 'Full-featured analytics platform with real-time processing capabilities.'
      },
      goals: {
        primary: 'Increase data-driven decision making by 75%',
        secondary: ['Reduce report generation time', 'Improve data accuracy', 'Enable self-service analytics'],
        success_criteria: 'User adoption >80%, Query response time <2s, 99.9% uptime'
      },
      audience: {
        primary: 'Business analysts and data scientists',
        secondary: 'Executive leadership and department heads',
        personas: ['Technical Analyst', 'Business User', 'Executive Viewer']
      },
      user_stories: [
        'As a business analyst, I want to create custom dashboards so I can monitor KPIs',
        'As a data scientist, I want to run complex queries so I can perform advanced analysis',
        'As an executive, I want executive summaries so I can make strategic decisions'
      ],
      requirements: {
        functional: [
          'Real-time data processing',
          'Custom dashboard creation',
          'Advanced query builder',
          'Automated report generation',
          'Data export capabilities'
        ],
        non_functional: [
          'Sub-2 second query response time',
          '99.9% uptime SLA',
          'Support 10,000 concurrent users',
          'GDPR compliance',
          'Enterprise SSO integration'
        ]
      },
      metrics: {
        adoption: 'Monthly active users >1000',
        performance: 'Average query time <2s',
        satisfaction: 'User satisfaction score >4.5/5',
        business: '25% increase in data-driven decisions'
      },
      questions: [
        'How will we handle data privacy for EU users?',
        'What is the budget for third-party integrations?',
        'Who will provide ongoing technical support?'
      ]
    },
    partial: {
      introduction: {
        productName: 'Mobile Shopping App',
        description: 'Next-generation mobile commerce platform'
      },
      goals: {
        primary: 'Increase mobile sales conversion by 40%'
      }
    },
    minimal: {
      introduction: {
        productName: 'Task Manager Pro'
      }
    }
  };
}

function generateResponseData() {
  return {
    short: 'This is a brief response to the AI question.',
    medium: 'This is a medium-length response that provides more detail about the product requirements. It includes specific examples and explains the reasoning behind certain decisions. The content is substantial enough to trigger quality scoring.',
    long: 'This is an extensive response that covers multiple aspects of the product requirements in great detail. '.repeat(20),
    technical: 'The system shall implement OAuth 2.0 authentication with PKCE extension for mobile clients. Database operations must support ACID transactions with row-level locking. API responses shall include ETags for caching optimization. The frontend will use WebSocket connections for real-time updates with automatic reconnection logic.',
    business: 'The target market consists of enterprise customers with 100-5000 employees who currently struggle with data silos and manual reporting processes. Our solution addresses this by providing unified analytics with self-service capabilities, resulting in 60% reduction in report generation time and 40% increase in data-driven decision making.',
    invalid: 'no', // Too short, will trigger validation
    empty: ''
  };
}

function generateLargeContent() {
  const sections = [];
  const sectionTemplates = [
    'Detailed functional requirements: ',
    'Technical architecture overview: ',
    'User interface specifications: ',
    'Performance requirements: ',
    'Security considerations: ',
    'Integration requirements: ',
    'Testing strategy: ',
    'Deployment procedures: '
  ];
  
  sectionTemplates.forEach(template => {
    sections.push(template + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100));
  });
  
  return sections.join('\n\n');
}

// =============================================================================
// SCENARIO CONFIGURATIONS
// =============================================================================

const scenarios = {
  // Default load test - moderate concurrent users
  default: {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: [
      { duration: '2m', target: 20 },   // Ramp up
      { duration: '3m', target: 50 },   // Stay at 50 users
      { duration: '2m', target: 100 },  // Ramp to 100 users
      { duration: '3m', target: 100 },  // Stay at 100 users
      { duration: '2m', target: 0 },    // Ramp down
    ],
  },
  
  // Concurrent user sessions test
  concurrent: {
    executor: 'constant-vus',
    vus: TARGET_VUS,
    duration: DURATION,
  },
  
  // Message processing throughput test
  throughput: {
    executor: 'constant-arrival-rate',
    rate: 50, // 50 requests per second
    timeUnit: '1s',
    duration: DURATION,
    preAllocatedVUs: 10,
    maxVUs: 100,
  },
  
  // AI response time under load
  'ai-response': {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: [
      { duration: '1m', target: 5 },
      { duration: '3m', target: 20 },
      { duration: '1m', target: 5 },
    ],
  },
  
  // Spike testing - sudden load increase
  spike: {
    executor: 'ramping-vus',
    startVUs: 10,
    stages: [
      { duration: '1m', target: 10 },   // Normal load
      { duration: '30s', target: 200 }, // Spike to 200 users
      { duration: '1m', target: 200 },  // Stay at spike
      { duration: '30s', target: 10 },  // Return to normal
      { duration: '1m', target: 10 },   // Stay at normal
    ],
  },
  
  // Endurance testing - sustained load
  endurance: {
    executor: 'constant-vus',
    vus: 50,
    duration: '30m', // Extended duration
  },
  
  // Volume testing - large PRDs
  volume: {
    executor: 'constant-vus',
    vus: 20,
    duration: '10m',
  },
  
  // Breakpoint testing - find system limits
  breakpoint: {
    executor: 'ramping-arrival-rate',
    startRate: 1,
    timeUnit: '1s',
    preAllocatedVUs: 50,
    maxVUs: 500,
    stages: [
      { duration: '2m', target: 10 },   // Start with 10 RPS
      { duration: '2m', target: 50 },   // Ramp to 50 RPS
      { duration: '2m', target: 100 },  // Ramp to 100 RPS
      { duration: '2m', target: 200 },  // Ramp to 200 RPS
      { duration: '2m', target: 300 },  // Find breaking point
    ],
  }
};

export const options = {
  scenarios: {
    [SCENARIO]: scenarios[SCENARIO] || scenarios.default
  },
  
  thresholds: {
    // Response time thresholds
    'http_req_duration': [
      `p(95)<${PERFORMANCE_TARGETS.API_RESPONSE_TIME}`, // 95th percentile < 200ms
      `p(99)<${PERFORMANCE_TARGETS.API_RESPONSE_TIME * 2}` // 99th percentile < 400ms
    ],
    'ai_response_time': [
      `p(95)<${PERFORMANCE_TARGETS.AI_RESPONSE_TIME}`,
      `p(99)<${PERFORMANCE_TARGETS.AI_RESPONSE_TIME * 1.5}`
    ],
    'export_generation_time': [
      `p(95)<${PERFORMANCE_TARGETS.EXPORT_GENERATION_TIME}`,
      `p(99)<${PERFORMANCE_TARGETS.EXPORT_GENERATION_TIME * 1.5}`
    ],
    
    // Error rate thresholds
    'http_req_failed': [`rate<${PERFORMANCE_TARGETS.ERROR_RATE / 100}`],
    'api_errors': ['count<10'],
    'ai_errors': ['count<5'],
    
    // Business metric thresholds
    'sessions_created': ['count>0'],
    'prds_generated': ['count>0']
  }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getRandomUser() {
  return testData.users[Math.floor(Math.random() * testData.users.length)];
}

function getRandomSessionData() {
  const types = ['complete', 'partial', 'minimal'];
  const type = types[Math.floor(Math.random() * types.length)];
  return testData.sessions[type];
}

function getRandomResponse() {
  const types = ['short', 'medium', 'long', 'technical', 'business'];
  const type = types[Math.floor(Math.random() * types.length)];
  return testData.responses[type];
}

function authenticateUser(user) {
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, {
    email: user.email,
    password: user.password
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (loginResponse.status === 200) {
    const loginData = loginResponse.json();
    user.token = loginData.token;
    user.id = loginData.user.id;
    return true;
  }
  
  // Try to register if login fails
  const registerResponse = http.post(`${BASE_URL}/api/auth/register`, {
    email: user.email,
    password: user.password,
    name: user.name
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (registerResponse.status === 201) {
    return authenticateUser(user); // Try login again
  }
  
  return false;
}

function createAuthHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token}`
  };
}

function measurePerformance(name, fn) {
  const startTime = Date.now();
  const result = fn();
  const duration = Date.now() - startTime;
  
  customMetrics.apiResponseTime.add(duration);
  
  return result;
}

// =============================================================================
// TEST SCENARIOS
// =============================================================================

export default function() {
  const user = getRandomUser();
  
  // Authenticate user
  group('Authentication', () => {
    const success = authenticateUser(user);
    check(success, {
      'user authenticated successfully': (success) => success === true
    });
    
    if (!success) {
      customMetrics.apiErrors.add(1);
      return;
    }
  });
  
  // Based on scenario, run different test patterns
  switch (SCENARIO) {
    case 'concurrent':
      concurrentUserSessionTest(user);
      break;
    case 'throughput':
      messageProcessingThroughputTest(user);
      break;
    case 'ai-response':
      aiResponseTimeTest(user);
      break;
    case 'volume':
      volumeTest(user);
      break;
    case 'breakpoint':
      breakpointTest(user);
      break;
    default:
      standardWorkflowTest(user);
  }
  
  sleep(1);
}

// =============================================================================
// TEST IMPLEMENTATIONS
// =============================================================================

function concurrentUserSessionTest(user) {
  group('Concurrent User Session Test', () => {
    customMetrics.concurrentSessions.add(1);
    
    // Create session
    const sessionData = getRandomSessionData();
    const createResponse = measurePerformance('create_session', () => 
      http.post(`${BASE_URL}/api/sessions`, sessionData, {
        headers: createAuthHeaders(user)
      })
    );
    
    const sessionCreated = check(createResponse, {
      'session created': (r) => r.status === 201
    });
    
    if (!sessionCreated) {
      customMetrics.apiErrors.add(1);
      return;
    }
    
    customMetrics.sessionsCreated.add(1);
    const session = createResponse.json();
    
    // Simulate concurrent activity
    const activities = [
      () => updateSessionProgress(user, session.id),
      () => submitResponse(user, session.id, 'introduction'),
      () => getSessionStatus(user, session.id),
      () => validateSection(user, session.id, 'introduction')
    ];
    
    // Execute multiple activities concurrently
    activities.forEach(activity => {
      activity();
      sleep(0.1); // Small delay between activities
    });
    
    customMetrics.concurrentSessions.add(-1);
  });
}

function messageProcessingThroughputTest(user) {
  group('Message Processing Throughput Test', () => {
    const sessionData = getRandomSessionData();
    const session = createSession(user, sessionData);
    
    if (!session) return;
    
    // Send multiple messages rapidly
    const messageCount = 5;
    const responses = [];
    
    for (let i = 0; i < messageCount; i++) {
      const response = getRandomResponse();
      const submitStart = Date.now();
      
      const submitResponse = http.post(
        `${BASE_URL}/api/sessions/${session.id}/responses`,
        {
          section: 'introduction',
          response: response,
          messageId: `msg_${i}_${Date.now()}`
        },
        { headers: createAuthHeaders(user) }
      );
      
      const submitDuration = Date.now() - submitStart;
      customMetrics.apiResponseTime.add(submitDuration);
      
      responses.push(submitResponse);
      
      check(submitResponse, {
        [`message ${i} processed`]: (r) => r.status === 200
      });
    }
    
    // Verify all messages were processed
    const processedCount = responses.filter(r => r.status === 200).length;
    check(processedCount, {
      'all messages processed': (count) => count === messageCount
    });
  });
}

function aiResponseTimeTest(user) {
  group('AI Response Time Test', () => {
    const sessionData = getRandomSessionData();
    const session = createSession(user, sessionData);
    
    if (!session) return;
    
    // Submit response that requires AI processing
    const complexResponse = testData.responses.technical + testData.responses.business;
    
    const aiStart = Date.now();
    const aiResponse = http.post(
      `${BASE_URL}/api/sessions/${session.id}/ai/process`,
      {
        section: 'requirements',
        response: complexResponse,
        context: session.context
      },
      { 
        headers: createAuthHeaders(user),
        timeout: '10s' // Extended timeout for AI
      }
    );
    
    const aiDuration = Date.now() - aiStart;
    customMetrics.aiResponseTime.add(aiDuration);
    
    const aiSuccess = check(aiResponse, {
      'AI response received': (r) => r.status === 200,
      'AI response time acceptable': (r) => aiDuration < PERFORMANCE_TARGETS.AI_RESPONSE_TIME
    });
    
    if (!aiSuccess) {
      customMetrics.aiErrors.add(1);
    }
    
    // Track token usage if available
    if (aiResponse.status === 200) {
      const aiData = aiResponse.json();
      if (aiData.tokens) {
        customMetrics.inputTokens.add(aiData.tokens.input || 0);
        customMetrics.outputTokens.add(aiData.tokens.output || 0);
        customMetrics.tokenCost.add(aiData.tokens.cost || 0);
      }
    }
  });
}

function volumeTest(user) {
  group('Volume Test - Large PRD', () => {
    // Create session with large content
    const largeSessionData = {
      introduction: {
        productName: 'Enterprise Data Platform',
        description: testData.largeContent,
        vision: testData.largeContent.substring(0, 1000),
        scope: testData.largeContent.substring(1000, 2000)
      },
      requirements: {
        functional: testData.largeContent.split('\n\n'),
        non_functional: testData.largeContent.split('\n\n').slice(0, 10)
      }
    };
    
    const session = createSession(user, largeSessionData);
    if (!session) return;
    
    // Test large response processing
    const largeResponse = testData.largeContent + testData.responses.technical.repeat(5);
    
    const processStart = Date.now();
    const processResponse = http.post(
      `${BASE_URL}/api/sessions/${session.id}/responses`,
      {
        section: 'requirements',
        response: largeResponse
      },
      { 
        headers: createAuthHeaders(user),
        timeout: '15s'
      }
    );
    
    const processDuration = Date.now() - processStart;
    customMetrics.apiResponseTime.add(processDuration);
    
    check(processResponse, {
      'large content processed': (r) => r.status === 200,
      'processing time acceptable': () => processDuration < 10000 // 10s limit
    });
    
    // Test PRD generation with large content
    testPrdGeneration(user, session.id);
  });
}

function breakpointTest(user) {
  group('Breakpoint Test', () => {
    // Rapidly create sessions to find breaking point
    const sessions = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < 10; i++) {
      const sessionData = getRandomSessionData();
      const createResponse = http.post(`${BASE_URL}/api/sessions`, sessionData, {
        headers: createAuthHeaders(user),
        timeout: '5s'
      });
      
      if (createResponse.status === 201) {
        successCount++;
        sessions.push(createResponse.json());
      } else {
        errorCount++;
        customMetrics.apiErrors.add(1);
      }
    }
    
    customMetrics.sessionsCreated.add(successCount);
    
    // Rapid-fire API calls to stress system
    sessions.forEach((session, index) => {
      for (let j = 0; j < 5; j++) {
        const response = http.get(`${BASE_URL}/api/sessions/${session.id}`, {
          headers: createAuthHeaders(user),
          timeout: '2s'
        });
        
        if (response.status !== 200) {
          customMetrics.apiErrors.add(1);
        }
      }
    });
    
    check({ successCount, errorCount }, {
      'some sessions created under stress': ({ successCount }) => successCount > 0,
      'error rate acceptable': ({ errorCount, successCount }) => 
        errorCount / (errorCount + successCount) < 0.2
    });
  });
}

function standardWorkflowTest(user) {
  group('Standard Workflow Test', () => {
    // Complete PRD generation workflow
    const sessionData = testData.sessions.complete;
    const session = createSession(user, sessionData);
    
    if (!session) return;
    
    // Complete each section
    const sections = ['introduction', 'goals', 'audience', 'user_stories', 'requirements', 'metrics', 'questions'];
    
    sections.forEach(section => {
      if (sessionData[section]) {
        const success = completeSection(user, session.id, section, sessionData[section]);
        if (success) {
          customMetrics.sectionsCompleted.add(1);
        }
      }
    });
    
    // Generate final PRD
    testPrdGeneration(user, session.id);
    
    // Test export functionality
    testExportGeneration(user, session.id);
  });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createSession(user, sessionData) {
  const createResponse = http.post(`${BASE_URL}/api/sessions`, sessionData, {
    headers: createAuthHeaders(user)
  });
  
  const success = check(createResponse, {
    'session created': (r) => r.status === 201
  });
  
  if (success) {
    customMetrics.sessionsCreated.add(1);
    return createResponse.json();
  } else {
    customMetrics.apiErrors.add(1);
    return null;
  }
}

function completeSection(user, sessionId, section, data) {
  const response = http.post(
    `${BASE_URL}/api/sessions/${sessionId}/sections/${section}`,
    data,
    { headers: createAuthHeaders(user) }
  );
  
  return check(response, {
    [`${section} section completed`]: (r) => r.status === 200
  });
}

function updateSessionProgress(user, sessionId) {
  const response = http.patch(
    `${BASE_URL}/api/sessions/${sessionId}`,
    { lastActivity: new Date().toISOString() },
    { headers: createAuthHeaders(user) }
  );
  
  return check(response, {
    'session progress updated': (r) => r.status === 200
  });
}

function submitResponse(user, sessionId, section) {
  const response = http.post(
    `${BASE_URL}/api/sessions/${sessionId}/responses`,
    {
      section: section,
      response: getRandomResponse()
    },
    { headers: createAuthHeaders(user) }
  );
  
  return check(response, {
    'response submitted': (r) => r.status === 200
  });
}

function getSessionStatus(user, sessionId) {
  const response = http.get(`${BASE_URL}/api/sessions/${sessionId}`, {
    headers: createAuthHeaders(user)
  });
  
  return check(response, {
    'session status retrieved': (r) => r.status === 200
  });
}

function validateSection(user, sessionId, section) {
  const response = http.post(
    `${BASE_URL}/api/sessions/${sessionId}/validate/${section}`,
    {},
    { headers: createAuthHeaders(user) }
  );
  
  return check(response, {
    'section validated': (r) => r.status === 200
  });
}

function testPrdGeneration(user, sessionId) {
  const generateStart = Date.now();
  const generateResponse = http.post(
    `${BASE_URL}/api/sessions/${sessionId}/generate`,
    {},
    { 
      headers: createAuthHeaders(user),
      timeout: '10s'
    }
  );
  
  const generateDuration = Date.now() - generateStart;
  customMetrics.apiResponseTime.add(generateDuration);
  
  const success = check(generateResponse, {
    'PRD generated': (r) => r.status === 200,
    'generation time acceptable': () => generateDuration < 8000
  });
  
  if (success) {
    customMetrics.prdsGenerated.add(1);
  }
}

function testExportGeneration(user, sessionId) {
  const formats = ['markdown', 'pdf', 'word', 'json'];
  
  formats.forEach(format => {
    const exportStart = Date.now();
    const exportResponse = http.post(
      `${BASE_URL}/api/sessions/${sessionId}/export`,
      { format: format },
      { 
        headers: createAuthHeaders(user),
        timeout: '10s'
      }
    );
    
    const exportDuration = Date.now() - exportStart;
    customMetrics.exportGenerationTime.add(exportDuration);
    
    const success = check(exportResponse, {
      [`${format} export generated`]: (r) => r.status === 200,
      [`${format} export time acceptable`]: () => exportDuration < PERFORMANCE_TARGETS.EXPORT_GENERATION_TIME
    });
    
    if (success) {
      customMetrics.exportsGenerated.add(1);
    }
  });
}

// =============================================================================
// SETUP AND TEARDOWN
// =============================================================================

export function setup() {
  console.log(`Starting performance test scenario: ${SCENARIO}`);
  console.log(`Target VUs: ${TARGET_VUS}, Duration: ${DURATION}`);
  console.log(`Base URL: ${BASE_URL}`);
  
  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }
  
  return {
    startTime: Date.now(),
    scenario: SCENARIO
  };
}

export function teardown(data) {
  const testDuration = Date.now() - data.startTime;
  console.log(`Performance test completed in ${testDuration}ms`);
  
  // Cleanup test data if needed
  // Note: In production, implement proper cleanup
}

// =============================================================================
// CUSTOM REPORTING
// =============================================================================

export function handleSummary(data) {
  const performanceReport = generatePerformanceReport(data);
  const regressionAnalysis = detectPerformanceRegression(data);
  
  return {
    'test-results/performance/k6-results.html': htmlReport(data),
    'test-results/performance/k6-results.json': JSON.stringify(data),
    'test-results/performance/performance-summary.txt': textSummary(data, { indent: ' ', enableColors: true }),
    'test-results/performance/performance-analysis.json': JSON.stringify(performanceReport),
    'test-results/performance/regression-analysis.json': JSON.stringify(regressionAnalysis),
    stdout: generateConsoleOutput(data, performanceReport, regressionAnalysis)
  };
}

function generatePerformanceReport(data) {
  const metrics = data.metrics;
  
  return {
    summary: {
      scenario: SCENARIO,
      duration: data.state.testRunDuration,
      totalRequests: metrics.http_reqs?.values?.count || 0,
      errorRate: (metrics.http_req_failed?.values?.rate || 0) * 100,
      avgResponseTime: metrics.http_req_duration?.values?.avg || 0,
      p95ResponseTime: metrics.http_req_duration?.values?.['p(95)'] || 0,
      p99ResponseTime: metrics.http_req_duration?.values?.['p(99)'] || 0
    },
    businessMetrics: {
      sessionsCreated: metrics.sessions_created?.values?.count || 0,
      sectionsCompleted: metrics.sections_completed?.values?.count || 0,
      prdsGenerated: metrics.prds_generated?.values?.count || 0,
      exportsGenerated: metrics.exports_generated?.values?.count || 0
    },
    aiMetrics: {
      avgAiResponseTime: metrics.ai_response_time?.values?.avg || 0,
      p95AiResponseTime: metrics.ai_response_time?.values?.['p(95)'] || 0,
      totalInputTokens: metrics.input_tokens?.values?.count || 0,
      totalOutputTokens: metrics.output_tokens?.values?.count || 0,
      totalTokenCost: metrics.token_cost?.values?.count || 0
    },
    slaCompliance: {
      apiResponseTime: (metrics.http_req_duration?.values?.['p(95)'] || 0) < PERFORMANCE_TARGETS.API_RESPONSE_TIME,
      aiResponseTime: (metrics.ai_response_time?.values?.['p(95)'] || 0) < PERFORMANCE_TARGETS.AI_RESPONSE_TIME,
      exportTime: (metrics.export_generation_time?.values?.['p(95)'] || 0) < PERFORMANCE_TARGETS.EXPORT_GENERATION_TIME,
      errorRate: ((metrics.http_req_failed?.values?.rate || 0) * 100) < PERFORMANCE_TARGETS.ERROR_RATE
    },
    timestamp: new Date().toISOString()
  };
}

function detectPerformanceRegression(data) {
  // In a real implementation, this would compare against historical data
  // For now, we'll provide a framework for regression detection
  
  const currentMetrics = {
    avgResponseTime: data.metrics.http_req_duration?.values?.avg || 0,
    p95ResponseTime: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
    errorRate: (data.metrics.http_req_failed?.values?.rate || 0) * 100,
    throughput: (data.metrics.http_reqs?.values?.count || 0) / (data.state.testRunDuration / 1000)
  };
  
  // Baseline metrics (these would come from previous test runs)
  const baselineMetrics = {
    avgResponseTime: 150,
    p95ResponseTime: 300,
    errorRate: 0.05,
    throughput: 100
  };
  
  const regressions = [];
  
  if (currentMetrics.avgResponseTime > baselineMetrics.avgResponseTime * 1.2) {
    regressions.push({
      metric: 'avgResponseTime',
      current: currentMetrics.avgResponseTime,
      baseline: baselineMetrics.avgResponseTime,
      regression: ((currentMetrics.avgResponseTime / baselineMetrics.avgResponseTime) - 1) * 100
    });
  }
  
  if (currentMetrics.p95ResponseTime > baselineMetrics.p95ResponseTime * 1.2) {
    regressions.push({
      metric: 'p95ResponseTime',
      current: currentMetrics.p95ResponseTime,
      baseline: baselineMetrics.p95ResponseTime,
      regression: ((currentMetrics.p95ResponseTime / baselineMetrics.p95ResponseTime) - 1) * 100
    });
  }
  
  if (currentMetrics.errorRate > baselineMetrics.errorRate * 2) {
    regressions.push({
      metric: 'errorRate',
      current: currentMetrics.errorRate,
      baseline: baselineMetrics.errorRate,
      regression: ((currentMetrics.errorRate / baselineMetrics.errorRate) - 1) * 100
    });
  }
  
  if (currentMetrics.throughput < baselineMetrics.throughput * 0.8) {
    regressions.push({
      metric: 'throughput',
      current: currentMetrics.throughput,
      baseline: baselineMetrics.throughput,
      regression: ((baselineMetrics.throughput / currentMetrics.throughput) - 1) * -100
    });
  }
  
  return {
    hasRegressions: regressions.length > 0,
    regressions: regressions,
    testTimestamp: new Date().toISOString(),
    scenario: SCENARIO
  };
}

function generateConsoleOutput(data, performanceReport, regressionAnalysis) {
  let output = `
🚀 Performance Test Results - ${SCENARIO}
==========================================

📊 Summary:
- Duration: ${Math.round(data.state.testRunDuration / 1000)}s
- Total Requests: ${performanceReport.summary.totalRequests}
- Error Rate: ${performanceReport.summary.errorRate.toFixed(2)}%
- Avg Response Time: ${Math.round(performanceReport.summary.avgResponseTime)}ms
- P95 Response Time: ${Math.round(performanceReport.summary.p95ResponseTime)}ms

🎯 Business Metrics:
- Sessions Created: ${performanceReport.businessMetrics.sessionsCreated}
- Sections Completed: ${performanceReport.businessMetrics.sectionsCompleted}
- PRDs Generated: ${performanceReport.businessMetrics.prdsGenerated}
- Exports Generated: ${performanceReport.businessMetrics.exportsGenerated}

🤖 AI Metrics:
- Avg AI Response Time: ${Math.round(performanceReport.aiMetrics.avgAiResponseTime)}ms
- Total Input Tokens: ${performanceReport.aiMetrics.totalInputTokens}
- Total Output Tokens: ${performanceReport.aiMetrics.totalOutputTokens}
- Total Token Cost: $${performanceReport.aiMetrics.totalTokenCost.toFixed(4)}

✅ SLA Compliance:
- API Response Time: ${performanceReport.slaCompliance.apiResponseTime ? '✅ PASS' : '❌ FAIL'}
- AI Response Time: ${performanceReport.slaCompliance.aiResponseTime ? '✅ PASS' : '❌ FAIL'}
- Export Time: ${performanceReport.slaCompliance.exportTime ? '✅ PASS' : '❌ FAIL'}
- Error Rate: ${performanceReport.slaCompliance.errorRate ? '✅ PASS' : '❌ FAIL'}
`;

  if (regressionAnalysis.hasRegressions) {
    output += `
⚠️  Performance Regressions Detected:
`;
    regressionAnalysis.regressions.forEach(regression => {
      output += `- ${regression.metric}: ${regression.regression.toFixed(1)}% regression (${regression.current} vs ${regression.baseline})\n`;
    });
  } else {
    output += `
✅ No Performance Regressions Detected
`;
  }

  return output;
}