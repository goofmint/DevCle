import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from 'vitest';
import { createDeveloper, deleteDeveloper } from '../../../services/drm.service.js';
import { hashPassword } from '../../../services/auth.service.js';
import {
  ensureTenantExists,
  runInTenant,
} from '../../../db/tenant-test-utils.js';
import { loader as developerLoader } from '../api.developers.$id.js';
import { getSession, commitSession } from '../../sessions.server.js';
import * as schema from '../../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { closeDb } from '../../../db/connection.js';

const TEST_TENANT = 'test-developer-detail-api';

function assertDeveloperDetail(
  data: unknown
): asserts data is { developerId: string; tenantId: string } {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response missing developer payload');
  }
  if (!('developerId' in data) || !('tenantId' in data)) {
    throw new Error('Developer payload missing identifiers');
  }
}

async function createAuthSession() {
  await ensureTenantExists(TEST_TENANT);

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword('dev-detail-pass');

  await runInTenant(TEST_TENANT, async (tx) => {
    await tx
      .insert(schema.users)
      .values({
        userId,
        tenantId: TEST_TENANT,
        email: `developer-detail-${userId}@example.com`,
        passwordHash,
        displayName: 'Developer Detail Test User',
        role: 'member',
        disabled: false,
      })
      .onConflictDoNothing();
  });

  const request = new Request('http://localhost/login');
  const session = await getSession(request);
  session.set('userId', userId);
  session.set('tenantId', TEST_TENANT);

  return {
    userId,
    cookie: await commitSession(session),
  };
}

async function deleteUser(userId: string) {
  await runInTenant(TEST_TENANT, async (tx) => {
    await tx.delete(schema.users).where(eq(schema.users.userId, userId));
  });
}

describe('Developer detail API', () => {
  const createdDevelopers: string[] = [];
  const createdUsers: string[] = [];

  beforeEach(async () => {
    await ensureTenantExists(TEST_TENANT);
  });

  afterEach(async () => {
    for (const developerId of createdDevelopers.splice(0)) {
      await deleteDeveloper(TEST_TENANT, developerId);
    }
    for (const userId of createdUsers.splice(0)) {
      await deleteUser(userId);
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  it('returns developer detail for tenant', async () => {
    const developer = await createDeveloper(TEST_TENANT, {
      displayName: 'Detail Developer',
      primaryEmail: 'detail@example.com',
      orgId: null,
    });
    createdDevelopers.push(developer.developerId);

    const auth = await createAuthSession();
    createdUsers.push(auth.userId);

    const request = new Request(
      `http://localhost/api/developers/${developer.developerId}`,
      {
        headers: {
          Cookie: auth.cookie,
        },
      }
    );

    const response = await developerLoader({
      params: { id: developer.developerId },
      request,
    } as never);

    expect(response.status).toBe(200);
    const data = await response.json();
    assertDeveloperDetail(data);
    expect(data.developerId).toBe(developer.developerId);
    expect(data.tenantId).toBe(TEST_TENANT);
  });

  it('returns 401 without authentication', async () => {
    const request = new Request('http://localhost/api/developers/some-id');

    const response = await developerLoader({
      params: { id: crypto.randomUUID() },
      request,
    } as never);

    expect(response.status).toBe(401);
  });
});
