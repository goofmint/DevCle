# Task 8.16: APIトークン管理APIの実装（CRUD）

## 概要

外部システムからWebhookを送信する際の認証用APIトークン管理機能を実装する。

Task 8.15で実装したWebhook受信は`auth: "public"`で認証なしだが、本番環境では外部システムの認証が必要。各テナントごとにAPIトークンを発行し、Webhookリクエストに含めることで認証する。

## 背景

現在のWebhook受信機能は認証なしで動作しているため、セキュリティリスクがある。本タスクでは、以下の仕組みを実装する：

1. テナントごとにAPIトークンを発行・管理
2. トークンは`drmtok_`プレフィックス付きのランダム文字列
3. 生トークンは作成時のみ表示（再表示不可）
4. トークンハッシュ（SHA256）をDBに保存
5. 有効期限・スコープ・無効化機能をサポート

## データベーススキーマ

### テーブル: `api_tokens`

```sql
CREATE TABLE api_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,

  CONSTRAINT api_tokens_tenant_name_unique UNIQUE (tenant_id, name)
);

CREATE INDEX idx_api_tokens_tenant_id ON api_tokens(tenant_id);
CREATE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX idx_api_tokens_revoked_at ON api_tokens(revoked_at) WHERE revoked_at IS NULL;
```

### Row Level Security (RLS)

```sql
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_tokens_tenant_isolation ON api_tokens
  USING (tenant_id = current_setting('app.tenant_id', true));
```

### マイグレーションファイル

- `0013_add_api_tokens_table.sql`

## サービス層

### ファイル: `core/services/api-token.service.ts`

```typescript
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '~/db/connection.js';
import * as schema from '~/db/schema/index.js';

// Zod スキーマ
export const CreateApiTokenSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1),
  expiresAt: z.string().datetime().optional(),
});

export const ListApiTokensSchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'expired', 'revoked', 'all']).default('active'),
});

// 型定義
export type CreateApiTokenInput = z.infer<typeof CreateApiTokenSchema>;
export type ListApiTokensInput = z.infer<typeof ListApiTokensSchema>;

/**
 * APIトークン生成（形式: drmtok_<32文字ランダム>）
 *
 * @returns 生成されたトークン文字列
 */
export function generateApiToken(): string {
  // 実装: crypto.randomBytes(24).toString('base64url')でランダム文字列生成
  // 形式: drmtok_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
}

/**
 * APIトークン作成
 *
 * @param tenantId - テナントID
 * @param userId - 作成ユーザーID
 * @param input - トークン作成情報
 * @returns トークン情報（生トークン含む）
 */
export async function createApiToken(
  tenantId: string,
  userId: string,
  input: CreateApiTokenInput
): Promise<{
  tokenId: string;
  name: string;
  token: string;
  tokenPrefix: string;
  scopes: string[];
  createdAt: Date;
  expiresAt: Date | null;
}> {
  // 実装:
  // 1. generateApiToken()でトークン生成
  // 2. token_prefix = token.substring(0, 16) (先頭16文字)
  // 3. token_hash = SHA256(token)
  // 4. withTenantContext()でDB保存
  // 5. 生トークンを含むレスポンス返却
}

/**
 * APIトークン一覧取得
 *
 * @param tenantId - テナントID
 * @param input - フィルタ・ページネーション情報
 * @returns トークン一覧とページネーション情報
 */
export async function listApiTokens(
  tenantId: string,
  input: ListApiTokensInput
): Promise<{
  items: Array<{
    tokenId: string;
    name: string;
    tokenPrefix: string;
    scopes: string[];
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    revokedAt: Date | null;
    status: 'active' | 'expired' | 'revoked';
  }>;
  total: number;
  page: number;
  perPage: number;
}> {
  // 実装:
  // 1. withTenantContext()でDBクエリ
  // 2. statusフィルタ適用
  //    - active: revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
  //    - expired: revoked_at IS NULL AND expires_at <= NOW()
  //    - revoked: revoked_at IS NOT NULL
  //    - all: すべて
  // 3. ページネーション適用
  // 4. status判定ロジック追加
}

/**
 * APIトークン詳細取得
 *
 * @param tenantId - テナントID
 * @param tokenId - トークンID
 * @returns トークン詳細情報
 */
export async function getApiToken(
  tenantId: string,
  tokenId: string
): Promise<{
  tokenId: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: string;
  revokedAt: Date | null;
  status: 'active' | 'expired' | 'revoked';
} | null> {
  // 実装: withTenantContext()でDB取得
}

/**
 * APIトークン無効化
 *
 * @param tenantId - テナントID
 * @param tokenId - トークンID
 * @returns 無効化成功フラグ
 */
export async function revokeApiToken(
  tenantId: string,
  tokenId: string
): Promise<boolean> {
  // 実装:
  // 1. withTenantContext()でrevoked_at = NOW()に更新
  // 2. 物理削除ではなく論理削除
}

/**
 * APIトークン検証
 *
 * @param token - 検証対象トークン
 * @returns トークン情報（検証成功時）またはnull（検証失敗時）
 */
export async function verifyApiToken(token: string): Promise<{
  tokenId: string;
  tenantId: string;
  scopes: string[];
} | null> {
  // 実装:
  // 1. token_hash = SHA256(token)
  // 2. DBから該当トークン検索（テナントコンテキストなし、グローバル検索）
  // 3. 以下をチェック:
  //    - revoked_at IS NULL
  //    - expires_at IS NULL OR expires_at > NOW()
  // 4. 検証成功時はトークン情報返却
}

/**
 * 最終使用日時更新
 *
 * @param tokenId - トークンID
 */
export async function updateLastUsedAt(tokenId: string): Promise<void> {
  // 実装:
  // 1. last_used_at = NOW()に更新
  // 2. テナントコンテキストなしで実行（verifyApiToken後に呼ばれる前提）
}
```

## API実装

### ファイル: `core/app/routes/api.api-tokens.ts` (一覧・作成)

```typescript
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/services/auth.service.js';
import {
  createApiToken,
  listApiTokens,
  CreateApiTokenSchema,
  ListApiTokensSchema,
} from '~/services/api-token.service.js';

/**
 * GET /api/api-tokens - トークン一覧取得
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // 実装:
  // 1. requireAuth()で認証
  // 2. URLSearchParamsからクエリパラメータ取得
  // 3. ListApiTokensSchema検証
  // 4. listApiTokens()呼び出し
  // 5. JSON返却
}

/**
 * POST /api/api-tokens - トークン作成
 */
export async function action({ request }: ActionFunctionArgs) {
  // 実装:
  // 1. requireAuth()で認証
  // 2. request.json()でボディ取得
  // 3. CreateApiTokenSchema検証
  // 4. createApiToken()呼び出し
  // 5. JSON返却（生トークン含む）
}
```

### ファイル: `core/app/routes/api.api-tokens_.$id.ts` (詳細・削除)

```typescript
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/services/auth.service.js';
import {
  getApiToken,
  revokeApiToken,
} from '~/services/api-token.service.js';

/**
 * GET /api/api-tokens/:id - トークン詳細取得
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  // 実装:
  // 1. requireAuth()で認証
  // 2. getApiToken()呼び出し
  // 3. 存在チェック
  // 4. JSON返却
}

/**
 * DELETE /api/api-tokens/:id - トークン無効化
 */
export async function action({ request, params }: ActionFunctionArgs) {
  // 実装:
  // 1. requireAuth()で認証
  // 2. revokeApiToken()呼び出し
  // 3. JSON返却
}
```

## テスト設計

### 単体テスト: `core/services/api-token.service.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateApiToken,
  createApiToken,
  listApiTokens,
  getApiToken,
  revokeApiToken,
  verifyApiToken,
  updateLastUsedAt,
} from './api-token.service.js';

describe('API Token Service', () => {
  describe('generateApiToken', () => {
    it('should generate token with drmtok_ prefix', () => {
      // トークン生成確認
    });

    it('should generate unique tokens', () => {
      // ユニーク性確認
    });
  });

  describe('createApiToken', () => {
    it('should create token successfully', async () => {
      // トークン作成成功
    });

    it('should throw error for duplicate name', async () => {
      // 重複名エラー
    });

    it('should validate scopes', async () => {
      // スコープバリデーション
    });
  });

  describe('listApiTokens', () => {
    it('should list active tokens', async () => {
      // アクティブトークン一覧
    });

    it('should filter by status', async () => {
      // ステータスフィルタ
    });

    it('should paginate results', async () => {
      // ページネーション
    });
  });

  describe('verifyApiToken', () => {
    it('should verify valid token', async () => {
      // 有効トークン検証成功
    });

    it('should reject expired token', async () => {
      // 期限切れトークン拒否
    });

    it('should reject revoked token', async () => {
      // 無効化トークン拒否
    });

    it('should reject invalid token', async () => {
      // 不正トークン拒否
    });
  });

  describe('revokeApiToken', () => {
    it('should revoke token', async () => {
      // トークン無効化
    });

    it('should not affect other tokens', async () => {
      // 他トークン影響なし
    });
  });

  describe('updateLastUsedAt', () => {
    it('should update last used timestamp', async () => {
      // 最終使用日時更新
    });
  });
});
```

### APIテスト: `core/app/routes/api.api-tokens.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('API Token API', () => {
  describe('POST /api/api-tokens', () => {
    it('should create token with valid input', async () => {
      // トークン作成成功
    });

    it('should return 401 for unauthenticated request', async () => {
      // 未認証エラー
    });

    it('should validate input schema', async () => {
      // 入力検証
    });
  });

  describe('GET /api/api-tokens', () => {
    it('should list tokens with pagination', async () => {
      // 一覧取得＋ページネーション
    });

    it('should filter by status', async () => {
      // ステータスフィルタ
    });
  });

  describe('GET /api/api-tokens/:id', () => {
    it('should return token details', async () => {
      // 詳細取得
    });

    it('should return 404 for non-existent token', async () => {
      // 存在しないトークン
    });
  });

  describe('DELETE /api/api-tokens/:id', () => {
    it('should revoke token', async () => {
      // トークン無効化
    });

    it('should return 404 for non-existent token', async () => {
      // 存在しないトークン
    });
  });
});
```

## セキュリティ考慮事項

1. **トークン生成**
   - `crypto.randomBytes()`で暗号学的に安全な乱数使用
   - 十分な長さ（32文字）確保

2. **トークン保存**
   - 生トークンは保存しない（SHA256ハッシュのみ）
   - 生トークンは作成時のみ返却（再表示不可）

3. **トークン検証**
   - ハッシュ比較（タイミング攻撃対策）
   - 有効期限チェック
   - 無効化フラグチェック

4. **RLS（Row Level Security）**
   - テナント分離（tenant_id基準）
   - 他テナントのトークンアクセス不可

5. **監査ログ**
   - 作成者記録（created_by）
   - 最終使用日時記録（last_used_at）
   - 無効化日時記録（revoked_at）

## 完了条件

- [ ] データベーススキーマ作成（migration 0013）
- [ ] サービス層実装（`api-token.service.ts`）
- [ ] API実装（`api.api-tokens.ts`, `api.api-tokens_.$id.ts`）
- [ ] 単体テスト実装（20+ tests）
- [ ] すべてのテストがパス（`pnpm test`）
- [ ] 型チェックがパス（`pnpm typecheck`）

## 次のタスクへの接続

- **Task 8.17**: APIトークン管理UIの実装（本タスクのAPI使用）
- **Task 8.18**: APIトークンを使ったWebhook認証の実装（`verifyApiToken()`使用）

## 実装時の注意事項

1. **トークンプレフィックス**
   - `drmtok_`で始まる（8文字 + 32文字 = 40文字）
   - プレフィックスはDB保存時に先頭16文字を保存（`drmtok_12345678`）

2. **ハッシュアルゴリズム**
   - SHA256使用（`crypto.createHash('sha256').update(token).digest('hex')`）

3. **スコープ**
   - 初期実装では`webhook:write`のみサポート
   - 将来的に拡張可能な設計

4. **有効期限**
   - オプション（`expires_at`がnullなら無期限）
   - 期限切れでも`revoked_at`がnullなら論理的には存在

5. **ページネーション**
   - デフォルト: page=1, perPage=20
   - 最大perPage=100

6. **ステータス判定**
   - `active`: `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`
   - `expired`: `revoked_at IS NULL AND expires_at <= NOW()`
   - `revoked`: `revoked_at IS NOT NULL`
