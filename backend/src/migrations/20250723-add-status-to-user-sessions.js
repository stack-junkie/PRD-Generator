'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add status enum type
    await queryInterface.sequelize.query(`
      CREATE TYPE enum_user_sessions_status AS ENUM ('active', 'completed', 'archived');
    `).catch(error => {
      // Type might already exist, which is fine
      console.log('Note: enum_user_sessions_status might already exist');
    });

    // Add status column
    await queryInterface.addColumn('user_sessions', 'status', {
      type: Sequelize.ENUM('active', 'completed', 'archived'),
      defaultValue: 'active',
      allowNull: false
    });

    // Add index on status column
    await queryInterface.addIndex('user_sessions', ['status']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index
    await queryInterface.removeIndex('user_sessions', ['status']);

    // Remove column
    await queryInterface.removeColumn('user_sessions', 'status');

    // Remove enum type (only in PostgreSQL)
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_user_sessions_status;
    `).catch(error => {
      console.log('Note: Could not drop enum_user_sessions_status');
    });
  }
};