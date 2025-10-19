/**
 * Activity Service Tests
 *
 * Focuses on verifying that activity operations respect tenant isolation and
 * share the same transaction-scoped helper API used in production code.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { closeDb } from '../db/connection.js';
import {
  runInTenant,
  ensureTenantExists,
} from '../db/tenant-test-utils.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import {
  createActivity,
  listActivities,
  deleteActivity,
} from './activity.service.js';
import { createDeveloper, deleteDeveloper } from './drm.service.js';

const PRIMARY_TENANT = 'test-tenant-activities';
const SECONDARY_TENANT = 'test-tenant-activities-b';

async function createDeveloperForTenant(
  tenantId: string,
  suffix: string
): Promise<string> {
  await ensureTenantExists(tenantId);

  const developer = await createDeveloper(tenantId, {
    displayName: `QA ${suffix}`,
    primaryEmail: `qa-${suffix}@example.dev`,
    orgId: null,
  });
  return developer.developerId;
}

async function removeDeveloper(id: string, tenantId: string): Promise<void> {
  await deleteDeveloper(tenantId, id);
}

async function clearActivities(tenantId: string): Promise<void> {
  await runInTenant(tenantId, async (tx) => {
    await tx.delete(schema.activities).where(eq(schema.activities.tenantId, tenantId));
  });
}

async function insertActivityForTenant(
  tenantId: string,
  developerId: string,
  action: string,
  dedupKey?: string
): Promise<string> {
  const activity = await createActivity(tenantId, {
    developerId,
    action,
    occurredAt: new Date('2025-10-18T10:00:00Z'),
    source: 'test-suite',
    dedupKey,
  });
  return activity.activityId;
}

describe('Activity Service (tenant aware)', () => {
  beforeEach(async () => {
    await clearActivities(PRIMARY_TENANT);
    await clearActivities(SECONDARY_TENANT);
  });

  afterAll(async () => {
    await clearActivities(PRIMARY_TENANT);
    await clearActivities(SECONDARY_TENANT);
    await closeDb();
  });

  it('creates and lists activities for the same tenant', async () => {
    const developerId = await createDeveloperForTenant(PRIMARY_TENANT, 'create');
    const activityId = await insertActivityForTenant(PRIMARY_TENANT, developerId, 'view');

    const list = await listActivities(PRIMARY_TENANT, {
      developerId,
      limit: 10,
      offset: 0,
      orderBy: 'occurred_at',
      orderDirection: 'desc',
    });

    expect(list.total).toBe(1);
    expect(list.activities[0]?.activityId).toBe(activityId);

    await deleteActivity(PRIMARY_TENANT, activityId);
    await removeDeveloper(developerId, PRIMARY_TENANT);
  });

  it('prevents duplicate dedupKey within tenant', async () => {
    const developerId = await createDeveloperForTenant(PRIMARY_TENANT, 'dedup');
    const dedupKey = `dedup-${crypto.randomUUID()}`;

    await insertActivityForTenant(PRIMARY_TENANT, developerId, 'click', dedupKey);

    await expect(
      createActivity(PRIMARY_TENANT, {
        developerId,
        action: 'click',
        occurredAt: new Date(),
        source: 'test-suite',
        dedupKey,
      })
    ).rejects.toThrow(/duplicate/i);

    await clearActivities(PRIMARY_TENANT);
    await removeDeveloper(developerId, PRIMARY_TENANT);
  });

  it('isolates activities between tenants', async () => {
    const primaryDev = await createDeveloperForTenant(PRIMARY_TENANT, 'isolation-a');
    const secondaryDev = await createDeveloperForTenant(
      SECONDARY_TENANT,
      'isolation-b'
    );

    await insertActivityForTenant(PRIMARY_TENANT, primaryDev, 'star');
    await insertActivityForTenant(SECONDARY_TENANT, secondaryDev, 'star');

    const primaryResult = await listActivities(PRIMARY_TENANT, {
      developerId: primaryDev,
      limit: 10,
      offset: 0,
      orderBy: 'occurred_at',
      orderDirection: 'desc',
    });

    expect(primaryResult.total).toBe(1);
    expect(primaryResult.activities[0]?.developerId).toBe(primaryDev);

    await clearActivities(PRIMARY_TENANT);
    await clearActivities(SECONDARY_TENANT);
    await removeDeveloper(primaryDev, PRIMARY_TENANT);
    await removeDeveloper(secondaryDev, SECONDARY_TENANT);
  });
});
