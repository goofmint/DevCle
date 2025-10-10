# Task 1.2: Docker Compose構成ファイル作成

**Phase**: 1 - 環境構築とインフラ基盤
**推定時間**: 3時間
**依存タスク**: Task 1.1

## 概要

DevCleプロジェクトの開発環境と本番環境をDocker Composeで構築する。nginx、core、PostgreSQL、Redisの4つのサービスで構成されるマルチコンテナ環境を実現する。

## 目標

- docker-compose.ymlによる本番環境構成の定義
- docker-compose-dev.ymlによる開発環境オーバーライドの定義
- core/Dockerfileの作成（Node.js 20 + pnpm）
- .dockerignore、.env.exampleの作成
- コンテナ起動確認とヘルスチェック

## 実装内容

### 1. Docker Compose メイン構成ファイル

```yaml
# docker-compose.yml (本番環境用)
version: '3.9'

services:
  nginx:
    image: nginx:1.25-alpine
    container_name: devcle-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
      - ./core/public:/var/www/public:ro
    depends_on:
      - core
    networks:
      - devcle-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  core:
    build:
      context: ./core
      dockerfile: Dockerfile
      target: production
    container_name: devcle-core
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      SESSION_SECRET: ${SESSION_SECRET}
    depends_on:
      - postgres
      - redis
    networks:
      - devcle-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    container_name: devcle-postgres
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-devcle}
      POSTGRES_USER: ${POSTGRES_USER:-devcle}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - devcle-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-devcle}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: devcle-redis
    command: redis-server /usr/local/etc/redis/redis.conf
    volumes:
      - redis-data:/data
      - ./infra/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
    networks:
      - devcle-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  devcle-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
```

**構成のポイント:**
- すべてのサービスが専用ネットワーク `devcle-network` で接続
- 各サービスにヘルスチェックを設定
- データ永続化のために named volumes を使用
- 本番環境用の restart policy を設定

### 2. 開発環境オーバーライド

```yaml
# docker-compose-dev.yml (開発環境用オーバーライド)
version: '3.9'

services:
  nginx:
    ports:
      - "8080:80"  # 開発環境は8080ポート使用
    volumes:
      - ./nginx/nginx-dev.conf:/etc/nginx/nginx.conf:ro

  core:
    build:
      target: development
    environment:
      NODE_ENV: development
    volumes:
      - ./core:/app
      - /app/node_modules  # node_modulesは除外
    ports:
      - "3000:3000"  # 開発サーバー直接アクセス用
    command: pnpm dev

  postgres:
    ports:
      - "5432:5432"  # ローカルから直接接続可能にする

  redis:
    ports:
      - "6379:6379"  # ローカルから直接接続可能にする
```

**開発環境の特徴:**
- ホットリロード対応（ソースコードをマウント）
- ポート開放でローカルツールからアクセス可能
- 開発用nginx設定を使用

### 3. core Dockerfile

```dockerfile
# core/Dockerfile
FROM node:20-alpine AS base

# pnpmインストール
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 依存関係のインストール
FROM base AS deps

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# 開発環境用ステージ
FROM base AS development

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
CMD ["pnpm", "dev"]

# ビルドステージ
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

# 本番環境用ステージ
FROM base AS production

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY package.json ./

EXPOSE 3000
CMD ["pnpm", "start"]
```

**マルチステージビルドの利点:**
- 開発環境と本番環境で異なるステージを使用
- 本番環境イメージを最小化
- ビルドキャッシュの効率化

### 4. .dockerignore

```gitignore
# .dockerignore
node_modules/
dist/
build/
.git/
.env
.env.local
*.log
.DS_Store
.cache/
coverage/
*.tsbuildinfo

# 開発ツール設定
.vscode/
.idea/
*.swp
*.swo

# ドキュメント
*.md
!README.md

# テスト
*.test.ts
*.spec.ts
__tests__/
```

**除外パターンの意図:**
- node_modulesはコンテナ内で再インストール
- ビルド成果物は除外
- 開発ツール設定は含めない

### 5. 環境変数テンプレート

```bash
# .env.example
# Database
POSTGRES_DB=devcle
POSTGRES_USER=devcle
POSTGRES_PASSWORD=change_this_password_in_production
DATABASE_URL=postgresql://devcle:change_this_password_in_production@postgres:5432/devcle

# Redis
REDIS_URL=redis://redis:6379

# Application
NODE_ENV=production
SESSION_SECRET=change_this_secret_in_production
APP_DOMAIN=devcle.com

# Optional: 本番環境のみ
# SENTRY_DSN=
# POSTHOG_API_KEY=
```

**環境変数の分類:**
- **必須**: DATABASE_URL, REDIS_URL, SESSION_SECRET
- **推奨**: POSTGRES_PASSWORD（本番環境では強力なパスワード）
- **オプション**: SENTRY_DSN, POSTHOG_API_KEY（監視ツール用）

## インターフェース定義

### Docker Compose サービス構成

```typescript
/**
 * Docker Compose サービス構成
 *
 * 4つのコンテナで構成されるマルチサービスアプリケーション:
 * - nginx: リバースプロキシ、静的ファイル配信
 * - core: Remixアプリケーション（Node.js 20 + pnpm）
 * - postgres: PostgreSQL 15（データ永続化）
 * - redis: Redis 7（セッション、キャッシュ、ジョブキュー）
 */
interface DockerComposeServices {
  nginx: {
    image: 'nginx:1.25-alpine';
    ports: ['80:80', '443:443'];
    volumes: [
      './nginx/nginx.conf:/etc/nginx/nginx.conf:ro',
      './core/public:/var/www/public:ro'
    ];
    dependsOn: ['core'];
  };

  core: {
    build: {
      context: './core';
      target: 'production' | 'development';
    };
    environment: {
      NODE_ENV: 'production' | 'development';
      DATABASE_URL: string;
      REDIS_URL: string;
      SESSION_SECRET: string;
    };
    dependsOn: ['postgres', 'redis'];
  };

  postgres: {
    image: 'postgres:15-alpine';
    environment: {
      POSTGRES_DB: string;
      POSTGRES_USER: string;
      POSTGRES_PASSWORD: string;
    };
    volumes: ['postgres-data:/var/lib/postgresql/data'];
  };

  redis: {
    image: 'redis:7-alpine';
    volumes: ['redis-data:/data'];
  };
}
```

### ヘルスチェック設定

```typescript
/**
 * コンテナヘルスチェック設定
 *
 * すべてのサービスにヘルスチェックを実装:
 * - nginx: HTTP GETリクエストで /health を確認
 * - core: Node.js fetch APIで /api/health を確認
 * - postgres: pg_isready コマンドで接続確認
 * - redis: redis-cli ping コマンドで応答確認
 */
interface HealthCheckConfig {
  test: string[];
  interval: string;  // 例: '30s'
  timeout: string;   // 例: '10s'
  retries: number;   // 例: 3
}

interface ServiceHealthChecks {
  nginx: HealthCheckConfig;
  core: HealthCheckConfig;
  postgres: HealthCheckConfig;
  redis: HealthCheckConfig;
}
```

## 完了条件

- [ ] `docker-compose.yml` が作成され、すべてのサービス定義が含まれている
- [ ] `docker-compose-dev.yml` が作成され、開発環境用のオーバーライドが設定されている
- [ ] `core/Dockerfile` がマルチステージビルドで作成されている
- [ ] `.dockerignore` が作成され、不要なファイルが除外されている
- [ ] `.env.example` が作成され、必要な環境変数が記載されている
- [ ] `docker-compose up -d` でコンテナが起動する
- [ ] `docker-compose ps` ですべてのコンテナが `healthy` 状態になる

## 検証方法

```bash
# .envファイルを作成（.env.exampleをコピー）
cp .env.example .env

# 環境変数を編集（パスワードなど）
# vim .env

# 本番環境モードで起動
docker-compose up -d

# コンテナ状態確認
docker-compose ps

# ログ確認
docker-compose logs -f

# ヘルスチェック確認
docker-compose ps --format "table {{.Name}}\t{{.Status}}"

# 開発環境モードで起動（オーバーライド適用）
docker-compose -f docker-compose.yml -f docker-compose-dev.yml up -d

# コンテナ停止
docker-compose down

# データ削除（注意: volumes も削除）
docker-compose down -v
```

## 次のタスクへの影響

このタスク完了後、以下のタスクが実行可能になる:
- **Task 1.3**: nginx設定とリバースプロキシ
- **Task 1.4**: PostgreSQL初期設定
- **Task 1.5**: Redis初期設定
- **Task 2.1**: Remix初期セットアップ

## 注意事項

### 🚨 CRITICAL: Dockerコンテナを停止しない

**絶対に実行してはいけないコマンド:**
- `docker-compose stop`
- `docker-compose restart`
- `docker stop`
- `docker restart`
- `docker kill`

**理由:** これらのコマンドは開発環境を破壊します。コンテナの停止が必要な場合は、必ずユーザーに確認してください。

### セキュリティ上の注意

1. **本番環境のパスワード**
   - `.env.example` のパスワードは必ず変更する
   - 強力なランダム文字列を使用（`openssl rand -base64 32`）

2. **環境変数ファイルの管理**
   - `.env` ファイルは `.gitignore` に含める
   - 本番環境の `.env` はソースコード管理に含めない

3. **ポート公開の制限**
   - 本番環境ではPostgreSQL、Redisのポートを公開しない
   - 開発環境のみポート開放

### マルチステージビルドの利点

- **開発環境**: ホットリロード対応、デバッグツール含む
- **本番環境**: 最小限のイメージサイズ、最適化されたビルド

## 参考資料

- [Docker Compose documentation](https://docs.docker.com/compose/)
- [Node.js Docker best practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [pnpm in Docker](https://pnpm.io/docker)
