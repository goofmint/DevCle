/**
 * Funnel Drop Rate Service Tests
 *
 * Tests for drop rate calculation and time series aggregation:
 * - calculateDropRate(): Single stage drop rate calculation
 * - getFunnelDropRates(): All stages drop rate calculation
 * - getFunnelTimeSeries(): Time series aggregation
 */

import { describe, it, expect, afterAll } from 'vitest';
import { setTenantContext, closeDb, getDb } from '../db/connection';
import * as schema from '../db/schema/index';
import { eq } from 'drizzle-orm';
import {
  calculateDropRate,
  getFunnelDropRates,
  getFunnelTimeSeries,
} from './funnel.service';
import { createActivity } from './activity.service';

describe('Funnel Drop Rate Service', () => {
  // Use dedicated test tenant to avoid conflicts with seed data
  const TEST_TENANT = 'test-funnel-droprate';
  const OTHER_TEST_TENANT = 'test-funnel-droprate-other';

  // Clean up after all tests
  afterAll(async () => {
    await closeDb();
  });

  // Helper function to create test developers
  async function createTestDevelopers() {
    const db = getDb();

    // Ensure test tenants exist
    await db.insert(schema.tenants).values({
      tenantId: TEST_TENANT,
      name: 'Test Funnel Drop Rate Tenant',
      plan: 'OSS',
    }).onConflictDoNothing();

    await db.insert(schema.tenants).values({
      tenantId: OTHER_TEST_TENANT,
      name: 'Other Test Funnel Drop Rate Tenant',
      plan: 'OSS',
    }).onConflictDoNothing();

    await setTenantContext(TEST_TENANT);
    const [alice] = await db.insert(schema.developers).values({
      developerId: crypto.randomUUID(),
      tenantId: TEST_TENANT,
      displayName: 'Alice Anderson',
      primaryEmail: 'alice@example.com',
      orgId: null,
      consentAnalytics: true,
      tags: [],
    }).returning();

    const [bob] = await db.insert(schema.developers).values({
      developerId: crypto.randomUUID(),
      tenantId: TEST_TENANT,
      displayName: 'Bob Builder',
      primaryEmail: 'bob@example.com',
      orgId: null,
      consentAnalytics: true,
      tags: [],
    }).returning();

    await setTenantContext(OTHER_TEST_TENANT);
    const [charlie] = await db.insert(schema.developers).values({
      developerId: crypto.randomUUID(),
      tenantId: OTHER_TEST_TENANT,
      displayName: 'Charlie Chaplin',
      primaryEmail: 'charlie@example.com',
      orgId: null,
      consentAnalytics: true,
      tags: [],
    }).returning();

    await setTenantContext(TEST_TENANT);

    if (!alice || !bob || !charlie) {
      throw new Error('Failed to create test developers');
    }

    // Create activity-funnel mappings for test tenant (copy from default tenant mappings)
    // This ensures classifyStage can properly map activities to funnel stages
    await db.insert(schema.activityFunnelMap).values([
      { tenantId: TEST_TENANT, action: 'click', stageKey: 'awareness' },
      { tenantId: TEST_TENANT, action: 'view', stageKey: 'awareness' },
      { tenantId: TEST_TENANT, action: 'attend', stageKey: 'engagement' },
      { tenantId: TEST_TENANT, action: 'comment', stageKey: 'engagement' },
      { tenantId: TEST_TENANT, action: 'signup', stageKey: 'adoption' },
      { tenantId: TEST_TENANT, action: 'api_call', stageKey: 'adoption' },
      { tenantId: TEST_TENANT, action: 'deploy', stageKey: 'adoption' },
      { tenantId: TEST_TENANT, action: 'post', stageKey: 'advocacy' },
      { tenantId: TEST_TENANT, action: 'talk', stageKey: 'advocacy' },
      { tenantId: TEST_TENANT, action: 'referral', stageKey: 'advocacy' },
      { tenantId: TEST_TENANT, action: 'contribute', stageKey: 'advocacy' },
    ]).onConflictDoNothing();

    return {
      alice: alice.developerId,
      bob: bob.developerId,
      charlie: charlie.developerId,
    };
  }

  // Helper function to clean up test developers and their data
  async function cleanupTestDevelopers(aliceId: string, bobId: string, charlieId: string) {
    const db = getDb();

    // Delete activities
    await setTenantContext(TEST_TENANT);
    await db.delete(schema.activities).where(eq(schema.activities.developerId, aliceId));
    await db.delete(schema.activities).where(eq(schema.activities.developerId, bobId));

    await setTenantContext(OTHER_TEST_TENANT);
    await db.delete(schema.activities).where(eq(schema.activities.developerId, charlieId));

    // Delete developers
    await setTenantContext(TEST_TENANT);
    await db.delete(schema.developers).where(eq(schema.developers.developerId, aliceId));
    await db.delete(schema.developers).where(eq(schema.developers.developerId, bobId));

    await setTenantContext(OTHER_TEST_TENANT);
    await db.delete(schema.developers).where(eq(schema.developers.developerId, charlieId));

    await setTenantContext(TEST_TENANT);
  }

  /**
   * calculateDropRate() Tests
   *
   * Tests drop rate calculation for a single funnel stage.
   */
  describe('calculateDropRate', () => {
    it('should throw error for awareness stage', async () => {
      await expect(
        calculateDropRate(TEST_TENANT, 'awareness')
      ).rejects.toThrow('Cannot calculate drop rate for awareness stage');
    });

    it('should return null for non-existent stage', async () => {
      const dropRate = await calculateDropRate(TEST_TENANT, 'non-existent' as any);
      expect(dropRate).toBeNull();
    });

    it('should calculate drop rate for engagement stage correctly', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        // Create test data: Awareness = 2, Engagement = 1
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'attend',
          source: 'event',
          occurredAt: new Date('2025-10-10T11:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T12:00:00Z'),
          metadata: {},
        });

        const dropRate = await calculateDropRate(TEST_TENANT, 'engagement');

        expect(dropRate).not.toBeNull();
        expect(dropRate?.stageKey).toBe('engagement');
        expect(dropRate?.uniqueDevelopers).toBe(1);
        expect(dropRate?.previousStageCount).toBe(2);
        expect(dropRate?.dropRate).toBeCloseTo(50, 1);
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    it('should calculate drop rate for adoption stage correctly', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'attend',
          source: 'event',
          occurredAt: new Date('2025-10-10T11:00:00Z'),
          metadata: {},
        });

        const dropRate = await calculateDropRate(TEST_TENANT, 'adoption');

        expect(dropRate).not.toBeNull();
        expect(dropRate?.stageKey).toBe('adoption');
        expect(dropRate?.uniqueDevelopers).toBe(0);
        expect(dropRate?.previousStageCount).toBe(1);
        expect(dropRate?.dropRate).toBe(100);
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    it('should return null for drop rate when previous stage has 0 developers', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        const dropRate = await calculateDropRate(TEST_TENANT, 'advocacy');

        expect(dropRate).not.toBeNull();
        expect(dropRate?.dropRate).toBeNull();
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    it('should respect tenant isolation', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'attend',
          source: 'event',
          occurredAt: new Date('2025-10-10T11:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T12:00:00Z'),
          metadata: {},
        });

        await setTenantContext(OTHER_TEST_TENANT);
        await createActivity(OTHER_TEST_TENANT, {
          developerId: charlie,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T14:00:00Z'),
          metadata: {},
        });
        await setTenantContext(TEST_TENANT);

        const dropRate = await calculateDropRate(TEST_TENANT, 'engagement');

        expect(dropRate?.uniqueDevelopers).toBe(1);
        expect(dropRate?.previousStageCount).toBe(2);
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });
  });

  /**
   * getFunnelDropRates() Tests
   *
   * Tests drop rate calculation for all funnel stages.
   */
  describe('getFunnelDropRates', () => {
    it('should calculate drop rates for all stages correctly', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'attend',
          source: 'event',
          occurredAt: new Date('2025-10-10T11:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'signup',
          source: 'web',
          occurredAt: new Date('2025-10-10T12:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T13:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'attend',
          source: 'event',
          occurredAt: new Date('2025-10-10T14:00:00Z'),
          metadata: {},
        });

        const dropRates = await getFunnelDropRates(TEST_TENANT);

        expect(dropRates.stages).toHaveLength(4);
        expect(dropRates.stages[0]?.dropRate).toBeNull();
        expect(dropRates.stages[1]?.dropRate).toBeCloseTo(0, 1);
        expect(dropRates.stages[2]?.dropRate).toBeCloseTo(50, 1);
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

  // Test 8: getFunnelDropRates - calculate overall conversion rate correctly
    it('should calculate overall conversion rate correctly', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T13:00:00Z'),
          metadata: {},
        });

        const dropRates = await getFunnelDropRates(TEST_TENANT);

        expect(dropRates.overallConversionRate).toBe(0);
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    // Test 9: getFunnelDropRates - set dropRate to null for awareness stage
    it('should set dropRate to null for awareness stage', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        const dropRates = await getFunnelDropRates(TEST_TENANT);

        const awareness = dropRates.stages.find(s => s.stageKey === 'awareness');
        expect(awareness?.dropRate).toBeNull();
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    // Test 10: getFunnelDropRates - respect tenant isolation
    it('should respect tenant isolation in getFunnelDropRates', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });

        await setTenantContext(OTHER_TEST_TENANT);
        await createActivity(OTHER_TEST_TENANT, {
          developerId: charlie,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T16:00:00Z'),
          metadata: {},
        });
        await setTenantContext(TEST_TENANT);

        const dropRates = await getFunnelDropRates(TEST_TENANT);

        const awareness = dropRates.stages.find(s => s.stageKey === 'awareness');
        expect(awareness?.uniqueDevelopers).toBe(1);
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    // Test 11: getFunnelDropRates - handle complete funnel with all stages populated
    it('should handle complete funnel with all stages populated', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'signup',
          source: 'web',
          occurredAt: new Date('2025-10-10T12:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'contribute',
          source: 'github',
          occurredAt: new Date('2025-10-10T17:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T13:00:00Z'),
          metadata: {},
        });

        const dropRates = await getFunnelDropRates(TEST_TENANT);

        const advocacy = dropRates.stages.find(s => s.stageKey === 'advocacy');
        expect(advocacy?.uniqueDevelopers).toBe(1);
        expect(dropRates.overallConversionRate).toBeCloseTo(50, 1);
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });
  });

  /**
   * getFunnelTimeSeries() Tests
   *
   * Tests time series aggregation for funnel analysis.
   */
  describe('getFunnelTimeSeries', () => {
    it('should aggregate data by day granularity', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-11T10:00:00Z'),
          metadata: {},
        });

        const timeSeries = await getFunnelTimeSeries(
          TEST_TENANT,
          new Date('2025-10-10T00:00:00Z'),
          new Date('2025-10-12T00:00:00Z'),
          'day'
        );

        expect(timeSeries.length).toBe(2);
        expect(timeSeries[0]?.date.toISOString()).toContain('2025-10-10');
        expect(timeSeries[1]?.date.toISOString()).toContain('2025-10-11');
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    // Test 13: getFunnelTimeSeries - aggregate data by week granularity
    it('should aggregate data by week granularity', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-11T10:00:00Z'),
          metadata: {},
        });

        const timeSeries = await getFunnelTimeSeries(
          TEST_TENANT,
          new Date('2025-10-01T00:00:00Z'),
          new Date('2025-10-31T00:00:00Z'),
          'week'
        );

        expect(timeSeries.length).toBe(1);
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    // Test 14: getFunnelTimeSeries - aggregate data by month granularity
    it('should aggregate data by month granularity', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-11-10T10:00:00Z'),
          metadata: {},
        });

        const timeSeries = await getFunnelTimeSeries(
          TEST_TENANT,
          new Date('2025-10-01T00:00:00Z'),
          new Date('2025-11-30T00:00:00Z'),
          'month'
        );

        expect(timeSeries.length).toBe(2);
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

  it('should validate date range (fromDate > toDate)', async () => {
    await expect(
      getFunnelTimeSeries(
        TEST_TENANT,
        new Date('2025-10-20T00:00:00Z'),
        new Date('2025-10-10T00:00:00Z'),
        'day'
      )
    ).rejects.toThrow('Invalid date range: fromDate must be on or before toDate');
  });

  it('should reject invalid granularity values (SQL injection prevention)', async () => {
    // Test with a malicious SQL injection attempt
    await expect(
      getFunnelTimeSeries(
        TEST_TENANT,
        new Date('2025-10-10T00:00:00Z'),
        new Date('2025-10-11T00:00:00Z'),
        "day'; DROP TABLE activities; --" as any
      )
    ).rejects.toThrow('Invalid granularity');
  });

  // Test 16: getFunnelTimeSeries - respect tenant isolation
    it('should respect tenant isolation in getFunnelTimeSeries', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });

        await setTenantContext(OTHER_TEST_TENANT);
        await createActivity(OTHER_TEST_TENANT, {
          developerId: charlie,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T11:00:00Z'),
          metadata: {},
        });
        await setTenantContext(TEST_TENANT);

        const timeSeries = await getFunnelTimeSeries(
          TEST_TENANT,
          new Date('2025-10-10T00:00:00Z'),
          new Date('2025-10-11T00:00:00Z'),
          'day'
        );

        expect(timeSeries.length).toBe(1);
        const day1Awareness = timeSeries[0]?.stages.find(s => s.stageKey === 'awareness');
        expect(day1Awareness?.uniqueDevelopers).toBe(1);
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    // Test 17: getFunnelTimeSeries - return empty array when no data in date range
    it('should return empty array when no data in date range', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-09-10T10:00:00Z'),
          metadata: {},
        });

        const timeSeries = await getFunnelTimeSeries(
          TEST_TENANT,
          new Date('2025-10-01T00:00:00Z'),
          new Date('2025-10-31T00:00:00Z'),
          'day'
        );

        expect(timeSeries).toEqual([]);
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    // Test 18: getFunnelTimeSeries - calculate drop rates in time series correctly
    it('should calculate drop rates in time series correctly', async () => {
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:30:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'attend',
          source: 'event',
          occurredAt: new Date('2025-10-10T11:00:00Z'),
          metadata: {},
        });

        const timeSeries = await getFunnelTimeSeries(
          TEST_TENANT,
          new Date('2025-10-10T00:00:00Z'),
          new Date('2025-10-11T00:00:00Z'),
          'day'
        );

        expect(timeSeries.length).toBe(1);
        const awareness = timeSeries[0]?.stages.find(s => s.stageKey === 'awareness');
        expect(awareness?.uniqueDevelopers).toBe(2);
        expect(awareness?.dropRate).toBeNull();

        const engagement = timeSeries[0]?.stages.find(s => s.stageKey === 'engagement');
        expect(engagement?.uniqueDevelopers).toBe(1);
        expect(engagement?.dropRate).toBeCloseTo(50, 1);
      } finally {
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });
  });
});
