# Task 8.12: プラグインの収集結果の詳細表示（UI）

**タスクID**: 8.12
**推定時間**: 4時間
**依存タスク**: Task 8.11（プラグインの収集結果の詳細用API実装）
**完了条件**: プラグインの収集データを一覧表示し、フィルタ・詳細表示・再処理ができる

---

## 概要

Task 8.11で実装したAPI（`GET /api/plugins/:id/events`、`GET /api/plugins/:id/events/:eventId`、`POST /api/plugins/:id/events/:eventId/reprocess`）を使用して、プラグインが収集した生イベントデータ（`plugin_events_raw`）を表示・管理するUI画面を実装する。

### 主な機能

1. **イベント一覧表示**: プラグインが収集したイベントをテーブル形式で表示
2. **フィルタリング**: ステータス（processed/failed/pending）、イベント種別、日付範囲でフィルタ
3. **ページネーション**: 大量のイベントデータを効率的にナビゲート
4. **統計サマリー**: 全体の統計情報（総数、成功数、失敗数など）を表示
5. **詳細モーダル**: JSONビューアで生データを確認
6. **再処理機能**: 失敗したイベントを再処理キューに追加

---

## 実装方針

### アーキテクチャ

- **SPA（Single Page Application）**: SSRは使用せず、クライアントサイドレンダリング
- **データフェッチ**: Remix の `useFetcher` または `fetch` を使用してAPIをクライアントサイドから呼び出し
- **リアルタイム更新**: フィルタ変更時やページ遷移時に動的にAPIを呼び出し
- **楽観的UI更新**: 再処理ボタン押下時、APIレスポンスを待たずにUI状態を更新

### UIテキスト言語

**すべてのUIテキストは英語で実装する**（日本語は使用しない）

---

## ファイル構成

```
core/
├── app/
│   ├── routes/
│   │   └── dashboard.plugins_.$id.data.tsx         # メインページ（SPA）
│   └── components/
│       └── plugins/
│           ├── EventsTable.tsx                      # イベント一覧テーブル
│           ├── EventsFilter.tsx                     # フィルタUI
│           ├── EventsStats.tsx                      # 統計サマリー
│           └── EventDetailModal.tsx                 # イベント詳細モーダル
└── e2e/
    └── plugin-data-display.spec.ts                  # E2Eテスト
```

---

## コンポーネント設計

### 1. `dashboard.plugins_.$id.data.tsx`（メインページ）

プラグインの収集データ一覧ページ。

```typescript
/**
 * Plugin Data Display Page
 *
 * Route: /dashboard/plugins/:id/data
 *
 * This page displays raw events collected by plugins stored in plugin_events_raw table.
 * Features:
 * - Event list with pagination
 * - Filtering by status, event type, and date range
 * - Statistics summary
 * - Event detail modal with JSON viewer
 * - Reprocess failed events
 *
 * Implementation:
 * - SPA (client-side rendering, no SSR)
 * - Uses useFetcher or fetch for API calls
 * - APIs: GET /api/plugins/:id/events, GET /api/plugins/:id/events/stats
 */

import { useState, useEffect } from 'react';
import { useParams } from '@remix-run/react';

interface EventsPageProps {
  // Page state and handlers
}

export default function PluginDataPage() {
  // State management:
  // - events: PluginEvent[]
  // - filters: EventsFilter (status, eventType, startDate, endDate)
  // - pagination: { page, perPage, total }
  // - stats: EventsStats
  // - selectedEvent: PluginEvent | null (for modal)
  // - loading: boolean

  // Effects:
  // - useEffect to fetch events when filters/pagination changes
  // - useEffect to fetch stats on mount

  // Handlers:
  // - handleFilterChange(newFilters)
  // - handlePageChange(newPage)
  // - handleEventClick(event) - open modal
  // - handleCloseModal()
  // - handleReprocess(eventId)

  return (
    <>
      <EventsStats stats={stats} />
      <EventsFilter filters={filters} onChange={handleFilterChange} />
      <EventsTable
        events={events}
        pagination={pagination}
        onPageChange={handlePageChange}
        onEventClick={handleEventClick}
      />
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={handleCloseModal}
          onReprocess={handleReprocess}
        />
      )}
    </>
  );
}
```

**実装内容**:
- `useState`でフィルタ、ページネーション、イベントリスト、統計情報を管理
- `useEffect`でフィルタやページが変更されたときにAPIを呼び出し
- ローディング状態を管理し、スケルトンまたはスピナーを表示
- エラーハンドリング（API呼び出し失敗時のトースト通知）

---

### 2. `EventsTable.tsx`（イベント一覧テーブル）

収集イベントをテーブル形式で表示する。

```typescript
/**
 * Events Table Component
 *
 * Displays a list of plugin events in a table format.
 *
 * Columns:
 * - Event ID (truncated UUID)
 * - Event Type
 * - Status (badge with color: success/failed/pending)
 * - Ingested At (formatted timestamp)
 * - Processed At (formatted timestamp or "—")
 * - Error Message (truncated, or "—")
 * - Actions (View Detail button)
 *
 * Props:
 * - events: PluginEvent[]
 * - pagination: { page, perPage, total }
 * - onPageChange: (page: number) => void
 * - onEventClick: (event: PluginEvent) => void
 */

interface EventsTableProps {
  events: PluginEvent[];
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onEventClick: (event: PluginEvent) => void;
}

export function EventsTable(props: EventsTableProps) {
  // Render table with:
  // - Header row with column names
  // - Data rows with event information
  // - Status badge component (color-coded)
  // - Pagination controls (previous, page numbers, next)
  // - "View Detail" button in Actions column

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        {/* Table header */}
        {/* Table body */}
        {/* Pagination */}
      </table>
    </div>
  );
}
```

**実装内容**:
- テーブルヘッダー: Event ID、Event Type、Status、Ingested At、Processed At、Error、Actions
- ステータスバッジ: 成功（緑）、失敗（赤）、保留中（黄）
- タイムスタンプフォーマット: `YYYY-MM-DD HH:mm:ss`（timezone考慮）
- ページネーション: `1 2 3 ... 10` 形式、前へ/次へボタン
- レスポンシブ対応: モバイルでは横スクロール

---

### 3. `EventsFilter.tsx`（フィルタUI）

イベントリストをフィルタリングするためのUI。

```typescript
/**
 * Events Filter Component
 *
 * Filter UI for events list.
 *
 * Filters:
 * - Status: processed | failed | pending (multi-select or dropdown)
 * - Event Type: text input (free text search)
 * - Date Range: start date and end date pickers
 *
 * Props:
 * - filters: EventsFilter
 * - onChange: (filters: EventsFilter) => void
 */

interface EventsFilterProps {
  filters: EventsFilter;
  onChange: (filters: EventsFilter) => void;
}

interface EventsFilter {
  status?: string[];        // ["processed", "failed", "pending"]
  eventType?: string;       // Free text search
  startDate?: string;       // ISO date string
  endDate?: string;         // ISO date string
}

export function EventsFilter(props: EventsFilterProps) {
  // Render filter UI with:
  // - Status dropdown/multi-select
  // - Event Type text input
  // - Date range picker (start and end)
  // - "Apply" button (or auto-apply on change)
  // - "Clear Filters" button

  return (
    <div className="flex gap-4 mb-4">
      {/* Status filter */}
      {/* Event Type filter */}
      {/* Date Range filter */}
      {/* Action buttons */}
    </div>
  );
}
```

**実装内容**:
- ステータスフィルタ: ドロップダウンまたはチェックボックス（複数選択可）
- イベント種別フィルタ: テキスト入力（部分一致検索）
- 日付範囲フィルタ: 開始日・終了日のdate input
- 「Apply Filters」ボタン: フィルタを適用してAPIを呼び出し
- 「Clear Filters」ボタン: フィルタをリセット
- レスポンシブ対応: モバイルでは縦並び

---

### 4. `EventsStats.tsx`（統計サマリー）

収集イベントの統計情報を表示する。

```typescript
/**
 * Events Statistics Component
 *
 * Displays summary statistics for plugin events.
 *
 * Metrics:
 * - Total Events
 * - Processed (success count)
 * - Failed (error count)
 * - Pending (not yet processed)
 * - Latest Ingested At (most recent event timestamp)
 * - Oldest Ingested At (oldest unprocessed event timestamp)
 *
 * Props:
 * - stats: EventsStats | null
 */

interface EventsStatsProps {
  stats: EventsStats | null;
}

interface EventsStats {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  latestIngestedAt: string | null;   // ISO timestamp
  oldestIngestedAt: string | null;   // ISO timestamp
}

export function EventsStats(props: EventsStatsProps) {
  // Render stats cards with:
  // - Grid layout (2x3 or 3x2)
  // - Each stat in a card with label and value
  // - Color-coded values (success: green, failed: red, pending: yellow)
  // - Loading skeleton when stats is null

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {/* Stat cards */}
    </div>
  );
}
```

**実装内容**:
- 統計カード: Total、Processed、Failed、Pending、Latest Ingested、Oldest Ingested
- カラーコーディング: 成功（緑）、失敗（赤）、保留中（黄）
- ローディング状態: スケルトンカード表示
- タイムスタンプフォーマット: `YYYY-MM-DD HH:mm:ss`
- レスポンシブ対応: モバイルでは1列、タブレットでは2列、デスクトップでは3列

---

### 5. `EventDetailModal.tsx`（イベント詳細モーダル）

選択したイベントの詳細をJSON形式で表示する。

```typescript
/**
 * Event Detail Modal Component
 *
 * Displays detailed information about a plugin event in a modal.
 *
 * Features:
 * - Event metadata (ID, type, status, timestamps)
 * - JSON viewer for raw data (with syntax highlighting)
 * - Reprocess button (only for failed events)
 * - Close button
 *
 * Props:
 * - event: PluginEvent
 * - onClose: () => void
 * - onReprocess: (eventId: string) => void
 */

interface EventDetailModalProps {
  event: PluginEvent;
  onClose: () => void;
  onReprocess: (eventId: string) => void;
}

interface PluginEvent {
  pluginEventId: string;
  eventType: string;
  status: 'processed' | 'failed' | 'pending';
  rawData: Record<string, any>;
  errorMessage: string | null;
  ingestedAt: string;       // ISO timestamp
  processedAt: string | null; // ISO timestamp
}

export function EventDetailModal(props: EventDetailModalProps) {
  // Render modal with:
  // - Modal overlay (backdrop)
  // - Modal dialog (centered, max-width)
  // - Header with event ID and close button
  // - Metadata section (status, type, timestamps, error)
  // - JSON viewer section (collapsible tree view)
  // - Footer with reprocess button (if failed)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Modal backdrop */}
      <div className="modal-dialog">
        {/* Header */}
        {/* Metadata */}
        {/* JSON Viewer */}
        {/* Footer with actions */}
      </div>
    </div>
  );
}
```

**実装内容**:
- モーダルオーバーレイ: 背景をクリックで閉じる
- ヘッダー: イベントID、ステータスバッジ、閉じるボタン
- メタデータセクション: イベント種別、取込日時、処理日時、エラーメッセージ
- JSONビューア: `react-json-view`（または類似ライブラリ）を使用
  - シンタックスハイライト
  - 折りたたみ可能なツリービュー
  - コピーボタン
- 再処理ボタン: 失敗イベントのみ表示、クリックで再処理API呼び出し
- レスポンシブ対応: モバイルではフルスクリーン

---

## API呼び出し

### 使用するエンドポイント（Task 8.11で実装）

#### 1. `GET /api/plugins/:id/events`

イベント一覧を取得。

**クエリパラメータ**:
```typescript
interface ListEventsQuery {
  page?: number;           // Default: 1
  perPage?: number;        // Default: 20
  status?: string;         // Comma-separated: "processed,failed,pending"
  eventType?: string;      // Free text search
  startDate?: string;      // ISO date string
  endDate?: string;        // ISO date string
  sort?: string;           // "ingestedAt:desc" | "ingestedAt:asc"
}
```

**レスポンス**:
```typescript
interface ListEventsResponse {
  events: PluginEvent[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}
```

#### 2. `GET /api/plugins/:id/events/stats`

統計情報を取得。

**レスポンス**:
```typescript
interface EventsStatsResponse {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  latestIngestedAt: string | null;
  oldestIngestedAt: string | null;
}
```

#### 3. `GET /api/plugins/:id/events/:eventId`

イベント詳細を取得。

**レスポンス**:
```typescript
interface EventDetailResponse {
  event: PluginEvent;
}
```

#### 4. `POST /api/plugins/:id/events/:eventId/reprocess`

イベントを再処理キューに追加。

**レスポンス**:
```typescript
interface ReprocessResponse {
  success: boolean;
  message: string;
}
```

**レート制限**: 10リクエスト/分/ユーザー（429 Too Many Requestsでエラー）

---

## E2Eテスト仕様

### テストファイル: `core/e2e/plugin-data-display.spec.ts`

```typescript
/**
 * E2E Tests for Plugin Data Display Page
 *
 * Test scenarios:
 * 1. Page load and data display
 *    - Navigate to /dashboard/plugins/:id/data
 *    - Verify stats cards are displayed
 *    - Verify events table is rendered
 *    - Verify pagination is displayed
 *
 * 2. Filtering
 *    - Apply status filter (select "failed")
 *    - Verify filtered results
 *    - Apply event type filter (enter "github.push")
 *    - Verify filtered results
 *    - Apply date range filter
 *    - Verify filtered results
 *    - Clear filters
 *    - Verify all events are displayed again
 *
 * 3. Pagination
 *    - Click "Next" button
 *    - Verify page 2 is displayed
 *    - Click page number "3"
 *    - Verify page 3 is displayed
 *    - Click "Previous" button
 *    - Verify page 2 is displayed
 *
 * 4. Event detail modal
 *    - Click "View Detail" on an event
 *    - Verify modal is opened
 *    - Verify event metadata is displayed
 *    - Verify JSON viewer is rendered
 *    - Close modal by clicking backdrop
 *    - Verify modal is closed
 *
 * 5. Reprocess failed event
 *    - Click "View Detail" on a failed event
 *    - Click "Reprocess" button
 *    - Verify success message is displayed
 *    - Verify event status is updated (optimistic UI)
 *    - Verify modal is closed
 *
 * 6. Error handling
 *    - Simulate API error (network failure)
 *    - Verify error message is displayed
 *    - Simulate rate limit error (429)
 *    - Verify rate limit message is displayed
 *
 * 7. Access control
 *    - Access page as non-admin user
 *    - Verify access is allowed (plugins are tenant-scoped)
 *    - Access page without authentication
 *    - Verify redirect to login page
 */

import { test, expect } from '@playwright/test';

test.describe('Plugin Data Display Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    // Navigate to plugin data page
  });

  test('should display stats and events table', async ({ page }) => {
    // Test implementation
  });

  test('should filter events by status', async ({ page }) => {
    // Test implementation
  });

  test('should paginate events', async ({ page }) => {
    // Test implementation
  });

  test('should open event detail modal', async ({ page }) => {
    // Test implementation
  });

  test('should reprocess failed event', async ({ page }) => {
    // Test implementation
  });

  test('should handle API errors', async ({ page }) => {
    // Test implementation
  });
});
```

**実装内容**:
- 15個以上のテストケース
- ページ読み込み、データ表示、フィルタリング、ページネーション、詳細モーダル、再処理機能をカバー
- エラーハンドリング（API失敗、レート制限）
- アクセス制御（認証、権限チェック）
- レスポンシブデザインのテスト（モバイル、タブレット）

---

## 依存ライブラリ

### JSON Viewer

以下のいずれかを使用：

1. **`react-json-view`** (推奨)
   ```bash
   pnpm add react-json-view
   pnpm add -D @types/react-json-view
   ```
   - シンタックスハイライト、折りたたみ、コピー機能あり
   - ダークモード対応

2. **`react-json-tree`** (代替)
   ```bash
   pnpm add react-json-tree
   ```
   - 軽量、シンプル
   - カスタマイズ性が高い

3. **Custom JSON Viewer**
   - `<pre>`タグと`JSON.stringify(data, null, 2)`で実装
   - 最小限の機能で十分な場合

---

## セキュリティ考慮事項

### 機密情報のマスキング

Task 8.11の`sanitizeRawData()`関数により、APIレスポンスで機密情報（トークン、パスワードなど）は既にマスキングされている。

**マスキング対象**:
- `token`, `api_key`, `password`, `secret`などのキー
- クレジットカード番号、SSNなどのパターン

**マスキング形式**:
```json
{
  "github_token": "***REDACTED***",
  "api_key": "***REDACTED***"
}
```

### XSS対策

- JSONビューアはエスケープされた形式で表示
- `dangerouslySetInnerHTML`は使用しない
- React標準のエスケープ機能を利用

### レート制限

- 再処理APIは10リクエスト/分/ユーザーに制限
- レート制限エラー（429）をハンドルし、ユーザーに通知
- リトライ後の時間（`Retry-After`ヘッダー）を表示

---

## パフォーマンス最適化

### クライアントサイドキャッシュ

- `useFetcher`のキャッシュ機能を活用
- 同一フィルタ・ページへの再訪問時はキャッシュから表示
- 統計情報は5分間キャッシュ

### 仮想スクロール（オプション）

- イベント数が1000件以上の場合、仮想スクロール（`react-window`など）を検討
- 初期実装ではページネーションで対応

### 遅延ローディング

- JSONビューアは動的import（`React.lazy`）で遅延ロード
- モーダルが開かれたときにロード

---

## アクセシビリティ

- **キーボードナビゲーション**: Tab/Shift+Tab、Enter/Space、Esc
- **スクリーンリーダー対応**: `aria-label`、`role`属性を適切に設定
- **フォーカス管理**: モーダルオープン時にフォーカスをトラップ
- **カラーコントラスト**: WCAG AA基準（4.5:1以上）

---

## 実装スケジュール

| 時間 | タスク |
|------|--------|
| 1h   | メインページ実装（`dashboard.plugins_.$id.data.tsx`） |
| 1h   | テーブル・フィルタコンポーネント実装 |
| 1h   | 統計・モーダルコンポーネント実装 |
| 1h   | E2Eテスト実装 |

**合計**: 4時間

---

## 完了チェックリスト

- [ ] `dashboard.plugins_.$id.data.tsx`作成（SPA実装）
- [ ] `EventsTable.tsx`作成（ページネーション付きテーブル）
- [ ] `EventsFilter.tsx`作成（ステータス、種別、日付フィルタ）
- [ ] `EventsStats.tsx`作成（統計サマリー）
- [ ] `EventDetailModal.tsx`作成（JSON ビューア付き）
- [ ] 再処理機能実装（楽観的UI更新）
- [ ] E2Eテスト実装（15テスト以上）
- [ ] すべてのE2Eテストがパス
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] ダークモード対応
- [ ] レスポンシブデザイン対応（モバイル、タブレット）
- [ ] アクセシビリティチェック（キーボードナビゲーション、スクリーンリーダー）

---

## 関連ドキュメント

- [Task 8.11: プラグインの収集結果の詳細用API実装](.tmp/tasks/task-8.11-plugin-data-api.md)
- [Task 8.9: プラグインの実行ログ確認画面実装](.tmp/tasks/task-8.9-plugin-logs-ui.md)（類似UI）
- [プラグイン仕様](.tmp/plugin.md)
