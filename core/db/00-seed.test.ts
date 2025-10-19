import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { runInTenant } from './tenant-test-utils.js';
import { closeDb } from './connection.js';
import * as schema from './schema/index.js';
import { eq } from 'drizzle-orm';

const TENANT = 'default';

describe('Database seed script', () => {
  beforeAll(async () => {
    execSync('tsx db/seed.ts', {
      cwd: '/app',
      stdio: 'inherit',
      env: process.env,
    });
  });

  afterAll(async () => {
    await closeDb();
  });

  it('creates default tenant and user records', async () => {
    const tenants = await runInTenant(TENANT, async (tx) => {
      return await tx
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.tenantId, TENANT));
    });

    expect(tenants.length).toBeGreaterThan(0);

    const users = await runInTenant(TENANT, async (tx) => {
      return await tx
        .select()
        .from(schema.users)
        .where(eq(schema.users.tenantId, TENANT));
    });

    expect(users.length).toBeGreaterThan(0);
  });

  it('populates developers and activities for default tenant', async () => {
    const developers = await runInTenant(TENANT, async (tx) => {
      return await tx
        .select()
        .from(schema.developers)
        .where(eq(schema.developers.tenantId, TENANT));
    });

    expect(developers.length).toBeGreaterThan(0);

    const activities = await runInTenant(TENANT, async (tx) => {
      return await tx
        .select()
        .from(schema.activities)
        .where(eq(schema.activities.tenantId, TENANT));
    });

    expect(activities.length).toBeGreaterThan(0);
  });
});
