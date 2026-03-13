#!/bin/bash
# ===========================================================
# Pro2Pro Bot — Deploy to OCI VM
# Run this from your LOCAL machine to deploy/update the bot
# Usage: ./deploy/deploy.sh <vm-ip> [ssh-key-path]
# ===========================================================
set -euo pipefail

VM_IP="${1:?Usage: ./deploy/deploy.sh <vm-ip> [ssh-key-path]}"
SSH_KEY="${2:-~/.ssh/id_rsa}"
REMOTE_DIR="/opt/pro2pro"
SSH_CMD="ssh -i $SSH_KEY ubuntu@$VM_IP"
SCP_CMD="scp -i $SSH_KEY"

echo "=== Deploying Pro2Pro to $VM_IP ==="

# 1. Sync project files to VM
echo "[1/3] Syncing files to VM..."
rsync -avz --delete \
    -e "ssh -i $SSH_KEY" \
    --exclude 'node_modules' \
    --exclude 'data/*.db' \
    --exclude 'data/*.db-shm' \
    --exclude 'data/*.db-wal' \
    --exclude '.git' \
    --exclude 'dist' \
    ./ "ubuntu@$VM_IP:$REMOTE_DIR/"

# 2. Copy .env file
echo "[2/3] Copying .env..."
$SCP_CMD .env "ubuntu@$VM_IP:$REMOTE_DIR/.env"

# 3. Build and start on VM
echo "[3/3] Building and starting bot on VM..."
$SSH_CMD "cd $REMOTE_DIR && docker compose up -d --build"

echo ""
echo "=== Deploy complete! ==="
echo ""
echo "Useful commands:"
echo "  $SSH_CMD 'docker logs -f pro2pro-bot'  # View logs"
echo "  $SSH_CMD 'docker compose -f $REMOTE_DIR/docker-compose.yml restart'  # Restart"
echo "  $SSH_CMD 'docker compose -f $REMOTE_DIR/docker-compose.yml down'     # Stop"
