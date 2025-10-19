import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { closeDb } from '../db/connection.js';
import { runInTenant, ensureTenantExists } from '../db/tenant-test-utils.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import {
  createDeveloper,
  deleteDeveloper,
  getDeveloper,
} from './drm.service.js';
import {
  createCampaign,
  listCampaigns,
  deleteCampaign,
  type ListCampaignsInput,
} from './campaign.service.js';
import {
  createActivity,
  listActivities,
  deleteActivity,
} from './activity.service.js';

const PRIMARY_TENANT = 'test-primary-tenant';
const SECONDARY_TENANT = 'test-secondary-tenant';

describe('Service tenant isolation', () => {
  beforeEach(async () => {
    await ensureTenantExists(PRIMARY_TENANT);
    await ensureTenantExists(SECONDARY_TENANT);

    await runInTenant(PRIMARY_TENANT, async (tx) => {
      await tx.delete(schema.activities).where(eq(schema.activities.tenantId, PRIMARY_TENANT));
      await tx.delete(schema.campaigns).where(eq(schema.campaigns.tenantId, PRIMARY_TENANT));
      await tx.delete(schema.developers).where(eq(schema.developers.tenantId, PRIMARY_TENANT));
    });

    await runInTenant(SECONDARY_TENANT, async (tx) => {
      await tx.delete(schema.activities).where(eq(schema.activities.tenantId, SECONDARY_TENANT));
      await tx.delete(schema.campaigns).where(eq(schema.campaigns.tenantId, SECONDARY_TENANT));
      await tx.delete(schema.developers).where(eq(schema.developers.tenantId, SECONDARY_TENANT));
    });
  });

  afterAll(async () => {
    await closeDb();
  });

  it('manages developers per tenant', async () => {
    const developer = await createDeveloper(PRIMARY_TENANT, {
      displayName: 'Tenant Dev',
      primaryEmail: 'tenant-dev@example.com',
      orgId: null,
    });

    const fetched = await getDeveloper(PRIMARY_TENANT, developer.developerId);
    expect(fetched).not.toBeNull();
    expect(fetched?.tenantId).toBe(PRIMARY_TENANT);

    const otherTenantResult = await getDeveloper(SECONDARY_TENANT, developer.developerId);
    expect(otherTenantResult).toBeNull();

    await deleteDeveloper(PRIMARY_TENANT, developer.developerId);
  });

  it('lists campaigns without leaking between tenants', async () => {
    const primaryCampaign = await createCampaign(PRIMARY_TENANT, {
      name: 'Primary Campaign',
      channel: 'web',
      startDate: null,
      endDate: null,
      budgetTotal: null,
      attributes: {},
    });

    await createCampaign(SECONDARY_TENANT, {
      name: 'Secondary Campaign',
      channel: 'events',
      startDate: null,
      endDate: null,
      budgetTotal: null,
      attributes: {},
    });

    const params: ListCampaignsInput = {};
    const primaryList = await listCampaigns(PRIMARY_TENANT, params);

    expect(primaryList.total).toBe(1);
    expect(primaryList.campaigns[0]?.campaignId).toBe(primaryCampaign.campaignId);

    await deleteCampaign(PRIMARY_TENANT, primaryCampaign.campaignId);
  });

  it('isolates activities per tenant', async () => {
    const primaryDev = await createDeveloper(PRIMARY_TENANT, {
      displayName: 'Primary Activity Dev',
      primaryEmail: 'primary-activity@example.com',
      orgId: null,
    });

    const secondaryDev = await createDeveloper(SECONDARY_TENANT, {
      displayName: 'Secondary Activity Dev',
      primaryEmail: 'secondary-activity@example.com',
      orgId: null,
    });

    const primaryActivity = await createActivity(PRIMARY_TENANT, {
      developerId: primaryDev.developerId,
      action: 'view',
      occurredAt: new Date(),
      source: 'web',
    });

    await createActivity(SECONDARY_TENANT, {
      developerId: secondaryDev.developerId,
      action: 'click',
      occurredAt: new Date(),
      source: 'web',
    });

    const primaryActivities = await listActivities(PRIMARY_TENANT, {
      developerId: primaryDev.developerId,
      limit: 10,
      offset: 0,
      orderBy: 'occurred_at',
      orderDirection: 'desc',
    });

    expect(primaryActivities.total).toBe(1);
    expect(primaryActivities.activities[0]?.activityId).toBe(primaryActivity.activityId);

    await deleteActivity(PRIMARY_TENANT, primaryActivity.activityId);
    await deleteDeveloper(PRIMARY_TENANT, primaryDev.developerId);
    await deleteDeveloper(SECONDARY_TENANT, secondaryDev.developerId);
  });
});
