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
- [ ] Unit Tests 全パス（最低 10 tests）
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
