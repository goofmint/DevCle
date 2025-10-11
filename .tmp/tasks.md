# タスクリスト - DRM（DevRel Management）MVP 開発

**Version:** 1.0
**Based on:** requirements.md v2.2, design.md v2.5
**Strategy:** アジャイル開発 - 常にデプロイ可能な状態を維持

---

## 概要

サービス名は `DevCle`（DevRel + Circleの造語）。本番環境のドメインは `devcle.com`。開発環境は `devcle.test`。

- **総タスク数**: 47タスク
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

### Task 1.4: PostgreSQL初期設定

- [ ] 初期化スクリプト（`infra/postgres/init.sql`）
- [ ] pgcrypto拡張の有効化
- [ ] テナント用RLSポリシーのテンプレート作成（`infra/postgres/rls-template.sql`）
- [ ] データベースバックアップ設定（docker volume）
- **完了条件**: PostgreSQLコンテナが起動し、接続可能
- **依存**: Task 1.2
- **推定時間**: 1.5時間
- **ドキュメント**: [.tmp/tasks/task-1.4-postgres-init.md](.tmp/tasks/task-1.4-postgres-init.md)

### Task 1.5: Redis初期設定

- [ ] `redis/redis.conf`作成
- [ ] パスワード認証設定
- [ ] メモリ上限・evictionポリシー設定
- [ ] 永続化設定（AOF）
- **完了条件**: Redisコンテナが起動し、接続可能
- **依存**: Task 1.2
- **推定時間**: 1時間

---

## Phase 2: Remixアプリケーション基盤（最小限のUI）

### Task 2.1: Remix初期セットアップ

- [ ] Remix v2プロジェクト初期化（`core/`）
- [ ] TailwindCSS設定
- [ ] ルートレイアウト作成（`app/root.tsx`）
- [ ] エラーバウンダリ設定
- [ ] 環境変数読み込み（`DATABASE_URL`, `REDIS_URL`）
- **完了条件**: Remixアプリが起動し、ルートページが表示される
- **依存**: Task 1.2
- **推定時間**: 2時間

### Task 2.2: LP（トップページ）作成

- [ ] `app/routes/_index.tsx`作成
- [ ] ヒーローセクション（キャッチコピー、CTA）
- [ ] 機能紹介セクション（DRM, ROI, Funnel）
- [ ] デモリンク・ドキュメントリンク
- [ ] フッター（規約・プライバシーポリシーリンク）
- **完了条件**: トップページが表示され、デザインが整っている
- **依存**: Task 2.1
- **推定時間**: 3時間

### Task 2.3: 利用規約ページ作成

- [ ] `app/routes/terms.tsx`作成
- [ ] 利用規約の文章作成（OSS版・SaaS版共通）
- [ ] TailwindCSSでマークダウンスタイル適用
- **完了条件**: `/terms`でページが表示される
- **依存**: Task 2.1
- **推定時間**: 2時間

### Task 2.4: プライバシーポリシーページ作成

- [ ] `app/routes/privacy.tsx`作成
- [ ] プライバシーポリシーの文章作成（GDPR/CCPA対応）
- [ ] データ収集・利用・保管方針の記載
- **完了条件**: `/privacy`でページが表示される
- **依存**: Task 2.1
- **推定時間**: 2時間

### Task 2.5: ヘルスチェックAPI

- [ ] `app/routes/api/health.ts`作成（Remix Resource Route）
- [ ] PostgreSQL接続確認
- [ ] Redis接続確認
- [ ] JSONレスポンス返却（`{ status: 'ok', db: true, redis: true }`）
- **完了条件**: `GET /api/health`が200を返す
- **依存**: Task 2.1
- **推定時間**: 1時間

---

## Phase 3: データベース設計と実装

### Task 3.1: Drizzle ORMセットアップ

- [ ] `drizzle-orm`, `drizzle-kit`インストール
- [ ] `drizzle.config.ts`作成
- [ ] データベース接続設定（`core/db/connection.ts`）
- [ ] マイグレーションディレクトリ作成
- **完了条件**: Drizzleが初期化され、DB接続確認できる
- **依存**: Task 1.4
- **推定時間**: 1.5時間

### Task 3.2: コアテーブルスキーマ定義

- [ ] `core/db/schema/tenants.ts`（tenantsテーブル）
- [ ] `core/db/schema/developers.ts`（developersテーブル）
- [ ] `core/db/schema/organizations.ts`（organizationsテーブル）
- [ ] `core/db/schema/activities.ts`（activitiesテーブル）
- [ ] `core/db/schema/identifiers.ts`（identifiersテーブル）
- [ ] すべてのテーブルに`tenant_id`カラム追加
- **完了条件**: スキーマファイルがTypeScriptエラーなくビルドできる
- **依存**: Task 3.1
- **推定時間**: 3時間

### Task 3.3: ROI/Campaign/Budgetテーブルスキーマ

- [ ] `core/db/schema/campaigns.ts`（campaignsテーブル）
- [ ] `core/db/schema/budgets.ts`（budgetsテーブル）
- [ ] `core/db/schema/roi_results.ts`（roi_resultsテーブル）
- [ ] `core/db/schema/clicks.ts`（clicksテーブル）
- **完了条件**: スキーマファイルがビルドできる
- **依存**: Task 3.2
- **推定時間**: 2時間

### Task 3.4: プラグインシステムテーブルスキーマ

- [ ] `core/db/schema/plugins.ts`（pluginsテーブル）
- [ ] `core/db/schema/plugin_logs.ts`（plugin_logsテーブル）
- **完了条件**: スキーマファイルがビルドできる
- **依存**: Task 3.2
- **推定時間**: 1時間

### Task 3.5: マイグレーション実行とRLS設定

- [ ] `pnpm db:generate`でマイグレーションファイル生成
- [ ] `pnpm db:migrate`でマイグレーション実行
- [ ] PostgreSQL RLS有効化スクリプト作成（`infra/postgres/rls.sql`）
- [ ] 各テーブルにRLSポリシー追加
- **完了条件**: マイグレーションが成功し、RLSが有効化される
- **依存**: Task 3.4
- **推定時間**: 2時間

### Task 3.6: シードデータ作成

- [ ] `core/db/seed.ts`作成
- [ ] デフォルトテナント（`tenant_id = 'default'`）作成
- [ ] テスト用Developer・Organization作成
- [ ] テスト用Activity作成
- **完了条件**: `pnpm db:seed`でシードデータが投入される
- **依存**: Task 3.5
- **推定時間**: 1.5時間

---

## Phase 4: DRMコア機能実装（MVP）

### Task 4.1: DRMサービス基盤実装

- [ ] `core/services/drm.service.ts`作成
- [ ] `createDeveloper()`実装
- [ ] `getDeveloper()`実装
- [ ] `listDevelopers()`実装（ページネーション付き）
- [ ] Zodスキーマでバリデーション
- **完了条件**: サービス関数が単体テストでパスする
- **依存**: Task 3.6
- **推定時間**: 3時間

### Task 4.2: ID統合機能実装

- [ ] `resolveDeveloper()`実装（identifiersテーブルから検索）
- [ ] `mergeDevelopers()`実装（重複開発者の統合）
- [ ] メールアドレス・SNS IDからのマッチングロジック
- **完了条件**: ID統合ロジックが単体テストでパスする
- **依存**: Task 4.1
- **推定時間**: 3時間

### Task 4.3: Activityサービス実装

- [ ] `core/services/activity.service.ts`作成
- [ ] `createActivity()`実装
- [ ] `listActivities()`実装（developerId, 日付範囲でフィルタ）
- [ ] Zodスキーマでバリデーション
- **完了条件**: サービス関数が単体テストでパスする
- **依存**: Task 4.1
- **推定時間**: 2時間

### Task 4.4: Developer API実装

- [ ] `app/routes/api/developers.ts`作成（Resource Route）
- [ ] `GET /api/developers`（一覧取得）
- [ ] `POST /api/developers`（新規作成）
- [ ] `GET /api/developers/:id`（詳細取得）
- [ ] エラーハンドリング（400, 404, 500）
- **完了条件**: APIが統合テストでパスする
- **依存**: Task 4.1
- **推定時間**: 3時間

### Task 4.5: Activity API実装

- [ ] `app/routes/api/activities.ts`作成（Resource Route）
- [ ] `GET /api/activities?developer_id=xxx`（一覧取得）
- [ ] `POST /api/activities`（新規登録）
- [ ] エラーハンドリング
- **完了条件**: APIが統合テストでパスする
- **依存**: Task 4.3
- **推定時間**: 2時間

---

## Phase 5: ROI分析機能実装（MVP）

### Task 5.1: ROIサービス基盤実装

- [ ] `core/services/roi.service.ts`作成
- [ ] `createCampaign()`実装
- [ ] `getCampaign()`実装
- [ ] `listCampaigns()`実装
- **完了条件**: サービス関数が単体テストでパスする
- **依存**: Task 3.6
- **推定時間**: 2時間

### Task 5.2: ROI計算ロジック実装

- [ ] `calculateROI(campaignId)`実装
- [ ] 予算（budgets）と効果値の集計
- [ ] ROI計算式の実装（`(効果値 - 投資額) / 投資額`）
- **完了条件**: 計算ロジックが単体テストでパスする
- **依存**: Task 5.1
- **推定時間**: 2時間

### Task 5.3: 短縮URL機能実装

- [ ] `generateShortURL(campaignId, target)`実装
- [ ] 短縮ID生成（nanoidなど）
- [ ] Clicksテーブルへの登録
- [ ] リダイレクトAPI実装（`app/routes/c/$shortId.ts`）
- **完了条件**: 短縮URLが機能し、クリック数がカウントされる
- **依存**: Task 5.1
- **推定時間**: 3時間

### Task 5.4: Campaign API実装

- [ ] `app/routes/api/campaigns.ts`作成（Resource Route）
- [ ] `GET /api/campaigns`（一覧取得）
- [ ] `POST /api/campaigns`（新規作成）
- [ ] `GET /api/campaigns/:id/roi`（ROI取得）
- **完了条件**: APIが統合テストでパスする
- **依存**: Task 5.2, Task 5.3
- **推定時間**: 3時間

---

## Phase 6: ファネル分析機能実装（MVP）

### Task 6.1: Funnelサービス基盤実装

- [ ] `core/services/funnel.service.ts`作成
- [ ] `classifyStage(activity)`実装（Awareness/Engagement/Adoption/Advocacy判定）
- [ ] `getFunnelStats()`実装（各ステージの人数集計）
- **完了条件**: サービス関数が単体テストでパスする
- **依存**: Task 4.3
- **推定時間**: 3時間

### Task 6.2: ドロップ率計算実装

- [ ] `calculateDropRate(stage)`実装
- [ ] 前ステージからの離脱率計算
- [ ] 時系列データの集計
- **完了条件**: 計算ロジックが単体テストでパスする
- **依存**: Task 6.1
- **推定時間**: 2時間

### Task 6.3: Funnel API実装

- [ ] `app/routes/api/funnel.ts`作成（Resource Route）
- [ ] `GET /api/funnel`（全体ファネル取得）
- [ ] `GET /api/funnel/timeline`（時系列データ取得）
- **完了条件**: APIが統合テストでパスする
- **依存**: Task 6.2
- **推定時間**: 2時間

---

## Phase 7: ダッシュボードUI実装（MVP）

### Task 7.1: ダッシュボードレイアウト実装

- [ ] `app/routes/dashboard.tsx`作成
- [ ] サイドバーナビゲーション（Overview, Developers, Campaigns, Funnel）
- [ ] ヘッダー（ロゴ、ユーザー情報）
- [ ] TailwindCSSでレスポンシブデザイン
- **完了条件**: ダッシュボードが表示され、ナビゲーションが機能する
- **依存**: Task 2.1
- **推定時間**: 3時間

### Task 7.2: Overviewページ実装

- [ ] `app/routes/dashboard/overview.tsx`作成
- [ ] 総アクティビティ数・開発者数・施策件数の表示
- [ ] ROI平均値の表示
- [ ] 簡易グラフ（Recharts）
- **完了条件**: Overviewページが表示され、データが取得される
- **依存**: Task 7.1, Task 4.5, Task 5.4
- **推定時間**: 4時間

### Task 7.3: Developersページ実装

- [ ] `app/routes/dashboard/developers.tsx`作成
- [ ] 開発者リスト表示（ページネーション付き）
- [ ] 検索・フィルタ機能
- [ ] 開発者詳細ページ（`/dashboard/developers/:id`）
- **完了条件**: 開発者リストが表示され、詳細ページへ遷移できる
- **依存**: Task 7.1, Task 4.4
- **推定時間**: 4時間

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

## Phase 9: PostHogプラグイン実装（サンプル）

### Task 9.1: PostHog Plugin初期化

- [ ] `plugins/posthog/package.json`作成
- [ ] `plugins/posthog/src/index.ts`作成
- [ ] `definePlugin()`でプラグイン定義
- [ ] PostHog Node SDKインストール
- **完了条件**: プラグインがビルドできる
- **依存**: Task 8.1
- **推定時間**: 2時間

### Task 9.2: PostHog同期ジョブ実装

- [ ] `syncPostHogData(ctx)`実装
- [ ] PostHog Capture APIからイベント取得
- [ ] `distinct_id = click_id`で匿名データ識別
- [ ] DRMのActivityテーブルと統合
- **完了条件**: 同期ジョブが実行され、データが取得される
- **依存**: Task 9.1, Task 8.3
- **推定時間**: 4時間

### Task 9.3: PostHog設定UI実装

- [ ] プラグイン設定画面（`/dashboard/plugins/posthog`）
- [ ] APIキー・プロジェクトID入力フォーム
- [ ] 設定保存API（`POST /api/plugins/posthog/config`）
- **完了条件**: 設定画面からAPIキーを保存できる
- **依存**: Task 9.1
- **推定時間**: 3時間

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

### Sprint 2（Week 2）: データベース設計とDRMコア
- Task 3.1 → Task 3.2 → Task 3.3 → Task 3.4 → Task 3.5 → Task 3.6
- Task 4.1 → Task 4.2 → Task 4.3 → Task 4.4 → Task 4.5
- **デプロイ確認**: Developer API・Activity APIが機能する

### Sprint 3（Week 3）: ROI・ファネル分析
- Task 5.1 → Task 5.2 → Task 5.3 → Task 5.4
- Task 6.1 → Task 6.2 → Task 6.3
- **デプロイ確認**: Campaign API・Funnel APIが機能する

### Sprint 4（Week 4）: ダッシュボードUI
- Task 7.1 → Task 7.2 → Task 7.3 → Task 7.4 → Task 7.5
- **デプロイ確認**: ダッシュボードが表示され、全機能が操作可能

### Sprint 5（Week 5）: プラグインシステムとPostHog統合
- Task 8.1 → Task 8.2 → Task 8.3 → Task 8.4
- Task 9.1 → Task 9.2 → Task 9.3
- **デプロイ確認**: プラグインが有効化され、PostHog同期が動作する

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
- **Sprint 5**: Task 9.2（PostHog同期）とTask 9.3（PostHog設定UI）

---

## リスクと対策

| リスク | 対策 |
|--------|------|
| **Docker環境の複雑化** | docker-compose-dev.ymlを分離し、開発環境と本番環境を明確に区別 |
| **データベースマイグレーション失敗** | マイグレーションの前に必ずバックアップ、ロールバックスクリプトを用意 |
| **プラグインシステムの複雑化** | 最初はPostHogプラグイン1つのみ実装し、動作確認してから拡張 |
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
