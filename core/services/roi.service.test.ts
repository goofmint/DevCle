/**
 * ROI Service Tests
 *
 * Comprehensive integration tests for ROI calculation functions.
 * All tests use real database connections (no mocks).
 * RLS (Row Level Security) is tested by using tenant context.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  calculateROI,
  getCampaignCost,
  getCampaignValue,
} from './roi.service.js';
import { createCampaign } from './campaign.service.js';
import { getDb, withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

const TEST_TENANT_ID = 'default';
const OTHER_TENANT_ID = 'other-tenant';

// Create other-tenant for RLS tests
beforeAll(async () => {
  const db = getDb();
  // Create other-tenant if it doesn't exist
  await db.insert(schema.tenants).values({
    tenantId: OTHER_TENANT_ID,
    name: 'Other Tenant',
  }).onConflictDoNothing();
});

// Test data cleanup
afterAll(async () => {
  const db = getDb();
  // Clean up test campaigns (budgets and activities will cascade)
  await db
    .delete(schema.campaigns)
    .where(eq(schema.campaigns.tenantId, TEST_TENANT_ID));
  await db
    .delete(schema.campaigns)
    .where(eq(schema.campaigns.tenantId, OTHER_TENANT_ID));
});

describe('ROI Service - getCampaignCost()', () => {
  it('should calculate total cost for campaign with multiple budgets', async () => {
    // Create campaign
    const campaign = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Cost ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    // Create budgets using withTenantContext
    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      await tx.insert(schema.budgets).values([
        {
          tenantId: TEST_TENANT_ID,
          campaignId: campaign.campaignId,
          category: 'labor',
          amount: '100000',
          currency: 'JPY',
          spentAt: '2025-10-01',
          source: 'test',
        },
        {
          tenantId: TEST_TENANT_ID,
          campaignId: campaign.campaignId,
          category: 'ad',
          amount: '50000',
          currency: 'JPY',
          spentAt: '2025-10-02',
          source: 'test',
        },
      ]);
    });

    // Calculate cost
    const totalCost = await getCampaignCost(TEST_TENANT_ID, campaign.campaignId);

    expect(totalCost).toBe('150000');
  });

  it('should return "0" for campaign with no budgets', async () => {
    // Create campaign without budgets
    const campaign = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign No Budget ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    const totalCost = await getCampaignCost(TEST_TENANT_ID, campaign.campaignId);

    expect(totalCost).toBe('0');
  });

  it('should handle different currencies (JPY assumed)', async () => {
    // Create campaign
    const campaign = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Currency ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    // Create budgets with different currencies (all treated as JPY)
    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      await tx.insert(schema.budgets).values([
        {
          tenantId: TEST_TENANT_ID,
          campaignId: campaign.campaignId,
          category: 'labor',
          amount: '100000',
          currency: 'JPY',
          spentAt: '2025-10-01',
          source: 'test',
        },
        {
          tenantId: TEST_TENANT_ID,
          campaignId: campaign.campaignId,
          category: 'ad',
          amount: '200000',
          currency: 'USD', // Different currency (not converted)
          spentAt: '2025-10-02',
          source: 'test',
        },
      ]);
    });

    const totalCost = await getCampaignCost(TEST_TENANT_ID, campaign.campaignId);

    // Sum is calculated regardless of currency
    expect(totalCost).toBe('300000');
  });

  it('should not include budgets from other tenants (RLS)', async () => {
    // Create campaigns in different tenants
    const campaign1 = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign RLS 1 ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    const campaign2 = await createCampaign(OTHER_TENANT_ID, {
      name: `Test Campaign RLS 2 ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    // Create budgets for both campaigns
    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      await tx.insert(schema.budgets).values({
        tenantId: TEST_TENANT_ID,
        campaignId: campaign1.campaignId,
        category: 'labor',
        amount: '100000',
        currency: 'JPY',
        spentAt: '2025-10-01',
        source: 'test',
      });
    });

    await withTenantContext(OTHER_TENANT_ID, async (tx) => {
      await tx.insert(schema.budgets).values({
        tenantId: OTHER_TENANT_ID,
        campaignId: campaign2.campaignId,
        category: 'labor',
        amount: '999999',
        currency: 'JPY',
        spentAt: '2025-10-01',
        source: 'test',
      });
    });

    // Get cost for campaign1 (should only include campaign1's budgets)
    const totalCost = await getCampaignCost(TEST_TENANT_ID, campaign1.campaignId);

    expect(totalCost).toBe('100000'); // Not 1099999
  });
});

describe('ROI Service - getCampaignValue()', () => {
  it('should calculate total value for campaign with multiple activities', async () => {
    // Create campaign
    const campaign = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Value ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    // Create activities with value using withTenantContext
    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      const activities = await tx.insert(schema.activities).values([
        {
          tenantId: TEST_TENANT_ID,
          action: 'click',
          occurredAt: new Date('2025-10-01'),
          source: 'test',
          value: '10000',
        },
        {
          tenantId: TEST_TENANT_ID,
          action: 'attend',
          occurredAt: new Date('2025-10-02'),
          source: 'test',
          value: '20000',
        },
      ]).returning();

      // Link activities to campaign
      await tx.insert(schema.activityCampaigns).values(
        activities.map((a) => ({
          tenantId: TEST_TENANT_ID,
          activityId: a.activityId,
          campaignId: campaign.campaignId,
          weight: '1.0',
        }))
      );
    });

    const totalValue = await getCampaignValue(TEST_TENANT_ID, campaign.campaignId);

    expect(totalValue).toBe('30000');
  });

  it('should return "0" for campaign with no activities', async () => {
    // Create campaign without activities
    const campaign = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign No Activity ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    const totalValue = await getCampaignValue(TEST_TENANT_ID, campaign.campaignId);

    expect(totalValue).toBe('0');
  });

  it('should skip activities with NULL value', async () => {
    // Create campaign
    const campaign = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign NULL Value ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    // Create activities (some with NULL value)
    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      const activities = await tx.insert(schema.activities).values([
        {
          tenantId: TEST_TENANT_ID,
          action: 'click',
          occurredAt: new Date('2025-10-01'),
          source: 'test',
          value: '10000',
        },
        {
          tenantId: TEST_TENANT_ID,
          action: 'view',
          occurredAt: new Date('2025-10-02'),
          source: 'test',
          value: null, // NULL value (should be skipped)
        },
      ]).returning();

      await tx.insert(schema.activityCampaigns).values(
        activities.map((a) => ({
          tenantId: TEST_TENANT_ID,
          activityId: a.activityId,
          campaignId: campaign.campaignId,
          weight: '1.0',
        }))
      );
    });

    const totalValue = await getCampaignValue(TEST_TENANT_ID, campaign.campaignId);

    expect(totalValue).toBe('10000'); // Only non-NULL value counted
  });

  it('should not include activities from other tenants (RLS)', async () => {
    // Create campaigns in different tenants
    const campaign1 = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Value RLS 1 ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    const campaign2 = await createCampaign(OTHER_TENANT_ID, {
      name: `Test Campaign Value RLS 2 ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    // Create activities for both campaigns
    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      const activities = await tx.insert(schema.activities).values({
        tenantId: TEST_TENANT_ID,
        action: 'click',
        occurredAt: new Date('2025-10-01'),
        source: 'test',
        value: '10000',
      }).returning();

      await tx.insert(schema.activityCampaigns).values({
        tenantId: TEST_TENANT_ID,
        activityId: activities[0]!.activityId,
        campaignId: campaign1.campaignId,
        weight: '1.0',
      });
    });

    await withTenantContext(OTHER_TENANT_ID, async (tx) => {
      const activities = await tx.insert(schema.activities).values({
        tenantId: OTHER_TENANT_ID,
        action: 'click',
        occurredAt: new Date('2025-10-01'),
        source: 'test',
        value: '999999',
      }).returning();

      await tx.insert(schema.activityCampaigns).values({
        tenantId: OTHER_TENANT_ID,
        activityId: activities[0]!.activityId,
        campaignId: campaign2.campaignId,
        weight: '1.0',
      });
    });

    const totalValue = await getCampaignValue(TEST_TENANT_ID, campaign1.campaignId);

    expect(totalValue).toBe('10000'); // Not 1009999
  });
});

describe('ROI Service - calculateROI()', () => {
  it('should calculate positive ROI (value > cost)', async () => {
    const campaign = await createCampaign(TEST_TENANT_ID, {
      name: `Test ROI Positive ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      await tx.insert(schema.budgets).values({
        tenantId: TEST_TENANT_ID,
        campaignId: campaign.campaignId,
        category: 'labor',
        amount: '100000',
        currency: 'JPY',
        spentAt: '2025-10-01',
        source: 'test',
      });

      const activities = await tx.insert(schema.activities).values({
        tenantId: TEST_TENANT_ID,
        action: 'click',
        occurredAt: new Date('2025-10-01'),
        source: 'test',
        value: '200000',
      }).returning();

      await tx.insert(schema.activityCampaigns).values({
        tenantId: TEST_TENANT_ID,
        activityId: activities[0]!.activityId,
        campaignId: campaign.campaignId,
        weight: '1.0',
      });
    });

    const roi = await calculateROI(TEST_TENANT_ID, campaign.campaignId);

    expect(roi).not.toBeNull();
    expect(roi?.roi).toBe(100); // (200000 - 100000) / 100000 * 100 = 100%
  });

  it('should calculate negative ROI (value < cost)', async () => {
    const campaign = await createCampaign(TEST_TENANT_ID, {
      name: `Test ROI Negative ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      await tx.insert(schema.budgets).values({
        tenantId: TEST_TENANT_ID,
        campaignId: campaign.campaignId,
        category: 'labor',
        amount: '100000',
        currency: 'JPY',
        spentAt: '2025-10-01',
        source: 'test',
      });

      const activities = await tx.insert(schema.activities).values({
        tenantId: TEST_TENANT_ID,
        action: 'click',
        occurredAt: new Date('2025-10-01'),
        source: 'test',
        value: '50000',
      }).returning();

      await tx.insert(schema.activityCampaigns).values({
        tenantId: TEST_TENANT_ID,
        activityId: activities[0]!.activityId,
        campaignId: campaign.campaignId,
        weight: '1.0',
      });
    });

    const roi = await calculateROI(TEST_TENANT_ID, campaign.campaignId);

    expect(roi).not.toBeNull();
    expect(roi?.roi).toBe(-50); // (50000 - 100000) / 100000 * 100 = -50%
  });

  it('should calculate zero ROI (value = cost)', async () => {
    const campaign = await createCampaign(TEST_TENANT_ID, {
      name: `Test ROI Zero ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      await tx.insert(schema.budgets).values({
        tenantId: TEST_TENANT_ID,
        campaignId: campaign.campaignId,
        category: 'labor',
        amount: '100000',
        currency: 'JPY',
        spentAt: '2025-10-01',
        source: 'test',
      });

      const activities = await tx.insert(schema.activities).values({
        tenantId: TEST_TENANT_ID,
        action: 'click',
        occurredAt: new Date('2025-10-01'),
        source: 'test',
        value: '100000',
      }).returning();

      await tx.insert(schema.activityCampaigns).values({
        tenantId: TEST_TENANT_ID,
        activityId: activities[0]!.activityId,
        campaignId: campaign.campaignId,
        weight: '1.0',
      });
    });

    const roi = await calculateROI(TEST_TENANT_ID, campaign.campaignId);

    expect(roi).not.toBeNull();
    expect(roi?.roi).toBe(0); // (100000 - 100000) / 100000 * 100 = 0%
  });

  it('should return null ROI when cost is 0', async () => {
    const campaign = await createCampaign(TEST_TENANT_ID, {
      name: `Test ROI Null ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      const activities = await tx.insert(schema.activities).values({
        tenantId: TEST_TENANT_ID,
        action: 'click',
        occurredAt: new Date('2025-10-01'),
        source: 'test',
        value: '100000',
      }).returning();

      await tx.insert(schema.activityCampaigns).values({
        tenantId: TEST_TENANT_ID,
        activityId: activities[0]!.activityId,
        campaignId: campaign.campaignId,
        weight: '1.0',
      });
    });

    const roi = await calculateROI(TEST_TENANT_ID, campaign.campaignId);

    expect(roi).not.toBeNull();
    expect(roi?.roi).toBeNull(); // Cannot calculate (division by zero)
    expect(roi?.totalCost).toBe('0');
    expect(roi?.totalValue).toBe('100000');
  });

  it('should calculate ROI -100% when value is 0', async () => {
    const campaign = await createCampaign(TEST_TENANT_ID, {
      name: `Test ROI Value Zero ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      await tx.insert(schema.budgets).values({
        tenantId: TEST_TENANT_ID,
        campaignId: campaign.campaignId,
        category: 'labor',
        amount: '100000',
        currency: 'JPY',
        spentAt: '2025-10-01',
        source: 'test',
      });
    });

    const roi = await calculateROI(TEST_TENANT_ID, campaign.campaignId);

    expect(roi).not.toBeNull();
    expect(roi?.roi).toBe(-100); // (0 - 100000) / 100000 * 100 = -100%
  });

  it('should return null for non-existent campaign', async () => {
    const nonExistentId = '00000000-0000-4000-8000-000000000000';

    const roi = await calculateROI(TEST_TENANT_ID, nonExistentId);

    expect(roi).toBeNull();
  });

  it('should count activities and developers correctly', async () => {
    const campaign = await createCampaign(TEST_TENANT_ID, {
      name: `Test ROI Counts ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      await tx.insert(schema.budgets).values({
        tenantId: TEST_TENANT_ID,
        campaignId: campaign.campaignId,
        category: 'labor',
        amount: '100000',
        currency: 'JPY',
        spentAt: '2025-10-01',
        source: 'test',
      });

      const activities = await tx.insert(schema.activities).values([
        {
          tenantId: TEST_TENANT_ID,
          action: 'click',
          occurredAt: new Date('2025-10-01'),
          source: 'test',
          value: '50000',
        },
        {
          tenantId: TEST_TENANT_ID,
          action: 'attend',
          occurredAt: new Date('2025-10-02'),
          source: 'test',
          value: '50000',
        },
      ]).returning();

      await tx.insert(schema.activityCampaigns).values(
        activities.map((a) => ({
          tenantId: TEST_TENANT_ID,
          activityId: a.activityId,
          campaignId: campaign.campaignId,
          weight: '1.0',
        }))
      );
    });

    const roi = await calculateROI(TEST_TENANT_ID, campaign.campaignId);

    expect(roi).not.toBeNull();
    expect(roi?.activityCount).toBe(2);
    expect(roi?.developerCount).toBe(0); // No developers linked
  });

  it('should round ROI to 2 decimal places', async () => {
    const campaign = await createCampaign(TEST_TENANT_ID, {
      name: `Test ROI Rounding ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      await tx.insert(schema.budgets).values({
        tenantId: TEST_TENANT_ID,
        campaignId: campaign.campaignId,
        category: 'labor',
        amount: '100000',
        currency: 'JPY',
        spentAt: '2025-10-01',
        source: 'test',
      });

      const activities = await tx.insert(schema.activities).values({
        tenantId: TEST_TENANT_ID,
        action: 'click',
        occurredAt: new Date('2025-10-01'),
        source: 'test',
        value: '123456',
      }).returning();

      await tx.insert(schema.activityCampaigns).values({
        tenantId: TEST_TENANT_ID,
        activityId: activities[0]!.activityId,
        campaignId: campaign.campaignId,
        weight: '1.0',
      });
    });

    const roi = await calculateROI(TEST_TENANT_ID, campaign.campaignId);

    expect(roi).not.toBeNull();
    // (123456 - 100000) / 100000 * 100 = 23.456%
    expect(roi?.roi).toBe(23.46); // Rounded to 2 decimal places
  });
});
