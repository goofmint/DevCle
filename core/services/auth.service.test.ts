import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from 'vitest';
import {
  login,
  getUserById,
  hashPassword,
  generatePluginToken,
  verifyPluginToken,
  cleanupExpiredNonces,
} from './auth.service.js';
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

  describe('Plugin Token Authentication', () => {
    const SECRET = 'test-secret-key';
    const PLUGIN_ID = 'test-plugin';

    it('generates valid plugin token', async () => {
      const token = generatePluginToken(PLUGIN_ID, TEST_TENANT, SECRET);

      expect(token).toBeTruthy();
      expect(token).toContain('.');
      const [payload, signature] = token.split('.');
      expect(payload).toBeTruthy();
      expect(signature).toBeTruthy();
    });

    it('verifies valid plugin token', async () => {
      const token = generatePluginToken(PLUGIN_ID, TEST_TENANT, SECRET);
      const context = await verifyPluginToken(token, SECRET);

      expect(context.pluginId).toBe(PLUGIN_ID);
      expect(context.tenantId).toBe(TEST_TENANT);
      expect(context.nonce).toBeTruthy();
    });

    it('rejects token with invalid signature', async () => {
      const token = generatePluginToken(PLUGIN_ID, TEST_TENANT, SECRET);
      const [payload] = token.split('.');
      const tamperedToken = `${payload}.invalid-signature`;

      await expect(
        verifyPluginToken(tamperedToken, SECRET)
      ).rejects.toThrow('Invalid token signature');
    });

    it('rejects token with wrong secret', async () => {
      const token = generatePluginToken(PLUGIN_ID, TEST_TENANT, SECRET);

      await expect(
        verifyPluginToken(token, 'wrong-secret')
      ).rejects.toThrow('Invalid token signature');
    });

    it('rejects malformed token', async () => {
      await expect(
        verifyPluginToken('not-a-valid-token', SECRET)
      ).rejects.toThrow('Invalid token format');
    });

    it('rejects token with invalid base64 payload', async () => {
      const invalidToken = 'invalid!!!base64.signature';

      await expect(
        verifyPluginToken(invalidToken, SECRET)
      ).rejects.toThrow('Invalid token encoding');
    });

    it('rejects expired token', async () => {
      // Mock Date.now to create an old token
      const oldTimestamp = Date.now() - (6 * 60 * 1000); // 6 minutes ago
      vi.spyOn(Date, 'now').mockReturnValueOnce(oldTimestamp);

      const expiredToken = generatePluginToken(PLUGIN_ID, TEST_TENANT, SECRET);

      // Restore Date.now
      vi.restoreAllMocks();

      await expect(
        verifyPluginToken(expiredToken, SECRET)
      ).rejects.toThrow('Token expired or future-dated');
    });

    it('rejects future-dated token beyond clock skew', async () => {
      // Mock Date.now to create a future token
      const futureTimestamp = Date.now() + (6 * 60 * 1000); // 6 minutes in future
      vi.spyOn(Date, 'now').mockReturnValueOnce(futureTimestamp);

      const futureToken = generatePluginToken(PLUGIN_ID, TEST_TENANT, SECRET);

      // Restore Date.now
      vi.restoreAllMocks();

      await expect(
        verifyPluginToken(futureToken, SECRET)
      ).rejects.toThrow('Token expired or future-dated');
    });

    it('accepts token within clock skew tolerance', async () => {
      // Create a token 25 seconds in the past (within 30s clock skew)
      const recentPast = Date.now() - (25 * 1000);
      vi.spyOn(Date, 'now').mockReturnValueOnce(recentPast);

      const token = generatePluginToken(PLUGIN_ID, TEST_TENANT, SECRET);

      // Restore Date.now
      vi.restoreAllMocks();

      const context = await verifyPluginToken(token, SECRET);
      expect(context.pluginId).toBe(PLUGIN_ID);
    });

    it('detects nonce replay attack', async () => {
      const token = generatePluginToken(PLUGIN_ID, TEST_TENANT, SECRET);

      // First use should succeed
      const context = await verifyPluginToken(token, SECRET);
      expect(context.pluginId).toBe(PLUGIN_ID);

      // Second use should fail (replay detected)
      await expect(
        verifyPluginToken(token, SECRET)
      ).rejects.toThrow('Token replay detected');
    });

    it('cleans up expired nonces', async () => {
      // Create some test nonces with old timestamps
      await runInTenant(TEST_TENANT, async (tx) => {
        const oldTime = new Date(Date.now() - (7 * 60 * 1000)); // 7 minutes ago

        await tx.insert(schema.pluginNonces).values([
          {
            tenantId: TEST_TENANT,
            pluginId: PLUGIN_ID,
            nonce: 'old-nonce-1',
            createdAt: oldTime,
          },
          {
            tenantId: TEST_TENANT,
            pluginId: PLUGIN_ID,
            nonce: 'old-nonce-2',
            createdAt: oldTime,
          },
          {
            tenantId: TEST_TENANT,
            pluginId: PLUGIN_ID,
            nonce: 'recent-nonce',
            createdAt: new Date(), // Recent nonce should not be deleted
          },
        ]);
      });

      // Run cleanup
      const deleted = await cleanupExpiredNonces();

      // Should delete only old nonces (2), not recent one
      expect(deleted).toBeGreaterThanOrEqual(2);

      // Verify recent nonce still exists
      await runInTenant(TEST_TENANT, async (tx) => {
        const remaining = await tx
          .select()
          .from(schema.pluginNonces)
          .where(eq(schema.pluginNonces.nonce, 'recent-nonce'));

        expect(remaining.length).toBe(1);
      });

      // Clean up test nonces
      await runInTenant(TEST_TENANT, async (tx) => {
        await tx
          .delete(schema.pluginNonces)
          .where(eq(schema.pluginNonces.tenantId, TEST_TENANT));
      });
    });
  });
});
