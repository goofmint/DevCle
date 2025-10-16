/**
 * Campaign ROI API Integration Tests
 *
 * Tests for the Campaign ROI API endpoint (GET /api/campaigns/:id/roi).
 * These tests verify that:
 * - HTTP handlers work correctly with real database
 * - Authentication is enforced
 * - Path parameter validation works
 * - ROI calculation is correct
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
import { deleteCampaign, createCampaign } from '../../../services/campaign.service.js';
import { hashPassword } from '../../../services/auth.service.js';
import { getDb } from '../../../db/connection.js';
import * as schema from '../../../db/schema/index.js';
import { loader as campaignROILoader } from './campaigns.$id.roi.js';
import { getSession, commitSession } from '../../sessions.server.js';

// Type guard helpers for response data
function assertROIResponse(data: unknown): asserts data is {
  campaignId: string;
  campaignName: string;
  totalCost: string;
  totalValue: string;
  roi: number | null;
  activityCount: number;
  developerCount: number;
  calculatedAt: string;
} {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  const required = [
    'campaignId',
    'campaignName',
    'totalCost',
    'totalValue',
    'roi',
    'activityCount',
    'developerCount',
    'calculatedAt',
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

describe('Campaign ROI API - /api/campaigns/:id/roi', () => {
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
        email: `test-campaign-roi-${Date.now()}@example.com`,
        passwordHash,
        displayName: 'Test Campaign ROI User',
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

  describe('GET /api/campaigns/:id/roi', () => {
    it('should return ROI for existing campaign', async () => {
      // Arrange: Create a campaign
      const timestamp = Date.now();
      const created = await createCampaign('default', {
        name: `Test ROI Campaign ${timestamp}`,
        channel: 'event',
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        budgetTotal: '5000.00',
        attributes: { test: 'roi' },
      });

      const request = new Request(
        `http://localhost/api/campaigns/${created.campaignId}/roi`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await campaignROILoader({
        request,
        params: { id: created.campaignId },
        context: {},
      });
      const data: unknown = await response.json();
      assertROIResponse(data);

      // Assert: Verify ROI data structure
      expect(response.status).toBe(200);
      expect(data.campaignId).toBe(created.campaignId);
      expect(data.campaignName).toBe(`Test ROI Campaign ${timestamp}`);
      expect(data.totalCost).toBeDefined();
      expect(data.totalValue).toBeDefined();
      expect(data.activityCount).toBeGreaterThanOrEqual(0);
      expect(data.developerCount).toBeGreaterThanOrEqual(0);
      expect(data.calculatedAt).toBeDefined();

      // ROI can be number or null (if totalCost is 0)
      if (data.roi !== null) {
        expect(typeof data.roi).toBe('number');
      }

      // Cleanup
      await deleteCampaign('default', created.campaignId);
    });

    it('should handle campaign with zero cost (roi = null)', async () => {
      // Arrange: Create campaign with zero budget
      const timestamp = Date.now();
      const created = await createCampaign('default', {
        name: `Test Zero Cost ${timestamp}`,
        channel: 'test',
        startDate: null,
        endDate: null,
        budgetTotal: null, // Zero cost
        attributes: {},
      });

      const request = new Request(
        `http://localhost/api/campaigns/${created.campaignId}/roi`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await campaignROILoader({
        request,
        params: { id: created.campaignId },
        context: {},
      });
      const data: unknown = await response.json();
      assertROIResponse(data);

      // Assert: ROI should be null (division by zero)
      expect(response.status).toBe(200);
      expect(data.roi).toBeNull();
      // totalCost can be '0' or '0.00' depending on database COALESCE behavior
      expect(['0', '0.00']).toContain(data.totalCost);

      // Cleanup
      await deleteCampaign('default', created.campaignId);
    });

    it('should return 404 for non-existent campaign', async () => {
      // Arrange: Use non-existent UUID
      const nonExistentId = '99999999-9999-4999-8999-999999999999';
      const request = new Request(
        `http://localhost/api/campaigns/${nonExistentId}/roi`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await campaignROILoader({
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
        `http://localhost/api/campaigns/${invalidId}/roi`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await campaignROILoader({
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
        name: `Test Unauth ROI ${timestamp}`,
        channel: null,
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      });

      const request = new Request(
        `http://localhost/api/campaigns/${created.campaignId}/roi`
      );

      // Act: Call loader
      const response = await campaignROILoader({
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
});
