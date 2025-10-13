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
 * Zod schema for account lookup (primary method)
 *
 * Validates input data for resolveDeveloperByAccount().
 * This is the PRIMARY matching method for most use cases.
 */
export const AccountLookupSchema = z.object({
  provider: z.string().min(1), // 'github', 'slack', 'discord', 'x', etc.
  externalUserId: z.string().min(1), // Provider-specific user ID
});

export type AccountLookupInput = z.infer<typeof AccountLookupSchema>;

/**
 * Zod schema for identifier lookup (secondary method)
 *
 * Validates input data for resolveDeveloperByIdentifier().
 * Used for email, phone, and other non-account identifiers.
 */
export const IdentifierLookupSchema = z.object({
  kind: z.enum(['email', 'domain', 'phone', 'mlid', 'click_id', 'key_fp']),
  value: z.string().min(1),
});

export type IdentifierLookupInput = z.infer<typeof IdentifierLookupSchema>;

/**
 * Resolve developer by external service account (PRIMARY METHOD)
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param account - Account to search (provider + externalUserId)
 * @returns Developer record if found, null otherwise
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using AccountLookupSchema
 * 2. Query accounts table by (tenant_id, provider, external_user_id)
 * 3. If found and developer_id is not null, return associated developer
 * 4. Return null if no match found
 *
 * This is the PRIMARY matching method because:
 * - Most external services provide account IDs (GitHub, Slack, Discord, X, etc.)
 * - Account IDs are stable and unique per provider
 * - Confidence is 1.0 (provider guarantees identity)
 * - Email addresses are rarely available from external services
 *
 * Example usage:
 * ```typescript
 * // Find developer by GitHub account
 * const dev = await resolveDeveloperByAccount('default', {
 *   provider: 'github',
 *   externalUserId: '12345678',
 * });
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function resolveDeveloperByAccount(
  tenantId: string,
  account: AccountLookupInput
): Promise<typeof schema.developers.$inferSelect | null> {
  // Implementation will be added in coding phase
  // 1. Validate input
  // 2. Query accounts table by (tenant_id, provider, external_user_id)
  // 3. Return associated developer if found
  throw new Error('Not implemented');
}

/**
 * Resolve developer by identifier (SECONDARY METHOD)
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
 * 5. If kind is 'email', fallback to accounts.email field
 * 6. If kind is 'email', fallback to developers.primary_email field
 * 7. Return null if no match found
 *
 * Matching priority for email:
 * 1. developer_identifiers table (highest priority)
 * 2. accounts table (email field)
 * 3. developers table (primary_email field)
 *
 * Note: Email matching is less common because:
 * - Most external services don't provide email addresses
 * - Email is mainly obtained through business cards or contact forms
 * - When email DOES match, confidence is 1.0 (100% same person)
 *
 * Example usage:
 * ```typescript
 * // Find developer by email (rare case)
 * const dev = await resolveDeveloperByIdentifier('default', {
 *   kind: 'email',
 *   value: 'alice@example.com',
 * });
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function resolveDeveloperByIdentifier(
  tenantId: string,
  identifier: IdentifierLookupInput
): Promise<typeof schema.developers.$inferSelect | null> {
  // Implementation will be added in coding phase
  // 1. Normalize value
  // 2. Search in developer_identifiers
  // 3. If email, fallback to accounts.email
  // 4. If email, fallback to developers.primary_email
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
 * 1. Get all accounts and identifiers for the given developer
 * 2. For each account/identifier, search for other developers with matches
 * 3. Calculate confidence score based on:
 *    - Type of match (account > email > other identifiers)
 *    - Number of matching items
 *    - Existing confidence scores in identifiers table
 * 4. Return candidates sorted by confidence (highest first)
 *
 * Confidence scoring (base confidence):
 * - Same account (provider + external_user_id): 1.0 (provider-guaranteed identity)
 * - Same email: 1.0 (exact match, 100% same person)
 * - Same mlid: 0.95 (very high confidence, ML-based ID)
 * - Same phone: 0.9 (high confidence)
 * - Same key_fp: 0.85 (GPG/SSH key fingerprint)
 * - Same domain: 0.7 (likely same organization)
 * - Same click_id: 0.6 (medium confidence, anonymous tracking)
 *
 * Multiple matches (combined confidence):
 * - Combine confidences with: combined = 1 - product(1 - conf_i)
 * - Formula: combined = 1 - (1 - conf1) * (1 - conf2) * ... * (1 - confN)
 * - Example: email (1.0) + domain (0.7) = 1 - (0.0 * 0.3) = 1.0
 * - Example: domain (0.7) + click_id (0.6) = 1 - (0.3 * 0.4) = 0.88
 * - Example: account (1.0) + anything = 1.0 (already certain)
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
- `kind` (text): 識別子の種類（'email', 'domain', 'phone', 'mlid', 'click_id', 'key_fp', 'account_name', 'display_name'）
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
  "combined_confidence": 1.0,
  "method": "automatic"
}
```

**注**: email (1.0) + domain (0.7) の組み合わせは `1 - (0.0 * 0.3) = 1.0` になります。

### 3. `accounts` テーブル（参照）

外部サービスアカウント（GitHub、Slack等）を管理します。

**重要な関連**:
- `developer_id` フィールドで開発者と関連付け
- マージ時に `developer_id` を更新して統合先に移動
- `email` フィールドでメールアドレスマッチング可能

---

## マッチングロジック

### 1. マッチング手法の優先順位

DevRel活動では、**外部サービスのアカウントID**での一致が最も一般的です。

**優先順位**:
1. **accounts テーブル** (provider + external_user_id) - **主力マッチング手法**
2. **developer_identifiers テーブル** (email等) - **副次的手法**

**理由**:
- ほとんどの外部サービス（GitHub、Slack、Discord、X等）はアカウントIDを提供する
- メールアドレスは名刺交換やお問い合わせフォームでしか取得できない
- アカウントIDはプロバイダーが保証しているため信頼度100%

### 2. 信頼度スコア

| マッチング種別 | 信頼度 | 説明 | 例 |
| ------------ | ------ | ---- | -- |
| **Account ID** | **1.0** | **外部サービスのアカウントID（プロバイダー保証）** | **GitHub ID: 12345678** |
| **email** | **1.0** | **メールアドレス（一致すれば100%同一人物）** | **alice@example.com** |
| **mlid** | 0.95 | ML推定ID（機械学習ベース） | ml_abc123def456 |
| **phone** | 0.9 | 電話番号 | +81-90-1234-5678 |
| **key_fp** | 0.85 | GPG/SSH鍵のフィンガープリント | AA:BB:CC:DD:EE:FF |
| **domain** | 0.7 | ドメイン（組織推定） | example.com |
| **click_id** | 0.6 | 匿名トラッキングID | click_xyz789 |

**重要な注意**:
- **Account ID**: プロバイダーが保証しているため信頼度1.0（GitHub ID、Slack ID等）
- **Email**: 一致していれば100%同一人物なので信頼度1.0（ただし取得機会は限定的）
- **その他**: 推測ベースなので1.0未満

### 3. 複数マッチングの信頼度計算

複数の識別子が一致する場合、以下の数式で信頼度を組み合わせて総合スコアを計算します。

**数式**:
```
combined = 1 - product(1 - conf_i)
```

詳細:
```
combined_confidence = 1 - (1 - conf1) * (1 - conf2) * ... * (1 - confN)
```

**例**:
- email (1.0) + domain (0.7) = `1 - (0.0 * 0.3)` = **1.0**（100%確信）
- Account ID (1.0) + 何か = **1.0**（既に100%確信しているので変わらない）
- domain (0.7) + click_id (0.6) = `1 - (0.3 * 0.4)` = **0.88**
- phone (0.9) + domain (0.7) = `1 - (0.1 * 0.3)` = **0.97**

### 4. 検索戦略

#### 主力手法: `resolveDeveloperByAccount()`

**ユースケース**: 外部サービスからのアクティビティ記録（最も一般的）

```typescript
// GitHub からのイベント
const dev = await resolveDeveloperByAccount('default', {
  provider: 'github',
  externalUserId: '12345678', // GitHub user ID
});

// Slack からのメッセージ
const dev = await resolveDeveloperByAccount('default', {
  provider: 'slack',
  externalUserId: 'U01ABC123', // Slack user ID
});
```

**検索順序**:
1. **accounts テーブル**: `(tenant_id, provider, external_user_id)` で検索
2. `developer_id` が NULL でない場合、関連する開発者を返す
3. 見つからない場合は null を返す

#### 副次的手法: `resolveDeveloperByIdentifier()`

**ユースケース**: メール、電話番号等（限定的）

```typescript
// 名刺交換でメールアドレスを取得した場合（レアケース）
const dev = await resolveDeveloperByIdentifier('default', {
  kind: 'email',
  value: 'alice@example.com',
});
```

**検索順序（email の場合）**:
1. **developer_identifiers テーブル**: `(tenant_id, kind='email', value_normalized)` で検索
2. **accounts テーブル**: `(tenant_id, email)` で検索（フォールバック）
3. **developers テーブル**: `(tenant_id, primary_email)` で検索（最終フォールバック）

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
   - 新しいアクティビティが記録される（例: GitHub イベント）
   - `resolveDeveloperByAccount()` で既存開発者を検索（主力）
   - 見つからない場合、新規開発者を作成

2. **信頼度判定**:
   - `findDuplicates()` で類似開発者を検索
   - 信頼度スコアが 0.9 以上の場合、自動統合候補とする
   - Account ID や Email が一致する場合は信頼度 1.0 なので即座に統合可能

3. **統合実行**:
   - `mergeDevelopers()` を自動実行
   - `merged_by = NULL`（自動統合）
   - `reason = "Automatic merge based on account/identifier matching"`

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

#### 1. `resolveDeveloperByAccount()` のテスト（主力マッチング手法）

```typescript
describe('resolveDeveloperByAccount', () => {
  it('should find developer by GitHub account ID', async () => {
    // Arrange: Create developer and link GitHub account
    const dev = await createDeveloper('default', {
      displayName: 'Test Developer',
      primaryEmail: null,
      orgId: null,
    });

    // Add GitHub account to accounts table
    await db.insert(schema.accounts).values({
      tenantId: 'default',
      developerId: dev.developerId,
      provider: 'github',
      externalUserId: '12345678',
      handle: 'testdev',
    });

    // Act: Resolve by GitHub account
    const result = await resolveDeveloperByAccount('default', {
      provider: 'github',
      externalUserId: '12345678',
    });

    // Assert: Should find the developer
    expect(result).not.toBeNull();
    expect(result?.developerId).toBe(dev.developerId);
  });

  it('should return null if account not found', async () => {
    // Act: Try to resolve non-existent account
    const result = await resolveDeveloperByAccount('default', {
      provider: 'github',
      externalUserId: '99999999',
    });

    // Assert: Should return null
    expect(result).toBeNull();
  });

  it('should return null if account exists but not linked to developer', async () => {
    // Arrange: Create account without developer_id
    await db.insert(schema.accounts).values({
      tenantId: 'default',
      developerId: null, // Not linked
      provider: 'slack',
      externalUserId: 'U01ABC123',
      handle: 'testuser',
    });

    // Act: Try to resolve
    const result = await resolveDeveloperByAccount('default', {
      provider: 'slack',
      externalUserId: 'U01ABC123',
    });

    // Assert: Should return null (no developer linked)
    expect(result).toBeNull();
  });

  it('should work with different providers', async () => {
    // Test GitHub, Slack, Discord, X, etc.
    const providers = ['github', 'slack', 'discord', 'x'];
    // ... (implementation)
  });
});
```

#### 2. `resolveDeveloperByIdentifier()` のテスト（副次的マッチング手法）

```typescript
describe('resolveDeveloperByIdentifier', () => {
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
    const result = await resolveDeveloperByIdentifier('default', {
      kind: 'email',
      value: 'test@example.com',
    });

    // Assert: Should find the developer
    expect(result).not.toBeNull();
    expect(result?.developerId).toBe(dev.developerId);
  });

  it('should return null if identifier not found', async () => {
    // Act: Try to resolve non-existent identifier
    const result = await resolveDeveloperByIdentifier('default', {
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
    const result = await resolveDeveloperByIdentifier('default', {
      kind: 'email',
      value: 'TEST@EXAMPLE.COM',
    });

    // Assert: Should find developer (case-insensitive)
    expect(result?.developerId).toBe(dev.developerId);
  });
});
```

#### 3. `findDuplicates()` のテスト

```typescript
describe('findDuplicates', () => {
  it('should find duplicates with matching GitHub account', async () => {
    // Arrange: Create two developers with same GitHub account (should not happen, but test for detection)
    const dev1 = await createDeveloper('default', {
      displayName: 'Developer 1',
      primaryEmail: null,
      orgId: null,
    });
    const dev2 = await createDeveloper('default', {
      displayName: 'Developer 2',
      primaryEmail: null,
      orgId: null,
    });

    // Add same GitHub account to both (duplicate situation)
    await db.insert(schema.accounts).values([
      {
        tenantId: 'default',
        developerId: dev1.developerId,
        provider: 'github',
        externalUserId: '12345678',
        handle: 'shareduser',
      },
      {
        tenantId: 'default',
        developerId: dev2.developerId,
        provider: 'github',
        externalUserId: '12345678',
        handle: 'shareduser',
      },
    ]);

    // Act: Find duplicates for dev1
    const duplicates = await findDuplicates('default', dev1.developerId);

    // Assert: Should find dev2 as duplicate with confidence 1.0
    expect(duplicates.length).toBe(1);
    expect(duplicates[0]!.developer.developerId).toBe(dev2.developerId);
    expect(duplicates[0]!.confidence).toBe(1.0); // Account match = 100% confidence
  });

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

    // Assert: Should find dev2 as duplicate with confidence 1.0
    expect(duplicates.length).toBe(1);
    expect(duplicates[0]!.developer.developerId).toBe(dev2.developerId);
    expect(duplicates[0]!.confidence).toBe(1.0); // Email match = 100% confidence
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

#### 4. `mergeDevelopers()` のテスト

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

#### 5. `addIdentifier()` のテスト

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
- [ ] Zodスキーマ定義（`AccountLookupSchema`, `IdentifierLookupSchema`, `MergeDevelopersSchema`）
- [ ] `resolveDeveloperByAccount()` 実装（主力マッチング手法）
- [ ] `resolveDeveloperByIdentifier()` 実装（副次的マッチング手法）
- [ ] `findDuplicates()` 実装（accounts + identifiers の両方を検索）
- [ ] `mergeDevelopers()` 実装（トランザクション処理含む）
- [ ] `addIdentifier()` 実装
- [ ] `removeIdentifier()` 実装
- [ ] 単体テストファイル作成（`core/services/identity.service.test.ts`）
- [ ] `resolveDeveloperByAccount()` のテスト（正常系・異常系）
- [ ] `resolveDeveloperByIdentifier()` のテスト（正常系・異常系）
- [ ] `findDuplicates()` のテスト（信頼度計算、account + email マッチング）
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
