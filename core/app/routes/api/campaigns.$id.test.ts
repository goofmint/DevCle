/**
 * Campaign API Integration Tests - Single Resource
 *
 * Tests for the Campaign API endpoints (GET/PUT/DELETE /api/campaigns/:id).
 * These tests verify that:
 * - HTTP handlers work correctly with real database
 * - Authentication is enforced
 * - Path parameter validation works
 * - Error handling works correctly (404, 400, etc.)
 *
 * Test Strategy:
 * - NO MOCKS: Tests use real database connection and actual sessions
 * - Cleanup: Tests clean up their own data
 * - Verification: Actual HTTP responses are checked
 * - RLS: Tests verify tenant isolation
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
  getCampaign,
} from '../../../services/campaign.service.js';
import { hashPassword } from '../../../services/auth.service.js';
import { getDb } from '../../../db/connection.js';
import * as schema from '../../../db/schema/index.js';
import {
  loader as campaignDetailLoader,
  action as campaignDetailAction,
} from './campaigns.$id.js';
import { getSession, commitSession } from '../../sessions.server.js';

// Type guard helpers for response data
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

describe('Campaign API - /api/campaigns/:id', () => {
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
        email: `test-campaign-detail-${Date.now()}@example.com`,
        passwordHash,
        displayName: 'Test Campaign Detail User',
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
    const setCookieHeader = await commitSession(session);
    testSessionCookie = setCookieHeader.split(';')[0]!;
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

  describe('GET /api/campaigns/:id', () => {
    it('should return campaign by ID', async () => {
      // Arrange: Create a campaign
      const timestamp = Date.now();
      const created = await createCampaign('default', {
        name: `Test Get Detail ${timestamp}`,
        channel: 'event',
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        budgetTotal: '5000.00',
        attributes: { test: 'get' },
      });

      const request = new Request(
        `http://localhost/api/campaigns/${created.campaignId}`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await campaignDetailLoader({
        request,
        params: { id: created.campaignId },
        context: {},
      });
      const data: unknown = await response.json();
      assertCampaignResponse(data);

      // Assert: Verify returned campaign
      expect(response.status).toBe(200);
      expect(data.campaignId).toBe(created.campaignId);
      expect(data.name).toBe(`Test Get Detail ${timestamp}`);
      expect(data.channel).toBe('event');
      expect(data.budgetTotal).toBe('5000.00');

      // Cleanup
      await deleteCampaign('default', created.campaignId);
    });

    it('should return 404 for non-existent ID', async () => {
      // Arrange: Use non-existent UUID
      const nonExistentId = '99999999-9999-4999-8999-999999999999';
      const request = new Request(
        `http://localhost/api/campaigns/${nonExistentId}`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await campaignDetailLoader({
        request,
        params: { id: nonExistentId },
        context: {},
      });

      // Assert: Expect 404
      expect(response.status).toBe(404);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Campaign not found');
    });

    it('should return 400 for invalid UUID format', async () => {
      // Arrange: Use invalid UUID
      const invalidId = 'invalid-uuid';
      const request = new Request(
        `http://localhost/api/campaigns/${invalidId}`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await campaignDetailLoader({
        request,
        params: { id: invalidId },
        context: {},
      });

      // Assert: Expect 400
      expect(response.status).toBe(400);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Invalid campaign ID format');
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Create campaign and request without auth
      const timestamp = Date.now();
      const created = await createCampaign('default', {
        name: `Test Unauth ${timestamp}`,
        channel: null,
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      });

      const request = new Request(
        `http://localhost/api/campaigns/${created.campaignId}`
      );

      // Act: Call loader
      const response = await campaignDetailLoader({
        request,
        params: { id: created.campaignId },
        context: {},
      });

      // Assert: Expect 401
      expect(response.status).toBe(401);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Unauthorized');

      // Cleanup
      await deleteCampaign('default', created.campaignId);
    });
  });

  describe('PUT /api/campaigns/:id', () => {
    it('should update campaign', async () => {
      // Arrange: Create campaign and prepare update data
      const timestamp = Date.now();
      const created = await createCampaign('default', {
        name: `Test Update ${timestamp}`,
        channel: 'event',
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        budgetTotal: '5000.00',
        attributes: { original: true },
      });

      const updateData = {
        name: `Updated Name ${timestamp}`,
        budgetTotal: '7000.00',
        attributes: { updated: true },
      };

      const request = new Request(
        `http://localhost/api/campaigns/${created.campaignId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: testSessionCookie,
          },
          body: JSON.stringify(updateData),
        }
      );

      // Act: Call action
      const response = await campaignDetailAction({
        request,
        params: { id: created.campaignId },
        context: {},
      });
      const data: unknown = await response.json();
      assertCampaignResponse(data);

      // Assert: Verify updated data
      expect(response.status).toBe(200);
      expect(data.name).toBe(`Updated Name ${timestamp}`);
      expect(data.budgetTotal).toBe('7000.00');
      expect(data.channel).toBe('event'); // Unchanged

      // Cleanup
      await deleteCampaign('default', created.campaignId);
    });

    it('should support partial updates', async () => {
      // Arrange: Create campaign
      const timestamp = Date.now();
      const created = await createCampaign('default', {
        name: `Test Partial ${timestamp}`,
        channel: 'event',
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        budgetTotal: '5000.00',
        attributes: { original: true },
      });

      const updateData = {
        budgetTotal: '6000.00',
      };

      const request = new Request(
        `http://localhost/api/campaigns/${created.campaignId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: testSessionCookie,
          },
          body: JSON.stringify(updateData),
        }
      );

      // Act: Call action
      const response = await campaignDetailAction({
        request,
        params: { id: created.campaignId },
        context: {},
      });
      const data: unknown = await response.json();
      assertCampaignResponse(data);

      // Assert: Only budgetTotal changed
      expect(response.status).toBe(200);
      expect(data.budgetTotal).toBe('6000.00');
      expect(data.name).toBe(`Test Partial ${timestamp}`); // Unchanged
      expect(data.channel).toBe('event'); // Unchanged

      // Cleanup
      await deleteCampaign('default', created.campaignId);
    });

    it('should return 404 for non-existent campaign', async () => {
      // Arrange: Non-existent ID
      const nonExistentId = '99999999-9999-4999-8999-999999999999';
      const updateData = {
        name: 'Should Not Work',
      };

      const request = new Request(
        `http://localhost/api/campaigns/${nonExistentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: testSessionCookie,
          },
          body: JSON.stringify(updateData),
        }
      );

      // Act: Call action
      const response = await campaignDetailAction({
        request,
        params: { id: nonExistentId },
        context: {},
      });

      // Assert: Expect 404
      expect(response.status).toBe(404);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Campaign not found');
    });

    it('should return 400 for invalid date range', async () => {
      // Arrange: Create campaign
      const timestamp = Date.now();
      const created = await createCampaign('default', {
        name: `Test Invalid Update ${timestamp}`,
        channel: 'test',
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      });

      const updateData = {
        startDate: '2025-06-30',
        endDate: '2025-06-01', // Invalid: endDate < startDate
      };

      const request = new Request(
        `http://localhost/api/campaigns/${created.campaignId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: testSessionCookie,
          },
          body: JSON.stringify(updateData),
        }
      );

      // Act: Call action
      const response = await campaignDetailAction({
        request,
        params: { id: created.campaignId },
        context: {},
      });

      // Assert: Expect 400 validation error
      expect(response.status).toBe(400);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Validation failed');

      // Cleanup
      await deleteCampaign('default', created.campaignId);
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Create campaign and request without auth
      const timestamp = Date.now();
      const created = await createCampaign('default', {
        name: `Test Unauth Update ${timestamp}`,
        channel: null,
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      });

      const updateData = {
        name: 'Should Not Work',
      };

      const request = new Request(
        `http://localhost/api/campaigns/${created.campaignId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        }
      );

      // Act: Call action
      const response = await campaignDetailAction({
        request,
        params: { id: created.campaignId },
        context: {},
      });

      // Assert: Expect 401
      expect(response.status).toBe(401);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Unauthorized');

      // Cleanup
      await deleteCampaign('default', created.campaignId);
    });
  });

  describe('DELETE /api/campaigns/:id', () => {
    it('should delete campaign', async () => {
      // Arrange: Create campaign to delete
      const timestamp = Date.now();
      const created = await createCampaign('default', {
        name: `Test Delete ${timestamp}`,
        channel: 'test',
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      });

      const request = new Request(
        `http://localhost/api/campaigns/${created.campaignId}`,
        {
          method: 'DELETE',
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call action
      const response = await campaignDetailAction({
        request,
        params: { id: created.campaignId },
        context: {},
      });

      // Assert: Verify deletion
      expect(response.status).toBe(204);
      // 204 No Content should have no body
      expect(response.body).toBeNull();

      // Verify campaign no longer exists
      const getResponse = await getCampaign('default', created.campaignId);
      expect(getResponse).toBeNull();
    });

    it('should return 404 for non-existent campaign', async () => {
      // Arrange: Non-existent ID
      const nonExistentId = '99999999-9999-4999-8999-999999999999';
      const request = new Request(
        `http://localhost/api/campaigns/${nonExistentId}`,
        {
          method: 'DELETE',
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call action
      const response = await campaignDetailAction({
        request,
        params: { id: nonExistentId },
        context: {},
      });

      // Assert: Expect 404
      expect(response.status).toBe(404);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Campaign not found');
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Create campaign and request without auth
      const timestamp = Date.now();
      const created = await createCampaign('default', {
        name: `Test Unauth Delete ${timestamp}`,
        channel: null,
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      });

      const request = new Request(
        `http://localhost/api/campaigns/${created.campaignId}`,
        {
          method: 'DELETE',
        }
      );

      // Act: Call action
      const response = await campaignDetailAction({
        request,
        params: { id: created.campaignId },
        context: {},
      });

      // Assert: Expect 401
      expect(response.status).toBe(401);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Unauthorized');

      // Cleanup
      await deleteCampaign('default', created.campaignId);
    });
  });

  describe('Method Not Allowed', () => {
    it('should return 405 for unsupported methods', async () => {
      // Arrange: Create campaign and request with PATCH (not supported)
      const timestamp = Date.now();
      const created = await createCampaign('default', {
        name: `Test Method ${timestamp}`,
        channel: null,
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      });

      const request = new Request(
        `http://localhost/api/campaigns/${created.campaignId}`,
        {
          method: 'PATCH',
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call action
      const response = await campaignDetailAction({
        request,
        params: { id: created.campaignId },
        context: {},
      });

      // Assert: Expect 405
      expect(response.status).toBe(405);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Method not allowed');

      // Cleanup
      await deleteCampaign('default', created.campaignId);
    });
  });

  describe('Tenant Isolation (RLS)', () => {
    let tenant1UserId: string;
    let tenant1SessionCookie: string;
    let tenant2CampaignId: string;

    beforeAll(async () => {
      const db = getDb();

      // Create tenant1 and tenant2 in tenants table
      await db
        .insert(schema.tenants)
        .values([
          {
            tenantId: 'tenant1',
            name: 'Test Tenant 1',
            plan: 'OSS',
          },
          {
            tenantId: 'tenant2',
            name: 'Test Tenant 2',
            plan: 'OSS',
          },
        ])
        .onConflictDoNothing();

      // Create user in tenant1
      await setTenantContext('tenant1');
      const passwordHash = await hashPassword('testpassword123');

      const [tenant1User] = await db
        .insert(schema.users)
        .values({
          userId: crypto.randomUUID(),
          tenantId: 'tenant1',
          email: `test-tenant1-${Date.now()}@example.com`,
          passwordHash,
          displayName: 'Tenant1 Test User',
          role: 'member',
          disabled: false,
        })
        .returning();

      tenant1UserId = tenant1User!.userId;
      await clearTenantContext();

      // Create session for tenant1 user
      const request = new Request('http://localhost/test');
      const session = await getSession(request);
      session.set('userId', tenant1UserId);
      session.set('tenantId', 'tenant1');
      const setCookieHeader = await commitSession(session);
      tenant1SessionCookie = setCookieHeader.split(';')[0]!;

      // Create campaign in tenant2
      await setTenantContext('tenant2');
      const timestamp = Date.now();
      const tenant2Campaign = await createCampaign('tenant2', {
        name: `Tenant2 Campaign ${timestamp}`,
        channel: 'test',
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      });
      tenant2CampaignId = tenant2Campaign.campaignId;
      await clearTenantContext();
    });

    afterAll(async () => {
      const db = getDb();

      // Clean up tenant2 campaign
      if (tenant2CampaignId) {
        await setTenantContext('tenant2');
        await deleteCampaign('tenant2', tenant2CampaignId);
        await clearTenantContext();
      }

      // Clean up tenant1 user
      if (tenant1UserId) {
        await setTenantContext('tenant1');
        await db
          .delete(schema.users)
          .where(eq(schema.users.userId, tenant1UserId));
        await clearTenantContext();
      }

      // Clean up tenant1 and tenant2
      await db
        .delete(schema.tenants)
        .where(eq(schema.tenants.tenantId, 'tenant1'));
      await db
        .delete(schema.tenants)
        .where(eq(schema.tenants.tenantId, 'tenant2'));

      // Clear tenant context and close database connections
      await clearTenantContext();
      await closeDb();
    });

    it('should return 404 when tenant1 user tries to GET tenant2 campaign', async () => {
      // Arrange: tenant1 user tries to access tenant2 campaign
      const request = new Request(
        `http://localhost/api/campaigns/${tenant2CampaignId}`,
        {
          headers: {
            Cookie: tenant1SessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await campaignDetailLoader({
        request,
        params: { id: tenant2CampaignId },
        context: {},
      });

      // Assert: RLS should prevent access (404 not found)
      expect(response.status).toBe(404);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Campaign not found');
    });

    it('should return 404 when tenant1 user tries to PUT tenant2 campaign', async () => {
      // Arrange: tenant1 user tries to update tenant2 campaign
      const updateData = {
        name: 'Should Not Update',
      };

      const request = new Request(
        `http://localhost/api/campaigns/${tenant2CampaignId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: tenant1SessionCookie,
          },
          body: JSON.stringify(updateData),
        }
      );

      // Act: Call action
      const response = await campaignDetailAction({
        request,
        params: { id: tenant2CampaignId },
        context: {},
      });

      // Assert: RLS should prevent access (404 not found)
      expect(response.status).toBe(404);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Campaign not found');
    });

    it('should return 404 when tenant1 user tries to DELETE tenant2 campaign', async () => {
      // Arrange: tenant1 user tries to delete tenant2 campaign
      const request = new Request(
        `http://localhost/api/campaigns/${tenant2CampaignId}`,
        {
          method: 'DELETE',
          headers: {
            Cookie: tenant1SessionCookie,
          },
        }
      );

      // Act: Call action
      const response = await campaignDetailAction({
        request,
        params: { id: tenant2CampaignId },
        context: {},
      });

      // Assert: RLS should prevent access (404 not found)
      expect(response.status).toBe(404);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Campaign not found');
    });
  });
});
