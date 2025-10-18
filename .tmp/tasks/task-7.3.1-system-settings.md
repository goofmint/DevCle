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

### 1. データベーススキーマ（既存のsystem_settingsテーブルを使用）

既存の`system_settings`テーブル（`core/db/schema/admin.ts`）を使用します。

```typescript
// core/db/schema/admin.ts（既存）
export const systemSettings = pgTable('system_settings', {
  settingId: uuid('setting_id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueKey: uniqueIndex('system_settings_tenant_key_idx').on(table.tenantId, table.key),
}));
```

### 2. 設定項目の定義

以下の設定項目をサポートします：

| key | value型 | 説明 |
|-----|---------|------|
| `service_name` | `string` | サービス名（例: "DevCle"） |
| `logo_url` | `string` | ロゴ画像のURL（公開URLまたはdata URI） |
| `fiscal_year_start` | `string` | 期初の月日（"MM-DD"形式、例: "04-01"） |
| `fiscal_year_end` | `string` | 期末の月日（"MM-DD"形式、例: "03-31"） |
| `timezone` | `string` | タイムゾーン（例: "Asia/Tokyo"） |

### 3. サービスレイヤー

```typescript
// core/services/system-settings.service.ts

interface SystemSetting {
  settingId: string;
  tenantId: string;
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}

interface ServiceNameSetting {
  service_name: string;
}

interface LogoSetting {
  logo_url: string;
}

interface FiscalYearSetting {
  fiscal_year_start: string; // "MM-DD"
  fiscal_year_end: string;   // "MM-DD"
}

interface TimezoneSetting {
  timezone: string; // IANA timezone
}

/**
 * Get system setting by key
 */
export async function getSystemSetting(
  tenantId: string,
  key: string
): Promise<SystemSetting | null>;

/**
 * Set system setting
 */
export async function setSystemSetting(
  tenantId: string,
  key: string,
  value: unknown
): Promise<SystemSetting>;

/**
 * Get all system settings for a tenant
 */
export async function getAllSystemSettings(
  tenantId: string
): Promise<SystemSetting[]>;

/**
 * Delete system setting by key
 */
export async function deleteSystemSetting(
  tenantId: string,
  key: string
): Promise<void>;
```

**実装の詳細:**
- `withTenantContext()`を使用してRLS対応
- UPSERT処理で設定を更新（key重複時は上書き）
- バリデーションはZodスキーマで実施

### 4. API Routes

```typescript
// app/routes/api/settings.ts

/**
 * GET /api/settings?keys=service_name,logo_url
 * Query all or specific settings
 */
export async function loader({ request }: LoaderFunctionArgs): Promise<Response>;

/**
 * PUT /api/settings
 * Body: { key: string, value: unknown }
 */
export async function action({ request }: ActionFunctionArgs): Promise<Response>;
```

**エラーハンドリング:**
- 400: Invalid request body
- 401: Unauthorized
- 404: Setting not found
- 500: Internal server error

### 5. UI実装

```typescript
// app/routes/dashboard.settings.tsx

interface SettingsPageProps {}

export default function SettingsPage(): JSX.Element;

/**
 * ページ構成:
 * - ヘッダー（"System Settings"）
 * - 基本設定セクション
 *   - サービス名入力フィールド
 *   - ロゴアップロード（File input + プレビュー）
 *   - 期初期末設定（MM-DD形式の日付入力）
 *   - タイムゾーン選択（ドロップダウン）
 * - 保存ボタン
 */
```

**UIコンポーネント:**

```typescript
// app/components/settings/BasicSettings.tsx

interface BasicSettingsProps {
  serviceName: string;
  logoUrl: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  timezone: string;
  onSave: (settings: BasicSettingsData) => void;
}

interface BasicSettingsData {
  service_name: string;
  logo_url: string;
  fiscal_year_start: string;
  fiscal_year_end: string;
  timezone: string;
}

export function BasicSettings(props: BasicSettingsProps): JSX.Element;
```

**デザイン要件:**
- ダークモード対応（既存のDarkModeProvider使用）
- モバイル対応（レスポンシブデザイン）
- フォームバリデーション表示（エラーメッセージ）
- 保存成功時のトースト通知

### 6. バリデーションスキーマ

```typescript
// core/services/system-settings.schemas.ts

import { z } from 'zod';

export const ServiceNameSettingSchema = z.object({
  service_name: z.string().min(1).max(100),
});

export const LogoSettingSchema = z.object({
  logo_url: z.string().url().or(z.string().startsWith('data:image/')),
});

export const FiscalYearSettingSchema = z.object({
  fiscal_year_start: z.string().refine((val) => {
    const parts = val.split('-');
    if (parts.length !== 2) return false;
    const month = Number(parts[0]);
    const day = Number(parts[1]);
    return month >= 1 && month <= 12 && day >= 1 && day <= 31;
  }, {
    message: 'Invalid MM-DD format (month 01-12, day 01-31)',
  }),
  fiscal_year_end: z.string().refine((val) => {
    const parts = val.split('-');
    if (parts.length !== 2) return false;
    const month = Number(parts[0]);
    const day = Number(parts[1]);
    return month >= 1 && month <= 12 && day >= 1 && day <= 31;
  }, {
    message: 'Invalid MM-DD format (month 01-12, day 01-31)',
  }),
});

// Get valid IANA timezones
const validTimezones = Intl.supportedValuesOf('timeZone');

export const TimezoneSettingSchema = z.object({
  timezone: z.string().refine((val) => validTimezones.includes(val), {
    message: 'Invalid IANA timezone',
  }),
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
