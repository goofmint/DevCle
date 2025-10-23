# Task 7.4.1: 新規 API 実装（Campaign Detail APIs）

**タスクID**: 7.4.1
**フェーズ**: Phase 7（ダッシュボード UI 実装）
**依存**: Task 5.4（Campaign API 実装）
**推定時間**: 3時間
**担当**: Backend Developer

---

## 概要

このタスクでは、**Campaign詳細ページ**で使用する3つの新規APIエンドポイントを実装します。Task 7.4.2の施策詳細ページ実装に必要なデータ取得APIです。

**実装するエンドポイント**:
1. **GET /api/campaigns/:id/budgets** - キャンペーン予算一覧取得
2. **GET /api/campaigns/:id/resources** - キャンペーンに紐づくリソース一覧取得
3. **GET /api/campaigns/:id/activities** - キャンペーンに関連するアクティビティ一覧取得

### 背景

- Task 5.4でキャンペーンのCRUD APIとROI APIを実装済み
- キャンペーン詳細ページでは、予算・リソース・アクティビティの詳細情報が必要
- これらのAPIは読み取り専用（GET）で、既存データの表示に特化

---

## 実装方針

### アーキテクチャ

```
HTTP Request
  ↓
Remix Resource Route (API Handler)
  ↓
Authentication Middleware (requireAuth)
  ↓
Tenant Context (withTenantContext)
  ↓
Campaign Detail Service (new)
  ↓
Drizzle ORM
  ↓
PostgreSQL (budgets, resources, activities with RLS)
```

### 設計原則

1. **Campaign API（Task 5.4）と同じパターン** - 既存実装と統一したコーディングスタイル
2. **認証必須** - すべてのエンドポイントは`requireAuth()`を使用
3. **RLS対応** - `withTenantContext(tenantId, async (tx) => {...})` パターンを使用
4. **読み取り専用** - CUD（Create/Update/Delete）操作は別タスクで実装
5. **ページネーション** - 大量データに対応するため、limit/offset パラメータをサポート
6. **型安全性** - `as any`/`as unknown`を使わず、TypeScript型推論を活用

---

## ファイル構成

```
core/services/
  └── campaign-detail.service.ts    // 新規作成（3つの関数を含むサービス層）

app/routes/api/
  ├── campaigns.$id.budgets.ts      // GET /api/campaigns/:id/budgets
  ├── campaigns.$id.resources.ts    // GET /api/campaigns/:id/resources
  └── campaigns.$id.activities.ts   // GET /api/campaigns/:id/activities
```

**ファイルサイズ**: 各ファイル150-250行程度

---

## サービス層実装

### core/services/campaign-detail.service.ts

```typescript
/**
 * Campaign Detail Service
 *
 * Provides read-only access to campaign-related data:
 * - Budgets (cost entries)
 * - Resources (trackable objects)
 * - Activities (developer actions)
 */

import { desc, eq, and, sql } from 'drizzle-orm';
import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';

// ==================== Types ====================

export interface BudgetListParams {
  limit?: number;
  offset?: number;
  category?: string;
}

export interface ResourceListParams {
  limit?: number;
  offset?: number;
  category?: string;
}

export interface ActivityListParams {
  limit?: number;
  offset?: number;
  action?: string;
}

// ==================== getBudgets ====================

/**
 * Get budgets for a campaign
 *
 * Query budgets table by campaign_id, sorted by spent_at DESC.
 * Returns paginated list of budget entries.
 *
 * Implementation steps:
 * 1. Use withTenantContext(tenantId, async (tx) => {...})
 * 2. Query budgets table with:
 *    - WHERE tenant_id = tenantId AND campaign_id = campaignId
 *    - Optional WHERE category = params.category (if provided)
 *    - ORDER BY spent_at DESC, created_at DESC
 *    - LIMIT params.limit (default 50, max 100)
 *    - OFFSET params.offset (default 0)
 * 3. Count total records with COUNT(*) (without limit/offset)
 * 4. Return { budgets: [...], total: number }
 */
export async function getBudgets(
  tenantId: string,
  campaignId: string,
  params: BudgetListParams = {}
): Promise<{ budgets: any[]; total: number }> {
  // Implementation will be added in coding phase
  // Use eq(), and(), desc() from drizzle-orm
  // Use schema.budgets table
  throw new Error('Not implemented');
}

// ==================== getResources ====================

/**
 * Get resources for a campaign
 *
 * Query resources table by campaign_id, sorted by created_at DESC.
 * Returns paginated list of resource entries.
 *
 * Implementation steps:
 * 1. Use withTenantContext(tenantId, async (tx) => {...})
 * 2. Query resources table with:
 *    - WHERE tenant_id = tenantId AND campaign_id = campaignId
 *    - Optional WHERE category = params.category (if provided)
 *    - ORDER BY created_at DESC
 *    - LIMIT params.limit (default 50, max 100)
 *    - OFFSET params.offset (default 0)
 * 3. Count total records with COUNT(*) (without limit/offset)
 * 4. Return { resources: [...], total: number }
 */
export async function getResources(
  tenantId: string,
  campaignId: string,
  params: ResourceListParams = {}
): Promise<{ resources: any[]; total: number }> {
  // Implementation will be added in coding phase
  // Use eq(), and(), desc() from drizzle-orm
  // Use schema.resources table
  throw new Error('Not implemented');
}

// ==================== getActivities ====================

/**
 * Get activities for a campaign
 *
 * Query activities table via activity_campaigns junction table.
 * Returns paginated list of activity entries attributed to this campaign.
 *
 * Implementation steps:
 * 1. Use withTenantContext(tenantId, async (tx) => {...})
 * 2. Query activities table with JOIN:
 *    - JOIN activity_campaigns ON activities.activity_id = activity_campaigns.activity_id
 *    - WHERE activity_campaigns.tenant_id = tenantId AND activity_campaigns.campaign_id = campaignId
 *    - Optional WHERE activities.action = params.action (if provided)
 *    - ORDER BY occurred_at DESC
 *    - LIMIT params.limit (default 50, max 100)
 *    - OFFSET params.offset (default 0)
 * 3. Count total records with COUNT(*) (without limit/offset)
 * 4. Return { activities: [...], total: number }
 *
 * Note: Activities are linked to campaigns via activity_campaigns (N:M)
 * This allows multi-touch attribution where one activity can belong to multiple campaigns.
 */
export async function getActivities(
  tenantId: string,
  campaignId: string,
  params: ActivityListParams = {}
): Promise<{ activities: any[]; total: number }> {
  // Implementation will be added in coding phase
  // Use eq(), and(), desc() from drizzle-orm
  // Use schema.activities and schema.activityCampaigns tables
  // JOIN via innerJoin() or leftJoin()
  throw new Error('Not implemented');
}
```

---

## エンドポイント定義

### 1. GET /api/campaigns/:id/budgets - 予算一覧取得

キャンペーンに紐づく予算エントリーを取得します。

#### インターフェース

```typescript
/**
 * GET /api/campaigns/:id/budgets - Get budgets for campaign
 *
 * Path Parameters:
 * - id: Campaign ID (UUID)
 *
 * Query Parameters:
 * - limit: Number of records to return (max 100, default 50)
 * - offset: Number of records to skip (default 0)
 * - category: Filter by category (optional)
 *
 * Response:
 * 200 OK
 * {
 *   budgets: [
 *     {
 *       budgetId: "...",
 *       tenantId: "...",
 *       campaignId: "...",
 *       category: "labor",
 *       amount: "10000.00",
 *       currency: "JPY",
 *       spentAt: "2025-03-01",
 *       source: "form",
 *       memo: "Staff costs",
 *       meta: {...},
 *       createdAt: "..."
 *     },
 *     ...
 *   ],
 *   total: 15
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid campaign ID format or query parameters
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Campaign not found
 * - 500 Internal Server Error: Database error
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  // Implementation will be added in coding phase
  // 1. Authentication check using requireAuth()
  //    const user = await requireAuth(request);
  //    const tenantId = user.tenantId;
  // 2. Validate campaign ID: const campaignId = params.id
  // 3. Verify campaign exists: const campaign = await getCampaign(tenantId, campaignId)
  //    if (!campaign) return json({ error: 'Campaign not found' }, { status: 404 })
  // 4. Parse query parameters
  //    const url = new URL(request.url);
  //    const queryParams = {
  //      limit: Number(url.searchParams.get('limit') || 50),
  //      offset: Number(url.searchParams.get('offset') || 0),
  //      category: url.searchParams.get('category') || undefined,
  //    };
  // 5. Call service: const result = await getBudgets(tenantId, campaignId, queryParams)
  // 6. Return: return json(result)
  throw new Error('Not implemented');
}
```

#### リクエスト例

```bash
GET /api/campaigns/30000000-0000-4000-8000-000000000001/budgets?limit=10&offset=0&category=labor
```

#### レスポンス例（200 OK）

```json
{
  "budgets": [
    {
      "budgetId": "40000000-0000-4000-8000-000000000001",
      "tenantId": "default",
      "campaignId": "30000000-0000-4000-8000-000000000001",
      "category": "labor",
      "amount": "10000.00",
      "currency": "JPY",
      "spentAt": "2025-03-01",
      "source": "form",
      "memo": "Staff costs for conference preparation",
      "meta": {
        "hours": 20,
        "rate": 500
      },
      "createdAt": "2025-10-14T00:00:00.000Z"
    },
    {
      "budgetId": "40000000-0000-4000-8000-000000000002",
      "tenantId": "default",
      "campaignId": "30000000-0000-4000-8000-000000000001",
      "category": "venue",
      "amount": "50000.00",
      "currency": "JPY",
      "spentAt": "2025-02-15",
      "source": "form",
      "memo": "Venue rental for conference",
      "meta": null,
      "createdAt": "2025-10-14T00:00:00.000Z"
    }
  ],
  "total": 15
}
```

---

### 2. GET /api/campaigns/:id/resources - リソース一覧取得

キャンペーンに紐づくリソース（blog、event、video等）を取得します。

#### インターフェース

```typescript
/**
 * GET /api/campaigns/:id/resources - Get resources for campaign
 *
 * Path Parameters:
 * - id: Campaign ID (UUID)
 *
 * Query Parameters:
 * - limit: Number of records to return (max 100, default 50)
 * - offset: Number of records to skip (default 0)
 * - category: Filter by category (optional)
 *
 * Response:
 * 200 OK
 * {
 *   resources: [
 *     {
 *       resourceId: "...",
 *       tenantId: "...",
 *       category: "event",
 *       groupKey: "devrel-2025",
 *       title: "DevRel Conference 2025",
 *       url: "https://example.com/events/2025",
 *       externalId: "connpass-12345",
 *       campaignId: "...",
 *       attributes: {...},
 *       createdAt: "...",
 *       updatedAt: "..."
 *     },
 *     ...
 *   ],
 *   total: 8
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid campaign ID format or query parameters
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Campaign not found
 * - 500 Internal Server Error: Database error
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  // Implementation will be added in coding phase
  // Same pattern as budgets API
  throw new Error('Not implemented');
}
```

#### リクエスト例

```bash
GET /api/campaigns/30000000-0000-4000-8000-000000000001/resources?limit=10&offset=0&category=event
```

#### レスポンス例（200 OK）

```json
{
  "resources": [
    {
      "resourceId": "50000000-0000-4000-8000-000000000001",
      "tenantId": "default",
      "category": "event",
      "groupKey": "devrel-2025",
      "title": "DevRel Conference 2025",
      "url": "https://example.com/events/devrel-2025",
      "externalId": "connpass-12345",
      "campaignId": "30000000-0000-4000-8000-000000000001",
      "attributes": {
        "location": "Tokyo",
        "capacity": 200,
        "language": "ja"
      },
      "createdAt": "2025-10-14T00:00:00.000Z",
      "updatedAt": "2025-10-14T00:00:00.000Z"
    },
    {
      "resourceId": "50000000-0000-4000-8000-000000000002",
      "tenantId": "default",
      "category": "blog",
      "groupKey": null,
      "title": "DevRel Best Practices 2025",
      "url": "https://blog.example.com/devrel-2025",
      "externalId": null,
      "campaignId": "30000000-0000-4000-8000-000000000001",
      "attributes": {
        "author": "alice",
        "tags": ["devrel", "conference"]
      },
      "createdAt": "2025-10-13T00:00:00.000Z",
      "updatedAt": "2025-10-13T00:00:00.000Z"
    }
  ],
  "total": 8
}
```

---

### 3. GET /api/campaigns/:id/activities - アクティビティ一覧取得

キャンペーンに関連するアクティビティ（click、attend、post等）を取得します。

#### インターフェース

```typescript
/**
 * GET /api/campaigns/:id/activities - Get activities for campaign
 *
 * Path Parameters:
 * - id: Campaign ID (UUID)
 *
 * Query Parameters:
 * - limit: Number of records to return (max 100, default 50)
 * - offset: Number of records to skip (default 0)
 * - action: Filter by action type (optional)
 *
 * Response:
 * 200 OK
 * {
 *   activities: [
 *     {
 *       activityId: "...",
 *       tenantId: "...",
 *       developerId: "..." | null,
 *       accountId: "..." | null,
 *       anonId: "..." | null,
 *       resourceId: "..." | null,
 *       action: "attend",
 *       occurredAt: "...",
 *       recordedAt: "...",
 *       source: "connpass",
 *       sourceRef: "https://connpass.com/event/12345",
 *       category: "event",
 *       groupKey: "devrel-2025",
 *       metadata: {...},
 *       confidence: "1.0",
 *       value: "5000.00",
 *       dedupKey: "...",
 *       ingestedAt: "..."
 *     },
 *     ...
 *   ],
 *   total: 120
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid campaign ID format or query parameters
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Campaign not found
 * - 500 Internal Server Error: Database error
 *
 * Note:
 * - Activities are linked to campaigns via activity_campaigns junction table
 * - One activity can be attributed to multiple campaigns (multi-touch attribution)
 * - The JOIN query returns activities with at least one link to the specified campaign
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  // Implementation will be added in coding phase
  // Same pattern as budgets/resources APIs
  // Use JOIN with activity_campaigns table
  throw new Error('Not implemented');
}
```

#### リクエスト例

```bash
GET /api/campaigns/30000000-0000-4000-8000-000000000001/activities?limit=10&offset=0&action=attend
```

#### レスポンス例（200 OK）

```json
{
  "activities": [
    {
      "activityId": "20000000-0000-4000-8000-000000000001",
      "tenantId": "default",
      "developerId": "10000000-0000-4000-8000-000000000001",
      "accountId": "15000000-0000-4000-8000-000000000001",
      "anonId": null,
      "resourceId": "50000000-0000-4000-8000-000000000001",
      "action": "attend",
      "occurredAt": "2025-03-01T10:00:00.000Z",
      "recordedAt": "2025-03-01T10:05:00.000Z",
      "source": "connpass",
      "sourceRef": "https://connpass.com/event/12345/participants/1",
      "category": "event",
      "groupKey": "devrel-2025",
      "metadata": {
        "utm_source": "twitter",
        "utm_medium": "social",
        "device": "mobile"
      },
      "confidence": "1.0",
      "value": "5000.00",
      "dedupKey": "connpass-12345-user-1",
      "ingestedAt": "2025-03-01T10:05:00.000Z"
    }
  ],
  "total": 120
}
```

---

## エラーハンドリング

### HTTPステータスコード

| ステータスコード | 意味 | 使用ケース |
|---------------|------|----------|
| 200 OK | 成功（GET） | データ取得成功 |
| 400 Bad Request | 不正なリクエスト | バリデーションエラー、不正なパラメータ |
| 401 Unauthorized | 認証エラー | 認証トークンがない、無効 |
| 404 Not Found | リソースが見つからない | キャンペーンが存在しない |
| 500 Internal Server Error | サーバーエラー | データベース接続エラー |

### エラーレスポンス形式

```typescript
interface ErrorResponse {
  error: string;           // エラーメッセージ
  details?: Record<string, string[]>; // フィールド別エラー（バリデーション時）
}
```

### エラーハンドリング実装例

```typescript
import { requireAuth } from '~/core/services/auth.middleware.js';
import { getCampaign } from '~/core/services/campaign.service.js';
import { getBudgets } from '~/core/services/campaign-detail.service.js';

export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Validate campaign ID
    const campaignId = params.id;
    if (!campaignId) {
      return json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    // 3. Verify campaign exists
    const campaign = await getCampaign(tenantId, campaignId);
    if (!campaign) {
      return json({ error: 'Campaign not found' }, { status: 404 });
    }

    // 4. Parse query parameters
    const url = new URL(request.url);
    const queryParams = {
      limit: Math.min(Number(url.searchParams.get('limit') || 50), 100),
      offset: Math.max(Number(url.searchParams.get('offset') || 0), 0),
      category: url.searchParams.get('category') || undefined,
    };

    // 5. Call service
    const result = await getBudgets(tenantId, campaignId, queryParams);

    // 6. Return success response
    return json(result);
  } catch (error) {
    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generic error
    console.error('Failed to fetch budgets:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

## 認証・認可

### セッション管理

すべてのAPIは認証済みユーザーのみがアクセス可能です。

**実装方針**:
1. Task 3.8で実装した`requireAuth()`ミドルウェアを使用
2. `requireAuth()`がユーザー情報（userId, tenantId, email, role）を返す
3. 未認証の場合は自動的に`/login`にリダイレクト（APIでは401を返す）

### Row Level Security (RLS)

全てのデータアクセスは、PostgreSQLのRLSにより自動的にテナント分離されます。

**重要**: サービス層の呼び出し時、`withTenantContext(tenantId, async (tx) => {...})`パターンを使用してください。

```typescript
// Campaign Detail Service uses withTenantContext internally
const result = await getBudgets(tenantId, campaignId, params);
// RLS is automatically applied by the service layer
```

---

## テスト方針

### 統合テスト

Task 7.4.1の完了条件は「3つのAPIが実装され、テストがパスする」ことです。以下のテストケースを実装します。

#### 1. GET /api/campaigns/:id/budgets - テスト

```typescript
import { describe, it, expect } from 'vitest';

describe('GET /api/campaigns/:id/budgets', () => {
  it('should return budgets for existing campaign', async () => {
    // Arrange: Use known campaign ID with budgets
    const campaignId = '30000000-0000-4000-8000-000000000001';
    const request = new Request(`http://localhost/api/campaigns/${campaignId}/budgets`);

    // Act: Call loader
    const response = await loader({ request, params: { id: campaignId }, context: {} });
    const data = await response.json();

    // Assert: Verify response
    expect(response.status).toBe(200);
    expect(data.budgets).toBeInstanceOf(Array);
    expect(data.total).toBeGreaterThanOrEqual(0);
  });

  it('should respect limit parameter', async () => {
    // Test pagination limit
    const campaignId = '30000000-0000-4000-8000-000000000001';
    const request = new Request(`http://localhost/api/campaigns/${campaignId}/budgets?limit=5`);
    const response = await loader({ request, params: { id: campaignId }, context: {} });
    const data = await response.json();

    expect(data.budgets.length).toBeLessThanOrEqual(5);
  });

  it('should filter by category', async () => {
    // Test category filter
    const campaignId = '30000000-0000-4000-8000-000000000001';
    const request = new Request(`http://localhost/api/campaigns/${campaignId}/budgets?category=labor`);
    const response = await loader({ request, params: { id: campaignId }, context: {} });
    const data = await response.json();

    // All returned budgets should have category === 'labor'
    data.budgets.forEach((budget) => {
      expect(budget.category).toBe('labor');
    });
  });

  it('should return 404 for non-existent campaign', async () => {
    // Arrange: Use non-existent UUID
    const campaignId = '99999999-9999-4999-8999-999999999999';
    const request = new Request(`http://localhost/api/campaigns/${campaignId}/budgets`);

    // Act & Assert: Expect 404
    const response = await loader({ request, params: { id: campaignId }, context: {} });
    expect(response.status).toBe(404);
  });

  it('should return 401 for unauthenticated requests', async () => {
    // Arrange: Request without session
    const campaignId = '30000000-0000-4000-8000-000000000001';
    const request = new Request(`http://localhost/api/campaigns/${campaignId}/budgets`);

    // Act & Assert: Expect 401
    const response = await loader({ request, params: { id: campaignId }, context: {} });
    expect(response.status).toBe(401);
  });
});
```

#### 2. GET /api/campaigns/:id/resources - テスト

```typescript
describe('GET /api/campaigns/:id/resources', () => {
  it('should return resources for existing campaign', async () => {
    // Test basic functionality
  });

  it('should respect limit parameter', async () => {
    // Test pagination limit
  });

  it('should filter by category', async () => {
    // Test category filter (event, blog, video, etc.)
  });

  it('should return 404 for non-existent campaign', async () => {
    // Test 404 error
  });

  it('should return 401 for unauthenticated requests', async () => {
    // Test authentication
  });
});
```

#### 3. GET /api/campaigns/:id/activities - テスト

```typescript
describe('GET /api/campaigns/:id/activities', () => {
  it('should return activities for existing campaign', async () => {
    // Test basic functionality with JOIN on activity_campaigns
  });

  it('should respect limit parameter', async () => {
    // Test pagination limit
  });

  it('should filter by action', async () => {
    // Test action filter (click, attend, post, etc.)
  });

  it('should return 404 for non-existent campaign', async () => {
    // Test 404 error
  });

  it('should return 401 for unauthenticated requests', async () {
    // Test authentication
  });

  it('should handle campaigns with no activities', async () => {
    // Test edge case: campaign with no linked activities
    // Should return empty array, not 404
  });
});
```

### テスト実行環境

- **Docker内で実行**: `docker compose --env-file .env.test exec core pnpm test campaigns.*budgets.test`
- **実データベース使用**: モック不使用、実際のPostgreSQLコンテナに接続
- **RLS有効**: テナントコンテキストを設定してRLSポリシーを検証
- **クリーンアップ**: `afterAll`フックでテストデータ削除

---

## セキュリティ考慮事項

### 1. 認証・認可

**認証**:
- 全てのエンドポイントは認証必須
- セッションCookieから`tenantId`を取得
- 認証エラーは401 Unauthorizedを返す

**認可**:
- RLSにより、テナント間のデータ分離を保証
- 不正なテナントIDアクセスは自動的にフィルタリング

### 2. 入力バリデーション

**クエリパラメータ**:
- `limit`: 最大100に制限（DoS攻撃防止）
- `offset`: 負の値を拒否（`Math.max(0, offset)`）
- `campaignId`: UUID形式を検証（Drizzle ORMが自動検証）

### 3. エラーメッセージのサニタイゼーション

**機密情報の漏洩防止**:
- データベースエラーメッセージを直接返さない
- スタックトレースをレスポンスに含めない
- ログには詳細を記録、レスポンスは汎用的なメッセージ

```typescript
catch (error) {
  // ログには詳細を記録
  console.error('Database error:', error);

  // クライアントには汎用的なメッセージを返す
  return json({ error: 'Internal server error' }, { status: 500 });
}
```

---

## 完了条件

- [ ] `core/services/campaign-detail.service.ts`ファイル作成
- [ ] `getBudgets()`関数実装（ページネーション、フィルタ対応）
- [ ] `getResources()`関数実装（ページネーション、フィルタ対応）
- [ ] `getActivities()`関数実装（JOIN、ページネーション、フィルタ対応）
- [ ] `app/routes/api/campaigns.$id.budgets.ts`ファイル作成
- [ ] GET /api/campaigns/:id/budgets 実装
- [ ] `app/routes/api/campaigns.$id.resources.ts`ファイル作成
- [ ] GET /api/campaigns/:id/resources 実装
- [ ] `app/routes/api/campaigns.$id.activities.ts`ファイル作成
- [ ] GET /api/campaigns/:id/activities 実装
- [ ] エラーハンドリング実装（400, 401, 404, 500）
- [ ] 統合テストファイル作成
  - `core/services/campaign-detail.service.test.ts`（サービス層テスト）
  - `app/routes/api/campaigns.$id.budgets.test.ts`（API テスト）
  - `app/routes/api/campaigns.$id.resources.test.ts`（API テスト）
  - `app/routes/api/campaigns.$id.activities.test.ts`（API テスト）
- [ ] 各APIのテスト（正常系・異常系）
- [ ] 認証・認可のテスト（401、404）
- [ ] 全テストが成功（`pnpm test`）
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] Lintエラーなし（`pnpm lint`）

---

## 実装ガイドライン

### 参考実装

- **Campaign API** (`app/routes/api/campaigns.ts`) - Task 5.4で実装済み（同じパターン）
- **Activity API** (`app/routes/api/activities.ts`) - Task 4.5で実装済み（エラーハンドリングパターン）
- **Campaign Service** (`core/services/campaign.service.ts`) - Task 5.1で実装済み

### コーディング規約

1. **すべてのコードとコメントは英語で記述**
2. **エラーハンドリングは`try-catch`で実装**
3. **型定義は明確に定義（any/unknown を使用しない）**
4. **console.errorでエラーログ出力**
5. **`as any`/`as unknown`を使用しない**

### データベースクエリパターン

```typescript
// Budgets query example
const budgets = await tx
  .select()
  .from(schema.budgets)
  .where(
    and(
      eq(schema.budgets.tenantId, tenantId),
      eq(schema.budgets.campaignId, campaignId),
      params.category ? eq(schema.budgets.category, params.category) : undefined
    )
  )
  .orderBy(desc(schema.budgets.spentAt), desc(schema.budgets.createdAt))
  .limit(params.limit || 50)
  .offset(params.offset || 0);
```

### COUNT集計パターン

```typescript
// Total count query example
const [countResult] = await tx
  .select({ count: sql<number>`COUNT(*)` })
  .from(schema.budgets)
  .where(
    and(
      eq(schema.budgets.tenantId, tenantId),
      eq(schema.budgets.campaignId, campaignId),
      params.category ? eq(schema.budgets.category, params.category) : undefined
    )
  );

const total = countResult?.count ?? 0;
```

### JOINクエリパターン（Activities用）

```typescript
// Activities JOIN query example
const activities = await tx
  .select({
    activityId: schema.activities.activityId,
    tenantId: schema.activities.tenantId,
    // ... other fields
  })
  .from(schema.activities)
  .innerJoin(
    schema.activityCampaigns,
    eq(schema.activities.activityId, schema.activityCampaigns.activityId)
  )
  .where(
    and(
      eq(schema.activityCampaigns.tenantId, tenantId),
      eq(schema.activityCampaigns.campaignId, campaignId),
      params.action ? eq(schema.activities.action, params.action) : undefined
    )
  )
  .orderBy(desc(schema.activities.occurredAt))
  .limit(params.limit || 50)
  .offset(params.offset || 0);
```

---

## 注意事項

### budgetsテーブル

- `amount`フィールドは`numeric`型（精度を保つため）
- JavaScript側では**string**として扱う
- `spentAt`は`date`型（YYYY-MM-DD形式）

### resourcesテーブル

- `campaign_id`は`NULL`可能（キャンペーンに紐づかないリソースも存在）
- `attributes`はJSONB型（カスタムメタデータ）
- `category`推奨値: "event", "blog", "video", "ad", "repo", "link", "form", "webinar"

### activitiesテーブル

- `activity_campaigns`テーブルを介してキャンペーンに紐づく（N:M関係）
- 1つのアクティビティは複数のキャンペーンに属することができる（マルチタッチアトリビューション）
- `developer_id`、`account_id`、`anon_id`はすべて`NULL`可能

---

## 次のタスク

Task 7.4.1完了後、次はTask 7.4.2（施策詳細ページ実装）に進みます：

- **Task 7.4.2**: 施策詳細ページ実装
  - `app/routes/dashboard/campaigns.$id.tsx`作成
  - 施策詳細情報表示
  - Budgets リスト表示
  - Resources リスト表示
  - Activities リスト表示

---

## 参考資料

- [Remix Resource Routes](https://remix.run/docs/en/main/guides/resource-routes)
- [Drizzle ORM Queries](https://orm.drizzle.team/docs/select)
- [Campaign Service Documentation](.tmp/tasks/task-5.1-roi-service.md)
- [Activity Service Documentation](.tmp/tasks/task-4.4-activity-service.md)
