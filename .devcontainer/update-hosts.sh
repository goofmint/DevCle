#!/bin/bash
# update-hosts.sh
# Automatically update /etc/hosts when DevContainer starts

set -e

echo "🔧 Updating /etc/hosts for devcle.test..."

# Wait for docker to be ready
max_attempts=30
attempt=0
while ! docker ps >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "⚠️  Docker not ready after $max_attempts attempts, skipping /etc/hosts update"
    exit 0
  fi
  echo "   Waiting for docker... ($attempt/$max_attempts)"
  sleep 1
done

# Get nginx container IP from bridge network (if running)
NGINX_IP=$(docker inspect devcle-nginx-test --format '{{range $net, $conf := .NetworkSettings.Networks}}{{if eq $net "bridge"}}{{$conf.IPAddress}}{{end}}{{end}}' 2>/dev/null || echo "")

if [ -z "$NGINX_IP" ]; then
  echo "⚠️  nginx container not found. Run test environment first:"
  echo "   docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d"
  echo "   Then restart DevContainer or run this script manually with sudo"
  exit 0
fi

echo "   Found nginx at: $NGINX_IP"

# Remove old devcle.test entries and add new one
grep -v 'devcle\.test' /etc/hosts > /tmp/hosts.new || true
echo "$NGINX_IP devcle.test" >> /tmp/hosts.new
cat /tmp/hosts.new > /etc/hosts
rm /tmp/hosts.new

echo "✅ /etc/hosts updated: devcle.test -> $NGINX_IP"
