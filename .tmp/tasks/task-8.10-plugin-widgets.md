# Task 8.10: プラグインのウィジェット表示（ダッシュボード）

**ステータス**: 設計中（ドキュメントのみ）
**推定時間**: 5 時間
**依存**: Task 8.4 (Plugin 管理 API), Task 7.2 (Overview ページ)

---

## 概要

プラグインがダッシュボードにウィジェットを表示できるようにする機能を実装します。プラグインは `plugin.json` の `widgets` フィールドでウィジェットを宣言し、コア側はそれを読み込んでダッシュボードに動的に配置します。

### 設計方針

- **宣言的なデータソース定義**: プラグインは `dataSource` を宣言し、コア側がクエリを実行
- **標準化されたウィジェット型**: `stat`, `table`, `list`, `timeseries`, `barchart`, `pie`, `funnel`, `card`
- **プラグイン固有データの識別**: `activities.source` フィールドで各プラグインが登録したデータを区別
- **既存のドラッグ&ドロップ機能を活用**: Task 7.2 で実装済みの Swapy を使用
- **ユーザー設定の保存**: 配置情報を `user_preferences` テーブルに保存

---

## 1. plugin.json の widgets フィールド

プラグインは `plugin.json` で以下のように**ウィジェットとデータソースを宣言的に定義**します：

```json
{
  "widgets": [
    {
      "key": "stats.signups",
      "type": "stat",
      "title": "Signups (today)",
      "version": "1.0",
      "dataSource": {
        "entity": "developers",
        "aggregation": {
          "op": "count",
          "filter": {
            "createdAt": { "gte": "today" }
          }
        }
      }
    },
    {
      "key": "dashboard.github_activities",
      "type": "timeseries",
      "title": "GitHub Activities (30d)",
      "version": "1.0",
      "dataSource": {
        "entity": "activities",
        "aggregation": {
          "op": "count",
          "bucket": "day",
          "filter": {
            "source": "github",
            "ts": { "gte": "30d" }
          }
        }
      }
    },
    {
      "key": "roi.campaigns",
      "type": "table",
      "title": "Top ROI Campaigns",
      "version": "1.0",
      "dataSource": {
        "entity": "campaigns",
        "columns": ["name", "clicks", "conversions", "roi"],
        "sort": { "key": "roi", "dir": "desc" },
        "limit": 10
      }
    }
  ]
}
```

### フィールド定義

| フィールド   | 型     | 必須 | 説明                                                      |
| ------------ | ------ | ---- | --------------------------------------------------------- |
| `key`        | string | ✓    | ウィジェットの一意なキー（プラグイン内でユニーク）       |
| `type`       | string | ✓    | ウィジェット型（`stat`, `table`, `timeseries`など）       |
| `title`      | string | ✓    | ウィジェットのタイトル                                    |
| `version`    | string | ✓    | ウィジェットのデータスキーマバージョン（例: `"1.0"`）    |
| `dataSource` | object | ✓    | データソース定義（コア側がクエリを実行）                  |

### dataSource フィールド

| フィールド    | 型     | 必須 | 説明                                                      |
| ------------- | ------ | ---- | --------------------------------------------------------- |
| `entity`      | string | ✓    | データソースのエンティティ（`developers`, `activities`, `campaigns`など） |
| `aggregation` | object |      | 集計定義（`count`, `sum`, `avg`など）                     |
| `columns`     | array  |      | テーブル表示用のカラムリスト                              |
| `filter`      | object |      | フィルタ条件（**必須**: `source` でプラグインを識別、他に `createdAt`, `ts` など） |
| `sort`        | object |      | ソート条件                                                |
| `limit`       | number |      | 取得件数制限                                              |

**重要**: `filter.source` は必ず指定してください。これにより各プラグインが登録したデータを識別します。
- 例: GitHub プラグイン → `"source": "github"`
- 例: Slack プラグイン → `"source": "slack"`

---

## 2. ウィジェット型の定義

標準化されたウィジェット型を定義します。各型は特定のデータ構造を持ち、アプリ側がそれに応じてレンダリングします。

### 2.1 `stat` - 統計値ウィジェット

単一の数値を大きく表示します。

```typescript
interface StatWidgetData {
  version: string; // "1.0"
  type: "stat";
  title: string; // "Signups (today)"
  data: {
    value: number; // 142
    trend?: {
      value: number; // 12.5 (%)
      direction: "up" | "down"; // "up"
    };
    label?: string; // "vs yesterday"
  };
  refreshHintSec?: number; // 3600
}
```

### 2.2 `table` - テーブルウィジェット

表形式のデータを表示します。

```typescript
interface TableWidgetData {
  version: string; // "1.0"
  type: "table";
  title: string; // "Top ROI Campaigns"
  data: {
    columns: Array<{ key: string; label: string; align?: "left" | "center" | "right" }>;
    rows: Array<Record<string, string | number>>;
  };
  refreshHintSec?: number; // 3600
}
```

### 2.3 `timeseries` - 時系列グラフウィジェット

時系列データを折れ線グラフで表示します。

```typescript
interface TimeseriesWidgetData {
  version: string; // "1.0"
  type: "timeseries";
  title: string; // "Contributions (30d)"
  data: {
    interval: "hour" | "day" | "week" | "month";
    series: Array<{
      label: string; // "PRs"
      points: Array<[string, number]>; // [["2025-10-01", 5], ["2025-10-02", 7]]
    }>;
  };
  refreshHintSec?: number; // 3600
}
```

### 2.4 `list` - リストウィジェット

アイテムのリストを表示します。

```typescript
interface ListWidgetData {
  version: string; // "1.0"
  type: "list";
  title: string; // "Recent Activities"
  data: {
    items: Array<{
      id: string;
      title: string;
      description?: string;
      timestamp?: string; // ISO 8601
      link?: string;
    }>;
  };
  refreshHintSec?: number; // 3600
}
```

### 2.5 `card` - カードウィジェット

自由形式のカードコンテンツを表示します。

```typescript
interface CardWidgetData {
  version: string; // "1.0"
  type: "card";
  title: string; // "Quick Actions"
  data: {
    content: string; // Markdown or plain text
    actions?: Array<{
      label: string;
      url: string;
      variant?: "primary" | "secondary";
    }>;
  };
  refreshHintSec?: number; // 3600
}
```

---

## 3. ウィジェットデータ取得 API（コア側で実装）

### 3.1 全ウィジェット一覧取得

```typescript
// GET /api/widgets
interface GetWidgetsResponse {
  widgets: Array<{
    id: string; // "plugin-123:stats.signups"
    pluginId: string;
    key: string;
    type: string;
    title: string;
    version: string;
  }>;
}
```

### 3.2 特定ウィジェットのデータ取得

```typescript
// GET /api/widgets/:widgetId/data
interface GetWidgetDataResponse =
  | StatWidgetData
  | TableWidgetData
  | TimeseriesWidgetData
  | ListWidgetData
  | CardWidgetData;
```

**実装方針:**

- コア側が `plugin.json` の `dataSource` 定義を読み取る
- コア側で Drizzle ORM を使ってクエリを実行
- プラグイン側のエンドポイント実装は不要（declarative）
- データ取得ロジックはすべて `app/services/widget-data.service.ts` で実装

---

## 4. Overview ページへのウィジェット配置

### 4.1 ウィジェットコンテナの実装

`app/routes/dashboard._index.tsx` にウィジェットコンテナを追加します。

```typescript
// app/routes/dashboard._index.tsx

interface WidgetInstance {
  id: string; // ユニークID（配置管理用）
  pluginId: string;
  widgetKey: string;
  position: number; // 表示順序
}

export default function DashboardOverviewPage() {
  const [widgets, setWidgets] = useState<WidgetInstance[]>([]);
  const [widgetData, setWidgetData] = useState<Record<string, GetWidgetDataResponse>>({});

  // ウィジェット一覧を取得
  useEffect(() => {
    // 1. ユーザー設定から配置情報を取得
    // 2. GET /api/widgets を呼んで利用可能なウィジェット一覧を取得
    // 3. widgetsステートに設定
  }, []);

  // 各ウィジェットのデータを取得
  useEffect(() => {
    // widgets配列を元に GET /api/widgets/:widgetId/data を呼んでデータを取得
    // コア側が plugin.json の dataSource 定義を読み取ってクエリを実行
    // widgetDataステートに設定
  }, [widgets]);

  return (
    <div className="p-6">
      <h1>Dashboard Overview</h1>

      {/* ウィジェットグリッド（Swapyでドラッグ&ドロップ対応） */}
      <div className="widget-grid" data-swapy-container>
        {widgets.map((widget) => (
          <WidgetRenderer
            key={widget.id}
            widget={widget}
            data={widgetData[widget.id]}
          />
        ))}
      </div>
    </div>
  );
}
```

### 4.2 ウィジェットレンダラーの実装

```typescript
// app/components/widgets/WidgetRenderer.tsx

interface WidgetRendererProps {
  widget: WidgetInstance;
  data?: GetWidgetDataResponse;
}

export function WidgetRenderer({ widget, data }: WidgetRendererProps) {
  // データがまだ取得されていない場合はローディング表示
  if (!data) {
    return <WidgetSkeleton />;
  }

  // ウィジェット型に応じて適切なコンポーネントをレンダリング
  switch (data.type) {
    case "stat":
      return <StatWidget data={data} />;
    case "table":
      return <TableWidget data={data} />;
    case "timeseries":
      return <TimeseriesWidget data={data} />;
    case "list":
      return <ListWidget data={data} />;
    case "card":
      return <CardWidget data={data} />;
    default:
      return <UnsupportedWidget type={data.type} />;
  }
}
```

---

## 5. 既存のドラッグ&ドロップ機能の活用

**Task 7.2 で実装済みの Swapy 機能を活用します。** 新規実装は不要です。

### 5.1 既存の useSwapy フックを使用

```typescript
// app/routes/dashboard._index.tsx

import { useSwapy } from '~/hooks/useSwapy.js';

export default function DashboardOverviewPage() {
  const { containerRef, resetLayout } = useSwapy({
    storageKey: 'widget-layout', // localStorage キー
    animation: 'dynamic',
    onLayoutChange: async (layout) => {
      // user_preferences テーブルに保存
      await saveWidgetLayout(layout);
    },
  });

  return (
    <div ref={containerRef} className="widget-grid" data-swapy-container>
      {widgets.map((widget, index) => (
        <div key={widget.id} data-swapy-slot={index}>
          <div data-swapy-item={widget.id}>
            <WidgetRenderer widget={widget} data={widgetData[widget.id]} />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 5.2 localStorage から user_preferences テーブルへの移行

**Task 7.2 では localStorage にレイアウトを保存していましたが、Task 8.10 では `user_preferences` テーブルに移行します。**

```typescript
// app/services/widget-layout.service.ts

/**
 * ウィジェットレイアウトを保存する
 *
 * Task 7.2 の useSwapy フックから呼び出される。
 * localStorage → user_preferences テーブルへの移行。
 */
export async function saveWidgetLayout(
  tenantId: string,
  userId: string,
  layout: Record<string, string> // Swapy の layout 形式
): Promise<void> {
  return await withTenantContext(tenantId, async (tx) => {
    await tx
      .insert(schema.userPreferences)
      .values({
        userId,
        tenantId,
        key: 'widget_layout',
        value: layout,
      })
      .onConflictDoUpdate({
        target: [schema.userPreferences.userId, schema.userPreferences.key],
        set: {
          value: layout,
          updatedAt: new Date(),
        },
      });
  });
}

/**
 * ウィジェットレイアウトを取得する
 *
 * user_preferences テーブルから取得。
 * 存在しない場合は localStorage のレイアウトを使用（後方互換性）。
 */
export async function getWidgetLayout(
  tenantId: string,
  userId: string
): Promise<Record<string, string> | null> {
  return await withTenantContext(tenantId, async (tx) => {
    const [preference] = await tx
      .select()
      .from(schema.userPreferences)
      .where(
        and(
          eq(schema.userPreferences.userId, userId),
          eq(schema.userPreferences.key, 'widget_layout')
        )
      )
      .limit(1);

    return preference?.value as Record<string, string> ?? null;
  });
}
```

---

## 6. ユーザー設定の保存

### 6.1 データベーススキーマ

`user_preferences` テーブルを新規作成してユーザー設定を保存します：

```typescript
// core/db/schema/user.ts

export const userPreferences = pgTable('user_preferences', {
  preferenceId: uuid('preference_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  key: text('key').notNull(), // 例: "widget_layout", "theme", "locale"
  value: jsonb('value').notNull(), // ユーザー設定値（ウィジェット配置情報など）
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // ユーザーごとにキーはユニーク
  uniqueUserKey: unique().on(table.userId, table.key),
  // RLS用のインデックス
  tenantIdIdx: index('user_preferences_tenant_id_idx').on(table.tenantId),
}));
```

**RLSポリシー:**
```sql
-- user_preferences テーブルのRLSポリシー
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_preferences_tenant_isolation
  ON user_preferences
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::text);
```

### 6.2 保存形式

Swapy のレイアウト形式をそのまま保存します：

```typescript
// user_preferences.value の形式（Swapyのレイアウト形式）
type WidgetLayoutSettings = Record<string, string>;

// 例:
// {
//   "slot-1": "item-github-activities",
//   "slot-2": "item-slack-messages",
//   "slot-3": "item-campaign-roi"
// }
```

---

## 7. API定義

### 7.1 全ウィジェット一覧取得API

```typescript
// app/routes/api.widgets.ts

export async function loader({ request }: LoaderFunctionArgs) {
  // 認証チェック
  const user = await requireAuth(request);

  // 全プラグインの widgets 定義を取得（plugin.jsonから）
  const widgets = await listAllWidgets(user.tenantId);

  return json({ widgets });
}
```

### 7.2 ウィジェットデータ取得API

```typescript
// app/routes/api.widgets.$widgetId.data.ts

export async function loader({ params, request }: LoaderFunctionArgs) {
  // 認証チェック
  const user = await requireAuth(request);

  // widgetId をパース（形式: "pluginId:widgetKey"）
  const [pluginId, widgetKey] = params.widgetId!.split(':');

  // プラグインの dataSource 定義を取得
  const widgetDef = await getWidgetDefinition(pluginId, widgetKey);

  // コア側で dataSource に基づいてクエリを実行
  const widgetData = await fetchWidgetData(
    user.tenantId,
    widgetDef.dataSource,
    widgetDef.type
  );

  return json(widgetData);
}
```

### 7.3 ウィジェットレイアウト保存API

```typescript
// app/routes/api.user.widget-layout.ts

export async function action({ request }: ActionFunctionArgs) {
  // 認証チェック
  const user = await requireAuth(request);

  // リクエストボディを取得
  const { widgets } = await request.json();

  // レイアウトを保存
  await saveWidgetLayout(user.tenantId, user.userId, widgets);

  return json({ success: true });
}
```

---

## 8. ウィジェットコンポーネント実装ガイド

### 8.0 共通定数とヘルパー関数

#### 8.0.1 カラーパレット定義

**ファイル**: `app/components/widgets/constants.ts`

```typescript
/**
 * ウィジェットグラフのカラーパレット
 * Recharts の Line/Bar/Area コンポーネントで使用
 */
export const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // green-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
] as const;
```

#### 8.0.2 時系列データ変換ヘルパー

**ファイル**: `app/components/widgets/TimeseriesWidget.tsx`

```typescript
/**
 * 時系列データを Recharts 形式に変換
 *
 * @param series - TimeseriesWidgetData の series フィールド
 * @returns Recharts 互換の配列
 *
 * 入力例:
 * [
 *   { label: "PRs", points: [["2025-10-01", 5], ["2025-10-02", 7]] },
 *   { label: "Issues", points: [["2025-10-01", 3], ["2025-10-02", 4]] }
 * ]
 *
 * 出力例:
 * [
 *   { date: "2025-10-01", PRs: 5, Issues: 3 },
 *   { date: "2025-10-02", PRs: 7, Issues: 4 }
 * ]
 */
function transformToChartData(
  series: Array<{ label: string; points: Array<[string, number]> }>
): Array<{ date: string; [seriesLabel: string]: string | number }> {
  // 1. 全ての日付を収集（重複を排除）
  const allDates = new Set<string>();
  for (const s of series) {
    for (const [date] of s.points) {
      allDates.add(date);
    }
  }

  // 2. 日付でソート
  const sortedDates = Array.from(allDates).sort();

  // 3. 各日付ごとに、全シリーズのデータをマージ
  return sortedDates.map((date) => {
    const dataPoint: { date: string; [key: string]: string | number } = { date };

    for (const s of series) {
      // この日付のデータポイントを探す
      const point = s.points.find(([d]) => d === date);
      dataPoint[s.label] = point ? point[1] : 0; // データがなければ 0
    }

    return dataPoint;
  });
}
```

### 8.1 StatWidget

**ファイル**: `app/components/widgets/StatWidget.tsx`

```typescript
import type { StatWidgetData } from '~/types/widget-api.js';

interface StatWidgetProps {
  data: StatWidgetData;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

export function StatWidget({ data, isLoading, isError, errorMessage }: StatWidgetProps) {
  // ローディング状態
  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4 animate-pulse" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
      </div>
    );
  }

  // エラー状態
  if (isError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
          {data.title}
        </h3>
        <p className="text-sm text-red-700 dark:text-red-300">
          {errorMessage || 'Failed to load data'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
        {data.title}
      </h3>
      <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
        {data.data.value.toLocaleString()}
      </div>
      {data.data.trend && (
        <div className="mt-2 flex items-center gap-1">
          <span className={data.data.trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}>
            {data.data.trend.direction === 'up' ? '↑' : '↓'} {data.data.trend.value}%
          </span>
          {data.data.label && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {data.data.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

### 8.2 TimeseriesWidget

**ファイル**: `app/components/widgets/TimeseriesWidget.tsx`

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CHART_COLORS } from './constants.js';
import type { TimeseriesWidgetData } from '~/types/widget-api.js';

interface TimeseriesWidgetProps {
  data: TimeseriesWidgetData;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

export function TimeseriesWidget({ data, isLoading, isError, errorMessage }: TimeseriesWidgetProps) {
  // ローディング状態
  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  // エラー状態
  if (isError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
          {data.title}
        </h3>
        <p className="text-sm text-red-700 dark:text-red-300">
          {errorMessage || 'Failed to load chart data'}
        </p>
      </div>
    );
  }

  // データをRechartsの形式に変換
  const chartData = transformToChartData(data.data.series);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {data.title}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis dataKey="date" className="text-xs text-gray-600 dark:text-gray-400" />
          <YAxis className="text-xs text-gray-600 dark:text-gray-400" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
          />
          <Legend />
          {data.data.series.map((series, index) => (
            <Line
              key={series.label}
              type="monotone"
              dataKey={series.label}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 時系列データを Recharts 形式に変換（上記 8.0.2 の実装）
 */
function transformToChartData(
  series: Array<{ label: string; points: Array<[string, number]> }>
): Array<{ date: string; [seriesLabel: string]: string | number }> {
  const allDates = new Set<string>();
  for (const s of series) {
    for (const [date] of s.points) {
      allDates.add(date);
    }
  }

  const sortedDates = Array.from(allDates).sort();

  return sortedDates.map((date) => {
    const dataPoint: { date: string; [key: string]: string | number } = { date };
    for (const s of series) {
      const point = s.points.find(([d]) => d === date);
      dataPoint[s.label] = point ? point[1] : 0;
    }
    return dataPoint;
  });
}
```

### 8.3 TableWidget（スタブ実装）

**ファイル**: `app/components/widgets/TableWidget.tsx`

```typescript
import type { TableWidgetData } from '~/types/widget-api.js';

interface TableWidgetProps {
  data: TableWidgetData;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

export function TableWidget({ data, isLoading, isError, errorMessage }: TableWidgetProps) {
  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
          {data.title}
        </h3>
        <p className="text-sm text-red-700 dark:text-red-300">
          {errorMessage || 'Failed to load table data'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {data.title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700">
            <tr>
              {data.data.columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-${col.align || 'left'}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.data.rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-200 dark:border-gray-700"
              >
                {data.data.columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-${col.align || 'left'}`}
                  >
                    {String(row[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### 8.4 ListWidget（スタブ実装）

**ファイル**: `app/components/widgets/ListWidget.tsx`

```typescript
import type { ListWidgetData } from '~/types/widget-api.js';

interface ListWidgetProps {
  data: ListWidgetData;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

export function ListWidget({ data, isLoading, isError, errorMessage }: ListWidgetProps) {
  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
          {data.title}
        </h3>
        <p className="text-sm text-red-700 dark:text-red-300">
          {errorMessage || 'Failed to load list data'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {data.title}
      </h3>
      <ul className="space-y-3">
        {data.data.items.map((item) => (
          <li
            key={item.id}
            className="border-l-2 border-blue-500 pl-4 py-2"
          >
            {item.link ? (
              <a
                href={item.link}
                className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {item.title}
              </a>
            ) : (
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {item.title}
              </div>
            )}
            {item.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {item.description}
              </p>
            )}
            {item.timestamp && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {new Date(item.timestamp).toLocaleString()}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 8.5 CardWidget（スタブ実装）

**ファイル**: `app/components/widgets/CardWidget.tsx`

```typescript
import type { CardWidgetData } from '~/types/widget-api.js';

interface CardWidgetProps {
  data: CardWidgetData;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

export function CardWidget({ data, isLoading, isError, errorMessage }: CardWidgetProps) {
  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
          {data.title}
        </h3>
        <p className="text-sm text-red-700 dark:text-red-300">
          {errorMessage || 'Failed to load card data'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {data.title}
      </h3>
      <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
        {/* TODO: Markdown レンダリング（react-markdown 等を使用） */}
        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {data.data.content}
        </p>
      </div>
      {data.data.actions && data.data.actions.length > 0 && (
        <div className="flex gap-2 mt-4">
          {data.data.actions.map((action, idx) => (
            <a
              key={idx}
              href={action.url}
              className={
                action.variant === 'primary'
                  ? 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                  : 'px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600'
              }
            >
              {action.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 9. データ取得サービスの実装

### 9.1 ウィジェットデータサービス

```typescript
// app/services/widget-data.service.ts

import { withTenantContext } from '../../db/connection.js';
import * as schema from '../../db/schema/index.js';
import { eq, gte, lte, and, count, sum, avg } from 'drizzle-orm';

interface DataSourceDefinition {
  entity: string;
  aggregation?: {
    op: 'count' | 'sum' | 'avg' | 'min' | 'max';
    field?: string;
    filter?: Record<string, unknown>;
    bucket?: 'hour' | 'day' | 'week' | 'month';
  };
  columns?: string[];
  filter?: Record<string, unknown>;
  sort?: { key: string; dir: 'asc' | 'desc' };
  limit?: number;
}

/**
 * ウィジェットデータを取得する
 */
export async function fetchWidgetData(
  tenantId: string,
  dataSource: DataSourceDefinition,
  widgetType: string
): Promise<unknown> {
  return await withTenantContext(tenantId, async (tx) => {
    // エンティティに応じたテーブルを選択
    const table = getTableForEntity(dataSource.entity);

    // フィルタ条件を構築
    const filters = buildFilters(dataSource.filter);

    // ウィジェット型に応じてデータを取得
    if (widgetType === 'stat' && dataSource.aggregation) {
      // 統計値を取得
      const result = await tx
        .select({ value: count() })
        .from(table)
        .where(and(eq(table.tenantId, tenantId), ...filters));

      return {
        version: '1.0',
        type: 'stat',
        title: '',
        data: { value: result[0]?.value ?? 0 },
      };
    }

    if (widgetType === 'timeseries' && dataSource.aggregation) {
      // 時系列データを取得
      // TODO: bucket に基づいてグループ化
    }

    if (widgetType === 'table') {
      // テーブルデータを取得
      const result = await tx
        .select()
        .from(table)
        .where(and(eq(table.tenantId, tenantId), ...filters))
        .limit(dataSource.limit ?? 100);

      return {
        version: '1.0',
        type: 'table',
        title: '',
        data: {
          columns: dataSource.columns?.map(key => ({ key, label: key })) ?? [],
          rows: result,
        },
      };
    }

    throw new Error(`Unsupported widget type: ${widgetType}`);
  });
}

/**
 * エンティティ名からテーブルを取得
 */
function getTableForEntity(entity: string) {
  switch (entity) {
    case 'developers':
      return schema.developers;
    case 'activities':
      return schema.activities;
    case 'campaigns':
      return schema.campaigns;
    default:
      throw new Error(`Unknown entity: ${entity}`);
  }
}

/**
 * フィルタ条件を構築
 */
function buildFilters(filter?: Record<string, unknown>) {
  // TODO: filter オブジェクトを Drizzle の where 条件に変換
  return [];
}
```

### 9.2 セキュリティとバリデーション

ウィジェットデータは JSON Schema で検証します。

```typescript
// app/utils/widget-validator.ts

import Ajv from 'ajv';

const ajv = new Ajv();

// ウィジェット型ごとのスキーマを定義
const statWidgetSchema = {
  type: 'object',
  required: ['version', 'type', 'title', 'data'],
  properties: {
    version: { type: 'string' },
    type: { const: 'stat' },
    title: { type: 'string' },
    data: {
      type: 'object',
      required: ['value'],
      properties: {
        value: { type: 'number' },
        trend: {
          type: 'object',
          properties: {
            value: { type: 'number' },
            direction: { enum: ['up', 'down'] },
          },
        },
        label: { type: 'string' },
      },
    },
    refreshHintSec: { type: 'number' },
  },
};

/**
 * ウィジェットデータを検証する
 */
export function validateWidgetData(data: unknown): data is GetWidgetDataResponse {
  // 型に応じたスキーマを選択して検証
  const schema = getSchemaForType((data as any).type);
  const validate = ajv.compile(schema);

  if (!validate(data)) {
    throw new Error(`Invalid widget data: ${ajv.errorsText(validate.errors)}`);
  }

  return true;
}
```

### 9.3 認証とテナント分離

ウィジェットデータ取得時は必ず認証を行い、`withTenantContext()` でテナント分離を保証します。

```typescript
// app/routes/api.widgets.$widgetId.data.ts

export async function loader({ params, request }: LoaderFunctionArgs) {
  // 認証チェック（必須）
  const user = await requireAuth(request);

  const [pluginId, widgetKey] = params.widgetId!.split(':');

  // プラグインの dataSource 定義を取得
  const widgetDef = await getWidgetDefinition(pluginId, widgetKey);

  // withTenantContext() でテナント分離を保証
  const widgetData = await fetchWidgetData(
    user.tenantId, // ユーザーのテナントIDを使用
    widgetDef.dataSource,
    widgetDef.type
  );

  // データを検証
  validateWidgetData(widgetData);

  return json(widgetData);
}
```

---

## 10. テスト戦略

### 10.1 単体テスト

- `WidgetRenderer` コンポーネントのレンダリングテスト
- 各ウィジェットコンポーネント（`StatWidget`, `TimeseriesWidget` など）のテスト
- `validateWidgetData` のバリデーションテスト

### 10.2 統合テスト

- `GET /api/widgets` の一覧取得テスト
- `GET /api/widgets/:widgetId/data` のデータ取得テスト
- レイアウト保存API のテスト
- `fetchWidgetData()` のテナント分離テスト

### 10.3 E2Eテスト

- Overviewページでウィジェットが表示されることを確認
- ドラッグ&ドロップでウィジェットを移動できることを確認
- 移動後のレイアウトが保存されることを確認
- ページリロード後もレイアウトが保持されることを確認

---

## 11. 実装の優先順位

1. **Phase 1**: ウィジェット型定義とレンダラー実装
   - TypeScript 型定義
   - `WidgetRenderer` コンポーネント
   - 基本的なウィジェットコンポーネント（`StatWidget`, `TableWidget`）

2. **Phase 2**: データ取得API実装
   - `GET /api/widgets`
   - `GET /api/widgets/:widgetId/data`
   - `fetchWidgetData()` サービスの実装（dataSource → Drizzle クエリ変換）

3. **Phase 3**: Overviewページへの統合
   - ウィジェットコンテナの実装
   - データ取得とレンダリング
   - ローディング・エラーハンドリング

4. **Phase 4**: レイアウト永続化の強化
   - localStorage → `user_preferences` テーブルへの移行
   - レイアウト保存API（`saveWidgetLayout`, `getWidgetLayout`）
   - 既存の `useSwapy` フックとの統合

---

## 12. 注意事項

- ウィジェットのデータ取得は**コア側で完結**します（プラグインはdataSourceを宣言的に定義するのみ）
- **`filter.source` は必須**: 各プラグインが登録したデータを識別するため、必ず `source` フィルタを指定してください
- ウィジェットデータは必ずバリデーションを行い、不正なデータを受け入れないようにします
- **ドラッグ&ドロップは既存実装を活用**: Task 7.2 の `useSwapy` フックを使用します
- ユーザーごとにレイアウトを保存できるようにします（`user_preferences` テーブル、localStorage からの移行）
- ウィジェットの表示数が増えた場合のパフォーマンスを考慮し、キャッシングや lazy loading を検討します
- `refreshHintSec` を尊重してウィジェットデータのキャッシュを実装します
- **外部API連携の流れ**:
  1. プラグインのジョブ機能でGitHub API等からデータを取得
  2. `activities` テーブル等のコアテーブルに保存（`source` フィールドにプラグイン識別子を設定）
  3. ウィジェットの `dataSource.filter.source` でそのデータをフィルタ

---

## 完了条件

- [ ] プラグインのウィジェット定義（dataSource含む、**`filter.source`必須**）を `plugin.json` から読み込める
- [ ] ウィジェット一覧取得API が実装されている（`GET /api/widgets`）
- [ ] ウィジェットデータ取得API が実装されている（`GET /api/widgets/:widgetId/data`）
- [ ] `fetchWidgetData()` サービスが dataSource 定義を Drizzle クエリに変換できる（`source` フィルタを含む）
- [ ] Overview ページにウィジェットが表示される
- [ ] 既存の `useSwapy` フックでウィジェットのドラッグ&ドロップができる
- [ ] ウィジェットレイアウトがユーザーごとに保存される（`user_preferences` テーブル、localStorage からの移行）
- [ ] ページリロード後もレイアウトが保持される
- [ ] E2Eテストが全てパスする

---

**次のステップ**: レビュー後、実装フェーズに入ります。
