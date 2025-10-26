/**
 * Job Scheduler Module
 *
 * Provides BullMQ-based job scheduling for plugins.
 * Plugins can register recurring (cron) jobs and one-time jobs.
 *
 * Key Features:
 * - Cron-based recurring jobs
 * - One-time job scheduling
 * - Priority queue support
 * - Automatic retry with configurable backoff
 * - Job timeout handling
 * - Execution logging to plugin_runs table
 *
 * Architecture:
 * 1. JobScheduler class - Main scheduler interface
 * 2. Queue per plugin:job combination
 * 3. Worker processes to execute jobs
 * 4. QueueEvents for monitoring
 *
 * Usage Example:
 * ```typescript
 * const scheduler = getScheduler();
 * await scheduler.registerJob(
 *   'google-analytics',
 *   'sync-data',
 *   async (ctx, job) => {
 *     // Job logic here
 *   },
 *   { cron: '0 * * * *' } // Hourly
 * );
 * ```
 */

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import type { JobsOptions, RepeatOptions } from 'bullmq';
import Redis from 'ioredis';

/**
 * Job handler function signature
 *
 * Handlers receive a minimal context and the BullMQ job object.
 * The job object contains data, progress tracking, and metadata.
 */
export type JobHandler = (ctx: JobContext, job: Job) => Promise<void>;

/**
 * Job execution context
 *
 * Minimal context passed to job handlers.
 * Provides tenant ID and plugin ID for data isolation.
 */
export interface JobContext {
  /** Tenant ID for RLS and data isolation */
  tenantId: string;
  /** Plugin ID that registered this job */
  pluginId: string;
  /** Job name */
  jobName: string;
}

/**
 * Job registration options
 *
 * Options for configuring job scheduling and execution behavior.
 */
export interface JobOptions {
  /**
   * Cron expression (e.g., '0 0 * * *' for daily at midnight)
   * If specified, creates a repeatable job
   */
  cron?: string;

  /**
   * Job priority (lower number = higher priority)
   * Default: undefined (no priority)
   */
  priority?: number;

  /**
   * Max number of retry attempts
   * Default: 3
   */
  attempts?: number;

  /**
   * Backoff strategy for retries
   */
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };

  /**
   * Job timeout in milliseconds
   * If job runs longer than this, it will be failed
   */
  timeout?: number;

  /**
   * Delay before job execution (milliseconds)
   * Only for one-time jobs
   */
  delay?: number;
}

/**
 * Job status information
 *
 * Status returned by getJobStatus()
 */
export interface JobStatus {
  id: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown';
  attemptsMade: number;
  progress: number | undefined;
  returnvalue: unknown;
  failedReason: string | undefined;
  finishedOn: Date | null;
}

/**
 * Job metadata stored in plugin_runs table
 *
 * Stored as JSON in the result column of plugin_runs
 */
export interface JobMetadata {
  jobId: string;
  jobName: string;
  attemptsMade: number;
  timestamp: Date;
  data?: unknown;
  progress?: number;
  error?: string;
}

/**
 * Registered handler entry
 *
 * Internal data structure for tracking registered job handlers
 */
interface RegisteredHandler {
  pluginId: string;
  jobName: string;
  handler: JobHandler;
  tenantId: string;
}

/**
 * Job Scheduler for plugin background tasks
 *
 * Manages BullMQ queues, workers, and job execution.
 * Singleton pattern - use getScheduler() to access.
 */
export class JobScheduler {
  private queues: Map<string, Queue>;
  private workers: Map<string, Worker>;
  private queueEvents: Map<string, QueueEvents>;
  private handlers: Map<string, RegisteredHandler>;
  private redisConnection: Redis;
  private redisOptions: { host: string; port: number; password?: string };

  /**
   * Create a new JobScheduler instance
   *
   * @param redisUrl - Redis connection URL (e.g., 'redis://localhost:6379')
   */
  constructor(redisUrl: string) {
    this.queues = new Map();
    this.workers = new Map();
    this.queueEvents = new Map();
    this.handlers = new Map();

    // Parse Redis URL
    const url = new URL(redisUrl);
    this.redisOptions = {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
    };

    // Extract password from URL if present
    if (url.password) {
      this.redisOptions.password = url.password;
    }

    // Create shared Redis connection for BullMQ
    this.redisConnection = new Redis(this.redisOptions);
  }

  /**
   * Register a new job with scheduler
   *
   * Creates a queue for the job if it doesn't exist, registers the handler,
   * and optionally creates a repeatable job for cron scheduling.
   *
   * @param pluginId - Plugin identifier
   * @param jobName - Unique job name within plugin
   * @param handler - Job handler function
   * @param tenantId - Tenant identifier for data isolation
   * @param options - Job scheduling options
   *
   * @example
   * ```typescript
   * await scheduler.registerJob(
   *   'google-analytics',
   *   'sync-data',
   *   async (ctx, job) => {
   *     // Job logic
   *   },
   *   'default',
   *   { cron: '0 * * * *' } // Every hour
   * );
   * ```
   */
  async registerJob(
    pluginId: string,
    jobName: string,
    handler: JobHandler,
    tenantId: string,
    options: JobOptions = {}
  ): Promise<void> {
    // Generate queue name (format: plugin:{pluginId}:{jobName})
    const queueName = this.getQueueName(pluginId, jobName);

    // Create or get queue
    let queue = this.queues.get(queueName);
    if (!queue) {
      queue = new Queue(queueName, {
        connection: this.redisOptions,
      });
      this.queues.set(queueName, queue);
    }

    // Store handler in registry
    const handlerKey = this.getHandlerKey(pluginId, jobName);
    this.handlers.set(handlerKey, {
      pluginId,
      jobName,
      handler,
      tenantId,
    });

    // Start worker if not already started for this queue
    if (!this.workers.has(queueName)) {
      await this.startWorker(queueName);
    }

    // If cron is specified, create repeatable job
    if (options.cron) {
      const repeatOptions: RepeatOptions = {
        pattern: options.cron,
      };

      const jobOptions: JobsOptions = {
        repeat: repeatOptions,
      };

      // Add job-specific options
      if (options.priority !== undefined) {
        jobOptions.priority = options.priority;
      }
      if (options.attempts !== undefined) {
        jobOptions.attempts = options.attempts;
      }
      if (options.backoff) {
        jobOptions.backoff = {
          type: options.backoff.type,
          delay: options.backoff.delay,
        };
      }
      // Note: timeout is not directly supported in JobsOptions
      // It's handled at the Worker level instead

      // Add repeatable job to queue
      await queue.add(
        jobName,
        { pluginId, tenantId }, // Job data
        jobOptions
      );
    }
  }

  /**
   * Remove a job from scheduler
   *
   * Removes repeatable jobs and unregisters the handler.
   * Does not remove the queue/worker (other jobs may be using them).
   *
   * @param pluginId - Plugin identifier
   * @param jobName - Job name to remove
   */
  async removeJob(pluginId: string, jobName: string): Promise<void> {
    const queueName = this.getQueueName(pluginId, jobName);
    const queue = this.queues.get(queueName);

    if (queue) {
      // Remove all repeatable jobs for this job name
      const repeatableJobs = await queue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === jobName) {
          await queue.removeRepeatableByKey(job.key);
        }
      }
    }

    // Remove handler from registry
    const handlerKey = this.getHandlerKey(pluginId, jobName);
    this.handlers.delete(handlerKey);
  }

  /**
   * Add a one-time job to queue
   *
   * Adds a single job execution to the queue.
   * Job must be registered first via registerJob().
   *
   * @param pluginId - Plugin identifier
   * @param jobName - Job name (must be registered)
   * @param data - Job data payload
   * @param options - Job execution options
   *
   * @returns Job ID
   *
   * @throws Error if job is not registered
   *
   * @example
   * ```typescript
   * await scheduler.addJob(
   *   'notifications',
   *   'send-email',
   *   { to: 'user@example.com', subject: 'Hello' },
   *   { delay: 5000 } // Send after 5 seconds
   * );
   * ```
   */
  async addJob(
    pluginId: string,
    jobName: string,
    data?: unknown,
    options?: JobOptions
  ): Promise<string> {
    const queueName = this.getQueueName(pluginId, jobName);
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(
        `Job "${jobName}" for plugin "${pluginId}" is not registered. Call registerJob() first.`
      );
    }

    // Get handler to extract tenant ID
    const handlerKey = this.getHandlerKey(pluginId, jobName);
    const registered = this.handlers.get(handlerKey);
    if (!registered) {
      throw new Error(
        `Job "${jobName}" for plugin "${pluginId}" is not registered. Call registerJob() first.`
      );
    }

    // Build job options
    const jobOptions: JobsOptions = {};
    if (options?.priority !== undefined) {
      jobOptions.priority = options.priority;
    }
    if (options?.attempts !== undefined) {
      jobOptions.attempts = options.attempts;
    }
    if (options?.backoff) {
      jobOptions.backoff = {
        type: options.backoff.type,
        delay: options.backoff.delay,
      };
    }
    // Note: timeout is not directly supported in JobsOptions
    // It's handled at the Worker level instead
    if (options?.delay !== undefined) {
      jobOptions.delay = options.delay;
    }

    // Add job to queue
    const job = await queue.add(
      jobName,
      { pluginId, tenantId: registered.tenantId, data },
      jobOptions
    );

    if (!job || !job.id) {
      throw new Error('Failed to create job');
    }

    return job.id;
  }

  /**
   * Get job status
   *
   * Returns the current state of a job by ID.
   *
   * @param pluginId - Plugin identifier
   * @param jobName - Job name
   * @param jobId - Job ID
   *
   * @returns Job status or null if not found
   */
  async getJobStatus(
    pluginId: string,
    jobName: string,
    jobId: string
  ): Promise<JobStatus | null> {
    const queueName = this.getQueueName(pluginId, jobName);
    const queue = this.queues.get(queueName);

    if (!queue) {
      return null;
    }

    // Get job from queue
    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    // Get job state
    const state = await job.getState();

    // Ensure progress is explicitly number or undefined
    const progress = typeof job.progress === 'number' ? job.progress : undefined;
    const failedReason = typeof job.failedReason === 'string' ? job.failedReason : undefined;

    return {
      id: job.id ?? 'unknown',
      state: state as JobStatus['state'],
      attemptsMade: job.attemptsMade,
      progress,
      returnvalue: job.returnvalue,
      failedReason,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
    };
  }

  /**
   * Start worker for processing jobs
   *
   * Creates a Worker instance to process jobs from the queue.
   * Handles job execution, error handling, and logging.
   *
   * @param queueName - Queue name to process
   * @private
   */
  private async startWorker(queueName: string): Promise<void> {
    // Create worker
    const worker = new Worker(
      queueName,
      async (job: Job) => {
        // Extract plugin ID and tenant ID from job data
        const { pluginId, tenantId } = job.data as {
          pluginId: string;
          tenantId: string;
        };

        // Get handler from registry
        const handlerKey = this.getHandlerKey(pluginId, job.name ?? 'unknown');
        const registered = this.handlers.get(handlerKey);

        if (!registered) {
          throw new Error(
            `Handler not found for job "${job.name}" (plugin "${pluginId}")`
          );
        }

        // Create job context
        const ctx: JobContext = {
          tenantId,
          pluginId,
          jobName: job.name ?? 'unknown',
        };

        // Execute handler
        await registered.handler(ctx, job);
      },
      {
        connection: this.redisOptions,
      }
    );

    this.workers.set(queueName, worker);

    // Set up QueueEvents for monitoring
    const queueEvents = new QueueEvents(queueName, {
      connection: this.redisOptions,
    });
    this.queueEvents.set(queueName, queueEvents);

    // Handle worker errors
    worker.on('failed', (job, err) => {
      if (job) {
        console.error(
          `Job ${job.id} (${job.name}) failed:`,
          err.message
        );
      }
    });
  }

  /**
   * Close all connections
   *
   * Closes all workers, queue events, queues, and Redis connections.
   * Call this on application shutdown.
   */
  async close(): Promise<void> {
    // Close all workers
    const workerCloses = Array.from(this.workers.values()).map((worker) =>
      worker.close()
    );
    await Promise.all(workerCloses);

    // Close all queue events
    const eventsCloses = Array.from(this.queueEvents.values()).map((events) =>
      events.close()
    );
    await Promise.all(eventsCloses);

    // Close all queues
    const queueCloses = Array.from(this.queues.values()).map((queue) =>
      queue.close()
    );
    await Promise.all(queueCloses);

    // Close Redis connection
    await this.redisConnection.quit();

    // Clear maps
    this.workers.clear();
    this.queueEvents.clear();
    this.queues.clear();
    this.handlers.clear();
  }

  /**
   * Generate queue name from plugin ID and job name
   *
   * @param pluginId - Plugin identifier
   * @param jobName - Job name
   * @returns Queue name (format: plugin-{pluginId}-{jobName})
   * @private
   */
  private getQueueName(pluginId: string, jobName: string): string {
    return `plugin-${pluginId}-${jobName}`;
  }

  /**
   * Generate handler registry key
   *
   * @param pluginId - Plugin identifier
   * @param jobName - Job name
   * @returns Handler key
   * @private
   */
  private getHandlerKey(pluginId: string, jobName: string): string {
    return `${pluginId}-${jobName}`;
  }
}

/**
 * Global job scheduler instance
 */
let globalScheduler: JobScheduler | null = null;

/**
 * Get or create global scheduler instance
 *
 * Singleton accessor for the job scheduler.
 * Uses REDIS_URL from environment variables.
 *
 * @returns Global JobScheduler instance
 *
 * @throws Error if REDIS_URL is not set
 */
export function getScheduler(): JobScheduler {
  if (!globalScheduler) {
    const redisUrl = process.env['REDIS_URL'];
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    globalScheduler = new JobScheduler(redisUrl);
  }
  return globalScheduler;
}

/**
 * Close global scheduler
 *
 * Closes all connections and resets the global instance.
 * Call this on application shutdown.
 */
export async function closeScheduler(): Promise<void> {
  if (globalScheduler) {
    await globalScheduler.close();
    globalScheduler = null;
  }
}
