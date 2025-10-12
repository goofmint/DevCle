# Task 3.2: Drizzle ORMコアテーブルスキーマ定義

## 概要

PostgreSQLデータベースに必要な全25テーブルをDrizzle ORMで定義する。このタスクでは実装は行わず、インターフェース定義と実装方針のドキュメント化のみを行う。

## スキーマ構成

### 1. 管理系テーブル (5テーブル)
- tenants: マルチテナント管理
- users: コンソールユーザー
- api_keys: プログラマティックアクセス用
- system_settings: テナント別設定
- notifications: 通知履歴

### 2. コアエンティティ (5テーブル)
- organizations: 組織
- developers: 開発者（統合後の正規エンティティ）
- accounts: 外部サービスアカウント
- developer_identifiers: 非アカウント識別子
- developer_merge_logs: ID統合監査ログ

### 3. キャンペーン/リソース (3テーブル)
- campaigns: DevRel/マーケティング施策
- budgets: キャンペーン別コスト
- resources: インタラクション対象（コンテンツ、イベント等）

### 4. アクティビティ (2テーブル)
- activities: イベントログ
- activity_campaigns: アトリビューション用N:M結合テーブル

### 5. プラグイン/インポート (5テーブル)
- plugins: 登録済みプラグイン
- plugin_runs: プラグイン実行ログ
- plugin_events_raw: 生イベントアーカイブ
- import_jobs: バッチインポート管理
- shortlinks: 短縮URL/QRコード

### 6. 分析/ファネル (4テーブル)
- developer_stats: 開発者別集計キャッシュ
- campaign_stats: キャンペーン別集計
- funnel_stages: ファネルステージ辞書
- activity_funnel_map: アクション→ファネルマッピング

### 7. システム (1テーブル)
- schema_migrations: マイグレーション履歴

---

## 各テーブルのインターフェース定義

### 1. 管理系テーブル

#### 1.1 tenants - テナント管理

**目的**: マルチテナント環境のルートテーブル。OSS版はシングルテナント（`plan = 'OSS'`）。

**ファイルパス**: `app/db/schema/admin.ts`

```typescript
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  tenantId: text('tenant_id').primaryKey(),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('OSS'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**説明**:
- `plan`: プラン種別（`OSS`がデフォルト）
- OSS版では通常シングルテナントで運用

---

#### 1.2 users - コンソールユーザー

**目的**: ダッシュボードにログインするユーザー。OSS版は最小機能（RBAC/SSOなし）。

**ファイルパス**: `app/db/schema/admin.ts`

```typescript
import { pgTable, uuid, text, timestamp, boolean, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  userId: uuid('user_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  email: text('email').notNull(), // CITEXT型として扱う
  displayName: text('display_name'),
  passwordHash: text('password_hash'),
  authProvider: text('auth_provider'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  disabled: boolean('disabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailUnique: unique('users_tenant_email_unique').on(t.tenantId, t.email),
}));
```

**説明**:
- `email`: CITEXT型（大文字小文字を区別しない）- PostgreSQL拡張
- `passwordHash`: ローカル認証用（bcrypt等でハッシュ化）
- `authProvider`: "password", "github"等

**PostgreSQL拡張要件**:
```sql
CREATE EXTENSION IF NOT EXISTS "citext";
```

---

#### 1.3 api_keys - API鍵管理

**目的**: プログラマティックアクセス用のAPI鍵。ハッシュ値のみ保存。

**ファイルパス**: `app/db/schema/admin.ts`

```typescript
export const apiKeys = pgTable('api_keys', {
  apiKeyId: uuid('api_key_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  hashedKey: text('hashed_key').notNull(),
  scope: text('scope'),
  createdBy: uuid('created_by').references(() => users.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
```

**説明**:
- `hashedKey`: SHA-256等でハッシュ化した値のみ保存
- `revokedAt`: NULL = 有効、値がある = 失効済み

---

#### 1.4 system_settings - システム設定

**目的**: テナント単位の設定（SMTP、カスタムドメイン等）。

**ファイルパス**: `app/db/schema/admin.ts`

```typescript
export const systemSettings = pgTable('system_settings', {
  tenantId: text('tenant_id').primaryKey().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  baseUrl: text('base_url'),
  smtpSettings: jsonb('smtp_settings'),
  aiSettings: jsonb('ai_settings'),
  shortlinkDomain: text('shortlink_domain'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**説明**:
- `smtpSettings`: SMTP接続情報（JSON）
- `aiSettings`: 将来の互換性用（OSS版では未使用）
- `shortlinkDomain`: カスタムドメイン（例: `go.example.com`）

---

#### 1.5 notifications - 通知履歴

**目的**: 送信済み通知の履歴管理（email/slack/webhook）。

**ファイルパス**: `app/db/schema/admin.ts`

```typescript
export const notifications = pgTable('notifications', {
  notificationId: uuid('notification_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  channel: text('channel').notNull(),
  target: text('target'),
  payload: jsonb('payload'),
  status: text('status').notNull().default('queued'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
});
```

**説明**:
- `channel`: "email", "slack", "webhook"
- `status`: "queued", "sent", "failed"
- OSS版ではオプション機能

---

### 2. コアエンティティ

#### 2.1 organizations - 組織

**目的**: 開発者が所属する組織（企業、コミュニティ等）。

**ファイルパス**: `app/db/schema/core.ts`

```typescript
import { pgTable, uuid, text, timestamp, jsonb, unique, boolean, numeric, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './admin';

export const organizations = pgTable('organizations', {
  orgId: uuid('org_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  domainPrimary: text('domain_primary'), // CITEXT型として扱う
  attributes: jsonb('attributes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  nameUnique: unique('organizations_tenant_name_unique').on(t.tenantId, t.name),
}));
```

**説明**:
- `domainPrimary`: 主要ドメイン（例: `example.com`）
- `attributes`: カスタム属性（業種、規模等）

---

#### 2.2 developers - 開発者プロファイル

**目的**: ID統合後の正規開発者エンティティ（器）。

**ファイルパス**: `app/db/schema/core.ts`

```typescript
// Note: このファイルの先頭には既に以下のimportがあります（2.1で定義済み）
// import { pgTable, uuid, text, timestamp, jsonb, unique, boolean, numeric, index } from 'drizzle-orm/pg-core';
// import { sql } from 'drizzle-orm';
// import { tenants } from './admin';

export const developers = pgTable('developers', {
  developerId: uuid('developer_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  primaryEmail: text('primary_email'), // CITEXT型として扱う
  orgId: uuid('org_id').references(() => organizations.orgId, { onDelete: 'set null' }),
  consentAnalytics: boolean('consent_analytics').notNull().default(true),
  tags: text('tags').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailUnique: unique('developers_tenant_email_unique').on(t.tenantId, t.primaryEmail),
  tenantOrgIdx: index('idx_developers_tenant_org').on(t.tenantId, t.orgId),
}));
```

**説明**:
- `primaryEmail`: NULL可（ID解決前は不明）
- `consentAnalytics`: デフォルトTRUE（schema.sqlに準拠）
- `tags`: カテゴリータグ配列

---

#### 2.3 accounts - 外部サービスアカウント（★最重要）

**目的**: 外部サービス（GitHub, Slack, X, Discord等）のアカウント情報。

**ファイルパス**: `app/db/schema/core.ts`

```typescript
export const accounts = pgTable('accounts', {
  accountId: uuid('account_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  developerId: uuid('developer_id').references(() => developers.developerId, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  externalUserId: text('external_user_id').notNull(),
  handle: text('handle'),
  email: text('email'), // CITEXT型として扱う
  profileUrl: text('profile_url'),
  avatarUrl: text('avatar_url'),
  firstSeen: timestamp('first_seen', { withTimezone: true }),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  isPrimary: boolean('is_primary').notNull().default(false),
  confidence: numeric('confidence').notNull().default('0.8'),
  attributes: jsonb('attributes'),
  dedupKey: text('dedup_key').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  providerUserUnique: unique('accounts_tenant_provider_user_unique').on(t.tenantId, t.provider, t.externalUserId),
  tenantDevIdx: index('idx_accounts_tenant_dev').on(t.tenantId, t.developerId),
}));
```

**説明**:
- `provider`: "github", "slack", "x", "discord", "email", "ga", "posthog"等
- `externalUserId`: プロバイダー固有のID
- `developerId`: NULL可（ID解決前）
- `confidence`: 自動リンク信頼度（0.0-1.0、デフォルト0.8）
- `dedupKey`: 重複排除用ハッシュ

---

#### 2.4 developer_identifiers - 非アカウント識別子

**目的**: アカウント以外の識別子（メール、ドメイン、click_id、mlid、key_fp等）。

**ファイルパス**: `app/db/schema/core.ts`

```typescript
export const developerIdentifiers = pgTable('developer_identifiers', {
  identifierId: uuid('identifier_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  developerId: uuid('developer_id').notNull().references(() => developers.developerId, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  valueNormalized: text('value_normalized').notNull(),
  confidence: numeric('confidence').notNull().default('1.0'),
  attributes: jsonb('attributes'),
  firstSeen: timestamp('first_seen', { withTimezone: true }),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
}, (t) => ({
  kindValueUnique: unique('dev_identifiers_tenant_kind_value_unique').on(t.tenantId, t.kind, t.valueNormalized),
  tenantDevIdx: index('idx_dev_identifiers_tenant_dev').on(t.tenantId, t.developerId),
}));
```

**説明**:
- `kind`: "email", "domain", "phone", "mlid", "click_id", "key_fp"
- `valueNormalized`: 正規化済み値（小文字化等）

---

#### 2.5 developer_merge_logs - ID統合監査ログ

**目的**: 開発者IDのマージ履歴を監査用に記録。

**ファイルパス**: `app/db/schema/core.ts`

```typescript
export const developerMergeLogs = pgTable('developer_merge_logs', {
  mergeId: uuid('merge_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  intoDeveloperId: uuid('into_developer_id').notNull().references(() => developers.developerId, { onDelete: 'cascade' }),
  fromDeveloperId: uuid('from_developer_id').notNull().references(() => developers.developerId, { onDelete: 'cascade' }),
  reason: text('reason'),
  evidence: jsonb('evidence'),
  mergedAt: timestamp('merged_at', { withTimezone: true }).notNull().defaultNow(),
  mergedBy: uuid('merged_by').references(() => users.userId),
});
```

**説明**:
- `intoDeveloperId`: マージ先
- `fromDeveloperId`: マージ元
- `evidence`: マッチした属性とスコア（JSON）
- OSS版では最小限の実装

---

### 3. キャンペーン/リソース

#### 3.1 campaigns - キャンペーン

**目的**: DevRel/マーケティング施策の管理単位（ROI計算の基準）。

**ファイルパス**: `app/db/schema/campaigns.ts`

```typescript
import { pgTable, uuid, text, date, numeric, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const campaigns = pgTable('campaigns', {
  campaignId: uuid('campaign_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  channel: text('channel'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  budgetTotal: numeric('budget_total'),
  attributes: jsonb('attributes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  nameUnique: unique('campaigns_tenant_name_unique').on(t.tenantId, t.name),
}));
```

**説明**:
- `channel`: "event", "ad", "content", "community"等
- `budgetTotal`: 総予算（参考値）
- `attributes`: UTMパラメータ、オーナー、地域等（JSON）

---

#### 3.2 budgets - 予算エントリ

**目的**: キャンペーン別のコスト記録（ROI計算用）。

**ファイルパス**: `app/db/schema/campaigns.ts`

```typescript
import { index } from 'drizzle-orm/pg-core';

export const budgets = pgTable('budgets', {
  budgetId: uuid('budget_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.campaignId, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  amount: numeric('amount').notNull(),
  currency: text('currency').notNull().default('JPY'),
  spentAt: date('spent_at').notNull(),
  source: text('source'),
  memo: text('memo'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantCampaignIdx: index('idx_budgets_tenant_campaign').on(t.tenantId, t.campaignId),
}));
```

**説明**:
- `category`: "labor", "ad", "production", "venue", "tool", "other"
- `source`: "form", "api", "csv", "plugin"
- `spentAt`: 支出日（DATE型）

---

#### 3.3 resources - リソース

**目的**: 開発者がインタラクションする対象（記事、イベント、リポジトリ、リンク等）。

**ファイルパス**: `app/db/schema/campaigns.ts`

```typescript
export const resources = pgTable('resources', {
  resourceId: uuid('resource_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  groupKey: text('group_key'),
  title: text('title'),
  url: text('url'),
  externalId: text('external_id'),
  campaignId: uuid('campaign_id').references(() => campaigns.campaignId, { onDelete: 'set null' }),
  attributes: jsonb('attributes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantCatIdx: index('idx_resources_tenant_cat').on(t.tenantId, t.category),
  tenantCampaignIdx: index('idx_resources_tenant_campaign').on(t.tenantId, t.campaignId),
}));
```

**説明**:
- `category`: "event", "blog", "video", "ad", "repo", "link", "form", "webinar"
- `groupKey`: イベント名やメディア名等のグループ識別子
- `attributes`: 言語、地域、トピック、タグ等（JSON）

---

### 4. アクティビティ

#### 4.1 activities - アクティビティログ（★重要）

**目的**: 開発者/アカウントの行動ログ（誰が・いつ・何を・どうした）。

**ファイルパス**: `app/db/schema/activities.ts`

```typescript
import { pgTable, uuid, text, timestamp, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const activities = pgTable('activities', {
  activityId: uuid('activity_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  developerId: uuid('developer_id').references(() => developers.developerId, { onDelete: 'set null' }),
  accountId: uuid('account_id').references(() => accounts.accountId, { onDelete: 'set null' }),
  anonId: text('anon_id'),
  resourceId: uuid('resource_id').references(() => resources.resourceId, { onDelete: 'set null' }),
  action: text('action').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  source: text('source').notNull(),
  sourceRef: text('source_ref'),
  category: text('category'),
  groupKey: text('group_key'),
  metadata: jsonb('metadata'),
  confidence: numeric('confidence').notNull().default('1.0'),
  dedupKey: text('dedup_key').unique(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantTimeIdx: index('idx_activities_tenant_time').on(t.tenantId, t.occurredAt),
  tenantDevIdx: index('idx_activities_tenant_dev').on(t.tenantId, t.developerId, t.occurredAt),
  tenantResIdx: index('idx_activities_tenant_res').on(t.tenantId, t.resourceId, t.occurredAt),
  tenantActionIdx: index('idx_activities_tenant_action').on(t.tenantId, t.action, t.occurredAt),
}));
```

**説明**:
- `accountId`: どのアカウントで実行したか（★最重要フィールド）
- `anonId`: 匿名ID（click_id、QRコード等）
- `action`: "click", "attend", "post", "view", "comment", "signup", "download", "api_call"等
- `source`: "ga", "posthog", "connpass", "x", "github", "csv", "form", "api"
- `category`, `groupKey`: resourcesテーブルからのキャッシュ値（クエリ最適化用）
- `metadata`: UA、言語、UTM、デバイス、位置情報、shortlink_id等（JSON）

**追加インデックス（マイグレーション時に手動追加）**:
```sql
CREATE INDEX idx_activities_metadata_gin ON activities USING GIN (metadata);
```

---

#### 4.2 activity_campaigns - アトリビューション

**目的**: アクティビティとキャンペーンのN:M関係（重み付きアトリビューション）。

**ファイルパス**: `app/db/schema/activities.ts`

```typescript
export const activityCampaigns = pgTable('activity_campaigns', {
  activityCampaignId: uuid('activity_campaign_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  activityId: uuid('activity_id').notNull().references(() => activities.activityId, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.campaignId, { onDelete: 'cascade' }),
  weight: numeric('weight').notNull().default('1.0'),
}, (t) => ({
  activityCampaignUnique: unique('activity_campaigns_tenant_activity_campaign_unique').on(t.tenantId, t.activityId, t.campaignId),
}));
```

**説明**:
- `weight`: アトリビューション重み（0.0-1.0）
- マルチタッチアトリビューション対応

---

### 5. プラグイン/インポート

#### 5.1 plugins - プラグイン登録

**目的**: テナント単位で有効化されたプラグイン。

**ファイルパス**: `app/db/schema/plugins.ts`

```typescript
import { pgTable, uuid, text, boolean, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const plugins = pgTable('plugins', {
  pluginId: uuid('plugin_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  config: jsonb('config'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  keyUnique: unique('plugins_tenant_key_unique').on(t.tenantId, t.key),
}));
```

**説明**:
- `key`: "ga", "posthog", "slack", "github", "x", "connpass"等
- `config`: API鍵やエンドポイント設定（JSON）

---

#### 5.2 plugin_runs - プラグイン実行ログ

**目的**: プラグインジョブの実行履歴（管理UI表示用）。

**ファイルパス**: `app/db/schema/plugins.ts`

```typescript
import { index } from 'drizzle-orm/pg-core';

export const pluginRuns = pgTable('plugin_runs', {
  runId: uuid('run_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  pluginId: uuid('plugin_id').notNull().references(() => plugins.pluginId, { onDelete: 'cascade' }),
  trigger: text('trigger').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull().default('running'),
  result: jsonb('result'),
}, (t) => ({
  tenantPluginTimeIdx: index('idx_plugin_runs_tenant_plugin_time').on(t.tenantId, t.pluginId, t.startedAt),
}));
```

**説明**:
- `trigger`: "cron", "manual", "webhook"
- `status`: "running", "success", "failed", "partial"
- `result`: 処理件数、診断情報、エラー詳細（JSON）

---

#### 5.3 plugin_events_raw - 生イベントアーカイブ

**目的**: プラグインが受信した生データのアーカイブ（再処理・監査用）。

**ファイルパス**: `app/db/schema/plugins.ts`

```typescript
export const pluginEventsRaw = pgTable('plugin_events_raw', {
  rawId: uuid('raw_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  pluginId: uuid('plugin_id').notNull().references(() => plugins.pluginId, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  dedupKey: text('dedup_key').unique(),
});
```

**説明**:
- `payload`: 生イベント/ドキュメント（JSON）
- `dedupKey`: 重複排除用ハッシュ

---

#### 5.4 import_jobs - インポートジョブ

**目的**: バッチインポート処理の制御とメトリクス（UI表示用）。

**ファイルパス**: `app/db/schema/plugins.ts`

```typescript
export const importJobs = pgTable('import_jobs', {
  jobId: uuid('job_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  status: text('status').notNull().default('queued'),
  filePath: text('file_path'),
  metrics: jsonb('metrics'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.userId),
});
```

**説明**:
- `source`: "csv", "api", "manual"
- `metrics`: 処理済み/挿入/失敗件数（JSON）

---

#### 5.5 shortlinks - 短縮URL/QRコード

**目的**: クリック追跡とキャンペーン紐付け用の短縮URL。

**ファイルパス**: `app/db/schema/plugins.ts`

```typescript
export const shortlinks = pgTable('shortlinks', {
  shortlinkId: uuid('shortlink_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  targetUrl: text('target_url').notNull(),
  campaignId: uuid('campaign_id').references(() => campaigns.campaignId, { onDelete: 'set null' }),
  resourceId: uuid('resource_id').references(() => resources.resourceId, { onDelete: 'set null' }),
  attributes: jsonb('attributes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  keyUnique: unique('shortlinks_tenant_key_unique').on(t.tenantId, t.key),
}));
```

**説明**:
- `key`: 短縮キー（例: `abcd1234`）
- `attributes`: UTMパラメータ、medium等（JSON）

---

### 6. 分析/ファネル

#### 6.1 developer_stats - 開発者統計キャッシュ

**目的**: 開発者別の集計値（非正規化キャッシュ、クエリ高速化用）。

**ファイルパス**: `app/db/schema/analytics.ts`

```typescript
import { pgTable, uuid, text, timestamp, bigint, index } from 'drizzle-orm/pg-core';

export const developerStats = pgTable('developer_stats', {
  developerId: uuid('developer_id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  lastActionAt: timestamp('last_action_at', { withTimezone: true }),
  totalActions: bigint('total_actions', { mode: 'number' }).notNull().default(0),
  clicks: bigint('clicks', { mode: 'number' }).notNull().default(0),
  attends: bigint('attends', { mode: 'number' }).notNull().default(0),
  posts: bigint('posts', { mode: 'number' }).notNull().default(0),
  stars: bigint('stars', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('idx_dev_stats_tenant').on(t.tenantId),
}));
```

**説明**:
- activitiesテーブルから定期的に再集計
- ダッシュボード表示の高速化

---

#### 6.2 campaign_stats - キャンペーン統計キャッシュ

**目的**: キャンペーン別の集計メトリクス（ROI計算用）。

**ファイルパス**: `app/db/schema/analytics.ts`

```typescript
export const campaignStats = pgTable('campaign_stats', {
  campaignId: uuid('campaign_id').primaryKey().references(() => campaigns.campaignId, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  actionsTotal: bigint('actions_total', { mode: 'number' }).notNull().default(0),
  conversions: bigint('conversions', { mode: 'number' }).notNull().default(0),
  costTotal: numeric('cost_total').notNull().default('0'),
  roiPerCost: numeric('roi_per_cost'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**説明**:
- `conversions`: コンバージョン数（signup、api_call等）
- `roiPerCost`: コスト当たりROI

---

#### 6.3 funnel_stages - ファネルステージ辞書

**目的**: グローバルなファネルステージ定義。

**ファイルパス**: `app/db/schema/analytics.ts`

```typescript
import { integer } from 'drizzle-orm/pg-core';

export const funnelStages = pgTable('funnel_stages', {
  stageKey: text('stage_key').primaryKey(),
  orderNo: integer('order_no').notNull().unique(),
  title: text('title').notNull(),
});
```

**説明**:
- `stageKey`: "awareness", "engagement", "adoption", "advocacy"
- `orderNo`: ステージの順序（1-4）

---

#### 6.4 activity_funnel_map - アクション→ファネルマッピング

**目的**: テナント単位でアクションをファネルステージにマッピング。

**ファイルパス**: `app/db/schema/analytics.ts`

```typescript
import { pgTable, text, primaryKey } from 'drizzle-orm/pg-core';
import { tenants } from './admin';

export const activityFunnelMap = pgTable('activity_funnel_map', {
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  stageKey: text('stage_key').notNull().references(() => funnelStages.stageKey),
}, (t) => ({
  pk: primaryKey({ columns: [t.tenantId, t.action] }),
}));
```

**説明**:
- 例: `click` → `awareness`
- テナント毎にカスタマイズ可能

---

### 7. システム

#### 7.1 schema_migrations - マイグレーション履歴

**目的**: スキーママイグレーションの実行履歴管理。

**ファイルパス**: `app/db/schema/migrations.ts`

```typescript
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const schemaMigrations = pgTable('schema_migrations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**説明**:
- Drizzle Kitまたはカスタムマイグレーションツール用
- マイグレーション名と実行日時を記録

---

## スキーマファイル構成

実装時は以下のファイル構成でスキーマを定義する：

```
app/db/schema/
├── index.ts                    # 全テーブルのエクスポート
├── admin.ts                    # 管理系（5テーブル）
├── core.ts                     # コアエンティティ（5テーブル）
├── campaigns.ts                # キャンペーン/リソース（3テーブル）
├── activities.ts               # アクティビティ（2テーブル）
├── plugins.ts                  # プラグイン/インポート（5テーブル）
├── analytics.ts                # 分析/ファネル（4テーブル）
└── migrations.ts               # システム（1テーブル）
```

**index.ts 構造**:
```typescript
// app/db/schema/index.ts
export * from './admin';
export * from './core';
export * from './campaigns';
export * from './activities';
export * from './plugins';
export * from './analytics';
export * from './migrations';
```

---

## 実装時の注意事項

### PostgreSQL拡張機能

マイグレーション前に以下の拡張機能を有効化する：

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
```

### マルチテナント分離

- 全テーブルに`tenant_id`カラムを含める
- Row Level Security (RLS)で自動的にテナント分離を実現（Task 3.5で実装）

### インデックス戦略

- 複合インデックス: `(tenant_id, ...)` の順序で定義
- GINインデックス: `activities.metadata`用（JSON検索）- マイグレーション時に手動追加
- タイムスタンプ: 特に指定のない限りDESC順（最新レコード優先）

### タイムスタンプ管理

- `createdAt`: `defaultNow()`で自動設定
- `updatedAt`: アプリケーション側でトリガーまたは手動更新

### 外部キー制約

- `onDelete: 'cascade'`: テナント削除時に関連データも削除
- `onDelete: 'set null'`: 参照先削除時にNULL設定（開発者削除時等）

### 重複排除

- `dedupKey`: `hash(tenant_id, provider, external_user_id)`等の一意ハッシュ
- `UNIQUE`制約で重複挿入を防止

### CITEXT型の扱い

Drizzle ORMには`citext`型の直接サポートがないため、`text`型として定義する。PostgreSQL側でCITEXT列として扱うには：

1. マイグレーション生成後、SQLファイルを手動編集
2. `text`を`citext`に置換（該当カラムのみ）

対象カラム:
- `users.email`
- `organizations.domain_primary`
- `developers.primary_email`
- `accounts.email`

---

## まとめ

本ドキュメントでは、DRMコアシステムに必要な全25テーブルのDrizzle ORM定義を提示した。実装時は以下の7ファイルに分割し、`app/db/schema/index.ts`で統合する：

1. `admin.ts` - 管理系（5テーブル）
2. `core.ts` - コアエンティティ（5テーブル）
3. `campaigns.ts` - キャンペーン/リソース（3テーブル）
4. `activities.ts` - アクティビティ（2テーブル）
5. `plugins.ts` - プラグイン/インポート（5テーブル）
6. `analytics.ts` - 分析/ファネル（4テーブル）
7. `migrations.ts` - システム（1テーブル）

次のTask 3.3以降で実装とマイグレーションを進める。
