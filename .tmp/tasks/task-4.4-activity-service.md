# Task 4.4: Activityサービス実装

**タスク番号**: 4.4
**依存タスク**: Task 4.1（DRMサービス基盤実装）
**推定時間**: 2時間
**完了条件**: サービス関数が単体テストでパスする

---

## 概要

開発者のアクティビティ（活動）を記録・取得する機能を実装します。アクティビティは、開発者が行った全ての行動（クリック、イベント参加、投稿、閲覧、サインアップ等）を時系列で記録し、DevRel分析の基盤となるデータです。

**Phase 4の位置づけ**:
Phase 4はDRMのコア機能を実装するフェーズです。Task 4.4では、アクティビティの記録と検索機能を実現します。

**重要**: このタスクではインターフェースの定義とロジック説明のみを行い、実装は後のレビュー後に行います。

---

## 実装するファイルとインターフェース

### 1. `core/services/activity.service.ts`

開発者のアクティビティを記録・取得するサービス。

```typescript
/**
 * Activity Service - Developer Activity Management
 *
 * Provides business logic for recording and retrieving developer activities.
 * Activities are the foundation of DevRel analytics, tracking all developer actions.
 *
 * Architecture:
 * - Remix loader/action -> Activity Service -> Drizzle ORM -> PostgreSQL
 * - All functions are async and return Promise
 * - RLS (Row Level Security) enforced for tenant isolation
 * - Time-series data with optimized indexes
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { z } from 'zod';
import { eq, and, sql, desc, asc, gte, lte } from 'drizzle-orm';

/**
 * Zod schema for creating activity
 *
 * Validates input data for createActivity().
 */
export const CreateActivitySchema = z.object({
  developerId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  anonId: z.string().nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
  action: z.string().min(1),
  occurredAt: z.date(),
  source: z.string().min(1),
  sourceRef: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  groupKey: z.string().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  dedupKey: z.string().nullable().optional(),
});

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;

/**
 * Zod schema for listing activities
 *
 * Validates query parameters for listActivities().
 */
export const ListActivitiesSchema = z.object({
  developerId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  action: z.string().optional(),
  source: z.string().optional(),
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  orderBy: z.enum(['occurred_at', 'recorded_at', 'ingested_at']).default('occurred_at'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

export type ListActivitiesInput = z.infer<typeof ListActivitiesSchema>;

/**
 * Create new activity
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param data - Activity data
 * @returns Created activity record
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using CreateActivitySchema
 * 2. Validate that at least one of (developerId, accountId, anonId) is provided
 * 3. Generate UUID for activity_id
 * 4. Insert into activities table
 * 5. Return created activity record
 *
 * Identity Resolution:
 * - If accountId is provided, try to resolve developerId using resolveDeveloperByAccount()
 * - If developerId cannot be resolved, keep it NULL (will be resolved later)
 * - anonId is used for anonymous tracking (click_id, QR code, etc.)
 *
 * Deduplication:
 * - If dedupKey is provided, use it to prevent duplicate events
 * - dedupKey should be a hash of (source, source_ref, occurred_at, action)
 * - Unique constraint on dedup_key prevents duplicates
 *
 * Example usage:
 * ```typescript
 * // Record GitHub star event
 * const activity = await createActivity('default', {
 *   accountId: '550e8400-e29b-41d4-a716-446655440000',
 *   action: 'star',
 *   occurredAt: new Date('2025-01-15T10:30:00Z'),
 *   source: 'github',
 *   sourceRef: 'https://github.com/user/repo/stargazers',
 *   category: 'oss_contribution',
 *   metadata: {
 *     repo: 'user/repo',
 *     language: 'typescript',
 *   },
 * });
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function createActivity(
  tenantId: string,
  data: CreateActivityInput
): Promise<typeof schema.activities.$inferSelect> {
  // Implementation will be added in coding phase
  // 1. Validate input
  // 2. Validate at least one ID is provided
  // 3. Optionally resolve developerId from accountId
  // 4. Insert activity record
  // 5. Return created activity
  throw new Error('Not implemented');
}

/**
 * List activities with filters
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param params - Query parameters (filters, pagination, sort)
 * @returns Array of activities matching the filters
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using ListActivitiesSchema
 * 2. Build WHERE clause based on filters
 *    - developerId: Filter by developer_id
 *    - accountId: Filter by account_id
 *    - resourceId: Filter by resource_id
 *    - action: Filter by action
 *    - source: Filter by source
 *    - fromDate: Filter occurred_at >= fromDate
 *    - toDate: Filter occurred_at <= toDate
 * 3. Apply ORDER BY clause (occurred_at DESC by default)
 * 4. Apply LIMIT and OFFSET for pagination
 * 5. Return activities array
 *
 * Index optimization:
 * - (tenant_id, developer_id, occurred_at DESC) for per-developer queries
 * - (tenant_id, resource_id, occurred_at DESC) for per-resource queries
 * - (tenant_id, action, occurred_at DESC) for per-action queries
 * - (tenant_id, occurred_at DESC) for time-series queries
 *
 * Example usage:
 * ```typescript
 * // Get all activities for a developer in the last 30 days
 * const activities = await listActivities('default', {
 *   developerId: '550e8400-e29b-41d4-a716-446655440000',
 *   fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
 *   limit: 100,
 *   orderBy: 'occurred_at',
 *   orderDirection: 'desc',
 * });
 *
 * // Get all 'signup' activities in January 2025
 * const signups = await listActivities('default', {
 *   action: 'signup',
 *   fromDate: new Date('2025-01-01'),
 *   toDate: new Date('2025-01-31'),
 * });
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function listActivities(
  tenantId: string,
  params: ListActivitiesInput = {}
): Promise<Array<typeof schema.activities.$inferSelect>> {
  // Implementation will be added in coding phase
  // 1. Validate input
  // 2. Build WHERE clause with filters
  // 3. Apply ORDER BY, LIMIT, OFFSET
  // 4. Return activities array
  throw new Error('Not implemented');
}
```

---

## データモデル

### `activities` テーブル

開発者/アカウントの全アクティビティを記録するイベントログ。DevRel分析システムの心臓部。

**主要フィールド**:
- `activity_id` (UUID): アクティビティID（主キー）
- `tenant_id` (text): テナントID（外部キー、cascade delete）
- `developer_id` (UUID): 開発者ID（外部キー、set null on delete、NULL許可）
- `account_id` (UUID): アカウントID（外部キー、set null on delete、**最重要フィールド**）
- `anon_id` (text): 匿名ID（click_id、QRコード等）
- `resource_id` (UUID): リソースID（外部キー、set null on delete）
- `action` (text): アクションタイプ（"click", "attend", "post", "view", "signup" 等）
- `occurred_at` (timestamptz): アクション発生日時（**NOT NULL**）
- `recorded_at` (timestamptz): 記録日時（デフォルト: NOW()）
- `source` (text): データソース（"ga", "posthog", "github", "slack", "csv" 等）
- `source_ref` (text): ソース側のIDまたはURL
- `category` (text): キャッシュ用カテゴリ（非正規化）
- `group_key` (text): キャッシュ用グループキー（非正規化）
- `metadata` (jsonb): メタデータ（UTMパラメータ、デバイス、位置情報等）
- `confidence` (numeric): データ信頼度（0.0-1.0、デフォルト: 1.0）
- `dedup_key` (text): 重複排除キー（ユニーク制約）
- `ingested_at` (timestamptz): データ取り込み日時（デフォルト: NOW()）

**インデックス**:
- `(tenant_id, occurred_at DESC)`: 時系列クエリ用
- `(tenant_id, developer_id, occurred_at DESC)`: 開発者別アクティビティ用
- `(tenant_id, resource_id, occurred_at DESC)`: リソース別アクティビティ用
- `(tenant_id, action, occurred_at DESC)`: アクション別クエリ用
- GIN index on `metadata`: JSONBクエリ用（マイグレーションで手動追加）

**重要な注意**:
- `account_id`は外部アカウント（GitHub、Slack等）を追跡するための最重要フィールド
- `developer_id`はID統合前はNULLの可能性あり（後で解決）
- `occurred_at`は実際のイベント発生時刻、`recorded_at`は記録時刻（データ遅延の把握用）

---

## アクションタイプ

DevRel活動で記録される代表的なアクションタイプ:

### 1. 認知（Awareness）
- `"click"`: リンククリック、広告クリック
- `"view"`: ページ閲覧、ドキュメント閲覧
- `"download"`: ダウンロード（SDK、ツール等）
- `"attend"`: イベント参加（オンライン/オフライン）

### 2. エンゲージメント（Engagement）
- `"signup"`: サインアップ、アカウント作成
- `"post"`: 投稿（フォーラム、SNS等）
- `"comment"`: コメント
- `"reaction"`: リアクション（いいね、スター等）
- `"share"`: シェア、リツイート

### 3. 導入（Adoption）
- `"api_call"`: API呼び出し
- `"deploy"`: デプロイ
- `"integration"`: 統合、連携設定
- `"purchase"`: 購入、サブスクリプション

### 4. 支援（Advocacy）
- `"contribution"`: コントリビューション（PR、Issue等）
- `"presentation"`: 登壇、プレゼンテーション
- `"article"`: 記事執筆（ブログ、技術記事等）
- `"recommend"`: 推薦、紹介

**注意**: アクションタイプは任意の文字列で、プロジェクトに応じてカスタマイズ可能です。

---

## フィルタリング機能

### 1. 開発者別フィルタ

```typescript
// 特定の開発者の全アクティビティを取得
const activities = await listActivities('default', {
  developerId: '550e8400-e29b-41d4-a716-446655440000',
  limit: 100,
});
```

### 2. 日付範囲フィルタ

```typescript
// 2025年1月のアクティビティを取得
const activities = await listActivities('default', {
  fromDate: new Date('2025-01-01'),
  toDate: new Date('2025-01-31'),
});
```

### 3. アクション別フィルタ

```typescript
// 全てのサインアップアクティビティを取得
const signups = await listActivities('default', {
  action: 'signup',
});
```

### 4. ソース別フィルタ

```typescript
// GitHubからのアクティビティのみを取得
const githubActivities = await listActivities('default', {
  source: 'github',
});
```

### 5. 複合フィルタ

```typescript
// 特定の開発者の、過去30日間の、GitHubでのアクティビティ
const activities = await listActivities('default', {
  developerId: '550e8400-e29b-41d4-a716-446655440000',
  source: 'github',
  fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  limit: 50,
  orderBy: 'occurred_at',
  orderDirection: 'desc',
});
```

---

## テスト方針

### 単体テスト（`core/services/activity.service.test.ts`）

Task 4.4の完了条件は「サービス関数が単体テストでパスする」ことです。

#### 1. `createActivity()` のテスト

```typescript
describe('createActivity', () => {
  it('should create activity with developer_id', async () => {
    // Arrange: Create developer
    const dev = await createDeveloper('default', {
      displayName: 'Test Developer',
      primaryEmail: 'test@example.com',
      orgId: null,
    });

    // Act: Create activity
    const activity = await createActivity('default', {
      developerId: dev.developerId,
      action: 'view',
      occurredAt: new Date(),
      source: 'web',
      confidence: 1.0,
    });

    // Assert: Activity should be created
    expect(activity.developerId).toBe(dev.developerId);
    expect(activity.action).toBe('view');
  });

  it('should create activity with account_id', async () => {
    // Arrange: Create developer and account
    const dev = await createDeveloper('default', {
      displayName: 'Test Developer',
      primaryEmail: null,
      orgId: null,
    });

    const db = getDb();
    const [account] = await db.insert(schema.accounts).values({
      accountId: crypto.randomUUID(),
      tenantId: 'default',
      developerId: dev.developerId,
      provider: 'github',
      externalUserId: '12345678',
      handle: 'testdev',
    }).returning();

    // Act: Create activity with account_id
    const activity = await createActivity('default', {
      accountId: account.accountId,
      action: 'star',
      occurredAt: new Date(),
      source: 'github',
      sourceRef: 'https://github.com/user/repo',
      metadata: { repo: 'user/repo' },
    });

    // Assert: Activity should be created
    expect(activity.accountId).toBe(account.accountId);
    expect(activity.action).toBe('star');
  });

  it('should create activity with anon_id (anonymous tracking)', async () => {
    // Act: Create anonymous activity
    const activity = await createActivity('default', {
      anonId: 'click_abc123',
      action: 'click',
      occurredAt: new Date(),
      source: 'shortlink',
      metadata: { campaign: 'summer2025' },
    });

    // Assert: Activity should be created
    expect(activity.anonId).toBe('click_abc123');
    expect(activity.developerId).toBeNull();
  });

  it('should throw error if no ID provided', async () => {
    // Act & Assert: Creating activity without any ID should fail
    await expect(
      createActivity('default', {
        // No developerId, accountId, or anonId
        action: 'view',
        occurredAt: new Date(),
        source: 'web',
      })
    ).rejects.toThrow(/at least one.*id.*required/i);
  });

  it('should handle deduplication with dedupKey', async () => {
    // Arrange: Create first activity with dedupKey
    const dedupKey = 'github_star_12345678_2025-01-15';
    const first = await createActivity('default', {
      anonId: 'anon123',
      action: 'star',
      occurredAt: new Date(),
      source: 'github',
      dedupKey,
    });

    // Act: Try to create duplicate activity
    // Assert: Should throw error due to unique constraint
    await expect(
      createActivity('default', {
        anonId: 'anon456',
        action: 'star',
        occurredAt: new Date(),
        source: 'github',
        dedupKey, // Same dedupKey
      })
    ).rejects.toThrow(/duplicate|unique/i);
  });

  it('should validate confidence score range', async () => {
    // Arrange: Create developer
    const dev = await createDeveloper('default', {
      displayName: 'Test',
      primaryEmail: null,
      orgId: null,
    });

    // Act & Assert: Confidence > 1.0 should fail
    await expect(
      createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date(),
        source: 'web',
        confidence: 1.5,
      })
    ).rejects.toThrow(/confidence/i);

    // Act & Assert: Confidence < 0.0 should fail
    await expect(
      createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date(),
        source: 'web',
        confidence: -0.1,
      })
    ).rejects.toThrow(/confidence/i);
  });
});
```

#### 2. `listActivities()` のテスト

```typescript
describe('listActivities', () => {
  it('should list all activities for a developer', async () => {
    // Arrange: Create developer and activities
    const dev = await createDeveloper('default', {
      displayName: 'Test Developer',
      primaryEmail: null,
      orgId: null,
    });

    // Create 3 activities
    await createActivity('default', {
      developerId: dev.developerId,
      action: 'view',
      occurredAt: new Date('2025-01-10'),
      source: 'web',
    });
    await createActivity('default', {
      developerId: dev.developerId,
      action: 'click',
      occurredAt: new Date('2025-01-11'),
      source: 'web',
    });
    await createActivity('default', {
      developerId: dev.developerId,
      action: 'signup',
      occurredAt: new Date('2025-01-12'),
      source: 'web',
    });

    // Act: List activities
    const activities = await listActivities('default', {
      developerId: dev.developerId,
    });

    // Assert: Should return 3 activities
    expect(activities.length).toBe(3);
  });

  it('should filter by date range', async () => {
    // Arrange: Create developer and activities
    const dev = await createDeveloper('default', {
      displayName: 'Test',
      primaryEmail: null,
      orgId: null,
    });

    await createActivity('default', {
      developerId: dev.developerId,
      action: 'view',
      occurredAt: new Date('2025-01-05'),
      source: 'web',
    });
    await createActivity('default', {
      developerId: dev.developerId,
      action: 'click',
      occurredAt: new Date('2025-01-15'),
      source: 'web',
    });
    await createActivity('default', {
      developerId: dev.developerId,
      action: 'signup',
      occurredAt: new Date('2025-01-25'),
      source: 'web',
    });

    // Act: List activities in January 10-20
    const activities = await listActivities('default', {
      developerId: dev.developerId,
      fromDate: new Date('2025-01-10'),
      toDate: new Date('2025-01-20'),
    });

    // Assert: Should return only 1 activity (2025-01-15)
    expect(activities.length).toBe(1);
    expect(activities[0]!.action).toBe('click');
  });

  it('should filter by action', async () => {
    // Arrange: Create activities
    const dev = await createDeveloper('default', {
      displayName: 'Test',
      primaryEmail: null,
      orgId: null,
    });

    await createActivity('default', {
      developerId: dev.developerId,
      action: 'signup',
      occurredAt: new Date(),
      source: 'web',
    });
    await createActivity('default', {
      developerId: dev.developerId,
      action: 'view',
      occurredAt: new Date(),
      source: 'web',
    });

    // Act: List only 'signup' activities
    const signups = await listActivities('default', {
      developerId: dev.developerId,
      action: 'signup',
    });

    // Assert: Should return only signup activities
    expect(signups.length).toBe(1);
    expect(signups[0]!.action).toBe('signup');
  });

  it('should apply pagination (limit and offset)', async () => {
    // Arrange: Create 10 activities
    const dev = await createDeveloper('default', {
      displayName: 'Test',
      primaryEmail: null,
      orgId: null,
    });

    for (let i = 0; i < 10; i++) {
      await createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date(Date.now() + i * 1000),
        source: 'web',
      });
    }

    // Act: Get first 5 activities
    const page1 = await listActivities('default', {
      developerId: dev.developerId,
      limit: 5,
      offset: 0,
    });

    // Act: Get next 5 activities
    const page2 = await listActivities('default', {
      developerId: dev.developerId,
      limit: 5,
      offset: 5,
    });

    // Assert: Should have 5 activities each
    expect(page1.length).toBe(5);
    expect(page2.length).toBe(5);
  });

  it('should sort by occurred_at DESC (default)', async () => {
    // Arrange: Create activities in non-chronological order
    const dev = await createDeveloper('default', {
      displayName: 'Test',
      primaryEmail: null,
      orgId: null,
    });

    await createActivity('default', {
      developerId: dev.developerId,
      action: 'a',
      occurredAt: new Date('2025-01-15'),
      source: 'web',
    });
    await createActivity('default', {
      developerId: dev.developerId,
      action: 'b',
      occurredAt: new Date('2025-01-20'),
      source: 'web',
    });
    await createActivity('default', {
      developerId: dev.developerId,
      action: 'c',
      occurredAt: new Date('2025-01-10'),
      source: 'web',
    });

    // Act: List activities (default sort)
    const activities = await listActivities('default', {
      developerId: dev.developerId,
    });

    // Assert: Should be sorted DESC (newest first)
    expect(activities[0]!.action).toBe('b'); // 2025-01-20
    expect(activities[1]!.action).toBe('a'); // 2025-01-15
    expect(activities[2]!.action).toBe('c'); // 2025-01-10
  });

  it('should sort by occurred_at ASC when specified', async () => {
    // Similar test with orderDirection: 'asc'
    // ...
  });

  it('should return empty array if no activities found', async () => {
    // Act: List activities for non-existent developer
    const activities = await listActivities('default', {
      developerId: '99999999-9999-4999-8999-999999999999',
    });

    // Assert: Should return empty array
    expect(activities).toEqual([]);
  });
});
```

### テスト環境セットアップ

```typescript
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { setTenantContext, clearTenantContext, closeDb } from '../db/connection';
import { getDb } from '../db/connection';
import * as schema from '../db/schema';

describe('Activity Service', () => {
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
    await db.delete(schema.activities);
  });
});
```

---

## エラーハンドリング

### エラーの種類と対応

| エラーの種類 | 対応 | HTTPステータス（参考） |
|-------------|------|---------------------|
| **バリデーションエラー** | ZodErrorをキャッチし、フィールド別エラーメッセージを返す | 400 Bad Request |
| **ID未指定エラー** | developerId, accountId, anonIdのいずれも指定されていない場合 | 400 Bad Request |
| **重複イベントエラー** | 同じdedupKeyで既にイベントが存在する場合 | 409 Conflict |
| **信頼度範囲外エラー** | confidenceが0.0未満または1.0超の場合 | 400 Bad Request |
| **日付範囲エラー** | fromDate > toDateの場合 | 400 Bad Request |
| **ページネーション範囲外エラー** | limit > 1000の場合 | 400 Bad Request |
| **データベースエラー** | クエリ失敗時 | 500 Internal Server Error |

---

## 完了チェックリスト

- [ ] `core/services/activity.service.ts` ファイル作成
- [ ] Zodスキーマ定義（`CreateActivitySchema`, `ListActivitiesSchema`）
- [ ] `createActivity()` 実装
- [ ] `listActivities()` 実装（フィルタ、ページネーション、ソート）
- [ ] 単体テストファイル作成（`core/services/activity.service.test.ts`）
- [ ] `createActivity()` のテスト（正常系・異常系、8テスト以上）
- [ ] `listActivities()` のテスト（フィルタ、ページネーション、ソート、8テスト以上）
- [ ] 全テストが成功（`pnpm test`）
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] Lintエラーなし（`pnpm lint`）

---

## 次のタスク

Task 4.4完了後、以下のタスクに進みます:

- **Task 4.5**: Activity API実装（Remix loader/action）

---

## 参考資料

- [Drizzle ORM Filters](https://orm.drizzle.team/docs/select#filtering)
- [Drizzle ORM Indexes](https://orm.drizzle.team/docs/indexes-constraints)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)
- [Time-Series Data Best Practices](https://www.timescale.com/blog/time-series-data-best-practices/)
