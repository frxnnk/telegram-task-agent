#!/bin/bash

# =================================================================
# SCRIPT DE DEPLOYMENT INTEGRAL TESTING 
# VPS: 5.75.171.46 (Hetzner Ubuntu 24.04.2 LTS)
# =================================================================

set -e  # Exit on any error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables de configuración
VPS_IP="5.75.171.46"
VPS_USER="root"
PROJECT_DIR="/root/telegram-task-agent"
GITHUB_REPO="telegram-task-agent"  # Ajustar según tu repo

echo -e "${BLUE}================================================================="
echo -e "🚀 DEPLOYMENT INTEGRAL TESTING - TELEGRAM TASK AGENT"
echo -e "📍 VPS: ${VPS_IP}"
echo -e "📂 Directorio: ${PROJECT_DIR}"
echo -e "=================================================================${NC}"

# Función para logging
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Verificar conexión al VPS
log "🔍 Verificando conexión al VPS..."
if ! ssh -o ConnectTimeout=10 ${VPS_USER}@${VPS_IP} "echo 'Conexión exitosa'" >/dev/null 2>&1; then
    error "No se puede conectar al VPS ${VPS_IP}. Verificar SSH."
fi

# Función para ejecutar comandos remotos
ssh_exec() {
    log "🔧 Ejecutando: $1"
    ssh ${VPS_USER}@${VPS_IP} "$1"
}

# Función para transferir archivos
scp_transfer() {
    log "📤 Transfiriendo: $1 -> $2"
    scp -r "$1" ${VPS_USER}@${VPS_IP}:"$2"
}

# PASO 1: Preparar directorio en VPS
log "📂 Preparando directorio de proyecto..."
ssh_exec "mkdir -p ${PROJECT_DIR}/{data,logs,workspace,scripts}"
ssh_exec "chmod 755 ${PROJECT_DIR}/{data,logs,workspace,scripts}"

# PASO 2: Transferir archivos del proyecto
log "📤 Transfiriendo archivos del proyecto..."
scp_transfer ".env.production" "${PROJECT_DIR}/.env"
scp_transfer "package.json" "${PROJECT_DIR}/"
scp_transfer "src/" "${PROJECT_DIR}/"
scp_transfer "Dockerfile*" "${PROJECT_DIR}/"
scp_transfer "docker-compose.yml" "${PROJECT_DIR}/"
scp_transfer "ecosystem.config.js" "${PROJECT_DIR}/"

# PASO 3: Verificar dependencias del sistema
log "🔍 Verificando dependencias del sistema en VPS..."
ssh_exec "
    echo '🐳 Verificando Docker...'
    docker --version || {
        echo 'Instalando Docker...'
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        systemctl enable docker
        systemctl start docker
    }
    
    echo '🐙 Verificando Docker Compose...'
    docker compose version || {
        echo 'Instalando Docker Compose...'
        curl -SL https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    }
    
    echo '🤖 Verificando Claude CLI...'
    claude --version || echo 'ADVERTENCIA: Claude CLI no encontrado'
    
    echo '🔐 Verificando autenticación Claude...'
    claude auth status || echo 'ADVERTENCIA: Claude CLI no autenticado'
"

# PASO 4: Construir imagen de agente
log "🏗️ Construyendo imagen de agente en VPS..."
ssh_exec "
    cd ${PROJECT_DIR}
    echo '📦 Construyendo imagen claude-agent...'
    docker build -f Dockerfile.agent -t claude-agent:latest .
    
    echo '✅ Verificando imagen construida...'
    docker images | grep claude-agent
"

# PASO 5: Instalar dependencias Node.js
log "📦 Instalando dependencias Node.js..."
ssh_exec "
    cd ${PROJECT_DIR}
    
    # Verificar Node.js
    node --version || {
        echo 'Instalando Node.js...'
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    }
    
    # Instalar dependencias
    npm install
    
    echo '✅ Dependencias instaladas'
    npm list --depth=0
"

# PASO 6: Configurar PM2 para proceso principal
log "⚙️ Configurando PM2..."
ssh_exec "
    cd ${PROJECT_DIR}
    
    # Instalar PM2 globalmente
    npm install -g pm2
    
    # Crear configuración PM2 si no existe
    if [ ! -f ecosystem.config.js ]; then
        cat > ecosystem.config.js << 'EOL'
module.exports = {
  apps: [{
    name: 'telegram-task-agent',
    script: 'src/bot.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOL
    fi
"

# PASO 7: Test de conectividad y configuración
log "🧪 Ejecutando tests de configuración..."
ssh_exec "
    cd ${PROJECT_DIR}
    
    echo '🔍 Test 1: Verificar archivo .env'
    if [ -f .env ]; then
        echo '✅ Archivo .env encontrado'
        grep -c TELEGRAM_BOT_TOKEN .env && echo '✅ Token configurado'
        grep -c DOCKER_MOCK_MODE .env && echo '✅ Modo Docker configurado'
    else
        echo '❌ Archivo .env no encontrado'
    fi
    
    echo '🔍 Test 2: Verificar permisos'
    ls -la data/ workspace/ logs/
    
    echo '🔍 Test 3: Test básico de Claude CLI'
    echo 'Hello testing' | claude --print || echo '⚠️ Claude CLI no funciona correctamente'
    
    echo '🔍 Test 4: Test de Docker'
    docker run --rm hello-world || echo '⚠️ Docker no funciona correctamente'
"

# PASO 8: Construir imagen del bot principal
log "🏗️ Construyendo imagen del bot principal..."
ssh_exec "
    cd ${PROJECT_DIR}
    docker build -t telegram-task-agent:latest .
    echo '✅ Imagen del bot construida'
"

# PASO 9: Parar servicios existentes
log "🛑 Parando servicios existentes..."
ssh_exec "
    cd ${PROJECT_DIR}
    pm2 stop telegram-task-agent || echo 'No hay proceso PM2 corriendo'
    docker compose down || echo 'No hay containers corriendo'
    docker ps -a | grep telegram && docker rm -f \$(docker ps -aq --filter name=telegram) || echo 'No hay containers de telegram'
"

# PASO 10: Iniciar servicios con Docker Compose
log "🚀 Iniciando servicios con Docker Compose..."
ssh_exec "
    cd ${PROJECT_DIR}
    
    # Iniciar con docker-compose
    docker compose up -d
    
    echo '⏳ Esperando que los servicios se inicien...'
    sleep 10
    
    echo '📊 Estado de containers:'
    docker compose ps
    
    echo '📋 Logs del bot (últimas 20 líneas):'
    docker compose logs --tail=20 telegram-bot
"

# PASO 11: Verificar deployment
log "✅ Verificando deployment..."
ssh_exec "
    cd ${PROJECT_DIR}
    
    echo '🔍 Estado de containers:'
    docker ps
    
    echo '🔍 Estado de la aplicación:'
    curl -f http://localhost:3000/health 2>/dev/null && echo '✅ Bot respondiendo' || echo '⚠️ Bot no responde en puerto 3000'
    
    echo '🔍 Logs recientes:'
    docker compose logs --tail=10 telegram-bot
    
    echo '🔍 Uso de recursos:'
    docker stats --no-stream
"

# PASO 12: Configurar auto-restart en boot
log "⚙️ Configurando auto-restart..."
ssh_exec "
    cd ${PROJECT_DIR}
    
    # Crear servicio systemd
    cat > /etc/systemd/system/telegram-task-agent.service << 'EOL'
[Unit]
Description=Telegram Task Agent
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/root/telegram-task-agent
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOL

    systemctl enable telegram-task-agent
    echo '✅ Servicio systemd configurado'
"

# PASO 13: Crear script de testing integral
log "📝 Creando script de testing integral..."
ssh_exec "
    cd ${PROJECT_DIR}
    
    cat > test-integral.sh << 'EOL'
#!/bin/bash
echo '🧪 TESTING INTEGRAL - TELEGRAM TASK AGENT'
echo '========================================'

# Test 1: Estado del bot
echo '🔍 Test 1: Estado del bot'
docker compose ps

# Test 2: Respuesta HTTP
echo '🔍 Test 2: Respuesta HTTP'
curl -s http://localhost:3000/health || echo 'No responde'

# Test 3: Logs recientes
echo '🔍 Test 3: Logs recientes (últimas 5 líneas)'
docker compose logs --tail=5 telegram-bot

# Test 4: Crear agente de test
echo '🔍 Test 4: Test de imagen de agente'
docker run --rm \\
    -v /usr/local/bin/claude:/usr/local/bin/claude:ro \\
    -v /root/.claude:/root/.claude:ro \\
    claude-agent:latest /test-agent.sh

echo '✅ Testing integral completado'
EOL

    chmod +x test-integral.sh
    echo '✅ Script de testing creado en test-integral.sh'
"

# PASO 14: Resumen final
log "🎉 DEPLOYMENT COMPLETADO"
echo -e "${GREEN}================================================================="
echo -e "✅ Sistema deployado exitosamente en VPS ${VPS_IP}"
echo -e ""
echo -e "📋 COMANDOS ÚTILES:"
echo -e "   ssh ${VPS_USER}@${VPS_IP} 'cd ${PROJECT_DIR} && docker compose logs -f'"
echo -e "   ssh ${VPS_USER}@${VPS_IP} 'cd ${PROJECT_DIR} && ./test-integral.sh'"
echo -e "   ssh ${VPS_USER}@${VPS_IP} 'cd ${PROJECT_DIR} && docker compose restart'"
echo -e ""
echo -e "🔗 ACCESO:"
echo -e "   Bot Telegram: Buscar tu bot en Telegram"
echo -e "   Logs: ssh ${VPS_USER}@${VPS_IP} 'cd ${PROJECT_DIR} && docker compose logs'"
echo -e ""
echo -e "🧪 TESTING:"
echo -e "   ssh ${VPS_USER}@${VPS_IP} 'cd ${PROJECT_DIR} && ./test-integral.sh'"
echo -e "=================================================================${NC}"

# Ejecutar test inicial
log "🧪 Ejecutando test inicial..."
ssh_exec "cd ${PROJECT_DIR} && ./test-integral.sh"

log "🚀 ¡Deployment integral completado exitosamente!"