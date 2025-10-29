# Task 8.11: プラグインの収集結果の詳細表示

**ステータス**: ドキュメント作成完了
**推定時間**: 4 時間
**依存関係**: Task 8.4（Plugin 管理 API 実装）

---

## 概要

プラグインが外部APIから収集した生データ（`plugin_events_raw` テーブル）を管理画面で表示する機能を実装します。この画面により、以下が可能になります：

- プラグインが収集した生データの一覧表示
- データのフィルタリング（日付範囲、ステータス、イベント種別）
- ソート機能（日付、ステータス）
- ページネーション
- 個別データの詳細表示（JSON ビューア）
- 統計情報の表示（総件数、成功/失敗件数、最新/最古の収集日時）

---

## データモデル

### plugin_events_raw テーブル（既存）

```typescript
// core/db/schema/plugins.ts（既存）
export const pluginEventsRaw = pgTable('plugin_events_raw', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  pluginId: text('plugin_id').notNull(),
  eventType: text('event_type').notNull(), // 例: "github:pull_request", "slack:message"
  rawData: jsonb('raw_data').notNull(), // 外部APIから取得した生データ
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }), // NULL = 未処理
  status: text('status').notNull(), // "pending", "processed", "failed"
  errorMessage: text('error_message'), // 処理失敗時のエラー
});
```

**用途**:
- プラグインが外部APIから取得した生データを保存
- 正規化処理前の原本データとして保持
- 処理の成功/失敗を追跡
- 後日の再処理や監査に使用

---

## UI 構成

### 8.11.1: メインページ（一覧表示）

**ルート**: `/dashboard/plugins/:id`
**ファイル**: `app/routes/dashboard/plugins.$id._index.tsx`

#### 表示内容

1. **ヘッダー**
   - プラグイン名とアイコン
   - 「設定」「実行ログ」へのリンク
   - 手動同期ボタン（該当する場合）

2. **統計サマリー**（カード形式）
   ```
   ┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
   │  総収集件数      │  成功             │  失敗             │  未処理           │
   │  12,345         │  12,100 (98.0%)  │  45 (0.4%)       │  200 (1.6%)      │
   └─────────────────┴─────────────────┴─────────────────┴─────────────────┘
   ```

3. **フィルタ・ソートUI**
   - 日付範囲選択（カレンダー UI）
   - ステータス選択（pending / processed / failed）
   - イベント種別選択（プラグイン固有、例: github:pull_request）
   - ソート選択（収集日時 昇順/降順）

4. **データテーブル**
   ```
   ┌──────────────────────┬──────────────────┬──────────────┬──────────────────────┬─────────┐
   │ 収集日時              │ イベント種別      │ ステータス    │ 処理日時              │ 操作    │
   ├──────────────────────┼──────────────────┼──────────────┼──────────────────────┼─────────┤
   │ 2025-10-29 12:34:56  │ github:pr_opened │ processed    │ 2025-10-29 12:35:10  │ [詳細]  │
   │ 2025-10-29 12:33:45  │ github:issue     │ failed       │ 2025-10-29 12:34:00  │ [詳細]  │
   │ 2025-10-29 12:32:10  │ github:star      │ pending      │ -                    │ [詳細]  │
   └──────────────────────┴──────────────────┴──────────────┴──────────────────────┴─────────┘
   ```

   - ステータスは色分け（processed: 緑、failed: 赤、pending: 黄）
   - 「詳細」ボタンクリックでモーダル表示

5. **ページネーション**
   - 1ページあたり20件
   - 「前へ」「次へ」ボタン
   - ページ番号表示

#### インタフェース定義

```typescript
// app/routes/dashboard/plugins.$id._index.tsx

interface LoaderData {
  plugin: {
    pluginId: string;
    name: string;
    version: string;
    description: string;
  };
  events: {
    items: PluginEventRaw[];
    total: number;
    page: number;
    perPage: number;
  };
  stats: {
    total: number;
    processed: number;
    failed: number;
    pending: number;
    latestIngestedAt: string | null;
    oldestIngestedAt: string | null;
  };
}

interface PluginEventRaw {
  eventId: string;
  eventType: string;
  status: 'pending' | 'processed' | 'failed';
  ingestedAt: string;
  processedAt: string | null;
  errorMessage: string | null;
  // rawData は詳細モーダルで取得
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  // 1. 認証チェック
  // 2. プラグイン情報取得（GET /api/plugins/:id）
  // 3. クエリパラメータ解析（page, status, eventType, startDate, endDate, sort）
  // 4. 統計情報取得（GET /api/plugins/:id/events/stats）
  // 5. イベント一覧取得（GET /api/plugins/:id/events）
  // 6. LoaderData として返す
}
```

### 8.11.2: 詳細モーダル

**トリガー**: テーブルの「詳細」ボタンクリック
**実装**: モーダルコンポーネント（`EventDetailModal`）

#### 表示内容

```
┌─────────────────────────────────────────────────────────────┐
│  イベント詳細                                         [×]    │
├─────────────────────────────────────────────────────────────┤
│  イベントID: a1b2c3d4-...                                    │
│  イベント種別: github:pull_request                           │
│  ステータス: processed                                       │
│  収集日時: 2025-10-29 12:34:56                               │
│  処理日時: 2025-10-29 12:35:10                               │
│                                                              │
│  [生データ（JSON）] [処理後データ]                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ {                                                      │  │
│  │   "action": "opened",                                  │  │
│  │   "pull_request": {                                    │  │
│  │     "id": 12345,                                       │  │
│  │     "title": "Fix bug in authentication",              │  │
│  │     "user": {                                          │  │
│  │       "login": "developer123",                         │  │
│  │       "id": 67890                                      │  │
│  │     },                                                 │  │
│  │     "created_at": "2025-10-29T12:30:00Z"               │  │
│  │   }                                                    │  │
│  │ }                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [エラー情報]（failed の場合のみ表示）                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Error: Failed to normalize data                        │  │
│  │ Missing required field: developer.email                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [再処理] [閉じる]                                           │
└─────────────────────────────────────────────────────────────┘
```

#### インタフェース定義

```typescript
// app/components/plugins/EventDetailModal.tsx

interface EventDetailModalProps {
  event: PluginEventDetail;
  isOpen: boolean;
  onClose: () => void;
  onReprocess?: (eventId: string) => Promise<void>;
}

interface PluginEventDetail extends PluginEventRaw {
  rawData: unknown; // JSON データ
  activityId?: string; // 正規化後に作成された Activity の ID（processed の場合）
}

function EventDetailModal({ event, isOpen, onClose, onReprocess }: EventDetailModalProps) {
  // モーダル UI の実装
  // - JSON シンタックスハイライト表示（react-json-view または類似ライブラリ）
  // - タブ切り替え（生データ / 処理後データ）
  // - 再処理ボタン（failed の場合のみ有効）
}
```

---

## API 設計

### 8.11.3: イベント一覧取得 API

**エンドポイント**: `GET /api/plugins/:id/events`
**ファイル**: `app/routes/api/plugins.$id.events.ts`

#### リクエスト

**クエリパラメータ**:
```typescript
interface GetEventsQuery {
  page?: number;          // デフォルト: 1
  perPage?: number;       // デフォルト: 20、最大: 100
  status?: 'pending' | 'processed' | 'failed';
  eventType?: string;     // 例: "github:pull_request"
  startDate?: string;     // ISO 8601 形式（例: "2025-10-01T00:00:00Z"）
  endDate?: string;       // ISO 8601 形式
  sort?: 'asc' | 'desc';  // ingestedAt でソート、デフォルト: desc
}
```

#### レスポンス

```typescript
interface GetEventsResponse {
  items: Array<{
    eventId: string;
    eventType: string;
    status: 'pending' | 'processed' | 'failed';
    ingestedAt: string;
    processedAt: string | null;
    errorMessage: string | null;
  }>;
  pagination: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}
```

#### 実装概要

```typescript
// app/routes/api/plugins.$id.events.ts

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const pluginId = params.id!;

  // 1. クエリパラメータをパース
  const url = new URL(request.url);
  const query = parseEventsQuery(url.searchParams);

  // 2. バリデーション
  validateEventsQuery(query);

  // 3. DB クエリ構築
  const events = await withTenantContext(user.tenantId, async (tx) => {
    let q = tx
      .select({
        eventId: schema.pluginEventsRaw.eventId,
        eventType: schema.pluginEventsRaw.eventType,
        status: schema.pluginEventsRaw.status,
        ingestedAt: schema.pluginEventsRaw.ingestedAt,
        processedAt: schema.pluginEventsRaw.processedAt,
        errorMessage: schema.pluginEventsRaw.errorMessage,
      })
      .from(schema.pluginEventsRaw)
      .where(
        and(
          eq(schema.pluginEventsRaw.tenantId, user.tenantId),
          eq(schema.pluginEventsRaw.pluginId, pluginId)
        )
      );

    // 4. フィルタ適用
    if (query.status) {
      q = q.where(eq(schema.pluginEventsRaw.status, query.status));
    }
    if (query.eventType) {
      q = q.where(eq(schema.pluginEventsRaw.eventType, query.eventType));
    }
    if (query.startDate) {
      q = q.where(gte(schema.pluginEventsRaw.ingestedAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      q = q.where(lte(schema.pluginEventsRaw.ingestedAt, new Date(query.endDate)));
    }

    // 5. ソート
    q = q.orderBy(
      query.sort === 'asc'
        ? asc(schema.pluginEventsRaw.ingestedAt)
        : desc(schema.pluginEventsRaw.ingestedAt)
    );

    // 6. ページネーション
    const offset = (query.page - 1) * query.perPage;
    q = q.limit(query.perPage).offset(offset);

    const items = await q;

    // 7. 総件数取得
    const [{ count: total }] = await tx
      .select({ count: count() })
      .from(schema.pluginEventsRaw)
      .where(/* 同じフィルタ条件 */);

    return { items, total };
  });

  // 8. レスポンス構築
  return json({
    items: events.items,
    pagination: {
      total: events.total,
      page: query.page,
      perPage: query.perPage,
      totalPages: Math.ceil(events.total / query.perPage),
    },
  });
}
```

### 8.11.4: イベント詳細取得 API

**エンドポイント**: `GET /api/plugins/:id/events/:eventId`
**ファイル**: `app/routes/api/plugins.$id.events.$eventId.ts`

#### レスポンス

```typescript
interface GetEventDetailResponse {
  eventId: string;
  eventType: string;
  status: 'pending' | 'processed' | 'failed';
  ingestedAt: string;
  processedAt: string | null;
  errorMessage: string | null;
  rawData: unknown; // JSON データ
  activityId?: string; // 正規化後の Activity ID（processed の場合）
}
```

#### 実装概要

```typescript
// app/routes/api/plugins.$id.events.$eventId.ts

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const { id: pluginId, eventId } = params;

  // 1. イベント取得（rawData を含む）
  const event = await withTenantContext(user.tenantId, async (tx) => {
    const [evt] = await tx
      .select()
      .from(schema.pluginEventsRaw)
      .where(
        and(
          eq(schema.pluginEventsRaw.tenantId, user.tenantId),
          eq(schema.pluginEventsRaw.pluginId, pluginId),
          eq(schema.pluginEventsRaw.eventId, eventId)
        )
      )
      .limit(1);

    if (!evt) {
      throw new Response('Event not found', { status: 404 });
    }

    // 2. 関連する Activity を検索（processed の場合）
    let activityId: string | undefined;
    if (evt.status === 'processed') {
      // plugin_events_raw と activities を紐づける方法は実装次第
      // 例: activities テーブルに sourceEventId カラムを追加
      // または metadata に eventId を記録
    }

    return { ...evt, activityId };
  });

  return json(event);
}
```

### 8.11.5: イベント統計取得 API

**エンドポイント**: `GET /api/plugins/:id/events/stats`
**ファイル**: `app/routes/api/plugins.$id.events.stats.ts`

#### レスポンス

```typescript
interface GetEventsStatsResponse {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  latestIngestedAt: string | null;
  oldestIngestedAt: string | null;
}
```

#### 実装概要

```typescript
// app/routes/api/plugins.$id.events.stats.ts

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const pluginId = params.id!;

  const stats = await withTenantContext(user.tenantId, async (tx) => {
    // 1. ステータス別カウント
    const [counts] = await tx
      .select({
        total: count(),
        processed: count(
          sql`CASE WHEN ${schema.pluginEventsRaw.status} = 'processed' THEN 1 END`
        ),
        failed: count(
          sql`CASE WHEN ${schema.pluginEventsRaw.status} = 'failed' THEN 1 END`
        ),
        pending: count(
          sql`CASE WHEN ${schema.pluginEventsRaw.status} = 'pending' THEN 1 END`
        ),
      })
      .from(schema.pluginEventsRaw)
      .where(
        and(
          eq(schema.pluginEventsRaw.tenantId, user.tenantId),
          eq(schema.pluginEventsRaw.pluginId, pluginId)
        )
      );

    // 2. 最新/最古の収集日時
    const [dates] = await tx
      .select({
        latest: max(schema.pluginEventsRaw.ingestedAt),
        oldest: min(schema.pluginEventsRaw.ingestedAt),
      })
      .from(schema.pluginEventsRaw)
      .where(
        and(
          eq(schema.pluginEventsRaw.tenantId, user.tenantId),
          eq(schema.pluginEventsRaw.pluginId, pluginId)
        )
      );

    return {
      total: counts.total,
      processed: counts.processed,
      failed: counts.failed,
      pending: counts.pending,
      latestIngestedAt: dates.latest?.toISOString() ?? null,
      oldestIngestedAt: dates.oldest?.toISOString() ?? null,
    };
  });

  return json(stats);
}
```

### 8.11.6: イベント再処理 API（オプション）

**エンドポイント**: `POST /api/plugins/:id/events/:eventId/reprocess`
**ファイル**: `app/routes/api/plugins.$id.events.$eventId.reprocess.ts`

#### 用途

- 処理に失敗したイベント（status = 'failed'）を再処理
- 正規化ロジックを修正した後に過去データを再処理

#### 実装概要

```typescript
// app/routes/api/plugins.$id.events.$eventId.reprocess.ts

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  const { id: pluginId, eventId } = params;

  // 1. イベント取得
  const event = await withTenantContext(user.tenantId, async (tx) => {
    const [evt] = await tx
      .select()
      .from(schema.pluginEventsRaw)
      .where(
        and(
          eq(schema.pluginEventsRaw.tenantId, user.tenantId),
          eq(schema.pluginEventsRaw.pluginId, pluginId),
          eq(schema.pluginEventsRaw.eventId, eventId)
        )
      )
      .limit(1);

    if (!evt) {
      throw new Response('Event not found', { status: 404 });
    }

    return evt;
  });

  // 2. ステータスを pending に戻す
  await withTenantContext(user.tenantId, async (tx) => {
    await tx
      .update(schema.pluginEventsRaw)
      .set({
        status: 'pending',
        processedAt: null,
        errorMessage: null,
      })
      .where(eq(schema.pluginEventsRaw.eventId, eventId));
  });

  // 3. 再処理ジョブをキューに追加
  // （BullMQ または類似のジョブキューを使用）
  // await addJob('plugin:normalize', { eventId, pluginId, tenantId: user.tenantId });

  return json({ success: true, message: 'Reprocessing queued' });
}
```

---

## サービス層の実装

### 8.11.7: plugin-events.service.ts

**ファイル**: `core/services/plugin-events.service.ts`

```typescript
// core/services/plugin-events.service.ts

import { z } from 'zod';
import { and, eq, gte, lte, count, asc, desc, max, min, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { withTenantContext } from '../db/connection';

// ===========================
// スキーマ定義
// ===========================

export const ListEventsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'processed', 'failed']).optional(),
  eventType: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

export type ListEventsInput = z.infer<typeof ListEventsSchema>;

export interface PluginEventListItem {
  eventId: string;
  eventType: string;
  status: 'pending' | 'processed' | 'failed';
  ingestedAt: Date;
  processedAt: Date | null;
  errorMessage: string | null;
}

export interface PluginEventDetail extends PluginEventListItem {
  rawData: unknown;
  activityId?: string;
}

export interface EventsStats {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  latestIngestedAt: Date | null;
  oldestIngestedAt: Date | null;
}

// ===========================
// イベント一覧取得
// ===========================

export async function listPluginEvents(
  tenantId: string,
  pluginId: string,
  input: ListEventsInput
): Promise<{ items: PluginEventListItem[]; total: number }> {
  // 実装: withTenantContext を使用して DB クエリ実行
  // フィルタ、ソート、ページネーションを適用
}

// ===========================
// イベント詳細取得
// ===========================

export async function getPluginEventDetail(
  tenantId: string,
  pluginId: string,
  eventId: string
): Promise<PluginEventDetail | null> {
  // 実装: rawData を含む完全なイベント情報を取得
  // 関連する activityId があれば取得
}

// ===========================
// イベント統計取得
// ===========================

export async function getPluginEventsStats(
  tenantId: string,
  pluginId: string
): Promise<EventsStats> {
  // 実装: ステータス別カウント、最新/最古の収集日時を取得
}

// ===========================
// イベント再処理
// ===========================

export async function reprocessEvent(
  tenantId: string,
  pluginId: string,
  eventId: string
): Promise<void> {
  // 実装: ステータスを pending に戻し、再処理ジョブをキューに追加
}
```

---

## UI コンポーネント

### 8.11.8: EventsTable コンポーネント

```typescript
// app/components/plugins/EventsTable.tsx

interface EventsTableProps {
  events: PluginEventListItem[];
  onViewDetail: (eventId: string) => void;
}

function EventsTable({ events, onViewDetail }: EventsTableProps) {
  // テーブル UI の実装
  // - ステータスの色分け表示
  // - 日時のフォーマット
  // - 「詳細」ボタン
}
```

### 8.11.9: EventsFilter コンポーネント

```typescript
// app/components/plugins/EventsFilter.tsx

interface EventsFilterProps {
  eventTypes: string[]; // プラグイン固有のイベント種別一覧
  onFilterChange: (filters: FilterState) => void;
}

interface FilterState {
  status?: 'pending' | 'processed' | 'failed';
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  sort: 'asc' | 'desc';
}

function EventsFilter({ eventTypes, onFilterChange }: EventsFilterProps) {
  // フィルタ UI の実装
  // - ステータス選択（ラジオボタンまたはドロップダウン）
  // - イベント種別選択（ドロップダウン）
  // - 日付範囲選択（カレンダー UI）
  // - ソート選択（ドロップダウン）
}
```

### 8.11.10: EventsStats コンポーネント

```typescript
// app/components/plugins/EventsStats.tsx

interface EventsStatsProps {
  stats: EventsStats;
}

function EventsStats({ stats }: EventsStatsProps) {
  // 統計カード UI の実装
  // - 総件数、成功/失敗/未処理件数
  // - パーセンテージ表示
  // - 最新/最古の収集日時
}
```

---

## テスト方針

### 単体テスト（Vitest）

1. **サービス層テスト**（`core/services/plugin-events.service.test.ts`）
   - `listPluginEvents()`: フィルタ、ソート、ページネーションの動作確認
   - `getPluginEventDetail()`: イベント詳細取得
   - `getPluginEventsStats()`: 統計計算の正確性
   - `reprocessEvent()`: ステータス更新とジョブキュー追加

2. **API テスト**（`app/routes/api/plugins.$id.events.test.ts`）
   - GET /api/plugins/:id/events: クエリパラメータの検証
   - GET /api/plugins/:id/events/:eventId: 詳細取得
   - GET /api/plugins/:id/events/stats: 統計取得
   - POST /api/plugins/:id/events/:eventId/reprocess: 再処理

### E2E テスト（Playwright）

1. **イベント一覧表示**（`core/e2e/plugin-events.spec.ts`）
   - ページ読み込み時に統計とイベント一覧が表示される
   - ページネーションが機能する
   - フィルタ適用後に一覧が更新される
   - ソート変更後に順序が変わる

2. **イベント詳細モーダル**
   - 「詳細」ボタンクリックでモーダルが開く
   - JSON データが正しく表示される
   - モーダルを閉じることができる

3. **イベント再処理**
   - 失敗イベントで「再処理」ボタンが表示される
   - 再処理後にステータスが pending に変わる

---

## セキュリティ考慮事項

1. **認証・認可**
   - すべての API エンドポイントで `requireAuth()` を使用
   - プラグインへのアクセス権限を確認（テナント ID チェック）

2. **データ露出の制限**
   - `rawData` は詳細表示時のみ取得（一覧では含めない）
   - 機密情報（API キー、トークン）が rawData に含まれる場合、マスキング処理を検討

3. **SQL インジェクション対策**
   - Drizzle ORM のパラメータ化クエリを使用
   - ユーザー入力は Zod で検証

4. **レート制限**
   - 統計情報のキャッシュ（Redis、60秒間）
   - 再処理 API のレート制限（1分間に10回まで）

---

## パフォーマンス最適化

1. **データベースクエリ最適化**
   - `plugin_events_raw` テーブルにインデックス追加:
     - `(tenant_id, plugin_id, ingested_at DESC)` — 一覧取得用
     - `(tenant_id, plugin_id, status)` — フィルタ用

2. **ページネーション**
   - OFFSET ベースのページネーションを使用
   - 大規模データセットでは Cursor ベースへの移行を検討

3. **統計情報のキャッシュ**
   - Redis に60秒間キャッシュ
   - キャッシュキー: `plugin_events_stats:{tenantId}:{pluginId}`

4. **JSON データの遅延読み込み**
   - 一覧表示では `rawData` を含めない（カラムを省略）
   - 詳細モーダルを開いた時に初めて取得

---

## 実装の優先順位

### Phase 1（基本機能）
1. データベーススキーマ確認（既存の `plugin_events_raw` テーブル）
2. サービス層実装（`plugin-events.service.ts`）
3. API 実装（一覧取得、詳細取得、統計取得）
4. メインページ UI 実装（一覧表示、統計サマリー）

### Phase 2（詳細・フィルタ）
5. 詳細モーダル実装（JSON ビューア）
6. フィルタ・ソート UI 実装
7. ページネーション実装

### Phase 3（追加機能）
8. 再処理 API と UI 実装
9. E2E テスト作成
10. パフォーマンス最適化（インデックス、キャッシュ）

---

## 今後の拡張案（将来的な実装）

1. **バルク操作**
   - 複数イベントを一括で再処理
   - 失敗イベントを一括削除

2. **エクスポート機能**
   - CSV / JSON 形式でエクスポート
   - フィルタ条件を保持したエクスポート

3. **アラート設定**
   - 失敗率が閾値を超えた場合に通知
   - 未処理イベントが一定時間以上滞留した場合に通知

4. **データ可視化**
   - 時系列グラフ（日別の収集件数、成功率）
   - イベント種別ごとの分布（円グラフ）

5. **高度なフィルタ**
   - JSON フィールドでのフィルタ（例: rawData.user.login = "developer123"）
   - 正規表現によるイベント種別検索

---

## 補足事項

### plugin.json との関連

- プラグインの `menus` フィールドに以下のようなメニュー項目を追加することで、このページにアクセス可能:
  ```json
  {
    "key": "data",
    "label": "収集データ",
    "icon": "database",
    "to": "/plugins/github"
  }
  ```

### 正規化パイプラインとの統合

- プラグインが収集したデータ（`plugin_events_raw`）は、バックグラウンドジョブで正規化処理され、`activities` テーブルに保存される
- 正規化処理の流れ:
  1. プラグインが外部 API からデータを取得し、`plugin_events_raw` に保存（status = 'pending'）
  2. バックグラウンドジョブ（例: `plugin:normalize`）が pending イベントを処理
  3. 正規化に成功したら `activities` テーブルに保存し、status を 'processed' に更新
  4. 正規化に失敗したら status を 'failed' に更新し、errorMessage にエラー内容を記録

---

## 参考資料

- [Task 8.4: Plugin 管理 API 実装](.tmp/tasks/task-8.4-plugin-management-api.md)
- [Task 8.9: プラグインの実行ログ確認画面実装](.tmp/tasks/task-8.9-plugin-logs-ui.md)
- [プラグイン仕様書](.tmp/plugin.md)
- [データベーススキーマ](core/db/schema/plugins.ts)

---

**作成日**: 2025-10-29
**最終更新日**: 2025-10-29
