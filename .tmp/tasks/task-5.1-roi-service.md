# Task 5.1: ROIサービス基盤実装

**タスクID**: 5.1
**フェーズ**: Phase 5（ROI分析機能実装）
**依存**: Task 3.6（シードデータ作成）
**推定時間**: 2時間
**担当**: Backend Developer

---

## 概要

このタスクでは、ROI分析の基盤となる**Campaign（施策）管理サービス**を実装します。CampaignはDevRel/マーケティング施策の単位であり、ROI計算の対象となります。

DeveloperサービスやActivityサービスと同様に、以下の5つのコア関数を実装します：

1. **createCampaign()** - 新規キャンペーン作成
2. **getCampaign()** - キャンペーン詳細取得
3. **listCampaigns()** - キャンペーン一覧取得（ページネーション・フィルタ・ソート対応）
4. **updateCampaign()** - キャンペーン更新（部分更新対応）
5. **deleteCampaign()** - キャンペーン削除

### 対象テーブル

`campaigns` テーブル（`core/db/schema/campaigns.ts`）：

```typescript
{
  campaignId: uuid (PK),
  tenantId: text (FK to tenants),
  name: text (NOT NULL),
  channel: text,              // "event", "ad", "content", "community", etc.
  startDate: date,
  endDate: date,
  budgetTotal: numeric,       // 予算総額（参考値）
  attributes: jsonb,          // UTM、担当者、地域等のカスタム属性
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Unique constraint**: `(tenant_id, name)` - テナント内でキャンペーン名が重複不可

---

## 実装方針

### アーキテクチャ

```
Remix loader/action
  ↓
Campaign Service (core/services/campaign.service.ts)
  ↓
Drizzle ORM
  ↓
PostgreSQL (campaigns table with RLS)
```

### 設計原則

1. **DRMサービスと同じパターン** - Developerサービス（Task 4.1）と同じ設計パターンを採用
2. **Zodバリデーション** - すべての入力をZodスキーマで検証
3. **RLS対応** - `withTenantContext(tenantId, async (tx) => {...})` パターンを使用
4. **型安全性** - `as any`/`as unknown`を使わず、TypeScript型推論を活用
5. **Production-safe** - Connection pooling対応（Task 3.7のパターン）

---

## ファイル構成

```
core/services/
  ├── campaign.service.ts        // メインサービスファイル（5つの関数 + Zodスキーマ）
  └── campaign.service.test.ts   // Vitestによるテスト
```

**ファイルサイズ**: 1ファイル300-400行程度（Activityサービスのように分割は不要）

---

## 関数定義

### 1. createCampaign()

新規キャンペーンを作成します。

#### インターフェース

```typescript
/**
 * Create a new campaign
 *
 * @param tenantId - Tenant ID for multi-tenant isolation (required for RLS)
 * @param data - Raw/unvalidated campaign data (z.input type)
 * @returns Created campaign record
 * @throws {Error} If validation fails or database error occurs
 */
export async function createCampaign(
  tenantId: string,
  data: CreateCampaignInput
): Promise<typeof schema.campaigns.$inferSelect>
```

#### Zodスキーマ

```typescript
export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  channel: z.string().min(1).max(100).nullable(),
  startDate: z.coerce.date().nullable(),
  endDate: z.coerce.date().nullable(),
  budgetTotal: z.string().nullable(), // numeric型はstringとして受け取る
  attributes: z.record(z.string(), z.any()).default({}),
}).refine(
  (data) => {
    // Date range validation: startDate <= endDate
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: "startDate must be on or before endDate" }
);

export type CreateCampaignInput = z.input<typeof CreateCampaignSchema>;
export type CreateCampaignData = z.infer<typeof CreateCampaignSchema>;
```

#### 実装のポイント

- **Unique constraint**: `(tenant_id, name)` の重複エラーをハンドリング
- **Date coercion**: ISO文字列 → Date型への変換（`z.coerce.date()`）
- **Date range validation**: `startDate <= endDate` をバリデーション
- **budgetTotal**: `numeric`型なのでstring入力を受け取る（PostgreSQLのnumeric型は精度が高いためstringで扱う）

#### エラーハンドリング

- Duplicate name: `"Campaign with this name already exists"`
- Invalid date range: Zodバリデーションエラー
- Database error: `"Failed to create campaign due to database error"`

---

### 2. getCampaign()

キャンペーンIDからキャンペーン詳細を取得します。

#### インターフェース

```typescript
/**
 * Get a single campaign by ID
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param campaignId - UUID of the campaign to retrieve
 * @returns Campaign record or null if not found
 * @throws {Error} If database error occurs
 */
export async function getCampaign(
  tenantId: string,
  campaignId: string
): Promise<typeof schema.campaigns.$inferSelect | null>
```

#### 実装のポイント

- RLS自動適用により、他テナントのキャンペーンは取得不可
- 存在しない場合は`null`を返す（エラーではない）
- UUID検証は呼び出し側で実施（APIハンドラーで検証）

---

### 3. listCampaigns()

キャンペーン一覧を取得します。ページネーション・フィルタ・ソート機能を提供します。

#### インターフェース

```typescript
/**
 * List campaigns with pagination, filtering, and sorting
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param params - Raw/unvalidated pagination, filter, and sort parameters
 * @returns Object containing campaigns array and total count
 * @throws {Error} If validation fails or database error occurs
 */
export async function listCampaigns(
  tenantId: string,
  params: ListCampaignsInput
): Promise<{
  campaigns: Array<typeof schema.campaigns.$inferSelect>;
  total: number;
}>
```

#### Zodスキーマ

```typescript
export const ListCampaignsSchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  channel: z.string().optional(),       // Filter by channel
  search: z.string().optional(),        // Search in name
  orderBy: z
    .enum(['name', 'startDate', 'endDate', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

export type ListCampaignsInput = z.input<typeof ListCampaignsSchema>;
export type ListCampaignsParams = z.infer<typeof ListCampaignsSchema>;
```

#### フィルタ機能

- **channel**: チャネルでフィルタ（完全一致）
- **search**: キャンペーン名で検索（部分一致、case-insensitive）

#### ソート機能

- **orderBy**: `name`, `startDate`, `endDate`, `createdAt`, `updatedAt`
- **orderDirection**: `asc` または `desc`

#### ページネーション

- **limit**: 取得件数（デフォルト50、最大100）
- **offset**: スキップ件数（デフォルト0）

#### 実装のポイント

- DeveloperサービスのlistDevelopers()と同じパターン
- COUNT集計は`sql<number>`count(*)`を使用（Activityサービスと同じ最適化）
- 並列クエリ実行（データ取得 + COUNT集計）

---

### 4. updateCampaign()

既存キャンペーンを更新します。部分更新（Partial Update）をサポートします。

#### インターフェース

```typescript
/**
 * Update an existing campaign
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param campaignId - UUID of the campaign to update
 * @param data - Campaign data to update (partial update supported)
 * @returns Updated campaign record or null if not found
 * @throws {Error} If validation fails or database error occurs
 */
export async function updateCampaign(
  tenantId: string,
  campaignId: string,
  data: UpdateCampaignInput
): Promise<typeof schema.campaigns.$inferSelect | null>
```

#### Zodスキーマ

```typescript
export const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  channel: z.string().min(1).max(100).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  budgetTotal: z.string().nullable().optional(),
  attributes: z.record(z.string(), z.any()).optional(),
}).refine(
  (data) => {
    // Date range validation: startDate <= endDate (if both provided)
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: "startDate must be on or before endDate" }
);

export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;
```

#### 実装のポイント

- 部分更新対応（指定フィールドのみ更新）
- Empty object `{}`の場合は既存レコードをそのまま返す（no-op）
- Date range validation（startDateとendDateが両方指定された場合のみ検証）
- `updatedAt`を自動更新（`sql`now()`）
- Unique constraint違反をハンドリング（name重複）

---

### 5. deleteCampaign()

キャンペーンを削除します（ハードデリート）。

#### インターフェース

```typescript
/**
 * Delete a campaign
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param campaignId - UUID of the campaign to delete
 * @returns True if deleted, false if not found
 * @throws {Error} If database error occurs
 */
export async function deleteCampaign(
  tenantId: string,
  campaignId: string
): Promise<boolean>
```

#### 実装のポイント

- **CASCADE削除**: 関連する`budgets`レコードも自動削除（FK制約で定義済み）
- **resources**: `campaign_id`は`SET NULL`（orphan化、削除されない）
- 存在しない場合は`false`を返す（エラーではない）
- ハードデリート（物理削除）

#### 削除の影響範囲

| テーブル | 動作 | 理由 |
|---------|------|------|
| `budgets` | CASCADE削除 | キャンペーン予算はキャンペーンに紐づくため |
| `resources` | `campaign_id = NULL` | リソース自体は独立して存在可能 |
| `activities` | 影響なし | アクティビティは独立（campaign_idを持たない） |

---

## テスト計画

### テストファイル

`core/services/campaign.service.test.ts`

### テストケース数

**合計: 20テスト以上**

#### createCampaign() - 5テスト

1. ✅ 正常系: 全フィールド指定で作成成功
2. ✅ 正常系: 最小フィールドのみ（nameのみ）で作成成功
3. ✅ 異常系: 重複name（unique constraint violation）
4. ✅ 異常系: 無効な日付範囲（startDate > endDate）
5. ✅ 異常系: バリデーションエラー（空のname）

#### getCampaign() - 2テスト

1. ✅ 正常系: 存在するキャンペーンを取得
2. ✅ 正常系: 存在しないキャンペーンは`null`を返す

#### listCampaigns() - 8テスト

1. ✅ 正常系: デフォルトパラメータで一覧取得
2. ✅ 正常系: limit/offsetでページネーション
3. ✅ 正常系: channelでフィルタ
4. ✅ 正常系: searchで名前検索（部分一致）
5. ✅ 正常系: orderBy=name, orderDirection=ascでソート
6. ✅ 正常系: orderBy=startDate, orderDirection=descでソート
7. ✅ 正常系: 空の結果セット（total=0）
8. ✅ 正常系: COUNTとデータ件数の整合性確認

#### updateCampaign() - 4テスト

1. ✅ 正常系: 部分更新（nameのみ変更）
2. ✅ 正常系: 複数フィールド更新
3. ✅ 正常系: empty object `{}`でno-op（既存レコード返却）
4. ✅ 異常系: 存在しないキャンペーンは`null`を返す

#### deleteCampaign() - 3テスト

1. ✅ 正常系: キャンペーン削除成功（`true`を返す）
2. ✅ 正常系: 存在しないキャンペーンは`false`を返す
3. ✅ 正常系: CASCADE削除確認（関連budgetsも削除される）

### テスト実行環境

- **Docker内で実行**: `docker compose exec core pnpm test campaign.service.test`
- **実データベース使用**: モック不使用、実際のPostgreSQLコンテナに接続
- **RLS有効**: テナントコンテキストを設定してRLSポリシーを検証
- **クリーンアップ**: `afterAll`フックでテストデータ削除

---

## エラーハンドリング

### バリデーションエラー

- Zodスキーマによる検証失敗時にエラーをthrow
- フィールドレベルのエラーメッセージを提供

### データベースエラー

| エラー種別 | メッセージ | HTTPステータス（API実装時） |
|-----------|-----------|---------------------------|
| Duplicate name | `"Campaign with this name already exists"` | 409 Conflict |
| Invalid date range | Zodエラーメッセージ | 400 Bad Request |
| Not found | `null`を返す（エラーではない） | 404 Not Found |
| Database error | `"Failed to [operation] campaign due to database error"` | 500 Internal Server Error |

---

## RLS（Row Level Security）

### テナント分離

すべてのクエリは`withTenantContext(tenantId, async (tx) => {...})`パターンで実行され、以下のRLSポリシーが自動適用されます：

```sql
CREATE POLICY tenant_isolation_policy ON campaigns
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);
```

### セキュリティ保証

- テナントAのユーザーはテナントBのキャンペーンを取得・変更・削除できない
- RLSはPostgreSQL側で強制されるため、アプリケーション層のバグでも漏洩しない

---

## 完了条件

- [ ] `core/services/campaign.service.ts`作成
- [ ] 5つの関数実装（create/get/list/update/delete）
- [ ] Zodスキーマ定義（3つ: Create/List/Update）
- [ ] `core/services/campaign.service.test.ts`作成
- [ ] テストケース20個以上実装
- [ ] 全テスト通過（`pnpm test campaign.service.test`）
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] `as any`/`as unknown`を使用していない
- [ ] RLS対応（`withTenantContext`使用）

---

## 実装ガイドライン

### 参考実装

- **DRM Service** (`core/services/drm.service.ts`) - CRUD操作の基本パターン
- **Activity Service** (`core/services/activity-*.service.ts`) - Date coercion、COUNT最適化

### コーディング規約

1. **すべてのコードとコメントは英語で記述**
2. **Zodスキーマは関数定義の前に配置**
3. **型定義は`z.input<>`と`z.infer<>`を明確に区別**
4. **エラーハンドリングは`try-catch`で実装**
5. **console.errorでエラーログ出力**

### TypeScript型安全性

```typescript
// ❌ 悪い例（as anyを使用）
const result = await tx.select().from(schema.campaigns) as any;

// ✅ 良い例（型推論を活用）
const result = await tx.select().from(schema.campaigns);
// result の型は自動的に Array<typeof schema.campaigns.$inferSelect>
```

### Date型の扱い

```typescript
// ❌ 悪い例（stringをそのまま受け取る）
startDate: z.string().optional()

// ✅ 良い例（coercionでDate型に変換）
startDate: z.coerce.date().nullable()
```

### COUNT集計の最適化

```typescript
// ❌ 悪い例（全行取得してlength）
const allCampaigns = await tx.select().from(schema.campaigns);
const total = allCampaigns.length;

// ✅ 良い例（COUNT集計クエリ）
const [countResult] = await tx
  .select({ count: sql<number>`count(*)` })
  .from(schema.campaigns)
  .where(whereClause);
const total = Number(countResult?.count ?? 0);
```

---

## 注意事項

### budgetTotalフィールド

- PostgreSQLの`numeric`型は任意精度の数値型（金額計算に最適）
- JavaScript側では**string**として扱う（精度を保つため）
- 例: `"1000000"` → PostgreSQL numeric → `"1000000"`

### attributesフィールド

- JSONB型のカスタム属性
- Zodスキーマ: `z.record(z.string(), z.any())`
- 用途: UTMパラメータ、担当者、地域、カスタムタグ等
- 例: `{ utm_source: "twitter", owner: "alice", region: "APAC" }`

### channelフィールド

- 推奨値: `"event"`, `"ad"`, `"content"`, `"community"`, `"partnership"`, `"other"`
- enumではなくtext型（柔軟性重視）
- フィルタ機能で使用

---

## 次のタスク

- **Task 5.2**: ROI計算ロジック実装（`calculateROI(campaignId)`）
- **Task 5.3**: 短縮URL機能実装
- **Task 5.4**: Campaign API実装（Remix Resource Routes）

Task 5.1完了後、campaignsテーブルのCRUD操作が完成し、Task 5.2でROI計算を実装できる状態になります。
