/**
 * Integration tests for plugin configuration API
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { runInTenant } from '~/db/tenant-test-utils.js';
import { loader } from './api.plugins.$id.config.js';
import { getSession, commitSession } from '~/sessions.server.js';
import { getDb } from '~/db/connection.js';
import * as schema from '~/db/schema/index.js';
import { eq } from 'drizzle-orm';

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

  if (users.length > 0) {
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

describe('GET /api/plugins/:id/config', () => {
  it('should return plugin configuration for authenticated user', async () => {
    await runInTenant('default', async () => {
      // Create authenticated request
      const request = await createAuthenticatedRequest(
        'http://localhost/api/plugins/drowl-plugin-test/config'
      );

      // Call loader
      const response = await loader({
        request,
        params: { id: 'drowl-plugin-test' },
        context: {},
      });

      // Parse JSON response
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data).toBeDefined();
      expect(data.basicInfo).toBeDefined();
      expect(data.basicInfo.id).toBe('drowl-plugin-test');
      expect(data.basicInfo.name).toBe('drowl-plugin-test');
      expect(data.basicInfo.version).toBeDefined();
      expect(data.capabilities).toBeDefined();
      expect(data.settingsSchema).toBeDefined();
      expect(data.routes).toBeDefined();
    });
  });

  it('should return 401 for unauthenticated requests', async () => {
    await runInTenant('default', async () => {
      // Create unauthenticated request
      const request = createUnauthenticatedRequest(
        'http://localhost/api/plugins/drowl-plugin-test/config'
      );

      // Call loader - expect it to throw (redirect to login)
      await expect(
        loader({
          request,
          params: { id: 'drowl-plugin-test' },
          context: {},
        })
      ).rejects.toThrow();
    });
  });

  it('should return 404 for non-existing plugin', async () => {
    await runInTenant('default', async () => {
      // Create authenticated request with non-existing plugin ID
      const request = await createAuthenticatedRequest(
        'http://localhost/api/plugins/non-existing-plugin/config'
      );

      // Call loader
      const response = await loader({
        request,
        params: { id: 'non-existing-plugin' },
        context: {},
      });

      // Parse JSON response
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(404);
      expect(data.error).toBe('Plugin not found');
    });
  });

  it('should return 400 for missing plugin ID', async () => {
    await runInTenant('default', async () => {
      // Create authenticated request without plugin ID
      const request = await createAuthenticatedRequest(
        'http://localhost/api/plugins//config'
      );

      // Call loader with undefined plugin ID
      const response = await loader({
        request,
        params: {}, // No ID provided
        context: {},
      });

      // Parse JSON response
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(400);
      expect(data.error).toBe('Plugin ID is required');
    });
  });

  it('should include all expected fields in response', async () => {
    await runInTenant('default', async () => {
      // Create authenticated request
      const request = await createAuthenticatedRequest(
        'http://localhost/api/plugins/drowl-plugin-test/config'
      );

      // Call loader
      const response = await loader({
        request,
        params: { id: 'drowl-plugin-test' },
        context: {},
      });

      // Parse JSON response
      const data = await response.json();

      // Verify response structure
      expect(data).toHaveProperty('basicInfo');
      expect(data).toHaveProperty('capabilities');
      expect(data).toHaveProperty('settingsSchema');
      expect(data).toHaveProperty('routes');

      // Verify basicInfo structure
      expect(data.basicInfo).toHaveProperty('id');
      expect(data.basicInfo).toHaveProperty('name');
      expect(data.basicInfo).toHaveProperty('version');
      expect(data.basicInfo).toHaveProperty('description');
      expect(data.basicInfo).toHaveProperty('vendor');
      expect(data.basicInfo).toHaveProperty('license');

      // Verify capabilities structure
      expect(data.capabilities).toHaveProperty('scopes');
      expect(data.capabilities).toHaveProperty('network');
      expect(data.capabilities).toHaveProperty('secrets');
      expect(Array.isArray(data.capabilities.scopes)).toBe(true);
      expect(Array.isArray(data.capabilities.network)).toBe(true);
      expect(Array.isArray(data.capabilities.secrets)).toBe(true);

      // Verify arrays
      expect(Array.isArray(data.settingsSchema)).toBe(true);
      expect(Array.isArray(data.routes)).toBe(true);
    });
  });
});
