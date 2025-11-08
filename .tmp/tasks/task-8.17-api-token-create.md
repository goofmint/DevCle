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

**シグネチャ:**
```typescript
export function generateToken(): string
```

**実装詳細:**
- トークン形式: `drowltok_` + 32文字のランダム文字列
- 合計長: 41文字（プレフィックス9文字 + ランダム32文字）
- ランダム文字列生成: `crypto.randomBytes(24).toString('base64url')`
  - 24バイトのランダムバイト列を生成
  - base64url形式でエンコード（URL安全な文字のみ）
  - 結果として約32文字の文字列が得られる

**使用例:**
```typescript
const token = generateToken();
// => "drowltok_AbC123XyZ456..."（41文字）
```

**セキュリティ:**
- Node.js標準の`crypto.randomBytes()`を使用し、暗号学的に安全な乱数を生成
- 推測不可能な十分な長さを確保
- プレフィックス付きで識別可能

#### 2. `hashToken(token: string): string`

**目的**: トークンのSHA256ハッシュ値を計算

**シグネチャ:**
```typescript
export function hashToken(token: string): string
```

**実装詳細:**
- SHA256ハッシュアルゴリズムを使用
- 実装: `crypto.createHash('sha256').update(token).digest('hex')`
- 返り値: 64文字の16進数文字列

**使用例:**
```typescript
const hash = hashToken('drowltok_AbC123XyZ456...');
// => "a1b2c3d4e5f6..." (64文字の16進数)
```

**注意:**
- データベースに保存するのはこのハッシュ値のみ
- 生トークンは保存しない（検証時にハッシュ比較）

#### 3. `createToken(tenantId, userId, input): Promise<TokenResponse>`

**目的**: 新規APIトークンの作成とデータベース保存

**シグネチャ:**
```typescript
export async function createToken(
  tenantId: string,
  userId: string,
  input: CreateTokenInput
): Promise<TokenResponse>
```

**入力型:**
```typescript
export type CreateTokenInput = z.input<typeof CreateTokenSchema>;
// { name: string; scopes: string[]; expiresAt?: Date }
```

**返り値型:**
```typescript
export type TokenResponse = {
  tokenId: string;
  name: string;
  token: string;          // 生トークン（作成時のみ）
  tokenPrefix: string;    // 先頭16文字（表示用）
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: string;
};
```

**実装フロー:**
1. 入力データをZodスキーマで検証（`CreateTokenSchema.parse(input)`）
2. `generateToken()`でトークン生成
3. `token_prefix` = トークンの先頭16文字を抽出
4. `token_hash` = `hashToken()`でハッシュ計算
5. `withTenantContext()`内でデータベースに保存
   - テーブル: `api_tokens`
   - 保存項目: tokenId(uuid), tenantId, name, tokenPrefix, tokenHash, scopes, expiresAt, createdBy, createdAt
6. 保存したレコードと**生トークン**を返却

**エラー処理:**
- 重複名（Unique constraint違反）: エラーをスロー（呼び出し側で400エラー処理）
- バリデーションエラー: Zodがスロー

**重要な注意事項:**
- **生トークン（`token`フィールド）は作成時のレスポンスでのみ返却**
- データベースには`token_hash`のみ保存（生トークンは保存しない）
- `token_prefix`（先頭16文字）はUI表示用に保存
- テナント分離のため必ず`withTenantContext()`を使用

### Zodスキーマ

#### CreateTokenSchema

```typescript
export const CreateTokenSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1),
  expiresAt: z.date().optional(),
});

export type CreateTokenInput = z.input<typeof CreateTokenSchema>;
export type CreateTokenParams = z.infer<typeof CreateTokenSchema>;
```

**検証ルール:**
- `name`: 1～100文字の文字列（必須）
- `scopes`: 最低1つのスコープを含む配列（必須）
  - 初期実装では`["webhook:write"]`のみサポート
- `expiresAt`: 有効期限（オプション、未指定なら無期限）

## API実装

### エンドポイント: `POST /api/tokens`

既存の`GET /api/tokens`（一覧取得）と同じファイルに実装。

### ファイル: `core/app/routes/api.tokens.ts`

#### リクエスト仕様

**HTTPメソッド:** POST

**認証:** `requireAuth()`（ログインユーザーのみ）

**Content-Type:** `application/json`

**リクエストボディ:**
```typescript
{
  name: string;        // トークンの説明（例: "GitHub Webhook Token"）
  scopes: string[];    // 権限スコープ（例: ["webhook:write"]）
  expiresAt?: string;  // ISO 8601形式の有効期限（オプション）
}
```

**バリデーション:**
- Zodスキーマで検証（`CreateTokenSchema.parse()`）
- 日付文字列はDateオブジェクトに変換

#### レスポンス仕様

**成功レスポンス（201 Created）:**
```typescript
{
  tokenId: string;
  name: string;
  token: string;          // ⚠️ 生トークン（作成時のみ）
  tokenPrefix: string;    // 先頭16文字（例: "drowltok_AbC1234"）
  scopes: string[];
  expiresAt: string | null;  // ISO 8601形式
  createdAt: string;         // ISO 8601形式
  createdBy: string;         // ユーザーID
}
```

**エラーレスポンス:**
- **400 Bad Request**: バリデーションエラー、重複名エラー
  ```json
  { "error": "Validation failed: name is required" }
  ```
- **401 Unauthorized**: 未認証
  ```json
  { "error": "Authentication required" }
  ```

#### 実装詳細

```typescript
export async function action({ request }: ActionFunctionArgs) {
  // 1. 認証チェック
  const user = await requireAuth(request);

  // 2. リクエストボディをJSON解析
  const body = await request.json();

  // 3. サービス層でトークン作成
  const tokenData = await createToken(user.tenantId, user.userId, body);

  // 4. レスポンス返却（201 Created）
  return json(tokenData, { status: 201 });
}
```

**注意事項:**
- エラーハンドリングは適切に実装（try-catch）
- 重複名エラーは400エラーとして返す
- 生トークンは**このレスポンスでのみ**返却（再表示不可）

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

### トークン生成の実装例

```typescript
import crypto from 'crypto';

export function generateToken(): string {
  const randomBytes = crypto.randomBytes(24);
  const randomString = randomBytes.toString('base64url');
  return `drowltok_${randomString}`;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

### createToken実装例（簡略版）

```typescript
export async function createToken(
  tenantId: string,
  userId: string,
  input: CreateTokenInput
): Promise<TokenResponse> {
  // 1. バリデーション
  const params = CreateTokenSchema.parse(input);

  // 2. トークン生成
  const token = generateToken();
  const tokenPrefix = token.substring(0, 16);
  const tokenHash = hashToken(token);

  // 3. DB保存
  return await withTenantContext(tenantId, async (tx) => {
    const [created] = await tx
      .insert(schema.apiTokens)
      .values({
        tokenId: crypto.randomUUID(),
        tenantId,
        name: params.name,
        tokenPrefix,
        tokenHash,
        scopes: params.scopes,
        expiresAt: params.expiresAt ?? null,
        createdBy: userId,
        createdAt: new Date(),
      })
      .returning();

    // 4. レスポンス（生トークン含む）
    return {
      tokenId: created.tokenId,
      name: created.name,
      token, // ⚠️ 作成時のみ
      tokenPrefix: created.tokenPrefix,
      scopes: created.scopes,
      expiresAt: created.expiresAt,
      createdAt: created.createdAt,
      createdBy: created.createdBy,
    };
  });
}
```

### APIルート実装例（簡略版）

```typescript
export async function action({ request }: ActionFunctionArgs) {
  // 認証
  const user = await requireAuth(request);

  try {
    // リクエストボディ解析
    const body = await request.json();

    // トークン作成
    const tokenData = await createToken(user.tenantId, user.userId, body);

    // 201 Created
    return json(tokenData, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json({ error: 'Validation failed' }, { status: 400 });
    }
    if (error.message?.includes('already exists')) {
      return json({ error: 'Token name already exists' }, { status: 400 });
    }
    throw error;
  }
}
```
