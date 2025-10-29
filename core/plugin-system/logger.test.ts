/**
 * Plugin Logger Tests
 *
 * Tests for plugin job execution logging.
 * Covers job run creation, completion, and history retrieval.
 *
 * Note: These tests use real PostgreSQL connections.
 * No mocks are used to ensure end-to-end functionality.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  startJobRun,
  finishJobRun,
  logJobExecution,
  getJobHistory,
} from './logger.js';
import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';

// Test configuration
const TEST_TENANT_ID = 'default';
const TEST_PLUGIN_ID = '00000000-0000-0000-0000-000000000002'; // Test plugin UUID

describe('Plugin Logger', () => {
  beforeAll(async () => {
    // Ensure test plugin exists in database
    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      // Check if plugin exists
      const existing = await tx
        .select()
        .from(schema.plugins)
        .where(eq(schema.plugins.pluginId, TEST_PLUGIN_ID))
        .limit(1);

      if (existing.length === 0) {
        // Create test plugin
        await tx.insert(schema.plugins).values({
          pluginId: TEST_PLUGIN_ID,
          tenantId: TEST_TENANT_ID,
          key: 'test-logger-plugin',
          name: 'Test Logger Plugin',
          enabled: true,
          config: null,
        });
      }
    });
  });

  afterAll(async () => {
    // Clean up test data
    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      await tx
        .delete(schema.pluginRuns)
        .where(eq(schema.pluginRuns.pluginId, TEST_PLUGIN_ID));
    });
  });

  beforeEach(async () => {
    // Clean up test job runs before each test
    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      await tx
        .delete(schema.pluginRuns)
        .where(eq(schema.pluginRuns.pluginId, TEST_PLUGIN_ID));
    });
  });

  describe('startJobRun', () => {
    it('should create a running job record', async () => {
      const runId = await startJobRun(
        TEST_PLUGIN_ID,
        TEST_TENANT_ID,
        'test-job-1'
      );

      expect(runId).toBeDefined();
      expect(typeof runId).toBe('string');

      // Verify record in database
      await withTenantContext(TEST_TENANT_ID, async (tx) => {
        const [run] = await tx
          .select()
          .from(schema.pluginRuns)
          .where(eq(schema.pluginRuns.runId, runId))
          .limit(1);

        if (!run) {
          throw new Error('Run not found');
        }

        expect(run).toBeDefined();
        expect(run.pluginId).toBe(TEST_PLUGIN_ID);
        expect(run.tenantId).toBe(TEST_TENANT_ID);
        expect(run.jobName).toBe('test-job-1');
        expect(run.status).toBe('running');
        expect(run.completedAt).toBeNull();
      });
    });

    it('should include job ID in metadata', async () => {
      const jobId = 'bullmq-job-123';

      const runId = await startJobRun(
        TEST_PLUGIN_ID,
        TEST_TENANT_ID,
        'test-job-2',
        jobId
      );

      await withTenantContext(TEST_TENANT_ID, async (tx) => {
        const [run] = await tx
          .select()
          .from(schema.pluginRuns)
          .where(eq(schema.pluginRuns.runId, runId))
          .limit(1);

        if (!run) {
          throw new Error('Run not found');
        }

        const metadata = run.metadata as Record<string, unknown>;
        expect(metadata['jobId']).toBe(jobId);
      });
    });
  });

  describe('finishJobRun', () => {
    it('should update job run with success status', async () => {
      // Create running job
      const runId = await startJobRun(
        TEST_PLUGIN_ID,
        TEST_TENANT_ID,
        'test-job-3'
      );

      // Finish job
      await finishJobRun(TEST_TENANT_ID, runId, 'success', {
        jobId: 'job-123',
        jobName: 'test-job-3',
        attemptsMade: 1,
        timestamp: new Date(),
        data: { recordsProcessed: 100 },
      });

      // Verify record updated
      await withTenantContext(TEST_TENANT_ID, async (tx) => {
        const [run] = await tx
          .select()
          .from(schema.pluginRuns)
          .where(eq(schema.pluginRuns.runId, runId))
          .limit(1);

        if (!run) {
          throw new Error('Run not found');
        }

        expect(run.status).toBe('success');
        expect(run.completedAt).not.toBeNull();

        const metadata = run.metadata as Record<string, unknown>;
        expect(metadata['jobId']).toBe('job-123');
        expect(metadata['data']).toEqual({ recordsProcessed: 100 });
      });
    });

    it('should update job run with failed status and error', async () => {
      const runId = await startJobRun(
        TEST_PLUGIN_ID,
        TEST_TENANT_ID,
        'test-job-4'
      );

      await finishJobRun(
        TEST_TENANT_ID,
        runId,
        'failed',
        {
          jobId: 'job-124',
          jobName: 'test-job-4',
          attemptsMade: 3,
          timestamp: new Date(),
        },
        'Connection timeout'
      );

      await withTenantContext(TEST_TENANT_ID, async (tx) => {
        const [run] = await tx
          .select()
          .from(schema.pluginRuns)
          .where(eq(schema.pluginRuns.runId, runId))
          .limit(1);

        if (!run) {
          throw new Error('Run not found');
        }

        expect(run.status).toBe('failed');
        expect(run.completedAt).not.toBeNull();

        const metadata = run.metadata as Record<string, unknown>;
        expect(metadata['error']).toBe('Connection timeout');
      });
    });

    it('should throw error if run ID not found', async () => {
      await expect(
        finishJobRun(TEST_TENANT_ID, '00000000-0000-0000-0000-000000000999', 'success')
      ).rejects.toThrow(/not found/);
    });
  });

  describe('logJobExecution', () => {
    it('should log a complete job execution', async () => {
      const runId = await logJobExecution(
        TEST_PLUGIN_ID,
        TEST_TENANT_ID,
        'quick-job-1',
        'success',
        {
          jobId: 'job-125',
          jobName: 'quick-job-1',
          attemptsMade: 1,
          timestamp: new Date(),
          data: { result: 'done' },
        }
      );

      expect(runId).toBeDefined();

      // Verify record
      await withTenantContext(TEST_TENANT_ID, async (tx) => {
        const [run] = await tx
          .select()
          .from(schema.pluginRuns)
          .where(eq(schema.pluginRuns.runId, runId))
          .limit(1);

        if (!run) {
          throw new Error('Run not found');
        }

        expect(run.pluginId).toBe(TEST_PLUGIN_ID);
        expect(run.jobName).toBe('quick-job-1');
        expect(run.status).toBe('success');
        expect(run.startedAt).not.toBeNull();
        expect(run.completedAt).not.toBeNull();

        const metadata = run.metadata as Record<string, unknown>;
        expect(metadata['jobName']).toBe('quick-job-1');
        expect(metadata['data']).toEqual({ result: 'done' });
      });
    });

    it('should log failed execution with error', async () => {
      const runId = await logJobExecution(
        TEST_PLUGIN_ID,
        TEST_TENANT_ID,
        'failed-job-1',
        'failed',
        {
          jobId: 'job-126',
          jobName: 'failed-job-1',
          attemptsMade: 3,
          timestamp: new Date(),
        },
        'API error: 500'
      );

      await withTenantContext(TEST_TENANT_ID, async (tx) => {
        const [run] = await tx
          .select()
          .from(schema.pluginRuns)
          .where(eq(schema.pluginRuns.runId, runId))
          .limit(1);

        if (!run) {
          throw new Error('Run not found');
        }

        expect(run.status).toBe('failed');

        const metadata = run.metadata as Record<string, unknown>;
        expect(metadata['error']).toBe('API error: 500');
      });
    });
  });

  describe('getJobHistory', () => {
    it('should return job execution history', async () => {
      // Create multiple job runs
      await logJobExecution(
        TEST_PLUGIN_ID,
        TEST_TENANT_ID,
        'history-job-1',
        'success'
      );

      await logJobExecution(
        TEST_PLUGIN_ID,
        TEST_TENANT_ID,
        'history-job-2',
        'failed',
        undefined,
        'Error message'
      );

      await logJobExecution(
        TEST_PLUGIN_ID,
        TEST_TENANT_ID,
        'history-job-3',
        'success'
      );

      // Get history
      const history = await getJobHistory(TEST_PLUGIN_ID, TEST_TENANT_ID);

      expect(history).toHaveLength(3);
      if (history.length > 0) {
        const firstRun = history[0];
        if (firstRun) {
          // Job name comes from the actual runs created in the test
          expect(firstRun.jobName).toBeTruthy();
        }
      }

      // History should be ordered by startedAt DESC (most recent first)
      // Note: Order may vary slightly if timestamps are identical
      const statuses = history.map((h) => h.status);
      expect(statuses).toHaveLength(3);
      expect(statuses).toContain('success');
      expect(statuses).toContain('failed');
    });

    it('should respect limit parameter', async () => {
      // Create 5 job runs
      for (let i = 0; i < 5; i++) {
        await logJobExecution(
          TEST_PLUGIN_ID,
          TEST_TENANT_ID,
          `limit-job-${i}`,
          'success'
        );
      }

      // Get history with limit=3
      const history = await getJobHistory(TEST_PLUGIN_ID, TEST_TENANT_ID, 3);

      expect(history).toHaveLength(3);
    });

    it('should return empty array if no history', async () => {
      const history = await getJobHistory(TEST_PLUGIN_ID, TEST_TENANT_ID);
      expect(history).toEqual([]);
    });
  });
});
