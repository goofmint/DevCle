# Task 8.11: プラグインデータ収集 API 実装

**ステータス**: ドキュメント作成完了
**推定時間**: 3 時間
**依存関係**: Task 8.4（Plugin 管理 API 実装）

---

## 概要

プラグインが外部APIから収集した生データ（`plugin_events_raw` テーブル）を取得するREST APIを実装します。**このタスクはバックエンドAPIの実装のみに焦点を当てます。UI実装はTask 8.12で対応します。**

実装するAPI：

- イベント一覧取得（フィルタリング：日付範囲、ステータス、イベント種別）
- ソート機能（日付、ステータス）
- ページネーション
- 個別イベント詳細取得（生JSONデータを含む）
- 統計情報取得（総件数、成功/失敗件数、最新/最古の収集日時）
- イベント再処理API（オプション）

**実装方針**:
- **SPA (Single Page Application) を前提としたREST API設計**
- クライアントサイドでfetchして表示（UIはTask 8.12で実装）
- SSR (Server-Side Rendering) は使用しない
- すべてのAPIエンドポイントで認証・認可を実装

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

## API 設計

### 8.11.1: イベント一覧取得 API

**エンドポイント**: `GET /api/plugins/:id/events`
**ファイル**: `core/app/routes/api.plugins.$id.events.ts`

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
// core/app/routes/api.plugins.$id.events.ts

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/services/auth.service';
import { listPluginEvents, ListEventsSchema } from '~/services/plugin-events.service';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const pluginId = params.id!;

  // 1. クエリパラメータをパース
  const url = new URL(request.url);
  const queryParams = {
    page: url.searchParams.get('page'),
    perPage: url.searchParams.get('perPage'),
    status: url.searchParams.get('status'),
    eventType: url.searchParams.get('eventType'),
    startDate: url.searchParams.get('startDate'),
    endDate: url.searchParams.get('endDate'),
    sort: url.searchParams.get('sort'),
  };

  // 2. バリデーション
  const query = ListEventsSchema.parse(queryParams);

  // 3. サービス層を呼び出し
  const result = await listPluginEvents(user.tenantId, pluginId, query);

  // 4. レスポンス構築
  return json({
    items: result.items.map(item => ({
      ...item,
      ingestedAt: item.ingestedAt.toISOString(),
      processedAt: item.processedAt?.toISOString() ?? null,
    })),
    pagination: {
      total: result.total,
      page: query.page,
      perPage: query.perPage,
      totalPages: Math.ceil(result.total / query.perPage),
    },
  });
}
```

---

### 8.11.2: イベント詳細取得 API

**エンドポイント**: `GET /api/plugins/:id/events/:eventId`
**ファイル**: `core/app/routes/api.plugins.$id.events.$eventId.ts`

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
// core/app/routes/api.plugins.$id.events.$eventId.ts

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/services/auth.service';
import { getPluginEventDetail } from '~/services/plugin-events.service';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const { id: pluginId, eventId } = params;

  if (!eventId) {
    throw new Response('Event ID is required', { status: 400 });
  }

  // 1. イベント取得（rawData を含む）
  const event = await getPluginEventDetail(user.tenantId, pluginId!, eventId);

  if (!event) {
    throw new Response('Event not found', { status: 404 });
  }

  // 2. レスポンス構築
  return json({
    ...event,
    ingestedAt: event.ingestedAt.toISOString(),
    processedAt: event.processedAt?.toISOString() ?? null,
  });
}
```

---

### 8.11.3: イベント統計取得 API

**エンドポイント**: `GET /api/plugins/:id/events/stats`
**ファイル**: `core/app/routes/api.plugins.$id.events.stats.ts`

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
// core/app/routes/api.plugins.$id.events.stats.ts

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/services/auth.service';
import { getPluginEventsStats } from '~/services/plugin-events.service';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const pluginId = params.id!;

  // 1. 統計情報取得
  const stats = await getPluginEventsStats(user.tenantId, pluginId);

  // 2. レスポンス構築
  return json({
    total: stats.total,
    processed: stats.processed,
    failed: stats.failed,
    pending: stats.pending,
    latestIngestedAt: stats.latestIngestedAt?.toISOString() ?? null,
    oldestIngestedAt: stats.oldestIngestedAt?.toISOString() ?? null,
  });
}
```

---

### 8.11.4: イベント再処理 API（オプション）

**エンドポイント**: `POST /api/plugins/:id/events/:eventId/reprocess`
**ファイル**: `core/app/routes/api.plugins.$id.events.$eventId.reprocess.ts`

#### 用途

- 処理に失敗したイベント（status = 'failed'）を再処理
- 正規化ロジックを修正した後に過去データを再処理

#### リクエスト

```typescript
// リクエストボディなし
```

#### レスポンス

```typescript
interface ReprocessEventResponse {
  success: boolean;
  message: string;
}
```

#### 実装概要

```typescript
// core/app/routes/api.plugins.$id.events.$eventId.reprocess.ts

import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/services/auth.service';
import { reprocessEvent } from '~/services/plugin-events.service';

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  const { id: pluginId, eventId } = params;

  if (!eventId) {
    throw new Response('Event ID is required', { status: 400 });
  }

  // 1. イベントを再処理キューに追加
  await reprocessEvent(user.tenantId, pluginId!, eventId);

  // 2. レスポンス構築
  return json({ success: true, message: 'Reprocessing queued' });
}
```

---

## サービス層の実装

### 8.11.5: plugin-events.service.ts

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
  return await withTenantContext(tenantId, async (tx) => {
    // 1. ベースクエリ構築
    const baseConditions = and(
      eq(schema.pluginEventsRaw.tenantId, tenantId),
      eq(schema.pluginEventsRaw.pluginId, pluginId)
    );

    // 2. フィルタ条件を構築
    const conditions = [baseConditions];
    if (input.status) {
      conditions.push(eq(schema.pluginEventsRaw.status, input.status));
    }
    if (input.eventType) {
      conditions.push(eq(schema.pluginEventsRaw.eventType, input.eventType));
    }
    if (input.startDate) {
      conditions.push(gte(schema.pluginEventsRaw.ingestedAt, input.startDate));
    }
    if (input.endDate) {
      conditions.push(lte(schema.pluginEventsRaw.ingestedAt, input.endDate));
    }

    const whereClause = and(...conditions);

    // 3. イベント一覧取得（rawDataは含めない）
    const items = await tx
      .select({
        eventId: schema.pluginEventsRaw.eventId,
        eventType: schema.pluginEventsRaw.eventType,
        status: schema.pluginEventsRaw.status,
        ingestedAt: schema.pluginEventsRaw.ingestedAt,
        processedAt: schema.pluginEventsRaw.processedAt,
        errorMessage: schema.pluginEventsRaw.errorMessage,
      })
      .from(schema.pluginEventsRaw)
      .where(whereClause)
      .orderBy(
        input.sort === 'asc'
          ? asc(schema.pluginEventsRaw.ingestedAt)
          : desc(schema.pluginEventsRaw.ingestedAt)
      )
      .limit(input.perPage)
      .offset((input.page - 1) * input.perPage);

    // 4. 総件数取得
    const [{ total }] = await tx
      .select({ total: count() })
      .from(schema.pluginEventsRaw)
      .where(whereClause);

    return {
      items: items as PluginEventListItem[],
      total: Number(total),
    };
  });
}

// ===========================
// イベント詳細取得
// ===========================

export async function getPluginEventDetail(
  tenantId: string,
  pluginId: string,
  eventId: string
): Promise<PluginEventDetail | null> {
  return await withTenantContext(tenantId, async (tx) => {
    // 1. イベント取得（rawData を含む）
    const [event] = await tx
      .select()
      .from(schema.pluginEventsRaw)
      .where(
        and(
          eq(schema.pluginEventsRaw.tenantId, tenantId),
          eq(schema.pluginEventsRaw.pluginId, pluginId),
          eq(schema.pluginEventsRaw.eventId, eventId)
        )
      )
      .limit(1);

    if (!event) {
      return null;
    }

    // 2. 関連する Activity を検索（processed の場合）
    // TODO: plugin_events_raw と activities を紐づける方法を実装
    // 例: activities テーブルに sourceEventId カラムを追加
    // または metadata に eventId を記録
    let activityId: string | undefined;

    return {
      eventId: event.eventId,
      eventType: event.eventType,
      status: event.status as 'pending' | 'processed' | 'failed',
      ingestedAt: event.ingestedAt,
      processedAt: event.processedAt,
      errorMessage: event.errorMessage,
      rawData: event.rawData,
      activityId,
    };
  });
}

// ===========================
// イベント統計取得
// ===========================

export async function getPluginEventsStats(
  tenantId: string,
  pluginId: string
): Promise<EventsStats> {
  return await withTenantContext(tenantId, async (tx) => {
    const baseConditions = and(
      eq(schema.pluginEventsRaw.tenantId, tenantId),
      eq(schema.pluginEventsRaw.pluginId, pluginId)
    );

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
      .where(baseConditions);

    // 2. 最新/最古の収集日時
    const [dates] = await tx
      .select({
        latest: max(schema.pluginEventsRaw.ingestedAt),
        oldest: min(schema.pluginEventsRaw.ingestedAt),
      })
      .from(schema.pluginEventsRaw)
      .where(baseConditions);

    return {
      total: Number(counts.total),
      processed: Number(counts.processed),
      failed: Number(counts.failed),
      pending: Number(counts.pending),
      latestIngestedAt: dates.latest,
      oldestIngestedAt: dates.oldest,
    };
  });
}

// ===========================
// イベント再処理
// ===========================

export async function reprocessEvent(
  tenantId: string,
  pluginId: string,
  eventId: string
): Promise<void> {
  await withTenantContext(tenantId, async (tx) => {
    // 1. イベント存在確認
    const [event] = await tx
      .select()
      .from(schema.pluginEventsRaw)
      .where(
        and(
          eq(schema.pluginEventsRaw.tenantId, tenantId),
          eq(schema.pluginEventsRaw.pluginId, pluginId),
          eq(schema.pluginEventsRaw.eventId, eventId)
        )
      )
      .limit(1);

    if (!event) {
      throw new Error('Event not found');
    }

    // 2. ステータスを pending に戻す
    await tx
      .update(schema.pluginEventsRaw)
      .set({
        status: 'pending',
        processedAt: null,
        errorMessage: null,
      })
      .where(eq(schema.pluginEventsRaw.eventId, eventId));

    // 3. 再処理ジョブをキューに追加
    // TODO: BullMQ または類似のジョブキューを実装
    // await addJob('plugin:normalize', { eventId, pluginId, tenantId });
  });
}
```

---

## テスト方針

### 単体テスト（Vitest）

#### 1. サービス層テスト（`core/services/plugin-events.service.test.ts`）

```typescript
describe('plugin-events.service', () => {
  describe('listPluginEvents', () => {
    it('should return paginated events', async () => {
      // テスト実装
    });

    it('should filter by status', async () => {
      // テスト実装
    });

    it('should filter by eventType', async () => {
      // テスト実装
    });

    it('should filter by date range', async () => {
      // テスト実装
    });

    it('should sort events', async () => {
      // テスト実装
    });
  });

  describe('getPluginEventDetail', () => {
    it('should return event with rawData', async () => {
      // テスト実装
    });

    it('should return null if event not found', async () => {
      // テスト実装
    });
  });

  describe('getPluginEventsStats', () => {
    it('should return correct statistics', async () => {
      // テスト実装
    });
  });

  describe('reprocessEvent', () => {
    it('should reset event status to pending', async () => {
      // テスト実装
    });

    it('should throw error if event not found', async () => {
      // テスト実装
    });
  });
});
```

#### 2. API テスト（`core/app/routes/api.plugins.$id.events.test.ts`）

```typescript
describe('GET /api/plugins/:id/events', () => {
  it('should return 401 if not authenticated', async () => {
    // テスト実装
  });

  it('should return paginated events', async () => {
    // テスト実装
  });

  it('should validate query parameters', async () => {
    // テスト実装
  });
});

describe('GET /api/plugins/:id/events/:eventId', () => {
  it('should return event detail', async () => {
    // テスト実装
  });

  it('should return 404 if event not found', async () => {
    // テスト実装
  });
});

describe('GET /api/plugins/:id/events/stats', () => {
  it('should return statistics', async () => {
    // テスト実装
  });
});

describe('POST /api/plugins/:id/events/:eventId/reprocess', () => {
  it('should queue reprocessing', async () => {
    // テスト実装
  });

  it('should return 404 if event not found', async () => {
    // テスト実装
  });
});
```

---

## セキュリティ考慮事項

1. **認証・認可**
   - すべての API エンドポイントで `requireAuth()` を使用
   - プラグインへのアクセス権限を確認（テナント ID チェック）

2. **データ露出の制限と機密情報のマスキング**
   - `rawData` は詳細表示時のみ取得（一覧では含めない）
   - `getPluginEventDetail()` で rawData を返す前に機密情報をマスキング

   **マスキングポリシー実装**:

   ```typescript
   // core/services/plugin-events.service.ts に追加

   // マスキング対象のフィールド名（設定可能なリスト）
   const SENSITIVE_FIELD_NAMES = [
     'token', 'api_key', 'apiKey', 'secret', 'password',
     'access_token', 'accessToken', 'refresh_token', 'refreshToken',
     'authorization', 'auth', 'credentials', 'private_key', 'privateKey',
     'client_secret', 'clientSecret', 'bearer'
   ];

   // クレデンシャルパターン（正規表現）
   const CREDENTIAL_PATTERNS = [
     /^[A-Za-z0-9\-_]{20,}$/, // 長いランダム文字列
     /^sk_[a-z]+_[A-Za-z0-9]{20,}$/, // Stripe形式
     /^ghp_[A-Za-z0-9]{36}$/, // GitHub Personal Access Token
     /^gho_[A-Za-z0-9]{36}$/, // GitHub OAuth Token
   ];

   /**
    * 機密情報を再帰的にマスキング
    */
   function sanitizeRawData(data: unknown): unknown {
     if (data === null || data === undefined) {
       return data;
     }

     // 配列の場合
     if (Array.isArray(data)) {
       return data.map(item => sanitizeRawData(item));
     }

     // オブジェクトの場合
     if (typeof data === 'object') {
       const sanitized: Record<string, unknown> = {};
       for (const [key, value] of Object.entries(data)) {
         // フィールド名が機密情報の場合
         const keyLower = key.toLowerCase();
         if (SENSITIVE_FIELD_NAMES.some(sensitive => keyLower.includes(sensitive))) {
           sanitized[key] = maskValue(value);
         }
         // 文字列値がクレデンシャルパターンに一致する場合
         else if (typeof value === 'string' && looksLikeCredential(value)) {
           sanitized[key] = maskValue(value);
         }
         // それ以外は再帰的に処理
         else {
           sanitized[key] = sanitizeRawData(value);
         }
       }
       return sanitized;
     }

     // プリミティブ値はそのまま返す
     return data;
   }

   /**
    * 値がクレデンシャルに見えるかチェック
    */
   function looksLikeCredential(value: string): boolean {
     return CREDENTIAL_PATTERNS.some(pattern => pattern.test(value));
   }

   /**
    * 値をマスキング（部分的にマスク）
    */
   function maskValue(value: unknown): string {
     if (typeof value !== 'string') {
       return '***REDACTED***';
     }

     // 8文字未満は完全マスク
     if (value.length < 8) {
       return '***REDACTED***';
     }

     // 8文字以上は最初の4文字と最後の4文字を表示
     const start = value.slice(0, 4);
     const end = value.slice(-4);
     return `${start}***${end}`;
   }
   ```

   **getPluginEventDetail の更新**:
   ```typescript
   export async function getPluginEventDetail(
     tenantId: string,
     pluginId: string,
     eventId: string
   ): Promise<PluginEventDetail | null> {
     return await withTenantContext(tenantId, async (tx) => {
       const [event] = await tx
         .select()
         .from(schema.pluginEventsRaw)
         .where(/* ... */)
         .limit(1);

       if (!event) {
         return null;
       }

       return {
         eventId: event.eventId,
         eventType: event.eventType,
         status: event.status as 'pending' | 'processed' | 'failed',
         ingestedAt: event.ingestedAt,
         processedAt: event.processedAt,
         errorMessage: event.errorMessage,
         rawData: sanitizeRawData(event.rawData), // マスキング適用
         activityId,
       };
     });
   }
   ```

   **マスキングされるフィールドのドキュメント**:
   - APIレスポンスでマスキングされるフィールド: `token`, `api_key`, `secret`, `password`, `access_token`, `refresh_token`, `authorization`, `credentials`, `private_key`, `client_secret`, `bearer` を含むキー名
   - クレデンシャルパターンに一致する文字列値（長いランダム文字列、特定のプレフィックス付きトークンなど）
   - マスキング形式: 短い値は `***REDACTED***`、長い値は `abcd***wxyz` 形式（最初と最後の4文字のみ表示）

   **テスト要件**:
   ```typescript
   describe('sanitizeRawData', () => {
     it('should mask sensitive field names', () => {
       const input = { api_key: 'secret123', user: 'john' };
       const output = sanitizeRawData(input);
       expect(output).toEqual({ api_key: '***REDACTED***', user: 'john' });
     });

     it('should mask nested sensitive fields', () => {
       const input = {
         config: {
           token: 'verylongtokenvalue1234567890',
           endpoint: 'https://api.example.com'
         }
       };
       const output = sanitizeRawData(input);
       expect(output.config.token).toMatch(/^very\*\*\*7890$/);
       expect(output.config.endpoint).toBe('https://api.example.com');
     });

     it('should mask credential-like strings', () => {
       const input = {
         id: 'ghp_1234567890abcdefghijklmnopqrstuvwxyz'
       };
       const output = sanitizeRawData(input);
       expect(output.id).toMatch(/^ghp_\*\*\*wxyz$/);
     });

     it('should handle arrays', () => {
       const input = {
         tokens: ['token1', 'token2'],
         keys: [{ api_key: 'secret' }]
       };
       const output = sanitizeRawData(input);
       expect(output.tokens[0]).toBe('***REDACTED***');
       expect(output.keys[0].api_key).toBe('***REDACTED***');
     });
   });
   ```

3. **SQL インジェクション対策**
   - Drizzle ORM のパラメータ化クエリを使用
   - ユーザー入力は Zod で検証

4. **レート制限**

   **統計情報のキャッシュ**:
   - Redis に60秒間キャッシュ
   - キャッシュキー: `plugin_events_stats:{tenantId}:{pluginId}`

   **再処理 API のレート制限実装**:

   ミドルウェアレベルのレート制限を実装：

   ```typescript
   // core/middleware/rate-limiter.ts

   import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
   import Redis from 'ioredis';

   const redis = new Redis({
     host: process.env.REDIS_HOST || 'localhost',
     port: parseInt(process.env.REDIS_PORT || '6379'),
   });

   // 再処理API用のレート制限（10 req/min per user）
   const reprocessRateLimiter = new RateLimiterRedis({
     storeClient: redis,
     keyPrefix: 'rate_limit:reprocess',
     points: 10, // 10リクエスト
     duration: 60, // 1分間
   });

   /**
    * レート制限ミドルウェア
    */
   export async function applyRateLimit(
     userId: string | null,
     ip: string
   ): Promise<void> {
     // 認証済みユーザーIDを優先、なければIPアドレス
     const key = userId || `ip:${ip}`;

     try {
       await reprocessRateLimiter.consume(key);
     } catch (error) {
       if (error instanceof RateLimiterRes) {
         const retryAfter = Math.ceil(error.msBeforeNext / 1000);
         throw new Response('Too Many Requests', {
           status: 429,
           headers: {
             'Retry-After': retryAfter.toString(),
             'X-RateLimit-Limit': '10',
             'X-RateLimit-Remaining': '0',
             'X-RateLimit-Reset': new Date(Date.now() + error.msBeforeNext).toISOString(),
           },
         });
       }
       throw error;
     }
   }
   ```

   **再処理APIルートでの適用**:
   ```typescript
   // core/app/routes/api.plugins.$id.events.$eventId.reprocess.ts

   import { applyRateLimit } from '~/middleware/rate-limiter';

   export async function action({ request, params }: ActionFunctionArgs) {
     const user = await requireAuth(request);
     const { id: pluginId, eventId } = params;

     // レート制限チェック
     const clientIp = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
     await applyRateLimit(user.userId, clientIp);

     if (!eventId) {
       throw new Response('Event ID is required', { status: 400 });
     }

     await reprocessEvent(user.tenantId, pluginId!, eventId);

     return json({ success: true, message: 'Reprocessing queued' });
   }
   ```

   **レート制限の設定**:
   - デフォルトポリシー: 10リクエスト/分/ユーザー（またはIP）
   - 認証済みユーザーIDで識別、未認証の場合はIPアドレスにフォールバック
   - Redisでカウンターを永続化（マルチインスタンス対応）
   - 制限超過時: HTTP 429 Too Many Requests + `Retry-After` ヘッダー

   **依存パッケージ**:
   ```bash
   pnpm add rate-limiter-flexible ioredis
   pnpm add -D @types/ioredis
   ```

---

## パフォーマンス最適化

### 1. データベースインデックス

`plugin_events_raw` テーブルに以下のインデックスを追加:

```sql
-- 一覧取得用（テナント・プラグイン・収集日時）
CREATE INDEX idx_plugin_events_raw_list
ON plugin_events_raw (tenant_id, plugin_id, ingested_at DESC);

-- フィルタ用（ステータス）
CREATE INDEX idx_plugin_events_raw_status
ON plugin_events_raw (tenant_id, plugin_id, status);

-- フィルタ用（イベント種別）
CREATE INDEX idx_plugin_events_raw_event_type
ON plugin_events_raw (tenant_id, plugin_id, event_type);
```

### 2. ページネーション

- OFFSET ベースのページネーションを使用
- 大規模データセット（10万件以上）では Cursor ベースへの移行を検討

### 3. 統計情報のキャッシュ

- Redis に60秒間キャッシュ
- キャッシュキー: `plugin_events_stats:{tenantId}:{pluginId}`

### 4. JSON データの遅延読み込み

- 一覧表示では `rawData` を含めない（SELECT時にカラムを省略）
- 詳細表示時に初めて `rawData` を取得

---

## 実装の優先順位

### Phase 1（基本機能）

1. データベーススキーマ確認（既存の `plugin_events_raw` テーブル）
2. サービス層実装（`plugin-events.service.ts`）
3. API 実装（一覧取得、詳細取得、統計取得）
4. 単体テスト実装

### Phase 2（追加機能）

5. 再処理 API 実装
6. API テスト実装
7. パフォーマンス最適化（インデックス追加）

### Phase 3（UI実装）

8. **Task 8.12 でUI実装（別タスク）**

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

4. **高度なフィルタ**
   - JSON フィールドでのフィルタ（例: rawData.user.login = "developer123"）
   - 正規表現によるイベント種別検索

---

## 補足事項

### 正規化パイプラインとの統合

- プラグインが収集したデータ（`plugin_events_raw`）は、バックグラウンドジョブで正規化処理され、`activities` テーブルに保存される
- 正規化処理の流れ:
  1. プラグインが外部 API からデータを取得し、`plugin_events_raw` に保存（status = 'pending'）
  2. バックグラウンドジョブ（例: `plugin:normalize`）が pending イベントを処理
  3. 正規化に成功したら `activities` テーブルに保存し、status を 'processed' に更新
  4. 正規化に失敗したら status を 'failed' に更新し、errorMessage にエラー内容を記録

### UI実装について

- UI実装は **Task 8.12** で対応
- SPAとして実装し、これらのAPIをfetchして表示
- Remixの`useFetcher`または`useLoaderData`を使用

---

## 参考資料

- [Task 8.4: Plugin 管理 API 実装](.tmp/tasks/task-8.4-plugin-management-api.md)
- [Task 8.12: プラグインデータ表示 UI 実装](.tmp/tasks/task-8.12-plugin-data-ui.md)（作成予定）
- [プラグイン仕様書](.tmp/plugin.md)
- [データベーススキーマ](core/db/schema/plugins.ts)

---

**作成日**: 2025-10-29
**最終更新日**: 2025-11-02
