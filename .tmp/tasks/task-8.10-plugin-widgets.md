# Task 8.10: プラグインのウィジェット表示（ダッシュボード）

**ステータス**: 設計中（ドキュメントのみ）
**推定時間**: 5 時間
**依存**: Task 8.4 (Plugin 管理 API), Task 7.2 (Overview ページ)

---

## 概要

プラグインがダッシュボードにウィジェットを表示できるようにする機能を実装します。プラグインは `plugin.json` の `widgets` フィールドでウィジェットを宣言し、コア側はそれを読み込んでダッシュボードに動的に配置します。

### 設計方針

- **プラグインは「型＋データ」のみを返す**: ウィジェットの描画はアプリ側が担当
- **標準化されたウィジェット型**: `stat`, `table`, `list`, `timeseries`, `barchart`, `pie`, `funnel`, `card`
- **Swapyでドラッグ&ドロップ**: ユーザーがウィジェットの配置を自由に変更できる
- **ユーザー設定の保存**: 配置情報を `user_preferences` テーブルに保存（今回は `system_settings` テーブルを流用）

---

## 1. plugin.json の widgets フィールド

プラグインは `plugin.json` で以下のようにウィジェットを宣言します：

```json
{
  "widgets": [
    {
      "key": "dashboard.timeseries",
      "type": "timeseries",
      "title": "Contributions (30d)",
      "version": "1.0"
    },
    {
      "key": "stats.signups",
      "type": "stat",
      "title": "Signups (today)",
      "version": "1.0"
    },
    {
      "key": "roi.table",
      "type": "table",
      "title": "Top ROI Campaigns",
      "version": "1.0"
    }
  ]
}
```

### フィールド定義

| フィールド | 型     | 必須 | 説明                                                      |
| ---------- | ------ | ---- | --------------------------------------------------------- |
| `key`      | string | ✓    | ウィジェットの一意なキー（プラグイン内でユニーク）       |
| `type`     | string | ✓    | ウィジェット型（`stat`, `table`, `timeseries`など）       |
| `title`    | string | ✓    | ウィジェットのタイトル                                    |
| `version`  | string | ✓    | ウィジェットのデータスキーマバージョン（例: `"1.0"`）    |

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

## 3. ウィジェットデータ取得 API

### 3.1 ウィジェット一覧取得

```typescript
// GET /api/plugins/:id/widgets
interface GetPluginWidgetsResponse {
  widgets: Array<{
    key: string;
    type: string;
    title: string;
    version: string;
  }>;
}
```

### 3.2 ウィジェットデータ取得

```typescript
// POST /api/plugins/:id/widgets/:key
interface GetWidgetDataRequest {
  tenantId: string;
  filters?: {
    since?: string; // "2025-09-15/2025-10-14"
    timezone?: string; // "Asia/Tokyo"
    [key: string]: unknown;
  };
  paging?: {
    limit: number;
    offset: number;
  };
  sort?: {
    key: string;
    dir: "asc" | "desc";
  };
  aggregation?: {
    metric: string; // "activities"
    filter?: Record<string, unknown>; // { "action": "click" }
    op: "count" | "sum" | "avg" | "min" | "max";
    bucket?: "hour" | "day" | "week" | "month";
    cumulative?: boolean;
  };
}

type GetWidgetDataResponse =
  | StatWidgetData
  | TableWidgetData
  | TimeseriesWidgetData
  | ListWidgetData
  | CardWidgetData;
```

**実装注意点:**

- プラグインは `POST /plugins/:id/widgets/:key` エンドポイントを実装する
- コア側は `plugin.json` の `routes` に該当するルート定義があるか確認する
- 認証は `auth: "plugin"` (短寿命JWT) を使用

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
    // 2. 各プラグインの GET /api/plugins/:id/widgets を呼んで利用可能なウィジェットを取得
    // 3. widgetsステートに設定
  }, []);

  // 各ウィジェットのデータを取得
  useEffect(() => {
    // widgets配列を元に POST /api/plugins/:id/widgets/:key を呼んでデータを取得
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

## 5. Swapyによるドラッグ&ドロップ

[Swapy](https://swapy.tahazsh.com/) ライブラリを使用してウィジェットのドラッグ&ドロップを実装します。

### 5.1 Swapyの初期化

```typescript
// app/routes/dashboard._index.tsx

import { createSwapy } from 'swapy';

export default function DashboardOverviewPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Swapyを初期化
    const swapy = createSwapy(containerRef.current, {
      animation: 'dynamic',
    });

    // スワップイベントをリスニング
    swapy.onSwap((event) => {
      // ウィジェットの位置が変更されたら保存
      saveWidgetLayout(event.data.array);
    });

    return () => {
      swapy.destroy();
    };
  }, []);

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

### 5.2 レイアウト保存

```typescript
// app/services/widget-layout.service.ts

/**
 * ウィジェットレイアウトを保存する
 */
export async function saveWidgetLayout(
  tenantId: string,
  userId: string,
  widgets: Array<{ id: string; position: number }>
): Promise<void> {
  // system_settingsテーブルに保存（またはuser_preferencesテーブルを新規作成）
  // キー: `widget_layout:${userId}`
  // 値: JSON.stringify(widgets)
}

/**
 * ウィジェットレイアウトを取得する
 */
export async function getWidgetLayout(
  tenantId: string,
  userId: string
): Promise<Array<{ id: string; pluginId: string; widgetKey: string; position: number }>> {
  // system_settingsテーブルから取得
  // デフォルトレイアウトを返す（プラグインがインストールされている場合）
}
```

---

## 6. ユーザー設定の保存

### 6.1 データベーススキーマ

既存の `system_settings` テーブルを流用してユーザー設定を保存します：

```typescript
// core/db/schema/admin.ts

export const systemSettings = pgTable('system_settings', {
  settingId: uuid('setting_id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  key: text('key').notNull(), // 例: "widget_layout:user-123"
  value: jsonb('value').notNull(), // ウィジェット配置情報
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 6.2 保存形式

```typescript
// ユーザー設定のJSON形式
interface WidgetLayoutSettings {
  widgets: Array<{
    id: string; // "plugin-123:widget-abc"
    pluginId: string; // "plugin-123"
    widgetKey: string; // "dashboard.timeseries"
    position: number; // 0, 1, 2, ...
  }>;
}
```

---

## 7. API定義

### 7.1 ウィジェット一覧取得API

```typescript
// app/routes/api.plugins.$id.widgets.ts

export async function loader({ params, request }: LoaderFunctionArgs) {
  // プラグインIDを取得
  const pluginId = params.id;

  // 認証チェック
  const user = await requireAuth(request);

  // プラグインのwidgets定義を取得（plugin.jsonから）
  const widgets = await getPluginWidgets(pluginId);

  return json({ widgets });
}
```

### 7.2 ウィジェットデータ取得API

```typescript
// app/routes/api.plugins.$id.widgets.$key.ts

export async function action({ params, request }: ActionFunctionArgs) {
  // プラグインIDとウィジェットキーを取得
  const pluginId = params.id;
  const widgetKey = params.key;

  // 認証チェック
  const user = await requireAuth(request);

  // リクエストボディを取得
  const requestData: GetWidgetDataRequest = await request.json();

  // プラグインのウィジェットエンドポイントを呼び出す
  // POST /plugins/:id/widgets/:key
  const widgetData = await fetchPluginWidgetData(
    pluginId,
    widgetKey,
    user.tenantId,
    requestData
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

## 8. ウィジェットコンポーネント実装例

### 8.1 StatWidget

```typescript
// app/components/widgets/StatWidget.tsx

interface StatWidgetProps {
  data: StatWidgetData;
}

export function StatWidget({ data }: StatWidgetProps) {
  return (
    <div className="widget-card">
      <h3>{data.title}</h3>
      <div className="stat-value">{data.data.value}</div>
      {data.data.trend && (
        <div className={`stat-trend ${data.data.trend.direction}`}>
          {data.data.trend.direction === 'up' ? '↑' : '↓'} {data.data.trend.value}%
          {data.data.label && <span> {data.data.label}</span>}
        </div>
      )}
    </div>
  );
}
```

### 8.2 TimeseriesWidget

```typescript
// app/components/widgets/TimeseriesWidget.tsx

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TimeseriesWidgetProps {
  data: TimeseriesWidgetData;
}

export function TimeseriesWidget({ data }: TimeseriesWidgetProps) {
  // データをRechartsの形式に変換
  const chartData = transformToChartData(data.data.series);

  return (
    <div className="widget-card">
      <h3>{data.title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          {data.data.series.map((series, index) => (
            <Line
              key={series.label}
              type="monotone"
              dataKey={series.label}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 9. セキュリティとバリデーション

### 9.1 ウィジェットデータのバリデーション

プラグインから返されたウィジェットデータは、JSON Schemaで検証します。

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

### 9.2 認証とテナント分離

ウィジェットデータ取得時は必ず認証を行い、テナントIDを検証します。

```typescript
// app/services/plugin-widget.service.ts

export async function fetchPluginWidgetData(
  pluginId: string,
  widgetKey: string,
  tenantId: string,
  requestData: GetWidgetDataRequest
): Promise<GetWidgetDataResponse> {
  // プラグインのルート定義を確認
  const route = await getPluginRoute(pluginId, 'POST', `/widgets/${widgetKey}`);
  if (!route) {
    throw new Error(`Widget route not found: ${widgetKey}`);
  }

  // 短寿命JWTを生成
  const token = await generatePluginToken(pluginId, tenantId);

  // プラグインのエンドポイントを呼び出す
  const response = await fetch(`/plugins/${pluginId}/widgets/${widgetKey}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...requestData, tenantId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch widget data: ${response.statusText}`);
  }

  const data = await response.json();

  // データを検証
  validateWidgetData(data);

  return data;
}
```

---

## 10. テスト戦略

### 10.1 単体テスト

- `WidgetRenderer` コンポーネントのレンダリングテスト
- 各ウィジェットコンポーネント（`StatWidget`, `TimeseriesWidget` など）のテスト
- `validateWidgetData` のバリデーションテスト

### 10.2 統合テスト

- `GET /api/plugins/:id/widgets` の一覧取得テスト
- `POST /api/plugins/:id/widgets/:key` のデータ取得テスト
- レイアウト保存API のテスト

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
   - `GET /api/plugins/:id/widgets`
   - `POST /api/plugins/:id/widgets/:key`
   - プラグインウィジェットエンドポイントの呼び出し

3. **Phase 3**: Overviewページへの統合
   - ウィジェットコンテナの実装
   - データ取得とレンダリング
   - ローディング・エラーハンドリング

4. **Phase 4**: ドラッグ&ドロップとレイアウト保存
   - Swapyの統合
   - レイアウト保存API
   - レイアウト復元機能

---

## 12. 注意事項

- ウィジェットは**プラグインのルーティング**を通じてデータを取得します（`plugin.json` の `routes` で定義）
- ウィジェットデータは必ずバリデーションを行い、不正なデータを受け入れないようにします
- ユーザーごとにレイアウトを保存できるようにします（`system_settings` または専用テーブル）
- ウィジェットの表示数が増えた場合のパフォーマンスを考慮し、キャッシングや lazy loading を検討します
- `refreshHintSec` を尊重してウィジェットデータのキャッシュを実装します

---

## 完了条件

- [ ] プラグインのウィジェット定義を `plugin.json` から読み込める
- [ ] ウィジェット一覧取得API が実装されている（`GET /api/plugins/:id/widgets`）
- [ ] ウィジェットデータ取得API が実装されている（`POST /api/plugins/:id/widgets/:key`）
- [ ] Overview ページにウィジェットが表示される
- [ ] Swapyでウィジェットのドラッグ&ドロップができる
- [ ] ウィジェットレイアウトがユーザーごとに保存される
- [ ] ページリロード後もレイアウトが保持される
- [ ] E2Eテストが全てパスする

---

**次のステップ**: レビュー後、実装フェーズに入ります。
