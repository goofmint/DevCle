/**
 * System Settings Connection Test APIs Integration Tests
 *
 * Tests for:
 * - POST /api/system-settings/test-s3
 * - POST /api/system-settings/test-smtp
 *
 * Uses real database connections (no mocks).
 * Note: Connection tests use mock credentials (no real S3/SMTP required).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { closeDb } from '../../db/connection.js';
import { runInTenant, ensureTenantExists } from '../../db/tenant-test-utils.js';
import { hashPassword } from '../../services/auth.service.js';
import * as schema from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { action as testS3Action } from './api.system-settings.test-s3.js';
import { action as testSmtpAction } from './api.system-settings.test-smtp.js';
import { getSession, commitSession } from '../sessions.server.js';

const TENANT = 'test-connection';

/**
 * Connection test API response type
 */
type ConnectionTestResponse =
  | { error: string }
  | { success: boolean }
  | { success: boolean; error: string };

/**
 * Create test user with session cookie
 */
async function createUserWithSession(role: 'admin' | 'member' = 'admin') {
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword('pass-123');

  await ensureTenantExists(TENANT);

  await runInTenant(TENANT, async (tx) => {
    await tx.insert(schema.users).values({
      userId,
      tenantId: TENANT,
      email: `connection-${userId}@example.com`,
      passwordHash,
      displayName: 'Connection Test User',
      role,
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

/**
 * Clean up test user
 */
async function cleanupUser(userId: string) {
  await runInTenant(TENANT, async (tx) => {
    await tx.delete(schema.users).where(eq(schema.users.userId, userId));
  });
}

describe('System Settings Test S3 API - POST /api/system-settings/test-s3', () => {
  let userId: string | null = null;
  let cookie: string | null = null;

  beforeEach(async () => {
    if (userId) {
      await cleanupUser(userId);
      userId = null;
      cookie = null;
    }

    const auth = await createUserWithSession('admin');
    userId = auth.userId;
    cookie = auth.cookie;
  });

  afterAll(async () => {
    if (userId) {
      await cleanupUser(userId);
    }
    await closeDb();
  });

  it('should reject invalid S3 settings', async () => {
    const request = new Request('http://localhost/api/system-settings/test-s3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        bucket: '', // Invalid: empty bucket
        region: 'us-east-1',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      }),
    });

    const response = await testS3Action({ request } as never);
    const json: ConnectionTestResponse = await response.json();

    expect(response.status).toBe(400);
    if (!('error' in json)) {
      throw new Error('Expected error response');
    }
    expect(json.error).toBe('Validation error');
  });

  it('should fail with invalid credentials (expected)', async () => {
    const request = new Request('http://localhost/api/system-settings/test-s3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        bucket: 'invalid-bucket',
        region: 'us-east-1',
        accessKeyId: 'INVALID',
        secretAccessKey: 'INVALID',
      }),
    });

    const response = await testS3Action({ request } as never);
    const json: ConnectionTestResponse = await response.json();

    // Connection test should fail with invalid credentials
    expect(response.status).toBe(500);
    if (!('success' in json)) {
      throw new Error('Expected success/error response');
    }
    expect(json.success).toBe(false);
    if (!('error' in json)) {
      throw new Error('Expected error in response');
    }
    expect(json.error).toBeDefined();
  });

  it('should reject non-admin users', async () => {
    // Create member user
    if (userId) {
      await cleanupUser(userId);
    }
    const memberAuth = await createUserWithSession('member');
    userId = memberAuth.userId;
    cookie = memberAuth.cookie;

    const request = new Request('http://localhost/api/system-settings/test-s3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      }),
    });

    const response = await testS3Action({ request } as never);
    const json: ConnectionTestResponse = await response.json();

    expect(response.status).toBe(403);
    if (!('error' in json)) {
      throw new Error('Expected error response');
    }
    expect(json.error).toBe('Admin role required');
  });

  it('should reject unauthorized requests', async () => {
    const request = new Request('http://localhost/api/system-settings/test-s3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      }),
    });

    const response = await testS3Action({ request } as never);
    const json: ConnectionTestResponse = await response.json();

    expect(response.status).toBe(401);
    if (!('error' in json)) {
      throw new Error('Expected error response');
    }
    expect(json.error).toBe('Unauthorized');
  });

  it('should reject non-POST methods', async () => {
    const request = new Request('http://localhost/api/system-settings/test-s3', {
      method: 'GET',
      headers: {
        Cookie: cookie ?? '',
      },
    });

    const response = await testS3Action({ request } as never);
    const json: ConnectionTestResponse = await response.json();

    expect(response.status).toBe(405);
    if (!('error' in json)) {
      throw new Error('Expected error response');
    }
    expect(json.error).toBe('Method not allowed');
  });
});

describe('System Settings Test SMTP API - POST /api/system-settings/test-smtp', () => {
  let userId: string | null = null;
  let cookie: string | null = null;

  beforeEach(async () => {
    if (userId) {
      await cleanupUser(userId);
      userId = null;
      cookie = null;
    }

    const auth = await createUserWithSession('admin');
    userId = auth.userId;
    cookie = auth.cookie;
  });

  afterAll(async () => {
    if (userId) {
      await cleanupUser(userId);
    }
    await closeDb();
  });

  it('should reject invalid SMTP settings', async () => {
    const request = new Request('http://localhost/api/system-settings/test-smtp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        host: 'smtp.example.com',
        port: 70000, // Invalid: port out of range
        secure: false,
        user: 'noreply@example.com',
        password: 'password',
        from: 'Test <noreply@example.com>',
      }),
    });

    const response = await testSmtpAction({ request } as never);
    const json: ConnectionTestResponse = await response.json();

    expect(response.status).toBe(400);
    if (!('error' in json)) {
      throw new Error('Expected error response');
    }
    expect(json.error).toBe('Validation error');
  });

  it('should fail with invalid credentials (expected)', async () => {
    const request = new Request('http://localhost/api/system-settings/test-smtp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        host: 'invalid.smtp.server',
        port: 587,
        secure: false,
        user: 'invalid@example.com',
        password: 'invalid',
        from: 'Test <invalid@example.com>',
      }),
    });

    const response = await testSmtpAction({ request } as never);
    const json: ConnectionTestResponse = await response.json();

    // Connection test should fail with invalid credentials
    expect(response.status).toBe(500);
    if (!('success' in json)) {
      throw new Error('Expected success/error response');
    }
    expect(json.success).toBe(false);
    if (!('error' in json)) {
      throw new Error('Expected error in response');
    }
    expect(json.error).toBeDefined();
  });

  it('should reject non-admin users', async () => {
    // Create member user
    if (userId) {
      await cleanupUser(userId);
    }
    const memberAuth = await createUserWithSession('member');
    userId = memberAuth.userId;
    cookie = memberAuth.cookie;

    const request = new Request('http://localhost/api/system-settings/test-smtp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        user: 'noreply@example.com',
        password: 'password',
        from: 'Test <noreply@example.com>',
      }),
    });

    const response = await testSmtpAction({ request } as never);
    const json: ConnectionTestResponse = await response.json();

    expect(response.status).toBe(403);
    if (!('error' in json)) {
      throw new Error('Expected error response');
    }
    expect(json.error).toBe('Admin role required');
  });

  it('should reject unauthorized requests', async () => {
    const request = new Request('http://localhost/api/system-settings/test-smtp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        user: 'noreply@example.com',
        password: 'password',
        from: 'Test <noreply@example.com>',
      }),
    });

    const response = await testSmtpAction({ request } as never);
    const json: ConnectionTestResponse = await response.json();

    expect(response.status).toBe(401);
    if (!('error' in json)) {
      throw new Error('Expected error response');
    }
    expect(json.error).toBe('Unauthorized');
  });

  it('should reject non-POST methods', async () => {
    const request = new Request('http://localhost/api/system-settings/test-smtp', {
      method: 'GET',
      headers: {
        Cookie: cookie ?? '',
      },
    });

    const response = await testSmtpAction({ request } as never);
    const json: ConnectionTestResponse = await response.json();

    expect(response.status).toBe(405);
    if (!('error' in json)) {
      throw new Error('Expected error response');
    }
    expect(json.error).toBe('Method not allowed');
  });
});
