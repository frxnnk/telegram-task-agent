const { testConnection, getTeams, createProject, createIssue } = require('./linear-setup');

// Roadmap completo atomizado en tareas específicas
const ROADMAP_TASKS = [
  {
    title: "RELY-50: Linear Integration - Mostrar tableros y tareas",
    description: `
**Objetivo:** Integrar Linear API para mostrar tableros y tareas disponibles via Telegram

**Especificaciones:**
- Comando /linear que muestre todos los tableros activos
- Comando /tasks [board_id] que liste tareas del tablero
- Formato visual con estados, prioridades y asignados
- Filtros por estado (Todo, In Progress, Done)
- Selección de tareas para atomización

**Criterios de aceptación:**
- ✅ Usuario puede ver todos sus tableros Linear
- ✅ Lista de tareas filtrable por estado
- ✅ Información completa de cada tarea (título, descripción, asignado)
- ✅ Integración sin errores con Linear API

**Tech Stack:** Linear GraphQL API, Telegraf.js
    `,
    category: "integration",
    priority: 1,
    estimatedTokens: 2500,
    dependencies: []
  },
  
  {
    title: "RELY-51: GitHub Repository Selection",
    description: `
**Objetivo:** Permitir selección y vinculación de repositorios GitHub específicos

**Especificaciones:**
- Comando /repos que liste repositorios accesibles
- Selección múltiple de repos para el proyecto
- Validación de permisos de escritura
- Cache de estructura de repos seleccionados
- Vinculación tarea Linear ↔ repo GitHub

**Criterios de aceptación:**
- ✅ Lista de repos con permisos de escritura
- ✅ Selección persistente de repos por proyecto  
- ✅ Validación de acceso y permisos
- ✅ Cache de estructura de directorios

**Tech Stack:** GitHub REST API, Octokit.js
    `,
    category: "integration", 
    priority: 2,
    estimatedTokens: 3000,
    dependencies: ["RELY-50"]
  },

  {
    title: "RELY-52: Enhanced Task Atomizer con contexto Linear+GitHub",
    description: `
**Objetivo:** Mejorar atomizador con contexto completo de Linear y estructura GitHub

**Especificaciones:**
- Atomizar tareas Linear con contexto del repo
- Análisis de estructura de archivos existente
- Generación de comandos Docker específicos
- Cálculo preciso de costos por tarea
- Dependencias automáticas basadas en archivos

**Criterios de aceptación:**
- ✅ Atomización considera estructura actual del repo
- ✅ Comandos Docker específicos y ejecutables
- ✅ Estimación precisa de tokens/costos
- ✅ Detección automática de dependencias

**Tech Stack:** Claude API, GitHub Tree API, Docker
    `,
    category: "core",
    priority: 3, 
    estimatedTokens: 4000,
    dependencies: ["RELY-51"]
  },

  {
    title: "RELY-53: VPS Docker Orchestration System",
    description: `
**Objetivo:** Sistema de orquestación Docker en VPS con permisos absolutos

**Especificaciones:**
- Conexión SSH automática a VPS
- Creación de contenedores con volúmenes completos
- Instalación automática de dependencias
- Acceso completo a filesystem del proyecto
- Monitoreo de recursos (CPU, RAM, Disk)

**Criterios de aceptación:**
- ✅ Conexión automática a VPS via SSH
- ✅ Contenedores con acceso completo al proyecto
- ✅ Instalación automática de tech stack
- ✅ Monitoreo de recursos en tiempo real

**Tech Stack:** Docker Remote API, SSH2, Node.js
    `,
    category: "infrastructure",
    priority: 4,
    estimatedTokens: 5000, 
    dependencies: ["RELY-52"]
  },

  {
    title: "RELY-54: Auto-Testing & Quality Assurance System",
    description: `
**Objetivo:** Sistema automático de testing completo antes de push

**Especificaciones:**
- Detección automática de framework de testing
- Ejecución de tests unitarios, integración y E2E
- Linting y formateo automático
- Build verification antes de push
- Reportes detallados de cobertura

**Criterios de aceptación:**
- ✅ Detección automática de Jest/Mocha/Cypress
- ✅ Ejecución completa de test suite
- ✅ Linting automático (ESLint, Prettier)
- ✅ Build exitoso verificado
- ✅ Reportes de cobertura y calidad

**Tech Stack:** Jest, ESLint, Prettier, framework-agnostic
    `,
    category: "quality",
    priority: 5,
    estimatedTokens: 3500,
    dependencies: ["RELY-53"]
  },

  {
    title: "RELY-55: Smart Branch Management & Auto-Push",
    description: `
**Objetivo:** Manejo inteligente de branches y push automático

**Especificaciones:**
- Creación automática de feature branches
- Nomenclatura basada en tarea Linear (RELY-XX/descripcion)
- Commits descriptivos automáticos
- Push automático solo si tests pasan
- Pull request automático con template

**Criterios de aceptación:**
- ✅ Branch creado automáticamente con nombre correcto
- ✅ Commits siguiendo conventional commits
- ✅ Push solo después de tests exitosos
- ✅ PR automático con descripción completa

**Tech Stack:** Git, GitHub API, Conventional Commits
    `,
    category: "automation",
    priority: 6,
    estimatedTokens: 2800,
    dependencies: ["RELY-54"]
  },

  {
    title: "RELY-56: Multi-Instance Dashboard & Real-time Monitoring",
    description: `
**Objetivo:** Dashboard para monitorear múltiples instancias concurrentes

**Especificaciones:**
- Vista de todas las instancias activas
- Estado en tiempo real de cada contenedor
- Logs streaming en vivo
- Métricas de progreso y performance
- Controles play/pause/stop por instancia

**Criterios de aceptación:**
- ✅ Dashboard con todas las instancias
- ✅ Estados actualizados cada 10 segundos
- ✅ Streaming de logs en tiempo real
- ✅ Controles granulares por instancia
- ✅ Métricas de CPU/RAM/progreso

**Tech Stack:** WebSockets, Docker Stats API, Telegraf inline keyboards
    `,
    category: "monitoring",
    priority: 7,
    estimatedTokens: 4500,
    dependencies: ["RELY-55"]
  },

  {
    title: "RELY-57: Cost Tracking & Budget Management",
    description: `
**Objetivo:** Tracking preciso de costos y manejo de presupuestos

**Especificaciones:**
- Cálculo en tiempo real de costos por token
- Presupuestos por proyecto y alertas
- Optimización automática de prompts
- Reportes de eficiencia y ROI
- Límites automáticos de gasto

**Criterios de aceptación:**
- ✅ Tracking preciso de tokens Claude + GitHub
- ✅ Alertas automáticas al 80% del presupuesto
- ✅ Optimización de prompts para reducir costos
- ✅ Reportes detallados de ROI por tarea

**Tech Stack:** Claude API Usage, GitHub API limits, SQLite analytics
    `,
    category: "analytics",
    priority: 8,
    estimatedTokens: 3000,
    dependencies: ["RELY-56"]
  },

  {
    title: "RELY-58: Advanced LangGraph Workflows",
    description: `
**Objetivo:** Workflows LangGraph avanzados para casos complejos

**Especificaciones:**
- Workflow de debugging automático
- Retry inteligente con análisis de errores
- Optimización de orden de ejecución
- Paralelización automática de tareas independientes
- Self-healing en caso de fallos

**Criterios de aceptación:**
- ✅ Debugging automático con Claude
- ✅ Retry inteligente basado en tipo de error
- ✅ Optimización dinámica del orden
- ✅ Ejecución paralela cuando es posible
- ✅ Recovery automático de fallos menores

**Tech Stack:** LangGraph, Claude API, Docker Swarm
    `,
    category: "intelligence",
    priority: 9,
    estimatedTokens: 6000,
    dependencies: ["RELY-57"]
  },

  {
    title: "RELY-59: Production Deployment & Scaling",
    description: `
**Objetivo:** Deploy a producción con escalabilidad automática

**Especificaciones:**
- Deploy automático a Railway/Render
- Escalabilidad horizontal automática
- Load balancing para múltiples bots
- Backup automático de datos
- Monitoring de uptime y performance

**Criterios de aceptación:**
- ✅ Deploy automático desde main branch
- ✅ Escalabilidad basada en carga
- ✅ Load balancer configurado
- ✅ Backups diarios automáticos
- ✅ Alertas de downtime < 30 segundos

**Tech Stack:** Railway, Docker Compose, Redis Cluster, PostgreSQL
    `,
    category: "deployment",
    priority: 10,
    estimatedTokens: 4000,
    dependencies: ["RELY-58"]
  }
];

async function createLinearRoadmap() {
  console.log('🚀 Creando roadmap completo en Linear...');
  
  try {
    // Test connection
    const viewer = await testConnection();
    console.log(`Connected as: ${viewer.name}`);
    
    // Get teams
    const teams = await getTeams();
    console.log('Available teams:', teams.map(t => `${t.name} (${t.key})`).join(', '));
    
    // Use first team or find specific team
    const team = teams.find(t => t.name.includes('Development')) || teams[0];
    console.log(`Using team: ${team.name}`);
    
    // Create project for the roadmap
    const project = await createProject(
      'Telegram Task Agent - Enhanced System',
      'Sistema completo de agentes atomizados con Linear + GitHub + VPS integration',
      team.id
    );
    
    console.log(`✅ Project created: ${project.name}`);
    console.log(`🔗 URL: ${project.url}`);
    
    // Create all issues
    console.log('\n📋 Creating issues...');
    const createdIssues = [];
    
    for (const task of ROADMAP_TASKS) {
      console.log(`Creating: ${task.title}`);
      
      const issue = await createIssue(
        task.title,
        task.description,
        team.id,
        project.id,
        task.priority
      );
      
      createdIssues.push({
        ...issue,
        category: task.category,
        estimatedTokens: task.estimatedTokens,
        dependencies: task.dependencies
      });
      
      console.log(`✅ ${issue.identifier}: ${issue.title}`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n🎉 Roadmap completo creado!');
    console.log(`📊 Total tareas: ${createdIssues.length}`);
    console.log(`💰 Tokens estimados totales: ${ROADMAP_TASKS.reduce((sum, task) => sum + task.estimatedTokens, 0)}`);
    console.log(`🔗 Linear Project: ${project.url}`);
    
    // Show execution order
    console.log('\n📅 Orden de ejecución recomendado:');
    ROADMAP_TASKS
      .sort((a, b) => a.priority - b.priority)
      .forEach((task, index) => {
        console.log(`${index + 1}. ${task.title} (${task.estimatedTokens} tokens)`);
      });
    
    return {
      project,
      issues: createdIssues,
      totalTasks: createdIssues.length,
      totalTokens: ROADMAP_TASKS.reduce((sum, task) => sum + task.estimatedTokens, 0)
    };
    
  } catch (error) {
    console.error('❌ Error creating roadmap:', error);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  createLinearRoadmap()
    .then(result => {
      console.log('\n✅ Roadmap creation completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed to create roadmap:', error);
      process.exit(1);
    });
}

module.exports = { createLinearRoadmap, ROADMAP_TASKS };