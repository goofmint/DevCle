# Task 7.3.2: システム設定画面の実装

**Status:** ドキュメント作成完了（実装待ち）
**Priority:** 中
**Estimated Time:** 4時間
**Dependencies:** Task 7.1（ダッシュボードレイアウト）

---

## 概要

DevCleのシステム設定画面を実装する。テナントごとに管理するサービス名、ロゴ、会計年度、タイムゾーン等の基本設定を行えるようにする。

---

## 目的

- テナントごとに独自のサービス名とロゴを設定可能にする
- 会計年度の期初・期末を設定し、ROI分析の期間計算に使用する
- タイムゾーン設定により、アクティビティやレポートの日時表示を正確にする

---

## データベーススキーマ

### `system_settings` テーブル（既存）

すでに `core/db/schema/admin.ts` に定義済み。

```typescript
export const systemSettings = pgTable('system_settings', {
  settingId: uuid('setting_id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  serviceName: text('service_name').notNull().default('DevCle'),
  logoUrl: text('logo_url'),
  fiscalYearStart: text('fiscal_year_start').notNull().default('04-01'), // MM-DD format
  fiscalYearEnd: text('fiscal_year_end').notNull().default('03-31'),   // MM-DD format
  timezone: text('timezone').notNull().default('Asia/Tokyo'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**制約:**
- `tenant_id` はユニーク（各テナントに1レコードのみ）
- `fiscal_year_start`, `fiscal_year_end` は `MM-DD` フォーマット（例: `'04-01'`, `'03-31'`）
- `timezone` は IANA timezone database 形式（例: `'Asia/Tokyo'`, `'UTC'`, `'America/New_York'`）

---

## サービス層インターフェース

### `core/services/system-settings.service.ts`

```typescript
import type { SystemSettingsRow } from '~/db/schema/admin.js';

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
 * Creates new settings if none exist.
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
    fiscalYearStart: string; // MM-DD format
    fiscalYearEnd: string;   // MM-DD format
    timezone: string;        // IANA timezone
  }>
): Promise<SystemSettingsRow>;
```

**実装の注意点:**
- `getSystemSettings()` は設定が存在しない場合、デフォルト値を返す（DBに保存はしない）
- `updateSystemSettings()` は UPSERT 操作（ON CONFLICT DO UPDATE）
- RLS対応: `withTenantContext()` を使用
- バリデーション: Zodスキーマで入力検証
  - `fiscalYearStart`, `fiscalYearEnd` は正規表現 `/^\d{2}-\d{2}$/` でチェック
  - `timezone` は `Intl.supportedValuesOf('timeZone')` で検証

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
 *   "settingId": "uuid",
 *   "tenantId": "default",
 *   "serviceName": "DevCle",
 *   "logoUrl": "https://example.com/logo.png",
 *   "fiscalYearStart": "04-01",
 *   "fiscalYearEnd": "03-31",
 *   "timezone": "Asia/Tokyo",
 *   "createdAt": "2025-10-19T00:00:00Z",
 *   "updatedAt": "2025-10-19T00:00:00Z"
 * }
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
 *   "fiscalYearStart"?: string,  // MM-DD format
 *   "fiscalYearEnd"?: string,    // MM-DD format
 *   "timezone"?: string          // IANA timezone
 * }
 *
 * Response: Updated system settings (same format as GET)
 *
 * Error codes:
 * - 400: Invalid request body (validation error)
 * - 401: Unauthorized (not authenticated)
 * - 500: Internal server error
 */
export async function action({ request }: ActionFunctionArgs): Promise<Response>;
```

---

## UI層インターフェース

### `app/routes/dashboard.settings.tsx`

システム設定画面のUIコンポーネント。

**レイアウト:**
```
┌─────────────────────────────────────────┐
│ System Settings                         │
├─────────────────────────────────────────┤
│                                         │
│ Basic Settings                          │
│ ┌─────────────────────────────────────┐ │
│ │ Service Name:  [DevCle            ] │ │
│ │ Logo URL:      [https://...       ] │ │
│ │                                     │ │
│ │ Fiscal Year:                        │ │
│ │   Start: [04] - [01]  (MM-DD)      │ │
│ │   End:   [03] - [31]  (MM-DD)      │ │
│ │                                     │ │
│ │ Timezone: [Asia/Tokyo        ▼]    │ │
│ │                                     │ │
│ │           [Save Settings]           │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

**コンポーネント構造:**

```typescript
export default function SystemSettingsPage() {
  // loader から初期データを取得
  // Remix Form で PUT /api/system-settings にサブミット
  // バリデーションエラーは action から返される
  // 成功時はトースト通知を表示
}

/**
 * Loader function
 *
 * Fetches system settings for the authenticated user's tenant
 */
export async function loader({ request }: LoaderFunctionArgs): Promise<Response>;

/**
 * Action function
 *
 * Handles form submission (PUT /api/system-settings)
 */
export async function action({ request }: ActionFunctionArgs): Promise<Response>;
```

**フォーム要素:**
- **Service Name**: テキスト入力（必須、1-100文字）
- **Logo URL**: テキスト入力（任意、URL形式）
- **Fiscal Year Start**: 2つのセレクトボックス（月 01-12、日 01-31）
- **Fiscal Year End**: 2つのセレクトボックス（月 01-12、日 01-31）
- **Timezone**: セレクトボックス（`Intl.supportedValuesOf('timeZone')` から生成）

**バリデーション:**
- クライアント側: HTML5 form validation + Zod schema
- サーバー側: Zod schema validation in action function

---

## テスト要件

### E2Eテスト (`e2e/dashboard-settings.spec.ts`)

```typescript
test.describe('System Settings', () => {
  test('should display system settings page', async ({ page }) => {
    // ログイン後、/dashboard/settings にアクセス
    // フォームが表示されることを確認
  });

  test('should load existing settings', async ({ page }) => {
    // 設定が既に存在する場合、値がフォームに反映されることを確認
  });

  test('should update service name', async ({ page }) => {
    // サービス名を変更して保存
    // 成功メッセージが表示されることを確認
  });

  test('should update fiscal year', async ({ page }) => {
    // 期初・期末を変更して保存
    // 成功メッセージが表示されることを確認
  });

  test('should update timezone', async ({ page }) => {
    // タイムゾーンを変更して保存
    // 成功メッセージが表示されることを確認
  });

  test('should show validation error for invalid fiscal year', async ({ page }) => {
    // 不正な日付（例: 02-31）を入力
    // エラーメッセージが表示されることを確認
  });
});
```

---

## 完了条件

- [x] ドキュメント作成完了
- [ ] `core/services/system-settings.service.ts` 実装
- [ ] `app/routes/api/system-settings.ts` 実装
- [ ] `app/routes/dashboard.settings.tsx` 実装
- [ ] E2Eテスト作成（6テスト）
- [ ] 全テストがパス（統合テスト + E2Eテスト）
- [ ] TypeScript type check エラーなし
- [ ] ESLint エラーなし

---

## セキュリティ考慮事項

- **RLS enforcement**: `withTenantContext()` で必ずテナントスコープを設定
- **Input validation**: Zodスキーマで厳密に検証（SQLインジェクション対策）
- **XSS prevention**: ロゴURLは信頼できるドメインのみ許可（オプション）
- **Logo upload**: 今回は外部URLのみ。将来的にアップロード機能を追加する場合は別タスクで対応

---

## 将来の拡張性

今回のタスクでは以下の機能は実装しない（将来のタスクで対応）:

- ロゴファイルのアップロード機能
- 複数言語対応（i18n）
- カスタムテーマカラー設定
- メール通知設定
- Webhook設定

---

## 参考資料

- [IANA Time Zone Database](https://www.iana.org/time-zones)
- [Intl.supportedValuesOf('timeZone')](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf)
- [Remix Form Validation Patterns](https://remix.run/docs/en/main/guides/form-validation)
