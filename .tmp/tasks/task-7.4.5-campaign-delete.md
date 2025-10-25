# Task 7.4.5: キャンペーンの削除

**タスクID**: 7.4.5
**フェーズ**: Phase 7（ダッシュボード UI 実装）
**依存**: Task 7.4（Campaigns ページ実装）
**推定時間**: 1時間
**担当**: Frontend Developer

---

## 概要

このタスクでは、**キャンペーン（施策）削除機能**を実装します。削除確認ダイアログを表示し、ユーザーの確認後にキャンペーンを削除します。関連データ（budgets, resources）も CASCADE 削除されます。

**実装する機能**:
1. **削除確認ダイアログ** - キャンペーン削除前にユーザーに確認を求めるモーダルダイアログ
2. **削除処理実装** - DELETE API 呼び出しとエラーハンドリング
3. **CASCADE 削除** - 関連データ（budgets, resources）の削除処理

### 背景

- Task 7.4 でキャンペーン一覧ページを実装
- Task 7.4.2 でキャンペーン詳細ページを実装
- Task 5.4 でキャンペーン API（CRUD）を実装済み（DELETE /api/campaigns/:id 含む）
- このタスクでは、キャンペーン削除UIと確認ダイアログを構築

---

## 実装方針

### アーキテクチャ

```
User Browser (SPA after authentication)
  ↓
Delete Button Click (in Campaign Detail Page or List Page)
  ↓
Show Confirmation Dialog (Modal)
  ↓
User confirms deletion
  ↓
API Call (fetch)
  - DELETE /api/campaigns/:id
  ↓
Success: Navigate to /dashboard/campaigns
Error: Display error message
```

### 設計原則

1. **Client-Side Rendering (CSR)** - ダイアログはクライアントサイドでレンダリング（認証後はSPA）
2. **API-First** - 既存のREST API（DELETE /api/campaigns/:id）を活用
3. **認証必須** - ログインユーザーのみアクセス可能（ダッシュボードレイアウトで保証）
4. **ユーザー確認必須** - 削除は不可逆操作のため、必ず確認ダイアログを表示
5. **CASCADE 削除** - 関連データ（budgets, resources）も自動削除（サーバー側で実装済み）
6. **エラーハンドリング** - ネットワークエラー・権限エラー等を適切に処理
7. **レスポンシブデザイン** - モバイル・タブレット・デスクトップ対応

---

## ファイル構成

```
app/routes/
  └── dashboard/
      └── campaigns.$id.tsx                // Campaign Detail Page (更新: 削除ボタン追加)

app/components/campaigns/                  // 既存ディレクトリ
  └── DeleteCampaignDialog.tsx             // 削除確認ダイアログ（新規作成）

app/components/ui/                         // 共通UIコンポーネント
  └── Dialog.tsx                           // 汎用ダイアログコンポーネント（新規作成）
```

**ファイルサイズ**: 各ファイル100-200行程度

**共通コンポーネントの設計方針**:
- `Dialog`は汎用的なダイアログコンポーネントとして設計（他の削除機能でも再利用可能）
- `DeleteCampaignDialog`はキャンペーン削除専用のダイアログコンポーネント

---

## コンポーネント設計

### 1. Dialog.tsx (汎用ダイアログコンポーネント)

```typescript
/**
 * Generic Dialog Component (Reusable Modal)
 *
 * Features:
 * - Display modal dialog with title, content, and actions
 * - Close on overlay click or ESC key
 * - Focus trap for accessibility
 * - Responsive design
 *
 * Props:
 * - isOpen: boolean - Dialog open state
 * - onClose: () => void - Close handler
 * - title: string - Dialog title
 * - children: React.ReactNode - Dialog content
 * - actions?: React.ReactNode - Dialog action buttons (optional)
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function Dialog({ isOpen, onClose, title, children, actions }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  /**
   * Handle ESC key press to close dialog
   */
  useEffect(() => {
    // Implementation details omitted (see actual code)
  }, [isOpen, onClose]);

  /**
   * Handle overlay click to close dialog
   */
  const handleOverlayClick = (e: React.MouseEvent) => {
    // Implementation details omitted (see actual code)
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="dialog-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="dialog-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="dialog-header">
          <h2 id="dialog-title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="dialog-close-button"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="dialog-content">
          {children}
        </div>

        {actions && (
          <div className="dialog-actions">
            {actions}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
```

**主な機能**:
- モーダルダイアログの表示・非表示制御
- ESC キーとオーバーレイクリックでダイアログを閉じる
- アクセシビリティ対応（role, aria-* 属性）
- React Portal でボディ直下にレンダリング

---

### 2. DeleteCampaignDialog.tsx (削除確認ダイアログ)

```typescript
/**
 * Delete Campaign Confirmation Dialog
 *
 * Features:
 * - Display campaign name and deletion warning
 * - Confirm/Cancel buttons
 * - Call DELETE API on confirmation
 * - Navigate to campaigns list on success
 *
 * Props:
 * - isOpen: boolean - Dialog open state
 * - onClose: () => void - Close handler
 * - campaign: { campaignId: string; name: string } - Campaign to delete
 * - onSuccess?: () => void - Success callback (optional)
 */

import { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { Dialog } from '~/components/ui/Dialog';

interface DeleteCampaignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: {
    campaignId: string;
    name: string;
  };
  onSuccess?: () => void;
}

export function DeleteCampaignDialog({
  isOpen,
  onClose,
  campaign,
  onSuccess,
}: DeleteCampaignDialogProps) {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle campaign deletion
   *
   * Steps:
   * 1. Call DELETE /api/campaigns/:id
   * 2. Navigate to campaigns list on success
   * 3. Display error message on failure
   */
  const handleDelete = async () => {
    // Implementation details omitted (see actual code)
    // 1. setIsDeleting(true)
    // 2. Call DELETE /api/campaigns/:id
    // 3. If success: onSuccess?.() or navigate('/dashboard/campaigns')
    // 4. If error: setError(message)
    // 5. setIsDeleting(false)
  };

  /**
   * Reset state when dialog closes
   */
  const handleClose = () => {
    // Implementation details omitted (see actual code)
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="キャンペーンの削除"
      actions={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="btn-secondary"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn-danger"
          >
            {isDeleting ? '削除中...' : '削除'}
          </button>
        </>
      }
    >
      <div className="delete-campaign-content">
        <p className="warning-text">
          以下のキャンペーンを削除しようとしています。この操作は取り消せません。
        </p>

        <div className="campaign-info">
          <strong>{campaign.name}</strong>
        </div>

        <p className="cascade-warning">
          関連する予算（Budgets）とリソース（Resources）も削除されます。
        </p>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
```

**主な機能**:
- キャンペーン名と警告メッセージの表示
- 削除中状態の管理（isDeleting）
- DELETE API 呼び出し
- エラーメッセージの表示
- 成功時のナビゲーション処理

---

### 3. campaigns.$id.tsx (キャンペーン詳細ページの更新)

```typescript
/**
 * Campaign Detail Page (Update: Add Delete Button)
 *
 * Features (Existing):
 * - Display campaign details
 * - Display budgets, resources, activities lists
 *
 * Features (New):
 * - Add delete button in header
 * - Open delete confirmation dialog on button click
 */

import { useState } from 'react';
import { useLoaderData } from '@remix-run/react';
import { DeleteCampaignDialog } from '~/components/campaigns/DeleteCampaignDialog';
// ... other imports ...

export default function CampaignDetailPage() {
  const { campaign } = useLoaderData<typeof loader>();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  /**
   * Open delete confirmation dialog
   */
  const handleDeleteClick = () => {
    // Implementation details omitted (see actual code)
  };

  /**
   * Close delete confirmation dialog
   */
  const handleDeleteDialogClose = () => {
    // Implementation details omitted (see actual code)
  };

  return (
    <div className="campaign-detail-page">
      {/* Page Header with Delete Button */}
      <div className="page-header">
        <h1>{campaign.name}</h1>
        <div className="header-actions">
          <button
            type="button"
            onClick={handleDeleteClick}
            className="btn-danger"
          >
            削除
          </button>
        </div>
      </div>

      {/* Campaign Details (Existing) */}
      {/* ... */}

      {/* Delete Confirmation Dialog */}
      <DeleteCampaignDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleDeleteDialogClose}
        campaign={{
          campaignId: campaign.campaignId,
          name: campaign.name,
        }}
      />
    </div>
  );
}
```

**主な変更点**:
- ページヘッダーに削除ボタンを追加
- 削除ダイアログの表示・非表示を管理する state 追加
- `DeleteCampaignDialog` コンポーネントを配置

---

## API 連携

### DELETE /api/campaigns/:id

**リクエスト例**:

```typescript
const response = await fetch(`/api/campaigns/${campaignId}`, {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
  },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message || 'キャンペーンの削除に失敗しました');
}

// Success: no response body (204 No Content)
```

**レスポンス例（成功）**:

```
HTTP/1.1 204 No Content
```

**レスポンス例（エラー）**:

```json
{
  "error": "Not Found",
  "message": "キャンペーンが見つかりませんでした",
  "statusCode": 404
}
```

**CASCADE 削除の動作**:
- `budgets` テーブル: `campaignId` が一致するレコードをすべて削除
- `resources` テーブル: `campaignId` カラムを NULL に更新（orphan 化）
- サーバー側で実装済み（Task 5.4）

---

## エラーハンドリング

### 1. API エラー

```typescript
// 404 Not Found: キャンペーンが見つからない
try {
  const response = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
  if (response.status === 404) {
    setError('キャンペーンが見つかりませんでした');
  } else if (!response.ok) {
    const error = await response.json();
    setError(error.message || 'キャンペーンの削除に失敗しました');
  }
} catch (err) {
  setError('ネットワークエラーが発生しました。もう一度お試しください。');
}
```

**表示例**:
- ダイアログ内にエラーメッセージを赤字で表示
- エラー発生時もダイアログは閉じない（ユーザーが再試行またはキャンセル可能）

### 2. ネットワークエラー

```typescript
// ネットワークエラー処理
try {
  const response = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
} catch (err) {
  setError('ネットワークエラーが発生しました。インターネット接続を確認してください。');
}
```

**表示例**:
- 「ネットワークエラーが発生しました」というメッセージをダイアログ内に表示

### 3. 権限エラー

```typescript
// 401 Unauthorized: 認証エラー
// 403 Forbidden: 権限エラー
if (response.status === 401 || response.status === 403) {
  setError('この操作を実行する権限がありません');
}
```

---

## UI/UX 仕様

### レイアウト

```
┌─────────────────────────────────────────┐
│ ダッシュボードヘッダー                    │
├─────────────────────────────────────────┤
│ サイドバー │ メインコンテンツ             │
│            │                             │
│ - Overview │ キャンペーン詳細             │
│ - Develop. │                             │
│ - Campaign │ [DevRel Summit 2024] [削除] │
│ - Funnel   │                             │
│            │ 開始日: 2024-11-01          │
│            │ 終了日: 2024-11-03          │
│            │                             │
│            │ ┌─────────────────────┐      │
│            │ │ キャンペーンの削除   │      │
│            │ │                     │      │
│            │ │ 以下のキャンペーンを │      │
│            │ │ 削除しようとしていま │      │
│            │ │ す。この操作は取り消 │      │
│            │ │ せません。           │      │
│            │ │                     │      │
│            │ │ DevRel Summit 2024  │      │
│            │ │                     │      │
│            │ │ 関連する予算とリソー │      │
│            │ │ スも削除されます。   │      │
│            │ │                     │      │
│            │ │ [キャンセル] [削除]  │      │
│            │ └─────────────────────┘      │
└────────────┴─────────────────────────────┘
```

### スタイリング

- **TailwindCSS** でスタイリング
- **ダークモード対応** (dark: プレフィックス)
- **レスポンシブデザイン** (sm:, md:, lg: ブレークポイント)
- **アクセシビリティ** (role, aria-modal, aria-labelledby 属性)

**カラーパレット**:
- Danger: red-600 (dark: red-500) - 削除ボタン
- Primary: blue-600 (dark: blue-500) - キャンセルボタン
- Overlay: rgba(0, 0, 0, 0.5) - モーダル背景
- Background: white (dark: gray-800) - ダイアログ背景

**アニメーション**:
- ダイアログ表示時: フェードイン + スケールアップ
- ダイアログ非表示時: フェードアウト + スケールダウン

---

## テスト仕様

### E2E テスト (Playwright)

**テストファイル**: `core/e2e/dashboard-campaigns-delete.spec.ts`

```typescript
/**
 * E2E Tests for Campaign Delete
 *
 * Test scenarios:
 * 1. Delete button display and access control
 * 2. Delete confirmation dialog display
 * 3. Successful campaign deletion
 * 4. Cancel deletion
 * 5. API errors
 * 6. Dialog close on ESC key
 * 7. Dialog close on overlay click
 */

import { test, expect } from '@playwright/test';

test.describe('Campaign Delete', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    // Create test campaign
    // Navigate to /dashboard/campaigns/:id
  });

  test('should display delete button in campaign detail page', async ({ page }) => {
    // Test implementation (see actual code)
  });

  test('should open delete confirmation dialog on delete button click', async ({ page }) => {
    // Test implementation (see actual code)
  });

  test('should delete campaign successfully and navigate to list', async ({ page }) => {
    // Test implementation (see actual code)
  });

  test('should close dialog on cancel button click', async ({ page }) => {
    // Test implementation (see actual code)
  });

  test('should close dialog on ESC key press', async ({ page }) => {
    // Test implementation (see actual code)
  });

  test('should close dialog on overlay click', async ({ page }) => {
    // Test implementation (see actual code)
  });

  test('should handle API errors (404 Not Found)', async ({ page }) => {
    // Test implementation (see actual code)
  });

  test('should show loading state during deletion', async ({ page }) => {
    // Test implementation (see actual code)
  });
});
```

**テストカバレッジ**:
- 削除ボタン表示
- 削除確認ダイアログ表示
- 成功時のキャンペーン削除と一覧ページへの遷移
- キャンセルボタン
- ESC キーでダイアログを閉じる
- オーバーレイクリックでダイアログを閉じる
- エラー表示（404 Not Found）
- ローディング状態

---

## セキュリティ考慮事項

1. **認証必須** - ダッシュボードレイアウトで認証チェック（未ログイン時は /login にリダイレクト）
2. **確認ダイアログ必須** - 削除は不可逆操作のため、必ず確認ダイアログを表示
3. **CSRF 対策** - API 側で実装済み（Task 5.4）
4. **権限チェック** - API 側でテナント ID によるアクセス制御実施（Task 5.4）
5. **エラーメッセージ** - システム内部情報を含めない（ユーザーフレンドリーなメッセージのみ）

---

## パフォーマンス考慮事項

1. **React Portal** - ダイアログはボディ直下にレンダリング（Z-index 問題を回避）
2. **非同期削除** - 削除中は UI をブロックせず、ローディング状態を表示
3. **バンドルサイズ** - Dialog コンポーネントは軽量（依存関係なし）
4. **レンダリング最適化** - Dialog は isOpen=false 時は null を返す（不要なレンダリングを回避）

---

## アクセシビリティ (a11y)

1. **役割（Role）** - `role="dialog"`, `aria-modal="true"` 属性でダイアログを通知
2. **ラベル** - `aria-labelledby` でダイアログタイトルを紐付け
3. **フォーカス管理** - ダイアログ表示時は最初のボタンにフォーカス、閉じたら元の要素に戻す
4. **キーボード操作** - ESC キーでダイアログを閉じる、Tab/Shift+Tab でフォーカス移動
5. **スクリーンリーダー** - 警告メッセージは読み上げ可能

---

## マイルストーン

### M1: 汎用 Dialog コンポーネント実装 (15分)

- [ ] `Dialog.tsx` 作成
- [ ] 基本レイアウト実装
- [ ] ESC キー・オーバーレイクリック対応

### M2: DeleteCampaignDialog コンポーネント実装 (20分)

- [ ] `DeleteCampaignDialog.tsx` 作成
- [ ] 削除確認メッセージ表示
- [ ] DELETE API 呼び出し実装

### M3: キャンペーン詳細ページに削除ボタン追加 (10分)

- [ ] `campaigns.$id.tsx` 更新
- [ ] 削除ボタン追加
- [ ] ダイアログ表示・非表示制御

### M4: E2E テスト (15分)

- [ ] `dashboard-campaigns-delete.spec.ts` 作成
- [ ] テストケース実装（8件）
- [ ] 全テストパス確認

---

## 完了条件

- [ ] キャンペーン詳細ページに削除ボタンが表示される
- [ ] 削除ボタンクリックで確認ダイアログが表示される
- [ ] ダイアログで「削除」ボタンをクリックすると DELETE /api/campaigns/:id が呼ばれる
- [ ] 成功時にキャンペーン一覧ページ（/dashboard/campaigns）にリダイレクトされる
- [ ] API エラーがダイアログ内に表示される
- [ ] キャンセルボタン・ESC キー・オーバーレイクリックでダイアログが閉じる
- [ ] E2E テスト 8 件すべてパス
- [ ] TypeScript エラーなし
- [ ] Lint エラーなし

---

## 次のステップ

- **Task 7.5**: Funnel ページ実装（ファネルチャート表示、ドロップ率表示、時系列グラフ）

---

## 参考資料

- [Remix Documentation - Forms](https://remix.run/docs/en/main/guides/data-writes)
- [React Portal Documentation](https://react.dev/reference/react-dom/createPortal)
- [Accessible Modal Dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- Task 5.4: Campaign API 実装ドキュメント
- Task 7.4.2: キャンペーン詳細ページ実装ドキュメント
