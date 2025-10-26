# Task 8.1: Plugin Loader 実装

**Status:** ドキュメント作成完了
**Branch:** `feature/task-8.1-plugin-loader`
**Estimated Time:** 3 時間

---

## 概要

プラグインシステムの基盤となる Plugin Loader を実装します。このローダーは以下の責務を持ちます：

1. **プラグインの検出**: `node_modules/` および指定ディレクトリからプラグインをスキャン
2. **プラグインの読み込み**: package.json のメタデータを読み取り、プラグインモジュールをロード
3. **プラグイン情報の管理**: 検出されたプラグインのメタデータをキャッシュ

---

## 実装対象ファイル

### 1. `core/plugin-system/loader.ts`

プラグインローダーのメイン実装。以下のインタフェースと関数を提供します。

```typescript
/**
 * Plugin metadata structure
 */
export interface PluginMetadata {
  /**
   * Plugin package name (e.g., "@drm/plugin-google-analytics")
   */
  name: string;

  /**
   * Plugin version (semver format)
   */
  version: string;

  /**
   * Human-readable plugin display name
   */
  displayName: string;

  /**
   * Plugin description
   */
  description: string;

  /**
   * Plugin author information
   */
  author?: string;

  /**
   * Plugin license (e.g., "MIT", "Commercial")
   */
  license?: string;

  /**
   * DRM plugin-specific configuration from package.json
   */
  drm?: {
    /**
     * Plugin type (e.g., "analytics", "crm", "notification")
     */
    type?: string;

    /**
     * Required DRM core version (semver range)
     */
    coreVersion?: string;
  };
}

/**
 * Loaded plugin instance
 */
export interface LoadedPlugin {
  /**
   * Plugin metadata
   */
  metadata: PluginMetadata;

  /**
   * Loaded plugin module (ESM default export)
   */
  module: unknown;

  /**
   * Plugin package.json path
   */
  packageJsonPath: string;
}

/**
 * Discover all available DRM plugins
 *
 * Scans the following locations for plugins:
 * 1. node_modules/ - NPM-installed plugins (prefix: @drm/plugin-*)
 * 2. /var/lib/drm/cloud-plugins/ - Cloud-signed plugins (production only)
 *
 * @returns Array of discovered plugin metadata
 *
 * Implementation notes:
 * - Use fs.readdir() to scan directories
 * - Filter packages by naming convention (@drm/plugin-*)
 * - Read package.json for each discovered plugin
 * - Validate package.json structure (name, version required)
 * - Return sorted list by plugin name
 */
export async function discoverPlugins(): Promise<PluginMetadata[]> {
  // Implementation: Scan node_modules/ and cloud plugin directories
  // Read package.json from each plugin
  // Extract metadata (name, version, displayName, etc.)
  // Return array of PluginMetadata
  throw new Error('Not implemented');
}

/**
 * Load a specific plugin by package name
 *
 * @param packageName - Plugin package name (e.g., "@drm/plugin-google-analytics")
 * @returns Loaded plugin with metadata and module
 * @throws Error if plugin not found or loading fails
 *
 * Implementation notes:
 * - Resolve plugin package.json path using require.resolve()
 * - Read and parse package.json
 * - Validate plugin metadata
 * - Dynamically import plugin module using import()
 * - Return LoadedPlugin object with metadata and module
 */
export async function loadPlugin(packageName: string): Promise<LoadedPlugin> {
  // Implementation:
  // 1. Resolve package.json path
  // 2. Read package.json and extract metadata
  // 3. Dynamically import plugin module
  // 4. Return LoadedPlugin object
  throw new Error('Not implemented');
}

/**
 * Get plugin metadata from package.json path
 *
 * @param packageJsonPath - Absolute path to package.json
 * @returns Plugin metadata
 * @throws Error if package.json is invalid or missing required fields
 *
 * Implementation notes:
 * - Read package.json file
 * - Parse JSON
 * - Validate required fields (name, version)
 * - Extract drm-specific configuration from "drm" field
 * - Return PluginMetadata object
 */
export async function getPluginMetadata(
  packageJsonPath: string
): Promise<PluginMetadata> {
  // Implementation:
  // 1. Read package.json file
  // 2. Parse JSON
  // 3. Validate required fields
  // 4. Extract and return metadata
  throw new Error('Not implemented');
}
```

---

## データフロー

```
┌──────────────────────────────────────────────────────────────┐
│ Plugin Discovery Flow                                        │
└──────────────────────────────────────────────────────────────┘

1. discoverPlugins() called
   │
   ├─→ Scan node_modules/ for @drm/plugin-* packages
   │   │
   │   └─→ Read each package.json
   │       │
   │       └─→ Extract metadata (name, version, displayName, etc.)
   │
   ├─→ Scan /var/lib/drm/cloud-plugins/ (production only)
   │   │
   │   └─→ Read each package.json
   │       │
   │       └─→ Extract metadata
   │
   └─→ Return sorted array of PluginMetadata


┌──────────────────────────────────────────────────────────────┐
│ Plugin Loading Flow                                          │
└──────────────────────────────────────────────────────────────┘

1. loadPlugin(packageName) called
   │
   ├─→ Resolve package.json path using require.resolve()
   │
   ├─→ Call getPluginMetadata(packageJsonPath)
   │   │
   │   └─→ Read and parse package.json
   │       │
   │       └─→ Return PluginMetadata
   │
   ├─→ Dynamically import plugin module (import())
   │   │
   │   └─→ Get default export (plugin definition)
   │
   └─→ Return LoadedPlugin { metadata, module, packageJsonPath }
```

---

## エラーハンドリング

### 1. プラグインが見つからない場合

```typescript
// Error: Plugin "@drm/plugin-invalid" not found
// - package.json が存在しない
// - require.resolve() が失敗
```

### 2. package.json が不正な場合

```typescript
// Error: Invalid package.json for plugin "@drm/plugin-foo"
// - JSON パースエラー
// - 必須フィールド (name, version) が欠如
```

### 3. モジュールロードエラー

```typescript
// Error: Failed to load plugin module "@drm/plugin-bar"
// - import() が失敗
// - モジュールに default export がない
```

---

## セキュリティ考慮事項

### 1. パストラバーサル対策

- プラグインパスは絶対パスに正規化
- `node_modules/` および `/var/lib/drm/cloud-plugins/` 外のパスは拒否

### 2. プラグイン署名検証（Phase 9 以降で実装）

- Cloud plugins は RSA256 署名を検証（本タスクでは対象外）
- 署名検証は後続タスクで実装

### 3. サンドボックス実行（Phase 9 以降で実装）

- プラグインコードは隔離された環境で実行（本タスクでは対象外）
- VM2 または Worker Threads を使用（後続タスクで実装）

---

## テスト方針

### 1. Unit Tests (`core/plugin-system/loader.test.ts`)

```typescript
describe('discoverPlugins', () => {
  test('should discover plugins from node_modules');
  test('should return empty array if no plugins found');
  test('should filter non-plugin packages');
  test('should sort plugins by name');
});

describe('loadPlugin', () => {
  test('should load plugin successfully');
  test('should throw error if plugin not found');
  test('should throw error if package.json is invalid');
  test('should throw error if module import fails');
});

describe('getPluginMetadata', () => {
  test('should extract metadata from package.json');
  test('should throw error if package.json is missing');
  test('should throw error if required fields are missing');
  test('should handle optional drm configuration');
});
```

### 2. Integration Tests

```typescript
describe('Plugin Loader Integration', () => {
  test('should discover and load multiple plugins');
  test('should handle mixed OSS and cloud plugins');
});
```

---

## 完了条件

- [x] `core/plugin-system/loader.ts` が作成されている
- [x] `discoverPlugins()` がプラグインを検出できる
- [x] `loadPlugin()` がプラグインモジュールをロードできる
- [x] `getPluginMetadata()` が package.json からメタデータを取得できる
- [x] Unit Tests が全てパスする（最低 10 テスト）
- [x] TypeScript エラーがない（`pnpm typecheck`）
- [x] ESLint エラーがない（`pnpm lint`）

---

## 依存タスク

- **依存**: Task 3.6 (シードデータ作成) ✅ 完了
- **後続**: Task 8.2 (Hook Registry 実装)

---

## 備考

### プラグイン命名規則

- NPM plugins: `@drm/plugin-{name}` (e.g., `@drm/plugin-google-analytics`)
- Cloud plugins: `@drm/plugin-cloud-{name}` (e.g., `@drm/plugin-cloud-slack`)

### プラグイン配置ディレクトリ

- OSS plugins: `node_modules/@drm/plugin-*`
- Cloud plugins: `/var/lib/drm/cloud-plugins/@drm/plugin-cloud-*` (production only)

### package.json の drm フィールド例

```json
{
  "name": "@drm/plugin-google-analytics",
  "version": "1.0.0",
  "description": "Google Analytics integration for DRM",
  "main": "dist/index.js",
  "drm": {
    "type": "analytics",
    "coreVersion": "^0.1.0"
  }
}
```
