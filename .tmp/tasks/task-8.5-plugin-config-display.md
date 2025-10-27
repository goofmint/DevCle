# Task 8.5: プラグインの設定表示機能実装

**ステータス**: 未着手
**担当**: -
**推定時間**: 3 時間
**依存**: Task 8.4

---

## 概要

プラグインの設定情報を表示する画面を実装します。この画面では、プラグインの基本情報、設定項目、追加ルーティング、必要な権限を一覧表示し、プラグインの全体像を把握できるようにします。

---

## 実装対象

### 1. プラグイン設定取得API

**ファイル**: `app/routes/api/plugins.$id.config.ts`

プラグインの設定情報を取得するAPIエンドポイントを実装します。

```typescript
// app/routes/api/plugins.$id.config.ts
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';

/**
 * GET /api/plugins/:id/config
 *
 * プラグインの設定情報を取得します。
 * - プラグインの基本情報（名前、バージョン、説明、ベンダー、ライセンス）
 * - 設定項目の一覧（settingsSchema）
 * - 追加ルーティングの一覧（routes）
 * - 必要な権限の一覧（capabilities）
 *
 * @returns PluginConfigInfo
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  // 認証チェック（requireAuth）
  // プラグイン情報を取得（getPluginConfig）
  // JSONレスポンスを返す
}
```

### 2. プラグイン設定表示ページ（SPA）

**ファイル**: `app/routes/dashboard/plugins.$id.config.tsx`

プラグインの設定情報を表示するクライアントコンポーネントを実装します。

```typescript
// app/routes/dashboard/plugins.$id.config.tsx
import { useEffect, useState } from 'react';
import { useParams } from '@remix-run/react';

export default function PluginConfigPage() {
  const { id } = useParams();
  const [config, setConfig] = useState<PluginConfigInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // APIからプラグイン設定を取得
    // fetch(`/api/plugins/${id}/config`)
    //   .then(res => res.json())
    //   .then(data => setConfig(data))
    //   .catch(err => setError(err.message))
    //   .finally(() => setLoading(false))
  }, [id]);

  // ローディング中の表示
  // エラー時の表示
  // プラグイン基本情報セクションを表示
  // 設定項目セクションを表示
  // ルーティングセクションを表示
  // 権限セクションを表示
}
```

---

## データ構造

### プラグイン設定情報の型定義

```typescript
// core/services/plugin/plugin-config.types.ts

/**
 * プラグイン基本情報
 */
export interface PluginBasicInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  vendor: string;
  homepage?: string;
  license: string;
  compatibility?: {
    drowlMin?: string;
    drowlMax?: string;
  };
}

/**
 * プラグイン権限情報
 */
export interface PluginCapabilities {
  scopes: string[];          // 例: ["read:activities", "write:activities"]
  network: string[];         // 例: ["https://api.github.com"]
  secrets: string[];         // 例: ["github_token"]
}

/**
 * プラグイン設定項目のスキーマ
 */
export interface PluginSettingSchema {
  key: string;               // 設定キー
  label: string;             // 表示ラベル
  type: 'text' | 'secret' | 'number' | 'select' | 'multiselect' | 'toggle' | 'url' | 'daterange';
  required?: boolean;        // 必須フラグ
  default?: unknown;         // デフォルト値
  hint?: string;             // ヒント
  regex?: string;            // バリデーション用正規表現
  min?: number;              // 最小値（numberの場合）
  max?: number;              // 最大値（numberの場合）
  options?: Array<{ value: string; label: string }>; // 選択肢（select/multiselectの場合）
}

/**
 * プラグインルート定義
 */
export interface PluginRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;              // 例: "/sync", "/widgets/:key"
  auth: 'plugin' | 'public'; // 認証方式
  timeoutSec: number;        // タイムアウト（秒）
  requestSchema?: string;    // リクエストスキーマファイルパス
  responseSchema?: string;   // レスポンススキーマファイルパス
  idempotent?: boolean;      // べき等性フラグ
  verify?: {                 // 検証設定（authがpublicの場合）
    type: string;
    secretKey: string;
  };
}

/**
 * プラグイン設定情報（全体）
 */
export interface PluginConfigInfo {
  basicInfo: PluginBasicInfo;
  capabilities: PluginCapabilities;
  settingsSchema: PluginSettingSchema[];
  routes: PluginRoute[];
  rateLimits?: {
    perMinute: number;
    burst: number;
  };
  i18n?: {
    supported: string[];
  };
}
```

---

## API 仕様

### プラグイン設定情報取得サービス

**ファイル**: `core/services/plugin/plugin-config.service.ts`

```typescript
/**
 * プラグインの設定情報を取得します
 *
 * @param pluginId - プラグインID
 * @param tenantId - テナントID
 * @returns プラグイン設定情報
 * @throws {Error} プラグインが見つからない場合
 */
export async function getPluginConfig(
  pluginId: string,
  tenantId: string
): Promise<PluginConfigInfo> {
  // 1. plugins ディレクトリからプラグインを検索
  // 2. plugin.json を読み込み
  // 3. JSON をパースして型に変換
  // 4. データを返す
}

/**
 * プラグインの存在チェック
 *
 * @param pluginId - プラグインID
 * @returns プラグインが存在するか
 */
export async function pluginExists(pluginId: string): Promise<boolean> {
  // plugins ディレクトリにプラグインが存在するか確認
}
```

---

## UI 仕様

### レイアウト構成

```
┌─────────────────────────────────────────────┐
│ Plugin Configuration: {プラグイン名}         │
├─────────────────────────────────────────────┤
│                                             │
│ [基本情報セクション]                         │
│   名前: GitHub                              │
│   バージョン: 1.0.0                         │
│   説明: Sync GitHub events...               │
│   ベンダー: YourOrg                          │
│   ライセンス: MIT                            │
│   互換性: 0.9.0 - 2.0.0                     │
│                                             │
│ [権限セクション]                             │
│   スコープ:                                  │
│     • read:activities                       │
│     • write:activities                      │
│   ネットワーク:                              │
│     • https://api.github.com                │
│   シークレット:                              │
│     • github_token                          │
│                                             │
│ [設定項目セクション]                         │
│   ┌──────────────────────────────────┐     │
│   │ Key          Label          Type  │     │
│   ├──────────────────────────────────┤     │
│   │ org          Organization   text  │     │
│   │ github_token Access Token   secret│     │
│   │ sinceDays    Sync Range     number│     │
│   └──────────────────────────────────┘     │
│                                             │
│ [ルーティングセクション]                     │
│   ┌──────────────────────────────────┐     │
│   │ Method Path       Auth    Timeout│     │
│   ├──────────────────────────────────┤     │
│   │ POST   /sync     plugin   120s   │     │
│   │ POST   /widgets  plugin   10s    │     │
│   └──────────────────────────────────┘     │
│                                             │
└─────────────────────────────────────────────┘
```

### セクション詳細

#### 1. 基本情報セクション

- プラグインID、名前、バージョン、説明を表示
- ベンダー、ホームページ（リンク）、ライセンスを表示
- 互換性情報（対応するコアバージョン範囲）を表示

#### 2. 権限セクション

- **スコープ**: プラグインが要求するデータアクセス権限をバッジ形式で表示
  - `read:*` → 青色バッジ
  - `write:*` → 黄色バッジ（注意喚起）
- **ネットワーク**: 外部アクセス許可先をリスト表示
- **シークレット**: 必要なシークレットキー名をリスト表示

#### 3. 設定項目セクション

設定スキーマをテーブル形式で表示：
- **Key**: 設定キー
- **Label**: 表示ラベル
- **Type**: データ型（text, secret, number, etc.）
- **Required**: 必須フラグ（✓マーク）
- **Default**: デフォルト値
- **Constraints**: 制約条件（regex, min, max など）

#### 4. ルーティングセクション

ルート定義をテーブル形式で表示：
- **Method**: HTTPメソッド（色分け: GET=緑, POST=青, etc.）
- **Path**: パス
- **Auth**: 認証方式（plugin/public）
- **Timeout**: タイムアウト時間
- **Idempotent**: べき等性フラグ（✓マーク）

---

## UIコンポーネント

### 1. PluginConfigPage コンポーネント

```typescript
// app/routes/dashboard/plugins.$id.config.tsx

export default function PluginConfigPage() {
  // メインページコンポーネント
  // 各セクションを組み合わせて表示
}
```

### 2. BasicInfoSection コンポーネント

```typescript
// app/components/plugin/BasicInfoSection.tsx

interface BasicInfoSectionProps {
  basicInfo: PluginBasicInfo;
}

export function BasicInfoSection({ basicInfo }: BasicInfoSectionProps) {
  // 基本情報を表示
}
```

### 3. CapabilitiesSection コンポーネント

```typescript
// app/components/plugin/CapabilitiesSection.tsx

interface CapabilitiesSectionProps {
  capabilities: PluginCapabilities;
}

export function CapabilitiesSection({ capabilities }: CapabilitiesSectionProps) {
  // 権限情報を表示
  // スコープ、ネットワーク、シークレットをリスト表示
}
```

### 4. SettingsSchemaSection コンポーネント

```typescript
// app/components/plugin/SettingsSchemaSection.tsx

interface SettingsSchemaSectionProps {
  settingsSchema: PluginSettingSchema[];
}

export function SettingsSchemaSection({ settingsSchema }: SettingsSchemaSectionProps) {
  // 設定スキーマをテーブル形式で表示
}
```

### 5. RoutesSection コンポーネント

```typescript
// app/components/plugin/RoutesSection.tsx

interface RoutesSectionProps {
  routes: PluginRoute[];
}

export function RoutesSection({ routes }: RoutesSectionProps) {
  // ルート定義をテーブル形式で表示
  // メソッドごとに色分け
}
```

---

## エラーハンドリング

### エラーケース

1. **プラグインが存在しない**
   - ステータス: 404 Not Found
   - メッセージ: "Plugin not found"

2. **plugin.json が不正**
   - ステータス: 500 Internal Server Error
   - メッセージ: "Invalid plugin configuration"

3. **権限不足**
   - ステータス: 403 Forbidden
   - メッセージ: "Permission denied"

---

## セキュリティ考慮事項

1. **認証チェック**
   - API呼び出し時（`GET /api/plugins/:id/config`）に必ず認証チェックを実施
   - 未認証の場合は401 Unauthorizedを返す
   - クライアント側でも認証状態をチェックし、未認証の場合はログインページへリダイレクト

2. **権限チェック**
   - プラグイン設定の閲覧は管理者権限が必要（将来的に実装）
   - 現時点では認証済みユーザーであればアクセス可能

3. **シークレット情報の保護**
   - settingsSchemaで`type: "secret"`の項目は、実際の値を表示しない
   - プレースホルダー（"••••••"）のみ表示
   - APIレスポンスにもシークレット値は含めない

---

## テストケース

### 単体テスト（Vitest）

```typescript
// core/services/plugin/plugin-config.service.test.ts

describe('getPluginConfig', () => {
  it('プラグイン設定情報を正常に取得できる', async () => {
    // plugin.jsonが存在する場合、正しく読み込めることを確認
  });

  it('プラグインが存在しない場合はエラーを投げる', async () => {
    // 存在しないプラグインIDを指定した場合、エラーが投げられることを確認
  });

  it('plugin.jsonが不正な場合はエラーを投げる', async () => {
    // 不正なJSON形式の場合、エラーが投げられることを確認
  });
});

describe('pluginExists', () => {
  it('プラグインが存在する場合はtrueを返す', async () => {
    // 存在するプラグインIDでtrueが返ることを確認
  });

  it('プラグインが存在しない場合はfalseを返す', async () => {
    // 存在しないプラグインIDでfalseが返ることを確認
  });
});
```

### 統合テスト（Vitest）

```typescript
// app/routes/api/plugins.$id.config.test.ts

describe('GET /api/plugins/:id/config', () => {
  it('プラグイン設定情報を正常に取得できる', async () => {
    // 認証済みリクエスト
    // プラグインIDを指定してAPIを呼び出し
    // 200 OKが返ることを確認
    // レスポンスに基本情報、権限、設定スキーマ、ルートが含まれることを確認
  });

  it('プラグインが存在しない場合は404を返す', async () => {
    // 認証済みリクエスト
    // 存在しないプラグインIDを指定
    // 404 Not Foundが返ることを確認
  });

  it('未認証の場合は401を返す', async () => {
    // 未認証リクエスト
    // 401 Unauthorizedが返ることを確認
  });
});
```

### E2Eテスト（Playwright）

```typescript
// core/e2e/plugin-config.spec.ts

test.describe('Plugin Config Page', () => {
  test('プラグイン設定ページが正しく表示される', async ({ page }) => {
    // ログイン
    // /dashboard/plugins/:id/config にアクセス
    // ローディング表示が出ることを確認
    // 基本情報セクションが表示されることを確認
    // 権限セクションが表示されることを確認
    // 設定項目セクションが表示されることを確認
    // ルーティングセクションが表示されることを確認
  });

  test('プラグインが存在しない場合はエラーメッセージが表示される', async ({ page }) => {
    // ログイン
    // 存在しないプラグインIDでアクセス
    // エラーメッセージが表示されることを確認
  });

  test('未認証の場合はログインページにリダイレクトされる', async ({ page }) => {
    // ログインせずにアクセス
    // ログインページにリダイレクトされることを確認
  });

  test('ローディング状態が正しく表示される', async ({ page }) => {
    // ログイン
    // ページにアクセス
    // ローディングスピナーが表示されることを確認
    // データ取得後にローディングが消えることを確認
  });
});
```

---

## 完了条件

- [ ] `core/services/plugin/plugin-config.service.ts` が作成され、プラグイン設定情報を取得できる
- [ ] `app/routes/api/plugins.$id.config.ts` が作成され、APIが機能する
- [ ] `app/routes/dashboard/plugins.$id.config.tsx` が作成され、設定情報が表示される（SPA方式）
- [ ] 基本情報セクションが表示される
- [ ] 権限セクションが表示される
- [ ] 設定項目セクションが表示される
- [ ] ルーティングセクションが表示される
- [ ] ローディング状態とエラー状態が適切に表示される
- [ ] エラーハンドリングが適切に実装されている
- [ ] 単体テストが実装され、全てパスする
- [ ] 統合テスト（API）が実装され、全てパスする
- [ ] E2Eテストが実装され、全てパスする

---

## 備考

- プラグイン情報は`plugin.json`から直接読み込みます（データベースには保存しません）
- 将来的には、プラグインのバージョン管理や更新通知機能を追加する予定ですが、このタスクの対象外です
- ダークモード対応は既存のダッシュボードUIと同様に実装します
