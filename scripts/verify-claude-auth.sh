#!/bin/bash

echo "🔍 Verificando autenticación de Claude CLI en VPS..."
echo ""

# Verificar estado
STATUS=$(ssh root@5.75.171.46 "claude auth status 2>&1")

if [[ $STATUS == *"Authenticated"* ]]; then
    echo "✅ Claude CLI está autenticado correctamente!"
    echo ""
    echo "Probando Claude CLI con un comando simple..."
    ssh root@5.75.171.46 "echo 'Hola, ¿cómo estás?' | claude --print"
else
    echo "❌ Claude CLI NO está autenticado"
    echo "Estado actual: $STATUS"
    echo ""
    echo "Por favor, ejecuta manualmente:"
    echo "1. ssh root@5.75.171.46"
    echo "2. claude auth login"
fi