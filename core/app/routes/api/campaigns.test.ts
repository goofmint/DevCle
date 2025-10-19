import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { closeDb } from '../../../db/connection.js';
import { runInTenant, ensureTenantExists } from '../../../db/tenant-test-utils.js';
import { createCampaign, deleteCampaign } from '../../../services/campaign.service.js';
import { hashPassword } from '../../../services/auth.service.js';
import * as schema from '../../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import {
  loader as campaignsLoader,
  action as campaignsAction,
} from './campaigns.js';
import { getSession, commitSession } from '../../sessions.server.js';

const TENANT = 'test-campaigns';

async function createUserWithSession() {
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword('pass-123');

  await ensureTenantExists(TENANT);

  await runInTenant(TENANT, async (tx) => {
    await tx.insert(schema.users).values({
      userId,
      tenantId: TENANT,
      email: `campaigns-${userId}@example.com`,
      passwordHash,
      displayName: 'Campaign Test User',
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

describe('Campaign API (tenant aware)', () => {
  let userId: string | null = null;
  let cookie: string | null = null;

  beforeEach(async () => {
    if (userId) {
      await cleanupUser(userId);
      userId = null;
      cookie = null;
    }
    const auth = await createUserWithSession();
    userId = auth.userId;
    cookie = auth.cookie;
  });

  afterAll(async () => {
    if (userId) {
      await cleanupUser(userId);
    }
    await closeDb();
  });

  it('lists campaigns for authenticated tenant', async () => {
    const campaign = await createCampaign(TENANT, {
      name: `QA Campaign ${Date.now()}`,
      channel: 'web',
      startDate: null,
      endDate: null,
      budgetTotal: null,
      attributes: {},
    });

    const request = new Request('http://localhost/api/campaigns', {
      headers: { Cookie: cookie ?? '' },
    });

    const response = await campaignsLoader({ request } as never);
    const json = await response.json();

    if ('error' in json) {
      throw new Error(`Unexpected error: ${json.error}`);
    }

    expect(response.status).toBe(200);
    expect(Array.isArray(json.campaigns)).toBe(true);
    expect(json.campaigns.some((item: { campaignId: string }) => item.campaignId === campaign.campaignId)).toBe(true);

    await deleteCampaign(TENANT, campaign.campaignId);
  });

  it('creates campaign via POST', async () => {
    const request = new Request('http://localhost/api/campaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        name: `Create Campaign ${Date.now()}`,
        channel: 'events',
        startDate: null,
        endDate: null,
        budgetTotal: null,
        attributes: {},
      }),
    });

    const response = await campaignsAction({ request } as never);
    const json = await response.json();

    if ('error' in json) {
      throw new Error(`Unexpected error: ${json.error}`);
    }

    expect(response.status).toBe(201);
    expect(json.tenantId).toBe(TENANT);

    await deleteCampaign(TENANT, json.campaignId);
  });

  it('rejects unauthorized access', async () => {
    const request = new Request('http://localhost/api/campaigns');
    const response = await campaignsLoader({ request } as never);
    const json = await response.json();

    expect(response.status).toBe(401);
    if (!('error' in json)) {
      throw new Error('Expected error response for unauthorized request');
    }
    expect(json.error).toBeDefined();
  });
});
