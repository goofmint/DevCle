# Task 8.3: Job Scheduler 実装（BullMQ）

## 概要

プラグインが定期実行ジョブ（cron）を登録・実行できるJob Schedulerシステムを実装します。BullMQを使用してRedisベースのジョブキューを構築し、プラグインが非同期タスクをスケジューリングできるようにします。

## 目的

- プラグインがcronスケジュールでジョブを登録できる
- BullMQを使用したRedisベースのジョブキュー実装
- Workerプロセスでジョブを非同期実行
- ジョブの実行状態を追跡・管理
- プラグインフックと統合（`plugin_runs`テーブルへのログ記録）

## 実装内容

### 1. BullMQインストール

**依存関係:**

```json
{
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.0"
  },
  "devDependencies": {
    "@types/ioredis": "^5.0.0"
  }
}
```

**説明:**
- `bullmq`: Redisベースのジョブキューライブラリ
- `ioredis`: RedisクライアントライブラリでBullMQが内部で使用

### 2. Scheduler実装

**ファイル:** `core/plugin-system/scheduler.ts`

#### 2.1 型定義

```typescript
import type { Job, JobsOptions, Worker } from 'bullmq';
import type { PluginContext } from './types.js';

/**
 * Job handler function signature
 * プラグインが提供するジョブハンドラー関数の型
 */
export type JobHandler = (ctx: PluginContext, job: Job) => Promise<void>;

/**
 * Job registration options
 * ジョブ登録時のオプション
 */
export interface JobOptions {
  /**
   * Cron expression (e.g., '0 0 * * *' for daily at midnight)
   * cron式（例: '0 0 * * *'で毎日深夜0時）
   */
  cron?: string;

  /**
   * Job priority (lower number = higher priority)
   * ジョブ優先度（数値が小さいほど優先度が高い）
   */
  priority?: number;

  /**
   * Max number of retry attempts
   * 最大リトライ回数
   */
  attempts?: number;

  /**
   * Backoff strategy for retries
   * リトライ時のバックオフ戦略
   */
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };

  /**
   * Job timeout in milliseconds
   * ジョブタイムアウト（ミリ秒）
   */
  timeout?: number;
}

/**
 * Job metadata stored in plugin_runs table
 * plugin_runsテーブルに保存されるジョブメタデータ
 */
export interface JobMetadata {
  jobId: string;
  jobName: string;
  attemptsMade: number;
  timestamp: Date;
  data?: unknown;
}
```

#### 2.2 Scheduler クラス

```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { createPluginContext } from './context.js';
import { logPluginRun } from './logger.js';

/**
 * Job Scheduler for plugin background tasks
 * プラグインのバックグラウンドタスク用Job Scheduler
 */
export class JobScheduler {
  private queues: Map<string, Queue>;
  private workers: Map<string, Worker>;
  private queueEvents: Map<string, QueueEvents>;
  private handlers: Map<string, JobHandler>;
  private redisConnection: Redis;

  constructor(redisUrl: string) {
    // Redis接続を初期化
    // BullMQのすべてのQueue/Worker/EventsインスタンスでRedis接続を共有
  }

  /**
   * Register a new job with scheduler
   * 新しいジョブをスケジューラーに登録
   *
   * @param pluginId - Plugin identifier
   * @param jobName - Unique job name within plugin
   * @param handler - Job handler function
   * @param options - Job scheduling options
   *
   * @example
   * scheduler.registerJob(
   *   'google-analytics',
   *   'sync-data',
   *   async (ctx, job) => {
   *     // ジョブのロジックをここに実装
   *   },
   *   { cron: '0 * * * *' } // 毎時0分に実行
   * );
   */
  async registerJob(
    pluginId: string,
    jobName: string,
    handler: JobHandler,
    options: JobOptions = {}
  ): Promise<void> {
    // 1. Queue名を生成（例: 'plugin:google-analytics:sync-data'）
    // 2. Queueインスタンスを作成（存在しない場合）
    // 3. ハンドラーをMapに保存
    // 4. cronオプションが指定されている場合、repeatable jobとして登録
    // 5. Workerをまだ作成していない場合は作成（後述のstartWorker）
  }

  /**
   * Remove a job from scheduler
   * ジョブをスケジューラーから削除
   *
   * @param pluginId - Plugin identifier
   * @param jobName - Job name to remove
   */
  async removeJob(pluginId: string, jobName: string): Promise<void> {
    // 1. Queue名を生成
    // 2. repeatable jobを削除
    // 3. ハンドラーをMapから削除
    // 4. そのQueueに他のジョブがない場合、Queue/Worker/Eventsをクリーンアップ
  }

  /**
   * Start worker for processing jobs
   * ジョブ処理用Workerを起動
   *
   * @param queueName - Queue name to process
   */
  private async startWorker(queueName: string): Promise<void> {
    // 1. Workerインスタンスを作成
    // 2. ジョブ処理ロジック:
    //    a. ハンドラーをMapから取得
    //    b. PluginContextを作成
    //    c. ハンドラーを実行
    //    d. 実行結果をplugin_runsテーブルに記録（logPluginRun）
    // 3. エラーハンドリング:
    //    a. ジョブ失敗時のリトライ
    //    b. エラーログの記録
    // 4. QueueEventsをリスンして完了/失敗イベントを処理
  }

  /**
   * Add a one-time job to queue
   * 1回限りのジョブをキューに追加
   *
   * @param pluginId - Plugin identifier
   * @param jobName - Job name
   * @param data - Job data payload
   * @param options - Job options
   */
  async addJob(
    pluginId: string,
    jobName: string,
    data?: unknown,
    options?: JobOptions
  ): Promise<void> {
    // 1. Queue名を生成
    // 2. Queueが存在しない場合はエラー（先にregisterJobが必要）
    // 3. job.add()で1回限りのジョブを追加
  }

  /**
   * Get job status
   * ジョブの状態を取得
   *
   * @param pluginId - Plugin identifier
   * @param jobName - Job name
   * @param jobId - Job ID
   */
  async getJobStatus(
    pluginId: string,
    jobName: string,
    jobId: string
  ): Promise<JobStatus | null> {
    // 1. Queue名を生成
    // 2. job.getState()でジョブの状態を取得
    // 3. 状態情報を返す（waiting, active, completed, failed, delayed）
  }

  /**
   * Close all connections
   * すべての接続をクローズ
   */
  async close(): Promise<void> {
    // 1. すべてのWorkerをクローズ
    // 2. すべてのQueueEventsをクローズ
    // 3. すべてのQueueをクローズ
    // 4. Redis接続をクローズ
  }
}

/**
 * Job status information
 * ジョブ状態情報
 */
export interface JobStatus {
  id: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  attemptsMade: number;
  progress?: number;
  returnvalue?: unknown;
  failedReason?: string;
  finishedOn?: Date;
}
```

#### 2.3 グローバルSchedulerインスタンス

```typescript
import { env } from '~/config/env.js';

/**
 * Global job scheduler instance
 * グローバルJob Schedulerインスタンス
 */
let globalScheduler: JobScheduler | null = null;

/**
 * Get or create global scheduler instance
 * グローバルSchedulerインスタンスを取得または作成
 */
export function getScheduler(): JobScheduler {
  if (!globalScheduler) {
    globalScheduler = new JobScheduler(env.REDIS_URL);
  }
  return globalScheduler;
}

/**
 * Close global scheduler
 * グローバルSchedulerをクローズ
 */
export async function closeScheduler(): Promise<void> {
  if (globalScheduler) {
    await globalScheduler.close();
    globalScheduler = null;
  }
}
```

### 3. Context実装

**ファイル:** `core/plugin-system/context.ts`

```typescript
import type { PluginContext } from './types.js';
import { getDb } from '~/db/connection.js';
import { getScheduler } from './scheduler.js';
import { getHookRegistry } from './hooks.js';

/**
 * Create plugin execution context
 * プラグイン実行コンテキストを作成
 *
 * @param pluginId - Plugin identifier
 * @param tenantId - Tenant identifier
 */
export function createPluginContext(
  pluginId: string,
  tenantId: string
): PluginContext {
  return {
    pluginId,
    tenantId,
    db: getDb(),
    scheduler: getScheduler(),
    hooks: getHookRegistry(),
    logger: {
      info: (message: string, meta?: unknown) => {
        // ログ出力実装
      },
      error: (message: string, error?: Error, meta?: unknown) => {
        // エラーログ出力実装
      },
    },
  };
}
```

### 4. Logger実装

**ファイル:** `core/plugin-system/logger.ts`

```typescript
import { schema } from '~/db/schema/index.js';
import { getDb } from '~/db/connection.js';
import type { JobMetadata } from './scheduler.js';

/**
 * Log plugin job execution to database
 * プラグインジョブ実行をデータベースにログ記録
 *
 * @param pluginId - Plugin identifier
 * @param tenantId - Tenant identifier
 * @param hookName - Hook name (for jobs, use 'job:' prefix)
 * @param status - Execution status
 * @param metadata - Job metadata
 * @param error - Error message if failed
 */
export async function logPluginRun(
  pluginId: string,
  tenantId: string,
  hookName: string,
  status: 'success' | 'error',
  metadata?: JobMetadata,
  error?: string
): Promise<void> {
  const db = getDb();
  await db.insert(schema.pluginRuns).values({
    pluginRunId: crypto.randomUUID(),
    pluginId,
    tenantId,
    hookName,
    status,
    argsHash: null, // Jobs don't have args hash
    result: metadata ? JSON.stringify(metadata) : null,
    error,
    executedAt: new Date(),
  });
}
```

### 5. Plugin定義への統合

**プラグインでの使用例:**

```typescript
import { definePlugin } from '@drm/plugin-api';

export default definePlugin({
  id: 'google-analytics',
  name: 'Google Analytics Integration',
  version: '1.0.0',

  async onLoad(ctx) {
    // プラグイン読み込み時にジョブを登録
    await ctx.scheduler.registerJob(
      ctx.pluginId,
      'sync-analytics-data',
      async (ctx, job) => {
        ctx.logger.info('Starting analytics sync', { jobId: job.id });

        try {
          // Google Analytics APIからデータを取得
          const data = await fetchAnalyticsData();

          // DRMのactivitiesテーブルに保存
          await saveActivities(ctx.db, data);

          ctx.logger.info('Analytics sync completed', {
            jobId: job.id,
            count: data.length,
          });
        } catch (error) {
          ctx.logger.error('Analytics sync failed', error, { jobId: job.id });
          throw error; // BullMQがリトライを処理
        }
      },
      {
        cron: '0 * * * *', // 毎時0分に実行
        attempts: 3, // 失敗時に最大3回リトライ
        backoff: {
          type: 'exponential',
          delay: 1000, // 1秒から開始して指数的に増加
        },
        timeout: 300000, // 5分でタイムアウト
      }
    );
  },

  async onUnload(ctx) {
    // プラグインアンロード時にジョブを削除
    await ctx.scheduler.removeJob(ctx.pluginId, 'sync-analytics-data');
  },
});
```

### 6. Worker起動

**ファイル:** `core/plugin-system/worker.ts`

```typescript
import { getScheduler } from './scheduler.js';

/**
 * Start job worker process
 * Job Workerプロセスを起動
 *
 * このファイルは別プロセスとして起動される想定
 * 例: node core/plugin-system/worker.js
 */
async function startWorker() {
  const scheduler = getScheduler();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing worker...');
    await scheduler.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, closing worker...');
    await scheduler.close();
    process.exit(0);
  });

  console.log('Job worker started');
}

startWorker().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});
```

## データベーススキーマ

既存の`plugin_runs`テーブルを使用してジョブ実行履歴を記録:

```sql
-- plugin_runs テーブル（既存）
CREATE TABLE plugin_runs (
  plugin_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  hook_name TEXT NOT NULL,  -- ジョブの場合は 'job:sync-data' 形式
  args_hash TEXT,           -- ジョブの場合はNULL
  status TEXT NOT NULL,     -- 'success' | 'error'
  result JSONB,             -- JobMetadataを保存
  error TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX idx_plugin_runs_tenant_plugin ON plugin_runs(tenant_id, plugin_id);
CREATE INDEX idx_plugin_runs_executed_at ON plugin_runs(executed_at DESC);
```

## BullMQの主な機能

### 1. Repeatable Jobs (Cron)

- cron式で定期実行ジョブを登録
- 自動的にスケジュール管理
- 実行履歴の追跡

### 2. Retry Mechanism

- ジョブ失敗時の自動リトライ
- Backoff戦略（exponential/fixed）
- 最大リトライ回数の設定

### 3. Priority Queue

- ジョブ優先度の設定
- 優先度順にジョブを処理

### 4. Timeout

- ジョブごとのタイムアウト設定
- タイムアウト時の自動失敗

### 5. Job Events

- ジョブ完了/失敗イベントのリスン
- 進捗状況の追跡

## 使用例

### 1. 定期実行ジョブ

```typescript
// 毎日深夜0時にデータをクリーンアップ
await scheduler.registerJob(
  'my-plugin',
  'cleanup-old-data',
  async (ctx) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await ctx.db
      .delete(schema.activities)
      .where(lt(schema.activities.timestamp, thirtyDaysAgo));
  },
  { cron: '0 0 * * *' }
);
```

### 2. 1回限りのジョブ

```typescript
// イベント発生時に非同期で処理
await scheduler.registerJob(
  'my-plugin',
  'send-notification',
  async (ctx, job) => {
    const { userId, message } = job.data;
    await sendEmail(userId, message);
  }
);

// ジョブをキューに追加
await scheduler.addJob('my-plugin', 'send-notification', {
  userId: '123',
  message: 'Hello!',
});
```

### 3. 優先度付きジョブ

```typescript
// 高優先度のジョブ
await scheduler.addJob(
  'my-plugin',
  'urgent-task',
  { data: 'important' },
  { priority: 1 } // 低い数値 = 高い優先度
);

// 低優先度のジョブ
await scheduler.addJob(
  'my-plugin',
  'background-task',
  { data: 'normal' },
  { priority: 10 }
);
```

## テスト計画

### 1. 単体テスト

- `JobScheduler.registerJob()` - ジョブ登録
- `JobScheduler.removeJob()` - ジョブ削除
- `JobScheduler.addJob()` - 1回限りのジョブ追加
- `JobScheduler.getJobStatus()` - ジョブ状態取得
- `createPluginContext()` - コンテキスト作成
- `logPluginRun()` - ログ記録

### 2. 統合テスト

- Cron式でジョブが定期実行される
- ジョブ失敗時にリトライされる
- `plugin_runs`テーブルにログが記録される
- 優先度順にジョブが処理される
- タイムアウトが正しく動作する

### 3. E2Eテスト

- プラグインがジョブを登録・実行できる
- ダッシュボードからジョブ実行履歴が確認できる（将来的な実装）

## パフォーマンス考慮事項

### 1. Redis接続プーリング

- BullMQはRedis接続を共有
- 接続数を最小限に抑える

### 2. Worker数

- CPU数に応じてWorker数を調整
- 環境変数`WORKER_CONCURRENCY`で設定可能

### 3. ジョブデータサイズ

- ジョブデータは小さく保つ（< 1MB推奨）
- 大きなデータはS3などに保存し、URLのみを渡す

## エラーハンドリング

### 1. ジョブ失敗時

- BullMQが自動的にリトライ
- 最大リトライ回数に達したら`failed`状態に
- `plugin_runs`テーブルにエラーログを記録

### 2. Worker障害時

- Workerが停止してもジョブはキューに残る
- Worker再起動時に未処理ジョブを処理

### 3. Redis接続障害時

- Redis接続が切れた場合、自動再接続
- 再接続できない場合はWorkerを停止

## セキュリティ考慮事項

### 1. テナント分離

- `PluginContext.tenantId`でテナントを識別
- ジョブ実行時に必ずテナントコンテキストを設定

### 2. プラグイン検証

- ジョブハンドラーはプラグイン読み込み時に検証済み
- 署名検証済みのプラグインのみ実行

### 3. リソース制限

- ジョブタイムアウトでリソース消費を制限
- Worker数を制限してCPU/メモリ使用量を管理

## 完了条件

- [x] BullMQとioredisがインストールされている
- [x] `core/plugin-system/scheduler.ts`が作成されている
- [x] `JobScheduler`クラスが実装されている
- [x] `registerJob()`でcronジョブを登録できる
- [x] `addJob()`で1回限りのジョブを追加できる
- [x] Workerがジョブを非同期実行する
- [x] ジョブ実行履歴が`plugin_runs`テーブルに記録される
- [x] 単体テストが全てパスする
- [x] 統合テストが全てパスする

## 依存関係

- Task 8.2: Hook Registry 実装（完了）
  - `plugin_runs`テーブルの使用
  - `PluginContext`型定義

## 推定時間

4 時間

## 関連ファイル

- `core/plugin-system/scheduler.ts` - Job Scheduler実装
- `core/plugin-system/context.ts` - Plugin Context作成
- `core/plugin-system/logger.ts` - Plugin実行ログ
- `core/plugin-system/worker.ts` - Worker起動スクリプト
- `core/plugin-system/types.ts` - 型定義（既存）
- `core/db/schema/plugins.ts` - plugin_runsテーブル（既存）
- `core/package.json` - 依存関係追加

## 参考資料

- [BullMQ Documentation](https://docs.bullmq.io/)
- [BullMQ Patterns](https://docs.bullmq.io/patterns/patterns)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
