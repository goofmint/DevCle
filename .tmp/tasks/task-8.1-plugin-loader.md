# Task 8.1: Plugin Loader 実装

**Status:** ドキュメント作成完了
**Branch:** `feature/task-8.1-plugin-loader`
**Estimated Time:** 3 時間

---

## 概要

プラグインシステムの基盤となる Plugin Loader を実装します。

### 責務

- **プラグインの検出**: `packages.json` からプラグインをスキャン（プラグイン名が `drowl-plugin-` で始まる NPM パッケージを対象）
- **プラグインの読み込み**: `plugin.json` のメタデータを読み取り、プラグインモジュールを動的ロード
- **メタデータ管理**: 検出されたプラグイン情報をキャッシュ

---

## 実装対象ファイル

### `core/plugin-system/loader.ts`

#### インタフェース

- `PluginMetadata`: プラグインメタデータ（name, version, displayName, description, author, license, drm config）
- `LoadedPlugin`: ロード済みプラグイン（metadata, module, pluginJsonPath）

#### 関数

**`discoverPlugins(): Promise<PluginMetadata[]>`**
- `packages.json` から `drowl-plugin-*` で始まるパッケージをスキャン
- 本番環境では `/var/lib/drm/cloud-plugins/` もスキャン
- 各プラグインの `plugin.json` を読み取り、メタデータを抽出
- プラグイン名でソートして返す

**`loadPlugin(packageName: string): Promise<LoadedPlugin>`**
- `require.resolve()` で `plugin.json` パスを解決
- `getPluginMetadata()` でメタデータ取得
- `import()` でモジュールを動的ロード
- `LoadedPlugin` オブジェクトを返す

**`getPluginMetadata(pluginJsonPath: string): Promise<PluginMetadata>`**
- `plugin.json` ファイルを読み取り
- JSON パース & 必須フィールド検証（name, version）
- `drm` フィールドから設定を抽出
- `PluginMetadata` を返す

---

## エラーハンドリング

- **プラグインが見つからない**: `plugin.json` 不在、require.resolve() 失敗
- **plugin.json 不正**: JSON パースエラー、必須フィールド欠如
- **モジュールロードエラー**: import() 失敗、default export なし

---

## セキュリティ

- パストラバーサル対策（絶対パス正規化、許可ディレクトリ外拒否）
- プラグイン署名検証（Phase 9 以降）
- サンドボックス実行（Phase 9 以降）

---

## テスト方針

### Unit Tests (`core/plugin-system/loader.test.ts`)

- `discoverPlugins()`: プラグイン検出、空配列、フィルタリング、ソート（4 tests）
- `loadPlugin()`: 正常ロード、プラグイン未検出、plugin.json 不正、import 失敗（4 tests）
- `getPluginMetadata()`: メタデータ抽出、ファイル不在、必須フィールド欠如、drm フィールド（4 tests）

### Integration Tests

- 複数プラグインの検出とロード
- OSS/Cloud プラグイン混在

**最低 10 テスト**

---

## 完了条件

- [ ] `core/plugin-system/loader.ts` 作成
- [ ] `discoverPlugins()` 実装
- [ ] `loadPlugin()` 実装
- [ ] `getPluginMetadata()` 実装
- [ ] Unit Tests 全パス（最低 10 tests）
- [ ] `pnpm typecheck` パス
- [ ] `pnpm lint` パス

---

## プラグイン仕様

### 命名規則

- OSS: `drowl-plugin-{name}` (例: `drowl-plugin-google-analytics`)
- Cloud: `drowl-plugin-cloud-{name}` (例: `drowl-plugin-cloud-slack`)

### 配置ディレクトリ

- OSS: `packages.json` に登録されたプラグイン
- Cloud: `/var/lib/drm/cloud-plugins/` (本番のみ)

### plugin.json 例

```json
{
  "name": "drowl-plugin-google-analytics",
  "version": "1.0.0",
  "description": "Google Analytics integration for DRM",
  "main": "dist/index.js",
  "drm": {
    "type": "analytics",
    "coreVersion": "^0.1.0"
  }
}
```
