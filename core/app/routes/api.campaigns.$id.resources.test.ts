/**
 * Campaign Resources API Tests
 *
 * Integration tests for GET /api/campaigns/:id/resources endpoint.
 * Tests use real database connections and authentication (no mocks).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runInTenant, ensureTenantExists } from '../../db/tenant-test-utils.js';
import { closeDb } from '../../db/connection.js';
import { hashPassword } from '../../services/auth.service.js';
import * as schema from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { loader as resourcesLoader } from './api.campaigns.$id.resources.js';
import { getSession, commitSession } from '../sessions.server.js';

const TENANT = 'test-campaign-resources';

// Test campaign ID (created in beforeAll)
let testCampaignId: string;

// Test user credentials
let userId: string | null = null;
let cookie: string | null = null;

// Test resource IDs for cleanup
let testResourceIds: string[] = [];

/**
 * Create authenticated user session for testing
 */
async function createUserSession(): Promise<{ userId: string; cookie: string }> {
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword('test-password');

  await runInTenant(TENANT, async (tx) => {
    await tx.insert(schema.users).values({
      userId: id,
      tenantId: TENANT,
      email: `resource-test-${id}@example.com`,
      passwordHash,
      displayName: 'Resource Test User',
      role: 'member',
      disabled: false,
    });
  });

  const request = new Request('http://localhost/login');
  const session = await getSession(request);
  session.set('userId', id);
  session.set('tenantId', TENANT);
  const sessionCookie = await commitSession(session);

  return { userId: id, cookie: sessionCookie };
}

/**
 * Seed test campaign and resources
 */
async function seedResources(): Promise<string[]> {
  const resourceIds: string[] = [];

  // Create campaign first
  testCampaignId = crypto.randomUUID();

  await runInTenant(TENANT, async (tx) => {
    // Insert test campaign
    await tx.insert(schema.campaigns).values({
      campaignId: testCampaignId,
      tenantId: TENANT,
      name: 'Test Campaign for Resources',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    });

    // Insert resources
    const inserted = await tx
      .insert(schema.resources)
      .values([
        {
          resourceId: '50001000-0000-4000-8000-000000000001',
          tenantId: TENANT,
          category: 'event',
          groupKey: 'test-event-2025',
          title: 'Test Event 2025',
          url: 'https://example.com/event-2025',
          externalId: 'test-event-1',
          campaignId: testCampaignId,
          attributes: { location: 'Tokyo', capacity: 100 },
        },
        {
          resourceId: '50001000-0000-4000-8000-000000000002',
          tenantId: TENANT,
          category: 'blog',
          groupKey: null,
          title: 'Test Blog Post',
          url: 'https://blog.example.com/test-post',
          externalId: null,
          campaignId: testCampaignId,
          attributes: { author: 'alice', tags: ['test', 'blog'] },
        },
        {
          resourceId: '50001000-0000-4000-8000-000000000003',
          tenantId: TENANT,
          category: 'event',
          groupKey: 'test-event-2025',
          title: 'Test Workshop 2025',
          url: 'https://example.com/workshop-2025',
          externalId: 'test-event-2',
          campaignId: testCampaignId,
          attributes: { location: 'Osaka', capacity: 50 },
        },
      ])
      .onConflictDoNothing()
      .returning({ resourceId: schema.resources.resourceId });

    resourceIds.push(...inserted.map((row) => row.resourceId));
  });

  return resourceIds;
}

/**
 * Clean up test data
 */
async function cleanup() {
  await runInTenant(TENANT, async (tx) => {
    // Clean up resources
    if (testResourceIds.length > 0) {
      await tx
        .delete(schema.resources)
        .where(eq(schema.resources.tenantId, TENANT));
    }

    // Clean up campaign
    if (testCampaignId) {
      await tx
        .delete(schema.campaigns)
        .where(eq(schema.campaigns.campaignId, testCampaignId));
    }

    // Clean up user
    if (userId) {
      await tx.delete(schema.users).where(eq(schema.users.userId, userId));
    }
  });
}

// Setup before all tests
beforeAll(async () => {
  await ensureTenantExists(TENANT);
  testResourceIds = await seedResources();
  const auth = await createUserSession();
  userId = auth.userId;
  cookie = auth.cookie;
});

// Cleanup after all tests
afterAll(async () => {
  await cleanup();
  await closeDb();
});

// ==================== Tests ====================

describe('GET /api/campaigns/:id/resources', () => {
  it('should return resources with default pagination', async () => {
    const request = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/resources`,
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await resourcesLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.resources).toBeInstanceOf(Array);
    expect(data.total).toBeGreaterThanOrEqual(3); // Our 3 test resources
    expect(data.resources.length).toBeGreaterThanOrEqual(3);
    expect(data.resources[0]).toHaveProperty('resourceId');
    expect(data.resources[0]).toHaveProperty('campaignId', testCampaignId);
  });

  it('should respect limit parameter', async () => {
    const request = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/resources?limit=2`,
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await resourcesLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    const data = await response.json();
    expect(data.resources.length).toBe(2);
    expect(data.total).toBeGreaterThanOrEqual(3); // Total unchanged
  });

  it('should filter by category', async () => {
    const request = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/resources?category=event`,
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await resourcesLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    const data = await response.json();
    expect(data.resources.length).toBe(2); // 2 event resources
    data.resources.forEach((resource: { category: string }) => {
      expect(resource.category).toBe('event');
    });
    expect(data.total).toBe(2);
  });

  it('should return 404 for non-existent campaign', async () => {
    const request = new Request(
      'http://localhost/api/campaigns/99999999-9999-4999-8999-999999999999/resources',
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await resourcesLoader({
      request,
      params: { id: '99999999-9999-4999-8999-999999999999' },
      context: {},
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Campaign not found');
  });

  it('should return 400 for invalid campaign ID', async () => {
    const request = new Request(
      'http://localhost/api/campaigns/invalid-uuid/resources',
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await resourcesLoader({
      request,
      params: { id: 'invalid-uuid' },
      context: {},
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid campaign ID format');
  });

  it('should return 401 for unauthenticated request', async () => {
    const request = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/resources`
    );

    const response = await resourcesLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });
});
