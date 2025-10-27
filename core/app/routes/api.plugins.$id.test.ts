/**
 * Plugin Management API Integration Tests - Detail and Logs
 *
 * Tests for plugin detail and logs endpoints.
 * Uses real database and authentication (no mocks).
 *
 * Test coverage:
 * - GET /api/plugins/:id - Get plugin details
 * - GET /api/plugins/:id/logs - Get execution logs
 * - Pagination for logs
 * - Status filtering for logs
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
import { loader as pluginDetailLoader } from './api.plugins.$id.js';
import { loader as pluginLogsLoader } from './api.plugins.$id.logs.js';
import { getSession, commitSession } from '../sessions.server.js';
import * as schema from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { closeDb } from '../../db/connection.js';
import { registerHook, unregisterHook } from '../../plugin-system/hooks.js';
import type { PluginDetailResponse, PluginLogsResponse } from '../types/plugin-api.js';

const TEST_TENANT = 'test-plugins-detail-api';
const PASSWORD = 'password-1234';

/**
 * Type assertion for plugin detail response
 */
function assertPluginDetailResponse(
  data: unknown
): asserts data is PluginDetailResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  if (!('plugin' in data) || typeof data.plugin !== 'object') {
    throw new Error('Response missing plugin field');
  }
  if (!('hooks' in data) || !Array.isArray(data.hooks)) {
    throw new Error('Response missing hooks array');
  }
  if (!('jobs' in data) || !Array.isArray(data.jobs)) {
    throw new Error('Response missing jobs array');
  }
}

/**
 * Type assertion for plugin logs response
 */
function assertPluginLogsResponse(
  data: unknown
): asserts data is PluginLogsResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  if (!('logs' in data) || !Array.isArray(data.logs)) {
    throw new Error('Response missing logs array');
  }
  if (!('total' in data) || typeof data.total !== 'number') {
    throw new Error('Response missing total field');
  }
  if (!('pagination' in data) || typeof data.pagination !== 'object') {
    throw new Error('Response missing pagination field');
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
        email: `plugins-detail-${userId}@example.com`,
        passwordHash,
        displayName: 'Plugins Detail API User',
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
async function createTestPlugin(key: string, name: string) {
  const pluginId = crypto.randomUUID();

  await runInTenant(TEST_TENANT, async (tx) => {
    await tx.insert(schema.plugins).values({
      pluginId,
      tenantId: TEST_TENANT,
      key,
      name,
      enabled: true,
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

/**
 * Create test plugin run
 */
async function createTestPluginRun(
  pluginId: string,
  trigger: string,
  status: 'running' | 'success' | 'failed',
  startedAt: Date,
  finishedAt: Date | null = null
) {
  const runId = crypto.randomUUID();

  await runInTenant(TEST_TENANT, async (tx) => {
    await tx.insert(schema.pluginRuns).values({
      runId,
      tenantId: TEST_TENANT,
      pluginId,
      trigger,
      status,
      startedAt,
      finishedAt,
      result: status === 'failed'
        ? { errors: [{ errorMessage: 'Test error' }] }
        : { success: true },
    });
  });

  return runId;
}

/**
 * Delete test plugin run
 */
async function deleteTestPluginRun(runId: string) {
  await runInTenant(TEST_TENANT, async (tx) => {
    await tx.delete(schema.pluginRuns).where(eq(schema.pluginRuns.runId, runId));
  });
}

describe('Plugin Management API - Detail and Logs', () => {
  const createdPlugins: string[] = [];
  const createdUsers: string[] = [];
  const createdRuns: string[] = [];
  const registeredHooks: Array<{ hookName: string; pluginId: string }> = [];

  beforeEach(async () => {
    await ensureTenantExists(TEST_TENANT);
  });

  afterEach(async () => {
    // Clean up registered hooks
    for (const { hookName, pluginId } of registeredHooks) {
      unregisterHook(hookName, pluginId);
    }
    registeredHooks.length = 0;

    // Clean up test plugin runs
    for (const runId of createdRuns) {
      await deleteTestPluginRun(runId);
    }
    createdRuns.length = 0;

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

  describe('GET /api/plugins/:id - Plugin details', () => {
    it('should return plugin details with hooks and jobs', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin('slack', 'Slack Integration');
      createdPlugins.push(pluginId);

      // Register a hook for this plugin
      const hookName = 'after:activity:create';
      registerHook(hookName, pluginId, async () => {
        // Test hook handler
      });
      registeredHooks.push({ hookName, pluginId });

      // Create a plugin run (to show job info)
      const runId = await createTestPluginRun(
        pluginId,
        'sync-data',
        'success',
        new Date('2025-01-01T00:00:00Z'),
        new Date('2025-01-01T00:01:00Z')
      );
      createdRuns.push(runId);

      const request = new Request(`http://localhost/api/plugins/${pluginId}`);
      request.headers.set('cookie', cookie);

      const response = await pluginDetailLoader({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      assertPluginDetailResponse(data);

      // Verify plugin data
      expect(data.plugin.pluginId).toBe(pluginId);
      expect(data.plugin.key).toBe('slack');
      expect(data.plugin.name).toBe('Slack Integration');

      // Verify hooks
      expect(data.hooks).toHaveLength(1);
      expect(data.hooks[0]?.hookName).toBe(hookName);

      // Verify jobs
      expect(data.jobs.length).toBeGreaterThan(0);
      const syncJob = data.jobs.find(j => j.jobName === 'sync-data');
      expect(syncJob).toBeDefined();
      expect(syncJob?.lastRun).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should return 400 for invalid UUID', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const request = new Request('http://localhost/api/plugins/invalid-uuid');
      request.headers.set('cookie', cookie);

      const response = await pluginDetailLoader({ request, params: { id: 'invalid-uuid' }, context: {} });
      expect(response.status).toBe(400);

      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.message).toContain('Invalid plugin ID format');
    });

    it('should return 404 for non-existent plugin', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const fakeId = crypto.randomUUID();
      const request = new Request(`http://localhost/api/plugins/${fakeId}`);
      request.headers.set('cookie', cookie);

      const response = await pluginDetailLoader({ request, params: { id: fakeId }, context: {} });
      expect(response.status).toBe(404);

      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.message).toContain('Plugin not found');
    });
  });

  describe('GET /api/plugins/:id/logs - Plugin execution logs', () => {
    it('should return execution logs with pagination', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin('slack', 'Slack Integration');
      createdPlugins.push(pluginId);

      // Create multiple plugin runs
      for (let i = 0; i < 3; i++) {
        const runId = await createTestPluginRun(
          pluginId,
          'sync-data',
          'success',
          new Date(`2025-01-0${i + 1}T00:00:00Z`),
          new Date(`2025-01-0${i + 1}T00:01:00Z`)
        );
        createdRuns.push(runId);
      }

      const request = new Request(`http://localhost/api/plugins/${pluginId}/logs?limit=2&offset=0`);
      request.headers.set('cookie', cookie);

      const response = await pluginLogsLoader({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      assertPluginLogsResponse(data);

      expect(data.logs).toHaveLength(2);
      expect(data.total).toBe(3);
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.offset).toBe(0);
      expect(data.pagination.hasMore).toBe(true);
    });

    it('should filter logs by status', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin('slack', 'Slack Integration');
      createdPlugins.push(pluginId);

      // Create runs with different statuses
      const successRunId = await createTestPluginRun(
        pluginId,
        'sync-data',
        'success',
        new Date('2025-01-01T00:00:00Z'),
        new Date('2025-01-01T00:01:00Z')
      );
      const failedRunId = await createTestPluginRun(
        pluginId,
        'sync-data',
        'failed',
        new Date('2025-01-02T00:00:00Z'),
        new Date('2025-01-02T00:01:00Z')
      );
      createdRuns.push(successRunId, failedRunId);

      const request = new Request(`http://localhost/api/plugins/${pluginId}/logs?status=failed`);
      request.headers.set('cookie', cookie);

      const response = await pluginLogsLoader({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      assertPluginLogsResponse(data);

      expect(data.logs).toHaveLength(1);
      expect(data.logs[0]?.status).toBe('failed');
      expect(data.logs[0]?.error).toBe('Test error');
    });

    it('should calculate duration for completed runs', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin('slack', 'Slack Integration');
      createdPlugins.push(pluginId);

      const runId = await createTestPluginRun(
        pluginId,
        'sync-data',
        'success',
        new Date('2025-01-01T00:00:00Z'),
        new Date('2025-01-01T00:01:00Z') // 1 minute later
      );
      createdRuns.push(runId);

      const request = new Request(`http://localhost/api/plugins/${pluginId}/logs`);
      request.headers.set('cookie', cookie);

      const response = await pluginLogsLoader({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      assertPluginLogsResponse(data);

      expect(data.logs).toHaveLength(1);
      expect(data.logs[0]?.duration).toBe(60000); // 60 seconds in milliseconds
    });

    it('should return 400 for invalid status filter', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin('slack', 'Slack Integration');
      createdPlugins.push(pluginId);

      const request = new Request(`http://localhost/api/plugins/${pluginId}/logs?status=invalid`);
      request.headers.set('cookie', cookie);

      const response = await pluginLogsLoader({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(400);

      const data: unknown = await response.json();
      assertErrorResponse(data);
      expect(data.message).toContain('Invalid status filter');
    });
  });
});
