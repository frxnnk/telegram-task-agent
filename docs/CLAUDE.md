# Background Agents Manager - Telegram Task System

## Descripción del Proyecto
Sistema de agentes background inteligentes que ejecutan tareas Linear en repositorios GitHub automáticamente. Inspirado en los background agents de Cursor, cada agente mantiene contexto específico y puede trabajar de forma autónoma.

## Concepto Core: Background Agents

### 🤖 **¿Qué es un Agente Background?**
- **Agente** = Linear Project + GitHub Repositories + Contexto específico
- **Background** = Ejecuta tareas automáticamente en VPS sin supervisión constante
- **Inteligente** = Claude analiza el código y genera tareas precisas para TU arquitectura

### 🎯 **Flujo de Trabajo:**
```
1. 🆕 Crear Agente
   ├── 📛 Nombre: "TEL Deploy Agent"
   ├── 🔗 Linear Project: TEL  
   └── 📂 GitHub Repos: telegram-task-agent

2. 📋 Mis Agentes
   └── 🤖 TEL Deploy Agent
       ├── 📋 Ver Tareas Linear (TEL-11, TEL-12...)
       │   ├── ▶️ Ejecutar Automático (background)
       │   └── 💬 Ejecutar con Prompt
       └── 📊 Estado: [Idle/Working/Completed]

3. 🔄 Ejecución Background
   ├── Agente analiza tarea Linear + código GitHub
   ├── Genera plan de ejecución específico
   ├── Ejecuta en Docker en VPS
   └── Reporta progreso en tiempo real
```

## Stack Tecnológico Actual

### **Backend Core:**
- **Orchestrator**: Node.js + Telegraf.js
- **Task Atomizer**: Claude CLI (ZERO costos API - usa plan Pro)
- **Agent Manager**: SQLite con gestión de estados
- **Docker Runtime**: Containers aislados por tarea en VPS

### **Integraciones:**
- **Linear API**: GraphQL completa para proyectos y tareas ✅
- **GitHub API**: REST + Octokit.js para repos y código ✅  
- **Claude Integration**: CLI con contexto completo del proyecto ✅
- **VPS Deployment**: Hetzner con Docker orchestration ✅

### **Base de Datos:**
```sql
-- Agentes background
CREATE TABLE agents (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  linear_project_id TEXT NOT NULL,
  github_repos TEXT NOT NULL, -- JSON array
  status TEXT DEFAULT 'idle', -- idle, working, completed, error
  current_task_id TEXT NULL,
  progress INTEGER DEFAULT 0
);

-- Ejecuciones de tareas
CREATE TABLE task_executions (
  id INTEGER PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  linear_task_id TEXT NOT NULL,
  execution_mode TEXT NOT NULL, -- 'background' or 'interactive'
  user_prompt TEXT NULL, -- Para modo interactive
  status TEXT DEFAULT 'pending',
  docker_instance_id TEXT NULL,
  progress INTEGER DEFAULT 0,
  logs TEXT NULL -- JSON array de logs
);
```

## Comandos del Sistema

### **Interfaz Principal:**
```
🤖 Background Agents Manager

📊 Tu Dashboard:
• Agentes creados: 3
• Agentes activos: 1  
• VPS: Conectado ✅

┌─────────────────────────┐
│ 🆕 Crear Agente         │
│ 📋 Mis Agentes          │
│ 📊 Dashboard           │
│ ⚙️ Configuración       │
│ ❓ ¿Cómo funciona?      │
└─────────────────────────┘
```

### **Flujo Crear Agente:**
```
1. 🆕 Crear Agente
   ├── 📛 Nombre del agente
   ├── 🔗 Seleccionar Linear Project
   ├── 📂 Seleccionar GitHub Repos
   └── ✅ Crear Agente

2. Resultado:
   🤖 "TEL Deploy Agent" creado
   📋 Linear: TEL (15 tareas disponibles)
   📂 Repos: telegram-task-agent (main)
   📊 Estado: Idle - Listo para trabajar
```

### **Dashboard Mis Agentes:**
```
📋 MIS AGENTES (3):

🤖 TEL Deploy Agent
├── 📊 Estado: 🟢 Ejecutando TEL-11 (45% completado)
├── 🔗 Linear: TEL (15 tareas)
├── 📂 Repos: telegram-task-agent
└── [⏸️ Pausar] [📋 Ver Tareas] [⚙️ Config]

🤖 Frontend Agent DEV  
├── 📊 Estado: 🔵 Idle
├── 🔗 Linear: DEV (8 tareas)
├── 📂 Repos: frontend-app, ui-components
└── [▶️ Ejecutar] [📋 Ver Tareas] [🗑️ Eliminar]

🤖 API Agent PROD
├── 📊 Estado: 🟠 Esperando input usuario
├── 🔗 Linear: PROD (3 tareas)
├── 📂 Repos: api-backend
└── [💬 Responder] [📋 Ver Tareas] [⚙️ Config]
```

## Modos de Ejecución

### **1. 🔄 Modo Background (Automático):**
```
Usuario: Click "▶️ Ejecutar Automático"
Sistema: 
├── Analiza tarea TEL-11: "Deploy en Hetzner VPS"
├── Lee código de telegram-task-agent  
├── Detecta: Node.js + Telegraf + Docker + Hetzner
├── Genera plan específico para TU stack
├── Ejecuta en Docker container en VPS
├── Reporta progreso cada 30s
└── Notifica cuando completa

Ventajas:
✅ Completamente autónomo
✅ Optimizado para tu código específico  
✅ Ejecuta mientras duermes
✅ Múltiples agentes en paralelo
```

### **2. 💬 Modo Interactive (Con Prompt):**
```
Usuario: Click "💬 Ejecutar con Prompt"
Sistema: "¿Cómo quieres que ejecute TEL-11?"
Usuario: "Deploy solo el backend, sin frontend. Usa staging database"
Sistema:
├── Ajusta plan según tu prompt
├── Ejecuta con modificaciones específicas
├── Te consulta si encuentra ambigüedades  
└── Reporta progreso personalizado

Ventajas:
✅ Control granular
✅ Personalización específica
✅ Iteración colaborativa
✅ Aprendizaje del contexto
```

## Arquitectura del Sistema

### **Componentes Principales:**
```
Telegram Bot (UI)
├── AgentManager (SQLite)
├── LinearManager (GraphQL API)  
├── GitHubManager (REST API)
└── DockerOrchestrator (VPS)
    ├── TaskAtomizerCLI (Claude)
    ├── Workspace Cloning (Git)
    └── Container Execution (Docker)
```

### **Flujo de Datos:**
```
1. User crea agente → AgentManager.createAgent()
2. User selecciona tarea → LinearManager.getTask()  
3. Sistema clona repos → GitHubManager.cloneRepo()
4. Claude analiza contexto → TaskAtomizerCLI.atomize()
5. Docker ejecuta plan → DockerOrchestrator.execute()
6. Reporta progreso → Telegram notifications
```

### **Persistencia:**
```
./data/
├── agents.db           # Agentes y ejecuciones
├── project_mappings.db # Legacy mappings  
└── tasks.db           # Task history

./workspace/
├── agent_1_execution_1/  # Isolated workspace
│   ├── telegram-task-agent/  # Cloned repo
│   └── execution_logs.json
└── agent_2_execution_2/
    ├── frontend-app/
    └── execution_logs.json
```

## Roadmap de Desarrollo

### **✅ COMPLETADO (Phase 1):**
1. **Agent Manager Database** - SQLite con esquemas completos ✅
2. **Background Agents UI** - Interfaz estilo Cursor ✅
3. **Linear Integration** - GraphQL API completa ✅
4. **GitHub Integration** - REST API + repo cloning ✅
5. **VPS Deployment** - Docker orchestration funcional ✅
6. **Claude CLI Integration** - ZERO costos API ✅

### **🔄 EN DESARROLLO (Phase 2):**
7. **Create Agent Flow** - Flujo completo de creación 🔄
8. **My Agents Dashboard** - Gestión de agentes existentes 📅
9. **Task Execution Engine** - Background vs Interactive modes 📅
10. **Real-time Progress** - WebSocket + Telegram notifications 📅
11. **Multi-Agent Orchestration** - Ejecución paralela 📅

### **📅 PLANIFICADO (Phase 3):**
12. **Advanced Monitoring** - Prometheus + Grafana
13. **Agent Learning** - IA que aprende de ejecuciones previas
14. **Team Collaboration** - Múltiples usuarios compartiendo agentes
15. **Advanced Workflows** - Dependencies entre agentes
16. **Performance Analytics** - Métricas de eficiencia y ROI

## Ventajas Clave del Sistema

### **🎯 Específico para tu Código:**
- Claude analiza TU arquitectura específica
- Genera tareas para TU stack tecnológico  
- Considera TUS patrones y convenciones
- Optimiza para TUS requisitos de deployment

### **🔄 Verdaderamente Background:**
- Agentes trabajan mientras duermes
- Múltiples agentes en paralelo
- Ejecución aislada por container
- Rollback automático en fallos

### **💰 Costo Optimizado:**
- Claude CLI = $0 USD (usa tu plan Pro)
- VPS Hetzner = €8.90/mes  
- GitHub API = Gratis
- Linear API = Gratis
- **Total**: <€10/mes para sistema completo

### **🚀 Escalable y Robusto:**
- Docker isolation por tarea
- SQLite para persistencia local
- Systemd para auto-restart
- Error handling completo
- Logs centralizados

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

**CONCEPTO CORE**: Background Agents = Linear Project + GitHub Repos + Claude Intelligence + True Autonomous Execution

**TESTING OBLIGATORIO**: Para dar cualquier feature por terminada, debe pasar testing end-to-end completo con validación de todos los criterios de aceptación. No hay excepciones.

**CONFIDENCE LEVEL**: 85% - Sistema funcional con agentes background implementados, listo para testing final y deployment.