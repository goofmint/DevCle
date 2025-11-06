# Task 8.14: menusの/dataを止めて、dataキーに変更する対応

**タスクID**: Task 8.14
**依存**: Task 8.12（プラグインデータ表示UI実装）
**推定時間**: 3時間
**ドキュメント作成日**: 2025-11-06

---

## 1. 背景と目的

### 1.1 現状の問題

現在、プラグインの `/data` ページは `menus` フィールドに含まれているが、以下の問題がある：

1. **特殊ページの混在**: `/data` はコア側で提供する標準UIであり、プラグインカスタムページ（`/overview`, `/settings`など）とは性質が異なる
2. **コンポーネント不要**: `/data` はプラグイン側でReactコンポーネントを提供する必要がない（コア側で自動生成）
3. **一貫性の欠如**: 他の特殊ページ（`/runs` = 実行ログ）は既にコア側で自動生成されているが、`/data` だけが `menus` に含まれている

### 1.2 新しい仕様

`/data` ページは `data: true` フィールドで自動生成する：

**変更前:**
```json
{
  "menus": [
    { "key": "data", "label": "Collected Data", "to": "/data", "icon": "mdi:database" }
  ]
}
```

**変更後:**
```json
{
  "data": true,
  "menus": []
}
```

---

## 2. 仕様詳細

### 2.1 plugin.jsonスキーマ変更

#### 新規フィールド: `data`

| フィールド | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| `data` | `boolean` | No | `false` | `true`の場合、`/data`ページを自動生成 |

#### バリデーションルール

1. `data: true` かつ `menus` に `/data` パスがある場合、エラーを返す
2. エラーメッセージ: "Cannot have both 'data: true' and a menu item with path '/data'. Remove the '/data' menu item from 'menus' array."

### 2.2 `/data` ページの自動生成

`data: true` の場合、以下のページが自動生成される：

- **URL**: `/dashboard/plugins/:pluginId/data`
- **コンポーネント**: コア側で提供（`core/app/routes/dashboard.plugins_.$id.data.tsx`、既に実装済み）
- **API**: `GET /api/plugins/:id/events` （Task 8.11で実装済み）
- **ページ内容**: プラグインが収集した生データの一覧表示、フィルタ、ページネーション、詳細モーダル

### 2.3 サイドバーメニューの表示順序

`data: true` の場合、サイドバーメニューは以下の順序で表示される：

1. **Overview** （`menus` の最初のアイテム、存在する場合）
2. **Collected Data** （`data: true` の場合、自動追加）
3. **Custom Menu Items** （`menus` のその他のアイテム）
4. **Settings** （`menus` の最後のアイテム、存在する場合）
5. **Activity Logs** （常に自動追加）

---

## 3. 実装内容

### 3.1 プラグインスキーマ更新

**ファイル**: `core/plugin-system/types.ts`

- `PluginManifest` インターフェースに `data?: boolean` フィールドを追加

### 3.2 バリデーション実装

**ファイル**: `core/plugin-system/validator.ts`

- Zodスキーマに `data` フィールドを追加（`boolean`, optional, default: `false`）
- `refine` で `data: true` かつ `menus` に `/data` がある場合はエラーを返す

### 3.3 プラグインローダー修正

**ファイル**: `core/plugin-system/loader.ts`

- `generatePluginMenus()` 関数を追加
- `data: true` の場合、Overview の後に "Collected Data" メニューを自動挿入
- Activity Logs は常に最後に追加

### 3.4 サイドバーメニュー生成ロジック修正

**ファイル**: `core/app/routes/dashboard.tsx`

- ローダーで `generatePluginMenus()` を呼び出してメニューを生成

---

## 4. 既存プラグインの移行

### 4.1 `drowl-plugin-test/plugin.json` の更新

**変更前:**
```json
{
  "menus": [
    { "key": "overview", "label": "Overview", "to": "/overview", "icon": "mdi:chart-line" },
    { "key": "data", "label": "Collected Data", "to": "/data", "icon": "mdi:database" },
    { "key": "settings", "label": "Settings", "to": "/settings", "icon": "mdi:cog" },
    { "key": "logs", "label": "Activity Logs", "to": "/logs", "icon": "mdi:file-document-outline" }
  ]
}
```

**変更後:**
```json
{
  "data": true,
  "menus": [
    { "key": "overview", "label": "Overview", "to": "/overview", "icon": "mdi:chart-line" },
    { "key": "settings", "label": "Settings", "to": "/settings", "icon": "mdi:cog" }
  ]
}
```

**変更内容:**
1. `data: true` を追加
2. `menus` から `data` エントリを削除
3. `menus` から `logs` エントリを削除（既に自動追加されているため）

**注意:** `/data` ページはコア側で自動生成されるため、プラグイン側にコンポーネントは存在しない。削除作業は不要。

---

## 5. テスト計画

### 5.1 単体テスト（Vitest）

**ファイル**: `core/plugin-system/validator.test.ts`

- `data: true` のみの場合、正常に通る
- `data: true` かつ `menus` に `/data` がある場合、エラー
- `data: false` の場合、`menus` に `/data` があってもエラーにならない

**ファイル**: `core/plugin-system/loader.test.ts`

- `data: true` の場合、"/data" メニューが Overview の後に追加される
- `data: false` の場合、"/data" メニューは追加されない

### 5.2 E2Eテスト（Playwright）

**ファイル**: `core/e2e/plugin-data-field.spec.ts`

- `data: true` の場合、"Collected Data" メニューが表示される
- `data: true` の場合、メニューの順序が正しい（Overview → Collected Data → Settings → Activity Logs）
- "Collected Data" をクリックすると `/data` ページに遷移する

---

## 6. 完了条件

- [ ] `plugin.json` に `data` フィールドが追加され、Zodスキーマでバリデーションされる
- [ ] `data: true` かつ `menus` に `/data` がある場合、バリデーションエラーが発生する
- [ ] `data: true` の場合、"Collected Data" メニューが自動生成される
- [ ] メニューの表示順序が正しい（Overview → Collected Data → Custom Menus → Settings → Activity Logs）
- [ ] `drowl-plugin-test/plugin.json` が新しい仕様に更新される
- [ ] 単体テスト（Vitest）が全てパスする
- [ ] E2Eテスト（Playwright）が全てパスする

---

## 7. 注意事項

### 7.1 破壊的変更

この変更は既存の `drowl-plugin-test` に影響する：

- `menus` に `to: "/data"` がある場合、`data: true` を追加するとバリデーションエラーが発生する
- 既存プラグインは plugin.json の更新が必要

### 7.2 `/data` のみ特殊扱い

- `/data` ページのみがコア側で自動生成される
- その他のページ（`/overview`, `/settings` など）は全てプラグイン側でコンポーネントを提供する必要がある
- `/runs` （Activity Logs）は既に自動生成されている（Task 8.9で実装済み）
