# Task 7.4.3: キャンペーンの追加

**タスクID**: 7.4.3
**フェーズ**: Phase 7（ダッシュボード UI 実装）
**依存**: Task 7.4（Campaigns ページ実装）
**推定時間**: 2時間
**担当**: Frontend Developer

---

## 概要

このタスクでは、**キャンペーン（施策）追加フォーム**を実装します。新規キャンペーンを作成するためのフォームUIと、バリデーション、エラーハンドリングを実装します。

**実装する機能**:
1. **キャンペーン追加フォーム** - 名前、説明、開始日、終了日、ステータス等の入力フォーム
2. **バリデーション** - クライアントサイドとサーバーサイドの両方でバリデーション
3. **入力エラー処理** - バリデーションエラー・API エラーの表示

### 背景

- Task 7.4 でキャンペーン一覧ページを実装
- Task 5.4 でキャンペーン API（CRUD）を実装済み
- このタスクでは、新規キャンペーン作成UIを構築

---

## 実装方針

### アーキテクチャ

```
User Browser (SPA after authentication)
  ↓
React Component (CampaignAddForm.tsx)
  ↓
Form Submission (handleSubmit)
  ↓
Validation (Zod schema)
  ↓
API Call (fetch)
  - POST /api/campaigns
  ↓
Success: Navigate to /dashboard/campaigns/:id
Error: Display error message
```

### 設計原則

1. **Client-Side Rendering (CSR)** - フォームはクライアントサイドでレンダリング（認証後はSPA）
2. **API-First** - 既存のREST API（POST /api/campaigns）を活用
3. **認証必須** - ログインユーザーのみアクセス可能（ダッシュボードレイアウトで保証）
4. **型安全性** - TypeScript型定義とZodスキーマでバリデーション
5. **共通コンポーネントの活用** - 入力フィールド、ボタン、エラーメッセージ等は共通コンポーネント化
6. **ユーザーフレンドリー** - バリデーションエラーは各フィールドに表示、成功時はフィードバック表示
7. **レスポンシブデザイン** - モバイル・タブレット・デスクトップ対応

---

## ファイル構成

```
app/routes/
  └── dashboard/
      └── campaigns.add.tsx                // Campaign Add Page (新規作成)

app/components/campaigns/                  // 既存ディレクトリ（キャンペーン用UIコンポーネント）
  └── CampaignForm.tsx                     // キャンペーンフォーム（共通コンポーネント、追加・編集両方で使用）

app/schemas/
  └── campaign.schema.ts                   // Zodバリデーションスキーマ（新規作成）
```

**ファイルサイズ**: 各ファイル150-250行程度

**共通コンポーネントの設計方針**:
- `CampaignForm`は追加・編集の両方で使用可能な汎用コンポーネントとして設計
- Task 7.4.4（編集）でも再利用
- props で初期値を渡すことで編集モードに対応

---

## コンポーネント設計

### 1. campaigns.add.tsx (メインページ)

```typescript
/**
 * Campaign Add Page (SPA)
 *
 * Features:
 * - Display campaign creation form
 * - Validate user input
 * - Call POST /api/campaigns
 * - Navigate to detail page on success
 *
 * Authentication: Required (handled by dashboard layout)
 * Method: Client-side rendering
 */

import { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { CampaignForm } from '~/components/campaigns/CampaignForm';
import type { CampaignFormData } from '~/schemas/campaign.schema';

export default function CampaignAddPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle form submission
   *
   * Steps:
   * 1. Validate form data (handled by CampaignForm)
   * 2. Call POST /api/campaigns
   * 3. Navigate to detail page on success
   * 4. Display error message on failure
   */
  const handleSubmit = async (data: CampaignFormData) => {
    // Implementation details omitted (see actual code)
  };

  const handleCancel = () => {
    // Navigate back to campaigns list
  };

  return (
    <div className="campaign-add-page">
      <h1>新規キャンペーン作成</h1>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <CampaignForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
```

**主な機能**:
- フォームコンポーネントの表示
- 送信中状態の管理（isSubmitting）
- API エラーの表示
- 成功時の遷移処理

---

### 2. CampaignForm.tsx (共通フォームコンポーネント)

```typescript
/**
 * Campaign Form Component (Reusable for Add/Edit)
 *
 * Features:
 * - Input fields for campaign data
 * - Client-side validation with Zod
 * - Error message display
 * - Submit/Cancel buttons
 *
 * Props:
 * - initialData?: Partial<CampaignFormData> - Initial form values (for edit mode)
 * - onSubmit: (data: CampaignFormData) => Promise<void> - Form submission handler
 * - onCancel: () => void - Cancel button handler
 * - isSubmitting: boolean - Submission state
 */

import { useState } from 'react';
import { campaignFormSchema, type CampaignFormData } from '~/schemas/campaign.schema';
import type { ZodError } from 'zod';

interface CampaignFormProps {
  initialData?: Partial<CampaignFormData>;
  onSubmit: (data: CampaignFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function CampaignForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: CampaignFormProps) {
  const [formData, setFormData] = useState<Partial<CampaignFormData>>(
    initialData || {}
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Validate form data using Zod schema
   *
   * Returns:
   * - true if validation passes
   * - false if validation fails (errors are set in state)
   */
  const validateForm = (): boolean => {
    // Implementation details omitted (see actual code)
    return true;
  };

  /**
   * Handle form field changes
   */
  const handleChange = (field: keyof CampaignFormData, value: unknown) => {
    // Implementation details omitted (see actual code)
  };

  /**
   * Handle form submission
   *
   * Steps:
   * 1. Validate form data
   * 2. Call onSubmit handler
   * 3. Handle validation errors
   */
  const handleSubmit = async (e: React.FormEvent) => {
    // Implementation details omitted (see actual code)
  };

  return (
    <form onSubmit={handleSubmit} className="campaign-form">
      {/* Name field */}
      <div className="form-field">
        <label htmlFor="name">キャンペーン名 *</label>
        <input
          type="text"
          id="name"
          value={formData.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          disabled={isSubmitting}
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </div>

      {/* Description field */}
      <div className="form-field">
        <label htmlFor="description">説明</label>
        <textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          disabled={isSubmitting}
        />
        {errors.description && <span className="error">{errors.description}</span>}
      </div>

      {/* Start date field */}
      <div className="form-field">
        <label htmlFor="startDate">開始日 *</label>
        <input
          type="date"
          id="startDate"
          value={formData.startDate || ''}
          onChange={(e) => handleChange('startDate', e.target.value)}
          disabled={isSubmitting}
        />
        {errors.startDate && <span className="error">{errors.startDate}</span>}
      </div>

      {/* End date field */}
      <div className="form-field">
        <label htmlFor="endDate">終了日</label>
        <input
          type="date"
          id="endDate"
          value={formData.endDate || ''}
          onChange={(e) => handleChange('endDate', e.target.value)}
          disabled={isSubmitting}
        />
        {errors.endDate && <span className="error">{errors.endDate}</span>}
      </div>

      {/* Status field */}
      <div className="form-field">
        <label htmlFor="status">ステータス</label>
        <select
          id="status"
          value={formData.status || 'draft'}
          onChange={(e) => handleChange('status', e.target.value)}
          disabled={isSubmitting}
        >
          <option value="draft">下書き</option>
          <option value="active">アクティブ</option>
          <option value="completed">完了</option>
        </select>
        {errors.status && <span className="error">{errors.status}</span>}
      </div>

      {/* Form actions */}
      <div className="form-actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="btn-secondary"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? '作成中...' : '作成'}
        </button>
      </div>
    </form>
  );
}
```

**主な機能**:
- フォームフィールドの状態管理
- Zod によるクライアントサイドバリデーション
- エラーメッセージの表示
- 送信中の disabled 状態制御
- 追加・編集モードの両対応（initialData プロパティ）

---

### 3. campaign.schema.ts (バリデーションスキーマ)

```typescript
/**
 * Campaign Form Validation Schema
 *
 * Features:
 * - Client-side validation using Zod
 * - Reusable schema for add/edit forms
 * - Type-safe form data
 */

import { z } from 'zod';

/**
 * Campaign form data schema
 *
 * Validation rules:
 * - name: required, 1-200 characters
 * - description: optional, max 2000 characters
 * - startDate: required, ISO date string
 * - endDate: optional, ISO date string, must be after startDate
 * - status: required, enum (draft, active, completed)
 */
export const campaignFormSchema = z.object({
  name: z.string()
    .min(1, 'キャンペーン名は必須です')
    .max(200, 'キャンペーン名は200文字以内で入力してください'),

  description: z.string()
    .max(2000, '説明は2000文字以内で入力してください')
    .optional(),

  startDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '有効な日付形式で入力してください（YYYY-MM-DD）'),

  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '有効な日付形式で入力してください（YYYY-MM-DD）')
    .optional(),

  status: z.enum(['draft', 'active', 'completed'], {
    errorMap: () => ({ message: 'ステータスは draft, active, completed のいずれかを選択してください' }),
  }),
}).refine(
  (data) => {
    if (!data.endDate) return true;
    return new Date(data.endDate) >= new Date(data.startDate);
  },
  {
    message: '終了日は開始日以降の日付を指定してください',
    path: ['endDate'],
  }
);

/**
 * TypeScript type inferred from schema
 */
export type CampaignFormData = z.infer<typeof campaignFormSchema>;
```

**主な機能**:
- 各フィールドのバリデーションルール定義
- 日付範囲の検証（終了日 >= 開始日）
- TypeScript 型の自動推論
- 日本語エラーメッセージ

---

## API 連携

### POST /api/campaigns

**リクエスト例**:

```typescript
const response = await fetch('/api/campaigns', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'DevRel Summit 2024',
    description: '開発者向けサミットイベント',
    startDate: '2024-11-01',
    endDate: '2024-11-03',
    status: 'active',
  }),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message || 'キャンペーンの作成に失敗しました');
}

const campaign = await response.json();
// Navigate to /dashboard/campaigns/:id
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

Zod スキーマによるバリデーション（リアルタイム）：

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
- 500 Internal Server Error: サーバーエラー

---

## エラーハンドリング

### 1. バリデーションエラー

```typescript
// クライアントサイドバリデーション（Zod）
try {
  campaignFormSchema.parse(formData);
} catch (error) {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    error.errors.forEach((err) => {
      if (err.path.length > 0) {
        fieldErrors[err.path[0] as string] = err.message;
      }
    });
    setErrors(fieldErrors);
  }
}
```

**表示例**:
- 各フィールドの下にエラーメッセージを赤字で表示
- フィールドの枠線を赤色にハイライト

### 2. API エラー

```typescript
// サーバーサイドエラー処理
try {
  const response = await fetch('/api/campaigns', { ... });
  if (!response.ok) {
    const error = await response.json();
    setError(error.message || 'キャンペーンの作成に失敗しました');
  }
} catch (err) {
  setError('ネットワークエラーが発生しました。もう一度お試しください。');
}
```

**表示例**:
- フォーム上部にエラーバナーを表示
- アイコン付き赤色背景で視認性向上

### 3. ネットワークエラー

```typescript
// ネットワークエラー処理
try {
  const response = await fetch('/api/campaigns', { ... });
} catch (err) {
  setError('ネットワークエラーが発生しました。インターネット接続を確認してください。');
}
```

**表示例**:
- 「ネットワークエラーが発生しました」というメッセージをバナー表示
- 再試行ボタンを表示

---

## UI/UX 仕様

### レイアウト

```
┌─────────────────────────────────────────┐
│ ダッシュボードヘッダー                    │
├─────────────────────────────────────────┤
│ サイドバー │ メインコンテンツ             │
│            │                             │
│ - Overview │ 新規キャンペーン作成          │
│ - Develop. │                             │
│ - Campaign │ [エラーバナー（エラー時のみ）] │
│ - Funnel   │                             │
│            │ ┌─────────────────────┐      │
│            │ │ キャンペーン名 *     │      │
│            │ │ [______________]    │      │
│            │ │ エラー: 必須です     │      │
│            │ └─────────────────────┘      │
│            │                             │
│            │ ┌─────────────────────┐      │
│            │ │ 説明                │      │
│            │ │ [______________]    │      │
│            │ │                     │      │
│            │ └─────────────────────┘      │
│            │                             │
│            │ ┌─────────────────────┐      │
│            │ │ 開始日 *  終了日     │      │
│            │ │ [____] [____]      │      │
│            │ └─────────────────────┘      │
│            │                             │
│            │ ┌─────────────────────┐      │
│            │ │ ステータス           │      │
│            │ │ [v 下書き   ]       │      │
│            │ └─────────────────────┘      │
│            │                             │
│            │ [キャンセル] [作成]          │
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

**テストファイル**: `core/e2e/dashboard-campaigns-add.spec.ts`

```typescript
/**
 * E2E Tests for Campaign Add Form
 *
 * Test scenarios:
 * 1. Form display and access control
 * 2. Successful campaign creation
 * 3. Validation errors
 * 4. API errors
 * 5. Cancel navigation
 */

import { test, expect } from '@playwright/test';

test.describe('Campaign Add Form', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    // Navigate to /dashboard/campaigns/add
  });

  test('should display form fields', async ({ page }) => {
    // Test implementation (see actual code)
  });

  test('should create campaign successfully', async ({ page }) => {
    // Test implementation (see actual code)
  });

  test('should show validation errors for required fields', async ({ page }) => {
    // Test implementation (see actual code)
  });

  test('should show validation error for invalid date range', async ({ page }) => {
    // Test implementation (see actual code)
  });

  test('should handle API errors', async ({ page }) => {
    // Test implementation (see actual code)
  });

  test('should navigate back on cancel', async ({ page }) => {
    // Test implementation (see actual code)
  });
});
```

**テストカバレッジ**:
- フォーム表示
- 必須フィールドバリデーション
- 日付範囲バリデーション
- 成功時のナビゲーション
- エラー表示
- キャンセルボタン

---

## セキュリティ考慮事項

1. **認証必須** - ダッシュボードレイアウトで認証チェック（未ログイン時は /login にリダイレクト）
2. **CSRF 対策** - Remix の Form コンポーネント使用時は自動対応（通常の fetch 使用時は必要に応じて対応）
3. **XSS 対策** - React の自動エスケープ機能を活用
4. **入力検証** - クライアントとサーバーの両方でバリデーション
5. **エラーメッセージ** - システム内部情報を含めない（ユーザーフレンドリーなメッセージのみ）

---

## パフォーマンス考慮事項

1. **フォームバリデーション** - onChange ではなく onBlur でバリデーション（パフォーマンス向上）
2. **API 呼び出し** - 送信中は重複送信を防止（isSubmitting フラグ）
3. **バンドルサイズ** - Zod は既存依存関係のため追加バンドルサイズなし
4. **レンダリング** - React.memo は不要（フォームコンポーネントは頻繁に再レンダリングされるため）

---

## アクセシビリティ (a11y)

1. **ラベル** - すべての入力フィールドに `<label>` を設定
2. **エラー通知** - `aria-invalid`, `aria-describedby` 属性でエラー状態を通知
3. **フォーカス管理** - エラー時は最初のエラーフィールドにフォーカス
4. **キーボード操作** - Tab/Shift+Tab でフィールド間移動、Enter で送信
5. **スクリーンリーダー** - エラーメッセージは読み上げ可能

---

## マイルストーン

### M1: フォームコンポーネント実装 (30分)

- [ ] `campaigns.add.tsx` 作成
- [ ] 基本レイアウト実装

### M2: バリデーションスキーマ実装 (30分)

- [ ] `campaign.schema.ts` 作成
- [ ] Zod スキーマ定義
- [ ] クライアントサイドバリデーション実装

### M3: API 連携とエラーハンドリング (30分)

- [ ] POST /api/campaigns 呼び出し
- [ ] エラーハンドリング実装
- [ ] 成功時のナビゲーション実装

### M4: E2E テスト (30分)

- [ ] `dashboard-campaigns-add.spec.ts` 作成
- [ ] テストケース実装（6件）
- [ ] 全テストパス確認

---

## 完了条件

- [ ] キャンペーン追加フォームが表示される
- [ ] フォーム送信で POST /api/campaigns が呼ばれる
- [ ] バリデーションエラーが表示される
- [ ] 成功時にキャンペーン詳細ページ（/dashboard/campaigns/:id）にリダイレクトされる
- [ ] API エラーが表示される
- [ ] キャンセルボタンでキャンペーン一覧ページに戻る
- [ ] E2E テスト 6 件すべてパス
- [ ] TypeScript エラーなし
- [ ] Lint エラーなし

---

## 次のステップ

- **Task 7.4.4**: キャンペーンの編集（`CampaignForm` コンポーネントを再利用）
- **Task 7.4.5**: キャンペーンの削除（削除確認ダイアログ実装）

---

## 参考資料

- [Remix Documentation - Forms](https://remix.run/docs/en/main/guides/data-writes)
- [Zod Documentation](https://zod.dev/)
- [TailwindCSS Forms](https://tailwindcss-forms.vercel.app/)
- Task 5.4: Campaign API 実装ドキュメント
- Task 7.4: Campaigns ページ実装ドキュメント
