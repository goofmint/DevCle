# Task 6.3: Funnel API実装

**タスク番号**: 6.3
**依存タスク**: Task 6.2（ドロップ率計算実装）
**推定時間**: 2時間
**完了条件**: APIが統合テストでパスする

---

## 概要

ファネル分析のHTTP APIエンドポイントを実装します。Task 6.1とTask 6.2で実装したファネル分析サービスをRemix Resource Routeとして公開し、フロントエンドやサードパーティアプリケーションからアクセス可能にします。

**Phase 6の位置づけ**:
Task 6.3はPhase 6の最終タスクで、ファネル分析機能をHTTP APIとして公開します。これによりダッシュボードUI（Phase 7）からファネル統計を表示できるようになります。

---

## 実装するファイルとインターフェース

### 1. `app/routes/api/funnel.ts`

ファネル分析のResource Route。認証が必要で、テナント分離が適用されます。

```typescript
/**
 * Funnel API Endpoints
 *
 * Provides HTTP API for funnel analysis.
 *
 * Endpoints:
 * - GET /api/funnel - Get overall funnel statistics
 * - GET /api/funnel/timeline - Get time series funnel data
 *
 * Authentication:
 * - All endpoints require authentication
 * - Session-based authentication (cookie)
 * - Tenant ID is extracted from session
 *
 * RLS (Row Level Security):
 * - Tenant context is set based on authenticated user's tenant_id
 * - All database queries are automatically filtered by tenant
 *
 * Architecture:
 * - HTTP Layer (this file) -> Funnel Service (Task 6.1, 6.2) -> Drizzle ORM -> PostgreSQL
 */

import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/services/auth.service';
import { setTenantContext, clearTenantContext } from '~/db/connection';
import {
  getFunnelStats,
  getFunnelDropRates,
  getFunnelTimeSeries,
} from '~/services/funnel.service';
import { z } from 'zod';

/**
 * GET /api/funnel
 *
 * Get overall funnel statistics with drop rates
 *
 * Response:
 * - 200: Funnel statistics with drop rates
 * - 401: Unauthorized (not authenticated)
 * - 500: Internal server error
 *
 * Response body:
 * ```json
 * {
 *   "stages": [
 *     {
 *       "stageKey": "awareness",
 *       "title": "Awareness",
 *       "orderNo": 1,
 *       "uniqueDevelopers": 100,
 *       "totalActivities": 250,
 *       "previousStageCount": null,
 *       "dropRate": null
 *     },
 *     {
 *       "stageKey": "engagement",
 *       "title": "Engagement",
 *       "orderNo": 2,
 *       "uniqueDevelopers": 30,
 *       "totalActivities": 80,
 *       "previousStageCount": 100,
 *       "dropRate": 70.0
 *     }
 *   ],
 *   "overallConversionRate": 5.0
 * }
 * ```
 *
 * Implementation:
 * 1. Authenticate user (requireAuth)
 * 2. Get tenant ID from session
 * 3. Set tenant context for RLS
 * 4. Call getFunnelStats() and getFunnelDropRates()
 * 5. Merge statistics and drop rates
 * 6. Return JSON response
 * 7. Clear tenant context in finally block
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Implementation:
  // 1. Authenticate user and get tenant ID
  // 2. Set tenant context
  // 3. Get funnel stats and drop rates
  // 4. Return merged response
  // 5. Handle errors (401, 500)
  throw new Error('Not implemented');
}
```

### 2. `app/routes/api/funnel.timeline.ts`

ファネル分析の時系列データ取得エンドポイント。

```typescript
/**
 * GET /api/funnel/timeline
 *
 * Get time series funnel data
 *
 * Query parameters:
 * - fromDate: Start date (ISO 8601 format, e.g., "2024-01-01")
 * - toDate: End date (ISO 8601 format, e.g., "2024-12-31")
 * - granularity: Time granularity ("day" | "week" | "month")
 *
 * Response:
 * - 200: Time series funnel data
 * - 400: Invalid query parameters
 * - 401: Unauthorized (not authenticated)
 * - 500: Internal server error
 *
 * Example request:
 * ```
 * GET /api/funnel/timeline?fromDate=2024-01-01&toDate=2024-01-31&granularity=week
 * ```
 *
 * Response body:
 * ```json
 * [
 *   {
 *     "date": "2024-01-01T00:00:00.000Z",
 *     "stages": [
 *       {
 *         "stageKey": "awareness",
 *         "uniqueDevelopers": 50,
 *         "dropRate": null
 *       },
 *       {
 *         "stageKey": "engagement",
 *         "uniqueDevelopers": 15,
 *         "dropRate": 70.0
 *       }
 *     ]
 *   },
 *   {
 *     "date": "2024-01-08T00:00:00.000Z",
 *     "stages": [...]
 *   }
 * ]
 * ```
 *
 * Implementation:
 * 1. Authenticate user (requireAuth)
 * 2. Parse and validate query parameters (Zod schema)
 * 3. Get tenant ID from session
 * 4. Set tenant context for RLS
 * 5. Call getFunnelTimeSeries()
 * 6. Return JSON response
 * 7. Clear tenant context in finally block
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Implementation:
  // 1. Authenticate user and get tenant ID
  // 2. Parse query parameters
  // 3. Validate parameters (Zod schema)
  // 4. Set tenant context
  // 5. Get time series data
  // 6. Return JSON response
  // 7. Handle errors (400, 401, 500)
  throw new Error('Not implemented');
}

/**
 * Query parameter validation schema
 */
const TimelineQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  granularity: z.enum(['day', 'week', 'month']),
});
```

---

## APIエンドポイント仕様

### 1. `GET /api/funnel` - 全体ファネル統計取得

#### リクエスト

```
GET /api/funnel
Cookie: __session=...
```

**認証**: 必須（Cookieベースのセッション認証）

**クエリパラメータ**: なし

#### レスポンス

**200 OK**

```json
{
  "stages": [
    {
      "stageKey": "awareness",
      "title": "Awareness",
      "orderNo": 1,
      "uniqueDevelopers": 100,
      "totalActivities": 250,
      "previousStageCount": null,
      "dropRate": null
    },
    {
      "stageKey": "engagement",
      "title": "Engagement",
      "orderNo": 2,
      "uniqueDevelopers": 30,
      "totalActivities": 80,
      "previousStageCount": 100,
      "dropRate": 70.0
    },
    {
      "stageKey": "adoption",
      "title": "Adoption",
      "orderNo": 3,
      "uniqueDevelopers": 15,
      "totalActivities": 40,
      "previousStageCount": 30,
      "dropRate": 50.0
    },
    {
      "stageKey": "advocacy",
      "title": "Advocacy",
      "orderNo": 4,
      "uniqueDevelopers": 5,
      "totalActivities": 10,
      "previousStageCount": 15,
      "dropRate": 66.7
    }
  ],
  "overallConversionRate": 5.0
}
```

**401 Unauthorized**

```json
{
  "error": "Unauthorized"
}
```

**500 Internal Server Error**

```json
{
  "error": "Internal server error"
}
```

### 2. `GET /api/funnel/timeline` - 時系列ファネルデータ取得

#### リクエスト

```
GET /api/funnel/timeline?fromDate=2024-01-01&toDate=2024-01-31&granularity=week
Cookie: __session=...
```

**認証**: 必須（Cookieベースのセッション認証）

**クエリパラメータ**:

| パラメータ | 型 | 必須 | 説明 | 例 |
|-----------|---|------|------|-----|
| `fromDate` | string | ✓ | 開始日（ISO 8601形式、YYYY-MM-DD） | `2024-01-01` |
| `toDate` | string | ✓ | 終了日（ISO 8601形式、YYYY-MM-DD） | `2024-01-31` |
| `granularity` | string | ✓ | 集計粒度（`day`, `week`, `month`） | `week` |

#### レスポンス

**200 OK**

```json
[
  {
    "date": "2024-01-01T00:00:00.000Z",
    "stages": [
      {
        "stageKey": "awareness",
        "uniqueDevelopers": 50,
        "dropRate": null
      },
      {
        "stageKey": "engagement",
        "uniqueDevelopers": 15,
        "dropRate": 70.0
      },
      {
        "stageKey": "adoption",
        "uniqueDevelopers": 8,
        "dropRate": 46.7
      },
      {
        "stageKey": "advocacy",
        "uniqueDevelopers": 2,
        "dropRate": 75.0
      }
    ]
  },
  {
    "date": "2024-01-08T00:00:00.000Z",
    "stages": [...]
  }
]
```

**400 Bad Request**

```json
{
  "error": "Invalid query parameters",
  "details": {
    "fromDate": "Invalid date format. Expected YYYY-MM-DD",
    "granularity": "Invalid granularity. Expected 'day', 'week', or 'month'"
  }
}
```

**401 Unauthorized**

```json
{
  "error": "Unauthorized"
}
```

**500 Internal Server Error**

```json
{
  "error": "Internal server error"
}
```

---

## 実装詳細

### 1. 認証とテナント分離

```typescript
/**
 * Authentication and tenant isolation flow
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authenticate user and get tenant ID
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Set tenant context for RLS
    await setTenantContext(tenantId);

    // 3. Call service functions
    const stats = await getFunnelStats(tenantId);
    const dropRates = await getFunnelDropRates(tenantId);

    // 4. Merge data
    const mergedStages = stats.stages.map((stage) => {
      const dropRateData = dropRates.stages.find(
        (d) => d.stageKey === stage.stageKey
      );
      return {
        ...stage,
        previousStageCount: dropRateData?.previousStageCount ?? null,
        dropRate: dropRateData?.dropRate ?? null,
      };
    });

    // 5. Return JSON response
    return json({
      stages: mergedStages,
      overallConversionRate: dropRates.overallConversionRate,
    });
  } catch (error) {
    // Handle errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to get funnel statistics:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    // 6. Clear tenant context
    await clearTenantContext();
  }
}
```

### 2. クエリパラメータの検証

```typescript
/**
 * Query parameter validation for timeline endpoint
 */
const TimelineQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD'),
  granularity: z.enum(['day', 'week', 'month'], {
    errorMap: () => ({ message: "Invalid granularity. Expected 'day', 'week', or 'month'" }),
  }),
});

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authenticate user
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Parse query parameters
    const url = new URL(request.url);
    const rawParams = {
      fromDate: url.searchParams.get('fromDate'),
      toDate: url.searchParams.get('toDate'),
      granularity: url.searchParams.get('granularity'),
    };

    // 3. Validate query parameters
    const validationResult = TimelineQuerySchema.safeParse(rawParams);
    if (!validationResult.success) {
      return json(
        {
          error: 'Invalid query parameters',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { fromDate, toDate, granularity } = validationResult.data;

    // 4. Set tenant context
    await setTenantContext(tenantId);

    // 5. Call service function
    const timeSeries = await getFunnelTimeSeries(
      tenantId,
      new Date(fromDate),
      new Date(toDate),
      granularity
    );

    // 6. Return JSON response
    return json(timeSeries);
  } catch (error) {
    // Handle errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to get funnel timeline:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    // 7. Clear tenant context
    await clearTenantContext();
  }
}
```

---

## エラーハンドリング

### エラーの種類と対応

| エラーの種類 | HTTPステータス | レスポンス |
|-------------|---------------|-----------|
| **未認証** | 401 Unauthorized | `{ "error": "Unauthorized" }` |
| **バリデーションエラー** | 400 Bad Request | `{ "error": "Invalid query parameters", "details": {...} }` |
| **データベースエラー** | 500 Internal Server Error | `{ "error": "Internal server error" }` |
| **RLS違反** | 500 Internal Server Error | `{ "error": "Internal server error" }` |
| **日付範囲エラー** | 400 Bad Request | `{ "error": "Invalid date range" }` |

### エラーハンドリングのベストプラクティス

```typescript
/**
 * Error handling best practices
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Business logic
  } catch (error) {
    // 1. Log error for debugging (server-side only)
    console.error('API error:', error);

    // 2. Return appropriate HTTP status and error message
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Invalid date range')) {
        return json({ error: 'Invalid date range' }, { status: 400 });
      }
    }

    // 3. Default to 500 Internal Server Error
    return json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    // 4. Always clear tenant context
    await clearTenantContext();
  }
}
```

---

## テスト要件

### 統合テスト（`app/routes/api/funnel.test.ts`）

最低12テストケース:

#### `GET /api/funnel` テスト (6テスト)

1. **正常系**: 認証済みユーザーがファネル統計を取得できる
2. **未認証**: 認証なしで401エラーが返される
3. **テナント分離**: 他のテナントのデータが取得できない
4. **ドロップ率**: ドロップ率が正しく計算される
5. **空データ**: アクティビティがない場合でも4ステージが返される
6. **コンバージョン率**: 全体のコンバージョン率が正しく計算される

#### `GET /api/funnel/timeline` テスト (6テスト)

7. **正常系（日次）**: 日次集計が正しく返される
8. **正常系（週次）**: 週次集計が正しく返される
9. **正常系（月次）**: 月次集計が正しく返される
10. **バリデーションエラー**: 無効なクエリパラメータで400エラーが返される
11. **未認証**: 認証なしで401エラーが返される
12. **テナント分離**: 他のテナントのデータが取得できない

### テストコード例

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createRemixStub } from '@remix-run/testing';
import { loader } from './funnel';

describe('GET /api/funnel', () => {
  it('should return funnel statistics for authenticated user', async () => {
    // Arrange: Create test session
    const request = createAuthenticatedRequest('default');

    // Act: Call loader
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // Assert: Should return funnel statistics
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('stages');
    expect(data.stages).toHaveLength(4);
    expect(data).toHaveProperty('overallConversionRate');
  });

  it('should return 401 for unauthenticated user', async () => {
    // Arrange: Create unauthenticated request
    const request = createUnauthenticatedRequest();

    // Act: Call loader
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // Assert: Should return 401
    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('should respect tenant isolation', async () => {
    // Arrange: Create activities for tenant-a and tenant-b
    await createActivityForTenant('tenant-a', 'click');
    await createActivityForTenant('tenant-b', 'click');

    const request = createAuthenticatedRequest('tenant-a');

    // Act: Call loader
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // Assert: Should only include tenant-a data
    const awarenessStage = data.stages.find((s) => s.stageKey === 'awareness');
    expect(awarenessStage.uniqueDevelopers).toBe(1); // Only tenant-a activity
  });
});

describe('GET /api/funnel/timeline', () => {
  it('should return time series data for day granularity', async () => {
    // Arrange: Create test session and query parameters
    const request = createAuthenticatedRequest('default', {
      fromDate: '2024-01-01',
      toDate: '2024-01-07',
      granularity: 'day',
    });

    // Act: Call loader
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // Assert: Should return time series data
    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty('date');
    expect(data[0]).toHaveProperty('stages');
  });

  it('should return 400 for invalid query parameters', async () => {
    // Arrange: Create request with invalid parameters
    const request = createAuthenticatedRequest('default', {
      fromDate: 'invalid-date',
      toDate: '2024-01-31',
      granularity: 'invalid',
    });

    // Act: Call loader
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // Assert: Should return 400
    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data).toHaveProperty('details');
  });
});
```

---

## セキュリティ考慮事項

### 1. 認証の必須化

全てのエンドポイントで認証が必要です。`requireAuth()`関数を使用して認証を強制します。

```typescript
// ✅ Correct: Always require authentication
const user = await requireAuth(request);

// ❌ Incorrect: Do not skip authentication
const user = await getCurrentUser(request); // This allows unauthenticated access
```

### 2. Row Level Security (RLS)

テナント分離はPostgreSQLのRLSポリシーにより自動的に行われます。必ず`setTenantContext()`と`clearTenantContext()`を使用します。

```typescript
try {
  await setTenantContext(tenantId);
  // ... database operations ...
} finally {
  await clearTenantContext(); // Always clear in finally block
}
```

### 3. SQLインジェクション対策

Drizzle ORMを使用することで、SQLインジェクションのリスクを最小化します。クエリパラメータは必ずZodスキーマで検証します。

```typescript
// ✅ Safe: Zod validation
const validationResult = TimelineQuerySchema.safeParse(rawParams);

// ❌ Dangerous: Direct use of user input
const granularity = url.searchParams.get('granularity'); // No validation
```

### 4. レート制限（将来的な実装）

本タスクでは実装しませんが、将来的にはレート制限を追加することを推奨します。

```typescript
// Future implementation (not in Task 6.3)
const rateLimit = createRateLimiter({
  windowMs: 60000, // 1 minute
  max: 100, // 100 requests per minute
});
```

---

## パフォーマンス考慮事項

### 1. キャッシュ（将来的な実装）

本タスクでは実装しませんが、将来的にはRedisキャッシュを追加することを推奨します。

```typescript
// Future implementation (not in Task 6.3)
const cacheKey = `funnel_stats:${tenantId}`;
const cached = await redis.get(cacheKey);
if (cached) return json(JSON.parse(cached));
```

### 2. データベースクエリの最適化

`getFunnelStats()`と`getFunnelDropRates()`は内部で同じクエリを実行する可能性があります。将来的には統合して1回のクエリで取得することを推奨します。

---

## 完了チェックリスト

- [ ] `app/routes/api/funnel.ts`ファイル作成
- [ ] `GET /api/funnel`エンドポイント実装
- [ ] `app/routes/api/funnel.timeline.ts`ファイル作成
- [ ] `GET /api/funnel/timeline`エンドポイント実装
- [ ] 認証チェック実装（`requireAuth()`）
- [ ] テナントコンテキスト管理（`setTenantContext()`, `clearTenantContext()`）
- [ ] クエリパラメータ検証（Zodスキーマ）
- [ ] エラーハンドリング（401, 400, 500）
- [ ] 統合テストファイル作成（`app/routes/api/funnel.test.ts`）
- [ ] `GET /api/funnel`のテスト（6テスト以上）
- [ ] `GET /api/funnel/timeline`のテスト（6テスト以上）
- [ ] 全テストが成功（`pnpm test`）
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] Lintエラーなし（`pnpm lint`）

---

## 次のタスク

Task 6.3完了後、以下のタスクに進みます：

- **Task 7.1**: ダッシュボードレイアウト実装（サイドバーナビゲーション、ヘッダー）
- **Task 7.5**: Funnelページ実装（ファネルチャート表示、ドロップ率表示、時系列グラフ）

---

## 参考資料

- [Remix Resource Routes](https://remix.run/docs/en/main/guides/resource-routes)
- [Remix Loader Functions](https://remix.run/docs/en/main/route/loader)
- [Zod Validation](https://zod.dev/)
- Task 6.1: [task-6.1-funnel-service.md](task-6.1-funnel-service.md)
- Task 6.2: [task-6.2-drop-rate-calculation.md](task-6.2-drop-rate-calculation.md)
