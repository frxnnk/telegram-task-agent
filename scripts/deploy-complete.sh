#!/bin/bash

set -e  # Exit on any error

echo "🚀 Complete Deployment Script for Background Agents Manager"
echo "==========================================================="

# Configuration
REPO_URL="https://github.com/frxnco/telegram-task-agent.git"  # Update with your repo
VPS_USER="root"
VPS_HOST="5.75.171.46"
PROJECT_DIR="/root/telegram-task-agent"
SERVICE_NAME="telegram-task-agent"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Step 1: Commit and push local changes
log "Step 1: Committing and pushing local changes..."
git add .
git commit -m "Complete deployment setup with Claude CLI integration" || warn "No changes to commit"
git push origin $(git branch --show-current) || error "Failed to push changes"

# Step 2: Deploy to VPS
log "Step 2: Deploying to VPS..."

ssh $VPS_USER@$VPS_HOST << 'ENDSSH'
set -e

log() {
    echo -e "\033[0;32m[$(date +'%Y-%m-%d %H:%M:%S')] $1\033[0m"
}

error() {
    echo -e "\033[0;31m[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1\033[0m"
    exit 1
}

log "🔧 Starting VPS deployment..."

# Update system packages
log "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages
log "📦 Installing required packages..."
apt install -y curl git nodejs npm docker.io docker-compose jq

# Install PM2 globally
log "📦 Installing PM2..."
npm install -g pm2

# Clone or update repository
if [ -d "/root/telegram-task-agent" ]; then
    log "📂 Updating existing repository..."
    cd /root/telegram-task-agent
    git pull origin main || git pull origin $(git branch --show-current)
else
    log "📂 Cloning repository..."
    cd /root
    git clone https://github.com/frxnco/telegram-task-agent.git || error "Failed to clone repository"
    cd telegram-task-agent
fi

# Install Node.js dependencies
log "📦 Installing Node.js dependencies..."
npm install --production

# Create necessary directories
log "📁 Creating directories..."
mkdir -p data logs workspace

# Set correct permissions
log "🔒 Setting permissions..."
chmod +x scripts/*.sh
chmod 755 workspace

# Start Docker service
log "🐳 Starting Docker service..."
systemctl enable docker
systemctl start docker

# Build agent image
log "🔨 Building Claude agent image..."
./scripts/build-agent-image.sh || error "Failed to build agent image"

# Check if .env exists, if not copy from example
if [ ! -f ".env" ]; then
    log "⚙️ Creating .env from example..."
    cp .env.example .env
    echo ""
    echo -e "\033[1;33m⚠️  IMPORTANT: Please edit .env file with your actual tokens:\033[0m"
    echo "   - TELEGRAM_BOT_TOKEN"
    echo "   - LINEAR_API_KEY" 
    echo "   - GITHUB_TOKEN"
    echo ""
    echo "Run: nano .env"
    echo ""
else
    log "✅ .env file already exists"
fi

# Verify Claude CLI authentication
log "🔐 Verifying Claude CLI authentication..."
if claude auth status > /dev/null 2>&1; then
    log "✅ Claude CLI is authenticated"
else
    echo -e "\033[1;33m⚠️  Claude CLI authentication required but was set up previously\033[0m"
fi

log "✅ VPS deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file: nano .env"
echo "2. Start the bot: pm2 start ecosystem.config.js"
echo "3. Save PM2 configuration: pm2 save && pm2 startup"

ENDSSH

log "Step 3: Deployment completed!"
echo ""
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "1. SSH to VPS: ssh $VPS_USER@$VPS_HOST"
echo "2. Edit environment: cd $PROJECT_DIR && nano .env"
echo "3. Start bot: pm2 start ecosystem.config.js"
echo "4. Monitor: pm2 monit"
echo ""
echo -e "${GREEN}✅ Deployment script completed successfully!${NC}"