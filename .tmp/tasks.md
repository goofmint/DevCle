# タスクリスト

## タスク一覧

### Phase 1: 基盤構築とPoC準備（1-2週間）

#### Task 1.1: Monorepo環境セットアップ

- [x] pnpm workspace設定（packages/core, packages/posthog, packages/plugins）
- [x] TypeScript 5.9+設定（strict mode + exactOptionalPropertyTypes）
- [x] ESLint 9 flat config設定
- [x] Prettier設定
- [x] package.jsonスクリプト設定（dev, build, test, lint, format, typecheck）
- **完了条件**: `pnpm install`が成功し、`pnpm typecheck`が通る
- **依存**: なし
- **推定時間**: 2-3時間

#### Task 1.2: Docker Compose環境構築

- [ ] `docker/compose.development.yml`作成（PostgreSQL + Redis）
- [ ] `docker/compose.production.yml`作成（アプリのみ）
- [ ] `docker/compose.test.yml`作成（テスト環境）
- [ ] Dockerfile作成
- [ ] Caddyfile作成（リバースプロキシ）
- [ ] .gitignore設定
- **完了条件**: `docker compose -f docker/compose.development.yml up`でPostgreSQL + Redisが起動
- **依存**: Task 1.1
- **推定時間**: 2-3時間

#### Task 1.3: データベーススキーマ設計（初期版）

- [ ] Drizzle ORMセットアップ
- [ ] developers, organizations, identifiers, activitiesテーブル定義
- [ ] tenant_idカラム追加（全テーブル）
- [ ] マイグレーションファイル生成
- [ ] シードデータ作成（開発用）
- **完了条件**: マイグレーション実行でテーブルが作成される
- **依存**: Task 1.2
- **推定時間**: 3-4時間

#### Task 1.4: Remix UIプロジェクト初期化

- [ ] Remix 2.xプロジェクト作成
- [ ] Tailwind CSS 4.x設定
- [ ] shadcn/uiセットアップ
- [ ] 基本レイアウト作成（ヘッダー、ナビゲーション、フッター）
- [ ] ルート構成設計（/dashboard, /developers, /organizations, /activities）
- **完了条件**: `pnpm dev`でRemixアプリが起動し、基本レイアウトが表示される
- **依存**: Task 1.1
- **推定時間**: 3-4時間

### Phase 2: UI先行実装（PoCフロント構築）（2-3週間）

#### Task 2.1: ランディングページ（LP）実装

- [ ] `/`ルート作成（未認証ユーザー向け）
- [ ] Hero Section実装（見出し、説明、CTAボタン）
- [ ] Features Section実装（ファネル分析、開発者プロフィール、プラグインシステム）
- [ ] CTA Section実装
- [ ] レスポンシブ対応（モバイル、タブレット、デスクトップ）
- [ ] SEO対応（meta tags, OGP）
- **完了条件**: `/`でLPが表示され、CTAボタンで`/login`に遷移
- **依存**: Task 1.4
- **推定時間**: 4-5時間
- **テスト**: E2Eテスト（Playwright）でLP表示・CTA遷移確認

#### Task 2.2: プライバシーポリシー・利用規約ページ実装

- [ ] `/privacy`ルート作成
- [ ] `/terms`ルート作成
- [ ] Markdownファイル作成（/legal/privacy-en.md, privacy-ja.md, terms-en.md, terms-ja.md）
- [ ] markedライブラリでMarkdown→HTML変換
- [ ] フッターに全ページ共通リンク追加
- [ ] 多言語対応（ロケールに応じてファイル切り替え）
- **完了条件**: `/privacy`と`/terms`でポリシー・規約が表示される
- **依存**: Task 1.4
- **推定時間**: 3-4時間
- **テスト**: E2Eテスト（Playwright）でページ表示・多言語切り替え確認

#### Task 2.3: i18n（国際化）セットアップ

- [ ] remix-i18next設定
- [ ] 翻訳ファイル作成（en/common.json, ja/common.json, en/landing.json, ja/landing.json）
- [ ] root.tsxでロケール検出・適用
- [ ] 言語切り替えコンポーネント作成
- [ ] LP・法的ページで翻訳キー適用
- **完了条件**: 言語切り替えが動作し、LP・法的ページが多言語対応される
- **依存**: Task 2.1, 2.2
- **推定時間**: 3-4時間
- **テスト**: 手動テストで言語切り替え確認

#### Task 2.4: 認証画面実装（ログイン・サインアップ）

- [ ] `/login`ルート作成
- [ ] `/signup`ルート作成
- [ ] ログインフォーム実装（email, password）
- [ ] サインアップフォーム実装（email, password, 利用規約同意チェックボックス）
- [ ] バリデーション UI実装（Zod）
- [ ] 認証API呼び出し（スタブ実装）
- [ ] セッション管理（Cookie）スタブ実装
- **完了条件**: ログイン・サインアップフォームが動作し、`/dashboard`に遷移
- **依存**: Task 2.3
- **推定時間**: 4-5時間
- **テスト**: E2Eテスト（Playwright）でフォーム入力・遷移確認

#### Task 2.5: ダッシュボード画面（モックデータ）

- [ ] `/dashboard`ルート作成（認証後）
- [ ] ファネルチャート表示（Recharts + モックデータ）
- [ ] サマリーカード表示（開発者数、組織数、アクティビティ数）
- [ ] 期間フィルター UI作成
- [ ] レスポンシブ対応
- **完了条件**: モックデータでダッシュボードが表示される
- **依存**: Task 2.4
- **推定時間**: 4-6時間
- **テスト**: E2Eテスト（Playwright）でページ表示確認

#### Task 2.6: 開発者一覧画面（モックデータ）

- [ ] `/developers`ルート作成
- [ ] 開発者一覧テーブル表示（shadcn/ui Table）
- [ ] ページネーション UI実装
- [ ] 検索フィルター UI実装
- [ ] ソート機能 UI実装
- **完了条件**: モックデータで開発者一覧が表示される
- **依存**: Task 2.4
- **推定時間**: 3-4時間
- **テスト**: E2Eテスト（Playwright）で一覧表示・検索・ソート確認

#### Task 2.7: 開発者詳細画面（モックデータ）

- [ ] `/developers/:id`ルート作成
- [ ] 開発者プロフィール表示
- [ ] 識別子リスト表示
- [ ] アクティビティ履歴表示（タイムライン）
- [ ] 編集ボタン・削除ボタン（モーダル）
- **完了条件**: モックデータで開発者詳細が表示される
- **依存**: Task 2.6
- **推定時間**: 3-4時間
- **テスト**: E2Eテスト（Playwright）で詳細表示確認

#### Task 2.8: アクティビティ登録フォーム（モックデータ）

- [ ] `/dashboard/activities/new`ルート作成
- [ ] フォーム作成（type, source, timestamp, metadata, identifiers）
- [ ] バリデーション UI実装（Zod + React Hook Form）
- [ ] プレビュー機能
- [ ] 送信ボタン（モック動作）
- **完了条件**: フォームでデータ入力し、バリデーションが動作する
- **依存**: Task 2.4
- **推定時間**: 3-4時間
- **テスト**: E2Eテスト（Playwright）でフォーム入力・バリデーション確認

### Phase 3: API層実装（バックエンド接続）（2-3週間）

#### Task 3.1: Hono APIサーバーセットアップ

- [ ] Honoプロジェクト作成（packages/core/api）
- [ ] ミドルウェア設定（CORS, Logger, Error Handler）
- [ ] ルーター構成設計
- [ ] 認証ミドルウェア（JWT）スタブ実装
- [ ] Context型定義（tenantId, userId, plugins）
- [ ] OpenAPI 3.0スキーマファイル作成（openapi.yaml）
- [ ] Swagger UIセットアップ（@hono/swagger-ui）
- **完了条件**: `pnpm dev`でAPIサーバーが起動し、/healthエンドポイントが応答、/api-docsでSwagger UI表示
- **依存**: Task 1.3
- **推定時間**: 4-5時間
- **テスト**: 統合テスト（Vitest + Supertest）で/health確認

#### Task 3.2: Developers API実装（基本CRUD）

- [ ] DeveloperRepository実装（Drizzle ORM）
- [ ] GET /v1/developers実装（一覧取得、ページネーション）
- [ ] GET /v1/developers/:id実装（詳細取得）
- [ ] POST /v1/developers実装（作成）
- [ ] PATCH /v1/developers/:id実装（更新）
- [ ] DELETE /v1/developers/:id実装（ソフトデリート）
- [ ] Zodスキーマバリデーション
- [ ] OpenAPIスキーマに各エンドポイント追加（paths, schemas）
- **完了条件**: 全エンドポイントが動作し、DBに読み書きできる、Swagger UIで確認可能
- **依存**: Task 3.1
- **推定時間**: 6-7時間
- **テスト**: 統合テスト（Vitest + Supertest + Docker PostgreSQL）で全CRUD確認

#### Task 3.3: Organizations API実装（基本CRUD）

- [ ] OrganizationRepository実装（Drizzle ORM）
- [ ] GET /v1/organizations実装（一覧取得）
- [ ] GET /v1/organizations/:id実装（詳細取得）
- [ ] POST /v1/organizations実装（作成）
- [ ] PATCH /v1/organizations/:id実装（更新）
- [ ] DELETE /v1/organizations/:id実装（ソフトデリート）
- [ ] Zodスキーマバリデーション
- [ ] OpenAPIスキーマに各エンドポイント追加
- **完了条件**: 全エンドポイントが動作し、DBに読み書きできる、Swagger UIで確認可能
- **依存**: Task 3.1
- **推定時間**: 5-6時間
- **テスト**: 統合テスト（Vitest + Supertest + Docker PostgreSQL）で全CRUD確認

#### Task 3.4: Activities API実装（基本CRUD）

- [ ] ActivityRepository実装（Drizzle ORM）
- [ ] GET /v1/activities実装（一覧取得、フィルター）
- [ ] GET /v1/activities/:id実装（詳細取得）
- [ ] POST /v1/activities実装（単一登録）
- [ ] POST /v1/activities/batch実装（バッチ登録）
- [ ] Zodスキーマバリデーション
- [ ] OpenAPIスキーマに各エンドポイント追加
- **完了条件**: 全エンドポイントが動作し、DBに読み書きできる、Swagger UIで確認可能
- **依存**: Task 3.1
- **推定時間**: 6-7時間
- **テスト**: 統合テスト（Vitest + Supertest + Docker PostgreSQL）で全CRUD確認

#### Task 3.5: RemixとAPIの接続（実データ表示）

- [ ] Remix loader/actionでAPI呼び出し実装
- [ ] ダッシュボード画面を実データで表示
- [ ] 開発者一覧画面を実データで表示
- [ ] 開発者詳細画面を実データで表示
- [ ] アクティビティ登録フォームを実データで動作
- [ ] エラーハンドリング実装
- **完了条件**: 全画面が実データで動作する
- **依存**: Task 3.2, 3.3, 3.4, Task 2.5, 2.6, 2.7, 2.8
- **推定時間**: 6-8時間
- **テスト**: E2Eテスト（Playwright + Docker環境）で実データ表示確認

### Phase 4: コアサービス層実装（3-4週間）

#### Task 4.1: ID Resolver Service実装

- [ ] IDResolverService実装（email, domain, handle解決）
- [ ] resolve()メソッド実装（ルールベースマッチング）
- [ ] merge()メソッド実装（開発者統合）
- [ ] split()メソッド実装（開発者分割）
- [ ] 信頼度スコアリング実装
- [ ] 監査ログ記録
- **完了条件**: ID解決が正確に動作し、テストが通る
- **依存**: Task 3.2
- **推定時間**: 6-8時間
- **テスト**: 単体テスト（Vitest + Docker PostgreSQL）で各シナリオ確認

#### Task 4.2: Activity Manager Service実装

- [ ] ActivityManager実装
- [ ] ingest()メソッド実装（ID Resolver呼び出し）
- [ ] batch()メソッド実装（バッチ処理）
- [ ] classify()メソッド実装（ファネルステージ判定）
- [ ] enrichment pipeline実装
- [ ] PostHog連携（Capture API呼び出し）
- **完了条件**: アクティビティ登録が正確に動作し、PostHogにイベント送信される
- **依存**: Task 4.1
- **推定時間**: 8-10時間
- **テスト**: 統合テスト（Vitest + Docker PostgreSQL + PostHog）で全フロー確認

#### Task 4.3: Funnel Engine実装

- [ ] FunnelEngine実装
- [ ] calculate()メソッド実装（SQL集計クエリ）
- [ ] getStageActivities()メソッド実装
- [ ] compareAnonymous()メソッド実装（PostHog Insights統合）
- [ ] Redisキャッシュ実装（5分TTL）
- [ ] Window functions活用
- **完了条件**: ファネル集計が正確に動作し、キャッシュが効く
- **依存**: Task 4.2
- **推定時間**: 8-10時間
- **テスト**: 統合テスト（Vitest + Docker PostgreSQL + Redis）でファネル計算確認

#### Task 4.4: Funnel API実装

- [ ] GET /v1/funnel実装（FunnelEngine呼び出し）
- [ ] GET /v1/funnel/compare実装（PostHog比較）
- [ ] GET /v1/funnel/stages/:stage実装
- [ ] クエリパラメータバリデーション
- [ ] キャッシュ戦略適用
- **完了条件**: Funnel APIが動作し、ダッシュボードで実データ表示
- **依存**: Task 4.3
- **推定時間**: 4-5時間
- **テスト**: 統合テスト（Vitest + Supertest）でAPI確認

#### Task 4.5: PostHog Client実装

- [ ] PostHogClient実装
- [ ] capture()メソッド実装（Capture API）
- [ ] getInsight()メソッド実装（Insights API）
- [ ] getPersons()メソッド実装（Persons API）
- [ ] mergeFunnels()メソッド実装
- [ ] レート制限対応（exponential backoff）
- **完了条件**: PostHog連携が動作し、匿名データが取得できる
- **依存**: Task 1.2
- **推定時間**: 5-6時間
- **テスト**: 統合テスト（Vitest + PostHog セルフホスト版）で全API確認

### Phase 5: ファイルインポート機能（1週間）

#### Task 5.1: File Parser実装

- [ ] CSVパーサー実装（papaparse）
- [ ] JSONパーサー実装（Zodバリデーション）
- [ ] エラー行記録機能
- [ ] ファイルサイズ制限チェック
- [ ] フォーマット検証
- **完了条件**: CSV/JSONファイルを解析し、エラー行を記録できる
- **依存**: なし
- **推定時間**: 3-4時間
- **テスト**: 単体テスト（Vitest）で各フォーマット確認

#### Task 5.2: Activity Import API実装

- [ ] POST /v1/activities/import実装
- [ ] multipart/form-dataハンドリング
- [ ] File Parser呼び出し
- [ ] ActivityManager.batch()呼び出し
- [ ] インポート結果レスポンス
- **完了条件**: CSV/JSONファイルアップロードでアクティビティが一括登録される
- **依存**: Task 5.1, Task 4.2
- **推定時間**: 4-5時間
- **テスト**: 統合テスト（Vitest + Supertest）でファイルアップロード確認

#### Task 5.3: Activity Import UI実装

- [ ] `/dashboard/activities/import`ルート作成
- [ ] ファイルアップロードフォーム実装
- [ ] ドラッグ&ドロップ対応
- [ ] インポート進捗表示
- [ ] エラー表示（行番号付き）
- [ ] 成功/失敗サマリー表示
- **完了条件**: UIからCSV/JSONファイルをアップロードし、結果が表示される
- **依存**: Task 5.2
- **推定時間**: 4-5時間
- **テスト**: E2Eテスト（Playwright）でファイルアップロード・結果表示確認

### Phase 6: メール配信機能（2-3週間）

#### Task 6.1: Email Service実装

- [ ] EmailService実装（Resend SDK）
- [ ] send()メソッド実装
- [ ] sendBatch()メソッド実装
- [ ] verifyDomain()メソッド実装
- [ ] バウンス処理Webhook実装
- [ ] リトライ戦略実装
- **完了条件**: Resend経由でメール送信できる
- **依存**: なし
- **推定時間**: 4-5時間
- **テスト**: 統合テスト（Vitest + Resend Test Mode）でメール送信確認

#### Task 6.2: URL Shortener Service実装

- [ ] URLShortenerService実装
- [ ] shorten()メソッド実装（nanoid生成）
- [ ] redirect()メソッド実装（302リダイレクト + クリック記録）
- [ ] generateQRCode()メソッド実装（qrcodeライブラリ）
- [ ] getClickStats()メソッド実装（GeoIP統合）
- [ ] Redisキャッシュ実装
- **完了条件**: 短縮URL生成・リダイレクト・QRコード生成が動作する
- **依存**: Task 1.2
- **推定時間**: 6-8時間
- **テスト**: 統合テスト（Vitest + Docker PostgreSQL + Redis）で全フロー確認

#### Task 6.3: Email Campaign Manager実装

- [ ] EmailCampaignManager実装
- [ ] createTemplate()メソッド実装
- [ ] createCampaign()メソッド実装
- [ ] previewEmail()メソッド実装（変数置換）
- [ ] sendCampaign()メソッド実装（BullMQジョブ化）
- [ ] URL自動短縮実装
- [ ] 購読解除トークン生成実装（HMAC-SHA256）
- **完了条件**: メールキャンペーン作成・送信が動作する
- **依存**: Task 6.1, Task 6.2
- **推定時間**: 8-10時間
- **テスト**: 統合テスト（Vitest + Docker環境）で全フロー確認

#### Task 6.4: Email Campaign API実装

- [ ] GET /v1/email/templates実装
- [ ] POST /v1/email/templates実装
- [ ] GET /v1/email/campaigns実装
- [ ] POST /v1/email/campaigns実装
- [ ] POST /v1/email/campaigns/:id/send実装
- [ ] GET /v1/email/campaigns/:id/stats実装
- [ ] GET /v1/email/unsubscribe/:token実装
- **完了条件**: 全エンドポイントが動作する
- **依存**: Task 6.3
- **推定時間**: 6-8時間
- **テスト**: 統合テスト（Vitest + Supertest）で全API確認

#### Task 6.5: Email Campaign UI実装

- [ ] `/dashboard/campaigns`ルート作成（一覧）
- [ ] `/dashboard/campaigns/new`ルート作成（作成フォーム）
- [ ] テンプレートエディタ実装（変数サポート）
- [ ] 受信者フィルター UI実装
- [ ] プレビュー機能実装
- [ ] 送信確認モーダル実装
- [ ] 統計ダッシュボード実装
- **完了条件**: UIからメールキャンペーンを作成・送信できる
- **依存**: Task 6.4
- **推定時間**: 8-10時間
- **テスト**: E2Eテスト（Playwright）でキャンペーン作成・送信確認

#### Task 6.6: URL Shortener API実装

- [ ] POST /v1/links実装
- [ ] GET /v1/links実装
- [ ] GET /v1/links/:shortCode/stats実装
- [ ] GET /v1/links/:shortCode/qr実装
- [ ] GET /:shortCode実装（リダイレクト）
- **完了条件**: 全エンドポイントが動作する
- **依存**: Task 6.2
- **推定時間**: 4-5時間
- **テスト**: 統合テスト（Vitest + Supertest）で全API確認

#### Task 6.7: URL Shortener UI実装

- [ ] `/dashboard/links`ルート作成（一覧）
- [ ] `/dashboard/links/new`ルート作成（作成フォーム）
- [ ] QRコードダウンロードボタン実装
- [ ] クリック統計表示（チャート）
- [ ] カスタムコード入力フォーム実装
- **完了条件**: UIから短縮URL作成・統計確認できる
- **依存**: Task 6.6
- **推定時間**: 5-6時間
- **テスト**: E2Eテスト（Playwright）でURL作成・統計表示確認

### Phase 7: プラグインシステム（2-3週間）

#### Task 7.1: Plugin Loader実装

- [ ] PluginLoader実装
- [ ] discover()メソッド実装（node_modules/@devcle/plugin-*スキャン）
- [ ] validate()メソッド実装（署名検証、バージョンチェック）
- [ ] load()メソッド実装（VM2サンドボックス）
- [ ] unload()メソッド実装
- [ ] DBと連携（enabled_plugins）
- **完了条件**: プラグインを検出・ロードできる
- **依存**: Task 1.3
- **推定時間**: 6-8時間
- **テスト**: 単体テスト（Vitest）でプラグインロード確認

#### Task 7.2: Hook Manager実装

- [ ] HookManager実装
- [ ] on()メソッド実装（イベント登録）
- [ ] emit()メソッド実装（イベント発火）
- [ ] emitActivity()メソッド実装
- [ ] タイムアウト制御実装（30秒）
- [ ] エラーハンドリング実装（プラグイン隔離）
- **完了条件**: プラグインフックが動作する
- **依存**: Task 7.1
- **推定時間**: 5-6時間
- **テスト**: 単体テスト（Vitest）でフック動作確認

#### Task 7.3: Registry実装

- [ ] Registry実装
- [ ] registerAPI()メソッド実装（Honoルーター動的追加）
- [ ] registerJob()メソッド実装（BullMQ登録）
- [ ] registerUI()メソッド実装（Remixコンポーネント登録）
- [ ] getAPI(), getJobs(), getUISlot()実装
- **完了条件**: プラグインがAPI/Job/UIを登録できる
- **依存**: Task 7.2
- **推定時間**: 5-6時間
- **テスト**: 単体テスト（Vitest）で登録・取得確認

#### Task 7.4: Plugin Manager Service実装

- [ ] PluginManager実装
- [ ] list()メソッド実装
- [ ] enable()メソッド実装（DB記録 + hot reload）
- [ ] disable()メソッド実装
- [ ] updateConfig()メソッド実装（暗号化保存）
- [ ] getConfig()メソッド実装
- **完了条件**: プラグイン一覧・有効化・無効化が動作する
- **依存**: Task 7.3
- **推定時間**: 5-6時間
- **テスト**: 統合テスト（Vitest + Docker PostgreSQL）で全操作確認

#### Task 7.5: Plugin Management API実装

- [ ] GET /v1/plugins実装
- [ ] POST /v1/plugins/:id/enable実装
- [ ] POST /v1/plugins/:id/disable実装
- [ ] GET /v1/plugins/:id/config実装
- [ ] PUT /v1/plugins/:id/config実装
- **完了条件**: 全エンドポイントが動作する
- **依存**: Task 7.4
- **推定時間**: 3-4時間
- **テスト**: 統合テスト（Vitest + Supertest）で全API確認

#### Task 7.6: Plugin Management UI実装

- [ ] `/dashboard/plugins`ルート作成
- [ ] プラグイン一覧表示
- [ ] Enable/Disableボタン実装
- [ ] 設定モーダル実装
- [ ] インストールガイド表示
- **完了条件**: UIからプラグイン管理できる
- **依存**: Task 7.5
- **推定時間**: 4-5時間
- **テスト**: E2Eテスト（Playwright）でプラグイン有効化・無効化確認

#### Task 7.7: サンプルプラグイン作成（検証用）

- [ ] @devcle/plugin-sample作成
- [ ] plugin.json定義
- [ ] definePlugin()実装
- [ ] onInit hookでAPI登録
- [ ] onActivity hook実装
- [ ] READMEドキュメント作成
- **完了条件**: サンプルプラグインがロード・動作する
- **依存**: Task 7.6
- **推定時間**: 3-4時間
- **テスト**: 手動テストでプラグイン動作確認

### Phase 8: 認証・認可（1週間）

#### Task 8.1: JWT認証実装

- [ ] JWTペイロード型定義
- [ ] JWT発行実装
- [ ] JWT検証ミドルウェア実装
- [ ] ログイン/ログアウトAPI実装
- [ ] リフレッシュトークン実装
- **完了条件**: JWT認証が動作する
- **依存**: Task 3.1
- **推定時間**: 4-5時間
- **テスト**: 統合テスト（Vitest + Supertest）で認証フロー確認

#### Task 8.2: RBAC（Role-Based Access Control）実装

- [ ] authorize()ミドルウェア実装
- [ ] Role定義（admin, member, viewer）
- [ ] 各エンドポイントに権限設定
- [ ] 権限エラーハンドリング
- **完了条件**: ロール別にアクセス制御が動作する
- **依存**: Task 8.1
- **推定時間**: 3-4時間
- **テスト**: 統合テスト（Vitest + Supertest）で権限確認

#### Task 8.3: ログイン/ログアウトUI実装

- [ ] `/login`ルート作成
- [ ] ログインフォーム実装
- [ ] ログアウトボタン実装
- [ ] セッション管理実装（Cookie）
- [ ] 認証リダイレクト実装
- **完了条件**: UIからログイン・ログアウトできる
- **依存**: Task 8.1
- **推定時間**: 3-4時間
- **テスト**: E2Eテスト（Playwright）でログインフロー確認

### Phase 9: セキュリティ強化（1週間）

#### Task 9.1: PII暗号化実装

- [ ] EncryptionService実装（AES-256-GCM）
- [ ] KMS連携実装（AWS KMS or HashiCorp Vault）
- [ ] developers.primary_email暗号化
- [ ] identifiers.value暗号化
- [ ] 暗号化マイグレーション実行
- **完了条件**: PII暗号化が動作する
- **依存**: Task 1.3
- **推定時間**: 5-6時間
- **テスト**: 統合テスト（Vitest + Docker PostgreSQL）で暗号化・復号化確認

#### Task 9.2: レート制限実装

- [ ] Redis使用レート制限ミドルウェア実装
- [ ] テナント別レート制限実装
- [ ] IP別レート制限実装
- [ ] 429レスポンス実装（Retry-Afterヘッダー）
- **完了条件**: レート制限が動作する
- **依存**: Task 1.2
- **推定時間**: 3-4時間
- **テスト**: 統合テスト（Vitest + Docker Redis）でレート制限確認

#### Task 9.3: 監査ログ実装

- [ ] audit_logsテーブル作成
- [ ] AuditLogService実装
- [ ] CRUD操作で監査ログ記録
- [ ] プラグイン操作で監査ログ記録
- [ ] 監査ログ閲覧UI実装
- **完了条件**: 監査ログが記録・閲覧できる
- **依存**: Task 1.3
- **推定時間**: 4-5時間
- **テスト**: 統合テスト（Vitest + Docker PostgreSQL）でログ記録確認

### Phase 10: パフォーマンス最適化（1週間）

#### Task 10.1: DBインデックス最適化

- [ ] 頻出クエリ分析
- [ ] インデックス追加（tenant_id, ts, funnel_stage等）
- [ ] 複合インデックス設計
- [ ] EXPLAIN ANALYZE実行
- [ ] マイグレーション作成
- **完了条件**: クエリパフォーマンスが改善される
- **依存**: Task 4.3
- **推定時間**: 3-4時間
- **テスト**: 統合テスト（Vitest）でクエリ速度確認

#### Task 10.2: Redisキャッシュ拡張

- [ ] Developer詳細キャッシュ実装（TTL 10分）
- [ ] PostHog Insightsキャッシュ実装（TTL 1時間）
- [ ] キャッシュinvalidation実装
- **完了条件**: キャッシュが効き、レスポンスが高速化される
- **依存**: Task 1.2
- **推定時間**: 4-5時間
- **テスト**: 統合テスト（Vitest + Docker Redis）でキャッシュ動作確認

#### Task 10.3: BullMQジョブキュー実装

- [ ] BullMQセットアップ
- [ ] PostHog Captureジョブ実装（バックグラウンド）
- [ ] メール送信ジョブ実装（バッチ処理）
- [ ] プラグイン同期ジョブ実装（cron）
- [ ] ジョブ監視UI実装（Bull Board）
- **完了条件**: バックグラウンドジョブが動作する
- **依存**: Task 4.2, Task 6.3
- **推定時間**: 5-6時間
- **テスト**: 統合テスト（Vitest + Docker Redis）でジョブ実行確認

### Phase 11: セキュリティ監査（1週間）

#### Task 11.1: セキュリティ監査

- [ ] 依存関係脆弱性スキャン（npm audit）
- [ ] OWASP Top 10チェック
- [ ] PII暗号化確認
- [ ] 認証・認可フロー確認
- [ ] 監査レポート作成
- **完了条件**: セキュリティ監査が完了し、重大な問題がない
- **依存**: Phase 8-9完了
- **推定時間**: 4-5時間

## 実装順序

### UI先行アプローチ（早期PoC確認）

1. **Week 1-2**: Phase 1（基盤構築） + Phase 2（UIモック実装）
   - → **PoC確認ポイント**: モックデータでUIが動作

2. **Week 3-4**: Phase 3（API層実装） + Phase 2.5（実データ接続）
   - → **PoC確認ポイント**: 実データでCRUD操作が動作

3. **Week 5-7**: Phase 4（コアサービス層）
   - → **PoC確認ポイント**: ファネル分析が動作

4. **Week 8**: Phase 5（ファイルインポート）
   - → **PoC確認ポイント**: CSV/JSONインポートが動作

5. **Week 9-11**: Phase 6（メール配信）
   - → **PoC確認ポイント**: メールキャンペーンが送信できる

6. **Week 12-14**: Phase 7（プラグインシステム）
   - → **PoC確認ポイント**: プラグインがロード・動作する

7. **Week 15**: Phase 8（認証・認可）
   - → **PoC確認ポイント**: ログインが動作し、権限制御される

8. **Week 16**: Phase 9（セキュリティ強化）
   - → **PoC確認ポイント**: PII暗号化が動作

9. **Week 17**: Phase 10（パフォーマンス最適化）
   - → **PoC確認ポイント**: レスポンスが高速化

10. **Week 18**: Phase 11（セキュリティ監査）
    - → **リリース準備完了**

### 並行実行可能なタスク

- Phase 2のUI実装タスクは並行実行可能
- Phase 3のAPI実装タスクは並行実行可能
- Phase 6のメール配信機能とPhase 7のプラグインシステムは一部並行可能

## リスクと対策

| リスク | 対策 |
|---|---|
| **PostHog連携が複雑** | Phase 4でPostHog Clientを早期実装し、動作確認 |
| **プラグインシステムの複雑性** | Phase 7でサンプルプラグインを作成し、動作確認 |
| **メール配信の到達率** | Task 6.1でResend Test Mode使用、DKIM/SPF設定ガイド作成 |
| **セキュリティ脆弱性** | Phase 11で監査実施、依存関係は定期的に更新 |

## テスト戦略

### 🚨 絶対禁止事項（再掲）

1. **モック絶対禁止**: 外部API、DB、プラグインのモック禁止
2. **フォールバック絶対禁止**: テスト失敗時のフォールバック禁止
3. **スキップ絶対禁止**: `it.skip()`等の使用禁止

### テスト環境

- **単体テスト**: Vitest + Docker環境（PostgreSQL, Redis, PostHog）
- **統合テスト**: Vitest + Supertest + Docker環境
- **E2Eテスト**: Playwright + Docker環境（全サービス起動）

### テスト実施タイミング

- **各タスク完了時**: 該当箇所のテスト作成・実行（単体/統合/E2E）
- **Phase完了時**: 統合テスト実行
- **継続的**: E2Eテストは各UIタスク完了時に作成し、常に実行される状態を保つ

## 注意事項

### コミット単位

- 各タスクは1-2コミットで完結させる
- コミットメッセージは明確に（`feat:`, `fix:`, `test:`, `docs:`）
- PR作成時は該当Phaseのタスクをまとめる

### 品質チェック

- タスク完了時: `pnpm typecheck && pnpm lint && pnpm test`
- Phase完了時: 統合テスト + E2Eテスト
- 不明点は実装前に確認

### PoC確認頻度

- 各Phaseの主要タスク完了時にPoC確認
- 問題発見時は即座に設計見直し
- UI動作確認を最優先

## 実装開始ガイド

### ステップ1: 環境構築

```bash
# リポジトリクローン（既存の場合はスキップ）
cd /Users/nakatsugawa/Code/DevRel/devcle/app

# 依存関係インストール
pnpm install

# Docker環境起動
docker compose -f docker/compose.development.yml up -d

# DBマイグレーション
pnpm db:migrate

# シードデータ投入
pnpm db:seed
```

### ステップ2: 実装開始

1. TodoWriteで現在のタスクを`in_progress`に更新
2. タスク内容を確認し、実装開始
3. テストを随時作成・実行
4. 完了条件を満たしたら`completed`に更新
5. 次のタスクへ

### ステップ3: PoC確認

- Phase 1完了時: Docker環境とMonorepo動作確認
- Phase 2完了時: UIモックデータ表示確認
- Phase 3完了時: 実データCRUD動作確認
- 以降、各Phase完了時に確認

### ステップ4: 問題発生時

1. エラーログを確認
2. 関連テストを実行
3. 必要に応じて設計を見直し
4. ユーザーに報告・相談

## 概要

- 総タスク数: 20
- 推定作業時間: 44-64時間（約6-8営業日）
- 優先度: 高

## タスク一覧

### Phase 1: 準備・調査

#### Task 1.1: スキーマ確定・インデックス設計

- [x] Drizzleスキーマ最終化（campaigns, budgets, cost_items。numeric(19,4), tenant_id, timestamps）
- [ ] 外部キー/ON DELETE CASCADE設計
- [ ] 主要インデックス設計（budgets(tenant_id,campaign_id,spent_at) ほか）
- **完了条件**: スキーマ定義PR作成、マイグレーション生成成功
- **依存**: なし
- **推定時間**: 3h

#### Task 1.2: OpenAPI I/F確定

- [ ] `/api/budgets`(GET/POST/PATCH), `/api/campaigns`(GET/POST), `/api/roi`(GET) を定義
- [ ] クエリ/ボディ/レスポンス/エラーのスキーマ確定（cursor, limit<=200, weighted等）
- [ ] Swagger表示確認
- **完了条件**: openapi.yamlがLint通過＆Swagger UIで表示
- **依存**: Task 1.1
- **推定時間**: 2h

#### Task 1.3: Zodスキーマ設計

- [ ] CreateBudgetBody, ListBudgetsQuery, RoiQuery のZod定義
- [ ] 金額/日付の正規化（decimal文字列→Decimal, ISO→Date）
- [ ] カテゴリ列挙と上限値・境界値の定義
- **完了条件**: 型チェック通過、サンプル入力でvalidate成功
- **依存**: Task 1.2
- **推定時間**: 2h

#### Task 1.4: RBAC/監査・Idempotency設計

- [ ] エンドポイント×ロール（Admin/Manager/Viewer/AI）権限表の確定
- [ ] Idempotency-Key運用（unique制約、保存列、期限）
- [ ] 監査項目（created_by/updated_by/change_reason）の運用方針
- **完了条件**: 設計反映、設定値ドラフト作成
- **依存**: Task 1.2
- **推定時間**: 2h

### Phase 2: 実装

#### Task 2.1: マイグレーション実装

- [ ] テーブルとインデックスのDDL実装
- [ ] 最小シード（campaign 1件）
- [ ] ロールバック用スクリプト
- **完了条件**: ローカルDockerでmigrate成功
- **依存**: Task 1.1
- **推定時間**: 3h

#### Task 2.2: Repository実装

- [ ] BudgetRepository（list/insert/update + 集計SQL）
- [ ] CostItemRepository（CRUD）
- [ ] CampaignRepository（CRUD + ensureExists）
- **完了条件**: 単体テストでCRUDが通る
- **依存**: Task 2.1
- **推定時間**: 4h

#### Task 2.3: BudgetService実装

- [ ] create/list/update（TX, idempotency, 楽観ロック）
- [ ] costItems合計とamount整合性チェック
- [ ] 監査情報保存
- **完了条件**: 単体テスト通過
- **依存**: Task 2.2, Task 1.4, Task 1.3
- **推定時間**: 4h

#### Task 2.4: BudgetsController実装

- [ ] GET/POST/PATCH ルートの作成
- [ ] Zodバリデーション適用・RBAC適用
- [ ] Cursorページング/limit制限実装
- **完了条件**: 統合テストで3エンドポイント成功
- **依存**: Task 2.3
- **推定時間**: 4h

#### Task 2.5: RoiCalculator実装

- [ ] 投資合計（期間/カテゴリフィルタ）
- [ ] 効果値取得スタブI/F（後続でCRM/ファネル接続）
- [ ] weighted計算フック（PluginRegistry連携）
- **完了条件**: 単体テストで計算式が正しい
- **依存**: Task 2.2
- **推定時間**: 3h

#### Task 2.6: ROI API実装

- [ ] GET /api/roi（weightedパラメータ対応）
- [ ] 期間フィルタ/バリデーション
- [ ] エラーハンドリング
- **完了条件**: 統合テスト通過
- **依存**: Task 2.5
- **推定時間**: 2h

#### Task 2.7: Campaigns API最小実装

- [ ] GET/POST /api/campaigns
- [ ] Zod/認可の適用
- [ ] 予算参照前提の整合性を確認
- **完了条件**: 統合テスト通過
- **依存**: Task 2.2
- **推定時間**: 2h

#### Task 2.8: PluginRegistry接続（AI Attribution）

- [ ] Registry I/F定義とDI
- [ ] FEATURE_AI_ATTRIBUTION で有効/無効切替
- [ ] モック実装で重み取得の疎通確認
- **完了条件**: weighted=true時にモック重み反映
- **依存**: Task 2.5
- **推定時間**: 2h

#### Task 2.9: エラーハンドラ/ロギング整備

- [ ] 構造化ログ（requestId, tenantId）
- [ ] エラーマッピング（400/401/403/404/409/429/5xx）
- [ ] 重要操作の監査ログ出力
- **完了条件**: 統合テスト時にログ/エラー型が期待通り
- **依存**: Task 2.4, Task 2.6
- **推定時間**: 2h

### Phase 3: 検証・テスト

#### Task 3.1: 単体テスト（サービス/計算/スキーマ）

- [ ] BudgetService（idempotency/整合性）
- [ ] RoiCalculator（weighted on/off境界値）
- [ ] Zodスキーマ（境界値/無効値）
- **完了条件**: 単体テストカバレッジ80%+
- **依存**: Task 2.3, Task 2.5
- **推定時間**: 3h

#### Task 3.2: 統合テスト（API）

- [ ] /api/budgets CRUD/検索/ページング/認可
- [ ] Idempotency 409検証
- [ ] /api/roi 正常/weighted/期間外
- **完了条件**: Docker PostgreSQLで全テストが緑
- **依存**: Task 2.4, Task 2.6
- **推定時間**: 4h

#### Task 3.3: 性能サニティチェック

- [ ] サンプル1万行で一覧・集計の実行時間測定
- [ ] インデックス有無の比較
- [ ] 簡易キャッシュ方針（必要時）
- **完了条件**: 主要クエリ<200ms@ローカルDB
- **依存**: Task 3.2
- **推定時間**: 2h

### Phase 4: 仕上げ

#### Task 4.1: ドキュメントとOpenAPI整備

- [ ] OpenAPI例/エラーレスポンス例の追記
- [ ] README（環境変数/マイグレーション/利用例）更新
- [ ] 使用例スニペット（cURL/TS）
- **完了条件**: ドキュメントレビュー完了
- **依存**: Task 3.2
- **推定時間**: 2h

#### Task 4.2: 運用準備/設定

- [ ] 環境変数整理（DATABASE_URL, FEATURE_AI_ATTRIBUTION 他）
- [ ] マイグレーション自動適用設定
- [ ] 重要通知のたたき台（Slack webhook箇所）
- **完了条件**: dev/prodテンプレ整備
- **依存**: Task 3.2
- **推定時間**: 2h

#### Task 4.3: リリースノート/移行手順

- [ ] 新規テーブル説明
- [ ] 既存データ影響（なし想定）明記
- [ ] ロールバック手順記載
- **完了条件**: ノート合意
- **依存**: Task 4.1
- **推定時間**: 1h

## 実装順序

1. Phase 1から順次実行（1.1→1.2→1.3→1.4）
2. Phase 2は2.1→2.2→2.3→2.4を主経路に、2.5/2.6/2.7/2.8/2.9を並行・後続で接続
3. Phase 3で単体→統合→性能の順に検証
4. Phase 4でドキュメント/運用/リリース整備

## リスクと対策

- 十進数誤差: `numeric(19,4)` + Decimalユーティリティを使用、浮動小数は不使用
- Idempotency競合: `tenant_id + idempotency_key`一意制約とTXで防止
- テナント漏洩: すべてのクエリに`tenantId`条件必須、統合テストで検証
- 外部依存（AI加重）: フィーチャーフラグでフォールバック、タイムアウト時は非加重結果
- タイムゾーン差: `timestamptz`で保存、ISO/UTCに正規化
- 集計負荷: 適切なインデックスとカーソル、必要時短期キャッシュ

## 注意事項

- 各タスクはコミット単位（1-4時間）で完結させる
- タスク完了時は単体/統合の品質チェックを実行
- 不明点は実装前に確認し、設計に反映する

## 実装開始ガイド

1. このタスクリストに従って順次実装を進めてください
2. 各タスクの開始時に状態をin_progressへ更新
3. 完了時はcompletedへ更新
4. 問題発生時は速やかに報告してください

# タスクリスト - DRM (Developer Relations Management) ツール

## 概要

- **総タスク数**: 45タスク
- **推定作業時間**: 220-290時間（約28-36営業日）
- **優先度**: 高
- **実装方針**: UI→API→サービス層の順で、早期PoC確認を優先

### Meta

- [ ] 詳細設計の完了とレビュー（Budgetモジュール）
- [ ] Budget: Phase 1（設計確定）
- [ ] Budget: Phase 2（API/Service/Repo実装）
- [ ] Budget: Phase 3（テスト）
- [ ] Budget: Phase 4（仕上げ/運用）

## 🚨 重要な開発方針

### OpenAPI
- **OpenAPI 3.0スキーマとSwagger UIはTask 3.1で初期セットアップ**
- **各API実装タスクで該当エンドポイントをopenapi.yamlに追加**
- まとめてドキュメントを作成するタスクは不要

### E2Eテスト
- **各UIタスク完了時に該当画面のE2Eテストを作成**
- 開発しながら常にE2Eテストを実行
- まとめてE2Eテストを作成するタスクは不要

### README.md
- **開発中に常に更新**
- セットアップ方法、環境変数、使い方を随時記載
- まとめてREADMEを更新するタスクは不要

### パフォーマンステスト
- **負荷テストは不要**
- 通常の統合テストでクエリ速度を確認

