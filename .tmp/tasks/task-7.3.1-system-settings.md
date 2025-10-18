# Task 7.3.1: システム設定画面の実装

**Status:** Pending
**Estimated Time:** 4時間
**Dependencies:** Task 7.1

## 概要

システム全体の基本設定を管理する画面を実装します。管理するサービス名、ロゴ、会計期間、タイムゾーンなどの設定を行えるようにします。

## 目的

- システム全体の設定を一元管理する画面を提供
- サービス名やロゴのカスタマイズを可能にする
- 会計期間とタイムゾーンの設定を可能にする

## 実装内容

### 1. データベーススキーマ（system_settingsテーブルの拡張）

既存の`system_settings`テーブル（`core/db/schema/admin.ts`）に新しいカラムを追加します。

**既存のスキーマ:**
```typescript
// core/db/schema/admin.ts（既存）
export const systemSettings = pgTable('system_settings', {
  tenantId: text('tenant_id').primaryKey().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  baseUrl: text('base_url'),
  smtpSettings: jsonb('smtp_settings'),
  aiSettings: jsonb('ai_settings'),
  shortlinkDomain: text('shortlink_domain'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**変更後のスキーマ:**
```typescript
// core/db/schema/admin.ts（変更後）
export const systemSettings = pgTable('system_settings', {
  tenantId: text('tenant_id').primaryKey().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  baseUrl: text('base_url'),
  shortlinkDomain: text('shortlink_domain'),
  // 基本設定
  serviceName: text('service_name'),             // サービス名（例: "DevCle"）
  logoUrl: text('logo_url'),                     // ロゴ画像URL（公開URLまたはdata URI）
  fiscalYearStart: text('fiscal_year_start'),    // 期初（MM-DD形式、例: "04-01"）
  fiscalYearEnd: text('fiscal_year_end'),        // 期末（MM-DD形式、例: "03-31"）
  timezone: text('timezone'),                    // タイムゾーン（IANA形式、例: "Asia/Tokyo"）デフォルト: ブラウザ設定
  // SMTP設定（フラット化）
  smtpHost: text('smtp_host'),                   // SMTPホスト（例: "smtp.gmail.com"）
  smtpPort: integer('smtp_port'),                // SMTPポート（例: 587）
  smtpUsername: text('smtp_username'),           // SMTPユーザー名
  smtpPassword: text('smtp_password'),           // SMTPパスワード（暗号化必須）
  // AI設定（フラット化）
  aiProvider: text('ai_provider'),               // AIプロバイダー（例: "openai", "anthropic"）
  aiApiKey: text('ai_api_key'),                  // AI APIキー（暗号化必須）
  aiModel: text('ai_model'),                     // AIモデル（例: "gpt-4", "claude-3"）
  // S3設定（フラット化）
  s3Bucket: text('s3_bucket'),                   // S3バケット名
  s3Region: text('s3_region'),                   // AWSリージョン（例: "ap-northeast-1"）
  s3AccessKeyId: text('s3_access_key_id'),       // アクセスキーID（暗号化推奨）
  s3SecretAccessKey: text('s3_secret_access_key'), // シークレットアクセスキー（暗号化必須）
  s3Endpoint: text('s3_endpoint'),               // カスタムエンドポイント（MinIO等、オプション）
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**マイグレーションSQL:**
```sql
-- Migration: Flatten SMTP/AI/S3 settings and add new columns
ALTER TABLE system_settings
  DROP COLUMN smtp_settings,
  DROP COLUMN ai_settings,
  ADD COLUMN service_name TEXT,
  ADD COLUMN logo_url TEXT,
  ADD COLUMN fiscal_year_start TEXT,
  ADD COLUMN fiscal_year_end TEXT,
  ADD COLUMN timezone TEXT,
  ADD COLUMN smtp_host TEXT,
  ADD COLUMN smtp_port INTEGER,
  ADD COLUMN smtp_username TEXT,
  ADD COLUMN smtp_password TEXT,
  ADD COLUMN ai_provider TEXT,
  ADD COLUMN ai_api_key TEXT,
  ADD COLUMN ai_model TEXT,
  ADD COLUMN s3_bucket TEXT,
  ADD COLUMN s3_region TEXT,
  ADD COLUMN s3_access_key_id TEXT,
  ADD COLUMN s3_secret_access_key TEXT,
  ADD COLUMN s3_endpoint TEXT;
```

### 2. 設定項目の定義

以下の設定項目をサポートします：

#### 基本設定
| カラム名 | 型 | 説明 | デフォルト値 |
|----------|-----|------|-------------|
| `service_name` | `text` | サービス名（例: "DevCle"） | NULL |
| `logo_url` | `text` | ロゴ画像のURL（公開URLまたはdata URI） | NULL |
| `fiscal_year_start` | `text` | 期初の月日（"MM-DD"形式、例: "04-01"） | NULL |
| `fiscal_year_end` | `text` | 期末の月日（"MM-DD"形式、例: "03-31"） | NULL |
| `timezone` | `text` | タイムゾーン（IANA形式、例: "Asia/Tokyo"） | ブラウザ設定（`Intl.DateTimeFormat().resolvedOptions().timeZone`） |

#### SMTP設定
| カラム名 | 型 | 説明 | デフォルト値 |
|----------|-----|------|-------------|
| `smtp_host` | `text` | SMTPホスト（例: "smtp.gmail.com"） | NULL |
| `smtp_port` | `integer` | SMTPポート（例: 587） | NULL |
| `smtp_username` | `text` | SMTPユーザー名 | NULL |
| `smtp_password` | `text` | SMTPパスワード（暗号化必須） | NULL |

#### AI設定
| カラム名 | 型 | 説明 | デフォルト値 |
|----------|-----|------|-------------|
| `ai_provider` | `text` | AIプロバイダー（"openai", "anthropic"等） | NULL |
| `ai_api_key` | `text` | AI APIキー（暗号化必須） | NULL |
| `ai_model` | `text` | AIモデル（"gpt-4", "claude-3"等） | NULL |

#### S3設定
| カラム名 | 型 | 説明 | デフォルト値 |
|----------|-----|------|-------------|
| `s3_bucket` | `text` | S3バケット名 | NULL |
| `s3_region` | `text` | AWSリージョン（例: "ap-northeast-1"） | NULL |
| `s3_access_key_id` | `text` | アクセスキーID（暗号化推奨） | NULL |
| `s3_secret_access_key` | `text` | シークレットアクセスキー（暗号化必須） | NULL |
| `s3_endpoint` | `text` | カスタムエンドポイント（MinIO等、オプション） | NULL |

### 3. サービスレイヤー

```typescript
// core/services/system-settings.service.ts

interface SystemSettings {
  tenantId: string;
  baseUrl: string | null;
  smtpSettings: unknown | null;
  aiSettings: unknown | null;
  shortlinkDomain: string | null;
  serviceName: string | null;
  logoUrl: string | null;
  fiscalYearStart: string | null;
  fiscalYearEnd: string | null;
  timezone: string | null;
  s3Bucket: string | null;
  s3Region: string | null;
  s3AccessKeyId: string | null;
  s3SecretAccessKey: string | null;
  s3Endpoint: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UpdateSystemSettingsInput {
  serviceName?: string;
  logoUrl?: string;
  fiscalYearStart?: string;
  fiscalYearEnd?: string;
  timezone?: string;
  s3Bucket?: string;
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3Endpoint?: string;
}

/**
 * Get system settings for a tenant
 */
export async function getSystemSettings(
  tenantId: string
): Promise<SystemSettings | null>;

/**
 * Update system settings (partial update)
 */
export async function updateSystemSettings(
  tenantId: string,
  settings: UpdateSystemSettingsInput
): Promise<SystemSettings>;

/**
 * Create initial system settings for a new tenant
 */
export async function createSystemSettings(
  tenantId: string
): Promise<SystemSettings>;
```

**実装の詳細:**
- `withTenantContext()`を使用してRLS対応
- UPSERT処理で設定を更新（tenant_idが主キーなので1レコードのみ）
- 部分更新をサポート（指定されたフィールドのみ更新）
- バリデーションはZodスキーマで実施

### 4. API Routes

```typescript
// app/routes/api/settings.ts

/**
 * GET /api/settings
 * Get system settings for the current tenant
 */
export async function loader({ request }: LoaderFunctionArgs): Promise<Response>;

/**
 * PUT /api/settings
 * Body: UpdateSystemSettingsInput
 * {
 *   serviceName?: string,
 *   logoUrl?: string,
 *   fiscalYearStart?: string,
 *   fiscalYearEnd?: string,
 *   timezone?: string,
 *   s3Bucket?: string,
 *   s3Region?: string,
 *   s3AccessKeyId?: string,
 *   s3SecretAccessKey?: string,
 *   s3Endpoint?: string
 * }
 */
export async function action({ request }: ActionFunctionArgs): Promise<Response>;
```

**エラーハンドリング:**
- 400: Invalid request body（バリデーションエラー）
- 401: Unauthorized（認証エラー）
- 404: Settings not found（初期化されていない場合は自動作成）
- 500: Internal server error

### 5. UI実装

```typescript
// app/routes/dashboard.settings.tsx

export default function SettingsPage(): JSX.Element;

/**
 * ページ構成:
 * - ヘッダー（"System Settings"）
 * - 基本設定セクション
 *   - サービス名入力フィールド
 *   - ロゴアップロード（File input + プレビュー）
 *   - 期初設定（MM-DD形式の日付入力）
 *   - 期末設定（MM-DD形式の日付入力）
 *   - タイムゾーン選択（ドロップダウン、Intl.supportedValuesOf('timeZone')から取得）
 *     - デフォルト値: Intl.DateTimeFormat().resolvedOptions().timeZone（ブラウザ設定）
 * - S3設定セクション
 *   - バケット名入力フィールド
 *   - リージョン選択（ドロップダウン）
 *   - アクセスキーID入力フィールド
 *   - シークレットアクセスキー入力フィールド（パスワード形式）
 *   - カスタムエンドポイント入力フィールド（オプション）
 * - 保存ボタン（Remix Form使用）
 */
```

**UIコンポーネント:**

```typescript
// app/components/settings/BasicSettingsForm.tsx

interface BasicSettingsFormProps {
  settings: {
    serviceName: string | null;
    logoUrl: string | null;
    fiscalYearStart: string | null;
    fiscalYearEnd: string | null;
    timezone: string | null;
    s3Bucket: string | null;
    s3Region: string | null;
    s3AccessKeyId: string | null;
    s3SecretAccessKey: string | null;
    s3Endpoint: string | null;
  };
  defaultTimezone: string; // Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function BasicSettingsForm(props: BasicSettingsFormProps): JSX.Element;
```

**デザイン要件:**
- ダークモード対応（既存のDarkModeProvider使用）
- モバイル対応（レスポンシブデザイン）
- フォームバリデーション表示（エラーメッセージ）
- 保存成功時のトースト通知
- ロゴプレビュー表示（画像アップロード後）

### 6. バリデーションスキーマ

```typescript
// core/services/system-settings.schemas.ts

import { z } from 'zod';

// Helper: Validate MM-DD format
const mmddValidator = z.string().refine((val) => {
  const parts = val.split('-');
  if (parts.length !== 2) return false;
  const month = Number(parts[0]);
  const day = Number(parts[1]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}, {
  message: 'Invalid MM-DD format (month 01-12, day 01-31)',
});

// Helper: Validate IANA timezone
const validTimezones = Intl.supportedValuesOf('timeZone');
const timezoneValidator = z.string().refine((val) => validTimezones.includes(val), {
  message: 'Invalid IANA timezone',
});

// Update system settings input schema
export const UpdateSystemSettingsSchema = z.object({
  serviceName: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().or(z.string().startsWith('data:image/')).optional(),
  fiscalYearStart: mmddValidator.optional(),
  fiscalYearEnd: mmddValidator.optional(),
  timezone: timezoneValidator.optional(),
  s3Bucket: z.string().min(1, 'Bucket name is required').optional(),
  s3Region: z.string().min(1, 'Region is required').optional(),
  s3AccessKeyId: z.string().min(1, 'Access Key ID is required').optional(),
  s3SecretAccessKey: z.string().min(1, 'Secret Access Key is required').optional(),
  s3Endpoint: z.string().url('Invalid endpoint URL').optional(),
});
```

### 7. E2Eテスト

```typescript
// core/e2e/settings.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test('should display settings page', async ({ page }) => {
    // ログイン後、設定ページにアクセス
    // "System Settings"ヘッダーが表示されることを確認
  });

  test('should save service name', async ({ page }) => {
    // サービス名を入力
    // 保存ボタンをクリック
    // 成功メッセージが表示されることを確認
    // リロード後も設定が保持されることを確認
  });

  test('should upload and display logo', async ({ page }) => {
    // ロゴ画像をアップロード
    // プレビューが表示されることを確認
    // 保存後、ダッシュボードにロゴが反映されることを確認
  });

  test('should save fiscal year settings', async ({ page }) => {
    // 期初期末を入力
    // 保存ボタンをクリック
    // 設定が保存されることを確認
  });

  test('should save timezone', async ({ page }) => {
    // タイムゾーンを選択
    // 保存ボタンをクリック
    // 設定が保存されることを確認
  });

  test('should default timezone to browser setting', async ({ page }) => {
    // 設定ページにアクセス
    // タイムゾーンドロップダウンのデフォルト値がブラウザ設定と一致することを確認
    // (Intl.DateTimeFormat().resolvedOptions().timeZone)
  });

  test('should save S3 settings', async ({ page }) => {
    // S3設定（バケット名、リージョン、アクセスキー等）を入力
    // 保存ボタンをクリック
    // 設定が保存されることを確認
    // シークレットアクセスキーがマスク表示されることを確認
  });

  test('should validate S3 settings', async ({ page }) => {
    // 必須フィールドを空にして保存
    // バリデーションエラーが表示されることを確認
  });
});
```

## 完了条件

- [ ] `app/routes/dashboard.settings.tsx`が実装され、ブラウザで表示できる
- [ ] サービス名、ロゴ、期初期末、タイムゾーン、S3設定が保存できる
- [ ] タイムゾーンのデフォルト値がブラウザ設定（`Intl.DateTimeFormat().resolvedOptions().timeZone`）になる
- [ ] 保存した設定が画面リロード後も保持される
- [ ] S3シークレットアクセスキーがパスワード形式で表示される
- [ ] E2Eテストが全て通過する
- [ ] TypeScriptエラーがない（`pnpm typecheck`成功）
- [ ] Lintエラーがない（`pnpm lint`成功）

## セキュリティ考慮事項

- ロゴアップロードはファイルサイズ制限（例: 2MB）を設ける
- ロゴのMIMEタイプ検証（image/png, image/jpeg, image/svgのみ許可）
- XSS対策（ロゴURLのサニタイズ）
- CSRF対策（RemixのCSRF保護機能を使用）
- **S3認証情報の暗号化**
  - `secretAccessKey`はデータベース保存時に暗号化（AES-256-GCM推奨）
  - `accessKeyId`も暗号化推奨（平文でも可だが暗号化が望ましい）
  - 暗号化キーは環境変数（`ENCRYPTION_KEY`）で管理
  - フロントエンドでは`secretAccessKey`をパスワード形式で表示（マスク表示）

## 注意事項

- ロゴアップロード機能は初期実装ではdata URI形式で保存し、後にS3等のストレージに移行予定
  - S3設定が保存されている場合は、ロゴをS3にアップロードすることも可能
- タイムゾーン一覧はIntl APIから取得（`Intl.supportedValuesOf('timeZone')`）
- タイムゾーンのデフォルト値はブラウザ設定（`Intl.DateTimeFormat().resolvedOptions().timeZone`）
- 期初期末の設定はROI計算やレポート生成で使用される予定
- この設定画面はシステム管理者のみアクセス可能（認証チェック）
- S3設定は将来的にロゴアップロード、データエクスポート、バックアップ等で使用される

## 次のタスク

Task 7.3.2: アクティビティカラーとアイコンの設定画面実装（システム設定画面の一部）
