# Task 7.2: Overviewページ実装

## 概要

ダッシュボードのOverviewページを実装し、主要な統計情報とグラフを表示します。Swapyライブラリを使用してウィジェットをドラッグ&ドロップで配置可能にし、ユーザーが自由にレイアウトをカスタマイズできるようにします。

## 目的

- ダッシュボードのホーム画面として、重要なメトリクスを一目で確認できるようにする
- ドラッグ&ドロップでウィジェットを並び替え可能にし、ユーザー体験を向上させる
- Rechartsを使用したグラフで、データの視覚化を実現する

## 依存タスク

- ✅ Task 7.1: ダッシュボードレイアウト実装
- ✅ Task 4.5: Activity API実装
- ✅ Task 5.4: Campaign API実装

## 実装内容

### 1. ルート定義

**ファイル**: `core/app/routes/dashboard._index.tsx`

Overviewページのルートを作成します。既存の`dashboard.tsx`はレイアウトとして機能し、このファイルがindex routeとしてOverviewコンテンツを提供します。

### 2. 統計情報の取得

Loaderで以下のデータを取得します：

```typescript
interface OverviewData {
  stats: {
    totalDevelopers: number;
    totalActivities: number;
    totalCampaigns: number;
    averageROI: number | null;
  };
  recentActivities: Activity[];
  timeSeriesData: TimeSeriesDataPoint[];
}

interface TimeSeriesDataPoint {
  date: string; // YYYY-MM-DD
  activities: number;
  developers: number;
}
```

### 3. ウィジェット構成

以下の4つの統計カードウィジェットを実装：

```typescript
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}
```

**ウィジェット一覧**:
- **Total Developers**: 総開発者数
- **Total Activities**: 総アクティビティ数
- **Active Campaigns**: アクティブな施策数
- **Average ROI**: ROI平均値（%表示）

### 4. Swapyによるドラッグ&ドロップ

[Swapy](https://swapy.tahazsh.com/)ライブラリを使用してウィジェットの並び替えを実装します。

```typescript
interface SwapyConfig {
  animation: 'dynamic' | 'spring' | 'none';
}

// Swapy初期化
const initSwapy = (container: HTMLElement, config: SwapyConfig) => {
  // Swapyインスタンスの作成
  // ウィジェットのドラッグ&ドロップを有効化
  // レイアウト変更時の永続化（localStorage）
};
```

### 5. グラフ表示（Recharts）

Rechartsを使用して以下のグラフを実装：

**アクティビティトレンドグラフ**:
```typescript
interface ChartData {
  date: string;
  activities: number;
  developers: number;
}

// LineChartコンポーネント
// - X軸: 日付（過去30日間）
// - Y軸: アクティビティ数、開発者数
// - ツールチップ表示
// - レスポンシブ対応
```

### 6. ダークモード対応

全てのウィジェットとグラフはダークモードに対応します：

- 背景色: `bg-white dark:bg-gray-800`
- テキスト: `text-gray-900 dark:text-white`
- グラフカラー: ダークモード時は明るい色を使用

### 7. レスポンシブデザイン

- **デスクトップ**: 4カラムグリッド（統計カード）
- **タブレット**: 2カラムグリッド
- **モバイル**: 1カラムグリッド

## ファイル構成

```
core/
├── app/
│   ├── routes/
│   │   └── dashboard._index.tsx          # Overviewページ（メインルート）
│   ├── components/
│   │   └── dashboard/
│   │       ├── StatCard.tsx              # 統計カードコンポーネント
│   │       ├── ActivityChart.tsx         # アクティビティグラフ
│   │       └── SwapyContainer.tsx        # Swapyラッパーコンポーネント
│   └── hooks/
│       └── useSwapy.ts                   # Swapy初期化カスタムフック
└── package.json                          # swapy, rechartsを追加
```

## API仕様

### GET /api/overview/stats

**レスポンス**:
```typescript
{
  "stats": {
    "totalDevelopers": 1234,
    "totalActivities": 5678,
    "totalCampaigns": 42,
    "averageROI": 156.7
  }
}
```

### GET /api/overview/timeline

**クエリパラメータ**:
- `days`: 取得する日数（デフォルト: 30）

**レスポンス**:
```typescript
{
  "timeline": [
    {
      "date": "2025-10-01",
      "activities": 120,
      "developers": 45
    },
    // ...
  ]
}
```

## コンポーネント設計

### StatCard

```typescript
interface StatCardProps {
  testId: string;
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

/**
 * StatCard Component
 *
 * 統計情報を表示するカードコンポーネント。
 * アイコン、ラベル、値を表示し、ダークモード対応。
 */
export function StatCard({ testId, label, value, icon: Icon, description }: StatCardProps): JSX.Element {
  // カード内にアイコン、ラベル、値を配置
  // Tailwind CSSでスタイリング
  // data-testid属性を設定
}
```

### ActivityChart

```typescript
interface ActivityChartProps {
  data: TimeSeriesDataPoint[];
  height?: number;
}

interface TimeSeriesDataPoint {
  date: string;
  activities: number;
  developers: number;
}

/**
 * ActivityChart Component
 *
 * アクティビティと開発者数の時系列グラフを表示。
 * Rechartsを使用し、レスポンシブ対応。
 */
export function ActivityChart({ data, height = 300 }: ActivityChartProps): JSX.Element {
  // LineChartでアクティビティと開発者数をプロット
  // ツールチップで詳細情報を表示
  // ダークモード対応
}
```

### SwapyContainer

```typescript
interface SwapyContainerProps {
  children: React.ReactNode;
  storageKey?: string;
}

/**
 * SwapyContainer Component
 *
 * Swapyライブラリを使用してドラッグ&ドロップを提供。
 * ウィジェットの並び替えをlocalStorageに永続化。
 */
export function SwapyContainer({ children, storageKey = 'overview-layout' }: SwapyContainerProps): JSX.Element {
  // Swapyインスタンスを初期化
  // ドラッグ&ドロップイベントをハンドリング
  // レイアウト変更をlocalStorageに保存
}
```

## データフロー

1. ページロード時に`loader`が実行される
2. `GET /api/overview/stats`と`GET /api/overview/timeline`を並列で呼び出す
3. データを取得してコンポーネントに渡す
4. StatCardとActivityChartがデータを表示
5. SwapyContainerがドラッグ&ドロップを有効化
6. レイアウト変更時にlocalStorageに保存

```typescript
// Loader実装例
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  // 統計情報とタイムラインデータを並列取得
  const [statsResponse, timelineResponse] = await Promise.all([
    fetch('/api/overview/stats', {
      headers: { Cookie: request.headers.get('Cookie') || '' }
    }),
    fetch('/api/overview/timeline?days=30', {
      headers: { Cookie: request.headers.get('Cookie') || '' }
    })
  ]);

  const stats = await statsResponse.json();
  const timeline = await timelineResponse.json();

  return json<OverviewData>({
    stats: stats.stats,
    recentActivities: [],
    timeSeriesData: timeline.timeline
  });
}
```

## テスト要件

### E2Eテスト

`core/e2e/dashboard-overview.spec.ts`を作成：

1. **統計カード表示テスト**: 4つの統計カードが正しく表示されることを確認
2. **グラフ表示テスト**: Rechartsグラフが描画されることを確認
3. **ドラッグ&ドロップテスト**: ウィジェットを並び替えられることを確認
4. **ダークモードテスト**: ダークモード切り替えで色が変わることを確認
5. **レスポンシブテスト**: モバイルビューポートで1カラムになることを確認

### API統合テスト

`core/app/routes/api/overview.test.ts`を作成：

1. **GET /api/overview/stats**: 統計情報が正しく返されることを確認
2. **GET /api/overview/timeline**: タイムラインデータが正しく返されることを確認
3. **認証テスト**: 未認証時に401が返されることを確認

## パフォーマンス考慮事項

- **データキャッシング**: Loaderでデータをキャッシュし、再レンダリングを最小化
- **遅延ロード**: グラフコンポーネントは遅延ロードで初期ロード時間を短縮
- **メモ化**: StatCardとActivityChartは`React.memo`でメモ化
- **デバウンス**: Swapyのレイアウト保存はデバウンスで不要な書き込みを防ぐ

## セキュリティ考慮事項

- **認証チェック**: 全てのAPIエンドポイントで`requireAuth()`を使用
- **テナント分離**: RLSポリシーで他テナントのデータにアクセスできないことを保証
- **XSS対策**: ユーザー入力は全てエスケープ
- **CSRF対策**: RemixのCSRFトークンを使用

## 完了条件

- [x] Overviewページが`/dashboard`で表示される
- [x] 4つの統計カード（開発者数、アクティビティ数、施策数、ROI平均値）が表示される
- [x] Rechartsグラフが描画され、過去30日間のデータが表示される
- [x] Swapyでウィジェットをドラッグ&ドロップで並び替えられる
- [x] レイアウト変更がlocalStorageに保存され、リロード後も維持される
- [x] ダークモード対応が完了している
- [x] レスポンシブデザインが実装されている（モバイル/タブレット/デスクトップ）
- [x] E2Eテストが実装され、全テストがパスする
- [x] TypeScriptエラーがない
- [x] ESLintエラーがない

## 備考

- Swapyはデフォルトで`animation: 'dynamic'`を使用
- グラフの色はTailwindのindigoカラーを基調とする
- 統計カードのアイコンはHeroiconsを使用
- ウィジェットの並び替え順序は`data-swapy-slot`属性で管理
