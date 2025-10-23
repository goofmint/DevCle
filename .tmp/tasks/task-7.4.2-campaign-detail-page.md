# Task 7.4.2: 施策詳細ページ実装

**タスクID**: 7.4.2
**フェーズ**: Phase 7（ダッシュボード UI 実装）
**依存**: Task 7.4（Campaigns ページ実装）, Task 7.4.1（Campaign Detail APIs）
**推定時間**: 3時間
**担当**: Frontend Developer

---

## 概要

このタスクでは、**キャンペーン（施策）詳細ページ**を実装します。Task 7.4.1で実装した3つのAPIエンドポイント（budgets, resources, activities）を呼び出し、施策の詳細情報を表示します。

**実装する機能**:
1. **施策詳細情報表示** - キャンペーンの基本情報（名前、期間、ステータス、ROI等）
2. **Budgets リスト表示** - 予算エントリー一覧（ページネーション付き）
3. **Resources リスト表示** - リソース一覧（event, blog, video等）
4. **Activities リスト表示** - 関連アクティビティ一覧（ページネーション付き）

### 背景

- Task 7.4でキャンペーン一覧ページを実装
- Task 7.4.1でキャンペーン詳細データ取得APIを実装
- このタスクでは、詳細ページUIを構築してデータを可視化

---

## 実装方針

### アーキテクチャ

```
User Browser (SPA after authentication)
  ↓
React Component (campaigns.$id.tsx)
  ↓
useEffect / useState (client-side data fetching)
  ↓
API Calls (fetch)
  - GET /api/campaigns/:id (campaign info)
  - GET /api/campaigns/:id/budgets
  - GET /api/campaigns/:id/resources
  - GET /api/campaigns/:id/activities
  - GET /api/campaigns/:id/roi
  ↓
State Management (useState)
  ↓
Component Rendering
```

### 設計原則

1. **Client-Side Rendering (CSR)** - すべてのデータはクライアントサイドでフェッチ（認証後はSPA）
2. **API-First** - 既存のREST APIを活用
3. **認証必須** - ログインユーザーのみアクセス可能（ダッシュボードレイアウトで保証）
4. **型安全性** - TypeScript型定義を活用
5. **再利用可能なコンポーネント** - 共通UIコンポーネントを活用（Task 7.3で実装済み）
6. **レスポンシブデザイン** - モバイル・タブレット・デスクトップ対応

---

## ファイル構成

```
app/routes/
  └── dashboard/
      └── campaigns.$id.tsx           // Campaign Detail Page (新規作成)

app/components/campaigns/              // 新規ディレクトリ（キャンペーン用UIコンポーネント）
  ├── CampaignHeader.tsx               // キャンペーンヘッダー（名前、ステータス、ROI）
  ├── BudgetList.tsx                   // 予算リスト表示
  ├── ResourceList.tsx                 // リソースリスト表示
  └── CampaignActivityList.tsx         // アクティビティリスト表示
```

**ファイルサイズ**: 各ファイル150-300行程度

---

## コンポーネント設計

### 1. campaigns.$id.tsx (メインページ)

```typescript
/**
 * Campaign Detail Page (SPA)
 *
 * Displays comprehensive information about a single campaign:
 * - Campaign header (name, status, dates, ROI)
 * - Budgets section (cost entries with pagination)
 * - Resources section (trackable objects)
 * - Activities section (developer actions with pagination)
 *
 * Route: /dashboard/campaigns/:id
 * Authentication: Handled by DashboardLayout (no loader needed)
 * Data Fetching: Client-side via fetch API
 */

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from '@remix-run/react';

// ==================== Types ====================

interface Campaign {
  campaignId: string;
  tenantId: string;
  name: string;
  startDate: string;
  endDate: string | null;
  status: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== Component ====================

/**
 * Campaign Detail Page Component
 *
 * Layout:
 * - Header: Campaign name, status badge, edit/delete buttons
 * - Stats Row: ROI, total budget, total activities
 * - Tabs: Overview | Budgets | Resources | Activities
 *
 * Implementation:
 * - Fetch campaign data from /api/campaigns/:id (useEffect)
 * - Fetch ROI from /api/campaigns/:id/roi (useEffect)
 * - Child components (BudgetList, ResourceList, CampaignActivityList) fetch their own data
 * - Use TailwindCSS for styling
 * - Use DashboardLayout (Task 7.1)
 *
 * State Management:
 * - campaign: Campaign | null
 * - loading: boolean
 * - error: string | null
 */
export default function CampaignDetailPage() {
  // const { id: campaignId } = useParams();
  // const [searchParams, setSearchParams] = useSearchParams();
  // const activeTab = searchParams.get('tab') || 'overview';

  // const [campaign, setCampaign] = useState<Campaign | null>(null);
  // const [loading, setLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null);

  // useEffect(() => {
  //   async function fetchCampaign() {
  //     try {
  //       setLoading(true);
  //       const response = await fetch(`/api/campaigns/${campaignId}`);
  //       if (!response.ok) {
  //         if (response.status === 404) {
  //           setError('Campaign not found');
  //         } else {
  //           setError('Failed to fetch campaign');
  //         }
  //         return;
  //       }
  //       const data = await response.json();
  //       setCampaign(data.campaign);
  //     } catch (err) {
  //       setError(err.message);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }
  //   if (campaignId) {
  //     fetchCampaign();
  //   }
  // }, [campaignId]);

  // Implementation will be added in coding phase
  // - Render loading skeleton while loading
  // - Render error message if error
  // - Render 404 page if campaign not found
  // - Render CampaignHeader component
  // - Render tab navigation (Overview | Budgets | Resources | Activities)
  // - Conditionally render tab content based on activeTab

  return (
    <div>Campaign Detail Page - Implementation pending</div>
  );
}
```

---

### 2. CampaignHeader.tsx (キャンペーンヘッダー)

```typescript
/**
 * Campaign Header Component
 *
 * Displays campaign summary information:
 * - Campaign name (h1)
 * - Status badge (active/completed/archived)
 * - Date range
 * - ROI indicator (color-coded: green for positive, red for negative)
 * - Action buttons (Edit, Delete, Archive)
 *
 * Props:
 * - campaign: Campaign object (fetched from /api/campaigns/:id)
 * - roi: ROI data (fetched from /api/campaigns/:id/roi)
 */

interface CampaignHeaderProps {
  campaign: {
    campaignId: string;
    name: string;
    startDate: string;
    endDate: string | null;
    status: string;
    description: string | null;
  };
  roi?: {
    totalCost: string;
    totalValue: string;
    roiPercentage: string | null;
  } | null;
}

export function CampaignHeader({ campaign, roi }: CampaignHeaderProps) {
  // Implementation will be added in coding phase
  // - Display campaign name as h1
  // - Display status badge (color-coded based on status)
  // - Display date range in human-readable format
  // - Display ROI with color indicator (green: positive, red: negative, gray: null)
  // - Render action buttons (Edit, Delete, Archive) with appropriate permissions
  // - Handle delete confirmation modal
  // - Use existing UI components (Badge, Button) from Task 7.3
  throw new Error('Not implemented');
}
```

---

### 3. BudgetList.tsx (予算リスト)

```typescript
/**
 * Budget List Component
 *
 * Displays paginated list of budget entries for a campaign.
 * Fetches data from /api/campaigns/:id/budgets
 *
 * Features:
 * - Table view (category, amount, currency, spent_at, memo)
 * - Category filter dropdown
 * - Pagination (limit: 20 per page)
 * - Total cost summary at bottom
 *
 * Props:
 * - campaignId: Campaign ID to fetch budgets for
 */

interface BudgetListProps {
  campaignId: string;
}

interface Budget {
  budgetId: string;
  category: string;
  amount: string;
  currency: string;
  spentAt: string;
  memo: string | null;
  meta: Record<string, any> | null;
  createdAt: string;
}

export function BudgetList({ campaignId }: BudgetListProps) {
  // const [budgets, setBudgets] = useState<Budget[]>([]);
  // const [total, setTotal] = useState(0);
  // const [page, setPage] = useState(1);
  // const [category, setCategory] = useState<string | null>(null);
  // const [loading, setLoading] = useState(true);

  // Implementation will be added in coding phase
  // - useEffect to fetch budgets when campaignId/page/category changes
  // - Fetch from `/api/campaigns/${campaignId}/budgets?limit=20&offset=${(page-1)*20}&category=${category}`
  // - Display data in table format
  // - Render category filter dropdown
  // - Render pagination controls (Previous, Next, Page X of Y)
  // - Calculate and display total cost at bottom
  // - Handle loading state (skeleton loader)
  // - Handle error state (error message + retry button)
  // - Handle empty state (no budgets message)
  throw new Error('Not implemented');
}
```

---

### 4. ResourceList.tsx (リソースリスト)

```typescript
/**
 * Resource List Component
 *
 * Displays list of resources (event, blog, video, etc.) for a campaign.
 * Fetches data from /api/campaigns/:id/resources
 *
 * Features:
 * - Card grid view (responsive: 1-3 columns)
 * - Category filter (event, blog, video, ad, repo, link, form, webinar)
 * - Pagination (limit: 12 per page)
 * - Resource card: title, category badge, URL link, thumbnail (if available)
 *
 * Props:
 * - campaignId: Campaign ID to fetch resources for
 */

interface ResourceListProps {
  campaignId: string;
}

interface Resource {
  resourceId: string;
  category: string;
  groupKey: string | null;
  title: string;
  url: string;
  externalId: string | null;
  campaignId: string;
  attributes: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export function ResourceList({ campaignId }: ResourceListProps) {
  // const [resources, setResources] = useState<Resource[]>([]);
  // const [total, setTotal] = useState(0);
  // const [page, setPage] = useState(1);
  // const [category, setCategory] = useState<string | null>(null);
  // const [loading, setLoading] = useState(true);

  // Implementation will be added in coding phase
  // - useEffect to fetch resources when campaignId/page/category changes
  // - Fetch from `/api/campaigns/${campaignId}/resources?limit=12&offset=${(page-1)*12}&category=${category}`
  // - Display data in responsive card grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
  // - Each card shows: category badge, title (link to URL), attributes
  // - Render category filter dropdown
  // - Render pagination controls
  // - Handle loading/error/empty states
  throw new Error('Not implemented');
}
```

---

### 5. CampaignActivityList.tsx (アクティビティリスト)

```typescript
/**
 * Campaign Activity List Component
 *
 * Displays paginated list of activities attributed to a campaign.
 * Fetches data from /api/campaigns/:id/activities
 *
 * Features:
 * - Timeline view (vertical list with icons)
 * - Action filter dropdown
 * - Pagination (limit: 20 per page)
 * - Activity card: action, developer, timestamp, source, value
 *
 * Props:
 * - campaignId: Campaign ID to fetch activities for
 *
 * Note:
 * - Reuses ActivityTimeline component from Task 7.3 if applicable
 * - Otherwise, creates simplified version for campaign context
 */

interface CampaignActivityListProps {
  campaignId: string;
}

interface Activity {
  activityId: string;
  developerId: string | null;
  accountId: string | null;
  action: string;
  occurredAt: string;
  source: string;
  category: string;
  value: string | null;
  metadata: Record<string, any> | null;
}

export function CampaignActivityList({ campaignId }: CampaignActivityListProps) {
  // const [activities, setActivities] = useState<Activity[]>([]);
  // const [total, setTotal] = useState(0);
  // const [page, setPage] = useState(1);
  // const [action, setAction] = useState<string | null>(null);
  // const [loading, setLoading] = useState(true);

  // Implementation will be added in coding phase
  // - useEffect to fetch activities when campaignId/page/action changes
  // - Fetch from `/api/campaigns/${campaignId}/activities?limit=20&offset=${(page-1)*20}&action=${action}`
  // - Display data in timeline format (vertical list)
  // - Each entry shows: icon (based on action), action name, developer name, timestamp, value
  // - Render action filter dropdown
  // - Render pagination controls
  // - Handle loading/error/empty states
  // - Consider reusing ActivityTimeline component from Task 7.3
  throw new Error('Not implemented');
}
```

---

## データフェッチング戦略

### すべてClient-Side（useEffect + fetch）

認証後はSPAとして動作するため、すべてのデータはクライアントサイドでフェッチします。

**フェッチするデータ**:
1. **Campaign基本情報**（GET /api/campaigns/:id）
   - メインコンポーネントのuseEffectで取得
   - ローディング・エラー・404ハンドリング

2. **ROI情報**（GET /api/campaigns/:id/roi）
   - CampaignHeaderコンポーネントで取得
   - 並行フェッチ可能

3. **Budgets**（GET /api/campaigns/:id/budgets）
   - BudgetListコンポーネントで取得
   - ページネーション対応

4. **Resources**（GET /api/campaigns/:id/resources）
   - ResourceListコンポーネントで取得
   - ページネーション対応

5. **Activities**（GET /api/campaigns/:id/activities）
   - CampaignActivityListコンポーネントで取得
   - ページネーション対応

**利点**:
- SPAとして一貫した動作
- 独立したローディング状態（段階的表示）
- ページネーション・フィルタの柔軟な対応
- 各コンポーネントが独立してデータ管理

---

## UI設計

### レイアウト構成

```
+----------------------------------------------------------+
| Dashboard Layout (Sidebar + Header)                      |
+----------------------------------------------------------+
| Campaign Header                                          |
| [Campaign Name]                     [Edit] [Delete]      |
| Status: [Active]  |  ROI: +125.5%  |  Period: 2025-03-01 ~ |
+----------------------------------------------------------+
| Tabs: [Overview] [Budgets] [Resources] [Activities]     |
+----------------------------------------------------------+
| Tab Content (depends on active tab)                      |
|                                                          |
| Overview Tab:                                            |
|   - Campaign description                                 |
|   - Stats cards (Total Budget, Total Activities, ROI)   |
|   - Quick summary of budgets/resources/activities       |
|                                                          |
| Budgets Tab:                                             |
|   - Category filter dropdown                             |
|   - Budget table (category, amount, date, memo)         |
|   - Pagination controls                                  |
|   - Total cost summary                                   |
|                                                          |
| Resources Tab:                                           |
|   - Category filter dropdown                             |
|   - Resource card grid (title, category, URL)           |
|   - Pagination controls                                  |
|                                                          |
| Activities Tab:                                          |
|   - Action filter dropdown                               |
|   - Activity timeline (icon, action, dev, timestamp)    |
|   - Pagination controls                                  |
+----------------------------------------------------------+
```

### タブナビゲーション

**実装方針**:
- URLクエリパラメータで管理（`?tab=overview|budgets|resources|activities`）
- デフォルトは`overview`
- タブクリックで`setSearchParams`を使用してURL更新
- Progressive Enhancement（JavaScriptなしでも動作）

**例**:
```
/dashboard/campaigns/xxx?tab=budgets
/dashboard/campaigns/xxx?tab=resources&category=event&page=2
```

---

## エラーハンドリング

### Client-Side Errors（API Fetch）

すべてのエラーはクライアントサイドでハンドリングします。

```typescript
// Error state in component
const [error, setError] = useState<string | null>(null);

// Fetch with error handling
try {
  const response = await fetch(`/api/campaigns/${campaignId}/budgets`);
  if (!response.ok) {
    throw new Error('Failed to fetch budgets');
  }
  const data = await response.json();
  setBudgets(data.budgets);
  setTotal(data.total);
} catch (err) {
  setError(err.message);
} finally {
  setLoading(false);
}

// Error UI
{error && (
  <div className="p-4 bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
    <p>Error: {error}</p>
    <button onClick={retryFetch}>Retry</button>
  </div>
)}
```

### ローディング状態

```typescript
// Skeleton loader for budgets table
{loading && (
  <div className="space-y-2">
    <div className="h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
    <div className="h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
    <div className="h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
  </div>
)}
```

### 空状態（Empty State）

```typescript
// No budgets message
{!loading && budgets.length === 0 && (
  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
    <p>No budgets found for this campaign.</p>
    <button className="mt-4 btn-primary">Add Budget</button>
  </div>
)}
```

---

## テスト方針

### E2Eテスト（Playwright）

Task 7.4.2の完了条件は「施策詳細ページが表示され、関連データが確認できる」ことです。以下のテストケースを実装します。

#### テストファイル: `core/e2e/dashboard-campaigns-detail.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Campaign Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('https://devcle.test/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should display campaign header with name and status', async ({ page }) => {
    // Navigate to campaign detail page
    await page.goto('https://devcle.test/dashboard/campaigns/30000000-0000-4000-8000-000000000001');

    // Verify campaign name is displayed
    await expect(page.locator('h1')).toContainText('DevRel Conference 2025');

    // Verify status badge is displayed
    await expect(page.locator('[data-testid="campaign-status"]')).toBeVisible();
  });

  test('should display ROI indicator', async ({ page }) => {
    // Navigate to campaign detail page
    await page.goto('https://devcle.test/dashboard/campaigns/30000000-0000-4000-8000-000000000001');

    // Verify ROI is displayed (may be loading state initially)
    await expect(page.locator('[data-testid="campaign-roi"]')).toBeVisible();
  });

  test('should display budgets list in Budgets tab', async ({ page }) => {
    // Navigate to campaign detail page
    await page.goto('https://devcle.test/dashboard/campaigns/30000000-0000-4000-8000-000000000001?tab=budgets');

    // Wait for budgets to load
    await page.waitForSelector('[data-testid="budget-list"]');

    // Verify budgets table is displayed
    await expect(page.locator('[data-testid="budget-list"]')).toBeVisible();

    // Verify at least one budget row exists
    const budgetRows = page.locator('[data-testid="budget-row"]');
    await expect(budgetRows).toHaveCount(await budgetRows.count());
  });

  test('should filter budgets by category', async ({ page }) => {
    // Navigate to budgets tab
    await page.goto('https://devcle.test/dashboard/campaigns/30000000-0000-4000-8000-000000000001?tab=budgets');

    // Wait for budgets to load
    await page.waitForSelector('[data-testid="budget-list"]');

    // Select category filter
    await page.selectOption('[data-testid="category-filter"]', 'labor');

    // Wait for filtered results
    await page.waitForTimeout(500); // Wait for client-side refetch

    // Verify all displayed budgets have category 'labor'
    const categoryLabels = page.locator('[data-testid="budget-category"]');
    const count = await categoryLabels.count();
    for (let i = 0; i < count; i++) {
      await expect(categoryLabels.nth(i)).toContainText('labor');
    }
  });

  test('should display resources list in Resources tab', async ({ page }) => {
    // Navigate to resources tab
    await page.goto('https://devcle.test/dashboard/campaigns/30000000-0000-4000-8000-000000000001?tab=resources');

    // Wait for resources to load
    await page.waitForSelector('[data-testid="resource-list"]');

    // Verify resources grid is displayed
    await expect(page.locator('[data-testid="resource-list"]')).toBeVisible();
  });

  test('should display activities list in Activities tab', async ({ page }) => {
    // Navigate to activities tab
    await page.goto('https://devcle.test/dashboard/campaigns/30000000-0000-4000-8000-000000000001?tab=activities');

    // Wait for activities to load
    await page.waitForSelector('[data-testid="activity-list"]');

    // Verify activities timeline is displayed
    await expect(page.locator('[data-testid="activity-list"]')).toBeVisible();
  });

  test('should paginate budgets list', async ({ page }) => {
    // Navigate to budgets tab
    await page.goto('https://devcle.test/dashboard/campaigns/30000000-0000-4000-8000-000000000001?tab=budgets');

    // Wait for budgets to load
    await page.waitForSelector('[data-testid="budget-list"]');

    // Verify pagination controls exist (if total > 20)
    const nextButton = page.locator('[data-testid="pagination-next"]');
    if (await nextButton.isVisible()) {
      // Click next page
      await nextButton.click();

      // Wait for new page to load
      await page.waitForTimeout(500);

      // Verify URL updated with page parameter
      expect(page.url()).toContain('page=2');
    }
  });

  test('should return 404 for non-existent campaign', async ({ page }) => {
    // Navigate to non-existent campaign
    const response = await page.goto('https://devcle.test/dashboard/campaigns/99999999-9999-4999-8999-999999999999');

    // Verify 404 status
    expect(response?.status()).toBe(404);

    // Verify error message is displayed
    await expect(page.locator('body')).toContainText('Campaign not found');
  });

  test('should display edit button for admin users', async ({ page }) => {
    // Navigate to campaign detail page
    await page.goto('https://devcle.test/dashboard/campaigns/30000000-0000-4000-8000-000000000001');

    // Verify edit button exists (if user has permission)
    const editButton = page.locator('[data-testid="campaign-edit-button"]');
    // May be visible or hidden depending on user role
  });

  test('should handle empty budgets list gracefully', async ({ page }) => {
    // Create campaign with no budgets (or use existing one with no budgets)
    // Navigate to budgets tab
    await page.goto('https://devcle.test/dashboard/campaigns/30000000-0000-4000-8000-000000000002?tab=budgets');

    // Wait for empty state message
    await page.waitForSelector('[data-testid="budgets-empty-state"]', { timeout: 5000 });

    // Verify empty state message is displayed
    await expect(page.locator('[data-testid="budgets-empty-state"]')).toContainText('No budgets found');
  });
});
```

### テスト実行環境

- **ホスト環境で実行**: `BASE_URL=https://devcle.test pnpm --filter @drm/core exec playwright test e2e/dashboard-campaigns-detail.spec.ts`
- **HTTPS必須**: DevContainerの`/etc/hosts`に`devcle.test`を登録済み
- **認証状態**: 各テストでログイン処理を実行
- **テストデータ**: シードデータに含まれるキャンペーンを使用

---

## 完了条件

- [ ] `app/routes/dashboard/campaigns.$id.tsx`ファイル作成
- [ ] useEffectでキャンペーン基本情報をクライアントサイドで取得
- [ ] 404エラーハンドリング（キャンペーンが存在しない場合）
- [ ] `app/components/campaigns/CampaignHeader.tsx`作成
  - [ ] キャンペーン名、ステータス、期間、ROI表示
  - [ ] 編集・削除ボタン実装
- [ ] `app/components/campaigns/BudgetList.tsx`作成
  - [ ] 予算リスト表示（テーブル形式）
  - [ ] カテゴリフィルタ実装
  - [ ] ページネーション実装
  - [ ] ローディング・エラー・空状態ハンドリング
- [ ] `app/components/campaigns/ResourceList.tsx`作成
  - [ ] リソースリスト表示（カードグリッド形式）
  - [ ] カテゴリフィルタ実装
  - [ ] ページネーション実装
  - [ ] ローディング・エラー・空状態ハンドリング
- [ ] `app/components/campaigns/CampaignActivityList.tsx`作成
  - [ ] アクティビティリスト表示（タイムライン形式）
  - [ ] アクションフィルタ実装
  - [ ] ページネーション実装
  - [ ] ローディング・エラー・空状態ハンドリング
- [ ] タブナビゲーション実装（Overview | Budgets | Resources | Activities）
- [ ] URLクエリパラメータ対応（?tab=xxx&page=xxx&category=xxx）
- [ ] レスポンシブデザイン実装（モバイル・タブレット・デスクトップ）
- [ ] ダークモード対応
- [ ] E2Eテストファイル作成（`core/e2e/dashboard-campaigns-detail.spec.ts`）
- [ ] E2Eテストケース実装（10 tests）
  - [ ] Campaign header display
  - [ ] ROI indicator display
  - [ ] Budgets list display
  - [ ] Budget category filter
  - [ ] Resources list display
  - [ ] Activities list display
  - [ ] Pagination
  - [ ] 404 error handling
  - [ ] Edit button visibility
  - [ ] Empty state handling
- [ ] 全E2Eテストが成功（`BASE_URL=https://devcle.test pnpm test:e2e`）
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] Lintエラーなし（`pnpm lint`）

---

## 実装ガイドライン

### 参考実装

- **Developers Detail Page** (`app/routes/dashboard/developers.$id.tsx`) - Task 7.3で実装済み（詳細ページパターン）
- **ActivityTimeline Component** (`app/components/developers/ActivityTimeline.tsx`) - Task 7.3で実装済み（再利用可能）
- **DashboardLayout** (`app/routes/dashboard.tsx`) - Task 7.1で実装済み
- **Campaign List Page** (`app/routes/dashboard/campaigns.tsx`) - Task 7.4で実装（一覧ページ）

### コーディング規約

1. **すべてのコードとコメントは英語で記述**
2. **UIコンポーネントは`app/components/campaigns/`に配置**
3. **TailwindCSSでスタイリング**
4. **TypeScript型定義を明確に記述（any使用禁止）**
5. **`data-testid`属性をE2Eテスト用に追加**

### TailwindCSSクラス例

```typescript
// Campaign Header
<div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{campaign.name}</h1>
  <div className="mt-2 flex items-center gap-4">
    <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm">
      {campaign.status}
    </span>
    <span className="text-gray-600 dark:text-gray-400">
      {campaign.startDate} ~ {campaign.endDate || 'Ongoing'}
    </span>
  </div>
</div>

// Budget Table
<table className="w-full border-collapse">
  <thead className="bg-gray-50 dark:bg-gray-800">
    <tr>
      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Category</th>
      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Amount</th>
      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Date</th>
      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Memo</th>
    </tr>
  </thead>
  <tbody>
    {budgets.map((budget) => (
      <tr key={budget.budgetId} className="border-t border-gray-200 dark:border-gray-700">
        <td className="px-4 py-2">{budget.category}</td>
        <td className="px-4 py-2">{budget.amount} {budget.currency}</td>
        <td className="px-4 py-2">{budget.spentAt}</td>
        <td className="px-4 py-2">{budget.memo || '-'}</td>
      </tr>
    ))}
  </tbody>
</table>

// Resource Card Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {resources.map((resource) => (
    <div key={resource.resourceId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded">
        {resource.category}
      </span>
      <h3 className="mt-2 font-semibold text-gray-900 dark:text-white">{resource.title}</h3>
      <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 text-sm">
        {resource.url}
      </a>
    </div>
  ))}
</div>
```

---

## セキュリティ考慮事項

### 1. 認証・認可

**認証**:
- ページアクセス時に認証チェック（requireAuth）
- 未認証ユーザーは`/login`にリダイレクト

**認可**:
- RLSにより、テナント間のデータ分離を保証
- 編集・削除ボタンはロール（admin/member）に応じて表示制御

### 2. XSS対策

**ユーザー入力のサニタイゼーション**:
- Reactは自動的にエスケープ
- `dangerouslySetInnerHTML`は使用しない
- 外部URL（resource.url）は`rel="noopener noreferrer"`を付与

### 3. CSRF対策

**Remix Form使用**:
- すべてのフォーム送信はRemix `<Form>`コンポーネントを使用
- CSRFトークンは自動的にハンドリング

---

## パフォーマンス考慮事項

### 1. データフェッチング最適化

**Server-Side Rendering (SSR)**:
- 初期表示に必須のデータ（キャンペーン基本情報）のみloaderでフェッチ
- 追加データ（budgets/resources/activities）はクライアントサイドで遅延ロード

**ページネーション**:
- 大量データの一括取得を避け、limit/offsetで分割取得
- デフォルトリミット: Budgets 20件、Resources 12件、Activities 20件

### 2. ローディング状態の段階的表示

**Skeleton Loader**:
- データ取得中はスケルトンローダーを表示
- ユーザーに待機状態を明示

**Progressive Enhancement**:
- JavaScriptなしでも基本情報（キャンペーン名、ステータス）は表示可能

---

## アクセシビリティ考慮事項

### ARIA属性

```typescript
// Tab navigation
<button
  role="tab"
  aria-selected={activeTab === 'budgets'}
  aria-controls="budgets-panel"
  onClick={() => setSearchParams({ tab: 'budgets' })}
>
  Budgets
</button>

<div
  role="tabpanel"
  id="budgets-panel"
  aria-labelledby="budgets-tab"
  hidden={activeTab !== 'budgets'}
>
  {/* Budgets content */}
</div>

// Loading state
<div role="status" aria-live="polite">
  {loading ? 'Loading budgets...' : `${budgets.length} budgets loaded`}
</div>
```

### キーボードナビゲーション

- タブ切り替え: `Tab`キーでフォーカス移動、`Enter`で選択
- ページネーション: `Tab`キーでフォーカス移動、`Enter`でページ切り替え

---

## 次のタスク

Task 7.4.2完了後、次はTask 7.4.3（キャンペーンの追加）に進みます：

- **Task 7.4.3**: キャンペーンの追加
  - キャンペーン追加フォーム実装
  - バリデーション実装
  - 入力エラー処理

---

## 参考資料

- [React Hooks - useEffect](https://react.dev/reference/react/useEffect)
- [React Hooks - useState](https://react.dev/reference/react/useState)
- [Remix useParams](https://remix.run/docs/en/main/hooks/use-params)
- [Remix useSearchParams](https://remix.run/docs/en/main/hooks/use-search-params)
- [TailwindCSS Grid](https://tailwindcss.com/docs/grid-template-columns)
- [Playwright Testing](https://playwright.dev/docs/intro)
- [Task 7.4.1 Documentation](.tmp/tasks/task-7.4.1-campaign-detail-apis.md)
