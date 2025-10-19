import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from 'vitest';
import { hashPassword } from '../../../services/auth.service.js';
import {
  createDeveloper,
  deleteDeveloper,
} from '../../../services/drm.service.js';
import {
  runInTenant,
  ensureTenantExists,
} from '../../../db/tenant-test-utils.js';
import { loader as developersLoader, action as developersAction } from '../api.developers.js';
import { getSession, commitSession } from '../../sessions.server.js';
import * as schema from '../../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { closeDb } from '../../../db/connection.js';

const TEST_TENANT = 'test-developers-api';
const PASSWORD = 'password-1234';

type DeveloperListItem = {
  developerId?: string;
};

function assertDeveloperListResponse(
  data: unknown
): asserts data is { developers: DeveloperListItem[]; total: number } {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Response is not an object');
  }
  if (!('developers' in data) || !Array.isArray(data.developers)) {
    throw new Error('Response missing developers array');
  }
  if (!('total' in data) || typeof data.total !== 'number') {
    throw new Error('Response missing total');
  }
}

function assertErrorResponse(
  data: unknown
): asserts data is { error: string } {
  if (typeof data !== 'object' || data === null || !('error' in data)) {
    throw new Error('Response missing error');
  }
  if (typeof (data as { error: unknown }).error !== 'string') {
    throw new Error('Response error is not string');
  }
}

async function createAuthSession() {
  await ensureTenantExists(TEST_TENANT);

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(PASSWORD);

  await runInTenant(TEST_TENANT, async (tx) => {
    await tx
      .insert(schema.users)
      .values({
        userId,
        tenantId: TEST_TENANT,
        email: `developers-${userId}@example.com`,
        passwordHash,
        displayName: 'Developers API User',
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

describe('Developer API (tenant aware)', () => {
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

  it('returns developer list for authenticated tenant', async () => {
    const developer = await createDeveloper(TEST_TENANT, {
      displayName: 'List Developer',
      primaryEmail: 'list-dev@example.com',
      orgId: null,
    });
    createdDevelopers.push(developer.developerId);

    const auth = await createAuthSession();
    createdUsers.push(auth.userId);

    const request = new Request('http://localhost/api/developers', {
      headers: {
        Cookie: auth.cookie,
      },
    });

    const response = await developersLoader({ request } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    assertDeveloperListResponse(data);
    const ids = data.developers.map(
      (item: { developerId?: string }) => item.developerId
    );
    expect(ids).toContain(developer.developerId);
  });

  it('creates developer via POST request', async () => {
    const auth = await createAuthSession();
    createdUsers.push(auth.userId);

    const request = new Request('http://localhost/api/developers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: auth.cookie,
      },
      body: JSON.stringify({
        displayName: 'Created Via API',
        primaryEmail: 'created-via-api@example.com',
        orgId: null,
      }),
    });

    const response = await developersAction({
      request,
      params: {},
      context: {},
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    if ('error' in data) {
      throw new Error(`Unexpected error response: ${data.error}`);
    }
    const developerId = (data as { developerId?: string }).developerId;

    if (typeof developerId !== 'string') {
      throw new Error('Developer ID missing in response');
    }

    createdDevelopers.push(developerId);
  });

  it('rejects invalid payload', async () => {
    const auth = await createAuthSession();
    createdUsers.push(auth.userId);

    const request = new Request('http://localhost/api/developers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: auth.cookie,
      },
      body: JSON.stringify({
        displayName: '',
        primaryEmail: 'invalid',
        orgId: null,
      }),
    });

    const response = await developersAction({
      request,
      params: {},
      context: {},
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    assertErrorResponse(data);
    expect(data.error).toBe('Validation failed');
  });

  it('requires authentication', async () => {
    const request = new Request('http://localhost/api/developers');

    const response = await developersLoader({ request } as never);
    const data = await response.json();

    expect(response.status).toBe(401);
    assertErrorResponse(data);
  });
});
