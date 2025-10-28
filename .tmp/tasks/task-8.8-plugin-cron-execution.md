# Task 8.8: プラグインの Cron 実行と結果確認

## 概要

プラグインの cron ジョブを実行し、その結果を記録・確認できるようにする。
手動実行機能と実行スケジュールの管理 UI を提供し、プラグインの実行状況を可視化する。

## 目的

- プラグインの `plugin.json` に定義された cron ジョブを自動実行する
- 実行結果を `plugin_runs` テーブルに記録する
- 手動実行機能を提供する（テスト・デバッグ用）
- 実行スケジュールを管理 UI で確認できるようにする（読み取り専用）
- 実行結果のサマリーを表示する

**重要**: cron スケジュールは `plugin.json` の `jobs[]` に定義されており、DB に保存する必要はありません。UI は plugin.json から読み取った設定を表示するのみです。

## 関連テーブル

### plugin_runs

Task 3.2 で既に実装済み（`core/db/schema/plugins.ts`）

```typescript
// Schema (既存)
export const pluginRuns = pgTable('plugin_runs', {
  runId: uuid('run_id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  pluginId: uuid('plugin_id').notNull().references(() => plugins.pluginId, { onDelete: 'cascade' }),
  jobName: text('job_name').notNull(),
  status: text('status').notNull(), // 'pending' | 'running' | 'success' | 'failed'
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  eventsProcessed: integer('events_processed').default(0),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'), // { cursor, retryCount, etc. }
});
```

## 実装内容

### 設計方針

- **cron スケジュールの定義**: `plugin.json` の `jobs[]` に記述（DB 保存不要）
- **実行記録**: `plugin_runs` テーブルに実行履歴を保存
- **UI の役割**:
  - `plugin.json` から設定を読み取って表示（読み取り専用）
  - 実行履歴と結果を表示（`plugin_runs` テーブルから取得）
  - 手動実行トリガー（テスト・デバッグ用）

### 1. プラグイン cron ジョブ実行機能

**場所**: `core/plugin-system/executor.ts`（新規作成）

```typescript
/**
 * Execute a plugin job manually or via cron scheduler
 *
 * Returns a minimal result. Caller should fetch the full PluginRun record
 * from plugin-run.service.ts using getPluginRun(runId) for complete details.
 */
export async function executePluginJob(
  tenantId: string,
  pluginId: string,
  jobName: string,
  metadata?: PluginRunMetadata
): Promise<PluginRunResult>;

/**
 * Minimal result returned by executePluginJob.
 * For complete details (tenantId, pluginId, jobName, startedAt, completedAt, metadata),
 * fetch the full PluginRun record using getPluginRun(runId).
 */
interface PluginRunResult {
  runId: string;              // Run ID (for fetching full record)
  status: 'success' | 'failed';
  eventsProcessed: number;
  errorMessage?: string;
  duration: number;           // ms
  metadata?: PluginRunMetadata; // Updated metadata (cursor, retryCount, etc.)
}
```

**説明**:
- プラグインの `plugin.json` に定義された `jobs` の設定を読み取る
  ```json
  {
    "jobs": [
      {
        "name": "sync",
        "route": "/sync",
        "cron": "0 */6 * * *",
        "timeoutSec": 120,
        "concurrency": 1,
        "retry": { "max": 5, "backoffSec": [10, 30, 60, 120, 300] },
        "cursor": { "key": "github_sync_cursor", "ttlSec": 604800 }
      }
    ]
  }
  ```
- `jobs[].route` にリクエストを送信（例: `POST /plugins/:id/sync`）
- `plugin_runs` テーブルに実行前にレコード作成（status: 'pending'）
- 実行中は status: 'running' に更新
- 完了後は status: 'success' | 'failed' に更新し、`completedAt`、`eventsProcessed`、`errorMessage` を記録
- タイムアウト制御（`jobs[].timeoutSec`）
- リトライ制御（`jobs[].retry.max` と `jobs[].retry.backoffSec`）
- カーソル管理（`jobs[].cursor`）で前回実行からの差分取得（Redis に保存、TTL 付き）
- 同時実行制御（`jobs[].concurrency`）

**Metadata 構造と使用方法**:

```typescript
/**
 * Metadata stored in plugin_runs.metadata (JSONB)
 */
interface PluginRunMetadata {
  cursor?: string;           // Checkpoint for incremental sync (e.g., last_sync_timestamp, next_page_token)
  retryCount?: number;       // Number of retries attempted (incremented on transient failures)
  lastRunAt?: string;        // ISO timestamp of last successful run (ISO 8601 format)
  error?: string;            // Error message from last failed attempt (for debugging)
  [key: string]: unknown;    // Plugin-specific custom fields
}
```

**Metadata の読み書き**:
1. **実行前（executePluginJob）**:
   - `plugin_runs` テーブルから最新の成功した run の `metadata` を取得
   - `metadata.cursor` を使用して、前回実行から の差分データを取得（例: `since=metadata.cursor`）

2. **実行中**:
   - プラグインの `/sync` ルートにリクエストを送信
   - リクエストボディに `metadata` を含める（例: `{ cursor: "2025-10-28T10:00:00Z" }`）
   - プラグインは `cursor` から差分データを取得し、新しい `cursor` を返す

3. **実行後**:
   - プラグインから返された新しい `cursor` を `metadata.cursor` に保存
   - `metadata.lastRunAt` を現在時刻に更新
   - 成功時: `metadata.retryCount` をリセット（0）
   - 失敗時: `metadata.retryCount` をインクリメント、`metadata.error` にエラーメッセージを記録

4. **永続化**:
   - `completePluginRun()` で `metadata` を `plugin_runs` テーブルに保存
   - 次回実行時に同じ `metadata` から再開可能（idempotent）

**例**:
```typescript
// Before execution
const lastRun = await getLastSuccessfulRun(tenantId, pluginId, jobName);
const metadata: PluginRunMetadata = lastRun?.metadata ?? { cursor: null, retryCount: 0 };

// Execute plugin route
const response = await fetch(`/plugins/${pluginId}/sync`, {
  method: 'POST',
  body: JSON.stringify({ cursor: metadata.cursor }),
});

// Update metadata
const newMetadata: PluginRunMetadata = {
  cursor: response.cursor,  // New checkpoint from plugin
  retryCount: 0,
  lastRunAt: new Date().toISOString(),
};

// Save to database
await completePluginRun(tenantId, runId, {
  status: 'success',
  eventsProcessed: response.eventsProcessed,
  metadata: newMetadata,
});
```

### 2. 実行結果の記録

**場所**: `core/services/plugin-run.service.ts`（新規作成）

```typescript
/**
 * Create a new plugin run record (status: 'pending')
 */
export async function createPluginRun(
  tenantId: string,
  pluginId: string,
  jobName: string
): Promise<string>; // runId

/**
 * Update plugin run status to 'running'
 */
export async function startPluginRun(runId: string): Promise<void>;

/**
 * Update plugin run status to 'success' or 'failed' with results
 */
export async function completePluginRun(
  runId: string,
  result: {
    status: 'success' | 'failed';
    eventsProcessed: number;
    errorMessage?: string;
  }
): Promise<void>;

/**
 * Get plugin run details
 */
export async function getPluginRun(runId: string): Promise<PluginRun | null>;

/**
 * List plugin runs for a plugin (with pagination, filtering)
 */
export async function listPluginRuns(
  tenantId: string,
  pluginId: string,
  options?: {
    status?: 'pending' | 'running' | 'success' | 'failed';
    jobName?: string;
    limit?: number;
    offset?: number;
    sort?: 'asc' | 'desc'; // by startedAt
  }
): Promise<{ runs: PluginRun[]; total: number }>;

interface PluginRun {
  runId: string;
  tenantId: string;
  pluginId: string;
  jobName: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt: Date;
  completedAt: Date | null;
  eventsProcessed: number;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
}
```

**説明**:
- `withTenantContext()` を使用して RLS 対応
- `plugin_runs` テーブルに CRUD 操作を実行
- Zod スキーマでバリデーション

**withTenantContext() 使用例**:

```typescript
import { withTenantContext } from '~/db/connection.js';
import { db } from '~/db/connection.js';
import * as schema from '~/db/schema/index.js';

/**
 * Create a new plugin run (status: 'pending')
 * @param tenantId - Required, must be non-empty string (validated before calling withTenantContext)
 */
export async function createPluginRun(
  tenantId: string,
  pluginId: string,
  jobName: string
): Promise<string> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenantId is required and must be a non-empty string');
  }

  return await withTenantContext(tenantId, async (tx) => {
    const [run] = await tx
      .insert(schema.pluginRuns)
      .values({
        tenantId,
        pluginId,
        jobName,
        status: 'pending',
      })
      .returning({ runId: schema.pluginRuns.runId });

    return run.runId;
  });
}

/**
 * Update plugin run status to 'running'
 * @param tenantId - Derived from request/session context
 */
export async function startPluginRun(tenantId: string, runId: string): Promise<void> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenantId is required and must be a non-empty string');
  }

  await withTenantContext(tenantId, async (tx) => {
    await tx
      .update(schema.pluginRuns)
      .set({ status: 'running' })
      .where(eq(schema.pluginRuns.runId, runId));
  });
}

/**
 * Update plugin run status to 'success' or 'failed' with results
 */
export async function completePluginRun(
  tenantId: string,
  runId: string,
  result: { status: 'success' | 'failed'; eventsProcessed: number; errorMessage?: string }
): Promise<void> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenantId is required and must be a non-empty string');
  }

  await withTenantContext(tenantId, async (tx) => {
    await tx
      .update(schema.pluginRuns)
      .set({
        status: result.status,
        completedAt: new Date(),
        eventsProcessed: result.eventsProcessed,
        errorMessage: result.errorMessage ?? null,
      })
      .where(eq(schema.pluginRuns.runId, runId));
  });
}

/**
 * List plugin runs for a plugin (with pagination, filtering)
 */
export async function listPluginRuns(
  tenantId: string,
  pluginId: string,
  options?: { status?: string; jobName?: string; limit?: number; offset?: number; sort?: 'asc' | 'desc' }
): Promise<{ runs: PluginRun[]; total: number }> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenantId is required and must be a non-empty string');
  }

  return await withTenantContext(tenantId, async (tx) => {
    const conditions = [
      eq(schema.pluginRuns.pluginId, pluginId),
      eq(schema.pluginRuns.tenantId, tenantId),
    ];

    if (options?.status) {
      conditions.push(eq(schema.pluginRuns.status, options.status));
    }
    if (options?.jobName) {
      conditions.push(eq(schema.pluginRuns.jobName, options.jobName));
    }

    const [runs, [{ count }]] = await Promise.all([
      tx
        .select()
        .from(schema.pluginRuns)
        .where(and(...conditions))
        .orderBy(options?.sort === 'asc' ? asc(schema.pluginRuns.startedAt) : desc(schema.pluginRuns.startedAt))
        .limit(options?.limit ?? 20)
        .offset(options?.offset ?? 0),
      tx
        .select({ count: count() })
        .from(schema.pluginRuns)
        .where(and(...conditions)),
    ]);

    return { runs, total: count ?? 0 };
  });
}
```

**tenantId の取得方法**:
```typescript
// In Remix loader/action
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAdmin(request); // Returns { userId, tenantId, role }
  const tenantId = user.tenantId; // Derived from session

  await createPluginRun(tenantId, pluginId, jobName);
}
```

### 3. 実行スケジュールの管理 UI

**場所**: `app/routes/dashboard/plugins.$id.schedule.tsx`（新規作成）

```typescript
/**
 * GET /dashboard/plugins/:id/schedule
 *
 * Display:
 * - Plugin job definitions (from plugin.json)
 * - Cron schedule for each job
 * - Last run status and timestamp
 * - Next scheduled run time (calculated from cron expression)
 */
export async function loader({ params, request }: LoaderFunctionArgs): Promise<{
  plugin: Plugin;
  jobs: JobSchedule[];
}>;

interface JobSchedule {
  // From plugin.json jobs[]
  name: string;
  route: string;
  cron: string;
  timeoutSec: number;
  concurrency: number; // Per-job concurrency limit (default: 1). Enforced by BullMQ worker concurrency option.
  retry: {
    max: number;
    backoffSec: number[];
  };
  cursor?: {
    key: string;
    ttlSec: number;
  };
  // Runtime info from plugin_runs table
  lastRun: {
    runId: string;
    status: 'success' | 'failed';
    startedAt: Date;
    completedAt: Date | null;
    eventsProcessed: number;
    errorMessage: string | null;
  } | null;
  nextRun: Date; // calculated from cron expression using cron-parser
}

/**
 * Concurrency enforcement:
 * - Enforced per-job using BullMQ's worker concurrency option
 * - Default: 1 (sequential execution)
 * - If concurrency = 1, a new job will wait in queue until the current one completes
 * - If concurrency > 1, up to N jobs can run in parallel
 * - Excess jobs are queued (FIFO) and processed when a worker slot becomes available
 * - Implementation: core/plugin-system/scheduler.ts (BullMQ Worker constructor with concurrency option)
 */
```

**UI 内容**:
- プラグインの `plugin.json` に定義された `jobs` を**読み取り専用**で一覧表示
- 各ジョブの cron スケジュール（`cron` フィールド）、リトライ設定、タイムアウト設定を表示
- 最終実行結果（`plugin_runs` テーブルから取得）を表示
- 次回実行予定時刻（`cron-parser` で計算）を表示
- 手動実行ボタン（後述）

**注意**:
- cron スケジュールは `plugin.json` の `jobs[].cron` に定義されており、**DB 保存は不要**
- スケジュール変更はプラグインの `plugin.json` を編集し、プラグインを再読み込みすることで反映される
- UI は読み取り専用（閲覧とモニタリングのみ）

### 4. 手動実行機能

**場所**: `app/routes/api/plugins.$id.run.ts`（新規作成）

```typescript
/**
 * POST /api/plugins/:id/run
 *
 * Manually execute a plugin job (for testing/debugging)
 *
 * Access control: Admin-only (requireAdmin() middleware)
 *
 * Request body:
 * {
 *   "jobName": "sync"
 * }
 *
 * Response:
 * {
 *   "runId": "uuid",
 *   "status": "pending"
 * }
 */
export async function action({ params, request }: ActionFunctionArgs): Promise<Response> {
  // Enforce admin-only access
  const user = await requireAdmin(request); // Throws 403 if non-admin
  const tenantId = user.tenantId;

  // ... implementation
}
```

**説明**:
- **アクセス制御**: `requireAdmin()` ミドルウェアで admin-only アクセスを強制
  - 未認証: 401 Unauthorized（ログインページにリダイレクト）
  - 非 admin: 403 Forbidden
- `jobName` を指定してプラグインのジョブを手動実行
- BullMQ のキューに即座にジョブを追加（優先度: high）
- `plugin_runs` テーブルに実行レコードを作成（status: 'pending'）
- runId を返す（フロントエンドでポーリングして結果確認）

### 5. 実行結果のサマリー表示

**場所**: `app/routes/dashboard/plugins.$id.runs.tsx`（新規作成）

```typescript
/**
 * GET /dashboard/plugins/:id/runs
 *
 * Display:
 * - List of plugin runs (paginated)
 * - Filter by status (success/failed/running)
 * - Filter by job name
 * - Sort by startedAt (desc)
 * - Run details (runId, jobName, status, startedAt, completedAt, eventsProcessed, errorMessage)
 */
export async function loader({ params, request }: LoaderFunctionArgs): Promise<{
  plugin: Plugin;
  runs: PluginRun[];
  total: number;
  summary: RunSummary;
}>;

interface RunSummary {
  total: number;
  success: number;
  failed: number;
  running: number;
  pending: number;
  avgEventsProcessed: number; // average events processed per successful run (calculated on each request)
  avgDuration: number; // average duration (ms) per successful run (calculated on each request)
}

/**
 * RunSummary calculation rules:
 * - avgEventsProcessed and avgDuration are calculated ONLY over successful runs
 * - Query: WHERE status = 'success' AND completedAt IS NOT NULL
 * - avgEventsProcessed = SUM(eventsProcessed) / COUNT(*) for successful runs
 * - avgDuration = SUM(EXTRACT(EPOCH FROM (completedAt - startedAt)) * 1000) / COUNT(*) for successful runs
 * - If COUNT(successful runs) = 0, both averages return 0
 * - No caching: values are recomputed on each request
 */
```

**UI 内容**:
- 実行履歴のテーブル表示（runId、jobName、status、startedAt、completedAt、eventsProcessed、errorMessage）
- ステータスフィルタ（success、failed、running、pending）
- ジョブ名フィルタ
- ページネーション（limit: 20）
- サマリーカード（total、success、failed、running、pending、avgEventsProcessed、avgDuration）
- 各行をクリックして詳細モーダル表示（errorMessage の全文など）

## API 仕様

### POST /api/plugins/:id/run

**アクセス制御**:
- **Admin-only**: このエンドポイントは `requireAdmin()` ミドルウェアで保護される
- **401 Unauthorized**: 未認証リクエストはリダイレクトまたはエラーレスポンス
- **403 Forbidden**: 認証済みでも非 admin ユーザーはアクセス不可
- **UI**: 非 admin ユーザーには手動実行ボタンを非表示にする（クライアント側制御）
- **API**: サーバー側でも同じチェックを実施し、権限昇格を防ぐ

**Request**:
```json
{
  "jobName": "sync"
}
```

**Response (202 Accepted)**:
```json
{
  "runId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}
```

**説明**:
- ジョブは BullMQ キューに追加され、Worker が処理を開始します
- 初期ステータスは `"pending"` です
- Worker がジョブを取得すると、ステータスは `"running"` に更新されます（通常 1-2 秒以内）
- フロントエンドはポーリング（2 秒間隔）でステータスを確認し、`"running"` → `"success"` / `"failed"` の遷移を表示します

**Error (400 Bad Request)**:
```json
{
  "error": "Invalid job name"
}
```

**Error (401 Unauthorized)**:
```json
{
  "error": "Authentication required"
}
```

**Error (403 Forbidden)**:
```json
{
  "error": "Admin access required"
}
```

**Error (404 Not Found)**:
```json
{
  "error": "Plugin not found"
}
```

### GET /api/plugins/:id/runs

**Query parameters**:
- `status`: 'pending' | 'running' | 'success' | 'failed'
- `jobName`: string
- `limit`: number (default: 20, max: 100)
- `offset`: number (default: 0)
- `sort`: 'asc' | 'desc' (default: 'desc')

**Response (200 OK)**:
```json
{
  "runs": [
    {
      "runId": "550e8400-e29b-41d4-a716-446655440000",
      "pluginId": "660e8400-e29b-41d4-a716-446655440001",
      "jobName": "sync",
      "status": "success",
      "startedAt": "2025-10-28T10:00:00Z",
      "completedAt": "2025-10-28T10:05:00Z",
      "eventsProcessed": 42,
      "errorMessage": null,
      "metadata": { "cursor": "2025-10-28T10:00:00Z" }
    }
  ],
  "total": 1,
  "summary": {
    "total": 100,
    "success": 95,
    "failed": 5,
    "running": 0,
    "pending": 0,
    "avgEventsProcessed": 38.5,  // Calculated from 95 successful runs only (SUM(eventsProcessed) / 95)
    "avgDuration": 120000  // Calculated from 95 successful runs only (SUM(duration_ms) / 95), in milliseconds
  }
}
```

**Note**: `avgEventsProcessed` and `avgDuration` are computed only from successful runs (`WHERE status = 'success' AND completedAt IS NOT NULL`). If there are no successful runs, both values return `0`.
```

### GET /api/plugins/:id/runs/:runId

**Response (200 OK)**:
```json
{
  "runId": "550e8400-e29b-41d4-a716-446655440000",
  "pluginId": "660e8400-e29b-41d4-a716-446655440001",
  "jobName": "sync",
  "status": "success",
  "startedAt": "2025-10-28T10:00:00Z",
  "completedAt": "2025-10-28T10:05:00Z",
  "eventsProcessed": 42,
  "errorMessage": null,
  "metadata": { "cursor": "2025-10-28T10:00:00Z" }
}
```

**Error (404 Not Found)**:
```json
{
  "error": "Plugin run not found"
}
```

## E2E テスト仕様

**ファイル**: `core/e2e/plugins-cron.spec.ts`

### テストケース

1. **スケジュール画面の表示**
   - `/dashboard/plugins/:id/schedule` にアクセス
   - プラグインのジョブ一覧が表示される
   - 各ジョブの cron スケジュール、最終実行結果、次回実行予定時刻が表示される

2. **手動実行**
   - スケジュール画面で「手動実行」ボタンをクリック（admin ユーザーのみボタンが表示される）
   - `POST /api/plugins/:id/run` が呼ばれる
   - レスポンスで `runId` と初期ステータス `"pending"` を受け取る
   - ポーリング（2 秒間隔）でステータスを確認
   - Worker がジョブを取得すると、ステータスが `"running"` に更新される（1-2 秒以内）
   - 実行完了後、ステータスが `"success"` または `"failed"` に更新される
   - 実行結果が `plugin_runs` テーブルに記録される

3. **実行履歴の表示**
   - `/dashboard/plugins/:id/runs` にアクセス
   - 実行履歴のテーブルが表示される
   - ステータスフィルタが機能する
   - ジョブ名フィルタが機能する
   - ページネーションが機能する

4. **実行詳細の表示**
   - 実行履歴の行をクリック
   - 詳細モーダルが表示される
   - errorMessage の全文が表示される（失敗時）

5. **サマリーの表示**
   - `/dashboard/plugins/:id/runs` にサマリーカードが表示される
   - total、success、failed、running、pending のカウントが正しい
   - avgEventsProcessed、avgDuration が正しい

6. **アクセス制御**
   - 未認証ユーザーは `/dashboard/plugins/:id/schedule` にアクセスできない（401 Unauthorized）
   - admin ロールのみが手動実行ボタンを表示できる（UI 制御）
   - 非 admin ユーザーが `POST /api/plugins/:id/run` を直接呼び出した場合、403 Forbidden を返す（API 制御）
   - admin ユーザーは手動実行ボタンをクリックでき、ジョブが正常に実行される

7. **エラーハンドリング**
   - 存在しないプラグインにアクセス → 404
   - 無効な jobName で手動実行 → 400

## 完了条件

- [ ] `core/plugin-system/executor.ts` が作成され、`executePluginJob()` が実装される
- [ ] `core/services/plugin-run.service.ts` が作成され、CRUD 操作が実装される
- [ ] `app/routes/dashboard/plugins.$id.schedule.tsx` が作成され、スケジュール管理 UI が表示される
  - `plugin.json` の `jobs[]` から設定を読み取る（読み取り専用）
  - 最終実行結果と次回実行予定時刻を表示
- [ ] `app/routes/api/plugins.$id.run.ts` が作成され、手動実行 API が機能する
- [ ] `app/routes/dashboard/plugins.$id.runs.tsx` が作成され、実行履歴とサマリーが表示される
- [ ] `GET /api/plugins/:id/runs` API が実装され、実行履歴を取得できる
- [ ] `GET /api/plugins/:id/runs/:runId` API が実装され、実行詳細を取得できる
- [ ] E2E テストが全てパスする（7 テスト）
- [ ] プラグインの cron ジョブが BullMQ で定期実行され、結果が記録される
  - `plugin.json` の `jobs[].cron` に従って自動実行
  - タイムアウト・リトライ・カーソル管理・同時実行制御が機能する

## 依存タスク

- Task 8.3: Job Scheduler 実装（BullMQ）✅

## 推定時間

3 時間

## 注意事項

- `withTenantContext()` を使用して RLS 対応
- `plugin_runs` テーブルは既に Task 3.2 で実装済み
- BullMQ の Worker は Task 8.3 で実装済み
- **cron スケジュールは `plugin.json` の `jobs[]` から読み取る（DB 保存不要）**
- cron 式のパースには `cron-parser` パッケージを使用
- 手動実行は admin ロールのみ許可（アクセス制御）
- タイムアウト・リトライ・カーソル管理・同時実行制御は `plugin.json` の `jobs` 定義に従う
  - `jobs[].timeoutSec`: タイムアウト
  - `jobs[].retry.max` / `jobs[].retry.backoffSec[]`: リトライ制御
  - `jobs[].cursor.key` / `jobs[].cursor.ttlSec`: カーソル管理（Redis に保存）
  - `jobs[].concurrency`: 同時実行数制限
- 実行中のジョブは `concurrency` 制限を適用（BullMQ の concurrency オプション）
- 実行結果のポーリング間隔は 2 秒（フロントエンド）
- プラグインの `plugin.json` を変更した場合は、プラグインを再読み込み（または再起動）することでスケジュールが更新される
