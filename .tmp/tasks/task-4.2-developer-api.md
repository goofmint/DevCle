# Task 4.2: Developer API実装

**タスク番号**: 4.2
**依存タスク**: Task 4.1（DRMサービス基盤実装）
**推定時間**: 3時間
**完了条件**: APIが統合テストでパスする

---

## 概要

Remix Resource RouteによるDeveloper管理APIを実装します。このAPIは、DRMサービス層（Task 4.1で実装）を呼び出し、HTTP層としてリクエスト/レスポンスのハンドリング、エラー処理、認証・認可を担当します。

**Phase 4の位置づけ**:
Task 4.2は、Phase 4のDRMコア機能実装におけるHTTP API層の構築です。Task 4.1で実装したサービス層をRESTful APIとして公開します。

---

## 実装するファイルとインターフェース

### 1. `app/routes/api/developers.ts` - Resource Route

Remix Resource Routeとして、以下のHTTPメソッドを実装します。

```typescript
/**
 * Developer API - Resource Route
 *
 * Provides RESTful API for developer management.
 * Uses DRM Service (Task 4.1) for business logic.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> DRM Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to DRM Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET    /api/developers       - List developers (with pagination, filtering, sorting)
 * - POST   /api/developers       - Create a new developer
 * - GET    /api/developers/:id   - Get a single developer by ID
 * - PUT    /api/developers/:id   - Update a developer
 * - DELETE /api/developers/:id   - Delete a developer
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/core/services/auth.middleware.js';
import { setTenantContext, clearTenantContext } from '~/core/db/connection.js';
import {
  createDeveloper,
  getDeveloper,
  listDevelopers,
  updateDeveloper,
  deleteDeveloper,
  type CreateDeveloperInput,
  type UpdateDeveloperInput,
} from '~/core/services/drm.service.js';
import { z } from 'zod';

/**
 * GET /api/developers - List developers
 *
 * Query Parameters:
 * - limit: Number of records to return (max 100, default 50)
 * - offset: Number of records to skip (default 0)
 * - orgId: Filter by organization ID (optional)
 * - search: Search in display_name and primary_email (optional)
 * - orderBy: Field to sort by ('displayName', 'primaryEmail', 'createdAt', 'updatedAt', default: 'createdAt')
 * - orderDirection: Sort direction ('asc', 'desc', default: 'desc')
 *
 * Response:
 * 200 OK
 * {
 *   developers: [...],
 *   total: 123
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid query parameters
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 *
 * Implementation:
 * 1. Authenticate user using requireAuth() middleware
 * 2. Parse and validate query parameters
 * 3. Set tenant context for RLS
 * 4. Call listDevelopers() from DRM Service
 * 5. Return JSON response
 * 6. Handle errors and return appropriate HTTP status codes
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Implementation will be added in coding phase
  // 1. Authentication/Authorization check using requireAuth()
  //    const user = await requireAuth(request);
  //    const tenantId = user.tenantId;
  // 2. Parse query parameters (limit, offset, orgId, search, orderBy, orderDirection)
  // 3. Set tenant context: await setTenantContext(tenantId)
  // 4. Call service: const result = await listDevelopers(tenantId, params)
  // 5. Clear tenant context: await clearTenantContext()
  // 6. Return: return json(result)
  throw new Error('Not implemented');
}

/**
 * POST /api/developers - Create a new developer
 *
 * Request Body:
 * {
 *   displayName: string,
 *   primaryEmail: string | null,
 *   orgId: string (UUID) | null,
 *   consentAnalytics?: boolean,
 *   tags?: string[]
 * }
 *
 * Response:
 * 201 Created
 * {
 *   developerId: "...",
 *   displayName: "...",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid request body (validation error)
 * - 401 Unauthorized: Missing or invalid authentication
 * - 409 Conflict: Developer with this email already exists
 * - 500 Internal Server Error: Database error
 *
 * Implementation:
 * 1. Authenticate user using requireAuth() middleware
 * 2. Parse and validate request body (JSON)
 * 3. Set tenant context for RLS
 * 4. Call createDeveloper() from DRM Service
 * 5. Return JSON response with 201 status
 * 6. Handle errors (validation, duplicate, database)
 */
export async function action({ request }: ActionFunctionArgs) {
  const method = request.method;

  if (method === 'POST') {
    // Implementation will be added in coding phase
    // 1. Authentication/Authorization check using requireAuth()
    //    const user = await requireAuth(request);
    //    const tenantId = user.tenantId;
    // 2. Parse request body: const data = await request.json()
    // 3. Set tenant context: await setTenantContext(tenantId)
    // 4. Call service: const result = await createDeveloper(tenantId, data)
    // 5. Clear tenant context: await clearTenantContext()
    // 6. Return: return json(result, { status: 201 })
    throw new Error('Not implemented');
  }

  // Method not allowed
  return json({ error: 'Method not allowed' }, { status: 405 });
}
```

### 2. `app/routes/api/developers.$id.ts` - Single Developer Resource Route

個別の開発者に対する操作（GET, PUT, DELETE）を実装します。

```typescript
/**
 * Developer API - Single Resource Route
 *
 * Handles operations on a single developer by ID.
 *
 * Endpoints:
 * - GET    /api/developers/:id - Get developer by ID
 * - PUT    /api/developers/:id - Update developer
 * - DELETE /api/developers/:id - Delete developer
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/core/services/auth.middleware.js';
import { setTenantContext, clearTenantContext } from '~/core/db/connection.js';
import {
  getDeveloper,
  updateDeveloper,
  deleteDeveloper,
  type UpdateDeveloperInput,
} from '~/core/services/drm.service.js';

/**
 * GET /api/developers/:id - Get developer by ID
 *
 * Path Parameters:
 * - id: Developer ID (UUID)
 *
 * Response:
 * 200 OK
 * {
 *   developerId: "...",
 *   displayName: "...",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid developer ID format
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Developer not found
 * - 500 Internal Server Error: Database error
 *
 * Implementation:
 * 1. Authenticate user using requireAuth() middleware
 * 2. Extract developer ID from URL params
 * 3. Validate developer ID (UUID format)
 * 4. Set tenant context for RLS
 * 5. Call getDeveloper() from DRM Service
 * 6. If null, return 404
 * 7. Return JSON response
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  // Implementation will be added in coding phase
  // 1. Authentication/Authorization check using requireAuth()
  //    const user = await requireAuth(request);
  //    const tenantId = user.tenantId;
  // 2. Validate developer ID: const developerId = params.id
  // 3. Set tenant context: await setTenantContext(tenantId)
  // 4. Call service: const result = await getDeveloper(tenantId, developerId)
  // 5. Clear tenant context: await clearTenantContext()
  // 6. If result is null: return json({ error: 'Not found' }, { status: 404 })
  // 7. Return: return json(result)
  throw new Error('Not implemented');
}

/**
 * PUT /api/developers/:id - Update developer
 *
 * Path Parameters:
 * - id: Developer ID (UUID)
 *
 * Request Body (all fields optional):
 * {
 *   displayName?: string,
 *   primaryEmail?: string | null,
 *   orgId?: string (UUID) | null,
 *   consentAnalytics?: boolean,
 *   tags?: string[]
 * }
 *
 * Response:
 * 200 OK
 * {
 *   developerId: "...",
 *   displayName: "...",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid request body or developer ID
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Developer not found
 * - 500 Internal Server Error: Database error
 *
 * Implementation:
 * 1. Authenticate user using requireAuth() middleware
 * 2. Extract developer ID from URL params
 * 3. Parse and validate request body (JSON)
 * 4. Set tenant context for RLS
 * 5. Call updateDeveloper() from DRM Service
 * 6. If null, return 404
 * 7. Return JSON response
 */
export async function action({ params, request }: ActionFunctionArgs) {
  const method = request.method;

  if (method === 'PUT') {
    // Implementation will be added in coding phase
    // 1. Authentication/Authorization check using requireAuth()
    //    const user = await requireAuth(request);
    //    const tenantId = user.tenantId;
    // 2. Validate developer ID: const developerId = params.id
    // 3. Parse request body: const data = await request.json()
    // 4. Set tenant context: await setTenantContext(tenantId)
    // 5. Call service: const result = await updateDeveloper(tenantId, developerId, data)
    // 6. Clear tenant context: await clearTenantContext()
    // 7. If result is null: return json({ error: 'Not found' }, { status: 404 })
    // 8. Return: return json(result)
    throw new Error('Not implemented');
  }

  if (method === 'DELETE') {
    // Implementation will be added in coding phase
    // See DELETE endpoint documentation below
    throw new Error('Not implemented');
  }

  // Method not allowed
  return json({ error: 'Method not allowed' }, { status: 405 });
}

/**
 * DELETE /api/developers/:id - Delete developer
 *
 * Path Parameters:
 * - id: Developer ID (UUID)
 *
 * Response:
 * 204 No Content (on success)
 *
 * Error Responses:
 * - 400 Bad Request: Invalid developer ID format
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Developer not found
 * - 500 Internal Server Error: Database error
 *
 * Implementation:
 * 1. Authenticate user using requireAuth() middleware
 * 2. Extract developer ID from URL params
 * 3. Validate developer ID (UUID format)
 * 4. Set tenant context for RLS
 * 5. Call deleteDeveloper() from DRM Service
 * 6. If false (not found), return 404
 * 7. Return 204 No Content (no body)
 *
 * Implementation in action() method above:
 * // if (method === 'DELETE') {
 * //   const user = await requireAuth(request);
 * //   const tenantId = user.tenantId;
 * //   const developerId = params.id;
 * //   await setTenantContext(tenantId);
 * //   const result = await deleteDeveloper(tenantId, developerId);
 * //   await clearTenantContext();
 * //   if (!result) {
 * //     return json({ error: 'Not found' }, { status: 404 });
 * //   }
 * //   return new Response(null, { status: 204 });
 * // }
 *
 * Note: This is a HARD DELETE. Consider soft delete for GDPR compliance.
 */
```

---

## アーキテクチャ層の責務

### HTTP層（Resource Route - Task 4.2 本タスク）

**責務**:
- HTTPリクエストの受付とパース
- 認証・認可チェック
- セッションからテナントIDを取得
- テナントコンテキストの設定（RLS有効化）
- サービス層の呼び出し
- HTTPレスポンスのシリアライズ（JSON）
- エラーハンドリング（HTTPステータスコード）
- テナントコンテキストのクリーンアップ

**実装しないこと**:
- ビジネスロジック（サービス層が担当）
- データベース操作（Drizzle ORMが担当）
- バリデーションロジック（Zodスキーマが担当）

### サービス層（DRM Service - Task 4.1で実装済み）

**責務**:
- 入力データのバリデーション（Zod）
- ビジネスロジックの実装
- データベース操作の抽象化
- エラーメッセージの生成

---

## エンドポイント一覧

| HTTPメソッド | エンドポイント | 説明 | 実装ファイル |
|------------|--------------|------|------------|
| GET | `/api/developers` | 開発者一覧取得（ページネーション、フィルタ、ソート） | `app/routes/api/developers.ts` |
| POST | `/api/developers` | 新規開発者作成 | `app/routes/api/developers.ts` |
| GET | `/api/developers/:id` | 開発者詳細取得 | `app/routes/api/developers.$id.ts` |
| PUT | `/api/developers/:id` | 開発者情報更新 | `app/routes/api/developers.$id.ts` |
| DELETE | `/api/developers/:id` | 開発者削除 | `app/routes/api/developers.$id.ts` |

---

## リクエスト/レスポンス仕様

### 1. GET /api/developers - 一覧取得

**クエリパラメータ**:
```typescript
{
  limit?: number;        // max 100, default 50
  offset?: number;       // default 0
  orgId?: string;        // UUID
  search?: string;       // search in displayName and primaryEmail
  orderBy?: 'displayName' | 'primaryEmail' | 'createdAt' | 'updatedAt'; // default 'createdAt'
  orderDirection?: 'asc' | 'desc'; // default 'desc'
}
```

**レスポンス（200 OK）**:
```json
{
  "developers": [
    {
      "developerId": "10000000-0000-4000-8000-000000000001",
      "tenantId": "default",
      "displayName": "Alice Anderson",
      "primaryEmail": "alice@example.com",
      "orgId": "20000000-0000-4000-8000-000000000001",
      "consentAnalytics": true,
      "tags": ["backend", "python"],
      "createdAt": "2025-10-13T00:00:00.000Z",
      "updatedAt": "2025-10-13T00:00:00.000Z"
    }
  ],
  "total": 123
}
```

**エラーレスポンス**:
```json
// 400 Bad Request
{
  "error": "Invalid query parameters",
  "details": {
    "limit": ["Must be a positive integer"]
  }
}

// 500 Internal Server Error
{
  "error": "Failed to fetch developers"
}
```

### 2. POST /api/developers - 新規作成

**リクエストボディ**:
```json
{
  "displayName": "Bob Builder",
  "primaryEmail": "bob@example.com",
  "orgId": "20000000-0000-4000-8000-000000000001",
  "consentAnalytics": true,
  "tags": ["frontend", "react"]
}
```

**レスポンス（201 Created）**:
```json
{
  "developerId": "10000000-0000-4000-8000-000000000002",
  "tenantId": "default",
  "displayName": "Bob Builder",
  "primaryEmail": "bob@example.com",
  "orgId": "20000000-0000-4000-8000-000000000001",
  "consentAnalytics": true,
  "tags": ["frontend", "react"],
  "createdAt": "2025-10-13T00:00:00.000Z",
  "updatedAt": "2025-10-13T00:00:00.000Z"
}
```

**エラーレスポンス**:
```json
// 400 Bad Request
{
  "error": "Validation failed",
  "details": {
    "primaryEmail": ["Invalid email format"]
  }
}

// 409 Conflict
{
  "error": "Developer with this email already exists"
}
```

### 3. GET /api/developers/:id - 詳細取得

**パスパラメータ**:
- `id`: Developer ID (UUID)

**レスポンス（200 OK）**:
```json
{
  "developerId": "10000000-0000-4000-8000-000000000001",
  "tenantId": "default",
  "displayName": "Alice Anderson",
  "primaryEmail": "alice@example.com",
  "orgId": "20000000-0000-4000-8000-000000000001",
  "consentAnalytics": true,
  "tags": ["backend", "python"],
  "createdAt": "2025-10-13T00:00:00.000Z",
  "updatedAt": "2025-10-13T00:00:00.000Z"
}
```

**エラーレスポンス**:
```json
// 404 Not Found
{
  "error": "Developer not found"
}

// 400 Bad Request
{
  "error": "Invalid developer ID format"
}
```

### 4. PUT /api/developers/:id - 更新

**パスパラメータ**:
- `id`: Developer ID (UUID)

**リクエストボディ（部分更新対応）**:
```json
{
  "displayName": "Alice Anderson (Updated)",
  "tags": ["backend", "python", "go"]
}
```

**レスポンス（200 OK）**:
```json
{
  "developerId": "10000000-0000-4000-8000-000000000001",
  "tenantId": "default",
  "displayName": "Alice Anderson (Updated)",
  "primaryEmail": "alice@example.com",
  "orgId": "20000000-0000-4000-8000-000000000001",
  "consentAnalytics": true,
  "tags": ["backend", "python", "go"],
  "createdAt": "2025-10-13T00:00:00.000Z",
  "updatedAt": "2025-10-13T12:00:00.000Z"
}
```

**エラーレスポンス**:
```json
// 404 Not Found
{
  "error": "Developer not found"
}

// 400 Bad Request
{
  "error": "Validation failed",
  "details": {
    "primaryEmail": ["Invalid email format"]
  }
}
```

### 5. DELETE /api/developers/:id - 削除

**パスパラメータ**:
- `id`: Developer ID (UUID)

**レスポンス（204 No Content）**:
```
(レスポンスボディなし)
```

**エラーレスポンス**:
```json
// 404 Not Found
{
  "error": "Developer not found"
}

// 400 Bad Request
{
  "error": "Invalid developer ID format"
}
```

---

## エラーハンドリング

### HTTPステータスコード

| ステータスコード | 意味 | 使用ケース |
|---------------|------|----------|
| 200 OK | 成功（GET, PUT） | 開発者情報の取得・更新成功 |
| 201 Created | 作成成功（POST） | 新規開発者作成成功 |
| 204 No Content | 削除成功（DELETE） | 開発者削除成功 |
| 400 Bad Request | 不正なリクエスト | バリデーションエラー、不正なパラメータ |
| 401 Unauthorized | 認証エラー | 認証トークンがない、無効 |
| 403 Forbidden | 認可エラー | テナントIDが不正、RLS違反 |
| 404 Not Found | リソースが見つからない | 開発者が存在しない |
| 405 Method Not Allowed | 許可されていないメソッド | 未実装のHTTPメソッド |
| 409 Conflict | 競合エラー | メールアドレス重複 |
| 500 Internal Server Error | サーバーエラー | データベース接続エラー |

### エラーレスポンス形式

**統一されたエラーレスポンス**:
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
    // 1. Authentication check using requireAuth middleware
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Parse query parameters
    const url = new URL(request.url);
    const params = {
      limit: Number(url.searchParams.get('limit') || 50),
      offset: Number(url.searchParams.get('offset') || 0),
      orgId: url.searchParams.get('orgId') || undefined,
      search: url.searchParams.get('search') || undefined,
      orderBy: url.searchParams.get('orderBy') || 'createdAt',
      orderDirection: url.searchParams.get('orderDirection') || 'desc',
    };

    // 3. Set tenant context for RLS
    await setTenantContext(tenantId);

    // 4. Call service
    const result = await listDevelopers(tenantId, params);

    // 5. Clear tenant context
    await clearTenantContext();

    // 6. Return success response
    return json(result);
  } catch (error) {
    // 7. Handle errors
    await clearTenantContext(); // Ensure cleanup

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
      if (error.message.includes('duplicate key')) {
        return json({ error: 'Conflict' }, { status: 409 });
      }
      if (error.message.includes('not found')) {
        return json({ error: 'Not found' }, { status: 404 });
      }
    }

    // Generic error
    console.error('Failed to list developers:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

## 認証・認可

### セッション管理

開発者APIは、認証済みユーザーのみがアクセス可能です。

**実装方針**:
1. Task 3.8で実装した`requireAuth()`ミドルウェアを使用
2. `requireAuth()`がユーザー情報（userId, tenantId, email, role）を返す
3. 未認証の場合は自動的に`/auth/login`にリダイレクト

```typescript
import { requireAuth } from '~/core/services/auth.middleware.js';

export async function loader({ request }: LoaderFunctionArgs) {
  // 1. Require authentication (throws redirect if not authenticated)
  const user = await requireAuth(request);

  // 2. Extract tenant ID from authenticated user
  const tenantId = user.tenantId;

  // ... proceed with authenticated request
}
```

**認証エラーハンドリング**:
- `requireAuth()`は未認証時に`throw redirect('/auth/login?returnTo=...')` を実行
- API routesでは、リダイレクトの代わりに401 Unauthorizedを返したい場合は、`try-catch`で処理

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // ... API処理
  } catch (error) {
    // requireAuth()のredirectをキャッチして401を返す（API用）
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error; // その他のエラーは再throw
  }
}
```

### Row Level Security (RLS)

全ての開発者データアクセスは、PostgreSQLのRLSにより自動的にテナント分離されます。

**重要**: APIハンドラーでサービス層を呼び出す前に、必ず`setTenantContext(tenantId)`を実行してください。

```typescript
// Set tenant context before service call
await setTenantContext(tenantId);

// Call service (RLS is automatically applied)
const result = await listDevelopers(tenantId, params);

// Clear tenant context after service call
await clearTenantContext();
```

---

## テスト方針

### 統合テスト（`app/routes/api/developers.test.ts`）

Task 4.2の完了条件は「APIが統合テストでパスする」ことです。以下のテストケースを実装します。

#### 1. GET /api/developers - 一覧取得テスト

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('GET /api/developers', () => {
  it('should return developers list with default pagination', async () => {
    // Arrange: Prepare authenticated request
    const request = new Request('http://localhost/api/developers', {
      headers: {
        Cookie: 'session=...' // authenticated session
      }
    });

    // Act: Call loader
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // Assert: Verify response
    expect(response.status).toBe(200);
    expect(data.developers).toBeInstanceOf(Array);
    expect(data.total).toBeGreaterThan(0);
  });

  it('should respect limit and offset parameters', async () => {
    // Test pagination
    const request = new Request('http://localhost/api/developers?limit=10&offset=5');
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(data.developers.length).toBeLessThanOrEqual(10);
  });

  it('should filter by orgId', async () => {
    // Test orgId filter
    const orgId = '20000000-0000-4000-8000-000000000001';
    const request = new Request(`http://localhost/api/developers?orgId=${orgId}`);
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // All returned developers should belong to the specified org
    data.developers.forEach((dev) => {
      expect(dev.orgId).toBe(orgId);
    });
  });

  it('should search by displayName', async () => {
    // Test search functionality
    const request = new Request('http://localhost/api/developers?search=alice');
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // At least one developer should match the search term
    expect(data.developers.length).toBeGreaterThan(0);
  });

  it('should sort by displayName ascending', async () => {
    // Test sorting
    const request = new Request('http://localhost/api/developers?orderBy=displayName&orderDirection=asc');
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // Verify sort order
    for (let i = 0; i < data.developers.length - 1; i++) {
      expect(data.developers[i].displayName <= data.developers[i + 1].displayName).toBe(true);
    }
  });

  it('should return 401 for unauthenticated requests', async () => {
    // Arrange: Request without session
    const request = new Request('http://localhost/api/developers');

    // Act & Assert: Expect 401
    const response = await loader({ request, params: {}, context: {} });
    expect(response.status).toBe(401);
  });
});
```

#### 2. POST /api/developers - 作成テスト

```typescript
describe('POST /api/developers', () => {
  it('should create a new developer', async () => {
    // Arrange: Prepare request with valid data
    const requestBody = {
      displayName: 'Test Developer',
      primaryEmail: 'test@example.com',
      orgId: '20000000-0000-4000-8000-000000000001',
      consentAnalytics: true,
      tags: ['test'],
    };

    const request = new Request('http://localhost/api/developers', {
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

    // Assert: Verify created developer
    expect(response.status).toBe(201);
    expect(data.displayName).toBe('Test Developer');
    expect(data.primaryEmail).toBe('test@example.com');
    expect(data.developerId).toBeDefined();
  });

  it('should return 400 for invalid email', async () => {
    // Arrange: Invalid email format
    const requestBody = {
      displayName: 'Test',
      primaryEmail: 'invalid-email',
      orgId: null,
      consentAnalytics: false,
      tags: [],
    };

    const request = new Request('http://localhost/api/developers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // Act & Assert: Expect validation error
    const response = await action({ request, params: {}, context: {} });
    expect(response.status).toBe(400);
  });

  it('should return 409 for duplicate email', async () => {
    // Test duplicate email constraint
  });
});
```

#### 3. GET /api/developers/:id - 詳細取得テスト

```typescript
describe('GET /api/developers/:id', () => {
  it('should return developer by ID', async () => {
    // Arrange: Use known developer ID
    const developerId = '10000000-0000-4000-8000-000000000001';
    const request = new Request(`http://localhost/api/developers/${developerId}`);

    // Act: Call loader
    const response = await loader({ request, params: { id: developerId }, context: {} });
    const data = await response.json();

    // Assert: Verify returned developer
    expect(response.status).toBe(200);
    expect(data.developerId).toBe(developerId);
  });

  it('should return 404 for non-existent ID', async () => {
    // Arrange: Use non-existent UUID
    const developerId = '99999999-9999-4999-8999-999999999999';
    const request = new Request(`http://localhost/api/developers/${developerId}`);

    // Act & Assert: Expect 404
    const response = await loader({ request, params: { id: developerId }, context: {} });
    expect(response.status).toBe(404);
  });

  it('should return 400 for invalid UUID format', async () => {
    // Test invalid UUID format
    const developerId = 'invalid-uuid';
    const request = new Request(`http://localhost/api/developers/${developerId}`);

    const response = await loader({ request, params: { id: developerId }, context: {} });
    expect(response.status).toBe(400);
  });
});
```

#### 4. PUT /api/developers/:id - 更新テスト

```typescript
describe('PUT /api/developers/:id', () => {
  it('should update developer', async () => {
    // Arrange: Prepare update data
    const developerId = '10000000-0000-4000-8000-000000000001';
    const updateData = {
      displayName: 'Updated Name',
      tags: ['updated'],
    };

    const request = new Request(`http://localhost/api/developers/${developerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });

    // Act: Call action
    const response = await action({ request, params: { id: developerId }, context: {} });
    const data = await response.json();

    // Assert: Verify updated data
    expect(response.status).toBe(200);
    expect(data.displayName).toBe('Updated Name');
    expect(data.tags).toEqual(['updated']);
  });

  it('should return 404 for non-existent developer', async () => {
    // Test update on non-existent developer
  });

  it('should support partial updates', async () => {
    // Test updating only specific fields
  });
});
```

#### 5. DELETE /api/developers/:id - 削除テスト

```typescript
describe('DELETE /api/developers/:id', () => {
  it('should delete developer', async () => {
    // Arrange: Create a developer to delete
    const created = await createDeveloper('default', {
      displayName: 'To Delete',
      primaryEmail: 'delete@example.com',
      orgId: null,
      consentAnalytics: false,
      tags: [],
    });

    const request = new Request(`http://localhost/api/developers/${created.developerId}`, {
      method: 'DELETE',
    });

    // Act: Call action
    const response = await action({ request, params: { id: created.developerId }, context: {} });

    // Assert: Verify deletion
    expect(response.status).toBe(204);

    // Verify developer no longer exists
    const getResponse = await getDeveloper('default', created.developerId);
    expect(getResponse).toBeNull();
  });

  it('should return 404 for non-existent developer', async () => {
    // Test deletion of non-existent developer
    const developerId = '99999999-9999-4999-8999-999999999999';
    const request = new Request(`http://localhost/api/developers/${developerId}`, {
      method: 'DELETE',
    });

    const response = await action({ request, params: { id: developerId }, context: {} });
    expect(response.status).toBe(404);
  });
});
```

### テスト環境セットアップ

```typescript
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { setTenantContext, clearTenantContext, closeDb } from '~/db/connection';

describe('Developer API', () => {
  beforeAll(async () => {
    // Set tenant context for all tests
    await setTenantContext('default');
  });

  afterAll(async () => {
    // Clean up
    await clearTenantContext();
    await closeDb();
  });

  beforeEach(async () => {
    // Optional: Clean up test data before each test
  });
});
```

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
- `orgId`, `developerId`: UUID形式を検証

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

### 4. Rate Limiting（将来実装）

**DoS攻撃対策**:
- APIエンドポイントごとにレート制限を設定
- 429 Too Many Requestsを返す
- Redis等を使用してカウンター管理

---

## OpenAPI仕様生成

### 概要

`@asteasolutions/zod-to-openapi` ライブラリを使用して、既存のZodスキーマからOpenAPI 3.x仕様を自動生成します。これにより、API仕様の一貫性を保ちながら、Swagger UIなどでのドキュメント生成が可能になります。

### 依存パッケージのインストール

```bash
pnpm add @asteasolutions/zod-to-openapi
```

### 実装方針

1. **Zodスキーマの拡張**: 既存のスキーマに`.openapi()`メソッドでメタデータを追加
2. **OpenAPIレジストリの設定**: エンドポイント情報をレジストリに登録
3. **仕様ドキュメント生成**: `/api/openapi.json`エンドポイントで公開

### Zodスキーマの拡張

`core/services/drm.service.ts`のスキーマに`.openapi()`メタデータを追加します。

```typescript
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Zodの拡張（ファイルの最初で一度だけ実行）
extendZodWithOpenApi(z);

/**
 * Developer creation schema with OpenAPI metadata
 */
export const CreateDeveloperSchema = z
  .object({
    displayName: z
      .string()
      .min(1)
      .max(255)
      .openapi({
        example: 'Alice Anderson',
        description: 'Display name of the developer',
      }),
    primaryEmail: z
      .string()
      .email()
      .nullable()
      .openapi({
        example: 'alice@example.com',
        description: 'Primary email address (null if not available)',
      }),
    orgId: z
      .string()
      .uuid()
      .nullable()
      .openapi({
        example: '20000000-0000-4000-8000-000000000001',
        description: 'Organization ID (UUID)',
      }),
    consentAnalytics: z
      .boolean()
      .default(false)
      .openapi({
        example: true,
        description: 'Whether the developer consented to analytics tracking',
      }),
    tags: z
      .array(z.string())
      .default([])
      .openapi({
        example: ['backend', 'python'],
        description: 'Tags associated with the developer',
      }),
  })
  .openapi('CreateDeveloperInput');

/**
 * Developer response schema with OpenAPI metadata
 */
export const DeveloperSchema = z
  .object({
    developerId: z
      .string()
      .uuid()
      .openapi({
        example: '10000000-0000-4000-8000-000000000001',
        description: 'Unique developer ID',
      }),
    tenantId: z
      .string()
      .openapi({
        example: 'default',
        description: 'Tenant ID for multi-tenant isolation',
      }),
    displayName: z.string().openapi({ example: 'Alice Anderson' }),
    primaryEmail: z.string().email().nullable().openapi({ example: 'alice@example.com' }),
    orgId: z.string().uuid().nullable().openapi({ example: '20000000-0000-4000-8000-000000000001' }),
    consentAnalytics: z.boolean().openapi({ example: true }),
    tags: z.array(z.string()).openapi({ example: ['backend', 'python'] }),
    createdAt: z
      .string()
      .datetime()
      .openapi({
        example: '2025-10-13T00:00:00.000Z',
        description: 'Creation timestamp',
      }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({
        example: '2025-10-13T00:00:00.000Z',
        description: 'Last update timestamp',
      }),
  })
  .openapi('Developer');

/**
 * List developers query parameters schema with OpenAPI metadata
 */
export const ListDevelopersSchema = z
  .object({
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .default(50)
      .openapi({
        example: 50,
        description: 'Number of records to return (max 100)',
      }),
    offset: z
      .number()
      .int()
      .nonnegative()
      .default(0)
      .openapi({
        example: 0,
        description: 'Number of records to skip',
      }),
    orgId: z
      .string()
      .uuid()
      .optional()
      .openapi({
        example: '20000000-0000-4000-8000-000000000001',
        description: 'Filter by organization ID',
      }),
    search: z
      .string()
      .optional()
      .openapi({
        example: 'alice',
        description: 'Search in displayName and primaryEmail',
      }),
    orderBy: z
      .enum(['displayName', 'primaryEmail', 'createdAt', 'updatedAt'])
      .default('createdAt')
      .openapi({
        example: 'createdAt',
        description: 'Field to sort by',
      }),
    orderDirection: z
      .enum(['asc', 'desc'])
      .default('desc')
      .openapi({
        example: 'desc',
        description: 'Sort direction',
      }),
  })
  .openapi('ListDevelopersParams');

/**
 * Update developer schema with OpenAPI metadata
 */
export const UpdateDeveloperSchema = z
  .object({
    displayName: z.string().min(1).max(255).optional().openapi({ example: 'Alice Anderson (Updated)' }),
    primaryEmail: z.string().email().nullable().optional().openapi({ example: 'alice.new@example.com' }),
    orgId: z.string().uuid().nullable().optional().openapi({ example: '20000000-0000-4000-8000-000000000002' }),
    consentAnalytics: z.boolean().optional().openapi({ example: false }),
    tags: z.array(z.string()).optional().openapi({ example: ['backend', 'python', 'go'] }),
  })
  .openapi('UpdateDeveloperInput');
```

### OpenAPIレジストリの設定

`app/routes/api/openapi-registry.ts`を作成し、全エンドポイントを登録します。

```typescript
/**
 * OpenAPI Registry - Developer API
 *
 * Registers all Developer API endpoints for OpenAPI documentation generation.
 */

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  CreateDeveloperSchema,
  DeveloperSchema,
  ListDevelopersSchema,
  UpdateDeveloperSchema,
} from '~/core/services/drm.service.js';

export const registry = new OpenAPIRegistry();

/**
 * Error response schema
 */
const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: 'Error message' }),
    details: z
      .record(z.array(z.string()))
      .optional()
      .openapi({
        example: { email: ['Invalid email format'] },
        description: 'Field-level error details',
      }),
  })
  .openapi('ErrorResponse');

/**
 * List response schema
 */
const ListDevelopersResponseSchema = z
  .object({
    developers: z.array(DeveloperSchema),
    total: z.number().int().openapi({ example: 123, description: 'Total count of developers' }),
  })
  .openapi('ListDevelopersResponse');

// Register GET /api/developers - List developers
registry.registerPath({
  method: 'get',
  path: '/api/developers',
  summary: 'List developers',
  description: 'Retrieve a paginated list of developers with optional filtering and sorting',
  tags: ['Developers'],
  request: {
    query: ListDevelopersSchema,
  },
  responses: {
    200: {
      description: 'Successful response with developers list',
      content: {
        'application/json': {
          schema: ListDevelopersResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid query parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - Missing or invalid authentication',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// Register POST /api/developers - Create developer
registry.registerPath({
  method: 'post',
  path: '/api/developers',
  summary: 'Create a new developer',
  description: 'Create a new developer record',
  tags: ['Developers'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateDeveloperSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Developer created successfully',
      content: {
        'application/json': {
          schema: DeveloperSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Conflict - Developer with this email already exists',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// Register GET /api/developers/:id - Get developer by ID
registry.registerPath({
  method: 'get',
  path: '/api/developers/{id}',
  summary: 'Get developer by ID',
  description: 'Retrieve a single developer by their unique ID',
  tags: ['Developers'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        example: '10000000-0000-4000-8000-000000000001',
        description: 'Developer ID',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Successful response with developer data',
      content: {
        'application/json': {
          schema: DeveloperSchema,
        },
      },
    },
    400: {
      description: 'Invalid developer ID format',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Developer not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// Register PUT /api/developers/:id - Update developer
registry.registerPath({
  method: 'put',
  path: '/api/developers/{id}',
  summary: 'Update developer',
  description: 'Update an existing developer (partial update supported)',
  tags: ['Developers'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        example: '10000000-0000-4000-8000-000000000001',
        description: 'Developer ID',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateDeveloperSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Developer updated successfully',
      content: {
        'application/json': {
          schema: DeveloperSchema,
        },
      },
    },
    400: {
      description: 'Validation error or invalid developer ID',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Developer not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// Register DELETE /api/developers/:id - Delete developer
registry.registerPath({
  method: 'delete',
  path: '/api/developers/{id}',
  summary: 'Delete developer',
  description: 'Delete a developer (hard delete)',
  tags: ['Developers'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        example: '10000000-0000-4000-8000-000000000001',
        description: 'Developer ID',
      }),
    }),
  },
  responses: {
    204: {
      description: 'Developer deleted successfully (no content)',
    },
    400: {
      description: 'Invalid developer ID format',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Developer not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});
```

### OpenAPI仕様ドキュメント公開エンドポイント

`app/routes/api/openapi.json.ts`を作成し、生成したOpenAPI仕様を公開します。

```typescript
/**
 * OpenAPI Specification Endpoint
 *
 * Generates and serves OpenAPI 3.x specification for the Developer API.
 * Accessible at: /api/openapi.json
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './openapi-registry.js';

export async function loader({ request }: LoaderFunctionArgs) {
  // Generate OpenAPI document
  const generator = new OpenApiGeneratorV3(registry.definitions);

  const document = generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'DevCle Developer API',
      version: '1.0.0',
      description: 'Developer Relationship Management API',
      contact: {
        name: 'DevCle Support',
        url: 'https://devcle.com',
      },
    },
    servers: [
      {
        url: 'https://api.devcle.com',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [
      {
        name: 'Developers',
        description: 'Developer management endpoints',
      },
    ],
  });

  // Return OpenAPI document as JSON
  return json(document, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
```

### Swagger UIの統合（オプション）

Swagger UIを統合する場合は、`app/routes/api/docs.tsx`を作成します。

```typescript
/**
 * Swagger UI Page
 *
 * Displays interactive API documentation using Swagger UI.
 * Accessible at: /api/docs
 */

export default function ApiDocs() {
  return (
    <html>
      <head>
        <title>DevCle API Documentation</title>
        <link
          rel="stylesheet"
          href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
        />
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.onload = () => {
                window.ui = SwaggerUIBundle({
                  url: '/api/openapi.json',
                  dom_id: '#swagger-ui',
                });
              };
            `,
          }}
        />
      </body>
    </html>
  );
}
```

### 利点

1. **自動生成**: Zodスキーマから自動的にOpenAPI仕様を生成
2. **一貫性**: スキーマとドキュメントが常に同期
3. **型安全**: TypeScriptの型とランタイムバリデーションが一致
4. **開発者体験**: Swagger UIで対話的にAPIをテスト可能
5. **クライアント生成**: OpenAPI仕様から各言語のクライアントSDKを生成可能

### 参考資料

- [@asteasolutions/zod-to-openapi](https://github.com/asteasolutions/zod-to-openapi)
- [OpenAPI Specification 3.0](https://swagger.io/specification/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)

---

## 完了チェックリスト

- [ ] `app/routes/api/developers.ts`ファイル作成
- [ ] GET /api/developers 実装（一覧取得）
- [ ] POST /api/developers 実装（新規作成）
- [ ] `app/routes/api/developers.$id.ts`ファイル作成
- [ ] GET /api/developers/:id 実装（詳細取得）
- [ ] PUT /api/developers/:id 実装（更新）
- [ ] DELETE /api/developers/:id 実装（削除）
- [ ] エラーハンドリング実装（400, 401, 404, 409, 500）
- [ ] 統合テストファイル作成（`app/routes/api/developers.test.ts`）
- [ ] GET一覧取得のテスト（ページネーション、フィルタ、ソート）
- [ ] POST作成のテスト（正常系・異常系）
- [ ] GET詳細取得のテスト（正常系・異常系）
- [ ] PUT更新のテスト（正常系・異常系）
- [ ] DELETE削除のテスト（正常系・異常系）
- [ ] 認証・認可のテスト（401, 403）
- [ ] 全テストが成功（`pnpm test`）
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] Lintエラーなし（`pnpm lint`）
- [ ] **OpenAPI仕様生成（オプション）**
  - [ ] `@asteasolutions/zod-to-openapi`パッケージインストール
  - [ ] Zodスキーマに`.openapi()`メタデータ追加
  - [ ] `app/routes/api/openapi-registry.ts`作成
  - [ ] `app/routes/api/openapi.json.ts`作成
  - [ ] `app/routes/api/docs.tsx`作成（Swagger UI統合）
  - [ ] `/api/openapi.json`でOpenAPI仕様が取得できる
  - [ ] `/api/docs`でSwagger UIが表示される

---

## 次のタスク

Task 4.2完了後、以下のタスクに進みます：

- **Task 4.3**: ID統合機能実装（`resolveDeveloper`, `mergeDevelopers`）
- **Task 4.4**: Activityサービス実装
- **Task 4.5**: Activity API実装

---

## 参考資料

- [Remix Resource Routes](https://remix.run/docs/en/main/guides/resource-routes)
- [Remix Loader/Action](https://remix.run/docs/en/main/route/loader)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [RESTful API Design Best Practices](https://restfulapi.net/)
- [@asteasolutions/zod-to-openapi](https://github.com/asteasolutions/zod-to-openapi) - OpenAPI生成ライブラリ
- [OpenAPI Specification 3.0](https://swagger.io/specification/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
