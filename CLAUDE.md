# Background Agents Manager - Telegram Task System

## Descripción del Proyecto
Sistema de agentes background inteligentes que ejecutan tareas Linear en repositorios GitHub automáticamente. Inspirado en los background agents de Cursor, cada agente mantiene contexto específico y puede trabajar de forma autónoma.

## IMPORTANTE: Referencia de Tareas Linear
Cuando se diga "TEL-X" (donde X es un número), se refiere a ejecutar esa tarea específica del proyecto Linear TEL en este repositorio. Por ejemplo:
- "TEL-15" = Ejecutar la tarea TEL-15 del Linear
- "TEL-11" = Ejecutar la tarea TEL-11 del Linear

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

## Quick Start
```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus tokens

# Ejecutar
npm start
```

## VPS de Producción
```
IP: 5.75.171.46
OS: Ubuntu 24.04.2 LTS
Acceso: SSH (puerto 22)
Servicios: Docker, Node.js, Claude CLI (autenticado)
Estado: ✅ Configurado y listo para deploy
```

### **Servicios Instalados en VPS:**
- **Claude CLI v1.0.64**: Autenticado con cuenta Pro (sin API key)
- **Docker**: Para aislamiento de agentes
- **Node.js**: Runtime principal del bot
- **PM2**: Process manager para mantener bot activo 24/7

## Variables de Entorno (.env)
```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
LINEAR_API_KEY=your_linear_api_key
GITHUB_TOKEN=your_github_token
DATABASE_PATH=./data/agents.db
DOCKER_WORKSPACE_PATH=./workspace
MAX_DOCKER_INSTANCES=10

# Claude Configuration 
CLAUDE_USE_API=false  # Claude CLI autenticado, no necesita API key
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

## Base de Datos

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

## 🚀 Próximos Pasos - Roadmap de Deployment

### **Fase 0: Ya Implementado ✅**
- **Agent Manager**: Base de datos SQLite completa
- **Linear Integration**: GraphQL API funcional
- **GitHub Integration**: REST API + clonación
- **Claude CLI Integration**: Atomizer con contexto
- **Telegram UI**: Crear agente, ver tareas, seleccionar repos
- **Agent Creation Flow**: Flujo completo funcional

### **Fase 1: Deployment Base (Inmediato)**
1. **Deploy del Bot en VPS**
   - Crear .env.example con estructura
   - Clonar repositorio en VPS
   - Configurar .env con tokens reales
   - Instalar PM2 y crear ecosystem.config.js
   - Verificar conexión Telegram

2. **Configurar Docker en VPS**
   - Instalar Docker y Docker Compose
   - Crear Dockerfile para agentes con Claude CLI
   - Configurar volúmenes para workspaces
   - Test de contenedor básico

### **Fase 2: Conectar Ejecución Real (1-2 días)**
3. **Conectar UI con DockerOrchestrator**
   - Implementar executeTask en DockerOrchestrator
   - Pasar contexto Linear + GitHub a contenedor
   - Capturar logs de Claude CLI
   - Enviar updates a Telegram

4. **Testing End-to-End**
   - Crear agente completo
   - Ejecutar tarea simple (background)
   - Verificar logs y resultados
   - Validar modo interactivo

### **Fase 3: Background Execution (3-5 días)**
5. **Docker Orchestration**
   - Crear container por tarea con workspace aislado
   - Montar repos GitHub en container
   - Pasar contexto Linear + código a Claude

6. **Monitoreo y Control**
   - WebSocket para updates en tiempo real
   - Pausar/resumir agentes
   - Ver progreso detallado por tarea

### **Fase 4: Intelligence Layer (1 semana)**
7. **Task Understanding**
   - Claude analiza tarea Linear + codebase
   - Genera plan de ejecución específico
   - Identifica dependencias y riesgos

8. **Execution Engine**
   - Ejecutar plan paso a paso
   - Manejar errores inteligentemente
   - Rollback automático si falla

## 📋 Tareas Inmediatas

```bash
# En tu máquina local:
1. git add . && git commit -m "VPS con Claude CLI configurado"
2. git push origin RELY-38/telegram-bot-comandos-core

# En el VPS:
3. cd /root
4. git clone https://github.com/tu-usuario/telegram-task-agent.git
5. cd telegram-task-agent
6. npm install
7. cp .env.example .env
8. nano .env  # Configurar tokens reales
9. npm start  # Probar que funcione
10. pm2 start npm --name "telegram-bot" -- start
```

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

**CONCEPTO CORE**: Background Agents = Linear Project + GitHub Repos + Claude Intelligence + True Autonomous Execution

**TESTING OBLIGATORIO**: Para dar cualquier feature por terminada, debe pasar testing end-to-end completo con validación de todos los criterios de aceptación. No hay excepciones.

**VPS READY**: Claude CLI autenticado y funcionando. Listo para deploy completo del sistema.