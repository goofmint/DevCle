# Task 4.3: ID統合機能実装

**タスク番号**: 4.3
**依存タスク**: Task 4.1（DRMサービス基盤実装）
**推定時間**: 3時間
**完了条件**: ID統合ロジックが単体テストでパスする

---

## 概要

開発者のアイデンティティ統合機能を実装します。複数のidentifier（email、SNS ID等）から同一人物の開発者を検索し、重複した開発者プロファイルを統合するロジックを提供します。

**Phase 4の位置づけ**:
Phase 4はDRMのコア機能を実装するフェーズです。Task 4.3では、開発者の重複排除とアイデンティティ解決（Identity Resolution）を実現します。

**重要**: このタスクではインターフェースの定義とロジック説明のみを行い、実装は後のレビュー後に行います。

---

## 実装するファイルとインターフェース

### 1. `core/services/identity.service.ts`

開発者のアイデンティティ解決（Identity Resolution）と統合を行うサービス。

```typescript
/**
 * Identity Service - Developer Identity Resolution
 *
 * Provides business logic for developer identity resolution and merging.
 * Handles identifier matching, confidence scoring, and merge operations.
 *
 * Architecture:
 * - Remix loader/action -> Identity Service -> Drizzle ORM -> PostgreSQL
 * - All functions are async and return Promise
 * - Confidence scoring (0.0-1.0) for automatic matching
 * - Audit trail via developer_merge_logs table
 */

import { getDb } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { z } from 'zod';

/**
 * Zod schema for identifier lookup
 *
 * Validates input data for resolveDeveloper().
 */
export const IdentifierLookupSchema = z.object({
  kind: z.enum(['email', 'domain', 'phone', 'mlid', 'click_id', 'key_fp']),
  value: z.string().min(1),
});

export type IdentifierLookupInput = z.infer<typeof IdentifierLookupSchema>;

/**
 * Resolve developer by identifier
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param identifier - Identifier to search (kind + value)
 * @returns Developer record if found, null otherwise
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using IdentifierLookupSchema
 * 2. Normalize value (lowercase, trim)
 * 3. Query developer_identifiers table by (tenant_id, kind, value_normalized)
 * 4. If found, return associated developer
 * 5. If not found, check accounts table (for email matching)
 * 6. Return null if no match found
 *
 * Matching priority:
 * 1. developer_identifiers table (highest priority)
 * 2. accounts table (email field)
 * 3. developers table (primary_email field)
 *
 * Example usage:
 * ```typescript
 * // Find developer by email
 * const dev = await resolveDeveloper('default', {
 *   kind: 'email',
 *   value: 'alice@example.com',
 * });
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function resolveDeveloper(
  tenantId: string,
  identifier: IdentifierLookupInput
): Promise<typeof schema.developers.$inferSelect | null> {
  // Implementation will be added in coding phase
  // 1. Normalize value
  // 2. Search in developer_identifiers
  // 3. Fallback to accounts table (email)
  // 4. Fallback to developers table (primary_email)
  throw new Error('Not implemented');
}

/**
 * Find potential duplicate developers
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param developerId - Developer ID to find duplicates for
 * @returns Array of potential duplicates with confidence scores
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Get all identifiers for the given developer
 * 2. For each identifier, search for other developers with matching identifiers
 * 3. Calculate confidence score based on:
 *    - Number of matching identifiers
 *    - Type of identifier (email > domain > click_id)
 *    - Existing confidence scores in identifiers table
 * 4. Return candidates sorted by confidence (highest first)
 *
 * Confidence scoring:
 * - Same email: 1.0 (exact match)
 * - Same domain: 0.7 (likely same organization)
 * - Same phone: 0.9 (high confidence)
 * - Same mlid: 0.95 (very high confidence, ML-based ID)
 * - Same click_id: 0.6 (medium confidence, anonymous tracking)
 * - Same key_fp: 0.85 (GPG/SSH key fingerprint)
 *
 * Multiple matches:
 * - If 2+ identifiers match, multiply confidence scores
 * - Example: email (1.0) + domain (0.7) = 0.85 combined confidence
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function findDuplicates(
  tenantId: string,
  developerId: string
): Promise<Array<{
  developer: typeof schema.developers.$inferSelect;
  confidence: number;
  matchedIdentifiers: Array<{
    kind: string;
    value: string;
    confidence: number;
  }>;
}>> {
  // Implementation will be added in coding phase
  // 1. Get developer's identifiers
  // 2. Search for other developers with matching identifiers
  // 3. Calculate confidence scores
  // 4. Return sorted by confidence
  throw new Error('Not implemented');
}

/**
 * Zod schema for merge operation
 *
 * Validates input data for mergeDevelopers().
 */
export const MergeDevelopersSchema = z.object({
  intoDeveloperId: z.string().uuid(),
  fromDeveloperId: z.string().uuid(),
  reason: z.string().optional(),
  mergedBy: z.string().uuid().nullable().optional(),
});

export type MergeDevelopersInput = z.infer<typeof MergeDevelopersSchema>;

/**
 * Merge two developer profiles
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param params - Merge parameters (into, from, reason, mergedBy)
 * @returns Merged developer record (into_developer_id)
 * @throws {Error} If validation fails, developers don't exist, or database error occurs
 *
 * Implementation details:
 * 1. Validate input using MergeDevelopersSchema
 * 2. Verify both developers exist and belong to the same tenant
 * 3. Start database transaction
 * 4. Move all identifiers from source to target developer
 *    - Update developer_identifiers.developer_id
 * 5. Move all accounts from source to target developer
 *    - Update accounts.developer_id
 * 6. Move all activities from source to target developer
 *    - Update activities.developer_id
 * 7. Merge metadata (tags, attributes) if needed
 * 8. Insert merge log into developer_merge_logs table
 * 9. Delete source developer record
 * 10. Commit transaction
 * 11. Return target developer
 *
 * Conflict resolution:
 * - If both developers have primary_email, prefer target's email
 * - Tags are merged (union of both sets)
 * - Display name: prefer target's name if set, otherwise use source's
 * - Organization: prefer target's org_id if set
 *
 * Audit trail:
 * - Record in developer_merge_logs table
 * - Include reason, evidence (matched identifiers), and merged_by user
 *
 * IMPORTANT: This is a destructive operation (deletes source developer)
 * - Consider soft delete alternative (add deleted_at column)
 * - Ensure proper backup before merge
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function mergeDevelopers(
  tenantId: string,
  params: MergeDevelopersInput
): Promise<typeof schema.developers.$inferSelect> {
  // Implementation will be added in coding phase
  // 1. Validate input
  // 2. Start transaction
  // 3. Move identifiers
  // 4. Move accounts
  // 5. Move activities
  // 6. Merge metadata
  // 7. Log merge
  // 8. Delete source developer
  // 9. Commit transaction
  throw new Error('Not implemented');
}

/**
 * Add identifier to developer
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param developerId - Developer ID to add identifier to
 * @param identifier - Identifier to add (kind + value)
 * @param confidence - Confidence score (0.0-1.0, default 1.0)
 * @returns Created identifier record
 * @throws {Error} If validation fails, duplicate identifier, or database error occurs
 *
 * Implementation details:
 * 1. Validate input
 * 2. Normalize value (lowercase, trim)
 * 3. Check for duplicate identifier (same kind + value_normalized)
 * 4. If duplicate exists and belongs to same developer, update confidence
 * 5. If duplicate exists and belongs to different developer, throw error (conflict)
 * 6. Insert into developer_identifiers table
 * 7. Set first_seen and last_seen timestamps
 * 8. Return created identifier
 *
 * Deduplication:
 * - Unique constraint on (tenant_id, kind, value_normalized)
 * - Prevents multiple developers claiming same identifier
 * - If conflict detected, suggest merge operation
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function addIdentifier(
  tenantId: string,
  developerId: string,
  identifier: IdentifierLookupInput,
  confidence: number = 1.0
): Promise<typeof schema.developerIdentifiers.$inferSelect> {
  // Implementation will be added in coding phase
  // 1. Normalize value
  // 2. Check for duplicates
  // 3. Handle conflicts
  // 4. Insert identifier
  throw new Error('Not implemented');
}

/**
 * Remove identifier from developer
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param identifierId - Identifier ID to remove
 * @returns True if deleted, false if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query identifier by identifier_id
 * 2. Verify it belongs to the tenant (RLS)
 * 3. Delete identifier record
 * 4. Return true if deleted, false if not found
 *
 * IMPORTANT: This is a hard delete (permanent removal)
 * - Consider soft delete for audit trail
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function removeIdentifier(
  tenantId: string,
  identifierId: string
): Promise<boolean> {
  // Implementation will be added in coding phase
  throw new Error('Not implemented');
}
```

---

## データモデル

### 1. `developer_identifiers` テーブル

開発者に関連付けられた識別子を管理します。

**主要フィールド**:
- `identifier_id` (UUID): 識別子ID（主キー）
- `tenant_id` (text): テナントID（外部キー）
- `developer_id` (UUID): 開発者ID（外部キー、cascade delete）
- `kind` (text): 識別子の種類（'email', 'domain', 'phone', 'mlid', 'click_id', 'key_fp'）
- `value_normalized` (text): 正規化された値（小文字化、トリム済み）
- `confidence` (numeric): 信頼度スコア（0.0-1.0、デフォルト1.0）
- `attributes` (jsonb): カスタム属性
- `first_seen` (timestamptz): 初回検出日時
- `last_seen` (timestamptz): 最終検出日時

**ユニーク制約**:
- `(tenant_id, kind, value_normalized)`: 同じ識別子を複数の開発者に重複登録不可

**インデックス**:
- `(tenant_id, developer_id)`: 開発者の識別子を高速検索

### 2. `developer_merge_logs` テーブル

開発者の統合履歴を記録します（監査ログ）。

**主要フィールド**:
- `merge_id` (UUID): マージID（主キー）
- `tenant_id` (text): テナントID（外部キー）
- `into_developer_id` (UUID): 統合先の開発者ID（外部キー）
- `from_developer_id` (UUID): 統合元の開発者ID（外部キー）
- `reason` (text): 統合理由（人間が読める形式）
- `evidence` (jsonb): 一致した属性と信頼度スコア
- `merged_at` (timestamptz): 統合実行日時（デフォルト: NOW()）
- `merged_by` (UUID): 統合を実行したユーザーID（外部キー、NULL = 自動統合）

**evidenceフィールドの例**:
```json
{
  "matched_identifiers": [
    { "kind": "email", "value": "alice@example.com", "confidence": 1.0 },
    { "kind": "domain", "value": "example.com", "confidence": 0.7 }
  ],
  "combined_confidence": 0.85,
  "method": "automatic"
}
```

### 3. `accounts` テーブル（参照）

外部サービスアカウント（GitHub、Slack等）を管理します。

**重要な関連**:
- `developer_id` フィールドで開発者と関連付け
- マージ時に `developer_id` を更新して統合先に移動
- `email` フィールドでメールアドレスマッチング可能

---

## マッチングロジック

### 1. 識別子の種類と信頼度

| kind | 説明 | 信頼度 | 例 |
|------|------|--------|-----|
| **email** | メールアドレス | 1.0 | alice@example.com |
| **phone** | 電話番号 | 0.9 | +81-90-1234-5678 |
| **mlid** | ML推定ID（機械学習ベース） | 0.95 | ml_abc123def456 |
| **key_fp** | GPG/SSH鍵のフィンガープリント | 0.85 | AA:BB:CC:DD:EE:FF |
| **domain** | ドメイン（組織推定） | 0.7 | example.com |
| **click_id** | 匿名トラッキングID | 0.6 | click_xyz789 |

### 2. 複数識別子のマッチング

複数の識別子が一致する場合、信頼度を掛け合わせて総合スコアを計算します。

**計算式**:
```
combined_confidence = 1 - (1 - conf1) * (1 - conf2) * ... * (1 - confN)
```

**例**:
- email (1.0) + domain (0.7) = `1 - (1 - 1.0) * (1 - 0.7)` = `1 - 0 * 0.3` = **1.0**
- domain (0.7) + click_id (0.6) = `1 - (1 - 0.7) * (1 - 0.6)` = `1 - 0.3 * 0.4` = **0.88**

### 3. 検索優先順位

`resolveDeveloper()` は以下の順序で検索します:

1. **developer_identifiers テーブル** (最優先)
   - `(tenant_id, kind, value_normalized)` でマッチング
   - 正規化された値で検索

2. **accounts テーブル** (email kind の場合)
   - `(tenant_id, email)` でマッチング
   - `developer_id` が NULL でないレコードを検索

3. **developers テーブル** (email kind の場合)
   - `(tenant_id, primary_email)` でマッチング
   - 直接メールアドレスで検索

### 4. 正規化ルール

識別子の値は検索前に正規化します:

```typescript
function normalizeValue(kind: string, value: string): string {
  // 1. Trim whitespace
  let normalized = value.trim();

  // 2. Lowercase (for email, domain)
  if (kind === 'email' || kind === 'domain') {
    normalized = normalized.toLowerCase();
  }

  // 3. Remove special characters (for phone)
  if (kind === 'phone') {
    normalized = normalized.replace(/[^0-9+]/g, '');
  }

  return normalized;
}
```

---

## 統合フロー

### 自動統合（Automatic Merge）

1. **重複検出**:
   - 新しいアクティビティが記録される
   - `resolveDeveloper()` で既存開発者を検索
   - 見つからない場合、新規開発者を作成

2. **信頼度判定**:
   - `findDuplicates()` で類似開発者を検索
   - 信頼度スコアが 0.9 以上の場合、自動統合候補とする

3. **統合実行**:
   - `mergeDevelopers()` を自動実行
   - `merged_by = NULL`（自動統合）
   - `reason = "Automatic merge based on identifier matching"`

### 手動統合（Manual Merge）

1. **候補リスト表示**:
   - UI上で `findDuplicates()` の結果を表示
   - ユーザーが統合対象を選択

2. **確認ダイアログ**:
   - 統合前に確認ダイアログを表示
   - 統合先・統合元の情報を表示

3. **統合実行**:
   - `mergeDevelopers()` を実行
   - `merged_by = {user_id}`（手動統合）
   - `reason = "Manual merge by admin"`

---

## セキュリティ考慮事項

### 1. テナント分離

- 全ての関数で `tenantId` パラメータを必須とする
- RLSにより、他のテナントのデータにアクセス不可
- マージ操作は同一テナント内のみ許可

### 2. 監査ログ

- `developer_merge_logs` テーブルに全ての統合を記録
- `merged_by` フィールドで操作者を追跡
- `evidence` フィールドに統合根拠を保存

### 3. トランザクション

- マージ操作は必ずトランザクション内で実行
- 途中でエラーが発生した場合、全てロールバック
- データ不整合を防止

### 4. 削除の慎重性

- マージ時に統合元の開発者を削除（破壊的操作）
- 将来的にはソフトデリート（`deleted_at` カラム）の検討
- バックアップの確保

---

## テスト方針

### 単体テスト（`core/services/identity.service.test.ts`）

Task 4.3の完了条件は「ID統合ロジックが単体テストでパスする」ことです。

#### 1. `resolveDeveloper()` のテスト

```typescript
describe('resolveDeveloper', () => {
  it('should find developer by email identifier', async () => {
    // Arrange: Create developer with email identifier
    const dev = await createDeveloper('default', {
      displayName: 'Test Developer',
      primaryEmail: 'test@example.com',
      orgId: null,
    });
    await addIdentifier('default', dev.developerId, {
      kind: 'email',
      value: 'test@example.com',
    });

    // Act: Resolve by email
    const result = await resolveDeveloper('default', {
      kind: 'email',
      value: 'test@example.com',
    });

    // Assert: Should find the developer
    expect(result).not.toBeNull();
    expect(result?.developerId).toBe(dev.developerId);
  });

  it('should return null if identifier not found', async () => {
    // Act: Try to resolve non-existent identifier
    const result = await resolveDeveloper('default', {
      kind: 'email',
      value: 'nonexistent@example.com',
    });

    // Assert: Should return null
    expect(result).toBeNull();
  });

  it('should normalize email (case-insensitive)', async () => {
    // Arrange: Create with lowercase email
    const dev = await createDeveloper('default', {
      displayName: 'Test',
      primaryEmail: 'test@example.com',
      orgId: null,
    });
    await addIdentifier('default', dev.developerId, {
      kind: 'email',
      value: 'test@example.com',
    });

    // Act: Search with uppercase email
    const result = await resolveDeveloper('default', {
      kind: 'email',
      value: 'TEST@EXAMPLE.COM',
    });

    // Assert: Should find developer (case-insensitive)
    expect(result?.developerId).toBe(dev.developerId);
  });
});
```

#### 2. `findDuplicates()` のテスト

```typescript
describe('findDuplicates', () => {
  it('should find duplicates with matching email', async () => {
    // Arrange: Create two developers with same email
    const dev1 = await createDeveloper('default', {
      displayName: 'Developer 1',
      primaryEmail: 'shared@example.com',
      orgId: null,
    });
    const dev2 = await createDeveloper('default', {
      displayName: 'Developer 2',
      primaryEmail: 'shared@example.com',
      orgId: null,
    });

    // Act: Find duplicates for dev1
    const duplicates = await findDuplicates('default', dev1.developerId);

    // Assert: Should find dev2 as duplicate
    expect(duplicates.length).toBe(1);
    expect(duplicates[0]!.developer.developerId).toBe(dev2.developerId);
    expect(duplicates[0]!.confidence).toBeGreaterThan(0.9);
  });

  it('should calculate confidence for multiple matching identifiers', async () => {
    // Arrange: Create developers with multiple matching identifiers
    // ... (implementation details)

    // Assert: Confidence should be combined
    expect(duplicates[0]!.confidence).toBeGreaterThan(0.8);
  });

  it('should return empty array if no duplicates found', async () => {
    // Arrange: Create developer with unique identifiers
    const dev = await createDeveloper('default', {
      displayName: 'Unique Developer',
      primaryEmail: 'unique@example.com',
      orgId: null,
    });

    // Act: Find duplicates
    const duplicates = await findDuplicates('default', dev.developerId);

    // Assert: Should return empty array
    expect(duplicates).toEqual([]);
  });
});
```

#### 3. `mergeDevelopers()` のテスト

```typescript
describe('mergeDevelopers', () => {
  it('should merge two developers successfully', async () => {
    // Arrange: Create two developers
    const target = await createDeveloper('default', {
      displayName: 'Target Developer',
      primaryEmail: 'target@example.com',
      orgId: null,
    });
    const source = await createDeveloper('default', {
      displayName: 'Source Developer',
      primaryEmail: 'source@example.com',
      orgId: null,
    });

    // Add identifiers to source
    await addIdentifier('default', source.developerId, {
      kind: 'email',
      value: 'source@example.com',
    });

    // Act: Merge source into target
    const result = await mergeDevelopers('default', {
      intoDeveloperId: target.developerId,
      fromDeveloperId: source.developerId,
      reason: 'Test merge',
    });

    // Assert: Should return target developer
    expect(result.developerId).toBe(target.developerId);

    // Source developer should be deleted
    const sourceAfterMerge = await getDeveloper('default', source.developerId);
    expect(sourceAfterMerge).toBeNull();

    // Identifiers should be moved to target
    const targetIdentifiers = await db
      .select()
      .from(schema.developerIdentifiers)
      .where(eq(schema.developerIdentifiers.developerId, target.developerId));
    expect(targetIdentifiers.length).toBeGreaterThan(0);
  });

  it('should create merge log record', async () => {
    // Arrange: Create developers
    // ... (setup)

    // Act: Merge
    await mergeDevelopers('default', {
      intoDeveloperId: target.developerId,
      fromDeveloperId: source.developerId,
      reason: 'Test merge',
      mergedBy: null, // automatic merge
    });

    // Assert: Merge log should be created
    const mergeLogs = await db
      .select()
      .from(schema.developerMergeLogs)
      .where(eq(schema.developerMergeLogs.intoDeveloperId, target.developerId));
    expect(mergeLogs.length).toBe(1);
    expect(mergeLogs[0]!.reason).toBe('Test merge');
  });

  it('should rollback on error (transaction test)', async () => {
    // Test transaction rollback on failure
  });

  it('should throw error if developers are from different tenants', async () => {
    // Test tenant isolation
  });
});
```

#### 4. `addIdentifier()` のテスト

```typescript
describe('addIdentifier', () => {
  it('should add identifier to developer', async () => {
    // Arrange: Create developer
    const dev = await createDeveloper('default', {
      displayName: 'Test',
      primaryEmail: 'test@example.com',
      orgId: null,
    });

    // Act: Add identifier
    const identifier = await addIdentifier('default', dev.developerId, {
      kind: 'email',
      value: 'test@example.com',
    }, 1.0);

    // Assert: Identifier should be created
    expect(identifier.developerId).toBe(dev.developerId);
    expect(identifier.kind).toBe('email');
    expect(identifier.valueNormalized).toBe('test@example.com');
  });

  it('should throw error on duplicate identifier (different developer)', async () => {
    // Arrange: Create two developers
    const dev1 = await createDeveloper('default', { /* ... */ });
    const dev2 = await createDeveloper('default', { /* ... */ });

    // Add identifier to dev1
    await addIdentifier('default', dev1.developerId, {
      kind: 'email',
      value: 'shared@example.com',
    });

    // Act & Assert: Adding same identifier to dev2 should fail
    await expect(
      addIdentifier('default', dev2.developerId, {
        kind: 'email',
        value: 'shared@example.com',
      })
    ).rejects.toThrow(/duplicate|conflict/i);
  });
});
```

### テスト環境セットアップ

```typescript
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { setTenantContext, clearTenantContext, closeDb } from '../db/connection';
import { getDb } from '../db/connection';
import * as schema from '../db/schema';

describe('Identity Service', () => {
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
    const db = getDb();
    await db.delete(schema.developerIdentifiers);
    await db.delete(schema.developerMergeLogs);
    await db.delete(schema.developers);
  });
});
```

---

## エラーハンドリング

### エラーの種類と対応

| エラーの種類 | 対応 | HTTPステータス（参考） |
|-------------|------|---------------------|
| **バリデーションエラー** | ZodErrorをキャッチし、フィールド別エラーメッセージを返す | 400 Bad Request |
| **識別子重複エラー** | 異なる開発者が同じ識別子を持つ場合、統合を提案 | 409 Conflict |
| **開発者不存在エラー** | 統合対象の開発者が存在しない場合 | 404 Not Found |
| **同一開発者統合エラー** | 統合元と統合先が同じ場合 | 400 Bad Request |
| **テナント不一致エラー** | 異なるテナントの開発者を統合しようとした場合 | 403 Forbidden |
| **トランザクションエラー** | 統合中にエラーが発生した場合、ロールバック | 500 Internal Server Error |

---

## 完了チェックリスト

- [ ] `core/services/identity.service.ts` ファイル作成
- [ ] Zodスキーマ定義（`IdentifierLookupSchema`, `MergeDevelopersSchema`）
- [ ] `resolveDeveloper()` 実装
- [ ] `findDuplicates()` 実装
- [ ] `mergeDevelopers()` 実装（トランザクション処理含む）
- [ ] `addIdentifier()` 実装
- [ ] `removeIdentifier()` 実装
- [ ] 単体テストファイル作成（`core/services/identity.service.test.ts`）
- [ ] `resolveDeveloper()` のテスト（正常系・異常系）
- [ ] `findDuplicates()` のテスト（信頼度計算を含む）
- [ ] `mergeDevelopers()` のテスト（トランザクション、監査ログ確認）
- [ ] `addIdentifier()` のテスト（重複検出含む）
- [ ] 全テストが成功（`pnpm test`）
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] Lintエラーなし（`pnpm lint`）

---

## 次のタスク

Task 4.3完了後、以下のタスクに進みます:

- **Task 4.4**: Activityサービス実装
- **Task 4.5**: Activity API実装（Remix loader/action）

---

## 参考資料

- [Drizzle ORM Transactions](https://orm.drizzle.team/docs/transactions)
- [Zod Documentation](https://zod.dev/)
- [PostgreSQL Foreign Keys and Cascade](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- [Identity Resolution in CRM](https://en.wikipedia.org/wiki/Identity_resolution)
