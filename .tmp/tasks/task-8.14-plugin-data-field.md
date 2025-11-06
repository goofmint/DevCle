# Task 8.14: menusの/dataを止めて、dataキーに変更する対応

**タスクID**: Task 8.14
**依存**: Task 8.12（プラグインデータ表示UI実装）
**推定時間**: 3時間
**ドキュメント作成日**: 2025-11-06

---

## 1. 背景と目的

### 1.1 現状の問題

現在、プラグインの `/data` ページは `menus` フィールドに含まれている：

```json
{
  "menus": [
    {
      "key": "overview",
      "label": "Overview",
      "to": "/overview",
      "icon": "mdi:chart-line"
    },
    {
      "key": "data",
      "label": "Collected Data",
      "to": "/data",
      "icon": "mdi:database"
    },
    {
      "key": "settings",
      "label": "Settings",
      "to": "/settings",
      "icon": "mdi:cog"
    }
  ]
}
```

しかし、この設計には以下の問題がある：

1. **特殊ページの混在**: `/data` はコア側で提供する標準UIであり、プラグインカスタムページ（`/overview`, `/settings`など）とは性質が異なる
2. **コンポーネント不要**: `/data` はプラグイン側でReactコンポーネントを提供する必要がない（コア側で自動生成）
3. **一貫性の欠如**: 他の特殊ページ（`/runs` = 実行ログ）は既にコア側で自動生成されているが、`/data` だけが `menus` に含まれている

### 1.2 新しい仕様

`/data` ページは `data: true` フィールドで自動生成する仕様に変更する：

```json
{
  "data": true,  // この行を追加すると /data ページが自動生成される
  "menus": [
    {
      "key": "overview",
      "label": "Overview",
      "to": "/overview",
      "icon": "mdi:chart-line"
    },
    {
      "key": "settings",
      "label": "Settings",
      "to": "/settings",
      "icon": "mdi:cog"
    }
    // `/data` は自動生成されるため、menus から削除
  ]
}
```

---

## 2. 仕様詳細

### 2.1 plugin.jsonスキーマ変更

#### 新規フィールド: `data`

| フィールド | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| `data` | `boolean` | No | `false` | `true`の場合、`/data`ページを自動生成 |

#### バリデーションルール

1. `data` フィールドが `true` の場合、`menus` に `/data` パスを含めることはできない
2. `menus` に `to: "/data"` があり、かつ `data: true` の場合、プラグインローダーはエラーを返す

**エラーメッセージ例:**
```
Plugin validation error: Cannot have both 'data: true' and a menu item with path '/data'.
Remove the '/data' menu item from 'menus' array.
```

### 2.2 `/data` ページの自動生成

#### 条件

- `data: true` が設定されている場合、以下のページが自動生成される：
  - **URL**: `/dashboard/plugins/:pluginId/data`
  - **コンポーネント**: コア側で提供（`core/app/routes/dashboard.plugins_.$id.data.tsx`）
  - **API**: `GET /api/plugins/:id/events` （Task 8.11で実装済み）

#### ページ内容

- プラグインが収集した生データ（`plugin_events_raw` テーブル）の一覧表示
- フィルタ機能（ステータス、イベント種別、日付範囲）
- ページネーション
- 詳細モーダル（JSON表示、再処理ボタン）

### 2.3 サイドバーメニューの表示順序

`data: true` の場合、サイドバーメニューは以下の順序で表示される：

1. **Overview** （`menus` の最初のアイテム、存在する場合）
2. **Collected Data** （`data: true` の場合、自動追加）
3. **Custom Menu Items** （`menus` のその他のアイテム）
4. **Settings** （`menus` の最後のアイテム、存在する場合）
5. **Activity Logs** （常に自動追加）

**例:**
```json
{
  "data": true,
  "menus": [
    { "key": "overview", "label": "Overview", "to": "/overview", "icon": "mdi:chart-line" },
    { "key": "custom", "label": "Custom Page", "to": "/custom", "icon": "mdi:puzzle" },
    { "key": "settings", "label": "Settings", "to": "/settings", "icon": "mdi:cog" }
  ]
}
```

**結果のサイドバー:**
1. Overview
2. Collected Data （自動追加）
3. Custom Page
4. Settings
5. Activity Logs （自動追加）

---

## 3. 実装内容

### 3.1 プラグインスキーマ更新

#### ファイル: `core/plugin-system/types.ts`

```typescript
// plugin.json の型定義
interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  vendor?: string;
  homepage?: string;
  license?: string;

  // 新規追加
  data?: boolean;

  capabilities: {
    scopes: string[];
    network: string[];
    secrets: string[];
  };

  settingsSchema: SettingsSchemaField[];
  menus: MenuDefinition[];
  widgets: WidgetDefinition[];
  routes: RouteDefinition[];
  jobs: JobDefinition[];

  rateLimits?: { perMinute: number; burst: number };
  i18n?: { supported: string[] };
}

// メニュー定義
interface MenuDefinition {
  key: string;
  label: string;
  to: string;
  icon: string;
}
```

### 3.2 バリデーション実装

#### ファイル: `core/plugin-system/validator.ts`

```typescript
import { z } from 'zod';

// plugin.json のZodスキーマ
const PluginManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),

  // 新規追加: data フィールド
  data: z.boolean().optional().default(false),

  capabilities: z.object({
    scopes: z.array(z.string()),
    network: z.array(z.string()),
    secrets: z.array(z.string()),
  }),

  menus: z.array(z.object({
    key: z.string(),
    label: z.string(),
    to: z.string(),
    icon: z.string(),
  })),

  // 他のフィールド省略
})
.refine((data) => {
  // バリデーションルール: data: true かつ menus に /data がある場合はエラー
  if (data.data === true) {
    const hasDataMenu = data.menus.some((menu) => menu.to === '/data');
    if (hasDataMenu) {
      return false; // エラー
    }
  }
  return true;
}, {
  message: "Cannot have both 'data: true' and a menu item with path '/data'. Remove the '/data' menu item from 'menus' array.",
});

/**
 * plugin.json をバリデーションする
 */
export function validatePluginManifest(manifest: unknown): PluginManifest {
  return PluginManifestSchema.parse(manifest);
}
```

### 3.3 プラグインローダー修正

#### ファイル: `core/plugin-system/loader.ts`

```typescript
import { validatePluginManifest } from './validator.js';
import type { PluginManifest } from './types.js';

/**
 * プラグインをロードする
 */
export async function loadPlugin(pluginId: string): Promise<PluginManifest> {
  const manifestPath = path.join(PLUGINS_DIR, pluginId, 'plugin.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

  // バリデーション（エラーの場合は例外をスロー）
  const validated = validatePluginManifest(manifest);

  return validated;
}

/**
 * プラグインのメニューを生成する
 *
 * data: true の場合、"/data" メニューを自動追加
 */
export function generatePluginMenus(manifest: PluginManifest): MenuDefinition[] {
  const menus = [...manifest.menus];

  // data: true の場合、"/data" メニューを自動追加
  if (manifest.data === true) {
    // Overview の後に挿入
    const overviewIndex = menus.findIndex((m) => m.key === 'overview');
    const insertIndex = overviewIndex >= 0 ? overviewIndex + 1 : 0;

    menus.splice(insertIndex, 0, {
      key: 'data',
      label: 'Collected Data',
      to: '/data',
      icon: 'mdi:database',
    });
  }

  // Activity Logs は常に最後に追加（既に実装済み）
  menus.push({
    key: 'logs',
    label: 'Activity Logs',
    to: '/runs',
    icon: 'mdi:file-document-outline',
  });

  return menus;
}
```

### 3.4 サイドバーメニュー生成ロジック修正

#### ファイル: `core/app/routes/dashboard.tsx`

```typescript
import { generatePluginMenus } from '~/plugin-system/loader.js';

/**
 * ダッシュボードのローダー
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  // プラグイン一覧を取得
  const plugins = await listPlugins(user.tenantId);

  // 各プラグインのメニューを生成
  const pluginMenus = plugins.map((plugin) => {
    return {
      pluginId: plugin.pluginId,
      name: plugin.name,
      menus: generatePluginMenus(plugin.manifest),
    };
  });

  return json({ user, pluginMenus });
}
```

---

## 4. 既存プラグインの移行

### 4.1 影響範囲

以下のプラグインに影響がある：

- `drowl-plugin-test` （テストプラグイン）

### 4.2 移行手順

#### ステップ1: plugin.json の更新

**変更前:**
```json
{
  "menus": [
    { "key": "overview", "label": "Overview", "to": "/overview", "icon": "mdi:chart-line" },
    { "key": "data", "label": "Collected Data", "to": "/data", "icon": "mdi:database" },
    { "key": "settings", "label": "Settings", "to": "/settings", "icon": "mdi:cog" },
    { "key": "logs", "label": "Activity Logs", "to": "/logs", "icon": "mdi:file-document-outline" }
  ]
}
```

**変更後:**
```json
{
  "data": true,
  "menus": [
    { "key": "overview", "label": "Overview", "to": "/overview", "icon": "mdi:chart-line" },
    { "key": "settings", "label": "Settings", "to": "/settings", "icon": "mdi:cog" }
  ]
}
```

**変更内容:**
1. `data: true` を追加
2. `menus` から `data` エントリを削除
3. `menus` から `logs` エントリを削除（既に自動追加されているため）

#### ステップ2: コンポーネントの削除

`/data` ページはコア側で自動生成されるため、プラグイン側のコンポーネントは不要：

- 削除: `plugins/drowl-plugin-test/src/components/DataPage.tsx` （存在する場合）

---

## 5. テスト計画

### 5.1 単体テスト（Vitest）

#### ファイル: `core/plugin-system/validator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validatePluginManifest } from './validator.js';

describe('validatePluginManifest', () => {
  it('data: true のみの場合、正常に通る', () => {
    const manifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      data: true,
      capabilities: { scopes: [], network: [], secrets: [] },
      menus: [
        { key: 'overview', label: 'Overview', to: '/overview', icon: 'icon' },
      ],
      settingsSchema: [],
      widgets: [],
      routes: [],
      jobs: [],
    };

    expect(() => validatePluginManifest(manifest)).not.toThrow();
  });

  it('data: true かつ menus に /data がある場合、エラー', () => {
    const manifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      data: true,
      capabilities: { scopes: [], network: [], secrets: [] },
      menus: [
        { key: 'data', label: 'Data', to: '/data', icon: 'icon' },
      ],
      settingsSchema: [],
      widgets: [],
      routes: [],
      jobs: [],
    };

    expect(() => validatePluginManifest(manifest)).toThrow(
      /Cannot have both 'data: true' and a menu item with path '\/data'/
    );
  });

  it('data: false の場合、menus に /data があってもエラーにならない', () => {
    const manifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      data: false,
      capabilities: { scopes: [], network: [], secrets: [] },
      menus: [
        { key: 'data', label: 'Data', to: '/data', icon: 'icon' },
      ],
      settingsSchema: [],
      widgets: [],
      routes: [],
      jobs: [],
    };

    expect(() => validatePluginManifest(manifest)).not.toThrow();
  });
});
```

#### ファイル: `core/plugin-system/loader.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { generatePluginMenus } from './loader.js';

describe('generatePluginMenus', () => {
  it('data: true の場合、"/data" メニューが Overview の後に追加される', () => {
    const manifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      data: true,
      menus: [
        { key: 'overview', label: 'Overview', to: '/overview', icon: 'icon' },
        { key: 'settings', label: 'Settings', to: '/settings', icon: 'icon' },
      ],
      // 他のフィールド省略
    };

    const menus = generatePluginMenus(manifest);

    expect(menus).toHaveLength(4); // overview, data, settings, logs
    expect(menus[0].key).toBe('overview');
    expect(menus[1].key).toBe('data');
    expect(menus[1].to).toBe('/data');
    expect(menus[2].key).toBe('settings');
    expect(menus[3].key).toBe('logs');
  });

  it('data: false の場合、"/data" メニューは追加されない', () => {
    const manifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      data: false,
      menus: [
        { key: 'overview', label: 'Overview', to: '/overview', icon: 'icon' },
      ],
      // 他のフィールド省略
    };

    const menus = generatePluginMenus(manifest);

    expect(menus).toHaveLength(2); // overview, logs
    expect(menus[0].key).toBe('overview');
    expect(menus[1].key).toBe('logs');
  });
});
```

### 5.2 E2Eテスト（Playwright）

#### ファイル: `core/e2e/plugin-data-field.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Plugin data field', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン処理
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('data: true の場合、"Collected Data" メニューが表示される', async ({ page }) => {
    // テストプラグインのページに移動
    await page.goto('/dashboard/plugins/drowl-plugin-test');

    // サイドバーに "Collected Data" メニューが存在することを確認
    const dataLink = page.locator('nav a:has-text("Collected Data")');
    await expect(dataLink).toBeVisible();

    // クリックして /data ページに移動
    await dataLink.click();
    await page.waitForURL('/dashboard/plugins/drowl-plugin-test/data');

    // ページタイトルが表示されることを確認
    await expect(page.locator('h1:has-text("Collected Data")')).toBeVisible();
  });

  test('data: true の場合、メニューの順序が正しい', async ({ page }) => {
    await page.goto('/dashboard/plugins/drowl-plugin-test');

    // サイドバーメニューを取得
    const menuItems = page.locator('nav a');

    // 順序を確認
    await expect(menuItems.nth(0)).toHaveText('Overview');
    await expect(menuItems.nth(1)).toHaveText('Collected Data');
    await expect(menuItems.nth(2)).toHaveText('Settings');
    await expect(menuItems.nth(3)).toHaveText('Activity Logs');
  });
});
```

---

## 6. ドキュメント更新

### 6.1 プラグイン開発ガイド

**ファイル**: `docs/plugin-development-guide.md`

#### セクション追加: 「データ収集ページ」

```markdown
## データ収集ページ（`/data`）

プラグインが外部APIからデータを収集する場合、そのデータを表示するための `/data` ページを自動生成できます。

### 有効化方法

`plugin.json` に `data: true` を追加します：

\`\`\`json
{
  "id": "github",
  "name": "GitHub",
  "version": "1.0.0",
  "data": true,
  "menus": [
    { "key": "overview", "label": "Overview", "to": "/overview", "icon": "mdi:chart-line" }
  ]
}
\`\`\`

### 表示内容

- プラグインが収集した生データ（`plugin_events_raw` テーブル）の一覧
- フィルタ機能（ステータス、イベント種別、日付範囲）
- ページネーション
- 詳細モーダル（JSON表示、再処理ボタン）

### 注意事項

- `/data` ページはコア側で自動生成されるため、プラグイン側でReactコンポーネントを提供する必要はありません
- `data: true` の場合、`menus` に `to: "/data"` を含めることはできません（バリデーションエラー）
```

### 6.2 Migration Guide

**ファイル**: `docs/plugin-migration-guide.md`

```markdown
# プラグイン移行ガイド

## v1.0.0 → v2.0.0: `/data` ページの自動生成

### 変更内容

`/data` ページは `data: true` フィールドで自動生成されるようになりました。

### 移行手順

#### ステップ1: plugin.json の更新

**変更前:**
\`\`\`json
{
  "menus": [
    { "key": "data", "label": "Collected Data", "to": "/data", "icon": "mdi:database" }
  ]
}
\`\`\`

**変更後:**
\`\`\`json
{
  "data": true,
  "menus": []
}
\`\`\`

#### ステップ2: コンポーネントの削除

`/data` ページはコア側で自動生成されるため、プラグイン側のコンポーネントは不要です：

- 削除: `src/components/DataPage.tsx` （存在する場合）
```

---

## 7. 完了条件

- [ ] `plugin.json` に `data` フィールドが追加され、Zodスキーマでバリデーションされる
- [ ] `data: true` かつ `menus` に `/data` がある場合、バリデーションエラーが発生する
- [ ] `data: true` の場合、"Collected Data" メニューが自動生成される
- [ ] メニューの表示順序が正しい（Overview → Collected Data → Custom Menus → Settings → Activity Logs）
- [ ] `drowl-plugin-test/plugin.json` が新しい仕様に更新される
- [ ] 単体テスト（Vitest）が全てパスする
- [ ] E2Eテスト（Playwright）が全てパスする
- [ ] プラグイン開発ガイドに `data` フィールドの説明が追加される
- [ ] Migration Guide が作成される

---

## 8. 注意事項

### 8.1 破壊的変更

この変更は既存のプラグインに影響する可能性があります：

- `menus` に `to: "/data"` がある場合、`data: true` を追加するとバリデーションエラーが発生する
- 既存プラグインは plugin.json の更新が必要

### 8.2 `/data` のみ特殊扱い

- `/data` ページのみがコア側で自動生成される
- その他のページ（`/overview`, `/settings` など）は全てプラグイン側でコンポーネントを提供する必要がある
- `/runs` （Activity Logs）は既に自動生成されている（Task 8.9で実装済み）

### 8.3 将来の拡張

将来的に他の標準ページ（例: `/dashboard`, `/reports`）を追加する場合も、同様に `dashboard: true`, `reports: true` のようなフィールドで自動生成できる設計とする。
