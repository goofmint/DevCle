import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hashPassword } from '../../../services/auth.service.js';
import { runInTenant, ensureTenantExists } from '../../../db/tenant-test-utils.js';
import { closeDb } from '../../../db/connection.js';
import * as schema from '../../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { loader as funnelLoader } from './funnel.js';
import { getSession, commitSession } from '../../sessions.server.js';

const TENANT = 'default';

async function createUserSession(): Promise<{ userId: string; cookie: string }> {
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword('funnel-pass');

  await ensureTenantExists(TENANT);

  await runInTenant(TENANT, async (tx) => {
    await tx.insert(schema.users).values({
      userId,
      tenantId: TENANT,
      email: `funnel-${userId}@example.com`,
      passwordHash,
      displayName: 'Funnel API User',
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

describe('Funnel API', () => {
  let userId: string | null = null;
  let cookie: string | null = null;

  beforeAll(async () => {
    const auth = await createUserSession();
    userId = auth.userId;
    cookie = auth.cookie;
  });

  afterAll(async () => {
    if (userId) {
      await cleanupUser(userId);
    }
    await closeDb();
  });

  it('returns funnel statistics for authenticated tenant', async () => {
    const request = new Request('http://localhost/api/funnel', {
      headers: {
        Cookie: cookie ?? '',
      },
    });

    const response = await funnelLoader({ request } as never);
    const json = await response.json();

    if ('error' in json) {
      throw new Error(`Unexpected error response: ${json.error}`);
    }

    expect(response.status).toBe(200);
    expect(Array.isArray(json.stages)).toBe(true);
    expect(json.overallConversionRate).toBeDefined();
  });

  it('rejects unauthenticated request', async () => {
    const request = new Request('http://localhost/api/funnel');
    const response = await funnelLoader({ request } as never);
    expect(response.status).toBe(401);
  });
});
