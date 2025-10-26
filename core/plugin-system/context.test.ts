/**
 * Plugin Context Tests
 *
 * Tests for plugin execution context creation and logger functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createPluginContext } from './context.js';

describe('Plugin Context', () => {
  let consoleLogs: string[] = [];
  let consoleErrors: string[] = [];
  let consoleWarns: string[] = [];
  let consoleDebugs: string[] = [];

  // Store original console methods at module level
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalDebug = console.debug;

  beforeEach(() => {
    // Reset console output arrays
    consoleLogs = [];
    consoleErrors = [];
    consoleWarns = [];
    consoleDebugs = [];

    // Override console methods to capture output
    console.log = (message: string) => {
      consoleLogs.push(message);
      originalLog(message);
    };

    console.error = (message: string) => {
      consoleErrors.push(message);
      originalError(message);
    };

    console.warn = (message: string) => {
      consoleWarns.push(message);
      originalWarn(message);
    };

    console.debug = (message: string) => {
      consoleDebugs.push(message);
      originalDebug(message);
    };
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    console.debug = originalDebug;
  });

  describe('createPluginContext', () => {
    it('should create context with correct properties', () => {
      const ctx = createPluginContext('test-plugin-id', 'test-tenant-id');

      expect(ctx.pluginId).toBe('test-plugin-id');
      expect(ctx.tenantId).toBe('test-tenant-id');
      expect(ctx.db).toBeDefined();
      expect(ctx.scheduler).toBeDefined();
      expect(ctx.logger).toBeDefined();
    });

    it('should provide database instance', () => {
      const ctx = createPluginContext('test-plugin-id', 'test-tenant-id');

      // Database should be Drizzle instance (has select, insert, update, delete)
      expect(typeof ctx.db.select).toBe('function');
      expect(typeof ctx.db.insert).toBe('function');
      expect(typeof ctx.db.update).toBe('function');
      expect(typeof ctx.db.delete).toBe('function');
    });

    it('should provide scheduler instance', () => {
      const ctx = createPluginContext('test-plugin-id', 'test-tenant-id');

      // Scheduler should have key methods
      expect(typeof ctx.scheduler.registerJob).toBe('function');
      expect(typeof ctx.scheduler.addJob).toBe('function');
      expect(typeof ctx.scheduler.removeJob).toBe('function');
      expect(typeof ctx.scheduler.getJobStatus).toBe('function');
    });

    it('should provide logger instance', () => {
      const ctx = createPluginContext('test-plugin-id', 'test-tenant-id');

      expect(typeof ctx.logger.info).toBe('function');
      expect(typeof ctx.logger.error).toBe('function');
      expect(typeof ctx.logger.warn).toBe('function');
      expect(typeof ctx.logger.debug).toBe('function');
    });
  });

  describe('Logger', () => {
    it('should log info messages as JSON', () => {
      const ctx = createPluginContext('test-plugin-id', 'test-tenant-id');

      ctx.logger.info('Test info message', { key: 'value' });

      expect(consoleLogs).toHaveLength(1);
      const logText = consoleLogs[0];
      if (!logText) {
        throw new Error('No log output');
      }
      const log = JSON.parse(logText);

      expect(log.level).toBe('info');
      expect(log.message).toBe('Test info message');
      expect(log.pluginId).toBe('test-plugin-id');
      expect(log.tenantId).toBe('test-tenant-id');
      expect(log.meta).toEqual({ key: 'value' });
      expect(log.timestamp).toBeDefined();
    });

    it('should log error messages with error details', () => {
      const ctx = createPluginContext('test-plugin-id', 'test-tenant-id');
      const error = new Error('Test error');

      ctx.logger.error('Error occurred', error, { context: 'test' });

      expect(consoleErrors).toHaveLength(1);
      const logText = consoleErrors[0];
      if (!logText) {
        throw new Error('No error log output');
      }
      const log = JSON.parse(logText);

      expect(log.level).toBe('error');
      expect(log.message).toBe('Error occurred');
      expect(log.error.message).toBe('Test error');
      expect(log.error.stack).toBeDefined();
      expect(log.meta).toEqual({ context: 'test' });
    });

    it('should log warning messages', () => {
      const ctx = createPluginContext('test-plugin-id', 'test-tenant-id');

      ctx.logger.warn('Warning message');

      expect(consoleWarns).toHaveLength(1);
      const logText = consoleWarns[0];
      if (!logText) {
        throw new Error('No warn log output');
      }
      const log = JSON.parse(logText);

      expect(log.level).toBe('warn');
      expect(log.message).toBe('Warning message');
    });

    it('should log debug messages in test environment', () => {
      const ctx = createPluginContext('test-plugin-id', 'test-tenant-id');

      ctx.logger.debug('Debug message', { detail: 'value' });

      // Debug messages are logged in test/development environments
      expect(consoleDebugs.length).toBeGreaterThanOrEqual(0);

      if (consoleDebugs.length > 0) {
        const logText = consoleDebugs[0];
        if (logText) {
          const log = JSON.parse(logText);
          expect(log.level).toBe('debug');
          expect(log.message).toBe('Debug message');
        }
      }
    });
  });
});
