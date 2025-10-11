# Task 1.4: PostgreSQL初期設定

**タスク番号**: 1.4
**フェーズ**: Phase 1 - 環境構築とインフラ基盤
**依存**: Task 1.2（Docker Compose構成ファイル作成）
**推定時間**: 1.5時間
**優先度**: 高

---

## 目的

PostgreSQL 15+データベースの初期設定を行い、以下を実現する：
- データベースとユーザーの初期化
- 必要な拡張機能の有効化（pgcrypto）
- テナント分離のためのRow Level Security (RLS)の準備
- データベースバックアップ用のvolumeマウント設定

---

## 完了条件

- [ ] PostgreSQLコンテナが正常に起動する
- [ ] データベースとユーザーが作成される
- [ ] pgcrypto拡張が有効化される
- [ ] RLSポリシーのテンプレートが作成される
- [ ] データベースボリュームが永続化される
- [ ] `psql`コマンドでデータベースに接続できる

---

## 実装内容

### 1. PostgreSQL初期化スクリプト

#### ファイル構成

```
app/
├── infra/
│   └── postgres/
│       ├── init.sh               # 初期化スクリプト（Shell）
│       └── rls-template.sql      # RLSポリシーテンプレート
```

#### init.sh - 初期化スクリプト

Docker PostgreSQLの`docker-entrypoint-initdb.d/`は`.sh`ファイルも実行可能です。環境変数を正しく展開するため、SQLを直接記述せず、シェルスクリプトから環境変数を読み込んでpsqlに渡します。

```bash
#!/bin/bash
# init.sh
# PostgreSQL database initialization script for DevCle
# This script runs only once when the database is first created
# Uses shell script to properly interpolate environment variables

set -e

# Read environment variables with defaults
DB_NAME="${POSTGRES_DB:-devcle}"
DB_USER="${POSTGRES_USER:-devcle}"

echo "Initializing PostgreSQL database: $DB_NAME for user: $DB_USER"

# Execute SQL statements with environment variable substitution
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- Enable pgcrypto extension for UUID generation and encryption
  -- Used for: generating UUIDs for primary keys, encrypting PII
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- Set default timezone to UTC for all new connections (persistent)
  -- This ensures consistent timestamp handling across the application
  ALTER DATABASE ${DB_NAME} SET timezone TO 'UTC';

  -- Grant necessary permissions to the database user
  -- Ensures the application can create tables and perform operations
  GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
  GRANT ALL PRIVILEGES ON SCHEMA public TO ${DB_USER};

  -- Log initialization completion
  DO \$\$
  BEGIN
    RAISE NOTICE 'Database initialized successfully';
    RAISE NOTICE 'Extensions enabled: pgcrypto';
    RAISE NOTICE 'Timezone set to: UTC (persistent via ALTER DATABASE)';
  END \$\$;
EOSQL

echo "PostgreSQL initialization completed successfully"
```

**重要な変更点**:
1. **ファイル形式**: `.sql` → `.sh` (環境変数展開のため)
2. **変数展開**: `${POSTGRES_DB}` → `${DB_NAME}` (シェルスクリプトで展開)
3. **タイムゾーン設定**: `SET timezone` → `ALTER DATABASE ${DB_NAME} SET timezone TO 'UTC'` (永続化)
4. **psqlへの渡し方**: Here-document (`<<-EOSQL`) を使用して環境変数を展開してからSQLを実行

#### rls-template.sql - RLSポリシーテンプレート

```sql
-- rls-template.sql
-- Template for Row Level Security (RLS) policies
-- This file demonstrates how to set up RLS for multi-tenant isolation
-- Actual RLS policies will be created during migration (Task 3.5)

-- Example: Enable RLS on a table
-- ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- Example: Create RLS policy for tenant isolation
-- CREATE POLICY tenant_isolation_policy ON <table_name>
--   USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Example: Allow users to see only their tenant's data
-- CREATE POLICY tenant_select_policy ON <table_name>
--   FOR SELECT
--   USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Example: Allow users to insert only into their tenant
-- CREATE POLICY tenant_insert_policy ON <table_name>
--   FOR INSERT
--   WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Example: Allow users to update only their tenant's data
-- CREATE POLICY tenant_update_policy ON <table_name>
--   FOR UPDATE
--   USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Example: Allow users to delete only their tenant's data
-- CREATE POLICY tenant_delete_policy ON <table_name>
--   FOR DELETE
--   USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Note: Actual RLS policies will be created per table during migration
-- This template shows the pattern to follow for tenant isolation
```

### 2. docker-compose.yml PostgreSQL設定

既存のdocker-compose.ymlにPostgreSQLサービスが定義されていることを確認します。

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: devcle-postgres
    environment:
      # Database name (defaults to 'devcle' if not set)
      POSTGRES_DB: ${POSTGRES_DB:-devcle}
      # Database user (defaults to 'devcle' if not set)
      POSTGRES_USER: ${POSTGRES_USER:-devcle}
      # Database password (must be set in .env)
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      # Persist database data using named volume
      - postgres-data:/var/lib/postgresql/data
      # Mount initialization script (read-only, executable)
      - ./infra/postgres/init.sh:/docker-entrypoint-initdb.d/init.sh:ro
    networks:
      - devcle-network
    restart: unless-stopped
    healthcheck:
      # Check if PostgreSQL is ready to accept connections
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-devcle}"]
      interval: 10s
      timeout: 5s
      retries: 5
      # Allow 30s for postgres to boot before starting healthchecks
      start_period: 30s

volumes:
  postgres-data:
    driver: local
```

**変更点**: `init.sql` → `init.sh` (環境変数展開とタイムゾーン永続化のため)

### 3. .env.example PostgreSQL設定

環境変数テンプレートにPostgreSQL設定を追加します。

```bash
# PostgreSQL Configuration
POSTGRES_DB=devcle
POSTGRES_USER=devcle
POSTGRES_PASSWORD=your_secure_password_here

# Database URL for application (Drizzle ORM)
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
```

---

## 設定内容の説明

### pgcrypto拡張

| 機能 | 用途 |
|------|------|
| `gen_random_uuid()` | UUID v4の生成（主キー用） |
| `pgp_sym_encrypt()` | データの暗号化（PII保護） |
| `pgp_sym_decrypt()` | データの復号化 |
| `digest()` | ハッシュ値の生成 |

### Row Level Security (RLS)

**目的**: マルチテナント環境でのデータ分離

**仕組み**:
1. 各テーブルに`tenant_id`カラムを追加
2. RLSポリシーを設定して、現在のテナントのデータのみアクセス可能にする
3. アプリケーションは`SET app.current_tenant_id = '<tenant_uuid>'`でテナントを設定
4. PostgreSQLが自動的にクエリにテナントIDフィルタを追加

**セキュリティ**:
- SQLインジェクション対策
- テナント間のデータ漏洩防止
- アプリケーションロジックに依存しないデータベースレベルの保護

### データベースボリューム

| ボリューム名 | マウント先 | 目的 |
|------------|-----------|------|
| `postgres-data` | `/var/lib/postgresql/data` | データベースファイルの永続化 |

**バックアップ戦略**:
- Docker volumeを使用してデータを永続化
- `docker volume inspect postgres-data`でボリュームの場所を確認
- バックアップ: `pg_dump`または`pg_basebackup`を使用
- リストア: volumeを削除して新しいデータをインポート

---

## 動作確認手順

### 1. PostgreSQLコンテナの起動確認

```bash
docker compose ps postgres
```

**期待結果**:
```
NAME              STATUS          PORTS
devcle-postgres   Up (healthy)    5432/tcp
```

### 2. データベース接続確認

```bash
docker compose exec postgres psql -U devcle -d devcle -c "SELECT version();"
```

**期待結果**:
```
                                                    version
---------------------------------------------------------------------------------------------------------------
 PostgreSQL 15.x on x86_64-pc-linux-musl, compiled by gcc (Alpine 12.2.1_git20220924) 12.2.1 20220924, 64-bit
(1 row)
```

### 3. pgcrypto拡張の確認

```bash
docker compose exec postgres psql -U devcle -d devcle -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'pgcrypto';"
```

**期待結果**:
```
 extname  | extversion
----------+------------
 pgcrypto | 1.3
(1 row)
```

### 4. UUID生成テスト

```bash
docker compose exec postgres psql -U devcle -d devcle -c "SELECT gen_random_uuid();"
```

**期待結果**:
```
           gen_random_uuid
--------------------------------------
 a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d
(1 row)
```

### 5. タイムゾーン確認

```bash
docker compose exec postgres psql -U devcle -d devcle -c "SHOW timezone;"
```

**期待結果**:
```
 TimeZone
----------
 UTC
(1 row)
```

### 6. データベースボリュームの確認

```bash
docker volume inspect devcle_postgres-data
```

**期待結果**:
```json
[
    {
        "CreatedAt": "2025-10-11T...",
        "Driver": "local",
        "Labels": {
            "com.docker.compose.project": "devcle",
            "com.docker.compose.version": "2.x.x",
            "com.docker.compose.volume": "postgres-data"
        },
        "Mountpoint": "/var/lib/docker/volumes/devcle_postgres-data/_data",
        "Name": "devcle_postgres-data",
        "Options": null,
        "Scope": "local"
    }
]
```

---

## トラブルシューティング

### 問題1: PostgreSQLコンテナが起動しない

**原因**: 環境変数が設定されていない

**解決策**:
```bash
# .envファイルが存在するか確認
cat .env | grep POSTGRES

# 環境変数を設定
cp .env.example .env
# .envファイルを編集してPOSTGRES_PASSWORDを設定
```

### 問題2: init.shが実行されない

**原因**: データベースボリュームが既に存在する

**解決策**:
```bash
# ボリュームを削除して再作成
docker compose down
docker volume rm devcle_postgres-data
docker compose up -d postgres

# ログを確認（init.shのechoとRAISE NOTICEが出力される）
docker compose logs postgres | grep "Initializing PostgreSQL"
docker compose logs postgres | grep "Database initialized"
```

### 問題3: pgcrypto拡張が見つからない

**原因**: PostgreSQLのバージョンが古い、またはalpineイメージに含まれていない

**解決策**:
```bash
# PostgreSQL 15+を使用していることを確認
docker compose exec postgres psql -U devcle -d devcle -c "SELECT version();"

# 手動で拡張を有効化
docker compose exec postgres psql -U devcle -d devcle -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

### 問題4: 接続エラー (connection refused)

**原因**: PostgreSQLが起動中、またはポートが開いていない

**解決策**:
```bash
# ヘルスチェックの状態を確認
docker compose ps postgres

# ログを確認
docker compose logs postgres

# 起動を待つ
docker compose exec postgres pg_isready -U devcle
```

---

## 依存関係

### 前提条件
- Task 1.2（Docker Compose構成ファイル）が完了していること
- `.env`ファイルにPostgreSQL設定が含まれていること

### 次のタスク
- Task 3.1（Drizzle ORMセットアップ）: このタスクでデータベース接続を使用
- Task 3.5（RLS設定）: このタスクで作成したテンプレートを使用

---

## チェックリスト

- [ ] `infra/postgres/init.sh` 作成（環境変数展開、タイムゾーン永続化対応）
- [ ] `infra/postgres/rls-template.sql` 作成
- [ ] `.env.example` にPostgreSQL設定追加
- [ ] docker-compose.ymlのpostgresサービス確認（init.shマウント）
- [ ] PostgreSQLコンテナの起動確認
- [ ] データベース接続確認
- [ ] pgcrypto拡張の動作確認
- [ ] UUID生成テスト
- [ ] タイムゾーン設定確認（永続化されているか確認）
- [ ] データベースボリュームの永続化確認

---

## 参考資料

- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/)
- [pgcrypto Extension](https://www.postgresql.org/docs/15/pgcrypto.html)
- [Row Level Security](https://www.postgresql.org/docs/15/ddl-rowsecurity.html)
- [Docker PostgreSQL Official Image](https://hub.docker.com/_/postgres)
- [PostgreSQL Initialization Scripts](https://github.com/docker-library/docs/blob/master/postgres/README.md#initialization-scripts)
