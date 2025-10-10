# 詳細設計書 - DRM (Developer Relations Management) ツール

**Version:** 2.1
**Based on:** requirements.md v2.1
**Date:** 2025-10-10

---

## 1. ディレクトリ構造

### 1.1 プロジェクト全体構造

```
/Users/nakatsugawa/Code/DevRel/devcle/app/
├── core/                    # OSS版コア機能（MIT/BSLライセンス）
│   ├── app/                # Remixアプリケーション
│   │   ├── routes/         # Remixルート（UI + API）
│   │   ├── components/     # UIコンポーネント
│   │   ├── services/       # ビジネスロジック
│   │   ├── utils/          # ユーティリティ関数
│   │   └── root.tsx        # ルートコンポーネント
│   ├── db/                 # データベース層
│   │   ├── schema/         # Drizzleスキーマ定義
│   │   ├── migrations/     # マイグレーションファイル
│   │   ├── seed.ts         # Seedデータ
│   │   └── index.ts        # DB接続初期化
│   ├── workers/            # バックグラウンドワーカー
│   │   ├── queue.ts        # BullMQキュー定義
│   │   └── index.ts        # ワーカー実装
│   ├── plugin-system/      # プラグインシステム
│   │   ├── loader.ts       # プラグインローダー
│   │   ├── types.ts        # プラグインAPI型定義
│   │   └── context.ts      # プラグインコンテキスト
│   ├── public/             # 静的ファイル
│   ├── Dockerfile          # Dockerイメージ定義
│   ├── package.json        # 依存関係管理
│   └── tsconfig.json       # TypeScript設定
│
├── plugins/                # プラグインディレクトリ（各プラグインは独立したフォルダ）
│   ├── developers/         # Developerプラグイン（OSS）
│   │   ├── index.ts        # プラグイン定義
│   │   ├── plugin.json     # メタデータ
│   │   ├── schema/         # プラグイン固有のスキーマ
│   │   │   ├── developers.ts
│   │   │   ├── activities.ts
│   │   │   └── organizations.ts
│   │   ├── routes/         # プラグイン固有のルート
│   │   │   ├── index.tsx   # /developers
│   │   │   ├── $id.tsx     # /developers/:id
│   │   │   └── new.tsx     # /developers/new
│   │   ├── widgets/        # ダッシュボードウィジェット
│   │   │   └── DeveloperStatsWidget.tsx
│   │   ├── services/       # ビジネスロジック
│   │   │   └── developer.service.ts
│   │   ├── package.json    # プラグイン依存関係
│   │   └── README.md       # プラグインドキュメント
│   │
│   ├── funnel/             # ファネル分析プラグイン（OSS）
│   │   ├── index.ts
│   │   ├── plugin.json
│   │   ├── schema/
│   │   │   └── funnel_stages.ts
│   │   ├── routes/
│   │   │   └── index.tsx   # /funnel
│   │   └── widgets/
│   │       └── FunnelChart.tsx
│   │
│   ├── roi/                # ROI分析プラグイン（OSS）
│   │   ├── index.ts
│   │   ├── plugin.json
│   │   ├── schema/
│   │   │   ├── budgets.ts
│   │   │   └── campaigns.ts
│   │   └── routes/
│   │       └── index.tsx   # /roi
│   │
│   ├── audit-log/          # 監査ログプラグイン（Commercial）
│   │   ├── index.ts
│   │   ├── plugin.json
│   │   ├── schema/
│   │   │   └── audit_logs.ts
│   │   └── routes/
│   │       └── index.tsx   # /audit-logs
│   │
│   ├── slack/              # Slack連携プラグイン（Commercial）
│   │   ├── index.ts
│   │   ├── plugin.json
│   │   ├── jobs/
│   │   │   └── sync.ts     # 定期同期ジョブ
│   │   └── widgets/
│   │       └── SlackActivityChart.tsx
│   │
│   ├── discord/            # Discord連携プラグイン（Commercial）
│   │   ├── index.ts
│   │   ├── plugin.json
│   │   └── jobs/
│   │       └── sync.ts
│   │
│   ├── posthog/            # PostHog連携プラグイン（OSS）
│   │   ├── index.ts
│   │   ├── plugin.json
│   │   ├── api/
│   │   │   └── capture.ts
│   │   └── services/
│   │       └── funnel-merge.ts
│   │
│   └── webhook/            # Webhook受信プラグイン（Commercial）
│       ├── index.ts
│       ├── plugin.json
│       └── routes/
│           └── webhook.tsx # /webhook
│
├── .env.example            # 環境変数テンプレート
├── docker-compose.yml      # Docker Compose設定
├── nginx/                  # nginx設定
│   └── nginx.conf
├── pnpm-workspace.yaml     # pnpm workspace設定
└── README.md               # プロジェクトドキュメント
```

### 1.2 ディレクトリ設計の方針

#### core/ - OSS版コア機能
- **責務**: DRMツールの基盤機能（認証、プラグインシステム、データベース管理）
- **ライセンス**: MIT または BSL（検討中）
- **含まれる機能**:
  - Remixアプリケーション（UI + API）
  - プラグインローダー
  - 認証システム（OAuth2）
  - データベース接続管理
  - ワーカーシステム（BullMQ）

#### plugins/ - プラグインディレクトリ
- **責務**: 機能拡張をプラグイン単位で管理
- **構造**: 各プラグインは独立したフォルダとして存在
- **ライセンス**: プラグインごとに個別設定（OSS or Commercial）
- **配置ルール**:
  - OSS版プラグイン: `plugins/` 直下に配置
  - Commercial版プラグイン: `plugins/` 直下に配置（`plugin.json`でライセンス明記）
  - 各プラグインは独立したnpmパッケージとしても配布可能

#### プラグインの構成要素
各プラグインは以下の要素を持つ：

1. **index.ts** - プラグイン定義（`definePlugin()`）
2. **plugin.json** - メタデータ（名前、バージョン、ライセンス）
3. **schema/** - プラグイン固有のデータベーススキーマ
4. **routes/** - プラグイン固有のRemixルート
5. **widgets/** - ダッシュボードウィジェット
6. **services/** - ビジネスロジック
7. **jobs/** - バックグラウンドジョブ（オプション）

### 1.3 プラグインの読み込み順序

```typescript
// core/plugin-system/loader.ts
export async function loadPlugins(): Promise<Plugin[]> {
  const pluginDirs = await fs.readdir('/app/plugins');
  const plugins: Plugin[] = [];

  for (const dir of pluginDirs) {
    const pluginPath = `/app/plugins/${dir}`;
    const pluginModule = await import(`${pluginPath}/index.ts`);
    const plugin = pluginModule.default;

    // plugin.jsonからメタデータ読み込み
    const metadata = await fs.readJSON(`${pluginPath}/plugin.json`);
    plugin.metadata = metadata;

    plugins.push(plugin);
  }

  return plugins;
}
```

### 1.4 プラグインのスキーマ管理

プラグインは独自のデータベーススキーマを定義できる：

```typescript
// plugins/developers/schema/developers.ts
import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const developers = pgTable('developers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  displayName: varchar('display_name', { length: 255 }),
  primaryEmail: varchar('primary_email', { length: 255 }),
});
```

スキーマはプラグインローダーによって自動的にマイグレーションに組み込まれる。

---

## 2. アーキテクチャ概要

### 1.1 システム構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cloudflare (SSL/TLS)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                           nginx (80/443)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Remix App (Port 8080)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  UI Layer (Remix Routes)                                  │  │
│  │  - Dashboard, Funnel, ROI, Plugins, Settings             │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  API Layer (Remix Resource Routes)                       │  │
│  │  - REST API, Webhooks, Auth                              │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Services Layer                                           │  │
│  │  - DeveloperService, ActivityService, ROIService         │  │
│  │  - FunnelService, PluginService                          │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Plugin System                                            │  │
│  │  - Plugin Loader, Hook Manager, Sandbox Runner          │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Data Layer (Drizzle ORM)                                │  │
│  │  - Models, Migrations, Query Builder                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
         ┌──────────────────┐  ┌──────────────────┐
         │  PostgreSQL 15   │  │  PostHog         │
         │  - drm_core DB   │  │  - Event Store   │
         │  - RLS Enabled   │  │  - Analytics     │
         └──────────────────┘  └──────────────────┘
```

### 1.2 技術スタック

#### フロントエンド
- **Framework**: Remix v2.x
- **Language**: TypeScript 5.9+
- **UI Components**: Radix UI / shadcn/ui
- **Styling**: Tailwind CSS
- **Charts**: Recharts / Tremor
- **State Management**: Remix Loaders/Actions (Server-First)

#### バックエンド
- **Framework**: Remix v2.x (Full-stack)
- **ORM**: Drizzle ORM v0.30+
- **Database**: PostgreSQL 15+
- **Cache/Queue**: Redis 7+
- **Job Queue**: BullMQ (プラグイン実行、外部API連携)
- **Auth**: Remix Auth + OAuth2 (GitHub, Google)
- **Session**: Cookie-based sessions (remix-sessions)
- **Validation**: Zod

#### インフラ (OSS版)
- **Container**: Docker + docker-compose
- **Reverse Proxy**: nginx
- **SSL/TLS**: Cloudflare Flexible SSL
- **Analytics**: PostHog (self-hosted or cloud)

#### 開発ツール
- **Package Manager**: pnpm (workspace monorepo)
- **Testing**: Vitest
- **Linting**: ESLint 9 (flat config)
- **Formatting**: Prettier
- **CI/CD**: GitHub Actions

---

## 2. コンポーネント設計

### 2.1 コンポーネント一覧

| コンポーネント名 | 責務 | 依存関係 |
|----------------|------|---------|
| **UI Layer** | ユーザーインターフェース、Remix Routes | Services, Plugin UI |
| **API Layer** | REST API、Webhooks、認証 | Services, Validation |
| **Services** | ビジネスロジック、データ操作 | Data Layer, Plugin System |
| **Plugin System** | プラグインのロード、実行、UI統合 | Plugin Registry, Sandbox |
| **Data Layer** | データベースアクセス、マイグレーション | Drizzle ORM, PostgreSQL |
| **PostHog Integration** | 匿名イベント収集、ファネル突合 | PostHog API, Services |

**開発優先順位**:
1. **Phase 1**: docker-compose環境構築 + 基本UI（ダッシュボード、Developer一覧）
2. **Phase 2**: Developer詳細画面 + Activity登録UI
3. **Phase 3**: Services層実装 + データ連携
4. **Phase 4**: プラグインシステム + PostHog連携

### 2.2 各コンポーネントの詳細

#### UI Layer (Remix Routes)

**目的**: ユーザーが操作するダッシュボード、フォーム、可視化画面を提供

**Routes構成**:
```
app/routes/
  _index.tsx                # Dashboard (Overview) [Phase 1]
  developers._index.tsx     # Developer一覧 [Phase 1]
  developers.$id.tsx        # Developer詳細 [Phase 2]
  activities._index.tsx     # Activity一覧 [Phase 2]
  activities.new.tsx        # Activity登録 [Phase 2]
  funnel.tsx                # Funnel View [Phase 3]
  roi.tsx                   # ROI View [Phase 3]
  campaigns.$id.tsx         # Campaign詳細 [Phase 3]
  plugins._index.tsx        # Plugin管理 [Phase 4]
  plugins.$id.tsx           # Plugin設定 [Phase 4]
  settings.tsx              # システム設定 [Phase 1]
  api.activities.tsx        # API: Activity管理 (Resource Route)
  api.developers.$id.tsx    # API: Developer操作 (Resource Route)
  api.roi.calculate.tsx     # API: ROI計算 (Resource Route)
  api.funnel.tsx            # API: Funnel取得 (Resource Route)
  api.plugins.$id.tsx       # API: Plugin操作 (Resource Route)
  api.webhooks.posthog.tsx  # Webhook: PostHog (Resource Route)
```

**公開インターフェース**:
```typescript
// Remix Loader Pattern
export async function loader({ request, params }: LoaderFunctionArgs) {
  const tenantId = await getTenantFromRequest(request);
  const data = await service.getData(tenantId, params.id);
  return json(data);
}

// Remix Action Pattern
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const result = await service.processAction(formData);
  return redirect('/success');
}
```

**内部実装方針**:
- Server-Firstアプローチ（Loaders/Actionsでデータ取得）
- クライアント側の状態管理は最小限に
- プラグインUIは動的に`<PluginWidget />`コンポーネントで埋め込み

---

#### API Layer (Remix Resource Routes)

**目的**: 外部連携、Webhook受信、REST API提供

**公開インターフェース**:
```typescript
// app/routes/api.activities.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";
import { ActivityService } from "~/services/activity.service";
import { getTenantFromSession } from "~/utils/auth.server";

const ActivitySchema = z.object({
  type: z.string(),
  source: z.string(),
  metadata: z.record(z.unknown()).optional(),
  ts: z.string().datetime(),
});

export async function action({ request }: ActionFunctionArgs) {
  // 認証チェック
  const tenantId = await getTenantFromSession(request);
  if (!tenantId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  // リクエストボディのパース & バリデーション
  const body = await request.json();
  const validatedData = ActivitySchema.parse(body);

  // サービス呼び出し
  const activity = await ActivityService.recordActivity(tenantId, validatedData);

  return json(activity, { status: 201 });
}

// app/routes/api.webhooks.posthog.tsx
export async function action({ request }: ActionFunctionArgs) {
  // Webhook署名検証
  const signature = request.headers.get("X-PostHog-Signature");
  const body = await request.text();

  if (!verifyPostHogSignature(signature, body)) {
    return json({ error: "Invalid signature" }, { status: 403 });
  }

  // Webhook処理
  const event = JSON.parse(body);
  await handlePostHogWebhook(event);

  return json({ success: true });
}
```

**内部実装方針**:
- Remix Resource Routesで REST API + Webhook実装
- 認証はRemix Authのセッション管理を活用
- Zodでリクエストバリデーション
- Webhook署名検証（PostHog, Slack等）
- レート制限はミドルウェアで実装（per-tenant, per-plugin）

---

#### Services Layer

**目的**: ビジネスロジックの実装、データ操作の抽象化

**主要サービス**:

1. **DeveloperService**
```typescript
interface DeveloperService {
  createDeveloper(tenantId: string, data: CreateDeveloperInput): Promise<Developer>;
  mergeDeveloper(tenantId: string, fromId: string, toId: string): Promise<void>;
  getDeveloperTimeline(tenantId: string, developerId: string): Promise<Activity[]>;
  updateEngagementScore(tenantId: string, developerId: string): Promise<number>;
  listDevelopers(tenantId: string, filters?: DeveloperFilters): Promise<Developer[]>;
}
```

2. **ActivityService**
```typescript
interface ActivityService {
  recordActivity(tenantId: string, data: CreateActivityInput): Promise<Activity>;
  linkActivityToDeveloper(activityId: string, developerId: string): Promise<void>;
  getActivitiesBySource(tenantId: string, source: string): Promise<Activity[]>;
  listActivities(tenantId: string, filters?: ActivityFilters): Promise<Activity[]>;
}
```

3. **ROIService**
```typescript
interface ROIService {
  calculateCampaignROI(tenantId: string, campaignId: string): Promise<ROIResult>;
  recordBudget(tenantId: string, data: CreateBudgetInput): Promise<Budget>;
  getROISummary(tenantId: string, dateRange: DateRange): Promise<ROISummary>;
}
```

4. **FunnelService**
```typescript
interface FunnelService {
  updateDeveloperStage(tenantId: string, developerId: string, stage: FunnelStage): Promise<void>;
  getFunnelMetrics(tenantId: string): Promise<FunnelMetrics>;
  mergeFunnelWithPostHog(tenantId: string): Promise<void>;
}
```

5. **PluginService**
```typescript
interface PluginService {
  installPlugin(tenantId: string, pluginId: string): Promise<void>;
  enablePlugin(tenantId: string, pluginId: string): Promise<void>;
  executePluginHook(tenantId: string, pluginId: string, hook: string, args: unknown): Promise<unknown>;
  executeActionHooks(action: string, context: ActionContext): Promise<void>;
  getPluginSettings(tenantId: string, pluginId: string): Promise<Record<string, unknown>>;
}

interface ActionContext {
  tenantId: string;
  userId: string;
  action: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  request: Request;
}
```

**内部実装方針**:
- 各サービスはStateless（Dependency Injection可能）
- トランザクションはDrizzle ORMの`db.transaction()`を使用
- エラーは専用のエラークラスで表現（`DRMError`, `ValidationError`, `NotFoundError`）

---

#### Plugin System

**目的**: 外部機能（Slack, Discord, AI等）をモジュールとして動的にロード・実行

**アーキテクチャ**:
```
plugins/
  slack/
    plugin.json
    index.ts
    ui/
      SlackActivityChart.tsx
    jobs/
      sync.ts
  discord/
    plugin.json
    index.ts
  webhook/
    plugin.json
    index.ts
```

**Plugin定義API**:
```typescript
// plugins/slack/index.ts
import { definePlugin } from '@drm/plugin-sdk';

export default definePlugin({
  id: 'slack',
  name: 'Slack Integration',
  version: '1.0.0',
  author: 'DRM Team',
  license: 'MIT',

  // 設定スキーマ
  settings: {
    apiToken: {
      type: 'string',
      title: 'Slack API Token',
      required: true,
      secret: true,
    },
    workspaceId: {
      type: 'string',
      title: 'Workspace ID',
      required: true,
    },
  },

  // ライフサイクルフック
  hooks: {
    onInit({ registerJob, registerAPI, registerUI, registerActionHook }) {
      // 定期実行ジョブ登録
      registerJob('slack.sync', { cron: '*/15 * * * *' }, syncSlackData);

      // API拡張
      registerAPI('POST', '/slack/webhook', handleSlackWebhook);

      // UI Widget登録
      registerUI('dashboard.panel', SlackSummaryChart);

      // アクションフック登録（監査ログ用）
      registerActionHook('developer.create', logAction);
      registerActionHook('developer.merge', logAction);
    },

    onEnable({ tenantId, settings }) {
      console.log(`Slack plugin enabled for tenant ${tenantId}`);
    },

    onDisable({ tenantId }) {
      console.log(`Slack plugin disabled for tenant ${tenantId}`);
    },
  },

  // UIコンポーネント
  widgets: [
    {
      type: 'chart',
      title: 'Slack Activity',
      component: SlackActivityChart,
    },
    {
      type: 'list',
      title: 'Recent Messages',
      component: RecentMessagesList,
    },
  ],
});
```

**Plugin Loader**:
```typescript
// core/plugin-system/loader.ts
interface PluginLoader {
  loadPlugin(pluginPath: string): Promise<PluginDefinition>;
  verifySignature(pluginPath: string): Promise<boolean>; // 商用版のみ
  registerPlugin(plugin: PluginDefinition): void;
  unregisterPlugin(pluginId: string): void;
}
```

**内部実装方針**:
- プラグインは独立したnpmパッケージとして配布
- OSS版は`/plugins`ディレクトリから自動ロード
- SaaS版は署名検証必須（RSA256）
- プラグイン実行は専用のSandboxで隔離（vm2 or isolated-vm検討）
- エラーは本体に影響しないようcatch

**プラグイン例: 監査ログ**:
```typescript
// plugins/audit-log/index.ts
import { definePlugin } from '@drm/plugin-sdk';

export default definePlugin({
  id: 'audit-log',
  name: 'Audit Log',
  version: '1.0.0',
  author: 'DRM Team',
  license: 'Commercial',

  // スキーマ定義
  schema: {
    auditLogs: {
      id: 'uuid',
      tenantId: 'uuid',
      userId: 'uuid',
      action: 'string', // 'developer.create', 'developer.merge', etc.
      resourceType: 'string', // 'developer', 'activity', etc.
      resourceId: 'uuid',
      metadata: 'jsonb',
      ipAddress: 'string',
      userAgent: 'string',
      createdAt: 'timestamp',
    },
  },

  hooks: {
    onInit({ registerActionHook, registerUI, db }) {
      // すべてのアクションをフック
      const actions = [
        'developer.create',
        'developer.update',
        'developer.delete',
        'developer.merge',
        'activity.create',
        'activity.update',
        'activity.delete',
        'campaign.create',
        'campaign.update',
        'plugin.enable',
        'plugin.disable',
      ];

      actions.forEach((action) => {
        registerActionHook(action, async (context) => {
          await db.insert('audit_logs').values({
            tenantId: context.tenantId,
            userId: context.userId,
            action: context.action,
            resourceType: action.split('.')[0],
            resourceId: context.resourceId,
            metadata: context.metadata,
            ipAddress: context.request.ip,
            userAgent: context.request.headers['user-agent'],
          });
        });
      });

      // UI登録
      registerUI('settings.audit', AuditLogViewer);
    },
  },

  widgets: [
    {
      type: 'list',
      title: 'Recent Audit Logs',
      component: RecentAuditLogs,
    },
  ],
});
```

**コア側のアクションフック実装**:
```typescript
// services/developer.service.ts
export class DeveloperService {
  async createDeveloper(tenantId: string, userId: string, data: CreateDeveloperInput, request: Request): Promise<Developer> {
    const developer = await db.insert(developers).values({
      tenantId,
      ...data,
    });

    // アクションフック実行（監査ログプラグインが記録）
    await pluginSystem.executeActionHooks('developer.create', {
      tenantId,
      userId,
      action: 'developer.create',
      resourceId: developer.id,
      metadata: { displayName: developer.displayName },
      request,
    });

    return developer;
  }
}
```

---

#### Data Layer (Drizzle ORM)

**目的**: データベーススキーマ定義、マイグレーション、クエリビルダー

**スキーマ定義**:
```typescript
// db/schema/developers.ts
import { pgTable, uuid, varchar, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const developers = pgTable('developers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  displayName: varchar('display_name', { length: 255 }),
  primaryEmail: varchar('primary_email', { length: 255 }),
  orgId: uuid('org_id'),
  consentAnalytics: boolean('consent_analytics').default(false),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// db/schema/activities.ts
export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  developerId: uuid('developer_id'),
  type: varchar('type', { length: 100 }).notNull(), // 'event', 'post', 'github', etc.
  source: varchar('source', { length: 100 }), // 'slack', 'connpass', etc.
  metadata: jsonb('metadata'),
  ts: timestamp('ts').defaultNow(),
});

// db/schema/budgets.ts
export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  campaignId: uuid('campaign_id'),
  category: varchar('category', { length: 100 }), // 'labor', 'ad', 'production'
  amount: numeric('amount', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('JPY'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

**RLS (Row Level Security)**:
```sql
-- マイグレーションファイルで実行
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON developers
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

**内部実装方針**:
- Drizzle Kitでマイグレーション管理
- RLSで完全なテナント分離（SaaS版）
- インデックス戦略：`tenant_id`, `developer_id`, `ts`
- JSONBカラムでメタデータの柔軟性確保

**Phase 1での実装範囲**:
- `developers`, `activities`, `organizations`テーブルのみ
- Seed dataで動作確認用のサンプルデータ投入
- マイグレーション実行確認

**Workerの実装**:
```typescript
// workers/index.ts
import { Queue, Worker } from 'bullmq';
import { connection } from './redis';

// キュー定義
export const pluginQueue = new Queue('plugins', { connection });

// ワーカー起動
const worker = new Worker('plugins', async (job) => {
  console.log(`Processing job ${job.id}: ${job.name}`);

  switch (job.name) {
    case 'sync.slack':
      // Phase 4で実装
      break;
    case 'sync.connpass':
      // Phase 4で実装
      break;
    default:
      console.log(`Unknown job: ${job.name}`);
  }
}, { connection });

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});
```

---

#### PostHog Integration

**目的**: 匿名イベントとDRMファネルを統合

**データフロー**:
```
[匿名ユーザー]
  ↓ click_id付きURL訪問
[PostHog Capture API]
  ↓ distinct_id = click_id
[DRM Webhook受信]
  ↓ click_id → developer_id マッピング
[Funnel更新]
```

**公開インターフェース**:
```typescript
// posthog/api/capture.ts
interface PostHogCapture {
  sendEvent(clickId: string, event: string, properties: Record<string, unknown>): Promise<void>;
  linkClickIdToDeveloper(clickId: string, developerId: string): Promise<void>;
}

// posthog/services/funnel-merge.ts
interface FunnelMergeService {
  mergeAnonymousEvents(tenantId: string, developerId: string): Promise<void>;
  getAnonymousFunnelMetrics(tenantId: string): Promise<FunnelMetrics>;
}
```

**Phase 1での実装範囲**:
- PostHog連携はPhase 4まで延期
- まずはDeveloper/Activity手動登録から開始

**内部実装方針**:
- PostHog Node SDKを使用
- click_idは短縮URL生成時に発行（nanoid 16文字）
- Webhookで`$identify`イベントを受信してマッピング
- 匿名イベントは定期的にDRMファネルに統合

---

## 3. データフロー

### 3.1 データフロー図

```
┌──────────────┐
│ User Action  │ (フォーム入力、CSV、API)
└──────┬───────┘
       ▼
┌───────────────────────────┐
│ Remix Routes/Actions      │ (Validation, Auth)
└──────┬────────────────────┘
       ▼
┌──────────────────┐
│ Services Layer   │ (Business Logic)
└──────┬───────────┘
       ▼
┌──────────────────┐
│ Data Layer (ORM) │ (Drizzle ORM)
└──────┬───────────┘
       ▼
┌──────────────────┐
│ PostgreSQL       │ (Persistent Storage)
└──────────────────┘

[External Services]
  ↓
[Plugin System]
  ↓
[Services Layer] → [Data Layer] → [PostgreSQL]
```

### 3.2 データ変換例

#### Example: イベント参加者のCSVアップロード

**入力データ形式** (CSV):
```csv
name,email,company,event_name,participated_at
Alice,alice@example.com,ACME Inc,DevFest 2024,2024-03-15
Bob,bob@example.com,ACME Inc,DevFest 2024,2024-03-15
```

**処理過程**:
1. CSVパース（papaparseライブラリ）
2. バリデーション（Zodスキーマ）
3. Developer名寄せ（email, name）
4. Organization自動生成（company）
5. Activity登録（type='event', source='csv'）

**出力データ形式** (Database):
```typescript
// developers table
{
  id: 'uuid-1',
  tenant_id: 'tenant-uuid',
  display_name: 'Alice',
  primary_email: 'alice@example.com',
  org_id: 'org-uuid-1',
}

// activities table
{
  id: 'activity-uuid-1',
  tenant_id: 'tenant-uuid',
  developer_id: 'uuid-1',
  type: 'event',
  source: 'csv',
  metadata: { event_name: 'DevFest 2024' },
  ts: '2024-03-15T00:00:00Z',
}
```

---

## 4. APIインターフェース

### 4.1 内部API（Services間）

```typescript
// services/developer.service.ts → services/activity.service.ts
const developer = await developerService.createDeveloper(tenantId, data);
await activityService.recordActivity(tenantId, {
  developerId: developer.id,
  type: 'signup',
  source: 'web',
});
```

### 4.2 外部API（REST API）

**認証**: Cookie-based Session (Remix Auth)

**エンドポイント一覧**:

| Method | Endpoint | 説明 | Phase |
|--------|----------|------|-------|
| `GET` | `/api/developers` | Developer一覧取得 | Phase 1 |
| `GET` | `/api/developers/:id` | Developer詳細取得 | Phase 2 |
| `POST` | `/api/developers` | Developer新規登録 | Phase 2 |
| `POST` | `/api/developers/:id/merge` | Developer統合 | Phase 3 |
| `GET` | `/api/activities` | Activity一覧取得 | Phase 2 |
| `POST` | `/api/activities` | Activity登録 | Phase 2 |
| `GET` | `/api/funnel` | ファネルメトリクス | Phase 3 |
| `POST` | `/api/roi/calculate` | ROI計算 | Phase 3 |
| `POST` | `/api/webhooks/posthog` | PostHogイベント受信 | Phase 4 |
| `GET` | `/api/plugins` | プラグイン一覧 | Phase 4 |
| `POST` | `/api/plugins/:id/enable` | プラグイン有効化 | Phase 4 |

**Example Request**:
```bash
curl -X POST https://drm.example.com/api/activities \
  -H "Cookie: __session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "event",
    "source": "connpass",
    "metadata": {
      "event_name": "DevFest 2024",
      "url": "https://connpass.com/event/12345"
    },
    "ts": "2024-03-15T10:00:00Z"
  }'
```

**Example Response**:
```json
{
  "id": "activity-uuid",
  "tenantId": "tenant-uuid",
  "type": "event",
  "source": "connpass",
  "metadata": { "event_name": "DevFest 2024" },
  "ts": "2024-03-15T10:00:00Z",
  "createdAt": "2024-03-15T10:05:00Z"
}
```

---

## 5. エラーハンドリング

### 5.1 エラー分類

| エラータイプ | HTTPステータス | 対処方法 |
|------------|--------------|---------|
| `ValidationError` | 400 | リクエストデータの検証失敗。詳細をレスポンスに含める |
| `AuthenticationError` | 401 | JWT検証失敗。再ログイン促す |
| `AuthorizationError` | 403 | テナントアクセス権限なし。管理者に連絡促す |
| `NotFoundError` | 404 | リソースが見つからない |
| `PluginError` | 500 | プラグイン実行エラー。ログに記録し、本体は継続 |
| `DatabaseError` | 500 | DB接続エラー。リトライ可能ならリトライ |

### 5.2 エラー通知

**ロギング戦略**:
- **構造化ログ**: JSON形式（pino or winston）
- **ログレベル**: `error`, `warn`, `info`, `debug`
- **エラートレース**: スタックトレース + テナントID + リクエストID

**エラーレスポンス例**:
```json
{
  "error": {
    "type": "ValidationError",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    },
    "requestId": "req-uuid"
  }
}
```

**監視**:
- PostHogで`$exception`イベント送信
- SaaS版ではSentry連携検討

---

## 6. セキュリティ設計

### 6.1 認証・認可

**OSS版**:
- ローカル認証（bcrypt）
- セッションベース（cookie-session）

**SaaS版**:
- OAuth2（GitHub, Google）via Remix Auth
- Cookie-based sessions (HTTP-only, Secure, SameSite=Lax)
- Session storage: Redis or Database

**ロール**:
```typescript
enum Role {
  ADMIN = 'admin',       // 全権限
  MANAGER = 'manager',   // 施策・ROI管理
  VIEWER = 'viewer',     // 閲覧のみ
}
```

### 6.2 データ保護

| データ種別 | 保護方法 |
|-----------|---------|
| PII（メール、名前） | PostgreSQL暗号化カラム（pgcrypto） |
| プラグインAPIキー | `settings`テーブル、`secret=true`フィールド |
| Session Secret | 環境変数、`.env`でgitignore |
| Database接続情報 | 環境変数、KMSで暗号化（SaaS版） |

**監査ログ**（プラグインで実装）:
- 監査ログ機能はコアには含めず、プラグインとして実装
- プラグインが各種アクション（developer.merge, plugin.enable等）をフック
- 詳細は「プラグイン例: 監査ログ」セクション参照

---

## 7. テスト戦略

### 7.1 単体テスト

**カバレッジ目標**: 80%以上

**テストフレームワーク**: Vitest

**テスト対象**:
- Services層のビジネスロジック
- Utility関数（ROI計算、ファネル集計）
- バリデーションスキーマ（Zod）

**Example**:
```typescript
// services/__tests__/roi.service.test.ts
import { describe, it, expect } from 'vitest';
import { ROIService } from '../roi.service';

describe('ROIService', () => {
  it('should calculate ROI correctly', () => {
    const roi = ROIService.calculateROI({ investment: 100, return: 150 });
    expect(roi).toBe(0.5); // 50% ROI
  });
});
```

### 7.2 統合テスト

**アプローチ**:
- PostgreSQL（Testcontainers or docker-compose）でテスト用DB
- APIエンドポイントのE2Eテスト（supertest）

**Example**:
```typescript
// routes/__tests__/api.activities.test.ts
import { describe, it, expect } from 'vitest';
import { createRemixStub } from '@remix-run/testing';
import { action } from '../api.activities';

describe('POST /api/activities', () => {
  it('should create activity', async () => {
    const request = new Request('http://localhost/api/activities', {
      method: 'POST',
      body: JSON.stringify({ type: 'event', source: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await action({ request, params: {}, context: {} });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty('id');
  });
});
```

### 7.3 プラグインテスト

- プラグインは独立したテストスイート
- Mockサーバーで外部API（Slack, connpass）をシミュレート

---

## 8. パフォーマンス最適化

### 8.1 想定される負荷

**OSS版**:
- 開発者数: ~1,000人
- 月間アクティビティ: ~10,000件
- 同時接続数: ~10ユーザー

**SaaS版**:
- テナント数: ~100
- 総開発者数: ~100,000人
- 月間アクティビティ: ~1,000,000件
- 同時接続数: ~100ユーザー

### 8.2 最適化方針

| 施策 | 効果 |
|------|------|
| **DB Indexing** | `tenant_id`, `developer_id`, `ts`にIndex |
| **Query Optimization** | N+1問題を回避（Drizzleの`with`で一括取得） |
| **Caching** | Redis（ファネルメトリクス、ROIサマリ） |
| **CDN** | 静的アセット配信（Cloudflare） |
| **Job Queue** | 重い処理（AI分析、外部API同期）を非同期化 |
| **Connection Pool** | PostgreSQL接続プール（pg-pool） |

**Example**: Redis Cache
```typescript
// services/funnel.service.ts
async getFunnelMetrics(tenantId: string): Promise<FunnelMetrics> {
  const cacheKey = `funnel:${tenantId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const metrics = await this.calculateFunnelMetrics(tenantId);
  await redis.set(cacheKey, JSON.stringify(metrics), 'EX', 300); // 5分キャッシュ
  return metrics;
}
```

---

## 9. デプロイメント

### 9.1 デプロイ構成（OSS版）

**docker-compose構成**:
```yaml
version: '3.9'
services:
  web:
    build: .
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://drm:drm_pass@db:5432/drm_core
      REDIS_URL: redis://redis:6379
      POSTHOG_API_KEY: ${POSTHOG_API_KEY}
      SESSION_SECRET: ${SESSION_SECRET}
    depends_on:
      - db
      - redis
      - posthog

  worker:
    build: .
    command: pnpm worker:start
    environment:
      DATABASE_URL: postgres://drm:drm_pass@db:5432/drm_core
      REDIS_URL: redis://redis:6379
      POSTHOG_API_KEY: ${POSTHOG_API_KEY}
    depends_on:
      - db
      - redis

  nginx:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - web

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: drm
      POSTGRES_PASSWORD: drm_pass
      POSTGRES_DB: drm_core
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  posthog:
    image: posthog/posthog:latest
    environment:
      DATABASE_URL: postgres://posthog:posthog@db:5432/posthog
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis
    ports:
      - "8000:8000"

volumes:
  postgres_data:
  redis_data:
```

**起動手順**:
```bash
# 1. 環境変数設定
cp .env.example .env
vim .env  # 編集

# 2. Docker起動
docker-compose up -d

# 3. マイグレーション
docker-compose exec web pnpm db:migrate

# 4. 初期データ投入
docker-compose exec web pnpm db:seed
```

### 9.2 設定管理

**環境変数** (`.env`):
```bash
# Database
DATABASE_URL=postgres://drm:drm_pass@db:5432/drm_core

# Redis
REDIS_URL=redis://redis:6379

# PostHog
POSTHOG_API_KEY=phc_xxx
POSTHOG_HOST=http://posthog:8000

# Auth
SESSION_SECRET=your-secret-key

# Plugins
PLUGIN_PATH=/app/plugins

# Worker
WORKER_CONCURRENCY=5
```

**SaaS版追加設定**:
```bash
# OAuth
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# Redis
REDIS_URL=redis://localhost:6379

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## 10. 実装上の注意事項

### 10.1 必須事項

1. **テナント分離の徹底**
   - すべてのクエリに`tenant_id`を含める
   - RLSを必ず有効化（SaaS版）
   - Middlewareでテナント検証

2. **プラグインのサンドボックス化**
   - プラグインエラーが本体に影響しないようcatch
   - 署名検証を必須に（SaaS版）
   - APIレート制限

3. **監査ログ**
   - コアには含めず、プラグインとして提供
   - プラグインがアクションフックを利用して記録
   - SaaS版では監査ログプラグインを必須化

4. **非同期処理の実装**
   - 外部API連携（Slack, connpass）は必ずJob Queue経由
   - BullMQ + Redis推奨

5. **エラーハンドリング**
   - すべてのエラーを構造化ログに記録
   - ユーザーにはフレンドリーなメッセージ

### 10.2 避けるべきパターン

1. **N+1クエリ**
   - Drizzleの`with`で一括取得
   ```typescript
   // ❌ Bad
   const developers = await db.select().from(developers);
   for (const d of developers) {
     const activities = await db.select().from(activities).where(eq(activities.developerId, d.id));
   }

   // ✅ Good
   const developersWithActivities = await db.query.developers.findMany({
     with: { activities: true },
   });
   ```

2. **同期的な外部API呼び出し**
   - 必ずJob Queue経由

3. **ハードコーディング**
   - 設定値は環境変数 or DB

4. **グローバルステート**
   - サービスはStatelessに

### 10.3 スケーラビリティ対策

1. **水平スケール対応**
   - Statelessアーキテクチャ
   - セッションはRedis

2. **データベース分離**
   - テナントごとにスキーマ分離（検討）
   - 大規模テナントは専用DB

3. **CDN活用**
   - 静的アセットはCloudflare

---

## 11. マイグレーション戦略

### 11.1 データベースマイグレーション

**ツール**: Drizzle Kit

**フロー**:
```bash
# 1. スキーマ変更
# db/schema/developers.ts を編集

# 2. マイグレーションファイル生成
pnpm db:generate

# 3. 確認
cat db/migrations/0001_add_consent_field.sql

# 4. 適用
pnpm db:migrate

# 5. Seed dataで動作確認
pnpm db:seed

# 6. 本番適用前にバックアップ
pg_dump drm_core > backup.sql
```

**ロールバック**:
```bash
# Drizzleは自動ロールバック未対応のため手動SQL実行
psql drm_core < db/migrations/rollback/0001.sql
```

### 11.2 プラグインマイグレーション

- プラグインは独立したバージョン管理
- 後方互換性を維持（Breaking Changeは避ける）

---

## 12. モニタリング・可観測性

### 12.1 メトリクス

**収集項目**:
- API応答時間（p50, p95, p99）
- エラー率（5xx, 4xx）
- DB接続数
- プラグイン実行時間
- ファネル更新頻度

**ツール**:
- Prometheus（メトリクス収集）
- Grafana（可視化）
- PostHog（ユーザー行動分析）

### 12.2 ログ

**構造化ログフォーマット**:
```json
{
  "level": "info",
  "timestamp": "2024-03-15T10:00:00Z",
  "requestId": "req-uuid",
  "tenantId": "tenant-uuid",
  "userId": "user-uuid",
  "message": "Activity created",
  "metadata": {
    "activityId": "activity-uuid",
    "type": "event"
  }
}
```

**ログ保存先**:
- OSS版: ファイル（ローテーション設定）
- SaaS版: CloudWatch Logs or Datadog

---

## 13. 今後の拡張予定

### Phase 1（docker-compose + 基本UI）**← 最優先**
**目標**: docker-composeで起動し、ブラウザで動作確認できる状態
- ✅ docker-compose環境構築（nginx + Remix + PostgreSQL + Redis + Worker）
- ✅ Drizzle ORM セットアップ + マイグレーション
- ✅ BullMQ + Worker セットアップ（プラグイン実行用）
- ✅ Seed data投入（Developer 10件、Activity 50件）
- ✅ ダッシュボード UI（総Developer数、総Activity数）
- ✅ Developer一覧画面（テーブル表示、検索機能）
- ✅ システム設定画面（基本情報表示）

**成果物**: `docker-compose up -d` → `http://localhost` でUI確認可能

**コンテナ構成**:
- `web`: Remix アプリケーション (Port 8080)
- `worker`: BullMQ ワーカー（バックグラウンドジョブ実行）
- `nginx`: リバースプロキシ (Port 80/443)
- `db`: PostgreSQL 15 (Port 5432)
- `redis`: Redis 7 (Port 6379)
- `posthog`: PostHog (Port 8000) ※Phase 4まで未使用

### Phase 2（CRUD操作 + 詳細画面）
**目標**: Developer/Activityの登録・編集・削除がUIで可能
- Developer詳細画面（Timeline表示）
- Developer新規登録/編集フォーム
- Activity一覧画面
- Activity登録フォーム
- Services層実装（DeveloperService, ActivityService）

### Phase 3（分析機能）
**目標**: ROI・ファネル分析の可視化
- ROI計算UI（施策別ROI表示）
- ファネル可視化（Awareness → Advocacy）
- Campaign管理画面
- FunnelService, ROIService実装

### Phase 4（拡張機能）
**目標**: PostHog連携 + プラグインシステム
- PostHog連携（匿名イベント収集）
- プラグインシステム基盤
- Slack / Discord / connpass プラグイン
- **監査ログプラグイン**（アクションフック実装）

### Phase 5（SaaS化）
**目標**: マルチテナント対応
- OAuth認証（GitHub, Google）
- テナント管理
- 課金システム（Stripe）
- プラグインマーケットプレイス

---

## まとめ

本設計書は、DRMツールのOSS版（docker-compose）とSaaS版（マルチテナント）の両方を見据えた技術設計を示しています。

**重要ポイント**:
1. **プラグインシステム**による拡張性の確保
2. **PostHog連携**による匿名ファネル分析
3. **テナント分離**（RLS）によるSaaS対応
4. **Remix Full-Stack**によるシンプルな構成（Honoは不使用）
5. **Drizzle ORM**による型安全なDB操作

次のステップとして、タスク分解（`/tasks`）を実施し、実装フェーズに移行します。
