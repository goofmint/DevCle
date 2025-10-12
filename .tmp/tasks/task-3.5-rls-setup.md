# Task 3.5: Row Level Security (RLS) ポリシー設定

**タスク番号**: 3.5
**推定時間**: 2時間
**依存タスク**: Task 3.2（完了済み）
**完了条件**: 全25テーブルにRLSポリシーが適用され、tenant_idによるマルチテナント分離が機能する

---

## 概要

DevCleはマルチテナントアプリケーションとして設計されています。PostgreSQLのRow Level Security (RLS)機能を使用して、各テナントのデータを自動的に分離し、テナント間のデータ漏洩を防ぎます。

本タスクでは、Task 3.2で作成した全25テーブルに対してRLSポリシーを追加します。

---

## RLSの基本概念

### 1. Row Level Security (RLS) とは

PostgreSQLのRLSは、テーブルレベルではなく**行レベル**でアクセス制御を行う機能です。

- **通常のアクセス制御**: テーブル全体に対して権限を設定（SELECT, INSERT, UPDATE, DELETE）
- **RLS**: 各行に対してポリシーを適用し、条件に合致する行のみアクセス可能にする

### 2. マルチテナント分離の実現

DevCleでは、全テーブルに`tenant_id`カラムを持たせ、以下のポリシーを適用します：

```sql
-- Example: RLS policy for tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON tenants
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);
```

このポリシーにより、クエリ実行時に`app.current_tenant_id`セッション変数にセットされた`tenant_id`に一致する行のみがアクセス可能になります。

### 3. セッション変数の設定

アプリケーションコードでは、接続時に`app.current_tenant_id`を設定します：

```typescript
// Example: Setting session variable in Drizzle
import { sql } from 'drizzle-orm';
import { db } from '~/db/connection';

export async function setTenantContext(tenantId: string) {
  await db.execute(sql`SET LOCAL app.current_tenant_id = ${tenantId}`);
}
```

---

## 実装ファイル

### 1. RLSスクリプトの作成

以下のファイルを作成します：

- **ファイルパス**: `infra/postgres/rls.sql`
- **目的**: 全25テーブルに対するRLSポリシーの定義

### 2. RLSスクリプトの構造

```sql
-- infra/postgres/rls.sql
-- PostgreSQL Row Level Security (RLS) Policies for Multi-Tenant Isolation

-- ============================================================================
-- SECTION 1: Admin Tables (5 tables)
-- ============================================================================

-- 1.1 tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON tenants
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 1.2 users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON users
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 1.3 api_keys table
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON api_keys
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 1.4 system_settings table
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON system_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 1.5 notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON notifications
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- SECTION 2: Core Entity Tables (5 tables)
-- ============================================================================

-- 2.1 organizations table
-- [Same pattern as above]

-- 2.2 developers table
-- [Same pattern as above]

-- 2.3 accounts table
-- [Same pattern as above]

-- 2.4 developer_identifiers table
-- [Same pattern as above]

-- 2.5 developer_merge_logs table
-- [Same pattern as above]

-- ============================================================================
-- SECTION 3: Campaign/Resource Tables (3 tables)
-- ============================================================================

-- 3.1 campaigns table
-- [Same pattern as above]

-- 3.2 budgets table
-- [Same pattern as above]

-- 3.3 resources table
-- [Same pattern as above]

-- ============================================================================
-- SECTION 4: Activity Tables (2 tables)
-- ============================================================================

-- 4.1 activities table
-- [Same pattern as above]

-- 4.2 activity_campaigns table
-- [Same pattern as above]

-- ============================================================================
-- SECTION 5: Plugin/Import Tables (5 tables)
-- ============================================================================

-- 5.1 plugins table
-- [Same pattern as above]

-- 5.2 plugin_runs table
-- [Same pattern as above]

-- 5.3 plugin_events_raw table
-- [Same pattern as above]

-- 5.4 import_jobs table
-- [Same pattern as above]

-- 5.5 shortlinks table
-- [Same pattern as above]

-- ============================================================================
-- SECTION 6: Analytics/Funnel Tables (4 tables)
-- ============================================================================

-- 6.1 developer_stats table
-- [Same pattern as above]

-- 6.2 campaign_stats table
-- [Same pattern as above]

-- 6.3 funnel_stages table
-- [Same pattern as above]

-- 6.4 activity_funnel_map table
-- [Same pattern as above]

-- ============================================================================
-- SECTION 7: System Table (1 table)
-- ============================================================================

-- 7.1 schema_migrations table (NO RLS - system table)
-- Schema migrations table should be accessible without tenant filtering
```

---

## RLSポリシーの適用方法

### 1. Docker環境での適用

開発環境では、以下のコマンドでRLSスクリプトを適用します：

```bash
# Example: Apply RLS policies to PostgreSQL container
docker-compose exec postgres psql -U devcle -d devcle -f /docker-entrypoint-initdb.d/rls.sql
```

### 2. docker-compose-dev.ymlへの統合

RLSスクリプトを自動適用するため、`docker-compose-dev.yml`の`postgres`サービスにマウントポイントを追加します：

```yaml
# Example: Mount RLS script in docker-compose-dev.yml
postgres:
  volumes:
    - ./infra/postgres/init.sh:/docker-entrypoint-initdb.d/01-init.sh:ro
    - ./infra/postgres/rls.sql:/docker-entrypoint-initdb.d/02-rls.sql:ro
```

**注意**: ファイル名のプレフィックス（`01-`, `02-`）により、初期化スクリプトの実行順序が制御されます。

---

## アプリケーション統合

### 1. Tenant Context Middleware

Remixアプリケーションで、リクエストごとに`tenant_id`をセットするミドルウェアを実装します：

```typescript
// Example: core/app/middleware/tenant-context.ts

import { sql } from 'drizzle-orm';
import { db } from '~/db/connection';

/**
 * Set tenant context for RLS (Row Level Security)
 *
 * This function must be called at the start of every database transaction
 * to ensure proper tenant isolation via PostgreSQL RLS policies.
 *
 * @param tenantId - The tenant ID to set for the current session
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  await db.execute(sql`SET LOCAL app.current_tenant_id = ${tenantId}`);
}

/**
 * Clear tenant context (for cleanup or switching tenants)
 */
export async function clearTenantContext(): Promise<void> {
  await db.execute(sql`RESET app.current_tenant_id`);
}
```

### 2. Remix Loader/Action統合

各RouteのloaderやactionでTenant Contextを設定します：

```typescript
// Example: core/app/routes/api/developers.ts

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { setTenantContext } from '~/middleware/tenant-context';
import { db } from '~/db/connection';
import { developers } from '~/db/schema';

export async function loader({ request }: LoaderFunctionArgs) {
  // 1. Extract tenant_id from session/auth token
  const tenantId = await getTenantIdFromSession(request);

  // 2. Set tenant context for RLS
  await setTenantContext(tenantId);

  // 3. Query developers (RLS automatically filters by tenant_id)
  const allDevelopers = await db.select().from(developers);

  return json({ developers: allDevelopers });
}

async function getTenantIdFromSession(request: Request): Promise<string> {
  // Implementation: Extract tenant_id from cookie/JWT/session
  // For MVP, return default tenant
  return 'default';
}
```

---

## テスト方法

### 1. RLS動作確認

PostgreSQLコンテナ内で以下のSQLを実行し、RLSが機能していることを確認します：

```sql
-- Example: Test RLS policy

-- Set tenant context to 'tenant-a'
SET app.current_tenant_id = 'tenant-a';

-- Insert test data for tenant-a
INSERT INTO developers (tenant_id, display_name, primary_email)
VALUES ('tenant-a', 'Alice', 'alice@example.com');

-- Switch to tenant-b
SET app.current_tenant_id = 'tenant-b';

-- Query developers (should return empty - Alice is in tenant-a)
SELECT * FROM developers;

-- Expected result: 0 rows (tenant isolation working)
```

### 2. アプリケーションレベルのテスト

```typescript
// Example: Unit test for RLS isolation

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setTenantContext, clearTenantContext } from '~/middleware/tenant-context';
import { db } from '~/db/connection';
import { developers } from '~/db/schema';

describe('RLS Tenant Isolation', () => {
  beforeEach(async () => {
    // Setup: Insert test data for multiple tenants
  });

  afterEach(async () => {
    await clearTenantContext();
  });

  it('should only return developers for the current tenant', async () => {
    // Set tenant context to 'tenant-a'
    await setTenantContext('tenant-a');

    // Query developers
    const results = await db.select().from(developers);

    // Verify all results belong to 'tenant-a'
    expect(results.every(d => d.tenantId === 'tenant-a')).toBe(true);
  });

  it('should not access data from other tenants', async () => {
    // Set tenant context to 'tenant-b'
    await setTenantContext('tenant-b');

    // Query developers
    const results = await db.select().from(developers);

    // Verify no results from 'tenant-a'
    expect(results.every(d => d.tenantId !== 'tenant-a')).toBe(true);
  });
});
```

---

## 実装チェックリスト

- [ ] `infra/postgres/rls.sql`を作成
  - [ ] Admin tables (5テーブル) にRLSポリシー追加
  - [ ] Core entity tables (5テーブル) にRLSポリシー追加
  - [ ] Campaign/resource tables (3テーブル) にRLSポリシー追加
  - [ ] Activity tables (2テーブル) にRLSポリシー追加
  - [ ] Plugin/import tables (5テーブル) にRLSポリシー追加
  - [ ] Analytics/funnel tables (4テーブル) にRLSポリシー追加
  - [ ] `schema_migrations`テーブルはRLS対象外（システムテーブル）
- [ ] `docker-compose-dev.yml`にRLSスクリプトのマウントポイント追加
- [ ] Tenant contextミドルウェア実装（`core/app/middleware/tenant-context.ts`）
- [ ] RLS動作確認（SQLテスト）
- [ ] アプリケーションレベルのテスト作成

---

## セキュリティ上の注意事項

### 1. `current_setting()`の第2引数

```sql
-- ❌ Wrong: Will raise error if variable not set
current_setting('app.current_tenant_id')

-- ✅ Correct: Returns NULL if variable not set (fails-safe)
current_setting('app.current_tenant_id', true)
```

第2引数に`true`を指定することで、変数が未設定の場合にエラーではなくNULLを返します。これにより、テナントコンテキストが設定されていない場合は全ての行へのアクセスが拒否されます（fail-safe）。

### 2. `SET LOCAL` vs `SET`

```sql
-- ❌ Wrong: Session-wide setting (persists across transactions)
SET app.current_tenant_id = 'tenant-a';

-- ✅ Correct: Transaction-local setting (resets after transaction)
SET LOCAL app.current_tenant_id = 'tenant-a';
```

`SET LOCAL`を使用することで、トランザクション終了後に自動的にリセットされ、テナント設定の漏洩を防ぎます。

### 3. Superuser Bypass

PostgreSQLのsuperuserはRLSポリシーをバイパスできます。本番環境では、アプリケーションユーザーにsuperuser権限を付与しないでください。

```sql
-- Example: Create application user without superuser privileges
CREATE USER devcle_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE devcle TO devcle_app;
GRANT USAGE ON SCHEMA public TO devcle_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO devcle_app;
```

---

## 参考資料

- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Drizzle ORM with PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
- [Multi-Tenant Architecture Patterns](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/multi-tenant-architecture-patterns.html)

---

**完了条件**: 上記チェックリストが全て完了し、RLSテストが成功すること
