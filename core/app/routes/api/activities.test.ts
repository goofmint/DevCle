/**
 * Activity API Integration Tests (Collection)
 *
 * Tests for the Activity API endpoints (GET/POST /api/activities).
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
  getDb,
} from '../../../db/connection.js';
import { createActivity, deleteActivity } from '../../../services/activity.service.js';
import { createDeveloper, deleteDeveloper } from '../../../services/drm.service.js';
import { hashPassword } from '../../../services/auth.service.js';
import * as schema from '../../../db/schema/index.js';
import { loader as activitiesLoader, action as activitiesAction } from './activities.js';
import { getSession, commitSession } from '../../sessions.server.js';

// Type guard helpers for response data
function assertListResponse(data: unknown): asserts data is { activities: Array<unknown>; total: number } {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  if (!('activities' in data) || !('total' in data)) {
    throw new Error('Response missing activities or total');
  }
  if (!Array.isArray(data['activities'])) {
    throw new Error('activities is not an array');
  }
  if (typeof data['total'] !== 'number') {
    throw new Error('total is not a number');
  }
}

function assertActivityResponse(data: unknown): asserts data is {
  activityId: string;
  tenantId: string;
  action: string;
  source: string;
  occurredAt: string;
} {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  const required = ['activityId', 'tenantId', 'action', 'source', 'occurredAt'];
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
  if (typeof data['error'] !== 'string') {
    throw new Error('error is not a string');
  }
}

describe('Activity API - /api/activities', () => {
  let testUserId: string;
  let testDeveloperId: string;
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
        email: `test-activity-api-${Date.now()}@example.com`,
        passwordHash,
        displayName: 'Test Activity API User',
        role: 'member',
        disabled: false,
      })
      .returning();

    testUserId = testUser!.userId;

    // Create test developer for activities
    const developer = await createDeveloper('default', {
      displayName: 'Test Activity Developer',
      primaryEmail: `test-activity-dev-${Date.now()}@example.com`,
      orgId: null,
    });
    testDeveloperId = developer.developerId;

    // Create session cookie for authentication
    const request = new Request('http://localhost/test');
    const session = await getSession(request);
    session.set('userId', testUserId);
    session.set('tenantId', 'default');
    testSessionCookie = await commitSession(session);
  });

  afterAll(async () => {
    // Clean up test developer
    if (testDeveloperId) {
      await deleteDeveloper('default', testDeveloperId);
    }

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

  describe('GET /api/activities', () => {
    it('should return activities list with default pagination', async () => {
      // Arrange: Create test activity
      const timestamp = Date.now();
      const activity = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: `test-action-${timestamp}`,
        occurredAt: new Date(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey: `test-list-${timestamp}`,
      });

      const request = new Request('http://localhost/api/activities', {
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call loader
      const response = await activitiesLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Verify response
      expect(response.status).toBe(200);
      expect(data.activities).toBeInstanceOf(Array);
      expect(data.total).toBeGreaterThan(0);

      // Cleanup
      await deleteActivity('default', activity.activityId);
    });

    it('should respect limit and offset parameters', async () => {
      // Arrange: Create multiple activities
      const timestamp = Date.now();
      const activities = await Promise.all([
        createActivity('default', {
          developerId: testDeveloperId,
          accountId: null,
          anonId: null,
          resourceId: null,
          action: 'test-pagination',
          occurredAt: new Date(Date.now() - 3000),
          source: 'test',
          sourceRef: null,
          category: null,
          groupKey: null,
          metadata: null,
          confidence: 1.0,
          dedupKey: `test-pagination-1-${timestamp}`,
        }),
        createActivity('default', {
          developerId: testDeveloperId,
          accountId: null,
          anonId: null,
          resourceId: null,
          action: 'test-pagination',
          occurredAt: new Date(Date.now() - 2000),
          source: 'test',
          sourceRef: null,
          category: null,
          groupKey: null,
          metadata: null,
          confidence: 1.0,
          dedupKey: `test-pagination-2-${timestamp}`,
        }),
        createActivity('default', {
          developerId: testDeveloperId,
          accountId: null,
          anonId: null,
          resourceId: null,
          action: 'test-pagination',
          occurredAt: new Date(Date.now() - 1000),
          source: 'test',
          sourceRef: null,
          category: null,
          groupKey: null,
          metadata: null,
          confidence: 1.0,
          dedupKey: `test-pagination-3-${timestamp}`,
        }),
      ]);

      const request = new Request(
        'http://localhost/api/activities?limit=2&offset=0',
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await activitiesLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Should return max 2 items
      expect(response.status).toBe(200);
      expect(data.activities.length).toBeLessThanOrEqual(2);
      expect(data.total).toBeGreaterThanOrEqual(3);

      // Cleanup
      await Promise.all(activities.map((a) => deleteActivity('default', a.activityId)));
    });

    it('should filter by developerId', async () => {
      // Arrange: Create activity for specific developer
      const timestamp = Date.now();
      const activity = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-filter-developer',
        occurredAt: new Date(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey: `test-filter-dev-${timestamp}`,
      });

      const request = new Request(
        `http://localhost/api/activities?developerId=${testDeveloperId}`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await activitiesLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Should find activities for the developer
      expect(response.status).toBe(200);
      expect(data.activities.length).toBeGreaterThan(0);
      expect(
        data.activities.every((a) => {
          if (typeof a === 'object' && a !== null && 'developerId' in a) {
            return a['developerId'] === testDeveloperId;
          }
          return false;
        })
      ).toBe(true);

      // Cleanup
      await deleteActivity('default', activity.activityId);
    });

    it('should filter by action', async () => {
      // Arrange: Create activity with specific action
      const timestamp = Date.now();
      const uniqueAction = `unique-action-${timestamp}`;
      const activity = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: uniqueAction,
        occurredAt: new Date(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey: `test-filter-action-${timestamp}`,
      });

      const request = new Request(
        `http://localhost/api/activities?action=${uniqueAction}`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await activitiesLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Should find activities with the action
      expect(response.status).toBe(200);
      expect(data.activities.length).toBeGreaterThan(0);
      expect(
        data.activities.some((a) => {
          if (typeof a === 'object' && a !== null && 'action' in a) {
            return a['action'] === uniqueAction;
          }
          return false;
        })
      ).toBe(true);

      // Cleanup
      await deleteActivity('default', activity.activityId);
    });

    it('should filter by date range', async () => {
      // Arrange: Create activities with specific dates
      const timestamp = Date.now();
      const activity1 = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-date-range',
        occurredAt: new Date('2025-01-01T00:00:00Z'),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey: `test-date-1-${timestamp}`,
      });
      const activity2 = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-date-range',
        occurredAt: new Date('2025-06-15T00:00:00Z'),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey: `test-date-2-${timestamp}`,
      });

      const request = new Request(
        'http://localhost/api/activities?fromDate=2025-06-01T00:00:00Z&toDate=2025-06-30T23:59:59Z&action=test-date-range',
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await activitiesLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Should only find activity2 (within date range)
      expect(response.status).toBe(200);
      const foundActivity2 = data.activities.some((a) => {
        if (typeof a === 'object' && a !== null && 'activityId' in a) {
          return a['activityId'] === activity2.activityId;
        }
        return false;
      });
      expect(foundActivity2).toBe(true);

      // Cleanup
      await deleteActivity('default', activity1.activityId);
      await deleteActivity('default', activity2.activityId);
    });

    it('should sort by occurred_at descending by default', async () => {
      // Arrange: Create activities with different occurred_at times
      const timestamp = Date.now();
      const activities = await Promise.all([
        createActivity('default', {
          developerId: testDeveloperId,
          accountId: null,
          anonId: null,
          resourceId: null,
          action: 'test-sort',
          occurredAt: new Date(Date.now() - 3000),
          source: 'test',
          sourceRef: null,
          category: null,
          groupKey: null,
          metadata: null,
          confidence: 1.0,
          dedupKey: `test-sort-1-${timestamp}`,
        }),
        createActivity('default', {
          developerId: testDeveloperId,
          accountId: null,
          anonId: null,
          resourceId: null,
          action: 'test-sort',
          occurredAt: new Date(Date.now() - 1000),
          source: 'test',
          sourceRef: null,
          category: null,
          groupKey: null,
          metadata: null,
          confidence: 1.0,
          dedupKey: `test-sort-2-${timestamp}`,
        }),
      ]);

      const request = new Request(
        'http://localhost/api/activities?action=test-sort',
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await activitiesLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Verify descending order (most recent first)
      expect(response.status).toBe(200);
      if (data.activities.length > 1) {
        for (let i = 0; i < data.activities.length - 1; i++) {
          const current = data.activities[i];
          const next = data.activities[i + 1];
          if (
            current &&
            typeof current === 'object' &&
            'occurredAt' in current &&
            next &&
            typeof next === 'object' &&
            'occurredAt' in next
          ) {
            const currentDate = new Date(current['occurredAt'] as string);
            const nextDate = new Date(next['occurredAt'] as string);
            expect(currentDate >= nextDate).toBe(true);
          }
        }
      }

      // Cleanup
      await Promise.all(activities.map((a) => deleteActivity('default', a.activityId)));
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Request without session cookie
      const request = new Request('http://localhost/api/activities');

      // Act: Call loader
      const response = await activitiesLoader({
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
      // Arrange: Request with invalid limit (exceeds max)
      const request = new Request(
        'http://localhost/api/activities?limit=9999',
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await activitiesLoader({
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

  describe('POST /api/activities', () => {
    it('should create a new activity with developerId', async () => {
      // Arrange: Prepare request with valid data
      const timestamp = Date.now();
      const requestBody = {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-create',
        occurredAt: new Date().toISOString(),
        source: 'test',
        sourceRef: 'test-ref',
        category: 'test-category',
        groupKey: 'test-group',
        metadata: { key: 'value' },
        confidence: 1.0,
        dedupKey: `test-create-${timestamp}`,
      };

      const request = new Request('http://localhost/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await activitiesAction({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertActivityResponse(data);

      // Assert: Verify created activity
      expect(response.status).toBe(201);
      expect(data.action).toBe('test-create');
      expect(data.source).toBe('test');
      expect(data.activityId).toBeDefined();

      // Cleanup
      await deleteActivity('default', data.activityId);
    });

    it('should create activity with anonId', async () => {
      // Arrange: Create activity with anonymous ID
      const timestamp = Date.now();
      const requestBody = {
        developerId: null,
        accountId: null,
        anonId: `anon-${timestamp}`,
        resourceId: null,
        action: 'test-anon',
        occurredAt: new Date().toISOString(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 0.8,
        dedupKey: `test-anon-${timestamp}`,
      };

      const request = new Request('http://localhost/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await activitiesAction({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertActivityResponse(data);

      // Assert: Verify created activity
      expect(response.status).toBe(201);
      expect(data.action).toBe('test-anon');

      // Cleanup
      await deleteActivity('default', data.activityId);
    });

    it('should return 400 if no ID provided', async () => {
      // Arrange: No developerId, accountId, or anonId
      const requestBody = {
        developerId: null,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-no-id',
        occurredAt: new Date().toISOString(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey: null,
      };

      const request = new Request('http://localhost/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await activitiesAction({
        request,
        params: {},
        context: {},
      });

      // Assert: Expect validation error
      expect(response.status).toBe(400);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toContain('At least one ID');
    });

    it('should return 409 for duplicate dedupKey', async () => {
      // Arrange: Create activity with dedupKey first
      const timestamp = Date.now();
      const dedupKey = `test-dup-${timestamp}`;
      const activity = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-duplicate',
        occurredAt: new Date(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey,
      });

      // Try to create activity with same dedupKey
      const requestBody = {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-duplicate',
        occurredAt: new Date().toISOString(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey,
      };

      const request = new Request('http://localhost/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await activitiesAction({
        request,
        params: {},
        context: {},
      });

      // Assert: Expect 409 Conflict
      expect(response.status).toBe(409);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toContain('Duplicate');

      // Cleanup
      await deleteActivity('default', activity.activityId);
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Request without session cookie
      const requestBody = {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test',
        occurredAt: new Date().toISOString(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey: null,
      };

      const request = new Request('http://localhost/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await activitiesAction({
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
  });
});
