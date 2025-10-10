# 詳細設計書 - DRM（Developer Relations Management）ツール

**Version:** 2.2
**Author:** Atsushi Nakatsugawa
**Based on:** requirements.md v2.2

---

## 1. アーキテクチャ概要

### 1.1 システム構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                         User (Browser)                          │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS (Cloudflare SSL)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                        nginx (Reverse Proxy)                     │
│  - SSL Termination                                              │
│  - Load Balancing                                               │
│  - Static File Serving                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Remix Application (core/)                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  UI Layer (routes/)                                        │ │
│  │    - Dashboard Views                                       │ │
│  │    - Admin Console                                         │ │
│  │    - Plugin Management UI                                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  API Layer (routes/api/)                                   │ │
│  │    - Remix Resource Routes                                 │ │
│  │    - REST Endpoints (action/loader)                        │ │
│  │    - Webhook Handlers                                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Service Layer (services/)                                 │ │
│  │    - DRM Service (Developer/Organization/Activity)         │ │
│  │    - ROI Service (Campaign/Budget)                         │ │
│  │    - Funnel Service (Stages/Analytics)                     │ │
│  │    - AI Service (SaaS only)                                │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Plugin System (plugin-system/)                            │ │
│  │    - Plugin Loader                                         │ │
│  │    - Hook Registry                                         │ │
│  │    - Job Scheduler (Redis Queue)                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Data Layer (db/)                                          │ │
│  │    - Drizzle ORM                                           │ │
│  │    - Migration System                                      │ │
│  │    - Tenant Isolation (RLS)                                │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────┬──────────────────────────────┬────────────────────┬────┘
         │                              │                    │
         ↓                              ↓                    ↓
┌─────────────────┐         ┌─────────────────┐   ┌─────────────────┐
│   PostgreSQL    │         │      Redis      │   │    Plugins      │
│   (Database)    │         │  (Queue/Cache)  │   │  (plugins/)     │
│  - Core Data    │         │  - Jobs         │   │  - PostHog      │
│  - Tenants      │         │  - Sessions     │   │  - Webhook      │
│  - RLS Policies │         │  - Rate Limit   │   │  - (Future)     │
└─────────────────┘         └─────────────────┘   └─────────────────┘
```

### 1.2 技術スタック

#### 言語
- **TypeScript 5.9+** (Strict mode with `exactOptionalPropertyTypes`)
- **Node.js 20+** (LTS)

#### フレームワーク
- **Remix 2.x** - UI/SSR framework + API routes
- **Drizzle ORM** - Type-safe database access
- **Vitest** - Testing framework

#### ライブラリ
- **Zod** - Schema validation
- **React 18** - UI components
- **PostHog Node SDK** - Analytics integration
- **BullMQ** - Job queue (Redis-based)
- **jose** - JWT handling
- **csv-parse** - CSV import

#### ツール
- **pnpm** - Package manager (workspace monorepo)
- **ESLint 9** - Linting (flat config)
- **Prettier** - Code formatting
- **Docker & Docker Compose** - Container orchestration

#### Infrastructure
- **PostgreSQL 15+** - Primary database with RLS
- **Redis 7** - Queue, cache, rate limiting
- **nginx** - Reverse proxy and SSL termination
- **Cloudflare** - DNS, DDoS protection, SSL

---

## 2. コンポーネント設計

### 2.1 コンポーネント一覧

| コンポーネント名 | 責務 | 依存関係 |
|----------------|------|---------|
| **UI Layer** | ユーザーインターフェース、ダッシュボード、管理画面 | Service Layer, Plugin System |
| **API Layer** | REST/GraphQL エンドポイント、Webhook ハンドラ | Service Layer, Plugin System |
| **Service Layer** | ビジネスロジック、DRM/ROI/Funnel/AI処理 | Data Layer |
| **Plugin System** | プラグイン読込、フック実行、ジョブスケジューラ | Data Layer, Redis |
| **Data Layer** | データベースアクセス、マイグレーション、RLS | PostgreSQL |
| **PostHog Plugin** | 匿名データ収集・ファネル統合 | PostHog API, Service Layer |
| **Webhook Plugin** | 外部システム連携（例示用） | API Layer |

### 2.2 各コンポーネントの詳細

#### UI Layer (`core/ui/`)

- **目的**: ユーザーに対するダッシュボード、管理画面、プラグイン管理UIの提供
- **公開インターフェース**:
  ```typescript
  // routes/dashboard.tsx
  export default function Dashboard() {
    const data = useLoaderData<DashboardData>();
    return <OverviewPanel data={data} />;
  }

  // routes/admin/plugins.tsx
  export default function PluginsAdmin() {
    const plugins = useLoaderData<Plugin[]>();
    return <PluginList plugins={plugins} />;
  }
  ```

- **内部実装方針**:
  - Remix の `loader` / `action` で API 呼び出し
  - プラグインが提供する UI ウィジェットを動的にレンダリング
  - Chart.js または Recharts でグラフ表示
  - TailwindCSS でレスポンシブデザイン

---

#### API Layer (`core/routes/api/`)

- **目的**: 外部からのデータ登録、Webhook 受信、プラグイン API ルーティング
- **公開インターフェース**:
  ```typescript
  // routes/api/activities.ts (Remix Resource Route)
  import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/node';
  import { z } from 'zod';

  const activitySchema = z.object({
    type: z.string(),
    developer_id: z.string().uuid(),
    source: z.string(),
    metadata: z.record(z.any()),
  });

  export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = activitySchema.parse(await request.json());
    const activity = await activityService.create(body);
    return json(activity, { status: 201 });
  }

  export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const developerId = url.searchParams.get('developer_id');

    if (!developerId) {
      return json({ error: 'Missing developer_id' }, { status: 400 });
    }

    const activities = await activityService.list(developerId);
    return json({ activities });
  }
  ```

- **内部実装方針**:
  - Remix Resource Routes で REST API を実装
  - `action` で POST/PUT/DELETE、`loader` で GET
  - Zod でリクエストバリデーション
  - JWT トークンによる認証（SaaS）
  - プラグインが登録した Webhook エンドポイントを動的にルーティング

---

#### Service Layer (`core/services/`)

- **目的**: ビジネスロジックの実装（DRM、ROI、Funnel、AI）
- **公開インターフェース**:
  ```typescript
  // services/drm.service.ts
  export interface DRMService {
    createDeveloper(data: CreateDeveloperInput): Promise<Developer>;
    resolveDeveloper(identifiers: Identifier[]): Promise<Developer | null>;
    mergeDevelopers(sourceId: string, targetId: string): Promise<void>;
    listActivities(developerId: string, filters?: ActivityFilters): Promise<Activity[]>;
  }

  // services/roi.service.ts
  export interface ROIService {
    createCampaign(data: CreateCampaignInput): Promise<Campaign>;
    calculateROI(campaignId: string): Promise<ROIResult>;
    trackClick(clickId: string, campaignId: string): Promise<void>;
    generateShortURL(campaignId: string, target: string): Promise<string>;
  }

  // services/funnel.service.ts
  export interface FunnelService {
    classifyStage(activity: Activity): FunnelStage;
    calculateDropRate(stage: FunnelStage): Promise<number>;
    getTimeSeriesFunnel(from: Date, to: Date): Promise<FunnelTimeSeries>;
  }
  ```

- **内部実装方針**:
  - 各サービスは Data Layer を通じて DB アクセス
  - トランザクション管理は Drizzle ORM で実施
  - AI Service（SaaS 限定）は OpenAI / Claude / Gemini API を呼び出し
  - ID 統合ロジックは `resolveDeveloper()` で一元管理

---

#### Plugin System (`core/plugin-system/`)

- **目的**: プラグインの読み込み、フック実行、ジョブスケジューリング
- **公開インターフェース**:
  ```typescript
  // plugin-system/types.ts
  export interface Plugin {
    id: string;
    name: string;
    version: string;
    hooks: {
      onInit?(ctx: PluginContext): void;
      onActivityCreated?(activity: Activity): Promise<void>;
      onCronJob?(schedule: string, job: JobHandler): void;
    };
  }

  export interface PluginContext {
    registerJob(name: string, schedule: string, handler: JobHandler): void;
    registerUI(slot: string, component: React.ComponentType): void;
    registerAPI(path: string, handler: RemixActionHandler): void;
    db: DrizzleDB;
    redis: RedisClient;
  }

  // plugin-system/loader.ts
  export class PluginLoader {
    async discoverPlugins(): Promise<Plugin[]>;
    async loadPlugin(packageName: string): Promise<Plugin>;
    async verifySignature(plugin: Plugin, signature: string): Promise<boolean>;
    async enablePlugin(pluginId: string): Promise<void>;
    async disablePlugin(pluginId: string): Promise<void>;
    async getInstalledPlugins(): Promise<Array<{ name: string; version: string; enabled: boolean }>>;
  }
  ```

- **内部実装方針**:
  - プラグインは npm パッケージとして配布（`@drm-plugin/xxx` または `drm-plugin-xxx`）
  - `pnpm add @drm-plugin/posthog` でインストール
  - `node_modules/` からプラグインを検出・読み込み
  - 管理画面でプラグインを有効化/無効化
  - 有効化状態は DB（`plugins` テーブル）に保存
  - プラグインの署名検証は RSA256 で実施（商用プラグインのみ）
  - BullMQ で Redis ベースのジョブキュー管理
  - プラグインが登録した UI コンポーネントを動的にレンダリング

---

#### Data Layer (`core/db/`)

- **目的**: データベーススキーマ、マイグレーション、RLS ポリシー管理
- **公開インターフェース**:
  ```typescript
  // db/schema.ts
  import { pgTable, uuid, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

  export const developers = pgTable('developers', {
    developer_id: uuid('developer_id').primaryKey().defaultRandom(),
    tenant_id: text('tenant_id').notNull().default('default'),
    display_name: text('display_name').notNull(),
    primary_email: text('primary_email'),
    organization_id: uuid('organization_id'),
    consent_analytics: boolean('consent_analytics').default(false),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
  });

  export const organizations = pgTable('organizations', {
    organization_id: uuid('organization_id').primaryKey().defaultRandom(),
    tenant_id: text('tenant_id').notNull().default('default'),
    name: text('name').notNull(),
    domain: text('domain'),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
  });

  export const activities = pgTable('activities', {
    activity_id: uuid('activity_id').primaryKey().defaultRandom(),
    tenant_id: text('tenant_id').notNull().default('default'),
    developer_id: uuid('developer_id').references(() => developers.developer_id),
    type: text('type').notNull(),
    source: text('source').notNull(),
    metadata: jsonb('metadata'),
    ts: timestamp('ts').notNull(),
  });

  export const plugins = pgTable('plugins', {
    plugin_id: text('plugin_id').primaryKey(), // e.g., 'posthog', 'webhook'
    tenant_id: text('tenant_id').notNull().default('default'),
    package_name: text('package_name').notNull(), // e.g., '@drm-plugin/posthog'
    version: text('version').notNull(),
    enabled: boolean('enabled').default(false),
    config: jsonb('config'), // プラグイン固有の設定
    installed_at: timestamp('installed_at').defaultNow(),
    enabled_at: timestamp('enabled_at'),
  });

  export const plugin_logs = pgTable('plugin_logs', {
    log_id: uuid('log_id').primaryKey().defaultRandom(),
    plugin_id: text('plugin_id').references(() => plugins.plugin_id),
    tenant_id: text('tenant_id').notNull().default('default'),
    status: text('status').notNull(), // 'success', 'error', 'warning'
    message: text('message'),
    stack: text('stack'),
    created_at: timestamp('created_at').defaultNow(),
  });
  ```

- **内部実装方針**:
  - Drizzle ORM でスキーマ定義
  - マイグレーションは `drizzle-kit` で管理
  - PostgreSQL RLS で `tenant_id` によるデータ分離
  - 暗号化は PII カラムに対して `pgcrypto` を使用

---

---

#### プラグインのインストールと有効化フロー

```
1. npm パッケージのインストール
   $ pnpm add @drm-plugin/posthog

2. アプリケーション再起動（開発時は自動再起動）
   $ docker-compose restart web

3. プラグイン検出
   - Plugin Loader が node_modules/ をスキャン
   - @drm-plugin/* または drm-plugin-* パッケージを検出
   - package.json の "drm-plugin" フィールドでメタデータ取得

4. 管理画面で有効化
   - /admin/plugins ページで未有効化プラグイン一覧を表示
   - 「有効化」ボタンをクリック
   - DB の plugins テーブルに { plugin_id, enabled: true } を保存
   - onInit フックを実行してジョブ・UI・API を登録

5. プラグイン実行
   - 有効化されたプラグインのみが実行される
   - ジョブスケジューラーでcronジョブを定期実行
```

**package.json の例**
```json
{
  "name": "@drm-plugin/posthog",
  "version": "1.0.0",
  "main": "dist/index.js",
  "drm-plugin": {
    "id": "posthog",
    "name": "PostHog Integration",
    "description": "Integrate anonymous analytics data from PostHog",
    "signature": "base64-encoded-signature-for-commercial-plugins"
  }
}
```

---

#### PostHog Plugin (`@drm-plugin/posthog`)

- **目的**: 匿名ユーザーの行動データを PostHog から取得し、DRM ファネルと統合
- **公開インターフェース**:
  ```typescript
  // @drm-plugin/posthog/src/index.ts
  import { definePlugin } from '@drm/core/plugin-system';

  export default definePlugin({
    id: 'posthog',
    name: 'PostHog Integration',
    version: '1.0.0',
    hooks: {
      onInit(ctx) {
        ctx.registerJob('posthog.sync', '0 */6 * * *', syncPostHogData);
        ctx.registerUI('dashboard.funnel', FunnelChart);
      },
    },
  });

  async function syncPostHogData(ctx: PluginContext) {
    const events = await fetchPostHogEvents(ctx);
    await mergeAnonymousFunnel(ctx, events);
  }
  ```

**インストール方法**
```bash
# プラグインをインストール
pnpm add @drm-plugin/posthog

# アプリケーションを再起動
docker-compose restart web

# 管理画面 (/admin/plugins) で有効化
```

- **内部実装方針**:
  - PostHog Node SDK で Capture API からイベント取得
  - `distinct_id = click_id` で匿名データを識別
  - DRM の `Activity` と統合してファネル分析に反映
  - cron で定期的に同期（6時間ごと）

---

#### Webhook Plugin (`@drm-plugin/webhook`)

- **目的**: 外部システムからのデータ受信（商用プラグイン例示）
- **公開インターフェース**:
  ```typescript
  // @drm-plugin/webhook/src/index.ts
  import { definePlugin } from '@drm/core/plugin-system';

  export default definePlugin({
    id: 'webhook',
    name: 'Webhook Integration',
    version: '1.0.0',
    hooks: {
      onInit(ctx) {
        ctx.registerAPI('/webhook/:eventType', handleWebhook);
      },
    },
  });

  async function handleWebhook({ request, params }: ActionFunctionArgs) {
    const eventType = params.eventType;
    const payload = await request.json();
    await processWebhookEvent(eventType, payload);
    return json({ success: true });
  }
  ```

**インストール方法**
```bash
# プラグインをインストール
pnpm add @drm-plugin/webhook

# アプリケーションを再起動
docker-compose restart web

# 管理画面 (/admin/plugins) で有効化
```

- **内部実装方針**:
  - Remix Resource Routes で Webhook エンドポイントを動的に登録
  - イベントタイプに応じて Activity を作成
  - 署名検証（HMAC-SHA256）でセキュリティ確保

---

## 3. データフロー

### 3.1 データフロー図

```
┌───────────────────────────────────────────────────────────────────┐
│                     データ登録フロー                                │
└───────────────────────────────────────────────────────────────────┘

[User/External System]
         │
         ├─────────────┬─────────────┬─────────────┐
         │             │             │             │
         ↓             ↓             ↓             ↓
    [Form Input]   [API POST]   [CSV Upload]  [Webhook]
         │             │             │             │
         └─────────────┴─────────────┴─────────────┘
                       │
                       ↓
                 [API Layer]
                  (Validation)
                       │
                       ↓
                [Service Layer]
             (Business Logic)
                       │
                       ↓
                 [Data Layer]
               (Drizzle ORM)
                       │
                       ↓
                 [PostgreSQL]
                       │
                       ↓
              [Plugin Hooks]
           (onActivityCreated)
                       │
                       ↓
             [Background Jobs]
              (Redis Queue)


┌───────────────────────────────────────────────────────────────────┐
│                   ファネル分析フロー                                │
└───────────────────────────────────────────────────────────────────┘

[PostHog Events] ──┐
                   │
[DRM Activities] ──┼──→ [Funnel Service]
                   │      - classifyStage()
[Plugin Data] ─────┘      - calculateDropRate()
                              │
                              ↓
                       [Dashboard UI]
                         (Charts)


┌───────────────────────────────────────────────────────────────────┐
│                      ROI分析フロー                                 │
└───────────────────────────────────────────────────────────────────┘

[Campaign] ────────┐
                   │
[Budget] ──────────┼──→ [ROI Service]
                   │      - calculateROI()
[Click Tracking] ──┘      - aggregateContribution()
                              │
                              ↓
                        [ROI Dashboard]
                     (投資対効果グラフ)
```

### 3.2 データ変換

#### 入力データ形式

**Activity 登録 (JSON)**
```json
{
  "type": "event_participation",
  "developer_id": "550e8400-e29b-41d4-a716-446655440000",
  "source": "connpass",
  "metadata": {
    "event_name": "DevRel Meetup Tokyo",
    "attended": true,
    "role": "speaker"
  },
  "ts": "2025-10-10T10:00:00Z"
}
```

**CSV インポート (connpass エクスポート)**
```csv
nickname,email,event_title,attendance,date
山田太郎,yamada@example.com,DevRel Meetup Tokyo,出席,2025-10-10
```

#### 処理過程

1. **バリデーション**: Zod スキーマでデータ検証
2. **ID 統合**: メールアドレスから既存 Developer を検索または新規作成
3. **ファネル分類**: Activity の type と metadata から Funnel Stage を推定
4. **プラグイン通知**: `onActivityCreated` フックを実行
5. **データ保存**: PostgreSQL に INSERT

#### 出力データ形式

**Activity レスポンス (JSON)**
```json
{
  "activity_id": "660e8400-e29b-41d4-a716-446655440001",
  "developer_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "event_participation",
  "source": "connpass",
  "metadata": {
    "event_name": "DevRel Meetup Tokyo",
    "attended": true,
    "role": "speaker"
  },
  "ts": "2025-10-10T10:00:00Z",
  "created_at": "2025-10-10T10:05:00Z"
}
```

---

## 4. APIインターフェース

### 4.1 内部API（モジュール間）

#### Service → Data Layer

```typescript
// services/drm.service.ts
import { db } from '@/db/connection';
import { developers, activities } from '@/db/schema';

export class DRMService {
  async createDeveloper(data: CreateDeveloperInput): Promise<Developer> {
    return db.insert(developers).values(data).returning();
  }
}
```

#### Plugin → Service Layer

```typescript
// plugins/posthog/sync.ts
import { DRMService } from '@drm/core/services/drm.service';

export async function syncPostHogData(ctx: PluginContext) {
  const drmService = new DRMService(ctx.db);
  await drmService.createActivity({ ... });
}
```

### 4.2 外部API（REST）

#### Activity API

**POST /api/activities**
```typescript
// Request
{
  "type": "github_contribution",
  "developer_id": "uuid",
  "source": "github",
  "metadata": { "repo": "org/repo", "pr_number": 123 }
}

// Response (201)
{
  "activity_id": "uuid",
  "created_at": "2025-10-10T10:00:00Z"
}
```

**GET /api/activities?developer_id=uuid**
```typescript
// Response (200)
{
  "activities": [
    {
      "activity_id": "uuid",
      "type": "github_contribution",
      "ts": "2025-10-10T10:00:00Z"
    }
  ]
}
```

#### ROI API

**POST /api/campaigns**
```typescript
// Request
{
  "name": "DevRel Conference Sponsorship",
  "budget": 500000,
  "start_date": "2025-10-01",
  "end_date": "2025-10-15"
}

// Response (201)
{
  "campaign_id": "uuid",
  "short_url": "https://devcle.com/c/abc123"
}
```

**GET /api/campaigns/:id/roi**
```typescript
// Response (200)
{
  "campaign_id": "uuid",
  "budget": 500000,
  "clicks": 1200,
  "conversions": 80,
  "roi": 0.32
}
```

#### Plugin API

**GET /api/plugins**
```typescript
// Response (200)
{
  "plugins": [
    {
      "id": "posthog",
      "package_name": "@drm-plugin/posthog",
      "name": "PostHog Integration",
      "description": "Integrate anonymous analytics data from PostHog",
      "version": "1.0.0",
      "enabled": true,
      "installed_at": "2025-10-10T10:00:00Z",
      "enabled_at": "2025-10-10T10:05:00Z"
    },
    {
      "id": "webhook",
      "package_name": "@drm-plugin/webhook",
      "name": "Webhook Integration",
      "version": "1.0.0",
      "enabled": false,
      "installed_at": "2025-10-10T11:00:00Z"
    }
  ]
}
```

**POST /api/plugins/:id/enable**
```typescript
// Request
{
  "config": {
    "api_key": "phc_xxxxxx",
    "project_id": "12345"
  }
}

// Response (200)
{
  "success": true,
  "plugin_id": "posthog",
  "enabled": true
}
```

**POST /api/plugins/:id/disable**
```typescript
// Response (200)
{
  "success": true,
  "plugin_id": "posthog",
  "enabled": false
}
```

**GET /api/plugins/:id/logs**
```typescript
// Response (200)
{
  "logs": [
    {
      "log_id": "uuid",
      "status": "success",
      "message": "Synced 1200 events from PostHog",
      "created_at": "2025-10-10T12:00:00Z"
    },
    {
      "log_id": "uuid",
      "status": "error",
      "message": "Failed to connect to PostHog API",
      "stack": "Error: Connection timeout...",
      "created_at": "2025-10-10T06:00:00Z"
    }
  ]
}
```

---

## 5. エラーハンドリング

### 5.1 エラー分類

#### 1. バリデーションエラー（400 Bad Request）
- **発生条件**: 不正な入力データ
- **対処方法**: Zod エラーメッセージを返却
```typescript
return json({
  error: 'Validation failed',
  details: zodError.errors
}, { status: 400 });
```

#### 2. 認証エラー（401 Unauthorized）
- **発生条件**: JWT トークンが無効または期限切れ
- **対処方法**: トークン再取得を促す
```typescript
return json({
  error: 'Invalid token',
  message: 'Please re-authenticate'
}, { status: 401 });
```

#### 3. 権限エラー（403 Forbidden）
- **発生条件**: テナント外のリソースへのアクセス
- **対処方法**: RLS で自動的にブロック、ログに記録
```typescript
return json({
  error: 'Access denied',
  message: 'You do not have permission to access this resource'
}, { status: 403 });
```

#### 4. リソース未検出（404 Not Found）
- **発生条件**: 存在しない Developer/Activity/Campaign
- **対処方法**: 明確なエラーメッセージを返却
```typescript
return json({
  error: 'Resource not found',
  message: 'Developer with ID xxx not found'
}, { status: 404 });
```

#### 5. プラグインエラー（500 Internal Server Error）
- **発生条件**: プラグインの実行に失敗
- **対処方法**: `plugin_logs` にエラー詳細を記録、管理画面に表示
```typescript
await db.insert(pluginLogs).values({
  plugin_id: 'posthog',
  status: 'error',
  message: error.message,
  stack: error.stack,
});
```

#### 6. 外部API エラー（502 Bad Gateway）
- **発生条件**: PostHog/GitHub などの外部 API が応答しない
- **対処方法**: リトライロジック（指数バックオフ）、エラー通知
```typescript
for (let i = 0; i < 3; i++) {
  try {
    return await fetchPostHogAPI();
  } catch (error) {
    if (i === 2) throw error;
    await sleep(2 ** i * 1000);
  }
}
```

### 5.2 エラー通知

#### ログ戦略
- **エラーレベル**: `error` (重大), `warn` (注意), `info` (情報)
- **ログ出力先**: `stdout` (JSON形式) → Docker logs → CloudWatch/Datadog
- **プラグインエラー**: `plugin_logs` テーブルに保存し、管理画面で閲覧可能

#### 通知方法
- **SaaS版**: Webhook で Slack/Discord に通知
- **OSS版**: 管理画面のエラーログビューアで確認

```typescript
// services/notification.service.ts
export async function notifyError(error: Error, context: Record<string, any>) {
  console.error(JSON.stringify({
    level: 'error',
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  }));

  // SaaS版のみ Webhook 通知
  if (process.env.NODE_ENV === 'production') {
    await sendSlackNotification(error, context);
  }
}
```

---

## 6. セキュリティ設計

### 6.1 認証・認可

#### OSS版
- **基本認証**: 環境変数で設定したユーザー名/パスワード
- **セッション管理**: Redis にセッション保存
- **権限**: すべてのユーザーが Admin 権限

#### SaaS版
- **OAuth2 / OpenID Connect**: Google, GitHub SSO
- **JWT トークン**: `access_token` (15分), `refresh_token` (30日)
- **ロールベース権限**: Admin / Manager / Viewer / AI Engine
- **テナント分離**: JWT に `tenant_id` を含め、すべての API で検証

```typescript
// utils/auth.server.ts
import { verify } from 'jose';
import { redirect } from '@remix-run/node';

export async function requireAuth(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    throw json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verify(token, JWT_SECRET);
  return {
    tenantId: payload.tenant_id as string,
    userId: payload.user_id as string,
    role: payload.role as string,
  };
}

// routes/api/activities.ts での使用例
export async function action({ request }: ActionFunctionArgs) {
  const auth = await requireAuth(request);
  // auth.tenantId, auth.userId, auth.role が利用可能
}
```

### 6.2 データ保護

#### 暗号化
- **PII（個人情報）**: `pgcrypto` で列レベル暗号化
  - `primary_email`, `display_name` など
- **API キー**: Hashicorp Vault または AWS Secrets Manager で管理

#### PostgreSQL RLS
```sql
-- developers テーブルの RLS ポリシー
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON developers
  USING (tenant_id = current_setting('app.tenant_id')::text);

-- organizations テーブルの RLS ポリシー
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON organizations
  USING (tenant_id = current_setting('app.tenant_id')::text);
```

#### Redis セキュリティ
- **認証**: `requirepass` で Redis パスワード設定
- **ネットワーク**: Docker 内部ネットワークのみアクセス可能

#### HTTPS/SSL
- **Cloudflare**: Flexible SSL または Full SSL
- **nginx**: Let's Encrypt 証明書自動更新

---

## 7. テスト戦略

### 7.1 単体テスト

#### カバレッジ目標
- **Service Layer**: 90%以上
- **Data Layer**: 80%以上
- **Plugin System**: 85%以上

#### テストフレームワーク
- **Vitest**: 高速な単体テスト
- **Test Containers**: PostgreSQL/Redis のテスト用コンテナ

```typescript
// services/drm.service.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DRMService } from './drm.service';
import { setupTestDB, teardownTestDB } from '@/test/utils';

describe('DRMService', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  it('should create a developer', async () => {
    const service = new DRMService(testDB);
    const developer = await service.createDeveloper({
      display_name: 'Test User',
      primary_email: 'test@example.com',
    });
    expect(developer.developer_id).toBeDefined();
  });
});
```

### 7.2 統合テスト

#### テストシナリオ
1. **Activity 登録フロー**: API → Service → DB → Plugin Hook
2. **ROI 計算フロー**: Campaign 作成 → Click 追跡 → ROI 算出
3. **PostHog 同期フロー**: PostHog API → Funnel 統合 → Dashboard 表示

```typescript
// integration/activity-flow.test.ts
import { describe, it, expect } from 'vitest';
import { testClient } from '@/test/utils';

describe('Activity Registration Flow', () => {
  it('should register activity via API and trigger plugin hook', async () => {
    const res = await testClient.post('/api/activities', {
      json: {
        type: 'event_participation',
        developer_id: 'test-uuid',
        source: 'test',
        metadata: {},
      },
    });
    expect(res.status).toBe(201);

    // Plugin hook が実行されたか確認
    const logs = await db.select().from(pluginLogs).where(...);
    expect(logs).toHaveLength(1);
  });
});
```

### 7.3 E2Eテスト

#### ツール
- **Playwright**: ブラウザ自動化テスト

#### テストシナリオ
1. **ダッシュボード表示**: ログイン → Overview → Funnel → ROI
2. **Activity 登録**: フォーム入力 → 保存 → 一覧表示
3. **プラグイン管理**: プラグイン有効化 → 設定入力 → データ同期

---

## 8. パフォーマンス最適化

### 8.1 想定される負荷

#### OSS版
- **ユーザー数**: 10-50人
- **Activity 登録**: 1000件/日
- **ダッシュボードアクセス**: 100回/日

#### SaaS版
- **テナント数**: 100-1000
- **Activity 登録**: 100,000件/日
- **ダッシュボードアクセス**: 10,000回/日

### 8.2 最適化方針

#### データベース
- **インデックス**: `developer_id`, `tenant_id`, `ts` に複合インデックス
```sql
CREATE INDEX idx_activities_developer_ts ON activities (developer_id, ts DESC);
CREATE INDEX idx_activities_tenant ON activities (tenant_id);
```

- **パーティショニング**: `activities` テーブルを月次パーティション
```sql
CREATE TABLE activities_2025_10 PARTITION OF activities
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

#### キャッシュ
- **Redis**: ダッシュボードデータを 5 分間キャッシュ
```typescript
const cacheKey = `dashboard:${tenantId}:overview`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const data = await fetchDashboardData(tenantId);
await redis.setex(cacheKey, 300, JSON.stringify(data));
return data;
```

#### バックグラウンドジョブ
- **BullMQ**: Redis ベースのジョブキュー
- **並列実行**: 複数のワーカープロセスで処理
```typescript
// worker.ts
import { Worker } from 'bullmq';

const worker = new Worker('plugin-jobs', async (job) => {
  await executePluginJob(job.data);
}, { connection: redisConnection });
```

#### 静的ファイル配信
- **nginx**: `/public` ディレクトリを直接配信
- **CDN**: Cloudflare CDN でキャッシュ

---

## 9. デプロイメント

### 9.1 デプロイ構成

#### OSS版（docker-compose）

```yaml
# docker-compose.yml
version: '3.9'
services:
  web:
    build: ./core
    environment:
      DATABASE_URL: postgresql://drm:drm_pass@db:5432/drm_core
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis

  nginx:
    image: nginx:latest
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
      - "443:443"

  db:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    volumes:
      - redis_data:/data
```

**起動コマンド**
```bash
docker-compose up -d
docker-compose exec web pnpm db:migrate
docker-compose exec web pnpm db:seed
```

#### SaaS版（Kubernetes）

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: drm-web
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: web
        image: drm/core:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
```

**デプロイコマンド**
```bash
kubectl apply -f k8s/
kubectl rollout status deployment/drm-web
```

### 9.2 設定管理

#### 環境変数
```bash
# .env.example
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379
JWT_SECRET=xxxxxxxx
POSTHOG_API_KEY=phc_xxxxxx
BASE_URL=https://devcle.com
```

#### シークレット管理
- **OSS版**: `.env` ファイル（`.gitignore` 必須）
- **SaaS版**: AWS Secrets Manager / HashiCorp Vault

---

## 10. 実装上の注意事項

### 一般的な注意事項
- **TypeScript strict mode**: すべてのコードで `strict: true` を遵守
- **exactOptionalPropertyTypes**: `undefined` を明示的に許可しない限り使用禁止
- **any/unknown 禁止**: 型推論できない場合は Zod でスキーマ定義
- **class 禁止**: カスタムエラークラス以外は関数型で実装

### プラグイン開発
- **署名必須**: 商用プラグインは RSA256 署名を添付
- **バージョニング**: semver に従う（例: `1.2.3`）
- **エラー処理**: すべてのフックでエラーをキャッチし `plugin_logs` に記録

### データベース
- **tenant_id 必須**: すべてのテーブルに `tenant_id` カラムを追加
- **RLS 有効化**: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- **マイグレーション**: 後方互換性を保つ（カラム削除時は非推奨化 → 削除）

### セキュリティ
- **PII 暗号化**: `primary_email`, `display_name` は暗号化
- **API キー**: 環境変数で管理、ログに出力しない
- **SQL インジェクション**: Drizzle ORM のパラメータ化クエリを使用

### パフォーマンス
- **N+1 クエリ**: Drizzle の `with()` でリレーションを一括取得
- **大量データ**: ページネーション必須（例: `limit: 100, offset: 0`）
- **バックグラウンド処理**: 重い処理は BullMQ でジョブキューに投入

### テスト
- **Test Containers**: PostgreSQL/Redis のテスト用コンテナを使用
- **モック禁止**: 可能な限り実際の DB を使用
- **テストデータ**: `beforeEach` でクリーンアップ

---

## 11. 今後の実装予定（Phase別）

### Phase 1: Core完成（現在）
- [x] 要件定義
- [ ] 詳細設計
- [ ] タスク分解
- [ ] Core実装（DRM/ROI/Funnel/Plugin System）

### Phase 2: Cloud Plugins
- [ ] Slack/Discord統合
- [ ] connpass/Meetup統合
- [ ] GitHub統合
- [ ] X (Twitter)統合
- [ ] Google Analytics統合
- [ ] Google Search統合
- [ ] PostHog統合

### Phase 3: Dashboard & AI
- [ ] ダッシュボードUI完成
- [ ] AI分析機能（SaaS限定）
- [ ] レポート自動生成

### Phase 4: OSS Release & Cloud Launch
- [ ] OSS版リリース（MIT/BSL）
- [ ] SaaS版ベータリリース
- [ ] 課金システム（Stripe）

### Phase 5: Marketplace
- [ ] プラグインマーケットプレイス
- [ ] 外部開発者向けSDK
- [ ] 署名検証システム

---

## 12. 参考資料

- **Remix**: https://remix.run/docs
- **Remix Resource Routes**: https://remix.run/docs/en/main/guides/resource-routes
- **Drizzle ORM**: https://orm.drizzle.team/
- **PostHog**: https://posthog.com/docs
- **BullMQ**: https://docs.bullmq.io/
- **PostgreSQL RLS**: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

---

**設計書バージョン:** 2.5
**最終更新:** 2025-10-10
**変更履歴:**
- v2.5: 全てのperson/person_id参照をdeveloper/developer_idに修正完了
- v2.4: プラグインのnpmインストール＋管理画面での有効化フローを追加
- v2.3: Person → Developer、Org → Organization に統一、Hono削除しRemix単体化
- v2.2: 初版
