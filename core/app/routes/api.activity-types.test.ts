/**
 * Activity Types API Tests
 *
 * Integration tests for /api/activity-types endpoints.
 *
 * Test coverage:
 * - GET /api/activity-types (list)
 * - POST /api/activity-types (create)
 * - Authorization checks
 * - Input validation
 * - Error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runInTenant, ensureTenantExists } from '../../core/db/tenant-test-utils.js';
import * as schema from '../../core/db/schema/index.js';
import { createTestSession } from '../middleware/test-utils.js';

const TEST_TENANT_ID = 'test-api-activity-types';

describe('/api/activity-types', () => {
  beforeEach(async () => {
    await ensureTenantExists(TEST_TENANT_ID);

    // Clean up activity_types table
    await runInTenant(TEST_TENANT_ID, async (tx) => {
      await tx.delete(schema.activityTypes);
    });
  });

  describe('GET /api/activity-types', () => {
    it('should list activity types for admin', async () => {
      // Create activity types
      await runInTenant(TEST_TENANT_ID, async (tx) => {
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
        ]);
      });

      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.activityTypes).toHaveLength(2);
      expect(data.activityTypes.map((at: any) => at.action).sort()).toEqual([
        'attend',
        'click',
      ]);
    });

    it('should respect limit parameter', async () => {
      // Create 3 activity types
      await runInTenant(TEST_TENANT_ID, async (tx) => {
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

      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types?limit=2');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.activityTypes).toHaveLength(2);
    });

    it('should respect offset parameter', async () => {
      // Create 3 activity types
      await runInTenant(TEST_TENANT_ID, async (tx) => {
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

      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types?offset=1');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.activityTypes).toHaveLength(2);
    });

    it('should return 403 for non-admin users', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'member');
      const response = await fetch('/api/activity-types');

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Admin role required');
    });

    it('should return 401 for unauthorized requests', async () => {
      const response = await fetch('/api/activity-types');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/activity-types', () => {
    it('should create activity type for admin', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'contribute',
          iconName: 'heroicons:code-bracket',
          colorClass: 'text-indigo-600 bg-indigo-100 border-indigo-200',
          stageKey: 'engagement',
        }),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.activityType).toMatchObject({
        action: 'contribute',
        iconName: 'heroicons:code-bracket',
        colorClass: 'text-indigo-600 bg-indigo-100 border-indigo-200',
        stageKey: 'engagement',
      });
    });

    it('should create activity type with default values', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'download',
          iconName: 'heroicons:bolt',
          colorClass: 'text-gray-600 bg-gray-100 border-gray-200',
        }),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.activityType.action).toBe('download');
    });

    it('should return 400 for invalid request body', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing action field
          iconName: 'heroicons:bolt',
        }),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid request body');
    });

    it('should return 409 for duplicate action', async () => {
      // Create first activity type
      await runInTenant(TEST_TENANT_ID, async (tx) => {
        await tx.insert(schema.activityTypes).values({
          tenantId: TEST_TENANT_ID,
          action: 'click',
          iconName: 'heroicons:cursor-arrow-rays',
          colorClass: 'text-blue-600 bg-blue-100 border-blue-200',
          stageKey: 'awareness',
        });
      });

      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'click', // Duplicate
          iconName: 'heroicons:cursor-arrow-ripple',
          colorClass: 'text-red-600 bg-red-100 border-red-200',
          stageKey: 'awareness',
        }),
      });

      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data.error).toContain('already exists');
    });

    it('should return 403 for non-admin users', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'member');
      const response = await fetch('/api/activity-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'click',
          iconName: 'heroicons:cursor-arrow-rays',
          colorClass: 'text-blue-600 bg-blue-100 border-blue-200',
          stageKey: 'awareness',
        }),
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Admin role required');
    });

    it('should return 401 for unauthorized requests', async () => {
      const response = await fetch('/api/activity-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'click',
          iconName: 'heroicons:cursor-arrow-rays',
          colorClass: 'text-blue-600 bg-blue-100 border-blue-200',
          stageKey: 'awareness',
        }),
      });

      expect(response.status).toBe(401);
    });
  });
});
