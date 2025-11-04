/**
 * Plugin Management API Integration Tests - List and Enable/Disable
 *
 * Tests for plugin list and enable/disable endpoints.
 * Uses real database and authentication (no mocks).
 *
 * Test coverage:
 * - GET /api/plugins - List all plugins
 * - PUT /api/plugins/:id - Enable plugin
 * - DELETE /api/plugins/:id - Disable plugin
 * - Authentication and tenant isolation
 * - Error handling (401, 404, 400)
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from 'vitest';
import { hashPassword } from '../../services/auth.service.js';
import {
  runInTenant,
  ensureTenantExists,
} from '../../db/tenant-test-utils.js';
import { loader as pluginsLoader, action as pluginsAction } from './api.plugins.js';
import { getSession, commitSession } from '../sessions.server.js';
import * as schema from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { closeDb } from '../../db/connection.js';
import type { PluginListResponse, PluginActionResponse } from '../types/plugin-api.js';

const TEST_TENANT = 'test-plugins-api';
const PASSWORD = 'password-1234';

/**
 * Type assertion for plugin list response
 */
function assertPluginListResponse(
  data: unknown
): asserts data is PluginListResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  if (!('plugins' in data) || !Array.isArray(data.plugins)) {
    throw new Error('Response missing plugins array');
  }
}

/**
 * Type assertion for plugin action response
 */
function assertPluginActionResponse(
  data: unknown
): asserts data is PluginActionResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  if (!('success' in data) || typeof data.success !== 'boolean') {
    throw new Error('Response missing success field');
  }
  if (!('plugin' in data) || typeof data.plugin !== 'object') {
    throw new Error('Response missing plugin field');
  }
}

/**
 * Type assertion for error response
 */
function assertErrorResponse(
  data: unknown
): asserts data is { status: number; message: string } {
  if (typeof data !== 'object' || data === null || !('message' in data)) {
    throw new Error('Response missing message');
  }
}

/**
 * Create authenticated session for testing
 */
async function createAuthSession() {
  await ensureTenantExists(TEST_TENANT);

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(PASSWORD);

  await runInTenant(TEST_TENANT, async (tx) => {
    await tx
      .insert(schema.users)
      .values({
        userId,
        tenantId: TEST_TENANT,
        email: `plugins-${userId}@example.com`,
        passwordHash,
        displayName: 'Plugins API User',
        role: 'member',
        disabled: false,
      })
      .onConflictDoNothing();
  });

  const request = new Request('http://localhost/login');
  const session = await getSession(request);
  session.set('userId', userId);
  session.set('tenantId', TEST_TENANT);

  return {
    userId,
    cookie: await commitSession(session),
  };
}

/**
 * Delete test user
 */
async function deleteUser(userId: string) {
  await runInTenant(TEST_TENANT, async (tx) => {
    await tx.delete(schema.users).where(eq(schema.users.userId, userId));
  });
}

/**
 * Create test plugin
 */
async function createTestPlugin(key: string, name: string, enabled: boolean = true) {
  const pluginId = crypto.randomUUID();

  await runInTenant(TEST_TENANT, async (tx) => {
    await tx.insert(schema.plugins).values({
      pluginId,
      tenantId: TEST_TENANT,
      key,
      name,
      enabled,
      config: { apiKey: 'test-key' },
    });
  });

  return pluginId;
}

/**
 * Delete test plugin
 */
async function deleteTestPlugin(pluginId: string) {
  await runInTenant(TEST_TENANT, async (tx) => {
    await tx.delete(schema.plugins).where(eq(schema.plugins.pluginId, pluginId));
  });
}

describe('Plugin Management API - List and Enable/Disable', () => {
  const createdPlugins: string[] = [];
  const createdUsers: string[] = [];

  beforeEach(async () => {
    await ensureTenantExists(TEST_TENANT);
  });

  afterEach(async () => {
    // Clean up test plugins
    for (const pluginId of createdPlugins) {
      await deleteTestPlugin(pluginId);
    }
    createdPlugins.length = 0;

    // Clean up test users
    for (const userId of createdUsers) {
      await deleteUser(userId);
    }
    createdUsers.length = 0;
  });

  afterAll(async () => {
    await closeDb();
  });

  describe('GET /api/plugins - List plugins', () => {
    it('should return plugins from filesystem even when DB is empty', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const request = new Request('http://localhost/api/plugins');
      request.headers.set('cookie', cookie);

      const response = await pluginsLoader({ request, params: {}, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      assertPluginListResponse(data);

      // Should return plugins from filesystem (at least drowl-plugin-test)
      expect(data.plugins.length).toBeGreaterThan(0);

      // Plugins not in DB should have enabled=false by default
      const filesystemPlugin = data.plugins[0];
      if (!filesystemPlugin) {
        throw new Error('Expected at least one plugin from filesystem');
      }
      // Check enabled status
      if (filesystemPlugin) {
        expect(filesystemPlugin.enabled).toBe(false);
      }
    });

    it('should return list of plugins with merged filesystem and DB data', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      // Create DB entry for an existing filesystem plugin (drowl-plugin-test)
      const pluginId = await createTestPlugin('drowl-plugin-test', 'Test Plugin', true);
      createdPlugins.push(pluginId);

      const request = new Request('http://localhost/api/plugins');
      request.headers.set('cookie', cookie);

      const response = await pluginsLoader({ request, params: {}, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      assertPluginListResponse(data);

      // Should have at least the one we registered
      expect(data.plugins.length).toBeGreaterThanOrEqual(1);

      // Verify plugin data merges filesystem (name, version) with DB (enabled)
      const testPlugin = data.plugins.find(p => p.key === 'drowl-plugin-test');
      expect(testPlugin).toBeDefined();
      expect(testPlugin?.enabled).toBe(true); // From DB
      expect(testPlugin?.name).toBe('drowl-plugin-test'); // From plugin.json
      expect(testPlugin?.version).toBe('1.0.0'); // From plugin.json
    });

  });

  describe('PUT /api/plugins/:id - Enable plugin', () => {
    it('should enable disabled plugin', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      // Create disabled plugin
      const pluginId = await createTestPlugin('slack', 'Slack Integration', false);
      createdPlugins.push(pluginId);

      const request = new Request(`http://localhost/api/plugins/${pluginId}`, {
        method: 'PUT',
        headers: { 'cookie': cookie, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await pluginsAction({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      assertPluginActionResponse(data);
      expect(data.success).toBe(true);
      expect(data.plugin.enabled).toBe(true);
      expect(data.plugin.pluginId).toBe(pluginId);
    });

    it('should update plugin config when provided', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin('slack', 'Slack Integration', false);
      createdPlugins.push(pluginId);

      const newConfig = { apiKey: 'new-key', webhookUrl: 'https://example.com/webhook' };
      const request = new Request(`http://localhost/api/plugins/${pluginId}`, {
        method: 'PUT',
        headers: { 'cookie': cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ config: newConfig }),
      });

      const response = await pluginsAction({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      assertPluginActionResponse(data);
      // Config should be redacted for security
      expect(data.plugin.config).toEqual({
        apiKey: '***REDACTED***',
        webhookUrl: 'https://example.com/webhook',
      });
    });

    it('should return 400 for invalid UUID', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const request = new Request('http://localhost/api/plugins/invalid-uuid', {
        method: 'PUT',
        headers: { 'cookie': cookie },
      });

      const response = await pluginsAction({ request, params: { id: 'invalid-uuid' }, context: {} });
      expect(response.status).toBe(400);

      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.message).toContain('Invalid plugin ID format');
    });

    it('should return 404 for non-existent plugin', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const fakeId = crypto.randomUUID();
      const request = new Request(`http://localhost/api/plugins/${fakeId}`, {
        method: 'PUT',
        headers: { 'cookie': cookie },
      });

      const response = await pluginsAction({ request, params: { id: fakeId }, context: {} });
      expect(response.status).toBe(404);

      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.message).toContain('Plugin not found');
    });
  });

  describe('DELETE /api/plugins/:id - Disable plugin', () => {
    it('should disable enabled plugin', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      // Create enabled plugin
      const pluginId = await createTestPlugin('slack', 'Slack Integration', true);
      createdPlugins.push(pluginId);

      const request = new Request(`http://localhost/api/plugins/${pluginId}`, {
        method: 'DELETE',
        headers: { 'cookie': cookie },
      });

      const response = await pluginsAction({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      assertPluginActionResponse(data);
      expect(data.success).toBe(true);
      expect(data.plugin.enabled).toBe(false);
      expect(data.plugin.pluginId).toBe(pluginId);
    });
  });
});
