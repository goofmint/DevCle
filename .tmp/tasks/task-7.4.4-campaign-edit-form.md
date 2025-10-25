# Task 7.4.4: キャンペーンの編集

**タスクID**: 7.4.4
**フェーズ**: Phase 7（ダッシュボード UI 実装）
**依存**: Task 7.4（Campaigns ページ実装）、Task 7.4.3（キャンペーンの追加）
**推定時間**: 2時間
**担当**: Frontend Developer

---

## 概要

このタスクでは、**キャンペーン（施策）編集フォーム**を実装します。既存キャンペーンのデータを読み込み、更新するためのフォームUIと、バリデーション、エラーハンドリングを実装します。

**実装する機能**:
1. **キャンペーン編集フォーム** - 既存データを読み込んだフォーム表示
2. **既存データの読み込み** - GET /api/campaigns/:id からデータ取得
3. **更新処理実装** - PUT /api/campaigns/:id で更新

### 背景

- Task 7.4.3 でキャンペーン追加フォームと共通コンポーネント（`CampaignForm`）を実装済み
- Task 5.4 でキャンペーン API（CRUD）を実装済み
- このタスクでは、既存キャンペーン編集UIを構築

---

## 実装方針

### アーキテクチャ

```
User Browser (SPA after authentication)
  ↓
React Component (CampaignEditPage.tsx)
  ↓
Data Loading (useEffect)
  - GET /api/campaigns/:id
  ↓
Form Rendering (CampaignForm.tsx)
  - initialData: existing campaign data
  ↓
Form Submission (handleSubmit)
  ↓
Validation (Zod schema)
  ↓
API Call (fetch)
  - PUT /api/campaigns/:id
  ↓
Success: Navigate to /dashboard/campaigns/:id
Error: Display error message
```

### 設計原則

1. **Client-Side Rendering (CSR)** - フォームはクライアントサイドでレンダリング（認証後はSPA）
2. **API-First** - 既存のREST API（GET /api/campaigns/:id, PUT /api/campaigns/:id）を活用
3. **認証必須** - ログインユーザーのみアクセス可能（ダッシュボードレイアウトで保証）
4. **型安全性** - TypeScript型定義とZodスキーマでバリデーション
5. **共通コンポーネントの再利用** - Task 7.4.3 で実装した `CampaignForm` を再利用
6. **ユーザーフレンドリー** - バリデーションエラーは各フィールドに表示、成功時はフィードバック表示
7. **レスポンシブデザイン** - モバイル・タブレット・デスクトップ対応

---

## ファイル構成

```
app/routes/
  └── dashboard/
      ├── campaigns.add.tsx                // Campaign Add Page (既存)
      └── campaigns.$id.edit.tsx           // Campaign Edit Page (新規作成)

app/components/campaigns/                  // 既存ディレクトリ
  └── CampaignForm.tsx                     // 共通フォームコンポーネント（既存、再利用）

app/schemas/
  └── campaign.schema.ts                   // Zodバリデーションスキーマ（既存、再利用）
```

**ファイルサイズ**: campaigns.$id.edit.tsx は 200-250行程度

**共通コンポーネントの再利用**:
- `CampaignForm` はTask 7.4.3 で実装済み（追加・編集両対応）
- `initialData` propsで既存データを渡すことで編集モード対応

---

## コンポーネント設計

### campaigns.$id.edit.tsx (メインページ)

```typescript
/**
 * Campaign Edit Page (SPA)
 *
 * Features:
 * - Load existing campaign data
 * - Display campaign edit form
 * - Validate user input
 * - Call PUT /api/campaigns/:id
 * - Navigate to detail page on success
 *
 * Authentication: Required (handled by dashboard layout)
 * Method: Client-side rendering
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@remix-run/react';
import { CampaignForm } from '~/components/campaigns/CampaignForm';
import type { CampaignFormData } from '~/schemas/campaign.schema';

interface Campaign {
  campaignId: string;
  tenantId: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export default function CampaignEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load existing campaign data on mount
   *
   * Steps:
   * 1. Call GET /api/campaigns/:id
   * 2. Set campaign state
   * 3. Handle errors (404, 401, etc.)
   */
  useEffect(() => {
    const loadCampaign = async () => {
      // Implementation details omitted (see actual code)
      // - Fetch campaign data
      // - Handle 404 (campaign not found)
      // - Handle 401 (unauthorized)
      // - Set loading state
    };

    if (id) {
      loadCampaign();
    }
  }, [id, navigate]);

  /**
   * Handle form submission
   *
   * Steps:
   * 1. Validate form data (handled by CampaignForm)
   * 2. Call PUT /api/campaigns/:id
   * 3. Navigate to detail page on success
   * 4. Display error message on failure
   */
  const handleSubmit = async (data: CampaignFormData) => {
    // Implementation details omitted (see actual code)
    // - Call PUT /api/campaigns/:id
    // - Handle response
    // - Navigate to detail page
  };

  const handleCancel = () => {
    // Navigate back to detail page
  };

  if (isLoading) {
    return (
      <div className="campaign-edit-page">
        <div className="loading-spinner">
          読み込み中...
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="campaign-edit-page">
        <div className="error-message">
          キャンペーンが見つかりませんでした。
        </div>
      </div>
    );
  }

  return (
    <div className="campaign-edit-page">
      <h1>キャンペーン編集</h1>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <CampaignForm
        initialData={{
          name: campaign.name,
          description: campaign.description || '',
          startDate: campaign.startDate,
          endDate: campaign.endDate || '',
          status: campaign.status,
        }}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
```

**主な機能**:
- 既存キャンペーンデータの読み込み（GET /api/campaigns/:id）
- ローディング状態の表示
- エラー状態の表示（404, 401など）
- フォームコンポーネントに既存データを渡す（initialData）
- 更新処理（PUT /api/campaigns/:id）
- 成功時の遷移処理

---

## API 連携

### GET /api/campaigns/:id

**リクエスト例**:

```typescript
const response = await fetch(`/api/campaigns/${id}`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
});

if (!response.ok) {
  if (response.status === 404) {
    throw new Error('キャンペーンが見つかりませんでした');
  }
  throw new Error('キャンペーンの読み込みに失敗しました');
}

const campaign = await response.json();
```

**レスポンス例（成功）**:

```json
{
  "campaignId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "default",
  "name": "DevRel Summit 2024",
  "description": "開発者向けサミットイベント",
  "startDate": "2024-11-01",
  "endDate": "2024-11-03",
  "status": "active",
  "createdAt": "2024-10-23T12:34:56.789Z",
  "updatedAt": "2024-10-23T12:34:56.789Z"
}
```

### PUT /api/campaigns/:id

**リクエスト例**:

```typescript
const response = await fetch(`/api/campaigns/${id}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'DevRel Summit 2024 (Updated)',
    description: '開発者向けサミットイベント（更新）',
    startDate: '2024-11-01',
    endDate: '2024-11-05',
    status: 'active',
  }),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message || 'キャンペーンの更新に失敗しました');
}

const updatedCampaign = await response.json();
// Navigate to /dashboard/campaigns/:id
```

**レスポンス例（成功）**:

```json
{
  "campaignId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "default",
  "name": "DevRel Summit 2024 (Updated)",
  "description": "開発者向けサミットイベント（更新）",
  "startDate": "2024-11-01",
  "endDate": "2024-11-05",
  "status": "active",
  "createdAt": "2024-10-23T12:34:56.789Z",
  "updatedAt": "2024-10-24T10:11:12.345Z"
}
```

**レスポンス例（エラー）**:

```json
{
  "error": "Validation failed",
  "message": "キャンペーン名は必須です",
  "statusCode": 400
}
```

---

## バリデーション仕様

### クライアントサイドバリデーション

Zod スキーマによるバリデーション（Task 7.4.3 で実装済み）：

| フィールド | ルール | エラーメッセージ |
|-----------|--------|----------------|
| name | 必須、1-200文字 | 「キャンペーン名は必須です」「キャンペーン名は200文字以内で入力してください」 |
| description | 任意、最大2000文字 | 「説明は2000文字以内で入力してください」 |
| startDate | 必須、YYYY-MM-DD形式 | 「有効な日付形式で入力してください（YYYY-MM-DD）」 |
| endDate | 任意、YYYY-MM-DD形式、startDate以降 | 「有効な日付形式で入力してください（YYYY-MM-DD）」「終了日は開始日以降の日付を指定してください」 |
| status | 必須、enum (draft/active/completed) | 「ステータスは draft, active, completed のいずれかを選択してください」 |

### サーバーサイドバリデーション

API側でも同様のバリデーションを実施（Task 5.4 で実装済み）：
- 400 Bad Request: バリデーションエラー
- 401 Unauthorized: 認証エラー
- 404 Not Found: キャンペーンが存在しない
- 500 Internal Server Error: サーバーエラー

---

## エラーハンドリング

### 1. データ読み込みエラー

```typescript
// GET /api/campaigns/:id のエラー処理
try {
  const response = await fetch(`/api/campaigns/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      setError('キャンペーンが見つかりませんでした');
      setCampaign(null);
      return;
    }

    if (response.status === 401) {
      // Redirect to login (handled by auth middleware)
      return;
    }

    setError('キャンペーンの読み込みに失敗しました');
  }
} catch (err) {
  setError('ネットワークエラーが発生しました。もう一度お試しください。');
}
```

**表示例**:
- 404エラー: 「キャンペーンが見つかりませんでした」というメッセージを表示
- その他エラー: エラーバナーを表示

### 2. バリデーションエラー

```typescript
// クライアントサイドバリデーション（Zod）
// Task 7.4.3 で実装済みの CampaignForm が処理
```

**表示例**:
- 各フィールドの下にエラーメッセージを赤字で表示
- フィールドの枠線を赤色にハイライト

### 3. 更新APIエラー

```typescript
// PUT /api/campaigns/:id のエラー処理
try {
  const response = await fetch(`/api/campaigns/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    setError(error.message || 'キャンペーンの更新に失敗しました');
  }
} catch (err) {
  setError('ネットワークエラーが発生しました。もう一度お試しください。');
}
```

**表示例**:
- フォーム上部にエラーバナーを表示
- アイコン付き赤色背景で視認性向上

---

## UI/UX 仕様

### レイアウト

```
┌─────────────────────────────────────────┐
│ ダッシュボードヘッダー                    │
├─────────────────────────────────────────┤
│ サイドバー │ メインコンテンツ             │
│            │                             │
│ - Overview │ キャンペーン編集             │
│ - Develop. │                             │
│ - Campaign │ [エラーバナー（エラー時のみ）] │
│ - Funnel   │                             │
│            │ ┌─────────────────────┐      │
│            │ │ キャンペーン名 *     │      │
│            │ │ [DevRel Summit 2024]│      │
│            │ │                     │      │
│            │ └─────────────────────┘      │
│            │                             │
│            │ ┌─────────────────────┐      │
│            │ │ 説明                │      │
│            │ │ [開発者向けサミット  │      │
│            │ │  イベント]          │      │
│            │ └─────────────────────┘      │
│            │                             │
│            │ ┌─────────────────────┐      │
│            │ │ 開始日 *  終了日     │      │
│            │ │ [2024-11-01]        │      │
│            │ │ [2024-11-03]        │      │
│            │ └─────────────────────┘      │
│            │                             │
│            │ ┌─────────────────────┐      │
│            │ │ ステータス           │      │
│            │ │ [v アクティブ]      │      │
│            │ └─────────────────────┘      │
│            │                             │
│            │ [キャンセル] [更新]          │
└────────────┴─────────────────────────────┘
```

### ローディング状態

```
┌─────────────────────────────────────────┐
│ ダッシュボードヘッダー                    │
├─────────────────────────────────────────┤
│ サイドバー │ メインコンテンツ             │
│            │                             │
│ - Overview │ キャンペーン編集             │
│ - Develop. │                             │
│ - Campaign │ ┌─────────────────────┐      │
│ - Funnel   │ │   🔄 読み込み中...   │      │
│            │ └─────────────────────┘      │
│            │                             │
└────────────┴─────────────────────────────┘
```

### スタイリング

- **TailwindCSS** でスタイリング
- **ダークモード対応** (dark: プレフィックス)
- **レスポンシブデザイン** (sm:, md:, lg: ブレークポイント)
- **アクセシビリティ** (aria-label, aria-invalid 属性)

**カラーパレット**:
- Primary: blue-600 (dark: blue-500)
- Error: red-600 (dark: red-500)
- Border: gray-300 (dark: gray-700)
- Background: white (dark: gray-800)

---

## テスト仕様

### E2E テスト (Playwright)

**テストファイル**: `core/e2e/dashboard-campaigns-edit.spec.ts`

```typescript
/**
 * E2E Tests for Campaign Edit Form
 *
 * Test scenarios:
 * 1. Data loading and form display
 * 2. Successful campaign update
 * 3. Validation errors
 * 4. API errors
 * 5. Cancel navigation
 * 6. 404 error handling
 */

import { test, expect } from '@playwright/test';

test.describe('Campaign Edit Form', () => {
  let campaignId: string;

  test.beforeEach(async ({ page }) => {
    // Login as test user
    // Create test campaign
    // Navigate to /dashboard/campaigns/:id/edit
  });

  test('should load and display existing campaign data', async ({ page }) => {
    // Test implementation (see actual code)
    // - Verify form fields are pre-filled with existing data
    // - Check name, description, dates, status
  });

  test('should update campaign successfully', async ({ page }) => {
    // Test implementation (see actual code)
    // - Modify form fields
    // - Submit form
    // - Verify navigation to detail page
    // - Verify updated data
  });

  test('should show validation errors for required fields', async ({ page }) => {
    // Test implementation (see actual code)
    // - Clear required fields
    // - Submit form
    // - Verify error messages
  });

  test('should show validation error for invalid date range', async ({ page }) => {
    // Test implementation (see actual code)
    // - Set endDate before startDate
    // - Submit form
    // - Verify error message
  });

  test('should handle API errors', async ({ page }) => {
    // Test implementation (see actual code)
    // - Mock API error response
    // - Submit form
    // - Verify error banner
  });

  test('should navigate back on cancel', async ({ page }) => {
    // Test implementation (see actual code)
    // - Click cancel button
    // - Verify navigation to detail page
  });

  test('should handle 404 error when campaign not found', async ({ page }) => {
    // Test implementation (see actual code)
    // - Navigate to non-existent campaign ID
    // - Verify error message
  });
});
```

**テストカバレッジ**:
- データ読み込み（ローディング状態）
- フォーム表示（既存データのプリフィル）
- 必須フィールドバリデーション
- 日付範囲バリデーション
- 成功時のナビゲーション
- エラー表示（API エラー、404 エラー）
- キャンセルボタン

---

## セキュリティ考慮事項

1. **認証必須** - ダッシュボードレイアウトで認証チェック（未ログイン時は /login にリダイレクト）
2. **権限チェック** - API側で同一テナントのキャンペーンのみ更新可能（RLS で保証）
3. **CSRF 対策** - Remix の Form コンポーネント使用時は自動対応（通常の fetch 使用時は必要に応じて対応）
4. **XSS 対策** - React の自動エスケープ機能を活用
5. **入力検証** - クライアントとサーバーの両方でバリデーション
6. **エラーメッセージ** - システム内部情報を含めない（ユーザーフレンドリーなメッセージのみ）

---

## パフォーマンス考慮事項

1. **初回データ読み込み** - useEffect で一度のみ実行（依存配列に id を指定）
2. **フォームバリデーション** - onChange ではなく onBlur でバリデーション（パフォーマンス向上）
3. **API 呼び出し** - 送信中は重複送信を防止（isSubmitting フラグ）
4. **レンダリング** - ローディング中は簡易UIのみ表示（スケルトンスクリーン）

---

## アクセシビリティ (a11y)

1. **ラベル** - すべての入力フィールドに `<label>` を設定
2. **エラー通知** - `aria-invalid`, `aria-describedby` 属性でエラー状態を通知
3. **フォーカス管理** - エラー時は最初のエラーフィールドにフォーカス
4. **キーボード操作** - Tab/Shift+Tab でフィールド間移動、Enter で送信
5. **スクリーンリーダー** - エラーメッセージは読み上げ可能
6. **ローディング状態** - aria-busy 属性でローディング中を通知

---

## マイルストーン

### M1: 編集ページコンポーネント実装 (30分)

- [ ] `campaigns.$id.edit.tsx` 作成
- [ ] データ読み込みロジック実装（GET /api/campaigns/:id）
- [ ] ローディング状態の実装

### M2: フォーム統合 (30分)

- [ ] `CampaignForm` に initialData を渡す
- [ ] フォーム表示確認

### M3: 更新処理とエラーハンドリング (30分)

- [ ] PUT /api/campaigns/:id 呼び出し
- [ ] エラーハンドリング実装
- [ ] 成功時のナビゲーション実装
- [ ] 404エラーハンドリング

### M4: E2E テスト (30分)

- [ ] `dashboard-campaigns-edit.spec.ts` 作成
- [ ] テストケース実装（7件）
- [ ] 全テストパス確認

---

## 完了条件

- [ ] キャンペーン編集ページ（/dashboard/campaigns/:id/edit）が表示される
- [ ] 既存キャンペーンデータがフォームに読み込まれる
- [ ] ローディング状態が表示される
- [ ] フォーム送信で PUT /api/campaigns/:id が呼ばれる
- [ ] バリデーションエラーが表示される
- [ ] 成功時にキャンペーン詳細ページ（/dashboard/campaigns/:id）にリダイレクトされる
- [ ] API エラーが表示される
- [ ] 404エラー時に適切なメッセージが表示される
- [ ] キャンセルボタンでキャンペーン詳細ページに戻る
- [ ] E2E テスト 7 件すべてパス
- [ ] TypeScript エラーなし
- [ ] Lint エラーなし

---

## 次のステップ

- **Task 7.4.5**: キャンペーンの削除（削除確認ダイアログ実装）
- **Task 7.5**: Funnel ページ実装

---

## 参考資料

- [Remix Documentation - Forms](https://remix.run/docs/en/main/guides/data-writes)
- [Remix Documentation - useParams](https://remix.run/docs/en/main/hooks/use-params)
- [React Hooks - useEffect](https://react.dev/reference/react/useEffect)
- Task 5.4: Campaign API 実装ドキュメント
- Task 7.4.3: キャンペーンの追加ドキュメント
