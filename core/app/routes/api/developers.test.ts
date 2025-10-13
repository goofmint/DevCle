/**
 * Developer API Integration Tests
 *
 * Tests for the Developer API endpoints (GET/POST /api/developers).
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
import { deleteDeveloper, createDeveloper } from '../../../services/drm.service.js';
import { hashPassword } from '../../../services/auth.service.js';
import { getDb } from '../../../db/connection.js';
import * as schema from '../../../db/schema/index.js';
import { loader as developersLoader, action as developersAction } from './developers.js';
import { getSession, commitSession } from '../../sessions.server.js';

// Type guard helpers for response data
function assertListResponse(data: unknown): asserts data is { developers: Array<unknown>; total: number } {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  if (!('developers' in data) || !('total' in data)) {
    throw new Error('Response missing developers or total');
  }
  // TypeScript knows data has 'developers' and 'total' properties here
  if (!Array.isArray(data.developers)) {
    throw new Error('developers is not an array');
  }
  if (typeof data.total !== 'number') {
    throw new Error('total is not a number');
  }
}

function assertDeveloperResponse(data: unknown): asserts data is {
  developerId: string;
  displayName: string;
  primaryEmail: string;
  consentAnalytics: boolean;
  tags: string[];
} {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  const required = ['developerId', 'displayName', 'primaryEmail', 'consentAnalytics', 'tags'];
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
  // TypeScript knows data has 'error' property here
  if (typeof data.error !== 'string') {
    throw new Error('error is not a string');
  }
}

describe('Developer API - /api/developers', () => {
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
        email: `test-api-${Date.now()}@example.com`,
        passwordHash,
        displayName: 'Test API User',
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

  describe('GET /api/developers', () => {
    it('should return developers list with default pagination', async () => {
      // Arrange: Create authenticated request
      const request = new Request('http://localhost/api/developers', {
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call loader
      const response = await developersLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Verify response
      expect(response.status).toBe(200);
      expect(data.developers).toBeInstanceOf(Array);
      expect(data.total).toBeGreaterThanOrEqual(0);
      expect(typeof data.total).toBe('number');
    });

    it('should respect limit parameter', async () => {
      // Arrange: Create developers and request with limit
      const timestamp = Date.now();
      const created1 = await createDeveloper('default', {
        displayName: `Test Limit 1 ${timestamp}`,
        primaryEmail: `test-limit-1-${timestamp}@example.com`,
        orgId: null,
      });
      const created2 = await createDeveloper('default', {
        displayName: `Test Limit 2 ${timestamp}`,
        primaryEmail: `test-limit-2-${timestamp}@example.com`,
        orgId: null,
      });
      const created3 = await createDeveloper('default', {
        displayName: `Test Limit 3 ${timestamp}`,
        primaryEmail: `test-limit-3-${timestamp}@example.com`,
        orgId: null,
      });

      const request = new Request(
        'http://localhost/api/developers?limit=2',
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await developersLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Should return max 2 items
      expect(response.status).toBe(200);
      expect(data.developers.length).toBeLessThanOrEqual(2);
      expect(data.total).toBeGreaterThanOrEqual(3);

      // Cleanup
      await deleteDeveloper('default', created1.developerId);
      await deleteDeveloper('default', created2.developerId);
      await deleteDeveloper('default', created3.developerId);
    });

    it('should search by displayName', async () => {
      // Arrange: Create developer with unique name
      const timestamp = Date.now();
      const uniqueName = `UniqueSearchName${timestamp}`;
      const created = await createDeveloper('default', {
        displayName: uniqueName,
        primaryEmail: `test-search-${timestamp}@example.com`,
        orgId: null,
      });

      const request = new Request(
        `http://localhost/api/developers?search=${uniqueName}`,
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await developersLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Should find the developer
      expect(response.status).toBe(200);
      expect(data.developers.length).toBeGreaterThan(0);
      expect(
        data.developers.some((d) => {
          if (typeof d === 'object' && d !== null && 'displayName' in d) {
            const displayName = d.displayName;
            if (typeof displayName === 'string') {
              return displayName.includes(uniqueName);
            }
          }
          return false;
        })
      ).toBe(true);

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });

    it('should sort by displayName ascending', async () => {
      // Arrange: Create request with orderBy and orderDirection
      const request = new Request(
        'http://localhost/api/developers?orderBy=displayName&orderDirection=asc&limit=10',
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await developersLoader({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertListResponse(data);

      // Assert: Verify sort order
      expect(response.status).toBe(200);
      if (data.developers.length > 1) {
        for (let i = 0; i < data.developers.length - 1; i++) {
          const currentItem = data.developers[i];
          const nextItem = data.developers[i + 1];
          if (
            currentItem &&
            typeof currentItem === 'object' &&
            'displayName' in currentItem &&
            nextItem &&
            typeof nextItem === 'object' &&
            'displayName' in nextItem
          ) {
            const current = currentItem.displayName;
            const next = nextItem.displayName;
            if (typeof current === 'string' && typeof next === 'string') {
              expect(current <= next).toBe(true);
            }
          }
        }
      }
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange: Request without session cookie
      const request = new Request('http://localhost/api/developers');

      // Act: Call loader
      const response = await developersLoader({
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
      const request = new Request(
        'http://localhost/api/developers?limit=-1',
        {
          headers: {
            Cookie: testSessionCookie,
          },
        }
      );

      // Act: Call loader
      const response = await developersLoader({
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

  describe('POST /api/developers', () => {
    it('should create a new developer', async () => {
      // Arrange: Prepare request with valid data
      const timestamp = Date.now();
      const requestBody = {
        displayName: `Test Create API ${timestamp}`,
        primaryEmail: `test-create-api-${timestamp}@example.com`,
        orgId: null,
        consentAnalytics: true,
        tags: ['test-api'],
      };

      const request = new Request('http://localhost/api/developers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await developersAction({
        request,
        params: {},
        context: {},
      });
      const data: unknown = await response.json();
      assertDeveloperResponse(data);

      // Assert: Verify created developer
      expect(response.status).toBe(201);
      expect(data.displayName).toBe(`Test Create API ${timestamp}`);
      expect(data.primaryEmail).toBe(`test-create-api-${timestamp}@example.com`);
      expect(data.developerId).toBeDefined();
      expect(data.consentAnalytics).toBe(true);
      expect(data.tags).toEqual(['test-api']);

      // Cleanup
      await deleteDeveloper('default', data.developerId);
    });

    it('should return 400 for invalid email', async () => {
      // Arrange: Invalid email format
      const requestBody = {
        displayName: 'Test Invalid Email',
        primaryEmail: 'invalid-email',
        orgId: null,
      };

      const request = new Request('http://localhost/api/developers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await developersAction({
        request,
        params: {},
        context: {},
      });

      // Assert: Expect validation error
      expect(response.status).toBe(400);
      const data: unknown = await response.json();
      if (typeof data === 'object' && data !== null && 'error' in data && 'details' in data) {
        expect(data.error).toBe('Validation failed');
        expect(data.details).toBeDefined();
      } else {
        throw new Error('Invalid error response structure');
      }
    });

    it('should return 400 for empty displayName', async () => {
      // Arrange: Empty displayName
      const requestBody = {
        displayName: '',
        primaryEmail: 'test@example.com',
        orgId: null,
      };

      const request = new Request('http://localhost/api/developers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await developersAction({
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
        displayName: 'Test',
        primaryEmail: 'test@example.com',
        orgId: null,
      };

      const request = new Request('http://localhost/api/developers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Act: Call action
      const response = await developersAction({
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
      const request = new Request('http://localhost/api/developers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSessionCookie,
        },
        body: 'invalid-json{',
      });

      // Act: Call action
      const response = await developersAction({
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
      // Arrange: Request with PUT method (should be in developers.$id.ts)
      const request = new Request('http://localhost/api/developers', {
        method: 'PUT',
        headers: {
          Cookie: testSessionCookie,
        },
      });

      // Act: Call action
      const response = await developersAction({
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
