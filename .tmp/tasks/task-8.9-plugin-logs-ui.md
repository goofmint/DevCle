# Task 8.9: プラグインの実行ログ確認画面実装

## 概要

プラグインの実行ログを確認するための UI を実装します。実行日時、ステータス、実行時間、エラーメッセージを一覧表示し、ページネーション、フィルタ機能を提供します。また、ログ詳細をモーダルで表示する機能も実装します。

## 目的

- プラグインの実行履歴を可視化する
- 実行ステータス（成功/失敗/実行中/待機中）でフィルタリングする
- 実行時間、処理件数、エラーメッセージを確認できるようにする
- ページネーションで大量のログを扱えるようにする
- ログ詳細をモーダルで確認できるようにする

## 関連テーブル

### plugin_runs

Task 3.2 で既に実装済み（`core/db/schema/plugins.ts`）

```typescript
// Schema (既存)
export const pluginRuns = pgTable('plugin_runs', {
  runId: uuid('run_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  pluginId: uuid('plugin_id').notNull().references(() => plugins.pluginId, { onDelete: 'cascade' }),
  jobName: text('job_name').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'success' | 'failed'
  eventsProcessed: integer('events_processed').notNull().default(0),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'),
});
```

## 実装内容

### 1. UI ルート実装

**場所**: `app/routes/dashboard/plugins.$id.logs.tsx`（新規作成）

```typescript
/**
 * Plugin Logs UI Route
 *
 * Display plugin execution logs with filtering and pagination
 *
 * GET /dashboard/plugins/:id/logs
 */

import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, useSearchParams } from '@remix-run/react';
import { requireAuth } from '~/auth/session.server';

/**
 * Loader function
 *
 * Fetch plugin logs from API endpoint
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  // 1. Authenticate user and get tenant ID
  const user = await requireAuth(request);

  // 2. Validate plugin ID
  const pluginId = params.id;
  if (!pluginId) {
    throw new Response('Plugin ID is required', { status: 400 });
  }

  // 3. Parse query parameters
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  const jobName = url.searchParams.get('jobName') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  // 4. Fetch plugin info
  const plugin = await getPlugin(user.tenantId, pluginId);

  // 5. Fetch logs from API
  const logsData = await getPluginLogs(user.tenantId, pluginId, {
    status,
    jobName,
    limit,
    offset,
  });

  // 6. Return data
  return json({
    plugin,
    logs: logsData.logs,
    total: logsData.total,
    pagination: logsData.pagination,
  });
}

/**
 * UI Component
 *
 * Display logs table with filtering and pagination
 */
export default function PluginLogsPage() {
  const { plugin, logs, total, pagination } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  // State management
  const [selectedLog, setSelectedLog] = useState<PluginLog | null>(null);

  // Filter handlers
  const handleStatusFilter = (status: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (status) {
      newParams.set('status', status);
    } else {
      newParams.delete('status');
    }
    newParams.set('offset', '0'); // Reset to first page
    setSearchParams(newParams);
  };

  const handleJobNameFilter = (jobName: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (jobName) {
      newParams.set('jobName', jobName);
    } else {
      newParams.delete('jobName');
    }
    newParams.set('offset', '0'); // Reset to first page
    setSearchParams(newParams);
  };

  // Pagination handlers
  const handleNextPage = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('offset', String(pagination.offset + pagination.limit));
    setSearchParams(newParams);
  };

  const handlePreviousPage = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('offset', String(Math.max(0, pagination.offset - pagination.limit)));
    setSearchParams(newParams);
  };

  // Modal handlers
  const handleRowClick = (log: PluginLog) => {
    setSelectedLog(log);
  };

  const handleCloseModal = () => {
    setSelectedLog(null);
  };

  return (
    <div className="plugin-logs-page">
      {/* Page header */}
      <header>
        <h1>Plugin Logs: {plugin.name}</h1>
        <p>View execution logs for this plugin</p>
      </header>

      {/* Filters */}
      <div className="filters">
        <StatusFilter onChange={handleStatusFilter} />
        <JobNameFilter onChange={handleJobNameFilter} />
      </div>

      {/* Logs table */}
      <LogsTable logs={logs} onRowClick={handleRowClick} />

      {/* Pagination */}
      <Pagination
        total={total}
        limit={pagination.limit}
        offset={pagination.offset}
        hasMore={pagination.hasMore}
        onNext={handleNextPage}
        onPrevious={handlePreviousPage}
      />

      {/* Log detail modal */}
      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={handleCloseModal} />
      )}
    </div>
  );
}
```

### 2. UI コンポーネント

#### 2.1 LogsTable

```typescript
/**
 * LogsTable Component
 *
 * Display logs in a table with sortable columns
 */
interface LogsTableProps {
  logs: PluginLog[];
  onRowClick: (log: PluginLog) => void;
}

export function LogsTable({ logs, onRowClick }: LogsTableProps) {
  return (
    <table className="logs-table">
      <thead>
        <tr>
          <th>実行日時</th>
          <th>ジョブ名</th>
          <th>ステータス</th>
          <th>実行時間</th>
          <th>処理件数</th>
          <th>エラー</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <tr key={log.runId} onClick={() => onRowClick(log)}>
            <td>{formatDateTime(log.startedAt)}</td>
            <td>{log.jobName}</td>
            <td>
              <StatusBadge status={log.status} />
            </td>
            <td>{log.duration ? formatDuration(log.duration) : '-'}</td>
            <td>{log.eventsProcessed}</td>
            <td>{log.errorMessage ? '有り' : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

#### 2.2 StatusBadge

```typescript
/**
 * StatusBadge Component
 *
 * Display status with color coding
 */
interface StatusBadgeProps {
  status: 'pending' | 'running' | 'success' | 'failed';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colors = {
    pending: 'bg-gray-500',
    running: 'bg-blue-500',
    success: 'bg-green-500',
    failed: 'bg-red-500',
  };

  const labels = {
    pending: '待機中',
    running: '実行中',
    success: '成功',
    failed: '失敗',
  };

  return (
    <span className={`badge ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}
```

#### 2.3 StatusFilter

```typescript
/**
 * StatusFilter Component
 *
 * Filter logs by status
 */
interface StatusFilterProps {
  onChange: (status: string) => void;
}

export function StatusFilter({ onChange }: StatusFilterProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedStatus(value);
    onChange(value);
  };

  return (
    <select value={selectedStatus} onChange={handleChange}>
      <option value="">すべて</option>
      <option value="pending">待機中</option>
      <option value="running">実行中</option>
      <option value="success">成功</option>
      <option value="failed">失敗</option>
    </select>
  );
}
```

#### 2.4 JobNameFilter

```typescript
/**
 * JobNameFilter Component
 *
 * Filter logs by job name
 */
interface JobNameFilterProps {
  onChange: (jobName: string) => void;
}

export function JobNameFilter({ onChange }: JobNameFilterProps) {
  const [jobName, setJobName] = useState<string>('');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setJobName(value);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onChange(jobName);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={jobName}
        onChange={handleChange}
        placeholder="ジョブ名で絞り込み"
      />
      <button type="submit">検索</button>
    </form>
  );
}
```

#### 2.5 LogDetailModal

```typescript
/**
 * LogDetailModal Component
 *
 * Display detailed information about a log entry
 */
interface LogDetailModalProps {
  log: PluginLog;
  onClose: () => void;
}

export function LogDetailModal({ log, onClose }: LogDetailModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>ログ詳細</h2>
          <button onClick={onClose}>閉じる</button>
        </header>

        <div className="modal-body">
          <dl>
            <dt>実行 ID</dt>
            <dd>{log.runId}</dd>

            <dt>ジョブ名</dt>
            <dd>{log.jobName}</dd>

            <dt>ステータス</dt>
            <dd>
              <StatusBadge status={log.status} />
            </dd>

            <dt>開始日時</dt>
            <dd>{formatDateTime(log.startedAt)}</dd>

            <dt>完了日時</dt>
            <dd>{log.completedAt ? formatDateTime(log.completedAt) : '-'}</dd>

            <dt>実行時間</dt>
            <dd>{log.duration ? formatDuration(log.duration) : '-'}</dd>

            <dt>処理件数</dt>
            <dd>{log.eventsProcessed} 件</dd>

            {log.errorMessage && (
              <>
                <dt>エラーメッセージ</dt>
                <dd className="error-message">{log.errorMessage}</dd>
              </>
            )}

            {log.metadata && (
              <>
                <dt>メタデータ</dt>
                <dd>
                  <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                </dd>
              </>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
```

#### 2.6 Pagination

```typescript
/**
 * Pagination Component
 *
 * Display pagination controls
 */
interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  onNext: () => void;
  onPrevious: () => void;
}

export function Pagination({ total, limit, offset, hasMore, onNext, onPrevious }: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="pagination">
      <button onClick={onPrevious} disabled={offset === 0}>
        前へ
      </button>

      <span>
        {currentPage} / {totalPages} ページ (全 {total} 件)
      </span>

      <button onClick={onNext} disabled={!hasMore}>
        次へ
      </button>
    </div>
  );
}
```

### 3. データ型定義

```typescript
/**
 * Plugin Log Entry
 */
interface PluginLog {
  /** Run ID (UUID) */
  runId: string;

  /** Job name */
  jobName: string;

  /** Execution status */
  status: 'pending' | 'running' | 'success' | 'failed';

  /** Start timestamp (ISO 8601) */
  startedAt: string;

  /** Completion timestamp (ISO 8601, null if still running) */
  completedAt: string | null;

  /** Execution duration in milliseconds (null if still running) */
  duration: number | null;

  /** Number of events processed */
  eventsProcessed: number;

  /** Error message (if failed) */
  errorMessage: string | null;

  /** Metadata (JSONB) */
  metadata: Record<string, unknown> | null;
}

/**
 * Pagination info
 */
interface PaginationInfo {
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

### 4. ヘルパー関数

```typescript
/**
 * Format date and time
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format duration in milliseconds
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}秒`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}分${remainingSeconds}秒`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}時間${remainingMinutes}分`;
}
```

## API 仕様

### GET /api/plugins/:id/logs

Task 8.4 で定義済み。以下は再掲。

**Query parameters**:
- `status`: 'pending' | 'running' | 'success' | 'failed' (optional filter)
- `jobName`: string (optional filter)
- `limit`: number (default: 20, max: 100)
- `offset`: number (default: 0)

**Response (200 OK)**:
```json
{
  "logs": [
    {
      "runId": "550e8400-e29b-41d4-a716-446655440000",
      "jobName": "sync",
      "status": "success",
      "startedAt": "2025-10-28T10:00:00Z",
      "completedAt": "2025-10-28T10:05:00Z",
      "duration": 300000,
      "eventsProcessed": 42,
      "errorMessage": null,
      "metadata": { "cursor": "2025-10-28T10:00:00Z" }
    }
  ],
  "total": 100,
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**Error (401 Unauthorized)**:
```json
{
  "error": "Authentication required"
}
```

**Error (404 Not Found)**:
```json
{
  "error": "Plugin not found"
}
```

## サービス関数

### getPlugin

```typescript
/**
 * Get plugin by ID
 *
 * Used in loader to fetch plugin info
 */
export async function getPlugin(tenantId: string, pluginId: string): Promise<Plugin | null> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenantId is required and must be a non-empty string');
  }

  return await withTenantContext(tenantId, async (tx) => {
    const [plugin] = await tx
      .select()
      .from(schema.plugins)
      .where(
        and(
          eq(schema.plugins.pluginId, pluginId),
          eq(schema.plugins.tenantId, tenantId)
        )
      )
      .limit(1);

    return plugin ?? null;
  });
}
```

### getPluginLogs

```typescript
/**
 * Get plugin logs with filtering and pagination
 *
 * This function calls the plugin-run.service.ts listPluginRuns() function
 */
export async function getPluginLogs(
  tenantId: string,
  pluginId: string,
  options?: {
    status?: 'pending' | 'running' | 'success' | 'failed';
    jobName?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{
  logs: PluginLog[];
  total: number;
  pagination: PaginationInfo;
}> {
  // Validate parameters
  const limit = Math.min(options?.limit ?? 20, 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  // Fetch logs from plugin-run service
  const { runs, total } = await listPluginRuns(tenantId, pluginId, {
    status: options?.status,
    jobName: options?.jobName,
    limit,
    offset,
    sort: 'desc', // Most recent first
  });

  // Calculate duration for each log
  const logs: PluginLog[] = runs.map((run) => ({
    runId: run.runId,
    jobName: run.jobName,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    duration: run.completedAt
      ? run.completedAt.getTime() - run.startedAt.getTime()
      : null,
    eventsProcessed: run.eventsProcessed,
    errorMessage: run.errorMessage,
    metadata: run.metadata,
  }));

  return {
    logs,
    total,
    pagination: {
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
}
```

## E2E テスト仕様

**ファイル**: `core/e2e/plugins-logs.spec.ts`

### テストケース

1. **ログ画面の表示**
   - `/dashboard/plugins/:id/logs` にアクセス
   - プラグインのログ一覧が表示される
   - テーブルに実行日時、ジョブ名、ステータス、実行時間、処理件数が表示される

2. **ステータスフィルタ**
   - ステータスフィルタで「成功」を選択
   - 成功したログのみが表示される
   - ステータスフィルタで「失敗」を選択
   - 失敗したログのみが表示される
   - ステータスフィルタで「すべて」を選択
   - すべてのログが表示される

3. **ジョブ名フィルタ**
   - ジョブ名フィルタで "sync" を入力して検索
   - "sync" ジョブのログのみが表示される
   - ジョブ名フィルタをクリアして検索
   - すべてのログが表示される

4. **ページネーション**
   - ログが 20 件以上ある場合、「次へ」ボタンが有効になる
   - 「次へ」ボタンをクリック
   - 次のページのログが表示される
   - 「前へ」ボタンをクリック
   - 前のページのログが表示される
   - 最初のページでは「前へ」ボタンが無効になる
   - 最後のページでは「次へ」ボタンが無効になる

5. **ログ詳細モーダル**
   - ログの行をクリック
   - ログ詳細モーダルが表示される
   - 実行 ID、ジョブ名、ステータス、開始日時、完了日時、実行時間、処理件数が表示される
   - エラーメッセージがある場合、エラーメッセージが表示される
   - メタデータがある場合、メタデータが JSON 形式で表示される
   - モーダルを閉じるボタンをクリック
   - モーダルが閉じる

6. **ステータスバッジの色分け**
   - 待機中のログは灰色のバッジが表示される
   - 実行中のログは青色のバッジが表示される
   - 成功したログは緑色のバッジが表示される
   - 失敗したログは赤色のバッジが表示される

7. **アクセス制御**
   - 未認証ユーザーは `/dashboard/plugins/:id/logs` にアクセスできない（401 Unauthorized）
   - 認証済みユーザーは自分のテナントのプラグインログにのみアクセスできる
   - 他のテナントのプラグインログにはアクセスできない（404 Not Found）

8. **エラーハンドリング**
   - 存在しないプラグインにアクセス → 404
   - 無効な limit パラメータ（101 以上） → 100 に制限される
   - 無効な offset パラメータ（負の値） → 0 に制限される

## 完了条件

- [ ] `app/routes/dashboard/plugins.$id.logs.tsx` が作成され、ログ確認 UI が表示される
- [ ] ログ一覧がテーブル形式で表示される（実行日時、ジョブ名、ステータス、実行時間、処理件数、エラー）
- [ ] ステータスフィルタが機能する（すべて/待機中/実行中/成功/失敗）
- [ ] ジョブ名フィルタが機能する
- [ ] ページネーションが機能する（limit: 20、max: 100）
- [ ] ログ詳細モーダルが表示される
- [ ] ステータスバッジが色分けされて表示される
- [ ] E2E テストが全てパスする（8 テスト）
- [ ] TypeScript の型エラーがない
- [ ] すべてのコンポーネントがダークモード対応している

## 依存タスク

- Task 8.4: Plugin 管理 API 実装（`GET /api/plugins/:id/logs` API）✅
- Task 8.8: プラグインの Cron 実行と結果確認（`plugin-run.service.ts`）

**注意**: Task 8.4 で API エンドポイント `/api/plugins/:id/logs` が定義されていますが、実際には Task 8.8 の `plugin-run.service.ts` の `listPluginRuns()` 関数を使用します。

## 推定時間

3 時間

## 注意事項

- `withTenantContext()` を使用して RLS 対応
- `plugin_runs` テーブルは既に Task 3.2 で実装済み
- `getPluginLogs()` は `listPluginRuns()` をラップして API レスポンス形式に変換する
- ログの duration（実行時間）は `completedAt - startedAt` で計算（ミリ秒単位）
- ページネーションの limit は最大 100 に制限
- ページネーションの offset は 0 以上に制限
- ステータスフィルタとジョブ名フィルタを組み合わせて使用可能
- モーダルは ESC キーでも閉じられるようにする
- テーブルの行はホバー時にハイライト表示する
- ログが 0 件の場合は「ログがありません」メッセージを表示する
- ダークモード対応（Tailwind の `dark:` プレフィックス使用）
- アクセシビリティ対応（ARIA ラベル、キーボードナビゲーション）
