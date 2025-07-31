#!/bin/bash

# Deploy Telegram Task Agent to VPS
# Usage: ./deploy-vps.sh

VPS_IP="5.75.171.46"
VPS_USER="root"  # Cambia si usas otro usuario
PROJECT_NAME="telegram-task-agent"

echo "🚀 Deploying Telegram Task Agent to VPS..."

# 1. Crear archivo tar con el proyecto (desde directorio raíz)
echo "📦 Creating deployment package..."
cd ..
tar -czf ${PROJECT_NAME}.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=workspace \
  --exclude=data \
  --exclude=tests \
  --exclude=temp \
  --exclude=*.log \
  --exclude=*.tar.gz \
  --exclude=.DS_Store \
  src/ \
  docs/ \
  scripts/ \
  package.json \
  package-lock.json \
  .env.production \
  docker-compose.yml \
  Dockerfile \
  README.md \
  LICENSE

# 2. Subir al VPS
echo "⬆️ Uploading to VPS..."
scp ${PROJECT_NAME}.tar.gz ${VPS_USER}@${VPS_IP}:/tmp/

# 3. Conectar y configurar
echo "🔧 Setting up on VPS..."
ssh ${VPS_USER}@${VPS_IP} << 'EOF'
  # Ir al directorio de aplicaciones
  cd /opt
  
  # Crear directorio del proyecto
  sudo mkdir -p telegram-task-agent
  cd telegram-task-agent
  
  # Extraer proyecto
  sudo tar -xzf /tmp/telegram-task-agent.tar.gz
  
  # Instalar dependencias
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
  npm install
  
  # Crear directorios necesarios
  mkdir -p data workspace
  chmod 755 data workspace
  
  # Crear archivo de servicio systemd
  sudo tee /etc/systemd/system/telegram-bot.service > /dev/null << 'SERVICE'
[Unit]
Description=Telegram Task Agent Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/telegram-task-agent
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/bot.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

  # Habilitar y iniciar servicio
  sudo systemctl daemon-reload
  sudo systemctl enable telegram-bot
  
  echo "✅ Setup complete!"
  echo "📝 Next steps:"
  echo "1. Configure .env file with your tokens"
  echo "2. Start service: sudo systemctl start telegram-bot"
  echo "3. Check status: sudo systemctl status telegram-bot"
  echo "4. View logs: journalctl -u telegram-bot -f"
EOF

# Limpiar archivo temporal
rm ${PROJECT_NAME}.tar.gz
cd scripts

echo "🎉 Deployment script completed!"
echo "📋 Manual steps remaining:"
echo "1. SSH to VPS: ssh ${VPS_USER}@${VPS_IP}"
echo "2. Go to project: cd /opt/telegram-task-agent"
echo "3. Configure .env with your tokens"
echo "4. Start bot: sudo systemctl start telegram-bot"