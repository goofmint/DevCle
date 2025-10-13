# Task 4.5: Activity API実装

**タスク番号**: 4.5
**依存タスク**: Task 3.8（認証システム実装）、Task 4.4（Activityサービス実装）
**推定時間**: 2時間
**完了条件**: APIが統合テストでパスする

---

## 概要

Remix Resource RouteによるActivity管理APIを実装します。このAPIは、Activity Service層（Task 4.4で実装済み）を呼び出し、HTTP層としてリクエスト/レスポンスのハンドリング、エラー処理、認証・認可を担当します。

**Phase 4の位置づけ**:
Task 4.5は、Phase 4のDRMコア機能実装におけるHTTP API層の構築です。Task 4.4で実装したActivity Service層をRESTful APIとして公開します。

**Activityの特性**:
- **イベントログ**: Activityはイベントソーシング原則に基づく不変なイベントログです
- **時系列データ**: 開発者のアクション履歴を時系列で記録します
- **更新・削除は稀**: イベントログの性質上、更新・削除は極めて稀です（データ修正、GDPR対応時のみ）
- **重複排除**: dedupKeyによる重複防止機能を提供します

---

## 実装するファイルとインターフェース

### 1. `app/routes/api/activities.ts` - Resource Route

Remix Resource Routeとして、以下のHTTPメソッドを実装します。

```typescript
/**
 * Activity API - Resource Route
 *
 * Provides RESTful API for activity management.
 * Uses Activity Service (Task 4.4) for business logic.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Activity Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to Activity Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET    /api/activities       - List activities (with pagination, filtering, sorting)
 * - POST   /api/activities       - Create a new activity
 * - GET    /api/activities/:id   - Get a single activity by ID
 * - PUT    /api/activities/:id   - Update an activity (rare - only for data correction)
 * - DELETE /api/activities/:id   - Delete an activity (rare - GDPR compliance)
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import {
  createActivity,
  getActivity,
  listActivities,
  updateActivity,
  deleteActivity,
  type CreateActivityInput,
  type ListActivitiesInput,
  type UpdateActivityInput,
} from '~/services/activity.service.js';
import { z } from 'zod';

/**
 * GET /api/activities - List activities
 *
 * Query Parameters:
 * - limit: Number of records to return (max 1000, default 100)
 * - offset: Number of records to skip (default 0)
 * - developerId: Filter by developer ID (UUID, optional)
 * - accountId: Filter by account ID (UUID, optional)
 * - resourceId: Filter by resource ID (UUID, optional)
 * - action: Filter by action type (string, optional)
 * - source: Filter by data source (string, optional)
 * - fromDate: Filter by occurred_at >= fromDate (ISO 8601 string, optional)
 * - toDate: Filter by occurred_at <= toDate (ISO 8601 string, optional)
 * - orderBy: Field to sort by ('occurred_at', 'recorded_at', 'ingested_at', default: 'occurred_at')
 * - orderDirection: Sort direction ('asc', 'desc', default: 'desc')
 *
 * Response:
 * 200 OK
 * {
 *   activities: [...],
 *   total: 123
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid query parameters (e.g., invalid date format, fromDate > toDate)
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 *
 * Implementation:
 * 1. Authenticate user using requireAuth() middleware
 * 2. Parse and validate query parameters (URL search params)
 * 3. Convert date strings to Date objects for fromDate/toDate
 * 4. Call listActivities() from Activity Service
 * 5. Return JSON response
 * 6. Handle errors and return appropriate HTTP status codes
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Implementation will be added in coding phase
  // 1. Authentication/Authorization check using requireAuth()
  //    const user = await requireAuth(request);
  //    const tenantId = user.tenantId;
  // 2. Parse query parameters (limit, offset, developerId, accountId, resourceId, action, source, fromDate, toDate, orderBy, orderDirection)
  //    const url = new URL(request.url);
  //    const params = {
  //      limit: Number(url.searchParams.get('limit') || 100),
  //      offset: Number(url.searchParams.get('offset') || 0),
  //      developerId: url.searchParams.get('developerId') || undefined,
  //      accountId: url.searchParams.get('accountId') || undefined,
  //      resourceId: url.searchParams.get('resourceId') || undefined,
  //      action: url.searchParams.get('action') || undefined,
  //      source: url.searchParams.get('source') || undefined,
  //      fromDate: url.searchParams.get('fromDate') ? new Date(url.searchParams.get('fromDate')!) : undefined,
  //      toDate: url.searchParams.get('toDate') ? new Date(url.searchParams.get('toDate')!) : undefined,
  //      orderBy: url.searchParams.get('orderBy') || 'occurred_at',
  //      orderDirection: url.searchParams.get('orderDirection') || 'desc',
  //    };
  // 3. Call service: const result = await listActivities(tenantId, params)
  // 4. Return: return json(result)
  throw new Error('Not implemented');
}

/**
 * POST /api/activities - Create a new activity
 *
 * Request Body:
 * {
 *   developerId?: string (UUID) | null,
 *   accountId?: string (UUID) | null,
 *   anonId?: string | null,
 *   resourceId?: string (UUID) | null,
 *   action: string,
 *   occurredAt: string (ISO 8601 date),
 *   source: string,
 *   sourceRef?: string | null,
 *   category?: string | null,
 *   groupKey?: string | null,
 *   metadata?: Record<string, any> | null,
 *   confidence?: number (0.0-1.0),
 *   dedupKey?: string | null
 * }
 *
 * Response:
 * 201 Created
 * {
 *   activityId: "...",
 *   action: "...",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid request body (validation error, missing required ID)
 * - 401 Unauthorized: Missing or invalid authentication
 * - 409 Conflict: Duplicate activity detected (dedupKey already exists)
 * - 500 Internal Server Error: Database error
 *
 * Implementation:
 * 1. Authenticate user using requireAuth() middleware
 * 2. Parse and validate request body (JSON)
 * 3. Convert occurredAt string to Date object
 * 4. Call createActivity() from Activity Service
 * 5. Return JSON response with 201 status
 * 6. Handle errors (validation, duplicate dedupKey, database)
 */
export async function action({ request }: ActionFunctionArgs) {
  const method = request.method;

  if (method === 'POST') {
    // Implementation will be added in coding phase
    // 1. Authentication/Authorization check using requireAuth()
    //    const user = await requireAuth(request);
    //    const tenantId = user.tenantId;
    // 2. Parse request body: const data = await request.json()
    // 3. Convert occurredAt to Date: data.occurredAt = new Date(data.occurredAt)
    // 4. Call service: const result = await createActivity(tenantId, data)
    // 5. Return: return json(result, { status: 201 })
    throw new Error('Not implemented');
  }

  // Method not allowed
  return json({ error: 'Method not allowed' }, { status: 405 });
}
```

### 2. `app/routes/api/activities.$id.ts` - Single Activity Resource Route

個別のアクティビティに対する操作（GET, PUT, DELETE）を実装します。

```typescript
/**
 * Activity API - Single Resource Route
 *
 * Handles operations on a single activity by ID.
 *
 * Endpoints:
 * - GET    /api/activities/:id - Get activity by ID
 * - PUT    /api/activities/:id - Update activity (rare - data correction only)
 * - DELETE /api/activities/:id - Delete activity (rare - GDPR compliance only)
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import {
  getActivity,
  updateActivity,
  deleteActivity,
  type UpdateActivityInput,
} from '~/services/activity.service.js';

/**
 * GET /api/activities/:id - Get activity by ID
 *
 * Path Parameters:
 * - id: Activity ID (UUID)
 *
 * Response:
 * 200 OK
 * {
 *   activityId: "...",
 *   action: "...",
 *   occurredAt: "2025-10-13T00:00:00.000Z",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid activity ID format
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Activity not found
 * - 500 Internal Server Error: Database error
 *
 * Implementation:
 * 1. Authenticate user using requireAuth() middleware
 * 2. Extract activity ID from URL params
 * 3. Validate activity ID (UUID format)
 * 4. Call getActivity() from Activity Service
 * 5. If null, return 404
 * 6. Return JSON response
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  // Implementation will be added in coding phase
  // 1. Authentication/Authorization check using requireAuth()
  //    const user = await requireAuth(request);
  //    const tenantId = user.tenantId;
  // 2. Validate activity ID: const activityId = params.id
  // 3. Call service: const result = await getActivity(tenantId, activityId)
  // 4. If result is null: return json({ error: 'Not found' }, { status: 404 })
  // 5. Return: return json(result)
  throw new Error('Not implemented');
}

/**
 * PUT /api/activities/:id - Update activity
 *
 * Path Parameters:
 * - id: Activity ID (UUID)
 *
 * Request Body (all fields optional):
 * {
 *   developerId?: string (UUID) | null,
 *   accountId?: string (UUID) | null,
 *   anonId?: string | null,
 *   resourceId?: string (UUID) | null,
 *   action?: string,
 *   occurredAt?: string (ISO 8601 date),
 *   source?: string,
 *   sourceRef?: string | null,
 *   category?: string | null,
 *   groupKey?: string | null,
 *   metadata?: Record<string, any> | null,
 *   confidence?: number (0.0-1.0)
 * }
 *
 * Response:
 * 200 OK
 * {
 *   activityId: "...",
 *   action: "...",
 *   ...
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid request body, activity ID, or no update fields provided
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Activity not found
 * - 500 Internal Server Error: Database error
 *
 * Important: Activities are event logs. Updates should be RARE:
 * - Developer ID resolution (anonymous → identified)
 * - Metadata enrichment
 * - Data correction errors
 *
 * Implementation:
 * 1. Authenticate user using requireAuth() middleware
 * 2. Extract activity ID from URL params
 * 3. Parse and validate request body (JSON)
 * 4. Convert occurredAt to Date if present
 * 5. Call updateActivity() from Activity Service
 * 6. Return JSON response
 */
export async function action({ params, request }: ActionFunctionArgs) {
  const method = request.method;

  if (method === 'PUT') {
    // Implementation will be added in coding phase
    // 1. Authentication/Authorization check using requireAuth()
    //    const user = await requireAuth(request);
    //    const tenantId = user.tenantId;
    // 2. Validate activity ID: const activityId = params.id
    // 3. Parse request body: const data = await request.json()
    // 4. Convert occurredAt to Date if present
    // 5. Call service: const result = await updateActivity(tenantId, activityId, data)
    // 6. Return: return json(result)
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
 * DELETE /api/activities/:id - Delete activity
 *
 * Path Parameters:
 * - id: Activity ID (UUID)
 *
 * Response:
 * 204 No Content (on success)
 *
 * Error Responses:
 * - 400 Bad Request: Invalid activity ID format
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Activity not found
 * - 500 Internal Server Error: Database error
 *
 * Important: Activities are event logs. Deletion should be EXTREMELY RARE:
 * - GDPR compliance (Right to be forgotten)
 * - Spam or test data removal
 * - Erroneous data that cannot be corrected
 *
 * Implementation in action() method above:
 * // if (method === 'DELETE') {
 * //   const user = await requireAuth(request);
 * //   const tenantId = user.tenantId;
 * //   const activityId = params.id;
 * //   const result = await deleteActivity(tenantId, activityId);
 * //   if (!result) {
 * //     return json({ error: 'Not found' }, { status: 404 });
 * //   }
 * //   return new Response(null, { status: 204 });
 * // }
 *
 * Note: This is a HARD DELETE. Consider soft delete for audit trail.
 */
```

---

## アーキテクチャ層の責務

### HTTP層（Resource Route - Task 4.5 本タスク）

**責務**:
- HTTPリクエストの受付とパース
- 認証・認可チェック（requireAuth()）
- セッションからテナントIDを取得
- クエリパラメータ/リクエストボディのパース
- 日付文字列（ISO 8601）をDateオブジェクトに変換
- Activity Serviceの呼び出し
- HTTPレスポンスのシリアライズ（JSON）
- エラーハンドリング（HTTPステータスコード）

**実装しないこと**:
- ビジネスロジック（Activity Serviceが担当）
- データベース操作（Drizzle ORMが担当）
- バリデーションロジック（Zodスキーマが担当）
- テナントコンテキスト管理（Activity Serviceが担当）

### サービス層（Activity Service - Task 4.4で実装済み）

**責務**:
- 入力データのバリデーション（Zod）
- テナントコンテキスト管理（withTenantContext）
- ビジネスロジックの実装
- データベース操作の抽象化
- エラーメッセージの生成

---

## エンドポイント一覧

| HTTPメソッド | エンドポイント | 説明 | 実装ファイル |
|------------|--------------|------|------------|
| GET | `/api/activities` | アクティビティ一覧取得（ページネーション、フィルタ、ソート） | `app/routes/api/activities.ts` |
| POST | `/api/activities` | 新規アクティビティ作成 | `app/routes/api/activities.ts` |
| GET | `/api/activities/:id` | アクティビティ詳細取得 | `app/routes/api/activities.$id.ts` |
| PUT | `/api/activities/:id` | アクティビティ更新（稀）| `app/routes/api/activities.$id.ts` |
| DELETE | `/api/activities/:id` | アクティビティ削除（極稀） | `app/routes/api/activities.$id.ts` |

---

## リクエスト/レスポンス仕様

### 1. GET /api/activities - 一覧取得

**クエリパラメータ**:
```typescript
{
  limit?: number;        // max 1000, default 100
  offset?: number;       // default 0
  developerId?: string;  // UUID
  accountId?: string;    // UUID
  resourceId?: string;   // UUID
  action?: string;       // e.g., "star", "fork", "comment"
  source?: string;       // e.g., "github", "slack", "connpass"
  fromDate?: string;     // ISO 8601 date (e.g., "2025-10-01T00:00:00Z")
  toDate?: string;       // ISO 8601 date (e.g., "2025-10-31T23:59:59Z")
  orderBy?: 'occurred_at' | 'recorded_at' | 'ingested_at'; // default 'occurred_at'
  orderDirection?: 'asc' | 'desc'; // default 'desc'
}
```

**レスポンス（200 OK）**:
```json
{
  "activities": [
    {
      "activityId": "30000000-0000-4000-8000-000000000001",
      "tenantId": "default",
      "developerId": "10000000-0000-4000-8000-000000000001",
      "accountId": null,
      "anonId": null,
      "resourceId": "40000000-0000-4000-8000-000000000001",
      "action": "star",
      "occurredAt": "2025-10-13T10:00:00.000Z",
      "recordedAt": "2025-10-13T10:00:01.000Z",
      "source": "github",
      "sourceRef": "https://github.com/example/repo",
      "category": "engagement",
      "groupKey": "repo-stars",
      "metadata": { "repo": "example/repo", "language": "typescript" },
      "confidence": 1.0,
      "dedupKey": "github_star_repo_12345",
      "ingestedAt": "2025-10-13T10:00:02.000Z"
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
    "fromDate": ["Invalid date format"]
  }
}

// 401 Unauthorized
{
  "error": "Unauthorized"
}

// 500 Internal Server Error
{
  "error": "Failed to fetch activities"
}
```

### 2. POST /api/activities - 新規作成

**リクエストボディ**:
```json
{
  "developerId": "10000000-0000-4000-8000-000000000001",
  "accountId": null,
  "anonId": null,
  "resourceId": "40000000-0000-4000-8000-000000000001",
  "action": "star",
  "occurredAt": "2025-10-13T10:00:00Z",
  "source": "github",
  "sourceRef": "https://github.com/example/repo",
  "category": "engagement",
  "groupKey": "repo-stars",
  "metadata": { "repo": "example/repo", "language": "typescript" },
  "confidence": 1.0,
  "dedupKey": "github_star_repo_12345"
}
```

**レスポンス（201 Created）**:
```json
{
  "activityId": "30000000-0000-4000-8000-000000000002",
  "tenantId": "default",
  "developerId": "10000000-0000-4000-8000-000000000001",
  "accountId": null,
  "anonId": null,
  "resourceId": "40000000-0000-4000-8000-000000000001",
  "action": "star",
  "occurredAt": "2025-10-13T10:00:00.000Z",
  "recordedAt": "2025-10-13T10:00:01.000Z",
  "source": "github",
  "sourceRef": "https://github.com/example/repo",
  "category": "engagement",
  "groupKey": "repo-stars",
  "metadata": { "repo": "example/repo", "language": "typescript" },
  "confidence": 1.0,
  "dedupKey": "github_star_repo_12345",
  "ingestedAt": "2025-10-13T10:00:02.000Z"
}
```

**エラーレスポンス**:
```json
// 400 Bad Request (validation error)
{
  "error": "Validation failed",
  "details": {
    "action": ["Required field"],
    "occurredAt": ["Invalid date format"]
  }
}

// 400 Bad Request (missing required ID)
{
  "error": "At least one ID (developerId, accountId, or anonId) is required"
}

// 409 Conflict (duplicate dedupKey)
{
  "error": "Duplicate activity detected (dedupKey already exists)"
}
```

### 3. GET /api/activities/:id - 詳細取得

**パスパラメータ**:
- `id`: Activity ID (UUID)

**レスポンス（200 OK）**:
```json
{
  "activityId": "30000000-0000-4000-8000-000000000001",
  "tenantId": "default",
  "developerId": "10000000-0000-4000-8000-000000000001",
  "accountId": null,
  "anonId": null,
  "resourceId": "40000000-0000-4000-8000-000000000001",
  "action": "star",
  "occurredAt": "2025-10-13T10:00:00.000Z",
  "recordedAt": "2025-10-13T10:00:01.000Z",
  "source": "github",
  "sourceRef": "https://github.com/example/repo",
  "category": "engagement",
  "groupKey": "repo-stars",
  "metadata": { "repo": "example/repo", "language": "typescript" },
  "confidence": 1.0,
  "dedupKey": "github_star_repo_12345",
  "ingestedAt": "2025-10-13T10:00:02.000Z"
}
```

**エラーレスポンス**:
```json
// 404 Not Found
{
  "error": "Activity not found"
}

// 400 Bad Request
{
  "error": "Invalid activity ID format"
}
```

### 4. PUT /api/activities/:id - 更新

**パスパラメータ**:
- `id`: Activity ID (UUID)

**リクエストボディ（部分更新対応）**:
```json
{
  "developerId": "10000000-0000-4000-8000-000000000002",
  "metadata": { "repo": "example/repo", "language": "typescript", "stars": 100 }
}
```

**レスポンス（200 OK）**:
```json
{
  "activityId": "30000000-0000-4000-8000-000000000001",
  "tenantId": "default",
  "developerId": "10000000-0000-4000-8000-000000000002",
  "accountId": null,
  "anonId": null,
  "resourceId": "40000000-0000-4000-8000-000000000001",
  "action": "star",
  "occurredAt": "2025-10-13T10:00:00.000Z",
  "recordedAt": "2025-10-13T10:00:01.000Z",
  "source": "github",
  "sourceRef": "https://github.com/example/repo",
  "category": "engagement",
  "groupKey": "repo-stars",
  "metadata": { "repo": "example/repo", "language": "typescript", "stars": 100 },
  "confidence": 1.0,
  "dedupKey": "github_star_repo_12345",
  "ingestedAt": "2025-10-13T10:00:02.000Z"
}
```

**エラーレスポンス**:
```json
// 404 Not Found
{
  "error": "Activity not found"
}

// 400 Bad Request (no update fields)
{
  "error": "No update fields provided"
}

// 400 Bad Request (validation error)
{
  "error": "Validation failed",
  "details": {
    "confidence": ["Must be between 0 and 1"]
  }
}
```

### 5. DELETE /api/activities/:id - 削除

**パスパラメータ**:
- `id`: Activity ID (UUID)

**レスポンス（204 No Content）**:
```
(レスポンスボディなし)
```

**エラーレスポンス**:
```json
// 404 Not Found
{
  "error": "Activity not found"
}

// 400 Bad Request
{
  "error": "Invalid activity ID format"
}
```

---

## エラーハンドリング

### HTTPステータスコード

| ステータスコード | 意味 | 使用ケース |
|---------------|------|----------|
| 200 OK | 成功（GET, PUT） | アクティビティ情報の取得・更新成功 |
| 201 Created | 作成成功（POST） | 新規アクティビティ作成成功 |
| 204 No Content | 削除成功（DELETE） | アクティビティ削除成功 |
| 400 Bad Request | 不正なリクエスト | バリデーションエラー、不正なパラメータ、日付範囲エラー |
| 401 Unauthorized | 認証エラー | 認証トークンがない、無効 |
| 404 Not Found | リソースが見つからない | アクティビティが存在しない |
| 405 Method Not Allowed | 許可されていないメソッド | 未実装のHTTPメソッド |
| 409 Conflict | 競合エラー | dedupKey重複 |
| 500 Internal Server Error | サーバーエラー | データベース接続エラー |

### エラーレスポンス形式

**統一されたエラーレスポンス**:
```typescript
interface ErrorResponse {
  error: string;           // エラーメッセージ
  details?: Record<string, string[]>; // フィールド別エラー（バリデーション時）
}
```

---

## 認証・認可

### セッション管理

Activity APIは、認証済みユーザーのみがアクセス可能です。

**実装方針**:
1. Task 3.8で実装した`requireAuth()`ミドルウェアを使用
2. `requireAuth()`がユーザー情報（userId, tenantId, email, role）を返す
3. 未認証の場合は自動的に`/login`にリダイレクト

```typescript
import { requireAuth } from '~/auth.middleware.js';

export async function loader({ request }: LoaderFunctionArgs) {
  // 1. Require authentication (throws redirect if not authenticated)
  const user = await requireAuth(request);

  // 2. Extract tenant ID from authenticated user
  const tenantId = user.tenantId;

  // ... proceed with authenticated request
}
```

**API向け認証エラーハンドリング**:
- `requireAuth()`は未認証時に`throw redirect('/login?returnTo=...')` を実行
- API routesでは、リダイレクトの代わりに401 Unauthorizedを返す

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

全てのアクティビティデータアクセスは、PostgreSQLのRLSにより自動的にテナント分離されます。

**重要**: Activity Serviceが内部で`withTenantContext()`を実行するため、HTTP層では明示的なテナントコンテキスト管理は不要です。

---

## テスト方針

### 統合テスト（`app/routes/api/activities.test.ts`）

Task 4.5の完了条件は「APIが統合テストでパスする」ことです。以下のテストケースを実装します。

#### 1. GET /api/activities - 一覧取得テスト（8テスト）

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('GET /api/activities', () => {
  it('should return activities list with default pagination', async () => {
    // Arrange: Prepare authenticated request
    const request = new Request('http://localhost/api/activities', {
      headers: {
        Cookie: 'session=...' // authenticated session
      }
    });

    // Act: Call loader
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // Assert: Verify response
    expect(response.status).toBe(200);
    expect(data.activities).toBeInstanceOf(Array);
    expect(data.total).toBeGreaterThan(0);
  });

  it('should respect limit and offset parameters', async () => {
    // Test pagination
  });

  it('should filter by developerId', async () => {
    // Test developerId filter
  });

  it('should filter by accountId', async () => {
    // Test accountId filter
  });

  it('should filter by action', async () => {
    // Test action filter
  });

  it('should filter by date range (fromDate and toDate)', async () => {
    // Test date range filter
  });

  it('should sort by occurred_at descending by default', async () => {
    // Test default sorting
  });

  it('should return 401 for unauthenticated requests', async () => {
    // Test authentication requirement
  });
});
```

#### 2. POST /api/activities - 作成テスト（5テスト）

```typescript
describe('POST /api/activities', () => {
  it('should create a new activity with developerId', async () => {
    // Test activity creation
  });

  it('should create activity with accountId', async () => {
    // Test with accountId instead of developerId
  });

  it('should create activity with anonId', async () => {
    // Test with anonId (anonymous tracking)
  });

  it('should return 400 if no ID provided', async () => {
    // Test validation: at least one ID required
  });

  it('should return 409 for duplicate dedupKey', async () => {
    // Test deduplication
  });
});
```

#### 3. GET /api/activities/:id - 詳細取得テスト（3テスト）

```typescript
describe('GET /api/activities/:id', () => {
  it('should return activity by ID', async () => {
    // Test single activity retrieval
  });

  it('should return 404 for non-existent ID', async () => {
    // Test not found case
  });

  it('should return 400 for invalid UUID format', async () => {
    // Test invalid UUID
  });
});
```

#### 4. PUT /api/activities/:id - 更新テスト（4テスト）

```typescript
describe('PUT /api/activities/:id', () => {
  it('should update activity (developer ID resolution)', async () => {
    // Test updating developerId (anonymous → identified)
  });

  it('should update metadata', async () => {
    // Test metadata enrichment
  });

  it('should return 400 if no update fields provided', async () => {
    // Test empty update guard
  });

  it('should return 404 for non-existent activity', async () => {
    // Test not found case
  });
});
```

#### 5. DELETE /api/activities/:id - 削除テスト（3テスト）

```typescript
describe('DELETE /api/activities/:id', () => {
  it('should delete activity', async () => {
    // Test deletion
  });

  it('should return 404 for non-existent activity', async () => {
    // Test not found case
  });

  it('should return 204 with no body on success', async () => {
    // Test 204 No Content response
  });
});
```

### テスト環境セットアップ

```typescript
import { beforeAll, afterAll } from 'vitest';
import { closeDb } from '~/db/connection';

describe('Activity API', () => {
  let testUserId: string;
  let testTenantId: string;
  let sessionCookie: string;

  beforeAll(async () => {
    // Setup test user and session
    // testUserId, testTenantId, sessionCookie を初期化
  });

  afterAll(async () => {
    // Cleanup
    await closeDb();
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
- Activity Serviceが内部でRLSを適用（テナント分離保証）
- 不正なテナントIDアクセスは自動的にブロック

### 2. 入力バリデーション

**クエリパラメータ**:
- `limit`: 最大1000に制限（DoS攻撃防止）
- `offset`: 負の値を拒否
- `developerId`, `accountId`, `resourceId`, `activityId`: UUID形式を検証
- `fromDate`, `toDate`: ISO 8601形式を検証、fromDate <= toDateを検証

**リクエストボディ**:
- JSONパース前にContent-Typeを検証
- Activity Serviceが内部でZodスキーマによる完全バリデーション
- 不正なデータは400 Bad Requestを返す

### 3. イベントログの不変性

**重要な制約**:
- Activityは**イベントログ**であり、原則として不変
- 更新・削除は極めて稀（データ修正、GDPR対応時のみ）
- 重複排除には`dedupKey`を使用
- 更新履歴を追跡する場合は、新しいActivityを作成することを推奨

### 4. エラーメッセージのサニタイゼーション

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

## 完了チェックリスト

- [ ] `app/routes/api/activities.ts`ファイル作成
- [ ] GET /api/activities 実装（一覧取得、フィルタ、ソート）
- [ ] POST /api/activities 実装（新規作成、重複排除）
- [ ] `app/routes/api/activities.$id.ts`ファイル作成
- [ ] GET /api/activities/:id 実装（詳細取得）
- [ ] PUT /api/activities/:id 実装（更新、empty guard）
- [ ] DELETE /api/activities/:id 実装（削除）
- [ ] エラーハンドリング実装（400, 401, 404, 409, 500）
- [ ] 日付文字列（ISO 8601）→Dateオブジェクトの変換処理
- [ ] 統合テストファイル作成（`app/routes/api/activities.test.ts`）
- [ ] GET一覧取得のテスト（8テスト: pagination, filters, sorting, auth）
- [ ] POST作成のテスト（5テスト: developerId/accountId/anonId, validation, dedup）
- [ ] GET詳細取得のテスト（3テスト: success, 404, invalid UUID）
- [ ] PUT更新のテスト（4テスト: update, empty guard, 404）
- [ ] DELETE削除のテスト（3テスト: delete, 404, 204 response）
- [ ] 全テストが成功（`pnpm test`）
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] Lintエラーなし（`pnpm lint`）

---

## 次のタスク

Task 4.5完了後、以下のタスクに進みます：

- **Task 5.1**: ROIサービス基盤実装（`createCampaign`, `getCampaign`, `listCampaigns`）
- **Task 5.2**: ROI計算ロジック実装（`calculateROI`）
- **Task 5.3**: 短縮URL機能実装（`generateShortURL`, リダイレクトAPI）

---

## 参考資料

- [Remix Resource Routes](https://remix.run/docs/en/main/guides/resource-routes)
- [Remix Loader/Action](https://remix.run/docs/en/main/route/loader)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [RESTful API Design Best Practices](https://restfulapi.net/)
- [ISO 8601 Date Format](https://en.wikipedia.org/wiki/ISO_8601)
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
