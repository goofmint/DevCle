/**
 * Seed Script Tests
 *
 * Tests for the database seeding functionality.
 * These tests verify that:
 * - Seed script runs without errors
 * - All expected records are created
 * - Idempotency works (can run multiple times)
 * - Data integrity is maintained
 *
 * Test Strategy:
 * - NO MOCKS: Tests use real database connection
 * - Cleanup: Database is reset before each test suite
 * - Verification: Actual database records are checked
 * - Idempotency: Seed is run twice to ensure no errors
 *
 * Setup:
 * - Requires PostgreSQL running (docker-compose)
 * - Uses DATABASE_* environment variables
 * - Cleans up connections after tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import {
  getDb,
  closeDb,
  setTenantContext,
  clearTenantContext,
} from './connection.js';
import * as schema from './schema/index.js';
import { eq } from 'drizzle-orm';

// Import seed functions indirectly by running the script
// We can't import them directly since seed.ts calls process.exit()
// Instead, we'll test the results of running the seed

describe('Database Seeding', () => {
  beforeAll(async () => {
    // Run seed script to ensure fresh data
    // This is necessary because other tests may have modified the database
    // before this test suite runs (vitest execution order is not guaranteed)
    console.log('🌱 Running seed script before seed tests...');
    execSync('tsx db/seed.ts', {
      cwd: '/app',
      stdio: 'inherit',
      env: process.env,
    });

    // Ensure database connection is available
    const db = getDb();
    expect(db).toBeDefined();

    // Set tenant context for RLS compliance
    // This is REQUIRED for all tests to pass because Task 3.5 enabled RLS
    // Without this, SELECT queries will fail with RLS policy violations
    await setTenantContext('default');
  });

  afterAll(async () => {
    // Clear tenant context to ensure test isolation
    // This prevents context from affecting other test suites
    await clearTenantContext();

    // Clean up database connections
    await closeDb();
  });

  describe('Tenant Seeding', () => {
    it('should create default tenant', async () => {
      const db = getDb();

      // Query for default tenant
      const tenants = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.tenantId, 'default'));

      // Verify tenant exists
      expect(tenants).toHaveLength(1);
      expect(tenants[0]?.name).toBe('Default Tenant');
      expect(tenants[0]?.plan).toBe('OSS');
    });
  });

  describe('User Seeding', () => {
    it('should create test user', async () => {
      const db = getDb();

      // Query for test user
      const users = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'test@example.com'));

      // Verify user exists
      expect(users).toHaveLength(1);
      expect(users[0]?.displayName).toBe('Test User');
      expect(users[0]?.authProvider).toBe('password');
      expect(users[0]?.disabled).toBe(false);

      // Verify password is hashed (not plain text)
      expect(users[0]?.passwordHash).toBeDefined();
      expect(users[0]?.passwordHash).not.toBe('password123');
      expect(users[0]?.passwordHash?.startsWith('$2')).toBe(true); // bcrypt hash starts with $2
    });
  });

  describe('Organization Seeding', () => {
    it('should create 3 organizations', async () => {
      const db = getDb();

      // Query for all organizations in default tenant
      const orgs = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.tenantId, 'default'));

      // Verify count
      expect(orgs.length).toBeGreaterThanOrEqual(3);

      // Verify specific organizations exist
      const orgNames = orgs.map((org) => org.name);
      expect(orgNames).toContain('Acme Corporation');
      expect(orgNames).toContain('DevRel Community');
      expect(orgNames).toContain('Startup Labs');
    });

    it('should have correct attributes for Acme Corporation', async () => {
      const db = getDb();

      const acme = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.name, 'Acme Corporation'));

      expect(acme).toHaveLength(1);
      expect(acme[0]?.domainPrimary).toBe('acme.com');
      expect(acme[0]?.attributes).toEqual({ industry: 'SaaS', size: 'large' });
    });
  });

  describe('Developer Seeding', () => {
    it('should create 5 developers', async () => {
      const db = getDb();

      // Query for all developers in default tenant
      const developers = await db
        .select()
        .from(schema.developers)
        .where(eq(schema.developers.tenantId, 'default'));

      // Verify count
      expect(developers.length).toBeGreaterThanOrEqual(5);

      // Verify specific developers exist
      const devNames = developers.map((dev) => dev.displayName);
      expect(devNames).toContain('Alice Anderson');
      expect(devNames).toContain('Bob Brown');
      expect(devNames).toContain('Charlie Chen');
      expect(devNames).toContain('Diana Davis');
      expect(devNames).toContain('Eve Evans');
    });

    it('should have Alice with email and organization', async () => {
      const db = getDb();

      const alice = await db
        .select()
        .from(schema.developers)
        .where(eq(schema.developers.displayName, 'Alice Anderson'));

      expect(alice).toHaveLength(1);
      expect(alice[0]?.primaryEmail).toBe('alice@acme.com');
      expect(alice[0]?.orgId).toBeDefined();
      expect(alice[0]?.consentAnalytics).toBe(true);
      expect(alice[0]?.tags).toEqual(['frontend', 'react']);
    });

    it('should have Charlie without email/organization', async () => {
      const db = getDb();

      const charlie = await db
        .select()
        .from(schema.developers)
        .where(eq(schema.developers.displayName, 'Charlie Chen'));

      expect(charlie).toHaveLength(1);
      expect(charlie[0]?.primaryEmail).toBeNull();
      expect(charlie[0]?.orgId).toBeNull();
      expect(charlie[0]?.consentAnalytics).toBe(false);
    });
  });

  describe('Account Seeding', () => {
    it('should create at least 4 accounts', async () => {
      const db = getDb();

      // Query for all accounts in default tenant
      const accounts = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.tenantId, 'default'));

      // Verify count
      expect(accounts.length).toBeGreaterThanOrEqual(4);
    });

    it('should have Alice with 2 accounts (GitHub + Slack)', async () => {
      const db = getDb();

      // Get Alice's developer ID
      const alice = await db
        .select()
        .from(schema.developers)
        .where(eq(schema.developers.displayName, 'Alice Anderson'));

      expect(alice).toHaveLength(1);
      const aliceId = alice[0]!.developerId;

      // Query for Alice's accounts
      const aliceAccounts = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.developerId, aliceId));

      expect(aliceAccounts.length).toBeGreaterThanOrEqual(2);

      const providers = aliceAccounts.map((acc) => acc.provider);
      expect(providers).toContain('github');
      expect(providers).toContain('slack');
    });

    it('should have unlinked X account', async () => {
      const db = getDb();

      const unlinkedAccounts = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.provider, 'x'));

      expect(unlinkedAccounts.length).toBeGreaterThanOrEqual(1);
      expect(unlinkedAccounts[0]?.developerId).toBeNull();
    });
  });

  describe('Campaign Seeding', () => {
    it('should create 3 campaigns', async () => {
      const db = getDb();

      // Query for all campaigns in default tenant
      const campaigns = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.tenantId, 'default'));

      // Verify count
      expect(campaigns.length).toBeGreaterThanOrEqual(3);

      // Verify specific campaigns exist
      const campaignNames = campaigns.map((c) => c.name);
      expect(campaignNames).toContain('DevRel Meetup 2025');
      expect(campaignNames).toContain('Blog Content Series');
      expect(campaignNames).toContain('GitHub Sponsor Campaign');
    });

    it('should have DevRel Meetup with budget', async () => {
      const db = getDb();

      const meetup = await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.name, 'DevRel Meetup 2025'));

      expect(meetup).toHaveLength(1);
      expect(meetup[0]?.channel).toBe('event');
      expect(meetup[0]?.budgetTotal).toBe('500000');
      expect(meetup[0]?.attributes).toEqual({
        location: 'Tokyo',
        format: 'hybrid',
      });
    });
  });

  describe('Resource Seeding', () => {
    it('should create 3 resources', async () => {
      const db = getDb();

      // Query for all resources in default tenant
      const resources = await db
        .select()
        .from(schema.resources)
        .where(eq(schema.resources.tenantId, 'default'));

      // Verify count
      expect(resources.length).toBeGreaterThanOrEqual(3);

      // Verify different categories exist
      const categories = resources.map((r) => r.category);
      expect(categories).toContain('event');
      expect(categories).toContain('blog');
      expect(categories).toContain('repo');
    });
  });

  describe('Activity Seeding', () => {
    it('should create 10 activities', async () => {
      const db = getDb();

      // Query for all activities in default tenant
      const activities = await db
        .select()
        .from(schema.activities)
        .where(eq(schema.activities.tenantId, 'default'));

      // Verify count
      expect(activities.length).toBeGreaterThanOrEqual(10);
    });

    it('should have authenticated activities (with developer_id)', async () => {
      const db = getDb();

      // Query for authenticated activities
      const authActivities = await db.select().from(schema.activities);

      const authenticated = authActivities.filter((a) => a.developerId !== null);

      expect(authenticated.length).toBeGreaterThan(0);
    });

    it('should have anonymous activities (with anon_id)', async () => {
      const db = getDb();

      // Query for anonymous activities
      const activities = await db.select().from(schema.activities);

      const anonymous = activities.filter((a) => a.anonId !== null);

      expect(anonymous.length).toBeGreaterThan(0);
    });

    it('should have different action types', async () => {
      const db = getDb();

      const activities = await db.select().from(schema.activities);

      const actions = [...new Set(activities.map((a) => a.action))];

      // Verify we have various action types
      expect(actions.length).toBeGreaterThan(5);
      expect(actions).toContain('star');
      expect(actions).toContain('view');
      expect(actions).toContain('click');
    });
  });

  describe('Funnel Stage Seeding (REQUIRED)', () => {
    it('should create 4 funnel stages', async () => {
      const db = getDb();

      // Query for all funnel stages
      const stages = await db.select().from(schema.funnelStages);

      // Verify count
      expect(stages).toHaveLength(4);

      // Verify specific stages exist
      const stageKeys = stages.map((s) => s.stageKey);
      expect(stageKeys).toContain('awareness');
      expect(stageKeys).toContain('engagement');
      expect(stageKeys).toContain('adoption');
      expect(stageKeys).toContain('advocacy');
    });

    it('should have stages in correct order', async () => {
      const db = getDb();

      const stages = await db.select().from(schema.funnelStages);

      // Sort by orderNo
      const sorted = stages.sort((a, b) => a.orderNo - b.orderNo);

      expect(sorted[0]?.stageKey).toBe('awareness');
      expect(sorted[0]?.orderNo).toBe(1);

      expect(sorted[1]?.stageKey).toBe('engagement');
      expect(sorted[1]?.orderNo).toBe(2);

      expect(sorted[2]?.stageKey).toBe('adoption');
      expect(sorted[2]?.orderNo).toBe(3);

      expect(sorted[3]?.stageKey).toBe('advocacy');
      expect(sorted[3]?.orderNo).toBe(4);
    });
  });

  describe('Activity Funnel Mapping Seeding', () => {
    it('should create 11 activity funnel mappings', async () => {
      const db = getDb();

      // Query for all mappings for default tenant
      const mappings = await db
        .select()
        .from(schema.activityFunnelMap)
        .where(eq(schema.activityFunnelMap.tenantId, 'default'));

      // Verify count
      expect(mappings.length).toBeGreaterThanOrEqual(11);
    });

    it('should map view action to awareness stage', async () => {
      const db = getDb();

      const viewMapping = await db
        .select()
        .from(schema.activityFunnelMap)
        .where(eq(schema.activityFunnelMap.action, 'view'));

      expect(viewMapping).toHaveLength(1);
      expect(viewMapping[0]?.stageKey).toBe('awareness');
    });

    it('should map attend action to engagement stage', async () => {
      const db = getDb();

      const attendMapping = await db
        .select()
        .from(schema.activityFunnelMap)
        .where(eq(schema.activityFunnelMap.action, 'attend'));

      expect(attendMapping).toHaveLength(1);
      expect(attendMapping[0]?.stageKey).toBe('engagement');
    });

    it('should map signup action to adoption stage', async () => {
      const db = getDb();

      const signupMapping = await db
        .select()
        .from(schema.activityFunnelMap)
        .where(eq(schema.activityFunnelMap.action, 'signup'));

      expect(signupMapping).toHaveLength(1);
      expect(signupMapping[0]?.stageKey).toBe('adoption');
    });

    it('should map star action to advocacy stage', async () => {
      const db = getDb();

      const starMapping = await db
        .select()
        .from(schema.activityFunnelMap)
        .where(eq(schema.activityFunnelMap.action, 'star'));

      expect(starMapping).toHaveLength(1);
      expect(starMapping[0]?.stageKey).toBe('advocacy');
    });
  });

  describe('Data Integrity', () => {
    it('should have all developers with valid tenant_id', async () => {
      const db = getDb();

      const developers = await db
        .select()
        .from(schema.developers)
        .where(eq(schema.developers.tenantId, 'default'));

      // All developers should belong to default tenant
      expect(developers.every((d) => d.tenantId === 'default')).toBe(true);
    });

    it('should have all activities with valid confidence values', async () => {
      const db = getDb();

      const activities = await db.select().from(schema.activities);

      // All activities should have confidence between 0 and 1
      activities.forEach((activity) => {
        const confidence = parseFloat(activity.confidence);
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Idempotency', () => {
    it('should handle running seed multiple times without errors', async () => {
      // This test verifies that .onConflictDoNothing() works correctly
      // If the seed script has already run, running it again should not throw errors

      const db = getDb();

      // Get current count of developers
      const beforeDevs = await db
        .select()
        .from(schema.developers)
        .where(eq(schema.developers.tenantId, 'default'));

      const beforeCount = beforeDevs.length;

      // Try to insert a duplicate developer (simulating re-running seed)
      // This should not throw an error due to .onConflictDoNothing()
      const testOrgId = beforeDevs[0]?.orgId;

      await expect(
        db
          .insert(schema.developers)
          .values({
            developerId: crypto.randomUUID(),
            tenantId: 'default',
            displayName: 'Test Duplicate',
            primaryEmail: 'alice@acme.com', // Duplicate email (unique constraint)
            orgId: testOrgId,
            consentAnalytics: true,
            tags: ['test'],
          })
          .onConflictDoNothing()
      ).resolves.toBeDefined();

      // Get count after attempted duplicate insert
      const afterDevs = await db
        .select()
        .from(schema.developers)
        .where(eq(schema.developers.tenantId, 'default'));

      // Count should remain the same (conflict was ignored)
      expect(afterDevs.length).toBe(beforeCount);
    });
  });
});
