/**
 * Database Seeding Script
 *
 * This script populates the database with initial test data for development and testing.
 * It creates:
 * - Default tenant (tenant_id = 'default')
 * - Test users for dashboard login (2: admin and member)
 * - Sample plugins (3)
 * - Sample organizations (3)
 * - Sample developers (5)
 * - Sample accounts (4)
 * - Sample campaigns (3)
 * - Sample resources (3)
 * - Sample activities (10)
 * - Funnel stage master data (4 stages) - REQUIRED
 * - Activity funnel mappings (11 mappings)
 *
 * Key Features:
 * - Idempotent: Can be run multiple times without errors
 * - Uses .onConflictDoNothing() to skip existing records
 * - Proper UUID generation for all IDs
 * - bcrypt password hashing for users
 * - Comprehensive error handling
 * - Production environment protection
 *
 * Usage:
 * ```bash
 * pnpm db:seed
 * ```
 *
 * Testing:
 * - Run twice to verify idempotency: `pnpm db:seed && pnpm db:seed`
 * - Check data: docker-compose exec postgres psql -U devcle -d devcle -c "SELECT * FROM developers;"
 */

import * as bcrypt from 'bcrypt';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb, getSql, testConnection } from './connection.js';
import * as schema from './schema/index.js';

// ============================================================================
// Environment Variable Loading
// ============================================================================

/**
 * Load environment variables from .env or .env.test
 * If NODE_ENV=test, use .env.test, otherwise use .env
 */
try {
  const isTestEnv = process.env['NODE_ENV'] === 'test';
  const envFileName = isTestEnv ? '.env.test' : '.env';
  // seed.ts is in /workspace/core/db/, so go up 2 levels to /workspace/
  const envPath = resolve(import.meta.dirname || __dirname, '..', '..', envFileName);
  const envFile = readFileSync(envPath, 'utf-8');

  envFile.split('\n').forEach(line => {
    if (line.trim() === '' || line.trim().startsWith('#')) {
      return;
    }
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      // Only set if not already set (allow environment to override)
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
  console.log(`✓ Loaded ${envFileName} for seeding`);
} catch (error) {
  console.warn('Warning: Could not load .env file for seeding:', error);
}

// ============================================================================
// Environment Protection
// ============================================================================

/**
 * Prevent running seeds in production environment
 * This is a safety measure to avoid accidentally polluting production data
 */
if (process.env['NODE_ENV'] === 'production') {
  console.error('❌ Cannot run seed in production environment');
  process.exit(1);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate UUID v4
 *
 * Uses crypto.randomUUID() for secure UUID generation.
 * This is available in Node.js 16+ and is faster than libraries.
 *
 * @returns {string} UUID v4 string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Hash password using bcrypt
 *
 * Generates a bcrypt hash with salt rounds = 10.
 * This provides good security while maintaining reasonable performance.
 *
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Bcrypt hash (e.g., "$2b$10$...")
 */
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// ============================================================================
// Seed Data Functions
// ============================================================================

/**
 * Seed default tenant
 *
 * Creates the default tenant for OSS single-tenant deployment.
 * In OSS mode, all data belongs to this tenant.
 *
 * Data:
 * - tenant_id: 'default'
 * - name: 'Default Tenant'
 * - plan: 'OSS'
 */
async function seedTenant(): Promise<void> {
  const db = getDb();

  console.log('  📋 Seeding tenant...');

  // Insert default tenant
  // Uses onConflictDoNothing() for idempotency (skip if already exists)
  try {
    const result = await db
      .insert(schema.tenants)
      .values({
        tenantId: 'default',
        name: 'Default Tenant',
        plan: 'OSS',
      })
      .onConflictDoNothing()
      .returning();

    console.log('    ✅ Tenant seeded:', result.length > 0 ? 'inserted' : 'skipped (exists)');
  } catch (error) {
    console.error('    ❌ Failed to seed tenant:', error);
    throw error;
  }
}

/**
 * Seed test users
 *
 * Creates test users for dashboard login in development.
 * Passwords are hashed using bcrypt for security.
 *
 * Login credentials:
 * - Admin: admin@example.com / admin123456 (role: admin)
 * - Member: test@example.com / password123 (role: member)
 *
 * @returns {Promise<Record<string, string>>} Map of user types to UUIDs
 */
async function seedUsers(): Promise<Record<string, string>> {
  const db = getDb();

  console.log('  👤 Seeding users...');

  // Generate password hashes
  // This takes ~100ms per hash due to bcrypt's intentional slowness (security feature)
  const memberPasswordHash = await hashPassword('password123');
  const adminPasswordHash = await hashPassword('admin123456');

  const memberId = generateUUID();
  const adminId = generateUUID();

  // Insert test users (member and admin)
  await db
    .insert(schema.users)
    .values([
      {
        userId: memberId,
        tenantId: 'default',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: memberPasswordHash,
        authProvider: 'password',
        role: 'member',
        disabled: false,
      },
      {
        userId: adminId,
        tenantId: 'default',
        email: 'admin@example.com',
        displayName: 'Admin User',
        passwordHash: adminPasswordHash,
        authProvider: 'password',
        role: 'admin',
        disabled: false,
      },
    ])
    .onConflictDoNothing();

  console.log('    ✅ Users seeded:');
  console.log('       - test@example.com / password123 (member)');
  console.log('       - admin@example.com / admin123456 (admin)');

  return { member: memberId, admin: adminId };
}

/**
 * Seed sample organizations
 *
 * Creates 3 test organizations representing different types:
 * 1. Acme Corporation - Large SaaS company with domain
 * 2. DevRel Community - Community without domain
 * 3. Startup Labs - Small consulting company with domain
 *
 * @returns {Promise<Record<string, string>>} Map of organization names to UUIDs
 */
async function seedOrganizations(): Promise<Record<string, string>> {
  const db = getDb();

  console.log('  🏢 Seeding organizations...');

  // Fixed UUIDs for idempotency - same IDs used on every seed run
  const acmeId = '20000000-0000-4000-8000-000000000001';
  const communityId = '20000000-0000-4000-8000-000000000002';
  const startupId = '20000000-0000-4000-8000-000000000003';

  // Insert 3 organizations with different characteristics
  await db
    .insert(schema.organizations)
    .values([
      {
        orgId: acmeId,
        tenantId: 'default',
        name: 'Acme Corporation',
        domainPrimary: 'acme.com',
        attributes: { industry: 'SaaS', size: 'large' },
      },
      {
        orgId: communityId,
        tenantId: 'default',
        name: 'DevRel Community',
        domainPrimary: null,
        attributes: { type: 'community' },
      },
      {
        orgId: startupId,
        tenantId: 'default',
        name: 'Startup Labs',
        domainPrimary: 'startup-labs.io',
        attributes: { industry: 'consulting', size: 'small' },
      },
    ])
    .onConflictDoNothing();

  console.log('    ✅ Organizations seeded (3)');

  // Return map for use in developer seeding
  return {
    acme: acmeId,
    community: communityId,
    startup: startupId,
  };
}

/**
 * Seed sample developers
 *
 * Creates 6 test developers with different characteristics:
 * - Alice: Frontend developer at Acme (email + org)
 * - Bob: Backend developer at Startup Labs (email + org)
 * - Charlie: DevOps developer without email/org (unresolved case)
 * - Diana: Community member (email + org)
 * - Eve: Fullstack developer at Acme (email + org)
 * - Test Webhook Developer: Test developer for E2E webhook tests
 *
 * @param {Record<string, string>} orgIds - Map of organization names to UUIDs
 * @returns {Promise<Record<string, string>>} Map of developer names to UUIDs
 */
async function seedDevelopers(
  orgIds: Record<string, string>
): Promise<Record<string, string>> {
  const db = getDb();

  console.log('  👨‍💻 Seeding developers...');

  // Fixed UUIDs for idempotency - same IDs used on every seed run
  const aliceId = '30000000-0000-4000-8000-000000000001';
  const bobId = '30000000-0000-4000-8000-000000000002';
  const charlieId = '30000000-0000-4000-8000-000000000003';
  const dianaId = '30000000-0000-4000-8000-000000000004';
  const eveId = '30000000-0000-4000-8000-000000000005';
  const testWebhookId = '123e4567-e89b-12d3-a456-426614174000'; // For E2E test

  // Insert 6 developers with different profiles
  await db
    .insert(schema.developers)
    .values([
      {
        developerId: aliceId,
        tenantId: 'default',
        displayName: 'Alice Anderson',
        primaryEmail: 'alice@acme.com',
        orgId: orgIds['acme']!,
        consentAnalytics: true,
        tags: ['frontend', 'react'],
      },
      {
        developerId: bobId,
        tenantId: 'default',
        displayName: 'Bob Brown',
        primaryEmail: 'bob@startup-labs.io',
        orgId: orgIds['startup']!,
        consentAnalytics: true,
        tags: ['backend', 'nodejs'],
      },
      {
        developerId: charlieId,
        tenantId: 'default',
        displayName: 'Charlie Chen',
        primaryEmail: null, // Unresolved email case
        orgId: null, // No organization
        consentAnalytics: false,
        tags: ['devops'],
      },
      {
        developerId: dianaId,
        tenantId: 'default',
        displayName: 'Diana Davis',
        primaryEmail: 'diana@community.dev',
        orgId: orgIds['community']!,
        consentAnalytics: true,
        tags: ['community'],
      },
      {
        developerId: eveId,
        tenantId: 'default',
        displayName: 'Eve Evans',
        primaryEmail: 'eve@acme.com',
        orgId: orgIds['acme']!,
        consentAnalytics: true,
        tags: ['fullstack', 'typescript'],
      },
      {
        developerId: testWebhookId,
        tenantId: 'default',
        displayName: 'Test Webhook Developer',
        primaryEmail: 'webhook-test@example.com',
        orgId: null,
        consentAnalytics: true,
        tags: ['test', 'webhook'],
      },
    ])
    .onConflictDoNothing();

  console.log('    ✅ Developers seeded (6)');

  // Return map for use in account/activity seeding
  return {
    alice: aliceId,
    bob: bobId,
    charlie: charlieId,
    diana: dianaId,
    eve: eveId,
  };
}

/**
 * Seed sample accounts
 *
 * Creates external service accounts linked to developers:
 * - Alice: GitHub (primary) + Slack accounts
 * - Bob: GitHub account
 * - Unlinked: X account (not yet linked to Charlie)
 *
 * This demonstrates both linked and unlinked account scenarios.
 *
 * @param {Record<string, string>} devIds - Map of developer names to UUIDs
 * @returns {Promise<Record<string, string>>} Map of account identifiers to UUIDs
 */
async function seedAccounts(
  devIds: Record<string, string>
): Promise<Record<string, string>> {
  const db = getDb();

  console.log('  🔗 Seeding accounts...');

  // Fixed UUIDs for idempotency - same IDs used on every seed run
  const aliceGithubId = '40000000-0000-4000-8000-000000000001';
  const aliceSlackId = '40000000-0000-4000-8000-000000000002';
  const bobGithubId = '40000000-0000-4000-8000-000000000003';
  const charlieXId = '40000000-0000-4000-8000-000000000004';

  // Insert 4 accounts (2 for Alice, 1 for Bob, 1 unlinked)
  await db
    .insert(schema.accounts)
    .values([
      {
        accountId: aliceGithubId,
        tenantId: 'default',
        developerId: devIds['alice']!,
        provider: 'github',
        externalUserId: 'alice-gh',
        handle: 'alice',
        email: 'alice@acme.com',
        profileUrl: 'https://github.com/alice',
        avatarUrl: null,
        isPrimary: true,
        confidence: '1.0',
        attributes: null,
        dedupKey: null,
      },
      {
        accountId: aliceSlackId,
        tenantId: 'default',
        developerId: devIds['alice']!,
        provider: 'slack',
        externalUserId: 'U01ALICE',
        handle: 'alice',
        email: 'alice@acme.com',
        profileUrl: null,
        avatarUrl: null,
        isPrimary: false,
        confidence: '0.95',
        attributes: null,
        dedupKey: null,
      },
      {
        accountId: bobGithubId,
        tenantId: 'default',
        developerId: devIds['bob']!,
        provider: 'github',
        externalUserId: 'bob-gh',
        handle: 'bob_brown',
        email: 'bob@startup-labs.io',
        profileUrl: 'https://github.com/bob_brown',
        avatarUrl: null,
        isPrimary: true,
        confidence: '1.0',
        attributes: null,
        dedupKey: null,
      },
      {
        accountId: charlieXId,
        tenantId: 'default',
        developerId: null, // Unlinked account (not yet resolved)
        provider: 'x',
        externalUserId: 'charlie_x',
        handle: 'charlie',
        email: null,
        profileUrl: null,
        avatarUrl: null,
        isPrimary: false,
        confidence: '0.5',
        attributes: null,
        dedupKey: null,
      },
    ])
    .onConflictDoNothing();

  console.log('    ✅ Accounts seeded (4)');

  // Return map for use in activity seeding
  return {
    aliceGithub: aliceGithubId,
    aliceSlack: aliceSlackId,
    bobGithub: bobGithubId,
    charlieX: charlieXId,
  };
}

/**
 * Seed sample campaigns
 *
 * Creates 3 test campaigns representing different types:
 * 1. DevRel Meetup 2025 - Event with full budget
 * 2. Blog Content Series - Content marketing with budget
 * 3. GitHub Sponsor Campaign - Community without budget
 *
 * @returns {Promise<Record<string, string>>} Map of campaign names to UUIDs
 */
async function seedCampaigns(): Promise<Record<string, string>> {
  const db = getDb();

  console.log('  📊 Seeding campaigns...');

  // Fixed UUIDs for idempotency - same IDs used on every seed run
  // This ensures that .onConflictDoNothing() works correctly and
  // the returned IDs match the actual database records
  const meetupId = '10000000-0000-4000-8000-000000000001';
  const blogId = '10000000-0000-4000-8000-000000000002';
  const sponsorId = '10000000-0000-4000-8000-000000000003';

  // Insert 3 campaigns with different characteristics
  await db
    .insert(schema.campaigns)
    .values([
      {
        campaignId: meetupId,
        tenantId: 'default',
        name: 'DevRel Meetup 2025',
        channel: 'event',
        startDate: '2025-11-01',
        endDate: '2025-11-30',
        budgetTotal: '500000',
        attributes: { location: 'Tokyo', format: 'hybrid' },
      },
      {
        campaignId: blogId,
        tenantId: 'default',
        name: 'Blog Content Series',
        channel: 'content',
        startDate: '2025-10-01',
        endDate: '2025-12-31',
        budgetTotal: '100000',
        attributes: { medium: 'blog', topics: ['typescript', 'remix'] },
      },
      {
        campaignId: sponsorId,
        tenantId: 'default',
        name: 'GitHub Sponsor Campaign',
        channel: 'community',
        startDate: '2025-09-01',
        endDate: null,
        budgetTotal: null,
        attributes: { platform: 'github' },
      },
    ])
    .onConflictDoNothing();

  console.log('    ✅ Campaigns seeded (3)');

  // Return map for use in resource seeding
  return {
    meetup: meetupId,
    blog: blogId,
    sponsor: sponsorId,
  };
}

/**
 * Seed sample resources
 *
 * Creates 3 test resources linked to campaigns:
 * 1. Event session (connpass)
 * 2. Blog post
 * 3. GitHub repository
 *
 * @param {Record<string, string>} campaignIds - Map of campaign names to UUIDs
 * @returns {Promise<Record<string, string>>} Map of resource types to UUIDs
 */
async function seedResources(
  campaignIds: Record<string, string>
): Promise<Record<string, string>> {
  const db = getDb();

  console.log('  📦 Seeding resources...');

  // Fixed UUIDs for idempotency - same IDs used on every seed run
  const eventId = '50000000-0000-4000-8000-000000000001';
  const blogPostId = '50000000-0000-4000-8000-000000000002';
  const repoId = '50000000-0000-4000-8000-000000000003';

  // Insert 3 resources with different categories
  await db
    .insert(schema.resources)
    .values([
      {
        resourceId: eventId,
        tenantId: 'default',
        category: 'event',
        groupKey: 'devrel-meetup-2025',
        title: 'DevRel Meetup 2025 - Session 1',
        url: 'https://connpass.com/event/12345',
        externalId: 'connpass-12345',
        campaignId: campaignIds['meetup']!,
        attributes: { capacity: 100, venue: 'Tokyo Office' },
      },
      {
        resourceId: blogPostId,
        tenantId: 'default',
        category: 'blog',
        groupKey: 'blog-series',
        title: 'Getting Started with Remix',
        url: 'https://blog.example.com/remix-intro',
        externalId: null,
        campaignId: campaignIds['blog']!,
        attributes: { author: 'Alice', language: 'en' },
      },
      {
        resourceId: repoId,
        tenantId: 'default',
        category: 'repo',
        groupKey: null,
        title: 'DRM Core Repository',
        url: 'https://github.com/example/drm-core',
        externalId: 'github-drm-core',
        campaignId: campaignIds['sponsor']!,
        attributes: { stars: 120, language: 'typescript' },
      },
    ])
    .onConflictDoNothing();

  console.log('    ✅ Resources seeded (3)');

  // Return map for use in activity seeding
  return {
    event: eventId,
    blogPost: blogPostId,
    repo: repoId,
  };
}

/**
 * Seed sample budgets
 *
 * Creates budget entries for campaigns to demonstrate cost tracking.
 * - Meetup campaign: venue, catering, materials (total: 500,000 JPY)
 * - Blog campaign: writer fees, ads (total: 100,000 JPY)
 * - Sponsor campaign: no budget (community-driven)
 *
 * @param {Record<string, string>} campaignIds - Map of campaign names to UUIDs
 */
async function seedBudgets(
  campaignIds: Record<string, string>
): Promise<void> {
  const db = getDb();

  console.log('  💰 Seeding budgets...');

  // Fixed UUIDs for idempotency
  const budgetIds = [
    '60000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000004',
    '60000000-0000-4000-8000-000000000005',
    '60000000-0000-4000-8000-000000000006',
  ];

  await db
    .insert(schema.budgets)
    .values([
      // DevRel Meetup 2025 budgets (total: 500,000 JPY)
      {
        budgetId: budgetIds[0],
        tenantId: 'default',
        campaignId: campaignIds['meetup']!,
        category: 'venue',
        amount: '200000',
        currency: 'JPY',
        spentAt: '2025-10-15',
        source: 'company_budget',
        memo: 'Event venue rental for DevRel Meetup 2025',
      },
      {
        budgetId: budgetIds[1],
        tenantId: 'default',
        campaignId: campaignIds['meetup']!,
        category: 'catering',
        amount: '150000',
        currency: 'JPY',
        spentAt: '2025-10-20',
        source: 'company_budget',
        memo: 'Food and drinks for attendees',
      },
      {
        budgetId: budgetIds[2],
        tenantId: 'default',
        campaignId: campaignIds['meetup']!,
        category: 'material',
        amount: '150000',
        currency: 'JPY',
        spentAt: '2025-10-25',
        source: 'company_budget',
        memo: 'Swag, name tags, and promotional materials',
      },
      // Blog Content Series budgets (total: 100,000 JPY)
      {
        budgetId: budgetIds[3],
        tenantId: 'default',
        campaignId: campaignIds['blog']!,
        category: 'labor',
        amount: '60000',
        currency: 'JPY',
        spentAt: '2025-10-05',
        source: 'marketing_budget',
        memo: 'Technical writer fee for blog series',
      },
      {
        budgetId: budgetIds[4],
        tenantId: 'default',
        campaignId: campaignIds['blog']!,
        category: 'ads',
        amount: '40000',
        currency: 'JPY',
        spentAt: '2025-10-10',
        source: 'marketing_budget',
        memo: 'Social media promotion for blog posts',
      },
      // Sponsor campaign has no budget entries (community-driven)
    ])
    .onConflictDoNothing();

  console.log('    ✅ Budgets seeded (5)');
}

/**
 * Seed sample activities
 *
 * Creates 10 test activity records demonstrating different scenarios:
 * - GitHub star (authenticated)
 * - Blog view (authenticated via GA)
 * - Shortlink click (anonymous)
 * - Event attendance
 * - GitHub comment
 * - Blog share
 * - Repository fork
 * - Event signup
 * - API call
 * - Repository contribution
 *
 * @param {Record<string, string>} devIds - Developer UUIDs
 * @param {Record<string, string>} accountIds - Account UUIDs
 * @param {Record<string, string>} resourceIds - Resource UUIDs
 */
async function seedActivities(
  devIds: Record<string, string>,
  accountIds: Record<string, string>,
  resourceIds: Record<string, string>
): Promise<void> {
  const db = getDb();

  console.log('  🎬 Seeding activities...');

  // Insert 10 activities with different types and scenarios
  await db
    .insert(schema.activities)
    .values([
      // 1. GitHub star (Alice, authenticated)
      {
        activityId: generateUUID(),
        tenantId: 'default',
        developerId: devIds['alice']!,
        accountId: accountIds['aliceGithub']!,
        anonId: null,
        resourceId: resourceIds['repo']!,
        action: 'star',
        occurredAt: new Date('2025-10-01T10:00:00Z'),
        source: 'github',
        sourceRef: 'github-event-123',
        category: 'repo',
        groupKey: null,
        metadata: { device: 'desktop', country: 'JP' },
        confidence: '1.0',
        dedupKey: null,
      },
      // 2. Blog view (Bob, authenticated via GA)
      {
        activityId: generateUUID(),
        tenantId: 'default',
        developerId: devIds['bob']!,
        accountId: accountIds['bobGithub']!,
        anonId: null,
        resourceId: resourceIds['blogPost']!,
        action: 'view',
        occurredAt: new Date('2025-10-02T14:30:00Z'),
        source: 'ga',
        sourceRef: 'ga-event-456',
        category: 'blog',
        groupKey: 'blog-series',
        metadata: { referrer: 'https://twitter.com', duration: 120 },
        confidence: '0.9',
        dedupKey: null,
      },
      // 3. Shortlink click (anonymous)
      {
        activityId: generateUUID(),
        tenantId: 'default',
        developerId: null,
        accountId: null,
        anonId: 'click_abc123',
        resourceId: resourceIds['event']!,
        action: 'click',
        occurredAt: new Date('2025-10-03T09:15:00Z'),
        source: 'shortlink',
        sourceRef: 'shortlink-abc123',
        category: 'event',
        groupKey: 'devrel-meetup-2025',
        metadata: { utm_source: 'twitter', utm_medium: 'social' },
        confidence: '0.5',
        dedupKey: null,
      },
      // 4. Event attendance (Diana)
      {
        activityId: generateUUID(),
        tenantId: 'default',
        developerId: devIds['diana']!,
        accountId: null,
        anonId: null,
        resourceId: resourceIds['event']!,
        action: 'attend',
        occurredAt: new Date('2025-10-04T18:00:00Z'),
        source: 'connpass',
        sourceRef: 'connpass-attend-789',
        category: 'event',
        groupKey: 'devrel-meetup-2025',
        metadata: { checkin_time: '18:05' },
        confidence: '1.0',
        dedupKey: null,
      },
      // 5. GitHub comment (Eve)
      {
        activityId: generateUUID(),
        tenantId: 'default',
        developerId: devIds['eve']!,
        accountId: accountIds['aliceGithub']!, // Note: Using Alice's GitHub as Eve's is not seeded
        anonId: null,
        resourceId: resourceIds['repo']!,
        action: 'comment',
        occurredAt: new Date('2025-10-05T11:20:00Z'),
        source: 'github',
        sourceRef: 'github-comment-101',
        category: 'repo',
        groupKey: null,
        metadata: { comment_type: 'issue' },
        confidence: '1.0',
        dedupKey: null,
      },
      // 6. Blog share (Alice)
      {
        activityId: generateUUID(),
        tenantId: 'default',
        developerId: devIds['alice']!,
        accountId: accountIds['aliceSlack']!,
        anonId: null,
        resourceId: resourceIds['blogPost']!,
        action: 'share',
        occurredAt: new Date('2025-10-06T15:45:00Z'),
        source: 'slack',
        sourceRef: 'slack-share-202',
        category: 'blog',
        groupKey: 'blog-series',
        metadata: { channel: 'engineering' },
        confidence: '0.95',
        dedupKey: null,
      },
      // 7. Repository fork (Bob)
      {
        activityId: generateUUID(),
        tenantId: 'default',
        developerId: devIds['bob']!,
        accountId: accountIds['bobGithub']!,
        anonId: null,
        resourceId: resourceIds['repo']!,
        action: 'contribute',
        occurredAt: new Date('2025-10-07T09:30:00Z'),
        source: 'github',
        sourceRef: 'github-fork-303',
        category: 'repo',
        groupKey: null,
        metadata: { fork_name: 'bob_brown/drm-core' },
        confidence: '1.0',
        dedupKey: null,
      },
      // 8. Event signup (anonymous -> later linked)
      {
        activityId: generateUUID(),
        tenantId: 'default',
        developerId: null,
        accountId: null,
        anonId: 'click_def456',
        resourceId: resourceIds['event']!,
        action: 'signup',
        occurredAt: new Date('2025-10-08T12:00:00Z'),
        source: 'form',
        sourceRef: 'form-signup-404',
        category: 'event',
        groupKey: 'devrel-meetup-2025',
        metadata: { email_provided: 'pending-verification' },
        confidence: '0.7',
        dedupKey: null,
      },
      // 9. API call (Alice)
      {
        activityId: generateUUID(),
        tenantId: 'default',
        developerId: devIds['alice']!,
        accountId: null,
        anonId: null,
        resourceId: null,
        action: 'api_call',
        occurredAt: new Date('2025-10-09T10:15:00Z'),
        source: 'api',
        sourceRef: 'api-call-505',
        category: null,
        groupKey: null,
        metadata: { endpoint: '/api/developers', method: 'GET' },
        confidence: '1.0',
        dedupKey: null,
      },
      // 10. Repository contribution (Bob)
      {
        activityId: generateUUID(),
        tenantId: 'default',
        developerId: devIds['bob']!,
        accountId: accountIds['bobGithub']!,
        anonId: null,
        resourceId: resourceIds['repo']!,
        action: 'contribute',
        occurredAt: new Date('2025-10-10T16:45:00Z'),
        source: 'github',
        sourceRef: 'github-pr-606',
        category: 'repo',
        groupKey: null,
        metadata: { pr_title: 'Add new feature', lines_changed: 250 },
        confidence: '1.0',
        dedupKey: null,
      },
    ])
    .onConflictDoNothing();

  console.log('    ✅ Activities seeded (10)');
}

/**
 * Seed funnel stages (REQUIRED MASTER DATA)
 *
 * Creates the 4 global funnel stages that are essential for the application.
 * These stages define the developer journey framework:
 * 1. Awareness - First contact with product/community
 * 2. Engagement - Active participation
 * 3. Adoption - Product usage
 * 4. Advocacy - Evangelism and contribution
 *
 * This data MUST exist before the application can function properly.
 *
 * Note: RLS is managed at the seed() function level, not here.
 */
async function seedFunnelStages(): Promise<void> {
  const db = getDb();

  console.log('  🔄 Seeding funnel stages...');

  // Insert 4 funnel stages (global, not tenant-specific)
  await db
    .insert(schema.funnelStages)
    .values([
      {
        stageKey: 'awareness',
        orderNo: 1,
        title: 'Awareness',
      },
      {
        stageKey: 'engagement',
        orderNo: 2,
        title: 'Engagement',
      },
      {
        stageKey: 'adoption',
        orderNo: 3,
        title: 'Adoption',
      },
      {
        stageKey: 'advocacy',
        orderNo: 4,
        title: 'Advocacy',
      },
    ])
    .onConflictDoNothing();

  console.log('    ✅ Funnel stages seeded (4)');
}

/**
 * Seed activity types
 *
 * Creates default activity types for the default tenant.
 * These are the base activity types that can be customized via the settings UI.
 *
 * Default types:
 * - click: Awareness stage (text-blue-600 bg-blue-100 border-blue-200, heroicons:cursor-arrow-rays)
 * - attend: Engagement stage (text-green-600 bg-green-100 border-green-200, heroicons:calendar-days)
 * - signup: Engagement stage (text-purple-600 bg-purple-100 border-purple-200, heroicons:user-plus)
 * - post: Advocacy stage (text-orange-600 bg-orange-100 border-orange-200, heroicons:chat-bubble-left-right)
 * - star: Advocacy stage (text-yellow-600 bg-yellow-100 border-yellow-200, heroicons:star)
 */
async function seedActivityTypes(): Promise<void> {
  const db = getDb();

  console.log('  🎯 Seeding activity types...');

  // Insert 5 default activity types for default tenant
  await db
    .insert(schema.activityTypes)
    .values([
      {
        activityTypeId: generateUUID(),
        tenantId: 'default',
        action: 'click',
        iconName: 'heroicons:cursor-arrow-rays',
        colorClass: 'text-blue-600 bg-blue-100 border-blue-200',
        stageKey: 'awareness',
      },
      {
        activityTypeId: generateUUID(),
        tenantId: 'default',
        action: 'attend',
        iconName: 'heroicons:calendar-days',
        colorClass: 'text-green-600 bg-green-100 border-green-200',
        stageKey: 'engagement',
      },
      {
        activityTypeId: generateUUID(),
        tenantId: 'default',
        action: 'signup',
        iconName: 'heroicons:user-plus',
        colorClass: 'text-purple-600 bg-purple-100 border-purple-200',
        stageKey: 'engagement',
      },
      {
        activityTypeId: generateUUID(),
        tenantId: 'default',
        action: 'post',
        iconName: 'heroicons:chat-bubble-left-right',
        colorClass: 'text-orange-600 bg-orange-100 border-orange-200',
        stageKey: 'advocacy',
      },
      {
        activityTypeId: generateUUID(),
        tenantId: 'default',
        action: 'star',
        iconName: 'heroicons:star',
        colorClass: 'text-yellow-600 bg-yellow-100 border-yellow-200',
        stageKey: 'advocacy',
      },
    ])
    .onConflictDoNothing();

  console.log('    ✅ Activity types seeded (5)');
}

/**
 * Seed activity funnel mappings
 *
 * Creates default mappings from activity actions to funnel stages.
 * This defines which actions belong to which stage of the developer journey.
 *
 * Mappings:
 * - Awareness: view, click
 * - Engagement: attend, comment, post
 * - Adoption: signup, download, api_call
 * - Advocacy: star, share, contribute
 */
async function seedActivityFunnelMaps(): Promise<void> {
  const db = getDb();

  console.log('  🗺️  Seeding activity funnel mappings...');

  // Insert 11 action-to-stage mappings for default tenant
  await db
    .insert(schema.activityFunnelMap)
    .values([
      // Awareness stage
      { tenantId: 'default', action: 'view', stageKey: 'awareness' },
      { tenantId: 'default', action: 'click', stageKey: 'awareness' },

      // Engagement stage
      { tenantId: 'default', action: 'attend', stageKey: 'engagement' },
      { tenantId: 'default', action: 'comment', stageKey: 'engagement' },
      { tenantId: 'default', action: 'post', stageKey: 'engagement' },

      // Adoption stage
      { tenantId: 'default', action: 'signup', stageKey: 'adoption' },
      { tenantId: 'default', action: 'download', stageKey: 'adoption' },
      { tenantId: 'default', action: 'api_call', stageKey: 'adoption' },

      // Advocacy stage
      { tenantId: 'default', action: 'star', stageKey: 'advocacy' },
      { tenantId: 'default', action: 'share', stageKey: 'advocacy' },
      { tenantId: 'default', action: 'contribute', stageKey: 'advocacy' },
    ])
    .onConflictDoNothing();

  console.log('    ✅ Activity funnel mappings seeded (11)');
}

/**
 * Seed sample plugins
 *
 * Creates test plugins for plugin management testing.
 * These plugins represent different integration types and states.
 *
 * Plugins:
 * 1. Test Plugin - Enabled test plugin (from drowl-plugin-test)
 * 2. Disabled Test Plugin - Disabled plugin for testing (no plugin directory)
 */
async function seedPlugins(): Promise<void> {
  const db = getDb();

  console.log('  🔌 Seeding plugins...');

  // Fixed UUIDs for idempotency
  const testPluginId = '20000000-0000-4000-8000-000000000001';
  const disabledPluginId = '20000000-0000-4000-8000-000000000002';

  // Seed both enabled and disabled plugins for testing
  // Note: drowl-plugin-disabled doesn't have a plugin directory, so config loading will fail gracefully
  await db
    .insert(schema.plugins)
    .values([
      {
        pluginId: testPluginId,
        tenantId: 'default',
        key: 'drowl-plugin-test',
        name: 'Test Plugin',
        enabled: true,
        config: {
          testMode: true,
          description: 'Test plugin for development',
        },
      },
      {
        pluginId: disabledPluginId,
        tenantId: 'default',
        key: 'drowl-plugin-disabled',
        name: 'Disabled Test Plugin',
        enabled: false,
        config: null,
      },
    ])
    .onConflictDoNothing();

  // Reset deterministic state so repeated seeds restore plugin defaults
  const now = new Date();

  await db
    .update(schema.plugins)
    .set({
      tenantId: 'default',
      key: 'drowl-plugin-test',
      name: 'Test Plugin',
      enabled: true,
      config: {
        testMode: true,
        description: 'Test plugin for development',
      },
      updatedAt: now,
    })
    .where(eq(schema.plugins.pluginId, testPluginId));

  await db
    .update(schema.plugins)
    .set({
      tenantId: 'default',
      key: 'drowl-plugin-disabled',
      name: 'Disabled Test Plugin',
      enabled: false,
      config: null,
      updatedAt: now,
    })
    .where(eq(schema.plugins.pluginId, disabledPluginId));

  console.log('    ✅ Plugins seeded (2)');
}

/**
 * Seed sample plugin events
 *
 * Creates test plugin events for plugin data display testing.
 * These events represent different scenarios:
 * - Various statuses (processed, failed, pending)
 * - Different event types (github.push, slack.message, etc.)
 * - Different timestamps for date filtering
 * - Error messages for failed events
 *
 * Total: 25 events to test pagination (default perPage is 20)
 */
async function seedPluginEvents(): Promise<void> {
  const db = getDb();

  console.log('  📊 Seeding plugin events...');

  // Use test plugin ID
  const testPluginId = '20000000-0000-4000-8000-000000000001';

  // Create 25 events with mix of statuses and types
  const events = [];
  const baseDate = new Date('2025-10-01T00:00:00Z');

  // Generate 10 processed events
  for (let i = 0; i < 10; i++) {
    events.push({
      pluginEventId: generateUUID(),
      tenantId: 'default',
      pluginId: testPluginId,
      eventType: i % 2 === 0 ? 'github.push' : 'slack.message',
      status: 'processed' as const,
      rawData: {
        action: 'push',
        repository: 'test-repo',
        user: `user-${i}`,
        timestamp: new Date(baseDate.getTime() + i * 3600000).toISOString(),
      },
      errorMessage: null,
      ingestedAt: new Date(baseDate.getTime() + i * 3600000),
      processedAt: new Date(baseDate.getTime() + i * 3600000 + 60000),
    });
  }

  // Generate 8 failed events (with error messages)
  for (let i = 0; i < 8; i++) {
    events.push({
      pluginEventId: generateUUID(),
      tenantId: 'default',
      pluginId: testPluginId,
      eventType: i % 2 === 0 ? 'github.pull_request' : 'discord.message',
      status: 'failed' as const,
      rawData: {
        action: 'opened',
        repository: 'error-repo',
        user: `error-user-${i}`,
      },
      errorMessage: `API error: ${i % 2 === 0 ? 'Rate limit exceeded' : 'Invalid token'}`,
      ingestedAt: new Date(baseDate.getTime() + (10 + i) * 3600000),
      processedAt: new Date(baseDate.getTime() + (10 + i) * 3600000 + 120000),
    });
  }

  // Generate 7 pending events (not yet processed)
  for (let i = 0; i < 7; i++) {
    events.push({
      pluginEventId: generateUUID(),
      tenantId: 'default',
      pluginId: testPluginId,
      eventType: i % 3 === 0 ? 'github.issue' : i % 3 === 1 ? 'slack.reaction' : 'twitter.tweet',
      status: 'pending' as const,
      rawData: {
        action: 'created',
        content: `Pending event ${i}`,
      },
      errorMessage: null,
      ingestedAt: new Date(baseDate.getTime() + (18 + i) * 3600000),
      processedAt: null,
    });
  }

  // Insert all events
  await db
    .insert(schema.pluginEventsRaw)
    .values(events)
    .onConflictDoNothing();

  console.log('    ✅ Plugin events seeded (25)');
}

// ============================================================================
// Main Seed Function
// ============================================================================

/**
 * Main seed function
 *
 * Orchestrates the seeding process in the correct order to maintain
 * referential integrity. Seeds are inserted in dependency order:
 * 1. Tenant (root)
 * 2. Users, Organizations (depend on tenant)
 * 3. Developers (depend on organizations)
 * 4. Accounts (depend on developers)
 * 5. Campaigns, Resources (depend on campaigns)
 * 6. Activities (depend on developers, accounts, resources)
 * 7. Funnel stages (global master data)
 * 8. Activity funnel mappings (depend on funnel stages)
 *
 * Error handling:
 * - Tests database connection first
 * - Wraps all operations in try-catch
 * - Logs progress at each step
 * - Throws errors with context for debugging
 */
async function seed(): Promise<void> {
  console.log('🌱 Starting seed...\n');

  // Get raw SQL client for RLS management
  const sql = getSql();
  if (!sql) {
    throw new Error('SQL client not initialized');
  }

  try {
    // Check database connection before seeding
    // This validates that DATABASE_* env vars are set correctly
    await testConnection();
    console.log('✅ Database connection OK\n');

    // Temporarily disable RLS on all RLS-enabled tables for seeding
    // Note: users table does NOT have RLS (authentication foundation data)
    // This is necessary because:
    // 1. Connection pooling makes session variables unreliable
    // 2. The devcle user is not a superuser (cannot bypass RLS)
    // 3. We need to seed data without RLS constraints
    console.log('  🔓 Temporarily disabling RLS on all RLS-enabled tables for seeding...\n');

    const tables = [
      // Admin tables (excluding users which has no RLS)
      'tenants', 'api_keys', 'system_settings', 'notifications',
      // Core entity tables
      'organizations', 'developers', 'accounts', 'developer_identifiers', 'developer_merge_logs',
      // Campaign/Resource tables
      'campaigns', 'budgets', 'resources',
      // Activity tables
      'activities', 'activity_campaigns',
      // Plugin/Import tables
      'plugins', 'plugin_runs', 'plugin_events_raw', 'import_jobs', 'shortlinks',
      // Analytics/Funnel tables
      'developer_stats', 'campaign_stats', 'funnel_stages', 'activity_funnel_map', 'activity_types'
    ];

    for (const table of tables) {
      // Remove FORCE RLS first, then disable RLS
      // FORCE RLS prevents table owners from bypassing RLS
      await sql.unsafe(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
      await sql.unsafe(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    }

    console.log('    ✅ RLS disabled on all tables\n');

    // TRUNCATE all tables BEFORE seeding to ensure clean state
    // This prevents conflicts with test data that may have been created
    // Each test should clean up its own data, but seed runs with fresh slate
    console.log('  🗑️  Clearing existing data...\n');
    await sql.unsafe('TRUNCATE TABLE activity_funnel_map CASCADE');
    await sql.unsafe('TRUNCATE TABLE funnel_stages CASCADE');
    await sql.unsafe('TRUNCATE TABLE activities CASCADE');
    await sql.unsafe('TRUNCATE TABLE activity_campaigns CASCADE');
    await sql.unsafe('TRUNCATE TABLE resources CASCADE');
    await sql.unsafe('TRUNCATE TABLE campaigns CASCADE');
    await sql.unsafe('TRUNCATE TABLE budgets CASCADE');
    await sql.unsafe('TRUNCATE TABLE accounts CASCADE');
    await sql.unsafe('TRUNCATE TABLE developer_identifiers CASCADE');
    await sql.unsafe('TRUNCATE TABLE developer_merge_logs CASCADE');
    await sql.unsafe('TRUNCATE TABLE developers CASCADE');
    await sql.unsafe('TRUNCATE TABLE organizations CASCADE');
    await sql.unsafe('TRUNCATE TABLE users CASCADE');
    await sql.unsafe('TRUNCATE TABLE api_keys CASCADE');
    await sql.unsafe('TRUNCATE TABLE system_settings CASCADE');
    await sql.unsafe('TRUNCATE TABLE notifications CASCADE');
    await sql.unsafe('TRUNCATE TABLE plugins CASCADE');
    await sql.unsafe('TRUNCATE TABLE plugin_runs CASCADE');
    await sql.unsafe('TRUNCATE TABLE plugin_events_raw CASCADE');
    await sql.unsafe('TRUNCATE TABLE import_jobs CASCADE');
    await sql.unsafe('TRUNCATE TABLE shortlinks CASCADE');
    await sql.unsafe('TRUNCATE TABLE developer_stats CASCADE');
    await sql.unsafe('TRUNCATE TABLE campaign_stats CASCADE');
    await sql.unsafe('TRUNCATE TABLE activity_types CASCADE');
    await sql.unsafe('TRUNCATE TABLE tenants CASCADE');
    console.log('    ✅ All data cleared\n');

    // Seed in dependency order
    // Each function is idempotent (can be run multiple times safely)

    await seedTenant(); // Must be first (root entity)

    await seedUsers(); // User for dashboard login

    await seedPlugins(); // Plugins for plugin management

    await seedPluginEvents(); // Plugin events for data display testing

    const orgIds = await seedOrganizations(); // Organizations for developer affiliation

    const devIds = await seedDevelopers(orgIds); // Developers (core entity)

    const accountIds = await seedAccounts(devIds); // External service accounts

    const campaignIds = await seedCampaigns(); // Marketing campaigns

    await seedBudgets(campaignIds); // Campaign budgets

    const resourceIds = await seedResources(campaignIds); // Campaign resources

    await seedActivities(devIds, accountIds, resourceIds); // Activity log

    await seedFunnelStages(); // REQUIRED: Funnel stage master data

    await seedActivityTypes(); // Activity types for settings UI

    await seedActivityFunnelMaps(); // Action-to-stage mappings

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  - Tenant: 1');
    console.log('  - Users: 2 (1 admin, 1 member)');
    console.log('  - Plugins: 2');
    console.log('  - Plugin Events: 25 (10 processed, 8 failed, 7 pending)');
    console.log('  - Organizations: 3');
    console.log('  - Developers: 6');
    console.log('  - Accounts: 4');
    console.log('  - Campaigns: 3');
    console.log('  - Budgets: 5');
    console.log('  - Resources: 3');
    console.log('  - Activities: 10');
    console.log('  - Funnel Stages: 4');
    console.log('  - Activity Types: 5');
    console.log('  - Activity Funnel Mappings: 11');
  } catch (error) {
    // Log detailed error information for debugging
    console.error('\n❌ Seed failed:', error);

    // Re-throw to trigger process.exit(1) in catch handler below
    throw error;
  } finally {
    // Always re-enable RLS, even if seeding fails
    // This ensures security policies are restored
    // Note: tenants and users tables do NOT have RLS
    console.log('\n  🔒 Re-enabling RLS on business data tables...\n');

    const tables = [
      // Admin tables (excluding tenants and users which have no RLS)
      'api_keys', 'system_settings', 'notifications',
      // Core entity tables
      'organizations', 'developers', 'accounts', 'developer_identifiers', 'developer_merge_logs',
      // Campaign/Resource tables
      'campaigns', 'budgets', 'resources',
      // Activity tables
      'activities', 'activity_campaigns',
      // Plugin/Import tables
      'plugins', 'plugin_runs', 'plugin_events_raw', 'import_jobs', 'shortlinks',
      // Analytics/Funnel tables
      'developer_stats', 'campaign_stats', 'funnel_stages', 'activity_funnel_map', 'activity_types'
    ];

    for (const table of tables) {
      try {
        // Re-enable RLS and restore FORCE RLS
        // This ensures security policies are fully restored
        await sql.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        await sql.unsafe(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      } catch (error) {
        // Log error but don't throw - we want to re-enable as many tables as possible
        console.error(`    ⚠️  Failed to re-enable RLS on ${table}:`, error);
      }
    }

    console.log('    ✅ RLS re-enabled on all tables\n');
  }
}

// ============================================================================
// Script Execution
// ============================================================================

// Execute seed function and handle exit codes
// - Success: exit(0) for CI/CD pipelines
// - Failure: exit(1) to signal error to shell
seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
