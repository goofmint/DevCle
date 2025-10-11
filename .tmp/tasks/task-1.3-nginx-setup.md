# Task 1.3: nginx設定とリバースプロキシ

**タスク番号**: 1.3
**フェーズ**: Phase 1 - 環境構築とインフラ基盤
**依存**: Task 1.2（Docker Compose構成ファイル作成）
**推定時間**: 2時間
**優先度**: 高

---

## 目的

nginxをリバースプロキシとして構成し、以下を実現する：
- Remixアプリケーションへのプロキシ
- 静的ファイル配信
- ヘルスチェックエンドポイント
- HTTPSリダイレクト（本番環境のみ）

---

## 完了条件

- [ ] nginxコンテナが正常に起動する
- [ ] `http://localhost` または `http://devcle.test` でRemixアプリケーションにアクセスできる
- [ ] 静的ファイル（`/public/*`）が直接配信される
- [ ] ヘルスチェックエンドポイント（`/health`）が応答する
- [ ] 開発環境でHTTPSリダイレクトが無効化されている

---

## 実装内容

### 1. nginx設定ファイル作成

#### ファイル構成

```
app/
├── infra/
│   └── nginx/
│       ├── nginx.conf          # メイン設定ファイル
│       ├── nginx.dev.conf      # 開発環境用オーバーライド
│       └── nginx.prod.conf     # 本番環境用設定
```

#### nginx.conf（開発環境用）

```nginx
# nginx.conf - Development Configuration

user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # ログフォーマット
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip圧縮
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    upstream remix_app {
        server core:3000;
    }

    server {
        listen 80;
        server_name localhost devcle.test;

        # リクエストサイズ制限
        client_max_body_size 10M;

        # ヘルスチェックエンドポイント
        location /health {
            access_log off;
            return 200 "OK\n";
            add_header Content-Type text/plain;
        }

        # 静的ファイル配信（/public）
        location /public/ {
            alias /app/public/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Remixアプリへのプロキシ
        location / {
            proxy_pass http://remix_app;
            proxy_http_version 1.1;

            # ヘッダー設定
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $host;

            # WebSocket対応
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";

            # タイムアウト設定
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
    }
}
```

#### nginx.prod.conf（本番環境用）

```nginx
# nginx.prod.conf - Production Configuration

user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log error;
pid /var/run/nginx.pid;

events {
    worker_connections 2048;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # ログフォーマット（JSON形式）
    log_format json_combined escape=json
    '{'
        '"time_local":"$time_local",'
        '"remote_addr":"$remote_addr",'
        '"request_method":"$request_method",'
        '"request_uri":"$request_uri",'
        '"status":$status,'
        '"body_bytes_sent":$body_bytes_sent,'
        '"http_referer":"$http_referer",'
        '"http_user_agent":"$http_user_agent",'
        '"request_time":$request_time'
    '}';

    access_log /var/log/nginx/access.log json_combined;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # セキュリティヘッダー
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip圧縮
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    # レート制限
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_status 429;

    upstream remix_app {
        server core:3000;
        keepalive 32;
    }

    # HTTP→HTTPSリダイレクト
    server {
        listen 80;
        server_name devcle.com www.devcle.com;

        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS サーバー
    server {
        listen 443 ssl http2;
        server_name devcle.com www.devcle.com;

        # SSL証明書（Let's Encryptを想定）
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # HSTS
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # リクエストサイズ制限
        client_max_body_size 10M;

        # ヘルスチェックエンドポイント
        location /health {
            access_log off;
            return 200 "OK\n";
            add_header Content-Type text/plain;
        }

        # 静的ファイル配信（/public）
        location /public/ {
            alias /app/public/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # API エンドポイント（レート制限適用）
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;

            proxy_pass http://remix_app;
            proxy_http_version 1.1;
            proxy_set_header Connection "";

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $host;

            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Remixアプリへのプロキシ
        location / {
            proxy_pass http://remix_app;
            proxy_http_version 1.1;
            proxy_set_header Connection "";

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $host;

            # WebSocket対応
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";

            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
    }
}
```

### 2. docker-compose.yml への nginx サービス追加

```yaml
services:
  nginx:
    image: nginx:1.25-alpine
    container_name: devcle-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./core/public:/app/public:ro
      - nginx_logs:/var/log/nginx
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
      start_period: 10s

volumes:
  nginx_logs:
    driver: local
```

### 3. docker-compose.prod.yml でのオーバーライド

```yaml
services:
  nginx:
    volumes:
      - ./infra/nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./core/public:/app/public:ro
      - /etc/letsencrypt/live/devcle.com/fullchain.pem:/etc/nginx/ssl/fullchain.pem:ro
      - /etc/letsencrypt/live/devcle.com/privkey.pem:/etc/nginx/ssl/privkey.pem:ro
      - nginx_logs:/var/log/nginx
```

---

## 設定内容の説明

### 開発環境（nginx.conf）

| 設定項目 | 内容 |
|---------|------|
| **リスンポート** | 80のみ（HTTPSリダイレクトなし） |
| **server_name** | `localhost`, `devcle.test` |
| **ログレベル** | warn（詳細ログ出力） |
| **静的ファイル** | `/public/*` を直接配信 |
| **プロキシ** | `core:3000` へリバースプロキシ |
| **WebSocket** | Upgrade/Connection ヘッダー対応 |
| **ヘルスチェック** | `/health` で200応答 |

### 本番環境（nginx.prod.conf）

| 設定項目 | 内容 |
|---------|------|
| **HTTPSリダイレクト** | ポート80→443へ301リダイレクト |
| **SSL/TLS** | TLSv1.2/1.3, Let's Encrypt証明書 |
| **セキュリティヘッダー** | X-Frame-Options, CSP, HSTS等 |
| **レート制限** | `/api/*` に10req/s制限 |
| **ログ形式** | JSON形式（構造化ログ） |
| **HTTP/2** | 有効化 |

---

## ヘルスチェックエンドポイント

### `/health`

```http
GET /health HTTP/1.1
Host: devcle.test

HTTP/1.1 200 OK
Content-Type: text/plain

OK
```

- nginx自体のヘルスチェック
- Docker Composeの`healthcheck`で使用
- ログ出力なし（`access_log off`）

---

## 静的ファイル配信

### ディレクトリ構成

```
core/
└── public/
    ├── favicon.ico
    ├── robots.txt
    ├── assets/
    │   ├── css/
    │   ├── js/
    │   └── images/
    └── fonts/
```

### キャッシュ戦略

- **キャッシュ期間**: 1年（`expires 1y`）
- **Cache-Control**: `public, immutable`
- **適用対象**: `/public/*` 配下のすべてのファイル

---

## プロキシ設定

### ヘッダー転送

| ヘッダー | 値 | 用途 |
|---------|---|------|
| `Host` | `$host` | オリジナルのホスト名 |
| `X-Real-IP` | `$remote_addr` | クライアントの実IPアドレス |
| `X-Forwarded-For` | `$proxy_add_x_forwarded_for` | プロキシチェーン |
| `X-Forwarded-Proto` | `$scheme` | HTTP/HTTPS判定 |
| `X-Forwarded-Host` | `$host` | 転送元ホスト |

### WebSocket対応

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

- Remix DevツールのHMR（Hot Module Replacement）に必要
- WebSocketコネクションの維持

---

## セキュリティ設定（本番環境）

### 1. HTTPSリダイレクト

```nginx
server {
    listen 80;
    server_name devcle.com;
    return 301 https://$server_name$request_uri;
}
```

### 2. セキュリティヘッダー

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### 3. レート制限

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    # ...
}
```

- `/api/*` エンドポイントに適用
- 10リクエスト/秒、バースト20まで許容
- 超過時は429（Too Many Requests）を返す

---

## 動作確認手順

### 1. nginx設定ファイルの文法チェック

```bash
docker-compose exec nginx nginx -t
```

**期待結果**:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 2. nginx再起動

```bash
docker-compose restart nginx
```

### 3. ヘルスチェック確認

```bash
curl -i http://localhost/health
```

**期待結果**:
```
HTTP/1.1 200 OK
Content-Type: text/plain

OK
```

### 4. Remixアプリへのアクセス確認

```bash
curl -i http://localhost/
```

**期待結果**:
```
HTTP/1.1 200 OK
Content-Type: text/html
# Remixアプリのレスポンス
```

### 5. 静的ファイル配信確認

```bash
curl -I http://localhost/public/favicon.ico
```

**期待結果**:
```
HTTP/1.1 200 OK
Cache-Control: public, immutable
Expires: <1年後の日付>
```

### 6. プロキシヘッダー確認

Remixアプリ側で以下のようにヘッダーを確認：

```typescript
// app/routes/debug.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  const headers = {
    host: request.headers.get('host'),
    xRealIp: request.headers.get('x-real-ip'),
    xForwardedFor: request.headers.get('x-forwarded-for'),
    xForwardedProto: request.headers.get('x-forwarded-proto'),
  };
  return json(headers);
}
```

---

## トラブルシューティング

### 問題1: nginxコンテナが起動しない

**原因**: 設定ファイルの文法エラー

**解決策**:
```bash
docker-compose logs nginx
docker-compose exec nginx nginx -t
```

### 問題2: 502 Bad Gateway

**原因**: coreコンテナが起動していない、またはポート3000で待機していない

**解決策**:
```bash
docker-compose ps
docker-compose logs core
```

### 問題3: 静的ファイルが404

**原因**: volumeマウントのパスが間違っている

**解決策**:
```bash
docker-compose exec nginx ls -la /app/public
```

### 問題4: WebSocketが接続できない

**原因**: Upgrade/Connectionヘッダーが転送されていない

**解決策**: nginx.confのproxy_set_header設定を確認

---

## 依存関係

### 前提条件
- Task 1.2（Docker Compose構成ファイル）が完了していること
- `core` サービスがポート3000で起動していること
- `core/public/` ディレクトリが存在すること

### 次のタスク
- Task 1.4（PostgreSQL初期設定）
- Task 1.5（Redis初期設定）

---

## チェックリスト

- [ ] `infra/nginx/nginx.conf` 作成
- [ ] `infra/nginx/nginx.prod.conf` 作成
- [ ] `docker-compose.yml` に nginx サービス追加
- [ ] `docker-compose.prod.yml` でSSL証明書マウント設定
- [ ] 設定ファイルの文法チェック（`nginx -t`）
- [ ] ヘルスチェックエンドポイント動作確認
- [ ] 静的ファイル配信の動作確認
- [ ] Remixアプリへのプロキシ動作確認
- [ ] WebSocket接続の動作確認（開発環境HMR）
- [ ] セキュリティヘッダーの確認（本番環境）
- [ ] レート制限の動作確認（本番環境）

---

## 参考資料

- [nginx公式ドキュメント](https://nginx.org/en/docs/)
- [nginx reverse proxy設定](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [WebSocket proxying](https://nginx.org/en/docs/http/websocket.html)
- [Remix Deployment Guide](https://remix.run/docs/en/main/guides/deployment)
- [Let's Encrypt](https://letsencrypt.org/)
