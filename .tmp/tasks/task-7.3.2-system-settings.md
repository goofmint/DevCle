# Task 7.3.2: システム設定画面の実装

**Status:** ドキュメント作成完了（実装待ち）
**Priority:** 中
**Estimated Time:** 6時間
**Dependencies:** Task 7.1（ダッシュボードレイアウト）

---

## 概要

DevCleのシステム設定画面を実装する。テナントごとに管理するサービス名、ロゴ、会計年度、タイムゾーン、外部サービス連携設定（S3、SMTP、AI）を行えるようにする。

---

## 目的

- テナントごとに独自のサービス名とロゴを設定可能にする
- 会計年度の期初月を設定し、ROI分析の期間計算に使用する
- タイムゾーン設定により、アクティビティやレポートの日時表示を正確にする
- S3設定によりロゴアップロード機能を有効化する（S3未設定時はURL入力のみ）
- SMTP設定によりメール通知機能を有効化する
- AI設定により将来のAI機能（アトリビューション分析等）を有効化する

---

## データベーススキーマ更新

### `system_settings` テーブル（拡張）

既存の `core/db/schema/admin.ts` に以下のカラムを追加する。

**追加カラム:**

```typescript
export const systemSettings = pgTable('system_settings', {
  tenantId: text('tenant_id').primaryKey().references(() => tenants.tenantId, { onDelete: 'cascade' }),

  // 既存カラム
  baseUrl: text('base_url'),
  smtpSettings: jsonb('smtp_settings'),
  aiSettings: jsonb('ai_settings'),
  shortlinkDomain: text('shortlink_domain'),

  // 新規追加カラム
  serviceName: text('service_name').notNull().default('DevCle'),
  logoUrl: text('logo_url'),
  fiscalYearStartMonth: integer('fiscal_year_start_month').notNull().default(4), // 1-12 (4 = April)
  timezone: text('timezone').notNull().default('Asia/Tokyo'),
  s3Settings: jsonb('s3_settings'), // { bucket, region, accessKeyId, secretAccessKey, endpoint? }

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**各カラムの説明:**

- `service_name`: テナント固有のサービス名（デフォルト: 'DevCle'）
- `logo_url`: ロゴ画像のURL（S3アップロード後のURLまたは外部URL）
- `fiscal_year_start_month`: 会計年度の期初月（1-12、デフォルト: 4 = 4月）
- `timezone`: IANAタイムゾーン（例: 'Asia/Tokyo', 'UTC', 'America/New_York'）
- `s3_settings`: S3接続情報（JSONBオブジェクト）
  ```typescript
  {
    bucket: string;
    region: string;
    accessKeyId: string;      // 暗号化推奨
    secretAccessKey: string;  // 暗号化推奨
    endpoint?: string;        // S3互換サービス用（MinIO等）
  }
  ```
- `smtp_settings`: SMTP接続情報（既存、JSONBオブジェクト）
  ```typescript
  {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;  // 暗号化推奨
    from: string;  // 送信元アドレス
  }
  ```
- `ai_settings`: AI API接続情報（既存、JSONBオブジェクト）
  ```typescript
  {
    provider: 'openai' | 'anthropic' | 'azure-openai';
    apiKey: string;      // 暗号化推奨
    model?: string;      // 例: 'gpt-4', 'claude-3-opus'
    endpoint?: string;   // Azure OpenAI用
  }
  ```

**制約:**
- `tenant_id` はプライマリキー（各テナントに1レコードのみ保証）
- `fiscal_year_start_month` は 1-12 の範囲（CHECK constraint）
- `timezone` は IANA timezone database 形式
- JSONBフィールドの機密情報（API keys, passwords）は暗号化推奨

**注意:**
- `tenantId` が PRIMARY KEY のため、重複レコードは自動的に防止される
- マイグレーションでCHECK constraint追加により、`fiscal_year_start_month`の範囲を強制

**マイグレーション:**

新規マイグレーションファイルを作成:

```sql
-- Migration: Add service branding and integration settings
ALTER TABLE system_settings
  ADD COLUMN service_name TEXT NOT NULL DEFAULT 'DevCle',
  ADD COLUMN logo_url TEXT,
  ADD COLUMN fiscal_year_start_month INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  ADD COLUMN s3_settings JSONB;

-- Add constraint for fiscal_year_start_month (1-12)
ALTER TABLE system_settings
  ADD CONSTRAINT fiscal_year_start_month_range
  CHECK (fiscal_year_start_month >= 1 AND fiscal_year_start_month <= 12);
```

---

## サービス層インターフェース

### `core/services/system-settings.service.ts`

```typescript
import type { SystemSettingsRow } from '~/db/schema/admin.js';

/**
 * S3 settings structure
 */
export interface S3Settings {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
}

/**
 * SMTP settings structure
 */
export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * AI settings structure
 */
export interface AiSettings {
  provider: 'openai' | 'anthropic' | 'azure-openai';
  apiKey: string;
  model?: string;
  endpoint?: string;
}

/**
 * Get system settings for a tenant
 *
 * If no settings exist, returns default values.
 *
 * @param tenantId - Tenant ID
 * @returns System settings
 */
export async function getSystemSettings(
  tenantId: string
): Promise<SystemSettingsRow>;

/**
 * Update system settings for a tenant
 *
 * Creates new settings if none exist (UPSERT).
 *
 * @param tenantId - Tenant ID
 * @param data - Partial system settings data
 * @returns Updated system settings
 */
export async function updateSystemSettings(
  tenantId: string,
  data: Partial<{
    serviceName: string;
    logoUrl: string | null;
    fiscalYearStartMonth: number; // 1-12
    timezone: string;             // IANA timezone
    baseUrl: string | null;
    s3Settings: S3Settings | null;
    smtpSettings: SmtpSettings | null;
    aiSettings: AiSettings | null;
    shortlinkDomain: string | null;
  }>
): Promise<SystemSettingsRow>;

/**
 * Check if S3 is configured for this tenant
 *
 * @param tenantId - Tenant ID
 * @returns true if S3 settings exist and are valid
 */
export async function isS3Configured(tenantId: string): Promise<boolean>;

/**
 * Check if SMTP is configured for this tenant
 *
 * @param tenantId - Tenant ID
 * @returns true if SMTP settings exist and are valid
 */
export async function isSmtpConfigured(tenantId: string): Promise<boolean>;

/**
 * Check if AI is configured for this tenant
 *
 * @param tenantId - Tenant ID
 * @returns true if AI settings exist and are valid
 */
export async function isAiConfigured(tenantId: string): Promise<boolean>;
```

**実装の注意点:**
- `getSystemSettings()` は設定が存在しない場合、デフォルト値を返す（DBに保存はしない）
- `updateSystemSettings()` は UPSERT 操作（ON CONFLICT(tenant_id) DO UPDATE）
- RLS対応: `withTenantContext()` を使用
- バリデーション: Zodスキーマで入力検証
  - `fiscalYearStartMonth`: 整数型で 1-12 の範囲チェック（`.int().min(1).max(12)`）
  - `timezone`: `Intl.supportedValuesOf('timeZone')` で有効なタイムゾーンか検証
  - S3/SMTP/AI設定のJSONB構造をZodで検証
    - S3: bucket/region/accessKeyId/secretAccessKey必須、endpoint任意
    - SMTP: host/port/user/pass/from必須、secure boolean
    - AI: provider/apiKey必須、model/endpoint任意
- **暗号化**: `s3Settings.secretAccessKey`, `smtpSettings.pass`, `aiSettings.apiKey` は暗号化してDB保存
  - 暗号化処理は別モジュール（`core/utils/encryption.ts`）で実装
  - 復号化は取得時に自動実行

---

## API層インターフェース

### `app/routes/api/system-settings.ts`

```typescript
/**
 * GET /api/system-settings
 *
 * Get system settings for the authenticated user's tenant
 *
 * Response:
 * {
 *   "tenantId": "default",
 *   "serviceName": "DevCle",
 *   "logoUrl": "https://example.com/logo.png",
 *   "fiscalYearStartMonth": 4,
 *   "timezone": "Asia/Tokyo",
 *   "baseUrl": "https://devcle.com",
 *   "s3Configured": true,     // boolean flag (hides sensitive data)
 *   "smtpConfigured": true,   // boolean flag (hides sensitive data)
 *   "aiConfigured": false,    // boolean flag (hides sensitive data)
 *   "shortlinkDomain": "go.devcle.com",
 *   "createdAt": "2025-10-19T00:00:00Z",
 *   "updatedAt": "2025-10-19T00:00:00Z"
 * }
 *
 * Note: Sensitive fields (API keys, passwords) are NOT returned.
 * Only boolean flags indicate if they are configured.
 */
export async function loader({ request }: LoaderFunctionArgs): Promise<Response>;

/**
 * PUT /api/system-settings
 *
 * Update system settings for the authenticated user's tenant
 *
 * Request body:
 * {
 *   "serviceName"?: string,
 *   "logoUrl"?: string | null,
 *   "fiscalYearStartMonth"?: number,  // 1-12
 *   "timezone"?: string,              // IANA timezone
 *   "baseUrl"?: string | null,
 *   "s3Settings"?: {
 *     "bucket": string,
 *     "region": string,
 *     "accessKeyId": string,
 *     "secretAccessKey": string,
 *     "endpoint"?: string
 *   } | null,
 *   "smtpSettings"?: {
 *     "host": string,
 *     "port": number,
 *     "secure": boolean,
 *     "user": string,
 *     "pass": string,
 *     "from": string
 *   } | null,
 *   "aiSettings"?: {
 *     "provider": "openai" | "anthropic" | "azure-openai",
 *     "apiKey": string,
 *     "model"?: string,
 *     "endpoint"?: string
 *   } | null,
 *   "shortlinkDomain"?: string | null
 * }
 *
 * Response: Updated system settings (same format as GET, sensitive data hidden)
 *
 * Error codes:
 * - 400: Invalid request body (validation error)
 * - 401: Unauthorized (not authenticated)
 * - 403: Forbidden (not admin role)
 * - 500: Internal server error
 */
export async function action({ request }: ActionFunctionArgs): Promise<Response>;
```

**セキュリティ要件:**
- GET response では機密情報（API keys, passwords）を返さない
- PUT request では平文で受け取り、サービス層で暗号化
- 設定変更は admin ロールのみ許可

---

## UI層インターフェース

### `app/routes/dashboard.settings.tsx`

システム設定画面のUIコンポーネント。

**レイアウト:**
```text
┌─────────────────────────────────────────┐
│ System Settings                         │
├─────────────────────────────────────────┤
│                                         │
│ Basic Settings                          │
│ ┌─────────────────────────────────────┐ │
│ │ Service Name:  [DevCle            ] │ │
│ │                                     │ │
│ │ Logo:                               │ │
│ │   [Upload] or [URL: https://...   ]│ │
│ │   (Upload disabled if S3 not set)  │ │
│ │                                     │ │
│ │ Fiscal Year Start: [April     ▼]   │ │
│ │ Timezone: [Asia/Tokyo         ▼]   │ │
│ │                                     │ │
│ │           [Save Basic Settings]     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Integration Settings                    │
│ ┌─────────────────────────────────────┐ │
│ │ S3 Settings                         │ │
│ │   Bucket:     [my-bucket          ]│ │
│ │   Region:     [ap-northeast-1     ]│ │
│ │   Access Key: [AKIA...           ]│ │
│ │   Secret Key: [••••••••••        ]│ │
│ │   Endpoint:   [optional          ]│ │
│ │   Status: ✅ Configured            │ │
│ │           [Test Connection]         │ │
│ │           [Save S3 Settings]        │ │
│ │                                     │ │
│ │ SMTP Settings                       │ │
│ │   Host:   [smtp.gmail.com        ]│ │
│ │   Port:   [587]  ☑ Use TLS       │ │
│ │   User:   [user@example.com      ]│ │
│ │   Pass:   [••••••••••            ]│ │
│ │   From:   [noreply@devcle.com    ]│ │
│ │   Status: ✅ Configured            │ │
│ │           [Test Connection]         │ │
│ │           [Save SMTP Settings]      │ │
│ │                                     │ │
│ │ AI Settings                         │ │
│ │   Provider: [OpenAI           ▼] │ │
│ │   API Key:  [sk-...              ]│ │
│ │   Model:    [gpt-4 (optional)    ]│ │
│ │   Endpoint: [optional for Azure  ]│ │
│ │   Status: ⚠️ Not configured       │ │
│ │           [Test Connection]         │ │
│ │           [Save AI Settings]        │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

**コンポーネント構造:**

```typescript
export default function SystemSettingsPage() {
  // loader から初期データを取得
  // 各セクションごとに独立したRemix Form
  // バリデーションエラーは action から返される
  // 成功時はトースト通知を表示
}

/**
 * Loader function
 *
 * Fetches system settings for the authenticated user's tenant
 * Requires admin role
 */
export async function loader({ request }: LoaderFunctionArgs): Promise<Response>;

/**
 * Action function
 *
 * Handles form submissions (PUT /api/system-settings)
 * Requires admin role
 */
export async function action({ request }: ActionFunctionArgs): Promise<Response>;
```

**フォーム要素:**

**Basic Settings:**
- **Service Name**: テキスト入力（必須、1-100文字）
- **Logo Upload**: ファイル入力（S3設定済みの場合のみ表示）
- **Logo URL**: テキスト入力（任意、URL形式、S3未設定時のフォールバック）
- **Fiscal Year Start**: セレクトボックス（1月〜12月、デフォルト: 4月）
- **Timezone**: セレクトボックス（`Intl.supportedValuesOf('timeZone')` から生成）

**S3 Settings:**
- **Bucket**: テキスト入力（必須）
- **Region**: テキスト入力（必須、例: `ap-northeast-1`）
- **Access Key ID**: テキスト入力（必須）
- **Secret Access Key**: パスワード入力（必須）
- **Endpoint**: テキスト入力（任意、MinIO等のS3互換サービス用）
- **Test Connection**: ボタン（S3接続テスト）

**SMTP Settings:**
- **Host**: テキスト入力（必須）
- **Port**: 数値入力（必須、デフォルト: 587）
- **Use TLS**: チェックボックス（デフォルト: ON）
- **User**: テキスト入力（必須）
- **Password**: パスワード入力（必須）
- **From**: メール入力（必須）
- **Test Connection**: ボタン（SMTP接続テスト、テストメール送信）

**AI Settings:**
- **Provider**: セレクトボックス（OpenAI, Anthropic, Azure OpenAI）
- **API Key**: パスワード入力（必須）
- **Model**: テキスト入力（任意、例: `gpt-4`, `claude-3-opus`）
- **Endpoint**: テキスト入力（Azure OpenAI用、任意）
- **Test Connection**: ボタン（AI API接続テスト）

**バリデーション:**
- クライアント側: HTML5 form validation + Zod schema
- サーバー側: Zod schema validation in action function
- 接続テスト: 各サービスへの実際の接続確認（Test Connectionボタン）

---

## テスト要件

### E2Eテスト (`e2e/dashboard-settings.spec.ts`)

```typescript
test.describe('System Settings - Basic', () => {
  test('should display system settings page (admin only)', async ({ page }) => {
    // admin ユーザーでログイン後、/dashboard/settings にアクセス
    // フォームが表示されることを確認
  });

  test('should prevent non-admin access', async ({ page }) => {
    // member ユーザーでログイン後、/dashboard/settings にアクセス
    // 403エラーまたはリダイレクトされることを確認
  });

  test('should load existing settings', async ({ page }) => {
    // 設定が既に存在する場合、値がフォームに反映されることを確認
  });

  test('should update service name', async ({ page }) => {
    // サービス名を変更して保存
    // 成功メッセージが表示されることを確認
  });

  test('should update fiscal year', async ({ page }) => {
    // 期初月を変更して保存
    // 成功メッセージが表示されることを確認
  });

  test('should update timezone', async ({ page }) => {
    // タイムゾーンを変更して保存
    // 成功メッセージが表示されることを確認
  });
});

test.describe('System Settings - S3', () => {
  test('should save S3 settings', async ({ page }) => {
    // S3設定を入力して保存
    // 成功メッセージが表示されることを確認
  });

  test('should show upload button when S3 is configured', async ({ page }) => {
    // S3設定後、ロゴアップロードボタンが有効化されることを確認
  });

  test('should test S3 connection', async ({ page }) => {
    // Test Connectionボタンをクリック
    // 接続成功メッセージが表示されることを確認
  });
});

test.describe('System Settings - SMTP', () => {
  test('should save SMTP settings', async ({ page }) => {
    // SMTP設定を入力して保存
    // 成功メッセージが表示されることを確認
  });

  test('should test SMTP connection', async ({ page }) => {
    // Test Connectionボタンをクリック
    // テストメール送信成功メッセージが表示されることを確認
  });
});

test.describe('System Settings - AI', () => {
  test('should save AI settings', async ({ page }) => {
    // AI設定を入力して保存
    // 成功メッセージが表示されることを確認
  });

  test('should test AI connection', async ({ page }) => {
    // Test Connectionボタンをクリック
    // API接続成功メッセージが表示されることを確認
  });
});

test.describe('System Settings - Validation', () => {
  test('should show validation error for invalid fiscal year', async ({ page }) => {
    // 不正な月（0, 13等）を入力
    // エラーメッセージが表示されることを確認
  });

  test('should show validation error for invalid timezone', async ({ page }) => {
    // 不正なタイムゾーンを入力
    // エラーメッセージが表示されることを確認
  });

  test('should mask sensitive fields on reload', async ({ page }) => {
    // SMTP/S3/AI設定を保存後、ページをリロード
    // パスワード等がマスクされていることを確認
  });
});
```

---

## 完了条件

- [x] ドキュメント作成完了
- [ ] データベーススキーマ更新（migration作成）
- [ ] `core/utils/encryption.ts` 実装（機密情報の暗号化/復号化）
- [ ] `core/services/system-settings.service.ts` 実装
- [ ] `app/routes/api/system-settings.ts` 実装
- [ ] `app/routes/dashboard.settings.tsx` 実装
- [ ] 接続テスト機能実装（S3, SMTP, AI）
- [ ] E2Eテスト作成（15テスト）
- [ ] 全テストがパス（統合テスト + E2Eテスト）
- [ ] TypeScript type check エラーなし
- [ ] ESLint エラーなし

---

## セキュリティ考慮事項

- **RLS enforcement**: `withTenantContext()` で必ずテナントスコープを設定
- **Input validation**: Zodスキーマで厳密に検証（SQLインジェクション対策）
- **Encryption at rest**: `s3Settings.secretAccessKey`, `smtpSettings.pass`, `aiSettings.apiKey` を暗号化
- **API response filtering**: GET /api/system-settings では機密情報を返さない（boolean flagのみ）
- **Role-based access**: 設定変更は admin ロールのみ許可
- **Logo upload security**: S3アップロード時はファイルタイプ検証（画像のみ許可）、ファイルサイズ制限（2MB以下）

---

## 暗号化実装

### `core/utils/encryption.ts`

```typescript
/**
 * Encrypt sensitive data before storing in database
 *
 * Uses AES-256-GCM encryption with a secret key from environment variable.
 *
 * @param plaintext - Plain text to encrypt
 * @returns Encrypted string (base64-encoded)
 */
export function encrypt(plaintext: string): string;

/**
 * Decrypt sensitive data after retrieving from database
 *
 * @param ciphertext - Encrypted string (base64-encoded)
 * @returns Decrypted plain text
 */
export function decrypt(ciphertext: string): string;
```

**環境変数:**
- `ENCRYPTION_KEY`: 32バイトのランダムキー（base64エンコード）
  - 生成方法: `openssl rand -base64 32`
  - `.env.example` に記載

---

## 接続テスト実装

### `app/routes/api/system-settings.test-s3.ts`

```typescript
/**
 * POST /api/system-settings/test-s3
 *
 * Test S3 connection with provided settings
 *
 * Request body: S3Settings
 * Response: { success: true } or { success: false, error: string }
 */
export async function action({ request }: ActionFunctionArgs): Promise<Response>;
```

### `app/routes/api/system-settings.test-smtp.ts`

```typescript
/**
 * POST /api/system-settings/test-smtp
 *
 * Test SMTP connection and send a test email
 *
 * Request body: SmtpSettings
 * Response: { success: true } or { success: false, error: string }
 */
export async function action({ request }: ActionFunctionArgs): Promise<Response>;
```

### `app/routes/api/system-settings.test-ai.ts`

```typescript
/**
 * POST /api/system-settings/test-ai
 *
 * Test AI API connection
 *
 * Request body: AiSettings
 * Response: { success: true } or { success: false, error: string }
 */
export async function action({ request }: ActionFunctionArgs): Promise<Response>;
```

---

## 将来の拡張性

今回のタスクでは以下の機能は実装しない（将来のタスクで対応）:

- ロゴのリサイズ・最適化処理
- 複数言語対応（i18n）
- カスタムテーマカラー設定
- メール通知のテンプレート管理
- Webhook設定
- 監査ログ（設定変更履歴）

---

## 参考資料

- [IANA Time Zone Database](https://www.iana.org/time-zones)
- [Intl.supportedValuesOf('timeZone')](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf)
- [Remix Form Validation Patterns](https://remix.run/docs/en/main/guides/form-validation)
- [AWS SDK for JavaScript v3 - S3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)
- [Nodemailer](https://nodemailer.com/)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
