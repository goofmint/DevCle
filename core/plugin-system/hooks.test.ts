/**
 * Hook Registry Tests
 *
 * Tests the hook registration and execution system without mocks.
 * Uses real database transactions via withTenantContext.
 *
 * Test Structure:
 * 1. registerHook() - Handler registration
 * 2. executeHook() - Handler execution and logging
 * 3. unregisterHook() - Handler removal
 * 4. listHooks() - Registry inspection
 * 5. Integration - End-to-end scenarios
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  registerHook,
  executeHook,
  unregisterHook,
  listHooks,
  type HookContext,
} from './hooks.js';
import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

// Test constants
const TEST_TENANT_ID = 'default';
const TEST_PLUGIN_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
const TEST_PLUGIN_ID_2 = '550e8400-e29b-41d4-a716-446655440002';

/**
 * Setup test plugin records in database
 *
 * Creates plugin records required for FK constraints in plugin_runs table.
 */
beforeAll(async () => {
  await withTenantContext(TEST_TENANT_ID, async (tx) => {
    // Create test plugins (if not exist)
    await tx
      .insert(schema.plugins)
      .values([
        {
          pluginId: TEST_PLUGIN_ID_1,
          tenantId: TEST_TENANT_ID,
          key: 'test-plugin-1',
          name: 'Test Plugin 1',
          enabled: true,
        },
        {
          pluginId: TEST_PLUGIN_ID_2,
          tenantId: TEST_TENANT_ID,
          key: 'test-plugin-2',
          name: 'Test Plugin 2',
          enabled: true,
        },
      ])
      .onConflictDoNothing();
  });
});

/**
 * Cleanup after each test
 *
 * Unregisters all hooks to prevent test interference.
 */
afterEach(() => {
  // Clear all registered hooks
  const hooks = listHooks();
  for (const [hookName] of hooks) {
    unregisterHook(hookName, TEST_PLUGIN_ID_1);
    unregisterHook(hookName, TEST_PLUGIN_ID_2);
  }
});

/**
 * Cleanup test data
 *
 * Removes plugin_runs and plugin records created during tests.
 */
afterAll(async () => {
  await withTenantContext(TEST_TENANT_ID, async (tx) => {
    // Delete plugin_runs (cascade will happen)
    await tx
      .delete(schema.pluginRuns)
      .where(eq(schema.pluginRuns.tenantId, TEST_TENANT_ID));

    // Delete test plugins
    await tx
      .delete(schema.plugins)
      .where(eq(schema.plugins.pluginId, TEST_PLUGIN_ID_1));
    await tx
      .delete(schema.plugins)
      .where(eq(schema.plugins.pluginId, TEST_PLUGIN_ID_2));
  });
});

describe('Hook Registry', () => {
  describe('registerHook()', () => {
    it('should register a single handler', () => {
      const handler = () => {};
      registerHook('test:hook:1', TEST_PLUGIN_ID_1, handler);

      const hooks = listHooks();
      const handlers = hooks.get('test:hook:1');

      expect(handlers).toBeDefined();
      if (!handlers) throw new Error('Handlers should be defined');
      expect(handlers).toHaveLength(1);
      const firstHandler = handlers[0];
      if (!firstHandler) throw new Error('First handler should exist');
      expect(firstHandler.pluginId).toBe(TEST_PLUGIN_ID_1);
    });

    it('should register multiple handlers for the same hook', () => {
      const handler1 = () => {};
      const handler2 = () => {};

      registerHook('test:hook:2', TEST_PLUGIN_ID_1, handler1);
      registerHook('test:hook:2', TEST_PLUGIN_ID_2, handler2);

      const hooks = listHooks();
      const handlers = hooks.get('test:hook:2');

      expect(handlers).toBeDefined();
      if (!handlers) throw new Error('Handlers should be defined');
      expect(handlers).toHaveLength(2);
      const firstHandler = handlers[0];
      const secondHandler = handlers[1];
      if (!firstHandler || !secondHandler) throw new Error('Handlers should exist');
      expect(firstHandler.pluginId).toBe(TEST_PLUGIN_ID_1);
      expect(secondHandler.pluginId).toBe(TEST_PLUGIN_ID_2);
    });

    it('should allow duplicate registration from same plugin', () => {
      const handler1 = () => {};
      const handler2 = () => {};

      registerHook('test:hook:3', TEST_PLUGIN_ID_1, handler1);
      registerHook('test:hook:3', TEST_PLUGIN_ID_1, handler2);

      const hooks = listHooks();
      const handlers = hooks.get('test:hook:3');

      expect(handlers).toBeDefined();
      if (!handlers) throw new Error('Handlers should be defined');
      expect(handlers).toHaveLength(2);
      const firstHandler = handlers[0];
      const secondHandler = handlers[1];
      if (!firstHandler || !secondHandler) throw new Error('Handlers should exist');
      expect(firstHandler.pluginId).toBe(TEST_PLUGIN_ID_1);
      expect(secondHandler.pluginId).toBe(TEST_PLUGIN_ID_1);
    });
  });

  describe('executeHook()', () => {
    it('should execute a single handler successfully', async () => {
      let executed = false;
      const handler = () => {
        executed = true;
      };

      registerHook('test:hook:exec:1', TEST_PLUGIN_ID_1, handler);

      const result = await executeHook('test:hook:exec:1', TEST_TENANT_ID, {
        test: 'data',
      });

      expect(executed).toBe(true);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.runId).toBeDefined();
    });

    it('should execute multiple handlers in order', async () => {
      const order: number[] = [];

      const handler1 = () => {
        order.push(1);
      };
      const handler2 = () => {
        order.push(2);
      };
      const handler3 = () => {
        order.push(3);
      };

      registerHook('test:hook:exec:2', TEST_PLUGIN_ID_1, handler1);
      registerHook('test:hook:exec:2', TEST_PLUGIN_ID_2, handler2);
      registerHook('test:hook:exec:2', TEST_PLUGIN_ID_1, handler3);

      const result = await executeHook('test:hook:exec:2', TEST_TENANT_ID, {
        test: 'data',
      });

      expect(order).toEqual([1, 2, 3]);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle errors gracefully (fail-safe)', async () => {
      let handler1Executed = false;
      let handler3Executed = false;

      const handler1 = () => {
        handler1Executed = true;
      };
      const handler2 = () => {
        throw new Error('Handler 2 failed');
      };
      const handler3 = () => {
        handler3Executed = true;
      };

      registerHook('test:hook:exec:3', TEST_PLUGIN_ID_1, handler1);
      registerHook('test:hook:exec:3', TEST_PLUGIN_ID_2, handler2);
      registerHook('test:hook:exec:3', TEST_PLUGIN_ID_1, handler3);

      const result = await executeHook('test:hook:exec:3', TEST_TENANT_ID, {
        test: 'data',
      });

      // Handlers 1 and 3 should execute despite handler 2 failing
      expect(handler1Executed).toBe(true);
      expect(handler3Executed).toBe(true);

      // Result should indicate partial failure
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      const firstError = result.errors[0];
      if (!firstError) throw new Error('Error should exist');
      expect(firstError.pluginId).toBe(TEST_PLUGIN_ID_2);
      expect(firstError.error.message).toBe('Handler 2 failed');
    });

    it('should return success for unregistered hook (silent fail)', async () => {
      const result = await executeHook('test:hook:nonexistent', TEST_TENANT_ID, {
        test: 'data',
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      // Run ID should be system placeholder
      expect(result.runId).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('should pass correct context to handlers', async () => {
      let receivedContext: HookContext | undefined;

      const handler = (ctx: HookContext) => {
        receivedContext = ctx;
      };

      registerHook('test:hook:exec:context', TEST_PLUGIN_ID_1, handler);

      await executeHook('test:hook:exec:context', TEST_TENANT_ID, {
        test: 'data',
      });

      expect(receivedContext).toBeDefined();
      if (!receivedContext) throw new Error('Context should be defined');
      expect(receivedContext.tenantId).toBe(TEST_TENANT_ID);
      expect(receivedContext.pluginId).toBe(TEST_PLUGIN_ID_1);
      expect(receivedContext.hookName).toBe('test:hook:exec:context');
      expect(receivedContext.timestamp).toBeInstanceOf(Date);
    });

    it('should pass arguments to handlers', async () => {
      let receivedArgs: unknown = null;

      const handler = (_ctx: HookContext, args: unknown) => {
        receivedArgs = args;
      };

      registerHook('test:hook:exec:args', TEST_PLUGIN_ID_1, handler);

      const testArgs = {
        activityId: '123',
        developerId: '456',
        action: 'star',
      };

      await executeHook('test:hook:exec:args', TEST_TENANT_ID, testArgs);

      expect(receivedArgs).toEqual(testArgs);
    });

    it('should log execution to plugin_runs table', async () => {
      const handler = () => {};

      registerHook('test:hook:exec:logging', TEST_PLUGIN_ID_1, handler);

      const result = await executeHook('test:hook:exec:logging', TEST_TENANT_ID, {
        test: 'data',
      });

      // Verify run was logged
      const runs = await withTenantContext(TEST_TENANT_ID, async (tx) => {
        return await tx
          .select()
          .from(schema.pluginRuns)
          .where(eq(schema.pluginRuns.runId, result.runId));
      });

      expect(runs).toHaveLength(1);
      const firstRun = runs[0];
      if (!firstRun) throw new Error('Run should exist');
      expect(firstRun.tenantId).toBe(TEST_TENANT_ID);
      expect(firstRun.pluginId).toBe(TEST_PLUGIN_ID_1);
      expect(firstRun.jobName).toBe('hook-execution');
      expect(firstRun.status).toBe('success');

      // Verify metadata structure
      const metadataRecord = firstRun.metadata as {
        hookName: string;
        argsHash: string;
        errors: unknown[];
        handlerCount: number;
        successCount: number;
        failureCount: number;
      };
      expect(metadataRecord.hookName).toBe('test:hook:exec:logging');
      expect(metadataRecord.argsHash).toBeDefined();
      expect(metadataRecord.errors).toHaveLength(0);
      expect(metadataRecord.handlerCount).toBe(1);
      expect(metadataRecord.successCount).toBe(1);
      expect(metadataRecord.failureCount).toBe(0);
    });
  });

  describe('unregisterHook()', () => {
    it('should remove handlers for a plugin', () => {
      const handler1 = () => {};
      const handler2 = () => {};

      registerHook('test:hook:unreg:1', TEST_PLUGIN_ID_1, handler1);
      registerHook('test:hook:unreg:1', TEST_PLUGIN_ID_2, handler2);

      // Verify both handlers registered
      let hooks = listHooks();
      let handlers = hooks.get('test:hook:unreg:1');
      if (!handlers) throw new Error('Handlers should be defined');
      expect(handlers).toHaveLength(2);

      // Unregister plugin 1
      unregisterHook('test:hook:unreg:1', TEST_PLUGIN_ID_1);

      // Verify only plugin 2's handler remains
      hooks = listHooks();
      handlers = hooks.get('test:hook:unreg:1');
      if (!handlers) throw new Error('Handlers should be defined');
      expect(handlers).toHaveLength(1);
      const remainingHandler = handlers[0];
      if (!remainingHandler) throw new Error('Handler should exist');
      expect(remainingHandler.pluginId).toBe(TEST_PLUGIN_ID_2);
    });

    it('should remove hook from registry when no handlers remain', () => {
      const handler = () => {};

      registerHook('test:hook:unreg:2', TEST_PLUGIN_ID_1, handler);

      // Verify hook registered
      let hooks = listHooks();
      expect(hooks.has('test:hook:unreg:2')).toBe(true);

      // Unregister the only handler
      unregisterHook('test:hook:unreg:2', TEST_PLUGIN_ID_1);

      // Verify hook removed from registry
      hooks = listHooks();
      expect(hooks.has('test:hook:unreg:2')).toBe(false);
    });

    it('should be safe to unregister non-existent hook', () => {
      // Should not throw
      expect(() => {
        unregisterHook('test:hook:nonexistent', TEST_PLUGIN_ID_1);
      }).not.toThrow();
    });
  });

  describe('listHooks()', () => {
    it('should return all registered hooks', () => {
      const handler1 = () => {};
      const handler2 = () => {};
      const handler3 = () => {};

      registerHook('test:hook:list:1', TEST_PLUGIN_ID_1, handler1);
      registerHook('test:hook:list:2', TEST_PLUGIN_ID_1, handler2);
      registerHook('test:hook:list:2', TEST_PLUGIN_ID_2, handler3);

      const hooks = listHooks();

      expect(hooks.size).toBeGreaterThanOrEqual(2);
      expect(hooks.has('test:hook:list:1')).toBe(true);
      expect(hooks.has('test:hook:list:2')).toBe(true);

      const handlers1 = hooks.get('test:hook:list:1');
      const handlers2 = hooks.get('test:hook:list:2');

      expect(handlers1).toHaveLength(1);
      expect(handlers2).toHaveLength(2);
    });
  });

  describe('Integration Tests', () => {
    it('should handle async handlers', async () => {
      let executed = false;

      const asyncHandler = async () => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
        executed = true;
      };

      registerHook('test:hook:integration:async', TEST_PLUGIN_ID_1, asyncHandler);

      const result = await executeHook('test:hook:integration:async', TEST_TENANT_ID, {
        test: 'data',
      });

      expect(executed).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should compute different hashes for different arguments', async () => {
      const handler = () => {};

      registerHook('test:hook:integration:hash', TEST_PLUGIN_ID_1, handler);

      const result1 = await executeHook('test:hook:integration:hash', TEST_TENANT_ID, {
        data: 'A',
      });

      const result2 = await executeHook('test:hook:integration:hash', TEST_TENANT_ID, {
        data: 'B',
      });

      // Fetch both run records
      const runs = await withTenantContext(TEST_TENANT_ID, async (tx) => {
        return await tx
          .select()
          .from(schema.pluginRuns)
          .where(eq(schema.pluginRuns.jobName, 'hook-execution'))
          .orderBy(schema.pluginRuns.startedAt);
      });

      // Find our test runs
      const run1 = runs.find((r) => r.runId === result1.runId);
      const run2 = runs.find((r) => r.runId === result2.runId);

      expect(run1).toBeDefined();
      expect(run2).toBeDefined();
      if (!run1 || !run2) throw new Error('Runs should exist');

      const hash1 = (run1.metadata as { argsHash: string } | null)?.argsHash;
      const hash2 = (run2.metadata as { argsHash: string } | null)?.argsHash;

      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
      expect(hash1).not.toBe(hash2);
    });

    it('should log partial status for mixed success/failure', async () => {
      const handler1 = () => {};
      const handler2 = () => {
        throw new Error('Intentional failure');
      };

      registerHook('test:hook:integration:partial', TEST_PLUGIN_ID_1, handler1);
      registerHook('test:hook:integration:partial', TEST_PLUGIN_ID_2, handler2);

      const result = await executeHook('test:hook:integration:partial', TEST_TENANT_ID, {
        test: 'data',
      });

      const runs = await withTenantContext(TEST_TENANT_ID, async (tx) => {
        return await tx
          .select()
          .from(schema.pluginRuns)
          .where(eq(schema.pluginRuns.runId, result.runId));
      });

      expect(runs).toHaveLength(1);
      const firstRun = runs[0];
      if (!firstRun) throw new Error('Run should exist');
      expect(firstRun.status).toBe('partial');

      const metadataRecord = firstRun.metadata as {
        successCount: number;
        failureCount: number;
        errors: Array<{ pluginId: string; errorMessage: string }>;
      };
      expect(metadataRecord.successCount).toBe(1);
      expect(metadataRecord.failureCount).toBe(1);
      expect(metadataRecord.errors).toHaveLength(1);
      const firstError = metadataRecord.errors[0];
      if (!firstError) throw new Error('Error should exist');
      expect(firstError.pluginId).toBe(TEST_PLUGIN_ID_2);
    });
  });
});
