# Task 3.7: テナントコンテキスト管理API実装

**タスク番号**: 3.7
**依存タスク**: Task 3.5（RLS設定）
**推定時間**: 2時間
**完了条件**: セッション変数`app.current_tenant_id`が設定でき、RLS対応のクエリが実行できる

---

## 概要

PostgreSQLのRow Level Security (RLS)ポリシーで使用するセッション変数`app.current_tenant_id`を管理するAPIを実装します。これにより、アプリケーション全体（Remix loader/action、シードスクリプト、テスト等）でテナント分離されたデータベースアクセスが可能になります。

## 背景・目的

### 現状の問題

Task 3.5でRLSポリシーを設定しましたが、現在の`connection.ts`にはテナントコンテキストを設定する仕組みがありません。そのため：

1. **シードスクリプトが動作しない**: Task 3.6で作成したシードスクリプトがRLSポリシー違反で失敗する
2. **アプリケーションでRLSを活用できない**: RemixのloaderやactionでRLS対応のクエリが実行できない
3. **テストが不完全**: テストでRLSを考慮したデータアクセスができない

### 目的

- セッション変数`app.current_tenant_id`を設定・管理するAPIを提供
- アプリケーション全体でテナント分離されたデータアクセスを実現
- シードスクリプト、Remixアプリ、テストでRLSポリシーを活用

---

## 実装API

### 1. `setTenantContext(tenantId: string): Promise<void>`

指定したテナントIDをセッション変数に設定します。この関数を呼び出した後のすべてのクエリは、指定したテナントのデータのみにアクセスします。

**インターフェース**:
```typescript
/**
 * Set tenant context for current database session
 *
 * This function sets the PostgreSQL session variable `app.current_tenant_id`
 * which is used by Row Level Security (RLS) policies to filter data by tenant.
 *
 * All subsequent queries in the same session will only access data
 * belonging to the specified tenant.
 *
 * Usage in Remix loaders/actions:
 * ```typescript
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const tenantId = getTenantIdFromRequest(request); // from session/auth
 *   await setTenantContext(tenantId);
 *
 *   const db = getDb();
 *   const developers = await db.select().from(schema.developers);
 *   // Returns only developers for the specified tenant
 * }
 * ```
 *
 * Usage in seed scripts:
 * ```typescript
 * await setTenantContext('default');
 * await seedTenant();
 * await seedDevelopers();
 * ```
 *
 * @param tenantId - Tenant ID to set (e.g., 'default', 'acme-corp')
 * @throws {Error} If tenantId is empty or SQL execution fails
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  // Implementation:
  // 1. Validate tenantId is not empty
  // 2. Get SQL client (getSql())
  // 3. Execute: SET app.current_tenant_id = '<tenantId>'
  // 4. Handle errors and log for debugging
}
```

**実装のポイント**:
- `tenantId`が空文字列の場合はエラーをthrow
- `getSql()`で生SQLクライアントを取得
- PostgreSQLの`SET`コマンドでセッション変数を設定
- エラー時は詳細なエラーメッセージをthrow

---

### 2. `getTenantContext(): Promise<string | null>`

現在のセッション変数の値を取得します。デバッグやテストで使用します。

**インターフェース**:
```typescript
/**
 * Get current tenant context from database session
 *
 * This function retrieves the current value of the PostgreSQL session variable
 * `app.current_tenant_id`. Useful for debugging and testing.
 *
 * Usage:
 * ```typescript
 * await setTenantContext('default');
 * const current = await getTenantContext();
 * console.log(current); // 'default'
 * ```
 *
 * @returns Current tenant ID, or null if not set
 * @throws {Error} If SQL execution fails
 */
export async function getTenantContext(): Promise<string | null> {
  // Implementation:
  // 1. Get SQL client (getSql())
  // 2. Execute: SELECT current_setting('app.current_tenant_id', true)
  // 3. Return the value (null if not set)
  // 4. Handle errors
}
```

**実装のポイント**:
- `current_setting()`の第2引数を`true`にしてエラーを防ぐ（未設定時はNULLを返す）
- 戻り値は`string | null`

---

### 3. `clearTenantContext(): Promise<void>`

セッション変数をクリアします。テストのクリーンアップで使用します。

**インターフェース**:
```typescript
/**
 * Clear tenant context from database session
 *
 * This function clears the PostgreSQL session variable `app.current_tenant_id`.
 * Primarily used in test cleanup to ensure isolated tests.
 *
 * After clearing, queries will fail with RLS policy violations unless
 * the database user is a superuser.
 *
 * Usage in tests:
 * ```typescript
 * afterEach(async () => {
 *   await clearTenantContext();
 * });
 * ```
 *
 * @throws {Error} If SQL execution fails
 */
export async function clearTenantContext(): Promise<void> {
  // Implementation:
  // 1. Get SQL client (getSql())
  // 2. Execute: RESET app.current_tenant_id
  // 3. Handle errors
}
```

**実装のポイント**:
- `RESET`コマンドでセッション変数をクリア
- テストのクリーンアップで使用

---

### 4. `withTenantContext<T>(tenantId: string, fn: () => Promise<T>): Promise<T>`

指定したテナントコンテキストで関数を実行します。実行後は元のコンテキストに戻ります（オプション実装）。

**インターフェース**:
```typescript
/**
 * Execute function within specific tenant context
 *
 * This is a convenience function that:
 * 1. Saves current tenant context
 * 2. Sets new tenant context
 * 3. Executes the provided function
 * 4. Restores original tenant context
 *
 * Useful for operations that need to temporarily switch tenants.
 *
 * Usage:
 * ```typescript
 * const result = await withTenantContext('tenant-a', async () => {
 *   const db = getDb();
 *   return await db.select().from(schema.developers);
 * });
 * ```
 *
 * @param tenantId - Tenant ID to use for this operation
 * @param fn - Async function to execute
 * @returns Result of the function
 * @throws {Error} If context switching or function execution fails
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  // Implementation:
  // 1. Save current context (getTenantContext())
  // 2. Set new context (setTenantContext(tenantId))
  // 3. Execute fn() and await result
  // 4. Restore original context (try-finally)
  // 5. Return result
}
```

**実装のポイント**:
- 元のコンテキストを保存
- `try-finally`で必ず元のコンテキストに戻す
- エラー時も元のコンテキストを復元

---

## 使用例

### 1. Remixアプリケーション（loader/action）

```typescript
// app/routes/dashboard.developers.tsx
import { setTenantContext } from '~/db/connection';

export async function loader({ request }: LoaderFunctionArgs) {
  // 1. Get tenant ID from session/auth
  const session = await getSession(request.headers.get('Cookie'));
  const tenantId = session.get('tenantId'); // 'default', 'acme-corp', etc.

  // 2. Set tenant context
  await setTenantContext(tenantId);

  // 3. Query data (RLS automatically filters by tenant)
  const db = getDb();
  const developers = await db
    .select()
    .from(schema.developers)
    .limit(100);

  return json({ developers });
}
```

### 2. シードスクリプト

```typescript
// core/db/seed.ts
import { setTenantContext } from './connection.js';

async function seed() {
  // Set tenant context before seeding
  await setTenantContext('default');

  // All subsequent inserts will use tenant_id = 'default'
  await seedTenant();
  await seedDevelopers();
  await seedActivities();
}
```

### 3. テスト

```typescript
// core/db/seed.test.ts
import { setTenantContext, clearTenantContext } from './connection';

describe('Database Seeding', () => {
  beforeAll(async () => {
    // Set tenant context for all tests
    await setTenantContext('default');
  });

  afterAll(async () => {
    // Clear tenant context after tests
    await clearTenantContext();
    await closeDb();
  });

  it('should create developers', async () => {
    const db = getDb();
    const developers = await db.select().from(schema.developers);
    expect(developers).toHaveLength(5);
  });
});
```

---

## テスト方針

### 単体テスト（`core/db/connection.test.ts`）

1. **`setTenantContext()`のテスト**
   - 正常系: テナントIDが正しく設定される
   - 異常系: 空文字列でエラーをthrow
   - 異常系: DB接続エラー時のハンドリング

2. **`getTenantContext()`のテスト**
   - 正常系: 設定済みの値を取得できる
   - 正常系: 未設定時はnullを返す

3. **`clearTenantContext()`のテスト**
   - 正常系: セッション変数がクリアされる
   - 確認: クリア後は`getTenantContext()`がnullを返す

4. **`withTenantContext()`のテスト（オプション）**
   - 正常系: コンテキストが一時的に切り替わる
   - 正常系: 実行後は元のコンテキストに戻る
   - 異常系: 関数内でエラーが発生してもコンテキストが復元される

### 統合テスト

1. **RLSポリシーとの統合**
   - `setTenantContext('default')`後にデータ挿入が成功する
   - 別のテナントIDに切り替えるとデータが見えなくなる
   - コンテキスト未設定時はRLS違反エラーが発生する

2. **シードスクリプトとの統合**
   - `pnpm db:seed`がエラーなく完了する
   - シードデータが正しく挿入される
   - 冪等性が保たれる（2回実行しても問題ない）

---

## エラーハンドリング

### 1. バリデーションエラー

```typescript
// Empty tenant ID
setTenantContext(''); // throws Error: "Tenant ID cannot be empty"
```

### 2. データベース接続エラー

```typescript
// Database not initialized
setTenantContext('default'); // throws Error: "SQL client not initialized"
```

### 3. RLSポリシー違反（コンテキスト未設定）

```typescript
// Query without tenant context
const db = getDb();
await db.select().from(schema.developers);
// throws PostgresError: "new row violates row-level security policy"
```

**エラーメッセージの要件**:
- ユーザーにわかりやすいメッセージ
- デバッグに必要な情報（テナントID、SQL等）を含む
- 本番環境では機密情報をログに出力しない

---

## 実装の注意事項

### 1. スレッドセーフティ

PostgreSQLのセッション変数はコネクション単位で管理されます。postgres.jsのコネクションプールを使用しているため、**同じコネクションで複数のリクエストが並行実行される可能性があります**。

**対策**:
- 各リクエストの開始時に必ず`setTenantContext()`を呼び出す
- Remixのloaderやactionで毎回設定する
- `withTenantContext()`を使って確実にコンテキストを管理

### 2. パフォーマンス

`SET`コマンドは軽量ですが、毎回実行するとオーバーヘッドがあります。

**最適化案**:
- 現在のコンテキストをキャッシュし、変更時のみ`SET`を実行
- ただし、コネクションプールを使用しているため、キャッシュは慎重に

### 3. テストの分離

テスト間でコンテキストが混在しないよう、テストのクリーンアップで必ず`clearTenantContext()`を呼び出します。

---

## 完了チェックリスト

- [ ] `setTenantContext()`の実装とテスト
- [ ] `getTenantContext()`の実装とテスト
- [ ] `clearTenantContext()`の実装とテスト
- [ ] `withTenantContext()`の実装とテスト（オプション）
- [ ] 単体テスト（`core/db/connection.test.ts`）
- [ ] 統合テスト（RLSポリシーとの統合）
- [ ] シードスクリプト（`core/db/seed.ts`）の更新と動作確認
- [ ] 既存テスト（`core/db/seed.test.ts`）の更新と動作確認
- [ ] TypeScriptエラーの解消
- [ ] `pnpm lint`、`pnpm typecheck`の成功
- [ ] `pnpm test`の成功
- [ ] `pnpm db:seed`の成功（docker-compose環境）

---

## 参考資料

- [PostgreSQL: SET](https://www.postgresql.org/docs/current/sql-set.html)
- [PostgreSQL: current_setting()](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-SET)
- [PostgreSQL: Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [postgres.js Documentation](https://github.com/porsager/postgres)
