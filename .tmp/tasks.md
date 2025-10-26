# タスクリスト - DRM（DevRel Management）MVP 開発

**Version:** 1.0
**Based on:** requirements.md v2.2, design.md v2.5
**Strategy:** アジャイル開発 - 常にデプロイ可能な状態を維持

---

## 概要

サービス名は `DevCle`（DevRel + Circle の造語）。本番環境のドメインは `devcle.com`。開発環境は `devcle.test`。

- **総タスク数**: 48 タスク
- **推定作業時間**: 4-6 週間（1 名）
- **優先度**: 高
- **開発方針**:
  - docker-compose 構築を最優先
  - 各タスク完了後にデプロイ・動作確認可能な状態を維持
  - MVP から段階的に機能追加
  - LP・規約・プライバシーポリシーも初期から組み込み

---

## Phase 1: 環境構築とインフラ基盤（デプロイ可能な最小構成）

### Task 1.1: プロジェクト初期構造と core パッケージセットアップ ✅

- [x] `core/`の package.json 作成（Remix, TypeScript）
- [x] TypeScript strict 設定（`exactOptionalPropertyTypes`含む）
- [x] ESLint 9 flat config 設定
- [x] Prettier 設定
- [x] `.gitignore`作成
- **完了条件**: `pnpm install`が core パッケージで成功
- **依存**: なし
- **推定時間**: 2 時間
- **ドキュメント**: [.tmp/tasks/task-1.1-monorepo-setup.md](.tmp/tasks/task-1.1-monorepo-setup.md)
- **注意**: プラグイン（posthog 等）は不要。core のみ構築。
- **完了日**: 2025-10-10

### Task 1.2: Docker Compose 構成ファイル作成 ✅

- [x] `docker-compose.yml`作成（nginx, core, postgres, redis）
- [x] `docker-compose-dev.yml`作成（開発環境用オーバーライド）
- [x] `core/Dockerfile`作成（Node.js 20, pnpm）
- [x] `.dockerignore`作成
- [x] `.env.example`作成（環境変数テンプレート）
- **完了条件**: `docker-compose up -d`でコンテナが起動
- **依存**: Task 1.1
- **推定時間**: 3 時間
- **完了日**: 2025-10-11

### Task 1.3: nginx 設定とリバースプロキシ ✅

- [x] `nginx/nginx.conf`作成
- [x] HTTPS リダイレクト設定（開発環境・本番環境共通）
- [x] 静的ファイル配信設定（`/public`）
- [x] Remix アプリへのプロキシ設定
- [x] ヘルスチェックエンドポイント（`/health`）
- **完了条件**: nginx が起動し、Remix アプリにプロキシされる
- **依存**: Task 1.2
- **推定時間**: 2 時間
- **ドキュメント**: [.tmp/tasks/task-1.3-nginx-setup.md](.tmp/tasks/task-1.3-nginx-setup.md)
- **完了日**: 2025-10-11

### Task 1.4: PostgreSQL 初期設定 ✅

- [x] 初期化スクリプト（`infra/postgres/init.sql`）
- [x] pgcrypto 拡張の有効化
- [x] テナント用 RLS ポリシーのテンプレート作成（`infra/postgres/rls-template.sql`）
- [x] データベースバックアップ設定（docker volume）
- **完了条件**: PostgreSQL コンテナが起動し、接続可能
- **依存**: Task 1.2
- **推定時間**: 1.5 時間
- **ドキュメント**: [.tmp/tasks/task-1.4-postgres-init.md](.tmp/tasks/task-1.4-postgres-init.md)
- **完了日**: 2025-10-11

### Task 1.5: Redis 初期設定 ✅

- [x] `redis/redis.conf`作成
- [x] パスワード認証設定
- [x] メモリ上限・eviction ポリシー設定
- [x] 永続化設定（AOF）
- **完了条件**: Redis コンテナが起動し、接続可能
- **依存**: Task 1.2
- **推定時間**: 1 時間
- **ドキュメント**: [.tmp/tasks/task-1.5-redis-init.md](.tmp/tasks/task-1.5-redis-init.md)
- **完了日**: 2025-10-11

---

## Phase 2: Remix アプリケーション基盤（最小限の UI）

### Task 2.1: Remix 初期セットアップ ✅

- [x] Remix v2 プロジェクト初期化（`core/`）
- [x] TailwindCSS 設定
- [x] ルートレイアウト作成（`app/root.tsx`）
- [x] エラーバウンダリ設定
- [x] 環境変数読み込み（`DATABASE_URL`, `REDIS_URL`）
- **完了条件**: Remix アプリが起動し、ルートページが表示される
- **依存**: Task 1.2
- **推定時間**: 2 時間
- **完了日**: 2025-10-11

### Task 2.2: LP（トップページ）作成 ✅

- [x] `app/routes/_index.tsx`作成
- [x] ヒーローセクション（キャッチコピー、CTA）
- [x] 機能紹介セクション（DRM, ROI, Funnel）
- [x] デモリンク・ドキュメントリンク
- [x] フッター（規約・プライバシーポリシーリンク）
- **完了条件**: トップページが表示され、デザインが整っている
- **依存**: Task 2.1
- **推定時間**: 3 時間
- **完了日**: 2025-10-12

### Task 2.3: 利用規約ページ作成 ✅

- [x] `app/routes/terms.tsx`作成
- [x] 利用規約の文章作成（OSS 版・SaaS 版共通）
- [x] TailwindCSS でマークダウンスタイル適用
- **完了条件**: `/terms`でページが表示される
- **依存**: Task 2.1
- **推定時間**: 2 時間
- **ドキュメント**: [.tmp/tasks/task-2.3-terms-page.md](.tmp/tasks/task-2.3-terms-page.md)
- **完了日**: 2025-10-12

### Task 2.4: プライバシーポリシーページ作成 ✅

- [x] `app/routes/privacy.mdx`作成
- [x] プライバシーポリシーの文章作成（GDPR/CCPA 対応）
- [x] データ収集・利用・保管方針の記載
- **完了条件**: `/privacy`でページが表示される
- **依存**: Task 2.1
- **推定時間**: 2 時間
- **ドキュメント**: [.tmp/tasks/task-2.4-privacy-page.md](.tmp/tasks/task-2.4-privacy-page.md)
- **完了日**: 2025-10-12

### Task 2.5: プライシングページ作成 ✅

- [x] `app/routes/pricing.mdx`作成
- [x] 料金表作成
  - OSS 版（無料）
    - セルフホスト
    - 基本プラグイン
  - SaaS 版（有料）
    - Basic, Team, Enterprise プラン
- [x] ダークモード対応（Tailwind v4 @custom-variant 設定）
- [x] E2E テスト作成（18 テスト）
- **完了条件**: `/pricing`でページが表示される
- **依存**: Task 2.1
- **推定時間**: 2 時間
- **完了日**: 2025-10-12

---

## Phase 3: データベース設計と実装

### Task 3.1: Drizzle ORM セットアップ ✅

- [x] `drizzle-orm`, `drizzle-kit`インストール
- [x] `drizzle.config.ts`作成
- [x] データベース接続設定（`core/db/connection.ts`）
- [x] マイグレーションディレクトリ作成
- **完了条件**: Drizzle が初期化され、DB 接続確認できる
- **依存**: Task 1.4
- **推定時間**: 1.5 時間
- **ドキュメント**: [.tmp/tasks/task-3.1-drizzle-setup.md](.tmp/tasks/task-3.1-drizzle-setup.md)
- **完了日**: 2025-10-12

### Task 3.2: コアテーブルスキーマ定義 ✅

- [x] 7 つのスキーマファイル作成（25 テーブル）
  - admin.ts: tenants, users, api_keys, system_settings, notifications
  - core.ts: organizations, developers, accounts, developer_identifiers, developer_merge_logs
  - campaigns.ts: campaigns, budgets, resources
  - activities.ts: activities, activity_campaigns
  - plugins.ts: plugins, plugin_runs, plugin_events_raw, import_jobs, shortlinks
  - analytics.ts: developer_stats, campaign_stats, funnel_stages, activity_funnel_map
  - migrations.ts: schema_migrations
- [x] マイグレーション SQL 生成と適用
- [x] PostgreSQL 拡張機能（uuid-ossp, citext）追加
- [x] 全 25 テーブルのデータベース作成確認
- **完了条件**: スキーマファイルが TypeScript エラーなくビルドできる ✓
- **依存**: Task 3.1
- **推定時間**: 3 時間
- **ドキュメント**: [.tmp/tasks/task-3.2-core-schema.md](.tmp/tasks/task-3.2-core-schema.md)
- **完了日**: 2025-10-12
- **注意**: Task 3.3, 3.4 の内容も含めて全 25 テーブルを実装完了

### Task 3.3: ROI/Campaign/Budget テーブルスキーマ ✅

- [x] Task 3.2 で実装済み（campaigns.ts）
- **完了条件**: スキーマファイルがビルドできる ✓
- **依存**: Task 3.2
- **推定時間**: 2 時間
- **完了日**: 2025-10-12（Task 3.2 に統合）

### Task 3.4: プラグインシステムテーブルスキーマ ✅

- [x] Task 3.2 で実装済み（plugins.ts）
- **完了条件**: スキーマファイルがビルドできる ✓
- **依存**: Task 3.2
- **推定時間**: 1 時間
- **完了日**: 2025-10-12（Task 3.2 に統合）

### Task 3.5: マイグレーション実行と RLS 設定 ✅

- [x] `pnpm db:generate`でマイグレーションファイル生成
- [x] `pnpm db:migrate`でマイグレーション実行
- [x] PostgreSQL RLS 有効化スクリプト作成（`infra/postgres/rls.sql`）
- [x] 各テーブルに RLS ポリシー追加
- **完了条件**: マイグレーションが成功し、RLS が有効化される
- **依存**: Task 3.4
- **推定時間**: 2 時間
- **ドキュメント**: [.tmp/tasks/task-3.5-rls-setup.md](.tmp/tasks/task-3.5-rls-setup.md)
- **完了日**: 2025-10-12

### Task 3.6: シードデータ作成 ✅

- [x] `core/db/seed.ts`作成（bcrypt、UUID、idempotency 対応）
- [x] デフォルトテナント（`tenant_id = 'default'`）作成
- [x] テスト用 Developer・Organization 作成（5 developers, 3 organizations）
- [x] テスト用 Activity 作成（10 activities）
- [x] Funnel stages master data（4 stages）
- [x] Activity funnel mappings（11 mappings）
- [x] 包括的なテスト作成（`core/db/seed.test.ts` - 22 tests）
- **完了条件**: `pnpm db:seed`でシードデータが投入される
- **依存**: Task 3.5
- **推定時間**: 1.5 時間
- **ドキュメント**: [.tmp/tasks/task-3.6-seed-data.md](.tmp/tasks/task-3.6-seed-data.md)
- **完了日**: 2025-10-12
- **注意**: RLS ポリシーとの統合はテナントコンテキスト API 実装後に対応

### Task 3.7: テナントコンテキスト管理 API 実装 ✅

- [x] `core/db/connection.ts`にテナントコンテキスト設定 API 追加（setTenantContext, getTenantContext, clearTenantContext）
- [x] RLS ポリシーの修正（FORCE RLS + NULL-safe 条件）
- [x] シードスクリプトの RLS 対応（一時的な無効化）
- [x] シードスクリプトの冪等性修正（固定 UUID 使用）
- **完了条件**: `pnpm db:seed`でシードデータが投入できる（RLS ポリシーを満たしながら） ✓
- **依存**: Task 3.5, Task 3.6
- **推定時間**: 2 時間
- **ドキュメント**: [.tmp/tasks/task-3.7-tenant-context-api.md](.tmp/tasks/task-3.7-tenant-context-api.md)
- **完了日**: 2025-10-12

### Task 3.8: 認証システム実装 ✅

- [x] Remix Sessions セットアップ（Cookie-based）
- [x] `core/services/auth.service.ts`作成
- [x] `login(email, password)`実装（bcrypt でパスワード検証）
- [x] `logout()`実装（セッション破棄）
- [x] `getCurrentUser(request)`実装（セッションからユーザー取得）
- [x] `app/routes/login.tsx`作成（ログインフォーム、Header/Footer/ダークモード対応）
- [x] `app/routes/logout.ts`作成（ログアウト処理、POST-only）
- [x] 認証ミドルウェア実装（`requireAuth()`, `getCurrentUser()`）
- [x] セッションとテナント ID の紐付け
- [x] E2E テスト実装（6 tests、全 49 E2E テストパス）
- [x] RLS 設計の修正（tenants は RLS 有効、users は RLS 無効で認証基盤化）
- [x] Idempotent seeding 実装（TRUNCATE CASCADE）
- **完了条件**: ログイン/ログアウトが機能し、セッションが保持される ✓
- **依存**: Task 3.7
- **推定時間**: 4 時間
- **完了日**: 2025-10-13
- **ドキュメント**: [.tmp/tasks/task-3.8-authentication.md](.tmp/tasks/task-3.8-authentication.md)
- **注意**:
  - users テーブルは既に Task 3.2 で実装済み（admin.ts）
  - パスワードは bcrypt でハッシュ化（constant-time comparison）
  - セッション Cookie は`httpOnly`, `secure`, `sameSite`設定
  - テスト用ユーザー: test@example.com / password123（member）、admin@example.com / admin123456（admin）
  - 重要な修正: `/auth/login` → `/login`、RLS 設計の修正（users table は RLS 無効）

---

## Phase 4: DRM コア機能実装（MVP）

### Task 4.1: DRM サービス基盤実装 ✅

- [x] `core/services/drm.service.ts`作成
- [x] `createDeveloper()`実装
- [x] `getDeveloper()`実装
- [x] `listDevelopers()`実装（ページネーション付き）
- [x] `updateDeveloper()`実装（UPDATE 操作）
- [x] `deleteDeveloper()`実装（DELETE 操作）
- [x] Zod スキーマでバリデーション
- [x] ソート機能実装（listDevelopers）
- [x] 包括的なテスト作成（24 tests）
- **完了条件**: サービス関数が単体テストでパスする ✓
- **依存**: Task 3.6
- **推定時間**: 3 時間
- **ドキュメント**: [.tmp/tasks/task-4.1-drm-service.md](.tmp/tasks/task-4.1-drm-service.md)
- **完了日**: 2025-10-13

### Task 4.2: Developer API 実装 ✅

- [x] `app/routes/api/developers.ts`作成（Resource Route）
- [x] `GET /api/developers`（一覧取得、ページネーション、フィルタ、ソート）
- [x] `POST /api/developers`（新規作成）
- [x] `app/routes/api/developers.$id.ts`作成
- [x] `GET /api/developers/:id`（詳細取得）
- [x] `PUT /api/developers/:id`（更新）
- [x] `DELETE /api/developers/:id`（削除）
- [x] 認証チェック（Task 3.8 の requireAuth()使用）
- [x] エラーハンドリング（400, 401, 404, 405, 409, 500）
- **完了条件**: API が統合テストでパスする ✓
- **依存**: Task 3.8, Task 4.1
- **推定時間**: 3 時間
- **ドキュメント**: [.tmp/tasks/task-4.2-developer-api.md](.tmp/tasks/task-4.2-developer-api.md)
- **完了日**: 2025-10-13

### Task 4.3: ID 統合機能実装 ✅

- [x] `resolveDeveloper()`実装（identifiers テーブルから検索）
- [x] `mergeDevelopers()`実装（重複開発者の統合）
- [x] メールアドレス・SNS ID からのマッチングロジック
- **完了条件**: ID 統合ロジックが単体テストでパスする ✓
- **依存**: Task 4.1
- **推定時間**: 3 時間
- **完了日**: 2025-10-13
- **ドキュメント**: [.tmp/tasks/task-4.3-id-integration.md](.tmp/tasks/task-4.3-id-integration.md)
- **注意**:
  - identity.service.ts を 3 つに分割（identity-resolver.service.ts, identity-merge.service.ts, identity-identifiers.service.ts）
  - RLS 対応：withTenantContext()ヘルパー使用（本番環境の connection pooling 対応）
  - 全 160 テスト成功

### Task 4.4: Activity サービス実装 ✅

- [x] `core/services/activity.service.ts`作成（barrel file）
- [x] `createActivity()`実装（CRUD - Create）
- [x] `getActivity()`実装（CRUD - Read single）
- [x] `listActivities()`実装（CRUD - Read、developerId/accountId/resourceId/action/source/日付範囲でフィルタ、ページネーション、ソート）
- [x] `updateActivity()`実装（CRUD - Update、部分更新対応）
- [x] `deleteActivity()`実装（CRUD - Delete、GDPR 対応）
- [x] Zod スキーマでバリデーション（CreateActivitySchema, ListActivitiesSchema, UpdateActivitySchema）
- [x] ファイル分割（activity-create/get/list/update/delete.service.ts、各 150 行以下）
- [x] セキュリティ修正（race condition 対策、tenant scoping、empty update guard）
- [x] バリデーション修正（date coercion、date range validation）
- [x] UUID 関数統一（uuid-ossp extension 追加）
- [x] 包括的なテスト作成（25 tests、モック不使用、全て通過）
- [x] TypeScript エラー解消（as any/unknown 不使用）
- **完了条件**: サービス関数が単体テストでパスする ✓
- **依存**: Task 4.1
- **推定時間**: 2 時間
- **ドキュメント**: [.tmp/tasks/task-4.4-activity-service.md](.tmp/tasks/task-4.4-activity-service.md)
- **完了日**: 2025-10-13
- **注意**:
  - Deduplication 機能実装（dedupKey with unique constraint）
  - Confidence score validation (0.0-1.0)
  - Event sourcing principles（Activities are event logs）
  - Drizzle クエリビルダーの型安全性対応（チェーン形式）
  - Critical security fixes implemented (atomic operations, tenant scoping)
  - Date validation and coercion for ISO string support

### Task 4.5: Activity API 実装 ✅

- [x] `app/routes/api/activities.ts`作成（Resource Route）
- [x] `GET /api/activities?developer_id=xxx`（一覧取得）
- [x] `POST /api/activities`（新規登録）
- [x] `GET /api/activities/:id`（詳細取得）
- [x] `PUT /api/activities/:id`（更新）
- [x] `DELETE /api/activities/:id`（削除）
- [x] 認証チェック（Task 3.8 の requireAuth()使用）
- [x] エラーハンドリング（400, 401, 404, 409, 500）
- [x] ハンドラーファイル分割（list/create/get/update/delete.handler.ts、各 150 行以下）
- [x] セキュリティ修正（request body guard、date validation、COUNT 最適化）
- [x] 包括的なテスト作成（26 tests、モック不使用、全て通過）
- [x] TypeScript エラー解消（as any/unknown 不使用）
- **完了条件**: API が統合テストでパスする ✓
- **依存**: Task 3.8, Task 4.4
- **推定時間**: 2 時間
- **ドキュメント**: [.tmp/tasks/task-4.5-activity-api.md](.tmp/tasks/task-4.5-activity-api.md)
- **完了日**: 2025-10-13
- **注意**:
  - Event sourcing principles（Activities are event logs）
  - UPDATE/DELETE は極めて稀な操作（GDPR 対応等）
  - Deduplication via dedupKey（409 Conflict response）
  - ハンドラー分離でコード可読性向上
  - COUNT aggregate クエリでパフォーマンス最適化

---

## Phase 5: ROI 分析機能実装（MVP）

### Task 5.1: ROI サービス基盤実装 ✅

- [x] `core/services/campaign.service.ts`作成（barrel file）
- [x] `createCampaign()`実装（Campaign 作成）
- [x] `getCampaign()`実装（Campaign 詳細取得）
- [x] `listCampaigns()`実装（Campaign 一覧取得、ページネーション・フィルタ・ソート）
- [x] `updateCampaign()`実装（Campaign 更新）
- [x] `deleteCampaign()`実装（Campaign 削除）
- [x] Zod スキーマでバリデーション（CreateCampaignSchema, ListCampaignsSchema, UpdateCampaignSchema）
- [x] RLS 対応（withTenantContext 使用）
- [x] ファイル分割（campaign.schemas.ts, campaign-{create,get,list,update,delete}.service.ts、各 150 行以下）
- [x] 包括的なテスト作成（22 テスト、モック不使用、全て通過）
- [x] TypeScript エラー解消（`as any`/`as unknown`不使用）
- [x] Date 型 → PostgreSQL date string 変換（'YYYY-MM-DD'）
- [x] CASCADE 削除実装（budgets 削除、resources orphan 化）
- **完了条件**: サービス関数が単体テストでパスする ✓
- **依存**: Task 3.6
- **推定時間**: 2 時間
- **ドキュメント**: [.tmp/tasks/task-5.1-roi-service.md](.tmp/tasks/task-5.1-roi-service.md)
- **完了日**: 2025-10-14

### Task 5.2: ROI 計算ロジック実装 ✅

- [x] `calculateROI(campaignId)`実装
- [x] `getCampaignCost()`実装（budgets から SUM 集計）
- [x] `getCampaignValue()`実装（activities の value 列から SUM 集計）
- [x] ROI 計算式の実装（`(効果値 - 投資額) / 投資額 * 100`）
- [x] Zod スキーマでバリデーション（CampaignROISchema）
- [x] ファイル分割（roi.schemas.ts, roi-{cost,value,calculate}.service.ts、各 150 行以下）
- [x] 包括的なテスト作成（16 テスト、モック不使用、全て通過）
- [x] TypeScript エラー解消（`as any`/`as unknown`不使用）
- [x] activities.value カラム追加（migration 0002）
- [x] RLS 対応（withTenantContext 使用）
- **完了条件**: 計算ロジックが単体テストでパスする ✓
- **依存**: Task 5.1
- **推定時間**: 2 時間
- **ドキュメント**: [.tmp/tasks/task-5.2-roi-calculation.md](.tmp/tasks/task-5.2-roi-calculation.md)
- **完了日**: 2025-10-14

### Task 5.3: 短縮 URL 機能実装 ✅

- [x] `generateShortURL(campaignId, target)`実装
- [x] 短縮 ID 生成（nanoid など）
- [x] Clicks テーブルへの登録
- [x] リダイレクト API 実装（`app/routes/c/$shortId.ts`）
- **完了条件**: 短縮 URL が機能し、クリック数がカウントされる ✓
- **依存**: Task 5.1
- **推定時間**: 3 時間
- **ドキュメント**: [.tmp/tasks/task-5.3-shorturl.md](.tmp/tasks/task-5.3-shorturl.md)
- **完了日**: 2025-10-15

### Task 5.4: Campaign API 実装 ✅

- [x] `app/routes/api/campaigns.ts`作成（Resource Route）
- [x] `GET /api/campaigns`（一覧取得）
- [x] `POST /api/campaigns`（新規作成）
- [x] `app/routes/api/campaigns.$id.ts`作成（Resource Route）
- [x] `GET /api/campaigns/:id`（詳細取得）
- [x] `PUT /api/campaigns/:id`（更新）
- [x] `DELETE /api/campaigns/:id`（削除）
- [x] `app/routes/api/campaigns.$id.roi.ts`作成（Resource Route）
- [x] `GET /api/campaigns/:id/roi`（ROI 取得）
- **完了条件**: CRUD 完全対応の API が統合テストでパスする ✓
- **依存**: Task 5.2, Task 5.3
- **推定時間**: 4 時間
- **ドキュメント**: [.tmp/tasks/task-5.4-campaign-api.md](.tmp/tasks/task-5.4-campaign-api.md)
- **完了日**: 2025-10-16

---

## Phase 6: ファネル分析機能実装（MVP）

### Task 6.1: Funnel サービス基盤実装 ✅

- [x] `core/services/funnel.service.ts`作成
- [x] `classifyStage(activity)`実装（Awareness/Engagement/Adoption/Advocacy 判定）
- [x] `getFunnelStats()`実装（各ステージの人数集計）
- **完了条件**: サービス関数が単体テストでパスする ✓
- **依存**: Task 4.3
- **推定時間**: 3 時間
- **ドキュメント**: [.tmp/tasks/task-6.1-funnel-service.md](.tmp/tasks/task-6.1-funnel-service.md)
- **完了日**: 2025-10-16

### Task 6.2: ドロップ率計算実装 ✅

- [x] `calculateDropRate(stage)`実装
- [x] 前ステージからの離脱率計算
- [x] 時系列データの集計
- **完了条件**: 計算ロジックが単体テストでパスする ✓
- **依存**: Task 6.1
- **推定時間**: 2 時間
- **ドキュメント**: [.tmp/tasks/task-6.2-drop-rate-calculation.md](.tmp/tasks/task-6.2-drop-rate-calculation.md)
- **完了日**: 2025-10-16

### Task 6.3: Funnel API 実装 ✅

- [x] `app/routes/api/funnel.ts`作成（Resource Route）
- [x] `GET /api/funnel`（全体ファネル取得）
- [x] `GET /api/funnel/timeline`（時系列データ取得）
- **完了条件**: API が統合テストでパスする ✓
- **依存**: Task 6.2
- **推定時間**: 2 時間
- **ドキュメント**: [.tmp/tasks/task-6.3-funnel-api.md](.tmp/tasks/task-6.3-funnel-api.md)
- **完了日**: 2025-10-16

---

## Phase 7: ダッシュボード UI 実装（MVP）

### Task 7.1: ダッシュボードレイアウト実装 ✅

- [x] `app/routes/dashboard.tsx`作成
- [x] サイドバーナビゲーション（Overview, Developers, Campaigns, Funnel）。一番下に System Settings へのアイコン
- [x] ヘッダー（ロゴ、ユーザー情報）
- [x] サイドバーの項目、ウィジェットはプラグイン次第で増減することを想定
- [x] ダークモード対応（DarkModeProvider 実装）
- [x] モバイル対応（レスポンシブデザイン）
- [x] E2E テスト作成（12 テスト）
- **完了条件**: ダッシュボードが表示され、ナビゲーションが機能する ✓
- **依存**: Task 2.1
- **推定時間**: 3 時間
- **ドキュメント**: [.tmp/tasks/task-7.1-dashboard-layout.md](.tmp/tasks/task-7.1-dashboard-layout.md)
- **完了日**: 2025-10-17

### Task 7.2: Overview ページ実装 ✅

- [x] `app/routes/dashboard._index.tsx`作成
- [x] Swapy でウィジェットをドラッグ＆ドロップ可能に（[Swapy](https://swapy.tahazsh.com/)）
- [x] 総アクティビティ数・開発者数・施策件数の表示
- [x] ROI 平均値の表示
- [x] 簡易グラフ（Recharts）
- [x] E2E テスト作成
- **完了条件**: Overview ページが表示され、データが取得される ✓
- **依存**: Task 7.1, Task 4.5, Task 5.4
- **推定時間**: 4 時間
- **ドキュメント**: [.tmp/tasks/task-7.2-overview-page.md](.tmp/tasks/task-7.2-overview-page.md)
- **完了日**: 2025-10-17

### Task 7.3: Developers ページ実装 ✅

- [x] `app/routes/dashboard/developers.tsx`作成
- [x] 開発者リスト表示（ページネーション付き）
  - 一覧機能はプラグインでも使うので、共通コンポーネント化する
- [x] 検索・フィルタ機能
- [x] 開発者詳細ページ（`/dashboard/developers/:id`）
- **完了条件**: 開発者リストが表示され、詳細ページへ遷移できる ✓
- **依存**: Task 7.1, Task 4.2, Task 4.3
- **推定時間**: 4 時間
- **ドキュメント**: [.tmp/tasks/task-7.3-developers-page.md](.tmp/tasks/task-7.3-developers-page.md)
- **完了日**: 2025-10-18

### Task 7.3.1: RLS 実装の修正とテスト環境の改善（技術的負債解消）

- [ ] **NODE_ENV=test 環境でのテスト実行対応**
  - 現在の問題: `connection.ts`で`NODE_ENV=test`時に`max: 1`制限があり、E2E 環境でデッドロック発生
- [ ] **withTenantContext()への統一**
  - 現在の問題: Production code と Test コードが`setTenantContext()`（セッションスコープ、`SET`）を使用
  - Connection pooling で接続が再利用されると、tenant context が漏洩する危険性
  - 正しい実装: `withTenantContext()`（トランザクションスコープ、`SET LOCAL`）を使用
  - 影響範囲:
    - Production API routes: `app/routes/api/campaigns.ts`, `app/routes/api/campaigns.$id.ts`, `app/routes/api/funnel.ts`
    - Test code: `app/middleware/tenant-context.test.ts`, `app/routes/api/campaigns.$id.test.ts`、その他すべての RLS テスト
  - 実装手順: 2. すべての Production code を`withTenantContext()`に書き換え 3. すべての Test code を`withTenantContext()`に書き換え 4. RLS integration tests が全てパスすることを確認
- **ドキュメント**: [.tmp/tasks/task-7.3.1-rls-tenancy-refactor.md](.tmp/tasks/task-7.3.1-rls-tenancy-refactor.md)
- **完了条件**:
  - 統合テスト（Vitest）が全てパスする
  - E2E テスト（Playwright）が全てパスする（NODE_ENV=test 環境）
  - すべてのコードが`withTenantContext()`を使用している
- **依存**: なし（独立した技術的負債解消タスク）
- **推定時間**: 8 時間
- **優先度**: 高（現在の RLS 実装は本質的に危険）
- **注意**:
  - このタスクは大規模なリファクタリングを含む
  - すべての API routes と service functions に影響
  - 慎重なテストとレビューが必要

### Task 7.3.2: システム設定画面の実装 ✅

- [x] データベーススキーマ更新（`service_name`, `logo_url`, `fiscal_year_start_month`, `timezone`, `s3_settings`, `smtp_settings`追加）
- [x] `core/config/env.ts`実装（ENCRYPTION_KEY 起動時バリデーション）
- [x] `core/utils/encryption.ts`実装（AES-256-GCM 暗号化/復号化、キーローテーション対応）
- [x] `core/utils/s3-client.ts`実装（S3 アップロード/削除）
- [x] `core/utils/smtp-client.ts`実装（SMTP 接続テスト）
- [x] `core/services/system-settings.service.ts`実装（CRUD、暗号化、S3/SMTP 設定チェック、ロゴアップロード）
- [x] `app/routes/api.system-settings.ts`実装（GET/PUT、admin 権限チェック）
- [x] `app/routes/api.system-settings.upload-logo.ts`実装（POST、ロゴアップロード）
- [x] `app/routes/dashboard.settings.tsx`作成（Basic/S3/SMTP 設定画面、ロゴアップロード UI）
- [x] 接続テスト機能実装（S3/SMTP 接続確認 API）
- [x] E2E テスト作成（14 テスト：Basic 6 + S3 3 + SMTP 2 + Validation 3）
- **完了条件**: システム設定画面が表示され、S3/SMTP 設定が保存・テスト・ロゴアップロードできる ✓
- **依存**: Task 7.1
- **推定時間**: 8 時間
- **完了日**: 2025-10-20
- **ドキュメント**: [.tmp/tasks/task-7.3.2-system-settings.md](.tmp/tasks/task-7.3.2-system-settings.md)
- **注意**:
  - AI 機能は OSS 版に含まれないため除外
  - 会計年度は期初月のみ（1-12、デフォルト: 4）
  - S3 未設定時はロゴアップロード無効化（URL 入力のみ）
  - 機密情報（API keys, passwords）は暗号化して DB 保存
  - GET API では機密情報を返さない（boolean flag のみ）
  - 設定変更は admin ロールのみ許可
  - ENCRYPTION_KEY 起動時バリデーション（Fail-Fast）
  - ロゴアップロード: multipart/form-data、2MB 以下、PNG/JPEG/WebP のみ（SVG 除外）

### Task 7.3.3: アクティビティカラーとアイコンの設定画面実装（システム設定画面の一部） ✅

**実装完了（2025-10-21）:**

**バックエンド実装（完了）:**

- [x] `core/db/schema/admin.ts`に`activity_types`テーブル追加 ✅
  - カラム: `activity_type_id`, `tenant_id`, `action`, `icon_name`, `color_class`, `stage_key`, `created_at`, `updated_at`
  - Migration 0007 生成・適用完了
- [x] `core/services/activity-type.service.ts`作成（CRUD + デフォルトシードデータ） ✅
  - 24 個のテストパス
- [x] `app/routes/api.activity-types.ts`作成（アクティビティタイプ CRUD API） ✅
  - GET (list), POST (create) - 13 テスト
- [x] `app/routes/api.activity-types.$action.ts`作成（個別リソース API） ✅
  - GET, PUT, DELETE - 13 テスト
- [x] `app/routes/api.activity-types.actions.ts`作成（既存アクション一覧 API） ✅
  - GET - 3 テスト
- [x] 依存関係インストール ✅
  - `react-color@2.19.3`
  - `@types/react-color@3.0.13`

**フロントエンド実装（完了）:**

- [x] `app/routes/dashboard.settings.activity-types.tsx`作成（メイン画面）
- [x] UI コンポーネント実装：
  - [x] ActivityTypeTable（一覧テーブル）
  - [x] ActivityTypeForm（作成・編集フォーム）
  - [x] ActionCombobox（既存アクション選択 + 新規入力）
  - [x] IconPicker（@iconify/react 使用、アイコン検索・選択）
  - [x] ColorPalette（react-color 使用、プリセットカラー選択）
- [x] E2E テスト作成（13 テスト）

  - 表示・アクセス制御: 2 tests
  - CRUD 操作: 6 tests
  - バリデーション: 2 tests
  - コンポーネント動作: 3 tests

- **完了条件**: 設定画面でアクティビティタイプごとにアイコンとカラーを設定でき、E2E テストが全てパスする ✓
- **依存**: Task 7.3
- **推定時間**: 6.5 時間
- **完了日**: 2025-10-21
- **ドキュメント**:
  - [.tmp/tasks/task-7.3.3-activity-type-settings.md](.tmp/tasks/task-7.3.3-activity-type-settings.md)（全体仕様）
  - [.tmp/tasks/task-7.3.3-ui.md](.tmp/tasks/task-7.3.3-ui.md)（UI 実装仕様）
- **注意**:
  - 実装は 2 段階に分割：
    1. このタスク（7.3.3）: 設定画面とテーブル作成（完了）
    2. 次のタスク（7.3.4）: `getActivityColor()`と`getActivityIconName()`の実装（データベースから取得）
  - ActivityTimeline.tsx 内の TODO コメントを参照

### Task 7.3.4: ActivityTimeline 動的カラー・アイコン適用 ✅

- [x] `getActivityColor()`実装（データベースから設定を取得）
- [x] `getActivityIconName()`実装（データベースから設定を取得）
- [x] `ActivityTimeline.tsx`にデータローディング処理追加
- [x] キャッシング実装（同一テナント内で設定を再利用）
- [x] E2E テスト作成（カラー・アイコンの動的表示確認）
- **完了条件**: ActivityTimeline がデータベースの設定に基づいてカラーとアイコンを動的に表示する ✓
- **依存**: Task 7.3.3
- **推定時間**: 3 時間
- **完了日**: 2025-10-21
- **ドキュメント**: [.tmp/tasks/task-7.3.4-activity-timeline-dynamic.md](.tmp/tasks/task-7.3.4-activity-timeline-dynamic.md)

### Task 7.4: Campaigns ページ実装 ✅

- [x] `app/routes/dashboard.campaigns._index.tsx`作成
- [x] 施策リスト表示
- [x] ROI 表示（色分け: 正/負）
- **完了条件**: 施策リストが表示され、ROI が確認できる ✓
- **依存**: Task 7.1, Task 5.4
- **推定時間**: 3 時間
- **完了日**: 2025-10-22

### Task 7.4.1: 新規 API 実装 ✅

- [x] `GET /api/campaigns/:id/budgets`実装
- [x] `GET /api/campaigns/:id/resources`実装
- [x] `GET /api/campaigns/:id/activities`実装
- **完了条件**: 3 つの API が実装され、テストがパスする ✓
- **依存**: Task 5.4
- **推定時間**: 3 時間
- **完了日**: 2025-10-22
- **ドキュメント**: [.tmp/tasks/task-7.4.1-campaign-detail-apis.md](.tmp/tasks/task-7.4.1-campaign-detail-apis.md)

### Task 7.4.2: 施策詳細ページ実装 ✅

- [x] `app/routes/dashboard/campaigns.$id.tsx`作成
- [x] 施策詳細情報表示
- [x] Budgets リスト表示
- [x] Resources リスト表示
- [x] Activities リスト表示
- **完了条件**: 施策詳細ページが表示され、関連データが確認できる ✓
- **依存**: Task 7.4, Task 7.4.1
- **推定時間**: 3 時間
- **完了日**: 2025-10-23
- **ドキュメント**: [.tmp/tasks/task-7.4.2-campaign-detail-page.md](.tmp/tasks/task-7.4.2-campaign-detail-page.md)

### Task 7.4.3: キャンペーンの追加 ✅

- [x] キャンペーン追加フォーム実装
- [x] バリデーション実装
- [x] 入力エラー処理
- **完了条件**: キャンペーンの追加フォームが機能し、新規キャンペーンを作成できる ✓
- **依存**: Task 7.4
- **推定時間**: 2 時間
- **完了日**: 2025-10-24
- **ドキュメント**: [.tmp/tasks/task-7.4.3-campaign-add-form.md](.tmp/tasks/task-7.4.3-campaign-add-form.md)

### Task 7.4.4: キャンペーンの編集 ✅

- [x] キャンペーン編集フォーム実装
- [x] 既存データの読み込み
- [x] 更新処理実装
- **完了条件**: キャンペーンの編集フォームが機能し、既存キャンペーンを更新できる ✓
- **依存**: Task 7.4
- **推定時間**: 2 時間
- **完了日**: 2025-10-24
- **ドキュメント**: [.tmp/tasks/task-7.4.4-campaign-edit-form.md](.tmp/tasks/task-7.4.4-campaign-edit-form.md)

### Task 7.4.5: キャンペーンの削除 ✅

- [x] 削除確認ダイアログ実装
- [x] 削除処理実装
- [x] CASCADE 削除（関連データの処理）
- **完了条件**: キャンペーンを削除でき、確認ダイアログが表示される ✓
- **依存**: Task 7.4
- **推定時間**: 1 時間
- **完了日**: 2025-10-25
- **ドキュメント**: [.tmp/tasks/task-7.4.5-campaign-delete.md](.tmp/tasks/task-7.4.5-campaign-delete.md)

### Task 7.5: Funnel ページ実装

- [ ] `app/routes/dashboard/funnel.tsx`作成
- [ ] ファネルチャート表示（Recharts）
- [ ] ドロップ率表示
- [ ] 時系列グラフ（日次/週次/月次）
- **完了条件**: ファネルページが表示され、グラフが描画される
- **依存**: Task 7.1, Task 6.3
- **推定時間**: 4 時間

---

## Phase 8: プラグインシステム実装（基盤）

### Task 8.1: Plugin Loader 実装

- [ ] `core/plugin-system/loader.ts`作成
- [ ] `discoverPlugins()`実装（node_modules/スキャン）
- [ ] `loadPlugin(packageName)`実装
- [ ] プラグインメタデータ取得（package.json から）
- **完了条件**: プラグインが検出される
- **依存**: Task 3.6
- **推定時間**: 3 時間
- **ドキュメント**: [.tmp/tasks/task-8.1-plugin-loader.md](.tmp/tasks/task-8.1-plugin-loader.md)

### Task 8.2: Hook Registry 実装

- [ ] `core/plugin-system/hooks.ts`作成
- [ ] `registerHook(name, handler)`実装
- [ ] `executeHook(name, args)`実装
- [ ] プラグインフックの実行ログ記録（plugin_logs テーブル）
- **完了条件**: フックが登録・実行される
- **依存**: Task 8.1
- **推定時間**: 2 時間

### Task 8.3: Job Scheduler 実装（BullMQ）

- [ ] BullMQ インストール
- [ ] `core/plugin-system/scheduler.ts`作成
- [ ] `registerJob(name, cron, handler)`実装
- [ ] Redis キュー接続
- [ ] Worker プロセス実装
- **完了条件**: cron ジョブが登録・実行される
- **依存**: Task 8.2
- **推定時間**: 4 時間

### Task 8.4: Plugin 管理 API 実装

- [ ] `app/routes/api/plugins.ts`作成
- [ ] `GET /api/plugins`（インストール済みプラグイン一覧）
- [ ] `POST /api/plugins/:id/enable`（プラグイン有効化）
- [ ] `POST /api/plugins/:id/disable`（プラグイン無効化）
- [ ] `GET /api/plugins/:id/logs`（実行ログ取得）
- **完了条件**: API が機能し、プラグインが有効化/無効化できる
- **依存**: Task 8.3
- **推定時間**: 3 時間

---

## Phase 9: Google Analytics プラグイン実装（サンプル）

### Task 9.1: Google Analytics Plugin 初期化

- [ ] `plugins/google_analytics/package.json`作成
- [ ] `plugins/google_analytics/src/index.ts`作成
- [ ] `definePlugin()`でプラグイン定義
- [ ] Google Analytics SDK インストール
- **完了条件**: プラグインがビルドできる
- **依存**: Task 8.1
- **推定時間**: 2 時間

### Task 9.2: Google Analytics 同期ジョブ実装

[ ] `syncGoogleAnalyticsData(ctx)`実装

- [ ] GoogleAnalytics Capture API からイベント取得
- [ ] `distinct_id = click_id`で匿名データ識別
- [ ] DRM の Activity テーブルと統合
- **完了条件**: 同期ジョブが実行され、データが取得される
- **依存**: Task 9.1, Task 8.3
- **推定時間**: 4 時間

### Task 9.3: GoogleAnalytics 設定 UI 実装

- [ ] プラグイン設定画面（`/dashboard/plugins/google_analytics`）
- [ ] API キー・プロジェクト ID 入力フォーム
- [ ] 設定保存 API（`POST /api/plugins/google_analytics/config`）
- **完了条件**: 設定画面から API キーを保存できる
- **依存**: Task 9.1
- **推定時間**: 3 時間

---

## 追加プラグイン開発

- GitHub プラグイン
- KPI プラグイン
- Slack 通知プラグイン

---

## Phase 10: テストとデプロイ準備

### Task 10.1: 単体テスト実装

- [ ] Vitest セットアップ
- [ ] DRM サービスのテスト
- [ ] ROI サービスのテスト
- [ ] Funnel サービスのテスト
- [ ] カバレッジ 80%以上
- **完了条件**: `pnpm test`が成功する
- **依存**: Task 4.1, Task 5.1, Task 6.1
- **推定時間**: 6 時間

### Task 10.2: 統合テスト実装

- [ ] API エンドポイントのテスト
- [ ] データベース接続テスト
- [ ] Redis キューテスト
- **完了条件**: 統合テストが成功する
- **依存**: Task 4.4, Task 5.4, Task 6.3
- **推定時間**: 4 時間

### Task 10.3: E2E テスト実装（Playwright）

- [ ] Playwright セットアップ
- [ ] ダッシュボード表示テスト
- [ ] Developer 作成フローテスト
- [ ] Campaign 作成フローテスト
- **完了条件**: E2E テストが成功する
- **依存**: Task 7.5
- **推定時間**: 5 時間

### Task 10.4: ドキュメント作成

- [ ] README.md 更新（インストール手順、起動方法）
- [ ] API 仕様書作成（OpenAPI/Swagger ドキュメント）
- [ ] プラグイン開発ガイド作成
- [ ] デプロイガイド作成
- **完了条件**: ドキュメントが完成し、第三者が理解できる
- **依存**: Task 10.3
- **推定時間**: 4 時間

### Task 10.5: 本番環境用設定

- [ ] `docker-compose.prod.yml`作成
- [ ] 環境変数の本番用設定
- [ ] PostgreSQL 外部接続設定
- [ ] Redis 外部接続設定
- [ ] ログ設定（JSON 形式）
- **完了条件**: 本番環境でデプロイ可能
- **依存**: Task 10.4
- **推定時間**: 3 時間

---

## 実装順序

### Sprint 1（Week 1）: 環境構築とインフラ基盤

- Task 1.1 → Task 1.2 → Task 1.3 → Task 1.4 → Task 1.5
- Task 2.1 → Task 2.2 → Task 2.3 → Task 2.4 → Task 2.5
- **デプロイ確認**: docker-compose up -d で LP・規約・プライバシーポリシーが表示される

### Sprint 2（Week 2）: データベース設計、認証、DRM コア

- Task 3.1 → Task 3.2 → Task 3.3 → Task 3.4 → Task 3.5 → Task 3.6 → Task 3.7 → Task 3.8
- Task 4.1 → Task 4.2 → Task 4.3 → Task 4.4 → Task 4.5
- **デプロイ確認**: 認証が機能し、Developer API・Activity API が認証付きで動作する

### Sprint 3（Week 3）: ROI・ファネル分析

- Task 5.1 → Task 5.2 → Task 5.3 → Task 5.4
- Task 6.1 → Task 6.2 → Task 6.3
- **デプロイ確認**: Campaign API・Funnel API が機能する

### Sprint 4（Week 4）: ダッシュボード UI

- Task 7.1 → Task 7.2 → Task 7.3 → Task 7.4 → Task 7.5
- **デプロイ確認**: ダッシュボードが表示され、全機能が操作可能

### Sprint 5（Week 5）: プラグインシステムと GoogleAnalytics 統合

- Task 8.1 → Task 8.2 → Task 8.3 → Task 8.4
- Task 9.1 → Task 9.2 → Task 9.3
- **デプロイ確認**: プラグインが有効化され、GoogleAnalytics 同期が動作する

### Sprint 6（Week 6）: テストとデプロイ準備

- Task 10.1 → Task 10.2 → Task 10.3 → Task 10.4 → Task 10.5
- **デプロイ確認**: 本番環境で MVP が動作する

---

## 並行実行可能なタスク

以下のタスクは依存関係がないため並行実行可能：

- **Sprint 1**: Task 1.4（PostgreSQL）と Task 1.5（Redis）
- **Sprint 1**: Task 2.3（規約）と Task 2.4（プライバシーポリシー）
- **Sprint 2**: Task 3.2（DRM テーブル）と Task 3.3（ROI テーブル）と Task 3.4（プラグインテーブル）
- **Sprint 3**: Task 5.1-5.4（ROI 機能）と Task 6.1-6.3（Funnel 機能）
- **Sprint 5**: Task 9.2（GoogleAnalytics 同期）と Task 9.3（GoogleAnalytics 設定 UI）

---

## リスクと対策

| リスク                               | 対策                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------- |
| **Docker 環境の複雑化**              | docker-compose-dev.yml を分離し、開発環境と本番環境を明確に区別        |
| **データベースマイグレーション失敗** | マイグレーションの前に必ずバックアップ、ロールバックスクリプトを用意   |
| **プラグインシステムの複雑化**       | 最初は GoogleAnalytics プラグイン 1 つのみ実装し、動作確認してから拡張 |
| **UI/UX の複雑化**                   | MVP ではシンプルなデザインに徹し、機能優先で実装                       |
| **テストの不足**                     | 各 Sprint の最後に必ず統合テスト・E2E テストを実行                     |

---

## 注意事項

### デプロイ可能性の維持

- 各タスク完了後、必ず`docker-compose up -d`で起動確認
- すべての Sprint の最後にデプロイ確認を実施
- 動作しない状態でコミットしない

### コミット単位

- 各タスクは 1-4 時間で完結する単位
- タスク完了時に必ずコミット
- コミットメッセージは`feat(module): Task X.Y - 説明`形式

### 品質チェック

- タスク完了時に`pnpm lint`、`pnpm typecheck`を実行
- テストが必要なタスクは必ず単体テスト・統合テストを実装
- UI タスクは E2E テストで動作確認

### シンプルさの維持

- 複雑な実装は避け、最小限のコードで機能を実現
- 抽象化は 2 回目以降に実施（YAGNI 原則）
- ドキュメントは簡潔に、コードで自明な部分は省略

---

## 実装開始ガイド

### 1. 最初のタスクから順次実装

- Task 1.1 から開始し、依存関係を確認しながら進める
- 各タスクの完了条件を必ず確認

### 2. TodoWrite でタスク管理

- 各タスクの開始時に TodoWrite で`in_progress`に更新
- 完了時は`completed`に更新
- 問題発生時は速やかに報告

### 3. デプロイ確認を徹底

- 各 Sprint の最後に必ずデプロイ確認
- `docker-compose up -d`でコンテナが起動することを確認
- ブラウザで動作確認

### 4. 問題発生時の対応

- エラーメッセージを詳細に記録
- ログを確認（`docker-compose logs`）
- 必要に応じてタスクを分割・追加

---

**MVP 完成目標**: 6 週間後
**最初のデプロイ可能日**: Sprint 1 終了時（Week 1）
