# Task 8.7: プラグインの設定編集実装

**Status:** ドキュメント作成完了
**Branch:** `feature/task-8.7-plugin-settings-edit`
**Estimated Time:** 4 時間

---

## 概要

プラグインの設定を編集するための Web UI と API を実装します。

### 責務

- **動的フォーム生成**: `plugin.json` で定義された設定項目に基づいてフォームを動的に生成
- **機密情報の暗号化**: API キー、トークンなどの機密情報を暗号化して保存
- **バリデーション**: 設定項目のバリデーション（型チェック、必須チェック、形式チェック）
- **設定更新 API**: プラグイン設定を更新するための REST API エンドポイント

---

## plugin.json の config スキーマ定義

プラグインの `plugin.json` に `config` フィールドを追加することで、設定項目を定義できます。

### 設定項目の型定義

```typescript
/**
 * プラグイン設定項目の型
 */
type PluginConfigFieldType =
  | 'string'      // 通常の文字列
  | 'secret'      // 機密情報（暗号化して保存、UI では *** で表示）
  | 'number'      // 数値
  | 'boolean'     // 真偽値
  | 'url'         // URL（形式検証あり）
  | 'email'       // メールアドレス（形式検証あり）
  | 'select';     // 選択肢（options フィールドが必須）

/**
 * プラグイン設定項目の定義
 */
interface PluginConfigField {
  /** フィールド名（識別子、例: "apiKey"） */
  name: string;

  /** 表示ラベル（例: "API Key"） */
  label: string;

  /** フィールドの型 */
  type: PluginConfigFieldType;

  /** 必須フィールドかどうか */
  required: boolean;

  /** デフォルト値 */
  default?: string | number | boolean;

  /** ヘルプテキスト（フィールドの説明） */
  help?: string;

  /** プレースホルダー（入力例） */
  placeholder?: string;

  /** 選択肢（type = 'select' の場合） */
  options?: Array<{ label: string; value: string | number }>;

  /** バリデーションルール */
  validation?: {
    /** 最小値（number 型の場合） */
    min?: number;

    /** 最大値（number 型の場合） */
    max?: number;

    /** 最小文字数（string 型の場合） */
    minLength?: number;

    /** 最大文字数（string 型の場合） */
    maxLength?: number;

    /** 正規表現パターン（string 型の場合） */
    pattern?: string;
  };
}

/**
 * プラグイン設定スキーマ（plugin.json の drm.config フィールド）
 */
interface PluginConfigSchema {
  /** 設定項目のリスト */
  fields: PluginConfigField[];
}
```

### 例: Google Analytics プラグインの設定

```json
{
  "name": "drowl-plugin-google-analytics",
  "version": "1.0.0",
  "description": "Google Analytics integration for DRM",
  "main": "dist/index.js",
  "drm": {
    "type": "analytics",
    "coreVersion": "^0.1.0",
    "config": {
      "fields": [
        {
          "name": "apiKey",
          "label": "Google Analytics API Key",
          "type": "secret",
          "required": true,
          "help": "Your Google Analytics API key. You can find it in the Google Cloud Console.",
          "placeholder": "AIzaSy..."
        },
        {
          "name": "propertyId",
          "label": "Property ID",
          "type": "string",
          "required": true,
          "help": "Your Google Analytics Property ID (e.g., G-XXXXXXXXXX)",
          "placeholder": "G-XXXXXXXXXX",
          "validation": {
            "pattern": "^G-[A-Z0-9]{10}$"
          }
        },
        {
          "name": "syncInterval",
          "label": "Sync Interval (hours)",
          "type": "number",
          "required": false,
          "default": 24,
          "help": "How often to sync data from Google Analytics (in hours)",
          "validation": {
            "min": 1,
            "max": 168
          }
        },
        {
          "name": "enabled",
          "label": "Enable Sync",
          "type": "boolean",
          "required": false,
          "default": true,
          "help": "Enable automatic data synchronization"
        }
      ]
    }
  }
}
```

---

## API 仕様

### PUT /api/plugins/:id/config - プラグイン設定更新

プラグインの設定を更新します。

```typescript
/**
 * PUT /api/plugins/:id/config
 *
 * Request: UpdatePluginConfigRequest
 * Response: UpdatePluginConfigResponse
 */
interface UpdatePluginConfigRequest {
  /** 設定値（key-value ペア） */
  config: Record<string, unknown>;
}

interface UpdatePluginConfigResponse {
  /** 成功フラグ */
  success: boolean;

  /** 更新されたプラグイン情報 */
  plugin: {
    pluginId: string;
    key: string;
    name: string;
    version: string;
    enabled: boolean;
    updatedAt: string;
  };
}
```

#### リクエスト例

```json
{
  "config": {
    "apiKey": "AIzaSyXXXXXXXXXXXXXXXXXXXXXX",
    "propertyId": "G-XXXXXXXXXX",
    "syncInterval": 24,
    "enabled": true
  }
}
```

#### レスポンス例（成功）

```json
{
  "success": true,
  "plugin": {
    "pluginId": "550e8400-e29b-41d4-a716-446655440000",
    "key": "drowl-plugin-google-analytics",
    "name": "Google Analytics",
    "version": "1.0.0",
    "enabled": true,
    "updatedAt": "2025-10-27T12:34:56.789Z"
  }
}
```

#### エラーレスポンス

```typescript
interface ApiErrorResponse {
  /** エラーステータスコード */
  status: number;

  /** エラーメッセージ */
  message: string;

  /** エラーコード */
  code?: string;

  /** バリデーションエラーの詳細 */
  errors?: Array<{
    field: string;
    message: string;
  }>;
}
```

**エラーシナリオ:**

- **400 Bad Request**: バリデーションエラー（必須フィールド未入力、型不一致、形式エラー）
- **401 Unauthorized**: 認証エラー（ログインしていない）
- **403 Forbidden**: 権限エラー（admin ロールのみ許可）
- **404 Not Found**: プラグインが存在しない
- **500 Internal Server Error**: サーバーエラー

---

## 暗号化仕様

### 機密情報の暗号化

`type: 'secret'` の設定項目は暗号化して保存します。

```typescript
/**
 * 機密情報フィールドの判定
 */
function isSecretField(field: PluginConfigField): boolean {
  return field.type === 'secret';
}

/**
 * プラグイン設定の暗号化
 *
 * type = 'secret' のフィールドを暗号化
 */
async function encryptPluginConfig(
  schema: PluginConfigSchema,
  config: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const encrypted: Record<string, unknown> = {};

  for (const field of schema.fields) {
    const value = config[field.name];

    if (value !== undefined && value !== null) {
      if (isSecretField(field)) {
        // 暗号化して保存（encryption.ts の encrypt() を使用）
        encrypted[field.name] = await encrypt(String(value));
      } else {
        // 通常のフィールドはそのまま保存
        encrypted[field.name] = value;
      }
    }
  }

  return encrypted;
}

/**
 * プラグイン設定の復号化
 *
 * type = 'secret' のフィールドを復号化
 */
async function decryptPluginConfig(
  schema: PluginConfigSchema,
  config: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const decrypted: Record<string, unknown> = {};

  for (const field of schema.fields) {
    const value = config[field.name];

    if (value !== undefined && value !== null) {
      if (isSecretField(field)) {
        // 復号化して返す（encryption.ts の decrypt() を使用）
        decrypted[field.name] = await decrypt(String(value));
      } else {
        // 通常のフィールドはそのまま返す
        decrypted[field.name] = value;
      }
    }
  }

  return decrypted;
}
```

### 暗号化ライブラリ

Task 7.3.2 で実装された `core/utils/encryption.ts` を使用します。

```typescript
/**
 * core/utils/encryption.ts (既存)
 *
 * AES-256-GCM 暗号化/復号化
 */
export async function encrypt(plaintext: string): Promise<string>;
export async function decrypt(ciphertext: string): Promise<string>;
```

---

## UI 実装

### app/routes/dashboard/plugins.$id.edit.tsx

プラグイン設定編集画面を実装します。

#### Loader

```typescript
/**
 * GET /dashboard/plugins/:id/edit
 *
 * プラグイン設定編集画面のローダー
 */
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireAuth } from '~/services/auth.service';
import { getPluginById } from '~/services/plugin.service';
import { loadPluginMetadata } from '~/plugin-system/loader';

export async function loader({ request, params }: LoaderFunctionArgs) {
  // 1. 認証チェック（admin ロールのみ許可）
  const user = await requireAuth(request);
  if (user.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }

  // 2. プラグイン ID のバリデーション
  const pluginId = params.id;
  if (!pluginId) {
    throw new Response('Plugin ID is required', { status: 400 });
  }

  // 3. プラグイン情報を取得（RLS 対応）
  const plugin = await getPluginById(user.tenantId, pluginId);
  if (!plugin) {
    throw new Response('Plugin not found', { status: 404 });
  }

  // 4. plugin.json から設定スキーマを取得
  const metadata = await loadPluginMetadata(plugin.key);
  const configSchema = metadata.drm?.config;

  if (!configSchema) {
    throw new Response('Plugin does not have configuration schema', {
      status: 400,
    });
  }

  // 5. 現在の設定値を取得（secret フィールドは復号化せず、null を返す）
  const currentConfig = sanitizeConfigForDisplay(
    configSchema,
    plugin.config as Record<string, unknown>
  );

  return json({
    plugin: {
      pluginId: plugin.pluginId,
      key: plugin.key,
      name: plugin.name,
      version: plugin.version,
      enabled: plugin.enabled,
    },
    configSchema,
    currentConfig,
  });
}

/**
 * 表示用に設定値をサニタイズ（secret フィールドを null にする）
 */
function sanitizeConfigForDisplay(
  schema: PluginConfigSchema,
  config: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const field of schema.fields) {
    const value = config[field.name];

    if (field.type === 'secret') {
      // secret フィールドは null を返す（UI では "****" と表示）
      sanitized[field.name] = null;
    } else {
      sanitized[field.name] = value ?? field.default ?? null;
    }
  }

  return sanitized;
}
```

#### Action

```typescript
/**
 * PUT /dashboard/plugins/:id/edit
 *
 * プラグイン設定更新アクション
 */
import type { ActionFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { requireAuth } from '~/services/auth.service';
import { updatePluginConfig } from '~/services/plugin.service';
import { loadPluginMetadata } from '~/plugin-system/loader';
import { validatePluginConfig } from '~/plugin-system/config-validator';

export async function action({ request, params }: ActionFunctionArgs) {
  // 1. 認証チェック（admin ロールのみ許可）
  const user = await requireAuth(request);
  if (user.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }

  // 2. プラグイン ID のバリデーション
  const pluginId = params.id;
  if (!pluginId) {
    throw new Response('Plugin ID is required', { status: 400 });
  }

  // 3. リクエストボディをパース
  const formData = await request.formData();
  const configJson = formData.get('config');
  if (!configJson || typeof configJson !== 'string') {
    throw new Response('Config is required', { status: 400 });
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(configJson);
  } catch {
    throw new Response('Invalid JSON in config', { status: 400 });
  }

  // 4. プラグインメタデータから設定スキーマを取得
  const plugin = await getPluginById(user.tenantId, pluginId);
  if (!plugin) {
    throw new Response('Plugin not found', { status: 404 });
  }

  const metadata = await loadPluginMetadata(plugin.key);
  const configSchema = metadata.drm?.config;
  if (!configSchema) {
    throw new Response('Plugin does not have configuration schema', {
      status: 400,
    });
  }

  // 5. バリデーション
  const validationErrors = validatePluginConfig(configSchema, config);
  if (validationErrors.length > 0) {
    return json(
      {
        success: false,
        errors: validationErrors,
      },
      { status: 400 }
    );
  }

  // 6. 設定を更新（暗号化はサービス層で実行）
  await updatePluginConfig(user.tenantId, pluginId, configSchema, config);

  // 7. プラグイン詳細ページにリダイレクト
  return redirect(`/dashboard/plugins/${pluginId}`);
}
```

#### コンポーネント

```typescript
/**
 * app/routes/dashboard/plugins.$id.edit.tsx
 *
 * プラグイン設定編集フォーム
 */
import { useLoaderData, Form, useNavigation } from '@remix-run/react';
import { useState } from 'react';
import type { PluginConfigSchema, PluginConfigField } from '~/plugin-system/types';

export default function PluginEditPage() {
  const { plugin, configSchema, currentConfig } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  // フォームの状態管理
  const [config, setConfig] = useState<Record<string, unknown>>(currentConfig);

  // フィールド値の変更ハンドラー
  const handleFieldChange = (name: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [name]: value }));
  };

  // フォーム送信ハンドラー
  const handleSubmit = (e: React.FormEvent) => {
    // config を JSON に変換して送信
    const form = e.currentTarget as HTMLFormElement;
    const hiddenInput = form.querySelector('input[name="config"]') as HTMLInputElement;
    hiddenInput.value = JSON.stringify(config);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Edit Plugin: {plugin.name}
      </h1>

      <Form method="put" onSubmit={handleSubmit}>
        {/* 非表示の JSON フィールド */}
        <input type="hidden" name="config" />

        <div className="space-y-6">
          {configSchema.fields.map((field) => (
            <PluginConfigField
              key={field.name}
              field={field}
              value={config[field.name]}
              onChange={(value) => handleFieldChange(field.name, value)}
            />
          ))}
        </div>

        <div className="mt-8 flex gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </button>

          <a
            href={`/dashboard/plugins/${plugin.pluginId}`}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
          >
            Cancel
          </a>
        </div>
      </Form>
    </div>
  );
}

/**
 * 動的フォームフィールドコンポーネント
 */
interface PluginConfigFieldProps {
  field: PluginConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function PluginConfigField({ field, value, onChange }: PluginConfigFieldProps) {
  // フィールドタイプに応じて適切な入力コンポーネントをレンダリング
  switch (field.type) {
    case 'string':
    case 'url':
    case 'email':
      return (
        <StringField
          field={field}
          value={String(value ?? '')}
          onChange={onChange}
        />
      );

    case 'secret':
      return (
        <SecretField
          field={field}
          value={String(value ?? '')}
          onChange={onChange}
        />
      );

    case 'number':
      return (
        <NumberField
          field={field}
          value={Number(value ?? field.default ?? 0)}
          onChange={onChange}
        />
      );

    case 'boolean':
      return (
        <BooleanField
          field={field}
          value={Boolean(value ?? field.default ?? false)}
          onChange={onChange}
        />
      );

    case 'select':
      return (
        <SelectField
          field={field}
          value={value}
          onChange={onChange}
        />
      );

    default:
      return null;
  }
}

/**
 * 文字列フィールド
 */
function StringField({
  field,
  value,
  onChange,
}: {
  field: PluginConfigField;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <input
        type={field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        minLength={field.validation?.minLength}
        maxLength={field.validation?.maxLength}
        pattern={field.validation?.pattern}
        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
      />

      {field.help && (
        <p className="mt-1 text-sm text-gray-500">{field.help}</p>
      )}
    </div>
  );
}

/**
 * シークレットフィールド（パスワード入力）
 */
function SecretField({
  field,
  value,
  onChange,
}: {
  field: PluginConfigField;
  value: string;
  onChange: (value: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={value ? '********' : field.placeholder}
          required={field.required}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 pr-20"
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-blue-600"
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>

      {field.help && (
        <p className="mt-1 text-sm text-gray-500">{field.help}</p>
      )}
    </div>
  );
}

/**
 * 数値フィールド
 */
function NumberField({
  field,
  value,
  onChange,
}: {
  field: PluginConfigField;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={field.placeholder}
        required={field.required}
        min={field.validation?.min}
        max={field.validation?.max}
        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
      />

      {field.help && (
        <p className="mt-1 text-sm text-gray-500">{field.help}</p>
      )}
    </div>
  );
}

/**
 * 真偽値フィールド（チェックボックス）
 */
function BooleanField({
  field,
  value,
  onChange,
}: {
  field: PluginConfigField;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div>
      <label className="flex items-center">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="mr-2"
        />
        <span className="text-sm font-medium">{field.label}</span>
      </label>

      {field.help && (
        <p className="mt-1 text-sm text-gray-500 ml-6">{field.help}</p>
      )}
    </div>
  );
}

/**
 * 選択フィールド（ドロップダウン）
 */
function SelectField({
  field,
  value,
  onChange,
}: {
  field: PluginConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <select
        value={String(value ?? '')}
        onChange={(e) => {
          const selectedOption = field.options?.find(
            (opt) => String(opt.value) === e.target.value
          );
          onChange(selectedOption?.value);
        }}
        required={field.required}
        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
      >
        <option value="">-- Select an option --</option>
        {field.options?.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>

      {field.help && (
        <p className="mt-1 text-sm text-gray-500">{field.help}</p>
      )}
    </div>
  );
}
```

---

## バリデーション実装

### core/plugin-system/config-validator.ts

```typescript
/**
 * プラグイン設定のバリデーション
 */
import type { PluginConfigSchema, PluginConfigField } from './types';

interface ValidationError {
  field: string;
  message: string;
}

/**
 * プラグイン設定全体のバリデーション
 */
export function validatePluginConfig(
  schema: PluginConfigSchema,
  config: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of schema.fields) {
    const value = config[field.name];

    // 必須チェック
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: field.name,
        message: `${field.label} is required`,
      });
      continue;
    }

    // 値が存在する場合のみ型チェック
    if (value !== undefined && value !== null && value !== '') {
      const fieldErrors = validateField(field, value);
      errors.push(...fieldErrors);
    }
  }

  return errors;
}

/**
 * 個別フィールドのバリデーション
 */
function validateField(field: PluginConfigField, value: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (field.type) {
    case 'string':
    case 'secret':
    case 'url':
    case 'email':
      errors.push(...validateStringField(field, value));
      break;

    case 'number':
      errors.push(...validateNumberField(field, value));
      break;

    case 'boolean':
      errors.push(...validateBooleanField(field, value));
      break;

    case 'select':
      errors.push(...validateSelectField(field, value));
      break;
  }

  return errors;
}

/**
 * 文字列フィールドのバリデーション
 */
function validateStringField(field: PluginConfigField, value: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof value !== 'string') {
    errors.push({
      field: field.name,
      message: `${field.label} must be a string`,
    });
    return errors;
  }

  // 長さチェック
  if (field.validation?.minLength && value.length < field.validation.minLength) {
    errors.push({
      field: field.name,
      message: `${field.label} must be at least ${field.validation.minLength} characters`,
    });
  }

  if (field.validation?.maxLength && value.length > field.validation.maxLength) {
    errors.push({
      field: field.name,
      message: `${field.label} must be at most ${field.validation.maxLength} characters`,
    });
  }

  // 正規表現チェック
  if (field.validation?.pattern) {
    const regex = new RegExp(field.validation.pattern);
    if (!regex.test(value)) {
      errors.push({
        field: field.name,
        message: `${field.label} has an invalid format`,
      });
    }
  }

  // URL 形式チェック
  if (field.type === 'url') {
    try {
      new URL(value);
    } catch {
      errors.push({
        field: field.name,
        message: `${field.label} must be a valid URL`,
      });
    }
  }

  // Email 形式チェック
  if (field.type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      errors.push({
        field: field.name,
        message: `${field.label} must be a valid email address`,
      });
    }
  }

  return errors;
}

/**
 * 数値フィールドのバリデーション
 */
function validateNumberField(field: PluginConfigField, value: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof value !== 'number' || isNaN(value)) {
    errors.push({
      field: field.name,
      message: `${field.label} must be a number`,
    });
    return errors;
  }

  // 範囲チェック
  if (field.validation?.min !== undefined && value < field.validation.min) {
    errors.push({
      field: field.name,
      message: `${field.label} must be at least ${field.validation.min}`,
    });
  }

  if (field.validation?.max !== undefined && value > field.validation.max) {
    errors.push({
      field: field.name,
      message: `${field.label} must be at most ${field.validation.max}`,
    });
  }

  return errors;
}

/**
 * 真偽値フィールドのバリデーション
 */
function validateBooleanField(field: PluginConfigField, value: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof value !== 'boolean') {
    errors.push({
      field: field.name,
      message: `${field.label} must be a boolean`,
    });
  }

  return errors;
}

/**
 * 選択フィールドのバリデーション
 */
function validateSelectField(field: PluginConfigField, value: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!field.options) {
    errors.push({
      field: field.name,
      message: `${field.label} is missing options`,
    });
    return errors;
  }

  const validValues = field.options.map((opt) => opt.value);
  if (!validValues.includes(value as string | number)) {
    errors.push({
      field: field.name,
      message: `${field.label} must be one of: ${validValues.join(', ')}`,
    });
  }

  return errors;
}
```

---

## サービス層実装

### core/services/plugin.service.ts

```typescript
/**
 * プラグイン設定更新サービス
 */
import { withTenantContext } from '~/db/connection';
import { plugins } from '~/db/schema/plugins';
import { eq, and } from 'drizzle-orm';
import type { PluginConfigSchema } from '~/plugin-system/types';
import { encryptPluginConfig } from '~/plugin-system/config-encryption';

/**
 * プラグイン設定を更新
 *
 * @param tenantId - テナント ID
 * @param pluginId - プラグイン ID
 * @param schema - 設定スキーマ（plugin.json から取得）
 * @param config - 新しい設定値
 */
export async function updatePluginConfig(
  tenantId: string,
  pluginId: string,
  schema: PluginConfigSchema,
  config: Record<string, unknown>
): Promise<void> {
  // 1. 機密情報を暗号化
  const encryptedConfig = await encryptPluginConfig(schema, config);

  // 2. データベースを更新（RLS 対応）
  await withTenantContext(tenantId, async (tx) => {
    await tx
      .update(plugins)
      .set({
        config: encryptedConfig,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(plugins.pluginId, pluginId),
          eq(plugins.tenantId, tenantId)
        )
      );
  });
}

/**
 * プラグイン情報を取得
 */
export async function getPluginById(
  tenantId: string,
  pluginId: string
): Promise<Plugin | null> {
  return await withTenantContext(tenantId, async (tx) => {
    const [plugin] = await tx
      .select()
      .from(plugins)
      .where(
        and(
          eq(plugins.pluginId, pluginId),
          eq(plugins.tenantId, tenantId)
        )
      )
      .limit(1);

    return plugin || null;
  });
}
```

---

## セキュリティ要件

1. **認証**: admin ロールのみが設定編集を許可される
2. **テナント分離**: RLS による自動的なテナント分離（`withTenantContext()` 使用）
3. **暗号化**: 機密情報（`type: 'secret'`）は AES-256-GCM で暗号化
4. **バリデーション**: サーバー側でバリデーションを実行（クライアント側のバリデーションは補助的）
5. **CSRF 保護**: Remix の Form コンポーネントで自動的に CSRF トークンが付与される
6. **XSS 対策**: ユーザー入力をサニタイゼーション（React は自動的にエスケープ）

---

## テスト要件

### Unit Tests (`core/plugin-system/config-validator.test.ts`)

- `validatePluginConfig()`: 必須チェック、型チェック、形式チェック（10 tests）
- `validateStringField()`: 文字列、URL、Email の形式検証（5 tests）
- `validateNumberField()`: 数値、範囲検証（3 tests）
- `validateSelectField()`: 選択肢の検証（2 tests）

### Integration Tests (`core/services/plugin.service.test.ts`)

- `updatePluginConfig()`: 設定更新、暗号化、RLS 対応（5 tests）
- `getPluginById()`: プラグイン取得、テナント分離（3 tests）

### E2E Tests (`core/e2e/plugin-settings.spec.ts`)

- プラグイン設定編集画面の表示（2 tests）
- フォームの動的生成（各フィールドタイプごとに 1 test、計 6 tests）
- バリデーションエラーの表示（3 tests）
- 設定の保存と暗号化（2 tests）
- 権限チェック（admin のみ編集可能）（2 tests）

合計で最低 40 テスト以上を実装する。

---

## 依存関係

- **Task 8.4**: Plugin 管理 API（プラグイン一覧取得、プラグイン情報取得）
- **Task 7.3.2**: システム設定画面（暗号化実装 `encryption.ts`）
- **既存**: Authentication system (`requireAuth()`)
- **既存**: Database connection with RLS (`withTenantContext()`)
- **既存**: Plugin Loader (`loadPluginMetadata()`)

---

## 完了条件

- [ ] `core/plugin-system/config-validator.ts` 作成
- [ ] `core/plugin-system/config-encryption.ts` 作成
- [ ] `core/services/plugin.service.ts` に `updatePluginConfig()` 追加
- [ ] `app/routes/dashboard/plugins.$id.edit.tsx` 作成
- [ ] `app/routes/api/plugins.$id.config.ts` 作成（設定更新 API）
- [ ] Unit Tests 全パス（最低 20 tests）
- [ ] Integration Tests 全パス（最低 8 tests）
- [ ] E2E Tests 全パス（最低 15 tests）
- [ ] `pnpm typecheck` パス
- [ ] `pnpm lint` パス

---

## 推定時間

4 時間

---

## 注意事項

- **機密情報の扱い**: `type: 'secret'` のフィールドは必ず暗号化して保存
- **デフォルト値**: フィールドに `default` が定義されている場合、値が未入力の場合はデフォルト値を使用
- **UI の一貫性**: システム設定画面（Task 7.3.2）と同じスタイルを使用
- **動的フォーム**: `plugin.json` の設定スキーマに基づいてフォームを動的に生成
- **エラーハンドリング**: バリデーションエラーは各フィールドの下に表示
