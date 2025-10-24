#!/bin/bash
# E2E Test Network Setup Script
#
# This script ensures nginx container is connected to both networks
# and provides the command to update /etc/hosts.
#
# Run this script after starting the test environment:
#   docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d
#
# Then run this script:
#   /workspace/.devcontainer/setup-e2e-network.sh

set -e

echo "🔧 Setting up E2E test network configuration..."
echo ""

# Step 1: Connect nginx to bridge network (if not already connected)
echo "📡 Connecting nginx to bridge network..."
if docker network inspect bridge | grep -q "devcle-nginx-test"; then
  echo "   ✅ nginx already connected to bridge network"
else
  docker network connect bridge devcle-nginx-test
  echo "   ✅ nginx connected to bridge network"
fi

# Step 2: Get nginx IP on bridge network
echo ""
echo "🔍 Getting nginx IP address on bridge network..."
NGINX_IP=$(docker inspect devcle-nginx-test --format '{{range $net, $conf := .NetworkSettings.Networks}}{{if eq $net "bridge"}}{{$conf.IPAddress}}{{end}}{{end}}')

if [ -z "$NGINX_IP" ]; then
  echo "   ❌ Failed to get nginx IP address"
  exit 1
fi

echo "   ✅ nginx IP: $NGINX_IP"

# Step 3: Show command to update /etc/hosts
echo ""
echo "📝 Next step: Update /etc/hosts (requires sudo)"
echo "   Copy and run the following command:"
echo ""
echo "   echo \"$NGINX_IP devcle.test\" | sudo tee /tmp/hosts.new && sudo sh -c 'grep -v \"devcle.test\" /etc/hosts > /tmp/hosts.tmp && cat /tmp/hosts.tmp /tmp/hosts.new > /etc/hosts'"
echo ""
echo "   After running the command above, verify with:"
echo "   grep devcle.test /etc/hosts"
echo ""
echo "   Then test HTTPS connection:"
echo "   curl -k -I https://devcle.test"
echo ""
echo "✅ Network setup (nginx bridge connection) completed!"
echo "   Don't forget to run the /etc/hosts update command above."
