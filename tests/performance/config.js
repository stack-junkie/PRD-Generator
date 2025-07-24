/**
 * K6 Performance Test Configuration
 * 
 * This file contains configuration settings for all performance tests
 * including environment-specific settings, performance targets, and
 * test data generation utilities.
 */

export const CONFIG = {
  // Environment Configuration
  environments: {
    local: {
      BASE_URL: 'http://localhost:3001',
      FRONTEND_URL: 'http://localhost:3000',
      WS_URL: 'ws://localhost:3001',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/prd_generator_test'
    },
    staging: {
      BASE_URL: 'https://api-staging.prd-generator.com',
      FRONTEND_URL: 'https://staging.prd-generator.com',
      WS_URL: 'wss://api-staging.prd-generator.com',
      DATABASE_URL: process.env.STAGING_DATABASE_URL
    },
    production: {
      BASE_URL: 'https://api.prd-generator.com',
      FRONTEND_URL: 'https://prd-generator.com',
      WS_URL: 'wss://api.prd-generator.com',
      DATABASE_URL: process.env.PRODUCTION_DATABASE_URL
    }
  },

  // Performance Targets (SLA)
  sla: {
    // Response Time Targets (milliseconds)
    apiResponseTime: {
      average: 150,
      p95: 200,
      p99: 400
    },
    aiResponseTime: {
      average: 2000,
      p95: 3000,
      p99: 5000
    },
    exportGenerationTime: {
      average: 3000,
      p95: 5000,
      p99: 8000
    },
    dbQueryTime: {
      average: 50,
      p95: 100,
      p99: 200
    },

    // Throughput Targets
    throughput: {
      minRequestsPerSecond: 100,
      maxRequestsPerSecond: 1000,
      concurrentUsers: 1000
    },

    // Error Rate Targets (percentage)
    errorRates: {
      total: 0.1,
      api: 0.05,
      ai: 0.2,
      timeout: 0.01
    },

    // Availability Target
    uptime: 99.9,

    // Resource Utilization Targets
    resources: {
      cpuUtilization: 80, // percentage
      memoryUtilization: 85, // percentage
      dbConnections: 90 // percentage of pool
    }
  },

  // Load Test Scenarios Configuration
  scenarios: {
    smoke: {
      description: 'Minimal load test to verify basic functionality',
      vus: 1,
      duration: '1m',
      thresholds: {
        http_req_duration: ['p(95)<500'],
        http_req_failed: ['rate<0.1']
      }
    },
    
    load: {
      description: 'Normal expected load',
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 10 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 }
      ],
      thresholds: {
        http_req_duration: ['p(95)<200'],
        http_req_failed: ['rate<0.1']
      }
    },
    
    stress: {
      description: 'Above normal load to test system limits',
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 150 },
        { duration: '5m', target: 150 },
        { duration: '2m', target: 0 }
      ],
      thresholds: {
        http_req_duration: ['p(95)<400'],
        http_req_failed: ['rate<0.2']
      }
    },
    
    spike: {
      description: 'Sudden load increase',
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 10 },
        { duration: '30s', target: 200 },
        { duration: '1m', target: 200 },
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 }
      ],
      thresholds: {
        http_req_duration: ['p(95)<800'],
        http_req_failed: ['rate<0.3']
      }
    },
    
    volume: {
      description: 'Large data volume processing',
      vus: 20,
      duration: '10m',
      thresholds: {
        http_req_duration: ['p(95)<1000'],
        http_req_failed: ['rate<0.1']
      }
    },
    
    endurance: {
      description: 'Extended duration test',
      vus: 30,
      duration: '30m',
      thresholds: {
        http_req_duration: ['p(95)<300'],
        http_req_failed: ['rate<0.1']
      }
    },
    
    breakpoint: {
      description: 'Find system breaking point',
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '2m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 300 }
      ]
    }
  },

  // Test Data Templates
  testData: {
    users: {
      // User account templates
      regular: {
        email: 'test.user.{id}@example.com',
        password: 'TestPassword123!',
        name: 'Test User {id}',
        role: 'user'
      },
      admin: {
        email: 'test.admin.{id}@example.com',
        password: 'AdminPassword123!',
        name: 'Test Admin {id}',
        role: 'admin'
      },
      premium: {
        email: 'test.premium.{id}@example.com',
        password: 'PremiumPassword123!',
        name: 'Test Premium {id}',
        role: 'premium'
      }
    },

    sessions: {
      minimal: {
        introduction: {
          productName: 'Test Product {id}',
          description: 'A simple test product for performance testing'
        }
      },
      
      standard: {
        introduction: {
          productName: 'Standard Product {id}',
          description: 'A comprehensive product for standard testing scenarios',
          vision: 'To provide value to users through innovative solutions',
          scope: 'Full-featured product with core functionality'
        },
        goals: {
          primary: 'Achieve product-market fit',
          secondary: ['Increase user engagement', 'Reduce churn rate'],
          success_criteria: 'User adoption >70%, Retention rate >80%'
        }
      },
      
      comprehensive: {
        introduction: {
          productName: 'Enterprise Product {id}',
          description: 'A complex enterprise-grade product for comprehensive testing',
          vision: 'To transform how enterprises handle their core business processes',
          scope: 'Complete enterprise solution with advanced features and integrations'
        },
        goals: {
          primary: 'Become the leading enterprise solution in the market',
          secondary: [
            'Achieve 50% market share within 2 years',
            'Establish partnerships with major vendors',
            'Build a scalable platform architecture'
          ],
          success_criteria: 'Revenue >$10M ARR, Customer satisfaction >4.5/5, System uptime >99.9%'
        },
        audience: {
          primary: 'Enterprise decision makers and technical teams',
          secondary: 'System integrators and consultants',
          personas: [
            'C-level executives seeking strategic advantage',
            'IT directors managing digital transformation',
            'Technical architects evaluating solutions'
          ]
        },
        user_stories: [
          'As a CEO, I want real-time business insights so I can make data-driven decisions',
          'As an IT director, I want seamless integration so I can minimize operational disruption',
          'As a technical lead, I want comprehensive APIs so I can customize the solution'
        ],
        requirements: {
          functional: [
            'Real-time data processing and analytics',
            'Multi-tenant architecture with role-based access',
            'Comprehensive REST and GraphQL APIs',
            'Advanced reporting and visualization',
            'Automated workflow management'
          ],
          non_functional: [
            'Support 10,000+ concurrent users',
            'Sub-second response times for critical operations',
            '99.9% uptime SLA with automated failover',
            'SOC 2 Type II compliance',
            'GDPR and CCPA compliance'
          ]
        },
        metrics: {
          adoption: 'Monthly active users >5000',
          performance: 'Average response time <500ms',
          satisfaction: 'Net Promoter Score >50',
          business: '40% increase in operational efficiency'
        },
        questions: [
          'What is the expected peak concurrent user load?',
          'Are there specific compliance requirements beyond SOC 2?',
          'What is the budget allocation for third-party integrations?'
        ]
      }
    },

    responses: {
      // Response templates for different quality levels
      high: [
        'This requirement addresses a critical business need by providing comprehensive functionality that enables users to achieve their primary objectives efficiently. The solution incorporates industry best practices and ensures scalability for future growth.',
        'The proposed feature set aligns with our strategic goals and user research findings. We\'ve validated this approach through prototype testing and stakeholder feedback, confirming its value proposition and feasibility.',
        'This functionality represents a key differentiator in the market, offering unique capabilities that competitors lack. The implementation leverages proven technologies while introducing innovative approaches to solve user pain points.'
      ],
      
      medium: [
        'This feature provides good value to users and supports our business objectives. The implementation is straightforward and builds on existing system capabilities.',
        'The requirement is well-defined and addresses user needs effectively. It can be delivered within reasonable time constraints using current technology stack.',
        'This functionality enhances the user experience and provides measurable benefits. The solution is technically feasible and aligns with our architecture.'
      ],
      
      low: [
        'This is a basic feature that users need.',
        'The requirement should be implemented.',
        'This functionality is important.'
      ],
      
      technical: [
        'The system shall implement OAuth 2.0 with PKCE for secure authentication, utilize JWT tokens with proper rotation mechanisms, and support role-based access control with fine-grained permissions.',
        'Database operations must ensure ACID compliance with row-level locking, implement connection pooling with configurable limits, and provide automated backup with point-in-time recovery.',
        'The API layer will expose RESTful endpoints with OpenAPI 3.0 specification, implement rate limiting per client, and provide comprehensive logging for monitoring and debugging.'
      ],
      
      business: [
        'The market opportunity represents a $2.5B addressable market with 15% annual growth. Our target customers are enterprise organizations with 1000+ employees who currently spend $50K+ annually on legacy solutions.',
        'User research indicates 78% of potential customers struggle with existing solutions, citing poor user experience and limited integration capabilities as primary pain points.',
        'The competitive landscape includes established players with 60% market share, but their solutions lack modern architecture and mobile-first design, creating opportunities for disruption.'
      ]
    }
  },

  // Monitoring and Alerting Configuration
  monitoring: {
    metrics: {
      // Custom metrics to track
      business: [
        'sessions_created',
        'sections_completed',
        'prds_generated',
        'exports_generated'
      ],
      performance: [
        'api_response_time',
        'ai_response_time',
        'export_generation_time',
        'db_query_time'
      ],
      errors: [
        'api_errors',
        'ai_errors',
        'timeout_errors',
        'validation_errors'
      ],
      resources: [
        'concurrent_sessions',
        'memory_usage_mb',
        'cpu_utilization_percent',
        'db_connections'
      ]
    },

    alerts: {
      // Alert thresholds
      critical: {
        errorRate: 5.0, // percentage
        responseTime: 1000, // milliseconds
        availability: 99.0 // percentage
      },
      warning: {
        errorRate: 1.0,
        responseTime: 500,
        availability: 99.5
      }
    }
  },

  // Reporting Configuration
  reporting: {
    formats: ['html', 'json', 'csv', 'junit'],
    destinations: {
      local: './test-results/performance/',
      s3: process.env.S3_RESULTS_BUCKET,
      slack: process.env.SLACK_WEBHOOK_URL
    },
    retention: {
      local: 30, // days
      s3: 90 // days
    }
  }
};

// Utility Functions
export function getEnvironmentConfig(env = 'local') {
  return CONFIG.environments[env] || CONFIG.environments.local;
}

export function getScenarioConfig(scenario = 'load') {
  return CONFIG.scenarios[scenario] || CONFIG.scenarios.load;
}

export function generateTestUser(id, type = 'regular') {
  const template = CONFIG.testData.users[type];
  return {
    email: template.email.replace('{id}', id),
    password: template.password,
    name: template.name.replace('{id}', id),
    role: template.role
  };
}

export function generateSessionData(id, type = 'standard') {
  const template = CONFIG.testData.sessions[type];
  return replaceTemplateVariables(template, { id });
}

export function getRandomResponse(quality = 'medium') {
  const responses = CONFIG.testData.responses[quality];
  return responses[Math.floor(Math.random() * responses.length)];
}

function replaceTemplateVariables(obj, vars) {
  const jsonString = JSON.stringify(obj);
  let result = jsonString;
  
  Object.keys(vars).forEach(key => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, vars[key]);
  });
  
  return JSON.parse(result);
}

export default CONFIG;