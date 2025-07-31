#!/bin/bash

echo "🔧 Configuración de Claude CLI en VPS"
echo "===================================="
echo ""
echo "Este script configurará la autenticación de Claude CLI en tu VPS."
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}PASO 1: Abrir túnel SSH${NC}"
echo "Abre una NUEVA terminal y ejecuta exactamente este comando:"
echo ""
echo -e "${GREEN}ssh -L 9222:localhost:9222 root@5.75.171.46${NC}"
echo ""
echo "Deja esa terminal abierta durante todo el proceso."
echo ""
read -p "Presiona ENTER cuando hayas ejecutado el comando en la otra terminal..."

echo ""
echo -e "${YELLOW}PASO 2: Iniciando autenticación en VPS${NC}"
echo "Conectando al VPS para iniciar el proceso de login..."
echo ""

# Ejecutar login en el VPS
ssh -t root@5.75.171.46 << 'ENDSSH'
echo "Iniciando Claude CLI login..."
echo ""
echo "IMPORTANTE: El navegador se abrirá en tu máquina LOCAL (no en el VPS)"
echo "Esto es normal y esperado debido al túnel SSH."
echo ""
claude auth login
ENDSSH

echo ""
echo -e "${YELLOW}PASO 3: Verificación${NC}"
echo "Verificando el estado de autenticación..."
echo ""

ssh root@5.75.171.46 "claude auth status"

echo ""
echo -e "${GREEN}✅ Proceso completado${NC}"
echo ""
echo "Si ves 'Authenticated' arriba, la configuración fue exitosa."
echo "Puedes cerrar la terminal con el túnel SSH."