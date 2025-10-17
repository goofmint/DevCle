/**
 * Funnel Drop Rate Service Tests
 *
 * Tests for drop rate calculation and time series aggregation:
 * - calculateDropRate(): Single stage drop rate calculation
 * - getFunnelDropRates(): All stages drop rate calculation
 * - getFunnelTimeSeries(): Time series aggregation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setTenantContext, clearTenantContext, closeDb, getDb } from '../db/connection';
import * as schema from '../db/schema/index';
import { eq } from 'drizzle-orm';
import {
  calculateDropRate,
  getFunnelDropRates,
  getFunnelTimeSeries,
} from './funnel.service';
import { createActivity } from './activity.service';

describe('Funnel Drop Rate Service', () => {
  // Set tenant context before all tests
  beforeAll(async () => {
    await setTenantContext('default');
  });

  // Clean up after all tests
  afterAll(async () => {
    await clearTenantContext();
    await closeDb();
  });

  // Developer IDs for testing - track test-created developers for cleanup
  let aliceDeveloperId: string;
  let bobDeveloperId: string;
  let charlieDeveloperId: string;
  let testActivityIds: string[] = [];

  // Create test developers before each test
  // This ensures each test starts with a clean state
  beforeEach(async () => {
    const db = getDb();
    testActivityIds = []; // Reset activity tracking

    // Ensure 'other-tenant' tenant exists (required for foreign key constraint)
    // Use onConflictDoNothing() to make this idempotent
    await db.insert(schema.tenants).values({
      tenantId: 'other-tenant',
      name: 'Other Tenant',
      plan: 'OSS',
    }).onConflictDoNothing();

    // Create test developers for 'default' tenant
    await setTenantContext('default');
    const [alice] = await db.insert(schema.developers).values({
      developerId: crypto.randomUUID(),
      tenantId: 'default',
      displayName: 'Alice Anderson',
      primaryEmail: 'alice@example.com',
      orgId: null,
      consentAnalytics: true,
      tags: [],
    }).returning();

    const [bob] = await db.insert(schema.developers).values({
      developerId: crypto.randomUUID(),
      tenantId: 'default',
      displayName: 'Bob Builder',
      primaryEmail: 'bob@example.com',
      orgId: null,
      consentAnalytics: true,
      tags: [],
    }).returning();

    // Create test developer for 'other-tenant'
    // Switch to other-tenant context to avoid RLS violation
    await setTenantContext('other-tenant');
    const [charlie] = await db.insert(schema.developers).values({
      developerId: crypto.randomUUID(),
      tenantId: 'other-tenant',
      displayName: 'Charlie Chaplin',
      primaryEmail: 'charlie@example.com',
      orgId: null,
      consentAnalytics: true,
      tags: [],
    }).returning();

    // Switch back to default tenant context
    await setTenantContext('default');

    if (!alice || !bob || !charlie) {
      throw new Error('Failed to create test developers');
    }

    aliceDeveloperId = alice.developerId;
    bobDeveloperId = bob.developerId;
    charlieDeveloperId = charlie.developerId;
  });

  // Clean up test data after each test
  // Only delete data created by this test, not seed data
  afterEach(async () => {
    const db = getDb();

    // Delete activities created by test developers
    await setTenantContext('default');
    await db.delete(schema.activities).where(
      eq(schema.activities.developerId, aliceDeveloperId)
    );
    await db.delete(schema.activities).where(
      eq(schema.activities.developerId, bobDeveloperId)
    );

    await setTenantContext('other-tenant');
    await db.delete(schema.activities).where(
      eq(schema.activities.developerId, charlieDeveloperId)
    );

    // Delete test developers
    await setTenantContext('default');
    await db.delete(schema.developers).where(
      eq(schema.developers.developerId, aliceDeveloperId)
    );
    await db.delete(schema.developers).where(
      eq(schema.developers.developerId, bobDeveloperId)
    );

    await setTenantContext('other-tenant');
    await db.delete(schema.developers).where(
      eq(schema.developers.developerId, charlieDeveloperId)
    );

    // Reset to default tenant
    await setTenantContext('default');
  });

  /**
   * calculateDropRate() Tests
   *
   * Tests drop rate calculation for a single funnel stage.
   */
  describe('calculateDropRate', () => {
    it('should throw error for awareness stage', async () => {
      await expect(
        calculateDropRate('default', 'awareness')
      ).rejects.toThrow('Cannot calculate drop rate for awareness stage');
    });

    it('should return null for non-existent stage', async () => {
      const dropRate = await calculateDropRate('default', 'non-existent' as any);
      expect(dropRate).toBeNull();
    });

    it('should calculate drop rate for engagement stage correctly', async () => {
      // Create test data: Awareness = 2, Engagement = 1
      await createActivity('default', {
        developerId: aliceDeveloperId,
        action: 'click',
        source: 'web',
        occurredAt: new Date('2025-10-10T10:00:00Z'),
        metadata: {},
      });
      await createActivity('default', {
        developerId: aliceDeveloperId,
        action: 'attend',
        source: 'event',
        occurredAt: new Date('2025-10-10T11:00:00Z'),
        metadata: {},
      });
      await createActivity('default', {
        developerId: bobDeveloperId,
        action: 'click',
        source: 'web',
        occurredAt: new Date('2025-10-10T12:00:00Z'),
        metadata: {},
      });

      const dropRate = await calculateDropRate('default', 'engagement');

      expect(dropRate).not.toBeNull();
      expect(dropRate?.stageKey).toBe('engagement');
      expect(dropRate?.uniqueDevelopers).toBe(1);
      expect(dropRate?.previousStageCount).toBe(2);
      expect(dropRate?.dropRate).toBeCloseTo(50, 1);
    });

    it('should calculate drop rate for adoption stage correctly', async () => {
      await createActivity('default', {
        developerId: aliceDeveloperId,
        action: 'attend',
        source: 'event',
        occurredAt: new Date('2025-10-10T11:00:00Z'),
        metadata: {},
      });

      const dropRate = await calculateDropRate('default', 'adoption');

      expect(dropRate).not.toBeNull();
      expect(dropRate?.stageKey).toBe('adoption');
      expect(dropRate?.uniqueDevelopers).toBe(0);
      expect(dropRate?.previousStageCount).toBe(1);
      expect(dropRate?.dropRate).toBe(100);
    });

    it('should return null for drop rate when previous stage has 0 developers', async () => {
      const dropRate = await calculateDropRate('default', 'advocacy');

      expect(dropRate).not.toBeNull();
      expect(dropRate?.dropRate).toBeNull();
    });

    it('should respect tenant isolation', async () => {
      await createActivity('default', {
        developerId: aliceDeveloperId,
        action: 'click',
        source: 'web',
        occurredAt: new Date('2025-10-10T10:00:00Z'),
        metadata: {},
      });
      await createActivity('default', {
        developerId: aliceDeveloperId,
        action: 'attend',
        source: 'event',
        occurredAt: new Date('2025-10-10T11:00:00Z'),
        metadata: {},
      });
      await createActivity('default', {
        developerId: bobDeveloperId,
        action: 'click',
        source: 'web',
        occurredAt: new Date('2025-10-10T12:00:00Z'),
        metadata: {},
      });

      await setTenantContext('other-tenant');
      await createActivity('other-tenant', {
        developerId: charlieDeveloperId,
        action: 'click',
        source: 'web',
        occurredAt: new Date('2025-10-10T14:00:00Z'),
        metadata: {},
      });
      await setTenantContext('default');

      const dropRate = await calculateDropRate('default', 'engagement');

      expect(dropRate?.uniqueDevelopers).toBe(1);
      expect(dropRate?.previousStageCount).toBe(2);
    });
  });

  /**
   * getFunnelDropRates() Tests
   *
   * Tests drop rate calculation for all funnel stages.
   */
  describe('getFunnelDropRates', () => {
    it('should calculate drop rates for all stages correctly', async () => {
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T10:00:00Z'),
      metadata: {},
    });
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'attend',
      source: 'event',
      occurredAt: new Date('2025-10-10T11:00:00Z'),
      metadata: {},
    });
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'signup',
      source: 'web',
      occurredAt: new Date('2025-10-10T12:00:00Z'),
      metadata: {},
    });
    await createActivity('default', {
      developerId: bobDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T13:00:00Z'),
      metadata: {},
    });
    await createActivity('default', {
      developerId: bobDeveloperId,
      action: 'attend',
      source: 'event',
      occurredAt: new Date('2025-10-10T14:00:00Z'),
      metadata: {},
    });

    const dropRates = await getFunnelDropRates('default');

    expect(dropRates.stages).toHaveLength(4);
    expect(dropRates.stages[0]?.dropRate).toBeNull();
    expect(dropRates.stages[1]?.dropRate).toBeCloseTo(0, 1);
    expect(dropRates.stages[2]?.dropRate).toBeCloseTo(50, 1);
  });

  // Test 8: getFunnelDropRates - calculate overall conversion rate correctly
  it('should calculate overall conversion rate correctly', async () => {
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T10:00:00Z'),
      metadata: {},
    });
    await createActivity('default', {
      developerId: bobDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T13:00:00Z'),
      metadata: {},
    });

    const dropRates = await getFunnelDropRates('default');

    expect(dropRates.overallConversionRate).toBe(0);
  });

  // Test 9: getFunnelDropRates - set dropRate to null for awareness stage
  it('should set dropRate to null for awareness stage', async () => {
    const dropRates = await getFunnelDropRates('default');

    const awareness = dropRates.stages.find(s => s.stageKey === 'awareness');
    expect(awareness?.dropRate).toBeNull();
  });

  // Test 10: getFunnelDropRates - respect tenant isolation
  it('should respect tenant isolation in getFunnelDropRates', async () => {
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T10:00:00Z'),
      metadata: {},
    });

    await setTenantContext('other-tenant');
    await createActivity('other-tenant', {
      developerId: charlieDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T16:00:00Z'),
      metadata: {},
    });
    await setTenantContext('default');

    const dropRates = await getFunnelDropRates('default');

    const awareness = dropRates.stages.find(s => s.stageKey === 'awareness');
    expect(awareness?.uniqueDevelopers).toBe(1);
  });

  // Test 11: getFunnelDropRates - handle complete funnel with all stages populated
  it('should handle complete funnel with all stages populated', async () => {
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T10:00:00Z'),
      metadata: {},
    });
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'signup',
      source: 'web',
      occurredAt: new Date('2025-10-10T12:00:00Z'),
      metadata: {},
    });
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'contribute',
      source: 'github',
      occurredAt: new Date('2025-10-10T17:00:00Z'),
      metadata: {},
    });
    await createActivity('default', {
      developerId: bobDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T13:00:00Z'),
      metadata: {},
    });

    const dropRates = await getFunnelDropRates('default');

    const advocacy = dropRates.stages.find(s => s.stageKey === 'advocacy');
    expect(advocacy?.uniqueDevelopers).toBe(1);
    expect(dropRates.overallConversionRate).toBeCloseTo(50, 1);
  });
  });

  /**
   * getFunnelTimeSeries() Tests
   *
   * Tests time series aggregation for funnel analysis.
   */
  describe('getFunnelTimeSeries', () => {
    it('should aggregate data by day granularity', async () => {
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T10:00:00Z'),
      metadata: {},
    });
    await createActivity('default', {
      developerId: bobDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-11T10:00:00Z'),
      metadata: {},
    });

    const timeSeries = await getFunnelTimeSeries(
      'default',
      new Date('2025-10-10T00:00:00Z'),
      new Date('2025-10-12T00:00:00Z'),
      'day'
    );

    expect(timeSeries.length).toBe(2);
    expect(timeSeries[0]?.date.toISOString()).toContain('2025-10-10');
    expect(timeSeries[1]?.date.toISOString()).toContain('2025-10-11');
  });

  // Test 13: getFunnelTimeSeries - aggregate data by week granularity
  it('should aggregate data by week granularity', async () => {
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T10:00:00Z'),
      metadata: {},
    });
    await createActivity('default', {
      developerId: bobDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-11T10:00:00Z'),
      metadata: {},
    });

    const timeSeries = await getFunnelTimeSeries(
      'default',
      new Date('2025-10-01T00:00:00Z'),
      new Date('2025-10-31T00:00:00Z'),
      'week'
    );

    expect(timeSeries.length).toBe(1);
  });

  // Test 14: getFunnelTimeSeries - aggregate data by month granularity
  it('should aggregate data by month granularity', async () => {
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T10:00:00Z'),
      metadata: {},
    });
    await createActivity('default', {
      developerId: bobDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-11-10T10:00:00Z'),
      metadata: {},
    });

    const timeSeries = await getFunnelTimeSeries(
      'default',
      new Date('2025-10-01T00:00:00Z'),
      new Date('2025-11-30T00:00:00Z'),
      'month'
    );

    expect(timeSeries.length).toBe(2);
  });

  it('should validate date range (fromDate > toDate)', async () => {
    await expect(
      getFunnelTimeSeries(
        'default',
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
        'default',
        new Date('2025-10-10T00:00:00Z'),
        new Date('2025-10-11T00:00:00Z'),
        "day'; DROP TABLE activities; --" as any
      )
    ).rejects.toThrow('Invalid granularity');
  });

  // Test 16: getFunnelTimeSeries - respect tenant isolation
  it('should respect tenant isolation in getFunnelTimeSeries', async () => {
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T10:00:00Z'),
      metadata: {},
    });

    await setTenantContext('other-tenant');
    await createActivity('other-tenant', {
      developerId: charlieDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T11:00:00Z'),
      metadata: {},
    });
    await setTenantContext('default');

    const timeSeries = await getFunnelTimeSeries(
      'default',
      new Date('2025-10-10T00:00:00Z'),
      new Date('2025-10-11T00:00:00Z'),
      'day'
    );

    expect(timeSeries.length).toBe(1);
    const day1Awareness = timeSeries[0]?.stages.find(s => s.stageKey === 'awareness');
    expect(day1Awareness?.uniqueDevelopers).toBe(1);
  });

  // Test 17: getFunnelTimeSeries - return empty array when no data in date range
  it('should return empty array when no data in date range', async () => {
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-09-10T10:00:00Z'),
      metadata: {},
    });

    const timeSeries = await getFunnelTimeSeries(
      'default',
      new Date('2025-10-01T00:00:00Z'),
      new Date('2025-10-31T00:00:00Z'),
      'day'
    );

    expect(timeSeries).toEqual([]);
  });

  // Test 18: getFunnelTimeSeries - calculate drop rates in time series correctly
  it('should calculate drop rates in time series correctly', async () => {
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T10:00:00Z'),
      metadata: {},
    });
    await createActivity('default', {
      developerId: bobDeveloperId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-10-10T10:30:00Z'),
      metadata: {},
    });
    await createActivity('default', {
      developerId: aliceDeveloperId,
      action: 'attend',
      source: 'event',
      occurredAt: new Date('2025-10-10T11:00:00Z'),
      metadata: {},
    });

    const timeSeries = await getFunnelTimeSeries(
      'default',
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
  });
  });
});
