# Task 5.3: 短縮URL機能実装

**担当者**: Claude Code
**推定時間**: 3時間
**依存タスク**: Task 5.1（Campaign Service）
**完了条件**: 短縮URLが機能し、クリック数がカウントされる

---

## 概要

短縮URL（Shortlink）機能を実装し、キャンペーンのクリック追跡を可能にする。

### 主要機能

1. **短縮URL生成**
   - Campaign/Resourceに紐づく短縮URLを生成
   - nanoidで短くURL-safeなキーを生成（例: `abcd1234`）
   - UTMパラメータを属性として保存

2. **クリック追跡**
   - 短縮URLがクリックされた際にActivityを作成
   - `action="click"`, `source="shortlink"`でActivity登録
   - metadataに `shortlink_id` を含める

3. **リダイレクト処理**
   - `/c/{key}` でアクセスされた際にターゲットURLへリダイレクト
   - リダイレクト前にクリックイベントを記録

---

## データベーススキーマ

### shortlinks テーブル（既存）

Task 3.2で既に実装済み。`core/db/schema/plugins.ts` に定義されている。

```typescript
// core/db/schema/plugins.ts (既存スキーマ)
export const shortlinks = pgTable('shortlinks', {
  shortlinkId: uuid('shortlink_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  key: text('key').notNull(),                    // 短縮キー (例: "abcd1234")
  targetUrl: text('target_url').notNull(),        // リダイレクト先URL
  campaignId: uuid('campaign_id').references(() => campaigns.campaignId, { onDelete: 'set null' }),
  resourceId: uuid('resource_id').references(() => resources.resourceId, { onDelete: 'set null' }),
  attributes: jsonb('attributes'),                // UTMパラメータ等
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  keyUnique: unique('shortlinks_tenant_key_unique').on(t.tenantId, t.key),
}));
```

**重要**: 新規マイグレーションは不要（既にテーブルが存在）。

---

## サービス関数定義

### 1. generateShortURL()

短縮URLを生成し、shortlinksテーブルに登録する。

```typescript
// core/services/shortlink.service.ts

import { z } from 'zod';

/**
 * Generate Short URL Schema
 *
 * Input validation for generateShortURL() function.
 *
 * Fields:
 * - targetUrl: Destination URL (required)
 * - campaignId: UUID of the campaign (optional)
 * - resourceId: UUID of the resource (optional)
 * - attributes: UTM parameters and other metadata (optional)
 * - customKey: Custom key for shortlink (optional, default: auto-generated with nanoid)
 */
export const GenerateShortURLSchema = z.object({
  targetUrl: z.string().url(),
  campaignId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  attributes: z.record(z.string(), z.any()).optional(),
  customKey: z.string().min(4).max(20).regex(/^[a-zA-Z0-9_-]+$/).optional(),
});

export type GenerateShortURL = z.infer<typeof GenerateShortURLSchema>;

/**
 * Generate Short URL Result
 *
 * Return type for generateShortURL() function.
 */
export interface ShortlinkResult {
  shortlinkId: string;      // UUID of the shortlink
  key: string;              // Short key (e.g., "abcd1234")
  targetUrl: string;        // Destination URL
  shortUrl: string;         // Full short URL (e.g., "https://devcle.com/c/abcd1234")
  campaignId: string | null;
  resourceId: string | null;
  attributes: Record<string, any> | null;
  createdAt: Date;
}

/**
 * Generate Short URL
 *
 * Creates a new shortlink and returns the short URL.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param input - Short URL generation parameters
 * @returns ShortlinkResult containing shortlink details
 * @throws {Error} If custom key already exists (unique constraint violation)
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using GenerateShortURLSchema
 * 2. Generate key using nanoid (if customKey not provided)
 * 3. Insert into shortlinks table with RLS context
 * 4. Return ShortlinkResult with full short URL
 *
 * Key generation:
 * - Use nanoid with custom alphabet (URL-safe: a-zA-Z0-9_-)
 * - Default length: 8 characters
 * - Example: "abcd1234", "XyZ_9876"
 *
 * Unique constraint handling:
 * - If key already exists, retry with new key (max 3 retries)
 * - If customKey provided and exists, throw error immediately
 *
 * Example:
 * ```typescript
 * const shortlink = await generateShortURL('default', {
 *   targetUrl: 'https://example.com/blog/post-123',
 *   campaignId: 'campaign-uuid',
 *   attributes: {
 *     utm_source: 'twitter',
 *     utm_medium: 'social',
 *     utm_campaign: 'spring-2025',
 *   },
 * });
 *
 * console.log(shortlink.shortUrl); // "https://devcle.com/c/abcd1234"
 * ```
 */
export async function generateShortURL(
  tenantId: string,
  input: GenerateShortURL
): Promise<ShortlinkResult> {
  // Implementation: Validate input, generate key with nanoid, insert into DB
  // ...
}
```

---

### 2. getShortlink()

shortlink_id または key で短縮URLを取得する。

```typescript
/**
 * Get Shortlink by Key
 *
 * Retrieves a shortlink by its key.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param key - Shortlink key (e.g., "abcd1234")
 * @returns ShortlinkResult if found, null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query shortlinks table filtered by tenant_id and key
 * 2. Return null if not found (not an error)
 * 3. Return ShortlinkResult if found
 *
 * Example:
 * ```typescript
 * const shortlink = await getShortlinkByKey('default', 'abcd1234');
 * if (!shortlink) {
 *   return Response.redirect('/404', 404);
 * }
 * ```
 */
export async function getShortlinkByKey(
  tenantId: string,
  key: string
): Promise<ShortlinkResult | null> {
  // Implementation: Query by key with RLS
  // ...
}
```

---

### 3. trackClick()

短縮URLがクリックされた際にActivityを作成する。

```typescript
/**
 * Track Click Event Schema
 *
 * Input validation for trackClick() function.
 *
 * Fields:
 * - shortlinkId: UUID of the shortlink (required)
 * - developerId: UUID of the developer (optional, if authenticated)
 * - accountId: UUID of the account (optional, if resolved)
 * - anonId: Anonymous ID from cookie/fingerprint (optional)
 * - userAgent: User agent string (optional)
 * - referer: Referer URL (optional)
 * - ipAddress: IP address (optional, for analytics)
 */
export const TrackClickSchema = z.object({
  shortlinkId: z.string().uuid(),
  developerId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  anonId: z.string().optional(),
  userAgent: z.string().optional(),
  referer: z.string().url().optional(),
  ipAddress: z.string().ip().optional(),
});

export type TrackClick = z.infer<typeof TrackClickSchema>;

/**
 * Track Click Event
 *
 * Creates an activity record for a shortlink click.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param input - Click tracking parameters
 * @returns Activity ID of the created activity
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using TrackClickSchema
 * 2. Create activity with:
 *    - action: "click"
 *    - source: "shortlink"
 *    - metadata: { shortlink_id, user_agent, referer, ip_address }
 *    - developer_id, account_id, anon_id: from input
 * 3. Use createActivity() from activity.service.ts
 * 4. Return activity_id
 *
 * Deduplication:
 * - Use dedup_key: `click:{shortlinkId}:{anonId}:{timestamp}`
 * - Prevents duplicate clicks within 5 minutes
 *
 * Example:
 * ```typescript
 * const activityId = await trackClick('default', {
 *   shortlinkId: 'shortlink-uuid',
 *   anonId: 'anon-123456',
 *   userAgent: 'Mozilla/5.0...',
 *   referer: 'https://twitter.com/...',
 *   ipAddress: '192.168.1.1',
 * });
 * ```
 */
export async function trackClick(
  tenantId: string,
  input: TrackClick
): Promise<string> {
  // Implementation: Create activity with action="click", source="shortlink"
  // ...
}
```

---

## Remix Resource Route実装

### リダイレクトルート: `/c/{key}`

```typescript
// core/app/routes/c.$key.ts

import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { getShortlinkByKey, trackClick } from '~/services/shortlink.service';

/**
 * Shortlink Redirect Route
 *
 * Handles shortlink redirects and click tracking.
 *
 * URL: /c/{key}
 * Method: GET
 *
 * Flow:
 * 1. Extract key from URL params
 * 2. Lookup shortlink by key
 * 3. If not found, return 404
 * 4. Track click event (create activity)
 * 5. Redirect to target URL
 *
 * Tenant resolution:
 * - Extract tenant from request hostname (e.g., "example.devcle.com" → "example")
 * - Default to "default" tenant for devcle.com
 *
 * Anonymous tracking:
 * - Read anon_id from cookie (if exists)
 * - Generate new anon_id if not exists (using nanoid)
 * - Set anon_id cookie with 1-year expiration
 *
 * Error handling:
 * - 404: Shortlink not found
 * - 500: Database error (log error, show generic error page)
 *
 * Example:
 * ```
 * GET /c/abcd1234
 * → Lookup shortlink with key "abcd1234"
 * → Create activity with action="click", source="shortlink"
 * → Redirect to target URL
 * ```
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  // Implementation:
  // 1. Extract key from params
  // 2. Extract tenant from hostname
  // 3. Get shortlink by key
  // 4. Extract anon_id from cookie or generate new one
  // 5. Track click event
  // 6. Redirect to target URL with Set-Cookie header
  // ...
}
```

---

## nanoid設定

### カスタムアルファベット

```typescript
// core/utils/nanoid.ts

import { customAlphabet } from 'nanoid';

/**
 * URL-safe Alphabet
 *
 * Custom alphabet for nanoid:
 * - Excludes similar-looking characters: 0/O, 1/l/I
 * - URL-safe: a-z, A-Z, 2-9, _, -
 *
 * Total characters: 60
 */
const SHORTLINK_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz_-';

/**
 * Default shortlink key length
 *
 * 8 characters with 60-character alphabet:
 * - Collision probability: ~1 in 168 billion (60^8)
 * - Sufficient for up to 100 million shortlinks
 */
const SHORTLINK_KEY_LENGTH = 8;

/**
 * Generate Shortlink Key
 *
 * Generates a random URL-safe key using nanoid.
 *
 * @returns Random key (e.g., "abcd1234", "XyZ_9876")
 *
 * Example:
 * ```typescript
 * const key = generateShortlinkKey(); // "abcd1234"
 * ```
 */
export const generateShortlinkKey = customAlphabet(
  SHORTLINK_ALPHABET,
  SHORTLINK_KEY_LENGTH
);
```

---

## テスト計画

### ユニットテスト（Vitest）

**ファイル**: `core/services/shortlink.service.test.ts`

```typescript
describe('shortlink.service.ts', () => {
  describe('generateShortURL()', () => {
    it('should generate shortlink with auto-generated key');
    it('should generate shortlink with custom key');
    it('should generate shortlink with campaign_id');
    it('should generate shortlink with resource_id');
    it('should generate shortlink with attributes (UTM params)');
    it('should throw error if custom key already exists');
    it('should validate target URL format');
    it('should validate campaign_id UUID format');
  });

  describe('getShortlinkByKey()', () => {
    it('should return shortlink if found');
    it('should return null if not found');
    it('should enforce RLS (tenant isolation)');
  });

  describe('trackClick()', () => {
    it('should create activity with action="click"');
    it('should include shortlink_id in metadata');
    it('should include user_agent in metadata');
    it('should include referer in metadata');
    it('should handle anonymous clicks (anon_id only)');
    it('should handle authenticated clicks (developer_id)');
    it('should use deduplication key');
  });
});
```

**最小テスト数**: 15テスト

### 統合テスト（Vitest）

**ファイル**: `core/app/routes/c.$key.test.ts`

```typescript
describe('/c/{key} redirect route', () => {
  it('should redirect to target URL for valid key');
  it('should return 404 for invalid key');
  it('should create activity on redirect');
  it('should set anon_id cookie if not exists');
  it('should preserve existing anon_id cookie');
  it('should enforce tenant isolation');
});
```

**最小テスト数**: 6テスト

---

## ファイル構造

```
core/
├── services/
│   ├── shortlink.service.ts              # Barrel file (exports)
│   ├── shortlink.schemas.ts              # Zod schemas
│   ├── shortlink-generate.service.ts     # generateShortURL()
│   ├── shortlink-get.service.ts          # getShortlinkByKey()
│   ├── shortlink-track.service.ts        # trackClick()
│   └── shortlink.service.test.ts         # Unit tests (15+ tests)
├── app/
│   └── routes/
│       ├── c.$key.ts                     # Redirect route
│       └── c.$key.test.ts                # Integration tests (6+ tests)
└── utils/
    └── nanoid.ts                         # Custom nanoid configuration
```

**ファイル行数制限**: 各ファイル150行以下

---

## エラーハンドリング

### エラーケース

1. **短縮URL生成エラー**
   - カスタムキーが既に存在: `409 Conflict`
   - 無効なURL形式: `400 Bad Request`
   - 無効なUUID形式（campaign_id/resource_id）: `400 Bad Request`

2. **リダイレクトエラー**
   - 短縮URLが見つからない: `404 Not Found`
   - データベースエラー: `500 Internal Server Error`（エラーログ記録）

3. **クリック追跡エラー**
   - クリック追跡失敗時もリダイレクトは継続（クリックデータの損失を最小化）
   - エラーログに記録

---

## セキュリティ考慮事項

### 1. Open Redirect対策

- targetUrl のバリデーション:
  - 許可するスキーム: `https://`, `http://` のみ
  - `javascript:`, `data:`, `file:` 等は禁止
  - ホワイトリストによる検証（オプション）

### 2. Rate Limiting

- 同一IPからの短縮URL生成を制限（例: 10件/分）
- 同一IPからのリダイレクトを制限（例: 100件/分）

### 3. RLS（Row Level Security）

- テナント分離を徹底
- 他テナントの短縮URLにアクセス不可

---

## パフォーマンス最適化

### 1. キャッシュ戦略

- shortlinks テーブルのキャッシュ（Redis）
  - キー: `shortlink:{tenant_id}:{key}`
  - TTL: 1時間
  - リダイレクト前にキャッシュから取得

### 2. インデックス

- `(tenant_id, key)` に unique index（既に存在）
- `(tenant_id, campaign_id)` に index（Campaign別集計用）

---

## 実装順序

1. **nanoid設定**（core/utils/nanoid.ts）
2. **Zodスキーマ定義**（core/services/shortlink.schemas.ts）
3. **generateShortURL()実装**（core/services/shortlink-generate.service.ts）
4. **getShortlinkByKey()実装**（core/services/shortlink-get.service.ts）
5. **trackClick()実装**（core/services/shortlink-track.service.ts）
6. **Barrel fileエクスポート**（core/services/shortlink.service.ts）
7. **ユニットテスト**（core/services/shortlink.service.test.ts）
8. **リダイレクトルート実装**（core/app/routes/c.$key.ts）
9. **統合テスト**（core/app/routes/c.$key.test.ts）
10. **TypeScriptエラー解消・型チェック**
11. **全テスト実行・確認**

---

## 完了条件

- [x] ドキュメント作成完了
- [ ] nanoid設定完了
- [ ] generateShortURL()実装完了
- [ ] getShortlinkByKey()実装完了
- [ ] trackClick()実装完了
- [ ] リダイレクトルート実装完了
- [ ] ユニットテスト15件以上作成・全てパス
- [ ] 統合テスト6件以上作成・全てパス
- [ ] TypeScriptエラーゼロ（`pnpm typecheck`パス）
- [ ] 短縮URLが機能し、クリック数がカウントされる

---

## 参考情報

### nanoid

- 公式ドキュメント: https://github.com/ai/nanoid
- URL-safe alphabet: https://github.com/ai/nanoid#custom-alphabet-or-size

### Remix Resource Routes

- 公式ドキュメント: https://remix.run/docs/en/main/guides/resource-routes

### Activity Service

- Task 4.4で実装済み: `core/services/activity.service.ts`
- createActivity()を使用してクリックイベントを記録
