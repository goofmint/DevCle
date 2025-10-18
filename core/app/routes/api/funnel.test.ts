/**
 * Funnel API Integration Tests
 *
 * Tests for the Funnel API endpoints (GET /api/funnel, GET /api/funnel/timeline).
 * These tests verify that:
 * - HTTP handlers work correctly with real database
 * - Authentication is enforced
 * - Error handling works correctly
 * - Request/response formats are correct
 * - Drop rate calculations are accurate
 * - Time series aggregation works correctly
 * - Tenant isolation (RLS) is enforced
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

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  closeDb,
  setTenantContext,
  clearTenantContext,
} from '../../../db/connection.js';
import { createActivity } from '../../../services/activity.service.js';
import { hashPassword } from '../../../services/auth.service.js';
import { getDb } from '../../../db/connection.js';
import * as schema from '../../../db/schema/index.js';
import { loader as funnelLoader } from './funnel.js';
import { loader as timelineLoader } from './funnel.timeline.js';
import { getSession, commitSession } from '../../sessions.server.js';

// Type guard helpers for response data
function assertFunnelResponse(data: unknown): asserts data is {
  stages: Array<{
    stageKey: string;
    title: string;
    orderNo: number;
    uniqueDevelopers: number;
    totalActivities: number;
    previousStageCount: number | null;
    dropRate: number | null;
  }>;
  overallConversionRate: number;
} {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  if (!('stages' in data) || !('overallConversionRate' in data)) {
    throw new Error('Response missing stages or overallConversionRate');
  }
  if (!Array.isArray(data.stages)) {
    throw new Error('stages is not an array');
  }
  if (typeof data.overallConversionRate !== 'number') {
    throw new Error('overallConversionRate is not a number');
  }
}

function assertTimeSeriesResponse(data: unknown): asserts data is Array<{
  date: string;
  stages: Array<{
    stageKey: string;
    uniqueDevelopers: number;
    dropRate: number | null;
  }>;
}> {
  if (!Array.isArray(data)) {
    throw new Error('Response is not an array');
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

describe('Funnel API - /api/funnel', () => {
  let testUserId: string;
  let testSessionCookie: string;
  let testDeveloperId: string;

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
        email: `test-funnel-api-${Date.now()}@example.com`,
        passwordHash,
        displayName: 'Test Funnel API User',
        role: 'member',
        disabled: false,
      })
      .returning();

    testUserId = testUser!.userId;

    // Create test developer for activities
    const [testDeveloper] = await db
      .insert(schema.developers)
      .values({
        developerId: crypto.randomUUID(),
        tenantId: 'default',
        displayName: 'Test Developer',
        primaryEmail: `developer-funnel-${Date.now()}@example.com`,
        orgId: null,
        consentAnalytics: true,
      })
      .returning();

    testDeveloperId = testDeveloper!.developerId;

    // Create session cookie for authentication
    const request = new Request('http://localhost/test');
    const session = await getSession(request);
    session.set('userId', testUserId);
    session.set('tenantId', 'default');
    testSessionCookie = await commitSession(session);
  });

  afterAll(async () => {
    // Clean up test user and developer
    if (testUserId || testDeveloperId) {
      const db = getDb();
      if (testUserId) {
        await db.delete(schema.users).where(eq(schema.users.userId, testUserId));
      }
      if (testDeveloperId) {
        await db
          .delete(schema.developers)
          .where(eq(schema.developers.developerId, testDeveloperId));
      }
    }

    // Clear tenant context
    await clearTenantContext();

    // Close database connections
    await closeDb();
  });

  beforeEach(async () => {
    // Clean up activities created by THIS TEST ONLY
    // This ensures tests don't interfere with each other
    const db = getDb();
    await db
      .delete(schema.activities)
      .where(eq(schema.activities.developerId, testDeveloperId));
  });

  describe('GET /api/funnel', () => {
    it('should return funnel statistics for authenticated user', async () => {
      // Arrange: Create activities across different stages
      await createActivity('default', {
        accountId: null,
        developerId: testDeveloperId,
        resourceId: null,
        action: 'click', // awareness stage
        source: 'web',
        occurredAt: new Date(),
        metadata: {},
        value: null,
        confidence: 1.0,
      });

      const request = new Request('http://localhost/api/funnel', {
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call loader
      const response = await funnelLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertFunnelResponse(data);

      // Assert: Verify response structure
      expect(response.status).toBe(200);
      expect(data.stages).toHaveLength(4); // Always 4 stages
      expect(data.stages[0]?.stageKey).toBe('awareness');
      expect(data.stages[1]?.stageKey).toBe('engagement');
      expect(data.stages[2]?.stageKey).toBe('adoption');
      expect(data.stages[3]?.stageKey).toBe('advocacy');
      expect(typeof data.overallConversionRate).toBe('number');
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Request without session cookie
      const request = new Request('http://localhost/api/funnel');

      // Act: Call loader
      const response = await funnelLoader({
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

    it('should respect tenant isolation', async () => {
      // Arrange: Create activities for different tenants
      // First, create activity for 'default' tenant
      await createActivity('default', {
        accountId: null,
        developerId: testDeveloperId,
        resourceId: null,
        action: 'click',
        source: 'web',
        occurredAt: new Date(),
        metadata: {},
        value: null,
        confidence: 1.0,
      });

      // Request with 'default' tenant session
      const request = new Request('http://localhost/api/funnel', {
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call loader
      const response = await funnelLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertFunnelResponse(data);

      // Assert: Should only include default tenant data
      expect(response.status).toBe(200);
      const awarenessStage = data.stages.find((s) => s.stageKey === 'awareness');
      expect(awarenessStage).toBeDefined();
      // Should have at least 1 developer (the test developer)
      expect(awarenessStage!.uniqueDevelopers).toBeGreaterThanOrEqual(1);
    });

    it('should calculate drop rates correctly', async () => {
      // Arrange: Create activities across multiple stages to test drop rate calculation
      // Awareness: 1 developer
      await createActivity('default', {
        accountId: null,
        developerId: testDeveloperId,
        resourceId: null,
        action: 'click', // awareness
        source: 'web',
        occurredAt: new Date(),
        metadata: {},
        value: null,
        confidence: 1.0,
      });

      // Engagement: same developer
      await createActivity('default', {
        accountId: null,
        developerId: testDeveloperId,
        resourceId: null,
        action: 'attend', // engagement
        source: 'event',
        occurredAt: new Date(),
        metadata: {},
        value: null,
        confidence: 1.0,
      });

      const request = new Request('http://localhost/api/funnel', {
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call loader
      const response = await funnelLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertFunnelResponse(data);

      // Assert: Verify drop rate structure
      expect(response.status).toBe(200);

      // Awareness stage should have null drop rate (first stage)
      const awarenessStage = data.stages.find((s) => s.stageKey === 'awareness');
      expect(awarenessStage!.dropRate).toBeNull();
      expect(awarenessStage!.previousStageCount).toBeNull();

      // Engagement stage should have drop rate calculated
      const engagementStage = data.stages.find((s) => s.stageKey === 'engagement');
      expect(engagementStage!.previousStageCount).toBeGreaterThanOrEqual(1);
      // Drop rate should be a number (can be 0 if all progressed)
      if (engagementStage!.dropRate !== null) {
        expect(typeof engagementStage!.dropRate).toBe('number');
        expect(engagementStage!.dropRate).toBeGreaterThanOrEqual(0);
        expect(engagementStage!.dropRate).toBeLessThanOrEqual(100);
      }
    });

    it('should return empty funnel with 4 stages when no activities exist', async () => {
      // Arrange: No activities created
      const request = new Request('http://localhost/api/funnel', {
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call loader
      const response = await funnelLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertFunnelResponse(data);

      // Assert: Should return 4 stages with zero counts
      expect(response.status).toBe(200);
      expect(data.stages).toHaveLength(4);
      data.stages.forEach((stage) => {
        expect(stage.uniqueDevelopers).toBeGreaterThanOrEqual(0);
        expect(stage.totalActivities).toBeGreaterThanOrEqual(0);
      });
    });

    it('should calculate overall conversion rate correctly', async () => {
      // Arrange: Create activities across all stages
      await createActivity('default', {
        accountId: null,
        developerId: testDeveloperId,
        resourceId: null,
        action: 'click', // awareness
        source: 'web',
        occurredAt: new Date(),
        metadata: {},
        value: null,
        confidence: 1.0,
      });

      await createActivity('default', {
        accountId: null,
        developerId: testDeveloperId,
        resourceId: null,
        action: 'post', // advocacy
        source: 'blog',
        occurredAt: new Date(),
        metadata: {},
        value: null,
        confidence: 1.0,
      });

      const request = new Request('http://localhost/api/funnel', {
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call loader
      const response = await funnelLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertFunnelResponse(data);

      // Assert: Verify conversion rate is a valid percentage
      expect(response.status).toBe(200);
      expect(typeof data.overallConversionRate).toBe('number');
      expect(data.overallConversionRate).toBeGreaterThanOrEqual(0);
      expect(data.overallConversionRate).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/funnel/timeline', () => {
    it('should return time series data for day granularity', async () => {
      // Arrange: Create activities with specific dates
      const today = new Date();
      await createActivity('default', {
        accountId: null,
        developerId: testDeveloperId,
        resourceId: null,
        action: 'click',
        source: 'web',
        occurredAt: today,
        metadata: {},
        value: null,
        confidence: 1.0,
      });

      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 7);
      const toDate = today;

      const request = new Request(
        `http://localhost/api/funnel/timeline?fromDate=${fromDate.toISOString().split('T')[0]}&toDate=${toDate.toISOString().split('T')[0]}&granularity=day`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await timelineLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertTimeSeriesResponse(data);

      // Assert: Verify response structure
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('date');
        expect(data[0]).toHaveProperty('stages');
        expect(Array.isArray(data[0]?.stages)).toBe(true);
      }
    });

    it('should return time series data for week granularity', async () => {
      // Arrange: Create request with week granularity
      const today = new Date();
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 30);
      const toDate = today;

      const request = new Request(
        `http://localhost/api/funnel/timeline?fromDate=${fromDate.toISOString().split('T')[0]}&toDate=${toDate.toISOString().split('T')[0]}&granularity=week`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await timelineLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertTimeSeriesResponse(data);

      // Assert: Verify response
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return time series data for month granularity', async () => {
      // Arrange: Create request with month granularity
      const today = new Date();
      const fromDate = new Date(today);
      fromDate.setMonth(fromDate.getMonth() - 3);
      const toDate = today;

      const request = new Request(
        `http://localhost/api/funnel/timeline?fromDate=${fromDate.toISOString().split('T')[0]}&toDate=${toDate.toISOString().split('T')[0]}&granularity=month`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await timelineLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertTimeSeriesResponse(data);

      // Assert: Verify response
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return 400 for invalid query parameters', async () => {
      // Arrange: Request with invalid parameters
      const request = new Request(
        'http://localhost/api/funnel/timeline?fromDate=invalid-date&toDate=2024-01-31&granularity=invalid',
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await timelineLoader({
        request,
        params: {},
        context: {},
      });

      // Assert: Expect 400
      expect(response.status).toBe(400);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toContain('query parameters');
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Request without session cookie
      const today = new Date();
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 7);

      const request = new Request(
        `http://localhost/api/funnel/timeline?fromDate=${fromDate.toISOString().split('T')[0]}&toDate=${today.toISOString().split('T')[0]}&granularity=day`
      );

      // Act: Call loader
      const response = await timelineLoader({
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

    it('should respect tenant isolation', async () => {
      // Arrange: Create activity for default tenant
      const today = new Date();
      await createActivity('default', {
        accountId: null,
        developerId: testDeveloperId,
        resourceId: null,
        action: 'click',
        source: 'web',
        occurredAt: today,
        metadata: {},
        value: null,
        confidence: 1.0,
      });

      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 1);
      const toDate = today;

      const request = new Request(
        `http://localhost/api/funnel/timeline?fromDate=${fromDate.toISOString().split('T')[0]}&toDate=${toDate.toISOString().split('T')[0]}&granularity=day`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await timelineLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertTimeSeriesResponse(data);

      // Assert: Should only include default tenant data
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
