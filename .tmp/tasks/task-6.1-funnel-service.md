# Task 6.1: Funnelサービス基盤実装

**タスク番号**: 6.1
**依存タスク**: Task 4.3（ID統合機能実装）
**推定時間**: 3時間
**完了条件**: サービス関数が単体テストでパスする

---

## 概要

ファネル分析サービスの基盤を実装します。このサービスは、開発者のアクティビティを4つのファネルステージ（Awareness、Engagement、Adoption、Advocacy）に分類し、各ステージの統計情報を提供します。

**Phase 6の位置づけ**:
Phase 6はファネル分析機能を実装するフェーズです。Task 6.1はその基盤となるサービス層の構築で、アクティビティのステージ分類とファネル統計の集計を担当します。

---

## 実装するファイルとインターフェース

### 1. `core/services/funnel.service.ts`

ファネル分析のビジネスロジックを提供するサービス。アクティビティのステージ分類とファネル統計の集計を行います。

```typescript
/**
 * Funnel Service - Developer Journey Analysis
 *
 * Provides business logic for funnel analysis.
 * Classifies activities into funnel stages and calculates funnel statistics.
 *
 * Architecture:
 * - Remix loader/action -> Funnel Service -> Drizzle ORM -> PostgreSQL
 * - All functions are async and return Promise
 * - Validation is done using Zod schemas
 * - RLS (Row Level Security) is enforced at database level
 *
 * Funnel Stages:
 * 1. Awareness: First contact with product/community (e.g., click, view)
 * 2. Engagement: Active participation (e.g., attend, post, comment)
 * 3. Adoption: Product usage, API calls (e.g., signup, api_call)
 * 4. Advocacy: Evangelism, content creation (e.g., blog_post, talk)
 */

import { getDb } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { z } from 'zod';
import { eq, and, count, countDistinct } from 'drizzle-orm';

/**
 * Funnel stage keys
 *
 * These match the `stage_key` values in the `funnel_stages` table.
 */
export const FunnelStageKey = {
  AWARENESS: 'awareness',
  ENGAGEMENT: 'engagement',
  ADOPTION: 'adoption',
  ADVOCACY: 'advocacy',
} as const;

export type FunnelStageKey = typeof FunnelStageKey[keyof typeof FunnelStageKey];

/**
 * Funnel stage definition
 *
 * Represents a single stage in the developer funnel.
 */
export interface FunnelStage {
  stageKey: FunnelStageKey;
  orderNo: number;
  title: string;
}

/**
 * Activity with funnel stage classification
 *
 * Represents an activity that has been classified into a funnel stage.
 */
export interface ClassifiedActivity {
  activityId: string;
  developerId: string | null;
  action: string;
  source: string;
  ts: Date;
  stageKey: FunnelStageKey | null;
}

/**
 * Funnel statistics for a single stage
 *
 * Contains the count of unique developers and total activities for a stage.
 */
export interface FunnelStageStats {
  stageKey: FunnelStageKey;
  title: string;
  orderNo: number;
  uniqueDevelopers: number;
  totalActivities: number;
}

/**
 * Complete funnel statistics
 *
 * Contains statistics for all funnel stages, ordered by stage order.
 */
export interface FunnelStats {
  stages: FunnelStageStats[];
  totalDevelopers: number;
}

/**
 * Classify an activity into a funnel stage
 *
 * @param tenantId - Tenant ID for multi-tenant isolation (required for RLS)
 * @param activityId - UUID of the activity to classify
 * @returns Activity with funnel stage classification, or null if activity not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query activity by activity_id (RLS applies)
 * 2. If not found, return null
 * 3. Look up the activity's action in the `activity_funnel_map` table
 * 4. If mapping exists, return the activity with the stage_key
 * 5. If no mapping exists, return the activity with stage_key = null
 *
 * Mapping logic:
 * - The mapping is per-tenant, stored in `activity_funnel_map` table
 * - Each tenant can customize which actions map to which stages
 * - Example mappings (from seed data):
 *   - "click" -> "awareness"
 *   - "attend" -> "engagement"
 *   - "signup" -> "adoption"
 *   - "post" -> "advocacy"
 *
 * Example usage:
 * ```typescript
 * const classified = await classifyStage('default', 'activity-uuid');
 * if (classified) {
 *   console.log(`Activity classified as ${classified.stageKey}`);
 * }
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function classifyStage(
  tenantId: string,
  activityId: string
): Promise<ClassifiedActivity | null> {
  // Implementation will be added in coding phase
  // 1. Query activity from activities table
  // 2. Query mapping from activity_funnel_map table
  // 3. Join and return classified activity
  throw new Error('Not implemented');
}

/**
 * Get funnel statistics for all stages
 *
 * @param tenantId - Tenant ID for multi-tenant isolation (required for RLS)
 * @returns Funnel statistics with all stages and counts
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query all funnel stages from `funnel_stages` table (4 stages)
 * 2. For each stage:
 *    a. Join activities -> activity_funnel_map -> funnel_stages
 *    b. Count unique developers (COUNT DISTINCT developer_id)
 *    c. Count total activities (COUNT *)
 * 3. Calculate total unique developers across all stages
 * 4. Return statistics ordered by stage order
 *
 * SQL Query Structure (conceptual):
 * ```sql
 * SELECT
 *   fs.stage_key,
 *   fs.title,
 *   fs.order_no,
 *   COUNT(DISTINCT a.developer_id) as unique_developers,
 *   COUNT(a.activity_id) as total_activities
 * FROM funnel_stages fs
 * LEFT JOIN activity_funnel_map afm ON fs.stage_key = afm.stage_key AND afm.tenant_id = 'default'
 * LEFT JOIN activities a ON a.action = afm.action AND a.tenant_id = 'default'
 * GROUP BY fs.stage_key, fs.title, fs.order_no
 * ORDER BY fs.order_no;
 * ```
 *
 * Performance considerations:
 * - This query can be expensive for large datasets
 * - Consider caching the results in Redis (5-10 minutes TTL)
 * - Consider pre-aggregating in `developer_stats` table (Task 3.2)
 *
 * Example usage:
 * ```typescript
 * const stats = await getFunnelStats('default');
 * console.log(`Total developers: ${stats.totalDevelopers}`);
 * for (const stage of stats.stages) {
 *   console.log(`${stage.title}: ${stage.uniqueDevelopers} developers, ${stage.totalActivities} activities`);
 * }
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function getFunnelStats(
  tenantId: string
): Promise<FunnelStats> {
  // Implementation will be added in coding phase
  // 1. Query all funnel stages (should always return 4 stages)
  // 2. For each stage, count unique developers and total activities
  // 3. Calculate total unique developers across all stages
  // 4. Return structured statistics
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
│  Funnel Service (Business Logic)    │ ← Task 6.1
│  - Activity stage classification    │
│  - Funnel statistics calculation    │
│  - Mapping lookup logic             │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Drizzle ORM (Data Access)          │
│  - Query construction               │
│  - Type-safe database operations    │
│  - JOIN operations                  │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  PostgreSQL Database                │
│  - activities table                 │
│  - funnel_stages table              │
│  - activity_funnel_map table        │
│  - RLS enforcement                  │
└─────────────────────────────────────┘
```

### 各層の責務

**Remix Loader/Action (Task 6.3で実装)**:
- HTTPリクエストの受付
- レスポンスのシリアライズ（JSON形式）
- エラーハンドリング（HTTP status code）
- セッション管理（tenantId取得）

**Funnel Service (Task 6.1 - 本タスク)**:
- アクティビティのステージ分類ロジック
- ファネル統計の集計ロジック
- マッピングテーブルの参照
- データベース操作の抽象化

**Drizzle ORM**:
- タイプセーフなクエリ構築
- JOINクエリの構築
- 集計関数（COUNT DISTINCT）の実行

**PostgreSQL**:
- RLS（Row Level Security）による自動的なテナント分離
- データの永続化
- 集計クエリの実行

---

## ファネルステージの定義

### 4つのステージ

DRMでは、開発者のジャーニーを以下の4つのステージに分類します：

#### 1. Awareness（認知）
- **定義**: プロダクトやコミュニティとの最初の接触
- **典型的なアクション**:
  - `click`: ランディングページへのクリック
  - `view`: ドキュメントの閲覧
  - `search`: Google検索からの流入

#### 2. Engagement（関与）
- **定義**: 積極的な参加と交流
- **典型的なアクション**:
  - `attend`: イベントへの参加
  - `comment`: コミュニティへのコメント
  - `question`: 質問の投稿

#### 3. Adoption（採用）
- **定義**: プロダクトの実際の利用
- **典型的なアクション**:
  - `signup`: アカウント作成
  - `api_call`: API呼び出し
  - `deploy`: デプロイメント

#### 4. Advocacy（支持）
- **定義**: 布教活動とコンテンツ作成
- **典型的なアクション**:
  - `post`: ブログ記事の投稿
  - `talk`: 登壇発表
  - `referral`: 紹介

### アクション→ステージマッピング

マッピングは`activity_funnel_map`テーブルに格納され、テナントごとにカスタマイズ可能です。

**デフォルトマッピング（シードデータ）**:

| アクション | ステージ | 説明 |
|----------|---------|------|
| `click` | awareness | リンククリック |
| `view` | awareness | ページ閲覧 |
| `attend` | engagement | イベント参加 |
| `comment` | engagement | コメント投稿 |
| `question` | engagement | 質問投稿 |
| `signup` | adoption | アカウント作成 |
| `api_call` | adoption | API呼び出し |
| `deploy` | adoption | デプロイ |
| `post` | advocacy | ブログ投稿 |
| `talk` | advocacy | 登壇 |
| `referral` | advocacy | 紹介 |

**カスタマイズの例**:
テナントごとに異なるマッピングを設定可能：

```typescript
// Tenant A: GitHub star を awareness に分類
await db.insert(schema.activityFunnelMap).values({
  tenantId: 'tenant-a',
  action: 'star',
  stageKey: 'awareness',
});

// Tenant B: GitHub star を advocacy に分類
await db.insert(schema.activityFunnelMap).values({
  tenantId: 'tenant-b',
  action: 'star',
  stageKey: 'advocacy',
});
```

---

## ファネル統計の計算ロジック

### `getFunnelStats()` の計算方法

#### 1. ステージごとの集計

各ステージについて、以下を計算：
- **uniqueDevelopers**: そのステージに到達した一意の開発者数
- **totalActivities**: そのステージでのアクティビティ総数

#### 2. 全体の集計

- **totalDevelopers**: 全ステージを通じた一意の開発者数（重複除外）

#### 3. クエリ構造（Drizzle ORM）

```typescript
// Conceptual implementation (actual implementation in coding phase)

// 1. Get all funnel stages (should always return 4 stages)
const stages = await db
  .select()
  .from(schema.funnelStages)
  .orderBy(asc(schema.funnelStages.orderNo));

// 2. For each stage, calculate statistics
const stageStats = await Promise.all(stages.map(async (stage) => {
  // Query activities that match this stage
  const [result] = await db
    .select({
      uniqueDevelopers: countDistinct(schema.activities.developerId),
      totalActivities: count(schema.activities.activityId),
    })
    .from(schema.activities)
    .innerJoin(
      schema.activityFunnelMap,
      and(
        eq(schema.activities.action, schema.activityFunnelMap.action),
        eq(schema.activities.tenantId, schema.activityFunnelMap.tenantId)
      )
    )
    .where(
      and(
        eq(schema.activityFunnelMap.stageKey, stage.stageKey),
        eq(schema.activityFunnelMap.tenantId, tenantId)
      )
    );

  return {
    stageKey: stage.stageKey,
    title: stage.title,
    orderNo: stage.orderNo,
    uniqueDevelopers: result?.uniqueDevelopers ?? 0,
    totalActivities: result?.totalActivities ?? 0,
  };
}));

// 3. Calculate total unique developers across all stages
const [totalResult] = await db
  .select({
    totalDevelopers: countDistinct(schema.activities.developerId),
  })
  .from(schema.activities)
  .where(eq(schema.activities.tenantId, tenantId));

return {
  stages: stageStats,
  totalDevelopers: totalResult?.totalDevelopers ?? 0,
};
```

### パフォーマンス最適化

**問題**: 大規模データセットでは集計クエリが遅くなる可能性

**対策**:
1. **Redisキャッシュ**: 5-10分間キャッシュ
2. **事前集計テーブル**: `developer_stats` テーブルに事前集計（Task 3.2で定義済み）
3. **インデックス**: `activities (tenant_id, action, developer_id)` に複合インデックス

```typescript
// Cache implementation example (to be implemented in coding phase)
const cacheKey = `funnel_stats:${tenantId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const stats = await calculateFunnelStats(tenantId);
await redis.setex(cacheKey, 300, JSON.stringify(stats)); // 5 minutes TTL
return stats;
```

---

## テスト方針

### 単体テスト（`core/services/funnel.service.test.ts`）

Task 6.1の完了条件は「サービス関数が単体テストでパスする」ことです。以下のテストケースを実装します。

#### 1. `classifyStage()`のテスト

```typescript
describe('classifyStage', () => {
  it('should classify activity based on action mapping', async () => {
    // Arrange: Create an activity with action = "click"
    const activity = await createActivity('default', {
      developerId: 'dev-uuid',
      action: 'click',
      source: 'web',
      metadata: {},
    });

    // Act: Classify the activity
    const classified = await classifyStage('default', activity.activityId);

    // Assert: Should be classified as "awareness"
    expect(classified).not.toBeNull();
    expect(classified?.stageKey).toBe('awareness');
  });

  it('should return null stage for unmapped action', async () => {
    // Arrange: Create an activity with an unmapped action
    const activity = await createActivity('default', {
      developerId: 'dev-uuid',
      action: 'unknown_action',
      source: 'web',
      metadata: {},
    });

    // Act: Classify the activity
    const classified = await classifyStage('default', activity.activityId);

    // Assert: Should return null stage (unmapped)
    expect(classified).not.toBeNull();
    expect(classified?.stageKey).toBeNull();
  });

  it('should respect tenant-specific mappings', async () => {
    // Arrange: Create custom mapping for tenant-b
    await db.insert(schema.activityFunnelMap).values({
      tenantId: 'tenant-b',
      action: 'custom_action',
      stageKey: 'advocacy',
    });

    const activity = await createActivity('tenant-b', {
      developerId: 'dev-uuid',
      action: 'custom_action',
      source: 'custom',
      metadata: {},
    });

    // Act: Classify the activity
    const classified = await classifyStage('tenant-b', activity.activityId);

    // Assert: Should be classified according to tenant-b mapping
    expect(classified?.stageKey).toBe('advocacy');
  });

  it('should return null for non-existent activity', async () => {
    // Act: Try to classify non-existent activity
    const classified = await classifyStage('default', '99999999-9999-4999-8999-999999999999');

    // Assert: Should return null
    expect(classified).toBeNull();
  });
});
```

#### 2. `getFunnelStats()`のテスト

```typescript
describe('getFunnelStats', () => {
  beforeEach(async () => {
    // Create test data: activities across all stages
    await createActivity('default', {
      developerId: 'dev-1',
      action: 'click',
      source: 'web',
      metadata: {},
    });
    await createActivity('default', {
      developerId: 'dev-1',
      action: 'attend',
      source: 'event',
      metadata: {},
    });
    await createActivity('default', {
      developerId: 'dev-2',
      action: 'click',
      source: 'web',
      metadata: {},
    });
  });

  it('should return statistics for all 4 stages', async () => {
    // Act: Get funnel statistics
    const stats = await getFunnelStats('default');

    // Assert: Should return 4 stages
    expect(stats.stages).toHaveLength(4);
    expect(stats.stages[0]?.stageKey).toBe('awareness');
    expect(stats.stages[1]?.stageKey).toBe('engagement');
    expect(stats.stages[2]?.stageKey).toBe('adoption');
    expect(stats.stages[3]?.stageKey).toBe('advocacy');
  });

  it('should count unique developers per stage', async () => {
    // Act: Get funnel statistics
    const stats = await getFunnelStats('default');

    // Assert: Awareness stage should have 2 unique developers
    const awarenessStage = stats.stages.find(s => s.stageKey === 'awareness');
    expect(awarenessStage?.uniqueDevelopers).toBe(2);

    // Assert: Engagement stage should have 1 unique developer
    const engagementStage = stats.stages.find(s => s.stageKey === 'engagement');
    expect(engagementStage?.uniqueDevelopers).toBe(1);
  });

  it('should count total activities per stage', async () => {
    // Act: Get funnel statistics
    const stats = await getFunnelStats('default');

    // Assert: Awareness stage should have 2 activities
    const awarenessStage = stats.stages.find(s => s.stageKey === 'awareness');
    expect(awarenessStage?.totalActivities).toBe(2);
  });

  it('should calculate total unique developers', async () => {
    // Act: Get funnel statistics
    const stats = await getFunnelStats('default');

    // Assert: Should have 2 unique developers total
    expect(stats.totalDevelopers).toBe(2);
  });

  it('should return zero counts for stages with no activities', async () => {
    // Act: Get funnel statistics
    const stats = await getFunnelStats('default');

    // Assert: Adoption and Advocacy stages should have zero counts
    const adoptionStage = stats.stages.find(s => s.stageKey === 'adoption');
    expect(adoptionStage?.uniqueDevelopers).toBe(0);
    expect(adoptionStage?.totalActivities).toBe(0);

    const advocacyStage = stats.stages.find(s => s.stageKey === 'advocacy');
    expect(advocacyStage?.uniqueDevelopers).toBe(0);
    expect(advocacyStage?.totalActivities).toBe(0);
  });

  it('should respect tenant isolation', async () => {
    // Arrange: Create activities for different tenant
    await createActivity('tenant-b', {
      developerId: 'dev-3',
      action: 'click',
      source: 'web',
      metadata: {},
    });

    // Act: Get statistics for 'default' tenant
    const stats = await getFunnelStats('default');

    // Assert: Should not include tenant-b activities
    expect(stats.totalDevelopers).toBe(2); // Only dev-1 and dev-2
  });

  it('should return stages in correct order', async () => {
    // Act: Get funnel statistics
    const stats = await getFunnelStats('default');

    // Assert: Stages should be ordered by order_no
    expect(stats.stages[0]?.orderNo).toBe(1);
    expect(stats.stages[1]?.orderNo).toBe(2);
    expect(stats.stages[2]?.orderNo).toBe(3);
    expect(stats.stages[3]?.orderNo).toBe(4);
  });
});
```

### テスト環境セットアップ

```typescript
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { setTenantContext, clearTenantContext, closeDb } from '../db/connection';
import { createActivity } from './activity.service';

describe('Funnel Service', () => {
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
    // Clean up activities table before each test
    await db.delete(schema.activities).where(eq(schema.activities.tenantId, 'default'));
  });
});
```

---

## エラーハンドリング

### エラーの種類と対応

| エラーの種類 | 対応 | HTTPステータス（参考） |
|-------------|------|---------------------|
| **Activity not found** | classifyStage()がnullを返す（エラーではない） | 404 Not Found |
| **Database connection error** | 接続エラーメッセージをログに記録し、汎用エラーを返す | 500 Internal Server Error |
| **RLS violation** | テナントIDが未設定、または不正なアクセスを示すエラー | 403 Forbidden |
| **Invalid tenant_id** | バリデーションエラーを返す | 400 Bad Request |

### エラーハンドリング実装例

```typescript
export async function classifyStage(
  tenantId: string,
  activityId: string
): Promise<ClassifiedActivity | null> {
  try {
    const db = getDb();

    // 1. Query activity
    const [activity] = await db
      .select()
      .from(schema.activities)
      .where(
        and(
          eq(schema.activities.activityId, activityId),
          eq(schema.activities.tenantId, tenantId)
        )
      );

    if (!activity) {
      return null; // Not an error, just not found
    }

    // 2. Query mapping
    const [mapping] = await db
      .select()
      .from(schema.activityFunnelMap)
      .where(
        and(
          eq(schema.activityFunnelMap.action, activity.action),
          eq(schema.activityFunnelMap.tenantId, tenantId)
        )
      );

    // 3. Return classified activity
    return {
      activityId: activity.activityId,
      developerId: activity.developerId,
      action: activity.action,
      source: activity.source,
      ts: activity.ts,
      stageKey: mapping?.stageKey ?? null,
    };
  } catch (error) {
    // Log error for debugging
    console.error('Failed to classify activity stage:', error);

    // Re-throw with more context
    throw new Error(`Failed to classify activity stage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

---

## セキュリティ考慮事項

### 1. Row Level Security (RLS)

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
  const stats = await getFunnelStats(tenantId);

  return json({ stats });
}
```

### 2. SQLインジェクション対策

Drizzle ORMを使用することで、全てのクエリはパラメータバインディングされます。生SQLの使用は避けます。

```typescript
// ✅ Safe: Drizzle ORM with parameter binding
await db
  .select()
  .from(schema.activities)
  .where(eq(schema.activities.activityId, activityId));

// ❌ Dangerous: Raw SQL with string concatenation (DO NOT USE)
await sql.unsafe(`SELECT * FROM activities WHERE activity_id = '${activityId}'`);
```

### 3. データの機密性

ファネル統計は集計データであり、個人を特定できる情報（PII）は含まれません。しかし、以下に留意：

- **テナント分離**: 他のテナントのデータを閲覧できないよう、RLSで保護
- **ログ出力**: 統計データをログに出力しても問題ないが、個別のdeveloper_idは含めない
- **API レスポンス**: 集計結果のみ返却（生のアクティビティデータは含めない）

---

## 完了チェックリスト

- [ ] `core/services/funnel.service.ts`ファイル作成
- [ ] 型定義（`FunnelStageKey`, `FunnelStage`, `ClassifiedActivity`, `FunnelStageStats`, `FunnelStats`）
- [ ] `classifyStage()`実装
- [ ] `getFunnelStats()`実装
- [ ] 単体テストファイル作成（`core/services/funnel.service.test.ts`）
- [ ] `classifyStage()`のテスト（正常系・異常系、8テスト以上）
- [ ] `getFunnelStats()`のテスト（正常系・異常系、7テスト以上）
- [ ] 全テストが成功（`pnpm test`）
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] Lintエラーなし（`pnpm lint`）

---

## 次のタスク

Task 6.1完了後、以下のタスクに進みます：

- **Task 6.2**: ドロップ率計算実装（`calculateDropRate`）
- **Task 6.3**: Funnel API実装（Remix loader/action）

---

## 参考資料

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle ORM - Aggregations](https://orm.drizzle.team/docs/select#aggregations)
- [Drizzle ORM - Joins](https://orm.drizzle.team/docs/joins)
- [PostgreSQL COUNT DISTINCT](https://www.postgresql.org/docs/current/functions-aggregate.html)
- [Funnel Analysis Best Practices](https://mixpanel.com/blog/funnel-analysis/)
