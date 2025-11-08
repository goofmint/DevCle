# Task 8.17: APIトークン作成APIの実装

## 概要

Task 8.16で実装したAPIトークン管理機能のうち、`POST /api/tokens`エンドポイントの実装を行う。

トークン作成は、外部システムからのWebhook認証に必要なAPIトークンを発行する重要な機能。生成されたトークンは作成時のみユーザーに表示され、データベースにはハッシュ値のみが保存される。

## 背景

Task 8.16でデータベーススキーマとトークン一覧取得API（`GET /api/tokens`）が実装された。本タスクでは、新規トークンを作成するための以下の機能を追加する：

1. 暗号学的に安全なトークン生成
2. トークンのハッシュ化と保存
3. 生トークンの一度限りの返却
4. スコープと有効期限の管理

## サービス層実装

### ファイル: `core/services/token.service.ts`

既存の`listTokens()`に加えて、以下の関数を追加実装する。

#### 1. `generateToken(): string`

**目的**: 暗号学的に安全なトークン文字列の生成

**実装詳細:**
- トークン形式: `drowltok_` + 32文字のランダム文字列（合計41文字）
- `crypto.randomBytes(24).toString('base64url')`で生成
- URL安全な文字のみ使用（base64url形式）

#### 2. `hashToken(token: string): string`

**目的**: トークンのSHA256ハッシュ値を計算

**実装詳細:**
- SHA256ハッシュアルゴリズムを使用
- 返り値: 64文字の16進数文字列
- データベースに保存するのはこのハッシュ値のみ

#### 3. `createToken(tenantId, userId, input): Promise<TokenResponse>`

**目的**: 新規APIトークンの作成とデータベース保存

**入力**: `{ name: string; scopes: string[]; expiresAt?: Date }`

**返り値**: トークン情報（tokenId, name, token, tokenPrefix, scopes, expiresAt, createdAt, createdBy）

**実装フロー:**
1. Zodスキーマで入力検証
2. `generateToken()`でトークン生成
3. `token_prefix`（先頭16文字）を抽出
4. `hashToken()`でハッシュ計算
5. `withTenantContext()`内でDB保存
6. 生トークンを含むレスポンスを返却

**重要な注意事項:**
- 生トークンは作成時のレスポンスでのみ返却
- DBには`token_hash`のみ保存（生トークンは保存しない）
- 重複名はUnique constraint違反でエラー

### Zodスキーマ

**CreateTokenSchema**:
- `name`: 1～100文字（必須）
- `scopes`: 文字列の配列、最低1つ（必須）
- `expiresAt`: 有効期限（オプション）

## API実装

### エンドポイント: `POST /api/tokens`

既存の`GET /api/tokens`（一覧取得）と同じファイルに実装。

### ファイル: `core/app/routes/api.tokens.ts`

**HTTPメソッド:** POST
**認証:** `requireAuth()`
**Content-Type:** application/json

**リクエスト:**
- `name`: トークン名（必須）
- `scopes`: スコープ配列（必須）
- `expiresAt`: 有効期限（オプション）

**レスポンス（201 Created）:**
- `tokenId`, `name`, `token`（⚠️作成時のみ）, `tokenPrefix`, `scopes`, `expiresAt`, `createdAt`, `createdBy`

**エラー:**
- 400: バリデーションエラー、重複名
- 401: 未認証

**実装:**
1. 認証チェック（`requireAuth()`）
2. リクエストボディ解析
3. `createToken()`でトークン作成
4. 201ステータスでレスポンス返却

## テスト設計

### 単体テスト: `core/services/token.service.test.ts`

既存の`listTokens()`テストに加えて、以下のテストケースを追加。

#### トークン生成（generateToken）

**テストケース:**
1. ✅ トークンが`drowltok_`プレフィックスで始まる
2. ✅ トークンの長さが41文字
3. ✅ 複数回呼び出しで異なるトークンが生成される（ユニーク性）
4. ✅ base64url文字のみ使用（URL安全な文字）

#### トークンハッシュ（hashToken）

**テストケース:**
1. ✅ SHA256ハッシュが64文字の16進数文字列
2. ✅ 同じトークンから同じハッシュが生成される（冪等性）
3. ✅ 異なるトークンから異なるハッシュが生成される

#### トークン作成（createToken）

**テストケース:**
1. ✅ 正常作成: 必須フィールド（name, scopes）のみ
2. ✅ 正常作成: 有効期限付き（expiresAt指定）
3. ✅ 正常作成: 生トークンが返却される
4. ✅ 正常作成: tokenPrefixが先頭16文字
5. ✅ 正常作成: データベースにtoken_hashが保存される（生トークンは保存されない）
6. ✅ 正常作成: 作成者（createdBy）が記録される
7. ❌ エラー: 重複名（同じテナント内で同じname）
8. ❌ エラー: nameが空文字列
9. ❌ エラー: scopesが空配列
10. ✅ テナント分離: 異なるテナントで同じnameが使用可能

**推定テスト数:** 15+ tests

### APIテスト: `core/app/routes/api.tokens.test.ts`

既存の`GET /api/tokens`テストに加えて、以下のテストケースを追加。

#### POST /api/tokens

**テストケース:**
1. ✅ 正常作成: 201 Createdとトークンデータ返却
2. ✅ 正常作成: 生トークンが返却される
3. ✅ 正常作成: レスポンスに全フィールドが含まれる
4. ✅ 正常作成: 有効期限付きトークン
5. ❌ エラー: 未認証（401）
6. ❌ エラー: リクエストボディなし（400）
7. ❌ エラー: nameが空（400）
8. ❌ エラー: scopesが空配列（400）
9. ❌ エラー: 重複名（400）
10. ✅ テナント分離: 異なるテナントで同じname使用可能

**推定テスト数:** 10+ tests

## 実装時の注意事項

### トークン形式の詳細

**プレフィックス:**
- `drowltok_`（9文字）
- プロダクト識別のための固定文字列
- 将来的にトークンスキャンツールで検出可能

**ランダム部分:**
- 32文字
- base64url形式（`A-Za-z0-9_-`のみ使用）
- `crypto.randomBytes(24).toString('base64url')`で生成

**全体:**
- 合計41文字
- 例: `drowltok_AbC123XyZ456def789ghiJKL012MNo`

### データベース保存時の処理

**保存するフィールド:**
- `token_id`: UUID（自動生成）
- `tenant_id`: テナントID
- `name`: トークン名
- `token_prefix`: 先頭16文字（例: `drowltok_AbC1234`）
- `token_hash`: SHA256ハッシュ（64文字の16進数）
- `scopes`: スコープ配列
- `expires_at`: 有効期限（nullable）
- `created_by`: 作成ユーザーID
- `created_at`: 作成日時（自動）
- `last_used_at`: null（初期値）
- `revoked_at`: null（初期値）

**保存しないフィールド:**
- **生トークン**: 絶対に保存しない（セキュリティリスク）

### セキュリティ考慮事項

#### 1. トークン生成
- ✅ `crypto.randomBytes()`使用（暗号学的に安全）
- ✅ 十分な長さ（32文字）
- ✅ URL安全な文字のみ（base64url）

#### 2. トークン保存
- ✅ 生トークンは保存しない
- ✅ SHA256ハッシュのみ保存
- ✅ プレフィックス（先頭16文字）のみ表示用に保存

#### 3. トークン返却
- ✅ 生トークンは作成時のみ返却
- ⚠️ ユーザーに「再表示不可」を明示（UIで警告）
- ✅ 以降のAPI（GET /api/tokens, GET /api/tokens/:id）では生トークンを含めない

#### 4. テナント分離
- ✅ `withTenantContext()`を必ず使用
- ✅ RLSで他テナントのトークンアクセス不可
- ✅ Unique constraint: (tenant_id, name)

#### 5. 監査ログ
- ✅ 作成者記録（created_by）
- ✅ 作成日時記録（created_at）
- 🔜 将来的に使用ログ（last_used_at）更新

### エラーハンドリング

#### 重複名エラー
```typescript
try {
  await tx.insert(schema.apiTokens).values({ ... });
} catch (error) {
  if (error.code === '23505') { // PostgreSQL unique violation
    throw new Error('Token name already exists');
  }
  throw error;
}
```

#### バリデーションエラー
- Zodスキーマで自動検証
- エラーは呼び出し側でキャッチして400エラーに変換

### スコープの仕様

**初期実装:**
- `webhook:write`: Webhook受信用（唯一サポート）

**将来的な拡張:**
- `api:read`: API読み取り専用
- `api:write`: API書き込み権限
- `admin:*`: 管理者権限

**データ構造:**
- PostgreSQLの`text[]`型で保存
- APIでは`string[]`として扱う

### 有効期限の仕様

**オプション設定:**
- `expiresAt`が`null`または未指定: 無期限
- `expiresAt`が指定された日時: その日時まで有効

**ステータス判定への影響:**
- `revoked_at IS NULL AND expires_at <= NOW()` → `expired`
- `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())` → `active`

**推奨値:**
- 短期利用: 30日
- 長期利用: 1年
- 無期限: 管理者権限のみ

## 完了条件

- [ ] サービス層実装（`core/services/token.service.ts`に追加）
  - [ ] `generateToken()`: トークン生成
  - [ ] `hashToken()`: ハッシュ計算
  - [ ] `createToken()`: トークン作成・保存
  - [ ] `CreateTokenSchema`: Zodスキーマ

- [ ] API実装（`core/app/routes/api.tokens.ts`に追加）
  - [ ] `POST /api/tokens`: トークン作成エンドポイント
  - [ ] 認証チェック（`requireAuth()`）
  - [ ] 入力検証（Zodスキーマ）
  - [ ] エラーハンドリング（重複名、バリデーション）

- [ ] 単体テスト作成（Vitest）
  - [ ] `services/token.service.test.ts`: generateToken, hashToken, createTokenのテスト（15+ tests）
  - [ ] `app/routes/api.tokens.test.ts`: POST /api/tokensのテスト（10+ tests）

- [ ] すべてのテストがパス
  - [ ] `docker compose --env-file .env.test exec core pnpm test`

- [ ] 型チェックがパス
  - [ ] `docker compose --env-file .env.test exec core pnpm typecheck`

## 依存関係

**前提タスク:**
- Task 8.16: APIトークン管理API（データベーススキーマ、`GET /api/tokens`）

**次のタスク:**
- Task 8.18: APIトークン詳細取得API（`GET /api/tokens/:id`）
- Task 8.19: APIトークン無効化API（`DELETE /api/tokens/:id`）

## 参考情報

### トークン生成

```typescript
// crypto.randomBytes(24).toString('base64url')で32文字のランダム文字列を生成
// プレフィックス "drowltok_" を付与
```

### トークンハッシュ

```typescript
// crypto.createHash('sha256').update(token).digest('hex')
// SHA256ハッシュ（64文字の16進数）
```

### 実装の流れ

1. **バリデーション**: CreateTokenSchema.parse()で入力検証
2. **トークン生成**: generateToken()で生トークン作成
3. **ハッシュ化**: hashToken()でSHA256ハッシュ計算
4. **DB保存**: withTenantContext()内でtoken_prefixとtoken_hashを保存
5. **レスポンス**: 生トークンを含むレスポンスを返却（作成時のみ）
