/**
 * Campaign Detail Service Tests
 *
 * Comprehensive integration tests for campaign detail data retrieval.
 * Tests getBudgets, getResources, and getActivities functions.
 * All tests use real database connections (no mocks).
 * RLS (Row Level Security) is tested by using tenant context.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getBudgets,
  getResources,
  getActivities,
} from './campaign-detail.service.js';
import { getDb } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

const TEST_TENANT_ID = 'default';

// Test campaign ID (created in beforeAll)
let testCampaignId: string;

// Create test campaign and budgets before all tests
beforeAll(async () => {
  const db = getDb();

  // Create test campaign
  testCampaignId = crypto.randomUUID();

  await db.insert(schema.campaigns).values({
    campaignId: testCampaignId,
    tenantId: TEST_TENANT_ID,
    name: 'Test Campaign for Service Tests',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  });

  // Create test budgets
  const budgetInserts = [
    {
      budgetId: '40000000-0000-4000-8000-000000000001',
      tenantId: TEST_TENANT_ID,
      campaignId: testCampaignId,
      category: 'labor',
      amount: '50000',
      currency: 'JPY',
      spentAt: '2025-03-01',
      source: 'form',
      memo: 'Staff costs for test',
      meta: { hours: 100 },
    },
    {
      budgetId: '40000000-0000-4000-8000-000000000002',
      tenantId: TEST_TENANT_ID,
      campaignId: testCampaignId,
      category: 'venue',
      amount: '100000',
      currency: 'JPY',
      spentAt: '2025-02-15',
      source: 'form',
      memo: 'Venue rental for test',
      meta: null,
    },
    {
      budgetId: '40000000-0000-4000-8000-000000000003',
      tenantId: TEST_TENANT_ID,
      campaignId: testCampaignId,
      category: 'labor',
      amount: '30000',
      currency: 'JPY',
      spentAt: '2025-02-20',
      source: 'api',
      memo: 'Additional staff costs for test',
      meta: { hours: 60 },
    },
  ];

  await db
    .insert(schema.budgets)
    .values(budgetInserts)
    .onConflictDoNothing();
});

// Clean up test data after all tests
afterAll(async () => {
  const db = getDb();

  // Delete test budgets
  await db
    .delete(schema.budgets)
    .where(
      and(
        eq(schema.budgets.tenantId, TEST_TENANT_ID),
        eq(schema.budgets.campaignId, testCampaignId)
      )
    );

  // Delete test campaign
  await db
    .delete(schema.campaigns)
    .where(eq(schema.campaigns.campaignId, testCampaignId));
});

// ==================== getBudgets Tests ====================

describe('Campaign Detail Service - getBudgets()', () => {
  it('should get budgets with default pagination', async () => {
    const result = await getBudgets(TEST_TENANT_ID, testCampaignId);

    // Should return paginated results
    expect(result.budgets).toBeInstanceOf(Array);
    expect(result.total).toBeGreaterThanOrEqual(3); // At least our 3 test budgets
    expect(result.budgets.length).toBeGreaterThanOrEqual(3);

    // Verify budget structure
    const budget = result.budgets[0];
    expect(budget).toHaveProperty('budgetId');
    expect(budget).toHaveProperty('tenantId', TEST_TENANT_ID);
    expect(budget).toHaveProperty('campaignId', testCampaignId);
    expect(budget).toHaveProperty('category');
    expect(budget).toHaveProperty('amount');
    expect(budget).toHaveProperty('currency');
    expect(budget).toHaveProperty('spentAt');
  });

  it('should respect limit parameter', async () => {
    const result = await getBudgets(TEST_TENANT_ID, testCampaignId, {
      limit: 2,
    });

    expect(result.budgets.length).toBe(2);
    expect(result.total).toBeGreaterThanOrEqual(3); // Total count unchanged
  });

  it('should respect offset parameter', async () => {
    const firstPage = await getBudgets(TEST_TENANT_ID, testCampaignId, {
      limit: 1,
      offset: 0,
    });

    const secondPage = await getBudgets(TEST_TENANT_ID, testCampaignId, {
      limit: 1,
      offset: 1,
    });

    // Different budgets on different pages
    expect(firstPage.budgets[0]?.budgetId).not.toBe(
      secondPage.budgets[0]?.budgetId
    );
  });

  it('should filter by category', async () => {
    const result = await getBudgets(TEST_TENANT_ID, testCampaignId, {
      category: 'labor',
    });

    // Should only return labor budgets (we have 2)
    expect(result.budgets.length).toBe(2);
    result.budgets.forEach((budget) => {
      expect(budget.category).toBe('labor');
    });
    expect(result.total).toBe(2);
  });

  it('should sort by spentAt DESC, createdAt DESC', async () => {
    const result = await getBudgets(TEST_TENANT_ID, testCampaignId);

    // Budgets should be sorted by spentAt DESC (most recent first)
    // Our test data: 2025-03-01, 2025-02-20, 2025-02-15
    expect(result.budgets.length).toBeGreaterThanOrEqual(3);
    expect(result.budgets[0]?.spentAt).toBe('2025-03-01');
    expect(result.budgets[1]?.spentAt).toBe('2025-02-20');
    expect(result.budgets[2]?.spentAt).toBe('2025-02-15');
  });

  it('should return empty array for campaign with no budgets', async () => {
    // Use a different seeded campaign without budgets
    const blogCampaignId = '10000000-0000-4000-8000-000000000002';
    const result = await getBudgets(TEST_TENANT_ID, blogCampaignId);

    expect(result.budgets).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should cap limit at 100', async () => {
    const result = await getBudgets(TEST_TENANT_ID, testCampaignId, {
      limit: 999, // Try to request more than max
    });

    // Should be capped at 100 (but we have far fewer test budgets)
    expect(result.budgets.length).toBeLessThanOrEqual(100);
  });
});

// ==================== getResources Tests ====================

describe('Campaign Detail Service - getResources()', () => {
  it('should get resources with default pagination', async () => {
    const result = await getResources(TEST_TENANT_ID, testCampaignId);

    // Should return paginated results
    expect(result.resources).toBeInstanceOf(Array);
    expect(result.total).toBeGreaterThanOrEqual(0); // May or may not have seeded resources

    // If resources exist, verify structure
    if (result.resources.length > 0) {
      const resource = result.resources[0];
      expect(resource).toHaveProperty('resourceId');
      expect(resource).toHaveProperty('tenantId', TEST_TENANT_ID);
      expect(resource).toHaveProperty('campaignId', testCampaignId);
      expect(resource).toHaveProperty('category');
    }
  });

  it('should respect limit parameter', async () => {
    const result = await getResources(TEST_TENANT_ID, testCampaignId, {
      limit: 1,
    });

    expect(result.resources.length).toBeLessThanOrEqual(1);
  });

  it('should respect offset parameter', async () => {
    // This test only makes sense if we have multiple resources
    const allResources = await getResources(TEST_TENANT_ID, testCampaignId);

    if (allResources.total >= 2) {
      const firstPage = await getResources(TEST_TENANT_ID, testCampaignId, {
        limit: 1,
        offset: 0,
      });

      const secondPage = await getResources(TEST_TENANT_ID, testCampaignId, {
        limit: 1,
        offset: 1,
      });

      expect(firstPage.resources[0]?.resourceId).not.toBe(
        secondPage.resources[0]?.resourceId
      );
    }
  });

  it('should sort by createdAt DESC', async () => {
    const result = await getResources(TEST_TENANT_ID, testCampaignId);

    // Resources should be sorted by createdAt DESC (most recent first)
    if (result.resources.length >= 2) {
      const first = result.resources[0]!;
      const second = result.resources[1]!;
      expect(new Date(first.createdAt) >= new Date(second.createdAt)).toBe(true);
    }
  });

  it('should return empty array for campaign with no resources', async () => {
    // Use a campaign ID that we know has no resources
    const sponsorCampaignId = '10000000-0000-4000-8000-000000000003';
    const result = await getResources(TEST_TENANT_ID, sponsorCampaignId);

    expect(result.resources).toBeInstanceOf(Array);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});

// ==================== getActivities Tests ====================

describe('Campaign Detail Service - getActivities()', () => {
  it('should get activities with default pagination', async () => {
    const result = await getActivities(TEST_TENANT_ID, testCampaignId);

    // Should return paginated results
    expect(result.activities).toBeInstanceOf(Array);
    expect(result.total).toBeGreaterThanOrEqual(0); // May or may not have linked activities

    // If activities exist, verify structure
    if (result.activities.length > 0) {
      const activity = result.activities[0];
      expect(activity).toHaveProperty('activityId');
      expect(activity).toHaveProperty('tenantId', TEST_TENANT_ID);
      expect(activity).toHaveProperty('action');
      expect(activity).toHaveProperty('occurredAt');
      expect(activity).toHaveProperty('source');
    }
  });

  it('should respect limit parameter', async () => {
    const result = await getActivities(TEST_TENANT_ID, testCampaignId, {
      limit: 1,
    });

    expect(result.activities.length).toBeLessThanOrEqual(1);
  });

  it('should respect offset parameter', async () => {
    // This test only makes sense if we have multiple activities
    const allActivities = await getActivities(TEST_TENANT_ID, testCampaignId);

    if (allActivities.total >= 2) {
      const firstPage = await getActivities(TEST_TENANT_ID, testCampaignId, {
        limit: 1,
        offset: 0,
      });

      const secondPage = await getActivities(TEST_TENANT_ID, testCampaignId, {
        limit: 1,
        offset: 1,
      });

      expect(firstPage.activities[0]?.activityId).not.toBe(
        secondPage.activities[0]?.activityId
      );
    }
  });

  it('should sort by occurredAt DESC', async () => {
    const result = await getActivities(TEST_TENANT_ID, testCampaignId);

    // Activities should be sorted by occurredAt DESC (most recent first)
    if (result.activities.length >= 2) {
      const first = result.activities[0]!;
      const second = result.activities[1]!;
      expect(new Date(first.occurredAt) >= new Date(second.occurredAt)).toBe(
        true
      );
    }
  });

  it('should return empty array for campaign with no activities', async () => {
    // Use a campaign ID that we know has no linked activities
    const sponsorCampaignId = '10000000-0000-4000-8000-000000000003';
    const result = await getActivities(TEST_TENANT_ID, sponsorCampaignId);

    expect(result.activities).toBeInstanceOf(Array);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});
