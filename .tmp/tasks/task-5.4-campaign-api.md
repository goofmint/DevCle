# Task 5.4: Campaign API実装

**タスクID**: 5.4
**フェーズ**: Phase 5（ROI分析機能実装）
**依存**: Task 5.2（ROI計算ロジック実装）、Task 5.3（短縮URL機能実装）
**推定時間**: 3時間
**担当**: Backend Developer

---

## 概要

このタスクでは、**Campaign（施策）管理API**と**ROI取得API**を実装します。Remix Resource Routeを使用して、RESTful APIエンドポイントを提供します。

**実装するエンドポイント（CRUD完全対応）**:
1. **GET /api/campaigns** - キャンペーン一覧取得（ページネーション、フィルタ、ソート対応）
2. **POST /api/campaigns** - 新規キャンペーン作成
3. **GET /api/campaigns/:id** - キャンペーン詳細取得
4. **PUT /api/campaigns/:id** - キャンペーン更新（部分更新対応）
5. **DELETE /api/campaigns/:id** - キャンペーン削除
6. **GET /api/campaigns/:id/roi** - キャンペーンのROI計算結果取得

### 対象サービス

- **Campaign Service** (`core/services/campaign.service.ts`) - Task 5.1で実装済み
- **ROI Service** (`core/services/roi.service.ts`) - Task 5.2で実装済み

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
Tenant Context (setTenantContext)
  ↓
Campaign Service / ROI Service
  ↓
Drizzle ORM
  ↓
PostgreSQL (campaigns, budgets, activities with RLS)
```

### 設計原則

1. **Developer APIと同じパターン** - Task 4.2のDeveloper API実装と同じ設計パターンを採用
2. **認証必須** - すべてのエンドポイントは`requireAuth()`を使用
3. **RLS対応** - `withTenantContext(tenantId, async (tx) => {...})` パターンを使用
4. **エラーハンドリング** - 統一されたエラーレスポンス形式
5. **型安全性** - `as any`/`as unknown`を使わず、TypeScript型推論を活用

---

## ファイル構成

```
app/routes/api/
  ├── campaigns.ts           // GET /api/campaigns (list), POST /api/campaigns (create)
  ├── campaigns.$id.ts       // GET /api/campaigns/:id (get), PUT /api/campaigns/:id (update), DELETE /api/campaigns/:id (delete)
  └── campaigns.$id.roi.ts   // GET /api/campaigns/:id/roi
```

**ファイルサイズ**: 各ファイル200-300行程度

---

## エンドポイント定義

### 1. GET /api/campaigns - 一覧取得

キャンペーン一覧を取得します。ページネーション・フィルタ・ソート機能を提供します。

#### インターフェース

```typescript
/**
 * GET /api/campaigns - List campaigns
 *
 * Query Parameters:
 * - limit: Number of records to return (max 100, default 50)
 * - offset: Number of records to skip (default 0)
 * - channel: Filter by channel (optional)
 * - search: Search in name (optional, partial match, case-insensitive)
 * - orderBy: Field to sort by ('name', 'startDate', 'endDate', 'createdAt', 'updatedAt', default: 'createdAt')
 * - orderDirection: Sort direction ('asc', 'desc', default: 'desc')
 *
 * Response:
 * 200 OK
 * {
 *   campaigns: [...],
 *   total: 123
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid query parameters
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Implementation will be added in coding phase
  // 1. Authentication check using requireAuth()
  //    const user = await requireAuth(request);
  //    const tenantId = user.tenantId;
  // 2. Parse and validate query parameters
  //    const url = new URL(request.url);
  //    const params = {
  //      limit: Number(url.searchParams.get('limit') || 50),
  //      offset: Number(url.searchParams.get('offset') || 0),
  //      channel: url.searchParams.get('channel') || undefined,
  //      search: url.searchParams.get('search') || undefined,
  //      orderBy: url.searchParams.get('orderBy') || 'createdAt',
  //      orderDirection: url.searchParams.get('orderDirection') || 'desc',
  //    };
  // 3. Call service: const result = await listCampaigns(tenantId, params)
  // 4. Return: return json(result)
  throw new Error('Not implemented');
}
```

#### リクエスト例

```bash
GET /api/campaigns?limit=10&offset=0&channel=event&orderBy=startDate&orderDirection=desc
```

#### レスポンス例（200 OK）

```json
{
  "campaigns": [
    {
      "campaignId": "30000000-0000-4000-8000-000000000001",
      "tenantId": "default",
      "name": "DevRel Conference 2025",
      "channel": "event",
      "startDate": "2025-03-01",
      "endDate": "2025-03-03",
      "budgetTotal": "50000.00",
      "attributes": {
        "location": "Tokyo",
        "utm_source": "conference"
      },
      "createdAt": "2025-10-14T00:00:00.000Z",
      "updatedAt": "2025-10-14T00:00:00.000Z"
    }
  ],
  "total": 15
}
```

#### エラーレスポンス例

```json
// 400 Bad Request
{
  "error": "Invalid query parameters",
  "details": {
    "limit": ["Must be a positive integer"]
  }
}

// 401 Unauthorized
{
  "error": "Unauthorized"
}

// 500 Internal Server Error
{
  "error": "Failed to fetch campaigns"
}
```

---

### 2. POST /api/campaigns - 新規作成

新規キャンペーンを作成します。

#### インターフェース

```typescript
/**
 * POST /api/campaigns - Create a new campaign
 *
 * Request Body:
 * {
 *   name: string,
 *   channel: string | null,
 *   startDate: string (ISO 8601 date) | null,
 *   endDate: string (ISO 8601 date) | null,
 *   budgetTotal: string (decimal) | null,
 *   attributes: { [key: string]: any }
 * }
 *
 * Response:
 * 201 Created
 * {
 *   campaignId: "...",
 *   tenantId: "...",
 *   name: "...",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid request body (validation error)
 * - 401 Unauthorized: Missing or invalid authentication
 * - 409 Conflict: Campaign with this name already exists
 * - 500 Internal Server Error: Database error
 */
export async function action({ request }: ActionFunctionArgs) {
  const method = request.method;

  if (method === 'POST') {
    // Implementation will be added in coding phase
    // 1. Authentication check using requireAuth()
    //    const user = await requireAuth(request);
    //    const tenantId = user.tenantId;
    // 2. Parse request body: const data = await request.json()
    // 3. Call service: const result = await createCampaign(tenantId, data)
    // 4. Return: return json(result, { status: 201 })
    throw new Error('Not implemented');
  }

  // Method not allowed
  return json({ error: 'Method not allowed' }, { status: 405 });
}
```

#### リクエスト例

```bash
POST /api/campaigns
Content-Type: application/json

{
  "name": "DevRel Conference 2025",
  "channel": "event",
  "startDate": "2025-03-01",
  "endDate": "2025-03-03",
  "budgetTotal": "50000.00",
  "attributes": {
    "location": "Tokyo",
    "utm_source": "conference"
  }
}
```

#### レスポンス例（201 Created）

```json
{
  "campaignId": "30000000-0000-4000-8000-000000000001",
  "tenantId": "default",
  "name": "DevRel Conference 2025",
  "channel": "event",
  "startDate": "2025-03-01",
  "endDate": "2025-03-03",
  "budgetTotal": "50000.00",
  "attributes": {
    "location": "Tokyo",
    "utm_source": "conference"
  },
  "createdAt": "2025-10-14T00:00:00.000Z",
  "updatedAt": "2025-10-14T00:00:00.000Z"
}
```

#### エラーレスポンス例

```json
// 400 Bad Request
{
  "error": "Validation failed",
  "details": {
    "name": ["Name is required"],
    "startDate": ["startDate must be on or before endDate"]
  }
}

// 409 Conflict
{
  "error": "Campaign with this name already exists"
}
```

---

### 3. GET /api/campaigns/:id - 詳細取得

キャンペーンIDからキャンペーン詳細を取得します。

#### インターフェース

```typescript
/**
 * GET /api/campaigns/:id - Get campaign by ID
 *
 * Path Parameters:
 * - id: Campaign ID (UUID)
 *
 * Response:
 * 200 OK
 * {
 *   campaignId: "...",
 *   tenantId: "...",
 *   name: "...",
 *   channel: "...",
 *   startDate: "...",
 *   endDate: "...",
 *   budgetTotal: "...",
 *   attributes: {...},
 *   createdAt: "...",
 *   updatedAt: "..."
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid campaign ID format
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
  // 3. Call service: const result = await getCampaign(tenantId, campaignId)
  // 4. If null, return 404
  // 5. Return: return json(result)
  throw new Error('Not implemented');
}
```

#### リクエスト例

```bash
GET /api/campaigns/30000000-0000-4000-8000-000000000001
```

#### レスポンス例（200 OK）

```json
{
  "campaignId": "30000000-0000-4000-8000-000000000001",
  "tenantId": "default",
  "name": "DevRel Conference 2025",
  "channel": "event",
  "startDate": "2025-03-01",
  "endDate": "2025-03-03",
  "budgetTotal": "50000.00",
  "attributes": {
    "location": "Tokyo",
    "utm_source": "conference"
  },
  "createdAt": "2025-10-14T00:00:00.000Z",
  "updatedAt": "2025-10-14T00:00:00.000Z"
}
```

#### エラーレスポンス例

```json
// 404 Not Found
{
  "error": "Campaign not found"
}

// 400 Bad Request
{
  "error": "Invalid campaign ID format"
}
```

---

### 4. PUT /api/campaigns/:id - 更新

既存キャンペーンを更新します。部分更新（Partial Update）をサポートします。

#### インターフェース

```typescript
/**
 * PUT /api/campaigns/:id - Update campaign
 *
 * Path Parameters:
 * - id: Campaign ID (UUID)
 *
 * Request Body (all fields optional):
 * {
 *   name?: string,
 *   channel?: string | null,
 *   startDate?: string (ISO 8601 date) | null,
 *   endDate?: string (ISO 8601 date) | null,
 *   budgetTotal?: string (decimal) | null,
 *   attributes?: { [key: string]: any }
 * }
 *
 * Response:
 * 200 OK
 * {
 *   campaignId: "...",
 *   tenantId: "...",
 *   name: "...",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid request body or campaign ID
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Campaign not found
 * - 409 Conflict: Campaign with this name already exists
 * - 500 Internal Server Error: Database error
 */
export async function action({ params, request }: ActionFunctionArgs) {
  const method = request.method;

  if (method === 'PUT') {
    // Implementation will be added in coding phase
    // 1. Authentication check using requireAuth()
    //    const user = await requireAuth(request);
    //    const tenantId = user.tenantId;
    // 2. Validate campaign ID: const campaignId = params.id
    // 3. Parse request body: const data = await request.json()
    // 4. Call service: const result = await updateCampaign(tenantId, campaignId, data)
    // 5. If null, return 404
    // 6. Return: return json(result)
    throw new Error('Not implemented');
  }

  // Method not allowed
  return json({ error: 'Method not allowed' }, { status: 405 });
}
```

#### リクエスト例

```bash
PUT /api/campaigns/30000000-0000-4000-8000-000000000001
Content-Type: application/json

{
  "name": "DevRel Conference 2025 (Updated)",
  "budgetTotal": "60000.00"
}
```

#### レスポンス例（200 OK）

```json
{
  "campaignId": "30000000-0000-4000-8000-000000000001",
  "tenantId": "default",
  "name": "DevRel Conference 2025 (Updated)",
  "channel": "event",
  "startDate": "2025-03-01",
  "endDate": "2025-03-03",
  "budgetTotal": "60000.00",
  "attributes": {
    "location": "Tokyo",
    "utm_source": "conference"
  },
  "createdAt": "2025-10-14T00:00:00.000Z",
  "updatedAt": "2025-10-15T12:00:00.000Z"
}
```

#### エラーレスポンス例

```json
// 404 Not Found
{
  "error": "Campaign not found"
}

// 400 Bad Request
{
  "error": "Validation failed",
  "details": {
    "startDate": ["startDate must be on or before endDate"]
  }
}

// 409 Conflict
{
  "error": "Campaign with this name already exists"
}
```

---

### 5. DELETE /api/campaigns/:id - 削除

キャンペーンを削除します（ハードデリート）。

#### インターフェース

```typescript
/**
 * DELETE /api/campaigns/:id - Delete campaign
 *
 * Path Parameters:
 * - id: Campaign ID (UUID)
 *
 * Response:
 * 204 No Content (on success)
 *
 * Error Responses:
 * - 400 Bad Request: Invalid campaign ID format
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Campaign not found
 * - 500 Internal Server Error: Database error
 *
 * Note:
 * - Related budgets are CASCADE deleted (FK constraint)
 * - Related resources are orphaned (campaign_id = NULL)
 */
export async function action({ params, request }: ActionFunctionArgs) {
  const method = request.method;

  if (method === 'DELETE') {
    // Implementation will be added in coding phase
    // 1. Authentication check using requireAuth()
    //    const user = await requireAuth(request);
    //    const tenantId = user.tenantId;
    // 2. Validate campaign ID: const campaignId = params.id
    // 3. Call service: const result = await deleteCampaign(tenantId, campaignId)
    // 4. If false (not found), return 404
    // 5. Return: return new Response(null, { status: 204 })
    throw new Error('Not implemented');
  }

  // Method not allowed (PUT or DELETE will be handled above)
  return json({ error: 'Method not allowed' }, { status: 405 });
}
```

#### リクエスト例

```bash
DELETE /api/campaigns/30000000-0000-4000-8000-000000000001
```

#### レスポンス例（204 No Content）

```
(レスポンスボディなし)
```

#### エラーレスポンス例

```json
// 404 Not Found
{
  "error": "Campaign not found"
}

// 400 Bad Request
{
  "error": "Invalid campaign ID format"
}
```

**削除の影響範囲**:

| テーブル | 動作 | 理由 |
|---------|------|------|
| `budgets` | CASCADE削除 | キャンペーン予算はキャンペーンに紐づくため |
| `resources` | `campaign_id = NULL` | リソース自体は独立して存在可能 |
| `activities` | 影響なし | アクティビティは独立（campaign_idを持たない） |

---

### 6. GET /api/campaigns/:id/roi - ROI取得

キャンペーンのROI計算結果を取得します。

#### インターフェース

```typescript
/**
 * GET /api/campaigns/:id/roi - Get campaign ROI
 *
 * Path Parameters:
 * - id: Campaign ID (UUID)
 *
 * Response:
 * 200 OK
 * {
 *   campaignId: "...",
 *   campaignName: "...",
 *   totalCost: "50000.00",
 *   totalValue: "75000.00",
 *   roi: 50.0,
 *   activityCount: 120,
 *   developerCount: 45,
 *   calculatedAt: "2025-10-15T00:00:00.000Z"
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid campaign ID format
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
  // 3. Call service: const result = await calculateROI(tenantId, campaignId)
  // 4. If campaign not found, return 404
  // 5. Return: return json(result)
  throw new Error('Not implemented');
}
```

#### リクエスト例

```bash
GET /api/campaigns/30000000-0000-4000-8000-000000000001/roi
```

#### レスポンス例（200 OK）

```json
{
  "campaignId": "30000000-0000-4000-8000-000000000001",
  "campaignName": "DevRel Conference 2025",
  "totalCost": "50000.00",
  "totalValue": "75000.00",
  "roi": 50.0,
  "activityCount": 120,
  "developerCount": 45,
  "calculatedAt": "2025-10-15T00:00:00.000Z"
}
```

**ROI解釈**:
- `roi > 0`: 正のリターン（成功したキャンペーン）
- `roi = 0`: 損益分岐点
- `roi < 0`: 負のリターン（損失）
- `roi = null`: 計算不可（totalCostが0、ゼロ除算）

#### エラーレスポンス例

```json
// 404 Not Found
{
  "error": "Campaign not found"
}

// 400 Bad Request
{
  "error": "Invalid campaign ID format"
}
```

---

## エラーハンドリング

### HTTPステータスコード

| ステータスコード | 意味 | 使用ケース |
|---------------|------|----------|
| 200 OK | 成功（GET, PUT） | キャンペーン一覧取得・詳細取得・更新・ROI取得成功 |
| 201 Created | 作成成功（POST） | 新規キャンペーン作成成功 |
| 204 No Content | 削除成功（DELETE） | キャンペーン削除成功 |
| 400 Bad Request | 不正なリクエスト | バリデーションエラー、不正なパラメータ |
| 401 Unauthorized | 認証エラー | 認証トークンがない、無効 |
| 404 Not Found | リソースが見つからない | キャンペーンが存在しない |
| 405 Method Not Allowed | 許可されていないメソッド | 未実装のHTTPメソッド |
| 409 Conflict | 競合エラー | キャンペーン名重複 |
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

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Parse query parameters
    const url = new URL(request.url);
    const params = {
      limit: Number(url.searchParams.get('limit') || 50),
      offset: Number(url.searchParams.get('offset') || 0),
      channel: url.searchParams.get('channel') || undefined,
      search: url.searchParams.get('search') || undefined,
      orderBy: url.searchParams.get('orderBy') || 'createdAt',
      orderDirection: url.searchParams.get('orderDirection') || 'desc',
    };

    // 3. Call service
    const result = await listCampaigns(tenantId, params);

    // 4. Return success response
    return json(result);
  } catch (error) {
    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof z.ZodError) {
      // Validation error
      return json(
        {
          error: 'Validation failed',
          details: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Check for specific error messages from service layer
      if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
        return json({ error: 'Campaign with this name already exists' }, { status: 409 });
      }
      if (error.message.includes('not found')) {
        return json({ error: 'Campaign not found' }, { status: 404 });
      }
    }

    // Generic error
    console.error('Failed to process request:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

## 認証・認可

### セッション管理

キャンペーンAPIは、認証済みユーザーのみがアクセス可能です。

**実装方針**:
1. Task 3.8で実装した`requireAuth()`ミドルウェアを使用
2. `requireAuth()`がユーザー情報（userId, tenantId, email, role）を返す
3. 未認証の場合は自動的に`/login`にリダイレクト

```typescript
import { requireAuth } from '~/core/services/auth.middleware.js';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Require authentication
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // ... proceed with authenticated request
  } catch (error) {
    // requireAuth() redirect → 401 Unauthorized for API
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }
}
```

### Row Level Security (RLS)

全てのキャンペーンデータアクセスは、PostgreSQLのRLSにより自動的にテナント分離されます。

**重要**: サービス層の呼び出し時、`withTenantContext(tenantId, async (tx) => {...})`パターンを使用してください。

```typescript
// Campaign Service already uses withTenantContext internally
const result = await listCampaigns(tenantId, params);
// RLS is automatically applied by the service layer
```

---

## テスト方針

### 統合テスト（`app/routes/api/campaigns.test.ts`）

Task 5.4の完了条件は「APIが統合テストでパスする」ことです。以下のテストケースを実装します。

#### 1. GET /api/campaigns - 一覧取得テスト

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('GET /api/campaigns', () => {
  it('should return campaigns list with default pagination', async () => {
    // Arrange: Prepare authenticated request
    const request = new Request('http://localhost/api/campaigns', {
      headers: {
        Cookie: 'session=...' // authenticated session
      }
    });

    // Act: Call loader
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // Assert: Verify response
    expect(response.status).toBe(200);
    expect(data.campaigns).toBeInstanceOf(Array);
    expect(data.total).toBeGreaterThanOrEqual(0);
  });

  it('should respect limit and offset parameters', async () => {
    // Test pagination
    const request = new Request('http://localhost/api/campaigns?limit=5&offset=0');
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(data.campaigns.length).toBeLessThanOrEqual(5);
  });

  it('should filter by channel', async () => {
    // Test channel filter
    const request = new Request('http://localhost/api/campaigns?channel=event');
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // All returned campaigns should have channel === 'event'
    data.campaigns.forEach((campaign) => {
      expect(campaign.channel).toBe('event');
    });
  });

  it('should search by name', async () => {
    // Test search functionality
    const request = new Request('http://localhost/api/campaigns?search=conference');
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // All returned campaigns should have 'conference' in name
    data.campaigns.forEach((campaign) => {
      expect(campaign.name.toLowerCase()).toContain('conference');
    });
  });

  it('should sort by startDate ascending', async () => {
    // Test sorting
    const request = new Request('http://localhost/api/campaigns?orderBy=startDate&orderDirection=asc');
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // Verify sort order
    for (let i = 0; i < data.campaigns.length - 1; i++) {
      const date1 = new Date(data.campaigns[i].startDate || 0);
      const date2 = new Date(data.campaigns[i + 1].startDate || 0);
      expect(date1 <= date2).toBe(true);
    }
  });

  it('should return 401 for unauthenticated requests', async () => {
    // Arrange: Request without session
    const request = new Request('http://localhost/api/campaigns');

    // Act & Assert: Expect 401
    const response = await loader({ request, params: {}, context: {} });
    expect(response.status).toBe(401);
  });
});
```

#### 2. POST /api/campaigns - 作成テスト

```typescript
describe('POST /api/campaigns', () => {
  it('should create a new campaign', async () => {
    // Arrange: Prepare request with valid data
    const requestBody = {
      name: 'Test Campaign ' + Date.now(),
      channel: 'test',
      startDate: '2025-06-01',
      endDate: '2025-06-30',
      budgetTotal: '10000.00',
      attributes: { test: true },
    };

    const request = new Request('http://localhost/api/campaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'session=...',
      },
      body: JSON.stringify(requestBody),
    });

    // Act: Call action
    const response = await action({ request, params: {}, context: {} });
    const data = await response.json();

    // Assert: Verify created campaign
    expect(response.status).toBe(201);
    expect(data.name).toBe(requestBody.name);
    expect(data.channel).toBe('test');
    expect(data.campaignId).toBeDefined();
  });

  it('should return 400 for invalid date range', async () => {
    // Arrange: Invalid date range (startDate > endDate)
    const requestBody = {
      name: 'Invalid Campaign',
      channel: 'test',
      startDate: '2025-06-30',
      endDate: '2025-06-01',
      budgetTotal: null,
      attributes: {},
    };

    const request = new Request('http://localhost/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // Act & Assert: Expect validation error
    const response = await action({ request, params: {}, context: {} });
    expect(response.status).toBe(400);
  });

  it('should return 409 for duplicate campaign name', async () => {
    // Test duplicate name constraint
    // (Implementation depends on existing test data)
  });
});
```

#### 3. GET /api/campaigns/:id - 詳細取得テスト

```typescript
describe('GET /api/campaigns/:id', () => {
  it('should return campaign by ID', async () => {
    // Arrange: Use known campaign ID
    const campaignId = '30000000-0000-4000-8000-000000000001';
    const request = new Request(`http://localhost/api/campaigns/${campaignId}`);

    // Act: Call loader
    const response = await loader({ request, params: { id: campaignId }, context: {} });
    const data = await response.json();

    // Assert: Verify returned campaign
    expect(response.status).toBe(200);
    expect(data.campaignId).toBe(campaignId);
    expect(data.name).toBeDefined();
  });

  it('should return 404 for non-existent ID', async () => {
    // Arrange: Use non-existent UUID
    const campaignId = '99999999-9999-4999-8999-999999999999';
    const request = new Request(`http://localhost/api/campaigns/${campaignId}`);

    // Act & Assert: Expect 404
    const response = await loader({ request, params: { id: campaignId }, context: {} });
    expect(response.status).toBe(404);
  });

  it('should return 400 for invalid UUID format', async () => {
    // Test invalid UUID format
    const campaignId = 'invalid-uuid';
    const request = new Request(`http://localhost/api/campaigns/${campaignId}`);

    const response = await loader({ request, params: { id: campaignId }, context: {} });
    expect(response.status).toBe(400);
  });
});
```

#### 4. PUT /api/campaigns/:id - 更新テスト

```typescript
describe('PUT /api/campaigns/:id', () => {
  it('should update campaign', async () => {
    // Arrange: Prepare update data
    const campaignId = '30000000-0000-4000-8000-000000000001';
    const updateData = {
      name: 'Updated Campaign',
      budgetTotal: '60000.00',
    };

    const request = new Request(`http://localhost/api/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });

    // Act: Call action
    const response = await action({ request, params: { id: campaignId }, context: {} });
    const data = await response.json();

    // Assert: Verify updated data
    expect(response.status).toBe(200);
    expect(data.name).toBe('Updated Campaign');
    expect(data.budgetTotal).toBe('60000.00');
  });

  it('should return 404 for non-existent campaign', async () => {
    // Test update on non-existent campaign
    const campaignId = '99999999-9999-4999-8999-999999999999';
    const updateData = { name: 'Test' };

    const request = new Request(`http://localhost/api/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });

    const response = await action({ request, params: { id: campaignId }, context: {} });
    expect(response.status).toBe(404);
  });

  it('should support partial updates', async () => {
    // Test updating only specific fields
    const campaignId = '30000000-0000-4000-8000-000000000001';
    const updateData = { budgetTotal: '70000.00' };

    const request = new Request(`http://localhost/api/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });

    const response = await action({ request, params: { id: campaignId }, context: {} });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.budgetTotal).toBe('70000.00');
    // Other fields should remain unchanged
  });
});
```

#### 5. DELETE /api/campaigns/:id - 削除テスト

```typescript
describe('DELETE /api/campaigns/:id', () => {
  it('should delete campaign', async () => {
    // Arrange: Create a campaign to delete
    const created = await createCampaign('default', {
      name: 'To Delete ' + Date.now(),
      channel: 'test',
      startDate: null,
      endDate: null,
      budgetTotal: null,
      attributes: {},
    });

    const request = new Request(`http://localhost/api/campaigns/${created.campaignId}`, {
      method: 'DELETE',
    });

    // Act: Call action
    const response = await action({ request, params: { id: created.campaignId }, context: {} });

    // Assert: Verify deletion
    expect(response.status).toBe(204);

    // Verify campaign no longer exists
    const getResponse = await getCampaign('default', created.campaignId);
    expect(getResponse).toBeNull();
  });

  it('should return 404 for non-existent campaign', async () => {
    // Test deletion of non-existent campaign
    const campaignId = '99999999-9999-4999-8999-999999999999';
    const request = new Request(`http://localhost/api/campaigns/${campaignId}`, {
      method: 'DELETE',
    });

    const response = await action({ request, params: { id: campaignId }, context: {} });
    expect(response.status).toBe(404);
  });

  it('should CASCADE delete related budgets', async () => {
    // Test that related budgets are deleted when campaign is deleted
    // (Implementation depends on budget service)
  });
});
```

#### 6. GET /api/campaigns/:id/roi - ROI取得テスト

```typescript
describe('GET /api/campaigns/:id/roi', () => {
  it('should return ROI for existing campaign', async () => {
    // Arrange: Use known campaign ID
    const campaignId = '30000000-0000-4000-8000-000000000001';
    const request = new Request(`http://localhost/api/campaigns/${campaignId}/roi`);

    // Act: Call loader
    const response = await loader({ request, params: { id: campaignId }, context: {} });
    const data = await response.json();

    // Assert: Verify ROI data
    expect(response.status).toBe(200);
    expect(data.campaignId).toBe(campaignId);
    expect(data.campaignName).toBeDefined();
    expect(data.totalCost).toBeDefined();
    expect(data.totalValue).toBeDefined();
    expect(data.roi).toBeDefined(); // number or null
    expect(data.activityCount).toBeGreaterThanOrEqual(0);
    expect(data.developerCount).toBeGreaterThanOrEqual(0);
    expect(data.calculatedAt).toBeDefined();
  });

  it('should return 404 for non-existent campaign', async () => {
    // Arrange: Use non-existent UUID
    const campaignId = '99999999-9999-4999-8999-999999999999';
    const request = new Request(`http://localhost/api/campaigns/${campaignId}/roi`);

    // Act & Assert: Expect 404
    const response = await loader({ request, params: { id: campaignId }, context: {} });
    expect(response.status).toBe(404);
  });

  it('should return 400 for invalid UUID format', async () => {
    // Test invalid UUID format
    const campaignId = 'invalid-uuid';
    const request = new Request(`http://localhost/api/campaigns/${campaignId}/roi`);

    const response = await loader({ request, params: { id: campaignId }, context: {} });
    expect(response.status).toBe(400);
  });

  it('should handle campaigns with zero cost (roi = null)', async () => {
    // Test edge case: totalCost = 0
    // ROI should be null (division by zero)
  });
});
```

### テスト実行環境

- **Docker内で実行**: `docker compose exec core pnpm test campaigns.test`
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
- 不正なテナントIDアクセスは403 Forbiddenを返す

### 2. 入力バリデーション

**クエリパラメータ**:
- `limit`: 最大100に制限（DoS攻撃防止）
- `offset`: 負の値を拒否
- `campaignId`: UUID形式を検証

**リクエストボディ**:
- JSONパース前にContent-Typeを検証
- Zodスキーマで全フィールドを検証
- 不正なデータは400 Bad Requestを返す

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

- [ ] `app/routes/api/campaigns.ts`ファイル作成
- [ ] GET /api/campaigns 実装（一覧取得）
- [ ] POST /api/campaigns 実装（新規作成）
- [ ] `app/routes/api/campaigns.$id.ts`ファイル作成
- [ ] GET /api/campaigns/:id 実装（詳細取得）
- [ ] PUT /api/campaigns/:id 実装（更新）
- [ ] DELETE /api/campaigns/:id 実装（削除）
- [ ] `app/routes/api/campaigns.$id.roi.ts`ファイル作成
- [ ] GET /api/campaigns/:id/roi 実装（ROI取得）
- [ ] エラーハンドリング実装（400, 401, 404, 409, 500）
- [ ] 統合テストファイル作成（`app/routes/api/campaigns.test.ts`, `app/routes/api/campaigns.$id.test.ts`）
- [ ] GET一覧取得のテスト（ページネーション、フィルタ、ソート）
- [ ] POST作成のテスト（正常系・異常系）
- [ ] GET詳細取得のテスト（正常系・異常系）
- [ ] PUT更新のテスト（正常系・異常系・部分更新）
- [ ] DELETE削除のテスト（正常系・異常系・CASCADE削除）
- [ ] GET ROI取得のテスト（正常系・異常系）
- [ ] 認証・認可のテスト（401）
- [ ] 全テストが成功（`pnpm test`）
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] Lintエラーなし（`pnpm lint`）

---

## 実装ガイドライン

### 参考実装

- **Developer API** (`app/routes/api/developers.ts`) - Task 4.2で実装済み（同じパターン）
- **Activity API** (`app/routes/api/activities.ts`) - Task 4.5で実装済み（エラーハンドリングパターン）
- **Campaign Service** (`core/services/campaign.service.ts`) - Task 5.1で実装済み
- **ROI Service** (`core/services/roi.service.ts`) - Task 5.2で実装済み

### コーディング規約

1. **すべてのコードとコメントは英語で記述**
2. **エラーハンドリングは`try-catch`で実装**
3. **型定義は`z.input<>`と`z.infer<>`を明確に区別**
4. **console.errorでエラーログ出力**
5. **`as any`/`as unknown`を使用しない**

### Date型の扱い

```typescript
// Campaign Service accepts ISO strings and coerces to Date
// PostgreSQL stores as date type (YYYY-MM-DD format)
// API response returns ISO string format
const requestBody = {
  startDate: '2025-03-01',  // ISO string
  endDate: '2025-03-03',     // ISO string
};
```

### ROI計算の取り扱い

```typescript
// ROI Service returns CampaignROI type
// totalCost and totalValue are decimal strings (PostgreSQL numeric)
// roi is a number (percentage) or null (if totalCost is 0)
const roiData = await calculateROI(tenantId, campaignId);

// Response:
{
  totalCost: "50000.00",   // decimal string
  totalValue: "75000.00",  // decimal string
  roi: 50.0,               // number (percentage)
  // or
  roi: null,               // if totalCost is 0
}
```

---

## 注意事項

### budgetTotalフィールド

- PostgreSQLの`numeric`型は任意精度の数値型（金額計算に最適）
- JavaScript側では**string**として扱う（精度を保つため）
- 例: `"50000.00"` → PostgreSQL numeric → `"50000.00"`

### attributesフィールド

- JSONB型のカスタム属性
- 用途: UTMパラメータ、担当者、地域、カスタムタグ等
- 例: `{ utm_source: "twitter", location: "Tokyo", owner: "alice" }`

### channelフィールド

- 推奨値: `"event"`, `"ad"`, `"content"`, `"community"`, `"partnership"`, `"other"`
- enumではなくtext型（柔軟性重視）
- フィルタ機能で使用

### ROIの解釈

- **roi > 0**: 正のリターン（成功したキャンペーン）
- **roi = 0**: 損益分岐点
- **roi < 0**: 負のリターン（損失）
- **roi = null**: 計算不可（totalCostが0、ゼロ除算）

---

## 次のタスク

Task 5.4完了後、Phase 5（ROI分析機能実装）が完了します。次はPhase 6（ファネル分析機能実装）に進みます：

- **Task 6.1**: Funnelサービス基盤実装
- **Task 6.2**: ドロップ率計算実装
- **Task 6.3**: Funnel API実装

---

## 参考資料

- [Remix Resource Routes](https://remix.run/docs/en/main/guides/resource-routes)
- [Remix Loader/Action](https://remix.run/docs/en/main/route/loader)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [RESTful API Design Best Practices](https://restfulapi.net/)
- [Campaign Service Documentation](.tmp/tasks/task-5.1-roi-service.md)
- [ROI Calculation Documentation](.tmp/tasks/task-5.2-roi-calculation.md)
