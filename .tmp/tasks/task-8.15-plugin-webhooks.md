# Task 8.15: プラグインのWebhook受信実装（isolated-vm）

**目的:** プラグインが外部サービス（GitHub、Slack等）からのWebhookを受信し、isolated-vm環境で安全に処理できるようにする。

**タスクID:** 8.15
**依存タスク:** Task 8.4（Plugin管理API実装）
**推定時間:** 8時間

---

## 1. 概要

プラグインは `plugin.json` の `routes` フィールドでWebhookエンドポイントを定義します。コア側は以下を提供します：

1. **Webhook署名検証** - GitHub/Slack等の署名検証ロジック
2. **isolated-vm実行環境** - プラグインコードをサンドボックス内で実行
3. **HTTP Client** - コアAPIへの内部呼び出し + `capabilities.network`で許可された外部ドメインへのアクセス
4. **認証システム** - 内部APIアクセス用のHMAC署名トークン

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
    "network": ["https://api.github.com"],
    "secrets": ["github_token", "webhook_secret"]
  },
  "routes": [
    {
      "method": "POST",
      "path": "/webhook/push",
      "auth": "public",
      "verify": {
        "type": "githubWebhook",
        "secretKey": "webhook_secret"
      },
      "handler": "handlers/github-webhook.js",
      "timeoutSec": 10
    },
    {
      "method": "POST",
      "path": "/webhook/slack",
      "auth": "public",
      "verify": {
        "type": "slackWebhook",
        "secretKey": "slack_signing_secret"
      },
      "handler": "handlers/slack-webhook.js",
      "timeoutSec": 10
    }
  ]
}
```

### 2.2 フィールド説明

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `method` | string | Yes | HTTPメソッド（POST） |
| `path` | string | Yes | Webhookパス（プラグインルートからの相対パス） |
| `auth` | string | Yes | 認証タイプ（"public" または "plugin"） |
| `verify` | object | No | Webhook署名検証設定 |
| `verify.type` | string | No | 検証タイプ（"githubWebhook", "slackWebhook"） |
| `verify.secretKey` | string | No | シークレット名（`settingsSchema`で定義したキー） |
| `handler` | string | Yes | ハンドラーファイルパス（プラグインルートからの相対パス） |
| `timeoutSec` | number | No | タイムアウト（デフォルト: 10秒） |

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
  |
  v
WebhookVerifier (core/plugin-system/auth/webhook-verifier.ts)
  |
  +-- GitHub HMAC-SHA256 verification
  +-- Slack HMAC-SHA256 verification
  |
  v
IsolatedVmRunner (core/plugin-system/sandbox/isolated-vm-runner.ts)
  |
  +-- Load plugin handler
  +-- Create sandbox context
  +-- Inject InternalHttpClient
  +-- Execute with timeout
  |
  v
Plugin Handler (plugins/github/handlers/webhook.js)
  |
  +-- Parse webhook payload
  +-- Call Core API (via InternalHttpClient)
  |
  v
InternalHttpClient (core/plugin-system/sandbox/internal-http-client.ts)
  |
  +-- POST /api/plugin-events (with HMAC token)
  |
  v
Core API (core/app/routes/api.plugin-events.ts)
  |
  +-- Verify HMAC token
  +-- Insert into plugin_events_raw table
```

---

## 4. インターフェース定義

### 4.1 Webhook署名検証（`webhook-verifier.ts`）

```typescript
/**
 * Webhook signature verification interface
 */
export interface WebhookVerifier {
  verify(
    payload: string,
    signature: string,
    secret: string
  ): Promise<boolean>;
}

/**
 * GitHub Webhook verification
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export class GitHubWebhookVerifier implements WebhookVerifier {
  async verify(
    payload: string,
    signature: string,
    secret: string
  ): Promise<boolean> {
    // HMAC-SHA256 verification
    // signature format: "sha256=<hex>"
    throw new Error('Not implemented');
  }
}

/**
 * Slack Webhook verification
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export class SlackWebhookVerifier implements WebhookVerifier {
  async verify(
    payload: string,
    signature: string,
    secret: string,
    timestamp: string
  ): Promise<boolean> {
    // HMAC-SHA256 verification
    // signature format: "v0=<hex>"
    // timestamp check (5min window)
    throw new Error('Not implemented');
  }
}

export function createVerifier(type: string): WebhookVerifier {
  // Factory function
  throw new Error('Not implemented');
}
```

### 4.2 isolated-vm Runner（`isolated-vm-runner.ts`）

```typescript
import ivm from 'isolated-vm';

export interface IsolatedVmRunnerOptions {
  memoryLimitMb: number;
  timeoutMs: number;
  cpuTimeMs: number;
}

export interface IsolatedVmContext {
  tenantId: string;
  pluginId: string;
  pluginToken: string; // HMAC token for internal API calls
  allowedDomains: string[]; // From capabilities.network
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: unknown;
  };
  httpClient: PluginHttpClient;
}

/**
 * Execute plugin code in isolated-vm sandbox
 */
export class IsolatedVmRunner {
  constructor(private options: IsolatedVmRunnerOptions) {}

  async execute(
    code: string,
    context: IsolatedVmContext
  ): Promise<boolean> {
    // 1. Create isolated-vm isolate
    // 2. Create sandbox context with restricted globals
    // 3. Inject context (tenantId, pluginId, httpClient)
    // 4. Execute plugin handler
    // 5. Return boolean result
    // 6. Handle errors (return false)
    throw new Error('Not implemented');
  }
}
```

### 4.3 HTTP Client（`http-client.ts`）

```typescript
/**
 * HTTP client for plugin sandbox
 * Supports:
 * - Internal API calls (with HMAC token)
 * - External API calls (only to allowed domains in capabilities.network)
 */
export class PluginHttpClient {
  constructor(
    private coreBaseUrl: string,
    private pluginToken: string,
    private allowedDomains: string[]
  ) {}

  /**
   * POST request
   * - Internal: All /api/* paths (with HMAC token)
   * - External: Only to domains in capabilities.network
   */
  async post(url: string, body: unknown): Promise<Response> {
    // 1. Check if internal API call
    if (url.startsWith('/api/')) {
      // All /api/* paths are allowed for internal calls
      // Add HMAC token to Authorization header
      // Send request to core API
    } else {
      // External API call - validate domain
      const urlObj = new URL(url);
      const allowed = this.allowedDomains.some(domain =>
        url.startsWith(domain)
      );
      if (!allowed) {
        throw new Error(`External domain not allowed: ${urlObj.hostname}`);
      }
      // Send external request (no HMAC token)
    }
    throw new Error('Not implemented');
  }

  /**
   * GET request (only external APIs allowed)
   */
  async get(url: string): Promise<Response> {
    // External API call only
    if (url.startsWith('/')) {
      throw new Error('Internal API GET is not allowed');
    }
    // Validate domain
    const urlObj = new URL(url);
    const allowed = this.allowedDomains.some(domain =>
      url.startsWith(domain)
    );
    if (!allowed) {
      throw new Error(`External domain not allowed: ${urlObj.hostname}`);
    }
    throw new Error('Not implemented');
  }

  /**
   * PUT/DELETE are NOT allowed
   */
  async put(): Promise<never> {
    throw new Error('PUT method is not allowed from plugin sandbox');
  }

  async delete(): Promise<never> {
    throw new Error('DELETE method is not allowed from plugin sandbox');
  }
}
```

### 4.4 Webhook Executor（`webhook-executor.ts`）

```typescript
import type { PluginManifest, PluginRoute } from './types.js';

export interface WebhookExecutorOptions {
  plugin: PluginManifest;
  route: PluginRoute;
  tenantId: string;
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: unknown;
  };
}

/**
 * Execute webhook handler with verification and sandboxing
 */
export class WebhookExecutor {
  async execute(options: WebhookExecutorOptions): Promise<boolean> {
    // 1. Verify webhook signature (if verify config exists)
    // 2. Load plugin handler code
    // 3. Generate internal plugin token (HMAC)
    // 4. Create IsolatedVmContext
    // 5. Execute handler in isolated-vm
    // 6. Return boolean result
    throw new Error('Not implemented');
  }
}
```

### 4.5 内部認証（`auth.service.ts`に追加）

```typescript
import crypto from 'crypto';
import { getRedis } from '../db/redis.js';

/**
 * Generate HMAC token for plugin-to-core API calls
 * Token format: base64(pluginId:tenantId:timestamp:nonce).signature
 *
 * @param pluginId - Plugin identifier
 * @param tenantId - Tenant identifier
 * @param secret - HMAC secret (from env PLUGIN_INTERNAL_SECRET)
 * @returns Token string
 */
export function generatePluginToken(
  pluginId: string,
  tenantId: string,
  secret: string
): string {
  // 1. Generate cryptographically secure nonce (UUIDv4)
  const nonce = crypto.randomUUID();

  // 2. Get current timestamp (Unix seconds)
  const timestamp = Math.floor(Date.now() / 1000);

  // 3. Create payload: pluginId:tenantId:timestamp:nonce
  const payload = `${pluginId}:${tenantId}:${timestamp}:${nonce}`;

  // 4. Generate HMAC-SHA256 signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const signature = hmac.digest('base64');

  // 5. Return token: base64(payload).signature
  const token = `${Buffer.from(payload).toString('base64')}.${signature}`;

  return token;
}

/**
 * Verify HMAC token for internal API calls
 *
 * Anti-replay measures:
 * - Nonce storage: Redis (primary), DB table (fallback)
 * - Nonce TTL: 5min validity window + 30s clock skew
 * - Clock skew tolerance: ±30s on top of 5min window
 *
 * @param token - Token to verify
 * @param secret - HMAC secret (from env PLUGIN_INTERNAL_SECRET)
 * @returns Parsed token data or null if invalid
 */
export async function verifyPluginToken(
  token: string,
  secret: string
): Promise<{ pluginId: string; tenantId: string; nonce: string } | null> {
  try {
    // 1. Parse token format: base64(payload).signature
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) {
      return null;
    }

    // 2. Decode payload
    const payload = Buffer.from(payloadB64, 'base64').toString('utf-8');
    const [pluginId, tenantId, timestampStr, nonce] = payload.split(':');

    if (!pluginId || !tenantId || !timestampStr || !nonce) {
      return null;
    }

    // 3. Verify HMAC signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('base64');

    if (signature !== expectedSignature) {
      return null; // Invalid signature
    }

    // 4. Check timestamp with clock skew tolerance
    const timestamp = parseInt(timestampStr, 10);
    const now = Math.floor(Date.now() / 1000);
    const validityWindow = 5 * 60; // 5 minutes
    const clockSkew = 30; // ±30 seconds

    const minValidTimestamp = now - validityWindow - clockSkew;
    const maxValidTimestamp = now + validityWindow + clockSkew;

    if (timestamp < minValidTimestamp || timestamp > maxValidTimestamp) {
      return null; // Token expired or clock skew too large
    }

    // 5. Check nonce reuse (anti-replay)
    const nonceKey = `plugin:nonce:${pluginId}:${tenantId}:${nonce}`;
    const ttl = validityWindow + clockSkew; // Auto-expire after validity window

    const redis = getRedis();

    // Try Redis first (primary store)
    if (redis) {
      const exists = await redis.get(nonceKey);
      if (exists) {
        return null; // Nonce already used (replay attack)
      }
      // Store nonce with TTL
      await redis.set(nonceKey, '1', 'EX', ttl);
    } else {
      // Fallback to DB table (plugin_nonces)
      const db = getDb();
      const existingNonce = await db
        .select()
        .from(schema.pluginNonces)
        .where(
          and(
            eq(schema.pluginNonces.pluginId, pluginId),
            eq(schema.pluginNonces.tenantId, tenantId),
            eq(schema.pluginNonces.nonce, nonce)
          )
        )
        .limit(1);

      if (existingNonce.length > 0) {
        return null; // Nonce already used (replay attack)
      }

      // Store nonce in DB
      await db.insert(schema.pluginNonces).values({
        nonceId: crypto.randomUUID(),
        pluginId,
        tenantId,
        nonce,
        createdAt: new Date(),
      });

      // Note: DB cleanup is handled by periodic GC job (see below)
    }

    return { pluginId, tenantId, nonce };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Middleware: Require plugin authentication
 *
 * @param request - HTTP request
 * @returns Plugin and tenant identifiers
 * @throws 401 if authentication fails
 */
export async function requirePluginAuth(
  request: Request
): Promise<{ pluginId: string; tenantId: string }> {
  // 1. Extract Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  // 2. Verify HMAC token
  const secret = process.env.PLUGIN_INTERNAL_SECRET;
  if (!secret) {
    throw new Error('PLUGIN_INTERNAL_SECRET is not configured');
  }

  const result = await verifyPluginToken(token, secret);

  if (!result) {
    throw new Response('Invalid or expired token', { status: 401 });
  }

  // 3. Return pluginId, tenantId
  return { pluginId: result.pluginId, tenantId: result.tenantId };
}

/**
 * Periodic GC job for cleaning up expired nonces in DB
 * (Only needed if Redis is unavailable)
 *
 * Schedule: Run every 10 minutes via BullMQ
 */
export async function cleanupExpiredNonces(): Promise<void> {
  const db = getDb();
  const validityWindow = 5 * 60; // 5 minutes
  const clockSkew = 30; // 30 seconds
  const ttl = validityWindow + clockSkew;

  const cutoffDate = new Date(Date.now() - ttl * 1000);

  await db
    .delete(schema.pluginNonces)
    .where(lt(schema.pluginNonces.createdAt, cutoffDate));
}
```

**Nonce管理戦略:**

1. **Nonce生成**: `crypto.randomUUID()`（暗号学的に安全なUUIDv4）
2. **プライマリストア**: Redis（`plugin:nonce:{pluginId}:{tenantId}:{nonce}`、TTL: 5min + 30s）
3. **フォールバック**: DB table `plugin_nonces`（indexed on `created_at`）
4. **クロックスキュー許容**: ±30s（5分ウィンドウの上下に追加）
5. **自動クリーンアップ**:
   - Redis: TTL auto-expire
   - DB: Periodic GC job (every 10min)

**タイムスタンプ検証ウィンドウ:**
```
[timestamp - 5min - 30s, timestamp + 5min + 30s]
```

**DBスキーマ（`plugin_nonces`テーブル）:**
```sql
CREATE TABLE plugin_nonces (
  nonce_id UUID PRIMARY KEY,
  plugin_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  nonce VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  INDEX idx_plugin_nonces_created_at (created_at),
  UNIQUE INDEX idx_plugin_nonces_composite (plugin_id, tenant_id, nonce)
);
```

### 4.6 コアAPI（プラグイン認証ミドルウェア適用）

プラグインからのすべての内部API呼び出しは、`requirePluginAuth()`ミドルウェアで認証されます。

**例: プラグインイベント登録API（`api.plugin-events.ts`）**

```typescript
/**
 * POST /api/plugin-events
 * Insert plugin event data into plugin_events_raw table
 */
export async function action({ request }: ActionFunctionArgs) {
  // 1. Verify plugin authentication (requirePluginAuth)
  const { pluginId, tenantId } = await requirePluginAuth(request);

  // 2. Parse request body
  const body = await request.json();

  // 3. Validate schema (eventType, rawData, metadata)
  const validation = PluginEventSchema.safeParse(body);
  if (!validation.success) {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  // 4. Insert into plugin_events_raw table
  await withTenantContext(tenantId, async (tx) => {
    await tx.insert(schema.pluginEventsRaw).values({
      eventId: crypto.randomUUID(),
      pluginId,
      tenantId,
      eventType: validation.data.eventType,
      rawData: validation.data.rawData,
      metadata: validation.data.metadata,
      ingestedAt: new Date(),
    });
  });

  // 5. Return 201 Created
  return json({ success: true }, { status: 201 });
}
```

**他のコアAPIも同様に利用可能:**
- `POST /api/activities` - Create activity
- `GET /api/developers` - List developers
- `POST /api/campaigns` - Create campaign
- etc.

プラグインは`capabilities.scopes`で宣言されたスコープに基づいてアクセス制御されます。

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
   - Load plugin settings (webhook_secret)

3. WebhookVerifier
   - Verify GitHub signature
   - Return 401 if invalid

4. WebhookExecutor
   - Load handler code (plugins/github/handlers/webhook.js)
   - Generate plugin token (HMAC)
   - Create IsolatedVmContext

5. IsolatedVmRunner
   - Create sandbox with context
   - Execute handler with timeout
   - Return boolean result

6. Plugin Handler (in sandbox)
   - Parse webhook payload
   - Call httpClient.post('/api/plugin-events', {...})
   - Return true on success

7. PluginHttpClient
   - POST /api/plugin-events with HMAC token
   - Core API verifies token (requirePluginAuth)
   - Check nonce reuse (Redis/DB)
   - Insert into plugin_events_raw table

8. WebhookController
   - Return 200 OK (if true)
   - Return 500 Internal Error (if false/error)

**Note:** プラグインは`/api/plugin-events`だけでなく、すべてのコアAPI（`/api/*`）にアクセス可能です。
アクセス制御は`capabilities.scopes`で管理されます。
```

---

## 6. セキュリティ設計

### 6.1 サンドボックス制約

isolated-vmで以下を制限：

- **ネットワークアクセス制限** - `httpClient`経由のみ、`capabilities.network`で許可されたドメインのみ
- **ファイルシステムアクセス禁止** - `fs`, `path`モジュール不可
- **プロセス操作禁止** - `child_process`, `cluster`モジュール不可
- **タイマー制限** - `setTimeout`, `setInterval`は使用不可
- **メモリ制限** - デフォルト32MB
- **CPU時間制限** - デフォルト5秒

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

### 6.3 レート制限

- Webhookエンドポイント: **100 req/min/plugin** (IP-based)
- 内部API（`/api/*`）: **1000 req/min/plugin** (token-based)

---

## 7. エラーハンドリング

### 7.1 HTTPステータスコード

| ステータス | 条件 | レスポンス |
|-----------|------|----------|
| 200 OK | Handler returned `true` | `{ "success": true }` |
| 400 Bad Request | Invalid webhook payload | `{ "error": "Invalid payload" }` |
| 401 Unauthorized | Signature verification failed | `{ "error": "Invalid signature" }` |
| 404 Not Found | Plugin or route not found | `{ "error": "Route not found" }` |
| 408 Request Timeout | Handler execution timeout | `{ "error": "Execution timeout" }` |
| 500 Internal Error | Handler returned `false` or threw error | `{ "error": "Handler execution failed" }` |
| 503 Service Unavailable | Plugin disabled | `{ "error": "Plugin is disabled" }` |

### 7.2 プラグインエラー処理

```typescript
// Plugin handler must return boolean
export async function handleWebhook(context) {
  try {
    // Process webhook
    await context.httpClient.post('/api/plugin-events', {...});
    return true; // Success
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return false; // Failure
  }
}
```

---

## 8. テストプラグイン例

### 8.1 plugin.json

```json
{
  "id": "github",
  "name": "GitHub",
  "version": "1.0.0",
  "capabilities": {
    "scopes": ["write:activities"],
    "network": ["https://api.github.com"],
    "secrets": ["github_token", "webhook_secret"]
  },
  "settingsSchema": [
    {
      "key": "webhook_secret",
      "label": "Webhook Secret",
      "type": "secret",
      "required": true,
      "hint": "GitHub Webhook Secret"
    }
  ],
  "routes": [
    {
      "method": "POST",
      "path": "/webhook/push",
      "auth": "public",
      "verify": {
        "type": "githubWebhook",
        "secretKey": "webhook_secret"
      },
      "handler": "handlers/github-webhook.js",
      "timeoutSec": 10
    }
  ]
}
```

### 8.2 handlers/github-webhook.js

```javascript
/**
 * GitHub Push Webhook Handler
 * @param {object} context - Execution context
 * @param {string} context.tenantId - Tenant ID
 * @param {string} context.pluginId - Plugin ID
 * @param {object} context.request - Request object
 * @param {object} context.httpClient - Internal HTTP client
 * @returns {boolean} - true on success, false on failure
 */
export async function handleWebhook(context) {
  const payload = context.request.body;

  // Validate payload
  if (!payload || !payload.repository) {
    console.error('Invalid webhook payload');
    return false;
  }

  try {
    // Example: Fetch additional data from GitHub API (optional)
    // This is allowed because https://api.github.com is in capabilities.network
    const repoUrl = `https://api.github.com/repos/${payload.repository.full_name}`;
    const repoResponse = await context.httpClient.get(repoUrl);
    const repoData = await repoResponse.json();

    // Prepare event data
    const eventData = {
      eventType: 'github.push',
      rawData: payload,
      metadata: {
        repository: payload.repository.full_name,
        ref: payload.ref,
        commits: payload.commits.length,
        stars: repoData.stargazers_count, // Additional data from GitHub API
      },
    };

    // Call core API to store event (internal API with HMAC token)
    const response = await context.httpClient.post(
      '/api/plugin-events',
      eventData
    );

    if (!response.ok) {
      console.error('Failed to store event:', response.status);
      return false;
    }

    return true; // Success
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return false;
  }
}
```

---

## 9. 実装チェックリスト

### 9.1 コア実装

- [ ] **Webhook署名検証** (`core/plugin-system/auth/webhook-verifier.ts`)
  - [ ] `WebhookVerifier` interface
  - [ ] `GitHubWebhookVerifier` class (HMAC-SHA256)
  - [ ] `SlackWebhookVerifier` class (HMAC-SHA256 + timestamp)
  - [ ] `createVerifier()` factory function

- [ ] **isolated-vm Runner** (`core/plugin-system/sandbox/isolated-vm-runner.ts`)
  - [ ] `IsolatedVmRunner` class
  - [ ] Sandbox context creation
  - [ ] Memory/CPU/timeout limits
  - [ ] Error handling

- [ ] **HTTP Client** (`core/plugin-system/sandbox/http-client.ts`)
  - [ ] `PluginHttpClient` class
  - [ ] POST method (internal: all `/api/*` paths, external: allowed domains)
  - [ ] GET method (external: allowed domains only)
  - [ ] HMAC token injection (internal API only)
  - [ ] Domain validation (capabilities.network)
  - [ ] PUT/DELETE methods blocked

- [ ] **Webhook Executor** (`core/plugin-system/webhook-executor.ts`)
  - [ ] `WebhookExecutor` class
  - [ ] Signature verification
  - [ ] Handler loading
  - [ ] Token generation
  - [ ] isolated-vm execution

- [ ] **内部認証** (`core/services/auth.service.ts`)
  - [ ] `generatePluginToken()` function (with nonce generation)
  - [ ] `verifyPluginToken()` function (with nonce verification + timestamp check)
  - [ ] `requirePluginAuth()` middleware
  - [ ] `cleanupExpiredNonces()` periodic GC job

- [ ] **Nonce管理** (`core/db/schema/admin.ts`)
  - [ ] `plugin_nonces` table schema (nonce_id, plugin_id, tenant_id, nonce, created_at)
  - [ ] Indexes (created_at, composite unique index)
  - [ ] Migration script

- [ ] **プラグインイベント登録API** (`core/app/routes/api.plugin-events.ts`)
  - [ ] POST handler
  - [ ] Authentication verification
  - [ ] Schema validation
  - [ ] Database insertion

- [ ] **Webhook受信API** (`core/app/routes/api.plugins_.$id.webhooks.$.ts`)
  - [ ] POST handler
  - [ ] Plugin lookup
  - [ ] Route matching
  - [ ] WebhookExecutor invocation
  - [ ] HTTP status code mapping

### 9.2 テストプラグイン

- [ ] **plugin.json定義**
  - [ ] routes フィールド
  - [ ] verify 設定

- [ ] **Webhookハンドラー**
  - [ ] handlers/github-webhook.js
  - [ ] Payload parsing
  - [ ] Internal API call

### 9.3 単体テスト（Vitest）

- [ ] **webhook-verifier.test.ts**
  - [ ] GitHub signature verification (valid/invalid)
  - [ ] Slack signature verification (valid/invalid/expired)

- [ ] **isolated-vm-runner.test.ts**
  - [ ] Successful execution
  - [ ] Timeout handling
  - [ ] Memory limit handling
  - [ ] Error handling

- [ ] **http-client.test.ts**
  - [ ] POST to internal API (all `/api/*` paths allowed)
  - [ ] POST to allowed external domain (allowed)
  - [ ] POST to disallowed external domain (should throw)
  - [ ] GET to allowed external domain (allowed)
  - [ ] GET to disallowed external domain (should throw)
  - [ ] GET to internal API (should throw)
  - [ ] PUT/DELETE blocked

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

### 9.4 E2Eテスト（Playwright）

- [ ] **plugin-webhooks.spec.ts**
  - [ ] Webhook reception (valid signature)
  - [ ] Webhook rejection (invalid signature)
  - [ ] Data storage in plugin_events_raw
  - [ ] Timeout handling
  - [ ] Error responses

---

## 10. 注意事項

### 10.1 isolated-vm制約

- **Node.jsモジュール不可**: `require()`, `import`は使用不可（事前バンドル必要）
- **非同期処理制限**: `Promise`は使用可、`async/await`も可
- **コンテキスト注入**: `context`オブジェクト経由でのみコア機能アクセス
- **グローバル汚染禁止**: サンドボックス内でグローバル変数変更不可
- **ネットワークアクセス**: `httpClient`経由のみ、`capabilities.network`で許可されたドメインのみ

### 10.2 Webhook署名検証

- **GitHub**: `X-Hub-Signature-256` ヘッダー（HMAC-SHA256）
- **Slack**: `X-Slack-Signature` + `X-Slack-Request-Timestamp` ヘッダー（HMAC-SHA256、5分窓）

### 10.3 トークンセキュリティ

- **短寿命**: デフォルト5分（タイムスタンプチェック）
- **クロックスキュー許容**: ±30秒（分散環境対応）
- **ノンス**: `crypto.randomUUID()`で生成、Redis/DBで重複検証
- **HMAC署名**: HMAC-SHA256で改ざん検知
- **リプレイアタック対策**:
  - Nonce storage: Redis (primary, TTL auto-expire) + DB (fallback, GC job)
  - Nonce reuse detection: Same nonce rejected immediately
  - Validity window: `[timestamp - 5min - 30s, timestamp + 5min + 30s]`

### 10.4 エラーログ

- **plugin_runs**: Webhook実行の成功/失敗を記録
- **Error details**: 失敗時は`errorMessage`フィールドに詳細を保存

---

## 11. 完了条件

- [ ] すべてのコア実装が完了している
- [ ] テストプラグインが動作する（GitHub Webhook受信 → データ保存）
- [ ] 単体テストが全てパスする
- [ ] E2Eテストが全てパスする
- [ ] ドキュメントが完成している

---

## 12. 参考リンク

- [isolated-vm Documentation](https://github.com/laverdet/isolated-vm)
- [GitHub Webhook Verification](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [Slack Webhook Verification](https://api.slack.com/authentication/verifying-requests-from-slack)
- [HMAC Authentication Best Practices](https://www.rfc-editor.org/rfc/rfc2104)

---

**実装方針:**
- **フェーズ1**: Webhook署名検証 + 内部認証（2h）
- **フェーズ2**: isolated-vm Runner + HTTP Client（ドメイン検証付き）（3h）
- **フェーズ3**: Webhook Executor + API実装（2h）
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
