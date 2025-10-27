# Drowl Plugin Manifest Spec (`plugin.json`)

> 目的：プラグインの **設定UI／メニュー／ウィジェット／ジョブ（cron）／APIルーティング／権限** を**宣言的**に記述し、
> コア側はそれを読み込んでフォーム生成・メニュー構築・データ取得・安全な実行を行う。

## 1. ファイル配置（推奨）

```
plugins/
  github/
    plugin.json
    README.md
```

---

## 2. トップレベル構造

```json
{
  "id": "github",
  "name": "GitHub",
  "version": "1.0.0",
  "description": "Sync GitHub events and visualize DevRel metrics.",
  "vendor": "YourOrg",
  "homepage": "https://example.com/plugins/github",
  "license": "MIT",
  "compatibility": {
    "drowlMin": "0.9.0",
    "drowlMax": "2.0.0"
  },

  "capabilities": {
    "scopes": ["read:activities", "write:activities"],
    "network": ["https://api.github.com"],
    "secrets": ["github_token"]
  },

  "settingsSchema": [ /* §4 */ ],

  "menus": [ /* §5 */ ],

  "widgets": [ /* §6 */ ],

  "routes": [ /* §7 */ ],

  "jobs": [ /* §8 */ ],

  "rateLimits": { "perMinute": 60, "burst": 30 },

  "i18n": { "supported": ["en", "ja"] }
}
```

### 必須フィールド

* `id`, `name`, `version`, `capabilities`, `settingsSchema`

---

## 3. セキュリティ／権限（capabilities）

```json
"capabilities": {
  "scopes": [
    "read:activities",   // DBからの読み取り（標準）
    "write:activities"   // 正規化後のアクティビティ書き込み（審査要）
  ],
  "network": [
    "https://api.github.com" // egress許可先（デフォルト拒否）
  ],
  "secrets": [
    "github_token" // シークレット名（保存はコア側KMS、実体は短寿命トークンで委譲）
  ]
}
```

* **原則 deny**、宣言された能力のみ許可。
* `network` はホスト単位 allowlist。
* `secrets` はキー名のみ宣言（実体はコアが保管・発行）。

---

## 4. 設定画面（settingsSchema）

> コアが自動でフォーム生成＆検証。保存はコア（暗号化）。プラグインには**短寿命トークン**で必要分のみ委譲。

```json
"settingsSchema": [
  { "key": "org", "label": "Organization", "type": "text", "required": true, "regex": "^[a-zA-Z0-9-_.]+$" },
  { "key": "github_token", "label": "Access Token", "type": "secret", "required": true, "hint": "Repo read scope required" },
  { "key": "sinceDays", "label": "Initial Sync Range (days)", "type": "number", "default": 30, "min": 1, "max": 365 },
  { "key": "enableIssues", "label": "Ingest Issues", "type": "toggle", "default": true }
]
```

**型**: `text | secret | number | select | multiselect | toggle | url | daterange`
**検証**: 必須・最小最大・正規表現・候補値。AJVで二重検証。

---

## 5. メニュー（menus）

> 管理画面サイドバー/タブを宣言。アプリはここを読み、ルートに紐づけて表示。

```json
"menus": [
  { "key": "overview", "label": "Overview", "icon": "chart", "to": "/overview" },
  { "key": "sync", "label": "Sync", "icon": "refresh", "to": "/sync" },
  { "key": "settings", "label": "Settings", "icon": "settings", "to": "/:id/settings" }
]
```

* `to` はプラグインルートからの相対パス。 `/overview` は `/dashboard/plugins/github/overview` に解決。 `:id` は任意のIDとして、プラグイン側で利用。
* メニュー押下時に必要なデータは §6/§7 で取得。

---

## 6. ウィジェット（widgets）— *アプリ描画*

> ウィジェットはダッシュボード、またはプラグイン独自のUIにて利用できることとします。
> プラグインは **「型＋データ」** だけ返し、**描画はアプリ**が行う。

### 6.1 定義（カタログ）

```json
"widgets": [
  { "key": "dashboard.timeseries", "type": "timeseries", "title": "Contributions (30d)", "version": "1.0" },
  { "key": "roi.table", "type": "table", "title": "Top ROI Campaigns", "version": "1.0" },
  { "key": "stats.signups", "type": "stat", "title": "Signups (today)", "version": "1.0" }
]
```

### 6.2 取得プロトコル（プラグイン実装契約）

* `GET /plugins/:id/widgets` → 定義一覧（上記配列）
* `POST /plugins/:id/widgets/:key` → **データペイロード**を返す

**リクエスト例**

```json
{
  "tenantId": "acme",
  "filters": { "org": "acme", "since": "2025-09-15/2025-10-14", "timezone": "Asia/Tokyo" },
  "paging": { "limit": 20, "offset": 0 },
  "sort": { "key": "actions", "dir": "desc" },
  "aggregation": {
    "metric": "activities",
    "filter": { "action": "click" },
    "op": "count",
    "bucket": "day",
    "cumulative": false
  }
}
```

**レスポンス例（`timeseries@1.0`）**

```json
{
  "version": "1.0",
  "type": "timeseries",
  "title": "Contributions (30d)",
  "data": {
    "interval": "day",
    "series": [
      { "label": "PRs", "points": [["2025-10-01", 5], ["2025-10-02", 7]] },
      { "label": "Issues", "points": [["2025-10-01", 2], ["2025-10-02", 3]] }
    ]
  },
  "refreshHintSec": 3600
}
```

> ウィジェット型 `stat / table / list / timeseries / barchart / pie / funnel / card` を標準化。
> JSON Schemaはアプリ側に同梱（例：`schemas/widget/timeseries@1.0.json`）。

---

## 7. APIルーティング（routes）

> **サーバ側の機能エンドポイント**を宣言。
> コアは**短寿命JWT**で認可し、**宣言されたもの以外は拒否**。

```json
"routes": [
  {
    "method": "POST",
    "path": "/sync",
    "auth": "plugin",               // plugin（短寿命JWT必須）| public（要独自検証）
    "timeoutSec": 120,
    "requestSchema": "schemas/sync.request@1.0.json",
    "responseSchema": "schemas/sync.response@1.0.json",
    "idempotent": true
  },
  {
    "method": "POST",
    "path": "/webhook",
    "auth": "public",               // 例：GitHub Webhookを直接受ける
    "verify": { "type": "githubWebhook", "secretKey": "webhook_secret" },
    "timeoutSec": 10
  },
  {
    "method": "POST",
    "path": "/widgets/:key",
    "auth": "plugin",
    "timeoutSec": 10
  }
]
```

**標準ヘッダ**

* `Authorization: Bearer <short-lived>`
* （idempotent時）`Idempotency-Key: <uuid>`
* `Content-Type: application/json`

**標準エラー**（プラグイン→コア）

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "invalid org", "details": { "field": "org" } } }
```

---

## 8. ジョブ（jobs）— cron / スケジューリング

```json
"jobs": [
  {
    "name": "sync",
    "route": "/sync",
    "cron": "0 */6 * * *",       // 6時間ごと
    "timeoutSec": 120,
    "concurrency": 1,            // 同時実行数
    "retry": { "max": 5, "backoffSec": [10, 30, 60, 120, 300] },
    "cursor": { "key": "github_sync_cursor", "ttlSec": 604800 } // 7日
  }
]
```

* `route` は §7 の `POST /sync` を叩く。
* 成果は `plugin_events_raw → activities` へ（コア側の正規化パイプライン）。
* `plugin_runs` に実績（開始/終了/件数/エラー）を自動記録。

---

## 9. キャッシュ・レート・パフォーマンス

```json
"rateLimits": { "perMinute": 60, "burst": 30 }
```

* **コアがAPIゲートで適用**（テナント×プラグイン×ルート）。
* ウィジェットは `refreshHintSec` を尊重してキャッシュ可（最終判断はコア）。

---

## 10. 多言語（i18n）

```json
"i18n": { "supported": ["en","ja"] }
```

* `title/label/description` はキー化も可（例：`i18nKey` と `default` を併記）。
* コアが現在言語でレンダリング。

---

## 11. セキュリティ補足

* **ネットワーク**：宣言外の宛先は拒否（コンテナ egress allowlist / `--network=none` デフォルト）。
* **シークレット**：`secrets[]` に宣言 → コアが短寿命トークンを発行（長期鍵はコアKMSで保管）。
* **DB書込**：`write:*` スコープ付与時のみ。すべて `plugin_runs` に監査。
* **スキーマ検証**：`requestSchema/responseSchema` を AJV で検証（コア側）。
* **署名**（任意）：`signature`（cosignなど）を別ファイルで配布可。

---

## 12. 最小実例（抜粋・そのまま動く形）

```json
{
  "id": "github",
  "name": "GitHub",
  "version": "1.0.0",
  "capabilities": {
    "scopes": ["read:activities", "write:activities"],
    "network": ["https://api.github.com"],
    "secrets": ["github_token"]
  },
  "settingsSchema": [
    { "key": "org", "label": "Organization", "type": "text", "required": true },
    { "key": "github_token", "label": "Access Token", "type": "secret", "required": true },
    { "key": "sinceDays", "label": "Initial Sync Range (days)", "type": "number", "default": 30 }
  ],
  "menus": [
    { "key": "overview", "label": "Overview", "icon": "chart", "to": "/plugins/github/overview" },
    { "key": "sync", "label": "Sync", "icon": "refresh", "to": "/plugins/github/sync" }
  ],
  "widgets": [
    { "key": "dashboard.timeseries", "type": "timeseries", "title": "Contributions (30d)", "version": "1.0" },
    { "key": "stats.signups", "type": "stat", "title": "Signups (today)", "version": "1.0" }
  ],
  "routes": [
    { "method": "POST", "path": "/sync", "auth": "plugin", "timeoutSec": 120, "idempotent": true },
    { "method": "POST", "path": "/widgets/:key", "auth": "plugin", "timeoutSec": 10 }
  ],
  "jobs": [
    { "name": "sync", "route": "/sync", "cron": "0 */6 * * *", "timeoutSec": 120, "concurrency": 1 }
  ],
  "rateLimits": { "perMinute": 60, "burst": 30 },
  "i18n": { "supported": ["en","ja"] }
}
```

---

## 13. 互換性・バージョニング

* `version`：プラグイン自身のSemVer。
* **ウィジェット**は `type@major.minor` でSchemaを固定（例：`timeseries@1.0`）。
* **破壊的変更**は **メジャー**を上げ、コアは互換性チェックで拒否可能。
* `compatibility.drowlMin/drowlMax` でコア側の対応範囲を明示。

---

## 14. 実装ガイド（要点）

* 設定画面（APIキーなど） は、**JSONデータで定義**します（UIはコアが描画）。
* プラグインは `isolated-vm` で**サンドボックス実行**され、**ネットワークアクセスは宣言制御**されます。
* メニューから呼ばれるUIは、各プラグインで描画します。
* DBアクセスは **宣言されたスコープ** のみ許可されます。
* 長時間処理は **ジョブ（/sync）** に集約。ウィジェットは**速く返す**。
* **Idempotency-Key** で再実行安全。
* すべての実行は **`plugin_runs` に記録**。
* 取り込んだ原本は **`plugin_events_raw`** に保全 → 正規化→ `activities`。
