# Task 5.3: 短縮URL機能実装

**担当者**: Claude Code
**推定時間**: 3時間
**依存タスク**: Task 5.1（Campaign Service）、Task 4.4（Activity Service）
**完了条件**: 短縮URLが機能し、クリック数がactivitiesテーブルに記録される

---

## 概要

短縮URL（Shortlink）機能を実装し、キャンペーンのクリック追跡を可能にする。

### 主要機能

1. **短縮URL管理（CRUD）**
   - Campaign/Resourceに紐づく短縮URLを生成・管理
   - nanoidで短くURL-safeなキーを生成（例: `abcd1234`）
   - url/keyはアップデート可能（ドメインを通じてユニーク）
   - UTMパラメータを属性として保存

2. **クリック追跡（activitiesテーブル使用）**
   - 短縮URLがクリックされた際に**activitiesテーブル**に記録
   - `action="click"`, `source="shortlink"` で識別
   - どのキャンペーン・リソース（ブログ記事等）のクリックか記録
   - developer_id, account_id, anon_id で識別
   - metadata に shortlink_id, user_agent, referer, ip_address 含める

3. **リダイレクト処理**
   - `/c/{key}` でアクセスされた際にターゲットURLへリダイレクト
   - リダイレクト前にactivitiesテーブルに記録

---

## データベーススキーマ

### 1. shortlinks テーブル（既存、更新あり）

Task 3.2で既に実装済みだが、`updated_at`カラムを追加する必要がある（url/key更新時のトラッキング用）。

```typescript
// core/db/schema/plugins.ts (既存スキーマ + updated_at追加)
export const shortlinks = pgTable('shortlinks', {
  shortlinkId: uuid('shortlink_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  key: text('key').notNull(),                    // 短縮キー (例: "abcd1234") - UPDATE可能
  targetUrl: text('target_url').notNull(),        // リダイレクト先URL - UPDATE可能
  campaignId: uuid('campaign_id').references(() => campaigns.campaignId, { onDelete: 'set null' }),
  resourceId: uuid('resource_id').references(() => resources.resourceId, { onDelete: 'set null' }),
  attributes: jsonb('attributes'),                // UTMパラメータ等 - UPDATE可能
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(), // 追加
}, (t) => ({
  keyUnique: unique('shortlinks_tenant_key_unique').on(t.tenantId, t.key),
}));
```

**マイグレーション**: `updated_at` カラム追加が必要。

---

### 2. activities テーブル（既存、活用）

Task 4.4で既に実装済み。クリックイベントはこのテーブルに記録する。

```typescript
// core/db/schema/activities.ts (既存スキーマ、変更なし)
export const activities = pgTable('activities', {
  activityId: uuid('activity_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  developerId: uuid('developer_id').references(() => developers.developerId, { onDelete: 'set null' }),
  accountId: uuid('account_id').references(() => accounts.accountId, { onDelete: 'set null' }),
  anonId: text('anon_id'),
  action: text('action').notNull(),              // "click" for shortlink clicks
  source: text('source').notNull(),              // "shortlink" for shortlink clicks
  resourceId: uuid('resource_id').references(() => resources.resourceId, { onDelete: 'set null' }),
  metadata: jsonb('metadata'),                   // { shortlink_id, user_agent, referer, ip_address }
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  value: numeric('value'),                       // Monetary value (optional)
  confidence: numeric('confidence').notNull().default('1.0'),
  dedupKey: text('dedup_key').unique(),
});
```

#### クリックイベントの記録仕様

- **action**: `"click"`
- **source**: `"shortlink"`
- **metadata**: `{ shortlink_id, campaign_id, user_agent, referer, ip_address }`
- **resourceId**: shortlinkのresource_id（ブログ記事等を識別）
- **dedupKey**: `"click:{shortlink_id}:{anon_id || developer_id}:{timestamp}"` （重複防止）

**マイグレーション**: 不要（activitiesテーブルは既に存在）

---

## サービス関数定義

### Shortlink Service（CRUD操作）

#### 1. createShortlink()

短縮URLを生成し、shortlinksテーブルに登録する。

```typescript
// core/services/shortlink.service.ts

import { z } from 'zod';

/**
 * Create Shortlink Schema
 *
 * Input validation for createShortlink() function.
 *
 * Fields:
 * - targetUrl: Destination URL (required)
 * - key: Custom key for shortlink (optional, default: auto-generated with nanoid)
 * - campaignId: UUID of the campaign (optional)
 * - resourceId: UUID of the resource (optional)
 * - attributes: UTM parameters and other metadata (optional)
 */
export const CreateShortlinkSchema = z.object({
  targetUrl: z.string().url(),
  key: z.string().min(4).max(20).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  campaignId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

export type CreateShortlink = z.infer<typeof CreateShortlinkSchema>;

/**
 * Shortlink Result
 *
 * Return type for shortlink CRUD operations.
 */
export interface Shortlink {
  shortlinkId: string;
  key: string;
  targetUrl: string;
  shortUrl: string;         // Full short URL (e.g., "https://devcle.com/c/abcd1234")
  campaignId: string | null;
  resourceId: string | null;
  attributes: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create Shortlink
 *
 * Creates a new shortlink and returns the shortlink details.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param input - Shortlink creation parameters
 * @returns Shortlink containing shortlink details
 * @throws {Error} If key already exists (unique constraint violation)
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using CreateShortlinkSchema
 * 2. Generate key using nanoid (if key not provided)
 * 3. Insert into shortlinks table with RLS context
 * 4. Return Shortlink with full short URL
 *
 * Key generation:
 * - Use nanoid with custom alphabet (URL-safe: a-zA-Z0-9_-)
 * - Default length: 8 characters
 * - Example: "abcd1234", "XyZ_9876"
 *
 * Unique constraint handling:
 * - If key already exists, retry with new key (max 3 retries)
 * - If custom key provided and exists, throw error immediately (409 Conflict)
 *
 * Example:
 * ```typescript
 * const shortlink = await createShortlink('default', {
 *   targetUrl: 'https://example.com/blog/post-123',
 *   campaignId: 'campaign-uuid',
 *   resourceId: 'resource-uuid',
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
export async function createShortlink(
  tenantId: string,
  input: CreateShortlink
): Promise<Shortlink> {
  // Implementation: Validate input, generate key with nanoid, insert into DB
  // ...
}
```

---

#### 2. getShortlink()

shortlink_id または key で短縮URLを取得する。

```typescript
/**
 * Get Shortlink by ID
 *
 * Retrieves a shortlink by its UUID.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param shortlinkId - Shortlink UUID
 * @returns Shortlink if found, null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query shortlinks table filtered by tenant_id and shortlink_id
 * 2. Return null if not found (not an error)
 * 3. Return Shortlink if found
 *
 * Example:
 * ```typescript
 * const shortlink = await getShortlink('default', 'shortlink-uuid');
 * if (!shortlink) {
 *   throw new Error('Shortlink not found');
 * }
 * ```
 */
export async function getShortlink(
  tenantId: string,
  shortlinkId: string
): Promise<Shortlink | null> {
  // Implementation: Query by shortlink_id with RLS
  // ...
}

/**
 * Get Shortlink by Key
 *
 * Retrieves a shortlink by its key.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param key - Shortlink key (e.g., "abcd1234")
 * @returns Shortlink if found, null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query shortlinks table filtered by tenant_id and key
 * 2. Return null if not found (not an error)
 * 3. Return Shortlink if found
 *
 * Example:
 * ```typescript
 * const shortlink = await getShortlinkByKey('default', 'abcd1234');
 * if (!shortlink) {
 *   return Response.json({ error: 'Not found' }, { status: 404 });
 * }
 * ```
 */
export async function getShortlinkByKey(
  tenantId: string,
  key: string
): Promise<Shortlink | null> {
  // Implementation: Query by key with RLS
  // ...
}
```

---

#### 3. listShortlinks()

短縮URL一覧を取得する（ページネーション、フィルタ、ソート対応）。

```typescript
/**
 * List Shortlinks Schema
 *
 * Input validation for listShortlinks() function.
 *
 * Fields:
 * - campaignId: Filter by campaign (optional)
 * - resourceId: Filter by resource (optional)
 * - search: Partial match in key or targetUrl (optional)
 * - limit: Max number of results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - orderBy: Sort field (key, targetUrl, createdAt, updatedAt, clickCount)
 * - orderDirection: Sort direction (asc, desc)
 */
export const ListShortlinksSchema = z.object({
  campaignId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  orderBy: z.enum(['key', 'targetUrl', 'createdAt', 'updatedAt', 'clickCount']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
});

export type ListShortlinks = z.infer<typeof ListShortlinksSchema>;

/**
 * List Shortlinks Result
 *
 * Return type for listShortlinks() function.
 */
export interface ListShortlinksResult {
  shortlinks: Array<Shortlink & { clickCount: number }>;
  total: number;
}

/**
 * List Shortlinks
 *
 * Retrieves a list of shortlinks with pagination, filtering, and sorting.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param input - List parameters
 * @returns List of shortlinks with click counts and total count
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using ListShortlinksSchema
 * 2. Apply default values: limit=50, offset=0, orderBy=createdAt, orderDirection=desc
 * 3. Query shortlinks with filters
 * 4. LEFT JOIN activities to get click count for each shortlink
 *    - JOIN condition: activities.action = 'click' AND activities.source = 'shortlink'
 *    - Extract shortlink_id from metadata: metadata->>'shortlink_id' = shortlinks.shortlink_id
 * 5. Apply sorting and pagination
 * 6. Get total count with COUNT aggregate query
 * 7. Return shortlinks and total
 *
 * Filters:
 * - campaignId: Exact match
 * - resourceId: Exact match
 * - search: ILIKE search in key or targetUrl (case-insensitive)
 *
 * Sorting:
 * - clickCount: Use COUNT(activities.activity_id) for sorting
 *
 * Example:
 * ```typescript
 * const result = await listShortlinks('default', {
 *   campaignId: 'campaign-uuid',
 *   search: 'blog',
 *   limit: 20,
 *   offset: 0,
 *   orderBy: 'clickCount',
 *   orderDirection: 'desc',
 * });
 *
 * console.log(result.shortlinks); // Array of shortlinks with clickCount
 * console.log(result.total); // Total count (not affected by limit/offset)
 * ```
 */
export async function listShortlinks(
  tenantId: string,
  input: ListShortlinks
): Promise<ListShortlinksResult> {
  // Implementation: Query with filters, LEFT JOIN activities, sorting, pagination
  // ...
}
```

---

#### 4. updateShortlink()

短縮URLを更新する（url, key, campaign_id, resource_id, attributes）。

```typescript
/**
 * Update Shortlink Schema
 *
 * Input validation for updateShortlink() function.
 *
 * Fields:
 * - targetUrl: New destination URL (optional)
 * - key: New shortlink key (optional, must be unique within tenant)
 * - campaignId: New campaign ID (optional, null to unset)
 * - resourceId: New resource ID (optional, null to unset)
 * - attributes: New attributes (optional, null to unset)
 *
 * Note: At least one field must be provided.
 */
export const UpdateShortlinkSchema = z.object({
  targetUrl: z.string().url().optional(),
  key: z.string().min(4).max(20).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  campaignId: z.string().uuid().nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
  attributes: z.record(z.string(), z.any()).nullable().optional(),
});

export type UpdateShortlink = z.infer<typeof UpdateShortlinkSchema>;

/**
 * Update Shortlink
 *
 * Updates a shortlink's properties.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param shortlinkId - Shortlink UUID
 * @param input - Fields to update
 * @returns Updated Shortlink
 * @throws {Error} If shortlink not found (404)
 * @throws {Error} If new key already exists (409 Conflict)
 * @throws {Error} If no fields provided for update (400 Bad Request)
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using UpdateShortlinkSchema
 * 2. Check if shortlink exists
 * 3. Check if at least one field is provided (throw error if empty update)
 * 4. If key is being updated, check unique constraint (tenant_id, key)
 * 5. Update shortlinks table with new values and updated_at = NOW()
 * 6. Return updated Shortlink
 *
 * Edge cases:
 * - Empty update (no fields provided): Throw 400 error
 * - Key collision: Throw 409 error with clear message
 * - Shortlink not found: Throw 404 error
 *
 * Example:
 * ```typescript
 * const updated = await updateShortlink('default', 'shortlink-uuid', {
 *   targetUrl: 'https://example.com/new-blog-post',
 *   key: 'newkey123',
 * });
 *
 * console.log(updated.key); // "newkey123"
 * console.log(updated.updatedAt); // New timestamp
 * ```
 */
export async function updateShortlink(
  tenantId: string,
  shortlinkId: string,
  input: UpdateShortlink
): Promise<Shortlink> {
  // Implementation: Validate, check existence, update with RLS
  // ...
}
```

---

#### 5. deleteShortlink()

短縮URLを削除する。

```typescript
/**
 * Delete Shortlink
 *
 * Deletes a shortlink. Associated activities are NOT deleted (event sourcing principle).
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param shortlinkId - Shortlink UUID
 * @returns true if deleted, false if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Execute DELETE with tenant_id and shortlink_id filtering
 * 2. Use RETURNING clause to detect successful deletion
 * 3. Return true if deleted, false if not found
 * 4. Activities with action="click" are NOT deleted (event log preservation)
 *
 * Example:
 * ```typescript
 * const deleted = await deleteShortlink('default', 'shortlink-uuid');
 * if (deleted) {
 *   console.log('Shortlink deleted');
 * } else {
 *   console.log('Shortlink not found');
 * }
 * ```
 */
export async function deleteShortlink(
  tenantId: string,
  shortlinkId: string
): Promise<boolean> {
  // Implementation: DELETE with RETURNING
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
import { getShortlinkByKey } from '~/services/shortlink.service';
import { createActivity } from '~/services/activity.service';

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
 * 4. Create activity record with action="click", source="shortlink"
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
 * Click attribution (via Activity Service):
 * - action: "click"
 * - source: "shortlink"
 * - resourceId: shortlink.resource_id (blog post, etc.)
 * - metadata: { shortlink_id, campaign_id, user_agent, referer, ip_address }
 * - developer_id: set if user is authenticated
 * - anon_id: used for anonymous tracking
 * - dedupKey: "click:{shortlink_id}:{anon_id||developer_id}:{timestamp}"
 *
 * Error handling:
 * - 404: Shortlink not found
 * - 500: Database error (log error, show generic error page)
 * - Click tracking failure: Log error but continue with redirect (don't block user)
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
  // 5. Create activity record using createActivity()
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

#### Shortlink Service

**ファイル**: `core/services/shortlink.service.test.ts`

```typescript
describe('shortlink.service.ts', () => {
  describe('createShortlink()', () => {
    it('should create shortlink with auto-generated key');
    it('should create shortlink with custom key');
    it('should create shortlink with campaign_id');
    it('should create shortlink with resource_id');
    it('should create shortlink with attributes (UTM params)');
    it('should throw error if custom key already exists');
    it('should validate target URL format');
    it('should validate campaign_id UUID format');
  });

  describe('getShortlink()', () => {
    it('should return shortlink if found by ID');
    it('should return null if not found by ID');
    it('should enforce RLS (tenant isolation)');
  });

  describe('getShortlinkByKey()', () => {
    it('should return shortlink if found by key');
    it('should return null if not found by key');
    it('should enforce RLS (tenant isolation)');
  });

  describe('listShortlinks()', () => {
    it('should list all shortlinks');
    it('should filter by campaign_id');
    it('should filter by resource_id');
    it('should search in key and targetUrl');
    it('should paginate with limit/offset');
    it('should sort by clickCount (from activities)');
    it('should include clickCount in results (from activities)');
    it('should enforce RLS (tenant isolation)');
  });

  describe('updateShortlink()', () => {
    it('should update targetUrl');
    it('should update key');
    it('should throw error if new key already exists');
    it('should throw error if empty update');
    it('should throw error if not found');
    it('should update updated_at timestamp');
  });

  describe('deleteShortlink()', () => {
    it('should delete shortlink');
    it('should return false if not found');
    it('should NOT delete associated activities (event log preservation)');
  });
});
```

**最小テスト数**: 26テスト

### 統合テスト（Vitest）

**ファイル**: `core/app/routes/c.$key.test.ts`

```typescript
describe('/c/{key} redirect route', () => {
  it('should redirect to target URL for valid key');
  it('should return 404 for invalid key');
  it('should create activity with action="click", source="shortlink"');
  it('should include shortlink_id and campaign_id in activity metadata');
  it('should set resource_id from shortlink');
  it('should set anon_id cookie if not exists');
  it('should preserve existing anon_id cookie');
  it('should enforce tenant isolation');
});
```

**最小テスト数**: 8テスト

---

## ファイル構造

```
core/
├── db/
│   ├── schema/
│   │   └── plugins.ts                         # Add updated_at to shortlinks
│   └── migrations/
│       └── 0003_xxx.sql                       # Migration for updated_at column
├── services/
│   ├── shortlink.service.ts                   # Barrel file (exports)
│   ├── shortlink.schemas.ts                   # Zod schemas
│   ├── shortlink-create.service.ts            # createShortlink()
│   ├── shortlink-get.service.ts               # getShortlink(), getShortlinkByKey()
│   ├── shortlink-list.service.ts              # listShortlinks()
│   ├── shortlink-update.service.ts            # updateShortlink()
│   ├── shortlink-delete.service.ts            # deleteShortlink()
│   └── shortlink.service.test.ts              # Unit tests (26+ tests)
├── app/
│   └── routes/
│       ├── c.$key.ts                          # Redirect route
│       └── c.$key.test.ts                     # Integration tests (8+ tests)
└── utils/
    └── nanoid.ts                              # Custom nanoid configuration
```

**ファイル行数制限**: 各ファイル150行以下

---

## エラーハンドリング

### エラーケース

1. **短縮URL作成エラー**
   - カスタムキーが既に存在: `409 Conflict`
   - 無効なURL形式: `400 Bad Request`
   - 無効なUUID形式（campaign_id/resource_id）: `400 Bad Request`

2. **短縮URL更新エラー**
   - 短縮URLが見つからない: `404 Not Found`
   - 新しいキーが既に存在: `409 Conflict`
   - 更新フィールドが空: `400 Bad Request`

3. **リダイレクトエラー**
   - 短縮URLが見つからない: `404 Not Found`
   - データベースエラー: `500 Internal Server Error`（エラーログ記録）

4. **クリック追跡エラー**
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
- 他テナントの短縮URL・クリックデータにアクセス不可

---

## パフォーマンス最適化

### 1. キャッシュ戦略

- shortlinks テーブルのキャッシュ（Redis）
  - キー: `shortlink:{tenant_id}:{key}`
  - TTL: 1時間
  - リダイレクト前にキャッシュから取得

### 2. インデックス

- shortlinks:
  - `(tenant_id, key)` unique index（既に存在）
  - `(tenant_id, campaign_id)` index（Campaign別集計用）
- activities:
  - `(tenant_id, action, source)` index（click counting用）
  - metadata->>'shortlink_id' GIN index（shortlink別集計用）

---

## 実装順序

### フェーズ1: スキーマとマイグレーション
1. **shortlinks に updated_at 追加**（core/db/schema/plugins.ts）
2. **マイグレーション生成・適用**（pnpm db:migrate:generate, pnpm db:migrate）

### フェーズ2: Shortlink Service
3. **nanoid設定**（core/utils/nanoid.ts）
4. **Zodスキーマ定義**（core/services/shortlink.schemas.ts）
5. **createShortlink()実装**（core/services/shortlink-create.service.ts）
6. **getShortlink()実装**（core/services/shortlink-get.service.ts）
7. **listShortlinks()実装**（core/services/shortlink-list.service.ts）
8. **updateShortlink()実装**（core/services/shortlink-update.service.ts）
9. **deleteShortlink()実装**（core/services/shortlink-delete.service.ts）
10. **Barrel fileエクスポート**（core/services/shortlink.service.ts）
11. **ユニットテスト**（core/services/shortlink.service.test.ts - 26テスト）

### フェーズ3: Redirect Route
12. **リダイレクトルート実装**（core/app/routes/c.$key.ts）
13. **統合テスト**（core/app/routes/c.$key.test.ts - 8テスト）

### フェーズ4: 最終確認
14. **TypeScriptエラー解消・型チェック**
15. **全テスト実行・確認**（34テスト以上）

---

## 完了条件

- [x] ドキュメント作成完了
- [ ] shortlinks.updated_at カラム追加完了（マイグレーション）
- [ ] nanoid設定完了
- [ ] Shortlink Service実装完了（CRUD 5関数）
- [ ] Shortlink Service テスト完了（26テスト以上、全てパス）
- [ ] リダイレクトルート実装完了
- [ ] リダイレクトルートテスト完了（8テスト以上、全てパス）
- [ ] TypeScriptエラーゼロ（`pnpm typecheck`パス）
- [ ] 短縮URLが機能し、クリック数がactivitiesテーブルに記録される

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

### Drizzle ORM

- LEFT JOIN for click counts: https://orm.drizzle.team/docs/joins
- JSONB queries: https://orm.drizzle.team/docs/select#filtering
