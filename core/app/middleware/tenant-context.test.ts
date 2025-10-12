/**
 * Tenant Context Middleware Tests
 *
 * These tests verify Row Level Security (RLS) tenant isolation.
 * They use a real database connection to validate that:
 * - Tenant context can be set and retrieved correctly
 * - RLS policies enforce tenant-based data isolation
 * - Different tenants cannot access each other's data
 * - Clearing tenant context works properly
 *
 * Test Strategy:
 * 1. Use actual database (not mocks) to verify real RLS behavior
 * 2. Insert test data for multiple tenants
 * 3. Switch tenant context and verify isolation
 * 4. Clean up test data after each test
 *
 * Important:
 * - These tests require PostgreSQL to be running
 * - RLS policies must be applied to the database
 * - Tests run sequentially to avoid context leakage
 * - No mocks - we test the actual RLS functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setTenantContext,
  clearTenantContext,
  getCurrentTenantContext,
} from './tenant-context';
import { getDb, closeDb } from '../../db/connection';
import { tenants, developers } from '../../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Test Suite: Tenant Context Basic Operations
 *
 * Tests basic functionality of setTenantContext and clearTenantContext
 * without involving database queries (unit-level tests).
 */
describe('Tenant Context - Basic Operations', () => {
  // Clean up tenant context after each test to prevent leakage
  afterEach(async () => {
    await clearTenantContext();
  });

  it('should set tenant context successfully', async () => {
    // Set tenant context to 'test-tenant-a'
    await setTenantContext('test-tenant-a');

    // Verify context was set correctly
    const currentTenant = await getCurrentTenantContext();
    expect(currentTenant).toBe('test-tenant-a');
  });

  it('should clear tenant context successfully', async () => {
    // Set tenant context first
    await setTenantContext('test-tenant-a');

    // Verify it was set
    let currentTenant = await getCurrentTenantContext();
    expect(currentTenant).toBe('test-tenant-a');

    // Clear tenant context
    await clearTenantContext();

    // Verify it was cleared (should be null)
    currentTenant = await getCurrentTenantContext();
    expect(currentTenant).toBeNull();
  });

  it('should allow switching between tenant contexts', async () => {
    // Set to tenant-a
    await setTenantContext('test-tenant-a');
    let currentTenant = await getCurrentTenantContext();
    expect(currentTenant).toBe('test-tenant-a');

    // Switch to tenant-b
    await setTenantContext('test-tenant-b');
    currentTenant = await getCurrentTenantContext();
    expect(currentTenant).toBe('test-tenant-b');

    // Switch to tenant-c
    await setTenantContext('test-tenant-c');
    currentTenant = await getCurrentTenantContext();
    expect(currentTenant).toBe('test-tenant-c');
  });

  it('should throw error for empty tenant ID', async () => {
    // Attempt to set empty tenant ID
    await expect(setTenantContext('')).rejects.toThrow(
      'Tenant ID cannot be empty'
    );

    // Attempt to set whitespace-only tenant ID
    await expect(setTenantContext('   ')).rejects.toThrow(
      'Tenant ID cannot be empty'
    );
  });

  it('should return null when no tenant context is set', async () => {
    // Ensure no context is set
    await clearTenantContext();

    // Get current context (should be null)
    const currentTenant = await getCurrentTenantContext();
    expect(currentTenant).toBeNull();
  });
});

/**
 * Test Suite: RLS Tenant Isolation with Actual Database
 *
 * Tests that PostgreSQL RLS policies correctly isolate data between tenants.
 * These are integration tests that verify end-to-end tenant isolation.
 *
 * Test Data Structure:
 * - Tenant A: Has 2 developers (Alice, Bob)
 * - Tenant B: Has 2 developers (Charlie, David)
 * - Tenant C: Has 1 developer (Eve)
 *
 * Expected Behavior:
 * - When context = 'test-tenant-a', only Alice and Bob are visible
 * - When context = 'test-tenant-b', only Charlie and David are visible
 * - When context = 'test-tenant-c', only Eve is visible
 * - When context is null, no developers are visible (fail-safe)
 */
describe('RLS Tenant Isolation - Integration Tests', () => {
  const db = getDb();

  // Test tenant IDs
  const TENANT_A = 'test-tenant-a';
  const TENANT_B = 'test-tenant-b';
  const TENANT_C = 'test-tenant-c';

  /**
   * Before each test: Set up test data
   *
   * Creates tenants and developers for testing isolation.
   * We need to disable RLS temporarily to insert test data across all tenants.
   */
  beforeEach(async () => {
    // Clear any existing tenant context
    await clearTenantContext();

    // Insert test tenants
    // Note: We need to set tenant context for each tenant to insert data
    // due to RLS policies. We'll insert one tenant at a time.

    // Insert tenant-a
    await setTenantContext(TENANT_A);
    await db
      .insert(tenants)
      .values({
        tenantId: TENANT_A,
        name: 'Test Tenant A',
        plan: 'OSS',
      })
      .onConflictDoNothing(); // Ignore if already exists

    // Insert developers for tenant-a
    await db.insert(developers).values([
      {
        tenantId: TENANT_A,
        displayName: 'Alice (Tenant A)',
        primaryEmail: 'alice@tenant-a.test',
      },
      {
        tenantId: TENANT_A,
        displayName: 'Bob (Tenant A)',
        primaryEmail: 'bob@tenant-a.test',
      },
    ]);

    // Insert tenant-b
    await setTenantContext(TENANT_B);
    await db
      .insert(tenants)
      .values({
        tenantId: TENANT_B,
        name: 'Test Tenant B',
        plan: 'OSS',
      })
      .onConflictDoNothing();

    // Insert developers for tenant-b
    await db.insert(developers).values([
      {
        tenantId: TENANT_B,
        displayName: 'Charlie (Tenant B)',
        primaryEmail: 'charlie@tenant-b.test',
      },
      {
        tenantId: TENANT_B,
        displayName: 'David (Tenant B)',
        primaryEmail: 'david@tenant-b.test',
      },
    ]);

    // Insert tenant-c
    await setTenantContext(TENANT_C);
    await db
      .insert(tenants)
      .values({
        tenantId: TENANT_C,
        name: 'Test Tenant C',
        plan: 'OSS',
      })
      .onConflictDoNothing();

    // Insert developers for tenant-c
    await db.insert(developers).values([
      {
        tenantId: TENANT_C,
        displayName: 'Eve (Tenant C)',
        primaryEmail: 'eve@tenant-c.test',
      },
    ]);

    // Clear context after setup
    await clearTenantContext();
  });

  /**
   * After each test: Clean up test data
   *
   * Removes all test data to ensure tests don't interfere with each other.
   */
  afterEach(async () => {
    // Clean up test data for each tenant
    // We need to set tenant context to delete tenant-specific data

    await setTenantContext(TENANT_A);
    await db.delete(developers).where(eq(developers.tenantId, TENANT_A));
    await db.delete(tenants).where(eq(tenants.tenantId, TENANT_A));

    await setTenantContext(TENANT_B);
    await db.delete(developers).where(eq(developers.tenantId, TENANT_B));
    await db.delete(tenants).where(eq(tenants.tenantId, TENANT_B));

    await setTenantContext(TENANT_C);
    await db.delete(developers).where(eq(developers.tenantId, TENANT_C));
    await db.delete(tenants).where(eq(tenants.tenantId, TENANT_C));

    // Clear tenant context
    await clearTenantContext();
  });

  // Clean up database connection after all tests
  afterAll(async () => {
    await closeDb();
  });

  it('should only return developers for tenant-a when context is tenant-a', async () => {
    // Set tenant context to tenant-a
    await setTenantContext(TENANT_A);

    // Query all developers (RLS should filter to tenant-a only)
    const results = await db.select().from(developers);

    // Verify we got exactly 2 developers
    expect(results).toHaveLength(2);

    // Verify all results belong to tenant-a
    expect(results.every((d: typeof developers.$inferSelect) => d.tenantId === TENANT_A)).toBe(true);

    // Verify we got Alice and Bob (not Charlie, David, or Eve)
    const names = results.map((d: typeof developers.$inferSelect) => d.displayName).sort();
    expect(names).toEqual(['Alice (Tenant A)', 'Bob (Tenant A)']);
  });

  it('should only return developers for tenant-b when context is tenant-b', async () => {
    // Set tenant context to tenant-b
    await setTenantContext(TENANT_B);

    // Query all developers (RLS should filter to tenant-b only)
    const results = await db.select().from(developers);

    // Verify we got exactly 2 developers
    expect(results).toHaveLength(2);

    // Verify all results belong to tenant-b
    expect(results.every((d: typeof developers.$inferSelect) => d.tenantId === TENANT_B)).toBe(true);

    // Verify we got Charlie and David (not Alice, Bob, or Eve)
    const names = results.map((d: typeof developers.$inferSelect) => d.displayName).sort();
    expect(names).toEqual(['Charlie (Tenant B)', 'David (Tenant B)']);
  });

  it('should only return developers for tenant-c when context is tenant-c', async () => {
    // Set tenant context to tenant-c
    await setTenantContext(TENANT_C);

    // Query all developers (RLS should filter to tenant-c only)
    const results = await db.select().from(developers);

    // Verify we got exactly 1 developer
    expect(results).toHaveLength(1);

    // TypeScript guard: At this point, results[0] is guaranteed to exist (length === 1)
    const firstResult = results[0];
    if (!firstResult) {
      throw new Error('Expected exactly 1 result but got undefined');
    }

    // Verify result belongs to tenant-c
    expect(firstResult.tenantId).toBe(TENANT_C);

    // Verify we got Eve (not Alice, Bob, Charlie, or David)
    expect(firstResult.displayName).toBe('Eve (Tenant C)');
  });

  it('should not access data from other tenants (cross-tenant isolation test)', async () => {
    // Set context to tenant-a
    await setTenantContext(TENANT_A);
    const resultsA = await db.select().from(developers);

    // Verify tenant-a has no developers from tenant-b
    const hasAnyTenantBData = resultsA.some((d: typeof developers.$inferSelect) => d.tenantId === TENANT_B);
    expect(hasAnyTenantBData).toBe(false);

    // Verify tenant-a has no developers from tenant-c
    const hasAnyTenantCData = resultsA.some((d: typeof developers.$inferSelect) => d.tenantId === TENANT_C);
    expect(hasAnyTenantCData).toBe(false);

    // Switch to tenant-b
    await setTenantContext(TENANT_B);
    const resultsB = await db.select().from(developers);

    // Verify tenant-b has no developers from tenant-a
    const hasAnyTenantAData = resultsB.some((d: typeof developers.$inferSelect) => d.tenantId === TENANT_A);
    expect(hasAnyTenantAData).toBe(false);

    // Verify tenant-b has no developers from tenant-c
    const hasAnyTenantCDataInB = resultsB.some((d: typeof developers.$inferSelect) => d.tenantId === TENANT_C);
    expect(hasAnyTenantCDataInB).toBe(false);
  });

  it('should return empty results when tenant context is not set (fail-safe)', async () => {
    // Ensure tenant context is cleared
    await clearTenantContext();

    // Verify context is null
    const currentTenant = await getCurrentTenantContext();
    expect(currentTenant).toBeNull();

    // Query developers without tenant context
    // RLS should block access (fail-safe behavior)
    const results = await db.select().from(developers);

    // Verify we got zero results (fail-safe: block all access)
    expect(results).toHaveLength(0);
  });

  it('should properly switch between tenant contexts without data leakage', async () => {
    // Start with tenant-a
    await setTenantContext(TENANT_A);
    let results = await db.select().from(developers);
    expect(results).toHaveLength(2);
    expect(results.every((d: typeof developers.$inferSelect) => d.tenantId === TENANT_A)).toBe(true);

    // Switch to tenant-b
    await setTenantContext(TENANT_B);
    results = await db.select().from(developers);
    expect(results).toHaveLength(2);
    expect(results.every((d: typeof developers.$inferSelect) => d.tenantId === TENANT_B)).toBe(true);

    // Switch to tenant-c
    await setTenantContext(TENANT_C);
    results = await db.select().from(developers);
    expect(results).toHaveLength(1);
    if (!results[0]) {
      throw new Error('Expected exactly 1 result but got undefined');
    }
    expect(results[0].tenantId).toBe(TENANT_C);

    // Switch back to tenant-a
    await setTenantContext(TENANT_A);
    results = await db.select().from(developers);
    expect(results).toHaveLength(2);
    expect(results.every((d: typeof developers.$inferSelect) => d.tenantId === TENANT_A)).toBe(true);
  });

  it('should support querying with WHERE clause combined with RLS', async () => {
    // Set context to tenant-a
    await setTenantContext(TENANT_A);

    // Query with additional WHERE clause for specific developer
    const results = await db
      .select()
      .from(developers)
      .where(eq(developers.displayName, 'Alice (Tenant A)'));

    // Verify we got exactly 1 developer (Alice)
    expect(results).toHaveLength(1);
    if (!results[0]) {
      throw new Error('Expected exactly 1 result but got undefined');
    }
    expect(results[0].displayName).toBe('Alice (Tenant A)');
    expect(results[0].tenantId).toBe(TENANT_A);
  });
});
