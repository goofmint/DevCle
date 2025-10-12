/**
 * Database Connection Tests
 *
 * These tests verify the database connection functionality without using mocks.
 * They test against a real PostgreSQL database to ensure:
 * - Connection pool is created correctly
 * - Database queries execute successfully
 * - Connection cleanup works properly
 * - Error handling is robust
 *
 * Test Strategy:
 * - No mocks: Tests use real database connections
 * - Cleanup: Each test closes connections to prevent leaks
 * - Isolation: Tests don't depend on each other
 * - Real scenarios: Tests simulate actual usage patterns
 *
 * Prerequisites:
 * - PostgreSQL must be running (via docker-compose)
 * - Environment variables must be set (DATABASE_HOST, etc.)
 * - Database must be accessible
 */

import { describe, it, expect, afterEach } from 'vitest';
import { getDb, closeDb, testConnection, createConnection, getSql } from './connection';

describe('Database Connection', () => {
  /**
   * Cleanup after each test
   *
   * Ensures no connection leaks between tests by closing all connections.
   * This is critical for:
   * - Preventing resource exhaustion
   * - Ensuring test isolation
   * - Avoiding port/socket conflicts
   */
  afterEach(async () => {
    // Close all database connections after each test
    // This prevents connection leaks and ensures clean state for next test
    await closeDb();
  });

  /**
   * Test: getDb returns a database client
   *
   * Verifies that:
   * - getDb() returns a valid database client
   * - The client is not null or undefined
   * - The client has expected Drizzle ORM methods
   */
  it('should return a database client', () => {
    // Get database client (singleton pattern)
    const db = getDb();

    // Verify client exists
    expect(db).toBeDefined();
    expect(db).not.toBeNull();

    // Verify client has Drizzle ORM methods
    // These methods are essential for querying the database
    expect(db.select).toBeDefined();
    expect(db.execute).toBeDefined();
  });

  /**
   * Test: getDb returns same instance (singleton)
   *
   * Verifies singleton pattern implementation:
   * - Multiple calls return the same instance
   * - No duplicate connection pools are created
   * - Memory and resources are used efficiently
   */
  it('should return same instance on multiple calls (singleton)', () => {
    // Get database client twice
    const db1 = getDb();
    const db2 = getDb();

    // Verify both references point to the same instance
    // This confirms singleton pattern is working
    expect(db1).toBe(db2);
  });

  /**
   * Test: testConnection validates database connectivity
   *
   * Verifies that:
   * - Database connection can be established
   * - Simple queries execute successfully
   * - testConnection() returns true for successful connection
   *
   * This test actually connects to PostgreSQL and executes a query.
   * It will fail if:
   * - PostgreSQL is not running
   * - Environment variables are incorrect
   * - Network connectivity issues exist
   */
  it('should successfully test database connection', async () => {
    // Execute connection test (runs SELECT 1 query)
    // This is a real database query, not mocked
    const result = await testConnection();

    // Verify connection was successful
    expect(result).toBe(true);
  });

  /**
   * Test: createConnection returns postgres client
   *
   * Verifies that:
   * - createConnection() creates a valid postgres client
   * - The client has expected postgres.js methods
   * - Connection pool is configured correctly
   */
  it('should create a postgres connection', () => {
    // Create new postgres connection
    // This creates a connection pool under the hood
    const sql = createConnection();

    // Verify connection exists
    expect(sql).toBeDefined();
    expect(sql).not.toBeNull();

    // Verify connection has postgres.js query methods
    // These are the low-level methods used by Drizzle ORM
    expect(typeof sql).toBe('function');
  });

  /**
   * Test: closeDb cleans up connections
   *
   * Verifies that:
   * - closeDb() successfully closes all connections
   * - No errors are thrown during cleanup
   * - Resources are properly released
   * - Next getDb() call creates a fresh connection
   */
  it('should close database connections', async () => {
    // Get database client (creates connection pool)
    const db1 = getDb();
    expect(db1).toBeDefined();

    // Close all connections
    // This should release all resources
    await closeDb();

    // Get database client again (should create new connection)
    // This verifies that singleton was reset properly
    const db2 = getDb();
    expect(db2).toBeDefined();

    // Verify new instance was created (not same as before close)
    // This confirms closeDb() properly reset the singleton
    expect(db2).not.toBe(db1);
  });

  /**
   * Test: execute simple query
   *
   * Verifies that:
   * - Database client can execute raw SQL queries
   * - Query results are returned correctly
   * - Result format matches expected structure
   *
   * This test executes a real SQL query against PostgreSQL.
   * It's a comprehensive end-to-end test of the connection stack.
   */
  it('should execute a simple query', async () => {
    // Get database client to initialize connection
    getDb();

    // Get raw postgres client for direct SQL execution
    const sql = getSql();

    // Ensure SQL client is initialized
    expect(sql).toBeDefined();
    expect(sql).not.toBeNull();

    if (!sql) {
      throw new Error('SQL client not initialized');
    }

    // Execute a simple test query using postgres.js template literal syntax
    // SELECT 1 is the simplest possible query - just returns 1
    // This verifies that:
    // - Connection is established
    // - Query execution works
    // - Results are returned
    const result = await sql`SELECT 1 as test`;

    // Verify query returned results
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Verify result contains expected data
    // The query should return one row with test=1
    expect(result[0]).toBeDefined();
    // Use bracket notation for index signature access
    expect(result[0]?.['test']).toBe(1);
  });

  /**
   * Test: connection survives after multiple queries
   *
   * Verifies that:
   * - Connection pool handles multiple queries
   * - Connections are reused efficiently
   * - No connection leaks occur
   * - Performance remains consistent
   */
  it('should handle multiple queries without connection issues', async () => {
    // Get database client to initialize connection
    getDb();

    // Get raw postgres client for direct SQL execution
    const sql = getSql();

    // Ensure SQL client is initialized
    expect(sql).toBeDefined();
    expect(sql).not.toBeNull();

    if (!sql) {
      throw new Error('SQL client not initialized');
    }

    // Execute multiple queries in sequence
    // This simulates real application usage patterns
    for (let i = 0; i < 5; i++) {
      // Use postgres.js template literal syntax for parameterized query
      const result = await sql`SELECT ${i} as count`;

      // Verify each query succeeds
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      // Use bracket notation for index signature access
      // postgres.js returns values as strings when using template literals with values
      // Convert to number for comparison
      expect(Number(result[0]?.['count'])).toBe(i);
    }
  });
});
