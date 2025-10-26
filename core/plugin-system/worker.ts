/**
 * Job Worker Process
 *
 * Standalone worker process for executing plugin jobs.
 * This file is meant to be run as a separate Node.js process.
 *
 * Usage:
 * ```bash
 * node core/plugin-system/worker.js
 * ```
 *
 * The worker connects to Redis, listens for jobs in all plugin queues,
 * and executes them. It handles graceful shutdown on SIGTERM/SIGINT.
 *
 * Key Features:
 * - Automatic job execution from all registered queues
 * - Graceful shutdown handling
 * - Error logging and recovery
 * - Integration with plugin_runs logging
 *
 * Architecture:
 * - Workers are started automatically when jobs are registered
 * - Each queue has its own worker instance
 * - Workers share the same Redis connection pool
 * - Job execution is logged to plugin_runs table
 */

import { getScheduler, closeScheduler } from './scheduler.js';

/**
 * Start job worker process
 *
 * Initializes the global scheduler, which automatically starts
 * workers for all registered job queues.
 *
 * The scheduler must be initialized before workers can process jobs.
 * In a real deployment, this would be run as a separate process
 * from the main application server.
 */
async function startWorker(): Promise<void> {
  try {
    // Initialize scheduler (connects to Redis)
    // The scheduler instance is stored globally
    getScheduler();

    console.log('Job worker started successfully');
    console.log('Waiting for jobs to be registered...');
    console.log('Press Ctrl+C to stop');

    // Note: Workers are created automatically when jobs are registered
    // via scheduler.registerJob(). This process just keeps the scheduler
    // alive to process jobs.

    // Set up graceful shutdown handlers
    setupShutdownHandlers();
  } catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
}

/**
 * Set up graceful shutdown handlers
 *
 * Listens for SIGTERM and SIGINT signals to gracefully shut down
 * the worker process. Ensures all running jobs complete before exit.
 *
 * @private
 */
function setupShutdownHandlers(): void {
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log('Shutdown already in progress...');
      return;
    }

    isShuttingDown = true;
    console.log(`\n${signal} received, shutting down gracefully...`);

    try {
      // Close scheduler (closes all workers, queues, and Redis connection)
      await closeScheduler();
      console.log('Worker shut down successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle SIGTERM (sent by Docker, Kubernetes, etc.)
  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((error) => {
      console.error('Error in SIGTERM handler:', error);
      process.exit(1);
    });
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((error) => {
      console.error('Error in SIGINT handler:', error);
      process.exit(1);
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    shutdown('UNCAUGHT_EXCEPTION').catch(() => {
      process.exit(1);
    });
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('UNHANDLED_REJECTION').catch(() => {
      process.exit(1);
    });
  });
}

/**
 * Main entry point
 *
 * Starts the worker process if this file is run directly.
 * Skips execution if imported as a module.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker().catch((error) => {
    console.error('Worker startup failed:', error);
    process.exit(1);
  });
}

// Export for testing
export { startWorker };
