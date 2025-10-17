# Task 7.3: Developersページ実装

## 概要

ダッシュボードのDevelopersページを実装し、開発者の一覧表示、検索・フィルタ機能、詳細ページを提供します。プラグインでも利用できるように、開発者リストコンポーネントは共通化します。

## 目的

- 登録されている開発者の一覧を表示し、検索・フィルタ機能で目的の開発者を素早く見つけられるようにする
- 開発者の詳細情報（アクティビティ履歴、識別子、所属組織など）を確認できるようにする
- プラグインでも再利用可能な共通コンポーネントを提供する

## 依存タスク

- ✅ Task 7.1: ダッシュボードレイアウト実装
- ✅ Task 4.2: Developer API実装
- ✅ Task 4.3: ID統合機能実装

## 型定義

```typescript
// Developer型（core/db/schema/core.tsから参照）
interface Developer {
  developerId: string;
  tenantId: string;
  displayName: string;
  primaryEmail: string;
  bio: string | null;
  avatarUrl: string | null;
  organizationId: string | null;
  consentAnalytics: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Organization型（core/db/schema/core.tsから参照）
interface Organization {
  organizationId: string;
  tenantId: string;
  name: string;
  domain: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// DeveloperIdentifier型（core/db/schema/core.tsから参照）
interface DeveloperIdentifier {
  identifierId: string;
  tenantId: string;
  developerId: string;
  kind: string; // 'email' | 'github' | 'twitter' | 'slack' | 'discord' | etc.
  value: string;
  confidence: number; // 0.0 - 1.0
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// 開発者リストアイテム（Organization情報を含む）
interface DeveloperListItem extends Developer {
  organization?: Pick<Organization, 'organizationId' | 'name'> | null;
  activityCount?: number;
}

// 開発者詳細（Activity、Identifier、Organizationを含む）
interface DeveloperDetail extends Developer {
  organization: Organization | null;
  identifiers: DeveloperIdentifier[];
  recentActivities: Activity[];
  stats: {
    totalActivities: number;
    awarenessCount: number;
    engagementCount: number;
    adoptionCount: number;
    advocacyCount: number;
  };
}

// リストフィルタオプション
interface DeveloperFilterOptions {
  query?: string; // 名前・メールアドレスで検索
  organizationId?: string; // 組織でフィルタ
  consentAnalytics?: boolean; // 分析同意でフィルタ
  sortBy?: 'name' | 'email' | 'createdAt' | 'activityCount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
```

## 実装内容

### 1. ルート定義

**ファイル**: `core/app/routes/dashboard.developers.tsx`

開発者一覧ページのルートを作成します。`dashboard.tsx`レイアウトの子ルートとして機能します。

**ファイル**: `core/app/routes/dashboard.developers.$id.tsx`

開発者詳細ページのルートを作成します。

### 2. 開発者一覧の取得

Loaderで以下のデータを取得します：

```typescript
interface DevelopersPageData {
  developers: DeveloperListItem[];
  organizations: Pick<Organization, 'organizationId' | 'name'>[];
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
- **検索**: 開発者名またはメールアドレスで検索（部分一致）
- **組織フィルタ**: 特定の組織に所属する開発者のみ表示
- **分析同意フィルタ**: 分析同意した開発者のみ表示
- **ソート**: 名前、メールアドレス、作成日、アクティビティ数でソート

### 4. 共通コンポーネント化

プラグインでも利用可能なように、以下のコンポーネントを共通化します：

**共通コンポーネント**:
- `DeveloperList`: 開発者リストの表示
- `DeveloperCard`: 開発者情報のカード表示
- `DeveloperTable`: 開発者情報のテーブル表示
- `DeveloperFilters`: 検索・フィルタUI

これらは`core/app/components/developers/`以下に配置し、プラグインからもimportできるようにします。

### 5. 開発者詳細ページ

開発者の詳細情報を表示するページを実装：

**表示内容**:
- 基本情報（名前、メールアドレス、アバター、所属組織）
- 識別子リスト（GitHub、Twitter、Slack、Discord等）
- アクティビティ統計（ファネルステージ別の件数）
- 最近のアクティビティ履歴（最新10件）
- タイムラインチャート（過去30日間のアクティビティ）

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
│   │   ├── dashboard.developers.tsx           # 開発者一覧ページ
│   │   └── dashboard.developers.$id.tsx       # 開発者詳細ページ
│   ├── components/
│   │   └── developers/
│   │       ├── DeveloperList.tsx              # 開発者リストコンテナ
│   │       ├── DeveloperCard.tsx              # 開発者カード表示
│   │       ├── DeveloperTable.tsx             # 開発者テーブル表示
│   │       ├── DeveloperFilters.tsx           # 検索・フィルタUI
│   │       ├── DeveloperDetail.tsx            # 開発者詳細表示
│   │       ├── IdentifierList.tsx             # 識別子リスト表示
│   │       └── ActivityTimeline.tsx           # アクティビティタイムライン
│   └── hooks/
│       └── useDeveloperFilters.ts             # フィルタ状態管理フック
```

## カスタムフック仕様

### useDeveloperFilters

開発者リストのフィルタ状態を管理するカスタムフック。

**ファイル**: `core/app/hooks/useDeveloperFilters.ts`

```typescript
interface UseDeveloperFiltersOptions {
  /** 初期検索クエリ */
  initialQuery?: string;
  /** 初期組織ID */
  initialOrganizationId?: string;
  /** 初期分析同意フィルタ */
  initialConsentAnalytics?: boolean | null;
  /** 初期ソート設定 */
  initialSortBy?: 'name' | 'email' | 'createdAt' | 'activityCount';
  /** 初期ソート順序 */
  initialSortOrder?: 'asc' | 'desc';
}

interface UseDeveloperFiltersReturn {
  /** 検索クエリ */
  query: string;
  /** 組織ID */
  organizationId: string | null;
  /** 分析同意フィルタ（null=全て, true=同意のみ, false=非同意のみ） */
  consentAnalytics: boolean | null;
  /** ソート項目 */
  sortBy: 'name' | 'email' | 'createdAt' | 'activityCount';
  /** ソート順序 */
  sortOrder: 'asc' | 'desc';
  /** 検索クエリ更新関数 */
  setQuery: (query: string) => void;
  /** 組織ID更新関数 */
  setOrganizationId: (id: string | null) => void;
  /** 分析同意フィルタ更新関数 */
  setConsentAnalytics: (consentAnalytics: boolean | null) => void;
  /** ソート設定更新関数 */
  setSortBy: (sortBy: 'name' | 'email' | 'createdAt' | 'activityCount') => void;
  /** ソート順序更新関数 */
  setSortOrder: (order: 'asc' | 'desc') => void;
  /** フィルタリセット関数（consentAnalyticsもnullにリセット） */
  resetFilters: () => void;
  /** URLSearchParams生成関数 */
  toSearchParams: () => URLSearchParams;
}

/**
 * useDeveloperFilters Hook
 *
 * 開発者リストのフィルタ状態を管理し、URLパラメータと同期。
 *
 * 機能:
 * - フィルタ状態の管理（検索クエリ、組織ID、分析同意フィルタ、ソート設定）
 * - URLパラメータとの双方向同期
 * - フィルタリセット（consentAnalyticsもnullにリセット）
 *
 * 使用例:
 * ```typescript
 * function DevelopersPage() {
 *   const {
 *     query,
 *     setQuery,
 *     organizationId,
 *     setOrganizationId,
 *     consentAnalytics,
 *     setConsentAnalytics,
 *     resetFilters,
 *     toSearchParams
 *   } = useDeveloperFilters({
 *     initialQuery: searchParams.get('query') || '',
 *     initialOrganizationId: searchParams.get('organizationId') || null,
 *     initialConsentAnalytics: searchParams.get('consentAnalytics') === 'true' ? true : searchParams.get('consentAnalytics') === 'false' ? false : null
 *   });
 *
 *   return (
 *     <Form method="get">
 *       <input value={query} onChange={(e) => setQuery(e.target.value)} />
 *       <select value={organizationId || ''} onChange={(e) => setOrganizationId(e.target.value || null)}>
 *         <option value="">All Organizations</option>
 *       </select>
 *       <select
 *         value={consentAnalytics === null ? '' : String(consentAnalytics)}
 *         onChange={(e) => setConsentAnalytics(e.target.value === '' ? null : e.target.value === 'true')}
 *       >
 *         <option value="">All Consent Status</option>
 *         <option value="true">Consented</option>
 *         <option value="false">Not Consented</option>
 *       </select>
 *       <button type="button" onClick={resetFilters}>Reset</button>
 *       <button type="submit">Search</button>
 *     </Form>
 *   );
 * }
 * ```
 */
export function useDeveloperFilters(options?: UseDeveloperFiltersOptions): UseDeveloperFiltersReturn {
  // フィルタ状態の管理（query, organizationId, consentAnalytics, sortBy, sortOrder）
  // URLパラメータとの同期
  // フィルタリセット処理（全フィルタを初期状態に戻す、consentAnalyticsもnullにする）
}
```

## API仕様

### GET /api/developers

既存APIを使用（Task 4.2で実装済み）。

**クエリパラメータ**:
- `query`: 検索クエリ（名前・メールアドレス）
- `organizationId`: 組織ID
- `consentAnalytics`: 分析同意フィルタ（true/false）
- `sortBy`: ソート項目（name/email/createdAt）
- `sortOrder`: ソート順序（asc/desc）
- `page`: ページ番号（デフォルト: 1）
- `limit`: 1ページあたりの件数（デフォルト: 20）

**レスポンス**:
```typescript
{
  "developers": [
    {
      "developerId": "uuid",
      "displayName": "John Doe",
      "primaryEmail": "john@example.com",
      "avatarUrl": "https://...",
      "organizationId": "uuid",
      "organization": {
        "organizationId": "uuid",
        "name": "Example Corp"
      },
      "activityCount": 42,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### GET /api/developers/:id

既存APIを使用（Task 4.2で実装済み）。

**レスポンス**:
```typescript
{
  "developer": {
    "developerId": "uuid",
    "displayName": "John Doe",
    "primaryEmail": "john@example.com",
    "bio": "Software Engineer",
    "avatarUrl": "https://...",
    "organizationId": "uuid",
    "organization": {
      "organizationId": "uuid",
      "name": "Example Corp",
      "domain": "example.com"
    },
    "consentAnalytics": true,
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

### GET /api/developers/:id/identifiers

開発者の識別子リストを取得するAPI（新規実装が必要）。

**レスポンス**:
```typescript
{
  "identifiers": [
    {
      "identifierId": "uuid",
      "kind": "github",
      "value": "johndoe",
      "confidence": 1.0,
      "verifiedAt": "2025-01-01T00:00:00Z",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### GET /api/developers/:id/activities

開発者のアクティビティを取得するAPI（既存のGET /api/activities?developerId=xxxを使用）。

**クエリパラメータ**:
- `developerId`: 開発者ID
- `limit`: 取得件数（デフォルト: 10）
- `sortBy`: ソート項目（デフォルト: occurredAt）
- `sortOrder`: ソート順序（デフォルト: desc）

### GET /api/developers/:id/stats

開発者のアクティビティ統計を取得するAPI（新規実装が必要）。

**レスポンス**:
```typescript
{
  "stats": {
    "totalActivities": 100,
    "awarenessCount": 30,
    "engagementCount": 40,
    "adoptionCount": 20,
    "advocacyCount": 10
  }
}
```

## コンポーネント設計

### DeveloperList

```typescript
interface DeveloperListProps {
  developers: DeveloperListItem[];
  organizations: Pick<Organization, 'organizationId' | 'name'>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  viewMode?: 'table' | 'card';
}

/**
 * DeveloperList Component
 *
 * 開発者リストを表示するコンテナコンポーネント。
 * テーブル表示とカード表示を切り替え可能。
 */
export function DeveloperList({ developers, organizations, pagination, viewMode = 'table' }: DeveloperListProps): JSX.Element {
  // viewModeに応じてDeveloperTableまたはDeveloperCardを表示
  // DeveloperFiltersを表示
  // Paginationを表示
}
```

### DeveloperTable

```typescript
interface DeveloperTableProps {
  developers: DeveloperListItem[];
  sortBy: 'name' | 'email' | 'createdAt' | 'activityCount';
  sortOrder: 'asc' | 'desc';
  onSort: (column: 'name' | 'email' | 'createdAt' | 'activityCount') => void;
}

/**
 * DeveloperTable Component
 *
 * 開発者情報をテーブル形式で表示。
 * ソート可能なカラムヘッダーを実装。
 */
export function DeveloperTable({ developers, sortBy, sortOrder, onSort }: DeveloperTableProps): JSX.Element {
  // テーブルヘッダー（ソートアイコン付き）
  // 開発者行（クリックで詳細ページへ遷移）
  // アバター、名前、メールアドレス、組織、アクティビティ数を表示
}
```

### DeveloperCard

```typescript
interface DeveloperCardProps {
  developer: DeveloperListItem;
}

/**
 * DeveloperCard Component
 *
 * 開発者情報をカード形式で表示。
 * モバイル・タブレット向けのレスポンシブ表示。
 */
export function DeveloperCard({ developer }: DeveloperCardProps): JSX.Element {
  // カード内にアバター、名前、メールアドレス、組織、アクティビティ数を表示
  // クリックで詳細ページへ遷移
}
```

### DeveloperFilters

```typescript
interface DeveloperFiltersProps {
  query: string;
  organizationId: string | null;
  consentAnalytics: boolean | null;
  organizations: Pick<Organization, 'organizationId' | 'name'>[];
  onQueryChange: (query: string) => void;
  onOrganizationChange: (organizationId: string | null) => void;
  onConsentAnalyticsChange: (consentAnalytics: boolean | null) => void;
  onReset: () => void;
}

/**
 * DeveloperFilters Component
 *
 * 検索・フィルタUIを提供。
 * 検索ボックス、組織フィルタ、分析同意フィルタ、リセットボタンを表示。
 */
export function DeveloperFilters({
  query,
  organizationId,
  consentAnalytics,
  organizations,
  onQueryChange,
  onOrganizationChange,
  onConsentAnalyticsChange,
  onReset
}: DeveloperFiltersProps): JSX.Element {
  // 検索ボックス（デバウンス付き）
  // 組織フィルタドロップダウン
  // 分析同意フィルタ（3状態トグル: null=全て, true=同意のみ, false=非同意のみ）
  // リセットボタン（全フィルタをリセット、onConsentAnalyticsChange(null)を呼び出す）
}
```

### DeveloperDetail

```typescript
interface DeveloperDetailProps {
  developer: Developer;
  organization: Organization | null;
  identifiers: DeveloperIdentifier[];
  stats: {
    totalActivities: number;
    awarenessCount: number;
    engagementCount: number;
    adoptionCount: number;
    advocacyCount: number;
  };
}

/**
 * DeveloperDetail Component
 *
 * 開発者の詳細情報を表示。
 * 基本情報、識別子、統計情報を表示。
 */
export function DeveloperDetail({ developer, organization, identifiers, stats }: DeveloperDetailProps): JSX.Element {
  // 基本情報（アバター、名前、メールアドレス、所属組織）
  // 識別子リスト（IdentifierListコンポーネント）
  // アクティビティ統計（ファネルステージ別）
}
```

### IdentifierList

```typescript
interface IdentifierListProps {
  identifiers: DeveloperIdentifier[];
}

/**
 * IdentifierList Component
 *
 * 開発者の識別子リストを表示。
 * プラットフォームごとのアイコンと値を表示。
 */
export function IdentifierList({ identifiers }: IdentifierListProps): JSX.Element {
  // 識別子ごとにアイコンと値を表示
  // 検証済みバッジを表示（verifiedAtがnullでない場合）
  // Confidence scoreを表示
}
```

### ActivityTimeline

```typescript
interface ActivityTimelineProps {
  activities: Activity[];
}

/**
 * ActivityTimeline Component
 *
 * 開発者のアクティビティ履歴をタイムライン形式で表示。
 */
export function ActivityTimeline({ activities }: ActivityTimelineProps): JSX.Element {
  // アクティビティをタイムライン形式で表示
  // アイコン、アクション、ソース、日時を表示
}
```

## データフロー

### 開発者一覧ページ

1. ページロード時に`loader`が実行される
2. URLパラメータからフィルタ設定を取得
3. `GET /api/developers?query=xxx&organizationId=xxx&page=1&limit=20`を呼び出す
4. データを取得してコンポーネントに渡す
5. DeveloperListがDeveloperTableまたはDeveloperCardを表示
6. ユーザーがフィルタを変更すると、URLパラメータが更新され、loaderが再実行される

```typescript
// Loader実装例（エラーハンドリング付き）
export async function loader({ request }: LoaderFunctionArgs) {
  // 認証チェック（未認証時は/loginへリダイレクト）
  const user = await requireAuth(request);

  // URLパラメータからフィルタ設定を取得
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';
  const organizationId = url.searchParams.get('organizationId') || null;
  const consentAnalyticsParam = url.searchParams.get('consentAnalytics');
  const consentAnalytics = consentAnalyticsParam === 'true' ? true : consentAnalyticsParam === 'false' ? false : null;
  const sortBy = url.searchParams.get('sortBy') || 'name';
  const sortOrder = url.searchParams.get('sortOrder') || 'asc';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  try {
    // URLパラメータ構築
    const params = new URLSearchParams({
      query,
      sortBy,
      sortOrder,
      page: String(page),
      limit: String(limit)
    });
    if (organizationId) params.set('organizationId', organizationId);
    if (consentAnalytics !== null) params.set('consentAnalytics', String(consentAnalytics));

    // 開発者リストと組織リストを並列取得
    const [developersResponse, organizationsResponse] = await Promise.all([
      fetch(`/api/developers?${params.toString()}`, {
        headers: { Cookie: request.headers.get('Cookie') || '' }
      }),
      fetch('/api/organizations', {
        headers: { Cookie: request.headers.get('Cookie') || '' }
      })
    ]);

    // レスポンスステータスチェック
    if (!developersResponse.ok) {
      throw new Error(`Failed to fetch developers: ${developersResponse.status}`);
    }
    if (!organizationsResponse.ok) {
      throw new Error(`Failed to fetch organizations: ${organizationsResponse.status}`);
    }

    // JSONパース
    const developers = await developersResponse.json();
    const organizations = await organizationsResponse.json();

    return json<DevelopersPageData>({
      developers: developers.developers,
      organizations: organizations.organizations,
      pagination: developers.pagination
    });
  } catch (error) {
    console.error('Developers loader error:', error);
    throw new Response('Failed to load developers', { status: 500 });
  }
}
```

### 開発者詳細ページ

1. ページロード時に`loader`が実行される
2. URLパラメータから開発者IDを取得
3. 以下のAPIを並列呼び出し：
   - `GET /api/developers/:id`
   - `GET /api/developers/:id/identifiers`
   - `GET /api/developers/:id/activities?limit=10`
   - `GET /api/developers/:id/stats`
4. データを取得してコンポーネントに渡す
5. DeveloperDetailが詳細情報を表示
6. ActivityTimelineがアクティビティ履歴を表示

```typescript
// Loader実装例（エラーハンドリング付き）
export async function loader({ params, request }: LoaderFunctionArgs) {
  // 認証チェック
  const user = await requireAuth(request);

  const { id } = params;
  if (!id) {
    throw new Response('Developer ID is required', { status: 400 });
  }

  try {
    // 開発者詳細、識別子、アクティビティ、統計を並列取得
    const [detailResponse, identifiersResponse, activitiesResponse, statsResponse] = await Promise.all([
      fetch(`/api/developers/${id}`, {
        headers: { Cookie: request.headers.get('Cookie') || '' }
      }),
      fetch(`/api/developers/${id}/identifiers`, {
        headers: { Cookie: request.headers.get('Cookie') || '' }
      }),
      fetch(`/api/developers/${id}/activities?limit=10`, {
        headers: { Cookie: request.headers.get('Cookie') || '' }
      }),
      fetch(`/api/developers/${id}/stats`, {
        headers: { Cookie: request.headers.get('Cookie') || '' }
      })
    ]);

    // レスポンスステータスチェック
    if (!detailResponse.ok) {
      if (detailResponse.status === 404) {
        throw new Response('Developer not found', { status: 404 });
      }
      throw new Error(`Failed to fetch developer: ${detailResponse.status}`);
    }

    // JSONパース
    const detail = await detailResponse.json();
    const identifiers = await identifiersResponse.json();
    const activities = await activitiesResponse.json();
    const stats = await statsResponse.json();

    return json<DeveloperDetail>({
      ...detail.developer,
      identifiers: identifiers.identifiers,
      recentActivities: activities.activities,
      stats: stats.stats
    });
  } catch (error) {
    console.error('Developer detail loader error:', error);
    throw new Response('Failed to load developer details', { status: 500 });
  }
}
```

## テスト要件

### E2Eテスト

`core/e2e/dashboard-developers.spec.ts`を作成：

1. **開発者リスト表示テスト**: 開発者リストが正しく表示されることを確認
2. **検索機能テスト**: 検索ボックスで開発者を検索できることを確認
3. **フィルタ機能テスト**: 組織フィルタで絞り込みができることを確認
4. **ソート機能テスト**: カラムヘッダーをクリックしてソートできることを確認
5. **ページネーションテスト**: ページ切り替えが機能することを確認
6. **詳細ページ遷移テスト**: 開発者をクリックして詳細ページに遷移できることを確認
7. **詳細ページ表示テスト**: 開発者詳細ページが正しく表示されることを確認
8. **レスポンシブテスト**: モバイルビューポートでカード表示になることを確認

### API統合テスト

`core/app/routes/api/developers.$id.identifiers.test.ts`を作成：

1. **GET /api/developers/:id/identifiers**: 識別子リストが正しく返されることを確認
2. **認証テスト**: 未認証時に401が返されることを確認

`core/app/routes/api/developers.$id.stats.test.ts`を作成：

1. **GET /api/developers/:id/stats**: 統計情報が正しく返されることを確認
2. **認証テスト**: 未認証時に401が返されることを確認

## パフォーマンス考慮事項

- **データキャッシング**: Loaderでデータをキャッシュし、再レンダリングを最小化
- **検索デバウンス**: 検索ボックスの入力はデバウンス（300ms）で不要なAPIコールを防ぐ
- **仮想スクロール**: 開発者数が多い場合は仮想スクロールを検討（将来的な拡張）
- **画像遅延ロード**: アバター画像は遅延ロードで初期ロード時間を短縮

## セキュリティ考慮事項

- **認証チェック**: 全てのAPIエンドポイントで`requireAuth()`を使用
- **テナント分離**: RLSポリシーで他テナントのデータにアクセスできないことを保証
- **XSS対策**: ユーザー入力は全てエスケープ
- **CSRF対策**: RemixのCSRFトークンを使用

## 実装完了条件（受け入れ基準）

以下の全ての項目が満たされた時点で、Task 7.3は完了とみなされます。

- [ ] 開発者一覧ページが`/dashboard/developers`で表示される
- [ ] 検索機能が動作する（名前・メールアドレスで検索）
- [ ] フィルタ機能が動作する（組織でフィルタ）
- [ ] ソート機能が動作する（名前、メールアドレス、作成日、アクティビティ数）
- [ ] ページネーションが動作する
- [ ] 開発者詳細ページが`/dashboard/developers/:id`で表示される
- [ ] 詳細ページで基本情報、識別子、統計情報が表示される
- [ ] ダークモード対応が完了している
- [ ] レスポンシブデザインが実装されている（モバイル/タブレット/デスクトップ）
- [ ] 共通コンポーネント（DeveloperList等）が実装されている
- [ ] E2Eテストが実装され、全テストがパスする
- [ ] TypeScriptエラーがない
- [ ] ESLintエラーがない

## 新規API実装が必要な項目

以下のAPIは既存実装がないため、新規実装が必要です：

1. **GET /api/developers/:id/identifiers**: 開発者の識別子リストを取得
   - `core/app/routes/api/developers.$id.identifiers.ts`を作成
   - `core/services/identity-identifiers.service.ts`の`listIdentifiers()`を使用

2. **GET /api/developers/:id/stats**: 開発者のアクティビティ統計を取得
   - `core/app/routes/api/developers.$id.stats.ts`を作成
   - ファネルステージ別のアクティビティ件数を集計

3. **GET /api/organizations**: 組織リストを取得（フィルタドロップダウン用）
   - `core/app/routes/api/organizations.ts`を作成
   - `core/services/organization.service.ts`が必要（未実装）

## 備考

- 開発者リストコンポーネントはプラグインでも利用されることを想定し、汎用的な設計にする
- アバター画像がない場合は、名前のイニシャルを表示するフォールバックUIを実装
- 識別子のプラットフォームアイコンはHeroiconsまたはSimple Iconsを使用
- アクティビティ統計はファネルステージ別に色分けして表示（Awareness: blue, Engagement: green, Adoption: yellow, Advocacy: purple）
