# 詳細設計書 - DRM (Developer Relations Management) ツール

## 1. アーキテクチャ概要

### 1.1 システム構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                        DRM Application                           │
│                                                                   │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐  │
│  │      API Server (Hono)       │  │    UI (Remix)            │  │
│  │                              │  │                          │  │
│  │  /v1/developers              │  │  - Dashboard             │  │
│  │  /v1/organizations           │  │  - Analytics             │  │
│  │  /v1/activities              │  │  - Settings              │  │
│  │  /v1/plugins (management)    │  │  - Plugin Management UI  │  │
│  └──────────────┬───────────────┘  └──────────┬───────────────┘  │
│                                  │                    │           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Core Services Layer                      │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │ │
│  │  │ ID Resolver │  │ Funnel Engine│  │ Activity Manager│  │ │
│  │  │             │  │              │  │                 │  │ │
│  │  │ - email     │  │ - Awareness  │  │ - Ingestion     │  │ │
│  │  │ - domain    │  │ - Engagement │  │ - Classification│  │ │
│  │  │ - handle    │  │ - Adoption   │  │ - Enrichment    │  │ │
│  │  │             │  │ - Advocacy   │  │                 │  │ │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                  │                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Plugin System Layer                      │ │
│  │  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │ Plugin Loader   │→ │ Hook Manager │→ │ Registry     │ │ │
│  │  │                 │  │              │  │              │ │ │
│  │  │ - Discover      │  │ - onInit     │  │ - API routes │ │ │
│  │  │ - Validate      │  │ - onActivity │  │ - Jobs       │ │ │
│  │  │ - Load          │  │ - onPerson   │  │ - UI panels  │ │ │
│  │  │ - Sandbox       │  │              │  │              │ │ │
│  │  └─────────────────┘  └──────────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                  │                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     Data Access Layer                       │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │ │
│  │  │ Drizzle ORM  │  │ Repositories │  │ Context Manager │ │ │
│  │  │              │  │              │  │                 │ │ │
│  │  │ - Schema     │  │ - Person     │  │ - Default ctx   │ │ │
│  │  │ - Migrations │  │ - Org        │  │ - Plugin hooks  │ │ │
│  │  │ - Types      │  │ - Activity   │  │                 │ │ │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                  │                                │
└──────────────────────────────────┼────────────────────────────────┘
                                   │
                      ┌────────────┴────────────┐
                      │                         │
           ┌──────────▼──────────┐   ┌─────────▼─────────┐
           │  PostgreSQL 15+     │   │  PostHog API      │
           │  (with RLS)         │   │  (External)       │
           │                     │   │                   │
           │  - developers       │   │  - Capture API    │
           │  - organizations    │   │  - Insights API   │
           │  - activities       │   │  - Persons API    │
           │  - identifiers      │   │                   │
           │  - campaigns        │   │                   │
           └─────────────────────┘   └───────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          Plugins (Isolated)                      │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ drm-plugin-  │  │ drm-plugin-  │  │ drm-plugin-         │   │
│  │ slack        │  │ connpass     │  │ ai-attribution      │   │
│  │ (OSS)        │  │ (OSS)        │  │ (Commercial)        │   │
│  │ - OAuth      │  │ - Scraper    │  │ - ML Model          │   │
│  │ - Webhook    │  │ - Rate limit │  │ - Attribution calc  │   │
│  │ - Sync job   │  │              │  │                     │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ drm-plugin-multi-tenant (Commercial/Cloud only)          │   │
│  │                                                           │   │
│  │ - JWT tenant_id extraction                               │   │
│  │ - RLS policy management                                  │   │
│  │ - Tenant CRUD operations                                 │   │
│  │ - Subscription management                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 技術スタック

#### Core Technologies
- **言語**: TypeScript 5.9+ (strict mode with exactOptionalPropertyTypes)
- **ランタイム**: Node.js 20+
- **パッケージマネージャ**: pnpm (workspace monorepo)

#### Backend Stack
- **API Framework**: Hono 4.x (lightweight, edge-ready)
- **ORM**: Drizzle ORM (type-safe, migration support)
- **Database**: PostgreSQL 15+ (with Row Level Security)
- **Validation**: Zod (schema validation)
- **Authentication**: Custom JWT + OAuth2 (for plugins)
- **File Parsing**: papaparse (CSV), native JSON.parse (JSON)
- **Email**: SendGrid SDK (推奨), AWS SES SDK (代替)
- **URL Shortener**: nanoid (short code), qrcode (QR generation)
- **GeoIP**: @maxmind/geoip2-node (country/city detection)

#### Frontend Stack
- **UI Framework**: Remix 2.x (SSR, progressive enhancement)
- **Styling**: Tailwind CSS 4.x
- **Components**: shadcn/ui (accessible, customizable)
- **State Management**: Remix loaders/actions (server-driven)
- **Charts**: Recharts (funnel, trend visualization)
- **I18n**: remix-i18next (Remix integration), i18next (core)

#### Development Tools
- **Testing**: Vitest (unit, integration)
- **Linting**: ESLint 9 flat config
- **Formatting**: Prettier
- **Type Checking**: TypeScript compiler
- **Build**: tsup (for libraries), Vite (for UI)

#### Infrastructure
- **Container**: Docker + Docker Compose
- **Reverse Proxy**: Cloudflare (SSL, caching)
- **Job Scheduler**: BullMQ (Redis-based queue)
- **Caching**: Redis (session, rate-limit)

#### External Integrations
- **PostHog**: Analytics and anonymous tracking（公式APIのみ、カスタマイズ禁止）
- **Cloud Plugins**: Slack, Discord, connpass, X, CRM

## 2. コンポーネント設計

### 2.1 コンポーネント一覧

| コンポーネント名 | 責務 | 依存関係 |
|---|---|---|
| **Core API Server** | REST API提供、リクエスト処理 | Core Services, Plugin System |
| **ID Resolver Service** | 識別子統合、Developer解決 | Drizzle ORM, Repositories |
| **Funnel Engine** | ファネル分析、集計 | Activity Manager, Repositories |
| **Activity Manager** | イベント取込、分類、enrichment、ファイルインポート | ID Resolver, Repositories, File Parser |
| **File Parser** | CSV/JSONファイル解析、バリデーション | papaparse, Zod |
| **Email Campaign Manager** | メール配信、テンプレート管理、購読解除 | Email Service, URL Shortener, Repositories |
| **Email Service** | メール送信（SMTP/API）、バッチ配信 | External Email Provider (SendGrid, AWS SES) |
| **URL Shortener Service** | 短縮URL生成、リダイレクト、クリック追跡 | Repositories, QR Code Generator |
| **Plugin Loader** | プラグイン検出、検証、ロード | Hook Manager, Sandbox |
| **Hook Manager** | プラグインライフサイクル管理 | Registry |
| **Registry** | API/Job/UI登録管理 | Hono Router, BullMQ |
| **Repositories** | データアクセス抽象化（Developer, Organization, Activity） | Drizzle ORM, Context Manager |
| **Context Manager** | リクエストコンテキスト管理 | PostgreSQL connection |
| **PostHog Client** | 匿名イベント送信、Insights取得 | External PostHog API |
| **I18n Service** | 多言語対応、翻訳、ロケール管理 | remix-i18next, i18next |
| **Landing Page (LP)** | 製品紹介、機能説明、CTAボタン | Remix UI App, I18n Service |
| **Legal Pages** | プライバシーポリシー、利用規約 | Remix UI App, I18n Service |
| **Remix UI App** | ダッシュボード、可視化、Activity入力/インポート、メール作成/配信、プラグイン管理 | Core API, PostHog Client, I18n Service |
| **Plugin Manager** | プラグイン一覧・有効化・設定管理 | Plugin Loader, Registry |

### 2.2 各コンポーネントの詳細

#### Core API Server

**目的**: REST APIエンドポイントを提供し、認証、バリデーション、レスポンス生成を担当

**公開インターフェース**:
```typescript
// packages/core/api/server.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { z } from 'zod';

interface DRMContext {
  Variables: {
    tenantId: string;  // Always "default" in OSS, extracted by plugin in Cloud
    userId?: string;
    plugins: PluginRegistry;
  };
}

type DRMApp = Hono<DRMContext>;

// API Routes
app.get('/v1/developers', developersRoutes);
app.get('/v1/organizations', organizationsRoutes);
app.post('/v1/activities', activitiesRoutes);
app.get('/v1/funnel', funnelRoutes);
```

**内部実装方針**:
- Honoの軽量性を活かしたエッジ対応設計
- Middleware: authentication → context resolution (plugin hook) → rate limiting
- OSS版: tenantIdは常に"default"（プラグインなし）
- Cloud版: multi-tenantプラグインがJWTからtenantId抽出
- Zodスキーマでリクエスト/レスポンスバリデーション
- プラグインが登録したルートを動的マウント

#### ID Resolver Service

**目的**: 複数の識別子（email, GitHub handle, domain等）から単一のDeveloperを特定・統合

**公開インターフェース**:
```typescript
// packages/core/services/id-resolver.ts
interface IdentifierInput {
  kind: 'email' | 'github_handle' | 'x_handle' | 'domain' | 'custom';
  value: string;
  confidence?: number; // 0.0 - 1.0
}

interface ResolutionResult {
  developerId: string | null;
  confidence: number;
  sources: IdentifierInput[];
  suggestedMerges?: string[]; // other developer_ids
}

class IDResolverService {
  async resolve(
    tenantId: string,
    identifiers: IdentifierInput[]
  ): Promise<ResolutionResult>;

  async merge(
    tenantId: string,
    sourceDeveloperId: string,
    targetDeveloperId: string
  ): Promise<void>;

  async split(
    tenantId: string,
    developerId: string,
    identifierIds: string[]
  ): Promise<{ newDeveloperId: string }>;
}
```

**内部実装方針**:
- ルールベースマッチング（email exact, domain fuzzy, handle case-insensitive）
- 信頼度スコアリング（複数識別子一致 = 高信頼度）
- マージ提案（同一org + 類似email = 提案）
- 監査ログ（マージ/分割履歴）

#### Funnel Engine

**目的**: Awareness → Engagement → Adoption → Advocacy のファネル集計

**公開インターフェース**:
```typescript
// packages/core/services/funnel-engine.ts
interface FunnelStage {
  stage: 'awareness' | 'engagement' | 'adoption' | 'advocacy';
  count: number;
  uniqueDevelopers: string[];
  conversionRate?: number; // from previous stage
}

interface FunnelQuery {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  campaignId?: string;
  organizationId?: string;
  developerId?: string;
}

class FunnelEngine {
  async calculate(query: FunnelQuery): Promise<FunnelStage[]>;

  async getStageActivities(
    query: FunnelQuery,
    stage: FunnelStage['stage']
  ): Promise<Activity[]>;

  async compareAnonymous(
    query: FunnelQuery,
    posthogInsightId: string
  ): Promise<{
    drm: FunnelStage[];
    posthog: FunnelStage[];
    overlap: number;
  }>;
}
```

**内部実装方針**:
- Activity typesをステージにマッピング（設定可能）
- PostgreSQL Window functionsで効率的集計
- PostHog Insightsとの期間・施策マッチング
- キャッシュ戦略（Redis、5分TTL）

#### Activity Manager

**目的**: 外部からのイベントを取り込み、分類、enrichment、Developer紐付け

**公開インターフェース**:
```typescript
// packages/core/services/activity-manager.ts
interface ActivityInput {
  type: string; // 'github.star', 'slack.message', 'api.call'
  source: string; // 'github', 'slack', 'manual'
  timestamp: Date;
  metadata: Record<string, unknown>;
  identifiers?: IdentifierInput[];
  clickId?: string; // for PostHog correlation
}

interface EnrichedActivity extends ActivityInput {
  activityId: string;
  developerId: string | null;
  organizationId: string | null;
  funnelStage: FunnelStage['stage'];
  confidence: number;
}

class ActivityManager {
  // Single activity ingestion (for manual form input)
  async ingest(
    tenantId: string,
    input: ActivityInput
  ): Promise<EnrichedActivity>;

  // Batch activity ingestion (for background tasks, CSV/JSON import)
  async batch(
    tenantId: string,
    inputs: ActivityInput[]
  ): Promise<EnrichedActivity[]>;

  // Import from CSV/JSON file (used by UI import route)
  async importFile(
    tenantId: string,
    file: File,
    format: 'csv' | 'json'
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ line: number; error: string }>;
  }>;

  // Classify activity to funnel stage
  async classify(
    activity: ActivityInput
  ): Promise<{ stage: FunnelStage['stage']; confidence: number }>;
}
```

**内部実装方針**:
- **バッチ取込対応**（BulkInsert、トランザクション）
- **分類ルールエンジン**（type → stage mapping + カスタムルール）
- **Enrichment pipeline**（geo, organization domain lookup, AI tagging - plugin経由）
- **PostHog連携**（clickIdでイベント送信）
- **ファイルパース**:
  - CSV: `papaparse`で解析、ヘッダー検証
  - JSON: Zodスキーマ検証、配列形式必須
  - エラー行を記録（スキップして継続）

#### Plugin Loader

**目的**: プラグインの検出、検証（署名・バージョン・パーミッション）、安全なロード

**公開インターフェース**:
```typescript
// packages/core/plugin-system/loader.ts
interface PluginManifest {
  name: string;
  version: string;
  provider: string;
  license: 'oss' | 'commercial';
  entry: string;
  requires: { 'drm-core': string };
  permissions: Array<'network' | 'scheduler' | 'secrets' | 'database'>;
  signature?: string; // RSA256, commercial only
}

interface LoadedPlugin {
  id: string;
  manifest: PluginManifest;
  module: PluginModule;
  sandbox: VM.Context;
}

class PluginLoader {
  async discover(dirs: string[]): Promise<PluginManifest[]>;

  async validate(manifest: PluginManifest): Promise<{
    valid: boolean;
    errors: string[];
  }>;

  async load(manifest: PluginManifest): Promise<LoadedPlugin>;

  async unload(pluginId: string): Promise<void>;
}
```

**内部実装方針**:
- **Discovery**: `node_modules/@devcle/plugin-*`をスキャン（起動時）
- **有効化チェック**: DBテーブル`enabled_plugins`と照合
- **署名検証**: 商用プラグインはpackage署名チェック（npm publish時）
- **バージョンチェック**: semverでコア互換性確認
- **VM2 sandbox**: プラグインコード実行（permissions制御）
- **ライセンス検証**: 商用プラグインはCloud API呼出（月次キャッシュ）

**プラグインインストールフロー**:
1. `pnpm add @devcle/plugin-slack`（手動）
2. DRM再起動 → Plugin Loader自動検出
3. 管理画面 `/dashboard/plugins` で「Enable」ボタンクリック
4. DBに有効化記録 + 設定入力（必要な場合）
5. 即座に有効化（再起動不要、hot reload）

#### Hook Manager

**目的**: プラグインライフサイクルイベント（onInit, onActivity, onPerson）の発火管理

**公開インターフェース**:
```typescript
// packages/core/plugin-system/hook-manager.ts
type HookName = 'onInit' | 'onActivity' | 'onDeveloper' | 'onOrganization' | 'onShutdown';

interface HookContext {
  tenantId: string;
  registerAPI: (path: string, handler: Handler) => void;
  registerJob: (name: string, opts: JobOpts, handler: JobHandler) => void;
  registerUI: (slot: string, component: UIComponent) => void;
  services: {
    idResolver: IDResolverService;
    activityManager: ActivityManager;
    funnelEngine: FunnelEngine;
  };
}

class HookManager {
  on(hook: HookName, pluginId: string, handler: (ctx: HookContext) => void): void;

  async emit(hook: HookName, context: HookContext): Promise<void>;

  async emitActivity(
    tenantId: string,
    activity: EnrichedActivity
  ): Promise<void>;
}
```

**内部実装方針**:
- イベントエミッター型（async/await）
- エラーハンドリング（プラグイン障害を隔離）
- タイムアウト制御（30秒上限）
- 監査ログ（hook実行履歴）

#### Registry

**目的**: プラグインが登録したAPI/Job/UIを一元管理、ルーティング

**公開インターフェース**:
```typescript
// packages/core/plugin-system/registry.ts
interface PluginRegistry {
  apis: Map<string, { pluginId: string; handler: Handler }>;
  jobs: Map<string, { pluginId: string; opts: JobOpts; handler: JobHandler }>;
  uiSlots: Map<string, { pluginId: string; component: UIComponent }[]>;
}

class Registry {
  registerAPI(pluginId: string, path: string, handler: Handler): void;
  registerJob(pluginId: string, name: string, opts: JobOpts, handler: JobHandler): void;
  registerUI(pluginId: string, slot: string, component: UIComponent): void;

  getAPI(path: string): Handler | null;
  getJobs(): Array<{ name: string; opts: JobOpts; handler: JobHandler }>;
  getUISlot(slot: string): UIComponent[];
}
```

**内部実装方針**:
- APIはHonoルーターに動的追加（prefix: /plugins/:pluginId）
- JobsはBullMQに登録（cron、repeat）
- UIはRemix loaderでコンポーネントリスト取得
- unregister時の依存関係チェック

#### Repositories

**目的**: データアクセス抽象化、型安全なクエリ、テナント条件自動付与

**公開インターフェース**:
```typescript
// packages/core/db/repositories/developer-repository.ts
import type { InferSelectModel } from 'drizzle-orm';
import { developers } from '../schema';

type Developer = InferSelectModel<typeof developers>;

interface DeveloperRepository {
  findById(tenantId: string, developerId: string): Promise<Developer | null>;

  findByIdentifier(
    tenantId: string,
    kind: string,
    value: string
  ): Promise<Developer | null>;

  create(tenantId: string, data: Partial<Developer>): Promise<Developer>;

  update(
    tenantId: string,
    developerId: string,
    data: Partial<Developer>
  ): Promise<Developer>;

  merge(
    tenantId: string,
    sourceId: string,
    targetId: string
  ): Promise<Developer>;
}
```

**内部実装方針**:
- Drizzle ORMの型安全クエリビルダー活用
- すべてのクエリにtenantId条件を自動付与（WHERE tenant_id = $1）
- OSS版: tenantIdは常に"default"
- Cloud版: multi-tenantプラグインがRLS有効化
- トランザクション管理（merge等）

#### Context Manager

**目的**: リクエストコンテキスト管理、プラグインによる拡張

**公開インターフェース**:
```typescript
// packages/core/db/context-manager.ts
interface RequestContext {
  tenantId: string;  // "default" in OSS, dynamic in Cloud
  userId?: string;
  roles: string[];
}

class ContextManager {
  async resolve(request: Request): Promise<RequestContext>;

  async setDBContext(
    db: DrizzleDB,
    context: RequestContext
  ): Promise<void>;
}
```

**内部実装方針**:
- OSS版: 常に`{ tenantId: "default", userId: from JWT, roles: from JWT }`
- Cloud版: multi-tenantプラグインがonRequest hookでtenantId上書き
- プラグインがRLS設定（SET LOCAL drm.tenant_id）を追加可能
- 後方互換性維持（tenantIdパラメータは全関数で保持）

#### PostHog Client

**目的**: 匿名イベント送信、Insights/Persons API取得、DRMファネルとのマージ

### 🚨 PostHog利用ポリシー（CRITICAL）

**絶対禁止事項**:
- ❌ PostHog本体のカスタマイズ（フォーク、ソースコード変更）
- ❌ PostHogプラグインの独自開発
- ❌ PostHogデータベースへの直接アクセス
- ❌ PostHog内部APIの直接利用（公式API以外）

**許可される操作**:
- ✅ PostHog公式APIの利用（Capture, Insights, Persons API）
- ✅ PostHog設定画面での設定変更（Project Settings, Feature Flags等）
- ✅ PostHog公式プラグインの利用（GeoIP, Property Filter等）
- ✅ PostHog Webhookの受信（DRM側でハンドリング）

**理由**:
- PostHogはサードパーティサービスとして扱う
- アップグレード時の互換性を保証するため
- 保守性・運用コストを最小化するため

**公開インターフェース**:
```typescript
// packages/posthog/services/posthog-client.ts
interface PostHogEvent {
  event: string;
  distinctId: string; // click_id or person_id
  properties?: Record<string, unknown>;
  timestamp?: Date;
}

interface PostHogInsight {
  id: string;
  type: 'funnel' | 'trend';
  filters: Record<string, unknown>;
  result: FunnelStage[] | TrendPoint[];
}

class PostHogClient {
  async capture(event: PostHogEvent): Promise<void>;

  async getInsight(insightId: string): Promise<PostHogInsight>;

  async getPersons(filters: Record<string, unknown>): Promise<{
    count: number;
    results: Array<{ distinct_id: string; properties: Record<string, unknown> }>;
  }>;

  async mergeFunnels(
    drmFunnel: FunnelStage[],
    posthogInsightId: string
  ): Promise<{
    drm: FunnelStage[];
    posthog: FunnelStage[];
    overlap: number;
  }>;
}
```

**内部実装方針**:
- **Capture API**: S2S POST https://app.posthog.com/capture/（公式APIのみ使用）
- **Insights API**: GET https://app.posthog.com/api/projects/:id/insights/:id/（公式APIのみ使用）
- **匿名→実名マッピング**: click_id → person_id when identified（PostHog標準機能）
- **レート制限対応**: exponential backoff（DRM側で実装）
- **設定管理**: 環境変数（POSTHOG_API_KEY, POSTHOG_HOST）でプロジェクト指定

#### Remix UI App

**目的**: ダッシュボード、ファネル可視化、設定画面提供

**公開インターフェース**:
```typescript
// packages/core/ui/app/routes/_dashboard.funnel.tsx
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { tenantId } = await context.contextManager.resolve(request);
  // tenantId is "default" in OSS, extracted from JWT in Cloud (via plugin)
  const funnel = await context.funnelEngine.calculate({
    tenantId,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
  });
  return json({ funnel });
}

export default function FunnelPage() {
  const { funnel } = useLoaderData<typeof loader>();
  return <FunnelChart data={funnel} />;
}
```

**内部実装方針**:
- SSR + Progressive Enhancement（JS無効でも表示）
- Remix loader/actionでAPI呼出（直接サービス層）
- Recharts（Funnel, Line, Bar charts）
- shadcn/ui（Table, Dialog, Form）
- Tailwind CSS（responsive design）

**Activity登録画面**:
```typescript
// packages/core/ui/app/routes/_dashboard.activities.new.tsx
export async function action({ request, context }: ActionFunctionArgs) {
  const { tenantId } = await context.contextManager.resolve(request);
  const formData = await request.formData();

  const activity = {
    type: formData.get('type'),
    source: formData.get('source') || 'manual',
    timestamp: new Date(formData.get('timestamp')),
    metadata: JSON.parse(formData.get('metadata') || '{}'),
    identifiers: JSON.parse(formData.get('identifiers') || '[]'),
  };

  await context.activityManager.ingest(tenantId, activity);
  return redirect('/dashboard/activities');
}

export default function NewActivityPage() {
  return <ActivityForm />;
}
```

**Activity一括インポート画面**:
```typescript
// packages/core/ui/app/routes/_dashboard.activities.import.tsx
export async function action({ request, context }: ActionFunctionArgs) {
  const { tenantId } = await context.contextManager.resolve(request);
  const formData = await request.formData();
  const file = formData.get('file') as File;

  // Parse CSV or JSON
  const activities = await parseFile(file);

  // Batch import
  const results = await context.activityManager.batch(tenantId, activities);

  return json({
    success: results.length,
    total: activities.length,
    errors: results.filter(r => r.error).map(r => r.error)
  });
}

export default function ImportActivitiesPage() {
  return <FileUploadForm acceptedFormats={['text/csv', 'application/json']} />;
}
```

**プラグイン管理画面**:
```typescript
// packages/core/ui/app/routes/_dashboard.plugins.tsx
export async function loader({ context }: LoaderFunctionArgs) {
  const plugins = await context.pluginManager.list();
  return json({ plugins });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('action'); // 'enable' | 'disable' | 'configure'
  const pluginId = formData.get('pluginId');

  if (action === 'enable') {
    await context.pluginManager.enable(pluginId);
  } else if (action === 'disable') {
    await context.pluginManager.disable(pluginId);
  }

  return redirect('/dashboard/plugins');
}

export default function PluginsPage() {
  const { plugins } = useLoaderData<typeof loader>();
  return (
    <div>
      <h1>Plugins</h1>
      <PluginList plugins={plugins} />
    </div>
  );
}
```

#### Plugin Manager

**目的**: プラグイン一覧表示、有効化/無効化、設定管理（UI経由）

**公開インターフェース**:
```typescript
// packages/core/services/plugin-manager.ts
interface PluginInfo {
  id: string;
  name: string;
  version: string;
  license: 'oss' | 'commercial';
  enabled: boolean;
  installed: boolean; // npm installed in node_modules
  configurable: boolean;
  config?: Record<string, unknown>;
}

class PluginManager {
  // List all available plugins (from node_modules/@devcle/plugin-*)
  async list(): Promise<PluginInfo[]>;

  // Enable plugin (add to enabled_plugins table)
  async enable(pluginId: string, config?: Record<string, unknown>): Promise<void>;

  // Disable plugin (remove from enabled_plugins)
  async disable(pluginId: string): Promise<void>;

  // Update plugin config
  async updateConfig(pluginId: string, config: Record<string, unknown>): Promise<void>;

  // Get plugin config
  async getConfig(pluginId: string): Promise<Record<string, unknown> | null>;
}
```

**内部実装方針**:
- **プラグインインストール**: `pnpm add @devcle/plugin-slack`（手動またはpackage.json）
- **プラグイン検出**: `node_modules/@devcle/plugin-*`をスキャン
- **有効化管理**: DBテーブル`enabled_plugins`で管理
- **設定保存**: `plugin_configs`テーブル（暗号化対応）
- **UI連携**: Remix loaderで一覧取得、actionで有効化/無効化

#### Email Campaign Manager

**目的**: Developer向けメール配信、テンプレート管理、購読解除管理

**公開インターフェース**:
```typescript
// packages/core/services/email-campaign-manager.ts
interface EmailTemplate {
  templateId: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[]; // ['{{name}}', '{{company}}']
  createdAt: Date;
  updatedAt: Date;
}

interface EmailCampaign {
  campaignId: string;
  name: string;
  templateId: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  recipientFilter: {
    organizationIds?: string[];
    funnelStages?: string[];
    tags?: string[];
    customQuery?: string;
  };
  recipientCount: number;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  unsubscribedCount: number;
  scheduledAt?: Date;
  sentAt?: Date;
}

interface EmailCampaignManager {
  // Template management
  createTemplate(tenantId: string, template: Partial<EmailTemplate>): Promise<EmailTemplate>;
  updateTemplate(tenantId: string, templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate>;
  deleteTemplate(tenantId: string, templateId: string): Promise<void>;
  listTemplates(tenantId: string): Promise<EmailTemplate[]>;

  // Campaign management
  createCampaign(tenantId: string, campaign: Partial<EmailCampaign>): Promise<EmailCampaign>;
  updateCampaign(tenantId: string, campaignId: string, updates: Partial<EmailCampaign>): Promise<EmailCampaign>;
  getCampaign(tenantId: string, campaignId: string): Promise<EmailCampaign>;
  listCampaigns(tenantId: string): Promise<EmailCampaign[]>;

  // Preview and send
  previewEmail(tenantId: string, campaignId: string, developerId: string): Promise<{ subject: string; bodyHtml: string; bodyText: string }>;
  sendTestEmail(tenantId: string, campaignId: string, toEmail: string): Promise<void>;
  sendCampaign(tenantId: string, campaignId: string): Promise<void>;

  // Subscription management
  unsubscribe(developerId: string, token: string): Promise<void>;
  getUnsubscribeStatus(developerId: string): Promise<{ unsubscribed: boolean; unsubscribedAt?: Date }>;
}
```

**内部実装方針**:
- **テンプレート変数置換**: `{{name}}`, `{{company}}` 等をDeveloper情報で置換
- **URL自動短縮**: メール本文内のすべてのURLを短縮URLに自動変換（URL Shortener Service経由）
- **購読解除トークン**: HMAC-SHA256でDeveloperごとに一意なトークン生成
- **購読解除リンク**: すべてのメールフッターに自動挿入
- **バッチ送信**: BullMQで非同期送信（1000件/分、レート制限対応）
- **開封・クリック追跡**:
  - 開封: 1x1透明画像（`/email/track/open/:campaignId/:developerId`）
  - クリック: 短縮URL経由で自動追跡

#### Email Service

**目的**: 実際のメール送信処理（SMTP/API）

**公開インターフェース**:
```typescript
// packages/core/services/email-service.ts
interface EmailMessage {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  headers?: Record<string, string>;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

interface EmailService {
  send(message: EmailMessage): Promise<{ messageId: string }>;
  sendBatch(messages: EmailMessage[]): Promise<Array<{ messageId: string; error?: string }>>;
  verifyDomain(domain: string): Promise<{ verified: boolean; records: DNSRecord[] }>;
}
```

**内部実装方針**:
- **推奨プロバイダー**: SendGrid（開発者向け、高い到達率）
- **代替プロバイダー**: AWS SES、Resend、Postmark
- **DKIM/SPF/DMARC**: ドメイン認証必須（設定ガイド提供）
- **バウンス処理**: Webhookでハードバウンス検出 → Developer購読状態を自動更新
- **送信レート制限**: プロバイダー別にレート制限設定
- **リトライ戦略**: exponential backoff（最大3回）
- **エラーハンドリング**: 一時エラー（rate limit）と永続エラー（invalid email）を区別

#### URL Shortener Service

**目的**: 短縮URL生成、リダイレクト、クリック追跡、QRコード生成

**公開インターフェース**:
```typescript
// packages/core/services/url-shortener.ts
interface ShortURL {
  shortCode: string;
  originalUrl: string;
  shortUrl: string; // https://devcle.link/abc123
  qrCodeUrl: string; // QR code image URL
  campaignId?: string;
  developerId?: string;
  clickCount: number;
  createdAt: Date;
  expiresAt?: Date;
}

interface URLClickEvent {
  shortCode: string;
  clickedAt: Date;
  developerId?: string;
  campaignId?: string;
  ipAddress: string;
  userAgent: string;
  referer?: string;
  country?: string;
  city?: string;
}

interface URLShortenerService {
  // URL shortening
  shorten(
    tenantId: string,
    originalUrl: string,
    options?: {
      customCode?: string;
      campaignId?: string;
      developerId?: string;
      expiresAt?: Date;
    }
  ): Promise<ShortURL>;

  // Bulk shortening (for email campaign)
  shortenBulk(
    tenantId: string,
    urls: Array<{ url: string; campaignId?: string; developerId?: string }>
  ): Promise<ShortURL[]>;

  // Redirect and track
  redirect(shortCode: string, request: Request): Promise<{
    redirectUrl: string;
    tracked: boolean;
  }>;

  // QR code
  generateQRCode(shortCode: string, options?: { size?: number; format?: 'png' | 'svg' }): Promise<Buffer>;

  // Analytics
  getClickStats(tenantId: string, shortCode: string): Promise<{
    totalClicks: number;
    uniqueClicks: number;
    clicksByDate: Array<{ date: string; count: number }>;
    clicksByCountry: Array<{ country: string; count: number }>;
    clicksByDevice: Array<{ device: string; count: number }>;
  }>;

  // URL management
  list(tenantId: string, filters?: { campaignId?: string }): Promise<ShortURL[]>;
  delete(tenantId: string, shortCode: string): Promise<void>;
}
```

**内部実装方針**:
- **短縮ドメイン設定**: 環境変数`SHORT_URL_DOMAIN`（デフォルト: `devcle.link`）
- **短縮コード生成**: nanoid（8文字、URL-safe）
- **カスタムコード**: ユーザー指定可能（衝突チェック）
- **パラメーター置換**: `{{developer_id}}` → 実際のID（メール配信時）
  - 例: `https://example.com/signup?ref={{developer_id}}` → `https://devcle.link/abc123` → `https://example.com/signup?ref=dev_xyz789`
- **リダイレクトロジック**:
  1. 短縮コードでDB検索
  2. クリックイベント記録（非同期）
  3. 302リダイレクト
  4. Activity自動登録（type: `link.click`）
- **QRコード生成**: `qrcode`ライブラリ（PNG/SVG）
- **GeoIP**: MaxMind GeoLite2（国/都市判定）
- **有効期限**: 自動削除（cron job、期限切れURL）
- **キャッシュ**: Redis（短縮コード → リダイレクトURL、TTL 1時間）

#### I18n Service

**目的**: UIの多言語対応、翻訳管理、ロケール自動検出

**公開インターフェース**:
```typescript
// packages/core/services/i18n-service.ts
interface I18nService {
  // Get translation
  t(key: string, options?: { lng?: string; params?: Record<string, string> }): string;

  // Get current locale
  getCurrentLocale(request: Request): Promise<string>;

  // Get available locales
  getAvailableLocales(): string[];

  // Change locale
  changeLocale(locale: string): Promise<void>;
}
```

**対応言語**:
- **Phase 1**: 英語（en）、日本語（ja）
- **Phase 2**: 中国語（zh-CN）、韓国語（ko）
- **Phase 3**: その他の言語（フランス語、ドイツ語、スペイン語等）

**翻訳ファイル構成**:
```
packages/core/ui/locales/
├── en/
│   ├── common.json
│   ├── dashboard.json
│   ├── activities.json
│   ├── email.json
│   └── errors.json
└── ja/
    ├── common.json
    ├── dashboard.json
    ├── activities.json
    ├── email.json
    └── errors.json
```

**翻訳ファイル例**:
```json
// locales/en/common.json
{
  "nav": {
    "dashboard": "Dashboard",
    "developers": "Developers",
    "organizations": "Organizations",
    "activities": "Activities",
    "campaigns": "Campaigns",
    "analytics": "Analytics",
    "settings": "Settings"
  },
  "actions": {
    "create": "Create",
    "edit": "Edit",
    "delete": "Delete",
    "save": "Save",
    "cancel": "Cancel",
    "search": "Search"
  },
  "pagination": {
    "previous": "Previous",
    "next": "Next",
    "showing": "Showing {{from}} to {{to}} of {{total}} results"
  }
}

// locales/ja/common.json
{
  "nav": {
    "dashboard": "ダッシュボード",
    "developers": "開発者",
    "organizations": "組織",
    "activities": "アクティビティ",
    "campaigns": "キャンペーン",
    "analytics": "分析",
    "settings": "設定"
  },
  "actions": {
    "create": "作成",
    "edit": "編集",
    "delete": "削除",
    "save": "保存",
    "cancel": "キャンセル",
    "search": "検索"
  },
  "pagination": {
    "previous": "前へ",
    "next": "次へ",
    "showing": "全{{total}}件中 {{from}}〜{{to}}件を表示"
  }
}
```

**内部実装方針**:
- **ライブラリ**: remix-i18next（Remix統合）+ i18next（コア）
- **ロケール検出**:
  1. URLパラメータ（`?lng=ja`）
  2. Cookie（`i18next`）
  3. Accept-Language ヘッダー
  4. デフォルト（`en`）
- **ロケール切り替え**:
  - UI: 右上言語セレクター
  - Cookie保存（永続化）
  - ページリロード不要（Remix loader再実行）
- **翻訳キー命名規則**:
  - ネームスペース.セクション.キー（例: `dashboard.funnel.title`）
  - 変数: `{{variable}}` 形式
- **フォールバック**: 翻訳未定義時は英語にフォールバック
- **日付・数値フォーマット**: Intl API使用
  - 日付: `new Intl.DateTimeFormat(locale).format(date)`
  - 数値: `new Intl.NumberFormat(locale).format(number)`
  - 通貨: `new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(amount)`

**Remix統合例**:
```typescript
// packages/core/ui/app/root.tsx
import { useChangeLanguage } from 'remix-i18next/react';
import { useTranslation } from 'react-i18next';

export async function loader({ request }: LoaderFunctionArgs) {
  const locale = await i18n.getLocale(request);
  return json({ locale });
}

export default function App() {
  const { locale } = useLoaderData<typeof loader>();
  const { i18n } = useTranslation();

  useChangeLanguage(locale);

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  );
}

// packages/core/ui/app/routes/_dashboard.tsx
import { useTranslation } from 'react-i18next';

export default function DashboardLayout() {
  const { t } = useTranslation('common');

  return (
    <nav>
      <Link to="/dashboard">{t('nav.dashboard')}</Link>
      <Link to="/developers">{t('nav.developers')}</Link>
      <Link to="/organizations">{t('nav.organizations')}</Link>
    </nav>
  );
}
```

**言語切り替えコンポーネント**:
```typescript
// packages/core/ui/app/components/LanguageSwitcher.tsx
import { Form } from '@remix-run/react';
import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <Form method="post" action="/api/change-language">
      <select
        name="lng"
        value={i18n.language}
        onChange={(e) => e.currentTarget.form?.submit()}
      >
        <option value="en">English</option>
        <option value="ja">日本語</option>
      </select>
    </Form>
  );
}
```

**バックエンド翻訳（メール等）**:
```typescript
// packages/core/services/email-campaign-manager.ts
import i18next from 'i18next';

async function sendCampaign(tenantId: string, campaignId: string) {
  const campaign = await getCampaign(tenantId, campaignId);
  const developers = await getRecipients(campaign.recipientFilter);

  for (const developer of developers) {
    // Developer's preferred locale (from profile or default)
    const locale = developer.preferredLocale || 'en';

    // Server-side translation
    const subject = i18next.t('email.campaign.subject', { lng: locale });
    const unsubscribeText = i18next.t('email.unsubscribe', { lng: locale });

    await emailService.send({
      to: developer.primaryEmail,
      subject,
      bodyHtml: renderTemplate(campaign.template, { developer, locale, unsubscribeText }),
    });
  }
}
```

#### Landing Page (LP)

**目的**: 製品紹介、機能説明、ユーザー獲得のためのマーケティングページ

**ルート**:
- `/` - トップページ（未認証ユーザー向け）
- `/features` - 機能詳細ページ
- `/pricing` - 価格プラン
- `/docs` - ドキュメントへのリンク

**構成要素**:
```typescript
// packages/core/ui/app/routes/_public._index.tsx
export default function LandingPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="hero">
        <h1>{t('lp.hero.title')}</h1>
        <p>{t('lp.hero.subtitle')}</p>
        <CTAButton href="/dashboard" variant="primary">
          {t('lp.hero.cta')}
        </CTAButton>
      </section>

      {/* Features Section */}
      <section className="features">
        <FeatureCard
          icon={<ChartIcon />}
          title={t('lp.features.funnel.title')}
          description={t('lp.features.funnel.description')}
        />
        <FeatureCard
          icon={<UsersIcon />}
          title={t('lp.features.developer.title')}
          description={t('lp.features.developer.description')}
        />
        <FeatureCard
          icon={<PlugIcon />}
          title={t('lp.features.plugin.title')}
          description={t('lp.features.plugin.description')}
        />
      </section>

      {/* Testimonials Section */}
      <section className="testimonials">
        {/* ... */}
      </section>

      {/* CTA Section */}
      <section className="cta">
        <h2>{t('lp.cta.title')}</h2>
        <CTAButton href="/dashboard" variant="primary">
          {t('lp.cta.button')}
        </CTAButton>
      </section>
    </div>
  );
}
```

**LP翻訳ファイル例**:
```json
// locales/en/landing.json
{
  "hero": {
    "title": "Measure & Grow Your Developer Community",
    "subtitle": "DRM helps you track, analyze, and optimize your DevRel activities with data-driven insights.",
    "cta": "Get Started"
  },
  "features": {
    "funnel": {
      "title": "Developer Funnel Analytics",
      "description": "Track developers from Awareness to Advocacy with visual funnel analysis."
    },
    "developer": {
      "title": "360° Developer Profiles",
      "description": "Unify identities across GitHub, Slack, X, and more with ID resolution."
    },
    "plugin": {
      "title": "Extensible Plugin System",
      "description": "Integrate with Slack, Discord, connpass, CRM, and custom data sources."
    }
  },
  "cta": {
    "title": "Ready to optimize your DevRel?",
    "button": "Start Free Trial"
  }
}

// locales/ja/landing.json
{
  "hero": {
    "title": "開発者コミュニティを測定・成長させる",
    "subtitle": "DRMはDevRel活動を追跡・分析し、データドリブンなインサイトで最適化します。",
    "cta": "始める"
  },
  "features": {
    "funnel": {
      "title": "開発者ファネル分析",
      "description": "認知からアドボケイトまで、視覚的なファネルで開発者の行動を追跡します。"
    },
    "developer": {
      "title": "360°開発者プロフィール",
      "description": "GitHub、Slack、X等のID統合により、開発者の全体像を把握します。"
    },
    "plugin": {
      "title": "拡張可能なプラグインシステム",
      "description": "Slack、Discord、connpass、CRM、カスタムデータソースと連携できます。"
    }
  },
  "cta": {
    "title": "DevRelを最適化する準備はできましたか？",
    "button": "無料トライアルを開始"
  }
}
```

**SEO対応**:
```typescript
// packages/core/ui/app/routes/_public._index.tsx
export const meta: MetaFunction = ({ data }) => {
  return [
    { title: 'DRM - Developer Relations Management Tool' },
    { name: 'description', content: 'Track, analyze, and optimize your DevRel activities with data-driven insights.' },
    { name: 'keywords', content: 'DevRel, Developer Relations, Analytics, Funnel, Community Management' },
    { property: 'og:title', content: 'DRM - Developer Relations Management Tool' },
    { property: 'og:description', content: 'Track, analyze, and optimize your DevRel activities with data-driven insights.' },
    { property: 'og:image', content: 'https://devcle.com/og-image.png' },
    { property: 'og:url', content: 'https://devcle.com' },
  ];
};
```

**デザイン方針**:
- **シンプル・クリーン**: 余白を活かしたモダンデザイン
- **レスポンシブ**: モバイル・タブレット・デスクトップ対応
- **高速**: SSR + Progressive Enhancement（Remix）
- **アクセシブル**: WCAG 2.1 AA準拠、キーボード操作可能
- **アニメーション**: Framer Motionでスムーズな遷移

#### Legal Pages（プライバシーポリシー・利用規約）

**目的**: 法的要件の遵守、ユーザーのデータ利用同意、透明性確保

**ルート**:
- `/privacy` - プライバシーポリシー
- `/terms` - 利用規約

**共通仕様**:
- **多言語対応**: 英語（en）・日本語（ja）
- **バージョン管理**: 更新日時を明記（最終更新日: 2025-XX-XX）
- **Markdownベース**: `/legal/privacy-en.md`, `/legal/privacy-ja.md`
- **静的ページ**: ビルド時にHTMLに変換（Remix loader）

**プライバシーポリシー構成**:
```markdown
# Privacy Policy

**Last Updated**: 2025-10-08

## 1. Introduction
DRM (Developer Relations Management) respects your privacy...

## 2. Data We Collect
- **Personal Information**: Name, email address, company name
- **Activity Data**: GitHub activity, Slack messages, event participation
- **Anonymous Data**: PostHog analytics (IP address, user agent)
- **Cookies**: Session cookies, language preference

## 3. How We Use Your Data
- **Identity Resolution**: Unify your identifiers across platforms
- **Funnel Analysis**: Measure your journey from Awareness to Advocacy
- **Email Campaigns**: Send relevant updates (with unsubscribe option)
- **Product Improvement**: Analyze usage patterns (anonymized)

## 4. Data Sharing
- **Third-Party Services**: PostHog (analytics), Resend (email), MaxMind (GeoIP)
- **Plugins**: Slack, Discord, GitHub (with your explicit consent)
- **No Selling**: We NEVER sell your personal data

## 5. Your Rights (GDPR/CCPA)
- **Access**: Request a copy of your data
- **Deletion**: Request permanent deletion
- **Portability**: Export your data (JSON format)
- **Opt-Out**: Unsubscribe from emails, disable analytics

## 6. Security
- **Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Access Control**: Role-Based Access Control (RBAC)
- **Audit Logs**: All data access is logged

## 7. Contact Us
Email: privacy@devcle.com
```

**利用規約構成**:
```markdown
# Terms of Service

**Last Updated**: 2025-10-08

## 1. Acceptance of Terms
By using DRM, you agree to these terms...

## 2. Service Description
DRM provides Developer Relations Management tools...

## 3. Account Registration
- **Eligibility**: 18+ years old
- **Accuracy**: Provide accurate information
- **Security**: Keep your password secure

## 4. Acceptable Use
- **Prohibited Activities**: Spam, hacking, data scraping
- **Rate Limits**: API rate limits apply (see docs)

## 5. Payment Terms (Cloud Plans)
- **Subscription**: Monthly/annual billing
- **Cancellation**: Cancel anytime, no refunds
- **Price Changes**: 30-day notice for price increases

## 6. Data Ownership
- **Your Data**: You own all data you upload
- **Our IP**: We own the DRM software and documentation

## 7. Termination
- **By You**: Cancel subscription anytime
- **By Us**: Terminate for terms violation (7-day notice)

## 8. Limitation of Liability
DRM is provided "as-is" without warranties...

## 9. Governing Law
Governed by the laws of Japan...

## 10. Contact Us
Email: legal@devcle.com
```

**Remix実装例**:
```typescript
// packages/core/ui/app/routes/_public.privacy.tsx
import { marked } from 'marked';
import fs from 'fs/promises';
import path from 'path';

export async function loader({ request }: LoaderFunctionArgs) {
  const locale = await i18n.getLocale(request);
  const mdPath = path.join(process.cwd(), 'legal', `privacy-${locale}.md`);
  const markdown = await fs.readFile(mdPath, 'utf-8');
  const html = marked(markdown);
  return json({ html, locale });
}

export default function PrivacyPage() {
  const { html } = useLoaderData<typeof loader>();

  return (
    <div className="legal-page">
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <footer>
        <Link to="/terms">{t('legal.terms')}</Link>
        <Link to="/">{t('legal.back_home')}</Link>
      </footer>
    </div>
  );
}
```

**リンク配置**:
- **Footer**: 全ページのフッターにリンク
- **サインアップフロー**: チェックボックス「利用規約とプライバシーポリシーに同意する」
- **メール**: 配信停止リンクと共にプライバシーポリシーリンク

**更新フロー**:
1. `/legal/*.md` ファイルを更新
2. 最終更新日を変更
3. 既存ユーザーに通知（メールまたはダッシュボード通知）
4. 再同意が必要な場合はログイン時にモーダル表示

## 3. データフロー

### 3.1 データフロー図

```
┌─────────────────────────────────────────────────────────────────┐
│                        Activity Ingestion Flow                   │
└─────────────────────────────────────────────────────────────────┘

External Source (GitHub, Slack, API, Plugin)
   │
   │ POST /v1/activities
   │
   ▼
┌─────────────────┐
│  API Gateway    │ ← Authentication (JWT)
│  (Hono)         │ ← Tenant Resolution
│                 │ ← Rate Limiting
└────────┬────────┘
         │
         │ ActivityInput
         │
         ▼
┌─────────────────────────┐
│  Activity Manager       │
│  .ingest()              │
│                         │
│  1. Validate schema     │
│  2. Extract identifiers │
│  3. Classify stage      │
└────────┬────────────────┘
         │
         │ IdentifierInput[]
         │
         ▼
┌─────────────────────────┐
│  ID Resolver Service    │
│  .resolve()             │
│                         │
│  1. Query identifiers   │
│  2. Compute confidence  │
│  3. Return personId     │
└────────┬────────────────┘
         │
         │ personId (or null)
         │
         ▼
┌─────────────────────────┐
│  Activity Manager       │
│  .enrich()              │
│                         │
│  1. Attach personId     │
│  2. Attach orgId        │
│  3. Set funnel stage    │
└────────┬────────────────┘
         │
         │ EnrichedActivity
         │
         ├────────────────────┐
         │                    │
         ▼                    ▼
┌────────────────┐   ┌──────────────────┐
│  Repository    │   │  PostHog Client  │
│  .create()     │   │  .capture()      │
│                │   │                  │
│  INSERT INTO   │   │  POST /capture   │
│  activities    │   │  (click_id)      │
└────────┬───────┘   └──────────────────┘
         │
         │ activity_id
         │
         ▼
┌─────────────────────────┐
│  Hook Manager           │
│  .emitActivity()        │
│                         │
│  Notify all plugins     │
│  (Slack, AI, etc.)      │
└─────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                       Funnel Analysis Flow                       │
└─────────────────────────────────────────────────────────────────┘

User (Dashboard) or API Client
   │
   │ GET /v1/funnel?start=2025-01-01&campaign=camp_001
   │
   ▼
┌─────────────────┐
│  API Gateway    │
│  (Hono)         │
└────────┬────────┘
         │
         │ FunnelQuery
         │
         ▼
┌─────────────────────────┐
│  Funnel Engine          │
│  .calculate()           │
│                         │
│  1. Build SQL query     │
│  2. Group by stage      │
│  3. Count unique persons│
└────────┬────────────────┘
         │
         │ SQL Query
         │
         ▼
┌─────────────────────────┐
│  Repository             │
│  (Drizzle ORM)          │
│                         │
│  SELECT stage,          │
│    COUNT(DISTINCT       │
│      developer_id)      │
│  FROM activities        │
│  WHERE tenant_id = $1   │
│    AND ts BETWEEN ...   │
│  GROUP BY stage         │
└────────┬────────────────┘
         │
         │ FunnelStage[]
         │
         ▼
┌─────────────────────────┐
│  Cache Layer (Redis)    │
│  SET funnel:key         │
│  EX 300                 │
└────────┬────────────────┘
         │
         │ Cached result
         │
         ▼
┌─────────────────────────┐
│  Funnel Engine          │
│  .compareAnonymous()    │ ─────┐
│                         │      │
│  Merge DRM + PostHog    │      │
└────────┬────────────────┘      │
         │                        │
         │ Combined funnel        │ GET /api/insights/:id
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌──────────────────┐
│  API Response   │      │  PostHog Client  │
│  (JSON)         │      │  .getInsight()   │
└─────────────────┘      └──────────────────┘
```

### 3.2 データ変換

#### Activity Ingestion (POST /v1/activities)

**入力データ形式**:
```json
{
  "type": "github.star",
  "source": "github",
  "timestamp": "2025-10-08T12:34:56Z",
  "metadata": {
    "repo": "devcle/drm",
    "user": "johndoe",
    "url": "https://github.com/devcle/drm"
  },
  "identifiers": [
    { "kind": "github_handle", "value": "johndoe" },
    { "kind": "email", "value": "john@example.com" }
  ],
  "clickId": "clk_abc123"
}
```

**処理過程**:
1. Zodスキーマバリデーション（ActivityInputSchema）
2. ID Resolver呼出 → developerId解決（"dev_xyz789" or null）
3. 分類ルール適用 → funnelStage決定（"github.star" → "awareness"）
4. Enrichment → organizationId補完（email domain → organization lookup）
5. DB永続化 + PostHog送信（並列）

**出力データ形式**:
```json
{
  "activityId": "act_def456",
  "type": "github.star",
  "source": "github",
  "timestamp": "2025-10-08T12:34:56Z",
  "metadata": { ... },
  "developerId": "dev_xyz789",
  "organizationId": "org_abc111",
  "funnelStage": "awareness",
  "confidence": 0.95,
  "clickId": "clk_abc123"
}
```

#### Funnel Analysis (GET /v1/funnel)

**入力データ形式**:
```typescript
{
  tenantId: "ten_aaa",
  startDate: new Date("2025-01-01"),
  endDate: new Date("2025-12-31"),
  campaignId: "camp_001"
}
```

**処理過程**:
1. Redisキャッシュチェック（key: `funnel:ten_aaa:2025-01-01:2025-12-31:camp_001`）
2. Cache miss → SQL集計クエリ実行
3. ステージ別人数カウント（DISTINCT developer_id）
4. コンバージョン率計算（次ステージ/現ステージ）
5. PostHog Insights取得（並列）
6. マージ処理（重複除外、overlap計算）
7. Redis書込（TTL 300秒）

**出力データ形式**:
```json
{
  "drm": [
    { "stage": "awareness", "count": 1500, "uniqueDevelopers": [...], "conversionRate": null },
    { "stage": "engagement", "count": 450, "uniqueDevelopers": [...], "conversionRate": 0.30 },
    { "stage": "adoption", "count": 120, "uniqueDevelopers": [...], "conversionRate": 0.27 },
    { "stage": "advocacy", "count": 30, "uniqueDevelopers": [...], "conversionRate": 0.25 }
  ],
  "posthog": [
    { "stage": "awareness", "count": 2000 },
    { "stage": "engagement", "count": 600 },
    { "stage": "adoption", "count": 150 },
    { "stage": "advocacy", "count": 35 }
  ],
  "overlap": 0.75
}
```

## 4. APIインターフェース

### 4.1 内部API（Core Services）

#### ID Resolver API
```typescript
// packages/core/services/id-resolver.ts
interface IDResolverService {
  // 識別子配列からDeveloperを解決
  resolve(
    tenantId: string,
    identifiers: IdentifierInput[]
  ): Promise<ResolutionResult>;

  // 2つのDeveloperをマージ
  merge(
    tenantId: string,
    sourceDeveloperId: string,
    targetDeveloperId: string
  ): Promise<void>;

  // Developerから識別子を分離（新Developer作成）
  split(
    tenantId: string,
    developerId: string,
    identifierIds: string[]
  ): Promise<{ newDeveloperId: string }>;
}
```

#### Activity Manager API
```typescript
// packages/core/services/activity-manager.ts
interface ActivityManager {
  // 単一イベント取込
  ingest(
    tenantId: string,
    input: ActivityInput
  ): Promise<EnrichedActivity>;

  // バッチイベント取込
  batch(
    tenantId: string,
    inputs: ActivityInput[]
  ): Promise<EnrichedActivity[]>;

  // イベント分類（ファネルステージ判定）
  classify(
    activity: ActivityInput
  ): Promise<{ stage: FunnelStage['stage']; confidence: number }>;
}
```

#### Funnel Engine API
```typescript
// packages/core/services/funnel-engine.ts
interface FunnelEngine {
  // ファネル集計
  calculate(query: FunnelQuery): Promise<FunnelStage[]>;

  // 特定ステージのActivity一覧取得
  getStageActivities(
    query: FunnelQuery,
    stage: FunnelStage['stage']
  ): Promise<EnrichedActivity[]>;

  // DRMとPostHogファネル比較
  compareAnonymous(
    query: FunnelQuery,
    posthogInsightId: string
  ): Promise<{
    drm: FunnelStage[];
    posthog: FunnelStage[];
    overlap: number;
  }>;
}
```

### 4.2 外部API（REST Endpoints）

#### Developers API
```
GET    /v1/developers                # List developers (paginated)
GET    /v1/developers/:id            # Get developer detail
POST   /v1/developers                # Create developer (manual)
PATCH  /v1/developers/:id            # Update developer
DELETE /v1/developers/:id            # Delete developer (soft delete)
POST   /v1/developers/:id/merge      # Merge with another developer
GET    /v1/developers/:id/activities # Get developer's activity history
```

**Example Response** (GET /v1/developers/:id):
```json
{
  "developerId": "dev_xyz789",
  "displayName": "John Doe",
  "primaryEmail": "john@example.com",
  "organizationId": "org_abc111",
  "consentAnalytics": true,
  "identifiers": [
    { "kind": "email", "value": "john@example.com", "confidence": 1.0 },
    { "kind": "github_handle", "value": "johndoe", "confidence": 0.95 }
  ],
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-10-08T12:34:56Z"
}
```

#### Organizations API
```
GET    /v1/organizations             # List organizations
GET    /v1/organizations/:id         # Get organization detail
POST   /v1/organizations             # Create organization
PATCH  /v1/organizations/:id         # Update organization
DELETE /v1/organizations/:id         # Delete organization
GET    /v1/organizations/:id/developers  # Get organization members (developers)
GET    /v1/organizations/:id/funnel  # Get organization-level funnel
```

#### Activities API
```
GET    /v1/activities                # List activities (paginated, filterable)
GET    /v1/activities/:id            # Get activity detail
POST   /v1/activities                # Ingest new activity
POST   /v1/activities/batch          # Batch ingest (up to 1000 events)
POST   /v1/activities/import         # Bulk import from CSV/JSON file
PATCH  /v1/activities/:id            # Update activity metadata
DELETE /v1/activities/:id            # Delete activity
```

**Activity登録の3つの方法**:

1. **バックグラウンドタスク経由**（自動化）
   - プラグインが定期的に外部データソース（Slack, GitHub, connpass等）からデータ取得
   - BullMQジョブで`POST /v1/activities/batch`を呼び出し
   - 例: Slackプラグインが15分ごとに新規メッセージを同期

2. **管理画面フォーム**（手動入力）
   - UI: `/dashboard/activities/new`
   - Remix actionで`POST /v1/activities`を呼び出し
   - カンファレンス参加、オフライン面談等の手動記録に利用

3. **ファイル一括アップロード**（CSV/JSON）
   - UI: `/dashboard/activities/import`
   - `POST /v1/activities/import`（multipart/form-data）
   - 対応形式: CSV（ヘッダー必須）、JSON（配列形式）
   - バリデーション後、`ActivityManager.batch()`で一括登録

**Example Request** (POST /v1/activities):
```json
{
  "type": "slack.message",
  "source": "slack",
  "timestamp": "2025-10-08T15:00:00Z",
  "metadata": {
    "channel": "#devrel",
    "text": "Great article!",
    "thread_ts": "1696780800.123456"
  },
  "identifiers": [
    { "kind": "email", "value": "jane@company.com" }
  ]
}
```

**Example CSV Format** (for import):
```csv
type,source,timestamp,email,github_handle,campaign_id,metadata_json
github.star,github,2025-10-08T12:00:00Z,user@example.com,johndoe,camp_001,"{\"repo\":\"devcle/drm\"}"
slack.message,slack,2025-10-08T13:00:00Z,user2@example.com,,camp_001,"{\"channel\":\"#devrel\"}"
```

**Example JSON Format** (for import):
```json
[
  {
    "type": "github.star",
    "source": "github",
    "timestamp": "2025-10-08T12:00:00Z",
    "identifiers": [
      { "kind": "email", "value": "user@example.com" },
      { "kind": "github_handle", "value": "johndoe" }
    ],
    "metadata": { "repo": "devcle/drm", "campaign_id": "camp_001" }
  }
]
```

#### Funnel API
```
GET    /v1/funnel                    # Calculate funnel
GET    /v1/funnel/compare            # Compare DRM + PostHog funnel
GET    /v1/funnel/stages/:stage      # Get activities for specific stage
```

**Query Parameters** (GET /v1/funnel):
- `start`: ISO 8601 date (required)
- `end`: ISO 8601 date (required)
- `campaignId`: Campaign filter (optional)
- `organizationId`: Organization filter (optional)
- `developerId`: Developer filter (optional)

#### Plugin Management API
```
GET    /v1/plugins                   # List all plugins (installed in node_modules)
POST   /v1/plugins/:id/enable        # Enable plugin
POST   /v1/plugins/:id/disable       # Disable plugin
GET    /v1/plugins/:id/config        # Get plugin config
PUT    /v1/plugins/:id/config        # Update plugin config
```

**Example Response** (GET /v1/plugins):
```json
[
  {
    "id": "slack",
    "name": "Slack Integration",
    "version": "1.0.0",
    "license": "oss",
    "enabled": true,
    "installed": true,
    "configurable": true,
    "config": {
      "webhook_url": "https://hooks.slack.com/...",
      "channel": "#devrel"
    }
  },
  {
    "id": "multi-tenant",
    "name": "Multi-Tenant Support",
    "version": "1.2.0",
    "license": "commercial",
    "enabled": false,
    "installed": true,
    "configurable": false
  }
]
```

#### Plugin API (Dynamic, registered by plugins)
```
GET    /plugins/:pluginId/*          # Plugin-registered routes
POST   /plugins/:pluginId/*
```

Example:
```
POST   /plugins/slack/webhook        # Slack event webhook (registered by drm-plugin-slack)
GET    /plugins/ai-attribution/scores # AI attribution scores
```

#### Email Campaign API
```
GET    /v1/email/templates           # List email templates
POST   /v1/email/templates           # Create email template
GET    /v1/email/templates/:id       # Get template detail
PATCH  /v1/email/templates/:id       # Update template
DELETE /v1/email/templates/:id       # Delete template

GET    /v1/email/campaigns           # List campaigns
POST   /v1/email/campaigns           # Create campaign
GET    /v1/email/campaigns/:id       # Get campaign detail
PATCH  /v1/email/campaigns/:id       # Update campaign
DELETE /v1/email/campaigns/:id       # Delete campaign

POST   /v1/email/campaigns/:id/preview # Preview email for specific developer
POST   /v1/email/campaigns/:id/test    # Send test email
POST   /v1/email/campaigns/:id/send    # Send campaign to all recipients

GET    /v1/email/campaigns/:id/stats   # Get campaign statistics
GET    /v1/email/unsubscribe/:token    # Unsubscribe page (public)
POST   /v1/email/unsubscribe/:token    # Process unsubscribe (public)
```

**Example Request** (POST /v1/email/campaigns):
```json
{
  "name": "Product Launch Announcement",
  "templateId": "tpl_abc123",
  "recipientFilter": {
    "funnelStages": ["awareness", "engagement"],
    "organizationIds": ["org_abc111"]
  },
  "scheduledAt": "2025-10-10T09:00:00Z"
}
```

**Example Response** (GET /v1/email/campaigns/:id/stats):
```json
{
  "campaignId": "camp_xyz789",
  "name": "Product Launch Announcement",
  "status": "sent",
  "recipientCount": 1500,
  "sentCount": 1498,
  "openedCount": 450,
  "clickedCount": 120,
  "unsubscribedCount": 3,
  "openRate": 0.30,
  "clickRate": 0.08,
  "unsubscribeRate": 0.002,
  "topLinks": [
    { "url": "https://example.com/product", "clicks": 80 },
    { "url": "https://example.com/docs", "clicks": 40 }
  ]
}
```

#### URL Shortener API
```
POST   /v1/links                     # Create short URL
GET    /v1/links                     # List short URLs
GET    /v1/links/:shortCode          # Get short URL detail
DELETE /v1/links/:shortCode          # Delete short URL

GET    /v1/links/:shortCode/stats    # Get click statistics
GET    /v1/links/:shortCode/qr       # Download QR code (PNG)
GET    /v1/links/:shortCode/qr.svg   # Download QR code (SVG)

GET    /:shortCode                   # Public redirect endpoint
```

**Example Request** (POST /v1/links):
```json
{
  "url": "https://example.com/signup?ref={{developer_id}}",
  "customCode": "signup-2025",
  "campaignId": "camp_xyz789",
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Example Response**:
```json
{
  "shortCode": "signup-2025",
  "originalUrl": "https://example.com/signup?ref={{developer_id}}",
  "shortUrl": "https://devcle.link/signup-2025",
  "qrCodeUrl": "https://devcle.link/signup-2025/qr",
  "clickCount": 0,
  "createdAt": "2025-10-08T12:00:00Z",
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Example Response** (GET /v1/links/:shortCode/stats):
```json
{
  "shortCode": "signup-2025",
  "totalClicks": 350,
  "uniqueClicks": 280,
  "clicksByDate": [
    { "date": "2025-10-08", "count": 45 },
    { "date": "2025-10-09", "count": 67 }
  ],
  "clicksByCountry": [
    { "country": "US", "count": 120 },
    { "country": "JP", "count": 80 },
    { "country": "UK", "count": 50 }
  ],
  "clicksByDevice": [
    { "device": "mobile", "count": 180 },
    { "device": "desktop", "count": 100 },
    { "device": "tablet", "count": 70 }
  ]
}
```

## 5. エラーハンドリング

### 5.1 エラー分類

#### Client Errors (4xx)

| エラータイプ | HTTPステータス | 対処方法 |
|---|---|---|
| **ValidationError** | 400 Bad Request | Zodスキーマエラーをフォーマットして返却、フィールド単位で詳細提供 |
| **AuthenticationError** | 401 Unauthorized | JWT検証失敗、リフレッシュトークン再取得を促す |
| **AuthorizationError** | 403 Forbidden | テナント外リソースアクセス、権限不足を明示 |
| **NotFoundError** | 404 Not Found | リソースIDが存在しない、削除済み（soft delete）の場合も含む |
| **ConflictError** | 409 Conflict | 一意制約違反（email重複等）、具体的フィールド名を返す |
| **RateLimitError** | 429 Too Many Requests | レート制限超過、Retry-Afterヘッダーで再試行時刻を通知 |

#### Server Errors (5xx)

| エラータイプ | HTTPステータス | 対処方法 |
|---|---|---|
| **DatabaseError** | 500 Internal Server Error | PostgreSQL接続失敗、トランザクション失敗、監査ログ記録 + アラート |
| **PluginError** | 500 Internal Server Error | プラグイン実行エラー、プラグイン名とスタックトレースを記録、隔離継続 |
| **ExternalAPIError** | 502 Bad Gateway | PostHog等の外部API障害、exponential backoff retry後に失敗通知 |
| **TimeoutError** | 504 Gateway Timeout | 重い集計クエリタイムアウト、バックグラウンドジョブ化を提案 |

### 5.2 エラー通知

#### エラーレスポンス形式
```typescript
interface ErrorResponse {
  error: {
    code: string;          // "VALIDATION_ERROR", "NOT_FOUND", etc.
    message: string;       // User-friendly message
    details?: unknown;     // Field-level errors, stack trace (dev only)
    requestId: string;     // Trace ID for debugging
  };
}
```

**Example**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid activity input",
    "details": {
      "type": "Required field",
      "timestamp": "Invalid ISO 8601 format"
    },
    "requestId": "req_abc123def456"
  }
}
```

#### ログ戦略

**構造化ログ（JSON形式）**:
```typescript
logger.error({
  level: 'error',
  timestamp: new Date().toISOString(),
  requestId: 'req_abc123',
  tenantId: 'ten_aaa',
  userId: 'usr_xyz',
  error: {
    code: 'DATABASE_ERROR',
    message: err.message,
    stack: err.stack,
  },
  context: {
    query: 'INSERT INTO activities',
    params: { ... },
  },
});
```

**ログレベル**:
- `error`: クライアント影響あり（5xx、データ損失リスク）
- `warn`: 潜在的問題（レート制限接近、プラグイン遅延）
- `info`: 正常動作記録（API呼出、認証成功）
- `debug`: 詳細トレース（SQL実行計画、プラグインフック）

**外部通知**:
- Slack通知: 5xx発生時、プラグイン経由で #alerts チャンネル
- Sentry統合: エラースタックトレース、ユーザーコンテキスト付き
- PostHog統合: エラーイベント送信（匿名集計用）

## 6. セキュリティ設計

### 6.1 認証・認可

#### 認証フロー（JWT + OAuth2）

```
User → Login (email/password)
  ↓
Auth Service (Core)
  ↓
JWT発行 { sub: userId, tenantId, roles: ['admin'], exp: 1h }
  ↓
Client stores JWT (httpOnly cookie or localStorage)
  ↓
API Request with Authorization: Bearer <JWT>
  ↓
Middleware validates JWT (signature, expiration)
  ↓
Extract { userId, tenantId, roles } → set in context
  ↓
Proceed to handler
```

**JWTペイロード**:
```typescript
interface JWTPayload {
  sub: string;        // userId
  tenantId: string;
  roles: string[];    // ['admin', 'member', 'viewer']
  exp: number;        // Unix timestamp
  iat: number;
}
```

#### 認可（Role-Based Access Control）

| Role | Permissions |
|---|---|
| **admin** | Full access (CRUD people, orgs, activities, plugins, settings) |
| **member** | Read all, Create activities, Update own person profile |
| **viewer** | Read-only (funnel, dashboards, activities) |

**実装**:
```typescript
// Middleware: packages/core/api/middleware/authorize.ts
function authorize(allowedRoles: string[]) {
  return async (c: Context, next: Next) => {
    const { roles } = c.get('user');
    if (!roles.some(r => allowedRoles.includes(r))) {
      throw new AuthorizationError('Insufficient permissions');
    }
    await next();
  };
}

// Usage
app.delete('/v1/people/:id', authorize(['admin']), deletePerson);
```

### 6.2 データ保護

#### PII暗号化

**暗号化対象**:
- `developers.primary_email`
- `developers.display_name`
- `identifiers.value` (email, phone)
- `activities.metadata` (user-generated content)

**実装方式**:
- AES-256-GCM（対称鍵暗号）
- 暗号鍵管理: AWS KMS or HashiCorp Vault（テナント別鍵）
- DB保存時: `encrypted_data` BYTEA型、`encryption_key_id` 参照

```typescript
// packages/core/db/encryption.ts
import { createCipheriv, createDecipheriv } from 'crypto';

class EncryptionService {
  async encrypt(tenantId: string, plaintext: string): Promise<Buffer> {
    const key = await this.getKey(tenantId); // Fetch from KMS
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
  }

  async decrypt(tenantId: string, ciphertext: Buffer): Promise<string> {
    const key = await this.getKey(tenantId);
    const iv = ciphertext.subarray(0, 16);
    const authTag = ciphertext.subarray(16, 32);
    const encrypted = ciphertext.subarray(32);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
```

#### Row Level Security (RLS) - Cloud版のみ（プラグイン実装）

**PostgreSQL RLSポリシー（multi-tenantプラグインが管理）**:
```sql
-- RLS is NOT enabled by default in OSS (single tenant "default")
-- Cloud plugin enables RLS for multi-tenancy

-- Policy: Users can only access their tenant's data (Cloud only)
CREATE POLICY tenant_isolation ON developers
  USING (tenant_id = current_setting('drm.tenant_id', true)::text);

CREATE POLICY tenant_isolation ON organizations
  USING (tenant_id = current_setting('drm.tenant_id', true)::text);

CREATE POLICY tenant_isolation ON activities
  USING (tenant_id = current_setting('drm.tenant_id', true)::text);
```

**アプリケーション側設定（multi-tenantプラグイン）**:
```typescript
// packages/plugins/drm-plugin-multi-tenant/index.ts
export default definePlugin({
  id: "multi-tenant",
  name: "Multi-Tenant Support",
  hooks: {
    onRequest({ request, db, context }) {
      // Extract tenantId from JWT
      const tenantId = extractTenantFromJWT(request);
      context.tenantId = tenantId;  // Override default "default"

      // Set RLS context
      await db.execute(sql`SET LOCAL drm.tenant_id = ${tenantId}`);
    },
    onInit({ registerAPI }) {
      // Register tenant management APIs
      registerAPI("/v1/tenants", tenantCRUDHandler);
    },
  },
});
```

**OSS版の動作**:
- RLSは無効（パフォーマンス優先）
- すべてのクエリに`WHERE tenant_id = 'default'`が自動付与
- 単一テナントのみサポート

#### 匿名データ保護（PostHog）

- click_idは一時ID（24h有効期限）、個人識別不可
- PostHogへ送信するpropertiesはPIIを含まない（campaign_id, route等のメタデータのみ）
- 統計集計後はclick_id削除（GDPR準拠）

#### 監査ログ

**記録対象**:
- Developer/Organization CRUD操作（誰が、いつ、何を）
- プラグインインストール/アンインストール
- データエクスポート（CSV, API）
- ログイン/ログアウト（成功・失敗）

**スキーマ**:
```typescript
interface AuditLog {
  logId: string;
  tenantId: string;
  userId: string;
  action: string;        // "developer.create", "plugin.install"
  resourceType: string;  // "developer", "plugin"
  resourceId: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
```

**保存期間**:
- 90日間（Standard）
- 1年間（Pro）
- 無期限（Enterprise）

## 7. テスト戦略

### 🚨 テストの3大禁止事項（必読）

1. **モック絶対禁止**
   - 外部API（PostHog, ライセンスAPI）のモック禁止
   - DB操作のモック禁止
   - プラグインのモック禁止
   - **理由**: モックは実際の挙動と乖離し、本番障害を見逃す原因になる

2. **フォールバック絶対禁止**
   - テスト失敗時のデフォルト値設定禁止（`|| 'default'`）
   - try-catchでのエラー握りつぶし禁止
   - **理由**: 問題を隠蔽し、不具合の温床になる

3. **スキップ絶対禁止**
   - `it.skip()`, `describe.skip()`, `xit()` 禁止
   - 条件分岐によるテスト回避禁止
   - **理由**: スキップされたテストは永遠に実行されず、デグレを引き起こす

### 7.1 単体テスト

**カバレッジ目標**: 80%以上（Core Services, Repositories）

**テストフレームワーク**: Vitest

**テスト対象**:
- Services（ID Resolver, Activity Manager, Funnel Engine）
- Repositories（Developer, Organization, Activity）
- Plugin System（Loader, Hook Manager, Registry）
- Utilities（encryption, validation, parsers）

**テスト方針**:
```typescript
// packages/core/services/__tests__/id-resolver.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { IDResolverService } from '../id-resolver';
import { createTestDB } from '../../db/test-utils';

describe('IDResolverService', () => {
  let service: IDResolverService;
  let db: TestDB;

  beforeEach(async () => {
    db = await createTestDB();
    service = new IDResolverService(db);
  });

  it('should resolve developer by email (exact match)', async () => {
    await db.developers.insert({
      developerId: 'dev_test',
      tenantId: 'ten_test',
      primaryEmail: 'test@example.com',
    });

    const result = await service.resolve('ten_test', [
      { kind: 'email', value: 'test@example.com' }
    ]);

    expect(result.developerId).toBe('dev_test');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should suggest merge when multiple developers match', async () => {
    // ... test implementation
  });
});
```

**🚨 テストの絶対禁止事項**:
1. **モック禁止**: 外部API、DB、プラグインを含む**すべてのモックを絶対に使用しない**
   - ❌ `vitest.mock()`, `msw`, `sinon`, `jest.fn()` などのモック
   - ✅ 実際のPostHog APIまたはローカルホスト版PostHog（Docker）
   - ✅ 実際のPostgreSQL（Docker Composeでテスト用DB）
   - ✅ 実際のプラグイン（テスト用プラグインも実装を持つ）
2. **フォールバック禁止**: テストで失敗時のフォールバック処理を**絶対に使用しない**
   - ❌ `try-catch`でエラーを握りつぶす
   - ❌ `|| default値`でフォールバック
   - ✅ テストが失敗したら明確にエラーを出す
3. **スキップ禁止**: テストのスキップを**絶対に使用しない**
   - ❌ `it.skip()`, `describe.skip()`, `xit()`, `xdescribe()`
   - ❌ `if (condition) return;` でテストを回避
   - ✅ すべてのテストケースを必ず実行する

**実テスト環境構築**:
- Docker Compose（`docker/compose.test.yml`）
  - PostgreSQL（テスト専用DB）
  - Redis（テスト専用）
  - PostHog（セルフホスト版、テスト専用プロジェクト）
- テストデータは各テストで完全にクリーンアップ（トランザクションロールバック）
- 各テストケースは独立して実行可能（並列実行対応）

### 7.2 統合テスト

**テストフレームワーク**: Vitest + Supertest (API testing)

**テスト対象**:
- API Endpoints（/v1/developers, /v1/activities, /v1/funnel）
- Plugin Lifecycle（install → load → hook → unload）
- Data Flow（Activity ingestion → ID resolution → Funnel update）
- PostHog Integration（capture → insights fetch → merge）

**テスト環境**:
- Docker Compose（`docker/compose.test.yml`）
  - PostgreSQL（テスト用DB）
  - Redis（テスト用）
  - PostHog セルフホスト版（実際のインスタンス）
  - **注意**: PostHogは実際のセルフホスト版を使用（モックサーバー禁止）
- CI/CD: GitHub Actions（matrix: Node 20, 22）
  - `docker compose -f docker/compose.test.yml up` で環境構築
  - すべてのテストを必ず実行（スキップ禁止）
  - テスト失敗時はビルド失敗させる（フォールバック禁止）

**テスト例**:
```typescript
// packages/core/api/__tests__/activities.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer } from '../test-utils';
import request from 'supertest';

describe('POST /v1/activities', () => {
  let app: App;

  beforeAll(async () => {
    app = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(app);
  });

  it('should ingest activity and resolve person', async () => {
    const response = await request(app)
      .post('/v1/activities')
      .set('Authorization', 'Bearer test-jwt')
      .send({
        type: 'github.star',
        source: 'github',
        timestamp: '2025-10-08T12:00:00Z',
        identifiers: [{ kind: 'email', value: 'test@example.com' }],
      })
      .expect(201);

    expect(response.body.activityId).toBeDefined();
    expect(response.body.developerId).toBeDefined();
    expect(response.body.funnelStage).toBe('awareness');
  });
});
```

### 7.3 E2Eテスト（Phase 2以降）

**ツール**: Playwright（UI自動化）

**シナリオ**:
1. ログイン → ダッシュボード表示
2. Activity手動登録 → ファネル更新確認
3. プラグインインストール → Slack連携動作確認
4. PostHog統合 → 匿名ファネル比較表示

**🚨 E2Eテストの絶対禁止事項**:
- **モック禁止**: 実際のブラウザ、実際のDB、実際の外部API使用
- **スキップ禁止**: すべてのE2Eシナリオを必ず実行
- **フォールバック禁止**: UI要素が見つからない場合は即失敗（リトライ回数の過剰設定も禁止）

**実行環境**:
- Docker Compose（`docker/compose.test.yml`）を使用
  - 実際のPostgreSQL, Redis, PostHog（セルフホスト版）
  - 実際のSlack Webhook（テスト用チャンネル）
- CI/CD環境でも同じDocker環境を再現
  ```bash
  docker compose -f docker/compose.test.yml up -d
  pnpm test:e2e
  docker compose -f docker/compose.test.yml down
  ```

## 8. パフォーマンス最適化

### 8.1 想定される負荷

**Phase 1目標（Community/Standard）**:
- リクエスト: 100 req/sec
- Activities ingestion: 1,000 events/min
- Concurrent users: 50
- DB size: 10GB（1M developers, 10M activities）

**Phase 3目標（Pro/Enterprise）**:
- リクエスト: 1,000 req/sec
- Activities ingestion: 10,000 events/min
- Concurrent users: 500
- DB size: 100GB（10M developers, 100M activities）

### 8.2 最適化方針

#### DB最適化

**インデックス戦略**:
```sql
-- Tenant isolation (RLS利用のため必須)
CREATE INDEX idx_developers_tenant ON developers(tenant_id);
CREATE INDEX idx_activities_tenant ON activities(tenant_id);

-- Funnel queries
CREATE INDEX idx_activities_tenant_ts ON activities(tenant_id, ts DESC);
CREATE INDEX idx_activities_tenant_stage ON activities(tenant_id, funnel_stage);
CREATE INDEX idx_activities_developer ON activities(developer_id, ts DESC);

-- ID resolution
CREATE INDEX idx_identifiers_kind_value ON identifiers(kind, value);
CREATE INDEX idx_identifiers_developer ON identifiers(developer_id);

-- Campaign filtering
CREATE INDEX idx_activities_campaign ON activities(tenant_id, (metadata->>'campaign_id'));
```

**パーティショニング**（Phase 3）:
```sql
-- Time-based partitioning for activities
CREATE TABLE activities (
  ...
) PARTITION BY RANGE (ts);

CREATE TABLE activities_2025_01 PARTITION OF activities
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Monthly partitions for high-volume tenants
```

**マテリアライズドビュー**（ファネル集計）:
```sql
CREATE MATERIALIZED VIEW funnel_daily AS
SELECT
  tenant_id,
  DATE(ts) AS date,
  funnel_stage,
  COUNT(DISTINCT developer_id) AS unique_developers
FROM activities
GROUP BY tenant_id, DATE(ts), funnel_stage;

-- Refresh every hour (cron job)
REFRESH MATERIALIZED VIEW CONCURRENTLY funnel_daily;
```

#### キャッシュ戦略

**Redis利用箇所**:
1. ファネル集計結果（TTL 5分）
2. Developer詳細（TTL 10分、invalidate on update）
3. PostHog Insights（TTL 1時間）
4. セッション管理（JWT blacklist）
5. レート制限カウンター（sliding window）

**キャッシュキー設計**:
```typescript
// Funnel cache
const key = `funnel:${tenantId}:${startDate}:${endDate}:${campaignId || 'all'}`;

// Developer cache
const key = `developer:${tenantId}:${developerId}`;

// Rate limit (per tenant)
const key = `ratelimit:${tenantId}:${minute}`;
```

#### バッチ処理

**Activity ingestion batching**:
```typescript
// POST /v1/activities/batch (up to 1000 events)
async function batchIngest(tenantId: string, inputs: ActivityInput[]) {
  // 1. Bulk ID resolution (single query with IN clause)
  const identifiers = inputs.flatMap(i => i.identifiers);
  const resolutions = await idResolver.bulkResolve(tenantId, identifiers);

  // 2. Bulk insert activities (single transaction)
  await db.transaction(async tx => {
    await tx.activities.insertMany(enrichedActivities);
  });

  // 3. Async PostHog capture (background job)
  await queue.add('posthog.capture', { events: enrichedActivities });
}
```

#### 非同期処理（BullMQ）

**バックグラウンドジョブ**:
1. PostHog event送信（Activity ingestion後）
2. プラグイン同期（Slack message sync等、15分cron）
3. 重いファネル集計（マテリアライズドビュー更新）
4. データエクスポート（CSV生成）

**ジョブ優先度**:
- High: PostHog capture（リアルタイム性重視）
- Medium: プラグイン同期
- Low: エクスポート、統計計算

## 9. デプロイメント

### 9.1 Docker Compose構成

プロジェクトは**3つのDocker Compose**ファイルを使い分ける：

#### 1. 本番用（`compose.production.yml`）
- **用途**: 本番環境デプロイ
- **特徴**:
  - アプリケーションコンテナのみ
  - PostgreSQL/Redisは外部サービス（AWS RDS, ElastiCache等）
  - 環境変数で外部DB/Redis接続
- **起動**: `docker compose -f docker/compose.production.yml up -d`

#### 2. 開発用（`compose.development.yml`）
- **用途**: ローカル開発環境
- **特徴**:
  - 本番用をベースに、PostgreSQL/Redisをローカルで追加
  - ホットリロード対応（volumeマウント）
  - ヘルスチェック設定
- **起動**: `docker compose -f docker/compose.development.yml up -d`

#### 3. テスト用（`compose.test.yml`）
- **用途**: 単体/統合/E2Eテスト実行環境
- **特徴**:
  - テスト専用PostgreSQL/Redis/PostHog（セルフホスト版）
  - 各テスト後にクリーンアップ
  - CI/CD環境で使用
- **起動**: `docker compose -f docker/compose.test.yml up -d`

### 9.2 デプロイ構成

#### Phase 1 (Community/OSS)

**本番用 Docker Compose**:
```yaml
# docker/compose.production.yml
services:
  app:
    image: drm/core:latest
    ports:
      - "3000:3000"
    environment:
      # 外部PostgreSQL/Redis接続（環境変数で指定）
      DATABASE_URL: ${DATABASE_URL}  # 例: postgresql://user:pass@external-db.example.com:5432/drm
      REDIS_URL: ${REDIS_URL}        # 例: redis://external-redis.example.com:6379
      POSTHOG_API_KEY: ${POSTHOG_API_KEY}
      NODE_ENV: production
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    restart: unless-stopped

volumes:
  caddy_data:
```

**開発用 Docker Compose**:
```yaml
# docker/compose.development.yml
# 本番用をベースに、PostgreSQL/Redisをローカルで追加
services:
  app:
    image: drm/core:latest
    build:
      context: ..
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://drm:password@db:5432/drm
      REDIS_URL: redis://redis:6379
      POSTHOG_API_KEY: ${POSTHOG_API_KEY}
      NODE_ENV: development
    volumes:
      - ../packages:/app/packages  # ホットリロード用
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  # 開発用PostgreSQL（本番は外部サービス利用）
  db:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: drm
      POSTGRES_USER: drm
      POSTGRES_PASSWORD: password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U drm"]
      interval: 5s
      timeout: 5s
      retries: 5

  # 開発用Redis（本番は外部サービス利用）
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data

volumes:
  db_data:
  redis_data:
  caddy_data:
```

**使い分け**:
- **開発環境**: `docker compose -f docker/compose.development.yml up`
  - PostgreSQL/Redisをローカルで起動
  - ホットリロード対応
- **本番環境**: `docker compose -f docker/compose.production.yml up`
  - 外部PostgreSQL/Redis（AWS RDS, ElastiCache等）に接続
  - アプリケーションコンテナのみ起動

#### Phase 4 (Cloud/SaaS)

**Kubernetes (GKE/EKS/AKS)**:
- Deployment: drm-api (3 replicas, HPA 3-10)
- Deployment: drm-worker (BullMQ consumers, 2 replicas)
- 外部サービス:
  - PostgreSQL: AWS RDS / GCP Cloud SQL / Azure Database for PostgreSQL
  - Redis: AWS ElastiCache / GCP Memorystore / Azure Cache for Redis
- Ingress: NGINX or Traefik (TLS termination)

**接続方法**:
```yaml
# k8s/deployment.yml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: drm-secrets
        key: database-url  # 例: postgresql://user:pass@rds.amazonaws.com:5432/drm
  - name: REDIS_URL
    valueFrom:
      secretKeyRef:
        name: drm-secrets
        key: redis-url  # 例: redis://elasticache.amazonaws.com:6379
```

**Cloud Plugins配布**:
- npm registry経由で配信（@devcle/plugin-*）
- npm provenance署名で信頼性確保
- ライセンスAPI（Vercel Edge Function）で認証（起動時・月次チェック）
- 更新: `pnpm update`で手動更新（または dependabot自動PR）

### 9.3 設定管理

#### 環境変数

```bash
# .env.example
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@host:5432/drm
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_URL=redis://host:6379
REDIS_CACHE_TTL=300

# PostHog
POSTHOG_API_KEY=phc_xxxxx
POSTHOG_HOST=https://app.posthog.com

# Security
JWT_SECRET=random-256-bit-secret
JWT_EXPIRATION=1h
ENCRYPTION_KEY_ID=kms://aws/alias/drm-prod

# Tenant (OSS)
DEFAULT_TENANT_ID=default  # Single tenant ID for OSS version

# Plugin System
PLUGIN_DIRS=/app/plugins,/var/lib/drm/cloud-plugins
PLUGIN_SIGNATURE_PUBLIC_KEY=/app/keys/public.pem

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60s

# Logging
LOG_LEVEL=info
SENTRY_DSN=https://xxx@sentry.io/xxx

# Cloud (SaaS only)
LICENSE_API_URL=https://api.devcle.com/license
CLOUD_TENANT_ID=ten_cloud_prod
```

#### シークレット管理

**開発環境**: `.env`ファイル（gitignore）

**本番環境**:
- AWS: Secrets Manager + IAM Role
- GCP: Secret Manager + Workload Identity
- Kubernetes: Sealed Secrets or External Secrets Operator

**アクセス制御**:
- DBパスワード: アプリケーションのみ
- 暗号化鍵: KMSから動的取得
- プラグインシークレット: テナント別暗号化保存

## 10. 実装上の注意事項

### 10.1 コーディング規約

- **TypeScript strict mode必須**（exactOptionalPropertyTypes有効）
- **any/unknown禁止**（適切な型定義）
- **class使用禁止**（関数型優先、Errorクラス継承は例外）
- **ハードコーディング禁止**（設定値は環境変数 or DB）
- **console.log禁止**（構造化logger使用）

### 10.2 プラグインシステム

#### プラグインインストール
- **手動インストール**: `pnpm add @devcle/plugin-<name>`
- **package.jsonに追加**: プロジェクトの依存関係として管理
- **自動検出**: 起動時に`node_modules/@devcle/plugin-*`をスキャン

#### プラグイン有効化
- **UI経由**: `/dashboard/plugins`で有効化/無効化ボタン
- **DBで管理**: `enabled_plugins`テーブルに記録
- **Hot reload**: 有効化/無効化時に再起動不要

#### プラグイン開発
- **npm package**: `@devcle/plugin-<name>`形式で公開
- **plugin.json**: マニフェストファイル（name, version, license, permissions）
- **entry point**: `index.ts`で`definePlugin()`呼出
- **署名**: 商用プラグインはnpm publish時に署名（npm provenance）

#### セキュリティ
- **コアAPIは後方互換性維持**（breaking changeはメジャーバージョンアップ）
- **プラグイン障害はコアに影響させない**（try-catch + timeout）
- **サンドボックス必須**（VM2、permissions制御）
- **署名検証**: 商用プラグインはnpm provenanceで検証

### 10.3 テナント管理

#### OSS版（単一テナント）
- **tenantIdは常に"default"**（環境変数で変更可能）
- **RLS無効**（パフォーマンス優先、WHERE句で分離）
- **マルチテナント機能なし**（tenant CRUD APIなし）

#### Cloud版（マルチテナント）
- **multi-tenantプラグイン必須**
- **JWTからtenantId抽出**（プラグインが実装）
- **RLS有効化**（プラグインがPOLICY管理）
- **Tenant管理API提供**（/v1/tenants - プラグインが登録）

#### 共通設計原則
- **tenantIdパラメータは全関数で維持**（後方互換性）
- **Repository層は変更不要**（プラグインが透過的に動作）
- **OSS→Cloud移行は設定のみ**（コード変更不要）

### 10.4 データベース

- **全クエリにtenantId条件**（WHERE tenant_id = $1 を明示的に）
- **OSS版でもtenantIdカラム必須**（将来のCloud移行を考慮）
- **マイグレーションはロールバック可能に**（DOWN migration必須）
- **N+1クエリ禁止**（Drizzle includeやjoinを活用）
- **トランザクション分離レベル**（READ COMMITTED、必要に応じてSERIALIZABLE）

### 10.4 セキュリティ

- **JWT検証必須**（全APIエンドポイント、public除く）
- **PII暗号化必須**（email, name, user content）
- **レート制限必須**（tenant別、IP別）
- **SQL injection対策**（Drizzle ORM使用、raw query禁止）
- **XSS対策**（RemixのデフォルトエスケープRelying、dangerouslySetInnerHTML禁止）

### 10.5 PostHog連携

#### 🚨 絶対禁止事項（CRITICAL）
1. **PostHog本体のカスタマイズ禁止**
   - PostHogのソースコードを変更しない
   - PostHogをフォークしない
   - PostHogデータベースに直接アクセスしない

2. **PostHogプラグインの独自開発禁止**
   - PostHog公式プラグインのみ使用可能
   - DRM側でデータ処理を実装する

3. **PostHog内部APIの直接利用禁止**
   - 公式API（Capture, Insights, Persons）のみ使用
   - 内部エンドポイントへの直接アクセス禁止

#### 許可される操作
- ✅ PostHog公式APIの利用（REST API）
- ✅ PostHog設定画面での設定変更
- ✅ PostHog公式プラグインの利用
- ✅ PostHog Webhookの受信（DRM側でハンドリング）
- ✅ PostHog SDKの標準的な使用

#### 理由
- PostHogをサードパーティサービスとして扱う
- アップグレード時の互換性を保証
- 保守性・運用コストの最小化
- PostHog側の仕様変更に影響されない

### 10.6 パフォーマンス

- **N+1回避**（DataLoader or batch fetching）
- **重いクエリはバックグラウンド化**（BullMQ）
- **キャッシュ戦略明確化**（TTL、invalidation）
- **ペジネーション必須**（list APIは全てcursor or offset）

### 10.7 テスト

#### 🚨 絶対禁止事項（CRITICAL）
1. **モック絶対禁止**
   - 外部API、DB、プラグイン、サービスのモックを一切使わない
   - テストは実環境と同じ構成で動作させる
   - 理由: モックは実際の挙動との乖離を生み、本番障害を見逃す

2. **フォールバック絶対禁止**
   - テスト失敗時のフォールバック処理を一切書かない
   - `|| defaultValue`、`try-catch`でのエラー握りつぶし禁止
   - 理由: フォールバックは不具合を隠蔽し、問題の特定を困難にする

3. **テストスキップ絶対禁止**
   - `it.skip()`, `describe.skip()`, `xit()` 等の使用禁止
   - 条件分岐によるテスト回避も禁止
   - 理由: スキップされたテストは永遠に実行されず、デグレの温床になる

#### テスト実装方針
- **E2E前に単体/統合テスト完備**
- **テストDBは隔離**（各テストで完全にクリーンアップ、トランザクションロールバック）
- **実環境利用**（`docker/compose.test.yml` で環境構築）
  - PostgreSQL（テスト専用DB）
  - Redis（テスト専用）
  - PostHog セルフホスト版（テスト専用プロジェクト）
- **CI/CDで自動実行**（PR時、main merge時、すべてのテストを必ず実行）
- **テスト失敗は即修正**（フォールバックやスキップで回避しない）

### 10.8 監視・運用

- **構造化ログ必須**（JSON、requestId付与）
- **エラーは必ずログ+通知**（Sentry, Slack）
- **メトリクス収集**（API latency, DB query time, queue depth）
- **ヘルスチェックエンドポイント**（GET /health → DB/Redis接続確認）

---

## 次のステップ

1. **設計レビュー**
   - アーキテクチャの妥当性確認
   - パフォーマンス目標の現実性検証
   - セキュリティ要件の充足確認

2. **タスク分解**（/tasks コマンド）
   - 実装可能な単位へ分割
   - 優先順位付け（Phase 1必須機能）
   - 依存関係整理

3. **プロトタイピング**（Phase 1-alpha）
   - 最小限のCore API実装
   - DB schema作成
   - Plugin Loader基本動作確認
   - PostHog連携テスト

4. **OSS準備**（Phase 2）
   - ライセンス選定（MIT or BSL）
   - ドキュメント整備
   - コントリビューションガイド作成
