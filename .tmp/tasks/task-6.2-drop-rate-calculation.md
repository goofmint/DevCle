# Task 6.2: ドロップ率計算実装

**ステータス**: ドキュメントのみ（実装待ち）
**担当**: Claude Code
**推定時間**: 2時間

## 概要

ファネル分析において、各ステージ間のドロップ率（離脱率）を計算する機能を実装します。前ステージから現ステージへの遷移率を可視化し、どのステージでユーザーが離脱しているかを分析できるようにします。

## 目的

- 各ファネルステージのドロップ率を計算
- 前ステージからの離脱率を算出
- 時系列でのドロップ率の推移を追跡
- どのステージでユーザーが離脱しているかを特定し、改善施策の優先度を決定

## 実装範囲

### 1. ドロップ率計算関数

#### `calculateDropRate()`

```typescript
/**
 * Calculate drop rate for a specific funnel stage
 *
 * Drop rate = (Previous stage count - Current stage count) / Previous stage count * 100
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param stageKey - Funnel stage key (engagement, adoption, advocacy)
 * @returns Drop rate statistics, or null if stage not found or no previous stage
 * @throws {Error} If database error occurs or stageKey is 'awareness' (first stage)
 *
 * Example:
 * - Awareness: 100 developers
 * - Engagement: 30 developers
 * - Engagement drop rate = (100 - 30) / 100 * 100 = 70%
 *
 * Note: Awareness stage has no drop rate (it's the first stage)
 */
export async function calculateDropRate(
  tenantId: string,
  stageKey: FunnelStageKey
): Promise<DropRateStats | null>;
```

**実装内容**:
- 指定されたステージと1つ前のステージのユニーク開発者数を取得
- ドロップ率を計算: `(前ステージ人数 - 現ステージ人数) / 前ステージ人数 * 100`
- Awarenessステージの場合はエラーをthrow（前のステージが存在しないため）
- 前ステージの人数が0の場合はnullを返す

#### `getFunnelDropRates()`

```typescript
/**
 * Calculate drop rates for all funnel stages
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @returns Drop rate statistics for all stages
 * @throws {Error} If database error occurs
 *
 * Implementation:
 * 1. Get all funnel stages with developer counts (from getFunnelStats)
 * 2. Calculate drop rate for each stage (except awareness)
 * 3. Calculate overall conversion rate (awareness → advocacy)
 * 4. Return complete drop rate statistics
 */
export async function getFunnelDropRates(
  tenantId: string
): Promise<FunnelDropRates>;
```

**実装内容**:
- 全ステージの開発者数を取得（`getFunnelStats()`を再利用）
- 各ステージ（Engagement, Adoption, Advocacy）のドロップ率を計算
- 全体のコンバージョン率を計算: `最終ステージ人数 / 最初のステージ人数 * 100`
- 各ステージのドロップ率と全体のコンバージョン率を返す

### 2. 時系列データ集計関数

#### `getFunnelTimeSeries()`

```typescript
/**
 * Get funnel statistics time series data
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param fromDate - Start date (inclusive)
 * @param toDate - End date (inclusive)
 * @param granularity - Time granularity (day, week, month)
 * @returns Time series data with developer counts and drop rates
 * @throws {Error} If database error occurs or invalid date range
 *
 * Implementation:
 * 1. Validate date range (fromDate <= toDate)
 * 2. Generate date buckets based on granularity
 * 3. For each bucket, aggregate activities by occurred_at
 * 4. Calculate unique developers per stage per bucket
 * 5. Calculate drop rates per bucket
 * 6. Return time series data sorted by date
 *
 * Example SQL (day granularity):
 * - Use DATE_TRUNC('day', occurred_at) for grouping
 * - Join activities with activity_funnel_map
 * - COUNT DISTINCT developer_id per stage per day
 */
export async function getFunnelTimeSeries(
  tenantId: string,
  fromDate: Date,
  toDate: Date,
  granularity: 'day' | 'week' | 'month'
): Promise<TimeSeriesFunnelData[]>;
```

**実装内容**:
- 日次/週次/月次で期間を分割（PostgreSQLの`DATE_TRUNC`関数を使用）
- 各期間ごとに、ステージ別のユニーク開発者数を集計
- 各期間ごとに、ステージ別のドロップ率を計算
- 時系列データとして返す（日付昇順でソート）

## データ型定義

```typescript
/**
 * Drop rate statistics for a single stage
 */
export interface DropRateStats {
  stageKey: FunnelStageKey;
  title: string;
  orderNo: number;
  uniqueDevelopers: number;
  previousStageCount: number;
  dropRate: number; // Percentage (0-100), null for awareness stage
}

/**
 * Complete funnel drop rate statistics
 */
export interface FunnelDropRates {
  stages: DropRateStats[];
  overallConversionRate: number; // Percentage from awareness to advocacy
}

/**
 * Time series funnel data point
 */
export interface TimeSeriesFunnelData {
  date: Date; // Start date of the period
  stages: {
    stageKey: FunnelStageKey;
    uniqueDevelopers: number;
    dropRate: number | null;
  }[];
}
```

## 計算ロジック

### ドロップ率の計算式

```
ドロップ率 = (前ステージの開発者数 - 現ステージの開発者数) / 前ステージの開発者数 * 100
```

### 具体例

| ステージ | 開発者数 | ドロップ率 | 計算式 |
|---------|---------|----------|--------|
| Awareness | 100 | - | （最初のステージのため計算なし） |
| Engagement | 30 | 70% | (100 - 30) / 100 * 100 |
| Adoption | 15 | 50% | (30 - 15) / 30 * 100 |
| Advocacy | 5 | 66.7% | (15 - 5) / 15 * 100 |

**全体のコンバージョン率**: 5 / 100 * 100 = 5%

### エッジケース

1. **Awarenessステージ**: ドロップ率は存在しない（最初のステージ）
2. **前ステージが0人**: ドロップ率はnull（計算不可能）
3. **現ステージ > 前ステージ**: 理論上は発生しない（データ不整合の可能性）
4. **現ステージ = 前ステージ**: ドロップ率は0%（全員が遷移）

## テスト要件

### 単体テスト（`funnel-droprate.service.test.ts`）

最低15テストケース:

#### `calculateDropRate()` テスト
1. Engagementステージの正しいドロップ率計算
2. Adoptionステージの正しいドロップ率計算
3. Advocacyステージの正しいドロップ率計算
4. Awarenessステージでエラーをthrow
5. 存在しないステージでnullを返す
6. 前ステージが0人の場合にnullを返す
7. テナント分離の確認

#### `getFunnelDropRates()` テスト
8. 全ステージのドロップ率が正しく計算される
9. 全体のコンバージョン率が正しく計算される
10. AwarenessステージにはdropRate: nullが設定される
11. テナント分離の確認

#### `getFunnelTimeSeries()` テスト
12. 日次集計が正しく動作する
13. 週次集計が正しく動作する
14. 月次集計が正しく動作する
15. 日付範囲のバリデーション（fromDate > toDateでエラー）
16. テナント分離の確認
17. 期間内にデータがない場合は空配列を返す

## 依存関係

- **Task 6.1**: Funnelサービス基盤（`getFunnelStats()`を再利用）
- **データベース**: `activities`, `activity_funnel_map`, `funnel_stages` テーブル
- **RLS**: テナントコンテキスト管理（`withTenantContext()`）

## ファイル構成

```
core/services/
├── funnel.service.ts              # Barrel file (既存)
├── funnel-droprate.service.ts     # Drop rate calculation (新規)
├── funnel-timeseries.service.ts   # Time series aggregation (新規)
└── funnel.schemas.ts              # Zod schemas (既存、型定義追加)

core/services/__tests__/
└── funnel-droprate.service.test.ts  # Tests (新規)
```

## 実装手順

1. **型定義**: `funnel.schemas.ts`に`DropRateStats`, `FunnelDropRates`, `TimeSeriesFunnelData`を追加
2. **ドロップ率計算**: `funnel-droprate.service.ts`を作成し、`calculateDropRate()`と`getFunnelDropRates()`を実装
3. **時系列集計**: `funnel-timeseries.service.ts`を作成し、`getFunnelTimeSeries()`を実装
4. **Barrel file更新**: `funnel.service.ts`から新しい関数をexport
5. **テスト**: `funnel-droprate.service.test.ts`を作成し、全テストケースを実装
6. **型チェック**: `pnpm typecheck`でTypeScriptエラーがないことを確認
7. **テスト実行**: `pnpm test funnel-droprate`で全テスト成功を確認

## 完了条件

- [x] ドキュメントが作成される
- [ ] `calculateDropRate()`が実装される
- [ ] `getFunnelDropRates()`が実装される
- [ ] `getFunnelTimeSeries()`が実装される
- [ ] 15以上の単体テストが成功する
- [ ] TypeScriptエラーが0件
- [ ] `pnpm typecheck`が成功する

## 参考資料

- Task 6.1: [task-6.1-funnel-service.md](task-6.1-funnel-service.md)
- ファネル分析の基礎: https://en.wikipedia.org/wiki/Funnel_analysis
- PostgreSQL DATE_TRUNC: https://www.postgresql.org/docs/current/functions-datetime.html
