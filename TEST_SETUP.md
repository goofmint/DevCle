# テスト環境セットアップ手順

このドキュメントは、E2Eテストを実行するための環境セットアップ手順を説明します。

## 前提条件

- DevContainer環境で作業していること
- Docker Composeが利用可能であること

## 🚨 重要: 初回セットアップ（一度だけ実行）

### 1. /etc/hostsの更新

DevContainer内の`/etc/hosts`を更新して、`devcle.test`がnginxコンテナのIPアドレスに解決されるようにします。

```bash
# 1. テスト環境を起動
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d

# 2. nginxコンテナのbridge network IPアドレスを取得
NGINX_IP=$(docker inspect devcle-nginx-test --format '{{range $net, $conf := .NetworkSettings.Networks}}{{if eq $net "bridge"}}{{$conf.IPAddress}}{{end}}{{end}}')
echo "Nginx IP: $NGINX_IP"

# 3. /etc/hostsを更新（手動で編集）
# 以下のコマンドを実行して表示された内容を /etc/hosts に追加してください
echo "$NGINX_IP devcle.test"

# または、以下のワンライナーで自動更新
# （rootユーザーとして実行する必要があります）
# echo "$NGINX_IP devcle.test" | sudo tee -a /etc/hosts
```

**または、自動セットアップスクリプトを使用:**

```bash
# DevContainerをrootで起動し直す必要がある場合
/workspace/.devcontainer/setup-hosts.sh
```

### 2. セットアップの確認

```bash
# devcle.testが正しく解決されることを確認
ping -c 1 devcle.test

# HTTPSで接続できることを確認
curl -k -I https://devcle.test
```

## テスト環境の起動

```bash
# テスト環境を起動（データベース + Redis + アプリケーション + nginx）
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d

# データベースマイグレーション
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml exec core pnpm db:migrate

# テストデータのシード
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml exec core pnpm db:seed
```

## テストの実行

### E2Eテスト（Playwright）

```bash
# すべてのE2Eテストを実行
cd /workspace/core && BASE_URL=https://devcle.test pnpm playwright test --reporter=list

# 特定のテストファイルのみ実行
cd /workspace/core && BASE_URL=https://devcle.test pnpm playwright test e2e/auth.spec.ts

# UIモードで実行（デバッグ用）
cd /workspace/core && BASE_URL=https://devcle.test pnpm playwright test --ui
```

### 統合テスト（Vitest）

```bash
# コンテナ内で実行
docker compose --env-file .env.test exec core pnpm test

# 型チェック
docker compose --env-file .env.test exec core pnpm typecheck
```

## トラブルシューティング

### `net::ERR_CONNECTION_REFUSED`エラーが発生する場合

1. nginxコンテナが起動していることを確認:
   ```bash
   docker compose --env-file .env.test ps
   ```

2. nginxがbridgeネットワークに接続されていることを確認:
   ```bash
   docker inspect devcle-nginx-test --format '{{range $net, $conf := .NetworkSettings.Networks}}{{$net}}: {{$conf.IPAddress}} {{end}}'
   ```

   出力例:
   ```
   bridge: 172.17.0.3 workspace_devcle-network: 172.20.0.5
   ```

3. /etc/hostsが正しく設定されていることを確認:
   ```bash
   grep devcle /etc/hosts
   ```

   正しい例:
   ```
   172.17.0.3 devcle.test
   ```

4. 必要に応じて手動で更新:
   ```bash
   NGINX_IP=$(docker inspect devcle-nginx-test --format '{{range $net, $conf := .NetworkSettings.Networks}}{{if eq $net "bridge"}}{{$conf.IPAddress}}{{end}}{{end}}')
   # /etc/hostsを手動編集して、以下の行を追加:
   # $NGINX_IP devcle.test
   ```

### テスト環境の再起動

```bash
# すべてのコンテナを停止して削除（データは削除されます）
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml down -v

# 再起動
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d

# マイグレーションとシードを再実行
docker compose --env-file .env.test exec core pnpm db:migrate
docker compose --env-file .env.test exec core pnpm db:seed

# /etc/hostsを再設定（IPアドレスが変わっている可能性があります）
/workspace/.devcontainer/setup-hosts.sh
```

## アーキテクチャの説明

### なぜbridgeネットワークが必要なのか？

- DevContainerはデフォルトの`bridge`ネットワーク（172.17.0.x）で動作
- docker-composeで起動したコンテナは`workspace_devcle-network`（172.20.0.x）で動作
- 異なるDockerネットワーク間では直接通信できない
- nginxコンテナを両方のネットワークに接続することで、DevContainerからアクセス可能にしている

### ネットワーク構成

```
DevContainer (172.17.0.2)
    ↓
bridge network (172.17.0.x)
    ↓
nginx (172.17.0.3 + 172.20.0.5)
    ↓
workspace_devcle-network (172.20.0.x)
    ↓
core, postgres, redis
```

## 参考

- docker-compose-test.yml: テスト環境の設定
- .env.test: テスト環境の環境変数
- .devcontainer/setup-hosts.sh: /etc/hosts自動更新スクリプト
