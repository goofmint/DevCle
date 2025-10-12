# Task 3.1: Drizzle ORMセットアップ

**タスクID**: 3.1
**推定時間**: 1.5時間
**依存タスク**: Task 1.4（PostgreSQL初期設定）
**完了条件**: Drizzleが初期化され、DB接続確認できる

---

## 概要

Drizzle ORMをセットアップし、PostgreSQLデータベースへの接続とマイグレーション管理の基盤を構築します。Drizzle ORMは型安全なSQL queryビルダーであり、PostgreSQLの全機能をTypeScriptで利用できます。

### Drizzle ORMの選定理由

- **型安全性**: TypeScriptファーストで設計され、完全な型推論を提供
- **軽量**: ゼロ依存で高速なクエリ実行
- **マイグレーション管理**: drizzle-kitによる自動マイグレーション生成
- **PostgreSQL対応**: RLS（Row Level Security）などの高度な機能をサポート
- **開発体験**: スキーマ定義からクエリまで一貫したAPI

---

## 実装内容

### 1. パッケージインストール

以下のパッケージをインストールします：

```json
{
  "dependencies": {
    "drizzle-orm": "^0.38.0",
    "postgres": "^3.4.5"
  },
  "devDependencies": {
    "drizzle-kit": "^0.29.0"
  }
}
```

**パッケージ説明**:
- `drizzle-orm`: ORMコア機能（クエリビルダー、型定義）
- `postgres`: PostgreSQLドライバー（Node.js用、高速・軽量）
- `drizzle-kit`: マイグレーション管理ツール（開発時のみ使用）

---

### 2. Drizzle設定ファイル（drizzle.config.ts）

Drizzle Kitの動作を制御する設定ファイルを作成します。

```typescript
/**
 * Drizzle Kit Configuration
 *
 * This file configures the Drizzle migration tool.
 * - schema: Location of schema definition files
 * - out: Output directory for generated migrations
 * - dialect: Database type (postgresql)
 * - dbCredentials: Connection parameters
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Schema definition files location
  // すべてのテーブルスキーマを定義したファイルのパス
  schema: './db/schema/index.ts',

  // Migration output directory
  // 生成されたマイグレーションSQLファイルの出力先
  out: './db/migrations',

  // Database dialect
  // 使用するデータベースの種類
  dialect: 'postgresql',

  // Database connection credentials
  // データベース接続情報（環境変数から取得）
  dbCredentials: {
    host: process.env['DATABASE_HOST'] || 'localhost',
    port: Number(process.env['DATABASE_PORT']) || 5432,
    user: process.env['DATABASE_USER'] || 'postgres',
    password: process.env['DATABASE_PASSWORD'] || 'postgres',
    database: process.env['DATABASE_NAME'] || 'devcle_dev',
    ssl: process.env['DATABASE_SSL'] === 'true',
  },

  // Verbose logging for debugging
  // マイグレーション実行時の詳細ログ表示
  verbose: true,

  // Strict mode for schema validation
  // スキーマの厳密な検証（型エラーを早期発見）
  strict: true,
});
```

**設定項目の説明**:
- `schema`: スキーマ定義ファイルの場所。すべてのテーブル定義をimportする`db/schema/index.ts`を指定
- `out`: マイグレーションファイルの出力先。Gitで管理し、本番環境でも使用
- `dialect`: `postgresql`を指定（MySQL、SQLiteなども選択可能）
- `dbCredentials`: 環境変数から接続情報を取得。開発環境と本番環境で切り替え可能
- `verbose`: マイグレーション実行時に詳細なログを表示（デバッグ用）
- `strict`: スキーマの型チェックを厳密に実施

---

### 3. データベース接続設定（db/connection.ts）

データベースへの接続を管理するモジュールを作成します。

```typescript
/**
 * Database Connection Module
 *
 * This module provides a connection pool to the PostgreSQL database.
 * It uses the 'postgres' driver for high performance and automatic
 * connection pooling.
 *
 * Key Features:
 * - Connection pooling for efficient resource usage
 * - Environment-based configuration
 * - Type-safe database client
 * - Error handling and logging
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

/**
 * Database connection options interface
 * データベース接続オプションの型定義
 */
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  max?: number; // Maximum connections in pool
  idle_timeout?: number; // Idle connection timeout (seconds)
  connect_timeout?: number; // Connection timeout (seconds)
}

/**
 * Get database configuration from environment variables
 * 環境変数からデータベース設定を取得
 *
 * @returns {DatabaseConfig} Database configuration object
 */
function getDatabaseConfig(): DatabaseConfig {
  // Implementation:
  // 1. Read environment variables (DATABASE_URL or individual params)
  // 2. Parse connection string if DATABASE_URL is provided
  // 3. Apply default values for missing parameters
  // 4. Validate required fields (throw error if missing)

  return {
    host: process.env['DATABASE_HOST'] || 'localhost',
    port: Number(process.env['DATABASE_PORT']) || 5432,
    database: process.env['DATABASE_NAME'] || 'devcle_dev',
    username: process.env['DATABASE_USER'] || 'postgres',
    password: process.env['DATABASE_PASSWORD'] || 'postgres',
    ssl: process.env['DATABASE_SSL'] === 'true',
    max: Number(process.env['DATABASE_POOL_MAX']) || 20,
    idle_timeout: Number(process.env['DATABASE_IDLE_TIMEOUT']) || 30,
    connect_timeout: Number(process.env['DATABASE_CONNECT_TIMEOUT']) || 10,
  };
}

/**
 * Create PostgreSQL connection
 * PostgreSQL接続を作成
 *
 * @returns {postgres.Sql} PostgreSQL client with connection pool
 */
export function createConnection(): postgres.Sql {
  // Implementation:
  // 1. Get database configuration
  // 2. Create postgres client with connection pooling
  // 3. Configure SSL if required
  // 4. Set up error handlers
  // 5. Return client instance

  const config = getDatabaseConfig();

  const sql = postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    ssl: config.ssl,
    max: config.max,
    idle_timeout: config.idle_timeout,
    connect_timeout: config.connect_timeout,
    // Automatically convert column names from snake_case to camelCase
    transform: postgres.camel,
  });

  return sql;
}

/**
 * Database client instance (singleton)
 * データベースクライアントのシングルトンインスタンス
 */
let dbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Get Drizzle database client
 * Drizzleデータベースクライアントを取得
 *
 * @returns {ReturnType<typeof drizzle>} Drizzle ORM client with schema
 */
export function getDb() {
  // Implementation:
  // 1. Check if instance already exists (singleton pattern)
  // 2. If not, create new connection and Drizzle instance
  // 3. Attach schema for type-safe queries
  // 4. Cache instance for reuse
  // 5. Return instance

  if (!dbInstance) {
    const sql = createConnection();
    dbInstance = drizzle(sql, { schema });
  }

  return dbInstance;
}

/**
 * Close database connection
 * データベース接続を閉じる
 *
 * Used for:
 * - Graceful shutdown
 * - Testing cleanup
 * - Resource management
 */
export async function closeDb(): Promise<void> {
  // Implementation:
  // 1. Check if instance exists
  // 2. Close all connections in pool
  // 3. Set instance to null
  // 4. Log closure event

  if (dbInstance) {
    // Close connection pool
    await dbInstance.$client.end();
    dbInstance = null;
  }
}

/**
 * Test database connection
 * データベース接続をテスト
 *
 * @returns {Promise<boolean>} true if connection successful
 * @throws {Error} if connection fails
 */
export async function testConnection(): Promise<boolean> {
  // Implementation:
  // 1. Get database client
  // 2. Execute simple query (SELECT 1)
  // 3. Return true if successful
  // 4. Throw error with details if failed
  // 5. Log connection status

  try {
    const db = getDb();
    const result = await db.execute(sql`SELECT 1 as test`);
    return result.length > 0;
  } catch (error) {
    console.error('Database connection test failed:', error);
    throw new Error('Failed to connect to database');
  }
}
```

**実装ポイント**:

1. **接続プーリング**: `postgres`ドライバーは自動的にコネクションプールを管理
2. **シングルトンパターン**: アプリ全体で1つのDB接続を共有（メモリ効率化）
3. **環境変数管理**: 開発・本番環境で接続情報を切り替え可能
4. **型安全性**: Drizzleスキーマを渡すことで、クエリの型チェックが有効化
5. **グレースフルシャットダウン**: `closeDb()`でクリーンアップ可能

---

### 4. ディレクトリ構造

以下のディレクトリ構造を作成します：

```
core/
├── db/
│   ├── connection.ts          # データベース接続管理
│   ├── index.ts               # dbモジュールのエントリポイント
│   ├── schema/                # テーブルスキーマ定義
│   │   └── index.ts           # すべてのスキーマをexport
│   └── migrations/            # マイグレーションファイル
│       ├── 0000_initial.sql   # 初期マイグレーション（自動生成）
│       └── meta/              # マイグレーションメタデータ
│           └── _journal.json  # マイグレーション履歴
├── drizzle.config.ts          # Drizzle Kit設定
└── package.json
```

**各ファイルの役割**:
- `connection.ts`: PostgreSQL接続とDrizzleクライアントの初期化
- `schema/index.ts`: すべてのテーブルスキーマを集約（Task 3.2で実装）
- `migrations/`: SQLマイグレーションファイル（自動生成）
- `drizzle.config.ts`: マイグレーション生成とDB同期の設定

---

### 5. マイグレーションディレクトリの作成

マイグレーションファイルを格納するディレクトリを作成します。

```bash
# Create migration directory
mkdir -p db/migrations/meta
```

**マイグレーションの仕組み**:
1. スキーマ定義（`db/schema/*.ts`）を作成
2. `pnpm db:generate`でマイグレーションSQL生成
3. `db/migrations/`にSQLファイルが生成される
4. `pnpm db:migrate`で本番DBに適用

---

### 6. package.jsonスクリプト

マイグレーション管理用のnpmスクリプトを追加します。

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:drop": "drizzle-kit drop"
  }
}
```

**スクリプトの説明**:
- `db:generate`: スキーマからマイグレーションSQLを生成
- `db:migrate`: マイグレーションをデータベースに適用
- `db:push`: スキーマを直接DBに反映（開発時のみ推奨）
- `db:studio`: Drizzle Studio（GUIツール）を起動
- `db:drop`: 最後のマイグレーションを取り消し

---

### 7. 環境変数設定

`.env.example`に以下の設定を追加します：

```bash
# Database Configuration
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=devcle_dev
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_SSL=false

# Connection Pool Settings
DATABASE_POOL_MAX=20
DATABASE_IDLE_TIMEOUT=30
DATABASE_CONNECT_TIMEOUT=10

# Alternative: Use connection string
# DATABASE_URL=postgresql://postgres:postgres@postgres:5432/devcle_dev
```

---

## 実装の流れ

### ステップ1: パッケージインストール

```bash
cd core
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

### ステップ2: 設定ファイル作成

1. `drizzle.config.ts`を作成
2. `db/connection.ts`を作成
3. `db/schema/index.ts`を作成（空ファイル）

### ステップ3: マイグレーションディレクトリ作成

```bash
mkdir -p db/migrations/meta
```

### ステップ4: 接続テスト

```typescript
// Test script: db/test-connection.ts
import { testConnection } from './connection';

async function main() {
  try {
    const success = await testConnection();
    console.log('✅ Database connection successful:', success);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

main();
```

```bash
pnpm tsx db/test-connection.ts
```

### ステップ5: package.jsonスクリプト追加

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:drop": "drizzle-kit drop",
    "db:test": "tsx db/test-connection.ts"
  }
}
```

---

## 完了条件

以下の条件をすべて満たすこと：

- [x] `drizzle-orm`, `drizzle-kit`, `postgres`パッケージがインストールされている
- [x] `drizzle.config.ts`が作成され、正しい設定が記述されている
- [x] `db/connection.ts`が作成され、接続関数が定義されている
- [x] `db/migrations/`ディレクトリが作成されている
- [x] `pnpm db:test`でデータベース接続が確認できる
- [x] TypeScriptのビルドエラーがない

---

## テスト方法

### 1. パッケージインストール確認

```bash
pnpm list drizzle-orm drizzle-kit postgres
```

期待する出力:
```
drizzle-orm 0.38.0
drizzle-kit 0.29.0
postgres 3.4.5
```

### 2. TypeScriptビルド確認

```bash
pnpm typecheck
```

期待する出力: `No errors`

### 3. データベース接続確認

```bash
pnpm db:test
```

期待する出力:
```
✅ Database connection successful: true
```

---

## トラブルシューティング

### 問題1: データベース接続エラー

**症状**: `ECONNREFUSED` エラーが発生

**原因**: PostgreSQLコンテナが起動していない

**解決方法**:
```bash
docker-compose up -d postgres
docker-compose logs postgres
```

### 問題2: 環境変数が読み込まれない

**症状**: `undefined` エラーが発生

**原因**: `.env`ファイルが読み込まれていない

**解決方法**:
```bash
# .env.exampleから.envを作成
cp .env.example .env

# Remix設定でdotenvを有効化
# vite.config.tsでenvPrefixを設定
```

### 問題3: TypeScriptエラー

**症状**: `Cannot find module 'drizzle-orm'`

**原因**: パッケージが正しくインストールされていない

**解決方法**:
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## 次のタスク

Task 3.1完了後、以下のタスクに進みます：

- **Task 3.2**: コアテーブルスキーマ定義
  - `tenants`, `developers`, `organizations`, `activities`, `identifiers`テーブルの定義
  - RLS対応のため、すべてのテーブルに`tenant_id`を追加

---

## 参考資料

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle Kit Documentation](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL Driver (postgres.js)](https://github.com/porsager/postgres)
- [Drizzle with PostgreSQL Tutorial](https://orm.drizzle.team/docs/get-started-postgresql)
