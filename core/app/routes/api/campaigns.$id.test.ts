import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { runInTenant, ensureTenantExists } from '../../../db/tenant-test-utils.js';
import { closeDb } from '../../../db/connection.js';
import { createCampaign, deleteCampaign } from '../../../services/campaign.service.js';
import { hashPassword } from '../../../services/auth.service.js';
import * as schema from '../../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import {
  loader as campaignLoader,
  action as campaignAction,
} from './campaigns.$id.js';
import { getSession, commitSession } from '../../sessions.server.js';

const TENANT = 'test-campaign-single';

async function createUserWithSession() {
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword('pass-123');

  await ensureTenantExists(TENANT);

  await runInTenant(TENANT, async (tx) => {
    await tx.insert(schema.users).values({
      userId,
      tenantId: TENANT,
      email: `campaign-id-${userId}@example.com`,
      passwordHash,
      displayName: 'Campaign Single Test User',
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

async function cleanupUser(userId: string) {
  await runInTenant(TENANT, async (tx) => {
    await tx.delete(schema.users).where(eq(schema.users.userId, userId));
  });
}

describe('Campaign API /api/campaigns/:id', () => {
  let campaignId: string | null = null;
  let userId: string | null = null;
  let cookie: string | null = null;

  beforeEach(async () => {
    if (campaignId) {
      await deleteCampaign(TENANT, campaignId);
      campaignId = null;
    }

    if (userId) {
      await cleanupUser(userId);
      userId = null;
      cookie = null;
    }

    const auth = await createUserWithSession();
    userId = auth.userId;
    cookie = auth.cookie;

  const campaign = await createCampaign(TENANT, {
    name: `QA Campaign ${Date.now()}`,
    channel: 'web',
    startDate: null,
    endDate: null,
      budgetTotal: null,
      attributes: {},
    });
    campaignId = campaign.campaignId;
  });

  afterAll(async () => {
    if (campaignId) {
      await deleteCampaign(TENANT, campaignId);
    }
    if (userId) {
      await cleanupUser(userId);
    }
    await closeDb();
  });

  it('loads campaign for tenant', async () => {
    const request = new Request(`http://localhost/api/campaigns/${campaignId}`, {
      headers: {
        Cookie: cookie ?? '',
      },
    });

    const response = await campaignLoader({ params: { id: campaignId }, request } as never);
    const json = await response.json();

    if ('error' in json) {
      throw new Error(`Unexpected error: ${json.error}`);
    }

    expect(response.status).toBe(200);
    expect(json.campaignId).toBe(campaignId);
    expect(json.tenantId).toBe(TENANT);
  });

  it('updates campaign via PUT', async () => {
    const request = new Request(`http://localhost/api/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        name: 'Updated Name',
      }),
    });

    const response = await campaignAction({
      params: { id: campaignId },
      request,
    } as never);
    const json = await response.json();

    if ('error' in json) {
      throw new Error(`Unexpected error: ${json.error}`);
    }

    expect(response.status).toBe(200);
    expect(json.name).toBe('Updated Name');
  });

  it('deletes campaign via DELETE', async () => {
    const request = new Request(`http://localhost/api/campaigns/${campaignId}`, {
      method: 'DELETE',
      headers: {
        Cookie: cookie ?? '',
      },
    });

    const response = await campaignAction({
      params: { id: campaignId },
      request,
    } as never);

    expect(response.status).toBe(204);
    expect(response.bodyUsed).toBe(false);

    const loadAfterDelete = await campaignLoader({
      params: { id: campaignId },
      request: new Request(`http://localhost/api/campaigns/${campaignId}`, {
        headers: { Cookie: cookie ?? '' },
      }),
    } as never);

    expect(loadAfterDelete.status).toBe(404);
  });
});
