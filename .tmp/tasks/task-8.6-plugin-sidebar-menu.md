# Task 8.6: プラグインのサイドメニュー表示実装

**Status:** ドキュメント作成完了
**Branch:** `feature/task-8.6-plugin-sidebar-menu`
**Estimated Time:** 2 時間

---

## 概要

プラグインが定義したメニュー項目をダッシュボードのサイドメニューに動的に追加する機能を実装します。

### 責務

- **plugin.json の menu フィールド読み込み**: プラグインメタデータから menu 設定を取得
- **動的メニュー追加**: サイドバーにプラグインのメニュー項目を追加
- **アクセス権限チェック**: ユーザーのロール・権限に基づいてメニュー項目の表示を制御

---

## 実装対象ファイル

### `core/plugin-system/menu.ts`

プラグインメニューの読み込み・集約機能を提供します。

#### インタフェース

```typescript
/**
 * 子メニュー項目の定義（第2階層、children フィールドなし）
 */
interface PluginMenuItemChild {
  /** 表示ラベル */
  label: string;

  /** アイコン名（例: "mdi:account-multiple"） */
  icon?: string;

  /** リンク先のパス */
  path: string;

  /** 必要な権限（複数指定可能） */
  capabilities?: string[];

  /** プラグインキー（内部使用、自動付与） */
  pluginKey: string;
}

/**
 * プラグインメニュー項目の定義（第1階層、最大2階層まで）
 */
interface PluginMenuItem {
  /** 表示ラベル */
  label: string;

  /** アイコン名（例: "mdi:chart-line"） */
  icon?: string;

  /** リンク先のパス */
  path: string;

  /** 必要な権限（複数指定可能） */
  capabilities?: string[];

  /** 子メニュー（第2階層のみ、これ以上のネストは不可） */
  children?: PluginMenuItemChild[];

  /** プラグインキー（内部使用、自動付与） */
  pluginKey: string;
}

/**
 * プラグインメニュー設定（plugin.json の menu フィールド）
 */
interface PluginMenuConfig {
  /** メニュー項目のリスト */
  items: PluginMenuItem[];

  /** メニューセクションの表示位置（例: "main", "bottom"） */
  section?: 'main' | 'bottom';
}
```

#### 関数

**`getPluginMenuItems(tenantId: string): Promise<PluginMenuItem[]>`**
- 有効化されているプラグインの一覧を取得（`plugins` テーブルから `enabled = true` のプラグインを取得）
- 各プラグインの `plugin.json` から `menu` フィールドを読み込み
- **メニュー階層の検証**: 各項目の深さをチェックし、最大2階層を超える構造を検出
  - 第1階層の項目に `children.children` が存在する場合はエラーログを出力
  - プラグイン名と問題のあるパス（`item.path`）を明示
  - 3階層目以降を切り詰める（`children.children` を削除）
- すべてのメニュー項目を配列として集約
- プラグインキーを各項目に付与（`pluginKey` フィールド）
- メニュー項目をソートして返す（section ごとにグループ化）

**`validateMenuDepth(items: any[], pluginKey: string, maxDepth: number = 2): PluginMenuItem[]`**
- メニュー項目の階層構造を検証し、最大深さを強制
- `maxDepth` を超える階層が見つかった場合：
  - エラーログを出力（プラグインキー、問題のあるパス、検出された深さ）
  - 超過した階層を切り詰める（3階層目以降の `children` を削除）
- 検証済みの構造を返す

**`filterMenuItemsByPermission(items: PluginMenuItem[], userCapabilities: string[]): PluginMenuItem[]`**
- メニュー項目の `capabilities` フィールドをチェック
- ユーザーが持つ権限（`userCapabilities`）と照合
- 権限がない項目を除外してフィルタリング
- 子メニュー（`children`）にも適用（再帰不要、最大2階層のため）

---

### `app/routes/dashboard.tsx`

ダッシュボードレイアウトのサイドバーにプラグインメニューを統合します。

#### Loader 実装

```typescript
// app/routes/dashboard.tsx
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { getPluginMenuItems, filterMenuItemsByPermission } from '~/plugin-system/menu';
import { requireAuth } from '~/services/auth.service';

export async function loader({ request }: LoaderFunctionArgs) {
  // 認証チェック
  const user = await requireAuth(request);

  // プラグインメニュー項目を取得（エラーハンドリング付き）
  let pluginMenuItems: PluginMenuItem[] = [];
  try {
    const rawMenuItems = await getPluginMenuItems(user.tenantId);

    // ユーザー権限でフィルタリング
    const userCapabilities = user.capabilities || [];
    pluginMenuItems = filterMenuItemsByPermission(rawMenuItems, userCapabilities);
  } catch (error) {
    // エラーログを出力（DB、パース、FSエラーなど）
    console.error('[Dashboard Loader] Failed to load plugin menu items:', error);
    // プラグインメニューが取得できなくてもページは正常にロード（空配列を使用）
    pluginMenuItems = [];
  }

  return json({
    user,
    pluginMenuItems,
  });
}
```

#### コンポーネント実装

```typescript
// app/routes/dashboard.tsx
import { useLoaderData } from '@remix-run/react';
import { Sidebar } from '~/components/Sidebar';

export default function DashboardLayout() {
  const { user, pluginMenuItems } = useLoaderData<typeof loader>();

  return (
    <div className="flex h-screen">
      <Sidebar user={user} pluginMenuItems={pluginMenuItems} />
      <main className="flex-1">
        {/* ダッシュボードコンテンツ */}
      </main>
    </div>
  );
}
```

---

### `app/components/Sidebar.tsx`

サイドバーコンポーネントを更新し、プラグインメニューを動的に表示します。

```typescript
// app/components/Sidebar.tsx
import { Link } from '@remix-run/react';
import { Icon } from '@iconify/react';
import type { PluginMenuItem } from '~/plugin-system/menu';

interface SidebarProps {
  user: User;
  pluginMenuItems: PluginMenuItem[];
}

export function Sidebar({ user, pluginMenuItems }: SidebarProps) {
  return (
    <aside className="w-64 bg-gray-800 text-white">
      {/* コアメニュー */}
      <nav>
        <SidebarLink to="/dashboard" label="Overview" icon="mdi:view-dashboard" />
        <SidebarLink to="/dashboard/developers" label="Developers" icon="mdi:account-group" />
        <SidebarLink to="/dashboard/campaigns" label="Campaigns" icon="mdi:bullhorn" />
        <SidebarLink to="/dashboard/funnel" label="Funnel" icon="mdi:filter" />
      </nav>

      {/* プラグインメニュー（動的） */}
      {pluginMenuItems.length > 0 && (
        <nav className="mt-4 pt-4 border-t border-gray-700">
          <div className="px-4 py-2 text-xs font-semibold text-gray-400">
            Plugins
          </div>
          {pluginMenuItems.map((item) => (
            <MenuItem key={item.path} item={item} />
          ))}
        </nav>
      )}

      {/* システム設定（最下部） */}
      <nav className="mt-auto">
        <SidebarLink to="/dashboard/settings" label="Settings" icon="mdi:cog" />
      </nav>
    </aside>
  );
}

function MenuItem({ item, depth = 0 }: { item: PluginMenuItem | PluginMenuItemChild; depth?: number }) {
  // 深さ制限のエンフォース: 2階層を超える場合は警告ログと子要素なしレンダリング
  if (depth > 1) {
    console.warn(`[MenuItem] Maximum nesting depth (2) exceeded for path: ${item.path}`);
    return (
      <Link
        to={item.path}
        className="flex items-center px-4 py-2 hover:bg-gray-700"
      >
        {item.icon && <Icon icon={item.icon} className="mr-2" />}
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <>
      <Link
        to={item.path}
        className="flex items-center px-4 py-2 hover:bg-gray-700"
      >
        {item.icon && <Icon icon={item.icon} className="mr-2" />}
        <span>{item.label}</span>
      </Link>

      {/* 子メニュー（最大2階層まで、depth < 1 の場合のみ） */}
      {depth < 1 && 'children' in item && item.children && item.children.length > 0 && (
        <div className="ml-4">
          {item.children.map((child) => (
            <MenuItem key={child.path} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

function SidebarLink({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <Link to={to} className="flex items-center px-4 py-2 hover:bg-gray-700">
      <Icon icon={icon} className="mr-2" />
      <span>{label}</span>
    </Link>
  );
}
```

---

## plugin.json の menu フィールド仕様

プラグインの `plugin.json` に `menu` フィールドを追加することで、サイドメニューに項目を追加できます。

### 例 1: 単一メニュー項目

```json
{
  "name": "drowl-plugin-google-analytics",
  "version": "1.0.0",
  "description": "Google Analytics integration for DRM",
  "main": "dist/index.js",
  "drm": {
    "type": "analytics",
    "coreVersion": "^0.1.0",
    "menu": {
      "section": "main",
      "items": [
        {
          "label": "Analytics",
          "icon": "mdi:chart-line",
          "path": "/dashboard/plugins/google-analytics",
          "capabilities": ["analytics:read"]
        }
      ]
    }
  }
}
```

### 例 2: 階層メニュー（子メニュー付き）

```json
{
  "name": "drowl-plugin-crm",
  "version": "1.0.0",
  "description": "CRM integration for DRM",
  "main": "dist/index.js",
  "drm": {
    "type": "integration",
    "coreVersion": "^0.1.0",
    "menu": {
      "section": "main",
      "items": [
        {
          "label": "CRM",
          "icon": "mdi:briefcase",
          "path": "/dashboard/plugins/crm",
          "capabilities": ["crm:read"],
          "children": [
            {
              "label": "Contacts",
              "icon": "mdi:account-multiple",
              "path": "/dashboard/plugins/crm/contacts",
              "capabilities": ["crm:contacts:read"]
            },
            {
              "label": "Organizations",
              "icon": "mdi:domain",
              "path": "/dashboard/plugins/crm/organizations",
              "capabilities": ["crm:organizations:read"]
            }
          ]
        }
      ]
    }
  }
}
```

---

## アクセス権限チェック

### ユーザー権限の取得

ユーザーの権限（`capabilities`）は以下のように取得されます：

- **Admin ユーザー**: すべての権限を持つ（`capabilities: ["*"]`）
- **Member ユーザー**: `users` テーブルの `capabilities` カラムから取得

### 権限フィルタリングのロジック

1. メニュー項目の `capabilities` フィールドをチェック
2. `capabilities` が未定義または空配列の場合、権限チェックをスキップ（すべてのユーザーに表示）
3. ユーザーが `["*"]` を持つ場合、すべてのメニュー項目を表示
4. それ以外の場合、ユーザーの `capabilities` 配列に含まれる権限を持つメニュー項目のみ表示

---

## エラーハンドリング

- **プラグインメニュー読み込みエラー**: ログに記録し、該当プラグインのメニューをスキップ
- **plugin.json 不正**: menu フィールドが不正な場合、ログに記録してスキップ
- **パスの衝突**: 複数のプラグインが同じパスを定義している場合、警告ログを出力（最初に検出されたものを優先）

---

## セキュリティ

- **パストラバーサル対策**: `path` フィールドの検証（`/dashboard/plugins/` 配下のみ許可）
- **XSS 対策**: `label` と `icon` フィールドのサニタイゼーション
- **権限チェック**: Loader でフィルタリングされたメニュー項目のみをクライアントに送信

---

## テスト方針

### Unit Tests (`core/plugin-system/menu.test.ts`)

- `getPluginMenuItems()`: プラグインメニューの取得、空配列、複数プラグイン、無効化プラグインの除外（4 tests）
- `filterMenuItemsByPermission()`: 権限フィルタリング、Admin ユーザー、権限なしユーザー、子メニューのフィルタリング（4 tests）

### Integration Tests

- ダッシュボードローダーでプラグインメニューが正しく取得される
- ユーザーロールに応じてメニュー項目がフィルタリングされる

### E2E Tests (`core/e2e/plugin-menu.spec.ts`)

- プラグインメニューがサイドバーに表示される
- 権限のないメニュー項目が非表示になる
- プラグイン無効化時にメニュー項目が削除される

合計で最低 10 テスト以上を実装する。

---

## 完了条件

- [ ] `core/plugin-system/menu.ts` 作成
- [ ] `getPluginMenuItems()` 実装
- [ ] `filterMenuItemsByPermission()` 実装
- [ ] `app/routes/dashboard.tsx` の Loader を更新
- [ ] `app/components/Sidebar.tsx` を更新
- [ ] Unit Tests 全パス（最低 10 tests）
- [ ] E2E Tests 全パス
- [ ] `pnpm typecheck` パス
- [ ] `pnpm lint` パス

---

## 依存関係

- **Task 8.4**: Plugin 管理 API（プラグイン一覧取得）
- **Task 7.1**: ダッシュボードレイアウト（Sidebar コンポーネント）

---

## 注意事項

- プラグインメニューは `plugins` テーブルの `enabled = true` のプラグインのみが対象
- メニュー項目の表示順序は `plugin.json` の定義順に従う
- `section` フィールドで "main"（メインメニュー）と "bottom"（最下部）を区別
- 階層メニュー（`children`）は最大 2 階層までサポート
