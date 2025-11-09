/**
 * API Route Tests for GET /api/tokens/:id (Task 8.18)
 *
 * Tests verify:
 * - 200 response with valid token
 * - 404 for non-existent token
 * - 401 for unauthenticated request
 * - 400 for missing token ID
 * - Tenant isolation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loader } from './api.tokens_.$id.js';
import { runInTenant } from '../../db/tenant-test-utils.js';
import * as schema from '../../db/schema/index.js';
import { sessionStorage, commitSession } from '../sessions.server.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { createToken } from '../../services/token.service.js';

describe('GET /api/tokens/:id', () => {
  const TEST_TENANT = 'default';
  let testUserId: string;

  beforeEach(async () => {
    // Get test user ID from database
    await runInTenant(TEST_TENANT, async (tx) => {
      const users = await tx
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'test@example.com'))
        .limit(1);
      testUserId = users[0]?.userId ?? '';
    });

    if (!testUserId) {
      throw new Error('Test user not found in database');
    }

    // Clean up existing tokens before each test
    await runInTenant(TEST_TENANT, async (tx) => {
      await tx.delete(schema.apiTokens).where(eq(schema.apiTokens.tenantId, TEST_TENANT));
      // Also clean up tenant2 if it exists from previous test runs
      await tx.delete(schema.users).where(eq(schema.users.tenantId, 'tenant2'));
      await tx.delete(schema.apiTokens).where(eq(schema.apiTokens.tenantId, 'tenant2'));
      await tx.delete(schema.tenants).where(eq(schema.tenants.tenantId, 'tenant2'));
    });
  });

  /**
   * Helper to create authenticated request
   */
  async function createAuthenticatedRequest(url: string): Promise<Request> {
    const session = await sessionStorage.getSession();
    session.set('userId', testUserId);
    session.set('tenantId', TEST_TENANT);
    const cookieHeader = await commitSession(session);

    return new Request(url, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
      },
    });
  }

  it('should return 200 with token detail for valid token', async () => {
    // Create test token
    const token = await createToken(TEST_TENANT, testUserId, {
      name: 'Test Token',
      scopes: ['webhook:write'],
    });

    // Create authenticated request
    const request = await createAuthenticatedRequest(
      `http://localhost/api/tokens/${token.tokenId}`
    );

    const params = { id: token.tokenId };

    // Call loader
    const response = await loader({ request, params, context: {} });
    const data = await response.json();

    // Verify response
    expect(response.status).toBe(200);

    // Type guard: ensure data has tokenId property
    expect('tokenId' in data).toBe(true);
    if ('tokenId' in data) {
      expect(data.tokenId).toBe(token.tokenId);
      expect(data.name).toBe('Test Token');
      expect(data.tokenPrefix).toBe(token.tokenPrefix);
      expect(data.scopes).toEqual(['webhook:write']);
      expect(data.status).toBe('active');
      expect(data.createdBy).toBe(testUserId);

      // Verify tokenHash is NOT included (security requirement)
      expect(data).not.toHaveProperty('tokenHash');
    }
  });

  it('should return 404 if token not found', async () => {
    // Use non-existent token ID
    const fakeTokenId = crypto.randomUUID();

    // Create authenticated request
    const request = await createAuthenticatedRequest(
      `http://localhost/api/tokens/${fakeTokenId}`
    );

    const params = { id: fakeTokenId };

    // Call loader
    const response = await loader({ request, params, context: {} });
    const data = await response.json();

    // Verify response
    expect(response.status).toBe(404);
    expect('error' in data).toBe(true);
    if ('error' in data) {
      expect(data.error).toBe('Token not found');
    }
  });

  it('should return 401 if not authenticated', async () => {
    // Create test token
    const token = await createToken(TEST_TENANT, testUserId, {
      name: 'Test Token',
      scopes: ['webhook:write'],
    });

    // Create request WITHOUT authentication
    const request = new Request(`http://localhost/api/tokens/${token.tokenId}`, {
      method: 'GET',
    });

    const params = { id: token.tokenId };

    // Call loader
    const response = await loader({ request, params, context: {} });
    const data = await response.json();

    // Verify response
    expect(response.status).toBe(401);
    expect('error' in data).toBe(true);
    if ('error' in data) {
      expect(data.error).toBe('Unauthorized');
    }
  });

  it('should return 400 if token ID is missing', async () => {
    // Create authenticated request
    const request = await createAuthenticatedRequest('http://localhost/api/tokens/');

    const params = {}; // Missing id parameter

    // Call loader
    const response = await loader({ request, params, context: {} });
    const data = await response.json();

    // Verify response
    expect(response.status).toBe(400);
    expect('error' in data).toBe(true);
    if ('error' in data) {
      expect(data.error).toBe('Token ID is required');
    }
  });

  it('should not return tokens from other tenants', async () => {
    // Create token in 'default' tenant
    const token = await createToken(TEST_TENANT, testUserId, {
      name: 'Tenant1 Token',
      scopes: ['webhook:write'],
    });

    // Create second test tenant and user
    const TEST_TENANT_2 = 'tenant2';
    let testUserId2 = '';

    // First, create the tenant2 in the tenants table
    await runInTenant(TEST_TENANT, async (tx) => {
      await tx.insert(schema.tenants).values({
        tenantId: TEST_TENANT_2,
        name: 'Tenant 2',
      });
    });

    await runInTenant(TEST_TENANT_2, async (tx) => {
      // Create user in tenant2
      const [user] = await tx
        .insert(schema.users)
        .values({
          userId: crypto.randomUUID(),
          tenantId: TEST_TENANT_2,
          email: 'user2@example.com',
          passwordHash: 'hash',
          displayName: 'User 2',
        })
        .returning();
      testUserId2 = user?.userId ?? '';
    });

    // Create authenticated request for tenant2 user
    const session = await sessionStorage.getSession();
    session.set('userId', testUserId2);
    session.set('tenantId', TEST_TENANT_2);
    const cookieHeader = await commitSession(session);

    const request = new Request(`http://localhost/api/tokens/${token.tokenId}`, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
      },
    });

    const params = { id: token.tokenId };

    // Call loader
    const response = await loader({ request, params, context: {} });
    const data = await response.json();

    // Verify response - should return 404 due to RLS
    expect(response.status).toBe(404);
    expect('error' in data).toBe(true);
    if ('error' in data) {
      expect(data.error).toBe('Token not found');
    }
  });
});
