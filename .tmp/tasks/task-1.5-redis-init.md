# Task 1.5: Redis初期設定

**タスク番号**: 1.5
**フェーズ**: Phase 1 - 環境構築とインフラ基盤
**依存**: Task 1.2（Docker Compose構成ファイル作成）
**推定時間**: 1時間
**優先度**: 高

---

## 目的

Redis 7+の初期設定を行い、以下を実現する：
- セッション管理、キャッシュ、ジョブキュー（BullMQ）用のRedisインスタンス
- パスワード認証によるセキュリティ確保
- メモリ管理とevictionポリシーの設定
- データ永続化（AOF: Append Only File）
- Docker volumeによるデータ保護

---

## 完了条件

- [ ] Redisコンテナが正常に起動する
- [ ] パスワード認証が有効になる
- [ ] メモリ上限とevictionポリシーが設定される
- [ ] AOF永続化が有効になる
- [ ] `redis-cli`でRedisに接続できる
- [ ] データがDocker volumeで永続化される

---

## 実装内容

### 1. Redis設定ファイル

#### ファイル構成

```
app/
├── infra/
│   └── redis/
│       └── redis.conf           # Redis設定ファイル
```

#### redis.conf - Redis設定

```conf
# redis.conf
# Redis configuration for DevCle
# Version: Redis 7.x

# ====================
# Network Configuration
# ====================

# Bind to all interfaces (Docker internal network)
bind 0.0.0.0

# Default Redis port
port 6379

# TCP backlog (default: 511)
tcp-backlog 511

# Close connection after client idle for N seconds (0 = disable)
timeout 0

# TCP keepalive (send ACKs to clients, default: 300)
tcp-keepalive 300

# ====================
# Security
# ====================

# Require password for authentication
# This will be overridden by REDIS_PASSWORD environment variable in docker-compose.yml
requirepass <REDIS_PASSWORD>

# Disable dangerous commands in production
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""

# ====================
# Memory Management
# ====================

# Maximum memory limit (512MB for development, adjust for production)
maxmemory 512mb

# Eviction policy when maxmemory is reached
# allkeys-lru: Remove any key using LRU algorithm (good for cache)
# volatile-lru: Remove keys with expire set using LRU (good for sessions)
# We use allkeys-lru for general-purpose cache/session/queue
maxmemory-policy allkeys-lru

# LRU/LFU/minimal TTL samples (default: 5)
maxmemory-samples 5

# ====================
# Persistence (AOF)
# ====================

# Enable Append Only File for durability
appendonly yes

# AOF filename
appendfilename "appendonly.aof"

# AOF fsync policy
# always: fsync every write (slow, safest)
# everysec: fsync every second (good balance)
# no: let OS decide (fastest, least safe)
appendfsync everysec

# Rewrite AOF file when it grows by 100%
auto-aof-rewrite-percentage 100

# Minimum AOF file size before rewrite (64MB)
auto-aof-rewrite-min-size 64mb

# ====================
# Logging
# ====================

# Log level: debug, verbose, notice, warning
loglevel notice

# Log to stdout (Docker will capture)
logfile ""

# ====================
# Performance
# ====================

# Number of databases (default: 16)
databases 16

# Enable active memory defragmentation
activedefrag yes

# ====================
# Slow Log
# ====================

# Log queries slower than N microseconds (10ms = 10000)
slowlog-log-slower-than 10000

# Maximum slow log entries
slowlog-max-len 128
```

---

## 設定内容の説明

### パスワード認証

| 設定 | 値 | 説明 |
|------|-----|------|
| `requirepass` | 環境変数から注入 | Redisへの接続にパスワードが必要 |

**セキュリティ上の注意**:
- `.env`ファイルに`REDIS_PASSWORD`を設定
- docker-compose.ymlで環境変数として渡す
- ハードコーディングしない

### メモリ管理

| 設定 | 値 | 説明 |
|------|-----|------|
| `maxmemory` | 512mb | 開発環境用の上限（本番環境では増やす） |
| `maxmemory-policy` | allkeys-lru | メモリ上限時にLRUアルゴリズムで削除 |

**evictionポリシー**:
- `allkeys-lru`: すべてのキーから最も使われていないものを削除（キャッシュ用）
- `volatile-lru`: TTL付きキーから削除（セッション用）
- `noeviction`: メモリ不足時にエラー（ジョブキュー用）

DevCleでは汎用的な`allkeys-lru`を使用。

### データ永続化（AOF）

| 設定 | 値 | 説明 |
|------|-----|------|
| `appendonly` | yes | AOFを有効化 |
| `appendfsync` | everysec | 毎秒ディスクに書き込み（バランス型） |

**永続化戦略**:
- **AOF**: すべての書き込みコマンドをログに記録
- **RDB**: 使用しない（AOFで十分）
- **バックアップ**: Docker volumeでAOFファイルを永続化

### 危険なコマンドの無効化

```conf
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

**理由**:
- `FLUSHDB`/`FLUSHALL`: 全データ削除防止
- `CONFIG`: 実行時設定変更防止

---

## docker-compose.yml Redis設定

### インターフェース定義

```yaml
services:
  redis:
    # Interface: Redis 7.x Alpine image
    image: redis:7-alpine
    container_name: devcle-redis

    # Interface: Environment variables
    # - REDIS_PASSWORD: Password for authentication (required)
    environment:
      REDIS_PASSWORD: ${REDIS_PASSWORD}

    # Interface: Command to start Redis with password
    # Overrides requirepass in redis.conf with environment variable
    command: >
      redis-server /usr/local/etc/redis/redis.conf
      --requirepass ${REDIS_PASSWORD}

    # Interface: Volume mounts
    # - redis.conf: Configuration file (read-only)
    # - redis-data: Persistent data volume for AOF
    volumes:
      - ./infra/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis-data:/data

    # Interface: Network configuration
    networks:
      - devcle-network

    # Interface: Restart policy
    restart: unless-stopped

    # Interface: Health check
    # Verifies Redis is ready to accept connections with password
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

volumes:
  redis-data:
    driver: local
```

**説明**:
- `command`: redis.confの`requirepass`を環境変数でオーバーライド
- `volumes`: 設定ファイルとデータディレクトリをマウント
- `healthcheck`: パスワード認証込みで接続確認

---

## .env.example Redis設定

### インターフェース定義

```bash
# Redis Configuration
REDIS_PASSWORD=your_redis_password_here

# Redis URL for application (BullMQ, session, cache)
# Format: redis://:<password>@<host>:<port>/<db>
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
```

---

## 動作確認手順

以下のコマンドでRedisの動作を確認します。

### 1. Redisコンテナの起動確認

```bash
docker compose ps redis
```

**期待結果**:
```
NAME           STATUS          PORTS
devcle-redis   Up (healthy)    6379/tcp
```

### 2. Redis接続確認（パスワード認証）

```bash
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" ping
```

**期待結果**:
```
PONG
```

### 3. データ書き込み・読み取りテスト

```bash
# 書き込み
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" SET test "hello"

# 読み取り
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" GET test
```

**期待結果**:
```
OK
hello
```

### 4. AOF永続化確認

```bash
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" CONFIG GET appendonly
```

**期待結果**:
```
1) "appendonly"
2) "yes"
```

### 5. メモリ設定確認

```bash
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" CONFIG GET maxmemory
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" CONFIG GET maxmemory-policy
```

**期待結果**:
```
1) "maxmemory"
2) "536870912"  # 512MB in bytes

1) "maxmemory-policy"
2) "allkeys-lru"
```

### 6. データボリュームの確認

```bash
docker volume inspect devcle_redis-data
```

**期待結果**:
```json
[
    {
        "CreatedAt": "2025-10-11T...",
        "Driver": "local",
        "Mountpoint": "/var/lib/docker/volumes/devcle_redis-data/_data",
        "Name": "devcle_redis-data"
    }
]
```

---

## トラブルシューティング

### 問題1: Redisコンテナが起動しない

**原因**: 環境変数が設定されていない

**解決策**:
```bash
# .envファイルを確認
cat .env | grep REDIS_PASSWORD

# 設定されていない場合は追加
echo "REDIS_PASSWORD=your_secure_password" >> .env

# コンテナを再起動
docker compose up -d redis
```

### 問題2: 認証エラー (NOAUTH Authentication required)

**原因**: パスワードが設定されていないか、間違っている

**解決策**:
```bash
# 環境変数を確認
echo $REDIS_PASSWORD

# パスワード付きで接続
docker compose exec redis redis-cli -a "your_password" ping
```

### 問題3: redis.confが読み込まれない

**原因**: ファイルパスが間違っている、またはマウントされていない

**解決策**:
```bash
# redis.confが存在するか確認
ls -la infra/redis/redis.conf

# コンテナ内で確認
docker compose exec redis cat /usr/local/etc/redis/redis.conf

# マウントを再確認
docker compose config | grep -A 5 redis
```

### 問題4: データが永続化されない

**原因**: volumeがマウントされていない、またはAOFが無効

**解決策**:
```bash
# AOF設定を確認
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" CONFIG GET appendonly

# volumeを確認
docker volume ls | grep redis

# コンテナを削除して再作成（データは保持される）
docker compose down
docker compose up -d redis
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" GET test
```

---

## 依存関係

### 前提条件
- Task 1.2（Docker Compose構成ファイル）が完了していること
- `.env`ファイルに`REDIS_PASSWORD`が設定されていること

### 次のタスク
- Task 8.3（Job Scheduler実装）: BullMQでRedisを使用
- セッション管理: Remixセッションストアでredisを使用

---

## チェックリスト

- [ ] `infra/redis/redis.conf` 作成
- [ ] `.env.example` にRedis設定追加
- [ ] docker-compose.ymlのredisサービス確認
- [ ] Redisコンテナの起動確認
- [ ] パスワード認証の動作確認
- [ ] データ書き込み・読み取りテスト
- [ ] AOF永続化の確認
- [ ] メモリ設定の確認
- [ ] データボリュームの永続化確認
- [ ] 危険なコマンドが無効化されているか確認

---

## 参考資料

- [Redis 7 Documentation](https://redis.io/docs/)
- [Redis Configuration](https://redis.io/docs/management/config/)
- [Redis Persistence](https://redis.io/docs/management/persistence/)
- [Redis Security](https://redis.io/docs/management/security/)
- [Docker Redis Official Image](https://hub.docker.com/_/redis)
- [BullMQ Documentation](https://docs.bullmq.io/)
