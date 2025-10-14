# Task 5.2 - ROI計算ロジック実装

**タスクID**: 5.2
**依存**: Task 5.1（ROIサービス基盤実装）
**推定時間**: 2時間
**完了日**: 2025-10-14

---

## 概要

Campaign（施策）のROI（Return on Investment：投資対効果）を計算するロジックを実装する。

ROI計算式：
```
ROI = (効果値 - 投資額) / 投資額 × 100 (%)
```

- **投資額**: budgetsテーブルのamount合計（Campaign単位）
- **効果値**: Campaign経由で獲得したActivityの価値を金額換算した値

---

## 関数仕様

### 1. calculateROI()

Campaign全体のROIを計算する。

```typescript
/**
 * Calculate ROI for a campaign
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param campaignId - UUID of the campaign
 * @returns ROI calculation result
 * @throws {Error} If campaign not found or calculation fails
 */
async function calculateROI(
  tenantId: string,
  campaignId: string
): Promise<CampaignROI>;
```

**CampaignROI 型定義**:
```typescript
interface CampaignROI {
  campaignId: string;
  campaignName: string;
  totalCost: string;          // 総投資額（decimal型）
  totalValue: string;         // 総効果値（decimal型）
  roi: number | null;         // ROI（パーセント、小数第2位まで）、投資額が0の場合はnull
  activityCount: number;      // 関連Activity数
  developerCount: number;     // 関連Developer数（重複排除）
  calculatedAt: Date;         // 計算日時
}
```

**処理フロー**:
1. Campaignの存在確認（getCampaign()を使用）
2. 投資額の集計（budgetsテーブルから）
3. 効果値の集計（activity_campaigns + activitiesテーブルから）
4. ROI計算式の適用
5. 結果を返す

**エラーハンドリング**:
- Campaign不存在: `null`を返す
- 投資額が0: `roi: null`（計算不可能）
- データベースエラー: Errorをthrow

---

### 2. getCampaignCost()（内部関数）

Campaign単位で投資額を集計する。

```typescript
/**
 * Get total cost (budget sum) for a campaign
 *
 * @param tenantId - Tenant ID
 * @param campaignId - Campaign UUID
 * @returns Total cost as decimal string
 */
async function getCampaignCost(
  tenantId: string,
  campaignId: string
): Promise<string>;
```

**処理内容**:
- budgetsテーブルからcampaign_idで絞り込み
- amountカラムをSUM集計
- 通貨（currency）は統一されている前提（JPY）
- 結果をdecimal型の文字列で返す（例: "1000000"）

**SQL イメージ**:
```sql
SELECT COALESCE(SUM(amount), 0) AS total_cost
FROM budgets
WHERE campaign_id = $1 AND tenant_id = $2;
```

---

### 3. getCampaignValue()（内部関数）

Campaign経由で獲得したActivityの効果値を集計する。

```typescript
/**
 * Get total value (activity value sum) for a campaign
 *
 * @param tenantId - Tenant ID
 * @param campaignId - Campaign UUID
 * @returns Total value as decimal string
 */
async function getCampaignValue(
  tenantId: string,
  campaignId: string
): Promise<string>;
```

**処理内容**:
- activity_campaignsテーブルでcampaign_idに紐づくactivity_idを取得
- activitiesテーブルから各activityのvalueを取得
- valueカラムをSUM集計
- valueが設定されていないactivityはスキップ（NULL扱い）
- 結果をdecimal型の文字列で返す（例: "5000000"）

**SQL イメージ**:
```sql
SELECT COALESCE(SUM(a.value), 0) AS total_value
FROM activities a
INNER JOIN activity_campaigns ac ON a.activity_id = ac.activity_id
WHERE ac.campaign_id = $1 AND a.tenant_id = $2;
```

**valueカラムの意味**:
- activities.value: そのActivityの価値を金額換算した値（decimal型）
- 例: GitHub Star獲得 = ¥10,000、Event参加 = ¥5,000 など
- 設定方法はプラグインまたは管理画面で定義（Task 5.2では未実装）

---

## ROI計算式の実装

```typescript
// 投資額を取得
const totalCost = await getCampaignCost(tenantId, campaignId);
const totalValue = await getCampaignValue(tenantId, campaignId);

// 投資額が0の場合、ROIは計算不可能
if (totalCost === "0") {
  return {
    campaignId,
    campaignName,
    totalCost,
    totalValue,
    roi: null, // 計算不可能
    activityCount,
    developerCount,
    calculatedAt: new Date(),
  };
}

// ROI計算: (効果値 - 投資額) / 投資額 × 100
const costNum = parseFloat(totalCost);
const valueNum = parseFloat(totalValue);
const roiPercent = ((valueNum - costNum) / costNum) * 100;

// 小数第2位まで丸める
const roi = Math.round(roiPercent * 100) / 100;
```

**ROIの解釈**:
- `roi > 0`: 投資に対してプラスのリターンがある（成功）
- `roi = 0`: 投資額と効果値が同じ（損益分岐点）
- `roi < 0`: 投資に対してマイナスのリターン（損失）
- `roi = null`: 投資額が0（計算不可能）

---

## Zodスキーマ

```typescript
import { z } from 'zod';

export const CampaignROISchema = z.object({
  campaignId: z.string().uuid(),
  campaignName: z.string(),
  totalCost: z.string(), // decimal型（PostgreSQL）
  totalValue: z.string(), // decimal型（PostgreSQL）
  roi: z.number().nullable(), // ROI（パーセント）、計算不可能な場合はnull
  activityCount: z.number().int().min(0),
  developerCount: z.number().int().min(0),
  calculatedAt: z.date(),
});

export type CampaignROI = z.infer<typeof CampaignROISchema>;
```

---

## エラーハンドリング

### 1. Campaign不存在エラー

```typescript
const campaign = await getCampaign(tenantId, campaignId);
if (!campaign) {
  return null; // Campaign not found
}
```

### 2. 投資額が0の場合

```typescript
if (totalCost === "0") {
  // ROI計算不可能（ゼロ除算を防ぐ）
  return {
    ...result,
    roi: null,
  };
}
```

### 3. データベースエラー

```typescript
try {
  // ... ROI計算処理
} catch (error) {
  console.error('Failed to calculate ROI:', error);
  throw new Error('Failed to calculate ROI due to database error');
}
```

---

## テスト計画

### 単体テスト（`roi.service.test.ts`）

**calculateROI()のテスト**（8テスト以上）:
1. ✅ 正常系: 投資額あり、効果値あり、ROIが正常に計算される
2. ✅ 正常系: ROIがプラス（効果値 > 投資額）
3. ✅ 正常系: ROIがマイナス（効果値 < 投資額）
4. ✅ 正常系: ROIがゼロ（効果値 = 投資額）
5. ✅ エッジケース: 投資額が0（ROIがnull）
6. ✅ エッジケース: 効果値が0（ROIがマイナス100%）
7. ✅ エラー: Campaignが存在しない（nullを返す）
8. ✅ エラー: 無効なcampaignId（UUIDバリデーションエラー）

**getCampaignCost()のテスト**（4テスト以上）:
1. ✅ 正常系: 複数のbudgetレコードがある場合、合計が正しく計算される
2. ✅ エッジケース: budgetレコードが0件の場合、"0"を返す
3. ✅ 正常系: 異なる通貨のbudgetがある場合（※現状はJPY統一を想定）
4. ✅ RLS: 別テナントのbudgetは集計されない

**getCampaignValue()のテスト**（4テスト以上）:
1. ✅ 正常系: 複数のactivityがある場合、value合計が正しく計算される
2. ✅ エッジケース: activityが0件の場合、"0"を返す
3. ✅ エッジケース: valueがNULLのactivityがある場合、スキップされる
4. ✅ RLS: 別テナントのactivityは集計されない

**テスト環境**:
- Real database connection（モック不使用）
- RLS有効（withTenantContext()使用）
- シードデータを使用してテストデータ準備
- afterAll()でテストデータをクリーンアップ

---

## ファイル構成

```
core/
├── services/
│   ├── roi.service.ts                 # Barrel file（re-exports）
│   ├── roi.schemas.ts                 # Zod schemas（CampaignROI）
│   ├── roi-calculate.service.ts      # calculateROI() 実装
│   ├── roi-cost.service.ts            # getCampaignCost() 実装
│   ├── roi-value.service.ts           # getCampaignValue() 実装
│   └── roi.service.test.ts            # 包括的テスト（16テスト以上）
```

**各ファイルのサイズ制約**: 150行以下

---

## 実装時の注意事項

### 1. Decimal型の扱い

PostgreSQLのdecimal型は文字列として取得される。計算時は`parseFloat()`で数値に変換する。

```typescript
// ❌ 誤り: 文字列同士を直接計算
const roi = (totalValue - totalCost) / totalCost; // NaN

// ✅ 正しい: parseFloat()で数値に変換
const costNum = parseFloat(totalCost);
const valueNum = parseFloat(totalValue);
const roi = (valueNum - costNum) / costNum;
```

### 2. RLS（Row Level Security）

全てのクエリは`withTenantContext()`内で実行する。

```typescript
return await withTenantContext(tenantId, async (tx) => {
  // ... ROI計算処理
});
```

### 3. TypeScript型安全性

- `as any`や`as unknown`は使用禁止
- Zodスキーマで型を定義し、`.parse()`でバリデーション
- Drizzle ORMの型推論を活用

### 4. パフォーマンス考慮

- budgetsとactivitiesの集計はSQL側で実行（アプリケーション側でループしない）
- 必要に応じてINDEXを追加（campaign_id, activity_id）

---

## 完了条件

- [x] `core/services/roi.service.ts`（barrel file）作成
- [x] `core/services/roi.schemas.ts`作成
- [x] `core/services/roi-calculate.service.ts`作成
- [x] `core/services/roi-cost.service.ts`作成
- [x] `core/services/roi-value.service.ts`作成
- [x] `core/services/roi.service.test.ts`作成（16テスト以上）
- [x] TypeScriptエラー0件（`pnpm typecheck`成功）
- [x] 全テスト成功（`pnpm test roi.service.test`成功）
- [x] RLS動作確認（別テナントのデータが漏れないこと）

---

## 次のタスク

Task 5.3: 短縮URL機能実装

- generateShortURL()実装
- 短縮ID生成（nanoid）
- Clicksテーブル登録
- リダイレクトAPI実装
