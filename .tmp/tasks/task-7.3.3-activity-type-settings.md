# Task 7.3.3: アクティビティカラーとアイコンの設定画面実装

**推定時間**: 5時間
**依存**: Task 7.3（Developersページ実装）
**優先度**: 中

## 概要

システム設定画面の一部として、アクティビティタイプごとのカラーとアイコンを設定できる画面を実装する。これにより、管理者はアクティビティの見た目をカスタマイズでき、ファネルステージとの紐付けも可能になる。

## 背景

現在の`ActivityTimeline.tsx`は、アクティビティのカラーとアイコンをハードコーディングしている（`getActivityColor()`, `getActivityIconName()`関数内）。これを動的な設定に変更し、管理者が設定画面から自由にカスタマイズできるようにする。

## スコープ

このタスク（7.3.3）では以下を実装する：

1. データベーススキーマ追加（`activity_types`テーブル）
2. サービス層実装（CRUD + デフォルトシードデータ）
3. API層実装（CRUD endpoints）
4. UI層実装（設定画面）
5. E2Eテスト作成

**注**: `ActivityTimeline.tsx`の動的カラー・アイコン適用は別タスク（7.3.4）で実装する。

---

## 1. データベーススキーマ定義

### 1.1 テーブル定義

`core/db/schema/admin.ts`に以下のテーブルを追加：

```typescript
/**
 * Activity Types Table
 *
 * Defines customizable activity types with icons, colors, and funnel stage mapping.
 * Allows administrators to customize how different activity actions are displayed.
 *
 * Examples:
 * - action: 'click' → icon: 'heroicons:cursor-arrow-rays' → color: 'text-blue-600 bg-blue-100'
 * - action: 'attend' → icon: 'heroicons:calendar-days' → color: 'text-green-600 bg-green-100'
 * - action: 'signup' → icon: 'heroicons:user-plus' → color: 'text-purple-600 bg-purple-100'
 * - action: 'post' → icon: 'heroicons:chat-bubble-left-right' → color: 'text-orange-600 bg-orange-100'
 * - action: 'star' → icon: 'heroicons:star' → color: 'text-yellow-600 bg-yellow-100'
 */
export const activityTypes = pgTable('activity_types', {
  activityTypeId: uuid('activity_type_id').primaryKey().defaultRandom(),
  tenantId: varchar('tenant_id', { length: 255 }).notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),

  // Activity action (e.g., 'click', 'attend', 'signup', 'post', 'star')
  action: varchar('action', { length: 100 }).notNull(),

  // Iconify icon name (e.g., 'heroicons:bolt', 'mdi:github')
  iconName: varchar('icon_name', { length: 255 }).notNull().default('heroicons:bolt'),

  // Tailwind CSS classes for styling (e.g., 'text-blue-600 bg-blue-100 border-blue-200')
  colorClass: varchar('color_class', { length: 255 }).notNull().default('text-gray-600 bg-gray-100 border-gray-200'),

  // Optional funnel stage mapping
  funnelStageId: uuid('funnel_stage_id').references(() => funnelStages.funnelStageId, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: one action per tenant
  uniqueTenantAction: unique().on(table.tenantId, table.action),
}));
```

### 1.2 マイグレーション

Drizzle-kitでマイグレーションを生成：

```bash
docker compose exec core pnpm db:generate
docker compose exec core pnpm db:migrate
```

---

## 2. サービス層定義

### 2.1 スキーマファイル

`core/services/activity-type.schemas.ts`

```typescript
import { z } from 'zod';

/**
 * Schema for creating an activity type
 */
export const CreateActivityTypeSchema = z.object({
  action: z.string().min(1).max(100),
  iconName: z.string().min(1).max(255).default('heroicons:bolt'),
  colorClass: z.string().min(1).max(255).default('text-gray-600 bg-gray-100 border-gray-200'),
  funnelStageId: z.string().uuid().nullable().optional(),
});

/**
 * Schema for updating an activity type
 */
export const UpdateActivityTypeSchema = z.object({
  iconName: z.string().min(1).max(255).optional(),
  colorClass: z.string().min(1).max(255).optional(),
  funnelStageId: z.string().uuid().nullable().optional(),
});

/**
 * Schema for listing activity types
 */
export const ListActivityTypesSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type CreateActivityType = z.infer<typeof CreateActivityTypeSchema>;
export type UpdateActivityType = z.infer<typeof UpdateActivityTypeSchema>;
export type ListActivityTypes = z.infer<typeof ListActivityTypesSchema>;
```

### 2.2 サービス実装

`core/services/activity-type.service.ts`

```typescript
import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { CreateActivityType, UpdateActivityType, ListActivityTypes } from './activity-type.schemas.js';

/**
 * Create a new activity type
 *
 * @param tenantId - Tenant ID
 * @param data - Activity type data
 * @returns Created activity type
 * @throws Error if action already exists
 */
export async function createActivityType(
  tenantId: string,
  data: CreateActivityType
): Promise<typeof schema.activityTypes.$inferSelect> {
  // Implementation: Use withTenantContext() to insert new activity type
  // Return inserted record
}

/**
 * Get activity type by action
 *
 * @param tenantId - Tenant ID
 * @param action - Activity action
 * @returns Activity type or null if not found
 */
export async function getActivityTypeByAction(
  tenantId: string,
  action: string
): Promise<typeof schema.activityTypes.$inferSelect | null> {
  // Implementation: Use withTenantContext() to query by action
  // Return found record or null
}

/**
 * List all activity types for a tenant
 *
 * @param tenantId - Tenant ID
 * @param params - Pagination parameters
 * @returns List of activity types
 */
export async function listActivityTypes(
  tenantId: string,
  params: ListActivityTypes
): Promise<Array<typeof schema.activityTypes.$inferSelect>> {
  // Implementation: Use withTenantContext() to list with pagination
  // Return array of activity types
}

/**
 * Update an activity type
 *
 * @param tenantId - Tenant ID
 * @param action - Activity action to update
 * @param data - Update data
 * @returns Updated activity type
 * @throws Error if activity type not found
 */
export async function updateActivityType(
  tenantId: string,
  action: string,
  data: UpdateActivityType
): Promise<typeof schema.activityTypes.$inferSelect> {
  // Implementation: Use withTenantContext() to update activity type
  // Return updated record
  // Throw error if not found
}

/**
 * Delete an activity type
 *
 * @param tenantId - Tenant ID
 * @param action - Activity action to delete
 * @throws Error if activity type not found
 */
export async function deleteActivityType(
  tenantId: string,
  action: string
): Promise<void> {
  // Implementation: Use withTenantContext() to delete activity type
  // Throw error if not found
}

/**
 * Seed default activity types for a tenant
 *
 * Default types:
 * - click: heroicons:cursor-arrow-rays, text-blue-600 bg-blue-100 border-blue-200
 * - attend: heroicons:calendar-days, text-green-600 bg-green-100 border-green-200
 * - signup: heroicons:user-plus, text-purple-600 bg-purple-100 border-purple-200
 * - post: heroicons:chat-bubble-left-right, text-orange-600 bg-orange-100 border-orange-200
 * - star: heroicons:star, text-yellow-600 bg-yellow-100 border-yellow-200
 *
 * @param tenantId - Tenant ID
 */
export async function seedDefaultActivityTypes(tenantId: string): Promise<void> {
  // Implementation: Use withTenantContext() to insert default activity types
  // Use ON CONFLICT DO NOTHING to support idempotency
}
```

---

## 3. API層定義

### 3.1 CRUD API

`app/routes/api.activity-types.ts`

```typescript
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../middleware/auth.server.js';
import {
  listActivityTypes,
  createActivityType,
  ListActivityTypesSchema,
  CreateActivityTypeSchema,
} from '../../services/activity-type.service.js';

/**
 * GET /api/activity-types
 *
 * List all activity types for the current tenant
 *
 * Query params:
 * - limit: number (default: 50, max: 100)
 * - offset: number (default: 0)
 *
 * Response:
 * {
 *   activityTypes: Array<ActivityType>
 * }
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Implementation:
  // 1. Require admin authentication
  // 2. Parse query params with ListActivityTypesSchema
  // 3. Call listActivityTypes(tenantId, params)
  // 4. Return JSON response
}

/**
 * POST /api/activity-types
 *
 * Create a new activity type
 *
 * Request body:
 * {
 *   action: string,
 *   iconName?: string,
 *   colorClass?: string,
 *   funnelStageId?: string | null
 * }
 *
 * Response:
 * {
 *   activityType: ActivityType
 * }
 *
 * Errors:
 * - 400: Invalid request body
 * - 401: Unauthorized
 * - 403: Admin role required
 * - 409: Activity type with this action already exists
 * - 500: Internal server error
 */
export async function action({ request }: ActionFunctionArgs) {
  // Implementation:
  // 1. Check method is POST
  // 2. Require admin authentication
  // 3. Parse request body with CreateActivityTypeSchema
  // 4. Call createActivityType(tenantId, data)
  // 5. Return JSON response
  // 6. Handle errors (409 for duplicate action)
}
```

### 3.2 個別リソース API

`app/routes/api.activity-types.$action.ts`

```typescript
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '../middleware/auth.server.js';
import {
  getActivityTypeByAction,
  updateActivityType,
  deleteActivityType,
  UpdateActivityTypeSchema,
} from '../../services/activity-type.service.js';

/**
 * GET /api/activity-types/:action
 *
 * Get activity type by action
 *
 * Response:
 * {
 *   activityType: ActivityType
 * }
 *
 * Errors:
 * - 401: Unauthorized
 * - 404: Activity type not found
 * - 500: Internal server error
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  // Implementation:
  // 1. Require authentication
  // 2. Get action from params
  // 3. Call getActivityTypeByAction(tenantId, action)
  // 4. Return JSON response or 404
}

/**
 * PUT /api/activity-types/:action
 * DELETE /api/activity-types/:action
 *
 * Update or delete activity type
 *
 * PUT request body:
 * {
 *   iconName?: string,
 *   colorClass?: string,
 *   funnelStageId?: string | null
 * }
 *
 * Response:
 * {
 *   activityType: ActivityType (for PUT)
 * }
 *
 * Errors:
 * - 400: Invalid request body (PUT)
 * - 401: Unauthorized
 * - 403: Admin role required
 * - 404: Activity type not found
 * - 405: Method not allowed
 * - 500: Internal server error
 */
export async function action({ request, params }: ActionFunctionArgs) {
  // Implementation:
  // 1. Require admin authentication
  // 2. Get action from params
  // 3. Check method (PUT or DELETE)
  // 4. For PUT: parse body with UpdateActivityTypeSchema, call updateActivityType()
  // 5. For DELETE: call deleteActivityType()
  // 6. Return JSON response
  // 7. Handle errors (404 for not found)
}
```

---

## 4. UI層定義

### 4.1 設定画面

`app/routes/dashboard.settings.activity-types.tsx`

```typescript
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import { requireAuth } from '../middleware/auth.server.js';
import { listActivityTypes, listFunnelStages } from '../../services/...';

/**
 * Activity Types Settings Page
 *
 * Features:
 * - List all activity types in a table
 * - Create new activity type
 * - Edit existing activity type (icon picker, color palette, funnel stage dropdown)
 * - Delete activity type
 * - Admin-only access
 *
 * UI Components:
 * - ActivityTypeTable: Displays all activity types with actions
 * - ActivityTypeForm: Create/Edit form with icon picker and color palette
 * - IconPicker: Iconify icon search and selection UI
 * - ColorPalette: Tailwind color class selection UI
 */

export async function loader({ request }: LoaderFunctionArgs) {
  // Implementation:
  // 1. Require admin authentication
  // 2. Load activity types using listActivityTypes()
  // 3. Load funnel stages for dropdown
  // 4. Return JSON with activityTypes and funnelStages
}

export async function action({ request }: ActionFunctionArgs) {
  // Implementation:
  // 1. Require admin authentication
  // 2. Parse form data
  // 3. Handle create/update/delete based on intent
  // 4. Return JSON response with success/error message
}

export default function ActivityTypesSettings() {
  // Implementation:
  // 1. Use useLoaderData() to get activity types and funnel stages
  // 2. Use useFetcher() for form submissions (no page reload)
  // 3. Render ActivityTypeTable with edit/delete buttons
  // 4. Render ActivityTypeForm for create/edit
  // 5. Show toast notifications for success/error
  // 6. Support dark/light mode
}
```

### 4.2 UIコンポーネント

```typescript
/**
 * ActivityTypeTable Component
 *
 * Props:
 * - activityTypes: Array<ActivityType>
 * - onEdit: (action: string) => void
 * - onDelete: (action: string) => void
 *
 * Displays:
 * - Action name
 * - Icon preview (Iconify component)
 * - Color preview (colored badge)
 * - Funnel stage (if mapped)
 * - Edit/Delete buttons
 */

/**
 * ActivityTypeForm Component
 *
 * Props:
 * - mode: 'create' | 'edit'
 * - initialData?: ActivityType
 * - funnelStages: Array<FunnelStage>
 * - onSubmit: (data: FormData) => void
 * - onCancel: () => void
 *
 * Fields:
 * - Action (text input, disabled in edit mode)
 * - Icon picker (IconPicker component)
 * - Color palette (ColorPalette component)
 * - Funnel stage (dropdown, optional)
 * - Submit/Cancel buttons
 */

/**
 * IconPicker Component
 *
 * Props:
 * - value: string (Iconify icon name)
 * - onChange: (iconName: string) => void
 *
 * Features:
 * - Search input for icon name
 * - Icon preview
 * - Popular icons gallery (heroicons, mdi, etc.)
 * - Click to select
 */

/**
 * ColorPalette Component
 *
 * Props:
 * - value: string (Tailwind CSS classes)
 * - onChange: (colorClass: string) => void
 *
 * Features:
 * - Predefined color swatches (blue, green, purple, orange, yellow, etc.)
 * - Preview of selected color
 * - Click to select
 * - Generates: 'text-{color}-600 bg-{color}-100 border-{color}-200'
 */
```

---

## 5. E2Eテスト要件

`core/e2e/dashboard-settings-activity-types.spec.ts`

```typescript
/**
 * Activity Types Settings E2E Tests
 *
 * Test Coverage:
 * 1. Display activity types settings page (admin only)
 * 2. Prevent non-admin access (403)
 * 3. List existing activity types
 * 4. Create new activity type
 * 5. Update activity type (change icon)
 * 6. Update activity type (change color)
 * 7. Update activity type (change funnel stage)
 * 8. Delete activity type
 * 9. Validation: duplicate action error
 * 10. Icon picker functionality
 * 11. Color palette functionality
 *
 * Total: 11 tests
 */
```

### テスト例

```typescript
test('should create new activity type', async ({ page }) => {
  // 1. Login as admin
  // 2. Navigate to /dashboard/settings/activity-types
  // 3. Click "Create Activity Type" button
  // 4. Fill form:
  //    - action: 'contribute'
  //    - icon: 'heroicons:code-bracket'
  //    - color: blue
  //    - funnel stage: 'Engagement'
  // 5. Submit form
  // 6. Verify toast notification: "Activity type created successfully"
  // 7. Verify new row appears in table
});

test('should update activity type icon', async ({ page }) => {
  // 1. Login as admin
  // 2. Navigate to /dashboard/settings/activity-types
  // 3. Click "Edit" button for 'click' action
  // 4. Open icon picker
  // 5. Select new icon: 'heroicons:cursor-arrow-ripple'
  // 6. Submit form
  // 7. Verify toast notification: "Activity type updated successfully"
  // 8. Verify icon preview changed in table
});
```

---

## 6. 実装完了条件

- [ ] `activity_types`テーブルがデータベースに作成されている
- [ ] マイグレーションが正常に実行できる
- [ ] サービス層のCRUD操作が単体テストでパスする（20+ tests）
- [ ] API層のCRUD操作が統合テストでパスする（15+ tests）
- [ ] 設定画面が表示され、アクティビティタイプの作成・編集・削除ができる
- [ ] アイコンピッカーとカラーパレットが正常に動作する
- [ ] E2Eテストが全てパスする（11 tests）
- [ ] TypeScriptエラーが0件
- [ ] Admin以外はアクセスできない（403エラー）
- [ ] ダークモード対応が完了している

---

## 7. セキュリティ考慮事項

### 7.1 アクセス制御

- **Admin専用**: 設定画面とAPIはadminロールのみアクセス可能
- **RLS enforcement**: `withTenantContext()`を使用してテナント分離

### 7.2 入力検証

- **Action**: 1-100文字、空文字不可
- **Icon name**: 1-255文字、Iconifyフォーマット推奨
- **Color class**: 1-255文字、Tailwind CSSクラス推奨
- **Funnel stage ID**: UUIDまたはnull

### 7.3 重複チェック

- **Unique constraint**: (tenant_id, action)でDBレベルで重複防止
- **API層**: 409 Conflictエラーを返す

---

## 8. パフォーマンス考慮事項

### 8.1 クエリ最適化

- **Index**: (tenant_id, action)に自動インデックス（unique constraint）
- **Pagination**: limit/offset対応で大量データに対応

### 8.2 キャッシング

- **設定データ**: 頻繁に変更されないため、将来的にRedisキャッシュ検討可能

---

## 9. 実装順序

1. **データベーススキーマ追加**（30分）
   - `activity_types`テーブル定義
   - マイグレーション生成・適用

2. **サービス層実装**（2時間）
   - スキーマファイル作成
   - CRUD関数実装
   - デフォルトシード関数実装
   - 単体テスト作成（20+ tests）

3. **API層実装**（1.5時間）
   - CRUD API実装
   - 統合テスト作成（15+ tests）

4. **UI層実装**（2時間）
   - 設定画面実装
   - アイコンピッカー実装
   - カラーパレット実装
   - フォーム実装

5. **E2Eテスト作成**（1時間）
   - 11テスト作成・実行

---

## 10. 補足

### 10.1 デフォルトアクティビティタイプ

テナント作成時に以下のデフォルトタイプをシード：

| Action   | Icon                                | Color Class                                       | Funnel Stage |
|----------|-------------------------------------|---------------------------------------------------|--------------|
| click    | heroicons:cursor-arrow-rays         | text-blue-600 bg-blue-100 border-blue-200         | Awareness    |
| attend   | heroicons:calendar-days             | text-green-600 bg-green-100 border-green-200      | Engagement   |
| signup   | heroicons:user-plus                 | text-purple-600 bg-purple-100 border-purple-200   | Engagement   |
| post     | heroicons:chat-bubble-left-right    | text-orange-600 bg-orange-100 border-orange-200   | Advocacy     |
| star     | heroicons:star                      | text-yellow-600 bg-yellow-100 border-yellow-200   | Advocacy     |

### 10.2 参考リンク

- [Iconify Icon Sets](https://icon-sets.iconify.design/)
- [Tailwind CSS Colors](https://tailwindcss.com/docs/customizing-colors)
- [Heroicons](https://heroicons.com/)

---

**推定時間**: 5時間
**完了条件**: 設定画面でアクティビティタイプのCRUDが完全に動作し、E2Eテストが全てパスする
