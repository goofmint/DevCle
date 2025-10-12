/**
 * Drizzle Kit Configuration
 *
 * This file configures the Drizzle migration tool for the DevCle project.
 * It defines how schema files are discovered, where migrations are generated,
 * and how to connect to the database.
 *
 * Configuration includes:
 * - Schema location: Points to all table definitions
 * - Migration output: Where SQL migration files are stored
 * - Database dialect: PostgreSQL-specific features and syntax
 * - Connection credentials: Environment-based database connection
 *
 * Usage:
 * - `pnpm db:generate` - Generate migration from schema changes
 * - `pnpm db:migrate` - Apply migrations to database
 * - `pnpm db:push` - Push schema directly (dev only)
 * - `pnpm db:studio` - Launch Drizzle Studio GUI
 */

import { defineConfig } from 'drizzle-kit';

// Read required environment variables
// POSTGRES_* variables are used by docker-compose
// DATABASE_* variables can be used as alternatives
const database = process.env['POSTGRES_DB'] || process.env['DATABASE_NAME'];
const username = process.env['POSTGRES_USER'] || process.env['DATABASE_USER'];
const password = process.env['POSTGRES_PASSWORD'] || process.env['DATABASE_PASSWORD'];

// Validate required environment variables
// NO fallback values for security reasons
if (!database) {
  throw new Error(
    'Database name is required. Set POSTGRES_DB or DATABASE_NAME environment variable.'
  );
}

if (!username) {
  throw new Error(
    'Database username is required. Set POSTGRES_USER or DATABASE_USER environment variable.'
  );
}

if (!password) {
  throw new Error(
    'Database password is required. Set POSTGRES_PASSWORD or DATABASE_PASSWORD environment variable.'
  );
}

// Optional parameters can have defaults
const host = process.env['DATABASE_HOST'] || 'localhost';
const port = Number(process.env['DATABASE_PORT']) || 5432;
const ssl = process.env['DATABASE_SSL'] === 'true';

export default defineConfig({
  // Schema definition files location
  // All table schemas are aggregated in this index file
  // This file will import all schema files from db/schema/*.ts
  schema: './db/schema/index.ts',

  // Migration output directory
  // Generated SQL files are stored here and should be committed to git
  // These migrations are applied to production databases
  out: './db/migrations',

  // Database dialect
  // PostgreSQL is chosen for its robust features:
  // - Row Level Security (RLS) for multi-tenancy
  // - JSONB for flexible metadata storage
  // - Full-text search capabilities
  // - Advanced indexing options
  dialect: 'postgresql',

  // Database connection credentials
  // Reads from required environment variables
  // Throws error if any required variable is missing (no fallback)
  dbCredentials: {
    host,
    port,
    user: username,
    password,
    database,
    ssl,
  },

  // Verbose logging for debugging
  // Enables detailed output during migration generation and application
  // Useful for troubleshooting schema changes and SQL generation
  verbose: true,

  // Strict mode for schema validation
  // Enforces type-safe schema definitions and catches errors early
  // Prevents common mistakes like missing constraints or invalid types
  strict: true,
});
