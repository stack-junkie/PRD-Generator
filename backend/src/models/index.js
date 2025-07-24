const { Sequelize, DataTypes } = require('sequelize');

// Database configuration
const sequelize = new Sequelize(
  process.env.DB_NAME || 'prd_generator',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'production' ? false : console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// UserSession Model - maps to UserSession interface
const UserSession = sequelize.define('UserSession', {
  sessionId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    field: 'session_id'
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'user_id'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  lastActive: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'last_active'
  },
  currentSection: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'current_section'
  },
  projectName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'project_name'
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'archived'),
    defaultValue: 'active',
    field: 'status',
    allowNull: false
  }
}, {
  tableName: 'user_sessions',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['created_at'] },
    { fields: ['last_active'] },
    { fields: ['status'] }
  ],
  hooks: {
    beforeUpdate: (session) => {
      session.lastActive = new Date();
    }
  }
});

// Section Model - maps to Section interface
const Section = sequelize.define('Section', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sessionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: UserSession,
      key: 'sessionId'
    },
    field: 'session_id'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  completionStatus: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'completion_status'
  },
  sectionContent: {
    type: DataTypes.TEXT,
    field: 'section_content'
  },
  validationState: {
    type: DataTypes.JSONB,
    defaultValue: {
      overallComplete: false,
      questionStates: {},
      userConsent: false
    },
    field: 'validation_state'
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    field: 'version'
  }
}, {
  tableName: 'sections',
  timestamps: true,
  indexes: [
    { fields: ['session_id'] },
    { fields: ['name'] },
    { fields: ['completion_status'] }
  ],
  hooks: {
    beforeUpdate: (section) => {
      if (section.changed('sectionContent')) {
        section.version += 1;
      }
    }
  }
});

// Question Model - maps to Question interface
const Question = sequelize.define('Question', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sectionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Section,
      key: 'id'
    },
    field: 'section_id'
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('required', 'optional', 'contextual'),
    allowNull: false,
    defaultValue: 'required'
  },
  validationRules: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'validation_rules'
  },
  answered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  quality: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  }
}, {
  tableName: 'questions',
  timestamps: true,
  indexes: [
    { fields: ['section_id'] },
    { fields: ['type'] },
    { fields: ['answered'] }
  ]
});

// Response Model - maps to Response interface
const Response = sequelize.define('Response', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  questionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Question,
      key: 'id'
    },
    field: 'question_id'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  qualityScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    },
    field: 'quality_score'
  },
  extractedData: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'extracted_data'
  }
}, {
  tableName: 'responses',
  timestamps: false,
  indexes: [
    { fields: ['question_id'] },
    { fields: ['timestamp'] },
    { fields: ['quality_score'] }
  ],
  hooks: {
    beforeCreate: (response) => {
      // Sanitize content
      if (response.content) {
        response.content = response.content.trim();
      }
    }
  }
});

// ConversationMessage Model - tracks the full conversation history
const ConversationMessage = sequelize.define('ConversationMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sessionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: UserSession,
      key: 'sessionId'
    },
    field: 'session_id'
  },
  role: {
    type: DataTypes.ENUM('user', 'assistant', 'system'),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    // Stores: section, tokens used, processing time, etc.
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  }
}, {
  tableName: 'conversation_messages',
  timestamps: false, // We only need createdAt
  indexes: [
    { fields: ['session_id', 'created_at'] }, // For conversation ordering
    { fields: ['created_at'] } // For cleanup jobs
  ],
  hooks: {
    beforeCreate: (message) => {
      // Sanitize content
      if (message.content) {
        message.content = message.content.trim();
      }
    }
  }
});

// PRDDocument Model - maps to PRDDocument interface
const PRDDocument = sequelize.define('PRDDocument', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sessionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: UserSession,
      key: 'sessionId'
    },
    field: 'session_id'
  },
  sections: {
    type: DataTypes.JSONB,
    defaultValue: {
      introduction: {},
      goals: {},
      audience: {},
      userStories: {},
      functionalReqs: {},
      metrics: {},
      openQuestions: {}
    }
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {
      createdAt: new Date(),
      lastModified: new Date(),
      version: '1.0.0'
    }
  },
  content: {
    type: DataTypes.TEXT,
    comment: 'Full markdown content of the PRD'
  },
  exportedAt: {
    type: DataTypes.DATE,
    field: 'exported_at'
  }
}, {
  tableName: 'prd_documents',
  timestamps: true,
  indexes: [
    { fields: ['session_id'] },
    { fields: ['exported_at'] }
  ],
  hooks: {
    beforeUpdate: (document) => {
      if (document.metadata) {
        document.metadata.lastModified = new Date();
      }
    }
  }
});

// Define associations
UserSession.hasMany(Section, {
  foreignKey: 'sessionId',
  as: 'completedSections'
});
Section.belongsTo(UserSession, {
  foreignKey: 'sessionId'
});

Section.hasMany(Question, {
  foreignKey: 'sectionId',
  as: 'questions'
});
Question.belongsTo(Section, {
  foreignKey: 'sectionId'
});

Question.hasMany(Response, {
  foreignKey: 'questionId',
  as: 'responses'
});
Response.belongsTo(Question, {
  foreignKey: 'questionId'
});

UserSession.hasOne(PRDDocument, {
  foreignKey: 'sessionId',
  as: 'draftPRD'
});
PRDDocument.belongsTo(UserSession, {
  foreignKey: 'sessionId'
});

UserSession.hasMany(ConversationMessage, {
  foreignKey: 'sessionId',
  as: 'messages'
});
ConversationMessage.belongsTo(UserSession, {
  foreignKey: 'sessionId'
});

// Export models and sequelize instance
module.exports = {
  sequelize,
  UserSession,
  Section,
  Question,
  Response,
  ConversationMessage,
  PRDDocument
};