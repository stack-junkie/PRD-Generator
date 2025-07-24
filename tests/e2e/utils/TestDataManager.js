/**
 * Test Data Manager
 * Provides test data fixtures and manages test data lifecycle
 */

class TestDataManager {
  constructor() {
    this.createdSessions = [];
    this.createdFiles = [];
  }

  /**
   * Get complete session data for full workflow tests
   */
  getCompleteSessionData() {
    return {
      introduction: {
        productName: 'SmartTask Pro - Advanced Project Management Platform',
        description: 'A comprehensive project management solution that combines AI-powered task automation, real-time collaboration, and intelligent resource allocation to help teams deliver projects faster and more efficiently.',
        timeline: 'We are targeting a 6-month development cycle with MVP launch in Q2 2024, followed by advanced features rollout in Q3 2024.',
        stakeholders: 'Primary stakeholders include product managers, engineering teams, sales organization, and enterprise customers in the 50-500 employee range.'
      },
      goals: {
        primary: 'Reduce project delivery time by 30% through AI-powered task automation and intelligent resource allocation while maintaining high quality standards.',
        secondary: 'Increase team collaboration efficiency by 40% with real-time updates, integrated communication tools, and centralized project visibility.',
        success: 'Success will be measured by user adoption rate (target: 80% team adoption within 3 months), project completion time reduction, customer satisfaction scores (target: NPS > 50), and revenue growth from enterprise accounts.'
      },
      audience: {
        primary: 'Mid-market companies (50-500 employees) with distributed teams, particularly in technology, consulting, and creative services industries.',
        personas: 'Project managers seeking better visibility and control, team leads managing multiple projects, individual contributors wanting clearer task prioritization, and executives needing project portfolio insights.',
        painPoints: 'Current tools lack AI automation, poor integration between planning and execution, difficulty tracking progress across multiple projects, manual resource allocation leading to bottlenecks, and insufficient real-time collaboration features.'
      },
      userStories: {
        stories: 'As a project manager, I want AI-suggested task assignments so I can optimize team workload. As a team member, I want real-time notifications about task dependencies so I can prioritize effectively. As an executive, I want dashboard views of all projects so I can identify risks early.',
        acceptance: 'Task assignment suggestions achieve >85% acceptance rate, notification response time <2 seconds, dashboard loads with complete data in <3 seconds, resource utilization reports are accurate within 5% variance.',
        workflows: 'Project creation → AI-powered task breakdown → resource allocation → team assignment → progress tracking → automated reporting → project completion analysis.'
      },
      requirements: {
        features: 'AI task automation engine, real-time collaboration workspace, intelligent resource allocation, advanced analytics dashboard, mobile app support, API integrations with popular tools (Slack, GitHub, Jira), customizable workflows, and automated reporting.',
        technical: 'React/Next.js frontend, Node.js/Express backend, PostgreSQL database, Redis for caching, WebSocket for real-time updates, OAuth 2.0 authentication, RESTful APIs, containerized deployment with Docker, AWS cloud infrastructure.',
        constraints: 'Must comply with SOC 2 Type II standards, GDPR compliance for EU customers, 99.9% uptime SLA, response time <500ms for core operations, support for 10,000+ concurrent users, data encryption at rest and in transit.'
      },
      metrics: {
        kpis: 'User adoption rate (target: 80% within 3 months), project completion time reduction (target: 30%), customer satisfaction (NPS > 50), monthly active users growth, feature usage analytics, system performance metrics.',
        measurement: 'Google Analytics for user behavior, custom telemetry for feature usage, customer surveys quarterly, support ticket analysis, performance monitoring with DataDog, A/B testing for feature optimization.',
        targets: 'Month 1: 100 beta users, Month 3: 1,000 active users, Month 6: 5,000 users, Year 1: 25,000 users with $2M ARR.'
      },
      openQuestions: {
        technical: 'What is the optimal AI model for task assignment recommendations? How should we handle data synchronization for offline mobile usage? What scalability testing approach should we use for 10,000+ concurrent users?',
        business: 'Should we offer freemium tier or enterprise-only pricing? What integration partnerships are most critical for initial launch? How do we differentiate from Asana, Monday.com, and other established players?',
        design: 'What is the ideal information density for the dashboard without overwhelming users? How can we make AI suggestions feel helpful rather than intrusive? What mobile-first features are essential vs nice-to-have?'
      }
    };
  }

  /**
   * Get partial session data for resume tests
   */
  getPartialSessionData() {
    const complete = this.getCompleteSessionData();
    return {
      introduction: complete.introduction,
      goals: complete.goals,
      audience: complete.audience,
      userStories: complete.userStories
    };
  }

  /**
   * Get large session data for performance tests
   */
  getLargeSessionData() {
    return {
      introduction: {
        productName: 'Enterprise Data Analytics Platform with Advanced Machine Learning Capabilities and Real-time Processing',
        description: `A comprehensive enterprise-grade data analytics platform that combines advanced machine learning algorithms, real-time stream processing, interactive visualization capabilities, and automated insight generation to help large organizations make data-driven decisions faster and more accurately. The platform supports multiple data sources including databases, APIs, file systems, streaming data, IoT sensors, and cloud storage solutions. It provides scalable infrastructure that can handle petabyte-scale datasets while maintaining sub-second query response times for critical business operations.

The platform includes advanced features such as automated anomaly detection, predictive modeling, natural language query processing, collaborative analytics workspaces, custom dashboard creation, automated report generation, and enterprise-grade security and compliance features. It integrates seamlessly with existing enterprise tools and provides comprehensive APIs for custom integrations.

Key differentiators include proprietary machine learning algorithms optimized for business use cases, industry-specific templates and models, advanced data lineage tracking, automated data quality monitoring, and intelligent data catalog management. The solution is designed to serve multiple personas from data scientists and analysts to business users and executives.`,
        timeline: `The development will follow a phased approach over 18 months:
        
Phase 1 (Months 1-6): Core platform development including data ingestion engine, basic analytics engine, user management, security framework, and MVP dashboard.

Phase 2 (Months 7-12): Advanced machine learning capabilities, real-time processing engine, advanced visualizations, collaboration features, and mobile applications.

Phase 3 (Months 13-18): Industry-specific modules, advanced AI features, enterprise integrations, advanced security features, and global deployment capabilities.

Each phase includes comprehensive testing, security audits, performance optimization, and user acceptance testing with selected enterprise customers.`,
        stakeholders: `Primary stakeholders include Chief Data Officers, VP of Analytics, Data Science teams, IT leadership, business analysts, and end users across multiple business units. Secondary stakeholders include compliance teams, security teams, procurement teams, and executive leadership. External stakeholders include technology partners, cloud providers, security auditors, and regulatory bodies.`
      },
      goals: {
        primary: `Transform how enterprises approach data analytics by providing a unified platform that reduces time-to-insight from weeks to minutes, enables self-service analytics for business users, and scales to support enterprise-wide data initiatives. The platform should democratize data access while maintaining enterprise-grade security, governance, and compliance standards.`,
        secondary: `Reduce operational costs of data analytics by 50% through automation and self-service capabilities, improve data quality and governance across the organization, enable real-time decision making through automated monitoring and alerting, and accelerate time-to-market for data-driven products and services.`,
        success: `Success metrics include adoption by 80% of target users within 12 months, reduction in time-to-insight by 75%, cost savings of $5M annually through operational efficiency, customer satisfaction scores above 4.5/5, and achievement of industry-leading performance benchmarks for query response times and system reliability.`
      },
      audience: {
        primary: `Large enterprises (1000+ employees) in finance, healthcare, retail, manufacturing, and technology sectors with significant data analytics needs and existing data infrastructure investments.`,
        personas: `Data Scientists need advanced ML capabilities and programming interfaces. Business Analysts require intuitive drag-and-drop interfaces and pre-built templates. Data Engineers need robust data pipeline management and monitoring tools. Executives want executive dashboards and automated insights. IT Administrators require comprehensive security, user management, and system monitoring capabilities.`,
        painPoints: `Existing solutions are fragmented across multiple tools, lack real-time capabilities, require extensive technical expertise, have poor user experience for business users, limited scalability, high total cost of ownership, inadequate security and governance features, and poor integration with existing enterprise systems.`
      }
    };
  }

  /**
   * Get minimal valid session data
   */
  getMinimalSessionData() {
    return {
      introduction: {
        productName: 'Simple Task App',
        description: 'A basic task management application for personal use.',
        timeline: '3 months development timeline with MVP in 6 weeks.'
      },
      goals: {
        primary: 'Help users organize their daily tasks effectively.',
        secondary: 'Provide simple and intuitive task management.'
      },
      audience: {
        primary: 'Individual users who need basic task organization.',
        personas: 'Busy professionals and students.'
      }
    };
  }

  /**
   * Get invalid session data for validation tests
   */
  getInvalidSessionData() {
    return {
      empty: {
        productName: '',
        description: '',
        timeline: ''
      },
      tooShort: {
        productName: 'App',
        description: 'An app.',
        timeline: 'Soon.'
      },
      tooLong: {
        productName: 'A'.repeat(500),
        description: 'Lorem ipsum '.repeat(1000),
        timeline: 'This timeline is way too long and contains excessive detail that goes beyond reasonable limits for a timeline description in a PRD document. '.repeat(50)
      },
      xssAttempts: {
        productName: '<script>alert("xss")</script>',
        description: 'javascript:alert("xss")',
        timeline: '<img src="x" onerror="alert(1)">'
      },
      specialCharacters: {
        productName: '🚀💻📱 Special Product ™® ©',
        description: 'Description with émojis and spëcial çharacters',
        timeline: 'Timeline with ñumbers and symbols: $1,000,000 @ 50% efficiency'
      }
    };
  }

  /**
   * Create a test session via API
   */
  async createTestSession(sessionData, apiHelper) {
    const session = await apiHelper.createSession(sessionData);
    this.createdSessions.push(session.id);
    return session;
  }

  /**
   * Generate random session ID
   */
  generateSessionId() {
    return 'test-session-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Generate random user responses
   */
  generateRandomResponses(count = 5) {
    const templates = [
      "This is a comprehensive response that provides detailed information about the topic with multiple sentences and thorough explanation.",
      "Our product aims to solve real-world problems by implementing innovative solutions that deliver measurable value to users.",
      "The target audience consists of professionals who need efficient tools to streamline their workflows and improve productivity.",
      "Key requirements include scalable architecture, intuitive user interface, robust security features, and seamless integrations.",
      "Success metrics will focus on user adoption, performance benchmarks, customer satisfaction, and business impact measurement."
    ];
    
    return Array.from({ length: count }, (_, i) => {
      const base = templates[i % templates.length];
      return base + ` Additional context for response ${i + 1} with unique identifier ${Math.random().toString(36).substr(2, 5)}.`;
    });
  }

  /**
   * Create test file
   */
  async createTestFile(filename, content) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const testDir = path.join(__dirname, '../temp');
    
    // Ensure directory exists
    try {
      await fs.mkdir(testDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }
    
    const filePath = path.join(testDir, filename);
    await fs.writeFile(filePath, content);
    
    this.createdFiles.push(filePath);
    return filePath;
  }

  /**
   * Clean up test data
   */
  async cleanup() {
    const fs = require('fs').promises;
    
    // Clean up created files
    for (const filePath of this.createdFiles) {
      try {
        await fs.unlink(filePath);
      } catch (e) {
        console.warn(`Failed to clean up file: ${filePath}`, e.message);
      }
    }
    
    // Reset arrays
    this.createdSessions = [];
    this.createdFiles = [];
  }

  /**
   * Get test environment configuration
   */
  getTestConfig() {
    return {
      baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
      apiURL: process.env.E2E_API_URL || 'http://localhost:3001',
      timeout: {
        short: 5000,
        medium: 15000,
        long: 30000,
        xlarge: 60000
      },
      retries: parseInt(process.env.E2E_RETRIES) || 2,
      parallel: parseInt(process.env.E2E_PARALLEL) || 1,
      headless: process.env.E2E_HEADLESS !== 'false',
      slowMo: parseInt(process.env.E2E_SLOW_MO) || 0,
      video: process.env.E2E_VIDEO === 'true',
      screenshots: process.env.E2E_SCREENSHOTS !== 'false'
    };
  }

  /**
   * Validate session data structure
   */
  validateSessionData(sessionData) {
    const requiredSections = ['introduction', 'goals', 'audience'];
    const requiredFields = {
      introduction: ['productName', 'description'],
      goals: ['primary'],
      audience: ['primary']
    };
    
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };
    
    // Check required sections
    for (const section of requiredSections) {
      if (!sessionData[section]) {
        validation.isValid = false;
        validation.errors.push(`Missing required section: ${section}`);
        continue;
      }
      
      // Check required fields in section
      for (const field of requiredFields[section]) {
        if (!sessionData[section][field] || sessionData[section][field].trim() === '') {
          validation.isValid = false;
          validation.errors.push(`Missing required field: ${section}.${field}`);
        }
      }
    }
    
    // Check for optional but recommended sections
    const recommendedSections = ['userStories', 'requirements', 'metrics'];
    for (const section of recommendedSections) {
      if (!sessionData[section]) {
        validation.warnings.push(`Missing recommended section: ${section}`);
      }
    }
    
    return validation;
  }

  /**
   * Generate performance test data
   */
  getPerformanceTestData() {
    return {
      concurrent_users: 50,
      test_duration: 300, // 5 minutes
      ramp_up_time: 60,   // 1 minute
      scenarios: [
        {
          name: 'complete_workflow',
          weight: 40,
          steps: [
            'create_session',
            'complete_introduction',
            'complete_goals',
            'complete_audience',
            'complete_user_stories',
            'complete_requirements',
            'complete_metrics',
            'complete_open_questions',
            'generate_prd',
            'export_markdown'
          ]
        },
        {
          name: 'partial_workflow',
          weight: 35,
          steps: [
            'create_session',
            'complete_introduction',
            'complete_goals',
            'complete_audience',
            'save_progress'
          ]
        },
        {
          name: 'resume_session',
          weight: 25,
          steps: [
            'resume_existing_session',
            'complete_remaining_sections',
            'generate_prd'
          ]
        }
      ]
    };
  }
}

module.exports = { TestDataManager };