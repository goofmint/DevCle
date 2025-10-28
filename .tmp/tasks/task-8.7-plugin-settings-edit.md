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

### 型定義

```typescript
/**
 * プラグイン設定項目の型
 */
type PluginConfigFieldType =
  | 'string'      // 通常の文字列（1行入力）
  | 'textarea'    // 複数行テキスト
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
  name: string;
  label: string;
  type: PluginConfigFieldType;
  required: boolean;
  default?: string | number | boolean;
  help?: string;
  placeholder?: string;
  options?: Array<{ label: string; value: string | number }>;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

/**
 * プラグイン設定スキーマ（plugin.json の drm.config フィールド）
 */
interface PluginConfigSchema {
  fields: PluginConfigField[];
}
```

### 例: Google Analytics プラグインの設定

```json
{
  "drm": {
    "config": {
      "fields": [
        {
          "name": "apiKey",
          "label": "Google Analytics API Key",
          "type": "secret",
          "required": true,
          "help": "Your Google Analytics API key"
        },
        {
          "name": "propertyId",
          "label": "Property ID",
          "type": "string",
          "required": true,
          "validation": { "pattern": "^G-[A-Z0-9]{10}$" }
        },
        {
          "name": "syncInterval",
          "label": "Sync Interval (hours)",
          "type": "number",
          "default": 24,
          "validation": { "min": 1, "max": 168 }
        }
      ]
    }
  }
}
```

---

## API 仕様

### PUT /api/plugins/:id/config - プラグイン設定更新

```typescript
/**
 * Request
 */
interface UpdatePluginConfigRequest {
  config: Record<string, unknown>;
}

/**
 * Response (Success)
 */
interface UpdatePluginConfigResponse {
  success: boolean;
  plugin: {
    pluginId: string;
    key: string;
    name: string;
    version: string;
    enabled: boolean;
    updatedAt: string;
  };
}

/**
 * Response (Error)
 */
interface ApiErrorResponse {
  /** HTTP status code */
  status: number;
  /** Human-readable error message */
  error: string;
  /** Detailed error information (validation errors, etc.) */
  details?: Array<{
    field: string;
    message: string;
  }>;
}
```

**エラーハンドリング仕様:**

- `400 Bad Request`: バリデーションエラー
  - すべてのバリデーションエラーを `details` 配列で返す（fail-fast しない）
  - 例: 必須フィールド未入力、型不一致、形式エラー
- `401 Unauthorized`: 認証エラー
  - リクエストヘッダーに有効な認証情報がない
  - セッションが無効または期限切れ
- `403 Forbidden`: 権限エラー
  - ユーザーが admin ロールを持っていない
  - プラグイン設定の編集権限がない
- `404 Not Found`: リソースが存在しない
  - プラグインが見つからない
  - 設定スキーマ（plugin.json の drm.config）が見つからない
- `500 Internal Server Error`: サーバーエラー
  - スキーマ読み込み失敗を try/catch でキャッチ
  - データベース更新失敗を try/catch でキャッチ
  - 暗号化/復号化失敗を try/catch でキャッチ
  - エラーログに完全なスタックトレースを記録
  - クライアントには安全なエラーメッセージのみ返す

---

### DELETE /api/plugins/:id - プラグイン無効化（設定削除）

プラグインを無効化し、設定をすべて削除します。

```typescript
/**
 * Request: なし
 */

/**
 * Response (Success)
 */
interface DisablePluginResponse {
  success: boolean;
  plugin: {
    pluginId: string;
    key: string;
    name: string;
    enabled: boolean; // false
    updatedAt: string;
  };
}
```

**動作**:
1. プラグインの `enabled` フラグを `false` に設定
2. `config` フィールドをクリア（`null` または `{}`）
3. `updatedAt` を更新

**注意**:
- UI で事前に確認ダイアログを表示すること
- 設定は完全に削除され、復元できないことをユーザーに警告

---

## 暗号化仕様

### 機密情報フィールドの処理

- **判定**: `type: 'secret'` のフィールドを機密情報と判定
- **暗号化**: Task 7.3.2 の `encryption.ts` を使用（AES-256-GCM）
- **保存**: 暗号化した値を DB に保存
- **表示**: UI では復号化せず `null` を返す（フォームでは `****` と表示）

### 関数インターフェース

```typescript
/**
 * プラグイン設定の暗号化
 *
 * type = 'secret' のフィールドを暗号化します。
 * 非 secret フィールドは変更されません。
 *
 * シリアライゼーションルール:
 * - プリミティブ値（string, number, boolean）: String() で文字列に変換
 * - オブジェクト・配列: JSON.stringify() でシリアライズ
 * - null/undefined: スキップ（暗号化しない）
 * - 空文字列: スキップ（暗号化しない）
 *
 * @param schema - プラグイン設定スキーマ（PluginConfigSchema に準拠）
 * @param config - 暗号化する設定値
 * @returns 暗号化された設定値（secret フィールドのみ暗号化）
 * @throws Error if schema is invalid
 * @throws Error if encryption fails (see core/utils/encryption.ts)
 */
function encryptPluginConfig(
  schema: PluginConfigSchema,
  config: Record<string, unknown>
): Promise<Record<string, unknown>>;

/**
 * プラグイン設定の復号化
 *
 * type = 'secret' のフィールドを復号化します。
 * 非 secret フィールドは変更されません。
 *
 * @param schema - プラグイン設定スキーマ（PluginConfigSchema に準拠）
 * @param config - 復号化する設定値
 * @returns 復号化された設定値（secret フィールドのみ復号化）
 * @throws Error if schema is invalid
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 * @throws Error if ciphertext format is invalid
 */
function decryptPluginConfig(
  schema: PluginConfigSchema,
  config: Record<string, unknown>
): Promise<Record<string, unknown>>;
```

---

## UI 要件

### プラグインカードへの設定アイコン表示

**表示位置**: プラグインカードの右上

**表示条件**:
- プラグインが有効（`enabled: true`）の場合のみ表示
- 設定スキーマ（`plugin.json` の `drm.config`）が存在する場合のみ表示

**アイコン**:
- 歯車アイコン（例: `mdi:cog` または `mdi:settings`）
- ボタンまたはリンク

**動作**:
- クリックで `/dashboard/plugins/:id/edit` に遷移

**実装イメージ**:
```typescript
{plugin.enabled && hasConfigSchema && (
  <Link
    to={`/dashboard/plugins/${plugin.pluginId}/edit`}
    className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded"
    title="Configure plugin"
  >
    <Icon icon="mdi:cog" className="w-5 h-5" />
  </Link>
)}
```

---

### プラグイン無効化時の確認ダイアログ

**トリガー**: `Disable` ボタンをクリック

**ダイアログ内容**:
- **タイトル**: "Disable Plugin?"
- **メッセージ**:
  ```
  Are you sure you want to disable this plugin?

  Warning: All plugin settings will be deleted and cannot be recovered.
  You will need to reconfigure the plugin if you enable it again.
  ```
- **ボタン**:
  - "Cancel"（キャンセル）
  - "Disable"（確定、赤色）

**動作**:
- "Cancel" をクリック: ダイアログを閉じる
- "Disable" をクリック: プラグインを無効化し、`config` フィールドをクリア（`null` または `{}`）

---

### プラグイン削除時の動作

**トリガー**: プラグインをアンインストール（`DELETE /api/plugins/:id` で削除）

**動作**:
- `plugins` テーブルからレコードを削除
- `config` フィールドも含めてすべてのデータを削除
- 関連する `plugin_runs` テーブルのレコードも CASCADE 削除

---

## 実装ファイル

### core/plugin-system/config-validator.ts

**責務**: プラグイン設定のバリデーション

**関数:**
- `validatePluginConfig(schema, config)`: 設定全体のバリデーション
- `validateField(field, value)`: 個別フィールドのバリデーション
- `validateStringField()`: 文字列フィールドの検証（string, textarea, secret, url, email）
  - 長さチェック（minLength, maxLength）
  - 正規表現パターンチェック
  - URL/Email 形式チェック
- `validateNumberField()`: 数値フィールドの検証（範囲）
- `validateBooleanField()`: 真偽値フィールドの検証
- `validateSelectField()`: 選択フィールドの検証（選択肢に含まれるか）

**戻り値:**
```typescript
interface ValidationError {
  field: string;
  message: string;
}
```

---

### core/plugin-system/config-encryption.ts

**責務**: 機密情報の暗号化/復号化

**関数:**
- `encryptPluginConfig(schema, config)`: secret フィールドを暗号化
- `decryptPluginConfig(schema, config)`: secret フィールドを復号化
- `isSecretField(field)`: 機密情報フィールドかどうかを判定

**使用ライブラリ**: `core/utils/encryption.ts`（Task 7.3.2 で実装済み）

---

### core/services/plugin.service.ts

**責務**: プラグイン設定の更新

**関数:**
- `updatePluginConfig(tenantId, pluginId, schema, config)`: 設定を更新
  - 機密情報を暗号化
  - RLS を使用してデータベース更新（`withTenantContext()`）
  - `updatedAt` を更新
- `getPluginById(tenantId, pluginId)`: プラグイン情報を取得
  - RLS を使用してクエリ実行

---

### core/app/routes/api.plugins.$id.config.ts

**責務**: 設定更新 API エンドポイント（Remix v2 flat route convention）

**実装内容:**
- `PUT /api/plugins/:id/config`
  1. 認証チェック（admin ロールのみ許可）
     - 未認証の場合: 401 Unauthorized
     - admin ロール以外の場合: 403 Forbidden
  2. リクエストボディをパース
     - JSON パースエラー: 400 Bad Request
  3. plugin.json から設定スキーマを取得
     - try/catch でエラーをキャッチ
     - スキーマが存在しない場合: 404 Not Found
     - 読み込み失敗: 500 Internal Server Error（ログに記録）
  4. バリデーション実行
     - すべてのバリデーションエラーを収集（fail-fast しない）
     - エラーがある場合: 400 Bad Request（details にすべてのエラーを含める）
  5. 設定を更新（暗号化はサービス層で実行）
     - try/catch でエラーをキャッチ
     - データベースエラー: 500 Internal Server Error（ログに記録）
     - 暗号化エラー: 500 Internal Server Error（ログに記録）
  6. レスポンスを返す
     - 成功: 200 OK（UpdatePluginConfigResponse）
     - エラー: 適切なステータスコード + ApiErrorResponse

---

### app/routes/dashboard/plugins.$id.edit.tsx

**責務**: プラグイン設定編集画面

**Loader:**
- 認証チェック（admin ロールのみ許可）
- プラグイン情報を取得
- plugin.json から設定スキーマを取得
- 現在の設定値を取得
  - **secret フィールドの扱い（Option D: "Change this setting" トグル）**:
    - secret フィールドは復号化せずに `{ _exists: true }` マーカーを返す
    - UI でトグルを表示し、ユーザーが明示的に「変更する」を選択した場合のみ入力フィールドを表示
    - セキュリティ上の理由: secret を復号化してクライアントに送信しない
    - UX 上の理由: ユーザーが意図的に変更する場合のみ入力を求める

**Action:**
- 認証チェック
- リクエストボディをパース
- **secret フィールドの処理**:
  - `{ _exists: true }` マーカーが送信された場合: 既存の値を保持（更新しない）
  - 新しい値が送信された場合: 暗号化して保存
  - セキュリティ上の考慮: マーカーを使用することで、意図しない上書きを防止
- バリデーション実行
- 設定を更新
- プラグイン詳細ページにリダイレクト

**コンポーネント:**
- `PluginEditPage`: メインコンポーネント
  - フォームの状態管理
  - 送信処理
- `PluginConfigField`: 動的フィールドコンポーネント
  - フィールドタイプに応じて適切な入力コンポーネントをレンダリング
- `StringField`: 文字列入力（1行）
- `TextareaField`: 複数行テキスト入力
- `SecretField`: パスワード入力
  - 既存の secret がある場合: "Change this setting" チェックボックスを表示
  - チェックボックスが OFF: `{ _exists: true }` マーカーを送信（既存の値を保持）
  - チェックボックスが ON: 入力フィールドを表示（新しい値を入力）
  - Show/Hide ボタン付き（入力中のみ）
- `NumberField`: 数値入力
- `BooleanField`: チェックボックス
- `SelectField`: ドロップダウン

---

## セキュリティ要件

1. **認証**: admin ロールのみが設定編集を許可
2. **テナント分離**: RLS による自動的なテナント分離（`withTenantContext()` 使用）
3. **暗号化**: 機密情報（`type: 'secret'`）は AES-256-GCM で暗号化
4. **バリデーション**: サーバー側でバリデーションを実行
5. **CSRF 保護**: Remix の Form コンポーネントで自動的に CSRF トークンが付与
6. **XSS 対策**: ユーザー入力をサニタイゼーション（React は自動的にエスケープ）

---

## テスト要件

### Unit Tests (`core/plugin-system/config-validator.test.ts`)
- 必須チェック、型チェック、形式チェック（10 tests）
- 文字列、URL、Email の形式検証（5 tests）
- 数値、範囲検証（3 tests）
- 選択肢の検証（2 tests）

### Integration Tests (`core/services/plugin.service.test.ts`)
- 設定更新、暗号化、RLS 対応（5 tests）
- プラグイン取得、テナント分離（3 tests）

### E2E Tests (`core/e2e/plugin-settings.spec.ts`)
- プラグイン設定編集画面の表示（2 tests）
- フォームの動的生成（各フィールドタイプごとに 1 test、計 7 tests）
  - string, textarea, secret, number, boolean, url, email, select
- バリデーションエラーの表示（3 tests）
  - すべてのエラーが details 配列で返されることを確認（fail-fast しない）
- 設定の保存と暗号化（2 tests）
- secret フィールドのトグル機能（3 tests）
  - トグル OFF: 既存の値を保持
  - トグル ON: 新しい値を入力して保存
  - `{ _exists: true }` マーカーの正しい処理
- 権限チェック（admin のみ編集可能）（2 tests）
- 設定アイコンの表示（有効なプラグインのみ）（2 tests）
- プラグイン無効化時の確認ダイアログ表示（2 tests）
- プラグイン無効化後の設定削除確認（2 tests）

**合計**: 最低 49 テスト以上

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
  - すべてのバリデーションエラーを収集（fail-fast しない）
  - @throws でエラーを明記
- [ ] `core/plugin-system/config-encryption.ts` 作成
  - シリアライゼーションルール実装（プリミティブ、オブジェクト、null/undefined）
  - @throws でエラーを明記
  - core/utils/encryption.ts のパターンに準拠
- [ ] `core/services/plugin.service.ts` に `updatePluginConfig()` 追加
  - try/catch でエラーをキャッチ
  - secret フィールドの `{ _exists: true }` マーカー処理
- [ ] `app/routes/dashboard/plugins.$id.edit.tsx` 作成
  - secret フィールドの "Change this setting" トグル実装
  - トグル OFF: `{ _exists: true }` マーカーを送信
  - トグル ON: 入力フィールドを表示
- [ ] `core/app/routes/api.plugins.$id.config.ts` 作成（Remix v2 flat route convention）
  - すべてのバリデーションエラーを details に含める
  - try/catch でスキーマ読み込み、DB 更新、暗号化のエラーをキャッチ
  - 500 エラー時にログ記録
- [ ] プラグインカードに設定アイコン表示（有効なプラグインのみ）
- [ ] プラグイン無効化時の確認ダイアログ実装
- [ ] プラグイン無効化時の設定削除実装
- [ ] Unit Tests 全パス（最低 20 tests）
- [ ] Integration Tests 全パス（最低 8 tests）
- [ ] E2E Tests 全パス（最低 25 tests）
  - secret トグル機能のテスト（3 tests）を含む
- [ ] `pnpm typecheck` パス
- [ ] `pnpm lint` パス

---

## 推定時間

4 時間

---

## 注意事項

- **機密情報の扱い**: `type: 'secret'` のフィールドは必ず暗号化して保存
- **secret フィールドの編集（Option D: "Change this setting" トグル）**:
  - Loader: secret を復号化せずに `{ _exists: true }` マーカーを返す
  - UI: "Change this setting" チェックボックスを表示
  - チェックボックス OFF: マーカーを送信して既存の値を保持
  - チェックボックス ON: 入力フィールドを表示して新しい値を入力
  - Action: マーカーを受け取った場合は既存の値を保持、新しい値を受け取った場合は暗号化して保存
  - セキュリティ: secret を復号化してクライアントに送信しない
- **デフォルト値**: フィールドに `default` が定義されている場合、値が未入力の場合はデフォルト値を使用
- **UI の一貫性**: システム設定画面（Task 7.3.2）と同じスタイルを使用
- **動的フォーム**: `plugin.json` の設定スキーマに基づいてフォームを動的に生成
- **エラーハンドリング**:
  - バリデーションエラーは各フィールドの下に表示
  - すべてのバリデーションエラーを収集（fail-fast しない）
  - try/catch でスキーマ読み込み、DB 更新、暗号化のエラーをキャッチ
  - 500 エラー時にログ記録
- **フィールドタイプの使い分け**:
  - `string`: 1行の短いテキスト入力（名前、ID など）
  - `textarea`: 複数行の長いテキスト入力（説明文、JSON、コードスニペットなど）
- **設定アイコンの表示条件**:
  - プラグインが有効（`enabled: true`）の場合のみ
  - 設定スキーマ（`plugin.json` の `drm.config`）が存在する場合のみ
- **プラグイン無効化時の警告**:
  - 必ず確認ダイアログを表示
  - 「設定がすべて削除されます」という警告を明示
  - ユーザーが意図せず設定を失わないよう配慮
- **設定削除の不可逆性**:
  - プラグイン無効化時に `config` フィールドをクリア
  - 復元不可能であることを明確に伝える
