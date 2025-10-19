import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { runWithTenantContext, createTenantContextRunner } from './tenant-context.js';
import { runInTenant } from '../../db/tenant-test-utils.js';
import * as schema from '../../db/schema/index.js';

const TENANT = 'test-middleware-tenant';

describe('Tenant Context Middleware Helpers', () => {
  it('validates tenant id input', async () => {
    await expect(runWithTenantContext('', async () => Promise.resolve()))
      .rejects.toThrow('Tenant ID cannot be empty');

    await expect(() => createTenantContextRunner('invalid tenant'))
      .toThrow('Tenant ID contains invalid characters');
  });

  it('executes callback within tenant context', async () => {
    const result = await runWithTenantContext(TENANT, async (tx) => {
      await tx.insert(schema.tenants).values({
        tenantId: TENANT,
        name: 'Middleware Tenant',
        plan: 'OSS',
      }).onConflictDoNothing();

      const tenants = await tx
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.tenantId, TENANT));

      return tenants.length;
    });

    expect(result).toBeGreaterThan(0);
  });

  it('provides reusable runner', async () => {
    const runner = createTenantContextRunner(TENANT);

    const orgIdOne = crypto.randomUUID();
    const orgIdTwo = crypto.randomUUID();

    await runner(async (tx) => {
      await tx.insert(schema.organizations).values({
        orgId: orgIdOne,
        tenantId: TENANT,
        name: 'Runner Org A',
        domainPrimary: null,
        attributes: null,
      });
    });

    await runner(async (tx) => {
      await tx.insert(schema.organizations).values({
        orgId: orgIdTwo,
        tenantId: TENANT,
        name: 'Runner Org B',
        domainPrimary: null,
        attributes: null,
      });
    });

    const organizations = await runInTenant(TENANT, async (tx) => {
      return await tx
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.tenantId, TENANT));
    });

    expect(organizations.map((org) => org.orgId)).toContain(orgIdOne);
    expect(organizations.map((org) => org.orgId)).toContain(orgIdTwo);
  });
});
