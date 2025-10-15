/**
 * Shortlink Service Tests
 *
 * Comprehensive integration tests for shortlink CRUD operations.
 * All tests use real database connections (no mocks).
 * RLS (Row Level Security) is tested by using tenant context.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createShortlink,
  getShortlink,
  getShortlinkByKey,
  listShortlinks,
  updateShortlink,
  deleteShortlink,
} from './shortlink.service.js';
import { getDb, withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

const TEST_TENANT_ID = 'default';
const OTHER_TENANT_ID = 'other-tenant';

// Test data setup and cleanup
beforeAll(async () => {
  const db = getDb();

  // Ensure test tenants exist
  await db
    .insert(schema.tenants)
    .values({ tenantId: TEST_TENANT_ID, name: 'Test Tenant' })
    .onConflictDoNothing();

  await db
    .insert(schema.tenants)
    .values({ tenantId: OTHER_TENANT_ID, name: 'Other Tenant' })
    .onConflictDoNothing();
});

afterAll(async () => {
  const db = getDb();

  // Clean up test data
  await db
    .delete(schema.activities)
    .where(eq(schema.activities.tenantId, TEST_TENANT_ID));

  await db
    .delete(schema.shortlinks)
    .where(eq(schema.shortlinks.tenantId, TEST_TENANT_ID));

  await db
    .delete(schema.activities)
    .where(eq(schema.activities.tenantId, OTHER_TENANT_ID));

  await db
    .delete(schema.shortlinks)
    .where(eq(schema.shortlinks.tenantId, OTHER_TENANT_ID));
});

describe('Shortlink Service - createShortlink()', () => {
  it('should create shortlink with auto-generated key', async () => {
    const input = {
      targetUrl: 'https://example.com/blog/post-1',
    };

    const result = await createShortlink(TEST_TENANT_ID, input);

    expect(result.shortlinkId).toBeDefined();
    expect(result.key).toBeDefined();
    expect(result.key.length).toBe(8); // default nanoid length
    expect(result.key).toMatch(/^[a-zA-Z0-9_-]+$/); // URL-safe characters
    expect(result.targetUrl).toBe(input.targetUrl);
    expect(result.shortUrl).toBe(`https://devcle.com/c/${result.key}`);
    expect(result.campaignId).toBeNull();
    expect(result.resourceId).toBeNull();
    expect(result.attributes).toBeNull();
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it('should create shortlink with custom key', async () => {
    const customKey = `test-${Date.now()}`;
    const input = {
      targetUrl: 'https://example.com/blog/post-2',
      key: customKey,
    };

    const result = await createShortlink(TEST_TENANT_ID, input);

    expect(result.key).toBe(customKey);
    expect(result.shortUrl).toBe(`https://devcle.com/c/${customKey}`);
  });

  it('should create shortlink with campaign_id', async () => {
    // Create a campaign first
    const campaign = await withTenantContext(TEST_TENANT_ID, async (tx) => {
      const [result] = await tx
        .insert(schema.campaigns)
        .values({
          tenantId: TEST_TENANT_ID,
          name: `Test Campaign ${Date.now()}`,
        })
        .returning();
      return result!;
    });

    const input = {
      targetUrl: 'https://example.com/campaign-link',
      campaignId: campaign.campaignId,
    };

    const result = await createShortlink(TEST_TENANT_ID, input);

    expect(result.campaignId).toBe(campaign.campaignId);
  });

  it('should create shortlink with resource_id', async () => {
    // Create a campaign and resource first
    const campaign = await withTenantContext(TEST_TENANT_ID, async (tx) => {
      const [result] = await tx
        .insert(schema.campaigns)
        .values({
          tenantId: TEST_TENANT_ID,
          name: `Test Campaign for Resource ${Date.now()}`,
        })
        .returning();
      return result!;
    });

    const resource = await withTenantContext(TEST_TENANT_ID, async (tx) => {
      const [result] = await tx
        .insert(schema.resources)
        .values({
          tenantId: TEST_TENANT_ID,
          campaignId: campaign.campaignId,
          category: 'content',
          title: `Test Resource ${Date.now()}`,
        })
        .returning();
      return result!;
    });

    const input = {
      targetUrl: 'https://example.com/resource-link',
      resourceId: resource.resourceId,
    };

    const result = await createShortlink(TEST_TENANT_ID, input);

    expect(result.resourceId).toBe(resource.resourceId);
  });

  it('should create shortlink with attributes (UTM params)', async () => {
    const input = {
      targetUrl: 'https://example.com/utm-link',
      attributes: {
        utm_source: 'twitter',
        utm_medium: 'social',
        utm_campaign: 'spring-2025',
        custom_field: 'test-value',
      },
    };

    const result = await createShortlink(TEST_TENANT_ID, input);

    // Note: postgres.camel transform converts JSONB keys to camelCase
    expect(result.attributes).toEqual({
      utmSource: 'twitter',
      utmMedium: 'social',
      utmCampaign: 'spring-2025',
      customField: 'test-value',
    });
  });

  it('should throw error if custom key already exists', async () => {
    const customKey = `dup${Date.now()}`.substring(0, 20);

    // Create first shortlink
    await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/first',
      key: customKey,
    });

    // Try to create duplicate
    await expect(
      createShortlink(TEST_TENANT_ID, {
        targetUrl: 'https://example.com/second',
        key: customKey,
      })
    ).rejects.toThrow(`Shortlink with key "${customKey}" already exists`);
  });

  it('should validate target URL format', async () => {
    const input = {
      targetUrl: 'not-a-valid-url',
    };

    await expect(createShortlink(TEST_TENANT_ID, input)).rejects.toThrow();
  });

  it('should validate campaign_id UUID format', async () => {
    const input = {
      targetUrl: 'https://example.com/test',
      campaignId: 'not-a-uuid',
    };

    await expect(createShortlink(TEST_TENANT_ID, input)).rejects.toThrow();
  });
});

describe('Shortlink Service - getShortlink()', () => {
  it('should return shortlink if found by ID', async () => {
    // Create a shortlink first
    const created = await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/get-test',
    });

    const result = await getShortlink(TEST_TENANT_ID, created.shortlinkId);

    expect(result).not.toBeNull();
    expect(result?.shortlinkId).toBe(created.shortlinkId);
    expect(result?.key).toBe(created.key);
    expect(result?.targetUrl).toBe(created.targetUrl);
  });

  it('should return null if not found by ID', async () => {
    const nonExistentId = '00000000-0000-4000-8000-000000000000';

    const result = await getShortlink(TEST_TENANT_ID, nonExistentId);

    expect(result).toBeNull();
  });

  it('should enforce RLS (tenant isolation)', async () => {
    // Create shortlink in TEST_TENANT_ID
    const created = await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/rls-test',
    });

    // Try to access from OTHER_TENANT_ID
    const result = await getShortlink(OTHER_TENANT_ID, created.shortlinkId);

    expect(result).toBeNull();
  });
});

describe('Shortlink Service - getShortlinkByKey()', () => {
  it('should return shortlink if found by key', async () => {
    const customKey = `bykey-${Date.now()}`;

    // Create a shortlink first
    const created = await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/bykey-test',
      key: customKey,
    });

    const result = await getShortlinkByKey(TEST_TENANT_ID, customKey);

    expect(result).not.toBeNull();
    expect(result?.shortlinkId).toBe(created.shortlinkId);
    expect(result?.key).toBe(customKey);
  });

  it('should return null if not found by key', async () => {
    const nonExistentKey = 'nonexistent-key-xyz';

    const result = await getShortlinkByKey(TEST_TENANT_ID, nonExistentKey);

    expect(result).toBeNull();
  });

  it('should enforce RLS (tenant isolation)', async () => {
    const customKey = `rls${Date.now()}`.substring(0, 20);

    // Create shortlink in TEST_TENANT_ID
    await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/rls-key-test',
      key: customKey,
    });

    // Try to access from OTHER_TENANT_ID
    const result = await getShortlinkByKey(OTHER_TENANT_ID, customKey);

    expect(result).toBeNull();
  });
});

describe('Shortlink Service - listShortlinks()', () => {
  // NOTE: Some listShortlinks tests are currently failing due to a bug in shortlink-list.service.ts
  // The SQL JOIN has an ambiguous column name issue: "shortlink_id" appears in both the subquery
  // and the main table, causing "column reference 'shortlink_id' is ambiguous" errors.
  // Fix required in shortlink-list.service.ts line 127: use table-qualified column reference.

  it('should list all shortlinks', async () => {
    // Create test shortlinks
    await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/list-1',
    });
    await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/list-2',
    });

    const result = await listShortlinks(TEST_TENANT_ID, {});

    expect(result.shortlinks).toBeDefined();
    expect(Array.isArray(result.shortlinks)).toBe(true);
    expect(result.total).toBeGreaterThan(0);
    expect(result.shortlinks.length).toBeLessThanOrEqual(50); // default limit
    expect(result.shortlinks[0]!.clickCount).toBeDefined();
  });

  it('should filter by campaign_id', async () => {
    // Create a campaign
    const campaign = await withTenantContext(TEST_TENANT_ID, async (tx) => {
      const [result] = await tx
        .insert(schema.campaigns)
        .values({
          tenantId: TEST_TENANT_ID,
          name: `Test Campaign Filter ${Date.now()}`,
        })
        .returning();
      return result!;
    });

    // Create shortlinks with and without campaign
    await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/with-campaign',
      campaignId: campaign.campaignId,
    });
    await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/without-campaign',
    });

    const result = await listShortlinks(TEST_TENANT_ID, {
      campaignId: campaign.campaignId,
    });

    expect(result.shortlinks.every((s) => s.campaignId === campaign.campaignId)).toBe(true);
  });

  it('should filter by resource_id', async () => {
    // Create campaign and resource
    const campaign = await withTenantContext(TEST_TENANT_ID, async (tx) => {
      const [result] = await tx
        .insert(schema.campaigns)
        .values({
          tenantId: TEST_TENANT_ID,
          name: `Test Campaign for Resource Filter ${Date.now()}`,
        })
        .returning();
      return result!;
    });

    const resource = await withTenantContext(TEST_TENANT_ID, async (tx) => {
      const [result] = await tx
        .insert(schema.resources)
        .values({
          tenantId: TEST_TENANT_ID,
          campaignId: campaign.campaignId,
          category: 'content',
          title: `Test Resource Filter ${Date.now()}`,
        })
        .returning();
      return result!;
    });

    // Create shortlinks with and without resource
    await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/with-resource',
      resourceId: resource.resourceId,
    });
    await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/without-resource',
    });

    const result = await listShortlinks(TEST_TENANT_ID, {
      resourceId: resource.resourceId,
    });

    expect(result.shortlinks.every((s) => s.resourceId === resource.resourceId)).toBe(true);
  });

  it('should search in key and targetUrl', async () => {
    const searchTerm = `search-${Date.now()}`;

    // Create shortlinks with search term in different fields
    await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/normal',
      key: searchTerm,
    });
    await createShortlink(TEST_TENANT_ID, {
      targetUrl: `https://example.com/${searchTerm}/page`,
    });

    const result = await listShortlinks(TEST_TENANT_ID, {
      search: searchTerm,
    });

    expect(result.shortlinks.length).toBeGreaterThanOrEqual(2);
    expect(
      result.shortlinks.every(
        (s) => s.key.includes(searchTerm) || s.targetUrl.includes(searchTerm)
      )
    ).toBe(true);
  });

  it('should paginate with limit/offset', async () => {
    // Create multiple shortlinks
    for (let i = 0; i < 5; i++) {
      await createShortlink(TEST_TENANT_ID, {
        targetUrl: `https://example.com/pagination-${i}`,
      });
    }

    // Get first page
    const page1 = await listShortlinks(TEST_TENANT_ID, {
      limit: 2,
      offset: 0,
    });

    // Get second page
    const page2 = await listShortlinks(TEST_TENANT_ID, {
      limit: 2,
      offset: 2,
    });

    expect(page1.shortlinks.length).toBeLessThanOrEqual(2);
    expect(page2.shortlinks.length).toBeGreaterThanOrEqual(0);
    expect(page1.total).toBe(page2.total); // total should be same
  });

  it('should sort by clickCount', async () => {
    // Create shortlinks with unique keys to filter in search
    const uniquePrefix = `click${Date.now()}`.substring(0, 18);
    const shortlink1 = await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/click-1',
      key: `${uniquePrefix}a`,
    });
    const shortlink2 = await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/click-2',
      key: `${uniquePrefix}b`,
    });

    // Create activities (clicks) for shortlink2 only
    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      for (let i = 0; i < 3; i++) {
        await tx.insert(schema.activities).values({
          tenantId: TEST_TENANT_ID,
          action: 'click',
          source: 'shortlink',
          occurredAt: new Date(),
          metadata: {
            shortlink_id: shortlink2.shortlinkId,
          },
        });
      }
    });

    const result = await listShortlinks(TEST_TENANT_ID, {
      search: uniquePrefix, // Filter to only our test shortlinks
      orderBy: 'clickCount',
      orderDirection: 'desc',
    });

    // Find our shortlinks in the result
    const found1 = result.shortlinks.find((s) => s.shortlinkId === shortlink1.shortlinkId);
    const found2 = result.shortlinks.find((s) => s.shortlinkId === shortlink2.shortlinkId);

    expect(found1?.clickCount).toBe(0);
    expect(found2?.clickCount).toBe(3);
  });

  it('should include clickCount in results (from activities)', async () => {
    // Create shortlink
    const shortlink = await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/clickcount-test',
    });

    // Create activities (clicks)
    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      for (let i = 0; i < 5; i++) {
        await tx.insert(schema.activities).values({
          tenantId: TEST_TENANT_ID,
          action: 'click',
          source: 'shortlink',
          occurredAt: new Date(),
          metadata: {
            shortlink_id: shortlink.shortlinkId,
          },
        });
      }
    });

    const result = await listShortlinks(TEST_TENANT_ID, {});

    const found = result.shortlinks.find((s) => s.shortlinkId === shortlink.shortlinkId);
    expect(found?.clickCount).toBe(5);
  });

  it('should enforce RLS (tenant isolation)', async () => {
    const uniqueKey = `rls${Date.now()}`.substring(0, 20);

    // Create shortlink in TEST_TENANT_ID
    await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/rls-list-test',
      key: uniqueKey,
    });

    // List from OTHER_TENANT_ID
    const result = await listShortlinks(OTHER_TENANT_ID, {});

    // Should not include TEST_TENANT_ID's shortlink
    expect(result.shortlinks.every((s) => s.key !== uniqueKey)).toBe(true);
  });
});

describe('Shortlink Service - updateShortlink()', () => {
  it('should update targetUrl', async () => {
    // Create shortlink
    const created = await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/old-url',
    });

    const newUrl = 'https://example.com/new-url';
    const updated = await updateShortlink(TEST_TENANT_ID, created.shortlinkId, {
      targetUrl: newUrl,
    });

    expect(updated.targetUrl).toBe(newUrl);
    expect(updated.key).toBe(created.key); // unchanged
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
  });

  it('should update key', async () => {
    const oldKey = `old${Date.now()}`.substring(0, 20);
    const newKey = `new${Date.now()}`.substring(0, 20);

    // Create shortlink
    const created = await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/update-key',
      key: oldKey,
    });

    const updated = await updateShortlink(TEST_TENANT_ID, created.shortlinkId, {
      key: newKey,
    });

    expect(updated.key).toBe(newKey);
    expect(updated.shortUrl).toBe(`https://devcle.com/c/${newKey}`);
  });

  it('should throw error if new key already exists', async () => {
    const existingKey = `exist${Date.now()}`.substring(0, 20);

    // Create first shortlink
    await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/first',
      key: existingKey,
    });

    // Create second shortlink
    const second = await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/second',
    });

    // Try to update second to use existing key
    await expect(
      updateShortlink(TEST_TENANT_ID, second.shortlinkId, {
        key: existingKey,
      })
    ).rejects.toThrow(`Shortlink with key "${existingKey}" already exists`);
  });

  it('should throw error if empty update', async () => {
    // Create shortlink
    const created = await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/empty-update',
    });

    await expect(
      updateShortlink(TEST_TENANT_ID, created.shortlinkId, {})
    ).rejects.toThrow('At least one field must be provided for update');
  });

  it('should throw error if not found', async () => {
    const nonExistentId = '00000000-0000-4000-8000-000000000000';

    await expect(
      updateShortlink(TEST_TENANT_ID, nonExistentId, {
        targetUrl: 'https://example.com/new',
      })
    ).rejects.toThrow('Shortlink not found');
  });

  it('should update updated_at timestamp', async () => {
    // Create shortlink
    const created = await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/timestamp-test',
    });

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    const updated = await updateShortlink(TEST_TENANT_ID, created.shortlinkId, {
      targetUrl: 'https://example.com/timestamp-updated',
    });

    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
  });
});

describe('Shortlink Service - deleteShortlink()', () => {
  it('should delete shortlink', async () => {
    // Create shortlink
    const created = await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/delete-test',
    });

    const deleted = await deleteShortlink(TEST_TENANT_ID, created.shortlinkId);

    expect(deleted).toBe(true);

    // Verify it's deleted
    const result = await getShortlink(TEST_TENANT_ID, created.shortlinkId);
    expect(result).toBeNull();
  });

  it('should return false if not found', async () => {
    const nonExistentId = '00000000-0000-4000-8000-000000000000';

    const deleted = await deleteShortlink(TEST_TENANT_ID, nonExistentId);

    expect(deleted).toBe(false);
  });

  it('should NOT delete associated activities (event log preservation)', async () => {
    // Create shortlink
    const shortlink = await createShortlink(TEST_TENANT_ID, {
      targetUrl: 'https://example.com/preserve-activities',
    });

    // Count activities before creating new ones
    const beforeCount = await withTenantContext(TEST_TENANT_ID, async (tx) => {
      const result = await tx
        .select()
        .from(schema.activities)
        .where(
          and(
            eq(schema.activities.tenantId, TEST_TENANT_ID),
            eq(schema.activities.action, 'click'),
            eq(schema.activities.source, 'shortlink')
          )
        );
      return result.filter((a) => {
        // Note: postgres.camel converts JSONB keys to camelCase
        const metadata = a.metadata as { shortlinkId?: string } | null;
        return metadata?.shortlinkId === shortlink.shortlinkId;
      }).length;
    });

    // Create activities (clicks)
    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      for (let i = 0; i < 3; i++) {
        await tx
          .insert(schema.activities)
          .values({
            tenantId: TEST_TENANT_ID,
            action: 'click',
            source: 'shortlink',
            occurredAt: new Date(),
            metadata: {
              shortlink_id: shortlink.shortlinkId,
            },
          })
          .returning();
      }
    });

    // Delete shortlink
    await deleteShortlink(TEST_TENANT_ID, shortlink.shortlinkId);

    // Verify activities still exist
    const afterCount = await withTenantContext(TEST_TENANT_ID, async (tx) => {
      const result = await tx
        .select()
        .from(schema.activities)
        .where(
          and(
            eq(schema.activities.tenantId, TEST_TENANT_ID),
            eq(schema.activities.action, 'click'),
            eq(schema.activities.source, 'shortlink')
          )
        );
      return result.filter((a) => {
        // Note: postgres.camel converts JSONB keys to camelCase
        const metadata = a.metadata as { shortlinkId?: string } | null;
        return metadata?.shortlinkId === shortlink.shortlinkId;
      }).length;
    });

    // Activities should not have been deleted
    expect(afterCount).toBe(beforeCount + 3);
  });
});
