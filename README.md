# Telegram Task Agent

Sistema de agentes atomizados que descompone proyectos complejos en tareas ejecutables por Docker containers independientes. Control total via Telegram con monitoreo en tiempo real y cálculo preciso de costos por token.

## 🎯 Features del MVP

- ✅ **Task Atomization**: IA que descompone proyectos complejos
- ✅ **Docker Isolation**: Cada tarea ejecuta en contenedor independiente  
- ✅ **Real-time Monitoring**: Updates automáticos cada 30s via Telegram
- ✅ **Cost Tracking**: Cálculo preciso de tokens y costos por tarea
- ✅ **Dependency Management**: Orden de ejecución basado en dependencias
- ✅ **Rollback System**: Revertir tareas fallidas automáticamente

## 🚀 Quick Start

### 1. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tu TELEGRAM_BOT_TOKEN
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Ejecutar en desarrollo
```bash
npm run dev
```

### 4. O ejecutar con Docker
```bash
docker-compose up --build
```

## 📱 Comandos del Bot

```
/start - Inicializar bot
/project "descripción completa del proyecto" - Atomizar proyecto
/status - Ver estado del proyecto actual
/start_execution - Iniciar ejecución de tareas atomizadas
/progress - Ver progreso detallado con todas las tareas
/pause - Pausar ejecución del proyecto
/resume - Reanudar ejecución
/stop - Detener proyecto actual y limpiar recursos
```

## 🏗️ Arquitectura LangGraph

```
Telegram Input → LangGraph Workflow → Docker Agents
       ↓              ↓                    ↓
   [Atomizer] → [Validator] → [Executor] → [Monitor]
       ↓              ↓                    ↓
   Claude API → TaskState → Docker Containers
```

### Workflow Nodes:
- **Atomizer**: Claude descompone proyecto en tareas atómicas
- **Validator**: Verifica dependencias y consistencia  
- **Executor**: Crea y ejecuta contenedores Docker
- **Monitor**: Supervisa progreso y maneja fallos
- **Finalizer**: Limpia recursos y reporta resultados

## 📁 Estructura

```
telegram-task-agent/
├── src/
│   ├── bot.js                    # Bot principal refactorizado
│   ├── workflows/
│   │   └── TaskWorkflow.js       # LangGraph workflow definition
│   ├── state/
│   │   └── TaskState.js          # State management class
│   └── agents/                   # (Futuro) Agentes especializados
├── workspace/                    # Volumen compartido con containers
├── data/                        # SQLite database
├── docker-compose.yml           # Setup completo
└── Dockerfile                  # Imagen del bot
```

## 🔄 Flujo de Ejecución

1. Usuario envía `/project "Crear API REST con autenticación"`
2. **Atomizer**: Claude descompone en tareas atómicas con dependencias
3. **Validator**: Verifica consistencia y dependencias
4. Usuario revisa tareas y ejecuta `/start_execution`
5. **Executor**: Crea contenedores Docker por tarea según dependencias
6. **Monitor**: Supervisa progreso, maneja fallos, actualiza estado
7. **Finalizer**: Limpia recursos y reporta resultados finales
8. Telegram recibe updates en tiempo real durante todo el proceso

## 🐛 Debug

```bash
# Ver logs del bot
docker-compose logs telegram-bot

# Ver contenedores activos
docker ps

# Limpiar contenedores huérfanos
docker container prune
```

## 📝 Desarrollo

Este proyecto está integrado con Linear para tracking de tareas:
- [📋 Linear Project](https://linear.app/rely-llc/project/telegram-task-agent-mvp-c086d93aa219)
- Usa format `RELY-XX: description` en commits para auto-linking
- Branches: `git checkout -b RELY-XX/task-description`

## 🚢 Deploy

Configurado para Railway/Render con deploy automático desde main branch.

---

🤖 Generated with [Claude Code](https://claude.ai/code)