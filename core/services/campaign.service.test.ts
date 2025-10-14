/**
 * Campaign Service Tests
 *
 * Comprehensive integration tests for campaign CRUD operations.
 * All tests use real database connections (no mocks).
 * RLS (Row Level Security) is tested by using tenant context.
 */

import { describe, it, expect, afterAll } from 'vitest';
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
} from './campaign.service.js';
import { getDb } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

const TEST_TENANT_ID = 'default';

// Test data cleanup
afterAll(async () => {
  const db = getDb();
  // Clean up test campaigns (use LIKE to match test campaign names)
  await db
    .delete(schema.campaigns)
    .where(eq(schema.campaigns.tenantId, TEST_TENANT_ID));
});

describe('Campaign Service - createCampaign()', () => {
  it('should create a campaign with all fields', async () => {
    const input = {
      name: `Test Campaign Full ${Date.now()}`,
      channel: 'event',
      startDate: new Date('2025-10-01'),
      endDate: new Date('2025-12-31'),
      budgetTotal: '1000000',
      attributes: { utm_source: 'twitter', owner: 'alice' },
    };

    const result = await createCampaign(TEST_TENANT_ID, input);

    expect(result.campaignId).toBeDefined();
    expect(result.tenantId).toBe(TEST_TENANT_ID);
    expect(result.name).toBe(input.name);
    expect(result.channel).toBe(input.channel);
    expect(result.startDate).toBe('2025-10-01'); // date type returns string
    expect(result.endDate).toBe('2025-12-31');
    expect(result.budgetTotal).toBe(input.budgetTotal);
    // PostgreSQL transform.camel converts snake_case to camelCase
    expect(result.attributes).toEqual({ utmSource: 'twitter', owner: 'alice' });
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it('should create a campaign with minimal fields (name only)', async () => {
    const input = {
      name: `Test Campaign Minimal ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    };

    const result = await createCampaign(TEST_TENANT_ID, input);

    expect(result.campaignId).toBeDefined();
    expect(result.name).toBe(input.name);
    expect(result.channel).toBeNull();
    expect(result.startDate).toBeNull();
    expect(result.endDate).toBeNull();
    expect(result.budgetTotal).toBeNull();
    expect(result.attributes).toEqual({}); // default value
  });

  it('should throw error for duplicate name (unique constraint)', async () => {
    const uniqueName = `Test Campaign Duplicate ${Date.now()}`;

    // Create first campaign
    await createCampaign(TEST_TENANT_ID, {
      name: uniqueName,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    // Try to create duplicate
    await expect(
      createCampaign(TEST_TENANT_ID, {
        name: uniqueName,
        channel: null,
        startDate: null,
        endDate: null,
        budgetTotal: null,
      })
    ).rejects.toThrow('Campaign with this name already exists');
  });

  it('should throw error for invalid date range (startDate > endDate)', async () => {
    const input = {
      name: `Test Campaign Invalid Date ${Date.now()}`,
      channel: null,
      startDate: new Date('2025-12-31'),
      endDate: new Date('2025-10-01'), // endDate < startDate
      budgetTotal: null,
    };

    await expect(createCampaign(TEST_TENANT_ID, input)).rejects.toThrow(
      'startDate must be on or before endDate'
    );
  });

  it('should throw error for empty name (validation error)', async () => {
    const input = {
      name: '', // empty string
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    };

    await expect(createCampaign(TEST_TENANT_ID, input)).rejects.toThrow();
  });
});

describe('Campaign Service - getCampaign()', () => {
  it('should get an existing campaign by ID', async () => {
    // Create a campaign first
    const created = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Get ${Date.now()}`,
      channel: 'content',
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    // Get the campaign
    const result = await getCampaign(TEST_TENANT_ID, created.campaignId);

    expect(result).not.toBeNull();
    expect(result?.campaignId).toBe(created.campaignId);
    expect(result?.name).toBe(created.name);
  });

  it('should return null for non-existent campaign', async () => {
    const nonExistentId = '00000000-0000-4000-8000-000000000000';

    const result = await getCampaign(TEST_TENANT_ID, nonExistentId);

    expect(result).toBeNull();
  });
});

describe('Campaign Service - listCampaigns()', () => {
  it('should list campaigns with default parameters', async () => {
    // Create test campaigns
    await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign List 1 ${Date.now()}`,
      channel: 'event',
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    const result = await listCampaigns(TEST_TENANT_ID, {});

    expect(result.campaigns).toBeDefined();
    expect(Array.isArray(result.campaigns)).toBe(true);
    expect(result.total).toBeGreaterThan(0);
    expect(result.campaigns.length).toBeLessThanOrEqual(50); // default limit
  });

  it('should paginate campaigns with limit and offset', async () => {
    // Create multiple campaigns
    for (let i = 0; i < 3; i++) {
      await createCampaign(TEST_TENANT_ID, {
        name: `Test Campaign Pagination ${i} ${Date.now()}`,
        channel: 'ad',
        startDate: null,
        endDate: null,
        budgetTotal: null,
      });
    }

    // Get first page
    const page1 = await listCampaigns(TEST_TENANT_ID, {
      limit: 2,
      offset: 0,
    });

    // Get second page
    const page2 = await listCampaigns(TEST_TENANT_ID, {
      limit: 2,
      offset: 2,
    });

    expect(page1.campaigns.length).toBeLessThanOrEqual(2);
    expect(page2.campaigns.length).toBeGreaterThanOrEqual(0);
    expect(page1.total).toBe(page2.total); // total should be same
  });

  it('should filter campaigns by channel', async () => {
    // Create campaigns with different channels
    await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Filter Event ${Date.now()}`,
      channel: 'event',
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });
    await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Filter Ad ${Date.now()}`,
      channel: 'ad',
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    const result = await listCampaigns(TEST_TENANT_ID, {
      channel: 'event',
    });

    expect(result.campaigns.every((c) => c.channel === 'event')).toBe(true);
  });

  it('should search campaigns by name (partial match)', async () => {
    const searchTerm = `SearchTest${Date.now()}`;
    await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign ${searchTerm} Alpha`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    const result = await listCampaigns(TEST_TENANT_ID, {
      search: searchTerm,
    });

    expect(result.campaigns.length).toBeGreaterThan(0);
    expect(result.campaigns.some((c) => c.name.includes(searchTerm))).toBe(
      true
    );
  });

  it('should sort campaigns by name ascending', async () => {
    const timestamp = Date.now();
    await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Sort B ${timestamp}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });
    await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Sort A ${timestamp}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    const result = await listCampaigns(TEST_TENANT_ID, {
      orderBy: 'name',
      orderDirection: 'asc',
    });

    // Check first two campaigns are in ascending order
    if (result.campaigns.length >= 2) {
      expect(result.campaigns[0]!.name <= result.campaigns[1]!.name).toBe(true);
    }
  });

  it('should sort campaigns by startDate descending', async () => {
    const timestamp = Date.now();
    await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Sort Date 1 ${timestamp}`,
      channel: null,
      startDate: new Date('2025-01-01'),
      endDate: null,
      budgetTotal: null,
    });
    await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Sort Date 2 ${timestamp}`,
      channel: null,
      startDate: new Date('2025-12-31'),
      endDate: null,
      budgetTotal: null,
    });

    const result = await listCampaigns(TEST_TENANT_ID, {
      orderBy: 'startDate',
      orderDirection: 'desc',
    });

    // Check campaigns with startDate are sorted descending
    const withDates = result.campaigns.filter((c) => c.startDate !== null);
    if (withDates.length >= 2) {
      expect(withDates[0]!.startDate! >= withDates[1]!.startDate!).toBe(true);
    }
  });

  it('should return empty result when no campaigns match', async () => {
    const result = await listCampaigns(TEST_TENANT_ID, {
      channel: 'non_existent_channel_xyz',
    });

    expect(result.campaigns.length).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should return correct total count matching data length', async () => {
    const result = await listCampaigns(TEST_TENANT_ID, {
      limit: 10,
      offset: 0,
    });

    // total should be >= campaigns.length
    expect(result.total).toBeGreaterThanOrEqual(result.campaigns.length);
  });
});

describe('Campaign Service - updateCampaign()', () => {
  it('should update campaign name only (partial update)', async () => {
    // Create a campaign
    const created = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Update Name ${Date.now()}`,
      channel: 'event',
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    const newName = `Updated Campaign Name ${Date.now()}`;
    const updated = await updateCampaign(TEST_TENANT_ID, created.campaignId, {
      name: newName,
    });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe(newName);
    expect(updated?.channel).toBe('event'); // unchanged
  });

  it('should update multiple fields', async () => {
    // Create a campaign
    const created = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Update Multi ${Date.now()}`,
      channel: 'ad',
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    const updates = {
      name: `Updated Multi ${Date.now()}`,
      channel: 'content',
      budgetTotal: '2000000',
    };

    const updated = await updateCampaign(
      TEST_TENANT_ID,
      created.campaignId,
      updates
    );

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe(updates.name);
    expect(updated?.channel).toBe(updates.channel);
    expect(updated?.budgetTotal).toBe(updates.budgetTotal);
  });

  it('should return existing record for empty update (no-op)', async () => {
    // Create a campaign
    const created = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Update NoOp ${Date.now()}`,
      channel: 'event',
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    const updated = await updateCampaign(TEST_TENANT_ID, created.campaignId, {});

    expect(updated).not.toBeNull();
    expect(updated?.campaignId).toBe(created.campaignId);
    expect(updated?.name).toBe(created.name);
  });

  it('should return null for non-existent campaign', async () => {
    const nonExistentId = '00000000-0000-4000-8000-000000000000';

    const result = await updateCampaign(TEST_TENANT_ID, nonExistentId, {
      name: 'New Name',
    });

    expect(result).toBeNull();
  });
});

describe('Campaign Service - deleteCampaign()', () => {
  it('should delete an existing campaign', async () => {
    // Create a campaign
    const created = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Delete ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    // Delete the campaign
    const deleted = await deleteCampaign(TEST_TENANT_ID, created.campaignId);

    expect(deleted).toBe(true);

    // Verify campaign is deleted
    const result = await getCampaign(TEST_TENANT_ID, created.campaignId);
    expect(result).toBeNull();
  });

  it('should return false for non-existent campaign', async () => {
    const nonExistentId = '00000000-0000-4000-8000-000000000000';

    const deleted = await deleteCampaign(TEST_TENANT_ID, nonExistentId);

    expect(deleted).toBe(false);
  });

  it('should cascade delete related budgets', async () => {
    // Create a campaign
    const created = await createCampaign(TEST_TENANT_ID, {
      name: `Test Campaign Cascade ${Date.now()}`,
      channel: null,
      startDate: null,
      endDate: null,
      budgetTotal: null,
    });

    // Create a budget for this campaign using withTenantContext (for RLS)
    const { withTenantContext } = await import('../db/connection.js');
    const budget = await withTenantContext(TEST_TENANT_ID, async (tx) => {
      const [result] = await tx
        .insert(schema.budgets)
        .values({
          tenantId: TEST_TENANT_ID,
          campaignId: created.campaignId,
          category: 'labor',
          amount: '100000',
          currency: 'JPY',
          spentAt: '2025-10-01',
          source: 'test',
        })
        .returning();
      return result!;
    });

    // Delete the campaign
    await deleteCampaign(TEST_TENANT_ID, created.campaignId);

    // Verify budget is also deleted (cascade)
    const budgetResult = await withTenantContext(TEST_TENANT_ID, async (tx) => {
      return await tx
        .select()
        .from(schema.budgets)
        .where(eq(schema.budgets.budgetId, budget.budgetId))
        .limit(1);
    });

    expect(budgetResult.length).toBe(0);
  });
});
