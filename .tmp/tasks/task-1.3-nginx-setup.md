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
- SSL/TLS設定（開発環境：mkcert、本番環境：Cloudflare Origin Certificate）

---

## 完了条件

- [ ] nginxコンテナが正常に起動する
- [ ] `https://localhost` または `https://devcle.test` でRemixアプリケーションにアクセスできる
- [ ] HTTPからHTTPSへ自動リダイレクトされる
- [ ] 静的ファイル（`/public/*`）が直接配信される
- [ ] mkcert証明書が正しくマウントされている

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

#### nginx.conf（開発環境用 - mkcert使用）

```nginx
# nginx.conf - Development Configuration with mkcert

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

    # HTTP→HTTPSリダイレクト
    server {
        listen 80;
        server_name localhost devcle.test;

        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS サーバー（mkcert証明書）
    server {
        listen 443 ssl http2;
        server_name localhost devcle.test;

        # SSL証明書（docker-composeでマウント）
        ssl_certificate /etc/nginx/certs/server.crt;
        ssl_certificate_key /etc/nginx/certs/server.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

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

#### 本番環境の設定（Cloudflare Origin Certificate使用）

本番環境では開発環境と同じ `nginx.conf` を使用します。証明書だけを `docker-compose.yml` でマウントして切り替えます。

**Cloudflare Origin Certificateの特徴**:
- Cloudflareが発行するオリジンサーバー専用の証明書
- 有効期限15年（自動更新不要）
- Cloudflareとオリジンサーバー間の通信を暗号化
- クライアント→Cloudflare間はCloudflareの証明書を使用
- 追加の設定項目：
  - セキュリティヘッダー（X-Frame-Options、HSTS等）
  - レート制限（API エンドポイント）
  - JSON形式のアクセスログ

**注意**: 本番環境では、nginx.confに以下の設定を追加します：
- セキュリティヘッダー（http ブロック内）
- レート制限（http ブロック内）
- JSON形式のログフォーマット

### 2. SSL証明書の準備

#### 開発環境: mkcert証明書

開発環境でHTTPSを使用するため、mkcertで自己署名証明書を作成します。

```bash
# mkcertのインストール（macOS）
brew install mkcert

# ルートCA証明書のインストール
mkcert -install

# devcle.test用の証明書生成
cd app/certs
mkcert devcle.test localhost 127.0.0.1 ::1
```

**生成される証明書**:
- `devcle.test+3.pem` - 証明書ファイル
- `devcle.test+3-key.pem` - 秘密鍵ファイル

#### 本番環境: Cloudflare Origin Certificate

Cloudflareダッシュボードから発行したオリジン証明書を使用します。

**証明書の取得手順**:
1. Cloudflareダッシュボードにログイン
2. 対象ドメイン（devcle.com）を選択
3. **SSL/TLS** → **Origin Server** に移動
4. **Create Certificate** をクリック
5. 以下の設定で証明書を生成：
   - **Private key type**: RSA (2048)
   - **Certificate Validity**: 15 years
   - **Hostnames**: `devcle.com`, `*.devcle.com`
6. 生成された証明書と秘密鍵をダウンロード：
   - **Origin Certificate**: `devcle.com.pem`（PEM形式）
   - **Private Key**: `devcle.com-key.pem`（PEM形式）
7. `app/certs/` ディレクトリに配置

**Cloudflare SSL/TLS設定**:
- **SSL/TLS encryption mode**: **Full (strict)**
  - Cloudflare→オリジンサーバー間も暗号化
  - オリジン証明書を検証

**注意**: `certs/` ディレクトリは `.gitignore` に追加して、証明書をコミットしないようにします。

### 3. docker-compose.yml への nginx サービス追加

**本番環境（docker-compose.yml）**:

```yaml
services:
  nginx:
    image: nginx:1.25-alpine
    container_name: devcle-nginx
    ports:
      - "80:80"
      - "443:443"
    environment:
      APP_DOMAIN: ${APP_DOMAIN:-devcle.com}
    volumes:
      # nginx設定ファイル
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      # 本番環境のSSL証明書（Cloudflare Origin Certificate）
      - ./certs/devcle.com.pem:/etc/nginx/certs/server.crt:ro
      - ./certs/devcle.com-key.pem:/etc/nginx/certs/server.key:ro
      # 静的ファイル
      - ./core/public:/var/www/public:ro
    depends_on:
      - core
    networks:
      - devcle-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pgrep nginx || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

networks:
  devcle-network:
    driver: bridge
```

**開発環境オーバーライド（docker-compose-dev.yml）**:

```yaml
services:
  nginx:
    volumes:
      # 開発環境のSSL証明書（mkcert）でオーバーライド
      - ./certs/devcle.test+3.pem:/etc/nginx/certs/server.crt:ro
      - ./certs/devcle.test+3-key.pem:/etc/nginx/certs/server.key:ro
```

### 4. 使用方法

**開発環境**:
```bash
docker compose -f docker-compose.yml -f docker-compose-dev.yml up -d
```

**本番環境**:
```bash
docker compose up -d
```

---

## 設定内容の説明

### 開発環境（nginx.conf - mkcert）

| 設定項目 | 内容 |
|---------|------|
| **リスンポート** | 80（HTTPSリダイレクト）、443（HTTPS） |
| **server_name** | `localhost`, `devcle.test` |
| **SSL証明書** | mkcert生成の自己署名証明書 |
| **HTTPSリダイレクト** | ポート80→443へ301リダイレクト |
| **ログレベル** | warn（詳細ログ出力） |
| **静的ファイル** | `/public/*` を直接配信 |
| **プロキシ** | `core:3000` へリバースプロキシ |
| **WebSocket** | Upgrade/Connection ヘッダー対応 |
| **ヘルスチェック** | `/health` で200応答 |

### 本番環境（nginx.conf + Cloudflare）

| 設定項目 | 内容 |
|---------|------|
| **HTTPSリダイレクト** | ポート80→443へ301リダイレクト |
| **SSL/TLS** | TLSv1.2/1.3, Cloudflare Origin Certificate |
| **SSL終端** | Cloudflare（クライアント側）+ nginx（オリジン側） |
| **セキュリティヘッダー** | X-Frame-Options, HSTS等（追加設定） |
| **レート制限** | `/api/*` に10req/s制限（追加設定） |
| **ログ形式** | JSON形式（構造化ログ、追加設定） |
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

## セキュリティ設定

### 1. HTTPSリダイレクト（開発・本番共通）

**開発環境（mkcert）**:
```nginx
server {
    listen 80;
    server_name localhost devcle.test;
    return 301 https://$server_name$request_uri;
}
```

**本番環境（Cloudflare Origin Certificate）**:
```nginx
server {
    listen 80;
    server_name devcle.com;
    return 301 https://$server_name$request_uri;
}
```

**注意**: Cloudflareを使用する場合も、オリジンサーバー側でHTTPSを有効にする必要があります。Cloudflareの **Full (strict)** モードでは、Cloudflareとオリジンサーバー間の通信も暗号化されます。

### 2. セキュリティヘッダー（本番環境のみ）

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

**注意**: 開発環境ではHSTSヘッダーは設定しません（mkcert証明書は自己署名のため）。

### 3. レート制限（本番環境のみ）

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

**注意**: 開発環境ではレート制限を設定しません（開発効率を優先）。

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

### 3. HTTPSリダイレクト確認

```bash
curl -i http://localhost/
```

**期待結果**:
```
HTTP/1.1 301 Moved Permanently
Location: https://localhost/
```

### 4. ヘルスチェック確認（HTTPS）

```bash
curl -i -k https://localhost/health
```

**期待結果**:
```
HTTP/2 200
Content-Type: text/plain

OK
```

### 5. Remixアプリへのアクセス確認（HTTPS）

```bash
curl -i -k https://localhost/
```

**期待結果**:
```
HTTP/2 200
Content-Type: text/html
# Remixアプリのレスポンス
```

### 6. 静的ファイル配信確認

```bash
curl -I -k https://localhost/public/favicon.ico
```

**期待結果**:
```
HTTP/2 200
Cache-Control: public, immutable
Expires: <1年後の日付>
```

### 7. プロキシヘッダー確認

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

### 開発環境
- [ ] mkcertのインストールと証明書生成
- [ ] `certs/devcle.test+3.pem` と `devcle.test+3-key.pem` の配置
- [ ] `nginx/nginx.conf` 作成（HTTPS対応）
- [ ] `docker-compose.yml` に nginx サービス追加（本番証明書パス）
- [ ] `docker-compose-dev.yml` で開発証明書をオーバーライド
- [ ] 設定ファイルの文法チェック（`nginx -t`）
- [ ] HTTPからHTTPSへのリダイレクト確認
- [ ] ヘルスチェックエンドポイント動作確認（HTTPS）
- [ ] 静的ファイル配信の動作確認（HTTPS）
- [ ] Remixアプリへのプロキシ動作確認（HTTPS）
- [ ] WebSocket接続の動作確認（HMR）

### 本番環境
- [ ] Cloudflare Origin Certificateの取得
- [ ] `certs/devcle.com.pem` と `devcle.com-key.pem` の配置
- [ ] CloudflareでSSL/TLS encryption modeを **Full (strict)** に設定
- [ ] `nginx/nginx.conf` に本番設定を追加（レート制限、セキュリティヘッダー、JSONログ）
- [ ] HTTPSでの接続確認（Cloudflare経由）
- [ ] セキュリティヘッダーの確認
- [ ] レート制限の動作確認

---

## 参考資料

- [nginx公式ドキュメント](https://nginx.org/en/docs/)
- [nginx reverse proxy設定](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [WebSocket proxying](https://nginx.org/en/docs/http/websocket.html)
- [Remix Deployment Guide](https://remix.run/docs/en/main/guides/deployment)
- [mkcert - ローカル開発用証明書](https://github.com/FiloSottile/mkcert)
- [Cloudflare Origin CA certificates](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/)
- [Cloudflare SSL/TLS encryption modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/)
