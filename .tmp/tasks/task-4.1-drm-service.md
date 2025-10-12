# Task 4.1: DRMサービス基盤実装

**タスク番号**: 4.1
**依存タスク**: Task 3.6（シードデータ作成）
**推定時間**: 3時間
**完了条件**: サービス関数が単体テストでパスする

---

## 概要

DRM（Developer Relationship Management）のサービス層基盤を実装します。このサービス層は、Remixのloader/actionとデータベース層の間に位置し、ビジネスロジックとデータアクセスを分離します。

**Phase 4の位置づけ**:
Phase 4はDRMのコア機能（開発者管理、ID統合、アクティビティ管理）を実装するフェーズです。Task 4.1はその基盤となるサービス層の構築です。

---

## 実装するファイルとインターフェース

### 1. `core/services/drm.service.ts`

開発者（Developer）の管理を行うサービスクラス。CRUD操作とページネーションを提供します。

```typescript
/**
 * DRM Service - Developer Relationship Management
 *
 * Provides business logic for developer management.
 * Handles CRUD operations, validation, and pagination.
 *
 * Architecture:
 * - Remix loader/action -> DRM Service -> Drizzle ORM -> PostgreSQL
 * - All functions are async and return Promise
 * - Validation is done using Zod schemas
 * - RLS (Row Level Security) is enforced at database level
 */

import { getDb } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { z } from 'zod';

/**
 * Zod schema for creating a new developer
 *
 * Validates input data before database insertion.
 * All fields must match the database schema constraints.
 */
export const CreateDeveloperSchema = z.object({
  displayName: z.string().min(1).max(255),
  primaryEmail: z.string().email().nullable(),
  orgId: z.string().uuid().nullable(),
  consentAnalytics: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

/**
 * Type inferred from CreateDeveloperSchema
 */
export type CreateDeveloperInput = z.infer<typeof CreateDeveloperSchema>;

/**
 * Zod schema for listing developers with pagination
 */
export const ListDevelopersSchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  orgId: z.string().uuid().optional(),
  search: z.string().optional(),
});

/**
 * Type inferred from ListDevelopersSchema
 */
export type ListDevelopersInput = z.infer<typeof ListDevelopersSchema>;

/**
 * Create a new developer
 *
 * @param tenantId - Tenant ID for multi-tenant isolation (required for RLS)
 * @param data - Developer data to create
 * @returns Created developer record
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using CreateDeveloperSchema
 * 2. Generate UUID for developer_id
 * 3. Insert into developers table using Drizzle ORM
 * 4. Return inserted record
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function createDeveloper(
  tenantId: string,
  data: CreateDeveloperInput
): Promise<typeof schema.developers.$inferSelect> {
  // Implementation will be added in coding phase
  throw new Error('Not implemented');
}

/**
 * Get a single developer by ID
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param developerId - UUID of the developer to retrieve
 * @returns Developer record or null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query developers table by developer_id
 * 2. RLS automatically filters by tenant_id
 * 3. Return null if not found (not an error)
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function getDeveloper(
  tenantId: string,
  developerId: string
): Promise<typeof schema.developers.$inferSelect | null> {
  // Implementation will be added in coding phase
  throw new Error('Not implemented');
}

/**
 * List developers with pagination
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param params - Pagination and filter parameters
 * @returns Object containing developers array and total count
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate params using ListDevelopersSchema
 * 2. Build query with filters (orgId, search)
 * 3. Apply pagination (limit, offset)
 * 4. Execute query and count query in parallel
 * 5. Return { developers, total }
 *
 * Filters:
 * - orgId: Filter by organization ID
 * - search: Search in display_name and primary_email (case-insensitive)
 *
 * Pagination:
 * - limit: Number of records to return (max 100, default 50)
 * - offset: Number of records to skip (default 0)
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function listDevelopers(
  tenantId: string,
  params: ListDevelopersInput
): Promise<{
  developers: Array<typeof schema.developers.$inferSelect>;
  total: number;
}> {
  // Implementation will be added in coding phase
  throw new Error('Not implemented');
}

/**
 * Zod schema for updating a developer
 *
 * All fields are optional (partial update support)
 */
export const UpdateDeveloperSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  primaryEmail: z.string().email().nullable().optional(),
  orgId: z.string().uuid().nullable().optional(),
  consentAnalytics: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Type inferred from UpdateDeveloperSchema
 */
export type UpdateDeveloperInput = z.infer<typeof UpdateDeveloperSchema>;

/**
 * Update an existing developer
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param developerId - UUID of the developer to update
 * @param data - Developer data to update (partial update supported)
 * @returns Updated developer record or null if not found
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using UpdateDeveloperSchema
 * 2. Query developer by developer_id (RLS applies)
 * 3. If not found, return null
 * 4. Update only provided fields using Drizzle ORM
 * 5. Return updated record
 *
 * Partial Update Support:
 * - Allows updating only specific fields
 * - Null values are treated as "set to null" (not "skip")
 * - Empty object {} is allowed (no-op, returns existing record)
 *
 * Examples:
 * - Update email only: { primaryEmail: 'new@example.com' }
 * - Update tags only: { tags: ['backend', 'python'] }
 * - Clear organization: { orgId: null }
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function updateDeveloper(
  tenantId: string,
  developerId: string,
  data: UpdateDeveloperInput
): Promise<typeof schema.developers.$inferSelect | null> {
  // Implementation will be added in coding phase
  throw new Error('Not implemented');
}

/**
 * Delete a developer
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param developerId - UUID of the developer to delete
 * @returns True if deleted, false if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query developer by developer_id (RLS applies)
 * 2. If not found, return false
 * 3. Delete developer record using Drizzle ORM
 * 4. Return true
 *
 * Important Notes:
 * - This is a HARD DELETE (permanent removal)
 * - Related records (accounts, activities) should be handled by:
 *   a) Database CASCADE constraints (automatic deletion)
 *   b) OR: Set developer_id to NULL (orphan records)
 *   c) OR: Soft delete (set deleted_at timestamp) - preferred for GDPR compliance
 *
 * GDPR Considerations:
 * - Users have "right to erasure" (right to be forgotten)
 * - Hard delete may be required for GDPR compliance
 * - Consider soft delete for audit trail requirements
 *
 * Alternative: Soft Delete
 * - Add `deleted_at` timestamp column to schema
 * - Set deleted_at = NOW() instead of DELETE
 * - Filter out deleted records in queries (WHERE deleted_at IS NULL)
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function deleteDeveloper(
  tenantId: string,
  developerId: string
): Promise<boolean> {
  // Implementation will be added in coding phase
  throw new Error('Not implemented');
}
```

---

## データフローと責務

### アーキテクチャ層

```
┌─────────────────────────────────────┐
│  Remix Loader/Action (HTTP Layer)  │
│  - Request validation               │
│  - Response serialization           │
│  - Error handling (try-catch)       │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  DRM Service (Business Logic)       │ ← Task 4.1
│  - Input validation (Zod)           │
│  - Business logic                   │
│  - Transaction coordination         │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Drizzle ORM (Data Access)          │
│  - Query construction               │
│  - Type-safe database operations    │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  PostgreSQL Database                │
│  - RLS enforcement                  │
│  - Data persistence                 │
└─────────────────────────────────────┘
```

### 各層の責務

**Remix Loader/Action (Task 4.4で実装)**:
- HTTPリクエストの受付
- レスポンスのシリアライズ（JSON形式）
- エラーハンドリング（HTTP status code）
- セッション管理（tenantId取得）

**DRM Service (Task 4.1 - 本タスク)**:
- 入力データのバリデーション（Zod）
- ビジネスロジックの実装
- データベース操作の抽象化
- エラーメッセージの生成

**Drizzle ORM**:
- タイプセーフなクエリ構築
- SQL生成とパラメータバインディング
- 接続プール管理

**PostgreSQL**:
- RLS（Row Level Security）による自動的なテナント分離
- データの永続化

---

## バリデーション戦略

### Zodスキーマによる入力検証

Task 4.1では、全ての入力データをZodスキーマで検証します。これにより以下を実現：

1. **型安全性**: TypeScriptの型推論により、コンパイル時エラー検出
2. **ランタイム検証**: 実行時に不正なデータを拒否
3. **エラーメッセージ**: ユーザーフレンドリーなエラーメッセージ生成

### バリデーション例

```typescript
// Example: createDeveloper input validation
const input = {
  displayName: 'Alice Anderson',
  primaryEmail: 'alice@example.com',
  orgId: '20000000-0000-4000-8000-000000000001',
  consentAnalytics: true,
  tags: ['frontend', 'react'],
};

// Validate using Zod schema
const validated = CreateDeveloperSchema.parse(input);
// If validation fails, throws ZodError with detailed error messages
```

### バリデーションエラーの処理

```typescript
import { z } from 'zod';

try {
  const validated = CreateDeveloperSchema.parse(data);
  // Proceed with database operation
} catch (error) {
  if (error instanceof z.ZodError) {
    // Extract field-level errors
    const fieldErrors = error.flatten().fieldErrors;
    // Return user-friendly error message
    throw new Error(`Validation failed: ${JSON.stringify(fieldErrors)}`);
  }
  throw error;
}
```

---

## ページネーション設計

### パラメータ

- **limit**: 1ページあたりの件数（最大100、デフォルト50）
- **offset**: スキップする件数（デフォルト0）

### レスポンス形式

```typescript
{
  developers: [...],  // Developer records
  total: 123,         // Total count (for pagination UI)
}
```

### SQLクエリ構造（実装イメージ）

```typescript
// 1. Data query with pagination
const developers = await db
  .select()
  .from(schema.developers)
  .where(/* filters */)
  .limit(params.limit)
  .offset(params.offset);

// 2. Count query (without limit/offset)
const [{ count }] = await db
  .select({ count: count() })
  .from(schema.developers)
  .where(/* same filters */);
```

### フロントエンド実装への考慮

フロントエンドでは以下のようにページネーションを実装可能:

```typescript
// Example: Page 2 with 50 items per page
const page = 2;
const limit = 50;
const offset = (page - 1) * limit; // 50

const response = await fetch(`/api/developers?limit=${limit}&offset=${offset}`);
const { developers, total } = await response.json();

// Calculate total pages
const totalPages = Math.ceil(total / limit);
```

---

## テスト方針

### 単体テスト（`core/services/drm.service.test.ts`）

Task 4.1の完了条件は「サービス関数が単体テストでパスする」ことです。以下のテストケースを実装します。

#### 1. `createDeveloper()`のテスト

```typescript
describe('createDeveloper', () => {
  it('should create a developer with valid data', async () => {
    // Arrange: Prepare valid input
    const input = {
      displayName: 'Test Developer',
      primaryEmail: 'test@example.com',
      orgId: null,
      consentAnalytics: true,
      tags: ['test'],
    };

    // Act: Call service function
    const result = await createDeveloper('default', input);

    // Assert: Verify created record
    expect(result.displayName).toBe('Test Developer');
    expect(result.primaryEmail).toBe('test@example.com');
    expect(result.tenantId).toBe('default');
  });

  it('should throw error for invalid email', async () => {
    // Arrange: Invalid email format
    const input = {
      displayName: 'Test',
      primaryEmail: 'invalid-email',
      orgId: null,
      consentAnalytics: false,
      tags: [],
    };

    // Act & Assert: Expect validation error
    await expect(
      createDeveloper('default', input)
    ).rejects.toThrow(/email/);
  });

  it('should handle database errors gracefully', async () => {
    // Test for database connection errors, constraint violations, etc.
  });
});
```

#### 2. `getDeveloper()`のテスト

```typescript
describe('getDeveloper', () => {
  it('should return developer by ID', async () => {
    // Arrange: Create a developer first
    const created = await createDeveloper('default', { /* ... */ });

    // Act: Retrieve by ID
    const result = await getDeveloper('default', created.developerId);

    // Assert: Verify returned data
    expect(result).not.toBeNull();
    expect(result?.developerId).toBe(created.developerId);
  });

  it('should return null for non-existent ID', async () => {
    // Act: Try to get non-existent developer
    const result = await getDeveloper('default', 'non-existent-uuid');

    // Assert: Should return null (not throw error)
    expect(result).toBeNull();
  });

  it('should not return developers from other tenants', async () => {
    // RLS test: Verify tenant isolation
  });
});
```

#### 3. `listDevelopers()`のテスト

```typescript
describe('listDevelopers', () => {
  it('should list developers with default pagination', async () => {
    // Arrange: Create multiple developers
    // ...

    // Act: List with default params
    const result = await listDevelopers('default', {
      limit: 50,
      offset: 0,
    });

    // Assert: Verify pagination
    expect(result.developers).toBeInstanceOf(Array);
    expect(result.total).toBeGreaterThan(0);
  });

  it('should filter by organization ID', async () => {
    // Test orgId filter
  });

  it('should search by display name', async () => {
    // Test search functionality
  });

  it('should respect limit parameter', async () => {
    // Arrange: Create 100 developers
    // Act: Request with limit=10
    const result = await listDevelopers('default', {
      limit: 10,
      offset: 0,
    });

    // Assert: Should return max 10 items
    expect(result.developers.length).toBeLessThanOrEqual(10);
  });

  it('should calculate total count correctly', async () => {
    // Verify that total count is accurate regardless of pagination
  });
});
```

### テスト環境セットアップ

```typescript
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { setTenantContext, clearTenantContext, closeDb } from '../db/connection';

describe('DRM Service', () => {
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
    // Or use transactions for test isolation
  });
});
```

---

## エラーハンドリング

### エラーの種類と対応

| エラーの種類 | 対応 | HTTPステータス（参考） |
|-------------|------|---------------------|
| **バリデーションエラー** | ZodErrorをキャッチし、フィールド別エラーメッセージを返す | 400 Bad Request |
| **データベース接続エラー** | 接続エラーメッセージをログに記録し、汎用エラーを返す | 500 Internal Server Error |
| **外部キー制約違反** | 参照先が存在しないことを示すエラーを返す | 400 Bad Request |
| **一意制約違反** | 重複データが存在することを示すエラーを返す | 409 Conflict |
| **RLS違反** | テナントIDが未設定、または不正なアクセスを示すエラー | 403 Forbidden |

### エラーハンドリング実装例

```typescript
export async function createDeveloper(
  tenantId: string,
  data: CreateDeveloperInput
): Promise<typeof schema.developers.$inferSelect> {
  // 1. Input validation
  try {
    CreateDeveloperSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.message}`);
    }
    throw error;
  }

  // 2. Database operation
  try {
    const db = getDb();
    const [result] = await db
      .insert(schema.developers)
      .values({
        developerId: crypto.randomUUID(),
        tenantId,
        ...data,
      })
      .returning();

    return result!;
  } catch (error) {
    // 3. Database error handling
    if (error instanceof Error) {
      // Check for specific error codes (e.g., unique constraint violation)
      if (error.message.includes('duplicate key')) {
        throw new Error('Developer with this email already exists');
      }
      if (error.message.includes('foreign key')) {
        throw new Error('Referenced organization does not exist');
      }
    }

    // 4. Generic error
    console.error('Failed to create developer:', error);
    throw new Error('Failed to create developer');
  }
}
```

---

## セキュリティ考慮事項

### 1. SQLインジェクション対策

Drizzle ORMを使用することで、全てのクエリはパラメータバインディングされます。生SQLの使用は避けます。

```typescript
// ✅ Safe: Drizzle ORM with parameter binding
await db
  .select()
  .from(schema.developers)
  .where(eq(schema.developers.developerId, developerId));

// ❌ Dangerous: Raw SQL with string concatenation (DO NOT USE)
await sql.unsafe(`SELECT * FROM developers WHERE developer_id = '${developerId}'`);
```

### 2. Row Level Security (RLS)

全てのサービス関数は`tenantId`パラメータを受け取りますが、実際のテナント分離はPostgreSQLのRLSポリシーにより自動的に行われます。

**重要**: サービス関数を呼び出す前に、必ず`setTenantContext(tenantId)`を実行してください（Task 3.7で実装済み）。

```typescript
// In Remix loader/action
export async function loader({ request }: LoaderFunctionArgs) {
  // 1. Get tenant ID from session
  const tenantId = await getTenantIdFromSession(request);

  // 2. Set tenant context for RLS
  await setTenantContext(tenantId);

  // 3. Call service function
  const developers = await listDevelopers(tenantId, { limit: 50, offset: 0 });

  return json({ developers });
}
```

### 3. 入力データのサニタイゼーション

Zodスキーマにより、以下を保証：
- メールアドレスの形式検証
- UUIDの形式検証
- 文字列長の制限
- 配列要素の型チェック

### 4. 機密情報の取り扱い

開発者情報には機密性の高いデータ（メールアドレス、組織情報）が含まれます。以下に留意：

- **ログ出力時**: メールアドレスをマスキング
- **エラーメッセージ**: 機密情報を含めない
- **API レスポンス**: 必要な情報のみ返却（全フィールド返却しない）

---

## 完了チェックリスト

- [ ] `core/services/drm.service.ts`ファイル作成
- [ ] Zodスキーマ定義（`CreateDeveloperSchema`, `ListDevelopersSchema`）
- [ ] `createDeveloper()`実装
- [ ] `getDeveloper()`実装
- [ ] `listDevelopers()`実装（ページネーション、フィルタ）
- [ ] 単体テストファイル作成（`core/services/drm.service.test.ts`）
- [ ] `createDeveloper()`のテスト（正常系・異常系）
- [ ] `getDeveloper()`のテスト（正常系・異常系）
- [ ] `listDevelopers()`のテスト（ページネーション、フィルタ）
- [ ] 全テストが成功（`pnpm test`）
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] Lintエラーなし（`pnpm lint`）

---

## 次のタスク

Task 4.1完了後、以下のタスクに進みます：

- **Task 4.2**: ID統合機能実装（`resolveDeveloper`, `mergeDevelopers`）
- **Task 4.3**: Activityサービス実装
- **Task 4.4**: Developer API実装（Remix loader/action）

---

## 参考資料

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Zod Documentation](https://zod.dev/)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Remix Loader/Action](https://remix.run/docs/en/main/route/loader)
