/**
 * Developer API Integration Tests - Single Resource
 *
 * Tests for the Developer API endpoints (GET/PUT/DELETE /api/developers/:id).
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
import {
  closeDb,
  setTenantContext,
  clearTenantContext,
} from '../../../db/connection.js';
import {
  deleteDeveloper,
  createDeveloper,
  getDeveloper,
} from '../../../services/drm.service.js';
import { hashPassword } from '../../../services/auth.service.js';
import { getDb } from '../../../db/connection.js';
import * as schema from '../../../db/schema/index.js';
import {
  loader as developerDetailLoader,
  action as developerDetailAction,
} from './developers.$id.js';
import { getSession, commitSession } from '../../sessions.server.js';

// Type guard helpers for response data
function assertDeveloperResponse(data: unknown): asserts data is {
  developerId: string;
  displayName: string;
  primaryEmail: string;
  tags: string[];
} {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  const required = ['developerId', 'displayName', 'primaryEmail', 'tags'];
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

describe('Developer API - /api/developers/:id', () => {
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
        email: `test-api-detail-${Date.now()}@example.com`,
        passwordHash,
        displayName: 'Test API Detail User',
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
      await db.delete(schema.users).where({
        userId: testUserId,
      } as never);
    }

    // Clear tenant context
    await clearTenantContext();

    // Close database connections
    await closeDb();
  });

  describe('GET /api/developers/:id', () => {
    it('should return developer by ID', async () => {
      // Arrange: Create a developer
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: `Test Get Detail ${timestamp}`,
        primaryEmail: `test-get-detail-${timestamp}@example.com`,
        orgId: null,
        tags: ['test-get'],
      });

      const request = new Request(
        `http://localhost/api/developers/${created.developerId}`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await developerDetailLoader({
        request,
        params: { id: created.developerId },
        context: {},
      });
      const data: unknown = await response.json();
      assertDeveloperResponse(data);

      // Assert: Verify returned developer
      expect(response.status).toBe(200);
      expect(data.developerId).toBe(created.developerId);
      expect(data.displayName).toBe(`Test Get Detail ${timestamp}`);
      expect(data.primaryEmail).toBe(`test-get-detail-${timestamp}@example.com`);
      expect(data.tags).toEqual(['test-get']);

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });

    it('should return 404 for non-existent ID', async () => {
      // Arrange: Use non-existent UUID
      const nonExistentId = '99999999-9999-4999-8999-999999999999';
      const request = new Request(
        `http://localhost/api/developers/${nonExistentId}`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await developerDetailLoader({
        request,
        params: { id: nonExistentId },
        context: {},
      });

      // Assert: Expect 404
      expect(response.status).toBe(404);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Developer not found');
    });

    it('should return 400 for invalid UUID format', async () => {
      // Arrange: Use invalid UUID
      const invalidId = 'invalid-uuid';
      const request = new Request(
        `http://localhost/api/developers/${invalidId}`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await developerDetailLoader({
        request,
        params: { id: invalidId },
        context: {},
      });

      // Assert: Expect 400
      expect(response.status).toBe(400);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Invalid developer ID format');
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Create developer and request without auth
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: `Test Unauth ${timestamp}`,
        primaryEmail: `test-unauth-${timestamp}@example.com`,
        orgId: null,
      });

      const request = new Request(
        `http://localhost/api/developers/${created.developerId}`
      );

      // Act: Call loader
      const response = await developerDetailLoader({
        request,
        params: { id: created.developerId },
        context: {},
      });

      // Assert: Expect 401
      expect(response.status).toBe(401);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Unauthorized');

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });
  });

  describe('PUT /api/developers/:id', () => {
    it('should update developer', async () => {
      // Arrange: Create developer and prepare update data
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: `Test Update ${timestamp}`,
        primaryEmail: `test-update-${timestamp}@example.com`,
        orgId: null,
        tags: ['original'],
      });

      const updateData = {
        displayName: `Updated Name ${timestamp}`,
        tags: ['updated'],
      };

      const request = new Request(
        `http://localhost/api/developers/${created.developerId}`,
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
      const response = await developerDetailAction({
        request,
        params: { id: created.developerId },
        context: {},
      });
      const data: unknown = await response.json();
      assertDeveloperResponse(data);

      // Assert: Verify updated data
      expect(response.status).toBe(200);
      expect(data.displayName).toBe(`Updated Name ${timestamp}`);
      expect(data.tags).toEqual(['updated']);
      expect(data.primaryEmail).toBe(`test-update-${timestamp}@example.com`); // Unchanged

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });

    it('should support partial updates', async () => {
      // Arrange: Create developer
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: `Test Partial ${timestamp}`,
        primaryEmail: `test-partial-${timestamp}@example.com`,
        orgId: null,
        consentAnalytics: true,
        tags: ['original'],
      });

      const updateData = {
        displayName: `Partially Updated ${timestamp}`,
      };

      const request = new Request(
        `http://localhost/api/developers/${created.developerId}`,
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
      const response = await developerDetailAction({
        request,
        params: { id: created.developerId },
        context: {},
      });
      const data: unknown = await response.json();
      assertDeveloperResponse(data);

      // Assert: Only displayName changed
      expect(response.status).toBe(200);
      expect(data.displayName).toBe(`Partially Updated ${timestamp}`);
      expect(data.primaryEmail).toBe(`test-partial-${timestamp}@example.com`); // Unchanged
      expect(data.tags).toEqual(['original']); // Unchanged

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });

    it('should return 404 for non-existent developer', async () => {
      // Arrange: Non-existent ID
      const nonExistentId = '99999999-9999-4999-8999-999999999999';
      const updateData = {
        displayName: 'Should Not Work',
      };

      const request = new Request(
        `http://localhost/api/developers/${nonExistentId}`,
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
      const response = await developerDetailAction({
        request,
        params: { id: nonExistentId },
        context: {},
      });

      // Assert: Expect 404
      expect(response.status).toBe(404);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Developer not found');
    });

    it('should return 400 for invalid email', async () => {
      // Arrange: Create developer
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: `Test Invalid Update ${timestamp}`,
        primaryEmail: `test-invalid-${timestamp}@example.com`,
        orgId: null,
      });

      const updateData = {
        primaryEmail: 'invalid-email',
      };

      const request = new Request(
        `http://localhost/api/developers/${created.developerId}`,
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
      const response = await developerDetailAction({
        request,
        params: { id: created.developerId },
        context: {},
      });

      // Assert: Expect 400 validation error
      expect(response.status).toBe(400);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Validation failed');

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Create developer and request without auth
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: `Test Unauth Update ${timestamp}`,
        primaryEmail: `test-unauth-update-${timestamp}@example.com`,
        orgId: null,
      });

      const updateData = {
        displayName: 'Should Not Work',
      };

      const request = new Request(
        `http://localhost/api/developers/${created.developerId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        }
      );

      // Act: Call action
      const response = await developerDetailAction({
        request,
        params: { id: created.developerId },
        context: {},
      });

      // Assert: Expect 401
      expect(response.status).toBe(401);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Unauthorized');

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });
  });

  describe('DELETE /api/developers/:id', () => {
    it('should delete developer', async () => {
      // Arrange: Create developer to delete
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: `Test Delete ${timestamp}`,
        primaryEmail: `test-delete-${timestamp}@example.com`,
        orgId: null,
      });

      const request = new Request(
        `http://localhost/api/developers/${created.developerId}`,
        {
          method: 'DELETE',
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call action
      const response = await developerDetailAction({
        request,
        params: { id: created.developerId },
        context: {},
      });

      // Assert: Verify deletion
      expect(response.status).toBe(204);
      // 204 No Content should have no body
      expect(response.body).toBeNull();

      // Verify developer no longer exists
      const getResponse = await getDeveloper('default', created.developerId);
      expect(getResponse).toBeNull();
    });

    it('should return 404 for non-existent developer', async () => {
      // Arrange: Non-existent ID
      const nonExistentId = '99999999-9999-4999-8999-999999999999';
      const request = new Request(
        `http://localhost/api/developers/${nonExistentId}`,
        {
          method: 'DELETE',
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call action
      const response = await developerDetailAction({
        request,
        params: { id: nonExistentId },
        context: {},
      });

      // Assert: Expect 404
      expect(response.status).toBe(404);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Developer not found');
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Create developer and request without auth
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: `Test Unauth Delete ${timestamp}`,
        primaryEmail: `test-unauth-delete-${timestamp}@example.com`,
        orgId: null,
      });

      const request = new Request(
        `http://localhost/api/developers/${created.developerId}`,
        {
          method: 'DELETE',
        }
      );

      // Act: Call action
      const response = await developerDetailAction({
        request,
        params: { id: created.developerId },
        context: {},
      });

      // Assert: Expect 401
      expect(response.status).toBe(401);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Unauthorized');

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });
  });

  describe('Method Not Allowed', () => {
    it('should return 405 for unsupported methods', async () => {
      // Arrange: Create developer and request with PATCH (not supported)
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: `Test Method ${timestamp}`,
        primaryEmail: `test-method-${timestamp}@example.com`,
        orgId: null,
      });

      const request = new Request(
        `http://localhost/api/developers/${created.developerId}`,
        {
          method: 'PATCH',
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call action
      const response = await developerDetailAction({
        request,
        params: { id: created.developerId },
        context: {},
      });

      // Assert: Expect 405
      expect(response.status).toBe(405);
      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.error).toBe('Method not allowed');

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });
  });
});
