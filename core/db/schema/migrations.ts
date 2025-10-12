/**
 * Migrations Schema
 *
 * Contains 1 system table for migration tracking:
 * - schema_migrations: Schema migration history
 *
 * Used by Drizzle Kit or custom migration tools to track which migrations
 * have been applied to the database.
 */

import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Schema Migrations Table
 *
 * Tracks schema migration execution history.
 * Used by Drizzle Kit or custom migration tools.
 *
 * Fields:
 * - id: Serial primary key (auto-incrementing integer)
 * - name: Migration name/identifier
 * - run_at: Timestamp when migration was executed (defaults to now)
 *
 * Usage: Each time a migration is applied, an entry is inserted with the
 * migration name and execution timestamp. This prevents re-running migrations.
 */
export const schemaMigrations = pgTable('schema_migrations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
});
