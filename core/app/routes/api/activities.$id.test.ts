import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { runInTenant, ensureTenantExists } from '../../../db/tenant-test-utils.js';
import { closeDb } from '../../../db/connection.js';
import * as schema from '../../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { loader as activityLoader } from './activities.$id.js';
import { createActivity } from '../../../services/activity.service.js';
import { createDeveloper, deleteDeveloper } from '../../../services/drm.service.js';
import { hashPassword } from '../../../services/auth.service.js';
import { getSession, commitSession } from '../../sessions.server.js';

const TENANT = 'test-activities-detail';

async function createUserSession(): Promise<{ userId: string; cookie: string }> {
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword('activities-detail-pass');

  await runInTenant(TENANT, async (tx) => {
    await tx.insert(schema.tenants).values({
      tenantId: TENANT,
      name: 'Activities Detail Tenant',
      plan: 'OSS',
    }).onConflictDoNothing();

    await tx.insert(schema.users).values({
      userId,
      tenantId: TENANT,
      email: `activities-detail-${userId}@example.com`,
      passwordHash,
      displayName: 'Activities Detail User',
      role: 'member',
      disabled: false,
    });
  });

  const request = new Request('http://localhost/login');
  const session = await getSession(request);
  session.set('userId', userId);
  session.set('tenantId', TENANT);
  const cookie = await commitSession(session);

  return { userId, cookie };
}

async function cleanupUser(userId: string): Promise<void> {
  await runInTenant(TENANT, async (tx) => {
    await tx.delete(schema.users).where(eq(schema.users.userId, userId));
  });
}

describe('Activity Detail API', () => {
  let developerId: string | null = null;
  let activityId: string | null = null;
  let userId: string | null = null;
  let cookie: string | null = null;

  beforeEach(async () => {
    if (developerId) {
      await deleteDeveloper(TENANT, developerId);
      developerId = null;
    }
    if (userId) {
      await cleanupUser(userId);
      userId = null;
      cookie = null;
    }

    await ensureTenantExists(TENANT);

    const developer = await createDeveloper(TENANT, {
      displayName: 'Activity Detail Dev',
      primaryEmail: 'activity-detail@example.com',
      orgId: null,
    });
    developerId = developer.developerId;

    const activity = await createActivity(TENANT, {
      developerId,
      action: 'click',
      occurredAt: new Date(),
      source: 'web',
    });
    activityId = activity.activityId;

    const auth = await createUserSession();
    userId = auth.userId;
    cookie = auth.cookie;
  });

  afterAll(async () => {
    if (activityId) {
      await runInTenant(TENANT, async (tx) => {
        await tx.delete(schema.activities).where(eq(schema.activities.activityId, activityId ?? ''));
      });
    }
    if (developerId) {
      await deleteDeveloper(TENANT, developerId);
    }
    if (userId) {
      await cleanupUser(userId);
    }
    await closeDb();
  });

  it('returns activity detail for tenant', async () => {
    const request = new Request(`http://localhost/api/activities/${activityId}`, {
      headers: {
        Cookie: cookie ?? '',
      },
    });

    const response = await activityLoader({
      params: { id: activityId },
      request,
    } as never);
    const json = await response.json();

    if ('error' in json) {
      throw new Error(`Unexpected error response: ${json.error}`);
    }

    expect(response.status).toBe(200);
    expect(json.activityId).toBe(activityId);
    expect(json.tenantId).toBe(TENANT);
  });
});
