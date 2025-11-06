/**
 * Integration tests for plugin runs API
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { runInTenant } from '../../db/tenant-test-utils.js';
import { loader } from './api.plugins.$id.runs.js';
import { getSession, commitSession } from '../sessions.server.js';
import { getDb } from '../../db/connection.js';
import * as schema from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';

// Test plugin key (from seed data)
const TEST_PLUGIN_KEY = 'drowl-plugin-test'; // Plugin key
const FAKE_PLUGIN_KEY = 'non-existent-plugin'; // Non-existent plugin

let testUserId: string | null = null;

/**
 * Get test user ID from database
 */
beforeAll(async () => {
  const db = getDb();
  const users = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, 'test@example.com'))
    .limit(1);

  if (users.length > 0 && users[0]) {
    testUserId = users[0].userId;
  }
});

/**
 * Helper function to create authenticated request
 */
async function createAuthenticatedRequest(url: string): Promise<Request> {
  if (!testUserId) {
    throw new Error('Test user not found. Run seed first.');
  }

  // Create a temporary request to get an empty session
  const tempRequest = new Request(url);
  const session = await getSession(tempRequest);

  // Set session data with actual user ID from database
  session.set('userId', testUserId);
  session.set('tenantId', 'default');

  const cookieHeader = await commitSession(session);

  // Create the actual request with the session cookie
  return new Request(url, {
    method: 'GET',
    headers: {
      Cookie: cookieHeader,
    },
  });
}

/**
 * Helper function to create unauthenticated request
 */
function createUnauthenticatedRequest(url: string): Request {
  return new Request(url, {
    method: 'GET',
  });
}

describe('GET /api/plugins/:id/runs', () => {
  it('should return plugin runs list for authenticated user', async () => {
    await runInTenant('default', async () => {
      // Create authenticated request
      const request = await createAuthenticatedRequest(
        `http://localhost/api/plugins/${TEST_PLUGIN_KEY}/runs`
      );

      // Call loader
      const response = await loader({
        request,
        params: { id: TEST_PLUGIN_KEY },
        context: {},
      });

      // Parse JSON response
      const data: unknown = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data).toBeDefined();

      // Type guard for success response
      if (!data || typeof data !== 'object' || 'error' in data) {
        throw new Error('Expected runs response');
      }

      const runsData = data as { runs: unknown[]; total: number; summary: unknown };
      expect(runsData.runs).toBeDefined();
      expect(Array.isArray(runsData.runs)).toBe(true);
      expect(runsData.total).toBeDefined();
      expect(typeof runsData.total).toBe('number');
      expect(runsData.summary).toBeDefined();
    });
  });

  it('should return 401 for unauthenticated requests', async () => {
    await runInTenant('default', async () => {
      // Create unauthenticated request
      const request = createUnauthenticatedRequest(
        `http://localhost/api/plugins/${TEST_PLUGIN_KEY}/runs`
      );

      // Call loader - expect it to throw (redirect to login)
      await expect(
        loader({
          request,
          params: { id: TEST_PLUGIN_KEY },
          context: {},
        })
      ).rejects.toThrow();
    });
  });

  it('should return 404 for non-existing plugin', async () => {
    await runInTenant('default', async () => {
      // Create authenticated request with non-existing plugin key
      const request = await createAuthenticatedRequest(
        `http://localhost/api/plugins/${FAKE_PLUGIN_KEY}/runs`
      );

      // Call loader
      const response = await loader({
        request,
        params: { id: FAKE_PLUGIN_KEY },
        context: {},
      });

      // Parse JSON response
      const data: unknown = await response.json();

      // Assertions
      expect(response.status).toBe(404);

      // Type guard for error response
      if (!data || typeof data !== 'object' || !('error' in data)) {
        throw new Error('Expected error response');
      }

      const errorData = data as { error: string };
      expect(errorData.error).toBe('Plugin not found');
    });
  });

  it('should return 400 for missing plugin ID', async () => {
    await runInTenant('default', async () => {
      // Create authenticated request without plugin ID
      const request = await createAuthenticatedRequest(
        'http://localhost/api/plugins//runs'
      );

      // Call loader with undefined plugin ID
      const response = await loader({
        request,
        params: {}, // No ID provided
        context: {},
      });

      // Parse JSON response
      const data: unknown = await response.json();

      // Assertions
      expect(response.status).toBe(400);

      // Type guard for error response
      if (!data || typeof data !== 'object' || !('error' in data)) {
        throw new Error('Expected error response');
      }

      const errorData = data as { error: string };
      expect(errorData.error).toBe('Plugin key is required');
    });
  });

  it('should support pagination with limit and offset', async () => {
    await runInTenant('default', async () => {
      // Create authenticated request with pagination params
      const request = await createAuthenticatedRequest(
        `http://localhost/api/plugins/${TEST_PLUGIN_KEY}/runs?limit=5&offset=0`
      );

      // Call loader
      const response = await loader({
        request,
        params: { id: TEST_PLUGIN_KEY },
        context: {},
      });

      // Parse JSON response
      const data: unknown = await response.json();

      // Assertions
      expect(response.status).toBe(200);

      if (!data || typeof data !== 'object' || 'error' in data) {
        throw new Error('Expected runs response');
      }

      const runsData = data as { runs: unknown[]; total: number };
      expect(Array.isArray(runsData.runs)).toBe(true);
      // Should respect limit
      expect(runsData.runs.length).toBeLessThanOrEqual(5);
    });
  });

  it('should filter by status parameter', async () => {
    await runInTenant('default', async () => {
      // Create authenticated request with status filter
      const request = await createAuthenticatedRequest(
        `http://localhost/api/plugins/${TEST_PLUGIN_KEY}/runs?status=success`
      );

      // Call loader
      const response = await loader({
        request,
        params: { id: TEST_PLUGIN_KEY },
        context: {},
      });

      // Parse JSON response
      const data: unknown = await response.json();

      // Assertions
      expect(response.status).toBe(200);

      if (!data || typeof data !== 'object' || 'error' in data) {
        throw new Error('Expected runs response');
      }

      const runsData = data as { runs: Array<{ status: string }>; total: number };
      expect(Array.isArray(runsData.runs)).toBe(true);

      // All returned runs should have 'success' status
      runsData.runs.forEach((run) => {
        expect(run.status).toBe('success');
      });
    });
  });

  it('should include summary statistics in response', async () => {
    await runInTenant('default', async () => {
      // Create authenticated request
      const request = await createAuthenticatedRequest(
        `http://localhost/api/plugins/${TEST_PLUGIN_KEY}/runs`
      );

      // Call loader
      const response = await loader({
        request,
        params: { id: TEST_PLUGIN_KEY },
        context: {},
      });

      // Parse JSON response
      const data: unknown = await response.json();

      // Type guard for success response
      if (!data || typeof data !== 'object' || 'error' in data) {
        throw new Error('Expected runs response');
      }

      const runsData = data as {
        runs: unknown[];
        total: number;
        summary: {
          total: number;
          success: number;
          failed: number;
          running: number;
          pending: number;
          avgEventsProcessed: number;
          avgDuration: number;
        };
      };

      // Verify summary structure
      expect(runsData.summary).toBeDefined();
      expect(runsData.summary).toHaveProperty('total');
      expect(runsData.summary).toHaveProperty('success');
      expect(runsData.summary).toHaveProperty('failed');
      expect(runsData.summary).toHaveProperty('running');
      expect(runsData.summary).toHaveProperty('pending');
      expect(runsData.summary).toHaveProperty('avgEventsProcessed');
      expect(runsData.summary).toHaveProperty('avgDuration');

      // Verify all are numbers
      expect(typeof runsData.summary.total).toBe('number');
      expect(typeof runsData.summary.success).toBe('number');
      expect(typeof runsData.summary.failed).toBe('number');
      expect(typeof runsData.summary.running).toBe('number');
      expect(typeof runsData.summary.pending).toBe('number');
      expect(typeof runsData.summary.avgEventsProcessed).toBe('number');
      expect(typeof runsData.summary.avgDuration).toBe('number');
    });
  });
});
