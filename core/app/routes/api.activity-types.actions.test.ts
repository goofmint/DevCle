/**
 * Activity Types Actions API Tests
 *
 * Integration tests for /api/activity-types/actions endpoint.
 *
 * Test coverage:
 * - GET /api/activity-types/actions
 * - Authorization checks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runInTenant, ensureTenantExists } from '../../core/db/tenant-test-utils.js';
import * as schema from '../../core/db/schema/index.js';
import { createTestSession } from '../middleware/test-utils.js';

const TEST_TENANT_ID = 'test-api-activity-type-actions';

describe('/api/activity-types/actions', () => {
  beforeEach(async () => {
    await ensureTenantExists(TEST_TENANT_ID);

    // Clean up activity_types table
    await runInTenant(TEST_TENANT_ID, async (tx) => {
      await tx.delete(schema.activityTypes);

      // Create test activity types
      await tx.insert(schema.activityTypes).values([
        {
          tenantId: TEST_TENANT_ID,
          action: 'click',
          iconName: 'heroicons:cursor-arrow-rays',
          colorClass: 'text-blue-600 bg-blue-100 border-blue-200',
          stageKey: 'awareness',
        },
        {
          tenantId: TEST_TENANT_ID,
          action: 'attend',
          iconName: 'heroicons:calendar-days',
          colorClass: 'text-green-600 bg-green-100 border-green-200',
          stageKey: 'engagement',
        },
        {
          tenantId: TEST_TENANT_ID,
          action: 'signup',
          iconName: 'heroicons:user-plus',
          colorClass: 'text-purple-600 bg-purple-100 border-purple-200',
          stageKey: 'engagement',
        },
      ]);
    });
  });

  describe('GET /api/activity-types/actions', () => {
    it('should return list of action names for authenticated user', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'member');
      const response = await fetch('/api/activity-types/actions');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.actions).toBeInstanceOf(Array);
      expect(data.actions).toHaveLength(3);
      expect(data.actions.sort()).toEqual(['attend', 'click', 'signup']);
    });

    it('should return empty array when no activity types exist', async () => {
      // Clean up all activity types
      await runInTenant(TEST_TENANT_ID, async (tx) => {
        await tx.delete(schema.activityTypes);
      });

      const { fetch } = await createTestSession(TEST_TENANT_ID, 'member');
      const response = await fetch('/api/activity-types/actions');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.actions).toEqual([]);
    });

    it('should return 401 for unauthorized requests', async () => {
      const response = await fetch('/api/activity-types/actions');

      expect(response.status).toBe(401);
    });
  });
});
