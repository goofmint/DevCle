# Task 7.4: Campaignsページ実装（一覧のみ）

## 概要

ダッシュボードのCampaignsページを実装し、施策（キャンペーン）の一覧表示、ROI表示、検索・フィルタ機能を提供します。プラグインでも利用できるように、施策リストコンポーネントは共通化します。

**注意**: このタスクは一覧ページのみを対象とします。詳細ページはTask 7.4.2、新規API実装はTask 7.4.1で行います。

## 目的

- 登録されている施策の一覧を表示し、検索・フィルタ機能で目的の施策を素早く見つけられるようにする
- 施策のROIを視覚的に表示し、正のリターン（成功）と負のリターン（損失）を色分けして確認できるようにする
- プラグインでも再利用可能な共通コンポーネントを提供する

## 依存タスク

- ✅ Task 7.1: ダッシュボードレイアウト実装
- ✅ Task 5.4: Campaign API実装

## 型定義

```typescript
// Campaign型（core/db/schema/campaigns.tsから参照）
interface Campaign {
  campaignId: string;
  tenantId: string;
  name: string;
  channel: string | null;
  startDate: string | null; // YYYY-MM-DD format
  endDate: string | null;   // YYYY-MM-DD format
  budgetTotal: string | null; // decimal string
  attributes: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ROIデータ型（Task 5.2で定義）
interface CampaignROI {
  campaignId: string;
  campaignName: string;
  totalCost: string;    // decimal string
  totalValue: string;   // decimal string
  roi: number | null;   // percentage or null if totalCost is 0
  activityCount: number;
  developerCount: number;
  calculatedAt: Date;
}

// 施策リストアイテム（ROI情報を含む）
interface CampaignListItem extends Campaign {
  roi?: number | null;
  activityCount?: number;
  developerCount?: number;
}

// リストフィルタオプション
interface CampaignFilterOptions {
  query?: string;      // 名前で検索
  channel?: string;    // チャネルでフィルタ
  roiStatus?: 'positive' | 'negative' | 'neutral'; // ROIステータスでフィルタ
  sortBy?: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
```

## 実装内容

### 1. ルート定義

**ファイル**: `core/app/routes/dashboard.campaigns.tsx`

施策一覧ページのルートを作成します。`dashboard.tsx`レイアウトの子ルートとして機能します。

### 2. 施策一覧の取得

Loaderで以下のデータを取得します：

```typescript
interface CampaignsPageData {
  campaigns: CampaignListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### 3. 検索・フィルタ機能

以下のフィルタオプションを実装：

**フィルタ項目**:
- **検索**: 施策名で検索（部分一致、大文字小文字を区別しない）
- **チャネルフィルタ**: 特定のチャネル（event, ad, content, community, partnership, other）で絞り込み
- **ROIステータスフィルタ**: ROIが正/負/ゼロで絞り込み
  - `positive`: roi > 0（成功したキャンペーン）
  - `negative`: roi < 0（損失）
  - `neutral`: roi = 0 または roi = null（損益分岐点または計算不可）
- **ソート**: 名前、開始日、終了日、ROI、作成日でソート

### 4. ROI表示の色分け

ROI値に基づいて色分けして表示：

```typescript
/**
 * Get ROI color class based on ROI value
 *
 * ROI > 0: green (positive return, successful campaign)
 * ROI = 0: gray (break-even)
 * ROI < 0: red (negative return, loss)
 * ROI = null: gray (calculation not possible, totalCost is 0)
 */
function getROIColorClass(roi: number | null): string {
  if (roi === null || roi === 0) {
    return 'text-gray-500 dark:text-gray-400';
  }
  if (roi > 0) {
    return 'text-green-600 dark:text-green-400';
  }
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get ROI badge color class
 */
function getROIBadgeClass(roi: number | null): string {
  if (roi === null || roi === 0) {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
  if (roi > 0) {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
  }
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
}

/**
 * Format ROI value for display
 *
 * Examples:
 * - roi = 50.5 → "+50.5%"
 * - roi = -25.0 → "-25.0%"
 * - roi = 0 → "0%"
 * - roi = null → "N/A"
 */
function formatROI(roi: number | null): string {
  if (roi === null) {
    return 'N/A';
  }
  const sign = roi > 0 ? '+' : '';
  return `${sign}${roi.toFixed(1)}%`;
}
```

### 5. 共通コンポーネント化

プラグインでも利用可能なように、以下のコンポーネントを共通化します：

**共通コンポーネント**:
- `CampaignList`: 施策リストの表示
- `CampaignCard`: 施策情報のカード表示
- `CampaignTable`: 施策情報のテーブル表示
- `CampaignFilters`: 検索・フィルタUI
- `ROIBadge`: ROIバッジ表示（色分け付き）

これらは`core/app/components/campaigns/`以下に配置し、プラグインからもimportできるようにします。

### 6. ページネーション

一覧ページにページネーションを実装：

```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Pagination Component
 *
 * ページネーションUIを提供。
 * 前ページ・次ページボタン、ページ番号リンクを表示。
 */
export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps): JSX.Element {
  // ページ番号リンクの生成
  // 前ページ・次ページボタンの制御
  // URLパラメータとの同期
}
```

### 7. ダークモード対応

全てのコンポーネントはダークモードに対応します：

- 背景色: `bg-white dark:bg-gray-800`
- テキスト: `text-gray-900 dark:text-white`
- ボーダー: `border-gray-200 dark:border-gray-700`

### 8. レスポンシブデザイン

- **デスクトップ**: テーブル表示
- **タブレット**: カード表示（2カラム）
- **モバイル**: カード表示（1カラム）

## ファイル構成

```text
core/
├── app/
│   ├── routes/
│   │   └── dashboard.campaigns.tsx           # 施策一覧ページ
│   ├── components/
│   │   └── campaigns/
│   │       ├── CampaignList.tsx              # 施策リストコンテナ
│   │       ├── CampaignCard.tsx              # 施策カード表示
│   │       ├── CampaignTable.tsx             # 施策テーブル表示
│   │       ├── CampaignFilters.tsx           # 検索・フィルタUI
│   │       └── ROIBadge.tsx                  # ROIバッジ表示
│   └── hooks/
│       └── useCampaignFilters.ts             # フィルタ状態管理フック
```

## カスタムフック仕様

### useCampaignFilters

施策リストのフィルタ状態を管理するカスタムフック。

**ファイル**: `core/app/hooks/useCampaignFilters.ts`

```typescript
interface UseCampaignFiltersOptions {
  /** 初期検索クエリ */
  initialQuery?: string;
  /** 初期チャネル */
  initialChannel?: string;
  /** 初期ROIステータス */
  initialRoiStatus?: 'positive' | 'negative' | 'neutral' | null;
  /** 初期ソート設定 */
  initialSortBy?: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt';
  /** 初期ソート順序 */
  initialSortOrder?: 'asc' | 'desc';
}

interface UseCampaignFiltersReturn {
  /** 検索クエリ */
  query: string;
  /** チャネル */
  channel: string | null;
  /** ROIステータス */
  roiStatus: 'positive' | 'negative' | 'neutral' | null;
  /** ソート項目 */
  sortBy: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt';
  /** ソート順序 */
  sortOrder: 'asc' | 'desc';
  /** 検索クエリ更新関数 */
  setQuery: (query: string) => void;
  /** チャネル更新関数 */
  setChannel: (channel: string | null) => void;
  /** ROIステータス更新関数 */
  setRoiStatus: (roiStatus: 'positive' | 'negative' | 'neutral' | null) => void;
  /** ソート設定更新関数 */
  setSortBy: (sortBy: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt') => void;
  /** ソート順序更新関数 */
  setSortOrder: (order: 'asc' | 'desc') => void;
  /** フィルタリセット関数 */
  resetFilters: () => void;
  /** URLSearchParams生成関数 */
  toSearchParams: () => URLSearchParams;
}

/**
 * useCampaignFilters Hook
 *
 * 施策リストのフィルタ状態を管理し、URLパラメータと同期。
 *
 * 機能:
 * - フィルタ状態の管理（検索クエリ、チャネル、ROIステータス、ソート設定）
 * - URLパラメータとの双方向同期
 * - フィルタリセット
 *
 * 使用例:
 * ```typescript
 * function CampaignsPage() {
 *   const {
 *     query,
 *     setQuery,
 *     channel,
 *     setChannel,
 *     roiStatus,
 *     setRoiStatus,
 *     resetFilters,
 *     toSearchParams
 *   } = useCampaignFilters({
 *     initialQuery: searchParams.get('query') || '',
 *     initialChannel: searchParams.get('channel') || null,
 *     initialRoiStatus: searchParams.get('roiStatus') as 'positive' | 'negative' | 'neutral' | null
 *   });
 *
 *   return (
 *     <Form method="get">
 *       <input value={query} onChange={(e) => setQuery(e.target.value)} />
 *       <select value={channel || ''} onChange={(e) => setChannel(e.target.value || null)}>
 *         <option value="">All Channels</option>
 *         <option value="event">Event</option>
 *         <option value="ad">Ad</option>
 *         <option value="content">Content</option>
 *         <option value="community">Community</option>
 *         <option value="partnership">Partnership</option>
 *         <option value="other">Other</option>
 *       </select>
 *       <select value={roiStatus || ''} onChange={(e) => {
 *         const value = e.target.value as 'positive' | 'negative' | 'neutral' | '';
 *         setRoiStatus(value === '' ? null : value);
 *       }}>
 *         <option value="">All ROI Status</option>
 *         <option value="positive">Positive</option>
 *         <option value="negative">Negative</option>
 *         <option value="neutral">Neutral</option>
 *       </select>
 *       <button type="button" onClick={resetFilters}>Reset</button>
 *       <button type="submit">Search</button>
 *     </Form>
 *   );
 * }
 * ```
 */
export function useCampaignFilters(options?: UseCampaignFiltersOptions): UseCampaignFiltersReturn {
  // フィルタ状態の管理（query, channel, roiStatus, sortBy, sortOrder）
  // URLパラメータとの同期
  // フィルタリセット処理（全フィルタを初期状態に戻す）
}
```

## API仕様

### GET /api/campaigns

既存APIを使用（Task 5.4で実装済み）。

**クエリパラメータ**:
- `search`: 検索クエリ（施策名で検索、部分一致）
- `channel`: チャネルフィルタ（event/ad/content/community/partnership/other）
- `orderBy`: ソート項目（name/startDate/endDate/createdAt）
- `orderDirection`: ソート順序（asc/desc）
- `limit`: 1ページあたりの件数（デフォルト: 50、最大: 100）
- `offset`: オフセット（デフォルト: 0）

**レスポンス**:
```typescript
{
  "campaigns": [
    {
      "campaignId": "uuid",
      "tenantId": "default",
      "name": "DevRel Conference 2025",
      "channel": "event",
      "startDate": "2025-03-01",
      "endDate": "2025-03-03",
      "budgetTotal": "50000.00",
      "attributes": {
        "location": "Tokyo",
        "utm_source": "conference"
      },
      "createdAt": "2025-10-14T00:00:00.000Z",
      "updatedAt": "2025-10-14T00:00:00.000Z"
    }
  ],
  "total": 15
}
```

### GET /api/campaigns/:id

既存APIを使用（Task 5.4で実装済み）。

**レスポンス**:
```typescript
{
  "campaignId": "uuid",
  "tenantId": "default",
  "name": "DevRel Conference 2025",
  "channel": "event",
  "startDate": "2025-03-01",
  "endDate": "2025-03-03",
  "budgetTotal": "50000.00",
  "attributes": {
    "location": "Tokyo",
    "utm_source": "conference"
  },
  "createdAt": "2025-10-14T00:00:00.000Z",
  "updatedAt": "2025-10-14T00:00:00.000Z"
}
```

### GET /api/campaigns/:id/roi

既存APIを使用（Task 5.4で実装済み）。

**レスポンス**:
```typescript
{
  "campaignId": "uuid",
  "campaignName": "DevRel Conference 2025",
  "totalCost": "50000.00",
  "totalValue": "75000.00",
  "roi": 50.0,
  "activityCount": 120,
  "developerCount": 45,
  "calculatedAt": "2025-10-15T00:00:00.000Z"
}
```

**ROI解釈**:
- `roi > 0`: 正のリターン（成功したキャンペーン）
- `roi = 0`: 損益分岐点
- `roi < 0`: 負のリターン（損失）
- `roi = null`: 計算不可（totalCostが0、ゼロ除算）

## コンポーネント設計

### CampaignList

```typescript
interface CampaignListProps {
  campaigns: CampaignListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  viewMode?: 'table' | 'card';
}

/**
 * CampaignList Component
 *
 * 施策リストを表示するコンテナコンポーネント。
 * テーブル表示とカード表示を切り替え可能。
 */
export function CampaignList({ campaigns, pagination, viewMode = 'table' }: CampaignListProps): JSX.Element {
  // viewModeに応じてCampaignTableまたはCampaignCardを表示
  // CampaignFiltersを表示
  // Paginationを表示
}
```

### CampaignTable

```typescript
interface CampaignTableProps {
  campaigns: CampaignListItem[];
  sortBy: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  onSort: (column: 'name' | 'startDate' | 'endDate' | 'roi' | 'createdAt') => void;
}

/**
 * CampaignTable Component
 *
 * 施策情報をテーブル形式で表示。
 * ソート可能なカラムヘッダーを実装。
 */
export function CampaignTable({ campaigns, sortBy, sortOrder, onSort }: CampaignTableProps): JSX.Element {
  // テーブルヘッダー（ソートアイコン付き）
  // 施策行（クリックで詳細ページへ遷移）
  // 名前、チャネル、期間、ROI（色分け）を表示
}
```

### CampaignCard

```typescript
interface CampaignCardProps {
  campaign: CampaignListItem;
}

/**
 * CampaignCard Component
 *
 * 施策情報をカード形式で表示。
 * モバイル・タブレット向けのレスポンシブ表示。
 */
export function CampaignCard({ campaign }: CampaignCardProps): JSX.Element {
  // カード内に名前、チャネル、期間、ROI（色分け）を表示
  // クリックで詳細ページへ遷移
}
```

### CampaignFilters

```typescript
interface CampaignFiltersProps {
  query: string;
  channel: string | null;
  roiStatus: 'positive' | 'negative' | 'neutral' | null;
  onQueryChange: (query: string) => void;
  onChannelChange: (channel: string | null) => void;
  onRoiStatusChange: (roiStatus: 'positive' | 'negative' | 'neutral' | null) => void;
  onReset: () => void;
}

/**
 * CampaignFilters Component
 *
 * 検索・フィルタUIを提供。
 * 検索ボックス、チャネルフィルタ、ROIステータスフィルタ、リセットボタンを表示。
 */
export function CampaignFilters({
  query,
  channel,
  roiStatus,
  onQueryChange,
  onChannelChange,
  onRoiStatusChange,
  onReset
}: CampaignFiltersProps): JSX.Element {
  // 検索ボックス（デバウンス付き）
  // チャネルフィルタドロップダウン（event/ad/content/community/partnership/other）
  // ROIステータスフィルタ（positive/negative/neutral）
  // リセットボタン（全フィルタをリセット）
}
```

### ROIBadge

```typescript
interface ROIBadgeProps {
  roi: number | null;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * ROIBadge Component
 *
 * ROI値をバッジ形式で表示。色分け付き。
 * ROI > 0: green, ROI = 0: gray, ROI < 0: red, ROI = null: gray
 */
export function ROIBadge({ roi, size = 'md' }: ROIBadgeProps): JSX.Element {
  // バッジの色をROI値に基づいて設定
  // ROI値をフォーマットして表示（+50.0%, -25.0%, 0%, N/A）
}
```

## データフロー

1. ページロード時に`loader`が実行される
2. URLパラメータからフィルタ設定を取得
3. `GET /api/campaigns?search=xxx&channel=xxx&limit=50&offset=0`を呼び出す
4. 各施策のROIを並列取得（`GET /api/campaigns/:id/roi`）
5. データを取得してコンポーネントに渡す
6. CampaignListがCampaignTableまたはCampaignCardを表示
7. ユーザーがフィルタを変更すると、URLパラメータが更新され、loaderが再実行される

```typescript
// Loader実装例（エラーハンドリング付き）
export async function loader({ request }: LoaderFunctionArgs) {
  // 認証チェック（未認証時は/loginへリダイレクト）
  const user = await requireAuth(request);

  // URLパラメータからフィルタ設定を取得
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';
  const channel = url.searchParams.get('channel') || null;
  const roiStatus = url.searchParams.get('roiStatus') as 'positive' | 'negative' | 'neutral' | null;
  const sortBy = url.searchParams.get('sortBy') || 'name';
  const sortOrder = url.searchParams.get('sortOrder') || 'asc';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const offset = (page - 1) * limit;

  try {
    // URLパラメータ構築
    const params = new URLSearchParams({
      search: query,
      orderBy: sortBy,
      orderDirection: sortOrder,
      limit: String(limit),
      offset: String(offset)
    });
    if (channel) params.set('channel', channel);

    // 施策リストを取得
    const campaignsResponse = await fetch(`/api/campaigns?${params.toString()}`, {
      headers: { Cookie: request.headers.get('Cookie') || '' }
    });

    // レスポンスステータスチェック
    if (!campaignsResponse.ok) {
      throw new Error(`Failed to fetch campaigns: ${campaignsResponse.status}`);
    }

    // JSONパース
    const { campaigns, total } = await campaignsResponse.json();

    // 各施策のROIを並列取得
    const campaignsWithROI = await Promise.all(
      campaigns.map(async (campaign: Campaign) => {
        try {
          const roiResponse = await fetch(`/api/campaigns/${campaign.campaignId}/roi`, {
            headers: { Cookie: request.headers.get('Cookie') || '' }
          });
          if (roiResponse.ok) {
            const roiData = await roiResponse.json();
            return {
              ...campaign,
              roi: roiData.roi,
              activityCount: roiData.activityCount,
              developerCount: roiData.developerCount
            };
          }
        } catch (error) {
          console.error(`Failed to fetch ROI for campaign ${campaign.campaignId}:`, error);
        }
        return campaign;
      })
    );

    // ROIステータスでフィルタ（クライアントサイド）
    let filteredCampaigns = campaignsWithROI;
    if (roiStatus) {
      filteredCampaigns = campaignsWithROI.filter((campaign) => {
        if (roiStatus === 'positive') return campaign.roi !== null && campaign.roi > 0;
        if (roiStatus === 'negative') return campaign.roi !== null && campaign.roi < 0;
        if (roiStatus === 'neutral') return campaign.roi === null || campaign.roi === 0;
        return true;
      });
    }

    return json<CampaignsPageData>({
      campaigns: filteredCampaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Campaigns loader error:', error);
    throw new Response('Failed to load campaigns', { status: 500 });
  }
}
```

## テスト要件

### E2Eテスト

`core/e2e/dashboard-campaigns.spec.ts`を作成：

1. **施策リスト表示テスト**: 施策リストが正しく表示されることを確認
2. **検索機能テスト**: 検索ボックスで施策を検索できることを確認
3. **チャネルフィルタテスト**: チャネルフィルタで絞り込みができることを確認
4. **ROIステータスフィルタテスト**: ROIステータスフィルタで絞り込みができることを確認
5. **ROI色分けテスト**: ROIが正/負/ゼロで色分けされていることを確認
6. **ソート機能テスト**: カラムヘッダーをクリックしてソートできることを確認
7. **ページネーションテスト**: ページ切り替えが機能することを確認
8. **レスポンシブテスト**: モバイルビューポートでカード表示になることを確認

## パフォーマンス考慮事項

- **ROI並列取得**: 施策リストのROIは並列取得で高速化（Promise.all使用）
- **検索デバウンス**: 検索ボックスの入力はデバウンス（300ms）で不要なAPIコールを防ぐ
- **ROIキャッシング**: ROIデータは一定時間キャッシュ（将来的な拡張）
- **仮想スクロール**: 施策数が多い場合は仮想スクロールを検討（将来的な拡張）

## セキュリティ考慮事項

- **認証チェック**: 全てのAPIエンドポイントで`requireAuth()`を使用
- **テナント分離**: RLSポリシーで他テナントのデータにアクセスできないことを保証
- **XSS対策**: ユーザー入力は全てエスケープ
- **CSRF対策**: RemixのCSRFトークンを使用

## 実装完了条件（受け入れ基準）

以下の全ての項目が満たされた時点で、Task 7.4は完了とみなされます。

- [ ] 施策一覧ページが`/dashboard/campaigns`で表示される
- [ ] 検索機能が動作する（施策名で検索）
- [ ] チャネルフィルタが動作する
- [ ] ROIステータスフィルタが動作する（positive/negative/neutral）
- [ ] ROIが色分けされている（positive: green, negative: red, neutral: gray）
- [ ] ソート機能が動作する（名前、開始日、終了日、ROI、作成日）
- [ ] ページネーションが動作する
- [ ] ダークモード対応が完了している
- [ ] レスポンシブデザインが実装されている（モバイル/タブレット/デスクトップ）
- [ ] 共通コンポーネント（CampaignList, CampaignTable, CampaignCard, CampaignFilters, ROIBadge）が実装されている
- [ ] E2Eテストが実装され、全テストがパスする（8テスト）
- [ ] TypeScriptエラーがない
- [ ] ESLintエラーがない

## 備考

- 施策リストコンポーネントはプラグインでも利用されることを想定し、汎用的な設計にする
- ROIの色分けは一貫性のあるデザインシステムを使用（Tailwind CSS色パレット）
- チャネルアイコンはHeroiconsを使用（event: CalendarIcon, ad: MegaphoneIcon, content: DocumentIcon等）
- 施策の期間表示は開始日〜終了日形式（例: "2025-03-01 ~ 2025-03-03"）
- 予算総額は通貨記号付きで表示（例: "¥50,000"）
- ROI表示は小数点1桁まで表示（例: "+50.5%", "-25.0%", "0%", "N/A"）
