# 🧪 Testing Integral - Background Agents System

## 🎯 Objetivo

Testeo completo y real del sistema de Background Agents en VPS Hetzner con Docker y Claude CLI funcionando en modo producción.

## 📋 Requisitos Previos

### VPS Configurado
- **IP**: 5.75.171.46
- **OS**: Ubuntu 24.04.2 LTS  
- **Acceso**: SSH como root
- **Claude CLI**: Instalado y autenticado
- **Docker**: Instalado y funcionando

### Verificación Previa
```bash
# Verificar conexión SSH
ssh root@5.75.171.46 "echo 'Conexión OK'"

# Verificar Claude CLI
ssh root@5.75.171.46 "claude --version && claude auth status"

# Verificar Docker
ssh root@5.75.171.46 "docker --version && docker ps"
```

## 🚀 Deployment Automatizado

### Opción 1: Script Completo (Recomendado)
```bash
# Ejecutar deployment completo
./deploy-integral-testing.sh
```

### Opción 2: Manual Step-by-Step

#### 1. Transferir Archivos
```bash
# Crear directorio en VPS
ssh root@5.75.171.46 "mkdir -p /root/telegram-task-agent/{data,logs,workspace}"

# Transferir archivos de configuración
scp .env.production root@5.75.171.46:/root/telegram-task-agent/.env
scp package.json root@5.75.171.46:/root/telegram-task-agent/
scp -r src/ root@5.75.171.46:/root/telegram-task-agent/
scp Dockerfile* root@5.75.171.46:/root/telegram-task-agent/
scp docker-compose.yml root@5.75.171.46:/root/telegram-task-agent/
```

#### 2. Construir Imágenes
```bash
ssh root@5.75.171.46 "
  cd /root/telegram-task-agent
  docker build -f Dockerfile.agent -t claude-agent:latest .
  docker build -t telegram-task-agent:latest .
"
```

#### 3. Instalar Dependencias
```bash
ssh root@5.75.171.46 "
  cd /root/telegram-task-agent
  npm install
"
```

#### 4. Iniciar Servicios
```bash
ssh root@5.75.171.46 "
  cd /root/telegram-task-agent
  docker compose up -d
"
```

## 🧪 Plan de Testing Integral

### Fase 1: Verificación de Infraestructura
```bash
# Conectar al VPS
ssh root@5.75.171.46

# Verificar servicios básicos
cd /root/telegram-task-agent
docker compose ps
docker compose logs --tail=20 telegram-bot
```

### Fase 2: Testing del Bot de Telegram

#### Test 2.1: Conexión Básica
1. Abrir Telegram
2. Buscar tu bot por username
3. Enviar `/start`
4. Verificar respuesta del bot

#### Test 2.2: Crear Agente
1. Usar comando para crear agente
2. Seleccionar proyecto Linear
3. Seleccionar repositorios GitHub
4. Verificar creación exitosa

#### Test 2.3: Ver Agentes
1. Listar agentes creados
2. Verificar estados y información
3. Acceder a detalles de agente

### Fase 3: Testing de Ejecución Background

#### Test 3.1: Ejecución Background Simple
```bash
# En Telegram:
# 1. Seleccionar agente creado
# 2. Elegir tarea Linear
# 3. Ejecutar en modo "Background"
# 4. Monitorear progreso

# En VPS (paralelo):
ssh root@5.75.171.46 "
  cd /root/telegram-task-agent
  docker ps  # Ver containers de agentes
  docker logs <container-name>  # Ver logs de ejecución
"
```

#### Test 3.2: Monitoreo en Tiempo Real
1. **Telegram**: Ver updates automáticos cada 30s
2. **VPS Logs**: `docker compose logs -f telegram-bot`
3. **Container Logs**: `docker logs -f <agent-container>`

### Fase 4: Testing de Ejecución Interactive

#### Test 4.1: Ejecución Interactive con Prompt
1. Seleccionar agente
2. Elegir tarea Linear  
3. Ejecutar en modo "Interactive"
4. Proporcionar prompt específico
5. Verificar ejecución personalizada

#### Test 4.2: Container Compartido  
```bash
# Verificar que se crea container compartido
docker ps | grep "shared-agent"

# Verificar reutilización para múltiples tareas
# Ejecutar 2-3 tareas interactive del mismo agente
# Confirmar que usan el mismo container compartido
```

### Fase 5: Testing de Claude CLI Integration

#### Test 5.1: Verificación de Montaje
```bash
# Verificar que Claude CLI está montado correctamente
docker exec <agent-container> "which claude"
docker exec <agent-container> "claude --version"
docker exec <agent-container> "claude auth status"
```

#### Test 5.2: Funcionalidad Real de Claude
```bash
# Test directo de Claude en container
docker exec <agent-container> "echo 'Analyze this test' | claude --print"

# Verificar que la respuesta es real (no mock)
```

### Fase 6: Testing de Casos Complejos

#### Test 6.1: Múltiples Agentes Simultáneos
1. Crear 3 agentes diferentes
2. Ejecutar tareas en paralelo
3. Verificar aislamiento de containers
4. Confirmar límites de recursos

#### Test 6.2: Clonación de Repositorios
1. Crear agente con repositorios GitHub
2. Ejecutar tarea background
3. Verificar que repos se clonan correctamente
4. Confirmar contexto disponible para Claude

#### Test 6.3: Manejo de Errores
1. Ejecutar tarea que falle intencionalmente
2. Verificar rollback automático
3. Confirmar logs de error
4. Testear recuperación del sistema

## 📊 Criterios de Éxito

### ✅ Testing Básico
- [ ] Bot responde en Telegram
- [ ] Puede crear agentes
- [ ] Puede listar agentes creados
- [ ] Interfaz funciona correctamente

### ✅ Testing Background
- [ ] Crea containers aislados por tarea
- [ ] Claude CLI funciona dentro del container
- [ ] Logs se capturan correctamente
- [ ] Updates en tiempo real en Telegram
- [ ] Container se limpia al finalizar

### ✅ Testing Interactive  
- [ ] Crea container compartido por agente
- [ ] Reutiliza container para múltiples tareas
- [ ] Procesa prompts de usuario correctamente
- [ ] Mantiene contexto entre ejecuciones

### ✅ Testing Avanzado
- [ ] Múltiples agentes simultáneos
- [ ] Clonación de repositorios real
- [ ] Límites de recursos respetados
- [ ] Manejo de errores robusto
- [ ] Monitoreo y logs completos

## 🐛 Troubleshooting

### Problema: Bot no responde
```bash
# Verificar logs
docker compose logs telegram-bot

# Verificar conectividad
curl http://localhost:3000/health

# Reiniciar si es necesario
docker compose restart telegram-bot
```

### Problema: Claude CLI no funciona
```bash
# Verificar montaje
docker exec <container> ls -la /usr/local/bin/claude
docker exec <container> ls -la /root/.claude/

# Verificar autenticación en host
claude auth status

# Re-montar si es necesario
docker compose down && docker compose up -d
```

### Problema: Containers no se crean
```bash
# Verificar imagen de agente
docker images | grep claude-agent

# Reconstruir imagen
docker build -f Dockerfile.agent -t claude-agent:latest .

# Verificar Docker socket
ls -la /var/run/docker.sock
```

### Problema: Out of Memory
```bash
# Verificar uso de recursos
docker stats

# Verificar límites configurados
docker inspect <container> | grep -i memory

# Ajustar límites en DockerOrchestrator.js si es necesario
```

## 📈 Monitoreo Continuo

### Comandos de Monitoreo
```bash
# Estado general
cd /root/telegram-task-agent && ./test-integral.sh

# Logs en tiempo real
docker compose logs -f

# Estadísticas de containers
docker stats

# Uso de disco
df -h && du -sh workspace/*
```

### Alertas Automáticas
- **Memoria > 80%**: Revisar containers activos
- **Disk > 90%**: Limpiar workspace antiguo  
- **Bot down**: Reiniciar automáticamente con systemd
- **Claude auth fail**: Re-autenticar y reiniciar

## 🔄 Mantenimiento

### Limpieza Periódica
```bash
# Limpiar workspace viejo (>7 días)
find /root/telegram-task-agent/workspace -type d -mtime +7 -exec rm -rf {} +

# Limpiar containers parados
docker container prune -f

# Limpiar imágenes no usadas
docker image prune -f
```

### Backup de Datos
```bash
# Backup de base de datos
cp /root/telegram-task-agent/data/*.db /backup/

# Backup de logs importantes
tar -czf /backup/logs-$(date +%Y%m%d).tar.gz /root/telegram-task-agent/logs/
```

## 🎯 Resultado Esperado

Al completar este testing integral, deberías tener:

1. **✅ Sistema Completamente Funcional**: Background agents ejecutándose realmente con Claude CLI
2. **✅ Integración Real**: Linear + GitHub + Claude + Docker funcionando juntos
3. **✅ Monitoreo**: Logs y métricas en tiempo real
4. **✅ Escalabilidad**: Múltiples agentes simultáneos
5. **✅ Robustez**: Manejo de errores y recuperación automática

Este sistema representa la implementación completa del concepto de Background Agents con IA real, no simulada.