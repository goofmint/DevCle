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
│   ├── types/
│   │   └── plugin-events.ts                         # 共有型定義
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

## 共有型定義

### `app/types/plugin-events.ts`

すべてのコンポーネントで使用される型を一元管理する。

```typescript
/**
 * Shared Type Definitions for Plugin Events
 *
 * This file serves as the single source of truth for all plugin event
 * related types used across components.
 */

/**
 * Plugin Event
 *
 * Represents a single event collected by a plugin from an external source.
 * Stored in plugin_events_raw table.
 */
export interface PluginEvent {
  pluginEventId: string;
  eventType: string;
  status: 'processed' | 'failed' | 'pending';
  rawData: Record<string, any>;
  errorMessage: string | null;
  ingestedAt: string;       // ISO timestamp
  processedAt: string | null; // ISO timestamp
}

/**
 * Events Filter
 *
 * Filter criteria for event list queries.
 */
export interface EventsFilter {
  status?: string[];        // ["processed", "failed", "pending"]
  eventType?: string;       // Free text search (partial match)
  startDate?: string;       // ISO date string
  endDate?: string;         // ISO date string
}

/**
 * Events Statistics
 *
 * Aggregated statistics for plugin events.
 */
export interface EventsStats {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  latestIngestedAt: string | null;   // ISO timestamp
  oldestIngestedAt: string | null;   // ISO timestamp
}

/**
 * Pagination Info
 *
 * Pagination metadata for event list.
 */
export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/**
 * API Response Types
 */

export interface ListEventsResponse {
  events: PluginEvent[];
  pagination: PaginationInfo;
}

export interface EventsStatsResponse extends EventsStats {}

export interface EventDetailResponse {
  event: PluginEvent;
}

export interface ReprocessResponse {
  success: boolean;
  message: string;
}

/**
 * API Error Response
 *
 * Standard error response format from API.
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}
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
import type {
  PluginEvent,
  EventsFilter,
  EventsStats,
  PaginationInfo,
} from '~/types/plugin-events';

export default function PluginDataPage() {
  // State management:
  // - events: PluginEvent[]
  // - filters: EventsFilter (status, eventType, startDate, endDate)
  // - pagination: PaginationInfo
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
 * - pagination: PaginationInfo
 * - onPageChange: (page: number) => void
 * - onEventClick: (event: PluginEvent) => void
 */

import type { PluginEvent, PaginationInfo } from '~/types/plugin-events';

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

import type { EventsFilter } from '~/types/plugin-events';

interface EventsFilterProps {
  filters: EventsFilter;
  onChange: (filters: EventsFilter) => void;
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

import type { EventsStats } from '~/types/plugin-events';

interface EventsStatsProps {
  stats: EventsStats | null;
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

import type { PluginEvent } from '~/types/plugin-events';

interface EventDetailModalProps {
  event: PluginEvent;
  onClose: () => void;
  onReprocess: (eventId: string) => void;
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

すべてのレスポンス型は `~/types/plugin-events.ts` で定義済み。

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

**レスポンス**: `ListEventsResponse` (see `~/types/plugin-events.ts`)

#### 2. `GET /api/plugins/:id/events/stats`

統計情報を取得。

**レスポンス**: `EventsStatsResponse` (see `~/types/plugin-events.ts`)

#### 3. `GET /api/plugins/:id/events/:eventId`

イベント詳細を取得。

**レスポンス**: `EventDetailResponse` (see `~/types/plugin-events.ts`)

#### 4. `POST /api/plugins/:id/events/:eventId/reprocess`

イベントを再処理キューに追加。

**レスポンス**: `ReprocessResponse` (see `~/types/plugin-events.ts`)

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

## エラーハンドリング & UX

このセクションでは、各種エラー状況に対する具体的なUI応答と動作を定義する。

### 対応するAPIエラーコード

| エラーコード | 説明 | UI応答 |
|-------------|------|--------|
| **400** | Bad Request（不正なリクエスト） | インラインアラート |
| **401** | Unauthorized（認証失敗） | リダイレクト → `/login` |
| **403** | Forbidden（権限不足） | トースト通知 |
| **404** | Not Found（リソース未発見） | インラインアラート |
| **429** | Too Many Requests（レート制限） | トースト + ボタン無効化 |
| **500** | Internal Server Error（サーバーエラー） | トースト通知 |
| **503** | Service Unavailable（サービス停止） | トースト通知 |
| **Network Timeout** | リクエストタイムアウト | トースト + リトライボタン |
| **Network Failure** | ネットワーク接続失敗 | トースト + リトライボタン |

### エラー表示の詳細

#### 1. インラインアラート（400, 404）

**表示場所**: コンテンツエリア上部（テーブル・フィルタの直上）

**UI要素**:
```html
<div class="alert alert-error">
  <Icon name="alert-circle" />
  <span>Failed to load events: Invalid filter parameters</span>
  <button class="btn-close" aria-label="Close alert">×</button>
</div>
```

**スタイル**:
- 背景色: `bg-red-50 dark:bg-red-900/20`
- ボーダー: `border-l-4 border-red-500`
- テキスト: `text-red-800 dark:text-red-200`
- 閉じるボタン: ユーザーが手動で閉じる

**メッセージ例**:
- 400: `"Failed to load events: Invalid filter parameters"`
- 404: `"Plugin not found or event does not exist"`

---

#### 2. トースト通知（403, 429, 500, 503, Network Timeout, Network Failure）

**表示場所**: 画面右上（fixed position、z-index: 9999）

**UI要素**:
```html
<div class="toast toast-error">
  <Icon name="alert-triangle" />
  <div>
    <h4>Request Failed</h4>
    <p>Server error occurred. Please try again later.</p>
  </div>
  <button class="btn-close" aria-label="Dismiss">×</button>
</div>
```

**スタイル**:
- 背景色: `bg-white dark:bg-gray-800`
- ボーダー: `border-l-4 border-red-500`
- シャドウ: `shadow-lg`
- アニメーション: スライドイン（右から）、5秒後に自動消去

**メッセージ例**:
- 403: `"Access denied. You do not have permission to reprocess events."`
- 429: `"Rate limit exceeded. Please wait {N} seconds before retrying."`
- 500: `"Server error occurred. Please try again later."`
- 503: `"Service temporarily unavailable. Please try again in a few minutes."`
- Network Timeout: `"Request timed out. Check your connection and try again."`
- Network Failure: `"Network error. Please check your internet connection."`

---

#### 3. 401 Unauthorized（リダイレクト）

**動作**:
1. エラー検知時、即座に `/login` へリダイレクト
2. リダイレクト前にセッションストレージに現在のURLを保存
3. ログイン成功後、元のURLに戻る

**実装**:
```typescript
if (response.status === 401) {
  sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
  window.location.href = '/login';
}
```

---

### クライアントサイドリトライ・バックオフ戦略

#### リトライ対象エラー

- 500 Internal Server Error
- 503 Service Unavailable
- Network Timeout
- Network Failure

#### リトライ戦略

**アルゴリズム**: 指数バックオフ + ジッター（Exponential Backoff with Jitter）

**パラメータ**:
- 最大リトライ回数: `3`
- 初期待機時間: `1秒`
- バックオフ係数: `2`（指数関数的に増加）
- 最大待機時間: `10秒`
- ジッター: `±20%`（ランダム性を追加して同時リトライを回避）

**計算式**:
```typescript
const baseDelay = 1000; // 1 second
const maxDelay = 10000; // 10 seconds
const jitterFactor = 0.2; // ±20%

function calculateDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    baseDelay * Math.pow(2, attempt),
    maxDelay
  );
  const jitter = exponentialDelay * jitterFactor * (Math.random() * 2 - 1);
  return Math.floor(exponentialDelay + jitter);
}

// Retry delays:
// - Attempt 1: ~1秒 (800ms - 1200ms)
// - Attempt 2: ~2秒 (1600ms - 2400ms)
// - Attempt 3: ~4秒 (3200ms - 4800ms)
```

**実装例**:
```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // リトライ対象エラーチェック
      if ([500, 503].includes(response.status)) {
        throw new Error(`Server error: ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // 最後のリトライなら諦める
      if (attempt === maxRetries) {
        break;
      }

      // 待機時間計算
      const delay = calculateDelay(attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

#### リトライUI

**ローディング状態**:
- スピナー表示
- リトライ回数表示: `"Retrying... (Attempt 2 of 3)"`

**リトライ失敗時**:
- トースト通知: `"Failed to load events after 3 attempts. Please try again."`
- 「Retry」ボタン表示（手動リトライ）

---

### レート制限フィードバック（429 Too Many Requests）

#### レート制限パラメータ

- **制限**: 10リクエスト/分/ユーザー
- **対象API**: `POST /api/plugins/:id/events/:eventId/reprocess`
- **クライアントサイド保護**: 3回連続クリックで一時無効化

#### UI動作

**1. 初回レート制限エラー（429）**

- トースト通知を表示:
  ```
  Title: "Rate Limit Exceeded"
  Message: "You can reprocess up to 10 events per minute. Please wait {N} seconds."
  ```
- `Retry-After`ヘッダーから待機時間を取得
- 再処理ボタンを無効化
- ボタンに待機時間カウントダウンを表示

**2. ボタン無効化状態**

**UI要素**:
```html
<button disabled class="btn btn-disabled">
  Reprocess (Wait 45s)
</button>
```

**スタイル**:
- 背景色: `bg-gray-300 dark:bg-gray-700`
- カーソル: `cursor-not-allowed`
- テキスト: `text-gray-500`

**カウントダウン**:
- 1秒ごとに更新: `"Reprocess (Wait 44s)"` → `"Reprocess (Wait 43s)"` → ...
- 0秒になったら再有効化: `"Reprocess"`

**実装例**:
```typescript
const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);

useEffect(() => {
  if (rateLimitRemaining === null || rateLimitRemaining <= 0) return;

  const timer = setInterval(() => {
    setRateLimitRemaining((prev) => {
      if (prev === null || prev <= 1) {
        clearInterval(timer);
        return null;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [rateLimitRemaining]);

// API error handling
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
  setRateLimitRemaining(retryAfter);
  showToast('error', `Rate limit exceeded. Please wait ${retryAfter} seconds.`);
}
```

**3. ツールチップ説明**

ボタンにカーソルホバー時、ツールチップを表示:
```
"You have reached the rate limit (10 requests per minute).
Please wait before retrying."
```

**4. クライアントサイド保護（3回連続クリック）**

- 同じイベントに対して3回連続で再処理ボタンをクリックした場合、ローカルで一時無効化
- 無効化時間: 30秒
- トースト通知: `"Please wait before retrying again."`

**実装**:
```typescript
const reprocessAttempts = useRef<Map<string, number>>(new Map());

function handleReprocess(eventId: string) {
  const attempts = reprocessAttempts.current.get(eventId) || 0;

  if (attempts >= 3) {
    showToast('warning', 'Please wait before retrying again.');
    return;
  }

  reprocessAttempts.current.set(eventId, attempts + 1);

  // 30秒後にカウントをリセット
  setTimeout(() => {
    reprocessAttempts.current.delete(eventId);
  }, 30000);

  // API呼び出し
  reprocessEvent(eventId);
}
```

---

### ネットワークタイムアウトハンドリング

#### タイムアウト設定

| API | タイムアウト時間 | 理由 |
|-----|-----------------|------|
| `GET /api/plugins/:id/events` | 15秒 | 大量データフェッチ |
| `GET /api/plugins/:id/events/stats` | 10秒 | 集計クエリ |
| `GET /api/plugins/:id/events/:eventId` | 10秒 | 単一レコード取得 |
| `POST /api/plugins/:id/events/:eventId/reprocess` | 10秒 | キュー追加のみ |

#### タイムアウト時のUI動作

**1. スピナー表示**

- API呼び出し開始時、ローディングスピナーを表示
- スピナー表示時間: 最大15秒（最長APIに合わせる）

**2. タイムアウト検知**

- タイムアウト時間を超えたら、スピナーを非表示にしてエラートースト表示

**3. エラーメッセージ**

```
Title: "Request Timed Out"
Message: "The request took too long. Please check your connection and try again."
```

**4. リトライボタン**

トースト内に「Retry」ボタンを表示:
```html
<div class="toast toast-error">
  <Icon name="clock" />
  <div>
    <h4>Request Timed Out</h4>
    <p>The request took too long. Please check your connection and try again.</p>
  </div>
  <button class="btn btn-sm" onclick="retryRequest()">Retry</button>
</div>
```

**実装例**:
```typescript
async function fetchEventsWithTimeout(url: string, timeoutMs: number = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}
```

---

### エラーメッセージの国際化対応

すべてのエラーメッセージは英語で実装する（日本語は使用しない）。

**エラーメッセージ定数**:
```typescript
export const ERROR_MESSAGES = {
  400: 'Invalid request parameters. Please check your filters.',
  401: 'Authentication required. Redirecting to login...',
  403: 'Access denied. You do not have permission for this action.',
  404: 'Resource not found. The event may have been deleted.',
  429: 'Rate limit exceeded. Please wait before retrying.',
  500: 'Server error occurred. Please try again later.',
  503: 'Service temporarily unavailable. Please try again in a few minutes.',
  TIMEOUT: 'Request timed out. Check your connection and try again.',
  NETWORK: 'Network error. Please check your internet connection.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
} as const;
```

---

### E2Eテストでの検証項目

すべてのエラーシナリオに対してE2Eテストを実装する必要がある。

**テストケース**:

1. **400 Bad Request**
   - 不正なフィルタパラメータでAPI呼び出し
   - インラインアラートが表示されることを確認
   - メッセージテキストを検証

2. **401 Unauthorized**
   - 未認証状態でページアクセス
   - `/login`へリダイレクトされることを確認

3. **403 Forbidden**
   - 権限不足のユーザーで再処理を試行
   - トースト通知が表示されることを確認

4. **404 Not Found**
   - 存在しないイベントIDでAPI呼び出し
   - インラインアラートが表示されることを確認

5. **429 Rate Limit**
   - 連続して11回再処理APIを呼び出し
   - トースト通知が表示されることを確認
   - ボタンが無効化され、カウントダウンが表示されることを確認
   - ツールチップが表示されることを確認

6. **500 Internal Server Error**
   - モックAPIで500エラーを返す
   - トースト通知が表示されることを確認
   - 3回自動リトライされることを確認

7. **Network Timeout**
   - モックAPIでタイムアウトをシミュレート
   - 15秒後にトースト + リトライボタンが表示されることを確認

8. **Network Failure**
   - ネットワーク接続を切断
   - トースト通知が表示されることを確認

**テスト実装例**:
```typescript
test('should display rate limit error and disable button', async ({ page }) => {
  // Navigate to plugin data page
  await page.goto('/dashboard/plugins/test-plugin/data');

  // Click reprocess button 11 times (exceeds 10 req/min limit)
  for (let i = 0; i < 11; i++) {
    await page.click('[data-testid="reprocess-button-0"]');
    await page.waitForTimeout(100);
  }

  // Verify toast notification
  await expect(page.locator('[data-testid="toast"]')).toContainText(
    'Rate limit exceeded'
  );

  // Verify button is disabled
  await expect(page.locator('[data-testid="reprocess-button-0"]')).toBeDisabled();

  // Verify countdown is displayed
  await expect(page.locator('[data-testid="reprocess-button-0"]')).toContainText(
    /Wait \d+s/
  );

  // Verify tooltip
  await page.hover('[data-testid="reprocess-button-0"]');
  await expect(page.locator('[data-testid="tooltip"]')).toContainText(
    'rate limit'
  );
});
```

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

### 型定義・ファイル構成
- [ ] `app/types/plugin-events.ts`作成（共有型定義）
- [ ] すべてのコンポーネントが共有型を参照

### コンポーネント実装
- [ ] `dashboard.plugins_.$id.data.tsx`作成（SPA実装）
- [ ] `EventsTable.tsx`作成（ページネーション付きテーブル）
- [ ] `EventsFilter.tsx`作成（ステータス、種別、日付フィルタ）
- [ ] `EventsStats.tsx`作成（統計サマリー）
- [ ] `EventDetailModal.tsx`作成（JSON ビューア付き）

### 機能実装
- [ ] 再処理機能実装（楽観的UI更新）
- [ ] フィルタリング機能実装
- [ ] ページネーション実装
- [ ] 統計サマリー実装

### エラーハンドリング
- [ ] すべてのAPIエラーコード（400/401/403/404/429/500/503）に対応
- [ ] インラインアラート実装（400, 404）
- [ ] トースト通知実装（403, 429, 500, 503, Timeout, Network）
- [ ] 401リダイレクト実装（セッションストレージ保存）
- [ ] 指数バックオフリトライ実装（3回、ジッター付き）
- [ ] レート制限フィードバック実装（カウントダウン、ツールチップ）
- [ ] ネットワークタイムアウトハンドリング実装（15秒）
- [ ] エラーメッセージ定数定義（英語）

### E2Eテスト
- [ ] ページ読み込み・データ表示テスト
- [ ] フィルタリングテスト
- [ ] ページネーションテスト
- [ ] 詳細モーダルテスト
- [ ] 再処理機能テスト
- [ ] エラーハンドリングテスト（8シナリオ）
  - [ ] 400 Bad Request
  - [ ] 401 Unauthorized
  - [ ] 403 Forbidden
  - [ ] 404 Not Found
  - [ ] 429 Rate Limit（カウントダウン、ツールチップ）
  - [ ] 500 Internal Server Error（自動リトライ）
  - [ ] Network Timeout
  - [ ] Network Failure
- [ ] すべてのE2Eテストがパス（20テスト以上）

### 品質チェック
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] ダークモード対応
- [ ] レスポンシブデザイン対応（モバイル、タブレット）
- [ ] アクセシビリティチェック（キーボードナビゲーション、スクリーンリーダー）
- [ ] パフォーマンス最適化（キャッシング、遅延ローディング）

---

## 関連ドキュメント

- [Task 8.11: プラグインの収集結果の詳細用API実装](.tmp/tasks/task-8.11-plugin-data-api.md)
- [Task 8.9: プラグインの実行ログ確認画面実装](.tmp/tasks/task-8.9-plugin-logs-ui.md)（類似UI）
- [プラグイン仕様](.tmp/plugin.md)
