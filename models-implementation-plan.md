# Database Models Implementation Plan

This document outlines the changes needed to implement the database models for the PRD-Maker project according to the requirements.

## Current Implementation Analysis

The existing `models/index.js` file already implements:

- `UserSession` model for tracking user sessions
- `Section` model for PRD sections
- `Question` model for section questions
- `Response` model for user responses
- `PRDDocument` model for the final PRD

However, it's missing some required elements:

1. Status field in UserSession model
2. Version field in Section model
3. ConversationMessage model for tracking the full conversation history
4. Some relationship definitions

## Implementation Plan

### 1. Update UserSession Model

Add a status field to track the session state:

```javascript
// Add to UserSession definition
status: {
  type: DataTypes.ENUM('active', 'completed', 'archived'),
  defaultValue: 'active',
  field: 'status',
  allowNull: false
}
```

Add an index for the status field:

```javascript
// Add to UserSession indexes
{ fields: ['status'] }
```

### 2. Update Section Model

Add a version field to track section revisions:

```javascript
// Add to Section definition
version: {
  type: DataTypes.INTEGER,
  defaultValue: 1,
  field: 'version'
}
```

Add a hook to increment version on updates:

```javascript
// Add to Section hooks
beforeUpdate: (section) => {
  if (section.changed('sectionContent')) {
    section.version += 1;
  }
}
```

### 3. Add ConversationMessage Model

Create a new model to track the full conversation history:

```javascript
// ConversationMessage Model
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
```

### 4. Update Model Relationships

Add the relationship between UserSession and ConversationMessage:

```javascript
// Add to associations section
UserSession.hasMany(ConversationMessage, { 
  foreignKey: 'sessionId',
  as: 'messages'
});
ConversationMessage.belongsTo(UserSession, { 
  foreignKey: 'sessionId' 
});
```

### 5. Update Exports

Add the new model to the exports:

```javascript
// Update module.exports
module.exports = {
  sequelize,
  UserSession,
  Section,
  Question,
  Response,
  ConversationMessage, // Add this
  PRDDocument
};
```

## Migration Strategy

Since we're adding new fields and a new model, we'll need to create migration files:

1. **Add status field to user_sessions table**:
   ```javascript
   // migrations/add-status-to-user-sessions.js
   module.exports = {
     up: async (queryInterface, Sequelize) => {
       await queryInterface.addColumn('user_sessions', 'status', {
         type: Sequelize.ENUM('active', 'completed', 'archived'),
         defaultValue: 'active',
         allowNull: false
       });
       await queryInterface.addIndex('user_sessions', ['status']);
     },
     down: async (queryInterface, Sequelize) => {
       await queryInterface.removeColumn('user_sessions', 'status');
     }
   };
   ```

2. **Add version field to sections table**:
   ```javascript
   // migrations/add-version-to-sections.js
   module.exports = {
     up: async (queryInterface, Sequelize) => {
       await queryInterface.addColumn('sections', 'version', {
         type: Sequelize.INTEGER,
         defaultValue: 1
       });
     },
     down: async (queryInterface, Sequelize) => {
       await queryInterface.removeColumn('sections', 'version');
     }
   };
   ```

3. **Create conversation_messages table**:
   ```javascript
   // migrations/create-conversation-messages.js
   module.exports = {
     up: async (queryInterface, Sequelize) => {
       await queryInterface.createTable('conversation_messages', {
         id: {
           type: Sequelize.UUID,
           defaultValue: Sequelize.UUIDV4,
           primaryKey: true
         },
         session_id: {
           type: Sequelize.UUID,
           allowNull: false,
           references: {
             model: 'user_sessions',
             key: 'session_id'
           },
           onDelete: 'CASCADE'
         },
         role: {
           type: Sequelize.ENUM('user', 'assistant', 'system'),
           allowNull: false
         },
         content: {
           type: Sequelize.TEXT,
           allowNull: false
         },
         metadata: {
           type: Sequelize.JSONB,
           defaultValue: {}
         },
         created_at: {
           type: Sequelize.DATE,
           defaultValue: Sequelize.NOW
         }
       });
       
       await queryInterface.addIndex('conversation_messages', ['session_id', 'created_at']);
       await queryInterface.addIndex('conversation_messages', ['created_at']);
     },
     down: async (queryInterface, Sequelize) => {
       await queryInterface.dropTable('conversation_messages');
     }
   };
   ```

## Next Steps

1. Switch to Code mode to implement these changes
2. Run the migrations to update the database schema
3. Test the new models with sample data
4. Update any services that interact with these models

## Potential Challenges

1. **Data Migration**: Existing sessions will need to have the status field populated
2. **Schema Compatibility**: Ensure the new schema is compatible with existing code
3. **Performance**: Monitor query performance with the new relationships and indexes