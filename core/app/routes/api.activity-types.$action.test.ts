/**
 * Activity Type Individual Resource API Tests
 *
 * Integration tests for /api/activity-types/:action endpoints.
 *
 * Test coverage:
 * - GET /api/activity-types/:action
 * - PUT /api/activity-types/:action
 * - DELETE /api/activity-types/:action
 * - Authorization checks
 * - Input validation
 * - Error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runInTenant, ensureTenantExists } from '../../core/db/tenant-test-utils.js';
import * as schema from '../../core/db/schema/index.js';
import { createTestSession } from '../middleware/test-utils.js';

const TEST_TENANT_ID = 'test-api-activity-type-action';

describe('/api/activity-types/:action', () => {
  beforeEach(async () => {
    await ensureTenantExists(TEST_TENANT_ID);

    // Clean up activity_types table
    await runInTenant(TEST_TENANT_ID, async (tx) => {
      await tx.delete(schema.activityTypes);

      // Create test activity type
      await tx.insert(schema.activityTypes).values({
        tenantId: TEST_TENANT_ID,
        action: 'click',
        iconName: 'heroicons:cursor-arrow-rays',
        colorClass: 'text-blue-600 bg-blue-100 border-blue-200',
        stageKey: 'awareness',
      });
    });
  });

  describe('GET /api/activity-types/:action', () => {
    it('should get activity type by action', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'member');
      const response = await fetch('/api/activity-types/click');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.activityType).toMatchObject({
        action: 'click',
        iconName: 'heroicons:cursor-arrow-rays',
        colorClass: 'text-blue-600 bg-blue-100 border-blue-200',
        stageKey: 'awareness',
      });
    });

    it('should return 404 when activity type not found', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'member');
      const response = await fetch('/api/activity-types/nonexistent');

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Activity type not found');
    });

    it('should return 401 for unauthorized requests', async () => {
      const response = await fetch('/api/activity-types/click');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/activity-types/:action', () => {
    it('should update icon name', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types/click', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iconName: 'heroicons:cursor-arrow-ripple',
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.activityType.iconName).toBe('heroicons:cursor-arrow-ripple');
      expect(data.activityType.colorClass).toBe('text-blue-600 bg-blue-100 border-blue-200');
      expect(data.activityType.stageKey).toBe('awareness');
    });

    it('should update color class', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types/click', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colorClass: 'text-red-600 bg-red-100 border-red-200',
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.activityType.colorClass).toBe('text-red-600 bg-red-100 border-red-200');
      expect(data.activityType.iconName).toBe('heroicons:cursor-arrow-rays');
      expect(data.activityType.stageKey).toBe('awareness');
    });

    it('should update stage key', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types/click', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageKey: 'engagement',
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.activityType.stageKey).toBe('engagement');
      expect(data.activityType.iconName).toBe('heroicons:cursor-arrow-rays');
      expect(data.activityType.colorClass).toBe('text-blue-600 bg-blue-100 border-blue-200');
    });

    it('should update stage key to null', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types/click', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageKey: null,
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.activityType.stageKey).toBeNull();
    });

    it('should update all fields', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types/click', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iconName: 'heroicons:cursor-arrow-ripple',
          colorClass: 'text-red-600 bg-red-100 border-red-200',
          stageKey: 'engagement',
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.activityType).toMatchObject({
        iconName: 'heroicons:cursor-arrow-ripple',
        colorClass: 'text-red-600 bg-red-100 border-red-200',
        stageKey: 'engagement',
      });
    });

    it('should return 404 when activity type not found', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types/nonexistent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iconName: 'heroicons:bolt',
        }),
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Activity type not found');
    });

    it('should return 403 for non-admin users', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'member');
      const response = await fetch('/api/activity-types/click', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iconName: 'heroicons:cursor-arrow-ripple',
        }),
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Admin role required');
    });

    it('should return 401 for unauthorized requests', async () => {
      const response = await fetch('/api/activity-types/click', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iconName: 'heroicons:cursor-arrow-ripple',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/activity-types/:action', () => {
    it('should delete activity type', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types/click', {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);

      // Verify deletion
      const getResponse = await fetch('/api/activity-types/click');
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 when activity type not found', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'admin');
      const response = await fetch('/api/activity-types/nonexistent', {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Activity type not found');
    });

    it('should return 403 for non-admin users', async () => {
      const { fetch } = await createTestSession(TEST_TENANT_ID, 'member');
      const response = await fetch('/api/activity-types/click', {
        method: 'DELETE',
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Admin role required');
    });

    it('should return 401 for unauthorized requests', async () => {
      const response = await fetch('/api/activity-types/click', {
        method: 'DELETE',
      });

      expect(response.status).toBe(401);
    });
  });
});
