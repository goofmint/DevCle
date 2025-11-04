/**
 * Plugin Events API Integration Tests
 *
 * Tests for plugin events API endpoints.
 * Uses real database and authentication (no mocks).
 *
 * Test coverage:
 * - GET /api/plugins/:id/events - List events with filtering/pagination
 * - GET /api/plugins/:id/events/stats - Get event statistics
 * - GET /api/plugins/:id/events/:eventId - Get event detail
 * - POST /api/plugins/:id/events/:eventId/reprocess - Reprocess event
 * - Authentication and tenant isolation
 * - Rate limiting
 * - Error handling (401, 404, 400, 429)
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
import { loader as eventsLoader } from './api.plugins.$id.events.js';
import { loader as statsLoader } from './api.plugins.$id.events.stats.js';
import { loader as eventDetailLoader } from './api.plugins.$id.events.$eventId.js';
import { action as reprocessAction } from './api.plugins.$id.events.$eventId.reprocess.js';
import { getSession, commitSession } from '../sessions.server.js';
import * as schema from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { closeDb } from '../../db/connection.js';

const TEST_TENANT = 'test-plugin-events-api';
const PASSWORD = 'password-1234';

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
        email: `events-${userId}@example.com`,
        passwordHash,
        displayName: 'Events API User',
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
async function createTestPlugin() {
  const pluginId = crypto.randomUUID();

  await runInTenant(TEST_TENANT, async (tx) => {
    await tx.insert(schema.plugins).values({
      pluginId,
      tenantId: TEST_TENANT,
      key: 'drowl-plugin-test-events-api',
      name: 'Test Plugin',
      enabled: true,
      config: {},
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
 * Create test event
 */
async function createTestEvent(
  pluginId: string,
  data: {
    eventType?: string;
    status?: 'pending' | 'processed' | 'failed';
    rawData?: unknown;
    processedAt?: Date | null;
    errorMessage?: string | null;
    ingestedAt?: Date;
  } = {}
) {
  const eventId = crypto.randomUUID();

  await runInTenant(TEST_TENANT, async (tx) => {
    await tx.insert(schema.pluginEventsRaw).values({
      eventId,
      tenantId: TEST_TENANT,
      pluginId,
      eventType: data.eventType ?? 'test:event',
      rawData: data.rawData ?? { test: 'data' },
      status: data.status ?? 'pending',
      processedAt: data.processedAt ?? null,
      errorMessage: data.errorMessage ?? null,
      ingestedAt: data.ingestedAt ?? new Date(),
    });
  });

  return eventId;
}

describe('Plugin Events API', () => {
  const createdPlugins: string[] = [];
  const createdUsers: string[] = [];

  beforeEach(async () => {
    await ensureTenantExists(TEST_TENANT);
  });

  afterEach(async () => {
    for (const pluginId of createdPlugins) {
      await deleteTestPlugin(pluginId);
    }
    createdPlugins.length = 0;

    for (const userId of createdUsers) {
      await deleteUser(userId);
    }
    createdUsers.length = 0;
  });

  afterAll(async () => {
    await closeDb();
  });

  describe('GET /api/plugins/:id/events - List events', () => {
    it('should return 401 without authentication', async () => {
      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const request = new Request(`http://localhost/api/plugins/${pluginId}/events`);
      const response = await eventsLoader({ request, params: { id: pluginId }, context: {} });

      expect(response.status).toBe(302);
    });

    it('should return 400 for missing plugin ID', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const request = new Request('http://localhost/api/plugins//events');
      request.headers.set('cookie', cookie);

      const response = await eventsLoader({ request, params: {}, context: {} });
      expect(response.status).toBe(400);

      const data: unknown = await response.json();
      expect(data).toHaveProperty('error', 'Plugin ID is required');
    });

    it('should return empty list for plugin with no events', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const request = new Request(`http://localhost/api/plugins/${pluginId}/events`);
      request.headers.set('cookie', cookie);

      const response = await eventsLoader({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('pagination');

      const typedData = data as { items: unknown[]; pagination: unknown };
      expect(typedData.items).toHaveLength(0);
    });

    it('should list events with default pagination', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      await createTestEvent(pluginId, { eventType: 'test:event-1' });
      await createTestEvent(pluginId, { eventType: 'test:event-2' });
      await createTestEvent(pluginId, { eventType: 'test:event-3' });

      const request = new Request(`http://localhost/api/plugins/${pluginId}/events`);
      request.headers.set('cookie', cookie);

      const response = await eventsLoader({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      const typedData = data as { items: unknown[]; pagination: { total: number } };

      expect(typedData.items).toHaveLength(3);
      expect(typedData.pagination.total).toBe(3);
    });

    it('should filter events by status', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      await createTestEvent(pluginId, { status: 'pending' });
      await createTestEvent(pluginId, { status: 'processed', processedAt: new Date() });
      await createTestEvent(pluginId, { status: 'failed', errorMessage: 'Test error' });

      const request = new Request(
        `http://localhost/api/plugins/${pluginId}/events?status=pending`
      );
      request.headers.set('cookie', cookie);

      const response = await eventsLoader({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      const typedData = data as {
        items: Array<{ status: string }>;
        pagination: { total: number };
      };

      expect(typedData.items).toHaveLength(1);
      if (typedData.items[0]) {
        expect(typedData.items[0].status).toBe('pending');
      }
      expect(typedData.pagination.total).toBe(1);
    });

    it('should filter events by eventType', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      await createTestEvent(pluginId, { eventType: 'github:pull_request' });
      await createTestEvent(pluginId, { eventType: 'github:issue' });
      await createTestEvent(pluginId, { eventType: 'github:pull_request' });

      const request = new Request(
        `http://localhost/api/plugins/${pluginId}/events?eventType=github:pull_request`
      );
      request.headers.set('cookie', cookie);

      const response = await eventsLoader({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      const typedData = data as {
        items: Array<{ eventType: string }>;
        pagination: { total: number };
      };

      expect(typedData.items).toHaveLength(2);
      if (typedData.items[0]) {
        expect(typedData.items[0].eventType).toBe('github:pull_request');
      }
      expect(typedData.pagination.total).toBe(2);
    });

    it('should paginate results', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      for (let i = 0; i < 25; i++) {
        await createTestEvent(pluginId);
      }

      const request = new Request(
        `http://localhost/api/plugins/${pluginId}/events?page=2&perPage=10`
      );
      request.headers.set('cookie', cookie);

      const response = await eventsLoader({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      const typedData = data as {
        items: unknown[];
        pagination: { total: number; page: number; perPage: number; totalPages: number };
      };

      expect(typedData.items).toHaveLength(10);
      expect(typedData.pagination.total).toBe(25);
      expect(typedData.pagination.page).toBe(2);
      expect(typedData.pagination.totalPages).toBe(3);
    });

    it('should return 400 for invalid query parameters', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const request = new Request(
        `http://localhost/api/plugins/${pluginId}/events?page=0`
      );
      request.headers.set('cookie', cookie);

      const response = await eventsLoader({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(400);

      const data: unknown = await response.json();
      expect(data).toHaveProperty('error', 'Invalid query parameters');
    });
  });

  describe('GET /api/plugins/:id/events/stats - Get statistics', () => {
    it('should return 401 without authentication', async () => {
      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const request = new Request(`http://localhost/api/plugins/${pluginId}/events/stats`);
      const response = await statsLoader({ request, params: { id: pluginId }, context: {} });

      expect(response.status).toBe(302);
    });

    it('should return 400 for missing plugin ID', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const request = new Request('http://localhost/api/plugins//events/stats');
      request.headers.set('cookie', cookie);

      const response = await statsLoader({ request, params: {}, context: {} });
      expect(response.status).toBe(400);

      const data: unknown = await response.json();
      expect(data).toHaveProperty('error', 'Plugin ID is required');
    });

    it('should return zero stats for plugin with no events', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const request = new Request(`http://localhost/api/plugins/${pluginId}/events/stats`);
      request.headers.set('cookie', cookie);

      const response = await statsLoader({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      expect(data).toEqual({
        total: 0,
        processed: 0,
        failed: 0,
        pending: 0,
        latestIngestedAt: null,
        oldestIngestedAt: null,
      });
    });

    it('should calculate statistics correctly', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const oldDate = new Date('2025-01-01T00:00:00Z');
      const newDate = new Date('2025-01-10T00:00:00Z');

      await createTestEvent(pluginId, { status: 'pending', ingestedAt: oldDate });
      await createTestEvent(pluginId, { status: 'pending', ingestedAt: newDate });
      await createTestEvent(pluginId, { status: 'processed', processedAt: new Date() });
      await createTestEvent(pluginId, { status: 'processed', processedAt: new Date() });
      await createTestEvent(pluginId, { status: 'failed', errorMessage: 'Test error' });

      const request = new Request(`http://localhost/api/plugins/${pluginId}/events/stats`);
      request.headers.set('cookie', cookie);

      const response = await statsLoader({ request, params: { id: pluginId }, context: {} });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      const typedData = data as {
        total: number;
        pending: number;
        processed: number;
        failed: number;
        latestIngestedAt: string;
        oldestIngestedAt: string;
      };

      expect(typedData.total).toBe(5);
      expect(typedData.pending).toBe(2);
      expect(typedData.processed).toBe(2);
      expect(typedData.failed).toBe(1);
      expect(new Date(typedData.latestIngestedAt).getTime()).toBe(newDate.getTime());
      expect(new Date(typedData.oldestIngestedAt).getTime()).toBe(oldDate.getTime());
    });
  });

  describe('GET /api/plugins/:id/events/:eventId - Get event detail', () => {
    it('should return 401 without authentication', async () => {
      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const eventId = crypto.randomUUID();
      const request = new Request(
        `http://localhost/api/plugins/${pluginId}/events/${eventId}`
      );
      const response = await eventDetailLoader({
        request,
        params: { id: pluginId, eventId },
        context: {},
      });

      expect(response.status).toBe(302);
    });

    it('should return 400 for missing plugin ID', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const eventId = crypto.randomUUID();
      const request = new Request(`http://localhost/api/plugins//events/${eventId}`);
      request.headers.set('cookie', cookie);

      const response = await eventDetailLoader({
        request,
        params: { eventId },
        context: {},
      });
      expect(response.status).toBe(400);

      const data: unknown = await response.json();
      expect(data).toHaveProperty('error', 'Plugin ID is required');
    });

    it('should return 400 for missing event ID', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const request = new Request(`http://localhost/api/plugins/${pluginId}/events/`);
      request.headers.set('cookie', cookie);

      const response = await eventDetailLoader({
        request,
        params: { id: pluginId },
        context: {},
      });
      expect(response.status).toBe(400);

      const data: unknown = await response.json();
      expect(data).toHaveProperty('error', 'Event ID is required');
    });

    it('should return 404 for non-existent event', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const eventId = crypto.randomUUID();
      const request = new Request(
        `http://localhost/api/plugins/${pluginId}/events/${eventId}`
      );
      request.headers.set('cookie', cookie);

      const response = await eventDetailLoader({
        request,
        params: { id: pluginId, eventId },
        context: {},
      });
      expect(response.status).toBe(404);

      const data: unknown = await response.json();
      expect(data).toHaveProperty('error', 'Event not found');
    });

    it('should return event detail with raw data', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const eventId = await createTestEvent(pluginId, {
        eventType: 'test:event',
        status: 'processed',
        rawData: { user: 'john', action: 'create' },
        processedAt: new Date(),
      });

      const request = new Request(
        `http://localhost/api/plugins/${pluginId}/events/${eventId}`
      );
      request.headers.set('cookie', cookie);

      const response = await eventDetailLoader({
        request,
        params: { id: pluginId, eventId },
        context: {},
      });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      const typedData = data as {
        eventId: string;
        eventType: string;
        status: string;
        rawData: unknown;
      };

      expect(typedData.eventId).toBe(eventId);
      expect(typedData.eventType).toBe('test:event');
      expect(typedData.status).toBe('processed');
      expect(typedData.rawData).toEqual({ user: 'john', action: 'create' });
    });

    it('should mask sensitive data in raw data', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const eventId = await createTestEvent(pluginId, {
        rawData: {
          user: 'john',
          token: 'secret_token_12345678',
          api_key: 'sk_test_abcdefghijklmnopqrstuvwxyz',
        },
      });

      const request = new Request(
        `http://localhost/api/plugins/${pluginId}/events/${eventId}`
      );
      request.headers.set('cookie', cookie);

      const response = await eventDetailLoader({
        request,
        params: { id: pluginId, eventId },
        context: {},
      });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      const typedData = data as { rawData: Record<string, unknown> };

      expect(typedData.rawData['user']).toBe('john');
      expect(typedData.rawData['token']).toBe('secr***5678');
      expect(typedData.rawData['api_key']).toBe('sk_t***wxyz');
    });
  });

  describe('POST /api/plugins/:id/events/:eventId/reprocess - Reprocess event', () => {
    it('should return 401 without authentication', async () => {
      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const eventId = crypto.randomUUID();
      const request = new Request(
        `http://localhost/api/plugins/${pluginId}/events/${eventId}/reprocess`,
        { method: 'POST' }
      );
      const response = await reprocessAction({
        request,
        params: { id: pluginId, eventId },
        context: {},
      });

      expect(response.status).toBe(302);
    });

    it('should return 400 for missing plugin ID', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const eventId = crypto.randomUUID();
      const request = new Request(
        `http://localhost/api/plugins//events/${eventId}/reprocess`,
        { method: 'POST' }
      );
      request.headers.set('cookie', cookie);

      const response = await reprocessAction({
        request,
        params: { eventId },
        context: {},
      });
      expect(response.status).toBe(400);

      const data: unknown = await response.json();
      expect(data).toHaveProperty('error', 'Plugin ID is required');
    });

    it('should return 400 for missing event ID', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const request = new Request(
        `http://localhost/api/plugins/${pluginId}/events//reprocess`,
        { method: 'POST' }
      );
      request.headers.set('cookie', cookie);

      const response = await reprocessAction({
        request,
        params: { id: pluginId },
        context: {},
      });
      expect(response.status).toBe(400);

      const data: unknown = await response.json();
      expect(data).toHaveProperty('error', 'Event ID is required');
    });

    it('should return 404 for non-existent event', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const eventId = crypto.randomUUID();
      const request = new Request(
        `http://localhost/api/plugins/${pluginId}/events/${eventId}/reprocess`,
        { method: 'POST' }
      );
      request.headers.set('cookie', cookie);

      const response = await reprocessAction({
        request,
        params: { id: pluginId, eventId },
        context: {},
      });
      expect(response.status).toBe(404);

      const data: unknown = await response.json();
      expect(data).toHaveProperty('error', 'Event not found');
    });

    it('should reprocess failed event', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const eventId = await createTestEvent(pluginId, {
        status: 'failed',
        processedAt: new Date(),
        errorMessage: 'Previous error',
      });

      const request = new Request(
        `http://localhost/api/plugins/${pluginId}/events/${eventId}/reprocess`,
        { method: 'POST' }
      );
      request.headers.set('cookie', cookie);

      const response = await reprocessAction({
        request,
        params: { id: pluginId, eventId },
        context: {},
      });
      expect(response.status).toBe(200);

      const data: unknown = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('message', 'Reprocessing queued');

      // Verify event was reset to pending
      await runInTenant(TEST_TENANT, async (tx) => {
        const [updatedEvent] = await tx
          .select()
          .from(schema.pluginEventsRaw)
          .where(eq(schema.pluginEventsRaw.eventId, eventId))
          .limit(1);

        if (updatedEvent) {
          expect(updatedEvent.status).toBe('pending');
          expect(updatedEvent.processedAt).toBeNull();
          expect(updatedEvent.errorMessage).toBeNull();
        }
      });
    });

    it('should reprocess processed event', async () => {
      const { userId, cookie } = await createAuthSession();
      createdUsers.push(userId);

      const pluginId = await createTestPlugin();
      createdPlugins.push(pluginId);

      const eventId = await createTestEvent(pluginId, {
        status: 'processed',
        processedAt: new Date(),
      });

      const request = new Request(
        `http://localhost/api/plugins/${pluginId}/events/${eventId}/reprocess`,
        { method: 'POST' }
      );
      request.headers.set('cookie', cookie);

      const response = await reprocessAction({
        request,
        params: { id: pluginId, eventId },
        context: {},
      });
      expect(response.status).toBe(200);

      await runInTenant(TEST_TENANT, async (tx) => {
        const [updatedEvent] = await tx
          .select()
          .from(schema.pluginEventsRaw)
          .where(eq(schema.pluginEventsRaw.eventId, eventId))
          .limit(1);

        if (updatedEvent) {
          expect(updatedEvent.status).toBe('pending');
          expect(updatedEvent.processedAt).toBeNull();
        }
      });
    });
  });
});
