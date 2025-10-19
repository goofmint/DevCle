import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from 'vitest';
import { login, getUserById, hashPassword } from './auth.service.js';
import { ensureTenantExists, runInTenant } from '../db/tenant-test-utils.js';
import * as schema from '../db/schema/index.js';
import { closeDb } from '../db/connection.js';
import { eq } from 'drizzle-orm';

const TEST_TENANT = 'test-auth-service';
const PASSWORD = 'super-secret';

async function insertUser(email: string, enabled = true) {
  await ensureTenantExists(TEST_TENANT);

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(PASSWORD);

  await runInTenant(TEST_TENANT, async (tx) => {
    await tx
      .insert(schema.users)
      .values({
        userId,
        tenantId: TEST_TENANT,
        email,
        passwordHash,
        displayName: 'Auth Service User',
        role: 'member',
        disabled: !enabled,
      })
      .onConflictDoNothing();
  });

  return { userId, email };
}

async function deleteUser(userId: string) {
  await runInTenant(TEST_TENANT, async (tx) => {
    await tx.delete(schema.users).where(eq(schema.users.userId, userId));
  });
}

describe('auth.service', () => {
  const createdUsers: string[] = [];

  beforeEach(async () => {
    await ensureTenantExists(TEST_TENANT);
  });

  afterEach(async () => {
    for (const userId of createdUsers.splice(0)) {
      await deleteUser(userId);
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  it('successfully logs in with valid credentials', async () => {
    const { userId, email } = await insertUser('auth-success@example.com');
    createdUsers.push(userId);

    const user = await login(email, PASSWORD);

    expect(user).not.toBeNull();
    expect(user?.userId).toBe(userId);
    expect(user?.tenantId).toBe(TEST_TENANT);
  });

  it('returns null for invalid password', async () => {
    const { userId, email } = await insertUser('auth-invalid@example.com');
    createdUsers.push(userId);

    const user = await login(email, 'wrong-password');
    expect(user).toBeNull();
  });

  it('does not return disabled users', async () => {
    const { userId, email } = await insertUser('auth-disabled@example.com', false);
    createdUsers.push(userId);

    const loginResult = await login(email, PASSWORD);
    expect(loginResult).toBeNull();

    const user = await getUserById(userId);
    expect(user).toBeNull();
  });
});
