# Sistema de Agentes Atomizados - Telegram Task Manager

## Descripción del Proyecto
Sistema avanzado que atomiza proyectos complejos en tareas ejecutables por agentes Docker independientes. Control total via Telegram con integración Linear + GitHub y monitoreo en tiempo real.

## Stack de Producción Actual
- **Orchestrator**: Node.js + Telegraf.js + LangGraph workflows
- **Task Atomizer**: Claude 3.5 Sonnet via API 
- **Linear Integration**: GraphQL API para tableros y tareas
- **GitHub Integration**: REST API + Octokit.js (próximo)
- **Agent Runtime**: Docker containers por tarea
- **Database**: SQLite (tasks) + Redis (real-time state)
- **Monitoring**: WebSocket + Telegram live updates
- **Cost Tracking**: Token usage metrics en tiempo real

## Quick Start
```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus tokens

# 3. Ejecutar bot
npm run dev
# o
node src/bot.js

# 4. Deploy con Docker
docker-compose up --build
```

## Variables de Entorno Requeridas (.env)
```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# Claude API  
CLAUDE_API_KEY=your_claude_api_key

# Linear Integration
LINEAR_API_KEY=your_linear_api_key

# GitHub (próximo)
GITHUB_TOKEN=your_github_token

# Configuración
NODE_ENV=development
PORT=3000
DATABASE_PATH=./data/tasks.db
DOCKER_WORKSPACE_PATH=./workspace
```

## Comandos del Sistema Implementados

### Linear Integration (✅ COMPLETADO - RELY-50)
```
/linear - Ver equipos y proyectos Linear disponibles
/tasks [team_key] - Ver tareas de un equipo específico
/project_tasks [project_name] - Ver tareas de un proyecto
/atomize [issue_id] - Seleccionar tarea Linear para atomización
```

### Core System (✅ IMPLEMENTADO)
```
/start - Inicializar bot y ver comandos disponibles
/project "descripción" - Atomizar proyecto libre en tareas
/list - Ver proyectos y tareas activas
/status - Estado del sistema y estadísticas
/help - Ayuda detallada de todos los comandos
```

### Próximos Comandos (Roadmap)
```
/repos - Listar repositorios GitHub accesibles
/select_repo [repo_name] - Seleccionar repo para proyecto
/play [atomic_task_id] - ▶️ Ejecutar tarea en Docker VPS
/instances - Dashboard de contenedores activos
/logs [instance_id] - Logs en tiempo real
/kill [instance_id] - Terminar instancia
/cost - Dashboard de costos detallado
```

## Arquitectura de Agentes Atomizados

### Flujo Principal Actual:
```
Linear Tasks → Task Atomizer → Enhanced Context → Docker Agents → VPS Execution
     ↓              ↓                ↓                ↓              ↓
  GitHub API → Claude Analysis → Cost Calculation → Auto-Testing → Auto-Push
```

### Componentes Implementados:
1. **✅ LinearManager**: Integración completa con Linear API
2. **✅ TaskAtomizer**: Claude API con contexto Linear
3. **✅ LangGraph Workflows**: Flujos complejos de agentes
4. **✅ TelegramBot**: Interface completa con comandos
5. **✅ DatabaseManager**: Persistencia SQLite
6. **✅ TaskState**: Manejo de estado avanzado

### Componentes en Desarrollo:
1. **🔄 GitHubManager**: Integración repos y permisos
2. **🔄 VPS Orchestrator**: Deploy real en VPS
3. **🔄 Auto-Testing**: Testing automático completo
4. **🔄 Multi-Instance Dashboard**: Monitoreo paralelo

## Roadmap de Desarrollo (10 Tareas Atomizadas)

### ✅ COMPLETADAS Y VALIDADAS:
1. **RELY-50: Linear Integration** (2,500 tokens)
   - ✅ Mostrar tableros y tareas Linear
   - ✅ Selección de tareas para atomización
   - ✅ Testing end-to-end completo
   - ✅ Todos los criterios de aceptación cumplidos

### 🔄 EN PROGRESO:
2. **RELY-51: GitHub Repository Selection** (3,000 tokens)
   - Listado de repositorios accesibles
   - Selección múltiple de repos
   - Validación de permisos de escritura
   - Cache de estructura de repos

### 📅 ROADMAP PLANIFICADO:
3. **RELY-52: Enhanced Task Atomizer** (4,000 tokens)
4. **RELY-53: VPS Docker Orchestration** (5,000 tokens)
5. **RELY-54: Auto-Testing & QA** (3,500 tokens)
6. **RELY-55: Smart Branch Management** (2,800 tokens)
7. **RELY-56: Multi-Instance Dashboard** (4,500 tokens)
8. **RELY-57: Cost Tracking** (3,000 tokens)
9. **RELY-58: Advanced LangGraph** (6,000 tokens)
10. **RELY-59: Production Deployment** (4,000 tokens)

**📊 Total estimado: 38,300 tokens (~$115 USD)**

## Estructura del Proyecto
```
telegram-task-agent/
├── src/
│   ├── bot.js                     # Bot principal con Linear integration
│   ├── integrations/
│   │   ├── LinearManager.js       # ✅ Linear API completa
│   │   └── GitHubManager.js       # 🔄 Próximo
│   ├── workflows/
│   │   └── TaskWorkflow.js        # LangGraph workflows
│   ├── state/
│   │   └── TaskState.js           # State management
│   ├── atomizer/
│   │   ├── TaskAtomizer.js        # Claude integration
│   │   └── TaskAtomizerCLI.js     # CLI interface
│   └── database/
│       └── DatabaseManager.js     # SQLite management
├── workspace/                     # Docker volumes
├── data/                         # Database files
├── test-linear-integration.js    # ✅ Testing E2E
├── test-linear-mock.js          # ✅ Testing funcionalidad
├── create-linear-roadmap.js     # ✅ Roadmap automation
├── docker-compose.yml           # Container orchestration
└── Dockerfile                   # Bot containerization
```

## Testing y Calidad

### ✅ RELY-50 Testing Completado:
- **100% tests pasados** (8/8 funcionalidades)
- **Validación end-to-end** con datos mock
- **Criterios de aceptación** verificados
- **Sintaxis validada** sin errores
- **Integración bot** confirmada

### 📋 Proceso de Testing Obligatorio:
**Para dar una tarea por terminada:**
1. **Testing funcional** con datos mock
2. **Testing end-to-end** con APIs reales
3. **Validación de criterios de aceptación**
4. **Testing de integración** con bot
5. **Validación de sintaxis** sin errores
6. **Documentación** actualizada

### 🧪 Comandos de Testing:
```bash
# Testing funcionalidad con mock data
node test-linear-mock.js

# Testing E2E (requiere API keys)
node test-linear-integration.js

# Validación de sintaxis
node -c src/bot.js
node -c src/integrations/LinearManager.js
```

## Features del Sistema

### ✅ IMPLEMENTADAS Y VALIDADAS:
- **Linear Integration**: Tableros, equipos, proyectos y tareas
- **Task Atomization**: IA que descompone proyectos complejos
- **LangGraph Workflows**: Flujos de agentes avanzados
- **Telegram Interface**: Comandos completos y formateo
- **Error Handling**: Manejo robusto de errores
- **Cache System**: Performance optimizada
- **Testing Framework**: Validación end-to-end

### 🔄 EN DESARROLLO:
- **GitHub Integration**: Repos, permisos y estructura
- **VPS Docker Orchestration**: Contenedores en producción
- **Auto-Testing**: Testing automático completo
- **Real-time Monitoring**: Updates en vivo
- **Cost Tracking**: Métricas precisas de costos

### 📅 PLANIFICADAS:
- **Smart Branch Management**: Auto-push con testing
- **Multi-Instance Dashboard**: Monitoreo paralelo
- **Advanced Cost Analytics**: ROI y optimización
- **Production Deployment**: Escalabilidad automática

## Ventajas Clave del Sistema
- **Integration First**: Linear + GitHub nativo
- **AI-Powered**: Atomización inteligente con contexto
- **Quality Assured**: Testing obligatorio E2E
- **Production Ready**: Docker + VPS deployment
- **Cost Transparent**: Tracking preciso de tokens
- **Fault Tolerant**: Manejo robusto de errores
- **Scalable**: Arquitectura para múltiples usuarios

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

**TESTING OBLIGATORIO**: Para dar cualquier tarea por terminada, debe pasar testing end-to-end completo con validación de todos los criterios de aceptación. No hay excepciones.