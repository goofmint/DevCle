# Task 8.8: プラグインの Cron 実行と結果確認

## 概要

プラグインの cron ジョブを実行し、その結果を記録・確認できるようにする。
手動実行機能と実行スケジュールの管理 UI を提供し、プラグインの実行状況を可視化する。

## 目的

- プラグインの cron ジョブを自動実行する
- 実行結果を `plugin_runs` テーブルに記録する
- 手動実行機能を提供する（テスト・デバッグ用）
- 実行スケジュールを管理 UI で確認できるようにする
- 実行結果のサマリーを表示する

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

### 1. プラグイン cron ジョブ実行機能

**場所**: `core/plugin-system/executor.ts`（新規作成）

```typescript
/**
 * Execute a plugin job manually or via cron scheduler
 */
export async function executePluginJob(
  tenantId: string,
  pluginId: string,
  jobName: string
): Promise<PluginRunResult>;

interface PluginRunResult {
  runId: string;
  status: 'success' | 'failed';
  eventsProcessed: number;
  errorMessage?: string;
  duration: number; // ms
}
```

**説明**:
- プラグインの `plugin.json` に定義された `jobs` の `route` を実行する
- `plugin_runs` テーブルに実行前にレコード作成（status: 'pending'）
- 実行中は status: 'running' に更新
- 完了後は status: 'success' | 'failed' に更新し、`completedAt`、`eventsProcessed`、`errorMessage` を記録
- タイムアウト制御（`jobs[].timeoutSec`）
- リトライ制御（`jobs[].retry`）
- カーソル管理（`jobs[].cursor`）で前回実行からの差分取得

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
  name: string;
  route: string;
  cron: string;
  timeoutSec: number;
  concurrency: number;
  lastRun: {
    runId: string;
    status: 'success' | 'failed';
    startedAt: Date;
    completedAt: Date | null;
    eventsProcessed: number;
    errorMessage: string | null;
  } | null;
  nextRun: Date; // calculated from cron expression
}
```

**UI 内容**:
- プラグインの `plugin.json` に定義された `jobs` を一覧表示
- 各ジョブの cron スケジュール、最終実行結果、次回実行予定時刻を表示
- 手動実行ボタン（後述）

### 4. 手動実行機能

**場所**: `app/routes/api/plugins.$id.run.ts`（新規作成）

```typescript
/**
 * POST /api/plugins/:id/run
 *
 * Manually execute a plugin job (for testing/debugging)
 *
 * Request body:
 * {
 *   "jobName": "sync"
 * }
 *
 * Response:
 * {
 *   "runId": "uuid",
 *   "status": "pending" | "running"
 * }
 */
export async function action({ params, request }: ActionFunctionArgs): Promise<Response>;
```

**説明**:
- `jobName` を指定してプラグインのジョブを手動実行
- BullMQ のキューに即座にジョブを追加（優先度: high）
- `plugin_runs` テーブルに実行レコードを作成
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
  avgEventsProcessed: number; // average events processed per successful run
  avgDuration: number; // average duration (ms) per successful run
}
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

**Error (400 Bad Request)**:
```json
{
  "error": "Invalid job name"
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
    "avgEventsProcessed": 38.5,
    "avgDuration": 120000
  }
}
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
   - スケジュール画面で「手動実行」ボタンをクリック
   - `POST /api/plugins/:id/run` が呼ばれる
   - 実行結果が `plugin_runs` テーブルに記録される
   - 実行中は status: 'running' が表示される
   - 完了後は status: 'success' または 'failed' が表示される

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
   - 未認証ユーザーはアクセスできない
   - admin ロールのみが手動実行ボタンを表示できる

7. **エラーハンドリング**
   - 存在しないプラグインにアクセス → 404
   - 無効な jobName で手動実行 → 400

## 完了条件

- [ ] `core/plugin-system/executor.ts` が作成され、`executePluginJob()` が実装される
- [ ] `core/services/plugin-run.service.ts` が作成され、CRUD 操作が実装される
- [ ] `app/routes/dashboard/plugins.$id.schedule.tsx` が作成され、スケジュール管理 UI が表示される
- [ ] `app/routes/api/plugins.$id.run.ts` が作成され、手動実行 API が機能する
- [ ] `app/routes/dashboard/plugins.$id.runs.tsx` が作成され、実行履歴とサマリーが表示される
- [ ] `GET /api/plugins/:id/runs` API が実装され、実行履歴を取得できる
- [ ] `GET /api/plugins/:id/runs/:runId` API が実装され、実行詳細を取得できる
- [ ] E2E テストが全てパスする（7 テスト）
- [ ] プラグインの cron ジョブが BullMQ で定期実行され、結果が記録される

## 依存タスク

- Task 8.3: Job Scheduler 実装（BullMQ）✅

## 推定時間

3 時間

## 注意事項

- `withTenantContext()` を使用して RLS 対応
- `plugin_runs` テーブルは既に Task 3.2 で実装済み
- BullMQ の Worker は Task 8.3 で実装済み
- cron 式のパースには `cron-parser` パッケージを使用
- 手動実行は admin ロールのみ許可（アクセス制御）
- タイムアウト・リトライ・カーソル管理は `plugin.json` の `jobs` 定義に従う
- 実行中のジョブは `concurrency` 制限を適用（同時実行数制限）
- 実行結果のポーリング間隔は 2 秒（フロントエンド）
