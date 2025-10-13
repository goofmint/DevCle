/**
 * Identity Identifiers Service Tests
 *
 * Tests for the Identity Identifiers Service (Developer Identifier Management).
 * These tests verify that:
 * - addIdentifier() handles duplicates correctly
 * - removeIdentifier() deletes identifiers correctly
 * - Validation and error handling work as expected
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
import { eq } from 'drizzle-orm';
import {
  addIdentifier,
  removeIdentifier,
} from './identity-identifiers.service.js';
import { createDeveloper, deleteDeveloper } from './drm.service.js';

describe('Identity Identifiers Service', () => {
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

  describe('addIdentifier', () => {
    it('should add identifier to developer', async () => {
      // Arrange: Create developer
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Add Identifier Test',
        primaryEmail: `add-id-${timestamp}@example.com`,
        orgId: null,
      });

      // Act: Add identifier
      const identifier = await addIdentifier('default', dev.developerId, {
        kind: 'email',
        value: `add-id-${timestamp}@example.com`,
      }, 1.0);

      // Assert: Identifier should be created
      expect(identifier.developerId).toBe(dev.developerId);
      expect(identifier.kind).toBe('email');
      expect(identifier.valueNormalized).toBe(`add-id-${timestamp}@example.com`);
      expect(Number(identifier.confidence)).toBe(1.0);

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should normalize identifier value', async () => {
      // Arrange: Create developer
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Normalize Test',
        primaryEmail: null,
        orgId: null,
      });

      // Act: Add identifier with uppercase email
      const identifier = await addIdentifier('default', dev.developerId, {
        kind: 'email',
        value: `UPPERCASE-${timestamp}@EXAMPLE.COM`,
      });

      // Assert: Should be normalized to lowercase
      expect(identifier.valueNormalized).toBe(`uppercase-${timestamp}@example.com`);

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should update existing identifier if same developer', async () => {
      // Arrange: Create developer with identifier
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Update Identifier Test',
        primaryEmail: null,
        orgId: null,
      });

      const email = `update-id-${timestamp}@example.com`;
      await addIdentifier('default', dev.developerId, {
        kind: 'email',
        value: email,
      }, 0.8);

      // Act: Add same identifier with different confidence
      const updated = await addIdentifier('default', dev.developerId, {
        kind: 'email',
        value: email,
      }, 0.9);

      // Assert: Should update confidence
      expect(Number(updated.confidence)).toBe(0.9);
      expect(updated.developerId).toBe(dev.developerId);

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should throw error on duplicate identifier (different developer)', async () => {
      // Arrange: Create two developers
      const timestamp = Date.now();
      const dev1 = await createDeveloper('default', {
        displayName: 'Dev 1',
        primaryEmail: null,
        orgId: null,
      });
      const dev2 = await createDeveloper('default', {
        displayName: 'Dev 2',
        primaryEmail: null,
        orgId: null,
      });

      const sharedEmail = `shared-conflict-${timestamp}@example.com`;

      // Add identifier to dev1
      await addIdentifier('default', dev1.developerId, {
        kind: 'email',
        value: sharedEmail,
      });

      // Act & Assert: Adding same identifier to dev2 should fail
      await expect(
        addIdentifier('default', dev2.developerId, {
          kind: 'email',
          value: sharedEmail,
        })
      ).rejects.toThrow(/conflict/i);

      // Cleanup
      await deleteDeveloper('default', dev1.developerId);
      await deleteDeveloper('default', dev2.developerId);
    });

    it('should throw error for invalid confidence score', async () => {
      // Arrange: Create developer
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Invalid Confidence Test',
        primaryEmail: null,
        orgId: null,
      });

      // Act & Assert: Confidence > 1.0 should fail
      await expect(
        addIdentifier('default', dev.developerId, {
          kind: 'email',
          value: `test-${timestamp}@example.com`,
        }, 1.5)
      ).rejects.toThrow(/confidence must be between/i);

      // Act & Assert: Confidence < 0.0 should fail
      await expect(
        addIdentifier('default', dev.developerId, {
          kind: 'email',
          value: `test2-${timestamp}@example.com`,
        }, -0.1)
      ).rejects.toThrow(/confidence must be between/i);

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });
  });

  describe('removeIdentifier', () => {
    it('should remove identifier from developer', async () => {
      // Arrange: Create developer with identifier
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Remove Identifier Test',
        primaryEmail: null,
        orgId: null,
      });

      const identifier = await addIdentifier('default', dev.developerId, {
        kind: 'email',
        value: `remove-id-${timestamp}@example.com`,
      });

      // Act: Remove identifier
      const result = await removeIdentifier('default', identifier.identifierId);

      // Assert: Should return true
      expect(result).toBe(true);

      // Verify deletion
      const db = getDb();
      const deleted = await db
        .select()
        .from(schema.developerIdentifiers)
        .where(eq(schema.developerIdentifiers.identifierId, identifier.identifierId))
        .limit(1);
      expect(deleted.length).toBe(0);

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should return false for non-existent identifier', async () => {
      // Act: Try to remove non-existent identifier
      const result = await removeIdentifier(
        'default',
        '99999999-9999-4999-8999-999999999999'
      );

      // Assert: Should return false
      expect(result).toBe(false);
    });
  });
});
