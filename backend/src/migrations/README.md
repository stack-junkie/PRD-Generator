# Database Migrations

This directory contains database migration files for the PRD-Maker project. These migrations update the database schema to support new features and changes to the data model.

## Migration Files

1. `20250723-add-status-to-user-sessions.js` - Adds a status field to the user_sessions table
2. `20250723-add-version-to-sections.js` - Adds a version field to the sections table
3. `20250723-create-conversation-messages.js` - Creates the conversation_messages table for tracking conversation history

## Running Migrations

To run these migrations, you'll need to use Sequelize CLI. If you haven't installed it yet, you can do so with:

```bash
npm install --save-dev sequelize-cli
```

### Configuration

Make sure your Sequelize configuration is set up correctly. Create a `.sequelizerc` file in the project root if you don't have one:

```javascript
// .sequelizerc
const path = require('path');

module.exports = {
  'config': path.resolve('backend/src/config', 'database.js'),
  'models-path': path.resolve('backend/src/models'),
  'seeders-path': path.resolve('backend/src/seeders'),
  'migrations-path': path.resolve('backend/src/migrations')
};
```

### Running All Migrations

To run all pending migrations:

```bash
npx sequelize-cli db:migrate
```

### Running a Specific Migration

To run a specific migration:

```bash
npx sequelize-cli db:migrate --to 20250723-add-status-to-user-sessions.js
```

### Undoing Migrations

To undo the most recent migration:

```bash
npx sequelize-cli db:migrate:undo
```

To undo all migrations:

```bash
npx sequelize-cli db:migrate:undo:all
```

To undo a specific migration:

```bash
npx sequelize-cli db:migrate:undo --to 20250723-add-status-to-user-sessions.js
```

## Migration Order

The migrations should be run in the following order:

1. First, add the status field to user_sessions table
2. Then, add the version field to sections table
3. Finally, create the conversation_messages table

The timestamp prefix in the filenames ensures they run in the correct order.

## Troubleshooting

If you encounter issues with the migrations:

1. Check that your database connection is configured correctly
2. Ensure you have the necessary permissions to modify the database schema
3. Look for error messages in the console output
4. For PostgreSQL-specific issues with enum types, you may need to manually drop types if they already exist

## Additional Resources

- [Sequelize Migrations Documentation](https://sequelize.org/master/manual/migrations.html)
- [Sequelize CLI Documentation](https://github.com/sequelize/cli)