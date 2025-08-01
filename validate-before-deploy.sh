#!/bin/bash

# =================================================================
# SCRIPT DE VALIDACIÓN PRE-DEPLOYMENT
# Verifica que todo esté listo para testing integral
# =================================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VPS_IP="5.75.171.46"
VPS_USER="root"

echo -e "${BLUE}================================================================="
echo -e "🔍 VALIDACIÓN PRE-DEPLOYMENT - TESTING INTEGRAL"
echo -e "=================================================================${NC}"

# Función para verificar
check() {
    if $1; then
        echo -e "${GREEN}✅ $2${NC}"
        return 0
    else
        echo -e "${RED}❌ $2${NC}"
        return 1
    fi
}

# Función para warning
warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

ERRORS=0

echo -e "\n${BLUE}📋 1. VERIFICANDO ARCHIVOS LOCALES${NC}"

# Verificar archivos críticos
check "[ -f .env.production ]" "Archivo .env.production existe"
[ $? -ne 0 ] && ((ERRORS++))

check "[ -f Dockerfile.agent ]" "Dockerfile.agent existe"
[ $? -ne 0 ] && ((ERRORS++))

check "[ -f docker-compose.yml ]" "docker-compose.yml existe"
[ $? -ne 0 ] && ((ERRORS++))

check "[ -f deploy-integral-testing.sh ]" "Script de deployment existe"
[ $? -ne 0 ] && ((ERRORS++))

check "[ -x deploy-integral-testing.sh ]" "Script de deployment es ejecutable"
[ $? -ne 0 ] && ((ERRORS++))

check "[ -f TESTING-INTEGRAL.md ]" "Documentación de testing existe"
[ $? -ne 0 ] && ((ERRORS++))

# Verificar estructura de código
check "[ -d src ]" "Directorio src/ existe"
[ $? -ne 0 ] && ((ERRORS++))

check "[ -f src/bot.js ]" "Bot principal existe"
[ $? -ne 0 ] && ((ERRORS++))

check "[ -f src/orchestration/DockerOrchestrator.js ]" "DockerOrchestrator existe"
[ $? -ne 0 ] && ((ERRORS++))

# Verificar configuración .env.production
echo -e "\n${BLUE}📋 2. VERIFICANDO CONFIGURACIÓN .env.production${NC}"

if [ -f .env.production ]; then
    check "grep -q 'DOCKER_MOCK_MODE=false' .env.production" "Modo Docker real configurado"
    [ $? -ne 0 ] && ((ERRORS++))
    
    check "grep -q 'TELEGRAM_BOT_TOKEN=' .env.production" "Token de Telegram configurado"
    [ $? -ne 0 ] && ((ERRORS++))
    
    check "grep -q 'LINEAR_API_KEY=' .env.production" "API key de Linear configurado"
    [ $? -ne 0 ] && ((ERRORS++))
    
    check "grep -q 'GITHUB_TOKEN=' .env.production" "Token de GitHub configurado"
    [ $? -ne 0 ] && ((ERRORS++))
else
    echo -e "${RED}❌ Archivo .env.production no encontrado${NC}"
    ((ERRORS++))
fi

echo -e "\n${BLUE}📋 3. VERIFICANDO CONECTIVIDAD AL VPS${NC}"

# Test de conexión SSH
if check "ssh -o ConnectTimeout=10 ${VPS_USER}@${VPS_IP} 'echo test' >/dev/null 2>&1" "Conexión SSH al VPS"; then
    
    # Verificar Docker en VPS
    check "ssh ${VPS_USER}@${VPS_IP} 'docker --version >/dev/null 2>&1'" "Docker instalado en VPS"
    [ $? -ne 0 ] && ((ERRORS++))
    
    # Verificar Claude CLI en VPS
    if check "ssh ${VPS_USER}@${VPS_IP} 'claude --version >/dev/null 2>&1'" "Claude CLI instalado en VPS"; then
        check "ssh ${VPS_USER}@${VPS_IP} 'claude auth status >/dev/null 2>&1'" "Claude CLI autenticado en VPS"
        [ $? -ne 0 ] && warn "Claude CLI no autenticado - esto puede causar problemas"
    else
        ((ERRORS++))
        warn "Claude CLI no encontrado en VPS"
    fi
    
    # Verificar Node.js en VPS
    check "ssh ${VPS_USER}@${VPS_IP} 'node --version >/dev/null 2>&1'" "Node.js instalado en VPS"
    [ $? -ne 0 ] && ((ERRORS++))
    
    # Verificar espacio en disco
    DISK_USAGE=$(ssh ${VPS_USER}@${VPS_IP} "df / | awk 'NR==2 {print \$5}' | sed 's/%//'")
    if [ "$DISK_USAGE" -lt 80 ]; then
        echo -e "${GREEN}✅ Espacio en disco OK (${DISK_USAGE}% usado)${NC}"
    else
        echo -e "${YELLOW}⚠️  Poco espacio en disco (${DISK_USAGE}% usado)${NC}"
        warn "Considerar limpiar espacio antes del deployment"
    fi
    
else
    ((ERRORS++))
    echo -e "${RED}❌ No se puede conectar al VPS${NC}"
    echo -e "${YELLOW}   Verificar: ssh ${VPS_USER}@${VPS_IP}${NC}"
fi

echo -e "\n${BLUE}📋 4. VERIFICANDO DEPENDENCIAS LOCALES${NC}"

# Verificar herramientas locales necesarias
check "command -v ssh >/dev/null" "SSH disponible localmente"
[ $? -ne 0 ] && ((ERRORS++))

check "command -v scp >/dev/null" "SCP disponible localmente"
[ $? -ne 0 ] && ((ERRORS++))

check "command -v curl >/dev/null" "cURL disponible localmente"
[ $? -ne 0 ] && ((ERRORS++))

echo -e "\n${BLUE}📋 5. VERIFICANDO CONFIGURACIÓN DEL CÓDIGO${NC}"

# Verificar que DockerOrchestrator tenga los métodos necesarios
if [ -f src/orchestration/DockerOrchestrator.js ]; then
    check "grep -q 'executeAgentTask' src/orchestration/DockerOrchestrator.js" "Método executeAgentTask implementado"
    [ $? -ne 0 ] && ((ERRORS++))
    
    check "grep -q 'createSharedAgentContainer' src/orchestration/DockerOrchestrator.js" "Método createSharedAgentContainer implementado"
    [ $? -ne 0 ] && ((ERRORS++))
    
    check "grep -q 'mockMode' src/orchestration/DockerOrchestrator.js" "Soporte para mockMode implementado"
    [ $? -ne 0 ] && ((ERRORS++))
fi

# Verificar package.json
if [ -f package.json ]; then
    check "grep -q 'telegraf' package.json" "Dependencia Telegraf incluida"
    [ $? -ne 0 ] && ((ERRORS++))
    
    check "grep -q 'sqlite3' package.json" "Dependencia SQLite incluida"
    [ $? -ne 0 ] && ((ERRORS++))
fi

echo -e "\n${BLUE}📋 6. RESUMEN DE VALIDACIÓN${NC}"
echo "=============================================="

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 VALIDACIÓN EXITOSA - LISTO PARA DEPLOYMENT${NC}"
    echo -e ""
    echo -e "${GREEN}📋 TODO VERIFICADO:${NC}"
    echo -e "   ✅ Archivos de configuración"
    echo -e "   ✅ Conectividad al VPS"
    echo -e "   ✅ Dependencias del sistema"
    echo -e "   ✅ Código y configuración"
    echo -e ""
    echo -e "${BLUE}🚀 PRÓXIMO PASO:${NC}"
    echo -e "   ./deploy-integral-testing.sh"
    echo -e ""
    exit 0
else
    echo -e "${RED}❌ VALIDACIÓN FALLIDA - ${ERRORS} ERRORES ENCONTRADOS${NC}"
    echo -e ""
    echo -e "${RED}🔧 CORREGIR ANTES DE CONTINUAR:${NC}"
    echo -e "   1. Revisar los errores marcados arriba"
    echo -e "   2. Corregir los problemas encontrados"
    echo -e "   3. Ejecutar este script nuevamente"
    echo -e ""
    echo -e "${YELLOW}💡 AYUDA:${NC}"
    echo -e "   - Para SSH: ssh-keygen y ssh-copy-id"
    echo -e "   - Para Claude CLI: Verificar autenticación en VPS"
    echo -e "   - Para archivos: Verificar que existan y tengan contenido"
    echo -e ""
    exit 1
fi