import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { runInTenant, ensureTenantExists } from '../../../db/tenant-test-utils.js';
import { closeDb } from '../../../db/connection.js';
import { createCampaign, deleteCampaign } from '../../../services/campaign.service.js';
import { createDeveloper, deleteDeveloper } from '../../../services/drm.service.js';
import { createActivity } from '../../../services/activity.service.js';
import { hashPassword } from '../../../services/auth.service.js';
import * as schema from '../../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { loader as campaignRoiLoader } from './campaigns.$id.roi.js';
import { getSession, commitSession } from '../../sessions.server.js';

const TENANT = 'test-campaign-roi';

async function seedRoiData() {
  await ensureTenantExists(TENANT);

  const campaign = await createCampaign(TENANT, {
    name: `ROI Campaign ${Date.now()}`,
    channel: 'paid-media',
    startDate: null,
    endDate: null,
    budgetTotal: null,
    attributes: {},
  });

  const developer = await createDeveloper(TENANT, {
    displayName: 'ROI Dev',
    primaryEmail: 'roi-dev@example.com',
    orgId: null,
  });

  const activity = await createActivity(TENANT, {
    developerId: developer.developerId,
    action: 'signup',
    occurredAt: new Date('2025-10-15T12:00:00Z'),
    source: 'web',
    value: 2500,
  });

  await runInTenant(TENANT, async (tx) => {
    await tx.insert(schema.budgets).values({
      tenantId: TENANT,
      campaignId: campaign.campaignId,
      category: 'ads',
      amount: '1000',
      currency: 'USD',
      spentAt: '2025-10-01',
      source: 'seed-data',
      memo: null,
      meta: null,
    });

    await tx.insert(schema.activityCampaigns).values({
      activityId: activity.activityId,
      campaignId: campaign.campaignId,
      tenantId: TENANT,
      weight: '1.0',
    });
  });

  return { campaignId: campaign.campaignId, developerId: developer.developerId }; 
}

async function cleanupRoiData(campaignId: string, developerId: string) {
  await runInTenant(TENANT, async (tx) => {
    await tx
      .delete(schema.activityCampaigns)
      .where(eq(schema.activityCampaigns.campaignId, campaignId));
    await tx
      .delete(schema.activities)
      .where(eq(schema.activities.tenantId, TENANT));
    await tx
      .delete(schema.budgets)
      .where(eq(schema.budgets.campaignId, campaignId));
  });
  await deleteCampaign(TENANT, campaignId);
  await deleteDeveloper(TENANT, developerId);
}

async function createUserSession(): Promise<{ userId: string; cookie: string }> {
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword('roi-pass');

  await runInTenant(TENANT, async (tx) => {
    await tx.insert(schema.users).values({
      userId,
      tenantId: TENANT,
      email: `roi-${userId}@example.com`,
      passwordHash,
      displayName: 'ROI User',
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

describe('Campaign ROI API', () => {
  let campaignId: string | null = null;
  let developerId: string | null = null;
  let userId: string | null = null;
  let cookie: string | null = null;

  beforeEach(async () => {
    if (campaignId && developerId) {
      await cleanupRoiData(campaignId, developerId);
      campaignId = null;
      developerId = null;
    }
    if (userId) {
      await cleanupUser(userId);
      userId = null;
      cookie = null;
    }
    const seed = await seedRoiData();
    campaignId = seed.campaignId;
    developerId = seed.developerId;
    const auth = await createUserSession();
    userId = auth.userId;
    cookie = auth.cookie;
  });

  afterAll(async () => {
    if (campaignId && developerId) {
      await cleanupRoiData(campaignId, developerId);
    }
    if (userId) {
      await cleanupUser(userId);
    }
    await closeDb();
  });

  it('calculates ROI for campaign', async () => {
    const request = new Request(`http://localhost/api/campaigns/${campaignId}/roi`, {
      headers: {
        Cookie: cookie ?? '',
      },
    });

    const response = await campaignRoiLoader({
      params: { id: campaignId },
      request,
    } as never);
    const json = await response.json();

    if ('error' in json) {
      throw new Error(`Unexpected error: ${json.error}`);
    }

    expect(response.status).toBe(200);
    expect(json.campaignId).toBe(campaignId);
    expect(json.totalCost).toBe('1000');
    expect(json.totalValue).toBe('2500');
    expect(json.activityCount).toBe(1);
  });
});
