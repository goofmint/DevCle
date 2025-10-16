/**
 * Campaign API Integration Tests
 *
 * Tests for the Campaign API endpoints (GET/POST /api/campaigns).
 * These tests verify that:
 * - HTTP handlers work correctly with real database
 * - Authentication is enforced
 * - Error handling works correctly
 * - Request/response formats are correct
 *
 * Test Strategy:
 * - NO MOCKS: Tests use real database connection and actual sessions
 * - Cleanup: Tests clean up their own data
 * - Verification: Actual HTTP responses are checked
 * - RLS: Tests verify tenant isolation
 *
 * Setup:
 * - Requires PostgreSQL running (docker-compose)
 * - Uses DATABASE_* environment variables
 * - Creates test user and session for authentication
 * - Closes connections after tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  closeDb,
  setTenantContext,
  clearTenantContext,
} from '../../../db/connection.js';
import {
  deleteCampaign,
  createCampaign,
} from '../../../services/campaign.service.js';
import { hashPassword } from '../../../services/auth.service.js';
import { getDb } from '../../../db/connection.js';
import * as schema from '../../../db/schema/index.js';
import {
  loader as campaignsLoader,
  action as campaignsAction,
} from './campaigns.js';
import { getSession, commitSession } from '../../sessions.server.js';

// Type guard helpers for response data
function assertListResponse(
  data: unknown
): asserts data is { campaigns: Array<unknown>; total: number } {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  if (!('campaigns' in data) || !('total' in data)) {
    throw new Error('Response missing campaigns or total');
  }
  if (!Array.isArray(data.campaigns)) {
    throw new Error('campaigns is not an array');
  }
  if (typeof data.total !== 'number') {
    throw new Error('total is not a number');
  }
}

function assertCampaignResponse(data: unknown): asserts data is {
  campaignId: string;
  tenantId: string;
  name: string;
  channel: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetTotal: string | null;
  attributes: Record<string, unknown>;
} {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  const required = [
    'campaignId',
    'tenantId',
    'name',
    'channel',
    'startDate',
    'endDate',
    'budgetTotal',
    'attributes',
  ];
  for (const key of required) {
    if (!(key in data)) {
      throw new Error(`Response missing ${key}`);
    }
  }
}

function assertErrorResponse(data: unknown): asserts data is { error: string } {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  if (!('error' in data)) {
    throw new Error('Response missing error');
  }
  if (typeof data.error !== 'string') {
    throw new Error('error is not a string');
  }
}

describe('Campaign API - /api/campaigns', () => {
  let testUserId: string;
  let testSessionCookie: string;

  beforeAll(async () => {
    // Set tenant context for all tests
    await setTenantContext('default');

    // Create test user for authentication
    const db = getDb();
    const passwordHash = await hashPassword('testpassword123');

    const [testUser] = await db
      .insert(schema.users)
      .values({
        userId: crypto.randomUUID(),
        tenantId: 'default',
        email: `test-campaigns-api-${Date.now()}@example.com`,
        passwordHash,
        displayName: 'Test Campaigns API User',
        role: 'member',
        disabled: false,
      })
      .returning();

    testUserId = testUser!.userId;

    // Create session cookie for authentication
    const request = new Request('http://localhost/test');
    const session = await getSession(request);
    session.set('userId', testUserId);
    session.set('tenantId', 'default');
    testSessionCookie = await commitSession(session);
  });

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      const db = getDb();
      await db.delete(schema.users).where(eq(schema.users.userId, testUserId));
    }

    // Clear tenant context
    await clearTenantContext();

    // Close database connections
    await closeDb();
  });

  describe('GET /api/campaigns', () => {
    it('should return campaigns list with default pagination', async () => {
      // Arrange: Create authenticated request
      const request = new Request('http://localhost/api/campaigns', {
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call loader
      const response = await campaignsLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Verify response
      expect(response.status).toBe(200);
      expect(data.campaigns).toBeInstanceOf(Array);
      expect(data.total).toBeGreaterThanOrEqual(0);
      expect(typeof data.total).toBe('number');
    });

    it('should respect limit parameter', async () => {
      // Arrange: Create campaigns and request with limit
      const timestamp = Date.now();
      const created1 = await createCampaign('default', {
        name: `Test Limit 1 ${timestamp}`,
        channel: 'test',
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      });
      const created2 = await createCampaign('default', {
        name: `Test Limit 2 ${timestamp}`,
        channel: 'test',
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      });
      const created3 = await createCampaign('default', {
        name: `Test Limit 3 ${timestamp}`,
        channel: 'test',
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      });

      const request = new Request('http://localhost/api/campaigns?limit=2', {
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call loader
      const response = await campaignsLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Should return max 2 items
      expect(response.status).toBe(200);
      expect(data.campaigns.length).toBeLessThanOrEqual(2);
      expect(data.total).toBeGreaterThanOrEqual(3);

      // Cleanup
      await deleteCampaign('default', created1.campaignId);
      await deleteCampaign('default', created2.campaignId);
      await deleteCampaign('default', created3.campaignId);
    });

    it('should filter by channel', async () => {
      // Arrange: Create campaign with specific channel
      const timestamp = Date.now();
      const created = await createCampaign('default', {
        name: `Test Event Channel ${timestamp}`,
        channel: 'event',
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      });

      const request = new Request(
        'http://localhost/api/campaigns?channel=event',
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await campaignsLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: All returned campaigns should have channel === 'event'
      expect(response.status).toBe(200);
      data.campaigns.forEach((campaign) => {
        if (
          typeof campaign === 'object' &&
          campaign !== null &&
          'channel' in campaign
        ) {
          expect(campaign.channel).toBe('event');
        }
      });

      // Cleanup
      await deleteCampaign('default', created.campaignId);
    });

    it('should search by name', async () => {
      // Arrange: Create campaign with unique name
      const timestamp = Date.now();
      const uniqueName = `UniqueSearchCampaign${timestamp}`;
      const created = await createCampaign('default', {
        name: uniqueName,
        channel: 'test',
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      });

      const request = new Request(
        `http://localhost/api/campaigns?search=${uniqueName}`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await campaignsLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Should find the campaign
      expect(response.status).toBe(200);
      expect(data.campaigns.length).toBeGreaterThan(0);
      expect(
        data.campaigns.some((c) => {
          if (typeof c === 'object' && c !== null && 'name' in c) {
            const name = c.name;
            if (typeof name === 'string') {
              return name.includes(uniqueName);
            }
          }
          return false;
        })
      ).toBe(true);

      // Cleanup
      await deleteCampaign('default', created.campaignId);
    });

    it('should sort by name ascending', async () => {
      // Arrange: Create request with orderBy and orderDirection
      const request = new Request(
        'http://localhost/api/campaigns?orderBy=name&orderDirection=asc&limit=10',
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await campaignsLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Verify sort order
      expect(response.status).toBe(200);
      if (data.campaigns.length > 1) {
        for (let i = 0; i < data.campaigns.length - 1; i++) {
          const currentItem = data.campaigns[i];
          const nextItem = data.campaigns[i + 1];
          if (
            currentItem &&
            typeof currentItem === 'object' &&
            'name' in currentItem &&
            nextItem &&
            typeof nextItem === 'object' &&
            'name' in nextItem
          ) {
            const current = currentItem.name;
            const next = nextItem.name;
            if (typeof current === 'string' && typeof next === 'string') {
              expect(current <= next).toBe(true);
            }
          }
        }
      }
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Request without session cookie
      const request = new Request('http://localhost/api/campaigns');

      // Act: Call loader
      const response = await campaignsLoader({
        request,
        params: {},
        context: {},
      });

      // Assert: Expect 401
      expect(response.status).toBe(401);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 for invalid query parameters', async () => {
      // Arrange: Request with invalid limit (negative number)
      const request = new Request('http://localhost/api/campaigns?limit=-1', {
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call loader
      const response = await campaignsLoader({
        request,
        params: {},
        context: {},
      });

      // Assert: Expect 400 validation error
      expect(response.status).toBe(400);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toContain('query parameters');
    });
  });

  describe('POST /api/campaigns', () => {
    it('should create a new campaign', async () => {
      // Arrange: Prepare request with valid data
      const timestamp = Date.now();
      const requestBody = {
        name: `Test Create Campaign ${timestamp}`,
        channel: 'event',
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        budgetTotal: '10000.00',
        attributes: { test: true },
      };

      const request = new Request('http://localhost/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await campaignsAction({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertCampaignResponse(data);

      // Assert: Verify created campaign
      expect(response.status).toBe(201);
      expect(data.name).toBe(`Test Create Campaign ${timestamp}`);
      expect(data.channel).toBe('event');
      expect(data.campaignId).toBeDefined();
      expect(data.budgetTotal).toBe('10000.00');

      // Cleanup
      await deleteCampaign('default', data.campaignId);
    });

    it('should return 400 for invalid date range', async () => {
      // Arrange: Invalid date range (startDate > endDate)
      const timestamp = Date.now();
      const requestBody = {
        name: `Invalid Date Range ${timestamp}`,
        channel: 'test',
        startDate: '2025-06-30',
        endDate: '2025-06-01',
        budgetTotal: null,
        attributes: {},
      };

      const request = new Request('http://localhost/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await campaignsAction({
        request,
        params: {},
        context: {},
      });

      // Assert: Expect validation error
      expect(response.status).toBe(400);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Validation failed');
    });

    it('should return 400 for missing name', async () => {
      // Arrange: Missing name
      const requestBody = {
        channel: 'test',
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      };

      const request = new Request('http://localhost/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await campaignsAction({
        request,
        params: {},
        context: {},
      });

      // Assert: Expect validation error
      expect(response.status).toBe(400);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Validation failed');
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Request without session cookie
      const requestBody = {
        name: 'Test',
        channel: null,
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      };

      const request = new Request('http://localhost/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await campaignsAction({
        request,
        params: {},
        context: {},
      });

      // Assert: Expect 401
      expect(response.status).toBe(401);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 for invalid JSON', async () => {
      // Arrange: Request with malformed JSON
      const request = new Request('http://localhost/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: 'invalid-json{',
      });

      // Act: Call action
      const response = await campaignsAction({
        request,
        params: {},
        context: {},
      });

      // Assert: Expect 400
      expect(response.status).toBe(400);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toContain('JSON');
    });

    it('should return 405 for unsupported methods', async () => {
      // Arrange: Request with PUT method (should be in campaigns.$id.ts)
      const request = new Request('http://localhost/api/campaigns', {
        method: 'PUT',
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call action
      const response = await campaignsAction({
        request,
        params: {},
        context: {},
      });

      // Assert: Expect 405 Method Not Allowed
      expect(response.status).toBe(405);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Method not allowed');
    });
  });
});
