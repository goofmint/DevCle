/**
 * Campaign Activities API Tests
 *
 * Integration tests for GET /api/campaigns/:id/activities endpoint.
 * Tests use real database connections and authentication (no mocks).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runInTenant, ensureTenantExists } from '../../db/tenant-test-utils.js';
import { closeDb } from '../../db/connection.js';
import { hashPassword } from '../../services/auth.service.js';
import { createDeveloper, deleteDeveloper } from '../../services/drm.service.js';
import * as schema from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { loader as activitiesLoader } from './api.campaigns.$id.activities.js';
import { getSession, commitSession } from '../sessions.server.js';

const TENANT = 'test-campaign-activities';

// Test campaign ID (created in beforeAll)
let testCampaignId: string;

// Test user credentials
let userId: string | null = null;
let cookie: string | null = null;

// Test developer ID for cleanup
let developerId: string | null = null;

// Test activity IDs for cleanup
let testActivityIds: string[] = [];

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
      email: `activity-test-${id}@example.com`,
      passwordHash,
      displayName: 'Activity Test User',
      role: 'member',
      disabled: false,
    });
  });

  const request = new Request('http://localhost/login');
  const session = await getSession(request);
  session.set('userId', id);
  session.set('tenantId', TENANT);
  const sessionCookie = await commitSession(session);

  // Extract only the cookie name=value portion (before first ';')
  const cookieValue = sessionCookie.split(';')[0] ?? '';

  return { userId: id, cookie: cookieValue };
}

/**
 * Seed test campaign and activities
 */
async function seedActivities(): Promise<string[]> {
  const activityIds: string[] = [];

  // Create campaign first
  testCampaignId = crypto.randomUUID();

  await runInTenant(TENANT, async (tx) => {
    // Insert test campaign
    await tx.insert(schema.campaigns).values({
      campaignId: testCampaignId,
      tenantId: TENANT,
      name: 'Test Campaign for Activities',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    });
  });

  // Create a test developer
  const developer = await createDeveloper(TENANT, {
    displayName: 'Test Developer',
    primaryEmail: 'testdev@example.com',
    orgId: null,
  });

  developerId = developer.developerId;

  await runInTenant(TENANT, async (tx) => {
    // Insert activities
    const insertedActivities = await tx
      .insert(schema.activities)
      .values([
        {
          activityId: '20001000-0000-4000-8000-000000000001',
          tenantId: TENANT,
          developerId,
          accountId: null,
          anonId: null,
          resourceId: null,
          action: 'attend',
          occurredAt: new Date('2025-03-01T10:00:00Z'),
          recordedAt: new Date('2025-03-01T10:05:00Z'),
          source: 'test',
          sourceRef: 'test-ref-1',
          category: 'event',
          groupKey: 'test-event',
          metadata: { utm_source: 'test' },
          confidence: '1.0',
          value: '5000',
          dedupKey: `test-dedup-1-${Date.now()}`,
          ingestedAt: new Date(),
        },
        {
          activityId: '20001000-0000-4000-8000-000000000002',
          tenantId: TENANT,
          developerId,
          accountId: null,
          anonId: null,
          resourceId: null,
          action: 'click',
          occurredAt: new Date('2025-02-28T15:00:00Z'),
          recordedAt: new Date('2025-02-28T15:05:00Z'),
          source: 'test',
          sourceRef: 'test-ref-2',
          category: 'ad',
          groupKey: null,
          metadata: { utm_medium: 'test' },
          confidence: '1.0',
          value: null,
          dedupKey: `test-dedup-2-${Date.now()}`,
          ingestedAt: new Date(),
        },
        {
          activityId: '20001000-0000-4000-8000-000000000003',
          tenantId: TENANT,
          developerId,
          accountId: null,
          anonId: null,
          resourceId: null,
          action: 'attend',
          occurredAt: new Date('2025-02-27T12:00:00Z'),
          recordedAt: new Date('2025-02-27T12:05:00Z'),
          source: 'test',
          sourceRef: 'test-ref-3',
          category: 'event',
          groupKey: 'test-event',
          metadata: null,
          confidence: '0.9',
          value: '3000',
          dedupKey: `test-dedup-3-${Date.now()}`,
          ingestedAt: new Date(),
        },
      ])
      .onConflictDoNothing()
      .returning({ activityId: schema.activities.activityId });

    activityIds.push(...insertedActivities.map((row) => row.activityId));

    // Link activities to campaign via activity_campaigns junction table
    await tx
      .insert(schema.activityCampaigns)
      .values(
        activityIds.map((activityId) => ({
          tenantId: TENANT,
          activityId,
          campaignId: testCampaignId,
          weight: '1.0',
        }))
      )
      .onConflictDoNothing();
  });

  return activityIds;
}

/**
 * Clean up test data
 */
async function cleanup() {
  await runInTenant(TENANT, async (tx) => {
    // Clean up activity_campaigns links
    if (testActivityIds.length > 0) {
      await tx
        .delete(schema.activityCampaigns)
        .where(eq(schema.activityCampaigns.tenantId, TENANT));
    }

    // Clean up activities
    if (testActivityIds.length > 0) {
      await tx
        .delete(schema.activities)
        .where(eq(schema.activities.tenantId, TENANT));
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

  // Clean up developer
  if (developerId) {
    await deleteDeveloper(TENANT, developerId);
  }
}

// Setup before all tests
beforeAll(async () => {
  await ensureTenantExists(TENANT);
  testActivityIds = await seedActivities();
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

describe('GET /api/campaigns/:id/activities', () => {
  it('should return activities with default pagination', async () => {
    const request = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/activities`,
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await activitiesLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    expect(response.status).toBe(200);

    const data = (await response.json()) as {
      activities: Array<{ activityId: string; action: string }>;
      total: number;
    };
    expect(data.activities).toBeInstanceOf(Array);
    expect(data.total).toBeGreaterThanOrEqual(3); // Our 3 test activities
    expect(data.activities.length).toBeGreaterThanOrEqual(3);
    expect(data.activities[0]).toHaveProperty('activityId');
    expect(data.activities[0]).toHaveProperty('action');
  });

  it('should respect limit parameter', async () => {
    const request = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/activities?limit=2`,
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await activitiesLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    const data = (await response.json()) as {
      activities: Array<{ activityId: string; action: string }>;
      total: number;
    };
    expect(data.activities.length).toBe(2);
    expect(data.total).toBeGreaterThanOrEqual(3); // Total unchanged
  });

  it('should filter by action', async () => {
    const request = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/activities?action=attend`,
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await activitiesLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    const data = (await response.json()) as {
      activities: Array<{ activityId: string; action: string }>;
      total: number;
    };
    expect(data.activities.length).toBe(2); // 2 attend activities
    data.activities.forEach((activity: { action: string }) => {
      expect(activity.action).toBe('attend');
    });
    expect(data.total).toBe(2);
  });

  it('should sort by occurredAt DESC', async () => {
    const request = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/activities`,
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await activitiesLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    const data = (await response.json()) as unknown as {
      activities: Array<{ activityId: string; action: string; occurredAt: string }>;
      total: number;
    };

    // Activities should be sorted by occurredAt DESC (most recent first)
    // Our test data: 2025-03-01, 2025-02-28, 2025-02-27
    expect(data.activities.length).toBeGreaterThanOrEqual(3);
    const first = new Date(data.activities[0]!.occurredAt);
    const second = new Date(data.activities[1]!.occurredAt);
    expect(first >= second).toBe(true);
  });

  it('should return 404 for non-existent campaign', async () => {
    const request = new Request(
      'http://localhost/api/campaigns/99999999-9999-4999-8999-999999999999/activities',
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await activitiesLoader({
      request,
      params: { id: '99999999-9999-4999-8999-999999999999' },
      context: {},
    });

    expect(response.status).toBe(404);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe('Campaign not found');
  });

  it('should return 400 for invalid campaign ID', async () => {
    const request = new Request(
      'http://localhost/api/campaigns/invalid-uuid/activities',
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await activitiesLoader({
      request,
      params: { id: 'invalid-uuid' },
      context: {},
    });

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe('Invalid campaign ID format');
  });

  it('should return 401 for unauthenticated request', async () => {
    const request = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/activities`
    );

    const response = await activitiesLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    expect(response.status).toBe(401);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe('Unauthorized');
  });
});
