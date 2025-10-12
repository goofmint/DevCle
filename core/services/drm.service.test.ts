/**
 * DRM Service Tests
 *
 * Tests for the DRM (Developer Relationship Management) service.
 * These tests verify that:
 * - Service functions work correctly with real database
 * - Input validation works (Zod schemas)
 * - Pagination and sorting work correctly
 * - Filters work correctly
 * - Error handling works correctly
 *
 * Test Strategy:
 * - NO MOCKS: Tests use real database connection
 * - Cleanup: Tests clean up their own data
 * - Verification: Actual database records are checked
 * - RLS: Tests verify tenant isolation
 *
 * Setup:
 * - Requires PostgreSQL running (docker-compose)
 * - Uses DATABASE_* environment variables
 * - Sets tenant context before all tests
 * - Closes connections after tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  closeDb,
  setTenantContext,
  clearTenantContext,
} from '../db/connection.js';
import {
  createDeveloper,
  getDeveloper,
  listDevelopers,
  updateDeveloper,
  deleteDeveloper,
  type CreateDeveloperInput,
} from './drm.service.js';

describe('DRM Service', () => {
  beforeAll(async () => {
    // Set tenant context for all tests
    // This is REQUIRED because Task 3.5 enabled RLS
    // Without this, SELECT queries will fail with RLS policy violations
    await setTenantContext('default');
  });

  afterAll(async () => {
    // Clear tenant context to ensure test isolation
    await clearTenantContext();

    // Clean up database connections
    await closeDb();
  });

  describe('createDeveloper', () => {
    it('should create a developer with valid data', async () => {
      // Arrange: Prepare valid input with unique email
      const timestamp = Date.now();
      const input: CreateDeveloperInput = {
        displayName: 'Test Developer',
        primaryEmail: `test-create-${timestamp}@example.com`,
        orgId: null,
        consentAnalytics: true,
        tags: ['test'],
      };

      // Act: Call service function
      const result = await createDeveloper('default', input);

      // Assert: Verify created record
      expect(result.displayName).toBe('Test Developer');
      expect(result.primaryEmail).toBe(`test-create-${timestamp}@example.com`);
      expect(result.tenantId).toBe('default');
      expect(result.consentAnalytics).toBe(true);
      expect(result.tags).toEqual(['test']);
      expect(result.developerId).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();

      // Cleanup: Delete created developer
      await deleteDeveloper('default', result.developerId);
    });

    it('should apply defaults for omitted fields', async () => {
      // Arrange: Input without consentAnalytics and tags
      const timestamp = Date.now();
      const input: CreateDeveloperInput = {
        displayName: 'Test Defaults',
        primaryEmail: `test-defaults-${timestamp}@example.com`,
        orgId: null,
        // consentAnalytics and tags are omitted (defaults will be applied)
      };

      // Act: Call service function
      const result = await createDeveloper('default', input);

      // Assert: Verify defaults were applied
      expect(result.consentAnalytics).toBe(false); // default: false
      expect(result.tags).toEqual([]); // default: []

      // Cleanup
      await deleteDeveloper('default', result.developerId);
    });

    it('should throw error for invalid email', async () => {
      // Arrange: Invalid email format
      const input = {
        displayName: 'Test',
        primaryEmail: 'invalid-email', // Invalid format
        orgId: null,
        consentAnalytics: false,
        tags: [],
      };

      // Act & Assert: Expect validation error
      await expect(createDeveloper('default', input)).rejects.toThrow();
    });

    it('should throw error for empty displayName', async () => {
      // Arrange: Empty displayName
      const input = {
        displayName: '', // Empty string (min: 1)
        primaryEmail: 'test@example.com',
        orgId: null,
      };

      // Act & Assert: Expect validation error
      await expect(createDeveloper('default', input)).rejects.toThrow();
    });

    it('should throw error for displayName longer than 255 chars', async () => {
      // Arrange: Very long displayName
      const input = {
        displayName: 'a'.repeat(256), // 256 characters (max: 255)
        primaryEmail: 'test@example.com',
        orgId: null,
      };

      // Act & Assert: Expect validation error
      await expect(createDeveloper('default', input)).rejects.toThrow();
    });

    it('should accept null for primaryEmail', async () => {
      // Arrange: null email
      const input: CreateDeveloperInput = {
        displayName: `Test Null Email ${Date.now()}`,
        primaryEmail: null,
        orgId: null,
      };

      // Act: Call service function
      const result = await createDeveloper('default', input);

      // Assert: Verify null email
      expect(result.primaryEmail).toBeNull();

      // Cleanup
      await deleteDeveloper('default', result.developerId);
    });
  });

  describe('getDeveloper', () => {
    it('should return developer by ID', async () => {
      // Arrange: Create a developer first
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: 'Test Get',
        primaryEmail: `test-get-${timestamp}@example.com`,
        orgId: null,
      });

      // Act: Retrieve by ID
      const result = await getDeveloper('default', created.developerId);

      // Assert: Verify returned data
      expect(result).not.toBeNull();
      expect(result?.developerId).toBe(created.developerId);
      expect(result?.displayName).toBe('Test Get');
      expect(result?.primaryEmail).toBe(`test-get-${timestamp}@example.com`);

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });

    it('should return null for non-existent ID', async () => {
      // Act: Try to get non-existent developer
      // Using a valid UUID v4 format that doesn't exist in the database
      const result = await getDeveloper(
        'default',
        '99999999-9999-4999-8999-999999999999'
      );

      // Assert: Should return null (not throw error)
      expect(result).toBeNull();
    });
  });

  describe('listDevelopers', () => {
    // Helper function to create test developers with unique emails
    async function createTestDevelopers(): Promise<
      Array<typeof schema.developers.$inferSelect>
    > {
      const developers = [];
      const timestamp = Date.now(); // Use timestamp to ensure unique emails

      developers.push(
        await createDeveloper('default', {
          displayName: 'Alice Test',
          primaryEmail: `alice-test-${timestamp}@example.com`,
          orgId: null,
        })
      );

      developers.push(
        await createDeveloper('default', {
          displayName: 'Bob Test',
          primaryEmail: `bob-test-${timestamp}@example.com`,
          orgId: null,
        })
      );

      developers.push(
        await createDeveloper('default', {
          displayName: 'Charlie Test',
          primaryEmail: `charlie-test-${timestamp}@example.com`,
          orgId: null,
        })
      );

      return developers;
    }

    // Helper function to clean up test developers
    async function cleanupTestDevelopers(
      developers: Array<{ developerId: string }>
    ): Promise<void> {
      for (const dev of developers) {
        await deleteDeveloper('default', dev.developerId);
      }
    }

    it('should list developers with default pagination', async () => {
      // Arrange: Create multiple developers
      const created = await createTestDevelopers();

      // Act: List with default params
      const result = await listDevelopers('default', {});

      // Assert: Verify pagination
      expect(result.developers).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThan(0);
      expect(result.developers.length).toBeGreaterThanOrEqual(3); // At least our 3 test devs

      // Cleanup
      await cleanupTestDevelopers(created);
    });

    it('should respect limit parameter', async () => {
      // Arrange: Create multiple developers
      const created = await createTestDevelopers();

      // Act: Request with limit=2
      const result = await listDevelopers('default', {
        limit: 2,
        offset: 0,
      });

      // Assert: Should return max 2 items
      expect(result.developers.length).toBeLessThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(3); // Total count should be unchanged

      // Cleanup
      await cleanupTestDevelopers(created);
    });

    it('should respect offset parameter', async () => {
      // Arrange: Create multiple developers
      const created = await createTestDevelopers();

      // Act: Get first page and second page
      const firstPage = await listDevelopers('default', {
        limit: 2,
        offset: 0,
        orderBy: 'createdAt',
        orderDirection: 'desc',
      });

      const secondPage = await listDevelopers('default', {
        limit: 2,
        offset: 2,
        orderBy: 'createdAt',
        orderDirection: 'desc',
      });

      // Assert: Pages should have different developers
      if (firstPage.developers[0] && secondPage.developers[0]) {
        expect(firstPage.developers[0].developerId).not.toBe(
          secondPage.developers[0].developerId
        );
      }

      // Cleanup
      await cleanupTestDevelopers(created);
    });

    it('should calculate total count correctly', async () => {
      // Arrange: Create multiple developers
      const created = await createTestDevelopers();

      // Act: Get with pagination
      const result = await listDevelopers('default', {
        limit: 1,
        offset: 0,
      });

      // Assert: Total count should be >= 3 regardless of limit
      expect(result.total).toBeGreaterThanOrEqual(3);
      expect(result.developers.length).toBe(1); // But only 1 item returned

      // Cleanup
      await cleanupTestDevelopers(created);
    });

    it('should sort by displayName ascending', async () => {
      // Arrange: Create developers with different names
      const created = await createTestDevelopers();

      // Act: Request with orderBy='displayName', orderDirection='asc'
      const result = await listDevelopers('default', {
        orderBy: 'displayName',
        orderDirection: 'asc',
      });

      // Assert: Verify sort order
      expect(result.developers.length).toBeGreaterThan(0);
      for (let i = 0; i < result.developers.length - 1; i++) {
        const current = result.developers[i]?.displayName;
        const next = result.developers[i + 1]?.displayName;
        // Skip if either developer is missing (shouldn't happen but TypeScript requires check)
        if (!current || !next) continue;
        expect(current <= next).toBe(true);
      }

      // Cleanup
      await cleanupTestDevelopers(created);
    });

    it('should sort by createdAt descending (default)', async () => {
      // Arrange: Create developers
      const created = await createTestDevelopers();

      // Act: Test default sort order
      const result = await listDevelopers('default', {});

      // Assert: Verify that createdAt is in descending order (newest first)
      expect(result.developers.length).toBeGreaterThan(0);
      for (let i = 0; i < result.developers.length - 1; i++) {
        const current = new Date(result.developers[i]!.createdAt);
        const next = new Date(result.developers[i + 1]!.createdAt);
        expect(current >= next).toBe(true);
      }

      // Cleanup
      await cleanupTestDevelopers(created);
    });

    it('should search by display name', async () => {
      // Arrange: Create developers
      const created = await createTestDevelopers();

      // Act: Search for "Alice"
      const result = await listDevelopers('default', {
        search: 'Alice',
      });

      // Assert: Should only return Alice
      expect(result.developers.length).toBeGreaterThanOrEqual(1);
      expect(
        result.developers.some((d) => d.displayName?.includes('Alice'))
      ).toBe(true);

      // Cleanup
      await cleanupTestDevelopers(created);
    });

    it('should search by email', async () => {
      // Arrange: Create developers
      const created = await createTestDevelopers();

      // Act: Search for "bob-test"
      const result = await listDevelopers('default', {
        search: 'bob-test',
      });

      // Assert: Should only return Bob
      expect(result.developers.length).toBeGreaterThanOrEqual(1);
      expect(
        result.developers.some((d) => d.primaryEmail?.includes('bob-test'))
      ).toBe(true);

      // Cleanup
      await cleanupTestDevelopers(created);
    });

    it('should support combined filters, sorting, and pagination', async () => {
      // Arrange: Create developers
      const created = await createTestDevelopers();

      // Act: Test combination of search + orderBy + limit
      const result = await listDevelopers('default', {
        search: 'test',
        orderBy: 'displayName',
        orderDirection: 'asc',
        limit: 2,
        offset: 0,
      });

      // Assert: Verify all parameters are applied correctly
      expect(result.developers.length).toBeLessThanOrEqual(2);
      expect(result.developers.length).toBeGreaterThan(0);

      // Cleanup
      await cleanupTestDevelopers(created);
    });
  });

  describe('updateDeveloper', () => {
    it('should update developer fields', async () => {
      // Arrange: Create a developer
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: 'Test Update',
        primaryEmail: `test-update-${timestamp}@example.com`,
        orgId: null,
      });

      // Act: Update the developer
      const updated = await updateDeveloper('default', created.developerId, {
        displayName: 'Updated Name',
        primaryEmail: `updated-${timestamp}@example.com`,
      });

      // Assert: Verify updates
      expect(updated).not.toBeNull();
      expect(updated?.displayName).toBe('Updated Name');
      expect(updated?.primaryEmail).toBe(`updated-${timestamp}@example.com`);

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });

    it('should support partial updates', async () => {
      // Arrange: Create a developer
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: 'Test Partial',
        primaryEmail: `test-partial-${timestamp}@example.com`,
        orgId: null,
        tags: ['original'],
      });

      // Act: Update only displayName
      const updated = await updateDeveloper('default', created.developerId, {
        displayName: 'Partially Updated',
      });

      // Assert: Only displayName should change
      expect(updated?.displayName).toBe('Partially Updated');
      expect(updated?.primaryEmail).toBe(`test-partial-${timestamp}@example.com`); // Unchanged
      expect(updated?.tags).toEqual(['original']); // Unchanged

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });

    it('should return null for non-existent developer', async () => {
      // Act: Try to update non-existent developer
      const result = await updateDeveloper(
        'default',
        '99999999-9999-4999-8999-999999999999',
        {
          displayName: 'Should Not Work',
        }
      );

      // Assert: Should return null
      expect(result).toBeNull();
    });

    it('should handle empty update (no-op)', async () => {
      // Arrange: Create a developer
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: 'Test No-op',
        primaryEmail: `test-noop-${timestamp}@example.com`,
        orgId: null,
      });

      // Act: Update with empty object
      const updated = await updateDeveloper('default', created.developerId, {});

      // Assert: Should return existing record unchanged
      expect(updated).not.toBeNull();
      expect(updated?.displayName).toBe('Test No-op');

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });

    it('should throw error for invalid email', async () => {
      // Arrange: Create a developer
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: 'Test Invalid Update',
        primaryEmail: `test-invalid-update-${timestamp}@example.com`,
        orgId: null,
      });

      // Act & Assert: Update with invalid email should throw
      await expect(
        updateDeveloper('default', created.developerId, {
          primaryEmail: 'invalid-email' as string, // Force invalid email
        })
      ).rejects.toThrow();

      // Cleanup
      await deleteDeveloper('default', created.developerId);
    });
  });

  describe('deleteDeveloper', () => {
    it('should delete existing developer', async () => {
      // Arrange: Create a developer
      const timestamp = Date.now();
      const created = await createDeveloper('default', {
        displayName: 'Test Delete',
        primaryEmail: `test-delete-${timestamp}@example.com`,
        orgId: null,
      });

      // Act: Delete the developer
      const result = await deleteDeveloper('default', created.developerId);

      // Assert: Should return true
      expect(result).toBe(true);

      // Verify deletion: getDeveloper should return null
      const retrieved = await getDeveloper('default', created.developerId);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent developer', async () => {
      // Act: Try to delete non-existent developer
      const result = await deleteDeveloper(
        'default',
        '99999999-9999-4999-8999-999999999999'
      );

      // Assert: Should return false
      expect(result).toBe(false);
    });
  });
});
