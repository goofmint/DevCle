# Task 8.4: Plugin 管理 API 実装

## 概要

プラグインの管理（一覧取得、有効化/無効化、設定取得、実行ログ取得）を行うための REST API を実装します。

このタスクでは、以下の API エンドポイントを提供します：

- `GET /api/plugins` - インストール済みプラグイン一覧
- `PUT /api/plugins/:id` - プラグイン有効化
- `DELETE /api/plugins/:id` - プラグイン無効化
- `GET /api/plugins/:id` - プラグイン設定取得
- `GET /api/plugins/:id/logs` - プラグイン実行ログ取得

## API 仕様

### 1. GET /api/plugins - プラグイン一覧取得

テナントに属するすべてのプラグインを取得します。

```typescript
/**
 * GET /api/plugins
 *
 * Response: PluginListResponse
 */
interface PluginListResponse {
  plugins: PluginInfo[];
}

interface PluginInfo {
  /** Plugin UUID */
  pluginId: string;

  /** Plugin key (unique identifier) */
  key: string;

  /** Plugin display name */
  name: string;

  /** Plugin version */
  version: string;

  /** Whether plugin is enabled */
  enabled: boolean;

  /** Plugin configuration (JSON) */
  config: unknown;

  /** Installation timestamp (ISO 8601) */
  installedAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}
```

### 2. PUT /api/plugins/:id - プラグイン有効化

指定したプラグインを有効化します。

```typescript
/**
 * PUT /api/plugins/:id
 *
 * Request: EnablePluginRequest
 * Response: PluginActionResponse
 */
interface EnablePluginRequest {
  /** Optional plugin configuration to update */
  config?: unknown;
}

interface PluginActionResponse {
  /** Success status */
  success: boolean;

  /** Updated plugin info */
  plugin: PluginInfo;
}
```

### 3. DELETE /api/plugins/:id - プラグイン無効化

指定したプラグインを無効化します。

```typescript
/**
 * DELETE /api/plugins/:id
 *
 * Response: PluginActionResponse
 */
// Uses same PluginActionResponse interface as above
```

### 4. GET /api/plugins/:id - プラグイン設定取得

指定したプラグインの詳細情報を取得します。

```typescript
/**
 * GET /api/plugins/:id
 *
 * Response: PluginDetailResponse
 */
interface PluginDetailResponse {
  /** Plugin information */
  plugin: PluginInfo;

  /** Registered hooks */
  hooks: PluginHookInfo[];

  /** Registered jobs */
  jobs: PluginJobInfo[];
}

interface PluginHookInfo {
  /** Hook name (e.g., 'developer.created') */
  hookName: string;

  /** Priority (lower = higher priority) */
  priority: number;
}

interface PluginJobInfo {
  /** Job name */
  jobName: string;

  /** Cron expression (if recurring) */
  cron?: string;

  /** Last execution timestamp (ISO 8601) */
  lastRun?: string;

  /** Next scheduled execution (ISO 8601) */
  nextRun?: string;
}
```

### 5. GET /api/plugins/:id/logs - 実行ログ取得

指定したプラグインの実行ログを取得します。

```typescript
/**
 * GET /api/plugins/:id/logs
 *
 * Query parameters:
 * - limit: number (default: 50, max: 100)
 * - offset: number (default: 0)
 * - status: 'running' | 'success' | 'failed' (optional filter)
 *
 * Response: PluginLogsResponse
 */
interface PluginLogsResponse {
  /** Log entries */
  logs: PluginLogEntry[];

  /** Total count (for pagination) */
  total: number;

  /** Pagination info */
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface PluginLogEntry {
  /** Run ID (UUID) */
  runId: string;

  /** Hook or job name */
  hookName: string;

  /** Execution status */
  status: 'running' | 'success' | 'failed';

  /** Start timestamp (ISO 8601) */
  startedAt: string;

  /** Finish timestamp (ISO 8601, null if still running) */
  finishedAt: string | null;

  /** Execution duration in milliseconds (null if still running) */
  duration: number | null;

  /** Error message (if failed) */
  error?: string;

  /** Result data (JSON, if available) */
  result?: unknown;
}
```

## データベーススキーマ

このタスクで使用する既存のテーブル：

### plugins テーブル

```typescript
/**
 * plugins テーブル (既存)
 *
 * インストール済みプラグインの情報を保存
 */
interface PluginsTable {
  pluginId: string;      // UUID (primary key)
  tenantId: string;      // Tenant ID (for RLS)
  key: string;           // Plugin key (unique per tenant)
  name: string;          // Display name
  version: string;       // Plugin version
  enabled: boolean;      // Enable/disable flag
  config: unknown;       // Plugin configuration (JSON)
  installedAt: Date;     // Installation timestamp
  updatedAt: Date;       // Last update timestamp
}
```

### plugin_runs テーブル

```typescript
/**
 * plugin_runs テーブル (既存)
 *
 * プラグインの実行履歴を保存
 */
interface PluginRunsTable {
  runId: string;         // UUID (primary key)
  pluginId: string;      // Plugin UUID (foreign key)
  tenantId: string;      // Tenant ID (for RLS)
  hookName: string;      // Hook or job name
  status: string;        // 'running' | 'success' | 'failed'
  startedAt: Date;       // Start timestamp
  finishedAt: Date | null; // Finish timestamp
  duration: number | null; // Duration in milliseconds
  error: string | null;  // Error message
  result: unknown;       // Result data (JSON)
}
```

## 実装ファイル

### app/routes/api/plugins.ts

```typescript
/**
 * Plugin Management API Routes
 *
 * Provides REST API for plugin management:
 * - List plugins
 * - Enable/disable plugins
 * - Get plugin settings
 * - Get execution logs
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireAuth } from '~/auth/session.server';

/**
 * GET /api/plugins
 *
 * List all plugins for current tenant
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // 1. Authenticate user and get tenant ID
  // 2. Query plugins table with RLS (withTenantContext)
  // 3. Return plugin list
}

/**
 * PUT /api/plugins/:id - Enable plugin
 * DELETE /api/plugins/:id - Disable plugin
 *
 * Handle plugin enable/disable actions
 */
export async function action({ request, params }: ActionFunctionArgs) {
  // 1. Authenticate user and get tenant ID
  // 2. Parse request method (PUT = enable, DELETE = disable)
  // 3. Validate plugin ID
  // 4. Update plugins table (enabled flag) with RLS
  // 5. Return updated plugin info
}
```

### app/routes/api/plugins.$id.ts

```typescript
/**
 * Plugin Detail API Route
 *
 * GET /api/plugins/:id - Get plugin details
 */

import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireAuth } from '~/auth/session.server';

/**
 * GET /api/plugins/:id
 *
 * Get plugin details including hooks and jobs
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  // 1. Authenticate user and get tenant ID
  // 2. Validate plugin ID
  // 3. Query plugins table with RLS
  // 4. Query plugin_hooks table for registered hooks
  // 5. Query job scheduler for registered jobs
  // 6. Return combined plugin detail
}
```

### app/routes/api/plugins.$id.logs.ts

```typescript
/**
 * Plugin Logs API Route
 *
 * GET /api/plugins/:id/logs - Get plugin execution logs
 */

import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireAuth } from '~/auth/session.server';

/**
 * GET /api/plugins/:id/logs
 *
 * Get plugin execution logs with pagination
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  // 1. Authenticate user and get tenant ID
  // 2. Parse query parameters (limit, offset, status filter)
  // 3. Validate pagination parameters (max limit: 100)
  // 4. Query plugin_runs table with RLS
  // 5. Calculate duration for completed runs
  // 6. Return paginated logs with total count
}
```

## エラーハンドリング

```typescript
/**
 * API Error Response
 */
interface ApiErrorResponse {
  /** Error status code */
  status: number;

  /** Error message */
  message: string;

  /** Error code (for client-side handling) */
  code?: string;
}

// Common error scenarios:
// - 401: Unauthorized (not authenticated)
// - 403: Forbidden (plugin not in tenant)
// - 404: Plugin not found
// - 422: Invalid request parameters
// - 500: Internal server error
```

## セキュリティ要件

1. **認証**: すべての API エンドポイントで `requireAuth()` による認証を必須とする
2. **テナント分離**: RLS による自動的なテナント分離を使用（`withTenantContext()`）
3. **バリデーション**: 以下のパラメータを厳密に検証
   - **Plugin ID**: UUID 形式（正規表現: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`）であることを検証
   - **Pagination `limit`**: 整数型、1 以上 100 以下（inclusive）、ドキュメントに記載の最大値 100 を超えない
   - **Pagination `offset`**: 整数型、0 以上
4. **CSRF 保護**: 状態変更を伴うエンドポイント（PUT, DELETE）は以下のいずれかの方法で CSRF 攻撃を防止
   - **オプション A (推奨)**: CSRF トークン検証
     - ログイン時にセッションごとの CSRF トークンを生成し、セッションストアに保存
     - フォーム送信時に `X-CSRF-Token` ヘッダーまたはリクエストボディに含める
     - サーバー側でセッション内のトークンと照合（一致しない場合は 403 Forbidden）
   - **オプション B**: SameSite Cookie + メソッド制限 + カスタムヘッダー
     - セッション Cookie に `SameSite=Strict` または `SameSite=Lax` を設定
     - 状態変更は GET メソッドを使用しない（PUT, DELETE, POST のみ）
     - カスタムヘッダー（例: `X-Requested-With: XMLHttpRequest`）の存在を検証（クロスオリジンリクエストでは送信できない）
5. **レート制限**: 将来的に実装（現時点では未実装）

## テスト要件

### 統合テスト (Vitest)

```typescript
/**
 * app/routes/api/plugins.test.ts
 *
 * Test scenarios:
 * - List plugins for authenticated user
 * - Enable/disable plugin
 * - Get plugin details
 * - Get execution logs with pagination
 * - Error handling (401, 403, 404)
 * - Tenant isolation (cannot access other tenant's plugins)
 */
```

### E2E テスト (Playwright)

```typescript
/**
 * e2e/plugin-management.spec.ts
 *
 * Test scenarios:
 * - Load plugin management page
 * - Enable plugin via API
 * - Disable plugin via API
 * - View plugin logs
 * - Pagination in logs view
 */
```

## 依存関係

- **Task 8.1**: Plugin Loader (plugins テーブル)
- **Task 8.2**: Hook Registry (plugin_hooks テーブル)
- **Task 8.3**: Job Scheduler (Job registration)
- **既存**: Authentication system (`requireAuth()`)
- **既存**: Database connection with RLS (`withTenantContext()`)

## 完了条件

- [x] API エンドポイントがすべて実装されている
- [x] 認証とテナント分離が正しく動作する
- [x] プラグインの有効化/無効化が機能する
- [x] 実行ログが正しく取得できる
- [x] ページネーションが正しく動作する
- [x] すべてのテストが通過する（モックなし）
- [x] TypeScript の型エラーがない

## 推定時間

3 時間
