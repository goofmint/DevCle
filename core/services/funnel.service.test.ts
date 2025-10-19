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
import { createDeveloper, deleteDeveloper } from './drm.service.js';
import { createActivity } from './activity.service.js';
import {
  classifyStage,
  getFunnelStats,
  getFunnelDropRates,
  FunnelStageKey,
} from './funnel.service.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { closeDb } from '../db/connection.js';

const TEST_TENANT = 'test-funnel-service';
const ACTION_MAP: Record<string, string> = {
  click: FunnelStageKey.AWARENESS,
  attend: FunnelStageKey.ENGAGEMENT,
  signup: FunnelStageKey.ADOPTION,
  post: FunnelStageKey.ADVOCACY,
};

async function seedFunnelMappings() {
  await runInTenant(TEST_TENANT, async (tx) => {
    for (const [action, stage] of Object.entries(ACTION_MAP)) {
      await tx
        .insert(schema.activityFunnelMap)
        .values({
          tenantId: TEST_TENANT,
          action,
          stageKey: stage,
        })
        .onConflictDoNothing();
    }
  });
}

async function clearFunnelData() {
  await runInTenant(TEST_TENANT, async (tx) => {
    await tx.delete(schema.activityCampaigns).where(eq(schema.activityCampaigns.tenantId, TEST_TENANT));
    await tx.delete(schema.activities).where(eq(schema.activities.tenantId, TEST_TENANT));
    await tx.delete(schema.activityFunnelMap).where(eq(schema.activityFunnelMap.tenantId, TEST_TENANT));
  });
}

describe('funnel.service', () => {
  const developers: string[] = [];

  beforeEach(async () => {
    await ensureTenantExists(TEST_TENANT);
    await clearFunnelData();
    developers.splice(0);
  });

  afterEach(async () => {
    await clearFunnelData();
    for (const developerId of developers.splice(0)) {
      await deleteDeveloper(TEST_TENANT, developerId);
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  it('classifies activities into stages', async () => {
    await seedFunnelMappings();
    const developer = await createDeveloper(TEST_TENANT, {
      displayName: 'Funnel Dev',
      primaryEmail: 'funnel-dev@example.com',
      orgId: null,
    });
    developers.push(developer.developerId);

    const activity = await createActivity(TEST_TENANT, {
      developerId: developer.developerId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-01-01T00:00:00Z'),
    });

    const classified = await classifyStage(TEST_TENANT, activity.activityId);
    expect(classified?.stageKey).toBe(FunnelStageKey.AWARENESS);
  });

  it('returns aggregated funnel stats per stage', async () => {
    await seedFunnelMappings();
    const developer = await createDeveloper(TEST_TENANT, {
      displayName: 'Stats Dev',
      primaryEmail: 'stats@example.com',
      orgId: null,
    });
    developers.push(developer.developerId);

    await createActivity(TEST_TENANT, {
      developerId: developer.developerId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-01-01T00:00:00Z'),
    });
    await createActivity(TEST_TENANT, {
      developerId: developer.developerId,
      action: 'attend',
      source: 'event',
      occurredAt: new Date('2025-01-02T00:00:00Z'),
    });

    const stats = await getFunnelStats(TEST_TENANT);
    const awareness = stats.stages.find(
      (stage) => stage.stageKey === FunnelStageKey.AWARENESS
    );
    const engagement = stats.stages.find(
      (stage) => stage.stageKey === FunnelStageKey.ENGAGEMENT
    );

    expect(awareness?.uniqueDevelopers).toBe(1);
    expect(engagement?.uniqueDevelopers).toBe(1);
  });

  it('calculates drop rates between stages', async () => {
    await seedFunnelMappings();
    const developer = await createDeveloper(TEST_TENANT, {
      displayName: 'DropRate Dev',
      primaryEmail: 'drop@example.com',
      orgId: null,
    });
    developers.push(developer.developerId);

    await createActivity(TEST_TENANT, {
      developerId: developer.developerId,
      action: 'click',
      source: 'web',
      occurredAt: new Date('2025-01-01T00:00:00Z'),
    });
    await createActivity(TEST_TENANT, {
      developerId: developer.developerId,
      action: 'attend',
      source: 'event',
      occurredAt: new Date('2025-01-02T00:00:00Z'),
    });
    await createActivity(TEST_TENANT, {
      developerId: developer.developerId,
      action: 'signup',
      source: 'app',
      occurredAt: new Date('2025-01-03T00:00:00Z'),
    });

    const dropRates = await getFunnelDropRates(TEST_TENANT);
    const adoption = dropRates.stages.find(
      (stage) => stage.stageKey === FunnelStageKey.ADOPTION
    );

    expect(adoption?.previousStageCount).toBe(1);
    expect(adoption?.dropRate).toBe(0);
  });
});
