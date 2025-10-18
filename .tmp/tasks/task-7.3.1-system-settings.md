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

**追加するカラム:**
```typescript
// core/db/schema/admin.ts（追加）
export const systemSettings = pgTable('system_settings', {
  tenantId: text('tenant_id').primaryKey().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  baseUrl: text('base_url'),
  smtpSettings: jsonb('smtp_settings'),
  aiSettings: jsonb('ai_settings'),
  shortlinkDomain: text('shortlink_domain'),
  // 新規追加カラム
  serviceName: text('service_name'),           // サービス名（例: "DevCle"）
  logoUrl: text('logo_url'),                   // ロゴ画像URL（公開URLまたはdata URI）
  fiscalYearStart: text('fiscal_year_start'),  // 期初（MM-DD形式、例: "04-01"）
  fiscalYearEnd: text('fiscal_year_end'),      // 期末（MM-DD形式、例: "03-31"）
  timezone: text('timezone'),                  // タイムゾーン（IANA形式、例: "Asia/Tokyo"）
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**マイグレーションSQL:**
```sql
-- Migration: Add settings columns to system_settings table
ALTER TABLE system_settings
  ADD COLUMN service_name TEXT,
  ADD COLUMN logo_url TEXT,
  ADD COLUMN fiscal_year_start TEXT,
  ADD COLUMN fiscal_year_end TEXT,
  ADD COLUMN timezone TEXT;
```

### 2. 設定項目の定義

以下の設定項目をサポートします：

| カラム名 | 型 | 説明 | デフォルト値 |
|----------|-----|------|-------------|
| `service_name` | `text` | サービス名（例: "DevCle"） | NULL |
| `logo_url` | `text` | ロゴ画像のURL（公開URLまたはdata URI） | NULL |
| `fiscal_year_start` | `text` | 期初の月日（"MM-DD"形式、例: "04-01"） | NULL |
| `fiscal_year_end` | `text` | 期末の月日（"MM-DD"形式、例: "03-31"） | NULL |
| `timezone` | `text` | タイムゾーン（IANA形式、例: "Asia/Tokyo"） | NULL |

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
  createdAt: Date;
  updatedAt: Date;
}

interface UpdateSystemSettingsInput {
  serviceName?: string;
  logoUrl?: string;
  fiscalYearStart?: string;
  fiscalYearEnd?: string;
  timezone?: string;
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
 *   timezone?: string
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
  };
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
});
```

## 完了条件

- [ ] `app/routes/dashboard.settings.tsx`が実装され、ブラウザで表示できる
- [ ] サービス名、ロゴ、期初期末、タイムゾーンの設定が保存できる
- [ ] 保存した設定が画面リロード後も保持される
- [ ] E2Eテストが全て通過する
- [ ] TypeScriptエラーがない（`pnpm typecheck`成功）
- [ ] Lintエラーがない（`pnpm lint`成功）

## セキュリティ考慮事項

- ロゴアップロードはファイルサイズ制限（例: 2MB）を設ける
- ロゴのMIMEタイプ検証（image/png, image/jpeg, image/svgのみ許可）
- XSS対策（ロゴURLのサニタイズ）
- CSRF対策（RemixのCSRF保護機能を使用）

## 注意事項

- ロゴアップロード機能は初期実装ではdata URI形式で保存し、後にS3等のストレージに移行予定
- タイムゾーン一覧はIntl APIから取得（`Intl.supportedValuesOf('timeZone')`）
- 期初期末の設定はROI計算やレポート生成で使用される予定
- この設定画面はシステム管理者のみアクセス可能（認証チェック）

## 次のタスク

Task 7.3.2: アクティビティカラーとアイコンの設定画面実装（システム設定画面の一部）
