#!/bin/bash
# setup-hosts.sh
# Automatically update /etc/hosts to resolve devcle.test to nginx container IP

set -e

echo "🔧 Setting up devcle.test hostname resolution..."

# Get nginx container IP from bridge network
NGINX_IP=$(docker inspect devcle-nginx-test --format '{{range $net, $conf := .NetworkSettings.Networks}}{{if eq $net "bridge"}}{{$conf.IPAddress}}{{end}}{{end}}' 2>/dev/null || echo "")

if [ -z "$NGINX_IP" ]; then
  echo "⚠️  Warning: nginx container not found or not connected to bridge network"
  echo "   Run: docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d"
  exit 0
fi

echo "   Found nginx at: $NGINX_IP"

# Create temporary hosts file
TMP_HOSTS=$(mktemp)
grep -v 'devcle\.test' /etc/hosts > "$TMP_HOSTS" || true
echo "$NGINX_IP devcle.test" >> "$TMP_HOSTS"

# Update /etc/hosts (requires Docker to be running with appropriate permissions)
if [ -w /etc/hosts ]; then
  cat "$TMP_HOSTS" > /etc/hosts
  rm "$TMP_HOSTS"
  echo "✅ /etc/hosts updated: devcle.test -> $NGINX_IP"
else
  echo "⚠️  /etc/hosts is not writable. Trying with docker exec..."
  # Get current container ID
  CONTAINER_ID=$(cat /proc/self/cgroup | grep 'docker' | sed 's/^.*\///' | tail -n1 | cut -c 1-12)
  if [ -n "$CONTAINER_ID" ]; then
    docker exec -u root "$CONTAINER_ID" sh -c "sed -i '/devcle\.test/d' /etc/hosts && echo '$NGINX_IP devcle.test' >> /etc/hosts"
    echo "✅ /etc/hosts updated via docker exec: devcle.test -> $NGINX_IP"
  else
    echo "❌ Could not update /etc/hosts. Please run manually:"
    echo "   docker exec -u root \$(docker ps --filter name=devcontainer -q) sh -c \"sed -i '/devcle\.test/d' /etc/hosts && echo '$NGINX_IP devcle.test' >> /etc/hosts\""
  fi
  rm "$TMP_HOSTS"
fi
