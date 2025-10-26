/**
 * Job Scheduler Tests
 *
 * Tests for the BullMQ-based job scheduler.
 * Covers job registration, execution, status tracking, and logging.
 *
 * Note: These tests use real Redis and PostgreSQL connections.
 * No mocks are used to ensure end-to-end functionality.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { JobScheduler } from './scheduler.js';
import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';

// Test configuration
const TEST_REDIS_URL = process.env['REDIS_URL'] || 'redis://localhost:6379';
const TEST_TENANT_ID = 'default';
const TEST_PLUGIN_ID = '00000000-0000-0000-0000-000000000001'; // Test plugin UUID

describe('JobScheduler', () => {
  let scheduler: JobScheduler;

  beforeAll(async () => {
    // Create scheduler instance
    scheduler = new JobScheduler(TEST_REDIS_URL);

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
          key: 'test-plugin',
          name: 'Test Plugin',
          enabled: true,
          config: null,
        });
      }
    });
  });

  afterAll(async () => {
    // Clean up scheduler
    await scheduler.close();
  });

  beforeEach(async () => {
    // Clean up test jobs before each test
    await withTenantContext(TEST_TENANT_ID, async (tx) => {
      await tx
        .delete(schema.pluginRuns)
        .where(eq(schema.pluginRuns.pluginId, TEST_PLUGIN_ID));
    });
  });

  describe('registerJob', () => {
    it('should register a job handler', async () => {
      let executed = false;

      await scheduler.registerJob(
        TEST_PLUGIN_ID,
        'test-job-1',
        async () => {
          executed = true;
        },
        TEST_TENANT_ID
      );

      // Job is registered but not executed yet (no cron, no manual add)
      expect(executed).toBe(false);
    });

    it('should register a cron job', async () => {
      // Register a cron job (every minute)
      await scheduler.registerJob(
        TEST_PLUGIN_ID,
        'cron-job-1',
        async () => {
          // Cron job handler
        },
        TEST_TENANT_ID,
        {
          cron: '* * * * *', // Every minute
        }
      );

      // Job is registered (we can't easily test cron execution in unit tests)
      // The fact that no error was thrown means registration succeeded
    });

    it('should register a job with options', async () => {
      await scheduler.registerJob(
        TEST_PLUGIN_ID,
        'options-job-1',
        async () => {
          // Job handler
        },
        TEST_TENANT_ID,
        {
          priority: 1,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          timeout: 30000,
        }
      );

      // Job is registered
    });
  });

  describe('addJob', () => {
    it('should add a one-time job to queue', async () => {
      let executedData: unknown = null;

      // Register job first
      await scheduler.registerJob(
        TEST_PLUGIN_ID,
        'one-time-job-1',
        async (_ctx, job) => {
          executedData = job.data;
        },
        TEST_TENANT_ID
      );

      // Add job to queue
      const jobId = await scheduler.addJob(
        TEST_PLUGIN_ID,
        'one-time-job-1',
        { message: 'Hello, World!' }
      );

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      // Wait for job to execute
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Job should have executed
      expect(executedData).toEqual({
        pluginId: TEST_PLUGIN_ID,
        tenantId: TEST_TENANT_ID,
        data: { message: 'Hello, World!' },
      });
    });

    it('should throw error if job is not registered', async () => {
      await expect(
        scheduler.addJob(TEST_PLUGIN_ID, 'non-existent-job', {})
      ).rejects.toThrow(/not registered/);
    });

    it('should add job with priority', async () => {
      let executionOrder: string[] = [];

      // Register job
      await scheduler.registerJob(
        TEST_PLUGIN_ID,
        'priority-job-1',
        async (_ctx, job) => {
          const jobData = job.data as { pluginId: string; tenantId: string; data: { id: string } };
          executionOrder.push(jobData.data.id);
        },
        TEST_TENANT_ID
      );

      // Add jobs with different priorities (lower number = higher priority)
      await scheduler.addJob(TEST_PLUGIN_ID, 'priority-job-1', { id: 'low' }, { priority: 10 });
      await scheduler.addJob(TEST_PLUGIN_ID, 'priority-job-1', { id: 'high' }, { priority: 1 });
      await scheduler.addJob(TEST_PLUGIN_ID, 'priority-job-1', { id: 'medium' }, { priority: 5 });

      // Wait for jobs to execute
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Jobs should execute in priority order
      expect(executionOrder).toEqual(['high', 'medium', 'low']);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      // Register job
      await scheduler.registerJob(
        TEST_PLUGIN_ID,
        'status-job-1',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        },
        TEST_TENANT_ID
      );

      // Add job
      const jobId = await scheduler.addJob(TEST_PLUGIN_ID, 'status-job-1', {});

      // Get status immediately (should be waiting or active)
      const status1 = await scheduler.getJobStatus(TEST_PLUGIN_ID, 'status-job-1', jobId);
      expect(status1).toBeDefined();
      expect(status1?.id).toBe(jobId);
      expect(['waiting', 'active', 'delayed']).toContain(status1?.state);

      // Wait for job to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get status after completion (should be completed)
      const status2 = await scheduler.getJobStatus(TEST_PLUGIN_ID, 'status-job-1', jobId);
      expect(status2).toBeDefined();
      expect(status2?.state).toBe('completed');
    });

    it('should return null for non-existent job', async () => {
      const status = await scheduler.getJobStatus(
        TEST_PLUGIN_ID,
        'non-existent-job',
        'fake-job-id'
      );
      expect(status).toBeNull();
    });
  });

  describe('removeJob', () => {
    it('should remove a registered job', async () => {
      // Register job
      await scheduler.registerJob(
        TEST_PLUGIN_ID,
        'removable-job-1',
        async () => {
          // Job handler
        },
        TEST_TENANT_ID
      );

      // Remove job
      await scheduler.removeJob(TEST_PLUGIN_ID, 'removable-job-1');

      // Trying to add job should now fail
      await expect(
        scheduler.addJob(TEST_PLUGIN_ID, 'removable-job-1', {})
      ).rejects.toThrow(/not registered/);
    });
  });

  describe('job execution context', () => {
    it('should provide correct context to job handler', async () => {
      let receivedContext: { tenantId: string; pluginId: string; jobName: string } | null = null;

      await scheduler.registerJob(
        TEST_PLUGIN_ID,
        'context-job-1',
        async (ctx) => {
          receivedContext = {
            tenantId: ctx.tenantId,
            pluginId: ctx.pluginId,
            jobName: ctx.jobName,
          };
        },
        TEST_TENANT_ID
      );

      await scheduler.addJob(TEST_PLUGIN_ID, 'context-job-1', {});

      // Wait for execution
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(receivedContext).toEqual({
        tenantId: TEST_TENANT_ID,
        pluginId: TEST_PLUGIN_ID,
        jobName: 'context-job-1',
      });
    });
  });
});
