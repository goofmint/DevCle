# DRM - タスク分解

**Version:** 1.0
**Created:** 2025-10-10
**Based on:** `.tmp/requirements.md`, `.tmp/design.md`

---

## 🎯 開発方針

- **MVP優先**: 小さく始めて、徐々に作り込む
- **UI+機能セット**: 各タスクで「見える機能」を完成させる
- **常時デプロイ可能**: 全タスク完了後に動作する状態を維持
- **docker-compose優先**: 環境構築を最優先、UI作成を重視
- **プラグインアーキテクチャ徹底**: Developer関連機能は全てプラグインとして実装
- **ナビゲーション動的生成**: 有効なプラグインから自動生成
- **静的ページも忘れずに**: LP、利用規約、プライバシーポリシー、問い合わせ

---

## 📋 フェーズ構成

| フェーズ | 目標 | 期間目安 |
|---------|------|---------|
| **Phase 1** | docker-compose + プラグイン基盤 + 認証 | 2週間 |
| **Phase 2** | Developerプラグイン（一覧・詳細・CRUD） | 2週間 |
| **Phase 3** | 分析プラグイン（Funnel/ROI表示） | 2週間 |
| **Phase 4** | 外部連携プラグイン（PostHog等） + Worker | 2週間 |
| **Phase 5** | SaaS化準備（テナント分離） | 1週間 |

---

## Phase 1: docker-compose + プラグイン基盤 + 認証（最優先）

**目標**: `docker-compose up -d` → `http://localhost` でログインし、プラグインシステムが動作する状態

**重要**: プラグインシステムを先に作り、Developer機能はプラグインとして実装

### Task 1.1: docker-compose環境の構築 ✅

**完了条件**: `docker-compose up -d` で全サービスが起動し、Remixアプリにアクセスできる

#### サブタスク

- [ ] 1.1.1 `docker-compose.yml` 作成
  - サービス: `nginx`, `web` (Remix), `worker`, `db` (PostgreSQL), `redis`, `posthog`
  - ネットワーク設定、ボリューム設定
  - 完了: 全サービスが起動し、ヘルスチェックが通る

- [ ] 1.1.2 `Dockerfile` 作成（Remix用）
  - Node.js 20.x ベースイメージ
  - pnpm インストール
  - アプリケーションビルド
  - 完了: `docker build` が成功し、コンテナが起動する

- [ ] 1.1.3 `nginx.conf` 作成
  - リバースプロキシ設定（web:8080へ転送）
  - 静的ファイル配信設定
  - 完了: `http://localhost` で Remix アプリにアクセスできる

- [ ] 1.1.4 環境変数設定（`.env.example` 作成）
  - `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`
  - PostHog API設定（Phase 4で使用）
  - 完了: `.env` をコピーして各サービスが正常起動

- [ ] 1.1.5 動作確認
  - 全サービスの起動確認 (`docker-compose ps`)
  - ログ確認（エラーがないこと）
  - 完了: 全サービスが `healthy` または `running` 状態

**見積もり**: 2日

---

### Task 1.2: Drizzle ORM セットアップ + マイグレーション

**完了条件**: `pnpm db:push` でテーブルが作成され、PostgreSQLに接続できる

#### サブタスク

- [ ] 1.2.1 Drizzle ORM インストール
  - `drizzle-orm`, `drizzle-kit`, `postgres` パッケージ追加
  - `drizzle.config.ts` 作成
  - 完了: `pnpm drizzle-kit` コマンドが使用可能

- [ ] 1.2.2 コアスキーマ定義（プラグイン用テーブルのみ）
  - `db/schema/plugins.ts` (id, name, slug, version, enabled, settings, created_at, updated_at)
  - `db/schema/users.ts` (id, email, github_id, tenant_id, created_at, updated_at)
  - `db/schema/tenants.ts` (id, name, subdomain, plan, created_at, updated_at)
  - 完了: スキーマファイルが TypeScript エラーなく保存される

- [ ] 1.2.3 マイグレーション実行
  - `pnpm db:generate` でマイグレーションファイル生成
  - `pnpm db:push` でテーブル作成
  - 完了: PostgreSQL に3テーブルが作成される

- [ ] 1.2.4 データベース接続確認
  - `db/index.ts` でDrizzleクライアント初期化
  - Remix loaderで接続テスト
  - 完了: Remixから `SELECT 1` クエリが成功

**見積もり**: 1日

---

### Task 1.3: プラグインローダー実装← プラグインシステムを先に作る！

**完了条件**: プラグインが動的にロードされ、ナビゲーションに表示される

#### サブタスク

- [ ] 1.3.1 プラグインローダー実装 (`app/core/plugin-loader.ts`)
  - プラグインディレクトリスキャン (`app/plugins/*`)
  - `definePlugin` 関数定義
  - プラグインメタデータ読み込み
  - 完了: プラグインがロードされる

- [ ] 1.3.2 プラグインAPI定義
  ```typescript
  interface Plugin {
    id: string;
    name: string;
    slug: string; // URL用 (例: "developers")
    description: string;
    icon?: string;
    navigation?: {
      label: string;
      path: string;
      order: number;
    };
    dashboardWidgets?: DashboardWidget[];
    routes?: PluginRoute[];
    schema?: Record<string, TableSchema>; // プラグイン独自テーブル
  }
  ```
  - 完了: 型定義が TypeScript エラーなく保存される

- [ ] 1.3.3 プラグインコンテキスト実装
  - `app/root.tsx` でプラグインをロード
  - 有効なプラグイン一覧をコンテキストに保存
  - 完了: コンテキストから有効なプラグインが取得できる

- [ ] 1.3.4 動作確認
  - サンプルプラグインを作成してロード
  - プラグイン一覧がログに出力される
  - 完了: プラグインローダーが正常動作

**見積もり**: 2日

---

### Task 1.4: 動的ナビゲーション実装

**完了条件**: 有効なプラグインから自動生成されたナビゲーションが表示される

#### サブタスク

- [ ] 1.4.1 ナビゲーションコンポーネント作成 (`app/components/Navigation.tsx`)
  - プラグインコンテキストから有効なプラグインを取得
  - `plugin.navigation` から動的にリンク生成
  - デフォルトリンク: "Plugins", "Settings", "Account"
  - 完了: ナビゲーションバーが表示される

- [ ] 1.4.2 ルートレイアウト更新 (`app/root.tsx`)
  - Navigation コンポーネントを追加
  - 完了: 全ページでナビゲーションが表示される

- [ ] 1.4.3 動作確認
  - プラグインなし: デフォルトリンクのみ表示
  - プラグインあり: プラグインリンクが追加表示
  - 完了: ナビゲーションが動的に生成される

**見積もり**: 0.5日

---

### Task 1.5: ダッシュボードUI（プラグインウィジェット対応）

**完了条件**: `http://localhost` でダッシュボードが表示され、プラグインウィジェットが表示される

#### サブタスク

- [ ] 1.5.1 Remix ルート作成 (`app/routes/_index.tsx`)
  - Loader: 有効なプラグインの dashboardWidgets を取得
  - 完了: loader が TypeScript エラーなく保存される

- [ ] 1.5.2 ダッシュボードUI実装（Tailwind CSS + shadcn/ui）
  - ヘッダー: "DRM Dashboard"
  - プラグインウィジェットを動的にレンダリング
  - ウィジェットなし: "No plugins enabled" 表示
  - 完了: ブラウザでダッシュボードが表示される

- [ ] 1.5.3 動作確認
  - プラグインなし: "No plugins enabled" 表示
  - プラグインあり: ウィジェットが表示される
  - 完了: ダッシュボードが動作する

**見積もり**: 1日

---

### Task 1.6: プラグイン管理画面

**完了条件**: `http://localhost/plugins` でプラグイン一覧と有効化・無効化が可能

#### サブタスク

- [ ] 1.6.1 Remix ルート作成 (`app/routes/plugins._index.tsx`)
  - Loader: 全プラグイン一覧（enabled/disabled）取得
  - 完了: loader が TypeScript エラーなく保存される

- [ ] 1.6.2 UI実装
  - プラグインカード表示（名前、説明、ステータス）
  - 有効化/無効化トグルボタン
  - 完了: プラグイン一覧が表示される

- [ ] 1.6.3 プラグイン有効化/無効化Action実装
  - Action: プラグインテーブルの enabled カラム更新
  - 完了: トグルボタンで有効化・無効化できる

- [ ] 1.6.4 動作確認
  - プラグインを無効化 → ナビゲーションから消える
  - プラグインを有効化 → ナビゲーションに表示される
  - 完了: プラグイン管理が動作する

**見積もり**: 1日

---

### Task 1.7: システム設定画面

**完了条件**: `http://localhost/settings` でシステム情報が表示される

#### サブタスク

- [ ] 1.7.1 Remix ルート作成 (`app/routes/settings._index.tsx`)
  - Loader: データベース接続状態、Redis接続状態、バージョン情報
  - 完了: loader が TypeScript エラーなく保存される

- [ ] 1.7.2 UI実装
  - システムステータス表示（DB: Connected, Redis: Connected）
  - バージョン情報表示（DRM Core v0.1.0）
  - 完了: 設定画面が表示される

- [ ] 1.7.3 動作確認
  - 接続状態が正しく表示されることを確認
  - 完了: すべてのステータスが "Connected" と表示される

**見積もり**: 0.5日

---

### Task 1.8: 認証機能実装（GitHub OAuth）← セキュアな状態にする

**完了条件**: GitHub OAuth でログインでき、未認証時はリダイレクトされる

#### サブタスク

- [ ] 1.8.1 Remix Auth セットアップ
  - `remix-auth`, `remix-auth-github` インストール
  - OAuth設定（GitHub App作成）
  - 完了: ログインフローが動作する

- [ ] 1.8.2 セッション管理実装
  - Cookie-based sessions
  - セッションストレージ（Redis使用）
  - 完了: ログイン状態が維持される

- [ ] 1.8.3 認証ルート作成
  - `/auth/github` - GitHub OAuthリダイレクト
  - `/auth/github/callback` - OAuth コールバック
  - `/auth/logout` - ログアウト
  - 完了: ログイン・ログアウトが動作する

- [ ] 1.8.4 認証ミドルウェア追加
  - 全ルートで認証チェック
  - 未認証時は `/auth/github` へリダイレクト
  - 完了: 未ログイン時はダッシュボードにアクセスできない

- [ ] 1.8.5 ナビゲーションにユーザー情報表示
  - ログインユーザー名とアバター表示
  - ログアウトボタン追加
  - 完了: ユーザー情報が表示される

**見積もり**: 2日

---

### Task 1.9: 静的ページ作成（利用規約、プライバシーポリシー、問い合わせ）← 最後でOK

**完了条件**: 各ページが表示され、ナビゲーションからアクセスできる

#### サブタスク

- [ ] 1.9.1 利用規約ページ作成 (`app/routes/terms.tsx`)
  - 基本的な利用規約テキスト（テンプレート使用）
  - 完了: `http://localhost/terms` で利用規約が表示される

- [ ] 1.9.2 プライバシーポリシーページ作成 (`app/routes/privacy.tsx`)
  - データ収集・利用・保護に関する記載
  - 完了: `http://localhost/privacy` でポリシーが表示される

- [ ] 1.9.3 問い合わせページ作成 (`app/routes/contact.tsx`)
  - フォーム: 名前、メール、内容（Phase 1では送信機能なし、UIのみ）
  - 完了: `http://localhost/contact` でフォームが表示される

- [ ] 1.9.4 フッター追加（全ページ共通）
  - リンク: "Terms", "Privacy", "Contact"
  - 完了: フッターが全ページに表示される

**見積もり**: 1日

---

### Task 1.10: Phase 1 統合テスト

**完了条件**: すべての機能が正常動作し、デプロイ可能な状態

#### サブタスク

- [ ] 1.10.1 E2Eテスト実行
  - 認証フローの確認
  - ダッシュボードの表示確認
  - プラグイン管理の確認
  - 静的ページのリンク確認
  - 完了: すべてのテストがパス

- [ ] 1.10.2 パフォーマンステスト
  - ページ読み込み時間測定（< 2秒）
  - プラグインロード時間測定（< 500ms）
  - 完了: パフォーマンス基準をクリア

- [ ] 1.10.3 Docker環境でのビルド・起動確認
  - `docker-compose down && docker-compose up --build -d`
  - すべてのサービスが正常起動
  - 完了: クリーンビルドで問題なく動作

- [ ] 1.10.4 README更新
  - セットアップ手順、起動方法、開発コマンド
  - GitHub OAuth設定手順
  - プラグイン開発ガイド
  - 完了: 第三者が README を見て環境構築できる

**見積もり**: 1日

---

## Phase 2: Developerプラグイン（一覧・詳細・CRUD）

**目標**: Developerプラグインとして、Developer・Activity の閲覧・登録・編集・削除が可能になる

### Task 2.1: Developerプラグイン基盤作成

**完了条件**: Developerプラグインがロードされ、ナビゲーションに表示される

#### サブタスク

- [ ] 2.1.1 プラグインディレクトリ作成 (`app/plugins/developers/`)
  - `index.ts` - プラグイン定義
  - `plugin.json` - メタデータ
  - 完了: ディレクトリ構造が作成される

- [ ] 2.1.2 プラグインスキーマ定義
  - `schema/developers.ts` (id, tenant_id, display_name, primary_email, org_id, consent_analytics, metadata, created_at, updated_at)
  - `schema/activities.ts` (id, tenant_id, developer_id, type, source, metadata, ts)
  - `schema/organizations.ts` (id, tenant_id, name, domain, metadata, created_at, updated_at)
  - 完了: スキーマファイルが TypeScript エラーなく保存される

- [ ] 2.1.3 プラグイン定義 (`index.ts`)
  ```typescript
  export default definePlugin({
    id: "developers",
    name: "Developers",
    slug: "developers",
    description: "Developer relationship management",
    navigation: {
      label: "Developers",
      path: "/developers",
      order: 1,
    },
    dashboardWidgets: [
      {
        id: "developer-stats",
        title: "Developer Statistics",
        component: DeveloperStatsWidget,
      },
    ],
    schema: { developers, activities, organizations },
  });
  ```
  - 完了: プラグイン定義が保存される

- [ ] 2.1.4 マイグレーション実行
  - プラグインスキーマをDBに反映
  - 完了: PostgreSQL に3テーブルが作成される

- [ ] 2.1.5 Seed data 投入
  - Organization 3件、Developer 10件、Activity 50件
  - 完了: `pnpm db:seed` でデータが投入される

- [ ] 2.1.6 動作確認
  - ナビゲーションに "Developers" リンクが表示される
  - 完了: プラグインがロードされる

**見積もり**: 1日

---

### Task 2.2: ダッシュボードウィジェット実装

**完了条件**: ダッシュボードにDeveloper統計ウィジェットが表示される

#### サブタスク

- [ ] 2.2.1 ウィジェットコンポーネント作成 (`app/plugins/developers/widgets/DeveloperStatsWidget.tsx`)
  - 総Developer数、総Activity数を表示
  - カード形式のUI
  - 完了: ウィジェットが表示される

- [ ] 2.2.2 動作確認
  - ダッシュボードにウィジェットが表示される
  - Seed dataの件数が正しく表示される
  - 完了: "Total Developers: 10", "Total Activities: 50" が表示される

**見積もり**: 0.5日

---

### Task 2.3: Developer一覧画面（プラグイン）

**完了条件**: `http://localhost/developers` でDeveloper一覧がテーブル表示される

#### サブタスク

- [ ] 2.3.1 Remix ルート作成 (`app/plugins/developers/routes/index.tsx`)
  - Loader: Developerリスト取得（organization情報も含む）
  - 完了: loader が TypeScript エラーなく保存される

- [ ] 2.3.2 テーブルUI実装
  - カラム: 名前、メール、所属組織、最終活動日
  - shadcn/ui Table コンポーネント使用
  - 完了: 10件のDeveloperがテーブルに表示される

- [ ] 2.3.3 検索機能追加
  - 検索フォーム追加
  - Loader: クエリパラメータで検索処理
  - 完了: 検索ワード入力でテーブルが絞り込まれる

- [ ] 2.3.4 ページネーション追加
  - 1ページ10件表示
  - shadcn/ui Pagination コンポーネント使用
  - 完了: ページネーションが動作する

**見積もり**: 1.5日

---

### Task 2.4: Developer詳細画面（プラグイン）

**完了条件**: `http://localhost/developers/:id` でDeveloper詳細とActivity一覧が表示される

#### サブタスク

- [ ] 2.4.1 Remix ルート作成 (`app/plugins/developers/routes/$id.tsx`)
  - Loader: Developer情報、関連Activity一覧取得
  - 完了: 詳細ページが表示される

- [ ] 2.4.2 UI実装
  - Developer基本情報表示
  - Activity タイムライン表示（時系列）
  - 完了: 情報とタイムラインが表示される

- [ ] 2.4.3 編集ボタン追加
  - "Edit" ボタン → 編集画面へ遷移
  - 完了: ボタンが動作する

**見積もり**: 1日

---

### Task 2.2: Developer登録・編集フォーム

**完了条件**: Developer の登録・編集が可能になる

#### サブタスク

- [ ] 2.2.1 登録フォーム作成 (`app/routes/developers.new.tsx`)
  - フォーム: 名前、メール、所属組織、consent_analytics
  - Zod バリデーション
  - Action: Drizzle で INSERT
  - 完了: フォーム送信でDeveloperが登録される

- [ ] 2.2.2 編集フォーム作成 (`app/routes/developers.$id.edit.tsx`)
  - 既存データをフォームに表示
  - Action: Drizzle で UPDATE
  - 完了: フォーム送信でDeveloperが更新される

- [ ] 2.2.3 削除機能追加
  - 削除ボタン + 確認ダイアログ
  - Action: Drizzle で DELETE
  - 完了: 削除ボタンでDeveloperが削除される

**見積もり**: 1.5日

---

### Task 2.3: Activity登録フォーム

**完了条件**: Activityを手動登録できる

#### サブタスク

- [ ] 2.3.1 登録フォーム作成 (`app/routes/activities.new.tsx`)
  - フォーム: Developer選択、type (event/post/github_pr/inquiry)、source、メタデータ
  - Zod バリデーション
  - Action: Drizzle で INSERT
  - 完了: フォーム送信でActivityが登録される

- [ ] 2.3.2 Developer詳細画面から登録
  - "Add Activity" ボタン → 登録フォームへ遷移（developer_id をプリセット）
  - 完了: Developer詳細画面から直接Activity登録できる

**見積もり**: 1日

---

### Task 2.4: Activity一覧画面

**完了条件**: `http://localhost/activities` でActivity一覧が表示される

#### サブタスク

- [ ] 2.4.1 Remix ルート作成 (`app/routes/activities._index.tsx`)
  - Loader: Activity一覧取得（Developer情報も含む）
  - 完了: 一覧ページが表示される

- [ ] 2.4.2 テーブルUI実装
  - カラム: Developer名、type、source、日時
  - フィルター: type別絞り込み
  - 完了: 一覧とフィルターが動作する

**見積もり**: 1日

---

### Task 2.5: CSV一括アップロード機能

**完了条件**: CSVファイルをアップロードしてDeveloper・Activityを一括登録できる

#### サブタスク

- [ ] 2.5.1 CSVアップロードフォーム作成 (`app/routes/import.tsx`)
  - ファイル選択、アップロードボタン
  - 完了: フォームが表示される

- [ ] 2.5.2 CSVパース処理実装
  - `papaparse` ライブラリ使用
  - カラムマッピング（name → display_name など）
  - 完了: CSVがパースされ、データが抽出される

- [ ] 2.5.3 バルクINSERT実装
  - Drizzle の `insert().values()` で一括登録
  - 重複チェック（メールアドレスで判定）
  - 完了: CSVデータがデータベースに登録される

- [ ] 2.5.4 動作確認
  - サンプルCSVで登録テスト
  - 完了: 一括登録が成功する

**見積もり**: 1.5日

---

## Phase 3: 分析機能（Funnel/ROI表示）

**目標**: ファネル分析とROI可視化が可能になる

### Task 3.1: Funnel View実装

**完了条件**: `http://localhost/funnel` でファネル段階別人数が可視化される

#### サブタスク

- [ ] 3.1.1 Funnel Stage テーブル追加
  - `db/schema/funnel_stages.ts` (developer_id, stage, updated_at)
  - マイグレーション実行
  - 完了: テーブルが作成される

- [ ] 3.1.2 Funnel Stage 自動更新ロジック実装
  - Activityから推定（event → Awareness, github_pr → Adoption など）
  - Remix Action で更新処理
  - 完了: Activityに応じてFunnel Stageが更新される

- [ ] 3.1.3 Funnel View UI実装 (`app/routes/funnel.tsx`)
  - Loader: 各Stage人数集計
  - UI: Recharts/Tremor でファネルグラフ表示
  - 完了: ファネルが可視化される

**見積もり**: 2日

---

### Task 3.2: ROI View実装

**完了条件**: `http://localhost/roi` で施策別ROIが表示される

#### サブタスク

- [ ] 3.2.1 Budget/Campaign テーブル追加
  - `db/schema/budgets.ts` (campaign_id, category, amount, date)
  - `db/schema/campaigns.ts` (id, name, type, start_date, end_date, metadata)
  - マイグレーション実行
  - 完了: テーブルが作成される

- [ ] 3.2.2 Campaign登録フォーム作成 (`app/routes/campaigns.new.tsx`)
  - フォーム: 施策名、type、予算、開始日、終了日
  - 完了: Campaignが登録される

- [ ] 3.2.3 ROI計算ロジック実装
  - `services/roi.ts` で ROI = (効果値 - 投資額) / 投資額
  - 効果値 = Activity数 × 重み付け
  - 完了: ROI計算関数が動作する

- [ ] 3.2.4 ROI View UI実装 (`app/routes/roi.tsx`)
  - Loader: Campaign別ROI計算結果取得
  - UI: 棒グラフでROI表示
  - 完了: ROIが可視化される

**見積もり**: 2日

---

## Phase 4: プラグインシステム基盤 + Worker

**目標**: プラグインのインストール・有効化・実行が可能になる、Workerでバックグラウンド処理が実行できる

### Task 4.1: BullMQ + Worker セットアップ

**完了条件**: Workerコンテナが起動し、ジョブキューが動作する

#### サブタスク

- [ ] 4.1.1 BullMQ インストール
  - `bullmq`, `ioredis` パッケージ追加
  - 完了: `package.json` に依存関係が追加される

- [ ] 4.1.2 Queue初期化 (`workers/queue.ts`)
  - Redis接続設定
  - `pluginQueue` 定義
  - 完了: ファイルが TypeScript エラーなく保存される

- [ ] 4.1.3 Worker実装 (`workers/index.ts`)
  - ジョブ処理ロジック（Phase 4ではログ出力のみ）
  - 完了: Worker起動時にエラーが出ない

- [ ] 4.1.4 docker-compose設定更新
  - `worker` サービスに `command: pnpm worker:start` 追加
  - 完了: `docker-compose up worker` でWorkerが起動

- [ ] 4.1.5 動作確認
  - テストジョブをキューに追加
  - Workerがジョブを処理することを確認
  - 完了: ログに処理完了メッセージが出力される

**見積もり**: 1日

---

### Task 4.2: プラグインローダー実装

**完了条件**: プラグインが動的にロードされ、フックが実行される

#### サブタスク

- [ ] 4.2.1 Plugin テーブル追加
  - `db/schema/plugins.ts` (id, name, version, enabled, settings)
  - マイグレーション実行
  - 完了: テーブルが作成される

- [ ] 4.2.2 プラグインローダー実装 (`core/plugin-loader.ts`)
  - プラグインディレクトリスキャン
  - `definePlugin` 関数定義
  - フック登録機構
  - 完了: プラグインがロードされる

- [ ] 4.2.3 Audit Log プラグイン実装
  - `plugins/audit-log/index.ts`
  - Action Hook で各操作を記録
  - 完了: Audit Logが記録される

**見積もり**: 2日

---

### Task 4.3: PostHog連携プラグイン実装

**完了条件**: PostHogからイベントデータを取得し、Activityとして登録される

#### サブタスク

- [ ] 4.3.1 PostHog Capture API連携
  - `posthog/api.ts` で Capture API クライアント実装
  - distinct_id = click_id でイベント送信
  - 完了: PostHogにイベントが送信される

- [ ] 4.3.2 PostHog → DRM ETL実装
  - Workerでイベントを定期取得
  - Activityに変換して登録
  - 完了: PostHogイベントがActivityとして同期される

**見積もり**: 2日

---

## Phase 5: SaaS化準備（テナント分離）

**目標**: マルチテナント対応が完了し、データが完全に分離される

### Task 5.1: テナント分離実装

**完了条件**: 各テナントのデータが完全に分離される

#### サブタスク

- [ ] 5.1.1 Tenant テーブル追加
  - `db/schema/tenants.ts` (id, name, subdomain, plan)
  - 完了: テーブルが作成される

- [ ] 5.1.2 RLS (Row Level Security) 設定
  - PostgreSQL で tenant_id ベースの RLS ポリシー設定
  - 完了: 他テナントのデータが取得できない

- [ ] 5.1.3 全テーブルに tenant_id 追加確認
  - マイグレーション実行
  - 全クエリに tenant_id フィルター追加
  - 完了: マルチテナント対応完了

**見積もり**: 2日

---

## 📊 開発スケジュール概算

| フェーズ | タスク数 | 見積もり合計 |
|---------|---------|------------|
| Phase 1 | 10タスク | 11日 |
| Phase 2 | 5タスク | 5.5日 |
| Phase 3 | 2タスク | 4日 |
| Phase 4 | 3タスク | 5日 |
| Phase 5 | 1タスク | 2日 |
| **合計** | **21タスク** | **27.5日（約5.5週間）** |

---

## ✅ チェックリスト（Phase 1最優先）

### Phase 1: docker-compose + プラグイン基盤 + 認証

- [x] Task 1.1: docker-compose環境の構築 ✅
- [ ] Task 1.2: Drizzle ORM セットアップ + マイグレーション（コア機能のみ）
- [ ] Task 1.3: プラグインローダー実装 ← **プラグインシステムを先に作る！**
- [ ] Task 1.4: 動的ナビゲーション実装
- [ ] Task 1.5: ダッシュボードUI（プラグインウィジェット対応）
- [ ] Task 1.6: プラグイン管理画面
- [ ] Task 1.7: システム設定画面
- [ ] Task 1.8: 認証機能実装（GitHub OAuth）
- [ ] Task 1.9: 静的ページ作成（利用規約、プライバシーポリシー、問い合わせ）
- [ ] Task 1.10: Phase 1 統合テスト

---

## 🚀 次のステップ

Phase 1のタスクを順次実装していきます。各タスク完了後にデプロイ可能な状態を維持します。

**実装順序の理念**:
1. **Task 1.1** ✅ - docker-compose環境の構築（完了）
2. **Task 1.2** - Drizzle ORM セットアップ（プラグイン用テーブルのみ）
3. **Task 1.3** - プラグインローダー実装（**プラグインシステムを先に！**）
4. **Task 1.4** - 動的ナビゲーション実装（プラグインから自動生成）
5. **Task 1.5** - ダッシュボードUI（プラグインウィジェット表示）
6. **Task 1.6** - プラグイン管理画面（有効化・無効化）
7. **Task 1.7** - システム設定画面
8. **Task 1.8** - 認証機能実装（**セキュアな状態にする**）
9. **Task 1.9** - 静的ページ作成（最後でOK）
10. **Task 1.10** - Phase 1 統合テスト

**重要**: Phase 2以降でDeveloperプラグインを作成し、Developer機能を実装します。

**次に取り組むべきタスク**: Task 1.2 - Drizzle ORM セットアップ + マイグレーション
