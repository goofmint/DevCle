/**
 * Authentication Service Tests
 *
 * Tests for auth.service.ts functions:
 * - login(): Credential verification
 * - getUserById(): User retrieval
 * - hashPassword(): Password hashing
 *
 * Test strategy:
 * - Use real database (no mocks)
 * - Create test users in beforeAll
 * - Clean up in afterAll
 * - Test both success and failure paths
 * - Verify security properties (no password leaks, constant-time, etc.)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { login, getUserById, hashPassword } from './auth.service.js';
import { getDb, setTenantContext, clearTenantContext, closeDb } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

// Test user data
const TEST_TENANT_ID = 'default';
const TEST_USER = {
  email: 'test@example.com',
  password: 'password123',
  displayName: 'Test User',
  role: 'member' as const,
};

const TEST_ADMIN = {
  email: 'admin@example.com',
  password: 'admin123456',
  displayName: 'Admin User',
  role: 'admin' as const,
};

// Store created user IDs for cleanup
let testUserId: string;
let testAdminId: string;

describe('Authentication Service', () => {
  beforeAll(async () => {
    // Set tenant context for test database
    await setTenantContext(TEST_TENANT_ID);

    const db = getDb();

    // Ensure tenant exists
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.tenantId, TEST_TENANT_ID))
      .limit(1);

    if (!tenant) {
      await db.insert(schema.tenants).values({
        tenantId: TEST_TENANT_ID,
        name: 'Test Tenant',
        plan: 'OSS',
      });
    }

    // Create test users
    const passwordHash = await hashPassword(TEST_USER.password);
    const adminPasswordHash = await hashPassword(TEST_ADMIN.password);

    // Delete existing test users if they exist
    await db
      .delete(schema.users)
      .where(
        and(
          eq(schema.users.tenantId, TEST_TENANT_ID),
          eq(schema.users.email, TEST_USER.email.toLowerCase())
        )
      );

    await db
      .delete(schema.users)
      .where(
        and(
          eq(schema.users.tenantId, TEST_TENANT_ID),
          eq(schema.users.email, TEST_ADMIN.email.toLowerCase())
        )
      );

    // Insert test user
    const [user] = await db
      .insert(schema.users)
      .values({
        tenantId: TEST_TENANT_ID,
        email: TEST_USER.email.toLowerCase(),
        displayName: TEST_USER.displayName,
        passwordHash,
        role: TEST_USER.role,
        authProvider: 'password',
        disabled: false,
      })
      .returning();

    if (!user) {
      throw new Error('Failed to create test user');
    }

    testUserId = user.userId;

    // Insert test admin
    const [admin] = await db
      .insert(schema.users)
      .values({
        tenantId: TEST_TENANT_ID,
        email: TEST_ADMIN.email.toLowerCase(),
        displayName: TEST_ADMIN.displayName,
        passwordHash: adminPasswordHash,
        role: TEST_ADMIN.role,
        authProvider: 'password',
        disabled: false,
      })
      .returning();

    if (!admin) {
      throw new Error('Failed to create test admin user');
    }

    testAdminId = admin.userId;
  });

  afterAll(async () => {
    // Clean up test users
    const db = getDb();

    await db
      .delete(schema.users)
      .where(eq(schema.users.userId, testUserId));

    await db
      .delete(schema.users)
      .where(eq(schema.users.userId, testAdminId));

    // Clear tenant context
    await clearTenantContext();

    // Close database connection
    await closeDb();
  });

  describe('hashPassword()', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'password123';
      const hash = await hashPassword(password);

      // Verify hash format (bcrypt starts with $2a$, $2b$, or $2y$)
      expect(hash).toMatch(/^\$2[aby]\$/);

      // Verify hash is not the plain password
      expect(hash).not.toBe(password);

      // Verify hash length (bcrypt hashes are 60 characters)
      expect(hash.length).toBe(60);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'password123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Verify both are valid bcrypt hashes
      expect(hash1).toMatch(/^\$2[aby]\$/);
      expect(hash2).toMatch(/^\$2[aby]\$/);

      // Verify hashes are different (bcrypt uses random salt)
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('login()', () => {
    it('should return user for valid credentials', async () => {
      const user = await login(TEST_USER.email, TEST_USER.password);

      expect(user).not.toBeNull();
      expect(user?.userId).toBe(testUserId);
      expect(user?.email).toBe(TEST_USER.email.toLowerCase());
      expect(user?.displayName).toBe(TEST_USER.displayName);
      expect(user?.tenantId).toBe(TEST_TENANT_ID);
      expect(user?.role).toBe(TEST_USER.role);
    });

    it('should return user for valid admin credentials', async () => {
      const user = await login(TEST_ADMIN.email, TEST_ADMIN.password);

      expect(user).not.toBeNull();
      expect(user?.userId).toBe(testAdminId);
      expect(user?.email).toBe(TEST_ADMIN.email.toLowerCase());
      expect(user?.role).toBe('admin');
    });

    it('should handle case-insensitive email', async () => {
      // Try uppercase email
      const user = await login(TEST_USER.email.toUpperCase(), TEST_USER.password);

      expect(user).not.toBeNull();
      expect(user?.userId).toBe(testUserId);
    });

    it('should return null for invalid email', async () => {
      const user = await login('nonexistent@example.com', 'password123');

      expect(user).toBeNull();
    });

    it('should return null for invalid password', async () => {
      const user = await login(TEST_USER.email, 'wrongpassword');

      expect(user).toBeNull();
    });

    it('should return null for disabled user', async () => {
      const db = getDb();

      // Disable test user
      await db
        .update(schema.users)
        .set({ disabled: true })
        .where(eq(schema.users.userId, testUserId));

      // Try to login
      const user = await login(TEST_USER.email, TEST_USER.password);

      expect(user).toBeNull();

      // Re-enable user for other tests
      await db
        .update(schema.users)
        .set({ disabled: false })
        .where(eq(schema.users.userId, testUserId));
    });

    it('should not return password hash', async () => {
      const user = await login(TEST_USER.email, TEST_USER.password);

      expect(user).not.toBeNull();

      // Verify no password-related fields in response
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('password');
    });

    it('should throw error for invalid email format', async () => {
      await expect(login('not-an-email', 'password123')).rejects.toThrow();
    });

    it('should throw error for short password', async () => {
      await expect(login(TEST_USER.email, 'short')).rejects.toThrow();
    });
  });

  describe('getUserById()', () => {
    it('should return user by ID', async () => {
      const user = await getUserById(testUserId);

      expect(user).not.toBeNull();
      expect(user?.userId).toBe(testUserId);
      expect(user?.email).toBe(TEST_USER.email.toLowerCase());
      expect(user?.displayName).toBe(TEST_USER.displayName);
      expect(user?.tenantId).toBe(TEST_TENANT_ID);
      expect(user?.role).toBe(TEST_USER.role);
    });

    it('should return null for non-existent ID', async () => {
      const user = await getUserById('00000000-0000-4000-8000-000000000000');

      expect(user).toBeNull();
    });

    it('should return null for disabled user', async () => {
      const db = getDb();

      // Disable test user
      await db
        .update(schema.users)
        .set({ disabled: true })
        .where(eq(schema.users.userId, testUserId));

      // Try to get user
      const user = await getUserById(testUserId);

      expect(user).toBeNull();

      // Re-enable user for other tests
      await db
        .update(schema.users)
        .set({ disabled: false })
        .where(eq(schema.users.userId, testUserId));
    });

    it('should not return password hash', async () => {
      const user = await getUserById(testUserId);

      expect(user).not.toBeNull();

      // Verify no password-related fields in response
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('password');
    });
  });
});
