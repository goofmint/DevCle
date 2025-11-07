/**
 * Plugin Events Service Tests
 *
 * Tests for plugin event service layer including:
 * - Sensitive data masking
 * - Event listing with pagination and filtering
 * - Event detail retrieval
 * - Statistics aggregation
 * - Event reprocessing
 *
 * Uses real database with tenant isolation (no mocks)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PluginConfigValues } from '../plugin-system/types.js';
import { eq, and } from 'drizzle-orm';
import { runInTenant, ensureTenantExists } from '../db/tenant-test-utils.js';
import * as schema from '../db/schema/index.js';
import {
  listPluginEvents,
  getPluginEventDetail,
  getPluginEventsStats,
  reprocessEvent,
  ListEventsSchema,
} from './plugin-events.service.js';

describe('Plugin Events Service', () => {
  const TEST_TENANT = 'test-plugin-events';
  let testPluginId: string;

  beforeEach(async () => {
    await ensureTenantExists(TEST_TENANT);

    // Create test plugin (or reuse existing)
    await runInTenant(TEST_TENANT, async (tx) => {
      // Delete existing plugin with same key if it exists
      await tx
        .delete(schema.plugins)
        .where(
          and(
            eq(schema.plugins.tenantId, TEST_TENANT),
            eq(schema.plugins.key, 'drowl-plugin-test-events')
          )
        );

      // Create new plugin
      const [plugin] = await tx
        .insert(schema.plugins)
        .values({
          pluginId: crypto.randomUUID(),
          tenantId: TEST_TENANT,
          key: 'drowl-plugin-test-events',
          name: 'Test Plugin',
          enabled: true,
          config: {},
        })
        .returning();
      if (!plugin) {
        throw new Error('Failed to create test plugin');
      }
      testPluginId = plugin.pluginId;
    });
  });

  afterEach(async () => {
    // Clean up test plugin and related events
    if (testPluginId) {
      await runInTenant(TEST_TENANT, async (tx) => {
        await tx
          .delete(schema.plugins)
          .where(eq(schema.plugins.pluginId, testPluginId));
      });
    }
  });

  describe('listPluginEvents', () => {
    it('should return empty list when no events exist', async () => {
      const input = ListEventsSchema.parse({});
      const result = await listPluginEvents(TEST_TENANT, testPluginId, input);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should list events with default pagination', async () => {
      // Create test events
      await runInTenant(TEST_TENANT, async (tx) => {
        for (let i = 0; i < 5; i++) {
          await tx.insert(schema.pluginEventsRaw).values({
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: { index: i },
            status: 'pending',
          });
        }
      });

      const input = ListEventsSchema.parse({});
      const result = await listPluginEvents(TEST_TENANT, testPluginId, input);

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.items[0]).toHaveProperty('eventId');
      expect(result.items[0]).toHaveProperty('eventType', 'test:event');
      expect(result.items[0]).not.toHaveProperty('rawData');
    });

    it('should filter events by status', async () => {
      await runInTenant(TEST_TENANT, async (tx) => {
        await tx.insert(schema.pluginEventsRaw).values([
          {
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {},
            status: 'pending',
          },
          {
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {},
            status: 'processed',
            processedAt: new Date(),
          },
          {
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {},
            status: 'failed',
            errorMessage: 'Test error',
          },
        ]);
      });

      const pendingResult = await listPluginEvents(
        TEST_TENANT,
        testPluginId,
        ListEventsSchema.parse({ status: ['pending'] })
      );
      expect(pendingResult.total).toBe(1);
      if (pendingResult.items[0]) {
        expect(pendingResult.items[0].status).toBe('pending');
      }

      const processedResult = await listPluginEvents(
        TEST_TENANT,
        testPluginId,
        ListEventsSchema.parse({ status: ['processed'] })
      );
      expect(processedResult.total).toBe(1);
      if (processedResult.items[0]) {
        expect(processedResult.items[0].status).toBe('processed');
      }

      const failedResult = await listPluginEvents(
        TEST_TENANT,
        testPluginId,
        ListEventsSchema.parse({ status: ['failed'] })
      );
      expect(failedResult.total).toBe(1);
      if (failedResult.items[0]) {
        expect(failedResult.items[0].status).toBe('failed');
      }
    });

    it('should filter events by eventType', async () => {
      await runInTenant(TEST_TENANT, async (tx) => {
        await tx.insert(schema.pluginEventsRaw).values([
          {
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'github:pull_request',
            rawData: {},
            status: 'pending',
          },
          {
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'github:issue',
            rawData: {},
            status: 'pending',
          },
        ]);
      });

      const result = await listPluginEvents(
        TEST_TENANT,
        testPluginId,
        ListEventsSchema.parse({ eventType: 'github:pull_request' })
      );

      expect(result.total).toBe(1);
      if (result.items[0]) {
        expect(result.items[0].eventType).toBe('github:pull_request');
      }
    });

    it('should filter events by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await runInTenant(TEST_TENANT, async (tx) => {
        await tx.insert(schema.pluginEventsRaw).values([
          {
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:old',
            rawData: {},
            status: 'pending',
            ingestedAt: yesterday,
          },
          {
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:recent',
            rawData: {},
            status: 'pending',
            ingestedAt: now,
          },
        ]);
      });

      const result = await listPluginEvents(
        TEST_TENANT,
        testPluginId,
        ListEventsSchema.parse({
          startDate: now.toISOString(),
          endDate: tomorrow.toISOString(),
        })
      );

      expect(result.total).toBe(1);
      if (result.items[0]) {
        expect(result.items[0].eventType).toBe('test:recent');
      }
    });

    it('should paginate results correctly', async () => {
      await runInTenant(TEST_TENANT, async (tx) => {
        for (let i = 0; i < 25; i++) {
          await tx.insert(schema.pluginEventsRaw).values({
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: `test:event-${i}`,
            rawData: { index: i },
            status: 'pending',
          });
        }
      });

      const page1 = await listPluginEvents(
        TEST_TENANT,
        testPluginId,
        ListEventsSchema.parse({ page: 1, perPage: 10 })
      );
      expect(page1.items).toHaveLength(10);
      expect(page1.total).toBe(25);

      const page2 = await listPluginEvents(
        TEST_TENANT,
        testPluginId,
        ListEventsSchema.parse({ page: 2, perPage: 10 })
      );
      expect(page2.items).toHaveLength(10);
      expect(page2.total).toBe(25);

      const page3 = await listPluginEvents(
        TEST_TENANT,
        testPluginId,
        ListEventsSchema.parse({ page: 3, perPage: 10 })
      );
      expect(page3.items).toHaveLength(5);
      expect(page3.total).toBe(25);
    });

    it('should sort events by ingestedAt ascending', async () => {
      const timestamps = [
        new Date('2025-01-01T00:00:00Z'),
        new Date('2025-01-02T00:00:00Z'),
        new Date('2025-01-03T00:00:00Z'),
      ];

      await runInTenant(TEST_TENANT, async (tx) => {
        for (const ts of timestamps) {
          await tx.insert(schema.pluginEventsRaw).values({
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {},
            status: 'pending',
            ingestedAt: ts,
          });
        }
      });

      const result = await listPluginEvents(
        TEST_TENANT,
        testPluginId,
        ListEventsSchema.parse({ sort: 'asc' })
      );

      const firstItem = result.items[0];
      const thirdItem = result.items[2];
      if (firstItem && thirdItem) {
        expect(firstItem.ingestedAt.getTime()).toBe(timestamps[0]!.getTime());
        expect(thirdItem.ingestedAt.getTime()).toBe(timestamps[2]!.getTime());
      }
    });

    it('should sort events by ingestedAt descending by default', async () => {
      const timestamps = [
        new Date('2025-01-01T00:00:00Z'),
        new Date('2025-01-02T00:00:00Z'),
        new Date('2025-01-03T00:00:00Z'),
      ];

      await runInTenant(TEST_TENANT, async (tx) => {
        for (const ts of timestamps) {
          await tx.insert(schema.pluginEventsRaw).values({
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {},
            status: 'pending',
            ingestedAt: ts,
          });
        }
      });

      const result = await listPluginEvents(
        TEST_TENANT,
        testPluginId,
        ListEventsSchema.parse({ sort: 'desc' })
      );

      const firstItem = result.items[0];
      const thirdItem = result.items[2];
      if (firstItem && thirdItem) {
        expect(firstItem.ingestedAt.getTime()).toBe(timestamps[2]!.getTime());
        expect(thirdItem.ingestedAt.getTime()).toBe(timestamps[0]!.getTime());
      }
    });
  });

  describe('getPluginEventDetail', () => {
    it('should return null for non-existent event', async () => {
      const result = await getPluginEventDetail(
        TEST_TENANT,
        testPluginId,
        crypto.randomUUID()
      );

      expect(result).toBeNull();
    });

    it('should return event detail with raw data', async () => {
      let testEventId!: string;

      await runInTenant(TEST_TENANT, async (tx) => {
        const [event] = await tx
          .insert(schema.pluginEventsRaw)
          .values({
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: { user: 'john', action: 'create' },
            status: 'processed',
            processedAt: new Date(),
          })
          .returning();
        if (!event) {
          throw new Error('Failed to create test event');
        }
        testEventId = event.eventId;
      });

      const result = await getPluginEventDetail(TEST_TENANT, testPluginId, testEventId);

      expect(result).not.toBeNull();
      expect(result?.eventId).toBe(testEventId);
      expect(result?.eventType).toBe('test:event');
      expect(result?.status).toBe('processed');
      expect(result?.rawData).toEqual({ user: 'john', action: 'create' });
    });

    it('should mask sensitive field names in raw data', async () => {
      let testEventId!: string;

      await runInTenant(TEST_TENANT, async (tx) => {
        const [event] = await tx
          .insert(schema.pluginEventsRaw)
          .values({
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {
              user: 'john',
              token: 'secret_token_12345678',
              api_key: 'sk_test_abcdefghijklmnopqrstuvwxyz',
              password: 'mypassword',
            },
            status: 'pending',
          })
          .returning();
        if (!event) {
          throw new Error('Failed to create test event');
        }
        testEventId = event.eventId;
      });

      const result = await getPluginEventDetail(TEST_TENANT, testPluginId, testEventId);

      expect(result?.rawData).toEqual({
        user: 'john',
        token: 'secr***5678',
        apiKey: 'sk_t***wxyz', // Note: JSONB converts api_key to apiKey
        password: 'mypa***word', // 10 chars: first 4 + *** + last 4
      });
    });

    it('should mask nested sensitive fields', async () => {
      let testEventId!: string;

      await runInTenant(TEST_TENANT, async (tx) => {
        const [event] = await tx
          .insert(schema.pluginEventsRaw)
          .values({
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {
              user: 'john',
              auth: {
                accessToken: 'ghp_1234567890123456789012345678901234567890',
                refreshToken: 'refresh_secret',
              },
              metadata: {
                credentials: {
                  privateKey: 'private_key_value',
                },
              },
            },
            status: 'pending',
          })
          .returning();
        if (!event) {
          throw new Error('Failed to create test event');
        }
        testEventId = event.eventId;
      });

      const result = await getPluginEventDetail(TEST_TENANT, testPluginId, testEventId);

      const rawData = result?.rawData as PluginConfigValues;
      expect(rawData['user']).toBe('john');

      // Field name 'auth' is sensitive, so entire object is masked
      expect(rawData['auth']).toBe('***REDACTED***');

      // Field name 'credentials' is also sensitive, so it's masked too
      const metadata = rawData['metadata'] as unknown as PluginConfigValues;
      expect(metadata['credentials']).toBe('***REDACTED***');
    });

    it('should mask credential-like patterns in string values', async () => {
      let testEventId!: string;

      // Build sample tokens at runtime to avoid triggering gitleaks
      const ghToken = 'ghp_' + 'A'.repeat(32) + '6789';
      const stripeKey = 'sk_test_' + '1'.repeat(32) + 'wxyz';

      await runInTenant(TEST_TENANT, async (tx) => {
        const [event] = await tx
          .insert(schema.pluginEventsRaw)
          .values({
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {
              user: 'john',
              githubToken: ghToken,
              stripeKey: stripeKey,
              normal: 'short',
            },
            status: 'pending',
          })
          .returning();
        if (!event) {
          throw new Error('Failed to create test event');
        }
        testEventId = event.eventId;
      });

      const result = await getPluginEventDetail(TEST_TENANT, testPluginId, testEventId);

      const rawData = result?.rawData as PluginConfigValues;
      expect(rawData['user']).toBe('john');
      expect(rawData['githubToken']).toBe('ghp_***6789');
      expect(rawData['stripeKey']).toBe('sk_t***wxyz');
      expect(rawData['normal']).toBe('short');
    });

    it('should handle arrays in raw data', async () => {
      let testEventId!: string;

      await runInTenant(TEST_TENANT, async (tx) => {
        const [event] = await tx
          .insert(schema.pluginEventsRaw)
          .values({
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {
              users: ['alice', 'bob'],
              tokens: ['token_1234567890', 'secret_abcdefghij'],
            },
            status: 'pending',
          })
          .returning();
        if (!event) {
          throw new Error('Failed to create test event');
        }
        testEventId = event.eventId;
      });

      const result = await getPluginEventDetail(TEST_TENANT, testPluginId, testEventId);

      const rawData = result?.rawData as PluginConfigValues;
      expect(rawData['users']).toEqual(['alice', 'bob']);
      // Field name 'tokens' contains 'token', so entire field is masked
      expect(rawData['tokens']).toBe('***REDACTED***');
    });
  });

  describe('getPluginEventsStats', () => {
    it('should return zero stats for plugin with no events', async () => {
      const stats = await getPluginEventsStats(TEST_TENANT, testPluginId);

      expect(stats.total).toBe(0);
      expect(stats.processed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.latestIngestedAt).toBeNull();
      expect(stats.oldestIngestedAt).toBeNull();
    });

    it('should calculate stats correctly', async () => {
      const oldDate = new Date('2025-01-01T00:00:00Z');
      const now = new Date('2025-01-05T00:00:00Z');
      const newDate = new Date('2025-01-10T00:00:00Z');

      await runInTenant(TEST_TENANT, async (tx) => {
        await tx.insert(schema.pluginEventsRaw).values([
          {
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {},
            status: 'pending',
            ingestedAt: oldDate,
          },
          {
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {},
            status: 'pending',
            ingestedAt: newDate,
          },
          {
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {},
            status: 'processed',
            processedAt: new Date(),
            ingestedAt: now,
          },
          {
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {},
            status: 'processed',
            processedAt: new Date(),
            ingestedAt: now,
          },
          {
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: {},
            status: 'failed',
            errorMessage: 'Test error',
            ingestedAt: now,
          },
        ]);
      });

      const stats = await getPluginEventsStats(TEST_TENANT, testPluginId);

      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(2);
      expect(stats.processed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.latestIngestedAt?.getTime()).toBe(newDate.getTime());
      expect(stats.oldestIngestedAt?.getTime()).toBe(oldDate.getTime());
    });
  });

  describe('reprocessEvent', () => {
    it('should throw error for non-existent event', async () => {
      await expect(
        reprocessEvent(TEST_TENANT, testPluginId, crypto.randomUUID())
      ).rejects.toThrow('Event not found');
    });

    it('should reset event to pending status', async () => {
      let testEventId!: string;

      await runInTenant(TEST_TENANT, async (tx) => {
        const [event] = await tx
          .insert(schema.pluginEventsRaw)
          .values({
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: { test: 'data' },
            status: 'failed',
            processedAt: new Date(),
            errorMessage: 'Previous error',
          })
          .returning();
        if (!event) {
          throw new Error('Failed to create test event');
        }
        testEventId = event.eventId;
      });

      await reprocessEvent(TEST_TENANT, testPluginId, testEventId);

      await runInTenant(TEST_TENANT, async (tx) => {
        const [updatedEvent] = await tx
          .select()
          .from(schema.pluginEventsRaw)
          .where(eq(schema.pluginEventsRaw.eventId, testEventId))
          .limit(1);

        if (updatedEvent) {
          expect(updatedEvent.status).toBe('pending');
          expect(updatedEvent.processedAt).toBeNull();
          expect(updatedEvent.errorMessage).toBeNull();
        }
      });
    });

    it('should allow reprocessing of processed events', async () => {
      let testEventId!: string;

      await runInTenant(TEST_TENANT, async (tx) => {
        const [event] = await tx
          .insert(schema.pluginEventsRaw)
          .values({
            eventId: crypto.randomUUID(),
            tenantId: TEST_TENANT,
            pluginId: testPluginId,
            eventType: 'test:event',
            rawData: { test: 'data' },
            status: 'processed',
            processedAt: new Date(),
          })
          .returning();
        if (!event) {
          throw new Error('Failed to create test event');
        }
        testEventId = event.eventId;
      });

      await reprocessEvent(TEST_TENANT, testPluginId, testEventId);

      await runInTenant(TEST_TENANT, async (tx) => {
        const [updatedEvent] = await tx
          .select()
          .from(schema.pluginEventsRaw)
          .where(eq(schema.pluginEventsRaw.eventId, testEventId))
          .limit(1);

        if (updatedEvent) {
          expect(updatedEvent.status).toBe('pending');
          expect(updatedEvent.processedAt).toBeNull();
        }
      });
    });
  });

  describe('ListEventsSchema validation', () => {
    it('should validate valid query parameters', () => {
      const valid = ListEventsSchema.parse({
        page: '2',
        perPage: '50',
        status: ['pending'],
        eventType: 'github:pull_request',
        sort: 'asc',
      });

      expect(valid.page).toBe(2);
      expect(valid.perPage).toBe(50);
      expect(valid.status).toEqual(['pending']);
      expect(valid.eventType).toBe('github:pull_request');
      expect(valid.sort).toBe('asc');
    });

    it('should apply default values', () => {
      const defaults = ListEventsSchema.parse({});

      expect(defaults.page).toBe(1);
      expect(defaults.perPage).toBe(20);
      expect(defaults.sort).toBe('desc');
    });

    it('should reject invalid page number', () => {
      expect(() => ListEventsSchema.parse({ page: '0' })).toThrow();
      expect(() => ListEventsSchema.parse({ page: '-1' })).toThrow();
    });

    it('should reject invalid perPage value', () => {
      expect(() => ListEventsSchema.parse({ perPage: '0' })).toThrow();
      expect(() => ListEventsSchema.parse({ perPage: '101' })).toThrow();
    });

    it('should reject invalid status', () => {
      expect(() => ListEventsSchema.parse({ status: 'invalid' })).toThrow();
    });

    it('should reject invalid sort order', () => {
      expect(() => ListEventsSchema.parse({ sort: 'invalid' })).toThrow();
    });
  });
});
