'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add version column to sections table
    await queryInterface.addColumn('sections', 'version', {
      type: Sequelize.INTEGER,
      defaultValue: 1,
      allowNull: false
    });

    // Update existing records to have version = 1
    await queryInterface.sequelize.query(`
      UPDATE sections SET version = 1 WHERE version IS NULL;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove version column
    await queryInterface.removeColumn('sections', 'version');
  }
};