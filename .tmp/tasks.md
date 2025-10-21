# タスクリスト - DRM（DevRel Management）MVP 開発

**Version:** 1.0
**Based on:** requirements.md v2.2, design.md v2.5
**Strategy:** アジャイル開発 - 常にデプロイ可能な状態を維持

---

## 概要

サービス名は `DevCle`（DevRel + Circleの造語）。本番環境のドメインは `devcle.com`。開発環境は `devcle.test`。

- **総タスク数**: 48タスク
- **推定作業時間**: 4-6週間（1名）
- **優先度**: 高
- **開発方針**:
  - docker-compose構築を最優先
  - 各タスク完了後にデプロイ・動作確認可能な状態を維持
  - MVPから段階的に機能追加
  - LP・規約・プライバシーポリシーも初期から組み込み

---

## Phase 1: 環境構築とインフラ基盤（デプロイ可能な最小構成）

### Task 1.1: プロジェクト初期構造とcoreパッケージセットアップ ✅

- [x] `core/`のpackage.json作成（Remix, TypeScript）
- [x] TypeScript strict設定（`exactOptionalPropertyTypes`含む）
- [x] ESLint 9 flat config設定
- [x] Prettier設定
- [x] `.gitignore`作成
- **完了条件**: `pnpm install`がcoreパッケージで成功
- **依存**: なし
- **推定時間**: 2時間
- **ドキュメント**: [.tmp/tasks/task-1.1-monorepo-setup.md](.tmp/tasks/task-1.1-monorepo-setup.md)
- **注意**: プラグイン（posthog等）は不要。coreのみ構築。
- **完了日**: 2025-10-10

### Task 1.2: Docker Compose構成ファイル作成 ✅

- [x] `docker-compose.yml`作成（nginx, core, postgres, redis）
- [x] `docker-compose-dev.yml`作成（開発環境用オーバーライド）
- [x] `core/Dockerfile`作成（Node.js 20, pnpm）
- [x] `.dockerignore`作成
- [x] `.env.example`作成（環境変数テンプレート）
- **完了条件**: `docker-compose up -d`でコンテナが起動
- **依存**: Task 1.1
- **推定時間**: 3時間
- **完了日**: 2025-10-11

### Task 1.3: nginx設定とリバースプロキシ ✅

- [x] `nginx/nginx.conf`作成
- [x] HTTPSリダイレクト設定（開発環境・本番環境共通）
- [x] 静的ファイル配信設定（`/public`）
- [x] Remixアプリへのプロキシ設定
- [x] ヘルスチェックエンドポイント（`/health`）
- **完了条件**: nginxが起動し、Remixアプリにプロキシされる
- **依存**: Task 1.2
- **推定時間**: 2時間
- **ドキュメント**: [.tmp/tasks/task-1.3-nginx-setup.md](.tmp/tasks/task-1.3-nginx-setup.md)
- **完了日**: 2025-10-11

### Task 1.4: PostgreSQL初期設定 ✅

- [x] 初期化スクリプト（`infra/postgres/init.sql`）
- [x] pgcrypto拡張の有効化
- [x] テナント用RLSポリシーのテンプレート作成（`infra/postgres/rls-template.sql`）
- [x] データベースバックアップ設定（docker volume）
- **完了条件**: PostgreSQLコンテナが起動し、接続可能
- **依存**: Task 1.2
- **推定時間**: 1.5時間
- **ドキュメント**: [.tmp/tasks/task-1.4-postgres-init.md](.tmp/tasks/task-1.4-postgres-init.md)
- **完了日**: 2025-10-11

### Task 1.5: Redis初期設定 ✅

- [x] `redis/redis.conf`作成
- [x] パスワード認証設定
- [x] メモリ上限・evictionポリシー設定
- [x] 永続化設定（AOF）
- **完了条件**: Redisコンテナが起動し、接続可能
- **依存**: Task 1.2
- **推定時間**: 1時間
- **ドキュメント**: [.tmp/tasks/task-1.5-redis-init.md](.tmp/tasks/task-1.5-redis-init.md)
- **完了日**: 2025-10-11

---

## Phase 2: Remixアプリケーション基盤（最小限のUI）

### Task 2.1: Remix初期セットアップ ✅

- [x] Remix v2プロジェクト初期化（`core/`）
- [x] TailwindCSS設定
- [x] ルートレイアウト作成（`app/root.tsx`）
- [x] エラーバウンダリ設定
- [x] 環境変数読み込み（`DATABASE_URL`, `REDIS_URL`）
- **完了条件**: Remixアプリが起動し、ルートページが表示される
- **依存**: Task 1.2
- **推定時間**: 2時間
- **完了日**: 2025-10-11

### Task 2.2: LP（トップページ）作成 ✅

- [x] `app/routes/_index.tsx`作成
- [x] ヒーローセクション（キャッチコピー、CTA）
- [x] 機能紹介セクション（DRM, ROI, Funnel）
- [x] デモリンク・ドキュメントリンク
- [x] フッター（規約・プライバシーポリシーリンク）
- **完了条件**: トップページが表示され、デザインが整っている
- **依存**: Task 2.1
- **推定時間**: 3時間
- **完了日**: 2025-10-12

### Task 2.3: 利用規約ページ作成 ✅

- [x] `app/routes/terms.tsx`作成
- [x] 利用規約の文章作成（OSS版・SaaS版共通）
- [x] TailwindCSSでマークダウンスタイル適用
- **完了条件**: `/terms`でページが表示される
- **依存**: Task 2.1
- **推定時間**: 2時間
- **ドキュメント**: [.tmp/tasks/task-2.3-terms-page.md](.tmp/tasks/task-2.3-terms-page.md)
- **完了日**: 2025-10-12

### Task 2.4: プライバシーポリシーページ作成 ✅

- [x] `app/routes/privacy.mdx`作成
- [x] プライバシーポリシーの文章作成（GDPR/CCPA対応）
- [x] データ収集・利用・保管方針の記載
- **完了条件**: `/privacy`でページが表示される
- **依存**: Task 2.1
- **推定時間**: 2時間
- **ドキュメント**: [.tmp/tasks/task-2.4-privacy-page.md](.tmp/tasks/task-2.4-privacy-page.md)
- **完了日**: 2025-10-12

### Task 2.5: プライシングページ作成 ✅

- [x] `app/routes/pricing.mdx`作成
- [x] 料金表作成
  - OSS版（無料）
    - セルフホスト
    - 基本プラグイン
  - SaaS版（有料）
    - Basic, Team, Enterpriseプラン
- [x] ダークモード対応（Tailwind v4 @custom-variant設定）
- [x] E2Eテスト作成（18テスト）
- **完了条件**: `/pricing`でページが表示される
- **依存**: Task 2.1
- **推定時間**: 2時間
- **完了日**: 2025-10-12

---

## Phase 3: データベース設計と実装

### Task 3.1: Drizzle ORMセットアップ ✅

- [x] `drizzle-orm`, `drizzle-kit`インストール
- [x] `drizzle.config.ts`作成
- [x] データベース接続設定（`core/db/connection.ts`）
- [x] マイグレーションディレクトリ作成
- **完了条件**: Drizzleが初期化され、DB接続確認できる
- **依存**: Task 1.4
- **推定時間**: 1.5時間
- **ドキュメント**: [.tmp/tasks/task-3.1-drizzle-setup.md](.tmp/tasks/task-3.1-drizzle-setup.md)
- **完了日**: 2025-10-12

### Task 3.2: コアテーブルスキーマ定義 ✅

- [x] 7つのスキーマファイル作成（25テーブル）
  - admin.ts: tenants, users, api_keys, system_settings, notifications
  - core.ts: organizations, developers, accounts, developer_identifiers, developer_merge_logs
  - campaigns.ts: campaigns, budgets, resources
  - activities.ts: activities, activity_campaigns
  - plugins.ts: plugins, plugin_runs, plugin_events_raw, import_jobs, shortlinks
  - analytics.ts: developer_stats, campaign_stats, funnel_stages, activity_funnel_map
  - migrations.ts: schema_migrations
- [x] マイグレーションSQL生成と適用
- [x] PostgreSQL拡張機能（uuid-ossp, citext）追加
- [x] 全25テーブルのデータベース作成確認
- **完了条件**: スキーマファイルがTypeScriptエラーなくビルドできる ✓
- **依存**: Task 3.1
- **推定時間**: 3時間
- **ドキュメント**: [.tmp/tasks/task-3.2-core-schema.md](.tmp/tasks/task-3.2-core-schema.md)
- **完了日**: 2025-10-12
- **注意**: Task 3.3, 3.4の内容も含めて全25テーブルを実装完了

### Task 3.3: ROI/Campaign/Budgetテーブルスキーマ ✅

- [x] Task 3.2で実装済み（campaigns.ts）
- **完了条件**: スキーマファイルがビルドできる ✓
- **依存**: Task 3.2
- **推定時間**: 2時間
- **完了日**: 2025-10-12（Task 3.2に統合）

### Task 3.4: プラグインシステムテーブルスキーマ ✅

- [x] Task 3.2で実装済み（plugins.ts）
- **完了条件**: スキーマファイルがビルドできる ✓
- **依存**: Task 3.2
- **推定時間**: 1時間
- **完了日**: 2025-10-12（Task 3.2に統合）

### Task 3.5: マイグレーション実行とRLS設定 ✅

- [x] `pnpm db:generate`でマイグレーションファイル生成
- [x] `pnpm db:migrate`でマイグレーション実行
- [x] PostgreSQL RLS有効化スクリプト作成（`infra/postgres/rls.sql`）
- [x] 各テーブルにRLSポリシー追加
- **完了条件**: マイグレーションが成功し、RLSが有効化される
- **依存**: Task 3.4
- **推定時間**: 2時間
- **ドキュメント**: [.tmp/tasks/task-3.5-rls-setup.md](.tmp/tasks/task-3.5-rls-setup.md)
- **完了日**: 2025-10-12

### Task 3.6: シードデータ作成 ✅

- [x] `core/db/seed.ts`作成（bcrypt、UUID、idempotency対応）
- [x] デフォルトテナント（`tenant_id = 'default'`）作成
- [x] テスト用Developer・Organization作成（5 developers, 3 organizations）
- [x] テスト用Activity作成（10 activities）
- [x] Funnel stages master data（4 stages）
- [x] Activity funnel mappings（11 mappings）
- [x] 包括的なテスト作成（`core/db/seed.test.ts` - 22 tests）
- **完了条件**: `pnpm db:seed`でシードデータが投入される
- **依存**: Task 3.5
- **推定時間**: 1.5時間
- **ドキュメント**: [.tmp/tasks/task-3.6-seed-data.md](.tmp/tasks/task-3.6-seed-data.md)
- **完了日**: 2025-10-12
- **注意**: RLSポリシーとの統合はテナントコンテキストAPI実装後に対応

### Task 3.7: テナントコンテキスト管理API実装 ✅

- [x] `core/db/connection.ts`にテナントコンテキスト設定API追加（setTenantContext, getTenantContext, clearTenantContext）
- [x] RLSポリシーの修正（FORCE RLS + NULL-safe条件）
- [x] シードスクリプトのRLS対応（一時的な無効化）
- [x] シードスクリプトの冪等性修正（固定UUID使用）
- **完了条件**: `pnpm db:seed`でシードデータが投入できる（RLSポリシーを満たしながら） ✓
- **依存**: Task 3.5, Task 3.6
- **推定時間**: 2時間
- **ドキュメント**: [.tmp/tasks/task-3.7-tenant-context-api.md](.tmp/tasks/task-3.7-tenant-context-api.md)
- **完了日**: 2025-10-12

### Task 3.8: 認証システム実装 ✅

- [x] Remix Sessionsセットアップ（Cookie-based）
- [x] `core/services/auth.service.ts`作成
- [x] `login(email, password)`実装（bcryptでパスワード検証）
- [x] `logout()`実装（セッション破棄）
- [x] `getCurrentUser(request)`実装（セッションからユーザー取得）
- [x] `app/routes/login.tsx`作成（ログインフォーム、Header/Footer/ダークモード対応）
- [x] `app/routes/logout.ts`作成（ログアウト処理、POST-only）
- [x] 認証ミドルウェア実装（`requireAuth()`, `getCurrentUser()`）
- [x] セッションとテナントIDの紐付け
- [x] E2Eテスト実装（6 tests、全49 E2Eテストパス）
- [x] RLS設計の修正（tenantsはRLS有効、usersはRLS無効で認証基盤化）
- [x] Idempotent seeding実装（TRUNCATE CASCADE）
- **完了条件**: ログイン/ログアウトが機能し、セッションが保持される ✓
- **依存**: Task 3.7
- **推定時間**: 4時間
- **完了日**: 2025-10-13
- **ドキュメント**: [.tmp/tasks/task-3.8-authentication.md](.tmp/tasks/task-3.8-authentication.md)
- **注意**:
  - usersテーブルは既にTask 3.2で実装済み（admin.ts）
  - パスワードはbcryptでハッシュ化（constant-time comparison）
  - セッションCookieは`httpOnly`, `secure`, `sameSite`設定
  - テスト用ユーザー: test@example.com / password123（member）、admin@example.com / admin123456（admin）
  - 重要な修正: `/auth/login` → `/login`、RLS設計の修正（users tableはRLS無効）

---

## Phase 4: DRMコア機能実装（MVP）

### Task 4.1: DRMサービス基盤実装 ✅

- [x] `core/services/drm.service.ts`作成
- [x] `createDeveloper()`実装
- [x] `getDeveloper()`実装
- [x] `listDevelopers()`実装（ページネーション付き）
- [x] `updateDeveloper()`実装（UPDATE操作）
- [x] `deleteDeveloper()`実装（DELETE操作）
- [x] Zodスキーマでバリデーション
- [x] ソート機能実装（listDevelopers）
- [x] 包括的なテスト作成（24 tests）
- **完了条件**: サービス関数が単体テストでパスする ✓
- **依存**: Task 3.6
- **推定時間**: 3時間
- **ドキュメント**: [.tmp/tasks/task-4.1-drm-service.md](.tmp/tasks/task-4.1-drm-service.md)
- **完了日**: 2025-10-13

### Task 4.2: Developer API実装 ✅

- [x] `app/routes/api/developers.ts`作成（Resource Route）
- [x] `GET /api/developers`（一覧取得、ページネーション、フィルタ、ソート）
- [x] `POST /api/developers`（新規作成）
- [x] `app/routes/api/developers.$id.ts`作成
- [x] `GET /api/developers/:id`（詳細取得）
- [x] `PUT /api/developers/:id`（更新）
- [x] `DELETE /api/developers/:id`（削除）
- [x] 認証チェック（Task 3.8のrequireAuth()使用）
- [x] エラーハンドリング（400, 401, 404, 405, 409, 500）
- **完了条件**: APIが統合テストでパスする ✓
- **依存**: Task 3.8, Task 4.1
- **推定時間**: 3時間
- **ドキュメント**: [.tmp/tasks/task-4.2-developer-api.md](.tmp/tasks/task-4.2-developer-api.md)
- **完了日**: 2025-10-13

### Task 4.3: ID統合機能実装 ✅

- [x] `resolveDeveloper()`実装（identifiersテーブルから検索）
- [x] `mergeDevelopers()`実装（重複開発者の統合）
- [x] メールアドレス・SNS IDからのマッチングロジック
- **完了条件**: ID統合ロジックが単体テストでパスする ✓
- **依存**: Task 4.1
- **推定時間**: 3時間
- **完了日**: 2025-10-13
- **ドキュメント**: [.tmp/tasks/task-4.3-id-integration.md](.tmp/tasks/task-4.3-id-integration.md)
- **注意**:
  - identity.service.tsを3つに分割（identity-resolver.service.ts, identity-merge.service.ts, identity-identifiers.service.ts）
  - RLS対応：withTenantContext()ヘルパー使用（本番環境のconnection pooling対応）
  - 全160テスト成功

### Task 4.4: Activityサービス実装 ✅

- [x] `core/services/activity.service.ts`作成（barrel file）
- [x] `createActivity()`実装（CRUD - Create）
- [x] `getActivity()`実装（CRUD - Read single）
- [x] `listActivities()`実装（CRUD - Read、developerId/accountId/resourceId/action/source/日付範囲でフィルタ、ページネーション、ソート）
- [x] `updateActivity()`実装（CRUD - Update、部分更新対応）
- [x] `deleteActivity()`実装（CRUD - Delete、GDPR対応）
- [x] Zodスキーマでバリデーション（CreateActivitySchema, ListActivitiesSchema, UpdateActivitySchema）
- [x] ファイル分割（activity-create/get/list/update/delete.service.ts、各150行以下）
- [x] セキュリティ修正（race condition対策、tenant scoping、empty update guard）
- [x] バリデーション修正（date coercion、date range validation）
- [x] UUID関数統一（uuid-ossp extension追加）
- [x] 包括的なテスト作成（25 tests、モック不使用、全て通過）
- [x] TypeScriptエラー解消（as any/unknown不使用）
- **完了条件**: サービス関数が単体テストでパスする ✓
- **依存**: Task 4.1
- **推定時間**: 2時間
- **ドキュメント**: [.tmp/tasks/task-4.4-activity-service.md](.tmp/tasks/task-4.4-activity-service.md)
- **完了日**: 2025-10-13
- **注意**:
  - Deduplication機能実装（dedupKey with unique constraint）
  - Confidence score validation (0.0-1.0)
  - Event sourcing principles（Activities are event logs）
  - Drizzleクエリビルダーの型安全性対応（チェーン形式）
  - Critical security fixes implemented (atomic operations, tenant scoping)
  - Date validation and coercion for ISO string support

### Task 4.5: Activity API実装 ✅

- [x] `app/routes/api/activities.ts`作成（Resource Route）
- [x] `GET /api/activities?developer_id=xxx`（一覧取得）
- [x] `POST /api/activities`（新規登録）
- [x] `GET /api/activities/:id`（詳細取得）
- [x] `PUT /api/activities/:id`（更新）
- [x] `DELETE /api/activities/:id`（削除）
- [x] 認証チェック（Task 3.8のrequireAuth()使用）
- [x] エラーハンドリング（400, 401, 404, 409, 500）
- [x] ハンドラーファイル分割（list/create/get/update/delete.handler.ts、各150行以下）
- [x] セキュリティ修正（request body guard、date validation、COUNT最適化）
- [x] 包括的なテスト作成（26 tests、モック不使用、全て通過）
- [x] TypeScriptエラー解消（as any/unknown不使用）
- **完了条件**: APIが統合テストでパスする ✓
- **依存**: Task 3.8, Task 4.4
- **推定時間**: 2時間
- **ドキュメント**: [.tmp/tasks/task-4.5-activity-api.md](.tmp/tasks/task-4.5-activity-api.md)
- **完了日**: 2025-10-13
- **注意**:
  - Event sourcing principles（Activities are event logs）
  - UPDATE/DELETEは極めて稀な操作（GDPR対応等）
  - Deduplication via dedupKey（409 Conflict response）
  - ハンドラー分離でコード可読性向上
  - COUNT aggregateクエリでパフォーマンス最適化

---

## Phase 5: ROI分析機能実装（MVP）

### Task 5.1: ROIサービス基盤実装 ✅

- [x] `core/services/campaign.service.ts`作成（barrel file）
- [x] `createCampaign()`実装（Campaign作成）
- [x] `getCampaign()`実装（Campaign詳細取得）
- [x] `listCampaigns()`実装（Campaign一覧取得、ページネーション・フィルタ・ソート）
- [x] `updateCampaign()`実装（Campaign更新）
- [x] `deleteCampaign()`実装（Campaign削除）
- [x] Zodスキーマでバリデーション（CreateCampaignSchema, ListCampaignsSchema, UpdateCampaignSchema）
- [x] RLS対応（withTenantContext使用）
- [x] ファイル分割（campaign.schemas.ts, campaign-{create,get,list,update,delete}.service.ts、各150行以下）
- [x] 包括的なテスト作成（22テスト、モック不使用、全て通過）
- [x] TypeScriptエラー解消（`as any`/`as unknown`不使用）
- [x] Date型 → PostgreSQL date string変換（'YYYY-MM-DD'）
- [x] CASCADE削除実装（budgets削除、resources orphan化）
- **完了条件**: サービス関数が単体テストでパスする ✓
- **依存**: Task 3.6
- **推定時間**: 2時間
- **ドキュメント**: [.tmp/tasks/task-5.1-roi-service.md](.tmp/tasks/task-5.1-roi-service.md)
- **完了日**: 2025-10-14

### Task 5.2: ROI計算ロジック実装 ✅

- [x] `calculateROI(campaignId)`実装
- [x] `getCampaignCost()`実装（budgetsからSUM集計）
- [x] `getCampaignValue()`実装（activitiesのvalue列からSUM集計）
- [x] ROI計算式の実装（`(効果値 - 投資額) / 投資額 * 100`）
- [x] Zodスキーマでバリデーション（CampaignROISchema）
- [x] ファイル分割（roi.schemas.ts, roi-{cost,value,calculate}.service.ts、各150行以下）
- [x] 包括的なテスト作成（16テスト、モック不使用、全て通過）
- [x] TypeScriptエラー解消（`as any`/`as unknown`不使用）
- [x] activities.value カラム追加（migration 0002）
- [x] RLS対応（withTenantContext使用）
- **完了条件**: 計算ロジックが単体テストでパスする ✓
- **依存**: Task 5.1
- **推定時間**: 2時間
- **ドキュメント**: [.tmp/tasks/task-5.2-roi-calculation.md](.tmp/tasks/task-5.2-roi-calculation.md)
- **完了日**: 2025-10-14

### Task 5.3: 短縮URL機能実装 ✅

- [x] `generateShortURL(campaignId, target)`実装
- [x] 短縮ID生成（nanoidなど）
- [x] Clicksテーブルへの登録
- [x] リダイレクトAPI実装（`app/routes/c/$shortId.ts`）
- **完了条件**: 短縮URLが機能し、クリック数がカウントされる ✓
- **依存**: Task 5.1
- **推定時間**: 3時間
- **ドキュメント**: [.tmp/tasks/task-5.3-shorturl.md](.tmp/tasks/task-5.3-shorturl.md)
- **完了日**: 2025-10-15

### Task 5.4: Campaign API実装 ✅

- [x] `app/routes/api/campaigns.ts`作成（Resource Route）
- [x] `GET /api/campaigns`（一覧取得）
- [x] `POST /api/campaigns`（新規作成）
- [x] `app/routes/api/campaigns.$id.ts`作成（Resource Route）
- [x] `GET /api/campaigns/:id`（詳細取得）
- [x] `PUT /api/campaigns/:id`（更新）
- [x] `DELETE /api/campaigns/:id`（削除）
- [x] `app/routes/api/campaigns.$id.roi.ts`作成（Resource Route）
- [x] `GET /api/campaigns/:id/roi`（ROI取得）
- **完了条件**: CRUD完全対応のAPIが統合テストでパスする ✓
- **依存**: Task 5.2, Task 5.3
- **推定時間**: 4時間
- **ドキュメント**: [.tmp/tasks/task-5.4-campaign-api.md](.tmp/tasks/task-5.4-campaign-api.md)
- **完了日**: 2025-10-16

---

## Phase 6: ファネル分析機能実装（MVP）

### Task 6.1: Funnelサービス基盤実装 ✅

- [x] `core/services/funnel.service.ts`作成
- [x] `classifyStage(activity)`実装（Awareness/Engagement/Adoption/Advocacy判定）
- [x] `getFunnelStats()`実装（各ステージの人数集計）
- **完了条件**: サービス関数が単体テストでパスする ✓
- **依存**: Task 4.3
- **推定時間**: 3時間
- **ドキュメント**: [.tmp/tasks/task-6.1-funnel-service.md](.tmp/tasks/task-6.1-funnel-service.md)
- **完了日**: 2025-10-16

### Task 6.2: ドロップ率計算実装 ✅

- [x] `calculateDropRate(stage)`実装
- [x] 前ステージからの離脱率計算
- [x] 時系列データの集計
- **完了条件**: 計算ロジックが単体テストでパスする ✓
- **依存**: Task 6.1
- **推定時間**: 2時間
- **ドキュメント**: [.tmp/tasks/task-6.2-drop-rate-calculation.md](.tmp/tasks/task-6.2-drop-rate-calculation.md)
- **完了日**: 2025-10-16

### Task 6.3: Funnel API実装 ✅

- [x] `app/routes/api/funnel.ts`作成（Resource Route）
- [x] `GET /api/funnel`（全体ファネル取得）
- [x] `GET /api/funnel/timeline`（時系列データ取得）
- **完了条件**: APIが統合テストでパスする ✓
- **依存**: Task 6.2
- **推定時間**: 2時間
- **ドキュメント**: [.tmp/tasks/task-6.3-funnel-api.md](.tmp/tasks/task-6.3-funnel-api.md)
- **完了日**: 2025-10-16

---

## Phase 7: ダッシュボードUI実装（MVP）

### Task 7.1: ダッシュボードレイアウト実装 ✅

- [x] `app/routes/dashboard.tsx`作成
- [x] サイドバーナビゲーション（Overview, Developers, Campaigns, Funnel）。一番下に System Settings へのアイコン
- [x] ヘッダー（ロゴ、ユーザー情報）
- [x] サイドバーの項目、ウィジェットはプラグイン次第で増減することを想定
- [x] ダークモード対応（DarkModeProvider実装）
- [x] モバイル対応（レスポンシブデザイン）
- [x] E2Eテスト作成（12テスト）
- **完了条件**: ダッシュボードが表示され、ナビゲーションが機能する ✓
- **依存**: Task 2.1
- **推定時間**: 3時間
- **ドキュメント**: [.tmp/tasks/task-7.1-dashboard-layout.md](.tmp/tasks/task-7.1-dashboard-layout.md)
- **完了日**: 2025-10-17

### Task 7.2: Overviewページ実装 ✅

- [x] `app/routes/dashboard._index.tsx`作成
- [x] Swapyでウィジェットをドラッグ＆ドロップ可能に（[Swapy](https://swapy.tahazsh.com/)）
- [x] 総アクティビティ数・開発者数・施策件数の表示
- [x] ROI平均値の表示
- [x] 簡易グラフ（Recharts）
- [x] E2Eテスト作成
- **完了条件**: Overviewページが表示され、データが取得される ✓
- **依存**: Task 7.1, Task 4.5, Task 5.4
- **推定時間**: 4時間
- **ドキュメント**: [.tmp/tasks/task-7.2-overview-page.md](.tmp/tasks/task-7.2-overview-page.md)
- **完了日**: 2025-10-17

### Task 7.3: Developersページ実装 ✅

- [x] `app/routes/dashboard/developers.tsx`作成
- [x] 開発者リスト表示（ページネーション付き）
  - 一覧機能はプラグインでも使うので、共通コンポーネント化する
- [x] 検索・フィルタ機能
- [x] 開発者詳細ページ（`/dashboard/developers/:id`）
- **完了条件**: 開発者リストが表示され、詳細ページへ遷移できる ✓
- **依存**: Task 7.1, Task 4.2, Task 4.3
- **推定時間**: 4時間
- **ドキュメント**: [.tmp/tasks/task-7.3-developers-page.md](.tmp/tasks/task-7.3-developers-page.md)
- **完了日**: 2025-10-18

### Task 7.3.1: RLS実装の修正とテスト環境の改善（技術的負債解消）

- [ ] **NODE_ENV=test環境でのテスト実行対応**
  - 現在の問題: `connection.ts`で`NODE_ENV=test`時に`max: 1`制限があり、E2E環境でデッドロック発生
- [ ] **withTenantContext()への統一**
  - 現在の問題: Production codeとTestコードが`setTenantContext()`（セッションスコープ、`SET`）を使用
  - Connection poolingで接続が再利用されると、tenant contextが漏洩する危険性
  - 正しい実装: `withTenantContext()`（トランザクションスコープ、`SET LOCAL`）を使用
  - 影響範囲:
    - Production API routes: `app/routes/api/campaigns.ts`, `app/routes/api/campaigns.$id.ts`, `app/routes/api/funnel.ts`
    - Test code: `app/middleware/tenant-context.test.ts`, `app/routes/api/campaigns.$id.test.ts`、その他すべてのRLSテスト
  - 実装手順:
    2. すべてのProduction codeを`withTenantContext()`に書き換え
    3. すべてのTest codeを`withTenantContext()`に書き換え
    4. RLS integration testsが全てパスすることを確認
- **ドキュメント**: [.tmp/tasks/task-7.3.1-rls-tenancy-refactor.md](.tmp/tasks/task-7.3.1-rls-tenancy-refactor.md)
- **完了条件**:
  - 統合テスト（Vitest）が全てパスする
  - E2Eテスト（Playwright）が全てパスする（NODE_ENV=test環境）
  - すべてのコードが`withTenantContext()`を使用している
- **依存**: なし（独立した技術的負債解消タスク）
- **推定時間**: 8時間
- **優先度**: 高（現在のRLS実装は本質的に危険）
- **注意**:
  - このタスクは大規模なリファクタリングを含む
  - すべてのAPI routesとservice functionsに影響
  - 慎重なテストとレビューが必要

### Task 7.3.2: システム設定画面の実装 ✅

- [x] データベーススキーマ更新（`service_name`, `logo_url`, `fiscal_year_start_month`, `timezone`, `s3_settings`, `smtp_settings`追加）
- [x] `core/config/env.ts`実装（ENCRYPTION_KEY起動時バリデーション）
- [x] `core/utils/encryption.ts`実装（AES-256-GCM暗号化/復号化、キーローテーション対応）
- [x] `core/utils/s3-client.ts`実装（S3アップロード/削除）
- [x] `core/utils/smtp-client.ts`実装（SMTP接続テスト）
- [x] `core/services/system-settings.service.ts`実装（CRUD、暗号化、S3/SMTP設定チェック、ロゴアップロード）
- [x] `app/routes/api.system-settings.ts`実装（GET/PUT、admin権限チェック）
- [x] `app/routes/api.system-settings.upload-logo.ts`実装（POST、ロゴアップロード）
- [x] `app/routes/dashboard.settings.tsx`作成（Basic/S3/SMTP設定画面、ロゴアップロードUI）
- [x] 接続テスト機能実装（S3/SMTP接続確認API）
- [x] E2Eテスト作成（14テスト：Basic 6 + S3 3 + SMTP 2 + Validation 3）
- **完了条件**: システム設定画面が表示され、S3/SMTP設定が保存・テスト・ロゴアップロードできる ✓
- **依存**: Task 7.1
- **推定時間**: 8時間
- **完了日**: 2025-10-20
- **ドキュメント**: [.tmp/tasks/task-7.3.2-system-settings.md](.tmp/tasks/task-7.3.2-system-settings.md)
- **注意**:
  - AI機能はOSS版に含まれないため除外
  - 会計年度は期初月のみ（1-12、デフォルト: 4）
  - S3未設定時はロゴアップロード無効化（URL入力のみ）
  - 機密情報（API keys, passwords）は暗号化してDB保存
  - GET APIでは機密情報を返さない（boolean flagのみ）
  - 設定変更はadminロールのみ許可
  - ENCRYPTION_KEY起動時バリデーション（Fail-Fast）
  - ロゴアップロード: multipart/form-data、2MB以下、PNG/JPEG/WebPのみ（SVG除外）

### Task 7.3.3: アクティビティカラーとアイコンの設定画面実装（システム設定画面の一部） 🔄 進行中

**現在の進捗（2025-10-20）:**
- [x] `core/db/schema/admin.ts`に`activity_types`テーブル追加 ✅
  - カラム: `activity_type_id`, `tenant_id`, `action`, `icon_name`, `color_class`, `stage_key`, `created_at`, `updated_at`
  - Migration 0007生成・適用完了
- [x] `core/services/activity-type.service.ts`作成（CRUD + デフォルトシードデータ） ✅
  - 24個のテストパス
- [x] `app/routes/api.activity-types.ts`作成（アクティビティタイプCRUD API） ✅
  - GET (list), POST (create) - 13テスト
- [x] `app/routes/api.activity-types.$action.ts`作成（個別リソースAPI） ✅
  - GET, PUT, DELETE - 13テスト
- [x] `app/routes/api.activity-types.actions.ts`作成（既存アクション一覧API） ✅
  - GET - 3テスト
- [ ] 依存関係インストール（@zunicornshift/mui-iconify-picker, react-color, @types/react-color）
- [ ] `app/routes/dashboard.settings.activity-types.tsx`作成（アクティビティタイプ設定画面）
- [ ] 設定画面UI実装
  - アクティビティタイプ一覧表示（テーブル形式）
  - アイコンピッカー（@zunicornshift/mui-iconify-picker）
  - カラーパレット（react-color CirclePicker）
  - ファネルステージ選択ドロップダウン
  - ActionCombobox（既存アクション選択 + 新規入力）
  - CRUD操作（作成・編集・削除）
- [ ] E2Eテスト作成（13テスト）
  - Basic Settings: 6 tests
  - S3 Settings: 3 tests
  - SMTP Settings: 2 tests
  - Validation: 2 tests
- **完了条件**: 設定画面でアクティビティタイプごとにアイコンとカラーを設定でき、E2Eテストが全てパスする
- **依存**: Task 7.3
- **推定時間**: 6.5時間（残り: 約3.5時間）
- **ドキュメント**: [.tmp/tasks/task-7.3.3-activity-type-settings.md](.tmp/tasks/task-7.3.3-activity-type-settings.md)
- **注意**:
  - 実装は2段階に分割：
    1. このタスク（7.3.3）: 設定画面とテーブル作成（DB・API完了、UI・E2E残り）
    2. 次のタスク（7.3.4）: `getActivityColor()`と`getActivityIconName()`の実装（データベースから取得）
  - ActivityTimeline.tsx内のTODOコメントを参照

### Task 7.3.4: ActivityTimeline動的カラー・アイコン適用

- [ ] `getActivityColor()`実装（データベースから設定を取得）
- [ ] `getActivityIconName()`実装（データベースから設定を取得）
- [ ] `ActivityTimeline.tsx`にデータローディング処理追加
- [ ] キャッシング実装（同一テナント内で設定を再利用）
- [ ] E2Eテスト作成（カラー・アイコンの動的表示確認）
- **完了条件**: ActivityTimelineがデータベースの設定に基づいてカラーとアイコンを動的に表示する
- **依存**: Task 7.3.3
- **推定時間**: 3時間
- **ドキュメント**: [.tmp/tasks/task-7.3.4-activity-timeline-dynamic.md](.tmp/tasks/task-7.3.4-activity-timeline-dynamic.md)

### Task 7.4: Campaignsページ実装

- [ ] `app/routes/dashboard/campaigns.tsx`作成
- [ ] 施策リスト表示
- [ ] ROI表示（色分け: 正/負）
- [ ] 施策詳細ページ（`/dashboard/campaigns/:id`）
- **完了条件**: 施策リストが表示され、ROIが確認できる
- **依存**: Task 7.1, Task 5.4
- **推定時間**: 4時間

### Task 7.5: Funnelページ実装

- [ ] `app/routes/dashboard/funnel.tsx`作成
- [ ] ファネルチャート表示（Recharts）
- [ ] ドロップ率表示
- [ ] 時系列グラフ（日次/週次/月次）
- **完了条件**: ファネルページが表示され、グラフが描画される
- **依存**: Task 7.1, Task 6.3
- **推定時間**: 4時間

---

## Phase 8: プラグインシステム実装（基盤）

### Task 8.1: Plugin Loader実装

- [ ] `core/plugin-system/loader.ts`作成
- [ ] `discoverPlugins()`実装（node_modules/スキャン）
- [ ] `loadPlugin(packageName)`実装
- [ ] プラグインメタデータ取得（package.jsonから）
- **完了条件**: プラグインが検出される
- **依存**: Task 3.6
- **推定時間**: 3時間

### Task 8.2: Hook Registry実装

- [ ] `core/plugin-system/hooks.ts`作成
- [ ] `registerHook(name, handler)`実装
- [ ] `executeHook(name, args)`実装
- [ ] プラグインフックの実行ログ記録（plugin_logsテーブル）
- **完了条件**: フックが登録・実行される
- **依存**: Task 8.1
- **推定時間**: 2時間

### Task 8.3: Job Scheduler実装（BullMQ）

- [ ] BullMQインストール
- [ ] `core/plugin-system/scheduler.ts`作成
- [ ] `registerJob(name, cron, handler)`実装
- [ ] Redisキュー接続
- [ ] Workerプロセス実装
- **完了条件**: cronジョブが登録・実行される
- **依存**: Task 8.2
- **推定時間**: 4時間

### Task 8.4: Plugin管理API実装

- [ ] `app/routes/api/plugins.ts`作成
- [ ] `GET /api/plugins`（インストール済みプラグイン一覧）
- [ ] `POST /api/plugins/:id/enable`（プラグイン有効化）
- [ ] `POST /api/plugins/:id/disable`（プラグイン無効化）
- [ ] `GET /api/plugins/:id/logs`（実行ログ取得）
- **完了条件**: APIが機能し、プラグインが有効化/無効化できる
- **依存**: Task 8.3
- **推定時間**: 3時間

---

## Phase 9: Google Analyticsプラグイン実装（サンプル）

### Task 9.1: Google Analytics Plugin初期化

- [ ] `plugins/google_analytics/package.json`作成
- [ ] `plugins/google_analytics/src/index.ts`作成
- [ ] `definePlugin()`でプラグイン定義
- [ ] Google Analytics SDKインストール
- **完了条件**: プラグインがビルドできる
- **依存**: Task 8.1
- **推定時間**: 2時間

### Task 9.2: Google Analytics同期ジョブ実装

 [ ] `syncGoogleAnalyticsData(ctx)`実装
- [ ] GoogleAnalytics Capture APIからイベント取得
- [ ] `distinct_id = click_id`で匿名データ識別
- [ ] DRMのActivityテーブルと統合
- **完了条件**: 同期ジョブが実行され、データが取得される
- **依存**: Task 9.1, Task 8.3
- **推定時間**: 4時間

### Task 9.3: GoogleAnalytics設定UI実装

- [ ] プラグイン設定画面（`/dashboard/plugins/google_analytics`）
- [ ] APIキー・プロジェクトID入力フォーム
- [ ] 設定保存API（`POST /api/plugins/google_analytics/config`）
- **完了条件**: 設定画面からAPIキーを保存できる
- **依存**: Task 9.1
- **推定時間**: 3時間

---

## 追加プラグイン開発

- GitHubプラグイン
- KPIプラグイン
- Slack通知プラグイン

---

## Phase 10: テストとデプロイ準備

### Task 10.1: 単体テスト実装

- [ ] Vitestセットアップ
- [ ] DRMサービスのテスト
- [ ] ROIサービスのテスト
- [ ] Funnelサービスのテスト
- [ ] カバレッジ80%以上
- **完了条件**: `pnpm test`が成功する
- **依存**: Task 4.1, Task 5.1, Task 6.1
- **推定時間**: 6時間

### Task 10.2: 統合テスト実装

- [ ] APIエンドポイントのテスト
- [ ] データベース接続テスト
- [ ] Redisキューテスト
- **完了条件**: 統合テストが成功する
- **依存**: Task 4.4, Task 5.4, Task 6.3
- **推定時間**: 4時間

### Task 10.3: E2Eテスト実装（Playwright）

- [ ] Playwrightセットアップ
- [ ] ダッシュボード表示テスト
- [ ] Developer作成フローテスト
- [ ] Campaign作成フローテスト
- **完了条件**: E2Eテストが成功する
- **依存**: Task 7.5
- **推定時間**: 5時間

### Task 10.4: ドキュメント作成

- [ ] README.md更新（インストール手順、起動方法）
- [ ] API仕様書作成（OpenAPI/Swaggerドキュメント）
- [ ] プラグイン開発ガイド作成
- [ ] デプロイガイド作成
- **完了条件**: ドキュメントが完成し、第三者が理解できる
- **依存**: Task 10.3
- **推定時間**: 4時間

### Task 10.5: 本番環境用設定

- [ ] `docker-compose.prod.yml`作成
- [ ] 環境変数の本番用設定
- [ ] PostgreSQL外部接続設定
- [ ] Redis外部接続設定
- [ ] ログ設定（JSON形式）
- **完了条件**: 本番環境でデプロイ可能
- **依存**: Task 10.4
- **推定時間**: 3時間

---

## 実装順序

### Sprint 1（Week 1）: 環境構築とインフラ基盤
- Task 1.1 → Task 1.2 → Task 1.3 → Task 1.4 → Task 1.5
- Task 2.1 → Task 2.2 → Task 2.3 → Task 2.4 → Task 2.5
- **デプロイ確認**: docker-compose up -dでLP・規約・プライバシーポリシーが表示される

### Sprint 2（Week 2）: データベース設計、認証、DRMコア
- Task 3.1 → Task 3.2 → Task 3.3 → Task 3.4 → Task 3.5 → Task 3.6 → Task 3.7 → Task 3.8
- Task 4.1 → Task 4.2 → Task 4.3 → Task 4.4 → Task 4.5
- **デプロイ確認**: 認証が機能し、Developer API・Activity APIが認証付きで動作する

### Sprint 3（Week 3）: ROI・ファネル分析
- Task 5.1 → Task 5.2 → Task 5.3 → Task 5.4
- Task 6.1 → Task 6.2 → Task 6.3
- **デプロイ確認**: Campaign API・Funnel APIが機能する

### Sprint 4（Week 4）: ダッシュボードUI
- Task 7.1 → Task 7.2 → Task 7.3 → Task 7.4 → Task 7.5
- **デプロイ確認**: ダッシュボードが表示され、全機能が操作可能

### Sprint 5（Week 5）: プラグインシステムとGoogleAnalytics統合
- Task 8.1 → Task 8.2 → Task 8.3 → Task 8.4
- Task 9.1 → Task 9.2 → Task 9.3
- **デプロイ確認**: プラグインが有効化され、GoogleAnalytics同期が動作する

### Sprint 6（Week 6）: テストとデプロイ準備
- Task 10.1 → Task 10.2 → Task 10.3 → Task 10.4 → Task 10.5
- **デプロイ確認**: 本番環境でMVPが動作する

---

## 並行実行可能なタスク

以下のタスクは依存関係がないため並行実行可能：

- **Sprint 1**: Task 1.4（PostgreSQL）とTask 1.5（Redis）
- **Sprint 1**: Task 2.3（規約）とTask 2.4（プライバシーポリシー）
- **Sprint 2**: Task 3.2（DRMテーブル）とTask 3.3（ROIテーブル）とTask 3.4（プラグインテーブル）
- **Sprint 3**: Task 5.1-5.4（ROI機能）とTask 6.1-6.3（Funnel機能）
- **Sprint 5**: Task 9.2（GoogleAnalytics同期）とTask 9.3（GoogleAnalytics設定UI）

---

## リスクと対策

| リスク | 対策 |
|--------|------|
| **Docker環境の複雑化** | docker-compose-dev.ymlを分離し、開発環境と本番環境を明確に区別 |
| **データベースマイグレーション失敗** | マイグレーションの前に必ずバックアップ、ロールバックスクリプトを用意 |
| **プラグインシステムの複雑化** | 最初はGoogleAnalyticsプラグイン1つのみ実装し、動作確認してから拡張 |
| **UI/UXの複雑化** | MVPではシンプルなデザインに徹し、機能優先で実装 |
| **テストの不足** | 各Sprintの最後に必ず統合テスト・E2Eテストを実行 |

---

## 注意事項

### デプロイ可能性の維持
- 各タスク完了後、必ず`docker-compose up -d`で起動確認
- すべてのSprintの最後にデプロイ確認を実施
- 動作しない状態でコミットしない

### コミット単位
- 各タスクは1-4時間で完結する単位
- タスク完了時に必ずコミット
- コミットメッセージは`feat(module): Task X.Y - 説明`形式

### 品質チェック
- タスク完了時に`pnpm lint`、`pnpm typecheck`を実行
- テストが必要なタスクは必ず単体テスト・統合テストを実装
- UIタスクはE2Eテストで動作確認

### シンプルさの維持
- 複雑な実装は避け、最小限のコードで機能を実現
- 抽象化は2回目以降に実施（YAGNI原則）
- ドキュメントは簡潔に、コードで自明な部分は省略

---

## 実装開始ガイド

### 1. 最初のタスクから順次実装
- Task 1.1から開始し、依存関係を確認しながら進める
- 各タスクの完了条件を必ず確認

### 2. TodoWriteでタスク管理
- 各タスクの開始時にTodoWriteで`in_progress`に更新
- 完了時は`completed`に更新
- 問題発生時は速やかに報告

### 3. デプロイ確認を徹底
- 各Sprintの最後に必ずデプロイ確認
- `docker-compose up -d`でコンテナが起動することを確認
- ブラウザで動作確認

### 4. 問題発生時の対応
- エラーメッセージを詳細に記録
- ログを確認（`docker-compose logs`）
- 必要に応じてタスクを分割・追加

---

**MVP完成目標**: 6週間後
**最初のデプロイ可能日**: Sprint 1終了時（Week 1）
