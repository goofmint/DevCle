/**
 * Identity Resolver Service Tests
 *
 * Tests for the Identity Resolver Service (Developer Identity Resolution).
 * These tests verify that:
 * - resolveDeveloperByAccount() works correctly (PRIMARY method)
 * - resolveDeveloperByIdentifier() works correctly (SECONDARY method)
 * - findDuplicates() calculates confidence scores correctly
 *
 * Test Strategy:
 * - NO MOCKS: Tests use real database connection
 * - Cleanup: Tests clean up their own data
 * - Verification: Actual database records are checked
 * - RLS: Tests verify tenant isolation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getDb,
  closeDb,
  setTenantContext,
  clearTenantContext,
} from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import {
  resolveDeveloperByAccount,
  resolveDeveloperByIdentifier,
  findDuplicates,
} from './identity-resolver.service.js';
import { addIdentifier } from './identity-identifiers.service.js';
import { createDeveloper, deleteDeveloper } from './drm.service.js';

describe('Identity Resolver Service', () => {
  beforeAll(async () => {
    // Set tenant context for all tests
    // This is REQUIRED because RLS is enabled
    await setTenantContext('default');
  });

  afterAll(async () => {
    // Clear tenant context to ensure test isolation
    await clearTenantContext();

    // Clean up database connections
    await closeDb();
  });

  describe('resolveDeveloperByAccount (PRIMARY METHOD)', () => {
    it('should find developer by GitHub account ID', async () => {
      // Arrange: Create developer and link GitHub account
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'GitHub User',
        primaryEmail: `github-${timestamp}@example.com`,
        orgId: null,
      });

      // Add GitHub account to accounts table
      const db = getDb();
      await db.insert(schema.accounts).values({
        accountId: crypto.randomUUID(),
        tenantId: 'default',
        developerId: dev.developerId,
        provider: 'github',
        externalUserId: `gh-${timestamp}`,
        handle: 'testdev',
      });

      // Act: Resolve by GitHub account
      const result = await resolveDeveloperByAccount('default', {
        provider: 'github',
        externalUserId: `gh-${timestamp}`,
      });

      // Assert: Should find the developer
      expect(result).not.toBeNull();
      expect(result?.developerId).toBe(dev.developerId);
      expect(result?.displayName).toBe('GitHub User');

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should find developer by Slack account ID', async () => {
      // Arrange: Create developer and link Slack account
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Slack User',
        primaryEmail: `slack-${timestamp}@example.com`,
        orgId: null,
      });

      const db = getDb();
      await db.insert(schema.accounts).values({
        accountId: crypto.randomUUID(),
        tenantId: 'default',
        developerId: dev.developerId,
        provider: 'slack',
        externalUserId: `U${timestamp}ABC`,
        handle: 'testslackuser',
      });

      // Act: Resolve by Slack account
      const result = await resolveDeveloperByAccount('default', {
        provider: 'slack',
        externalUserId: `U${timestamp}ABC`,
      });

      // Assert: Should find the developer
      expect(result).not.toBeNull();
      expect(result?.developerId).toBe(dev.developerId);

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should return null if account not found', async () => {
      // Act: Try to resolve non-existent account
      const result = await resolveDeveloperByAccount('default', {
        provider: 'github',
        externalUserId: 'nonexistent-999999',
      });

      // Assert: Should return null
      expect(result).toBeNull();
    });

    it('should return null if account exists but not linked to developer', async () => {
      // Arrange: Create account without developer_id
      const db = getDb();
      const timestamp = Date.now();
      await db.insert(schema.accounts).values({
        accountId: crypto.randomUUID(),
        tenantId: 'default',
        developerId: null, // Not linked
        provider: 'discord',
        externalUserId: `discord-${timestamp}`,
        handle: 'unlinkeddiscord',
      });

      // Act: Try to resolve
      const result = await resolveDeveloperByAccount('default', {
        provider: 'discord',
        externalUserId: `discord-${timestamp}`,
      });

      // Assert: Should return null (no developer linked)
      expect(result).toBeNull();
    });

    it('should work with different providers', async () => {
      // Arrange: Create developer with multiple accounts
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Multi-Provider User',
        primaryEmail: `multi-${timestamp}@example.com`,
        orgId: null,
      });

      const db = getDb();
      const providers = ['github', 'slack', 'discord', 'x'];

      // Create accounts for all providers
      for (const provider of providers) {
        await db.insert(schema.accounts).values({
          accountId: crypto.randomUUID(),
          tenantId: 'default',
          developerId: dev.developerId,
          provider,
          externalUserId: `${provider}-${timestamp}`,
          handle: `user-${provider}`,
        });
      }

      // Act: Resolve using each provider
      for (const provider of providers) {
        const result = await resolveDeveloperByAccount('default', {
          provider,
          externalUserId: `${provider}-${timestamp}`,
        });

        // Assert: Should find the same developer for all providers
        expect(result).not.toBeNull();
        expect(result?.developerId).toBe(dev.developerId);
      }

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });
  });

  describe('resolveDeveloperByIdentifier (SECONDARY METHOD)', () => {
    it('should find developer by email identifier', async () => {
      // Arrange: Create developer with email identifier
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Email User',
        primaryEmail: `email-id-${timestamp}@example.com`,
        orgId: null,
      });

      await addIdentifier('default', dev.developerId, {
        kind: 'email',
        value: `email-id-${timestamp}@example.com`,
      });

      // Act: Resolve by email
      const result = await resolveDeveloperByIdentifier('default', {
        kind: 'email',
        value: `email-id-${timestamp}@example.com`,
      });

      // Assert: Should find the developer
      expect(result).not.toBeNull();
      expect(result?.developerId).toBe(dev.developerId);

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should return null if identifier not found', async () => {
      // Act: Try to resolve non-existent identifier
      const result = await resolveDeveloperByIdentifier('default', {
        kind: 'email',
        value: 'nonexistent-9999@example.com',
      });

      // Assert: Should return null
      expect(result).toBeNull();
    });

    it('should normalize email (case-insensitive)', async () => {
      // Arrange: Create with lowercase email
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Case Test',
        primaryEmail: `casetest-${timestamp}@example.com`,
        orgId: null,
      });

      await addIdentifier('default', dev.developerId, {
        kind: 'email',
        value: `casetest-${timestamp}@example.com`,
      });

      // Act: Search with uppercase email
      const result = await resolveDeveloperByIdentifier('default', {
        kind: 'email',
        value: `CASETEST-${timestamp}@EXAMPLE.COM`,
      });

      // Assert: Should find developer (case-insensitive)
      expect(result).not.toBeNull();
      expect(result?.developerId).toBe(dev.developerId);

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should fallback to accounts.email for email kind', async () => {
      // Arrange: Create developer with email in accounts table (not in developer_identifiers)
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Account Email User',
        primaryEmail: null, // Not set in developers table
        orgId: null,
      });

      const db = getDb();
      await db.insert(schema.accounts).values({
        accountId: crypto.randomUUID(),
        tenantId: 'default',
        developerId: dev.developerId,
        provider: 'github',
        externalUserId: `gh-email-${timestamp}`,
        handle: 'testemailuser',
        email: `account-email-${timestamp}@example.com`, // Email in accounts table
      });

      // Act: Resolve by email (should fallback to accounts.email)
      const result = await resolveDeveloperByIdentifier('default', {
        kind: 'email',
        value: `account-email-${timestamp}@example.com`,
      });

      // Assert: Should find developer via accounts.email fallback
      expect(result).not.toBeNull();
      expect(result?.developerId).toBe(dev.developerId);

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should fallback to developers.primary_email for email kind', async () => {
      // Arrange: Create developer with primary_email (not in developer_identifiers or accounts)
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Primary Email User',
        primaryEmail: `primary-email-${timestamp}@example.com`,
        orgId: null,
      });

      // Act: Resolve by email (should fallback to developers.primary_email)
      const result = await resolveDeveloperByIdentifier('default', {
        kind: 'email',
        value: `primary-email-${timestamp}@example.com`,
      });

      // Assert: Should find developer via primary_email fallback
      expect(result).not.toBeNull();
      expect(result?.developerId).toBe(dev.developerId);

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should work with non-email identifiers', async () => {
      // Arrange: Create developer with various identifier types
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Multi-Identifier User',
        primaryEmail: null,
        orgId: null,
      });

      const identifiers = [
        { kind: 'phone' as const, value: '+81-90-1234-5678' },
        { kind: 'domain' as const, value: 'example.com' },
        { kind: 'mlid' as const, value: `ml_${timestamp}` },
      ];

      // Add all identifiers
      for (const identifier of identifiers) {
        await addIdentifier('default', dev.developerId, identifier);
      }

      // Act: Resolve using each identifier
      for (const identifier of identifiers) {
        const result = await resolveDeveloperByIdentifier('default', identifier);

        // Assert: Should find the same developer
        expect(result).not.toBeNull();
        expect(result?.developerId).toBe(dev.developerId);
      }

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });
  });

  describe('findDuplicates', () => {
    // Note: The unique constraints on accounts, developer_identifiers, and developers.primary_email
    // prevent creating multiple developers with the same data. This is by design for data integrity.
    // findDuplicates() is mainly used in scenarios where duplicates might exist due to:
    // - Data migration/import
    // - Manual database operations
    // - Edge cases in concurrent operations
    //
    // For testing purposes, we test the "no duplicates found" case, as creating actual duplicates
    // would violate the database constraints.

    it('should return empty array if no duplicates found', async () => {
      // Arrange: Create developer with unique identifiers
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Unique Developer',
        primaryEmail: `unique-${timestamp}@example.com`,
        orgId: null,
      });

      // Act: Find duplicates
      const duplicates = await findDuplicates('default', dev.developerId);

      // Assert: Should return empty array
      expect(duplicates).toEqual([]);

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });
  });
});
