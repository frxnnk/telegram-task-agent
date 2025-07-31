#!/bin/bash

echo "🐳 Construyendo imagen de agente con Claude CLI..."

# Construir imagen de agente
docker build -f Dockerfile.agent -t claude-agent:latest .

if [ $? -eq 0 ]; then
    echo "✅ Imagen claude-agent:latest construida exitosamente"
    
    # Verificar la imagen
    echo "🔍 Verificando imagen..."
    docker run --rm claude-agent:latest claude --version
    
    echo ""
    echo "📋 Para usar la imagen:"
    echo "docker run -v /root/.claude:/root/.claude:ro -v /path/to/workspace:/workspace claude-agent:latest"
else
    echo "❌ Error construyendo la imagen"
    exit 1
fi