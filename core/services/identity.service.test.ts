import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from 'vitest';
import {
  ensureTenantExists,
  runInTenant,
} from '../db/tenant-test-utils.js';
import {
  createDeveloper,
  deleteDeveloper,
} from './drm.service.js';
import {
  addIdentifier,
  listIdentifiers,
} from './identity-identifiers.service.js';
import { mergeDevelopers } from './identity-merge.service.js';
import { resolveDeveloperByIdentifier } from './identity-resolver.service.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { closeDb } from '../db/connection.js';

const TEST_TENANT = 'test-identity-service';

async function cleanupIdentifiers() {
  await runInTenant(TEST_TENANT, async (tx) => {
    await tx.delete(schema.developerIdentifiers).where(eq(schema.developerIdentifiers.tenantId, TEST_TENANT));
  });
}

describe('identity services', () => {
  const developers: string[] = [];

  beforeEach(async () => {
    await ensureTenantExists(TEST_TENANT);
    await cleanupIdentifiers();
    developers.splice(0);
  });

  afterEach(async () => {
    await cleanupIdentifiers();
    for (const developerId of developers.splice(0)) {
      await deleteDeveloper(TEST_TENANT, developerId);
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  it('adds identifiers and resolves developer by identifier', async () => {
    const developer = await createDeveloper(TEST_TENANT, {
      displayName: 'Identity Dev',
      primaryEmail: null,
      orgId: null,
    });
    developers.push(developer.developerId);

    await addIdentifier(TEST_TENANT, developer.developerId, {
      kind: 'email',
      value: 'identity@example.com',
    });

    const identifiers = await listIdentifiers(TEST_TENANT, developer.developerId);
    expect(identifiers).toHaveLength(1);
    expect(identifiers[0]?.valueNormalized).toBe('identity@example.com');

    const resolved = await resolveDeveloperByIdentifier(TEST_TENANT, {
      kind: 'email',
      value: 'identity@example.com',
    });

    expect(resolved?.developerId).toBe(developer.developerId);
  });

  it('prevents identifier conflicts between developers', async () => {
    const first = await createDeveloper(TEST_TENANT, {
      displayName: 'First Dev',
      primaryEmail: null,
      orgId: null,
    });
    const second = await createDeveloper(TEST_TENANT, {
      displayName: 'Second Dev',
      primaryEmail: null,
      orgId: null,
    });
    developers.push(first.developerId, second.developerId);

    await addIdentifier(TEST_TENANT, first.developerId, {
      kind: 'email',
      value: 'conflict@example.com',
    });

    await expect(
      addIdentifier(TEST_TENANT, second.developerId, {
        kind: 'email',
        value: 'conflict@example.com',
      })
    ).rejects.toThrow(/Identifier conflict/);
  });

  it('merges developers and reassigns identifiers', async () => {
    const target = await createDeveloper(TEST_TENANT, {
      displayName: 'Target Dev',
      primaryEmail: null,
      orgId: null,
    });
    const source = await createDeveloper(TEST_TENANT, {
      displayName: 'Source Dev',
      primaryEmail: null,
      orgId: null,
    });
    developers.push(target.developerId, source.developerId);

    await addIdentifier(TEST_TENANT, source.developerId, {
      kind: 'email',
      value: 'merge-me@example.com',
    });

    const merged = await mergeDevelopers(TEST_TENANT, {
      intoDeveloperId: target.developerId,
      fromDeveloperId: source.developerId,
      reason: 'duplicate test profile',
      mergedBy: null,
    });

    expect(merged.developerId).toBe(target.developerId);
    expect(merged.tags).toEqual([]);

    const identifiers = await listIdentifiers(TEST_TENANT, target.developerId);
    expect(identifiers.some((item) => item.valueNormalized === 'merge-me@example.com')).toBe(true);

    const sourceExists = await getDeveloperSource(source.developerId);
    expect(sourceExists).toBeNull();
  });
});

async function getDeveloperSource(developerId: string) {
  const results = await runInTenant(TEST_TENANT, async (tx) => {
    return await tx
      .select()
      .from(schema.developers)
      .where(eq(schema.developers.developerId, developerId))
      .limit(1);
  });

  return results[0] ?? null;
}
