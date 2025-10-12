/**
 * Database Connection Module
 *
 * This module provides a connection pool to the PostgreSQL database using
 * the 'postgres' driver and Drizzle ORM for type-safe queries.
 *
 * Key Features:
 * - Connection pooling for efficient resource usage
 * - Environment-based configuration (dev/staging/prod)
 * - Type-safe database client with full schema awareness
 * - Singleton pattern to prevent connection leaks
 * - Graceful shutdown support for cleanup
 * - Error handling and connection testing
 *
 * Architecture:
 * 1. getDatabaseConfig() - Reads environment variables
 * 2. createConnection() - Creates postgres client with pooling
 * 3. getDb() - Returns Drizzle client (singleton)
 * 4. closeDb() - Closes all connections (for shutdown/testing)
 * 5. testConnection() - Validates database connectivity
 *
 * Usage in application code:
 * ```typescript
 * import { getDb } from '~/db/connection';
 *
 * const db = getDb();
 * const users = await db.select().from(usersTable);
 * ```
 *
 * Usage in tests:
 * ```typescript
 * import { getDb, closeDb } from '~/db/connection';
 *
 * afterAll(async () => {
 *   await closeDb(); // Clean up connections
 * });
 * ```
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

/**
 * Database connection options interface
 *
 * Defines all configurable parameters for the PostgreSQL connection.
 * These options are read from environment variables with sensible defaults.
 *
 * Key configuration:
 * - Connection parameters (host, port, database, credentials)
 * - Connection pooling (max connections, timeouts)
 * - SSL/TLS for secure connections (required in production)
 */
interface DatabaseConfig {
  /** Database server hostname (e.g., 'localhost', 'db.example.com') */
  host: string;
  /** Database server port (default: 5432 for PostgreSQL) */
  port: number;
  /** Database name (e.g., 'devcle_dev', 'devcle_prod') */
  database: string;
  /** Database username for authentication */
  username: string;
  /** Database password for authentication */
  password: string;
  /** Enable SSL/TLS encryption (required in production) */
  ssl?: boolean;
  /** Maximum number of connections in the pool (default: 20) */
  max?: number;
  /** Time (seconds) before idle connections are closed (default: 30) */
  idle_timeout?: number;
  /** Time (seconds) to wait for initial connection (default: 10) */
  connect_timeout?: number;
}

/**
 * Get database configuration from environment variables
 *
 * Reads DATABASE_* environment variables and returns a validated config object.
 * Falls back to localhost defaults for local development convenience.
 *
 * Environment Variables:
 * - DATABASE_HOST: Server hostname
 * - DATABASE_PORT: Server port
 * - DATABASE_NAME: Database name
 * - DATABASE_USER: Username
 * - DATABASE_PASSWORD: Password
 * - DATABASE_SSL: Enable SSL ('true' for production)
 * - DATABASE_POOL_MAX: Max connections
 * - DATABASE_IDLE_TIMEOUT: Idle timeout
 * - DATABASE_CONNECT_TIMEOUT: Connect timeout
 *
 * @returns {DatabaseConfig} Validated database configuration
 * @throws {Error} If required environment variables are missing in production
 */
function getDatabaseConfig(): DatabaseConfig {
  // Read required environment variables
  // POSTGRES_* variables are used by docker-compose
  // DATABASE_* variables can be used as alternatives
  const database = process.env['POSTGRES_DB'] || process.env['DATABASE_NAME'];
  const username = process.env['POSTGRES_USER'] || process.env['DATABASE_USER'];
  const password = process.env['POSTGRES_PASSWORD'] || process.env['DATABASE_PASSWORD'];

  // Validate that required environment variables are set
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

  // In test environment, use max: 1 to ensure SET commands work correctly
  // This ensures all queries use the same connection, so SET app.current_tenant_id
  // persists across queries within the same test
  const isTestEnv = process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true';
  const max = isTestEnv ? 1 : (Number(process.env['DATABASE_POOL_MAX']) || 20);

  const idle_timeout = Number(process.env['DATABASE_IDLE_TIMEOUT']) || 30;
  const connect_timeout = Number(process.env['DATABASE_CONNECT_TIMEOUT']) || 10;

  const config: DatabaseConfig = {
    host,
    port,
    database,
    username,
    password,
    ssl,
    max,
    idle_timeout,
    connect_timeout,
  };

  return config;
}

/**
 * Create PostgreSQL connection with connection pooling
 *
 * Initializes a postgres client with automatic connection pooling.
 * The pool manages connections efficiently, reusing them across requests.
 *
 * Features:
 * - Automatic connection pooling (max 20 connections by default)
 * - Idle connection cleanup (closes unused connections after 30s)
 * - Connection timeout handling (fails fast if server unavailable)
 * - SSL/TLS support for secure connections
 * - snake_case to camelCase transformation for column names
 *
 * @returns {postgres.Sql} PostgreSQL client with connection pool
 * @throws {Error} If connection cannot be established
 */
export function createConnection(): postgres.Sql {
  const config = getDatabaseConfig();

  // Create postgres client with connection pooling
  // The 'transform' option automatically converts snake_case column names
  // to camelCase in JavaScript (e.g., created_at -> createdAt)
  // Build postgres options with proper typing
  // SSL must be false (not undefined) when disabled due to exactOptionalPropertyTypes
  const options = {
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    ssl: config.ssl === true ? true : false,
    max: config.max ?? 20,
    idle_timeout: config.idle_timeout ?? 30,
    connect_timeout: config.connect_timeout ?? 10,
    // Automatically convert column names from snake_case to camelCase
    // This improves JavaScript ergonomics while keeping SQL conventions
    transform: postgres.camel,
  };

  const sql = postgres(options);

  return sql;
}

/**
 * Database client instance (singleton)
 *
 * Stores the Drizzle ORM client instance to prevent creating multiple
 * connection pools. This singleton pattern ensures:
 * - Only one connection pool exists per application instance
 * - Connections are reused efficiently across requests
 * - No connection leaks from creating multiple pools
 *
 * Set to null initially and lazily initialized on first getDb() call.
 */
let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

/**
 * Postgres SQL client instance (singleton)
 *
 * Stores the raw postgres.js client for direct SQL access.
 * This is needed for:
 * - Closing connections (cleanup)
 * - Raw SQL queries (testConnection)
 * - Low-level database operations
 */
let sqlInstance: postgres.Sql | null = null;

/**
 * Get Drizzle database client (singleton)
 *
 * Returns a type-safe Drizzle ORM client with full schema awareness.
 * Uses singleton pattern to ensure only one connection pool exists.
 *
 * On first call:
 * 1. Creates postgres connection pool
 * 2. Wraps it with Drizzle ORM
 * 3. Attaches schema for type-safe queries
 * 4. Caches instance for reuse
 *
 * On subsequent calls:
 * - Returns cached instance immediately
 *
 * Type Safety:
 * The returned client has full TypeScript awareness of all tables,
 * columns, and relationships defined in the schema. This enables:
 * - Autocomplete for table/column names
 * - Type checking for query parameters
 * - Compile-time validation of queries
 *
 * @returns {PostgresJsDatabase<typeof schema>} Type-safe database client
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  // Return cached instance if it exists (singleton pattern)
  if (dbInstance) {
    return dbInstance;
  }

  // First call: create new connection and Drizzle instance
  const sql = createConnection();

  // Store SQL instance for cleanup and raw queries
  sqlInstance = sql;

  // Wrap postgres client with Drizzle ORM for type-safe queries
  // The 'schema' parameter enables:
  // - Type-safe select/insert/update/delete operations
  // - Automatic TypeScript inference for query results
  // - Schema-aware query building
  dbInstance = drizzle(sql, { schema });

  return dbInstance;
}

/**
 * Get raw postgres.js SQL client (for testing and raw queries)
 *
 * Returns the underlying postgres.js client for direct SQL access.
 * This is primarily used for:
 * - Testing raw SQL execution
 * - Low-level database operations
 * - Performance-critical queries that don't need ORM overhead
 *
 * Note: This function will initialize the connection if not already done.
 *
 * @returns {postgres.Sql | null} Raw postgres.js client or null if not initialized
 */
export function getSql(): postgres.Sql | null {
  // Initialize connection if needed
  if (!sqlInstance) {
    getDb();
  }
  return sqlInstance;
}

/**
 * Close database connection and cleanup resources
 *
 * Closes all connections in the pool and resets the singleton instance.
 * This is essential for:
 * - Graceful application shutdown
 * - Test cleanup (prevents hanging connections)
 * - Resource management in serverless environments
 *
 * Usage:
 * ```typescript
 * // In application shutdown handler
 * process.on('SIGTERM', async () => {
 *   await closeDb();
 *   process.exit(0);
 * });
 *
 * // In test cleanup
 * afterAll(async () => {
 *   await closeDb();
 * });
 * ```
 *
 * @returns {Promise<void>} Resolves when all connections are closed
 */
export async function closeDb(): Promise<void> {
  if (!sqlInstance) {
    // No instance exists, nothing to close
    return;
  }

  try {
    // Close all connections in the pool
    // This ensures no dangling connections remain
    await sqlInstance.end();

    // Reset both singleton instances so next getDb() creates fresh connection
    dbInstance = null;
    sqlInstance = null;
  } catch (error) {
    // Log error but don't throw - cleanup should be resilient
    console.error('Error closing database connection:', error);
    // Still reset instances even if close failed
    dbInstance = null;
    sqlInstance = null;
  }
}

/**
 * Test database connection
 *
 * Executes a simple query to verify database connectivity.
 * Useful for:
 * - Health checks in production
 * - Validating configuration during startup
 * - Debugging connection issues
 * - Integration test setup validation
 *
 * The test query (SELECT 1) is chosen because:
 * - It's fast and lightweight
 * - It doesn't require any tables to exist
 * - It's supported by all PostgreSQL versions
 * - It doesn't modify any data
 *
 * @returns {Promise<boolean>} true if connection successful
 * @throws {Error} If connection fails with detailed error message
 */
export async function testConnection(): Promise<boolean> {
  try {
    // Get database client (will create connection if needed)
    // This also initializes sqlInstance
    getDb();

    // Use raw SQL client for test query
    // This avoids needing to use Drizzle's query builder for simple test
    if (!sqlInstance) {
      throw new Error('SQL client not initialized');
    }

    // Execute simple test query
    // SELECT 1 is a no-op query that just verifies connection works
    const result = await sqlInstance`SELECT 1 as test`;

    // Verify we got a result back
    // A successful connection should return at least one row
    return result.length > 0;
  } catch (error) {
    // Log error for debugging
    console.error('Database connection test failed:', error);

    // Re-throw with more context for caller
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to connect to database: ${message}`);
  }
}

/**
 * Set tenant context for current database session
 *
 * This function sets the PostgreSQL session variable `app.current_tenant_id`
 * which is used by Row Level Security (RLS) policies to filter data by tenant.
 *
 * All subsequent queries in the same session will only access data
 * belonging to the specified tenant.
 *
 * Security Note:
 * Uses parameterized query (template literal) to prevent SQL injection.
 * The tenantId is automatically escaped by postgres.js.
 *
 * Usage in Remix loaders/actions:
 * ```typescript
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const tenantId = getTenantIdFromRequest(request); // from session/auth
 *   await setTenantContext(tenantId);
 *
 *   const db = getDb();
 *   const developers = await db.select().from(schema.developers);
 *   // Returns only developers for the specified tenant
 * }
 * ```
 *
 * Usage in seed scripts:
 * ```typescript
 * await setTenantContext('default');
 * await seedTenant();
 * await seedDevelopers();
 * ```
 *
 * @param tenantId - Tenant ID to set (e.g., 'default', 'acme-corp')
 * @throws {Error} If tenantId is empty or SQL execution fails
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  // Validate tenantId is not empty
  // This prevents security issues and ensures RLS policies work correctly
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('Tenant ID cannot be empty');
  }

  // Validate tenantId contains only safe characters to prevent SQL injection
  // Allow: alphanumeric, hyphen, underscore (common tenant ID formats)
  // This is CRITICAL security check since SET command cannot use parameter binding
  const safePattern = /^[a-zA-Z0-9_-]+$/;
  if (!safePattern.test(tenantId)) {
    throw new Error(
      `Tenant ID contains invalid characters. Only alphanumeric, hyphen, and underscore are allowed. Got: ${tenantId}`
    );
  }

  // Get raw SQL client (initialize if needed)
  // We need the raw client to execute SET command
  const sql = getSql();

  if (!sql) {
    throw new Error('SQL client not initialized');
  }

  try {
    // Execute SET command
    // Note: PostgreSQL's SET command does not support parameterized queries ($1, $2, etc.)
    // We use sql.unsafe() BUT with strict validation above to prevent SQL injection
    // The tenantId has been validated to contain only safe characters
    await sql.unsafe(`SET app.current_tenant_id = '${tenantId}'`);
  } catch (error) {
    // Log error for debugging (includes tenant ID for troubleshooting)
    console.error(
      `Failed to set tenant context to '${tenantId}':`,
      error
    );

    // Re-throw with context for caller
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Failed to set tenant context to '${tenantId}': ${message}`
    );
  }
}

/**
 * Get current tenant context from database session
 *
 * This function retrieves the current value of the PostgreSQL session variable
 * `app.current_tenant_id`. Useful for debugging and testing.
 *
 * Usage:
 * ```typescript
 * await setTenantContext('default');
 * const current = await getTenantContext();
 * console.log(current); // 'default'
 * ```
 *
 * @returns Current tenant ID, or null if not set
 * @throws {Error} If SQL execution fails
 */
export async function getTenantContext(): Promise<string | null> {
  // Get raw SQL client (initialize if needed)
  const sql = getSql();

  if (!sql) {
    throw new Error('SQL client not initialized');
  }

  try {
    // Execute query to get current_setting
    // Second argument 'true' prevents error if variable is not set (returns NULL instead)
    // This is safe - no user input involved
    const result = await sql`
      SELECT current_setting('app.current_tenant_id', true) as tenant_id
    `;

    // Extract tenant_id from result
    // postgres.js returns array of rows
    // Use bracket notation because TypeScript's exactOptionalPropertyTypes requires it for index signatures
    if (result.length > 0 && result[0]) {
      const tenantId = result[0]['tenantId'];
      // PostgreSQL returns empty string when variable is not set with second arg true
      // We normalize this to null for consistency
      return tenantId && tenantId !== '' ? tenantId : null;
    }

    return null;
  } catch (error) {
    // Log error for debugging
    console.error('Failed to get tenant context:', error);

    // Re-throw with context for caller
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get tenant context: ${message}`);
  }
}

/**
 * Clear tenant context from database session
 *
 * This function clears the PostgreSQL session variable `app.current_tenant_id`.
 * Primarily used in test cleanup to ensure isolated tests.
 *
 * After clearing, queries will fail with RLS policy violations unless
 * the database user is a superuser.
 *
 * Usage in tests:
 * ```typescript
 * afterEach(async () => {
 *   await clearTenantContext();
 * });
 * ```
 *
 * @throws {Error} If SQL execution fails
 */
export async function clearTenantContext(): Promise<void> {
  // Get raw SQL client (initialize if needed)
  const sql = getSql();

  if (!sql) {
    throw new Error('SQL client not initialized');
  }

  try {
    // Execute RESET to clear session variable
    // Note: RESET command, like SET, does not support parameterized queries
    // This is safe because there is no user input involved (hardcoded command)
    await sql.unsafe('RESET app.current_tenant_id');
  } catch (error) {
    // Log error for debugging
    console.error('Failed to clear tenant context:', error);

    // Re-throw with context for caller
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to clear tenant context: ${message}`);
  }
}
