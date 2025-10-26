# Task 8.2: Hook Registry 実装

**Status:** ドキュメント作成完了
**Branch:** `feature/task-8.2-hook-registry`
**Estimated Time:** 2 時間

---

## 概要

プラグインシステムの拡張ポイントを提供する Hook Registry を実装します。

### 責務

- **フックの登録**: プラグインが任意のタイミングで処理を差し込めるようにフックハンドラを登録
- **フックの実行**: 登録されたフックを順次実行し、結果を集約
- **実行ログの記録**: `plugin_runs` テーブルにフック実行履歴を記録（監視・デバッグ用）

---

## 実装対象ファイル

### `core/plugin-system/hooks.ts`

#### インタフェース

```typescript
/**
 * Hook execution context
 * Provides tenant ID, plugin ID, and other metadata to hook handlers
 */
interface HookContext {
  tenantId: string;
  pluginId: string;
  hookName: string;
  timestamp: Date;
}

/**
 * Hook handler function type
 * @param ctx - Hook execution context
 * @param args - Hook-specific arguments
 * @returns Promise<void> or void
 */
type HookHandler<T = unknown> = (ctx: HookContext, args: T) => Promise<void> | void;

/**
 * Hook execution result
 */
interface HookExecutionResult {
  success: boolean;
  runId: string;
  errors: Array<{ pluginId: string; error: Error }>;
}
```

#### 関数

**`registerHook<T>(hookName: string, pluginId: string, handler: HookHandler<T>): void`**
- 指定されたフック名にハンドラを登録
- 同一フック名に複数のハンドラを登録可能（配列で管理）
- プラグイン ID を記録し、後でログと紐付け
- スレッドセーフな実装（Map 使用）

**`executeHook<T>(hookName: string, tenantId: string, args: T): Promise<HookExecutionResult>`**
- 登録されたすべてのハンドラを順次実行
- 各ハンドラに `HookContext` と `args` を渡す
- 実行結果を `plugin_runs` テーブルに記録
  - `trigger`: "hook"
  - `status`: "success" | "failed"
  - `result`: `{ hookName, argsHash, errors }`
- エラーが発生してもスキップし、次のハンドラを実行（Fail-Safe）
- すべてのエラーを集約して返す

**`unregisterHook(hookName: string, pluginId: string): void`**
- 指定されたプラグインのフックハンドラを削除
- プラグイン無効化時に呼び出される

**`listHooks(): Map<string, Array<{ pluginId: string; handler: HookHandler }>>`**
- 登録されているすべてのフックを返す（デバッグ用）

---

## フック名の命名規則

プラグインが登録可能なフック名は以下の形式に従う：

- `before:{entity}:{action}` - エンティティ操作の前（例: `before:developer:create`）
- `after:{entity}:{action}` - エンティティ操作の後（例: `after:activity:create`）
- `cron:{schedule}` - 定期実行（例: `cron:daily`、`cron:hourly`）

将来的なフック例：
- `before:developer:create`
- `after:activity:create`
- `after:campaign:update`
- `cron:daily`

---

## `plugin_runs` テーブルスキーマ

Hook Registry は既存の `plugin_runs` テーブルにフック実行ログを記録します。

### テーブル構造

| カラム名 | 型 | 必須 | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| `run_id` | UUID | ✓ | `uuid_generate_v4()` | 実行ログの一意識別子（Primary Key） |
| `tenant_id` | TEXT | ✓ | - | テナント ID（FK to `tenants.tenant_id`, CASCADE DELETE） |
| `plugin_id` | UUID | ✓ | - | プラグイン ID（FK to `plugins.plugin_id`, CASCADE DELETE） |
| `trigger` | TEXT | ✓ | - | トリガー種別（"hook" / "cron" / "manual" / "webhook"） |
| `started_at` | TIMESTAMPTZ | ✓ | `now()` | 実行開始時刻 |
| `finished_at` | TIMESTAMPTZ |  | - | 実行終了時刻（完了時に更新） |
| `status` | TEXT | ✓ | `"running"` | 実行ステータス（"running" / "success" / "failed" / "partial"） |
| `result` | JSONB |  | - | 実行結果の詳細情報（構造は下記参照） |

### インデックス

- `idx_plugin_runs_tenant_plugin_time` - `(tenant_id, plugin_id, started_at DESC)`
  - 用途: テナント・プラグインごとの最近の実行ログを高速に取得

### `result` フィールドの構造（Hook Registry での使用）

```typescript
interface HookExecutionResultRecord {
  hookName: string;           // 実行されたフック名（例: "after:activity:create"）
  argsHash: string;           // 引数のハッシュ値（重複実行検出用、SHA-256）
  errors: Array<{             // エラー詳細（空配列の場合は全て成功）
    pluginId: string;
    errorMessage: string;
    stack?: string;           // スタックトレース（開発環境のみ）
  }>;
  handlerCount: number;       // 実行されたハンドラ数
  successCount: number;       // 成功したハンドラ数
  failureCount: number;       // 失敗したハンドラ数
}
```

### サンプルログ行

#### 成功例

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "default",
  "plugin_id": "550e8400-e29b-41d4-a716-446655440000",
  "trigger": "hook",
  "started_at": "2025-10-26T12:34:56.789Z",
  "finished_at": "2025-10-26T12:34:57.123Z",
  "status": "success",
  "result": {
    "hookName": "after:activity:create",
    "argsHash": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    "errors": [],
    "handlerCount": 3,
    "successCount": 3,
    "failureCount": 0
  }
}
```

#### エラー例（一部失敗）

```json
{
  "run_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "tenant_id": "default",
  "plugin_id": "550e8400-e29b-41d4-a716-446655440000",
  "trigger": "hook",
  "started_at": "2025-10-26T12:35:00.000Z",
  "finished_at": "2025-10-26T12:35:01.456Z",
  "status": "partial",
  "result": {
    "hookName": "before:campaign:update",
    "argsHash": "a3c5b2f8e9d1c4a7b6f3e2d8c1a9b7f6e5d4c3a2b1f9e8d7c6a5b4f3e2d1c0b9",
    "errors": [
      {
        "pluginId": "660e8400-e29b-41d4-a716-446655440001",
        "errorMessage": "Failed to send Slack notification: Connection timeout",
        "stack": "Error: Connection timeout\n    at SlackClient.send (/app/plugins/slack/client.ts:45:11)"
      }
    ],
    "handlerCount": 2,
    "successCount": 1,
    "failureCount": 1
  }
}
```

---

## エラーハンドリング

- **ハンドラ実行エラー**: ログに記録し、次のハンドラを実行（Fail-Safe）
- **フック名の重複登録**: 許可（複数ハンドラを順次実行）
- **未登録フックの実行**: エラーにせず、空の結果を返す（Silent Fail）

---

## セキュリティ

- **テナント分離**: `HookContext` に `tenantId` を含め、フックハンドラがテナント外のデータにアクセスできないようにする
- **引数の検証**: フックハンドラ内で引数を検証し、不正なデータを拒否
- **実行時間制限**: 長時間実行されるフックはタイムアウト（Phase 9 以降）
- **サンドボックス実行**: プラグインを隔離環境で実行（Phase 9 以降）

---

## テスト方針

### Unit Tests (`core/plugin-system/hooks.test.ts`)

- `registerHook()`: ハンドラ登録、複数ハンドラ登録、重複登録（3 tests）
- `executeHook()`: ハンドラ実行、複数ハンドラ実行、エラーハンドリング、未登録フック（4 tests）
- `unregisterHook()`: ハンドラ削除、未登録フックの削除（2 tests）
- `listHooks()`: 登録フック一覧取得（1 test）

### Integration Tests

- プラグインロードとフック登録の統合
- `plugin_runs` テーブルへのログ記録
- エラー発生時のロールバック

合計で最低 10 テスト以上を実装する。

---

## 完了条件

- [ ] `core/plugin-system/hooks.ts` 作成
- [ ] `registerHook()` 実装
- [ ] `executeHook()` 実装
- [ ] `unregisterHook()` 実装
- [ ] `listHooks()` 実装
- [ ] `plugin_runs` テーブルへのログ記録実装
- [ ] Unit Tests 全パス
- [ ] `pnpm typecheck` パス
- [ ] `pnpm lint` パス

---

## 使用例

### プラグイン側（フック登録）

```typescript
// drowl-plugin-slack/src/index.ts
import { registerHook } from '@drm/core/plugin-system/hooks.js';

export function activate(pluginId: string) {
  registerHook('after:activity:create', pluginId, async (ctx, args) => {
    const { activity } = args;

    // Slack に通知
    await sendSlackNotification(ctx.tenantId, activity);
  });
}
```

### Core 側（フック実行）

```typescript
// core/services/activity-create.service.ts
import { executeHook } from '../plugin-system/hooks.js';

export async function createActivity(tenantId: string, data: CreateActivityInput) {
  const activity = await insertActivity(data);

  // プラグインフックを実行
  await executeHook('after:activity:create', tenantId, { activity });

  return activity;
}
```

---

## 参考資料

- [VS Code Extension API - Events](https://code.visualstudio.com/api/references/vscode-api#events)
- [WordPress Hooks](https://developer.wordpress.org/plugins/hooks/)
- [Webpack Tapable](https://github.com/webpack/tapable)
