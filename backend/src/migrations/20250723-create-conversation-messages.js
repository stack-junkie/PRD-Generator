'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create enum type for message roles
    await queryInterface.sequelize.query(`
      CREATE TYPE enum_conversation_messages_role AS ENUM ('user', 'assistant', 'system');
    `).catch(error => {
      // Type might already exist, which is fine
      console.log('Note: enum_conversation_messages_role might already exist');
    });

    // Create conversation_messages table
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
    
    // Add indexes for performance
    await queryInterface.addIndex('conversation_messages', ['session_id', 'created_at']);
    await queryInterface.addIndex('conversation_messages', ['created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('conversation_messages', ['session_id', 'created_at']);
    await queryInterface.removeIndex('conversation_messages', ['created_at']);
    
    // Drop table
    await queryInterface.dropTable('conversation_messages');
    
    // Remove enum type (only in PostgreSQL)
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_conversation_messages_role;
    `).catch(error => {
      console.log('Note: Could not drop enum_conversation_messages_role');
    });
  }
};