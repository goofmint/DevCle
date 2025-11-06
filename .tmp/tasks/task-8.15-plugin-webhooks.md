# Task 8.15: プラグインのWebhook受信実装（isolated-vm）

**目的:** プラグインが外部サービス（GitHub、Slack等）からのWebhookを受信し、isolated-vm環境で安全に処理できるようにする。

**タスクID:** 8.15
**依存タスク:** Task 8.4（Plugin管理API実装）
**推定時間:** 8時間

---

## 1. 概要

プラグインは `plugin.json` の `routes` フィールドでWebhookエンドポイントを定義します。コア側は以下を提供します：

1. **isolated-vm実行環境** - プラグインコードをサンドボックス内で実行
2. **HTTP Client** - コアAPIへの内部呼び出し + `capabilities.network`で許可された外部ドメインへのアクセス
3. **認証システム** - 内部APIアクセス用のHMAC署名トークン

**注意:** Webhook署名検証（GitHub/Slack等）は各プラグイン側で実装してください。コアは検証機能を提供しません。

**重要な原則:**
- プラグインは**DB直接操作不可**、コアAPI経由のみ
- Webhookハンドラーの戻り値は**必ずboolean**（true: 成功, false: 失敗）
- すべてのコアAPI呼び出しに**内部認証トークン**必須
- isolated-vmで**ファイルシステムアクセス制限**
- **ネットワークアクセス**: `capabilities.network`で許可されたドメインのみアクセス可

---

## 2. plugin.json仕様（routes）

### 2.1 Webhook定義例

```json
{
  "id": "github",
  "name": "GitHub",
  "version": "1.0.0",
  "capabilities": {
    "scopes": ["write:activities"],
    "network": ["https://api.github.com"]
  },
  "settingsSchema": [
    {
      "key": "github_token",
      "label": "GitHub Token",
      "type": "secret"
    }
  ],
  "routes": [
    {
      "method": "POST",
      "path": "/webhook/push",
      "handler": "handlers/github-webhook.js"
    }
  ]
}
```

### 2.2 フィールド説明

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `method` | string | Yes | HTTPメソッド（GET, POST, PUT, DELETE） |
| `path` | string | Yes | Webhookパス（プラグインルートからの相対パス） |
| `handler` | string | Yes | ハンドラーファイルパス（プラグインルートからの相対パス） |

**注意:**
- `settingsSchema`で定義されたフィールドは自動的にプラグイン設定として利用可能
- `capabilities.secrets`は不要（削除済み）

---

## 3. コンポーネント設計

### 3.1 アーキテクチャ図

```
External Service (GitHub/Slack)
  |
  v
[POST /api/plugins/:id/webhooks/:path]
  |
  v
WebhookController (core/app/routes/api.plugins_.$id.webhooks.$.ts)
  |
  +-- 1. Plugin Lookup
  +-- 2. Route Matching
  +-- 3. Load plugin handler code
  +-- 4. Generate internal plugin token (HMAC)
  +-- 5. Log webhook request (plugin_runs table)
  |
  v
IsolatedVmRunner (core/plugin-system/sandbox/isolated-vm-runner.ts)
  |
  +-- Create sandbox context
  +-- Inject PluginHttpClient
  +-- Execute handler with timeout
  |
  v
Plugin Handler (plugins/github/handlers/webhook.js)
  |
  +-- Parse webhook payload
  +-- Call Core API (via PluginHttpClient)
  |
  v
PluginHttpClient (core/plugin-system/sandbox/http-client.ts)
  |
  +-- GET/POST/PUT/DELETE /api/* (with HMAC token)
  |
  v
Core API (core/app/routes/api.*.ts)
  |
  +-- Verify HMAC token
  +-- Execute core logic (e.g., create activity, developer, etc.)
```

---

## 4. インターフェース定義

### 4.1 isolated-vm Runner（`isolated-vm-runner.ts`）

**役割:**
- プラグインハンドラーコードをisolated-vm内で実行
- サンドボックスコンテキストを作成し、PluginHttpClientを注入
- 実行結果（boolean）を返却

**コンテキスト:**
- `tenantId`, `pluginId`, `pluginToken` (HMAC)
- `allowedDomains` (capabilities.networkから取得)
- `request` (method, path, headers, body)
- `response` (Remixのレスポンスオブジェクト)
- `httpClient` (PluginHttpClient)

### 4.2 HTTP Client（`http-client.ts`）

**役割:**
- サンドボックス内でHTTPリクエストを送信
- 内部API（`/api/*`）: HMAC認証トークンを付与
- 外部API: `capabilities.network`で許可されたドメインのみアクセス可

**メソッド:**
- `get(url)`, `post(url, body)`, `put(url, body)`, `delete(url)`
- 内部API: すべて利用可能
- 外部API: すべて利用可能（ドメイン検証あり）

### 4.3 内部認証（`auth.service.ts`に追加）

**トークン生成（`generatePluginToken`）:**
- Webhook受信API内で動的生成（UIは不要）
- フォーマット: `base64(pluginId:tenantId:timestamp:nonce).signature`
- 署名: HMAC-SHA256
- Nonce: `crypto.randomUUID()`（UUIDv4）
- Secret: `PLUGIN_INTERNAL_SECRET`環境変数

**トークン検証（`verifyPluginToken`）:**
- HMAC署名検証
- タイムスタンプ検証（5分有効期限 + ±30秒クロックスキュー許容）
- Nonce重複検証（リプレイアタック対策）
- Nonceストレージ: Redis（プライマリ、TTL自動削除） / DB（フォールバック、定期GC）

**`requireAuth`の修正:**
- Authorization headerからトークン抽出を試行
- プラグイントークンの場合は`verifyPluginToken()`で検証
- 既存のユーザー認証処理はそのまま
- 成功時は`pluginId`, `tenantId`を返却（プラグイン認証の場合）

**DBスキーマ（`plugin_nonces`テーブル）:**
- `nonce_id` (UUID PRIMARY KEY)
- `plugin_id`, `tenant_id`, `nonce` (UNIQUE INDEX)
- `created_at` (INDEX for GC)

### 4.4 コアAPI（`requireAuth`修正）

**利用可能なコアAPI（例）:**
- `POST /api/activities` - Activity作成
- `GET /api/developers` - Developer一覧
- `POST /api/developers` - Developer作成
- `GET /api/campaigns` - Campaign一覧
- `POST /api/campaigns` - Campaign作成

**アクセス制御:**
- `capabilities.scopes`で宣言されたスコープに基づく

---

## 5. データフロー

### 5.1 Webhook受信フロー

```
1. External service sends webhook
   POST https://devcle.com/api/plugins/github/webhooks/push
   X-Hub-Signature-256: sha256=abc123...
   Body: { "action": "opened", "pull_request": {...} }

2. WebhookController
   - Lookup plugin by ID
   - Match route by path
   - Load plugin handler code
   - Generate internal plugin token (HMAC)
   - Log webhook request (plugin_runs table)

3. IsolatedVmRunner
   - Create sandbox with context
   - Inject PluginHttpClient
   - Execute handler with timeout
   - Return boolean result

4. Plugin Handler (in sandbox)
   - Parse webhook payload
   - Call httpClient.post('/api/activities', {...}) or other core APIs
   - Return true on success

5. PluginHttpClient
   - GET/POST/PUT/DELETE /api/* with HMAC token
   - Core API verifies token (verifyPluginToken)
   - Check nonce reuse (Redis/DB)
   - Execute core logic (e.g., insert activity, create developer, etc.)

6. WebhookController
   - Log result (plugin_runs table)
   - Return 200 OK (if true)
   - Return 500 Internal Error (if false/error)

**Note:** プラグインはすべてのコアAPI（`/api/*`）にアクセス可能です。
アクセス制御は`capabilities.scopes`で管理されます。
```

---

## 6. セキュリティ設計

### 6.1 サンドボックス制約

isolated-vmで以下を制限：

- **ネットワークアクセス制限** - `httpClient`経由のみ、`capabilities.network`で許可されたドメインのみ
- **ファイルシステムアクセス禁止** - `fs`, `path`モジュール不可
- **プロセス操作禁止** - `child_process`, `cluster`モジュール不可

### 6.2 内部認証トークン

```typescript
// Token format: base64(payload).signature
// Payload: pluginId:tenantId:timestamp:nonce
// Signature: HMAC-SHA256(secret, payload)
// Secret: PLUGIN_INTERNAL_SECRET (env variable)

const token = generatePluginToken('github', 'default', secret);
// => "Z2l0aHViOmRlZmF1bHQ6MTczMDg2NTYwMDo1YTJiMzQ1Ni03ODkw...abc123def456"

// Token verification (with anti-replay)
const result = await verifyPluginToken(token, secret);
// => { pluginId: 'github', tenantId: 'default', nonce: '5a2b3456-7890...' }
```

**Anti-replay protection:**

1. **Nonce generation**: `crypto.randomUUID()` (cryptographically secure)
2. **Nonce storage**:
   - Primary: Redis (`plugin:nonce:{pluginId}:{tenantId}:{nonce}`, TTL: 5min + 30s)
   - Fallback: DB table `plugin_nonces` (indexed on `created_at`)
3. **Timestamp validation**:
   - Validity window: 5 minutes
   - Clock skew tolerance: ±30 seconds
   - Valid range: `[timestamp - 5min - 30s, timestamp + 5min + 30s]`
4. **Nonce cleanup**:
   - Redis: Auto-expire via TTL
   - DB: Periodic GC job (every 10min, deletes entries older than window + skew)

---

## 7. エラーハンドリング

### 7.1 HTTPステータスコード

| ステータス | 条件 | レスポンス |
|-----------|------|----------|
| 200 OK | Handler completed successfully | `{ "success": true }` |
| 404 Not Found | Plugin or route not found | `{ "error": "Route not found" }` |
| 500 Internal Error | Handler threw error | `{ "error": "Handler execution failed" }` |
| 503 Service Unavailable | Plugin disabled | `{ "error": "Plugin is disabled" }` |

### 7.2 プラグインエラー処理

**エラー検知:**
- ハンドラーが`throw`した場合、コアが`catch`して500エラーを返却
- ハンドラーが正常終了した場合は200を返却

---

## 8. 実装チェックリスト

### 8.1 コア実装

- [ ] **isolated-vm Runner** (`core/plugin-system/sandbox/isolated-vm-runner.ts`)
  - [ ] `IsolatedVmRunner` class
  - [ ] Sandbox context creation
  - [ ] Error handling

- [ ] **HTTP Client** (`core/plugin-system/sandbox/http-client.ts`)
  - [ ] `PluginHttpClient` class
  - [ ] POST method (internal: all `/api/*` paths, external: allowed domains)
  - [ ] GET method (internal: all `/api/*` paths, external: allowed domains)
  - [ ] PUT method (internal: all `/api/*` paths, external: allowed domains)
  - [ ] DELETE method (internal: all `/api/*` paths, external: allowed domains)
  - [ ] HMAC token injection (internal API only)
  - [ ] Domain validation (capabilities.network)

- [ ] **内部認証** (`core/services/auth.service.ts`)
  - [ ] `generatePluginToken()` function (with nonce generation)
  - [ ] `verifyPluginToken()` function (with nonce verification + timestamp check)
  - [ ] `requireAuth()` modification (support plugin token)
  - [ ] `cleanupExpiredNonces()` periodic GC job

- [ ] **Nonce管理** (`core/db/schema/admin.ts`)
  - [ ] `plugin_nonces` table schema (nonce_id, plugin_id, tenant_id, nonce, created_at)
  - [ ] Indexes (created_at, composite unique index)
  - [ ] Migration script

- [ ] **Webhook受信API** (`core/app/routes/api.plugins_.$id.webhooks.$.ts`)
  - [ ] HTTP handler (GET/POST/PUT/DELETE all supported)
  - [ ] Plugin lookup
  - [ ] Route matching (method + path)
  - [ ] Load plugin handler code
  - [ ] Generate internal plugin token (HMAC)
  - [ ] Log webhook request (plugin_runs table)
  - [ ] Execute handler in isolated-vm (via IsolatedVmRunner)
  - [ ] Log result (plugin_runs table)
  - [ ] HTTP status code mapping

### 8.2 単体テスト（Vitest）

- [ ] **isolated-vm-runner.test.ts**
  - [ ] Successful execution
  - [ ] Error handling

- [ ] **http-client.test.ts**
  - [ ] POST to internal API (all `/api/*` paths allowed)
  - [ ] POST to allowed external domain (allowed)
  - [ ] POST to disallowed external domain (should throw)
  - [ ] GET to internal API (all `/api/*` paths allowed)
  - [ ] GET to allowed external domain (allowed)
  - [ ] GET to disallowed external domain (should throw)
  - [ ] PUT to internal API (all `/api/*` paths allowed)
  - [ ] PUT to allowed external domain (allowed)
  - [ ] PUT to disallowed external domain (should throw)
  - [ ] DELETE to internal API (all `/api/*` paths allowed)
  - [ ] DELETE to allowed external domain (allowed)
  - [ ] DELETE to disallowed external domain (should throw)

- [ ] **auth.service.test.ts**
  - [ ] Token generation (includes nonce)
  - [ ] Token verification (valid token)
  - [ ] Token verification (invalid signature)
  - [ ] Token verification (expired timestamp)
  - [ ] Token verification (future timestamp beyond skew)
  - [ ] **Nonce reuse detection** (same nonce rejected)
  - [ ] **Timestamp expiration** (tokens older than window rejected)
  - [ ] **Clock skew tolerance** (±30s accepted, outside rejected)
  - [ ] Nonce cleanup (Redis TTL + DB GC)

### 8.3 E2Eテスト（Playwright）

- [ ] **plugin-webhooks.spec.ts**
  - [ ] Webhook reception
  - [ ] Data storage in activities table via core API
  - [ ] Error responses

---

## 10. 注意事項

### 10.1 isolated-vm制約

- **Node.jsモジュール不可**: `require()`, `import`は使用不可（事前バンドル必要）
- **非同期処理**: `Promise`, `async/await`は使用可
- **コンテキスト注入**: `context`オブジェクト経由でのみコア機能アクセス
- **ネットワークアクセス**: `httpClient`経由のみ、`capabilities.network`で許可されたドメインのみ

### 10.2 トークンセキュリティ

- **短寿命**: デフォルト5分（タイムスタンプチェック）
- **クロックスキュー許容**: ±30秒（分散環境対応）
- **ノンス**: `crypto.randomUUID()`で生成、Redis/DBで重複検証
- **HMAC署名**: HMAC-SHA256で改ざん検知
- **リプレイアタック対策**:
  - Nonce storage: Redis (primary, TTL auto-expire) + DB (fallback, GC job)
  - Nonce reuse detection: Same nonce rejected immediately
  - Validity window: `[timestamp - 5min - 30s, timestamp + 5min + 30s]`

### 10.3 Webhook署名検証について

Webhook署名検証（GitHub、Slack等）は**プラグイン側で実装**してください。コアはリクエストボディとヘッダーをそのまま`context.request`経由でプラグインに渡します。

プラグイン側で署名検証が失敗した場合は、ハンドラーが`throw`することで、コアが500エラーを返します。

### 10.4 エラーログ

- **plugin_runs**: Webhook実行の成功/失敗を記録
- **Error details**: 失敗時は`errorMessage`フィールドに詳細を保存

---

## 9. 完了条件

- [ ] すべてのコア実装が完了している
- [ ] 単体テストが全てパスする
- [ ] E2Eテストが全てパスする

---

## 10. 参考リンク

- [isolated-vm Documentation](https://github.com/laverdet/isolated-vm)
- [HMAC Authentication Best Practices](https://www.rfc-editor.org/rfc/rfc2104)

---

**実装方針:**
- **フェーズ1**: 内部認証（2h）
- **フェーズ2**: isolated-vm Runner + HTTP Client（ドメイン検証付き）（3h）
- **フェーズ3**: Webhook受信API実装（2h）
- **フェーズ4**: テストプラグイン + E2Eテスト（1h）

**ネットワークアクセスポリシー:**
- プラグインは`capabilities.network`で宣言されたドメインのみアクセス可能
- **内部API（`/api/*`）**: すべてのコアAPIにアクセス可能（HMAC認証必須、スコープ制御あり）
- 宣言されていないドメインへのアクセスは即座にエラー

**リプレイアタック対策:**
- Nonce生成: `crypto.randomUUID()`（暗号学的に安全）
- Nonceストレージ: Redis（プライマリ、TTL自動期限切れ）+ DB（フォールバック、GC job）
- クロックスキュー: ±30秒許容（5分ウィンドウの上下に追加）
- タイムスタンプ検証: `[now - 5min - 30s, now + 5min + 30s]`
- Nonce再利用検出: 同一nonceは即座に拒否
