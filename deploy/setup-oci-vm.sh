#!/bin/bash
# ===========================================================
# Pro2Pro Bot — OCI VM Setup Script
# Run this ONCE after SSH-ing into a fresh Oracle Cloud VM
# Tested on Ubuntu 22.04 (ARM64 / Ampere A1)
# ===========================================================
set -euo pipefail

echo "=== Pro2Pro OCI Setup ==="

# 1. Update system
echo "[1/4] Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Docker
echo "[2/4] Installing Docker..."
sudo apt-get install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

# 3. Create app directory
echo "[3/4] Setting up app directory..."
sudo mkdir -p /opt/pro2pro
sudo chown "$USER":"$USER" /opt/pro2pro

# 4. Firewall — ensure outbound traffic and HTTP/HTTPS are allowed
echo "[4/4] Configuring firewall rules..."
if command -v iptables &>/dev/null; then
    # OCI Ubuntu images have iptables rules blocking some traffic by default
    # Ensure Docker network traffic is not blocked
    sudo iptables -I INPUT 1 -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || true

    # Open HTTP/HTTPS for Caddy (Let's Encrypt + reverse proxy)
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

    sudo netfilter-persistent save 2>/dev/null || true
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "IMPORTANT: Log out and back in for Docker group to take effect:"
echo "  exit"
echo "  ssh -i <your-key> ubuntu@<your-vm-ip>"
echo ""
echo "Then deploy with:"
echo "  cd /opt/pro2pro"
echo "  # Copy your project files here (see deploy instructions)"
echo "  docker compose up -d --build"
