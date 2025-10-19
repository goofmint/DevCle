/**
 * System Settings API Integration Tests
 *
 * Tests for GET /api/system-settings and PUT /api/system-settings endpoints.
 * Uses real database connections (no mocks).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { closeDb } from '../../db/connection.js';
import { runInTenant, ensureTenantExists } from '../../db/tenant-test-utils.js';
import { hashPassword } from '../../services/auth.service.js';
import * as schema from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { loader, action } from './api.system-settings.js';
import { getSession, commitSession } from '../sessions.server.js';

const TENANT = 'test-system-settings';

/**
 * System settings API response type
 */
type SettingsResponse =
  | { error: string }
  | {
      tenantId: string;
      serviceName: string;
      logoUrl: string | null;
      fiscalYearStartMonth: number;
      timezone: string;
      baseUrl: string | null;
      s3Configured: boolean;
      smtpConfigured: boolean;
      shortlinkDomain: string | null;
      createdAt: string;
      updatedAt: string;
    };

/**
 * Create test user with session cookie
 *
 * @param role - User role (admin or member)
 * @returns User ID and session cookie
 */
async function createUserWithSession(role: 'admin' | 'member' = 'admin') {
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword('pass-123');

  await ensureTenantExists(TENANT);

  await runInTenant(TENANT, async (tx) => {
    await tx.insert(schema.users).values({
      userId,
      tenantId: TENANT,
      email: `settings-${userId}@example.com`,
      passwordHash,
      displayName: 'Settings Test User',
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

/**
 * Clean up system settings
 */
async function cleanupSettings() {
  await runInTenant(TENANT, async (tx) => {
    await tx.delete(schema.systemSettings).where(eq(schema.systemSettings.tenantId, TENANT));
  });
}

describe('System Settings API - GET /api/system-settings', () => {
  let userId: string | null = null;
  let cookie: string | null = null;

  beforeEach(async () => {
    if (userId) {
      await cleanupUser(userId);
      userId = null;
      cookie = null;
    }
    await cleanupSettings();

    const auth = await createUserWithSession('admin');
    userId = auth.userId;
    cookie = auth.cookie;
  });

  afterAll(async () => {
    if (userId) {
      await cleanupUser(userId);
    }
    await cleanupSettings();
    await closeDb();
  });

  it('should return default settings when no settings exist', async () => {
    const request = new Request('http://localhost/api/system-settings', {
      headers: { Cookie: cookie ?? '' },
    });

    const response = await loader({ request } as never);
    const json: SettingsResponse = await response.json();

    expect(response.status).toBe(200);
    if ('error' in json) {
      throw new Error(`Unexpected error: ${json.error}`);
    }
    expect(json.tenantId).toBe(TENANT);
    expect(json.serviceName).toBe('DevCle');
    expect(json.logoUrl).toBeNull();
    expect(json.fiscalYearStartMonth).toBe(4);
    expect(json.timezone).toBe('Asia/Tokyo');
    expect(json.baseUrl).toBeNull();
    expect(json.s3Configured).toBe(false);
    expect(json.smtpConfigured).toBe(false);
    expect(json.shortlinkDomain).toBeNull();
    expect(json.createdAt).toBeDefined();
    expect(json.updatedAt).toBeDefined();
  });

  it('should return existing settings with sensitive data hidden', async () => {
    // Create settings with S3 and SMTP configured
    const putRequest = new Request('http://localhost/api/system-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        serviceName: 'Test Service',
        s3Settings: {
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
        smtpSettings: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          user: 'noreply@example.com',
          password: 'smtp-password-123',
          from: 'Test <noreply@example.com>',
        },
      }),
    });

    await action({ request: putRequest } as never);

    // GET settings
    const getRequest = new Request('http://localhost/api/system-settings', {
      headers: { Cookie: cookie ?? '' },
    });

    const response = await loader({ request: getRequest } as never);
    const json: SettingsResponse = await response.json();

    expect(response.status).toBe(200);
    if ('error' in json) {
      throw new Error(`Unexpected error: ${json.error}`);
    }
    expect(json.serviceName).toBe('Test Service');
    expect(json.s3Configured).toBe(true); // Boolean flag instead of full object
    expect(json.smtpConfigured).toBe(true); // Boolean flag instead of full object
    // Sensitive data should NOT be in response
    expect(json).not.toHaveProperty('s3Settings');
    expect(json).not.toHaveProperty('smtpSettings');
  });

  it('should reject unauthorized requests', async () => {
    const request = new Request('http://localhost/api/system-settings');

    const response = await loader({ request } as never);
    const json: SettingsResponse = await response.json();

    expect(response.status).toBe(401);
    if (!('error' in json)) {
      throw new Error('Expected error response');
    }
    expect(json.error).toBe('Unauthorized');
  });
});

describe('System Settings API - PUT /api/system-settings', () => {
  let userId: string | null = null;
  let cookie: string | null = null;

  beforeEach(async () => {
    if (userId) {
      await cleanupUser(userId);
      userId = null;
      cookie = null;
    }
    await cleanupSettings();

    const auth = await createUserWithSession('admin');
    userId = auth.userId;
    cookie = auth.cookie;
  });

  afterAll(async () => {
    if (userId) {
      await cleanupUser(userId);
    }
    await cleanupSettings();
    await closeDb();
  });

  it('should update settings with valid input', async () => {
    const request = new Request('http://localhost/api/system-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        serviceName: 'Updated Service',
        fiscalYearStartMonth: 1,
        timezone: 'America/New_York',
      }),
    });

    const response = await action({ request } as never);
    const json: SettingsResponse = await response.json();

    expect(response.status).toBe(200);
    if ('error' in json) {
      throw new Error(`Unexpected error: ${json.error}`);
    }
    expect(json.serviceName).toBe('Updated Service');
    expect(json.fiscalYearStartMonth).toBe(1);
    expect(json.timezone).toBe('America/New_York');
  });

  it('should update S3 settings and return boolean flag', async () => {
    const request = new Request('http://localhost/api/system-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        s3Settings: {
          bucket: 'my-bucket',
          region: 'ap-northeast-1',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          endpoint: 'https://minio.example.com',
        },
      }),
    });

    const response = await action({ request } as never);
    const json: SettingsResponse = await response.json();

    expect(response.status).toBe(200);
    if ('error' in json) {
      throw new Error(`Unexpected error: ${json.error}`);
    }
    expect(json.s3Configured).toBe(true);
    // Sensitive data should NOT be in response
    expect(json).not.toHaveProperty('s3Settings');
  });

  it('should reject non-admin users', async () => {
    // Create member user
    if (userId) {
      await cleanupUser(userId);
    }
    const memberAuth = await createUserWithSession('member');
    userId = memberAuth.userId;
    cookie = memberAuth.cookie;

    const request = new Request('http://localhost/api/system-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        serviceName: 'Should Fail',
      }),
    });

    const response = await action({ request } as never);
    const json: SettingsResponse = await response.json();

    expect(response.status).toBe(403);
    if (!('error' in json)) {
      throw new Error('Expected error response');
    }
    expect(json.error).toBe('Admin role required');
  });

  it('should reject invalid input', async () => {
    const request = new Request('http://localhost/api/system-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        fiscalYearStartMonth: 13, // Invalid: must be 1-12
      }),
    });

    const response = await action({ request } as never);
    const json: SettingsResponse = await response.json();

    expect(response.status).toBe(400);
    if (!('error' in json)) {
      throw new Error('Expected error response');
    }
    expect(json.error).toBe('Validation error');
  });

  it('should reject unauthorized requests', async () => {
    const request = new Request('http://localhost/api/system-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceName: 'Should Fail',
      }),
    });

    const response = await action({ request } as never);
    const json: SettingsResponse = await response.json();

    expect(response.status).toBe(401);
    if (!('error' in json)) {
      throw new Error('Expected error response');
    }
    expect(json.error).toBe('Unauthorized');
  });

  it('should reject non-PUT methods', async () => {
    const request = new Request('http://localhost/api/system-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ?? '',
      },
      body: JSON.stringify({
        serviceName: 'Should Fail',
      }),
    });

    const response = await action({ request } as never);
    const json: SettingsResponse = await response.json();

    expect(response.status).toBe(405);
    if (!('error' in json)) {
      throw new Error('Expected error response');
    }
    expect(json.error).toBe('Method not allowed');
  });
});
