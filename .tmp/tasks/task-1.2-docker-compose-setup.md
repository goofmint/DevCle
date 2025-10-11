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
# 注: Compose V2 (docker compose) を使用
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
      # Mount SSL certificate files for production (devcle.com)
      - ./certs/devcle.com.pem:/etc/nginx/certs/server.crt:ro
      - ./certs/devcle.com-key.pem:/etc/nginx/certs/server.key:ro
      - ./core/public:/var/www/public:ro
    depends_on:
      - core
    networks:
      - devcle-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

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
      test: ["CMD-SHELL", "node -e \"fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1))\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

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
      start_period: 30s

  redis:
    image: redis:7-alpine
    container_name: devcle-redis
    command: redis-server /usr/local/etc/redis/redis.conf
    environment:
      REDIS_PASSWORD: ${REDIS_PASSWORD:-}
    volumes:
      - redis-data:/data
      - ./infra/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
    networks:
      - devcle-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "[ -z \"$REDIS_PASSWORD\" ] && redis-cli ping || redis-cli -a \"$REDIS_PASSWORD\" ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

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
- SSL証明書の管理:
  - **本番環境** (`docker-compose.yml`): `certs/devcle.com.pem` と `certs/devcle.com-key.pem` を使用
  - **開発環境** (`docker-compose-dev.yml`): `certs/devcle.test+3.pem` と `certs/devcle.test+3-key.pem` を使用
  - nginx内部では固定パス `/etc/nginx/certs/server.crt` と `/etc/nginx/certs/server.key` としてマウント

### 2. 開発環境オーバーライド

```yaml
# docker-compose-dev.yml (開発環境用オーバーライド)
# 注: Compose V2 (docker compose) を使用
version: '3.9'

services:
  nginx:
    ports:
      - "8080:80"  # 開発環境は8080ポート使用
    volumes:
      - ./nginx/nginx-dev.conf:/etc/nginx/nginx.conf:ro
      # Override SSL certificate files for development (devcle.test)
      - ./certs/devcle.test+3.pem:/etc/nginx/certs/server.crt:ro
      - ./certs/devcle.test+3-key.pem:/etc/nginx/certs/server.key:ro

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
- nginx設定は本番と共通（SERVER_NAME環境変数でホスト名を切り替え）
- 開発用SSL証明書を使用（devcle.test）

### 3. core Dockerfile

```dockerfile
# core/Dockerfile
FROM node:20-alpine AS base

# pnpmインストール
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 依存関係のインストール（開発用）
FROM base AS deps-dev

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# 依存関係のインストール（本番用 - devDependencies除外）
FROM base AS deps-prod

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

# 開発環境用ステージ
FROM base AS development

COPY --from=deps-dev /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
CMD ["pnpm", "dev"]

# ビルドステージ
FROM base AS builder

COPY --from=deps-dev /app/node_modules ./node_modules
COPY . .

RUN pnpm build

# 本番環境用ステージ
FROM base AS production

ENV NODE_ENV=production

# 非rootユーザーの作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# 本番用依存関係とビルド成果物をコピー
COPY --from=deps-prod --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/build ./build
COPY --chown=nodejs:nodejs package.json ./

# 非rootユーザーに切り替え
USER nodejs

EXPOSE 3000
CMD ["pnpm", "start"]
```

**マルチステージビルドの利点:**
- 開発環境（deps-dev）と本番環境（deps-prod）で異なる依存関係を管理
- 本番環境イメージを最小化（devDependencies除外）
- 非rootユーザー（nodejs）でコンテナを実行し、セキュリティを向上
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
REDIS_PASSWORD=change_this_redis_password_in_production
REDIS_URL=redis://:change_this_redis_password_in_production@redis:6379

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
- **推奨**: POSTGRES_PASSWORD, REDIS_PASSWORD（本番環境では強力なパスワード）
- **オプション**: SENTRY_DSN, POSTHOG_API_KEY（監視ツール用）

**セキュリティ注意:**
- 本番環境では必ずRedisにパスワード認証を設定してください
- パスワードなしでRedisを運用すると重大なセキュリティリスクになります

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

このタスクでは、Docker Compose構成ファイルとDockerfileのドキュメントを作成します。実際のファイル作成と動作確認は後続タスクで行います。

- [ ] `docker-compose.yml` の設計が完了している
- [ ] `docker-compose-dev.yml` の設計が完了している
- [ ] `core/Dockerfile` の設計が完了している
- [ ] `.dockerignore` の設計が完了している
- [ ] `.env.example` の設計が完了している
- [ ] すべてのヘルスチェック設定に `start_period` が含まれている
- [ ] Redisヘルスチェックがパスワード認証に対応している
- [ ] 本番環境Dockerfileが非rootユーザーで実行される設計になっている
- [ ] 本番環境DockerfileがdevDependenciesを除外する設計になっている

**注意:** 実際のコンテナ起動と `healthy` 状態の確認は、以下のタスク完了後に行います:
- Task 1.3: nginx設定ファイル作成
- Task 1.4: PostgreSQL初期設定
- Task 1.5: Redis設定ファイル作成
- Task 2.5: ヘルスチェックAPI実装

## 検証方法

```bash
# .envファイルを作成（.env.exampleをコピー）
cp .env.example .env

# 環境変数を編集（パスワードなど）
# vim .env

# 本番環境モードで起動
docker compose up -d

# コンテナ状態確認
docker compose ps

# ログ確認
docker compose logs -f

# ヘルスチェック確認
docker compose ps --format "table {{.Name}}\t{{.Status}}"

# 開発環境モードで起動（オーバーライド適用）
docker compose -f docker-compose.yml -f docker-compose-dev.yml up -d

# コンテナ停止
docker compose down

# データ削除（注意: volumes も削除）
docker compose down -v
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
- `docker compose stop`
- `docker compose restart`
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
