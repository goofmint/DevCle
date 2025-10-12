# Task 3.6: シードデータ作成

## 概要

開発環境とテスト環境で使用する初期データ（シードデータ）を投入するスクリプトを作成する。このタスクでは実装は行わず、インターフェース定義と実装方針のドキュメント化のみを行う。

## 目的

1. **開発環境の即座起動**: docker-compose起動後、即座にアプリケーションをテスト可能
2. **E2Eテストの基盤**: 統合テストとE2Eテスト用のベースデータ提供
3. **ファネルマスターデータ**: 必須のファネルステージ定義を投入
4. **リアルなデータ**: 実際のユースケースに近いサンプルデータで動作検証

## 実装ファイル

### シードスクリプト

**ファイルパス**: `core/db/seed.ts`

```typescript
import { db } from './connection';
import * as schema from './schema';

/**
 * Seed data for development and testing
 * - Creates default tenant
 * - Creates test users, organizations, developers
 * - Inserts funnel stage master data
 * - Creates sample campaigns, resources, activities
 */
async function seed() {
  console.log('🌱 Starting seed...');

  await seedTenant();
  await seedUsers();
  await seedOrganizations();
  await seedDevelopers();
  await seedCampaigns();
  await seedResources();
  await seedActivities();
  await seedFunnelStages();

  console.log('✅ Seed completed!');
}

// Individual seed functions
async function seedTenant() { /* ... */ }
async function seedUsers() { /* ... */ }
async function seedOrganizations() { /* ... */ }
async function seedDevelopers() { /* ... */ }
async function seedCampaigns() { /* ... */ }
async function seedResources() { /* ... */ }
async function seedActivities() { /* ... */ }
async function seedFunnelStages() { /* ... */ }

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
```

**説明**:
- 各シード関数は独立して実行可能
- 成功時: `then`ハンドラーで`process.exit(0)`を呼び出し（正常終了）
- エラー発生時: `catch`ハンドラーで`process.exit(1)`を呼び出し（異常終了）
- この実装により、失敗時に適切な非ゼロ終了ステータスが返される

---

## シードデータの内容

### 1. テナント（tenants）

**投入データ**: デフォルトテナント

```typescript
interface TenantSeedData {
  tenantId: 'default';
  name: 'Default Tenant';
  plan: 'OSS';
}
```

**説明**:
- OSS版はシングルテナント運用
- `tenant_id = 'default'`を全てのデータで使用

---

### 2. ユーザー（users）

**投入データ**: テストユーザー1名

```typescript
interface UserSeedData {
  userId: string; // UUID
  tenantId: 'default';
  email: 'test@example.com';
  displayName: 'Test User';
  passwordHash: string; // bcrypt hash of 'password123'
  authProvider: 'password';
  disabled: false;
}
```

**説明**:
- ダッシュボードログイン用のテストユーザー
- パスワード: `password123`（bcryptでハッシュ化）
- 実装時は`bcrypt`ライブラリを使用

---

### 3. 組織（organizations）

**投入データ**: テスト組織3つ

```typescript
interface OrganizationSeedData {
  orgId: string; // UUID
  tenantId: 'default';
  name: string;
  domainPrimary: string | null;
  attributes: Record<string, unknown> | null;
}

const organizations = [
  {
    name: 'Acme Corporation',
    domainPrimary: 'acme.com',
    attributes: { industry: 'SaaS', size: 'large' },
  },
  {
    name: 'DevRel Community',
    domainPrimary: null,
    attributes: { type: 'community' },
  },
  {
    name: 'Startup Labs',
    domainPrimary: 'startup-labs.io',
    attributes: { industry: 'consulting', size: 'small' },
  },
];
```

**説明**:
- 企業、コミュニティ、スタートアップの3種類
- ドメイン有り/無しのパターンを含む

---

### 4. 開発者（developers）

**投入データ**: テスト開発者5名

```typescript
interface DeveloperSeedData {
  developerId: string; // UUID
  tenantId: 'default';
  displayName: string;
  primaryEmail: string | null;
  orgId: string | null; // Organization UUID
  consentAnalytics: boolean;
  tags: string[];
}

const developers = [
  {
    displayName: 'Alice Anderson',
    primaryEmail: 'alice@acme.com',
    orgId: '<Acme Corporation UUID>',
    consentAnalytics: true,
    tags: ['frontend', 'react'],
  },
  {
    displayName: 'Bob Brown',
    primaryEmail: 'bob@startup-labs.io',
    orgId: '<Startup Labs UUID>',
    consentAnalytics: true,
    tags: ['backend', 'nodejs'],
  },
  {
    displayName: 'Charlie Chen',
    primaryEmail: null,
    orgId: null,
    consentAnalytics: false,
    tags: ['devops'],
  },
  {
    displayName: 'Diana Davis',
    primaryEmail: 'diana@community.dev',
    orgId: '<DevRel Community UUID>',
    consentAnalytics: true,
    tags: ['community'],
  },
  {
    displayName: 'Eve Evans',
    primaryEmail: 'eve@acme.com',
    orgId: '<Acme Corporation UUID>',
    consentAnalytics: true,
    tags: ['fullstack', 'typescript'],
  },
];
```

**説明**:
- 5名の開発者（所属あり4名、無所属1名）
- メールアドレス無し（ID解決前）のケースを含む
- タグで技術領域を分類

---

### 5. アカウント（accounts）

**投入データ**: 開発者に紐づく外部アカウント

```typescript
interface AccountSeedData {
  accountId: string; // UUID
  tenantId: 'default';
  developerId: string | null; // Developer UUID
  provider: string;
  externalUserId: string;
  handle: string | null;
  email: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  isPrimary: boolean;
  confidence: string; // numeric as string
}

const accounts = [
  // Alice's accounts
  {
    developerId: '<Alice UUID>',
    provider: 'github',
    externalUserId: 'alice-gh',
    handle: 'alice',
    email: 'alice@acme.com',
    profileUrl: 'https://github.com/alice',
    isPrimary: true,
    confidence: '1.0',
  },
  {
    developerId: '<Alice UUID>',
    provider: 'slack',
    externalUserId: 'U01ALICE',
    handle: 'alice',
    email: 'alice@acme.com',
    isPrimary: false,
    confidence: '0.95',
  },
  // Bob's account
  {
    developerId: '<Bob UUID>',
    provider: 'github',
    externalUserId: 'bob-gh',
    handle: 'bob_brown',
    email: 'bob@startup-labs.io',
    isPrimary: true,
    confidence: '1.0',
  },
  // Charlie's account (unlinked)
  {
    developerId: null,
    provider: 'x',
    externalUserId: 'charlie_x',
    handle: 'charlie',
    email: null,
    isPrimary: false,
    confidence: '0.5',
  },
];
```

**説明**:
- 各開発者に1つ以上のアカウントを紐付け
- 未解決アカウント（`developerId = null`）のケースを含む
- `provider`: "github", "slack", "x", "discord"等

---

### 6. キャンペーン（campaigns）

**投入データ**: テストキャンペーン3つ

```typescript
interface CampaignSeedData {
  campaignId: string; // UUID
  tenantId: 'default';
  name: string;
  channel: string | null;
  startDate: string | null; // ISO date
  endDate: string | null;
  budgetTotal: string | null; // numeric as string
  attributes: Record<string, unknown> | null;
}

const campaigns = [
  {
    name: 'DevRel Meetup 2025',
    channel: 'event',
    startDate: '2025-11-01',
    endDate: '2025-11-30',
    budgetTotal: '500000',
    attributes: { location: 'Tokyo', format: 'hybrid' },
  },
  {
    name: 'Blog Content Series',
    channel: 'content',
    startDate: '2025-10-01',
    endDate: '2025-12-31',
    budgetTotal: '100000',
    attributes: { medium: 'blog', topics: ['typescript', 'remix'] },
  },
  {
    name: 'GitHub Sponsor Campaign',
    channel: 'community',
    startDate: '2025-09-01',
    endDate: null,
    budgetTotal: null,
    attributes: { platform: 'github' },
  },
];
```

**説明**:
- イベント、コンテンツ、コミュニティの3種類
- 予算あり/無しのパターンを含む

---

### 7. リソース（resources）

**投入データ**: キャンペーンに関連するリソース

```typescript
interface ResourceSeedData {
  resourceId: string; // UUID
  tenantId: 'default';
  category: string;
  groupKey: string | null;
  title: string | null;
  url: string | null;
  externalId: string | null;
  campaignId: string | null; // Campaign UUID
  attributes: Record<string, unknown> | null;
}

const resources = [
  {
    category: 'event',
    groupKey: 'devrel-meetup-2025',
    title: 'DevRel Meetup 2025 - Session 1',
    url: 'https://connpass.com/event/12345',
    externalId: 'connpass-12345',
    campaignId: '<DevRel Meetup UUID>',
    attributes: { capacity: 100, venue: 'Tokyo Office' },
  },
  {
    category: 'blog',
    groupKey: 'blog-series',
    title: 'Getting Started with Remix',
    url: 'https://blog.example.com/remix-intro',
    externalId: null,
    campaignId: '<Blog Content Series UUID>',
    attributes: { author: 'Alice', language: 'en' },
  },
  {
    category: 'repo',
    groupKey: null,
    title: 'DRM Core Repository',
    url: 'https://github.com/example/drm-core',
    externalId: 'github-drm-core',
    campaignId: '<GitHub Sponsor Campaign UUID>',
    attributes: { stars: 120, language: 'typescript' },
  },
];
```

**説明**:
- イベント、ブログ、リポジトリの3種類
- キャンペーンとの紐付けあり

---

### 8. アクティビティ（activities）

**投入データ**: サンプルアクティビティ10件

```typescript
interface ActivitySeedData {
  activityId: string; // UUID
  tenantId: 'default';
  developerId: string | null; // Developer UUID
  accountId: string | null; // Account UUID
  anonId: string | null;
  resourceId: string | null; // Resource UUID
  action: string;
  occurredAt: string; // ISO timestamp
  source: string;
  sourceRef: string | null;
  category: string | null;
  groupKey: string | null;
  metadata: Record<string, unknown> | null;
  confidence: string; // numeric as string
}

const activities = [
  {
    developerId: '<Alice UUID>',
    accountId: '<Alice GitHub Account UUID>',
    anonId: null,
    resourceId: '<DRM Repo UUID>',
    action: 'star',
    occurredAt: '2025-10-01T10:00:00Z',
    source: 'github',
    sourceRef: 'github-event-123',
    category: 'repo',
    groupKey: null,
    metadata: { device: 'desktop', country: 'JP' },
    confidence: '1.0',
  },
  {
    developerId: '<Bob UUID>',
    accountId: '<Bob GitHub Account UUID>',
    anonId: null,
    resourceId: '<Blog Post UUID>',
    action: 'view',
    occurredAt: '2025-10-02T14:30:00Z',
    source: 'ga',
    sourceRef: 'ga-event-456',
    category: 'blog',
    groupKey: 'blog-series',
    metadata: { referrer: 'https://twitter.com', duration: 120 },
    confidence: '0.9',
  },
  {
    developerId: null,
    accountId: null,
    anonId: 'click_abc123',
    resourceId: '<Event UUID>',
    action: 'click',
    occurredAt: '2025-10-03T09:15:00Z',
    source: 'shortlink',
    sourceRef: 'shortlink-abc123',
    category: 'event',
    groupKey: 'devrel-meetup-2025',
    metadata: { utm_source: 'twitter', utm_medium: 'social' },
    confidence: '0.5',
  },
  // ... 7 more activities
];
```

**説明**:
- GitHub star、ブログ閲覧、短縮URLクリック等
- 認証済み（`developerId`あり）と匿名（`anonId`のみ）のパターンを含む
- メタデータにUTMパラメータやデバイス情報を含む

---

### 9. ファネルステージ（funnel_stages）★必須マスターデータ

**投入データ**: 4つのファネルステージ定義

```typescript
interface FunnelStageSeedData {
  stageKey: string;
  orderNo: number;
  title: string;
}

const funnelStages = [
  { stageKey: 'awareness', orderNo: 1, title: 'Awareness' },
  { stageKey: 'engagement', orderNo: 2, title: 'Engagement' },
  { stageKey: 'adoption', orderNo: 3, title: 'Adoption' },
  { stageKey: 'advocacy', orderNo: 4, title: 'Advocacy' },
];
```

**説明**:
- 全テナント共通のファネルステージ定義
- `orderNo`で順序を保証
- アプリケーション起動に必須

---

### 10. ファネルマッピング（activity_funnel_map）

**投入データ**: デフォルトのアクション→ファネルマッピング

```typescript
interface ActivityFunnelMapSeedData {
  tenantId: 'default';
  action: string;
  stageKey: string;
}

const activityFunnelMaps = [
  // Awareness
  { tenantId: 'default', action: 'view', stageKey: 'awareness' },
  { tenantId: 'default', action: 'click', stageKey: 'awareness' },

  // Engagement
  { tenantId: 'default', action: 'attend', stageKey: 'engagement' },
  { tenantId: 'default', action: 'comment', stageKey: 'engagement' },
  { tenantId: 'default', action: 'post', stageKey: 'engagement' },

  // Adoption
  { tenantId: 'default', action: 'signup', stageKey: 'adoption' },
  { tenantId: 'default', action: 'download', stageKey: 'adoption' },
  { tenantId: 'default', action: 'api_call', stageKey: 'adoption' },

  // Advocacy
  { tenantId: 'default', action: 'star', stageKey: 'advocacy' },
  { tenantId: 'default', action: 'share', stageKey: 'advocacy' },
  { tenantId: 'default', action: 'contribute', stageKey: 'advocacy' },
];
```

**説明**:
- デフォルトテナント用のマッピング
- 各アクションをファネルステージに分類

---

## 実行方法

### pnpm scriptの追加

**ファイルパス**: `core/package.json`

```json
{
  "scripts": {
    "db:seed": "tsx db/seed.ts"
  }
}
```

**説明**:
- `tsx`を使用してTypeScriptを直接実行
- 実装時は`tsx`パッケージを追加（`pnpm add -D tsx`）

### 実行コマンド

```bash
# シードデータ投入
pnpm db:seed

# Docker環境内で実行する場合
docker-compose exec core pnpm db:seed
```

---

## エラーハンドリング

### 重複データの扱い

シードスクリプトは冪等性（idempotency）を持つべきです。

```typescript
// Good: Upsert pattern
await db.insert(schema.tenants)
  .values({ tenantId: 'default', name: 'Default Tenant', plan: 'OSS' })
  .onConflictDoNothing(); // Already exists → skip

// Bad: Always insert (fails on second run)
await db.insert(schema.tenants)
  .values({ tenantId: 'default', name: 'Default Tenant', plan: 'OSS' });
```

**説明**:
- `.onConflictDoNothing()`を使用して、既存データをスキップ
- または、既存データを削除してから挿入（開発環境のみ推奨）

### データベース接続エラー

```typescript
async function seed() {
  try {
    // Check database connection
    await db.execute(sql`SELECT 1`);
    console.log('✅ Database connection OK');

    // Run seed functions
    await seedTenant();
    // ...

  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Seed failed:', error.message);
    }
    throw error;
  }
}
```

**説明**:
- 最初にデータベース接続を確認
- エラー発生時は詳細メッセージを表示

---

## テスト方法

### 1. シード実行確認

```bash
# 1. シード実行
pnpm db:seed

# 2. データ確認（psqlまたはDrizzle Studio）
docker-compose exec postgres psql -U devcle -d devcle -c "SELECT * FROM tenants;"
docker-compose exec postgres psql -U devcle -d devcle -c "SELECT * FROM developers;"
```

### 2. 冪等性確認

```bash
# 2回実行してエラーが出ないこと
pnpm db:seed
pnpm db:seed
```

### 3. E2Eテストでの確認

シードデータを使用したE2Eテスト（Playwright）で動作確認：

```typescript
// e2e/dashboard.spec.ts
test('should display seeded developers', async ({ page }) => {
  await page.goto('/dashboard/developers');

  // Alice, Bob, Charlie, Diana, Eve が表示されること
  await expect(page.locator('text=Alice Anderson')).toBeVisible();
  await expect(page.locator('text=Bob Brown')).toBeVisible();
});
```

---

## 完了条件

以下の条件を全て満たすこと：

1. ✅ `core/db/seed.ts`が作成されている
2. ✅ `pnpm db:seed`コマンドが成功する
3. ✅ デフォルトテナント（`tenant_id = 'default'`）が作成される
4. ✅ テスト用の開発者5名、組織3つ、キャンペーン3つが作成される
5. ✅ ファネルステージ4つとマッピングデータが投入される
6. ✅ サンプルアクティビティ10件が作成される
7. ✅ 冪等性（2回実行してもエラーが出ない）が保証される
8. ✅ エラー時に適切なメッセージが表示される

---

## 依存関係

- **依存タスク**: Task 3.5（マイグレーション実行とRLS設定）
- **必要なパッケージ**:
  - `drizzle-orm`（既存）
  - `tsx`（開発依存）
  - `bcrypt`（パスワードハッシュ化用）

---

## 備考

### シードデータの更新

将来的に追加のシードデータが必要になった場合、以下のように関数を追加：

```typescript
async function seedPlugins() {
  await db.insert(schema.plugins).values([
    {
      tenantId: 'default',
      key: 'posthog',
      name: 'PostHog Analytics',
      enabled: false,
    },
  ]).onConflictDoNothing();
}

// seed()関数に追加
async function seed() {
  // ...
  await seedPlugins(); // 追加
}
```

### 本番環境での注意

**本番環境ではシードデータを実行しないこと**

```typescript
// seed.ts の先頭に環境チェックを追加
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Cannot run seed in production environment');
  process.exit(1);
}
```

---

## まとめ

本ドキュメントでは、開発環境とテスト環境で使用するシードデータの内容と実装方針を定義した。実装時は以下の点に注意：

1. **冪等性の保証**: `.onConflictDoNothing()`を使用
2. **エラーハンドリング**: 接続エラー、挿入エラーを適切に処理
3. **ファネルマスターデータ**: 必須データを忘れずに投入
4. **リアルなデータ**: 実際のユースケースに近いサンプルデータを作成

次のTask 4.1以降で、このシードデータを使用してDRMコア機能を実装する。
