/**
 * Database Module Entry Point
 *
 * This module exports all database-related functionality for the DevCle application.
 * It serves as the single source of truth for database operations.
 *
 * Exported modules:
 * - Connection management: getDb, closeDb, testConnection
 * - Schema definitions: All table schemas (to be added in Task 3.2)
 *
 * Usage throughout the application:
 * ```typescript
 * // Get database client
 * import { getDb } from '~/db';
 * const db = getDb();
 *
 * // Clean up in tests or shutdown
 * import { closeDb } from '~/db';
 * await closeDb();
 * ```
 *
 * Architecture:
 * - connection.ts: Manages PostgreSQL connections and Drizzle ORM setup
 * - schema/: Contains all table definitions (Task 3.2+)
 * - migrations/: Generated SQL migration files (auto-generated)
 */

// Export all connection management functions
export { getDb, closeDb, testConnection, createConnection, getSql } from './connection';

// Export all schema definitions
// Currently empty, will be populated in Task 3.2 with table schemas
export * from './schema';
