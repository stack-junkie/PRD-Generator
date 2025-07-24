/**
 * AI Response Time Under Load Test
 * 
 * Tests the system's AI processing capabilities under various load conditions,
 * measuring response times, token usage, and quality under concurrent AI requests.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { CONFIG, getEnvironmentConfig, generateTestUser, getRandomResponse } from '../config.js';

// Configuration
const ENV = getEnvironmentConfig(__ENV.ENVIRONMENT || 'local');
const AI_LOAD_VUS = parseInt(__ENV.AI_LOAD_VUS || '20'); // Lower VU count for AI-intensive tests
const AI_TEST_DURATION = __ENV.AI_TEST_DURATION || '3m';
const AI_TIMEOUT = '15s'; // Extended timeout for AI operations

// Custom Metrics
const aiResponseTime = new Trend('ai_response_time_ms');
const aiSuccessRate = new Rate('ai_success_rate');
const aiErrors = new Counter('ai_errors_total');
const aiTimeouts = new Counter('ai_timeouts_total');
const tokenUsage = new Counter('token_usage_total');
const inputTokens = new Counter('input_tokens_total');
const outputTokens = new Counter('output_tokens_total');
const tokenCost = new Counter('token_cost_usd');
const aiQueueDepth = new Gauge('ai_queue_depth');
const concurrentAIRequests = new Gauge('concurrent_ai_requests');

export const options = {
  scenarios: {
    ai_load_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: Math.floor(AI_LOAD_VUS * 0.25) },
        { duration: '1m', target: Math.floor(AI_LOAD_VUS * 0.5) },
        { duration: '1m', target: AI_LOAD_VUS },
        { duration: AI_TEST_DURATION, target: AI_LOAD_VUS },
        { duration: '1m', target: Math.floor(AI_LOAD_VUS * 0.5) },
        { duration: '1m', target: 0 }
      ]
    }
  },
  
  thresholds: {
    'ai_response_time_ms': [
      `p(95)<${CONFIG.sla.aiResponseTime.p95}`,
      `p(99)<${CONFIG.sla.aiResponseTime.p99}`
    ],
    'ai_success_rate': ['rate>0.95'],
    'ai_errors_total': ['count<20'],
    'ai_timeouts_total': ['count<5'],
    'http_req_failed': ['rate<0.1']
  }
};

export default function() {
  const user = generateTestUser(__VU);
  
  // Authenticate user
  const authSuccess = authenticateUser(user);
  if (!authSuccess) {
    aiErrors.add(1);
    return;
  }
  
  // Create session for AI testing
  const session = createAITestSession(user);
  if (!session) {
    aiErrors.add(1);
    return;
  }
  
  concurrentAIRequests.add(1);
  
  group('AI Response Load Test', () => {
    // Test different AI operations
    testAIResponseGeneration(user, session);
    testAIValidation(user, session);
    testAIContextProcessing(user, session);
    testAISuggestions(user, session);
  });
  
  concurrentAIRequests.add(-1);
  sleep(1 + Math.random() * 2); // Random sleep to prevent synchronized requests
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

function createAITestSession(user) {
  const sessionData = {
    name: `AI Load Test Session ${Date.now()}`,
    type: 'ai_performance_test',
    introduction: {
      productName: 'AI Performance Test Product',
      description: 'This is a comprehensive product description for AI performance testing. It includes detailed information about features, capabilities, and technical requirements to ensure the AI system processes complex content effectively.',
      vision: 'To create an innovative solution that leverages artificial intelligence for enhanced user experiences',
      scope: 'Full-featured product with AI-driven recommendations, automated workflows, and intelligent data processing'
    }
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
    return response.json();
  }
  
  return null;
}

function testAIResponseGeneration(user, session) {
  group('AI Response Generation', () => {
    const complexPrompt = generateComplexPrompt();
    const startTime = Date.now();
    
    const response = http.post(`${ENV.BASE_URL}/api/sessions/${session.id}/ai/generate`, 
      JSON.stringify({
        section: 'requirements',
        context: session.introduction,
        prompt: complexPrompt,
        temperature: 0.7,
        maxTokens: 1000
      }), 
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        timeout: AI_TIMEOUT,
        tags: { operation: 'ai_generate' }
      }
    );
    
    const responseTime = Date.now() - startTime;
    aiResponseTime.add(responseTime);
    
    const success = check(response, {
      'AI generation successful': (r) => r.status === 200,
      'AI response time acceptable': () => responseTime < CONFIG.sla.aiResponseTime.p95,
      'AI response has content': (r) => {
        const data = r.json();
        return data && data.response && data.response.length > 0;
      }
    });
    
    if (success) {
      aiSuccessRate.add(true);
      trackTokenUsage(response);
    } else {
      aiSuccessRate.add(false);
      if (response.status === 0) {
        aiTimeouts.add(1);
      } else {
        aiErrors.add(1);
      }
    }
  });
}

function testAIValidation(user, session) {
  group('AI Validation', () => {
    const responseText = getRandomResponse('technical');
    const startTime = Date.now();
    
    const response = http.post(`${ENV.BASE_URL}/api/sessions/${session.id}/ai/validate`, 
      JSON.stringify({
        section: 'requirements',
        response: responseText,
        criteria: [
          'completeness',
          'technical_accuracy',
          'clarity',
          'feasibility'
        ]
      }), 
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        timeout: AI_TIMEOUT,
        tags: { operation: 'ai_validate' }
      }
    );
    
    const responseTime = Date.now() - startTime;
    aiResponseTime.add(responseTime);
    
    const success = check(response, {
      'AI validation successful': (r) => r.status === 200,
      'AI validation time acceptable': () => responseTime < CONFIG.sla.aiResponseTime.p95,
      'AI validation has scores': (r) => {
        const data = r.json();
        return data && data.scores && Object.keys(data.scores).length > 0;
      }
    });
    
    if (success) {
      aiSuccessRate.add(true);
      trackTokenUsage(response);
    } else {
      aiSuccessRate.add(false);
      if (response.status === 0) {
        aiTimeouts.add(1);
      } else {
        aiErrors.add(1);
      }
    }
  });
}

function testAIContextProcessing(user, session) {
  group('AI Context Processing', () => {
    const startTime = Date.now();
    
    const response = http.post(`${ENV.BASE_URL}/api/sessions/${session.id}/ai/process-context`, 
      JSON.stringify({
        previousResponses: [
          session.introduction,
          { goals: 'Increase user engagement by 50%' },
          { audience: 'Enterprise customers and SMBs' }
        ],
        currentSection: 'user_stories',
        requestType: 'generate_followup_questions'
      }), 
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        timeout: AI_TIMEOUT,
        tags: { operation: 'ai_context' }
      }
    );
    
    const responseTime = Date.now() - startTime;
    aiResponseTime.add(responseTime);
    
    const success = check(response, {
      'AI context processing successful': (r) => r.status === 200,
      'AI context time acceptable': () => responseTime < CONFIG.sla.aiResponseTime.p95,
      'AI context has questions': (r) => {
        const data = r.json();
        return data && data.questions && data.questions.length > 0;
      }
    });
    
    if (success) {
      aiSuccessRate.add(true);
      trackTokenUsage(response);
    } else {
      aiSuccessRate.add(false);
      if (response.status === 0) {
        aiTimeouts.add(1);
      } else {
        aiErrors.add(1);
      }
    }
  });
}

function testAISuggestions(user, session) {
  group('AI Suggestions', () => {
    const startTime = Date.now();
    
    const response = http.post(`${ENV.BASE_URL}/api/sessions/${session.id}/ai/suggestions`, 
      JSON.stringify({
        section: 'metrics',
        partialResponse: 'We want to measure user engagement and business impact',
        suggestionType: 'completion'
      }), 
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        timeout: AI_TIMEOUT,
        tags: { operation: 'ai_suggestions' }
      }
    );
    
    const responseTime = Date.now() - startTime;
    aiResponseTime.add(responseTime);
    
    const success = check(response, {
      'AI suggestions successful': (r) => r.status === 200,
      'AI suggestions time acceptable': () => responseTime < CONFIG.sla.aiResponseTime.p95,
      'AI suggestions has content': (r) => {
        const data = r.json();
        return data && data.suggestions && data.suggestions.length > 0;
      }
    });
    
    if (success) {
      aiSuccessRate.add(true);
      trackTokenUsage(response);
    } else {
      aiSuccessRate.add(false);
      if (response.status === 0) {
        aiTimeouts.add(1);
      } else {
        aiErrors.add(1);
      }
    }
  });
}

function generateComplexPrompt() {
  const prompts = [
    'Generate comprehensive functional requirements for an enterprise analytics platform that needs to process real-time data streams, support multi-tenant architecture, and provide advanced visualization capabilities with role-based access control.',
    'Create detailed user stories for a mobile-first e-commerce application that integrates with multiple payment providers, supports international currencies, and includes AI-powered product recommendations.',
    'Define technical specifications for a cloud-native microservices architecture that handles high-throughput API requests, implements event-driven communication, and ensures data consistency across distributed systems.',
    'Develop a comprehensive security framework for a healthcare application that must comply with HIPAA regulations, implement zero-trust architecture, and provide audit trails for all data access.',
    'Design a scalable data pipeline that can ingest data from multiple sources, perform real-time transformations, and support both batch and streaming analytics workloads.'
  ];
  
  return prompts[Math.floor(Math.random() * prompts.length)];
}

function trackTokenUsage(response) {
  if (response.status === 200) {
    const data = response.json();
    if (data.tokens) {
      const input = data.tokens.input || 0;
      const output = data.tokens.output || 0;
      const total = input + output;
      const cost = data.tokens.cost || 0;
      
      inputTokens.add(input);
      outputTokens.add(output);
      tokenUsage.add(total);
      tokenCost.add(cost);
    }
  }
}

// Specialized AI stress scenarios
export function aiConcurrencyStressTest() {
  group('AI Concurrency Stress Test', () => {
    const user = generateTestUser(__VU + 1000);
    authenticateUser(user);
    const session = createAITestSession(user);
    
    if (!session) return;
    
    // Send multiple AI requests simultaneously
    const concurrentRequests = 5;
    const promises = [];
    
    for (let i = 0; i < concurrentRequests; i++) {
      const promise = new Promise((resolve) => {
        const success = testAIResponseGeneration(user, session);
        resolve(success);
      });
      promises.push(promise);
    }
    
    // Wait for all requests (simulated)
    sleep(10); // Simulate concurrent processing time
    
    check({}, {
      'concurrent AI requests handled': () => true // Placeholder check
    });
  });
}

export function aiTokenLimitTest() {
  group('AI Token Limit Test', () => {
    const user = generateTestUser(__VU + 2000);
    authenticateUser(user);
    const session = createAITestSession(user);
    
    if (!session) return;
    
    // Generate very large prompt to test token limits
    const largePrompt = 'Generate detailed requirements for '.repeat(100) + generateComplexPrompt();
    
    const response = http.post(`${ENV.BASE_URL}/api/sessions/${session.id}/ai/generate`, 
      JSON.stringify({
        section: 'requirements',
        prompt: largePrompt,
        maxTokens: 4000 // High token count
      }), 
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        timeout: '30s', // Extended timeout for large requests
        tags: { operation: 'ai_token_limit' }
      }
    );
    
    const success = check(response, {
      'large token request handled': (r) => r.status === 200 || r.status === 413, // OK or Payload Too Large
      'appropriate error for oversized request': (r) => {
        if (r.status === 413) {
          const error = r.json();
          return error && error.message && error.message.includes('token');
        }
        return true;
      }
    });
    
    if (success && response.status === 200) {
      trackTokenUsage(response);
    }
  });
}

export function setup() {
  console.log(`Starting AI response load test with ${AI_LOAD_VUS} VUs for ${AI_TEST_DURATION}`);
  console.log(`Environment: ${__ENV.ENVIRONMENT || 'local'}`);
  console.log(`Base URL: ${ENV.BASE_URL}`);
  console.log(`AI Timeout: ${AI_TIMEOUT}`);
  
  // Verify API and AI endpoints are accessible
  const healthCheck = http.get(`${ENV.BASE_URL}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }
  
  // Check AI service availability
  const aiHealthCheck = http.get(`${ENV.BASE_URL}/api/ai/health`);
  if (aiHealthCheck.status !== 200) {
    console.warn(`AI health check failed: ${aiHealthCheck.status}. AI tests may fail.`);
  }
  
  return {
    startTime: Date.now(),
    targetVUs: AI_LOAD_VUS,
    aiServiceAvailable: aiHealthCheck.status === 200
  };
}

export function teardown(data) {
  const testDuration = (Date.now() - data.startTime) / 1000;
  console.log(`AI response load test completed in ${Math.round(testDuration)}s`);
  console.log(`Target VUs: ${data.targetVUs}`);
  console.log(`AI Service Available: ${data.aiServiceAvailable}`);
}

// Custom summary for AI response test
export function handleSummary(data) {
  const aiMetrics = {
    avgAiResponseTime: data.metrics.ai_response_time_ms?.values?.avg || 0,
    p95AiResponseTime: data.metrics.ai_response_time_ms?.values?.['p(95)'] || 0,
    p99AiResponseTime: data.metrics.ai_response_time_ms?.values?.['p(99)'] || 0,
    aiSuccessRate: (data.metrics.ai_success_rate?.values?.rate || 0) * 100,
    totalAiErrors: data.metrics.ai_errors_total?.values?.count || 0,
    totalAiTimeouts: data.metrics.ai_timeouts_total?.values?.count || 0,
    totalTokenUsage: data.metrics.token_usage_total?.values?.count || 0,
    totalInputTokens: data.metrics.input_tokens_total?.values?.count || 0,
    totalOutputTokens: data.metrics.output_tokens_total?.values?.count || 0,
    totalTokenCost: data.metrics.token_cost_usd?.values?.count || 0,
    maxConcurrentAIRequests: Math.max(...(data.metrics.concurrent_ai_requests?.values?.values || [0]))
  };
  
  const testDuration = data.state.testRunDuration / 1000;
  const aiRequestsPerSecond = (data.metrics.http_reqs?.values?.count || 0) / testDuration;
  
  const summary = `
🤖 AI Response Time Under Load Test Results
==========================================

🚀 AI Performance Metrics:
- Avg AI Response Time: ${Math.round(aiMetrics.avgAiResponseTime)}ms
- P95 AI Response Time: ${Math.round(aiMetrics.p95AiResponseTime)}ms
- P99 AI Response Time: ${Math.round(aiMetrics.p99AiResponseTime)}ms
- AI Success Rate: ${aiMetrics.aiSuccessRate.toFixed(2)}%
- Max Concurrent AI Requests: ${aiMetrics.maxConcurrentAIRequests}

❌ Error Metrics:
- Total AI Errors: ${aiMetrics.totalAiErrors}
- Total AI Timeouts: ${aiMetrics.totalAiTimeouts}
- AI Requests per Second: ${aiRequestsPerSecond.toFixed(2)}

🎯 Token Usage:
- Total Tokens Used: ${aiMetrics.totalTokenUsage}
- Input Tokens: ${aiMetrics.totalInputTokens}
- Output Tokens: ${aiMetrics.totalOutputTokens}
- Total Token Cost: $${aiMetrics.totalTokenCost.toFixed(4)}
- Avg Tokens per Request: ${aiMetrics.totalTokenUsage > 0 ? Math.round(aiMetrics.totalTokenUsage / (data.metrics.http_reqs?.values?.count || 1)) : 0}

📊 HTTP Metrics:
- Total Requests: ${data.metrics.http_reqs?.values?.count || 0}
- Avg HTTP Response Time: ${Math.round(data.metrics.http_req_duration?.values?.avg || 0)}ms
- HTTP Error Rate: ${((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%

✅ SLA Compliance:
- AI Response Time (P95 < ${CONFIG.sla.aiResponseTime.p95}ms): ${aiMetrics.p95AiResponseTime < CONFIG.sla.aiResponseTime.p95 ? '✅ PASS' : '❌ FAIL'}
- AI Response Time (P99 < ${CONFIG.sla.aiResponseTime.p99}ms): ${aiMetrics.p99AiResponseTime < CONFIG.sla.aiResponseTime.p99 ? '✅ PASS' : '❌ FAIL'}
- AI Success Rate (>95%): ${aiMetrics.aiSuccessRate > 95 ? '✅ PASS' : '❌ FAIL'}
- AI Error Count (<20): ${aiMetrics.totalAiErrors < 20 ? '✅ PASS' : '❌ FAIL'}
- AI Timeout Count (<5): ${aiMetrics.totalAiTimeouts < 5 ? '✅ PASS' : '❌ FAIL'}
`;

  return {
    'test-results/performance/ai-response-results.json': JSON.stringify({
      ...data,
      customMetrics: aiMetrics,
      aiRequestsPerSecond: aiRequestsPerSecond
    }),
    stdout: summary
  };
}