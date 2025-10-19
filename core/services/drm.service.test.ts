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
  getDeveloper,
  listDevelopers,
  deleteDeveloper,
} from './drm.service.js';
import * as schema from '../db/schema/index.js';
import { closeDb } from '../db/connection.js';

const PRIMARY_TENANT = 'test-drm-primary';
const OTHER_TENANT = 'test-drm-other';

async function insertOrganization(tenantId: string, name: string) {
  await runInTenant(tenantId, async (tx) => {
    await tx
      .insert(schema.organizations)
      .values({
        orgId: crypto.randomUUID(),
        tenantId,
        name,
        domainPrimary: null,
        attributes: null,
      })
      .onConflictDoNothing();
  });
}

describe('drm.service', () => {
  const createdDevelopers: { tenantId: string; developerId: string }[] = [];

  beforeEach(async () => {
    await ensureTenantExists(PRIMARY_TENANT);
    await ensureTenantExists(OTHER_TENANT);
  });

  afterEach(async () => {
    for (const entry of createdDevelopers.splice(0)) {
      await deleteDeveloper(entry.tenantId, entry.developerId);
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  it('creates and retrieves developer within the same tenant', async () => {
    await insertOrganization(PRIMARY_TENANT, 'Primary Org');

    const developer = await createDeveloper(PRIMARY_TENANT, {
      displayName: 'DRM Developer',
      primaryEmail: 'drm-developer@example.com',
      orgId: null,
    });
    createdDevelopers.push({ tenantId: PRIMARY_TENANT, developerId: developer.developerId });

    const fetched = await getDeveloper(PRIMARY_TENANT, developer.developerId);
    expect(fetched).not.toBeNull();
    expect(fetched?.tenantId).toBe(PRIMARY_TENANT);
  });

  it('does not leak developers across tenants', async () => {
    const developer = await createDeveloper(PRIMARY_TENANT, {
      displayName: 'Isolation Dev',
      primaryEmail: 'isolation@example.com',
      orgId: null,
    });
    createdDevelopers.push({ tenantId: PRIMARY_TENANT, developerId: developer.developerId });

    const otherTenantResult = await getDeveloper(OTHER_TENANT, developer.developerId);
    expect(otherTenantResult).toBeNull();
  });

  it('lists developers scoped to the current tenant', async () => {
    const primary = await createDeveloper(PRIMARY_TENANT, {
      displayName: 'Primary List Dev',
      primaryEmail: 'primary-list@example.com',
      orgId: null,
    });
    const other = await createDeveloper(OTHER_TENANT, {
      displayName: 'Other List Dev',
      primaryEmail: 'other-list@example.com',
      orgId: null,
    });
    createdDevelopers.push({ tenantId: PRIMARY_TENANT, developerId: primary.developerId });
    createdDevelopers.push({ tenantId: OTHER_TENANT, developerId: other.developerId });

    const list = await listDevelopers(PRIMARY_TENANT, {
      limit: 10,
      offset: 0,
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });

    const tenants = Array.from(
      new Set(list.developers.map((dev) => dev.tenantId))
    ).sort();
    expect(tenants).toEqual([PRIMARY_TENANT]);

    const ids = list.developers.map((dev) => dev.developerId);
    expect(ids).toContain(primary.developerId);
    expect(ids).not.toContain(other.developerId);
  });
});
