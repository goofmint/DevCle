# Task 8.16: APIトークン管理APIの実装（CRUD）

## 概要

外部システムからWebhookを送信する際の認証用APIトークン管理機能を実装する。

Task 8.15で実装したWebhook受信は`auth: "public"`で認証なしだが、本番環境では外部システムの認証が必要。各テナントごとにAPIトークンを発行し、Webhookリクエストに含めることで認証する。

## 背景

現在のWebhook受信機能は認証なしで動作しているため、セキュリティリスクがある。本タスクでは、以下の仕組みを実装する：

1. テナントごとにAPIトークンを発行・管理
2. トークンは`drowltok_`プレフィックス付きのランダム文字列
3. 生トークンは作成時のみ表示（再表示不可）
4. トークンハッシュ（SHA256）をDBに保存
5. 有効期限・スコープ・無効化機能をサポート

## データベーススキーマ

### テーブル: `api_tokens`

以下のカラムで構成されるテーブルを作成：

- `token_id` (uuid, PK): トークンID
- `tenant_id` (text, FK): テナントID
- `name` (text): トークンの説明（例: "GitHub Webhook Token"）
- `token_prefix` (text): 先頭16文字（表示用、例: "drowltok_1234567"）
- `token_hash` (text): SHA256ハッシュ値（検証用）
- `scopes` (text[]): 権限スコープ（例: ["webhook:write"]）
- `last_used_at` (timestamptz, nullable): 最終使用日時
- `expires_at` (timestamptz, nullable): 有効期限
- `created_by` (uuid, FK): 作成ユーザーID
- `created_at` (timestamptz): 作成日時
- `revoked_at` (timestamptz, nullable): 無効化日時

**制約条件:**
- Unique constraint: (tenant_id, name)
- RLS有効化（tenant_id基準）

**インデックス:**
- tenant_id
- token_hash（高速検索用）
- revoked_at（アクティブトークンフィルタ用）

**マイグレーション:** `0013_add_api_tokens_table.sql`

## サービス層

### ファイル: `core/services/token.service.ts`

以下の関数を実装：

#### 1. `generateToken(): string`
- **目的**: トークン文字列生成
- **形式**: `drowltok_` + 32文字のランダム文字列
- **実装**: `crypto.randomBytes(24).toString('base64url')`で暗号学的に安全な乱数生成

#### 2. `createToken(tenantId, userId, input): Promise<TokenResponse>`
- **目的**: トークン作成・DB保存
- **入力**: name, scopes, expiresAt（オプション）
- **処理**:
  1. トークン生成
  2. token_prefix = トークンの先頭16文字
  3. token_hash = SHA256(トークン)
  4. DB保存（withTenantContext使用）
- **返却**: 生トークンを含むトークン情報（**作成時のみ**）

#### 3. `listTokens(tenantId, input): Promise<PaginatedTokenList>`
- **目的**: トークン一覧取得
- **入力**: page, perPage, status（active/expired/revoked/all）
- **処理**:
  - ステータスフィルタ適用
    - active: revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
    - expired: revoked_at IS NULL AND expires_at <= NOW()
    - revoked: revoked_at IS NOT NULL
  - ページネーション適用
- **返却**: トークン一覧 + ページネーション情報

#### 4. `getToken(tenantId, tokenId): Promise<Token | null>`
- **目的**: トークン詳細取得
- **返却**: トークン詳細情報（生トークンは**含まない**）

#### 5. `revokeToken(tenantId, tokenId): Promise<boolean>`
- **目的**: トークン無効化
- **処理**: revoked_at = NOW()に更新（論理削除）

#### 6. `verifyToken(token): Promise<TokenInfo | null>`
- **目的**: トークン検証（Webhook認証時に使用）
- **処理**:
  1. SHA256ハッシュ計算
  2. DB検索（テナントコンテキストなし、グローバル検索）
  3. 有効性チェック（revoked_at, expires_at）
- **返却**: tokenId, tenantId, scopes

#### 7. `updateLastUsedAt(tokenId): Promise<void>`
- **目的**: 最終使用日時更新
- **タイミング**: トークン検証成功後に自動実行

### Zodスキーマ

- `CreateTokenSchema`: name, scopes, expiresAt（オプション）
- `ListTokensSchema`: page, perPage, status

## API実装

### エンドポイント設計

#### `POST /api/tokens` - トークン作成
- **認証**: requireAuth()（ログインユーザーのみ）
- **リクエスト**: `{ name, scopes, expiresAt? }`
- **レスポンス**: `{ tokenId, name, token, tokenPrefix, scopes, createdAt, expiresAt }`
- **注意**: 生トークン（`token`フィールド）は**作成時のみ**返却

#### `GET /api/tokens` - トークン一覧取得
- **認証**: requireAuth()
- **クエリパラメータ**: page, perPage, status
- **レスポンス**: `{ items: [...], total, page, perPage }`
- **items構造**: tokenId, name, tokenPrefix, scopes, lastUsedAt, expiresAt, createdAt, revokedAt, status

#### `GET /api/tokens/:id` - トークン詳細取得
- **認証**: requireAuth()
- **レスポンス**: トークン詳細情報（生トークンは**含まない**）

#### `DELETE /api/tokens/:id` - トークン無効化
- **認証**: requireAuth()
- **処理**: revoked_atを設定（物理削除ではなく論理削除）
- **レスポンス**: `{ success: true }`

### ルートファイル

- `core/app/routes/api.tokens.ts` (一覧・作成)
- `core/app/routes/api.tokens_.$id.ts` (詳細・削除)

## テスト設計

### 単体テスト: `core/services/token.service.test.ts`

**テストケース（20+ tests）:**

1. **トークン生成**
   - drowltok_プレフィックス確認
   - ユニーク性確認
   - 十分な長さ確認

2. **トークン作成**
   - 正常作成
   - 重複名エラー
   - スコープバリデーション

3. **一覧取得**
   - アクティブトークンフィルタ
   - ステータス別フィルタ（expired, revoked）
   - ページネーション

4. **トークン検証**
   - 有効トークン検証成功
   - 期限切れトークン拒否
   - 無効化トークン拒否
   - 不正トークン拒否

5. **トークン無効化**
   - 無効化成功
   - 他トークンへの影響なし

6. **最終使用日時更新**
   - タイムスタンプ更新確認

### APIテスト: `core/app/routes/api.tokens.test.ts`

**テストケース:**

1. **POST /api/tokens**
   - トークン作成成功
   - 未認証エラー（401）
   - 入力バリデーションエラー

2. **GET /api/tokens**
   - 一覧取得 + ページネーション
   - ステータスフィルタ

3. **GET /api/tokens/:id**
   - 詳細取得成功
   - 存在しないトークン（404）

4. **DELETE /api/tokens/:id**
   - 無効化成功
   - 存在しないトークン（404）

## セキュリティ考慮事項

### 1. トークン生成
- `crypto.randomBytes()`で暗号学的に安全な乱数使用
- 十分な長さ（32文字）確保
- プレフィックス（`drowltok_`）で識別可能

### 2. トークン保存
- **生トークンは保存しない**（SHA256ハッシュのみ）
- 生トークンは作成時のみ返却（**再表示不可**）
- プレフィックス（先頭16文字）のみ保存して表示用に使用

### 3. トークン検証
- ハッシュ比較（タイミング攻撃対策）
- 有効期限チェック
- 無効化フラグチェック
- テナント情報返却（RLS適用のため）

### 4. RLS（Row Level Security）
- テナント分離（tenant_id基準）
- 他テナントのトークンアクセス不可
- withTenantContext()を必ず使用

### 5. 監査ログ
- 作成者記録（created_by）
- 最終使用日時記録（last_used_at）
- 無効化日時記録（revoked_at）

## 完了条件

- [ ] データベーススキーマ作成（migration 0013）
- [ ] サービス層実装（`token.service.ts`）
- [ ] API実装（`api.tokens.ts`, `api.tokens_.$id.ts`）
- [ ] 単体テスト実装（20+ tests）
- [ ] すべてのテストがパス（`pnpm test`）
- [ ] 型チェックがパス（`pnpm typecheck`）

## 次のタスクへの接続

- **Task 8.17**: APIトークン管理UIの実装（本タスクのAPI使用）
- **Task 8.18**: APIトークンを使ったWebhook認証の実装（`verifyToken()`使用）

## 実装時の注意事項

### トークン形式
- **プレフィックス**: `drowltok_`（9文字）
- **ランダム部分**: 32文字
- **合計長**: 41文字
- **例**: `drowltok_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef`

### DB保存時
- **token_prefix**: 先頭16文字を保存（例: `drowltok_ABCDEFG`）
- **token_hash**: SHA256ハッシュ（64文字の16進数文字列）
- **生トークン**: 保存しない（作成レスポンスでのみ返却）

### ハッシュアルゴリズム
- SHA256使用
- Node.js標準の`crypto`モジュール使用
- `crypto.createHash('sha256').update(token).digest('hex')`

### スコープ
- 初期実装では`webhook:write`のみサポート
- 将来的に拡張可能な設計（配列で保存）

### 有効期限
- オプション（`expires_at`がnullなら無期限）
- 期限切れでも`revoked_at`がnullなら論理的には存在
- ステータス判定で区別

### ページネーション
- デフォルト: page=1, perPage=20
- 最大perPage=100
- オフセット計算: `(page - 1) * perPage`

### ステータス判定ロジック
- **active**: `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`
- **expired**: `revoked_at IS NULL AND expires_at <= NOW()`
- **revoked**: `revoked_at IS NOT NULL`

### エラーハンドリング
- 重複名: Unique constraint違反 → 400エラー
- 存在しないトークン: 404エラー
- 未認証: 401エラー
- 権限なし: 403エラー
