#!/usr/bin/env bash
set -euo pipefail

SOCK="/var/run/docker.sock"
if [ ! -S "$SOCK" ]; then
  echo "[enable-docker-sock] Not found: $SOCK (is Docker running on host?)"
  exit 1
fi

# 1) ソケットのGIDを調べ、同一GIDのグループを用意
GID="$(stat -c '%g' "$SOCK")"
GRP_NAME="$(getent group "$GID" | cut -d: -f1 || true)"
if [ -z "${GRP_NAME:-}" ]; then
  GRP_NAME="host-docker"
  sudo -n groupadd -g "$GID" "$GRP_NAME" || true
fi

# 2) node を該当GIDグループへ追加（既に入っていれば成功扱い）
sudo -n usermod -aG "$GID" node || true
echo "[enable-docker-sock] docker.sock gid=$GID group=$GRP_NAME; node added to group."

# 3) “今すぐ使える” ように sudo バイパスの docker ラッパを配置
if [ ! -x /usr/local/bin/docker ]; then
  echo "[enable-docker-sock] installing sudo wrapper at /usr/local/bin/docker"
  sudo -n tee /usr/local/bin/docker >/dev/null <<'WRAP'
#!/bin/sh
# run real docker via sudo without password prompt
exec sudo -n /usr/bin/docker "$@"
WRAP
  sudo -n chmod +x /usr/local/bin/docker
fi

# 4) 動作チェック（失敗してもスクリプトは落とさない）
if /usr/local/bin/docker version >/dev/null 2>&1; then
  echo "[enable-docker-sock] docker client can talk to daemon now."
else
  echo "[enable-docker-sock] wrapper installed; if it still fails, check sudoers for /usr/bin/docker, /usr/bin/tee, /bin/chmod."
fi
