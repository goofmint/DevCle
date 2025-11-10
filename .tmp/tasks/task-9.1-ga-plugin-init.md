# Task 9.1: Google Analytics Plugin 初期化 - 詳細設計

## 概要

Google Analyticsプラグインの基本構造を構築する。プラグインマニフェスト（`plugin.json`）の定義、パッケージ構成、Google Analytics SDK統合の準備を行う。

本タスクでは**実装は行わず、プラグイン定義のみ**を作成する。

## 目的

- Google Analyticsプラグインの基本構造を定義
- プラグインマニフェストの作成
- 必要な依存関係の定義
- ビルド可能な最小構成の確立

## ディレクトリ構造

```
plugins/
  google_analytics/
    plugin.json           # プラグインマニフェスト（本タスクで作成）
    package.json          # パッケージ定義（本タスクで作成）
    README.md             # プラグイン説明（本タスクで作成）
    src/
      index.ts            # プラグインエントリポイント（空のエクスポート）
```

## 1. プラグインマニフェスト（plugin.json）

### 基本情報

```json
{
  "id": "google_analytics",
  "name": "Google Analytics",
  "version": "1.0.0",
  "description": "Sync Google Analytics 4 events and track anonymous user behavior with click_id attribution.",
  "vendor": "DRM",
  "homepage": "https://github.com/goofmint/DevCle/tree/main/plugins/google_analytics",
  "license": "Commercial"
}
```

### 互換性

```json
{
  "compatibility": {
    "drowlMin": "0.1.0",
    "drowlMax": "2.0.0"
  }
}
```

- DRM Core 0.9.0以降で動作
- 2.0.0未満のバージョンで動作保証

### 権限（capabilities）

```json
{
  "capabilities": {
    "scopes": [
      "read:activities",
      "write:activities"
    ],
    "network": [
      "https://www.googleapis.com",
      "https://analyticsdata.googleapis.com"
    ],
    "secrets": [
      "google_service_account_key"
    ]
  }
}
```

**説明:**

- `scopes`:
  - `read:activities`: アクティビティデータの読み取り（重複チェック用）
  - `write:activities`: Google Analyticsイベントを正規化してactivitiesテーブルに書き込み
- `network`:
  - `https://www.googleapis.com`: Google OAuth 2.0トークンエンドポイント
  - `https://analyticsdata.googleapis.com`: Google Analytics Data API v1
- `secrets`:
  - `google_service_account_key`: サービスアカウントのJSON秘密鍵（コア側で暗号化保存）

### 設定スキーマ（settingsSchema）

```json
{
  "settingsSchema": [
    {
      "key": "property_id",
      "label": "GA4 Property ID",
      "type": "text",
      "required": true,
      "regex": "^[0-9]+$",
      "help": "Google Analytics 4のプロパティID（例: 123456789）"
    },
    {
      "key": "google_service_account_key",
      "label": "Service Account Key (JSON)",
      "type": "secret",
      "required": true,
      "help": "Google Cloud ConsoleでダウンロードしたサービスアカウントのJSON秘密鍵"
    },
    {
      "key": "sync_days",
      "label": "Initial Sync Range (days)",
      "type": "number",
      "default": 30,
      "min": 1,
      "max": 365,
      "help": "初回同期時に取得する過去データの範囲（日数）"
    },
    {
      "key": "event_names",
      "label": "Event Names to Sync",
      "type": "textarea",
      "default": "page_view\nclick\nsession_start",
      "help": "同期対象のイベント名（1行1イベント）"
    }
  ]
}
```

**フィールド説明:**

1. **property_id**:
   - GA4のプロパティID（数値のみ）
   - 正規表現検証: `^[0-9]+$`
   - 必須項目

2. **google_service_account_key**:
   - サービスアカウントのJSON秘密鍵（JSONファイル全体をテキストとして保存）
   - Google Cloud Consoleで作成したサービスアカウントの認証情報
   - 以下の権限が必要:
     - `https://www.googleapis.com/auth/analytics.readonly`
   - GA4プロパティにサービスアカウントのメールアドレスを閲覧者として追加する必要がある
   - `secret`型なのでコア側で暗号化保存
   - プラグイン実行時は環境変数またはファイルとして提供

3. **sync_days**:
   - 初回同期時の取得範囲
   - デフォルト: 30日
   - 最小: 1日、最大: 365日

4. **event_names**:
   - 同期対象のイベント名リスト
   - デフォルト: `page_view`, `click`, `session_start`
   - 改行区切りで複数指定

### メニュー（menus）

```json
{
  "menus": [
    {
      "key": "overview",
      "label": "Overview",
      "icon": "mdi:google-analytics",
      "to": "/overview"
    },
    {
      "key": "settings",
      "label": "Settings",
      "icon": "mdi:cog",
      "to": "/settings"
    }
  ]
}
```

**説明:**

- **Overview**: プラグインの概要（同期状態、統計情報など）
- **Settings**: プラグイン設定画面（自動生成）

### ウィジェット（widgets）

```json
{
  "widgets": [
    {
      "key": "events.timeseries",
      "type": "timeseries",
      "title": "GA Events (30d)",
      "version": "1.0",
      "description": "Google Analyticsイベントの時系列推移"
    },
    {
      "key": "stats.total_events",
      "type": "stat",
      "title": "Total Events (Today)",
      "version": "1.0",
      "description": "本日の総イベント数"
    }
  ]
}
```

**説明:**

- `events.timeseries`: 過去30日間のイベント推移（折れ線グラフ）
- `stats.total_events`: 本日の総イベント数（単一数値）

### APIルート（routes）

```json
{
  "routes": [
    {
      "method": "POST",
      "path": "/sync",
      "auth": "plugin",
      "timeoutSec": 300,
      "idempotent": true,
      "description": "Google Analyticsデータを同期"
    },
    {
      "method": "POST",
      "path": "/widgets/:key",
      "auth": "plugin",
      "timeoutSec": 10,
      "description": "ウィジェットデータを取得"
    }
  ]
}
```

**説明:**

- `POST /sync`:
  - Google Analytics Data APIからイベントを取得し、`plugin_events_raw`に保存
  - タイムアウト: 5分（大量データ取得を想定）
  - 冪等性あり（Idempotency-Key必須）

- `POST /widgets/:key`:
  - ウィジェットデータ取得
  - タイムアウト: 10秒（高速応答必須）

### ジョブ（jobs）

```json
{
  "jobs": [
    {
      "name": "sync",
      "route": "/sync",
      "cron": "0 */6 * * *",
      "timeoutSec": 300,
      "concurrency": 1,
      "description": "6時間ごとにGoogle Analyticsデータを同期",
      "retry": {
        "max": 3,
        "backoffSec": [60, 180, 600]
      },
      "cursor": {
        "key": "google_analytics_sync_cursor",
        "ttlSec": 2592000
      }
    }
  ]
}
```

**説明:**

- **cron**: `0 */6 * * *`（6時間ごと実行）
- **concurrency**: 1（同時実行数を制限）
- **retry**: 最大3回リトライ（1分 → 3分 → 10分のバックオフ）
- **cursor**:
  - 増分同期用カーソル（前回取得位置を記録）
  - TTL: 30日（2592000秒）

### レート制限（rateLimits）

```json
{
  "rateLimits": {
    "perMinute": 60,
    "burst": 30
  }
}
```

**説明:**

- 1分あたり最大60リクエスト
- バースト時最大30リクエスト
- Google Analytics Data API v1のクォータ制限に準拠

### 国際化（i18n）

```json
{
  "i18n": {
    "supported": ["en", "ja"]
  }
}
```

**説明:**

- 英語と日本語をサポート
- ラベルや説明文は多言語対応可能

### 自動データページ（data）

```json
{
  "data": true
}
```

**説明:**

- `data: true`を設定すると、コアが自動的に`/data`ページを生成
- `plugin_events_raw`テーブルのデータを表示
- フィルタリング、ページネーション、詳細モーダル、再処理機能を提供

## 2. パッケージ定義（package.json）

```json
{
  "name": "@drm/plugin-google-analytics",
  "version": "1.0.0",
  "description": "Google Analytics 4 integration plugin for DRM",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@google-analytics/data": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {},
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**依存関係:**

- `@google-analytics/data`: Google Analytics Data API v1の公式Node.jsクライアント
- TypeScript: 型定義とトランスパイル

## 3. TypeScript設定（tsconfig.json）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 4. エントリポイント（src/index.ts）

```typescript
/**
 * Google Analytics Plugin
 *
 * Syncs Google Analytics 4 events to DRM activities table.
 * Uses click_id for anonymous user attribution.
 */

/**
 * Placeholder export for initial setup.
 *
 * This file will be extended in Task 9.2 with:
 * - syncGoogleAnalyticsData() handler
 * - Widget data handlers
 * - Event normalization logic
 */
export {};
```

**説明:**

- 本タスクでは空のエクスポートのみ
- 実装はTask 9.2以降で追加

## 5. README（README.md）

```markdown
# Google Analytics Plugin

Google Analytics 4のイベントデータをDRMに同期し、`click_id`による匿名ユーザーアトリビューションを実現します。

## 機能

- Google Analytics 4 Data API v1統合
- 6時間ごとの自動同期（cron）
- `click_id`パラメータによる匿名追跡
- ページビュー、クリック、セッション開始などのイベント収集
- DRM activitiesテーブルへの正規化

## 必要な設定

1. **GA4 Property ID**: Google Analytics 4のプロパティID
2. **Service Account Key**: Google Cloud Consoleで作成したサービスアカウントのJSON秘密鍵

### サービスアカウントの作成手順

#### 1. Google Cloud Projectでの設定

1. **Google Cloud Console**にアクセス
2. プロジェクトを選択（または新規作成）
3. **APIs & Services > Credentials**に移動
4. **CREATE CREDENTIALS > Service Account**を選択
5. サービスアカウント名を入力（例: `drm-ga-sync`）
6. **CREATE AND CONTINUE**をクリック
7. ロールは設定不要（スキップ可能）
8. **DONE**をクリック
9. 作成したサービスアカウントをクリック
10. **KEYS**タブに移動
11. **ADD KEY > Create new key**を選択
12. **JSON**形式を選択してダウンロード

#### 2. Google Analytics Data APIの有効化

1. **APIs & Services > Library**に移動
2. "Google Analytics Data API"を検索
3. **Google Analytics Data API v1**を選択
4. **ENABLE**をクリック

#### 3. GA4での権限設定

1. **Google Analytics**にアクセス
2. 対象のGA4プロパティを選択
3. **Admin > Property > Property Access Management**に移動
4. **Add users**をクリック
5. サービスアカウントのメールアドレスを入力（例: `drm-ga-sync@project-id.iam.gserviceaccount.com`）
6. ロール: **Viewer**を選択
7. **Add**をクリック

#### 4. DRMでの設定

1. DRM管理画面でGoogle Analyticsプラグインの設定画面を開く
2. **GA4 Property ID**にプロパティIDを入力
3. **Service Account Key (JSON)**にダウンロードしたJSONファイルの内容を貼り付け
4. **Save**をクリック

## データフロー

1. **収集**: Google Analytics Data APIからイベントを取得
2. **保存**: `plugin_events_raw`テーブルに生データを保存
3. **正規化**: コアの正規化パイプラインで`activities`テーブルに変換
4. **アトリビューション**: `click_id`を`distinct_id`として使用し、匿名ユーザーを識別

## 制限事項

- Google Analytics Data API v1のクォータ制限に準拠
- 同時実行数: 1（並列実行不可）
- タイムアウト: 5分

## ライセンス

Commercial
```

## 完了条件

- [ ] `plugins/google_analytics/plugin.json`が作成され、すべての必須フィールドが定義されている
- [ ] `plugins/google_analytics/package.json`が作成され、必要な依存関係が記述されている
- [ ] `plugins/google_analytics/src/index.ts`が空のエクスポートとして作成されている
- [ ] `plugins/google_analytics/README.md`が作成されている
- [ ] TypeScript設定ファイル（`tsconfig.json`）が作成されている
- [ ] プラグインがビルドできる（`pnpm build`が成功する）

## 依存タスク

- Task 8.1: Plugin System基盤実装（完了済み）

## 推定時間

2時間

## 注意事項

- 本タスクでは**ドキュメントとマニフェスト定義のみ**を作成
- 実装（同期ロジック、ウィジェット、UI）はTask 9.2以降で実施
- Google Analytics SDK (`@google-analytics/data`) をpackage.jsonに記述するが、実際の使用はTask 9.2以降
- プラグインマニフェストは`.tmp/plugin.md`の仕様に準拠
