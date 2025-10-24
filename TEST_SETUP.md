# テスト環境セットアップ手順

このドキュメントは、E2Eテストを実行するための環境セットアップ手順を説明します。

## 🚀 クイックスタート（ワンライナー）

```bash
# テスト環境起動 + ネットワーク設定 + /etc/hosts更新
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d && \
docker network connect bridge devcle-nginx-test 2>/dev/null || true && \
NGINX_IP=$(docker inspect devcle-nginx-test --format '{{range $net, $conf := .NetworkSettings.Networks}}{{if eq $net "bridge"}}{{$conf.IPAddress}}{{end}}{{end}}') && \
echo "$NGINX_IP devcle.test" | sudo tee /tmp/hosts.new && \
sudo sh -c 'grep -v "devcle.test" /etc/hosts > /tmp/hosts.tmp && cat /tmp/hosts.tmp /tmp/hosts.new > /etc/hosts' && \
echo "✅ Setup complete! nginx IP: $NGINX_IP" && \
curl -k -I https://devcle.test
```

**初回のみ**: マイグレーションとシードも実行
```bash
docker compose --env-file .env.test exec core pnpm db:migrate && \
docker compose --env-file .env.test exec core pnpm db:seed
```

## 前提条件

- DevContainer環境で作業していること
- Docker Composeが利用可能であること

## 🚨 重要: テスト環境起動時に毎回実行が必要

**`docker compose down`するたびに、ネットワーク接続が解除されるため、以下の手順を毎回実行してください。**

### ✅ 推奨: セットアップスクリプトを使用

```bash
# 1. テスト環境を起動
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d

# 2. ネットワーク設定スクリプトを実行（毎回実行）
/workspace/.devcontainer/setup-e2e-network.sh

# 3. スクリプトが表示するコマンドをコピーして実行（/etc/hosts更新）
#    例: echo "172.17.0.3 devcle.test" | sudo tee /tmp/hosts.new && ...
```

スクリプトは以下を実行します：
- nginxコンテナをbridgeネットワークに接続（自動）
- nginxのIPアドレスを取得（自動）
- /etc/hosts更新コマンドを表示（手動実行が必要）

### 🔧 手動セットアップ（スクリプトが使えない場合のみ）

```bash
# 1. テスト環境を起動
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d

# 2. nginxをbridgeネットワークに接続（毎回必要）
docker network connect bridge devcle-nginx-test

# 3. nginxコンテナのbridge network IPアドレスを取得
NGINX_IP=$(docker inspect devcle-nginx-test --format '{{range $net, $conf := .NetworkSettings.Networks}}{{if eq $net "bridge"}}{{$conf.IPAddress}}{{end}}{{end}}')
echo "Nginx IP: $NGINX_IP"

# 4. /etc/hostsを更新
echo "$NGINX_IP devcle.test" | sudo tee /tmp/hosts.new && \
sudo sh -c 'grep -v "devcle.test" /etc/hosts > /tmp/hosts.tmp && cat /tmp/hosts.tmp /tmp/hosts.new > /etc/hosts'

# 5. 確認
grep devcle.test /etc/hosts
```

### 2. セットアップの確認

```bash
# HTTPSで接続できることを確認
curl -k -I https://devcle.test
# HTTP/2 200 が返ってくればOK
```

## テスト環境の起動（完全な手順）

```bash
# 1. テスト環境を起動（データベース + Redis + アプリケーション + nginx）
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d

# 2. ネットワーク設定（🚨毎回必須）
/workspace/.devcontainer/setup-e2e-network.sh

# 3. データベースマイグレーション（初回 or schema変更時のみ）
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml exec core pnpm db:migrate

# 4. テストデータのシード（初回 or データリセット時のみ）
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml exec core pnpm db:seed
```

**注意**: ステップ2のネットワーク設定は、`docker compose down`後に再起動するたびに必要です。

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

### `net::ERR_ADDRESS_UNREACHABLE`または`net::ERR_CONNECTION_REFUSED`エラーが発生する場合

**最も多い原因**: ネットワークセットアップスクリプトを実行していない

```bash
# 🚨 必ず実行: ネットワーク設定
/workspace/.devcontainer/setup-e2e-network.sh
```

### 詳細な診断手順

1. nginxコンテナが起動していることを確認:
   ```bash
   docker compose --env-file .env.test ps
   # devcle-nginx-test が "Up" になっているか確認
   ```

2. **重要**: nginxがbridgeネットワークに接続されていることを確認:
   ```bash
   docker inspect devcle-nginx-test --format '{{range $net, $conf := .NetworkSettings.Networks}}{{$net}}: {{$conf.IPAddress}} {{end}}'
   ```

   **正しい出力例（bridgeとdevcle-networkの両方に接続）:**
   ```
   bridge: 172.17.0.3 workspace_devcle-network: 172.20.0.5
   ```

   **間違った出力例（bridgeに接続されていない）:**
   ```
   workspace_devcle-network: 172.20.0.5
   ```
   ↑ この場合、セットアップスクリプトを実行してください

3. /etc/hostsが正しく設定されていることを確認:
   ```bash
   grep devcle /etc/hosts
   ```

   **正しい例（bridgeネットワークのIP）:**
   ```
   172.17.0.3 devcle.test
   ```

   **間違った例（devcle-networkのIP）:**
   ```
   172.20.0.5 devcle.test
   ```
   ↑ この場合、セットアップスクリプトを実行してください

4. HTTPS接続テスト:
   ```bash
   curl -k -I https://devcle.test
   # HTTP/2 200 が返ってくればOK
   ```

### テスト環境の再起動

```bash
# すべてのコンテナを停止して削除（データは削除されます）
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml down -v

# 再起動
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d

# 🚨 重要: ネットワーク設定（毎回必須）
/workspace/.devcontainer/setup-e2e-network.sh

# マイグレーションとシードを再実行
docker compose --env-file .env.test exec core pnpm db:migrate
docker compose --env-file .env.test exec core pnpm db:seed
```

**注意**: `docker compose down`を実行すると、nginxのbridgeネットワーク接続が解除されます。必ずセットアップスクリプトを再実行してください。

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
