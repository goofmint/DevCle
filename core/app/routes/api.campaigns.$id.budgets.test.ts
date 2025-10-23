/**
 * Campaign Budgets API Tests
 *
 * Integration tests for GET /api/campaigns/:id/budgets endpoint.
 * Tests use real database connections and authentication (no mocks).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runInTenant, ensureTenantExists } from '../../db/tenant-test-utils.js';
import { closeDb } from '../../db/connection.js';
import { hashPassword } from '../../services/auth.service.js';
import * as schema from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { loader as budgetsLoader } from './api.campaigns.$id.budgets.js';
import { getSession, commitSession } from '../sessions.server.js';

const TENANT = 'test-campaign-budgets';

// Test campaign ID (created in beforeAll)
let testCampaignId: string;

// Test user credentials
let userId: string | null = null;
let cookie: string | null = null;

// Test budget IDs for cleanup
let testBudgetIds: string[] = [];

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
      email: `budget-test-${id}@example.com`,
      passwordHash,
      displayName: 'Budget Test User',
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
 * Seed test campaign and budgets
 */
async function seedBudgets(): Promise<string[]> {
  const budgetIds: string[] = [];

  // Create campaign first
  testCampaignId = crypto.randomUUID();

  await runInTenant(TENANT, async (tx) => {
    // Insert test campaign
    await tx.insert(schema.campaigns).values({
      campaignId: testCampaignId,
      tenantId: TENANT,
      name: 'Test Campaign for Budgets',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    });

    // Insert budgets
    const inserted = await tx
      .insert(schema.budgets)
      .values([
        {
          budgetId: '40001000-0000-4000-8000-000000000001',
          tenantId: TENANT,
          campaignId: testCampaignId,
          category: 'labor',
          amount: '50000',
          currency: 'JPY',
          spentAt: '2025-03-01',
          source: 'form',
          memo: 'Test labor cost 1',
          meta: { hours: 100 },
        },
        {
          budgetId: '40001000-0000-4000-8000-000000000002',
          tenantId: TENANT,
          campaignId: testCampaignId,
          category: 'venue',
          amount: '100000',
          currency: 'JPY',
          spentAt: '2025-02-15',
          source: 'form',
          memo: 'Test venue rental',
          meta: null,
        },
        {
          budgetId: '40001000-0000-4000-8000-000000000003',
          tenantId: TENANT,
          campaignId: testCampaignId,
          category: 'labor',
          amount: '30000',
          currency: 'JPY',
          spentAt: '2025-02-20',
          source: 'api',
          memo: 'Test labor cost 2',
          meta: { hours: 60 },
        },
      ])
      .onConflictDoNothing()
      .returning({ budgetId: schema.budgets.budgetId });

    budgetIds.push(...inserted.map((row) => row.budgetId));
  });

  return budgetIds;
}

/**
 * Clean up test data
 */
async function cleanup() {
  await runInTenant(TENANT, async (tx) => {
    // Clean up budgets
    if (testBudgetIds.length > 0) {
      await tx
        .delete(schema.budgets)
        .where(eq(schema.budgets.tenantId, TENANT));
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
  testBudgetIds = await seedBudgets();
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

describe('GET /api/campaigns/:id/budgets', () => {
  it('should return budgets with default pagination', async () => {
    const request = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/budgets`,
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await budgetsLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.budgets).toBeInstanceOf(Array);
    expect(data.total).toBeGreaterThanOrEqual(3); // Our 3 test budgets
    expect(data.budgets.length).toBeGreaterThanOrEqual(3);
    expect(data.budgets[0]).toHaveProperty('budgetId');
    expect(data.budgets[0]).toHaveProperty('campaignId', testCampaignId);
  });

  it('should respect limit parameter', async () => {
    const request = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/budgets?limit=2`,
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await budgetsLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    const data = await response.json();
    expect(data.budgets.length).toBe(2);
    expect(data.total).toBeGreaterThanOrEqual(3); // Total unchanged
  });

  it('should respect offset parameter', async () => {
    const firstRequest = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/budgets?limit=1&offset=0`,
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const secondRequest = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/budgets?limit=1&offset=1`,
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const firstResponse = await budgetsLoader({
      request: firstRequest,
      params: { id: testCampaignId },
      context: {},
    });

    const secondResponse = await budgetsLoader({
      request: secondRequest,
      params: { id: testCampaignId },
      context: {},
    });

    const firstData = await firstResponse.json();
    const secondData = await secondResponse.json();

    // Different budgets on different pages
    expect(firstData.budgets[0].budgetId).not.toBe(
      secondData.budgets[0].budgetId
    );
  });

  it('should filter by category', async () => {
    const request = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/budgets?category=labor`,
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await budgetsLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    const data = await response.json();
    expect(data.budgets.length).toBe(2); // 2 labor budgets
    data.budgets.forEach((budget: { category: string }) => {
      expect(budget.category).toBe('labor');
    });
    expect(data.total).toBe(2);
  });

  it('should return 404 for non-existent campaign', async () => {
    const request = new Request(
      'http://localhost/api/campaigns/99999999-9999-4999-8999-999999999999/budgets',
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await budgetsLoader({
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
      'http://localhost/api/campaigns/invalid-uuid/budgets',
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await budgetsLoader({
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
      `http://localhost/api/campaigns/${testCampaignId}/budgets`
    );

    const response = await budgetsLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 for invalid query parameters', async () => {
    const request = new Request(
      `http://localhost/api/campaigns/${testCampaignId}/budgets?limit=invalid`,
      {
        headers: { Cookie: cookie ?? '' },
      }
    );

    const response = await budgetsLoader({
      request,
      params: { id: testCampaignId },
      context: {},
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid query parameters');
  });
});
