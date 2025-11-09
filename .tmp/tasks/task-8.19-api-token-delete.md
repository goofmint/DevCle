# Task 8.19: APIトークン無効化APIの実装

## 概要

`DELETE /api/tokens/:id` エンドポイントを実装し、APIトークンを無効化できるようにする。

## 目的

- 管理画面からトークンを無効化するため
- 漏洩したトークンや不要になったトークンを即座に無効化するため
- 論理削除により監査証跡を保持するため

## セキュリティ要件

- 認証必須：requireAuth()でログインユーザーのみアクセス可能
- テナント分離：RLS（Row Level Security）で他テナントのトークンにはアクセス不可
- 論理削除：物理削除ではなく`revoked_at`に現在時刻を設定
- 冪等性：既に無効化済みのトークンも再度無効化可能（エラーにしない）
- 即座に無効化：revoked_at設定後、即座にverifyToken()が失敗するようになる

## アーキテクチャ

```
HTTP Request (DELETE /api/tokens/:id)
  ↓
Resource Route (app/routes/api.tokens_.$id.ts)
  ↓ requireAuth() → user.tenantId
  ↓
Service Layer (services/token.service.ts)
  ↓ withTenantContext(tenantId, async (tx) => { ... })
  ↓
Drizzle ORM
  ↓
PostgreSQL + RLS
```

## 実装内容

### 1. サービス層（`core/services/token.service.ts`）

#### revokeToken()関数

```typescript
export async function revokeToken(
  tenantId: string,
  tokenId: string
): Promise<void>
```

**処理内容:**
- withTenantContext()内でUPDATE api_tokens SET revoked_at = NOW()を実行
- WHERE条件: token_id = $1 AND tenant_id = $2
- RETURNINGで結果確認。空配列なら"Token not found"エラー
- 既に無効化済みでもエラーにしない（冪等性）

### 2. APIルート層（`core/app/routes/api.tokens_.$id.ts`）

既存ファイルに`action`関数を追加（loaderと共存）。

#### action()関数

```typescript
export async function action({ request, params }: ActionFunctionArgs)
```

**処理フロー:**
1. HTTPメソッド検証（DELETE以外は405）
2. requireAuth()で認証チェック
3. params.idからtokenId取得
4. revokeToken(tenantId, tokenId)呼び出し
5. レスポンス: `{ success: true }` (200)

**エラーレスポンス:**
- 401: Unauthorized
- 404: Token not found
- 405: Method not allowed
- 500: Failed to revoke API token

### 3. テスト

#### サービス層テスト（`core/services/token.service.test.ts`）

- 有効なトークンの無効化
- 冪等性（既に無効化済みのトークンの再無効化）
- 存在しないトークンのエラー処理
- テナント分離（RLS）の検証
- verifyToken()が即座に失敗することの確認

#### APIルート層テスト（`core/app/routes/api.tokens_.$id.test.ts`）

- 200 OK（success: true）
- 冪等性確認
- 404エラー（存在しないトークン）
- 401エラー（認証なし）
- 405エラー（DELETE以外のメソッド）
- テナント分離の検証

## データフロー

```
1. ユーザーが管理画面でトークン無効化ボタンをクリック
   ↓
2. DELETE /api/tokens/:id リクエスト送信
   ↓
3. action()関数: 認証チェック、パラメータ取得
   ↓
4. revokeToken(): UPDATE revoked_at = NOW()
   ↓
5. JSONレスポンス: { success: true } または { error: "..." }
```

## 実装の注意点

### 論理削除

- 物理削除（DELETE）ではなく論理削除（UPDATE revoked_at）
- 監査証跡を保持するため

### 冪等性

- 既に無効化済みのトークンも再度無効化可能
- WHERE条件に`revoked_at IS NULL`を含めない
- UIでの二重クリック対策、リトライ処理での安全性確保

### RLS

- withTenantContext()を必ず使用
- 他テナントのトークンは自動的に更新不可

### 即座に無効化

- revoked_at設定直後から、verifyToken()が失敗する
- ステータス計算ロジックで優先度が最も高い

## 完了条件

- [ ] `services/token.service.ts`に`revokeToken()`関数を実装
- [ ] `app/routes/api.tokens_.$id.ts`に`action`関数を実装
- [ ] `services/token.service.test.ts`に`revokeToken()`のテストを追加
- [ ] `app/routes/api.tokens_.$id.test.ts`に`DELETE /api/tokens/:id`のテストを追加
- [ ] すべてのテストがパス
- [ ] TypeScriptの型チェックがパス

## 参考実装

- `services/token.service.ts` - getToken()のwithTenantContext()パターン
- `app/routes/api.tokens_.$id.ts` - loader関数のエラーハンドリングパターン
- `db/schema/admin.ts` - apiTokensテーブルスキーマ（revoked_atカラム）

## 依存関係

- **前提**: Task 8.18（APIトークン詳細取得API）が完了していること
- **後続**: Task 8.20（APIトークン管理UI）でこのエンドポイントを利用
