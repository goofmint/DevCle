# Task 8.20: APIトークン管理UIの実装

## 概要

ダッシュボードにAPIトークン管理画面を追加し、ユーザーがトークンの作成・一覧表示・詳細確認・無効化を行えるようにする。

## 目的

- Webhook連携のためのAPIトークンを管理画面から作成・管理できるようにする
- トークンのステータス（Active/Expired/Revoked）を可視化する
- セキュリティ上重要な「生トークンの1回のみ表示」を実装する

## アーキテクチャ

```
User (Browser)
  ↓
Remix Route (dashboard.settings.tokens._index.tsx)
  ↓ loader/action
  ↓
API Routes (/api/tokens, /api/tokens/:id)
  ↓
Token Service
  ↓
PostgreSQL + RLS
```

## 実装内容

### 1. トークン一覧ページ

#### ファイル: `core/app/routes/dashboard.settings.tokens._index.tsx`

```typescript
// Loader Data Type
interface LoaderData {
  tokens: TokenItem[];
  total: number;
  page: number;
  perPage: number;
}

// Loader function
export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData>
```

**処理内容:**
- requireAuth()で認証チェック
- URL検索パラメータからフィルタ取得（status, page, perPage）
- `GET /api/tokens`を呼び出してトークン一覧取得
- レスポンスをLoaderDataとして返す

```typescript
// Action function
export async function action({ request }: ActionFunctionArgs): Promise<ActionData>
```

**処理内容:**
- requireAuth()で認証チェック
- intentに応じて処理を分岐:
  - `create`: トークン作成（POST /api/tokens）
  - `revoke`: トークン無効化（DELETE /api/tokens/:id）

**UIコンポーネント構成:**
- ページヘッダー（タイトル + 新規作成ボタン）
- フィルタバー（Statusセレクト: All/Active/Expired/Revoked）
- トークン一覧テーブル
  - 列: Name, Token Prefix, Scopes, Last Used, Expires At, Status, Actions
  - Actionsカラム: View詳細ボタン, Revoke無効化ボタン（Activeのみ）
- ページネーション（< 1 2 3 >）

### 2. トークン作成ダイアログ

#### コンポーネント: `CreateTokenDialog`

```typescript
interface CreateTokenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  isSubmitting: boolean;
  createdToken?: string | null; // 作成成功時の生トークン
}
```

**フォーム項目:**
- Name（text, required, 1-100文字）
- Scopes（checkbox group, required, 最低1つ選択）
  - webhook:write
  - api:read
  - api:write
- Expires At（date picker, optional）

**作成成功時の表示:**
- 生トークンを大きく表示（monospace font）
- コピーボタン（navigator.clipboard.writeText使用）
- 警告メッセージ: "⚠️ This token will only be shown once. Make sure to copy it now and store it securely."
- 閉じるボタン（コピー後にダイアログを閉じる）

**バリデーション:**
- Name: 1-100文字、必須
- Scopes: 最低1つ選択必須
- Expires At: 未来の日付のみ

### 3. トークン詳細ダイアログ

#### コンポーネント: `TokenDetailDialog`

```typescript
interface TokenDetailDialogProps {
  tokenId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRevoke: (tokenId: string) => void;
}
```

**表示項目:**
- Name
- Token Prefix（monospace font, 例: `drowltok_ABCDEFG...`）
- Scopes（badge表示）
- Status（badge表示: Active=緑, Expired=黄, Revoked=灰）
- Last Used At（relative time表示: "2 hours ago"）
- Expires At
- Created At
- Created By

**アクション:**
- Revokeボタン（Activeステータスのみ表示）
- Closeボタン

**データ取得:**
- ダイアログ表示時に`GET /api/tokens/:id`を呼び出し
- useFetcherで非同期取得

### 4. トークン無効化確認ダイアログ

#### コンポーネント: `RevokeTokenDialog`

```typescript
interface RevokeTokenDialogProps {
  tokenName: string | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}
```

**表示内容:**
- 警告アイコン
- タイトル: "Revoke API Token?"
- メッセージ: "Are you sure you want to revoke the token '{tokenName}'? Webhooks using this token will stop working."
- 確認ボタン: "Revoke Token"（赤色、危険なアクション）
- キャンセルボタン: "Cancel"

### 5. 設定メニューへの追加

#### ファイル: `core/app/routes/dashboard.settings.tsx`

タブナビゲーションに"API Tokens"タブを追加:

```typescript
<Link to="/dashboard/settings/tokens">
  API Tokens
</Link>
```

**タブ構成（更新後）:**
- System
- Activity Types
- API Tokens ← 新規追加

## E2Eテスト

### ファイル: `core/e2e/api-tokens.spec.ts`

**テストシナリオ:**

1. **トークン作成フロー（10 tests）**
   - 作成ダイアログが開く
   - フォーム入力とバリデーション
   - 作成成功後、生トークンが表示される
   - コピーボタンでトークンをコピーできる
   - 警告メッセージが表示される
   - ダイアログを閉じると生トークンは消える
   - 一覧に新しいトークンが表示される

2. **トークン一覧表示（3 tests）**
   - トークン一覧が正しく表示される
   - フィルタでステータス絞り込みができる
   - ページネーションが動作する

3. **トークン詳細表示（3 tests）**
   - 詳細ダイアログが開く
   - トークン情報が正しく表示される
   - Token Prefixのみ表示される（生トークンは表示されない）

4. **トークン無効化（3 tests）**
   - 無効化確認ダイアログが開く
   - 無効化を実行できる
   - 無効化後、ステータスがRevokedになる

5. **バリデーション（5 tests）**
   - Name必須チェック
   - Name文字数チェック（1-100）
   - Scopes必須チェック（最低1つ）
   - Expires At未来日付チェック
   - 重複Name検証

## セキュリティ考慮事項

- **生トークンの1回のみ表示**: 作成直後のレスポンスでのみ返却、再表示不可
- **Token Prefixのみ表示**: 一覧・詳細では最初16文字のみ表示
- **コピー機能**: navigator.clipboard APIを使用（HTTPS必須）
- **無効化の確認**: 誤操作防止のため確認ダイアログを表示
- **RLS適用**: すべてのDB操作はテナント分離されている

## UIデザインガイドライン

- **カラースキーム**: 既存のダークモード対応を継承
- **アイコン**: Iconifyを使用（既存実装と同様）
- **フォーム**: Remix FormとuseFetcherを使用
- **トースト通知**: 成功・エラーメッセージ表示（既存パターンを踏襲）
- **レスポンシブ**: モバイル対応（テーブルはスクロール可能に）

## 完了条件

- [ ] トークン一覧ページが実装され、動作する
- [ ] トークン作成ダイアログが実装され、生トークンが1回のみ表示される
- [ ] トークン詳細ダイアログが実装され、情報が表示される
- [ ] トークン無効化が実装され、確認ダイアログが表示される
- [ ] 設定メニューに"API Tokens"タブが追加される
- [ ] E2Eテストが実装され、すべてパスする
- [ ] TypeScriptの型チェックがパスする

## 依存関係

- **前提**: Task 8.16-8.19（APIトークンのバックエンド実装）が完了していること
- **後続**: Webhook機能でこのUIから作成したトークンを利用

## 参考実装

- `app/routes/dashboard.settings.tsx` - タブナビゲーションパターン
- `app/routes/dashboard.settings_.activity-types.tsx` - 一覧・作成・編集のUIパターン
- `components/settings/BasicSettingsForm.tsx` - フォームコンポーネントパターン
