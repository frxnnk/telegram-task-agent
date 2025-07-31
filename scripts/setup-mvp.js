const { testConnection, getTeams, createProject, createIssue } = require('./linear-setup');

const MVP_TASKS = [
  {
    title: "Setup inicial del proyecto",
    description: `**Objetivo**: Crear la estructura base del proyecto
    
**Tareas**:
- Inicializar proyecto Node.js con package.json
- Instalar dependencias básicas (telegraf, sqlite3)
- Crear estructura de archivos según CLAUDE.md
- Configurar variables de entorno (.env)
- Setup inicial de bot.js (archivo principal)`,
    priority: 1
  },
  {
    title: "Implementar Task Atomizer con Claude API",
    description: `**Objetivo**: Sistema que convierte descripciones en tareas atómicas
    
**Funcionalidades**:
- Integración con Claude 3.5 Sonnet API
- Parser que recibe descripción de proyecto
- Generador de tareas atómicas ordenadas
- Sistema de dependencias entre tareas
- Output en formato JSON estructurado`,
    priority: 1
  },
  {
    title: "Bot de Telegram - Comandos Core",
    description: `**Objetivo**: Implementar comandos básicos del bot
    
**Comandos a implementar**:
- /project "descripción" - Atomizar proyecto
- /list - Ver tareas y estados
- /start [task_id] - Ejecutar tarea
- /pause [task_id] - Pausar tarea
- /logs [task_id] - Ver logs
- /cost - Dashboard de costos`,
    priority: 1
  },
  {
    title: "Database Layer - SQLite",
    description: `**Objetivo**: Sistema de persistencia para tareas y estados
    
**Esquema**:
- Tabla tasks (id, title, description, status, dependencies)
- Tabla executions (task_id, start_time, end_time, logs)
- Tabla costs (task_id, tokens_used, cost_usd)
- Funciones CRUD básicas
- Migraciones automáticas`,
    priority: 2
  },
  {
    title: "Docker Agent System - MVP",
    description: `**Objetivo**: Ejecutor de tareas en contenedores aislados
    
**Componentes**:
- Dockerfile base para agentes
- Sistema de spawn de contenedores por tarea
- Workspace compartido entre host y container
- Captura de logs en tiempo real
- Cleanup automático de contenedores`,
    priority: 2
  },
  {
    title: "Real-time Monitoring System",
    description: `**Objetivo**: Monitoreo en vivo via Telegram
    
**Features**:
- Updates automáticos cada 30s
- Estado de tareas en ejecución
- Progreso visual con emojis
- Alertas de errores/fallos
- Comando /monitor on/off`,
    priority: 3
  },
  {
    title: "Cost Tracking System",
    description: `**Objetivo**: Seguimiento preciso de costos por token
    
**Métricas**:
- Tokens consumidos por Claude API
- Costo en USD por tarea/proyecto
- Dashboard en tiempo real
- Alertas de presupuesto
- Histórico de gastos`,
    priority: 3
  },
  {
    title: "Error Handling & Rollback",
    description: `**Objetivo**: Sistema robusto de manejo de errores
    
**Funcionalidades**:
- Detección automática de fallos
- Rollback de tareas fallidas
- Reintentos automáticos
- Logs detallados de errores
- Comando /rollback [task_id]`,
    priority: 3
  },
  {
    title: "Testing & Documentation",
    description: `**Objetivo**: Asegurar calidad y facilitar deployment
    
**Entregables**:
- Tests unitarios para componentes core
- Tests de integración con APIs
- README.md con quick start
- Documentación de comandos
- Guía de deployment`,
    priority: 4
  },
  {
    title: "Deployment & Production Setup",
    description: `**Objetivo**: Preparar para producción
    
**Tareas**:
- Configuración para Railway/Render
- Variables de entorno de producción
- Health checks y monitoring
- Backup automático de database
- CI/CD pipeline básico`,
    priority: 4
  }
];

async function setupMVP() {
  console.log('🚀 Setting up Telegram Task Agent MVP in Linear...\n');
  
  try {
    // Test connection
    console.log('1. Testing Linear connection...');
    const user = await testConnection();
    
    // Get teams
    console.log('\n2. Getting available teams...');
    const teams = await getTeams();
    console.log('Available teams:');
    teams.forEach(team => console.log(`  - ${team.name} (${team.key})`));
    
    // Use first team or create logic to select
    const selectedTeam = teams[0];
    console.log(`\nUsing team: ${selectedTeam.name}`);
    
    // Create project
    console.log('\n3. Creating MVP project...');
    const project = await createProject(
      'Telegram Task Agent MVP',
      'Sistema de agentes atomizados que descompone proyectos complejos en tareas ejecutables por Docker containers. Control total via Telegram con monitoreo en tiempo real.',
      selectedTeam.id
    );
    console.log(`✅ Project created: ${project.name}`);
    console.log(`   URL: ${project.url}`);
    
    // Create issues for each MVP task
    console.log('\n4. Creating MVP tasks...');
    const createdIssues = [];
    
    for (const task of MVP_TASKS) {
      const issue = await createIssue(
        task.title,
        task.description,
        selectedTeam.id,
        project.id,
        task.priority
      );
      createdIssues.push(issue);
      console.log(`✅ Created: ${issue.identifier} - ${issue.title}`);
    }
    
    console.log('\n🎉 MVP setup completed successfully!');
    console.log(`\n📋 Project Overview:`);
    console.log(`   - Project: ${project.name}`);
    console.log(`   - Tasks created: ${createdIssues.length}`);
    console.log(`   - Team: ${selectedTeam.name}`);
    console.log(`   - URL: ${project.url}`);
    
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Review tasks in Linear: ${project.url}`);
    console.log(`   2. Adjust priorities and assignees as needed`);
    console.log(`   3. Start with "Setup inicial del proyecto" task`);
    console.log(`   4. Follow the atomic task execution approach`);
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  setupMVP();
}

module.exports = { setupMVP, MVP_TASKS };