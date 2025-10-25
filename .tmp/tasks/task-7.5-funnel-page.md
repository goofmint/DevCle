# Task 7.5: Funnelページ実装

**タスク番号**: 7.5
**依存タスク**: Task 7.1（ダッシュボードレイアウト実装）, Task 6.3（Funnel API実装）
**推定時間**: 4時間
**完了条件**: ファネルページが表示され、グラフが描画される

---

## 概要

開発者ファネルの視覚化ページを実装します。Recharts ライブラリを使用してファネルチャート、ドロップ率、時系列グラフを表示します。Task 6.3 で実装した Funnel API からデータを取得し、認知（Awareness）→ エンゲージメント（Engagement）→ 導入（Adoption）→ 推奨（Advocacy）の4段階ファネルを可視化します。

**Phase 7の位置づけ**:
Task 7.5 は Phase 7（ダッシュボード UI 実装）の最終タスクで、ファネル分析の可視化を提供します。これにより MVP の UI 機能が完成します。

---

## 実装するファイルとインターフェース

### 1. `app/routes/dashboard.funnel.tsx`

ファネル分析ページのメインコンポーネント。

```typescript
/**
 * Funnel Analysis Page
 *
 * Displays funnel visualization with:
 * - Overall funnel chart (4 stages: Awareness → Engagement → Adoption → Advocacy)
 * - Drop rate between stages
 * - Time series chart (daily/weekly/monthly)
 *
 * Data Flow:
 * 1. loader() fetches funnel data from GET /api/funnel
 * 2. loader() fetches timeline data from GET /api/funnel/timeline
 * 3. FunnelChart component renders the funnel visualization
 * 4. DropRateCard components display drop rates
 * 5. TimeSeriesChart component renders the time series graph
 *
 * Authentication:
 * - Requires authenticated user (via requireAuth())
 * - Tenant-scoped data (RLS enforced in API layer)
 */

import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { requireAuth } from '~/services/auth.service';

/**
 * Funnel stage data structure
 */
interface FunnelStage {
  stage: 'awareness' | 'engagement' | 'adoption' | 'advocacy';
  stageName: string;
  count: number;
  dropRate: number | null; // null for first stage
}

/**
 * Funnel statistics returned from API
 */
interface FunnelStats {
  stages: FunnelStage[];
  totalDevelopers: number;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
}

/**
 * Time series data point
 */
interface TimeSeriesDataPoint {
  date: string; // YYYY-MM-DD
  awareness: number;
  engagement: number;
  adoption: number;
  advocacy: number;
}

/**
 * Loader function
 *
 * Fetches funnel statistics and timeline data from API.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // 認証チェック、ファネル統計取得、時系列データ取得を実装
}

/**
 * Funnel page component
 */
export default function FunnelPage() {
  // ローダーデータを取得し、チャートコンポーネントをレンダリング
}
```

---

### 2. `app/components/funnel/FunnelChart.tsx`

ファネルチャートコンポーネント（Recharts使用）。

```typescript
/**
 * Funnel Chart Component
 *
 * Displays a funnel visualization using Recharts.
 * Shows the flow of developers through 4 stages.
 *
 * Features:
 * - Funnel bars with width proportional to developer count
 * - Stage labels and counts
 * - Color coding (gradient from blue to green)
 * - Responsive design (mobile/desktop)
 * - Dark mode support
 *
 * Libraries:
 * - recharts: Charting library
 */

import { FunnelChart, Funnel, LabelList, ResponsiveContainer, Tooltip } from 'recharts';

interface FunnelChartProps {
  data: Array<{
    stage: string;
    stageName: string;
    count: number;
  }>;
}

export function FunnelChartComponent({ data }: FunnelChartProps) {
  // Rechartsのファネルチャートをレンダリング
}
```

---

### 3. `app/components/funnel/DropRateCard.tsx`

ステージ間のドロップ率を表示するカードコンポーネント。

```typescript
/**
 * Drop Rate Card Component
 *
 * Displays the drop rate between two funnel stages.
 *
 * Features:
 * - Previous stage name
 * - Current stage name
 * - Drop rate percentage
 * - Visual indicator (color: red for high drop, yellow for medium, green for low)
 * - Icon indicating direction (down arrow)
 * - Dark mode support
 *
 * Drop Rate Calculation:
 * dropRate = (previousCount - currentCount) / previousCount * 100
 */

interface DropRateCardProps {
  fromStage: string;
  toStage: string;
  dropRate: number; // percentage (0-100)
}

export function DropRateCard({ fromStage, toStage, dropRate }: DropRateCardProps) {
  // ドロップ率カードをレンダリング（色分けあり）
}
```

---

### 4. `app/components/funnel/TimeSeriesChart.tsx`

時系列チャートコンポーネント（Recharts使用）。

```typescript
/**
 * Time Series Chart Component
 *
 * Displays a line chart showing funnel progression over time.
 *
 * Features:
 * - 4 lines (one per stage)
 * - Date range selector (daily/weekly/monthly)
 * - Legend
 * - Tooltip showing exact counts
 * - Responsive design
 * - Dark mode support
 *
 * Libraries:
 * - recharts: Charting library
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TimeSeriesChartProps {
  data: Array<{
    date: string;
    awareness: number;
    engagement: number;
    adoption: number;
    advocacy: number;
  }>;
  interval: 'daily' | 'weekly' | 'monthly';
  onIntervalChange: (interval: 'daily' | 'weekly' | 'monthly') => void;
}

export function TimeSeriesChart({ data, interval, onIntervalChange }: TimeSeriesChartProps) {
  // Rechartsの折れ線グラフをレンダリング
}
```

---

### 5. E2Eテスト: `core/e2e/dashboard-funnel.spec.ts`

ファネルページのE2Eテスト。

```typescript
/**
 * E2E Tests for Funnel Page
 *
 * Test Coverage:
 * 1. Page loads successfully
 * 2. Funnel chart is displayed
 * 3. Drop rate cards are displayed
 * 4. Time series chart is displayed
 * 5. Date range selector works (daily/weekly/monthly)
 * 6. Dark mode support
 * 7. Responsive design (mobile/desktop)
 * 8. Data accuracy (matches API response)
 * 9. Error handling (no data, API error)
 * 10. Authentication required
 *
 * Prerequisites:
 * - Authenticated user (test@example.com / password123)
 * - Seed data with activities mapped to funnel stages
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';

test.describe('Funnel Page', () => {
  // ログイン、ページ表示、チャート描画、インタラクションのテスト
});
```

---

## データフロー

1. **ページロード**:
   - `dashboard.funnel.tsx` の `loader()` が実行される
   - `requireAuth()` で認証チェック
   - `GET /api/funnel` からファネル統計を取得
   - `GET /api/funnel/timeline?interval=daily` から時系列データを取得

2. **データ表示**:
   - `FunnelChartComponent` がファネルチャートを描画
   - `DropRateCard` が各ステージ間のドロップ率を表示
   - `TimeSeriesChart` が時系列グラフを描画

3. **インタラクション**:
   - ユーザーが日次/週次/月次を選択
   - `TimeSeriesChart` の `onIntervalChange` が呼ばれる
   - 新しい interval で API を再取得（クライアントサイド fetch）

---

## UI/UXの要件

### レイアウト

```text
┌─────────────────────────────────────────────────────────┐
│ Funnel Analysis                                         │
│                                                         │
│ ┌───────────────────────────────────────────────────┐  │
│ │           Funnel Chart (Recharts)                 │  │
│ │   ┌─────────────────────┐                         │  │
│ │   │   Awareness: 100    │                         │  │
│ │   └─────────────────────┘                         │  │
│ │        ┌──────────────┐                           │  │
│ │        │ Engagement: 50│                          │  │
│ │        └──────────────┘                           │  │
│ │          ┌────────┐                               │  │
│ │          │Adoption:20│                            │  │
│ │          └────────┘                               │  │
│ │           ┌─────┐                                 │  │
│ │           │Adv:5│                                 │  │
│ │           └─────┘                                 │  │
│ └───────────────────────────────────────────────────┘  │
│                                                         │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│ │ Awareness    │ │ Engagement   │ │ Adoption     │   │
│ │      ↓       │ │      ↓       │ │      ↓       │   │
│ │ Engagement   │ │ Adoption     │ │ Advocacy     │   │
│ │ Drop: 50%    │ │ Drop: 60%    │ │ Drop: 75%    │   │
│ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                         │
│ Time Series Chart                                       │
│ [Daily] [Weekly] [Monthly]                             │
│ ┌───────────────────────────────────────────────────┐  │
│ │           Line Chart (Recharts)                   │  │
│ │  Count                                            │  │
│ │  100 ┼─────────────────                           │  │
│ │   50 ┼──────────                                  │  │
│ │    0 ┼──────────────────────                      │  │
│ │       Jan  Feb  Mar  Apr                          │  │
│ └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### カラースキーム

- **ファネルチャート**: グラデーション（青 → 緑）
  - Awareness: `bg-blue-500`
  - Engagement: `bg-cyan-500`
  - Adoption: `bg-teal-500`
  - Advocacy: `bg-green-500`

- **ドロップ率カード**:
  - 高ドロップ率（>70%）: `text-red-500`
  - 中ドロップ率（30-70%）: `text-yellow-500`
  - 低ドロップ率（<30%）: `text-green-500`

- **ダークモード対応**:
  - すべてのコンポーネントで `dark:` prefix 使用
  - チャート背景: `bg-white dark:bg-gray-800`
  - テキスト: `text-gray-900 dark:text-white`

### レスポンシブデザイン

- **デスクトップ（>768px）**:
  - ファネルチャート: 中央配置、最大幅 600px
  - ドロップ率カード: 3カラムグリッド
  - 時系列チャート: 全幅

- **モバイル（<768px）**:
  - ファネルチャート: 全幅
  - ドロップ率カード: 1カラム（縦積み）
  - 時系列チャート: 全幅、縦長

---

## アクセシビリティ

- すべてのチャートに `aria-label` 属性を追加
- ドロップ率カードに `role="region"` 属性を追加
- キーボードナビゲーション対応（Tab キーでフォーカス移動）
- スクリーンリーダー対応（代替テキスト提供）

---

## パフォーマンス最適化

- チャートコンポーネントの遅延ロード（React.lazy）
- API レスポンスのキャッシング（useMemo フック使用）
- 時系列データの効率的な再取得（interval 変更時のみ）

---

## エラーハンドリング

1. **API エラー**:
   - ネットワークエラー: エラーメッセージ表示 + リトライボタン
   - 404 Not Found: "データが見つかりません" メッセージ
   - 500 Internal Server Error: "サーバーエラーが発生しました" メッセージ

2. **データなし**:
   - 空のファネル: "アクティビティデータがありません" メッセージ + データ追加ガイドへのリンク

3. **認証エラー**:
   - 未認証: ログインページにリダイレクト

---

## 依存ライブラリ

```json
{
  "recharts": "^2.10.0"
}
```

---

## 実装の優先順位

1. **Phase 1**: 基本的なファネルチャート表示（`FunnelChartComponent`）
2. **Phase 2**: ドロップ率カード表示（`DropRateCard`）
3. **Phase 3**: 時系列チャート表示（`TimeSeriesChart`）
4. **Phase 4**: E2E テスト作成
5. **Phase 5**: ダークモード対応、レスポンシブデザイン最適化

---

## 実装上の注意点

1. **Recharts の型定義**:
   - TypeScript の型エラーを避けるため、`recharts` の型定義を正しくインポート
   - カスタムコンポーネントは `ComponentType` でラップ

2. **API データ形式**:
   - Task 6.3 で定義された API レスポンス形式に従う
   - `stage` フィールドは小文字（`'awareness'`, `'engagement'`, `'adoption'`, `'advocacy'`）

3. **日付フォーマット**:
   - API からは ISO 8601 形式（`YYYY-MM-DD`）で受け取る
   - UI では locale に応じたフォーマット（例: `2025/01/01`）で表示

4. **テナント分離**:
   - ローダーで `requireAuth()` を使用し、テナント ID を自動的に取得
   - API 層で RLS が適用されるため、フロントエンドで追加のフィルタリングは不要

---

## テスト戦略

### E2E テスト

- **シナリオ 1**: ログイン後、ファネルページにアクセスし、チャートが表示されることを確認
- **シナリオ 2**: ドロップ率カードが正しい値を表示することを確認
- **シナリオ 3**: 日次/週次/月次の切り替えが機能することを確認
- **シナリオ 4**: ダークモードで色が正しく表示されることを確認
- **シナリオ 5**: モバイルビューで正しくレイアウトされることを確認

### 統合テスト

- ローダーが API から正しくデータを取得することを確認（モック不使用）
- エラーハンドリングが正しく機能することを確認

---

## 完了条件

- [ ] `app/routes/dashboard.funnel.tsx` が作成され、ページが表示される
- [ ] ファネルチャートが Recharts で描画される
- [ ] ドロップ率カードが表示される
- [ ] 時系列チャート（日次/週次/月次）が表示される
- [ ] E2E テストが全て通過する（最低 10 テスト）
- [ ] ダークモード対応が完了している
- [ ] レスポンシブデザイン対応が完了している
- [ ] TypeScript エラーがない（`pnpm typecheck` 成功）
- [ ] すべての既存テストがパスする（Integration + E2E）
