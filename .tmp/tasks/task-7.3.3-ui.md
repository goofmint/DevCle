# Task 7.3.3-UI: アクティビティタイプ設定画面UI実装

**推定時間**: 3.5時間
**依存**: Task 7.3.3-backend（完了済み）
**優先度**: 中

## 概要

アクティビティタイプ設定画面のUI実装。バックエンド（DB、サービス層、API層）は既に完了しているため、フロントエンドのみを実装する。

## 前提条件（完了済み）

- [x] `activity_types`テーブル作成済み（Migration 0007）
- [x] `core/services/activity-type.service.ts`実装済み（24テストパス）
- [x] API層実装済み：
  - `app/routes/api.activity-types.ts`（GET list, POST create）
  - `app/routes/api.activity-types.$action.ts`（GET detail, PUT update, DELETE delete）
  - `app/routes/api.activity-types.actions.ts`（GET action names）
- [x] 依存パッケージインストール済み：
  - `react-color@2.19.3`
  - `@types/react-color@3.0.13`

## スコープ

このタスクで実装するもの：

1. `app/routes/dashboard.settings.activity-types.tsx`（メイン画面）
2. UIコンポーネント（ActionCombobox, IconPicker, ColorPalette, ActivityTypeTable, ActivityTypeForm）
3. E2Eテスト（13テスト）

---

## 1. メイン画面実装

### 1.1 ファイル構成

```
app/
├── routes/
│   └── dashboard.settings.activity-types.tsx  # メイン画面（<300行）
├── components/settings/
│   ├── ActivityTypeTable.tsx                  # 一覧テーブル
│   ├── ActivityTypeForm.tsx                   # 作成・編集フォーム
│   ├── ActionCombobox.tsx                     # アクション入力コンポーネント
│   ├── IconPicker.tsx                         # アイコン選択コンポーネント
│   └── ColorPalette.tsx                       # カラー選択コンポーネント
```

### 1.2 Remix Route実装

`app/routes/dashboard.settings.activity-types.tsx`

```typescript
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import { requireAuth } from '../middleware/auth.server.js';
import {
  listActivityTypes,
  createActivityType,
  updateActivityType,
  deleteActivityType
} from '../../services/activity-type.service.js';
import { listFunnelStages } from '../../services/funnel-stage.service.js';

/**
 * Loader: Load activity types and funnel stages
 *
 * - Admin-only access (403 for non-admin)
 * - Load all activity types for current tenant
 * - Load funnel stages for dropdown options
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // 実装内容:
  // 1. requireAuth(request) でadmin権限チェック（非adminは403）
  // 2. listActivityTypes(user.tenantId, { limit: 100, offset: 0 }) で全取得
  // 3. listFunnelStages(user.tenantId) でファネルステージ取得
  // 4. return json({ activityTypes, funnelStages })
}

/**
 * Action: Handle create/update/delete operations
 *
 * - POST: Create new activity type
 * - PUT: Update existing activity type
 * - DELETE: Delete activity type
 *
 * Form data:
 * - intent: 'create' | 'update' | 'delete'
 * - action: string (activity action name)
 * - iconName: string (Iconify icon name)
 * - colorClass: string (Tailwind CSS classes)
 * - funnelStageId: string | null (UUID)
 */
export async function action({ request }: ActionFunctionArgs) {
  // 実装内容:
  // 1. requireAuth(request) でadmin権限チェック
  // 2. await request.formData() でフォームデータ取得
  // 3. intent で処理を分岐:
  //    - 'create': createActivityType(tenantId, data)
  //    - 'update': updateActivityType(tenantId, action, data)
  //    - 'delete': deleteActivityType(tenantId, action)
  // 4. return json({ success: true, message: '...' })
  // 5. エラー時: return json({ success: false, error: '...' }, { status: 400/409/500 })
}

/**
 * Activity Types Settings Page Component
 *
 * Features:
 * - Display activity types in a table
 * - Create new activity type (modal/inline form)
 * - Edit existing activity type (modal/inline form)
 * - Delete activity type (confirmation dialog)
 * - Toast notifications for success/error
 * - Dark/Light mode support
 */
export default function ActivityTypesSettings() {
  // 実装内容:
  // 1. const { activityTypes, funnelStages } = useLoaderData<typeof loader>();
  // 2. const fetcher = useFetcher();
  // 3. const [editingAction, setEditingAction] = useState<string | null>(null);
  // 4. const [isCreating, setIsCreating] = useState(false);
  // 5. レンダリング:
  //    - ページタイトル "Activity Type Settings"
  //    - "Create Activity Type" ボタン
  //    - <ActivityTypeTable> でactivityTypes表示
  //    - isCreating時: <ActivityTypeForm mode="create" />
  //    - editingAction時: <ActivityTypeForm mode="edit" />
  //    - fetcher.dataでToast表示（success/error）
  // 6. Dark/Light mode: Tailwind dark:クラス使用
}
```

---

## 2. UIコンポーネント実装

### 2.1 ActivityTypeTable

`app/components/settings/ActivityTypeTable.tsx`

```typescript
import { Icon } from '@iconify/react';

interface ActivityType {
  activityTypeId: string;
  action: string;
  iconName: string;
  colorClass: string;
  stageKey: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ActivityTypeTableProps {
  activityTypes: ActivityType[];
  onEdit: (action: string) => void;
  onDelete: (action: string) => void;
}

/**
 * Activity Type Table Component
 *
 * Displays all activity types in a table with:
 * - Action name
 * - Icon preview (using @iconify/react)
 * - Color preview (colored badge)
 * - Funnel stage (if mapped)
 * - Edit/Delete buttons
 *
 * Table columns:
 * 1. Action (string)
 * 2. Icon (visual preview with Iconify)
 * 3. Color (badge with applied Tailwind classes)
 * 4. Funnel Stage (stage name or '-')
 * 5. Actions (Edit/Delete buttons)
 */
export function ActivityTypeTable({
  activityTypes,
  onEdit,
  onDelete
}: ActivityTypeTableProps) {
  // 実装内容:
  // 1. テーブルレイアウト（Tailwindクラス使用）
  // 2. ヘッダー: Action, Icon, Color, Funnel Stage, Actions
  // 3. 各行:
  //    - action: <td>{activity.action}</td>
  //    - icon: <td><Icon icon={activity.iconName} className="w-6 h-6" /></td>
  //    - color: <td><span className={activity.colorClass}>Badge</span></td>
  //    - stage: <td>{activity.stageKey || '-'}</td>
  //    - actions: <td><button onClick={() => onEdit(activity.action)}>Edit</button> <button onClick={() => onDelete(activity.action)}>Delete</button></td>
  // 4. Dark mode: dark:bg-gray-800, dark:text-white
  // 5. 空の場合: "No activity types found. Create one to get started."
}
```

### 2.2 ActivityTypeForm

`app/components/settings/ActivityTypeForm.tsx`

```typescript
import { ActionCombobox } from './ActionCombobox.js';
import { IconPicker } from './IconPicker.js';
import { ColorPalette } from './ColorPalette.js';

interface FunnelStage {
  funnelStageId: string;
  stageKey: string;
  stageName: string;
}

interface ActivityTypeFormProps {
  mode: 'create' | 'edit';
  initialData?: {
    action: string;
    iconName: string;
    colorClass: string;
    funnelStageId: string | null;
  };
  existingActions: string[];
  funnelStages: FunnelStage[];
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

/**
 * Activity Type Form Component
 *
 * Create or edit activity type with:
 * - Action input (ActionCombobox)
 * - Icon picker (IconPicker)
 * - Color palette (ColorPalette)
 * - Funnel stage dropdown (select)
 * - Submit/Cancel buttons
 *
 * Fields:
 * 1. Action (Combobox):
 *    - Create mode: Select existing or type new
 *    - Edit mode: Disabled (action is identifier)
 * 2. Icon (IconPicker):
 *    - Search and select Iconify icons
 *    - Preview selected icon
 * 3. Color (ColorPalette):
 *    - Select from preset Tailwind colors
 *    - Preview colored badge
 * 4. Funnel Stage (select):
 *    - Dropdown with funnel stages
 *    - Optional (can be null)
 * 5. Buttons:
 *    - Submit: "Create" or "Update"
 *    - Cancel: Close form
 */
export function ActivityTypeForm({
  mode,
  initialData,
  existingActions,
  funnelStages,
  onSubmit,
  onCancel,
}: ActivityTypeFormProps) {
  // 実装内容:
  // 1. useState で action, iconName, colorClass, funnelStageId を管理
  // 2. initialData があれば初期値設定
  // 3. フォームレンダリング:
  //    - <ActionCombobox value={action} onChange={setAction} disabled={mode === 'edit'} existingActions={existingActions} />
  //    - <IconPicker value={iconName} onChange={setIconName} />
  //    - <ColorPalette value={colorClass} onChange={setColorClass} />
  //    - <select value={funnelStageId} onChange={...}> でファネルステージ選択
  //    - <button type="submit">{mode === 'create' ? 'Create' : 'Update'}</button>
  //    - <button type="button" onClick={onCancel}>Cancel</button>
  // 4. onSubmit時: FormDataを作成してonSubmit(formData)呼び出し
  // 5. Validation: actionは1-100文字、iconNameとcolorClassは必須
  // 6. Dark mode対応
}
```

### 2.3 ActionCombobox

`app/components/settings/ActionCombobox.tsx`

```typescript
interface ActionComboboxProps {
  value: string;
  existingActions: string[];
  onChange: (action: string) => void;
  disabled?: boolean;
}

/**
 * Action Combobox Component
 *
 * Features:
 * - Dropdown showing existing actions
 * - Allows typing new action
 * - Autocomplete suggestions
 * - Validation: 1-100 characters
 *
 * Implementation:
 * - Use native <datalist> + <input> for simplicity
 * - OR use Headless UI Combobox for better UX
 *
 * Behavior:
 * - Click to show dropdown of existing actions
 * - Type to filter suggestions
 * - Select existing action or enter new one
 * - Disabled in edit mode (action is identifier)
 */
export function ActionCombobox({
  value,
  existingActions,
  onChange,
  disabled = false,
}: ActionComboboxProps) {
  // 実装内容:
  // 1. <input> + <datalist> パターンで実装（シンプル）
  // 2. <input
  //      type="text"
  //      value={value}
  //      onChange={(e) => onChange(e.target.value)}
  //      list="action-suggestions"
  //      disabled={disabled}
  //    />
  // 3. <datalist id="action-suggestions">
  //      {existingActions.map(action => <option key={action} value={action} />)}
  //    </datalist>
  // 4. Validation: maxLength={100}, minLength={1}, required
  // 5. Dark mode対応
}
```

### 2.4 IconPicker

`app/components/settings/IconPicker.tsx`

```typescript
interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

/**
 * Icon Picker Component
 *
 * Features:
 * - Search input for icon name
 * - Icon preview with live rendering
 * - Popular icon sets (heroicons, mdi, material-symbols)
 * - Grid layout for browsing
 *
 * Implementation:
 * - Use @iconify/react for icon preview
 * - Simple text input with suggestions (no external library)
 * - Show preview below input
 *
 * Popular Icons (suggestions):
 * - heroicons:cursor-arrow-rays
 * - heroicons:calendar-days
 * - heroicons:user-plus
 * - heroicons:chat-bubble-left-right
 * - heroicons:star
 * - heroicons:code-bracket
 * - heroicons:bolt
 * - mdi:github
 * - mdi:slack
 * - material-symbols:event
 */
export function IconPicker({ value, onChange }: IconPickerProps) {
  // 実装内容:
  // 1. Popular iconsのリスト定義
  // 2. <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
  // 3. <div>Icon Preview: <Icon icon={value} className="w-8 h-8" /></div>
  // 4. <div>Suggestions: {popularIcons.map(icon => <button onClick={() => onChange(icon)}><Icon icon={icon} /></button>)}</div>
  // 5. Validation: 1-255文字、必須
  // 6. Dark mode対応
}
```

### 2.5 ColorPalette

`app/components/settings/ColorPalette.tsx`

```typescript
import { CirclePicker } from 'react-color';

interface ColorPaletteProps {
  value: string; // Tailwind CSS classes
  onChange: (colorClass: string) => void;
}

/**
 * Preset Colors (Tailwind-based)
 */
const PRESET_COLORS = [
  { hex: '#3B82F6', tailwind: 'text-blue-600 bg-blue-100 border-blue-200', name: 'Blue' },
  { hex: '#10B981', tailwind: 'text-green-600 bg-green-100 border-green-200', name: 'Green' },
  { hex: '#8B5CF6', tailwind: 'text-purple-600 bg-purple-100 border-purple-200', name: 'Purple' },
  { hex: '#F97316', tailwind: 'text-orange-600 bg-orange-100 border-orange-200', name: 'Orange' },
  { hex: '#EAB308', tailwind: 'text-yellow-600 bg-yellow-100 border-yellow-200', name: 'Yellow' },
  { hex: '#EF4444', tailwind: 'text-red-600 bg-red-100 border-red-200', name: 'Red' },
  { hex: '#EC4899', tailwind: 'text-pink-600 bg-pink-100 border-pink-200', name: 'Pink' },
  { hex: '#6366F1', tailwind: 'text-indigo-600 bg-indigo-100 border-indigo-200', name: 'Indigo' },
  { hex: '#14B8A6', tailwind: 'text-teal-600 bg-teal-100 border-teal-200', name: 'Teal' },
  { hex: '#6B7280', tailwind: 'text-gray-600 bg-gray-100 border-gray-200', name: 'Gray' },
];

/**
 * Color Palette Component
 *
 * Features:
 * - Use react-color CirclePicker
 * - Preset colors with Tailwind CSS class mapping
 * - Preview badge showing selected color
 * - Click to select
 *
 * Display:
 * - Color picker with preset colors
 * - Preview badge: <span className={value}>Preview</span>
 * - Selected color name
 */
export function ColorPalette({ value, onChange }: ColorPaletteProps) {
  // 実装内容:
  // 1. const selectedColor = PRESET_COLORS.find(c => c.tailwind === value) || PRESET_COLORS[0];
  // 2. <CirclePicker
  //      colors={PRESET_COLORS.map(c => c.hex)}
  //      color={selectedColor.hex}
  //      onChangeComplete={(color) => {
  //        const selected = PRESET_COLORS.find(c => c.hex === color.hex);
  //        if (selected) onChange(selected.tailwind);
  //      }}
  //    />
  // 3. <div>Preview: <span className={`${value} px-3 py-1 rounded-full border`}>Badge</span></div>
  // 4. <div>Selected: {selectedColor.name}</div>
  // 5. Dark mode対応
}
```

---

## 3. E2Eテスト実装

### 3.1 テストファイル

`core/e2e/dashboard-settings-activity-types.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

/**
 * Activity Types Settings E2E Tests
 *
 * Test Coverage:
 * 1. Display activity types settings page (admin only)
 * 2. Prevent non-admin access (403)
 * 3. List existing activity types
 * 4. Create new activity type with ActionCombobox (select existing)
 * 5. Create new activity type with ActionCombobox (type new action)
 * 6. Update activity type (change icon)
 * 7. Update activity type (change color)
 * 8. Update activity type (change funnel stage)
 * 9. Delete activity type
 * 10. Validation: duplicate action error
 * 11. ActionCombobox: autocomplete suggestions
 * 12. IconPicker: search and select icon
 * 13. ColorPalette: select preset color
 *
 * Total: 13 tests
 */

/**
 * Helper: Login as admin
 */
async function loginAsAdmin(page) {
  // 実装内容:
  // await page.goto('https://devcle.test/login');
  // await page.fill('[name="email"]', 'admin@example.com');
  // await page.fill('[name="password"]', 'admin123456');
  // await page.click('button[type="submit"]');
  // await page.waitForURL('https://devcle.test/dashboard');
}

/**
 * Helper: Login as member
 */
async function loginAsMember(page) {
  // 実装内容:
  // await page.goto('https://devcle.test/login');
  // await page.fill('[name="email"]', 'test@example.com');
  // await page.fill('[name="password"]', 'password123');
  // await page.click('button[type="submit"]');
  // await page.waitForURL('https://devcle.test/dashboard');
}

test.describe('Activity Types Settings', () => {
  test('should display activity types settings page (admin only)', async ({ page }) => {
    // 実装内容:
    // 1. loginAsAdmin(page)
    // 2. await page.goto('https://devcle.test/dashboard/settings/activity-types')
    // 3. await expect(page.locator('h1')).toContainText('Activity Type Settings')
    // 4. await expect(page.locator('button:has-text("Create Activity Type")')).toBeVisible()
  });

  test('should prevent non-admin access', async ({ page }) => {
    // 実装内容:
    // 1. loginAsMember(page)
    // 2. await page.goto('https://devcle.test/dashboard/settings/activity-types')
    // 3. await expect(page.locator('text=403')).toBeVisible() OR
    //    await expect(page.locator('text=Forbidden')).toBeVisible()
  });

  test('should list existing activity types', async ({ page }) => {
    // 実装内容:
    // 1. loginAsAdmin(page)
    // 2. await page.goto('https://devcle.test/dashboard/settings/activity-types')
    // 3. await expect(page.locator('table tbody tr')).toHaveCount(5) // Default: click, attend, signup, post, star
    // 4. await expect(page.locator('td:has-text("click")')).toBeVisible()
  });

  test('should create new activity type (select existing action)', async ({ page }) => {
    // 実装内容:
    // 1. loginAsAdmin(page)
    // 2. await page.goto('https://devcle.test/dashboard/settings/activity-types')
    // 3. await page.click('button:has-text("Create Activity Type")')
    // 4. await page.fill('[name="action"]', 'contribute')
    // 5. await page.click('[data-testid="icon-picker-suggestion-heroicons:code-bracket"]')
    // 6. await page.click('[data-testid="color-palette-blue"]')
    // 7. await page.selectOption('[name="funnelStageId"]', { label: 'Engagement' })
    // 8. await page.click('button:has-text("Create")')
    // 9. await expect(page.locator('text=Activity type created successfully')).toBeVisible()
    // 10. await expect(page.locator('td:has-text("contribute")')).toBeVisible()
  });

  test('should create new activity type (type new action)', async ({ page }) => {
    // 実装内容:
    // 1. loginAsAdmin(page)
    // 2. await page.goto('https://devcle.test/dashboard/settings/activity-types')
    // 3. await page.click('button:has-text("Create Activity Type")')
    // 4. await page.fill('[name="action"]', 'download')
    // 5. await page.fill('[name="iconName"]', 'heroicons:arrow-down-tray')
    // 6. await page.click('[data-testid="color-palette-purple"]')
    // 7. await page.click('button:has-text("Create")')
    // 8. await expect(page.locator('text=Activity type created successfully')).toBeVisible()
  });

  test('should update activity type (change icon)', async ({ page }) => {
    // 実装内容:
    // 1. loginAsAdmin(page)
    // 2. await page.goto('https://devcle.test/dashboard/settings/activity-types')
    // 3. await page.click('button:has-text("Edit"):near(td:has-text("click"))')
    // 4. await page.fill('[name="iconName"]', 'heroicons:cursor-arrow-ripple')
    // 5. await page.click('button:has-text("Update")')
    // 6. await expect(page.locator('text=Activity type updated successfully')).toBeVisible()
  });

  test('should update activity type (change color)', async ({ page }) => {
    // 実装内容:
    // 1. loginAsAdmin(page)
    // 2. await page.goto('https://devcle.test/dashboard/settings/activity-types')
    // 3. await page.click('button:has-text("Edit"):near(td:has-text("click"))')
    // 4. await page.click('[data-testid="color-palette-green"]')
    // 5. await page.click('button:has-text("Update")')
    // 6. await expect(page.locator('text=Activity type updated successfully')).toBeVisible()
  });

  test('should update activity type (change funnel stage)', async ({ page }) => {
    // 実装内容:
    // 1. loginAsAdmin(page)
    // 2. await page.goto('https://devcle.test/dashboard/settings/activity-types')
    // 3. await page.click('button:has-text("Edit"):near(td:has-text("click"))')
    // 4. await page.selectOption('[name="funnelStageId"]', { label: 'Adoption' })
    // 5. await page.click('button:has-text("Update")')
    // 6. await expect(page.locator('text=Activity type updated successfully')).toBeVisible()
  });

  test('should delete activity type', async ({ page }) => {
    // 実装内容:
    // 1. loginAsAdmin(page)
    // 2. await page.goto('https://devcle.test/dashboard/settings/activity-types')
    // 3. const initialCount = await page.locator('table tbody tr').count()
    // 4. await page.click('button:has-text("Delete"):near(td:has-text("click"))')
    // 5. await page.click('button:has-text("Confirm")') // Confirmation dialog
    // 6. await expect(page.locator('text=Activity type deleted successfully')).toBeVisible()
    // 7. const newCount = await page.locator('table tbody tr').count()
    // 8. expect(newCount).toBe(initialCount - 1)
  });

  test('should show validation error for duplicate action', async ({ page }) => {
    // 実装内容:
    // 1. loginAsAdmin(page)
    // 2. await page.goto('https://devcle.test/dashboard/settings/activity-types')
    // 3. await page.click('button:has-text("Create Activity Type")')
    // 4. await page.fill('[name="action"]', 'click') // Duplicate
    // 5. await page.fill('[name="iconName"]', 'heroicons:bolt')
    // 6. await page.click('[data-testid="color-palette-gray"]')
    // 7. await page.click('button:has-text("Create")')
    // 8. await expect(page.locator('text=Activity type with this action already exists')).toBeVisible()
  });

  test('should show autocomplete suggestions in ActionCombobox', async ({ page }) => {
    // 実装内容:
    // 1. loginAsAdmin(page)
    // 2. await page.goto('https://devcle.test/dashboard/settings/activity-types')
    // 3. await page.click('button:has-text("Create Activity Type")')
    // 4. await page.fill('[name="action"]', 'c')
    // 5. await expect(page.locator('option[value="click"]')).toBeVisible()
  });

  test('should allow searching and selecting icon', async ({ page }) => {
    // 実装内容:
    // 1. loginAsAdmin(page)
    // 2. await page.goto('https://devcle.test/dashboard/settings/activity-types')
    // 3. await page.click('button:has-text("Create Activity Type")')
    // 4. await page.fill('[name="iconName"]', 'heroicons:code-bracket')
    // 5. await expect(page.locator('[data-testid="icon-preview"]')).toBeVisible()
    // 6. // Icon preview should show heroicons:code-bracket
  });

  test('should select preset color from palette', async ({ page }) => {
    // 実装内容:
    // 1. loginAsAdmin(page)
    // 2. await page.goto('https://devcle.test/dashboard/settings/activity-types')
    // 3. await page.click('button:has-text("Create Activity Type")')
    // 4. await page.click('[data-testid="color-palette-purple"]')
    // 5. await expect(page.locator('[data-testid="color-preview"]')).toHaveClass(/text-purple-600/)
    // 6. await expect(page.locator('text=Purple')).toBeVisible() // Selected color name
  });
});
```

---

## 4. 実装完了条件

- [ ] `app/routes/dashboard.settings.activity-types.tsx`が作成されている
- [ ] 全UIコンポーネントが実装されている：
  - [ ] ActivityTypeTable
  - [ ] ActivityTypeForm
  - [ ] ActionCombobox
  - [ ] IconPicker
  - [ ] ColorPalette
- [ ] 設定画面でアクティビティタイプのCRUDが動作する：
  - [ ] 一覧表示
  - [ ] 作成（ActionCombobox で既存/新規選択）
  - [ ] 編集（Icon/Color/FunnelStage変更）
  - [ ] 削除（確認ダイアログ付き）
- [ ] E2Eテストが全てパスする（13テスト）
- [ ] TypeScriptエラーが0件
- [ ] Admin以外はアクセスできない（403エラー）
- [ ] ダークモード対応が完了している
- [ ] Toast通知が成功/エラー時に表示される

---

## 5. セキュリティ考慮事項

### 5.1 アクセス制御

- **Admin専用**: loader/actionの両方で`requireAuth(request)`でadmin権限チェック
- **403 Forbidden**: 非adminユーザーには403エラーを返す

### 5.2 入力検証

- **Action**: 1-100文字、空文字不可（フロントエンド + バックエンド両方）
- **Icon name**: 1-255文字、必須
- **Color class**: 1-255文字、必須
- **Funnel stage ID**: UUIDまたはnull

### 5.3 CSRF保護

- Remix組み込みのCSRF保護を使用（session-based）

---

## 6. パフォーマンス考慮事項

### 6.1 データフェッチ

- **loaderでまとめて取得**: activityTypesとfunnelStagesをloaderで一度に取得
- **Fetcherでフォーム送信**: useFetcher()を使用してページリロードなし

### 6.2 アイコンプレビュー

- **@iconify/react**: 必要なアイコンのみを遅延ロード
- **IconifyのCDN**: Iconify APIを使用してアイコンをCDNから取得

---

## 7. 実装順序

1. **メイン画面実装**（1時間）
   - `dashboard.settings.activity-types.tsx`作成
   - loader/action実装
   - 基本レイアウト実装

2. **ActivityTypeTable実装**（30分）
   - テーブルレイアウト
   - Icon/Color preview
   - Edit/Delete buttons

3. **ActivityTypeForm実装**（1時間）
   - フォームレイアウト
   - ActionCombobox統合
   - IconPicker統合
   - ColorPalette統合
   - Funnel stage dropdown

4. **ActionCombobox実装**（15分）
   - `<input>` + `<datalist>`パターン
   - 既存アクション選択 + 新規入力

5. **IconPicker実装**（15分）
   - テキスト入力 + @iconify/react preview
   - Popular iconsのsuggestions

6. **ColorPalette実装**（15分）
   - react-color CirclePicker統合
   - PRESET_COLORS定義
   - Preview badge

7. **E2Eテスト作成**（1時間）
   - 13テスト作成・実行
   - 全テストパス確認

---

## 8. 技術スタック

### 8.1 使用ライブラリ

- **@iconify/react**: アイコンプレビュー（既存プロジェクトで使用中）
- **react-color**: カラーピッカー（CirclePicker）
- **Remix**: ルーティング、loader/action、useFetcher
- **Tailwind CSS**: スタイリング、ダークモード

### 8.2 データフロー

```
User Action
    ↓
useFetcher (form submission)
    ↓
action() handler (Remix)
    ↓
service layer (activity-type.service.ts)
    ↓
database (activity_types table)
    ↓
loader() handler (Remix)
    ↓
useLoaderData (component)
    ↓
UI Update
```

---

## 9. 参考リンク

- [@iconify/react](https://iconify.design/docs/icon-components/react/) - Icon component
- [react-color](https://casesandberg.github.io/react-color/) - Color picker library
- [Iconify Icon Sets](https://icon-sets.iconify.design/) - Available icon sets
- [Tailwind CSS Colors](https://tailwindcss.com/docs/customizing-colors) - Color palette
- [Heroicons](https://heroicons.com/) - Icon library

---

**推定時間**: 3.5時間
**内訳**:
1. メイン画面実装 - 1時間
2. ActivityTypeTable実装 - 30分
3. ActivityTypeForm実装 - 1時間
4. ActionCombobox実装 - 15分
5. IconPicker実装 - 15分
6. ColorPalette実装 - 15分
7. E2Eテスト作成 - 1時間

**完了条件**: 設定画面でアクティビティタイプのCRUDが完全に動作し、ActionCombobox/IconPicker/ColorPaletteが正常に機能し、E2Eテストが全てパスする
