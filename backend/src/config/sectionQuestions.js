/**
 * PRD Section Questions Configuration
 * 
 * Defines all questions for each PRD section with metadata for intelligent conversation flow.
 * Supports conditional logic, follow-up questions, and adaptive questioning based on user responses.
 */

const SECTION_QUESTIONS_VERSION = '1.0.0';

// Question types
const QUESTION_TYPES = {
  REQUIRED: 'required',
  OPTIONAL: 'optional', 
  CONDITIONAL: 'conditional'
};

// User experience levels
const USER_LEVELS = {
  TECHNICAL: 'technical',
  NON_TECHNICAL: 'non-technical',
  MIXED: 'mixed'
};

// Industry contexts
const INDUSTRY_CONTEXTS = {
  ENTERPRISE: 'enterprise',
  CONSUMER: 'consumer',
  SAAS: 'saas',
  MOBILE: 'mobile',
  ECOMMERCE: 'ecommerce',
  FINTECH: 'fintech',
  HEALTHCARE: 'healthcare',
  EDUCATION: 'education'
};

/**
 * Section 1: Introduction/Overview Questions
 */
const introductionQuestions = {
  primary: [
    {
      id: 'intro_product_name',
      text: "What's the name of the product or feature you're building?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "This will be the main identifier throughout your PRD. Be specific and descriptive.",
      examples: [
        "Customer Dashboard 2.0",
        "Mobile Payment Gateway",
        "AI-Powered Recommendation Engine"
      ],
      validationRules: {
        minLength: 3,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\s\-_.]+$/
      },
      followUpTriggers: {
        containsVersion: {
          pattern: /v?\d+\.\d+|2\.0|version/i,
          followUp: 'intro_previous_version'
        },
        containsPlatform: {
          pattern: /mobile|web|desktop|api/i,
          followUp: 'intro_platform_details'
        }
      }
    },
    {
      id: 'intro_problem_statement',
      text: "What problem does this product solve? What pain point are you addressing?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Focus on the core user problem, not the solution. This drives everything else in your PRD.",
      examples: [
        "Users struggle to track their expenses across multiple accounts",
        "Customer support teams can't efficiently prioritize and resolve tickets",
        "Small businesses lack affordable tools for inventory management"
      ],
      validationRules: {
        minLength: 20,
        maxLength: 500,
        mustContain: ['problem', 'issue', 'challenge', 'difficulty', 'struggle', 'pain', 'need']
      },
      followUpTriggers: {
        vagueProblem: {
          pattern: /users want|people need|improve|better/i,
          followUp: 'intro_problem_specifics'
        },
        multipleProbems: {
          pattern: /and|also|additionally|furthermore/i,
          followUp: 'intro_primary_problem'
        }
      }
    },
    {
      id: 'intro_solution_overview',
      text: "At a high level, how does your product solve this problem?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Describe the core solution approach, not detailed features. Think elevator pitch.",
      examples: [
        "A unified dashboard that aggregates data from all user accounts in real-time",
        "An AI-powered ticketing system that automatically categorizes and routes support requests",
        "A simple mobile app with barcode scanning and automated reorder alerts"
      ],
      validationRules: {
        minLength: 30,
        maxLength: 300,
        shouldReference: ['problem from intro_problem_statement']
      },
      followUpTriggers: {
        tooDetailed: {
          pattern: /button|screen|field|database|api|endpoint/i,
          followUp: 'intro_solution_high_level'
        },
        missingValue: {
          pattern: /^(?!.*\b(how|by|through|via|using)\b).+$/i,
          followUp: 'intro_solution_mechanism'
        }
      }
    }
  ],
  conditional: [
    {
      id: 'intro_previous_version',
      text: "What issues or limitations exist with the current version that you're addressing?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'containsVersion',
        fromQuestion: 'intro_product_name'
      },
      helpText: "This helps establish the improvement context and sets expectations.",
      examples: [
        "The current dashboard is slow and doesn't support real-time updates",
        "Version 1.0 only works on desktop and users need mobile access",
        "The existing system requires manual data entry which is error-prone"
      ],
      validationRules: {
        minLength: 20,
        maxLength: 200
      }
    },
    {
      id: 'intro_platform_details',
      text: "Which platforms or environments will this work on?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'containsPlatform',
        fromQuestion: 'intro_product_name'
      },
      helpText: "Platform requirements affect technical decisions and user experience design.",
      examples: [
        "iOS and Android mobile apps with web admin portal",
        "Web application supporting Chrome, Firefox, and Safari",
        "REST API for third-party integrations"
      ],
      validationRules: {
        minLength: 10,
        maxLength: 150
      }
    },
    {
      id: 'intro_problem_specifics',
      text: "Can you be more specific about this problem? What exactly happens that causes frustration?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'vagueProblem',
        fromQuestion: 'intro_problem_statement'
      },
      helpText: "Specific problems lead to specific solutions. Vague problems create vague products.",
      examples: [
        "Users waste 30 minutes daily switching between 5 different banking apps to check balances",
        "Support agents spend 10 minutes per ticket just figuring out which team should handle it",
        "Store owners discover they're out of stock only when customers complain"
      ],
      validationRules: {
        minLength: 30,
        maxLength: 300,
        shouldContain: ['specific', 'exactly', 'when', 'how', 'why']
      }
    }
  ],
  optional: [
    {
      id: 'intro_inspiration',
      text: "Are there any existing products or solutions that inspired this idea?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "Understanding inspiration helps identify differentiators and competitive positioning.",
      examples: [
        "Mint for personal finance but focused on business expenses",
        "Slack's user experience but for project management",
        "Amazon's recommendation engine but for B2B software"
      ],
      validationRules: {
        maxLength: 200
      }
    },
    {
      id: 'intro_company_context',
      text: "How does this fit into your company's broader product strategy?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "Strategic context helps with prioritization and resource allocation decisions.",
      examples: [
        "Part of our digital transformation initiative to reduce manual processes",
        "Supports our expansion into the SMB market segment",
        "Addresses the #1 customer complaint from our annual survey"
      ],
      validationRules: {
        maxLength: 250
      }
    }
  ]
};

/**
 * Section 2: Goals/Objectives Questions
 */
const goalsQuestions = {
  primary: [
    {
      id: 'goals_business_objectives',
      text: "What are the main business goals you want to achieve with this product?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Think revenue, cost savings, market expansion, customer satisfaction, etc.",
      examples: [
        "Increase customer retention by 15% within 6 months",
        "Reduce support ticket volume by 30% through self-service",
        "Generate $2M ARR from new enterprise customers"
      ],
      validationRules: {
        minLength: 20,
        maxLength: 400,
        shouldContain: ['increase', 'reduce', 'improve', 'generate', 'achieve', 'grow']
      },
      followUpTriggers: {
        hasMetrics: {
          pattern: /\d+%|\$\d+|by \d+/i,
          followUp: 'goals_metric_rationale'
        },
        vagueBusiness: {
          pattern: /better|more|good|successful/i,
          followUp: 'goals_specific_business'
        }
      }
    },
    {
      id: 'goals_user_outcomes',
      text: "What outcomes do you want users to experience? How should their lives/work improve?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Focus on user value, not product features. What changes for them?",
      examples: [
        "Spend 50% less time on expense reporting and get reimbursed faster",
        "Make confident purchasing decisions with personalized recommendations",
        "Collaborate with remote teammates as if they were in the same room"
      ],
      validationRules: {
        minLength: 25,
        maxLength: 300,
        shouldContain: ['user', 'customer', 'people', 'they', 'their']
      },
      followUpTriggers: {
        featureFocused: {
          pattern: /dashboard|button|feature|function|tool/i,
          followUp: 'goals_user_benefits'
        },
        timeImprovement: {
          pattern: /faster|quicker|save time|less time/i,
          followUp: 'goals_time_quantify'
        }
      }
    },
    {
      id: 'goals_success_definition',
      text: "How will you know this product is successful? What does 'winning' look like?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Define clear success criteria that you can measure and celebrate.",
      examples: [
        "90% of users complete onboarding within their first session",
        "Customer satisfaction scores increase from 3.2 to 4.5 stars",
        "We become the #2 player in our market segment within 18 months"
      ],
      validationRules: {
        minLength: 20,
        maxLength: 250,
        shouldContain: ['success', 'win', 'achieve', 'reach', 'measure']
      },
      followUpTriggers: {
        subjective: {
          pattern: /happy|satisfied|pleased|love|like/i,
          followUp: 'goals_objective_measures'
        }
      }
    }
  ],
  conditional: [
    {
      id: 'goals_metric_rationale',
      text: "How did you arrive at those specific numbers? What makes them realistic yet ambitious?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'hasMetrics',
        fromQuestion: 'goals_business_objectives'
      },
      helpText: "Understanding the reasoning behind metrics helps validate feasibility.",
      validationRules: {
        minLength: 30,
        maxLength: 200
      }
    },
    {
      id: 'goals_time_quantify',
      text: "Can you quantify the time savings? How much time do users currently spend on this?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'timeImprovement',
        fromQuestion: 'goals_user_outcomes'
      },
      helpText: "Specific time savings create compelling value propositions.",
      validationRules: {
        minLength: 20,
        maxLength: 150
      }
    }
  ],
  optional: [
    {
      id: 'goals_timeline',
      text: "What's your target timeline for achieving these goals?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "Timeline context helps with planning and expectation setting.",
      examples: [
        "Pilot launch in Q2, full rollout by end of year",
        "MVP in 3 months, iterate based on feedback for 6 months",
        "18-month roadmap with quarterly milestone reviews"
      ],
      validationRules: {
        maxLength: 200
      }
    },
    {
      id: 'goals_constraints',
      text: "Are there any constraints or limitations that might affect these goals?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "Understanding constraints helps set realistic expectations.",
      examples: [
        "Limited to current engineering team size",
        "Must integrate with existing legacy systems",
        "Compliance requirements in regulated industry"
      ],
      validationRules: {
        maxLength: 300
      }
    }
  ]
};

/**
 * Section 3: Target Audience Questions
 */
const audienceQuestions = {
  primary: [
    {
      id: 'audience_primary_users',
      text: "Who are the primary users of this product? Describe them in detail.",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Be specific about demographics, job roles, experience levels, and context of use.",
      examples: [
        "Small business owners (5-50 employees) who manage their own finances and aren't accounting experts",
        "Software engineering managers at mid-size companies who need to track team productivity",
        "College students aged 18-25 who want to build healthy financial habits"
      ],
      validationRules: {
        minLength: 30,
        maxLength: 400,
        shouldContain: ['users', 'people', 'customers', 'who', 'they']
      },
      followUpTriggers: {
        multipleSegments: {
          pattern: /and|also|both|different|types/i,
          followUp: 'audience_primary_segment'
        },
        vagueDescription: {
          pattern: /^(?!.*\b(who|what|where|when|how|why)\b).{1,50}$/i,
          followUp: 'audience_user_details'
        }
      }
    },
    {
      id: 'audience_user_problems',
      text: "What specific problems or frustrations do these users currently face?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Connect user problems to the product opportunity. What makes them struggle?",
      examples: [
        "They spend hours each week manually categorizing expenses and often make errors",
        "They can't get visibility into what their team members are working on without constant status meetings",
        "They want to save money but don't understand where their money actually goes"
      ],
      validationRules: {
        minLength: 25,
        maxLength: 350,
        shouldContain: ['problem', 'frustration', 'difficult', 'challenge', 'struggle']
      },
      followUpTriggers: {
        workflowIssues: {
          pattern: /process|workflow|steps|manual|time|slow/i,
          followUp: 'audience_current_workflow'
        }
      }
    },
    {
      id: 'audience_current_solutions',
      text: "How do these users currently solve these problems? What tools or methods do they use?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Understanding current solutions helps identify improvement opportunities.",
      examples: [
        "Excel spreadsheets and manual receipt filing, which is error-prone and time-consuming",
        "Weekly team meetings and Slack check-ins, but information gets lost or outdated",
        "Banking apps and mental budgeting, but no systematic tracking or analysis"
      ],
      validationRules: {
        minLength: 20,
        maxLength: 300,
        shouldContain: ['currently', 'now', 'use', 'tools', 'methods', 'solve']
      },
      followUpTriggers: {
        competitorMentioned: {
          pattern: /[A-Z][a-z]+ (app|software|tool|platform)/i,
          followUp: 'audience_competitor_gaps'
        }
      }
    }
  ],
  conditional: [
    {
      id: 'audience_primary_segment',
      text: "If you have multiple user types, which one should we focus on first? Why?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'multipleSegments',
        fromQuestion: 'audience_primary_users'
      },
      helpText: "Focus creates better products. You can expand to other segments later.",
      validationRules: {
        minLength: 20,
        maxLength: 200
      }
    },
    {
      id: 'audience_current_workflow',
      text: "Can you walk me through their current workflow step by step?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'workflowIssues',
        fromQuestion: 'audience_user_problems'
      },
      helpText: "Understanding current workflows helps design better replacement processes.",
      validationRules: {
        minLength: 40,
        maxLength: 400,
        shouldContain: ['first', 'then', 'next', 'step', 'process']
      }
    },
    {
      id: 'audience_competitor_gaps',
      text: "What's missing or frustrating about the existing tools they use?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'competitorMentioned',
        fromQuestion: 'audience_current_solutions'
      },
      helpText: "Competitor gaps become your competitive advantages.",
      validationRules: {
        minLength: 20,
        maxLength: 250
      }
    }
  ],
  optional: [
    {
      id: 'audience_secondary_users',
      text: "Are there secondary users or stakeholders who influence the buying/usage decision?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "B2B products often have multiple stakeholders with different needs.",
      examples: [
        "IT administrators who need to approve and manage security settings",
        "Finance teams who control budget and need usage reporting",
        "End users' managers who need visibility into team productivity"
      ],
      validationRules: {
        maxLength: 300
      }
    },
    {
      id: 'audience_user_research',
      text: "Have you done any user research or have access to user feedback on this problem?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "Existing research provides valuable validation and insights.",
      examples: [
        "Customer support tickets show 40% of complaints are about this issue",
        "User interviews with 20 customers revealed consistent pain points",
        "Survey data from 500 users identified this as the #2 requested feature"
      ],
      validationRules: {
        maxLength: 250
      }
    }
  ]
};

/**
 * Section 4: User Stories Questions
 */
const userStoriesQuestions = {
  primary: [
    {
      id: 'stories_core_user_journey',
      text: "Walk me through the main user journey. What does a user do from start to finish?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Describe the complete flow from first interaction to achieving their goal.",
      examples: [
        "User opens app → connects bank account → categorizes expenses → views spending insights → sets budget alerts",
        "Manager opens dashboard → sees team status → drills into individual tasks → provides feedback → updates priorities",
        "Student creates account → sets financial goals → tracks spending → receives personalized tips → adjusts behavior"
      ],
      validationRules: {
        minLength: 50,
        maxLength: 500,
        shouldContain: ['user', 'then', 'next', 'finally', '→', '->', 'after']
      },
      followUpTriggers: {
        complexJourney: {
          pattern: /(→|->|then|next|after)/g,
          condition: 'count > 5',
          followUp: 'stories_simplify_journey'
        },
        vagueMethods: {
          pattern: /clicks|selects|views|sees/i,
          followUp: 'stories_interaction_details'
        }
      }
    },
    {
      id: 'stories_key_scenarios',
      text: "What are the 3-5 most important scenarios or use cases users will encounter?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Think about different contexts, user types, or problem variations.",
      examples: [
        "1) New user setup 2) Daily expense logging 3) Monthly budget review 4) Tax preparation export 5) Shared expense splitting",
        "1) Sprint planning 2) Daily standups 3) Code review tracking 4) Performance reviews 5) Resource allocation",
        "1) First-time budgeting 2) Emergency expense handling 3) Savings goal tracking 4) Income changes 5) Shared expenses"
      ],
      validationRules: {
        minLength: 40,
        maxLength: 400,
        shouldContain: ['scenario', 'use case', '1)', '2)', '3)', 'first', 'when']
      },
      followUpTriggers: {
        lacksPriority: {
          pattern: /^(?!.*\b(most|key|important|critical|primary)\b).+$/i,
          followUp: 'stories_scenario_priority'
        }
      }
    },
    {
      id: 'stories_edge_cases',
      text: "What happens when things go wrong? What edge cases should we consider?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Error handling, unusual inputs, system failures, and recovery scenarios.",
      examples: [
        "Bank connection fails, user enters invalid data, internet connectivity issues, account gets locked",
        "Team member leaves company, project gets cancelled, priorities change mid-sprint, external system outage",
        "Income drops suddenly, expenses exceed budget, app crashes during transaction, account compromise"
      ],
      validationRules: {
        minLength: 30,
        maxLength: 300,
        shouldContain: ['when', 'if', 'fails', 'error', 'wrong', 'issues']
      },
      followUpTriggers: {
        dataIssues: {
          pattern: /data|information|input|connection|sync/i,
          followUp: 'stories_data_handling'
        }
      }
    }
  ],
  conditional: [
    {
      id: 'stories_simplify_journey',
      text: "That journey seems complex. What are the absolute must-have steps vs. nice-to-have?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'complexJourney',
        fromQuestion: 'stories_core_user_journey'
      },
      helpText: "Simplifying the core journey improves user success and reduces development complexity.",
      validationRules: {
        minLength: 30,
        maxLength: 250,
        shouldContain: ['must', 'required', 'essential', 'critical', 'minimum']
      }
    },
    {
      id: 'stories_interaction_details',
      text: "What specific actions do users take at each step? How do they interact with the product?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'vagueMethods',
        fromQuestion: 'stories_core_user_journey'
      },
      helpText: "Specific interactions help design better UI/UX and identify technical requirements.",
      validationRules: {
        minLength: 40,
        maxLength: 300
      }
    },
    {
      id: 'stories_data_handling',
      text: "How should the system handle data inconsistencies, missing information, or sync failures?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'dataIssues',
        fromQuestion: 'stories_edge_cases'
      },
      helpText: "Data reliability is critical for user trust and product success.",
      validationRules: {
        minLength: 25,
        maxLength: 200
      }
    }
  ],
  optional: [
    {
      id: 'stories_user_personas',
      text: "Do you have specific user personas or can you describe different user archetypes?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "Personas help create more targeted user stories and design decisions.",
      examples: [
        "Busy Manager Beth: Wants quick insights, mobile-first, values efficiency over features",
        "Detail-Oriented Dan: Needs comprehensive data, loves customization, willing to invest time learning",
        "Casual User Chris: Occasional usage, needs simple interface, gets overwhelmed by too many options"
      ],
      validationRules: {
        maxLength: 400
      }
    },
    {
      id: 'stories_integration_scenarios',
      text: "How does this product fit into users' existing workflows or tools?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "Integration context affects adoption and user success.",
      examples: [
        "Must sync with existing accounting software for tax reporting",
        "Should integrate with Slack for team notifications and updates",
        "Needs to connect with existing banking and credit card accounts"
      ],
      validationRules: {
        maxLength: 250
      }
    }
  ]
};

/**
 * Section 5: Functional Requirements Questions
 */
const functionalRequirementsQuestions = {
  primary: [
    {
      id: 'functional_core_features',
      text: "What are the core features that absolutely must be included in the first version?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Focus on MVP features that deliver the core value proposition. What can't you live without?",
      examples: [
        "Account connection, expense categorization, spending visualization, budget alerts",
        "Team dashboard, task assignment, progress tracking, deadline notifications",
        "User registration, goal setting, expense logging, basic reporting"
      ],
      validationRules: {
        minLength: 30,
        maxLength: 400,
        shouldContain: ['feature', 'function', 'capability', 'must', 'core', 'essential']
      },
      followUpTriggers: {
        tooManyFeatures: {
          pattern: /,/g,
          condition: 'count > 6',
          followUp: 'functional_feature_priority'
        },
        vagueFunctionality: {
          pattern: /dashboard|system|platform|tool/i,
          followUp: 'functional_specific_capabilities'
        }
      }
    },
    {
      id: 'functional_data_requirements',
      text: "What data does the system need to collect, store, and process?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Think about user input, external data sources, calculated fields, and data relationships.",
      examples: [
        "User profile, bank transactions, expense categories, budgets, spending patterns, account balances",
        "User accounts, projects, tasks, time logs, team assignments, progress metrics, deadlines",
        "Student profiles, financial goals, income sources, expense categories, savings targets, spending habits"
      ],
      validationRules: {
        minLength: 25,
        maxLength: 350,
        shouldContain: ['data', 'information', 'store', 'collect', 'process']
      },
      followUpTriggers: {
        externalData: {
          pattern: /api|integration|import|sync|connect/i,
          followUp: 'functional_data_sources'
        },
        personalData: {
          pattern: /personal|private|sensitive|financial|health/i,
          followUp: 'functional_privacy_requirements'
        }
      }
    },
    {
      id: 'functional_user_actions',
      text: "What specific actions can users perform? List the main operations and interactions.",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Think CRUD operations (Create, Read, Update, Delete) plus any complex workflows.",
      examples: [
        "Create/edit budgets, categorize transactions, generate reports, set alerts, export data, share with accountant",
        "Create/assign tasks, update status, leave comments, set priorities, generate reports, track time",
        "Add expenses, set goals, view analytics, receive recommendations, connect accounts, share with family"
      ],
      validationRules: {
        minLength: 40,
        maxLength: 400,
        shouldContain: ['create', 'edit', 'delete', 'view', 'update', 'add', 'remove']
      },
      followUpTriggers: {
        collaborativeFeatures: {
          pattern: /share|collaborate|team|group|invite|permission/i,
          followUp: 'functional_collaboration_details'
        }
      }
    }
  ],
  conditional: [
    {
      id: 'functional_feature_priority',
      text: "That's quite a few features. Which 3-4 are absolutely critical for launch?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'tooManyFeatures',
        fromQuestion: 'functional_core_features'
      },
      helpText: "MVP success depends on doing fewer things really well rather than many things poorly.",
      validationRules: {
        minLength: 20,
        maxLength: 200,
        shouldContain: ['critical', 'essential', 'must', 'priority', 'first']
      }
    },
    {
      id: 'functional_data_sources',
      text: "What external systems or APIs will you need to integrate with?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'externalData',
        fromQuestion: 'functional_data_requirements'
      },
      helpText: "External integrations affect technical complexity and reliability requirements.",
      validationRules: {
        minLength: 15,
        maxLength: 250
      }
    },
    {
      id: 'functional_privacy_requirements',
      text: "What privacy and security measures are needed for this sensitive data?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'personalData',
        fromQuestion: 'functional_data_requirements'
      },
      helpText: "Sensitive data requires additional security, compliance, and privacy considerations.",
      validationRules: {
        minLength: 20,
        maxLength: 300,
        shouldContain: ['security', 'privacy', 'encryption', 'compliance', 'protection']
      }
    },
    {
      id: 'functional_collaboration_details',
      text: "How should sharing and collaboration work? What permissions and roles are needed?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'collaborativeFeatures',
        fromQuestion: 'functional_user_actions'
      },
      helpText: "Collaboration features significantly impact data model and security requirements.",
      validationRules: {
        minLength: 25,
        maxLength: 250
      }
    }
  ],
  optional: [
    {
      id: 'functional_performance_requirements',
      text: "Are there specific performance requirements? Response times, data volumes, concurrent users?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "Performance requirements affect architecture and technology choices.",
      examples: [
        "Must handle 10,000 transactions per user, respond within 2 seconds, support 1000 concurrent users",
        "Real-time updates for team collaboration, offline functionality for mobile app",
        "Fast search across large expense history, quick budget calculations"
      ],
      validationRules: {
        maxLength: 200
      }
    },
    {
      id: 'functional_platform_features',
      text: "Are there platform-specific features needed? Mobile vs web vs desktop capabilities?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "Different platforms have different capabilities and user expectations.",
      examples: [
        "Mobile: Camera for receipt scanning, push notifications, offline mode",
        "Web: Advanced reporting, bulk operations, admin functionality",
        "Desktop: File system integration, keyboard shortcuts, multi-window support"
      ],
      validationRules: {
        maxLength: 300
      }
    }
  ]
};

/**
 * Section 6: Success Metrics Questions
 */
const successMetricsQuestions = {
  primary: [
    {
      id: 'metrics_kpis',
      text: "What are the key performance indicators (KPIs) that will show this product is successful?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Choose 3-5 metrics that directly tie to your business goals. Make them specific and measurable.",
      examples: [
        "Monthly active users >10k, average session time >5 minutes, user retention rate >70% after 30 days",
        "Task completion rate >85%, time to resolution reduced by 40%, team productivity score >4.2/5",
        "Users who complete budgeting >60%, expense tracking consistency >80%, savings goal achievement >45%"
      ],
      validationRules: {
        minLength: 30,
        maxLength: 300,
        shouldContain: ['metric', 'measure', 'kpi', '%', 'rate', 'score', 'number']
      },
      followUpTriggers: {
        hasNumbers: {
          pattern: /\d+%|\d+k|\d+\.\d+|\$\d+/i,
          followUp: 'metrics_target_rationale'
        },
        vagueMetrics: {
          pattern: /better|good|successful|improved|more/i,
          followUp: 'metrics_specific_measures'
        }
      }
    },
    {
      id: 'metrics_user_behavior',
      text: "What user behaviors indicate success? How do you know users are getting value?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Look for leading indicators that predict long-term success and value realization.",
      examples: [
        "Users connect multiple accounts within first week, categorize >80% of transactions, set up budget alerts",
        "Teams update task status daily, use comments feature, complete >90% of assigned tasks on time",
        "Students log expenses for 30+ consecutive days, achieve monthly budget goals, use saving recommendations"
      ],
      validationRules: {
        minLength: 25,
        maxLength: 250,
        shouldContain: ['behavior', 'users', 'action', 'engagement', 'adoption']
      },
      followUpTriggers: {
        habitFormation: {
          pattern: /daily|weekly|regularly|consistently|habit/i,
          followUp: 'metrics_engagement_frequency'
        }
      }
    },
    {
      id: 'metrics_business_impact',
      text: "How will you measure the business impact? Revenue, cost savings, efficiency gains?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Connect product success to business outcomes that stakeholders care about.",
      examples: [
        "Customer acquisition cost reduced by 25%, support ticket volume down 40%, customer lifetime value up 30%",
        "Team productivity increased 20%, project delivery time reduced 15%, employee satisfaction score +0.8",
        "User acquisition cost <$15, premium conversion rate >12%, monthly churn rate <5%"
      ],
      validationRules: {
        minLength: 20,
        maxLength: 250,
        shouldContain: ['business', 'revenue', 'cost', 'efficiency', 'roi', 'impact']
      },
      followUpTriggers: {
        costSavings: {
          pattern: /save|reduce|decrease|lower|cut/i,
          followUp: 'metrics_cost_calculation'
        }
      }
    }
  ],
  conditional: [
    {
      id: 'metrics_target_rationale',
      text: "How did you determine these specific targets? What makes them realistic yet ambitious?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'hasNumbers',
        fromQuestion: 'metrics_kpis'
      },
      helpText: "Understanding target rationale helps validate feasibility and ambition level.",
      validationRules: {
        minLength: 30,
        maxLength: 200
      }
    },
    {
      id: 'metrics_engagement_frequency',
      text: "What's the ideal usage frequency? How often should users engage to form successful habits?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'habitFormation',
        fromQuestion: 'metrics_user_behavior'
      },
      helpText: "Habit formation patterns affect product design and success metrics.",
      validationRules: {
        minLength: 15,
        maxLength: 150
      }
    },
    {
      id: 'metrics_cost_calculation',
      text: "How will you calculate and attribute these cost savings? What's the baseline?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'costSavings',
        fromQuestion: 'metrics_business_impact'
      },
      helpText: "Cost savings need clear measurement methodology and baseline data.",
      validationRules: {
        minLength: 20,
        maxLength: 200
      }
    }
  ],
  optional: [
    {
      id: 'metrics_timeline',
      text: "What's the timeline for achieving these metrics? Any interim milestones?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "Timeline context helps set realistic expectations and interim goals.",
      examples: [
        "30-day: 1k users, 60-day: 5k users, 90-day: 10k users with 70% retention",
        "Month 1: Team adoption >80%, Month 3: Productivity gains >15%, Month 6: Full ROI",
        "Quarter 1: MVP metrics, Quarter 2: Growth metrics, Quarter 3: Retention/expansion"
      ],
      validationRules: {
        maxLength: 200
      }
    },
    {
      id: 'metrics_measurement_method',
      text: "How will you actually collect and measure these metrics? What tools or methods?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "Measurement methodology affects data accuracy and decision-making capability.",
      examples: [
        "Google Analytics for user behavior, internal database for business metrics, monthly user surveys",
        "Built-in product analytics, team productivity surveys, integration with project management tools",
        "App analytics SDK, financial data APIs, user interviews and feedback forms"
      ],
      validationRules: {
        maxLength: 250
      }
    }
  ]
};

/**
 * Section 7: Open Questions Questions
 */
const openQuestionsQuestions = {
  primary: [
    {
      id: 'questions_unknowns',
      text: "What are the biggest unknowns or uncertainties about this product?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Identify assumptions that need validation, technical risks, or market uncertainties.",
      examples: [
        "Will users trust us with their financial data? Can we reliably connect to all major banks? What's our go-to-market strategy?",
        "How complex is the team workflow integration? Will managers actually use the dashboard? What's the learning curve?",
        "Do students have enough income to justify the app? How do we differentiate from existing budgeting apps?"
      ],
      validationRules: {
        minLength: 30,
        maxLength: 400,
        shouldContain: ['unknown', 'uncertain', 'question', 'risk', 'assumption', 'unclear']
      },
      followUpTriggers: {
        technicalRisks: {
          pattern: /technical|integration|api|system|performance|scale/i,
          followUp: 'questions_technical_risks'
        },
        marketRisks: {
          pattern: /market|competitor|adoption|user|customer|demand/i,
          followUp: 'questions_market_validation'
        }
      }
    },
    {
      id: 'questions_research_needed',
      text: "What research or validation do you need to do before building?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Identify critical research that could change your approach or validate key assumptions.",
      examples: [
        "User interviews about current expense tracking habits, competitive analysis of existing solutions, technical feasibility study",
        "Survey team managers about current pain points, prototype testing with 5-10 teams, integration complexity assessment",
        "Student spending behavior research, university partnership opportunities, freemium vs subscription model testing"
      ],
      validationRules: {
        minLength: 25,
        maxLength: 300,
        shouldContain: ['research', 'validation', 'testing', 'analysis', 'study', 'interview']
      },
      followUpTriggers: {
        userResearch: {
          pattern: /user|customer|interview|survey|feedback/i,
          followUp: 'questions_user_research_plan'
        }
      }
    },
    {
      id: 'questions_decisions_needed',
      text: "What key decisions do you need to make that could significantly impact the product?",
      type: QUESTION_TYPES.REQUIRED,
      helpText: "Identify architectural, business model, or strategic decisions that affect everything else.",
      examples: [
        "Native mobile app vs web app, freemium vs subscription pricing, build vs buy for bank integrations",
        "Self-hosted vs cloud deployment, Slack integration vs standalone app, real-time vs batch processing",
        "University partnerships vs direct-to-consumer, social features vs privacy-focused, gamification vs simplicity"
      ],
      validationRules: {
        minLength: 20,
        maxLength: 300,
        shouldContain: ['decision', 'choice', 'vs', 'or', 'option', 'approach']
      },
      followUpTriggers: {
        architecturalChoices: {
          pattern: /technical|architecture|platform|technology|framework/i,
          followUp: 'questions_technical_decisions'
        }
      }
    }
  ],
  conditional: [
    {
      id: 'questions_technical_risks',
      text: "What are the specific technical risks or challenges you're most concerned about?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'technicalRisks',
        fromQuestion: 'questions_unknowns'
      },
      helpText: "Technical risks can derail projects. Better to identify and plan for them early.",
      validationRules: {
        minLength: 25,
        maxLength: 250
      }
    },
    {
      id: 'questions_market_validation',
      text: "How will you validate market demand and user willingness to adopt this solution?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'marketRisks',
        fromQuestion: 'questions_unknowns'
      },
      helpText: "Market validation reduces the risk of building something nobody wants.",
      validationRules: {
        minLength: 20,
        maxLength: 200
      }
    },
    {
      id: 'questions_user_research_plan',
      text: "What's your plan for conducting user research? Timeline, methodology, sample size?",
      type: QUESTION_TYPES.CONDITIONAL,
      condition: {
        trigger: 'userResearch',
        fromQuestion: 'questions_research_needed'
      },
      helpText: "A specific research plan is more likely to happen and provide useful insights.",
      validationRules: {
        minLength: 30,
        maxLength: 200
      }
    }
  ],
  optional: [
    {
      id: 'questions_success_risks',
      text: "What could go wrong even if the product works as intended? What success risks exist?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "Sometimes success brings unexpected challenges like scaling issues or competitive response.",
      examples: [
        "Rapid growth could overwhelm our bank integration limits or customer support capacity",
        "Success might attract big competitors who could out-resource us or copy our features",
        "Viral adoption could create performance issues or require major architecture changes"
      ],
      validationRules: {
        maxLength: 250
      }
    },
    {
      id: 'questions_dependencies',
      text: "What external dependencies or partnerships are critical to success?",
      type: QUESTION_TYPES.OPTIONAL,
      helpText: "External dependencies create risks and constraints that should be managed proactively.",
      examples: [
        "Bank API partnerships, payment processor agreements, app store approval processes",
        "Integration partnerships with Slack/Teams, enterprise customer pilot programs",
        "University partnerships, student organization endorsements, financial literacy content providers"
      ],
      validationRules: {
        maxLength: 200
      }
    }
  ]
};

/**
 * Dynamic Question Generation Rules
 */
const dynamicQuestionRules = {
  // Industry-specific question variations
  industryAdaptations: {
    [INDUSTRY_CONTEXTS.ENTERPRISE]: {
      additionalQuestions: [
        {
          id: 'enterprise_compliance',
          text: "What compliance requirements (SOX, HIPAA, GDPR, etc.) must this product meet?",
          insertAfter: 'functional_privacy_requirements',
          type: QUESTION_TYPES.CONDITIONAL
        },
        {
          id: 'enterprise_integration',
          text: "What enterprise systems (ERP, CRM, Active Directory) need integration?",
          insertAfter: 'functional_data_sources',
          type: QUESTION_TYPES.CONDITIONAL
        }
      ],
      questionModifications: {
        'audience_primary_users': {
          examples: [
            "Enterprise software managers who need to ensure team productivity and compliance",
            "IT administrators who manage software deployments across large organizations"
          ]
        }
      }
    },
    [INDUSTRY_CONTEXTS.HEALTHCARE]: {
      additionalQuestions: [
        {
          id: 'healthcare_hipaa',
          text: "How will you ensure HIPAA compliance and patient data protection?",
          insertAfter: 'functional_privacy_requirements',
          type: QUESTION_TYPES.REQUIRED
        }
      ]
    },
    [INDUSTRY_CONTEXTS.FINTECH]: {
      additionalQuestions: [
        {
          id: 'fintech_regulatory',
          text: "What financial regulations (PCI DSS, SOX, banking regulations) apply?",
          insertAfter: 'functional_privacy_requirements',
          type: QUESTION_TYPES.REQUIRED
        }
      ]
    }
  },

  // User level adaptations
  userLevelAdaptations: {
    [USER_LEVELS.NON_TECHNICAL]: {
      questionModifications: {
        'functional_data_requirements': {
          text: "What information does the system need to work with? Think about what users input and what gets calculated.",
          examples: [
            "User's basic info, their expenses and income, spending categories, savings goals"
          ]
        },
        'functional_performance_requirements': {
          text: "Are there any speed or reliability requirements? How fast should things work?",
          examples: [
            "Should load quickly on mobile phones, work reliably during peak hours"
          ]
        }
      }
    },
    [USER_LEVELS.TECHNICAL]: {
      additionalQuestions: [
        {
          id: 'technical_architecture',
          text: "What are your technical architecture preferences or constraints?",
          insertAfter: 'functional_platform_features',
          type: QUESTION_TYPES.OPTIONAL
        }
      ]
    }
  },

  // Context-aware follow-up generation
  contextualFollowUps: {
    // If user mentions competitors, ask about differentiation
    competitorMentioned: {
      pattern: /like \w+|similar to \w+|\w+ but|compared to \w+/i,
      followUp: {
        id: 'competitive_differentiation',
        text: "How will your solution be different or better than [COMPETITOR]?",
        type: QUESTION_TYPES.CONDITIONAL
      }
    },
    
    // If user mentions AI/ML, ask about data and training
    aiMentioned: {
      pattern: /ai|artificial intelligence|machine learning|ml|recommendation/i,
      followUp: {
        id: 'ai_requirements',
        text: "What data will you need to train the AI? How will you handle model accuracy and bias?",
        type: QUESTION_TYPES.CONDITIONAL
      }
    },
    
    // If user mentions real-time, ask about performance
    realTimeMentioned: {
      pattern: /real[- ]time|live|instant|immediate/i,
      followUp: {
        id: 'realtime_requirements',
        text: "What's the acceptable latency for real-time features? How will you handle high concurrency?",
        type: QUESTION_TYPES.CONDITIONAL
      }
    }
  }
};

/**
 * Question Selection and Ordering Logic
 */
const questionSelectionRules = {
  // Maximum questions per section to avoid overwhelming users
  maxQuestionsPerSection: {
    introduction: 6,
    goals: 5,
    audience: 6,
    userStories: 7,
    functionalRequirements: 8,
    successMetrics: 6,
    openQuestions: 5
  },

  // Question prioritization weights
  priorityWeights: {
    [QUESTION_TYPES.REQUIRED]: 100,
    [QUESTION_TYPES.CONDITIONAL]: 50,
    [QUESTION_TYPES.OPTIONAL]: 25
  },

  // Skip conditions - when to skip certain questions
  skipConditions: {
    'audience_secondary_users': {
      condition: 'b2c_product',
      pattern: /consumer|personal|individual|student|b2c/i,
      fromSection: 'introduction'
    },
    'functional_collaboration_details': {
      condition: 'single_user_product',
      pattern: /personal|individual|single user|private/i,
      fromSection: 'audience'
    }
  }
};

/**
 * Export configuration with versioning and migration support
 */
const sectionQuestionsConfig = {
  version: SECTION_QUESTIONS_VERSION,
  lastUpdated: '2024-01-15',
  
  // Question definitions by section
  sections: {
    introduction: introductionQuestions,
    goals: goalsQuestions,
    audience: audienceQuestions,
    userStories: userStoriesQuestions,
    functionalRequirements: functionalRequirementsQuestions,
    successMetrics: successMetricsQuestions,
    openQuestions: openQuestionsQuestions
  },

  // Dynamic generation rules
  dynamicRules: dynamicQuestionRules,
  selectionRules: questionSelectionRules,

  // Constants and enums
  constants: {
    QUESTION_TYPES,
    USER_LEVELS,
    INDUSTRY_CONTEXTS
  },

  // Migration support for future versions
  migrations: {
    '1.0.0': {
      // Future migration logic would go here
    }
  },

  // Utility methods
  utils: {
    getQuestionsForSection: (sectionName, context = {}) => {
      const section = sectionQuestionsConfig.sections[sectionName];
      if (!section) return null;

      // Apply industry and user level adaptations
      const adaptedQuestions = applyContextualAdaptations(section, context);
      
      // Apply question selection rules
      const selectedQuestions = applySelectionRules(adaptedQuestions, context);
      
      return selectedQuestions;
    },

    validateQuestionResponse: (questionId, response, context = {}) => {
      const question = findQuestionById(questionId);
      if (!question || !question.validationRules) return { valid: true };

      return validateResponse(response, question.validationRules, context);
    },

    getFollowUpQuestions: (questionId, response, context = {}) => {
      const question = findQuestionById(questionId);
      if (!question || !question.followUpTriggers) return [];

      return generateFollowUpQuestions(question, response, context);
    }
  }
};

// Helper functions for dynamic question processing
function applyContextualAdaptations(section, context) {
  // Implementation would apply industry and user level adaptations
  return section;
}

function applySelectionRules(questions, context) {
  // Implementation would apply selection and skip rules
  return questions;
}

function findQuestionById(questionId) {
  // Implementation would search all sections for the question
  return null;
}

function validateResponse(response, rules, context) {
  // Implementation would validate response against rules
  return { valid: true };
}

function generateFollowUpQuestions(question, response, context) {
  // Implementation would generate contextual follow-up questions
  return [];
}

module.exports = sectionQuestionsConfig;