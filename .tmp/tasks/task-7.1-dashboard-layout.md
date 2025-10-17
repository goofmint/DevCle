# Task 7.1: ダッシュボードレイアウト実装

**タスク番号**: 7.1
**依存タスク**: Task 2.1（Remix初期セットアップ）
**推定時間**: 3時間
**完了条件**: ダッシュボードが表示され、ナビゲーションが機能する

---

## 概要

DRMのダッシュボードレイアウトを実装します。サイドバーナビゲーション、ヘッダー、メインコンテンツエリアを含む基本的なレイアウト構造を構築します。プラグインによってサイドバーの項目やウィジェットが動的に増減することを想定した拡張可能な設計を行います。

**Phase 7の位置づけ**:
Task 7.1はPhase 7の最初のタスクで、ダッシュボードUIの基盤となるレイアウトを実装します。このタスク完了後、Overview（Task 7.2）、Developers（Task 7.3）、Campaigns（Task 7.4）、Funnel（Task 7.5）の各ページを実装します。

---

## 実装するファイルとインターフェース

### 1. `app/routes/dashboard.tsx`

ダッシュボードのルートレイアウトファイル。認証が必要で、サイドバーとヘッダーを含むレイアウトを提供します。

```typescript
/**
 * Dashboard Layout
 *
 * Provides the main layout structure for the dashboard with:
 * - Sidebar navigation
 * - Header with logo and user info
 * - Main content area
 *
 * Authentication:
 * - All dashboard routes require authentication
 * - Unauthenticated users are redirected to /login
 *
 * Plugin Extensibility:
 * - Sidebar items can be dynamically added by plugins
 * - Widget slots can be registered by plugins
 *
 * Layout Structure:
 * +------------------+-----------------------------+
 * | Sidebar          | Header                      |
 * |                  |-----------------------------|
 * | - Overview       | Main Content Area           |
 * | - Developers     |                             |
 * | - Campaigns      |                             |
 * | - Funnel         |                             |
 * |                  |                             |
 * | [System Settings]|                             |
 * +------------------+-----------------------------+
 */

import { type LoaderFunctionArgs, json, redirect } from '@remix-run/node';
import { Outlet, useLoaderData } from '@remix-run/react';
import { requireAuth } from '~/services/auth.service';
import { DashboardSidebar } from '~/components/dashboard/Sidebar';
import { DashboardHeader } from '~/components/dashboard/Header';

/**
 * Loader function
 *
 * Implementation:
 * 1. Authenticate user (requireAuth)
 * 2. Fetch user information
 * 3. Fetch sidebar navigation items (including plugin-registered items)
 * 4. Return user and navigation data
 * 5. Redirect to /login if not authenticated
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Implementation:
  // 1. Authenticate user
  // 2. Get user info
  // 3. Get navigation items
  // 4. Return loader data
  throw new Error('Not implemented');
}

/**
 * Dashboard layout component
 *
 * Implementation:
 * 1. Render sidebar with navigation items
 * 2. Render header with logo and user info
 * 3. Render <Outlet /> for nested routes
 * 4. Apply responsive design (mobile/desktop)
 */
export default function DashboardLayout() {
  // Implementation:
  // 1. Get loader data (user, navigation items)
  // 2. Render layout with sidebar, header, and main content
  // 3. Pass navigation items to DashboardSidebar
  // 4. Pass user info to DashboardHeader
  throw new Error('Not implemented');
}
```

### 2. `app/components/dashboard/Sidebar.tsx`

サイドバーコンポーネント。ナビゲーション項目を表示し、プラグインによって動的に拡張可能です。

```typescript
/**
 * Dashboard Sidebar Component
 *
 * Displays navigation items with icons and labels.
 * Supports plugin-registered navigation items.
 *
 * Features:
 * - Active link highlighting
 * - Icon support
 * - Badge support (for notifications)
 * - System Settings at the bottom
 * - Mobile responsive (collapsible)
 *
 * Navigation Items:
 * - Overview (Home icon)
 * - Developers (Users icon)
 * - Campaigns (Megaphone icon)
 * - Funnel (Filter icon)
 * - System Settings (Settings icon, at bottom)
 *
 * Plugin Extensibility:
 * - Plugins can register new navigation items
 * - Items are inserted in order based on plugin registration
 */

import { NavLink } from '@remix-run/react';
import type { NavigationItem } from '~/types/dashboard';

interface DashboardSidebarProps {
  /**
   * Navigation items to display
   * Includes both core items and plugin-registered items
   */
  items: NavigationItem[];

  /**
   * Whether the sidebar is collapsed (mobile)
   */
  isCollapsed?: boolean;

  /**
   * Callback when sidebar toggle is clicked
   */
  onToggle?: () => void;
}

/**
 * Sidebar component
 *
 * Implementation:
 * 1. Separate items into main items and bottom items
 * 2. Render navigation items with icons
 * 3. Use NavLink for active state
 * 4. Apply Tailwind CSS for styling
 * 5. Handle mobile collapse state
 */
export function DashboardSidebar({
  items,
  isCollapsed = false,
  onToggle,
}: DashboardSidebarProps) {
  // Implementation:
  // 1. Filter main items and bottom items
  // 2. Render navigation items with icons and labels
  // 3. Apply active state styling
  // 4. Handle mobile responsive behavior
  throw new Error('Not implemented');
}
```

### 3. `app/components/dashboard/Header.tsx`

ヘッダーコンポーネント。ロゴとユーザー情報を表示します。

```typescript
/**
 * Dashboard Header Component
 *
 * Displays logo and user information with dropdown menu.
 *
 * Features:
 * - Logo (links to dashboard overview)
 * - User avatar (or initials)
 * - User name and role
 * - Dropdown menu (Profile, Settings, Logout)
 * - Dark mode toggle
 *
 * Layout:
 * +----------------------------------+
 * | [Logo]              [User ▼]    |
 * +----------------------------------+
 */

import { Link, Form } from '@remix-run/react';
import type { User } from '~/types/dashboard';

interface DashboardHeaderProps {
  /**
   * Current user information
   */
  user: User;
}

/**
 * Header component
 *
 * Implementation:
 * 1. Render logo with link to /dashboard/overview
 * 2. Render user avatar or initials
 * 3. Render user name and role
 * 4. Render dropdown menu with Profile, Settings, Logout
 * 5. Handle logout form submission
 * 6. Apply Tailwind CSS for styling
 */
export function DashboardHeader({ user }: DashboardHeaderProps) {
  // Implementation:
  // 1. Render logo and user info
  // 2. Implement dropdown menu (using Headless UI)
  // 3. Handle logout action
  // 4. Apply responsive design
  throw new Error('Not implemented');
}
```

### 4. `app/routes/dashboard._index.tsx`

ダッシュボードのインデックスルート。`/dashboard`にアクセスした場合、`/dashboard/overview`にリダイレクトします。

```typescript
/**
 * Dashboard Index Route
 *
 * Redirects to /dashboard/overview
 *
 * Purpose:
 * - /dashboard is the default dashboard route
 * - Automatically redirect to /dashboard/overview
 * - This ensures a consistent user experience
 */

import { redirect } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';

/**
 * Loader function
 *
 * Implementation:
 * 1. Redirect to /dashboard/overview
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Implementation:
  // 1. Return redirect to /dashboard/overview
  throw new Error('Not implemented');
}
```

### 5. `app/types/dashboard.ts`

ダッシュボード関連の型定義。

```typescript
/**
 * Dashboard Type Definitions
 *
 * Defines types for dashboard layout, navigation, and widgets.
 */

/**
 * Navigation item type
 */
export interface NavigationItem {
  /**
   * Unique key for the navigation item
   */
  key: string;

  /**
   * Display label
   */
  label: string;

  /**
   * Route path
   */
  path: string;

  /**
   * Icon name (from icon library)
   */
  icon: string;

  /**
   * Badge text (optional, for notifications)
   */
  badge?: string;

  /**
   * Whether this item should be shown at the bottom
   */
  isBottomItem?: boolean;

  /**
   * Plugin ID (if registered by a plugin)
   */
  pluginId?: string;

  /**
   * Order number (for sorting)
   */
  order?: number;
}

/**
 * Dashboard layout data
 */
export interface DashboardLayoutData {
  /**
   * Current user
   */
  user: User;

  /**
   * Navigation items (core + plugins)
   */
  navigationItems: NavigationItem[];
}

/**
 * User type
 */
export interface User {
  /**
   * User ID
   */
  userId: string;

  /**
   * Email address
   */
  email: string;

  /**
   * Display name
   */
  displayName: string;

  /**
   * Role (admin, member)
   */
  role: 'admin' | 'member';

  /**
   * Tenant ID
   */
  tenantId: string;

  /**
   * Avatar URL (optional)
   */
  avatarUrl?: string;
}
```

---

## レイアウト構造

### デスクトップレイアウト

```text
+------------------+-----------------------------+
| Sidebar (240px)  | Main Area                   |
|                  |                             |
| [Logo]           | Header (64px)               |
|                  | +-------------------------+ |
| Overview         | | [Logo]      [User ▼]  | |
| Developers       | +-------------------------+ |
| Campaigns        |                             |
| Funnel           | Content Area                |
|                  | (Outlet)                    |
|                  |                             |
|                  |                             |
|                  |                             |
| [System Settings]|                             |
+------------------+-----------------------------+
```

### モバイルレイアウト

```text
+----------------------------------+
| Header                           |
| [☰]  [Logo]          [User ▼]   |
+----------------------------------+
| Content Area                     |
| (Outlet)                         |
|                                  |
+----------------------------------+

(Sidebar is collapsible, opens as overlay)
```

---

## コンポーネント設計

### コンポーネント階層

```text
DashboardLayout (app/routes/dashboard.tsx)
├── DashboardSidebar (app/components/dashboard/Sidebar.tsx)
│   ├── NavigationItem (internal component)
│   └── NavigationBadge (internal component)
├── DashboardHeader (app/components/dashboard/Header.tsx)
│   ├── UserMenu (internal component)
│   └── DarkModeToggle (internal component)
└── <Outlet /> (nested routes)
```

### スタイリング

- **Tailwind CSS**を使用
- **ダークモード対応**（Tailwind v4の`@custom-variant`を使用）
- **レスポンシブデザイン**（モバイル・デスクトップ）
- **アイコン**: Heroicons（`@heroicons/react`）
- **ドロップダウンメニュー**: Headless UI（`@headlessui/react`）

### アイコンマッピング

| ナビゲーション項目 | アイコン | Heroicon名 |
|------------------|---------|------------|
| Overview | Home | `HomeIcon` |
| Developers | Users | `UsersIcon` |
| Campaigns | Megaphone | `MegaphoneIcon` |
| Funnel | Filter | `FunnelIcon` |
| System Settings | Settings | `Cog6ToothIcon` |

---

## プラグイン拡張性の設計

### ナビゲーション項目の動的追加

プラグインがナビゲーション項目を追加できるように、プラグインシステムとの統合ポイントを設けます。

```typescript
/**
 * Plugin Navigation Registry
 *
 * Allows plugins to register navigation items.
 *
 * Usage:
 * ```typescript
 * // In plugin initialization
 * registerNavigationItem({
 *   key: 'my-plugin-page',
 *   label: 'My Plugin',
 *   path: '/dashboard/plugins/my-plugin',
 *   icon: 'puzzle-piece',
 *   order: 50,
 * });
 * ```
 */

/**
 * Register a navigation item (to be implemented in Task 8.1)
 */
export function registerNavigationItem(item: NavigationItem): void {
  // Implementation:
  // 1. Validate navigation item
  // 2. Add to navigation registry
  // 3. Sort by order number
  throw new Error('Not implemented - Task 8.1');
}

/**
 * Get all navigation items (core + plugins)
 */
export function getNavigationItems(tenantId: string): NavigationItem[] {
  // Implementation:
  // 1. Get core navigation items
  // 2. Get plugin-registered navigation items
  // 3. Merge and sort by order
  // 4. Filter by user permissions
  // 5. Return sorted items
  throw new Error('Not implemented');
}
```

### コアナビゲーション項目

Task 7.1では、コアナビゲーション項目のみを実装します。プラグインによる動的追加は**Task 8.1（Plugin Loader実装）**で実装します。

```typescript
/**
 * Core navigation items
 */
const CORE_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    path: '/dashboard/overview',
    icon: 'home',
    order: 10,
  },
  {
    key: 'developers',
    label: 'Developers',
    path: '/dashboard/developers',
    icon: 'users',
    order: 20,
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    path: '/dashboard/campaigns',
    icon: 'megaphone',
    order: 30,
  },
  {
    key: 'funnel',
    label: 'Funnel',
    path: '/dashboard/funnel',
    icon: 'funnel',
    order: 40,
  },
  {
    key: 'system-settings',
    label: 'System Settings',
    path: '/dashboard/settings',
    icon: 'cog',
    order: 1000, // Always at bottom
    isBottomItem: true,
  },
];
```

---

## 認証とセキュリティ

### 認証チェック

ダッシュボード全体で認証が必須です。`requireAuth()`を使用して認証を強制します。

```typescript
/**
 * Loader function with authentication
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // 1. Authenticate user
  const user = await requireAuth(request);

  // 2. If not authenticated, redirect to /login
  // (requireAuth automatically throws redirect)

  // 3. Get navigation items
  const navigationItems = getNavigationItems(user.tenantId);

  // 4. Return loader data
  return json<DashboardLayoutData>({
    user,
    navigationItems,
  });
}
```

### セキュリティ考慮事項

1. **認証の必須化**: 全てのダッシュボードルートで認証が必要
2. **ロール管理**: 将来的にロールベースのアクセス制御を実装
3. **CSRF保護**: Remix FormはCSRFトークンを自動的に含む
4. **XSS対策**: Reactのデフォルトのエスケープを使用

---

## レスポンシブデザイン

### ブレークポイント

| デバイス | 画面幅 | レイアウト |
|---------|-------|-----------|
| Mobile | < 768px | サイドバーは非表示（ハンバーガーメニュー） |
| Tablet | 768px - 1024px | サイドバー表示 |
| Desktop | > 1024px | サイドバー表示 |

### モバイル対応

```typescript
/**
 * Mobile navigation state
 */
const [isSidebarOpen, setIsSidebarOpen] = useState(false);

/**
 * Toggle sidebar on mobile
 */
const toggleSidebar = () => {
  setIsSidebarOpen(!isSidebarOpen);
};
```

---

## テスト要件

### E2Eテスト（`e2e/dashboard-layout.spec.ts`）

最低8テストケース:

1. **認証チェック**: 未認証ユーザーは/loginにリダイレクトされる
2. **ダッシュボード表示**: 認証済みユーザーはダッシュボードが表示される
3. **サイドバーナビゲーション**: サイドバーの全項目が表示される
4. **ナビゲーション遷移**: Overview/Developers/Campaigns/Funnelに遷移できる
5. **アクティブリンク**: 現在のページがハイライトされる
6. **ヘッダー表示**: ユーザー名とメールアドレスが表示される
7. **ログアウト**: ログアウトボタンをクリックすると/loginに遷移する
8. **モバイル対応**: モバイルでサイドバーが折りたたまれる

### テストコード例

```typescript
import { test, expect } from '@playwright/test';

test.describe('Dashboard Layout', () => {
  test('should redirect to login if not authenticated', async ({ page }) => {
    // Act: Navigate to dashboard without authentication
    await page.goto('/dashboard');

    // Assert: Should redirect to /login
    await expect(page).toHaveURL('/login');
  });

  test('should display dashboard for authenticated user', async ({ page }) => {
    // Arrange: Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Act: Navigate to dashboard
    await page.goto('/dashboard');

    // Assert: Should display dashboard
    await expect(page).toHaveURL('/dashboard/overview');
    await expect(page.locator('text=Overview')).toBeVisible();
  });

  test('should display all navigation items', async ({ page }) => {
    // Arrange: Login and navigate to dashboard
    await loginAndNavigateToDashboard(page);

    // Assert: All navigation items should be visible
    await expect(page.locator('text=Overview')).toBeVisible();
    await expect(page.locator('text=Developers')).toBeVisible();
    await expect(page.locator('text=Campaigns')).toBeVisible();
    await expect(page.locator('text=Funnel')).toBeVisible();
    await expect(page.locator('text=System Settings')).toBeVisible();
  });

  test('should navigate to different pages', async ({ page }) => {
    // Arrange: Login and navigate to dashboard
    await loginAndNavigateToDashboard(page);

    // Act & Assert: Navigate to each page
    await page.click('text=Developers');
    await expect(page).toHaveURL('/dashboard/developers');

    await page.click('text=Campaigns');
    await expect(page).toHaveURL('/dashboard/campaigns');

    await page.click('text=Funnel');
    await expect(page).toHaveURL('/dashboard/funnel');

    await page.click('text=Overview');
    await expect(page).toHaveURL('/dashboard/overview');
  });

  test('should highlight active navigation item', async ({ page }) => {
    // Arrange: Login and navigate to dashboard
    await loginAndNavigateToDashboard(page);

    // Act: Navigate to Developers page
    await page.click('text=Developers');

    // Assert: Developers link should be highlighted
    const developersLink = page.locator('a[href="/dashboard/developers"]');
    await expect(developersLink).toHaveClass(/active/);
  });

  test('should display user information in header', async ({ page }) => {
    // Arrange: Login and navigate to dashboard
    await loginAndNavigateToDashboard(page);

    // Assert: User info should be visible
    await expect(page.locator('text=test@example.com')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Arrange: Login and navigate to dashboard
    await loginAndNavigateToDashboard(page);

    // Act: Click logout button
    await page.click('button[aria-label="User menu"]');
    await page.click('text=Logout');

    // Assert: Should redirect to /login
    await expect(page).toHaveURL('/login');
  });

  test('should collapse sidebar on mobile', async ({ page }) => {
    // Arrange: Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAndNavigateToDashboard(page);

    // Assert: Sidebar should be collapsed
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).not.toBeVisible();

    // Act: Open sidebar
    await page.click('[data-testid="sidebar-toggle"]');

    // Assert: Sidebar should be visible
    await expect(sidebar).toBeVisible();
  });
});

/**
 * Helper function to login and navigate to dashboard
 */
async function loginAndNavigateToDashboard(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard/overview');
}
```

---

## アクセシビリティ

### WAI-ARIA対応

```typescript
/**
 * Accessibility attributes
 */
<nav aria-label="Main navigation">
  <NavLink to="/dashboard/overview" aria-current={isActive ? 'page' : undefined}>
    Overview
  </NavLink>
</nav>

<button aria-label="User menu" aria-expanded={isOpen}>
  {user.displayName}
</button>
```

### キーボードナビゲーション

- **Tab**: フォーカスを次の要素に移動
- **Shift+Tab**: フォーカスを前の要素に移動
- **Enter**: リンクやボタンをアクティブ化
- **Escape**: ドロップダウンメニューを閉じる

---

## 完了チェックリスト

- [ ] `app/routes/dashboard.tsx`ファイル作成
- [ ] `app/routes/dashboard._index.tsx`ファイル作成（/dashboard → /dashboard/overviewリダイレクト）
- [ ] `app/components/dashboard/Sidebar.tsx`コンポーネント作成
- [ ] `app/components/dashboard/Header.tsx`コンポーネント作成
- [ ] `app/types/dashboard.ts`型定義ファイル作成
- [ ] コアナビゲーション項目実装（Overview, Developers, Campaigns, Funnel, System Settings）
- [ ] 認証チェック実装（`requireAuth()`）
- [ ] アクティブリンクのハイライト実装
- [ ] ユーザーメニュー（Profile, Settings, Logout）実装
- [ ] レスポンシブデザイン実装（モバイル・デスクトップ）
- [ ] ダークモード対応
- [ ] E2Eテストファイル作成（`e2e/dashboard-layout.spec.ts`）
- [ ] 8つのE2Eテストケース実装
- [ ] 全テストが成功（`pnpm exec playwright test`）
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] Lintエラーなし（`pnpm lint`）

---

## 次のタスク

Task 7.1完了後、以下のタスクに進みます：

- **Task 7.2**: Overviewページ実装（総アクティビティ数・開発者数・施策件数・ROI平均値、簡易グラフ）
- **Task 7.3**: Developersページ実装（開発者リスト、検索・フィルタ機能、開発者詳細ページ）
- **Task 7.4**: Campaignsページ実装（施策リスト、ROI表示、施策詳細ページ）
- **Task 7.5**: Funnelページ実装（ファネルチャート表示、ドロップ率表示、時系列グラフ）

---

## 参考資料

- [Remix Nested Routes](https://remix.run/docs/en/main/guides/routing#nested-routes)
- [Remix Outlet](https://remix.run/docs/en/main/components/outlet)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Heroicons](https://heroicons.com/)
- [Headless UI](https://headlessui.com/)
- [Playwright Testing](https://playwright.dev/docs/intro)
- Task 2.1: [task-2.1-remix-setup.md](task-2.1-remix-setup.md)（未作成、参考）
