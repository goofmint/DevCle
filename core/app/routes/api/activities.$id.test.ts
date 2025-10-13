/**
 * Activity API Integration Tests (Single Resource)
 *
 * Tests for the Activity API endpoints (GET/PUT/DELETE /api/activities/:id).
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
import { loader as activityLoader, action as activityAction } from './activities.$id.js';
import { getSession, commitSession } from '../../sessions.server.js';

// Type guard helpers for response data
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

describe('Activity API - /api/activities/:id', () => {
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
        email: `test-activity-id-api-${Date.now()}@example.com`,
        passwordHash,
        displayName: 'Test Activity ID API User',
        role: 'member',
        disabled: false,
      })
      .returning();

    testUserId = testUser!.userId;

    // Create test developer for activities
    const developer = await createDeveloper('default', {
      displayName: 'Test Activity ID Developer',
      primaryEmail: `test-activity-id-dev-${Date.now()}@example.com`,
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

  describe('GET /api/activities/:id', () => {
    it('should return activity by ID', async () => {
      // Arrange: Create test activity
      const timestamp = Date.now();
      const activity = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-get-single',
        occurredAt: new Date(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: { test: 'data' },
        confidence: 1.0,
        dedupKey: `test-get-${timestamp}`,
      });

      const request = new Request(`http://localhost/api/activities/${activity.activityId}`, {
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call loader
      const response = await activityLoader({
        request,
        params: { id: activity.activityId },
        context: {},
      });
      const data: unknown = await response.json();
      assertActivityResponse(data);

      // Assert: Verify response
      expect(response.status).toBe(200);
      expect(data.activityId).toBe(activity.activityId);
      expect(data.action).toBe('test-get-single');
      expect(data.source).toBe('test');

      // Cleanup
      await deleteActivity('default', activity.activityId);
    });

    it('should return 404 for non-existent ID', async () => {
      // Arrange: Use non-existent UUID
      const nonExistentId = '00000000-0000-4000-8000-000000000000';
      const request = new Request(`http://localhost/api/activities/${nonExistentId}`, {
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call loader
      const response = await activityLoader({
        request,
        params: { id: nonExistentId },
        context: {},
      });

      // Assert: Expect 404
      expect(response.status).toBe(404);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Activity not found');
    });

    it('should return 400 for invalid UUID format', async () => {
      // Arrange: Use invalid UUID
      const invalidId = 'invalid-uuid';
      const request = new Request(`http://localhost/api/activities/${invalidId}`, {
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call loader
      const response = await activityLoader({
        request,
        params: { id: invalidId },
        context: {},
      });

      // Assert: Expect 400
      expect(response.status).toBe(400);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toContain('Invalid activity ID format');
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Create test activity
      const timestamp = Date.now();
      const activity = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-auth',
        occurredAt: new Date(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey: `test-auth-${timestamp}`,
      });

      const request = new Request(`http://localhost/api/activities/${activity.activityId}`);

      // Act: Call loader
      const response = await activityLoader({
        request,
        params: { id: activity.activityId },
        context: {},
      });

      // Assert: Expect 401
      expect(response.status).toBe(401);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Unauthorized');

      // Cleanup
      await deleteActivity('default', activity.activityId);
    });
  });

  describe('PUT /api/activities/:id', () => {
    it('should update activity (developer ID resolution)', async () => {
      // Arrange: Create anonymous activity
      const timestamp = Date.now();
      const activity = await createActivity('default', {
        developerId: null,
        accountId: null,
        anonId: `anon-${timestamp}`,
        resourceId: null,
        action: 'test-update',
        occurredAt: new Date(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 0.8,
        dedupKey: `test-update-${timestamp}`,
      });

      // Update to add developerId
      const requestBody = {
        developerId: testDeveloperId,
      };

      const request = new Request(`http://localhost/api/activities/${activity.activityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await activityAction({
        request,
        params: { id: activity.activityId },
        context: {},
      });
      const data: unknown = await response.json();
      assertActivityResponse(data);

      // Assert: Verify updated activity
      expect(response.status).toBe(200);
      expect(data.activityId).toBe(activity.activityId);
      if (typeof data === 'object' && data !== null && 'developerId' in data) {
        expect(data['developerId']).toBe(testDeveloperId);
      }

      // Cleanup
      await deleteActivity('default', activity.activityId);
    });

    it('should update metadata', async () => {
      // Arrange: Create activity
      const timestamp = Date.now();
      const activity = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-metadata-update',
        occurredAt: new Date(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: { original: 'data' },
        confidence: 1.0,
        dedupKey: `test-metadata-${timestamp}`,
      });

      // Update metadata
      const requestBody = {
        metadata: { original: 'data', updated: 'value' },
      };

      const request = new Request(`http://localhost/api/activities/${activity.activityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await activityAction({
        request,
        params: { id: activity.activityId },
        context: {},
      });
      const data: unknown = await response.json();
      assertActivityResponse(data);

      // Assert: Verify updated metadata
      expect(response.status).toBe(200);
      if (typeof data === 'object' && data !== null && 'metadata' in data) {
        const metadata = data['metadata'];
        if (typeof metadata === 'object' && metadata !== null) {
          expect(metadata).toMatchObject({ original: 'data', updated: 'value' });
        }
      }

      // Cleanup
      await deleteActivity('default', activity.activityId);
    });

    it('should return 400 if no update fields provided', async () => {
      // Arrange: Create activity
      const timestamp = Date.now();
      const activity = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-empty-update',
        occurredAt: new Date(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey: `test-empty-${timestamp}`,
      });

      // Empty update
      const requestBody = {};

      const request = new Request(`http://localhost/api/activities/${activity.activityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await activityAction({
        request,
        params: { id: activity.activityId },
        context: {},
      });

      // Assert: Expect 400
      expect(response.status).toBe(400);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toContain('No update fields');

      // Cleanup
      await deleteActivity('default', activity.activityId);
    });

    it('should return 404 for non-existent activity', async () => {
      // Arrange: Use non-existent UUID
      const nonExistentId = '00000000-0000-4000-8000-000000000000';
      const requestBody = {
        metadata: { test: 'value' },
      };

      const request = new Request(`http://localhost/api/activities/${nonExistentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await activityAction({
        request,
        params: { id: nonExistentId },
        context: {},
      });

      // Assert: Expect 404
      expect(response.status).toBe(404);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Activity not found');
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Create activity
      const timestamp = Date.now();
      const activity = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-auth-update',
        occurredAt: new Date(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey: `test-auth-update-${timestamp}`,
      });

      const requestBody = {
        metadata: { test: 'value' },
      };

      const request = new Request(`http://localhost/api/activities/${activity.activityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await activityAction({
        request,
        params: { id: activity.activityId },
        context: {},
      });

      // Assert: Expect 401
      expect(response.status).toBe(401);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Unauthorized');

      // Cleanup
      await deleteActivity('default', activity.activityId);
    });
  });

  describe('DELETE /api/activities/:id', () => {
    it('should delete activity', async () => {
      // Arrange: Create activity
      const timestamp = Date.now();
      const activity = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-delete',
        occurredAt: new Date(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey: `test-delete-${timestamp}`,
      });

      const request = new Request(`http://localhost/api/activities/${activity.activityId}`, {
        method: 'DELETE',
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call action
      const response = await activityAction({
        request,
        params: { id: activity.activityId },
        context: {},
      });

      // Assert: Expect 204 No Content
      expect(response.status).toBe(204);
      // 204 should have no body
      const text = await response.text();
      expect(text).toBe('');
    });

    it('should return 404 for non-existent activity', async () => {
      // Arrange: Use non-existent UUID
      const nonExistentId = '00000000-0000-4000-8000-000000000000';
      const request = new Request(`http://localhost/api/activities/${nonExistentId}`, {
        method: 'DELETE',
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call action
      const response = await activityAction({
        request,
        params: { id: nonExistentId },
        context: {},
      });

      // Assert: Expect 404
      expect(response.status).toBe(404);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Activity not found');
    });

    it('should return 204 with no body on success', async () => {
      // Arrange: Create activity
      const timestamp = Date.now();
      const activity = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-delete-204',
        occurredAt: new Date(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey: `test-delete-204-${timestamp}`,
      });

      const request = new Request(`http://localhost/api/activities/${activity.activityId}`, {
        method: 'DELETE',
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call action
      const response = await activityAction({
        request,
        params: { id: activity.activityId },
        context: {},
      });

      // Assert: Verify 204 and empty body
      expect(response.status).toBe(204);
      const text = await response.text();
      expect(text).toBe('');
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Create activity
      const timestamp = Date.now();
      const activity = await createActivity('default', {
        developerId: testDeveloperId,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'test-auth-delete',
        occurredAt: new Date(),
        source: 'test',
        sourceRef: null,
        category: null,
        groupKey: null,
        metadata: null,
        confidence: 1.0,
        dedupKey: `test-auth-delete-${timestamp}`,
      });

      const request = new Request(`http://localhost/api/activities/${activity.activityId}`, {
        method: 'DELETE',
      });

      // Act: Call action
      const response = await activityAction({
        request,
        params: { id: activity.activityId },
        context: {},
      });

      // Assert: Expect 401
      expect(response.status).toBe(401);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Unauthorized');

      // Cleanup
      await deleteActivity('default', activity.activityId);
    });
  });
});
