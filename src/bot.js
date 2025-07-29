require('dotenv').config();
const { Telegraf } = require('telegraf');
const TaskAtomizerCLI = require('./atomizer/TaskAtomizerCLI');
const DatabaseManager = require('./database/DatabaseManager');
const LinearManager = require('./integrations/LinearManager');
const GitHubManager = require('./integrations/GitHubManager');
const path = require('path');

class TelegramTaskBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.atomizer = new TaskAtomizerCLI();
    this.db = new DatabaseManager();
    this.linear = new LinearManager(process.env.LINEAR_API_KEY);
    this.github = new GitHubManager(process.env.GITHUB_TOKEN);
    this.projects = new Map(); // En memoria para el MVP
    this.linearCache = new Map(); // Cache para equipos y proyectos
    this.githubCache = new Map(); // Cache para repos y estructuras
    this.selectedRepositories = new Map(); // Repos seleccionados por usuario
    
    this.setupCommands();
    this.setupMiddleware();
  }

  setupMiddleware() {
    // Logging middleware
    this.bot.use((ctx, next) => {
      const user = ctx.from.username || ctx.from.first_name || 'unknown';
      console.log(`📨 [${new Date().toISOString()}] ${user}: ${ctx.message?.text || ctx.update.callback_query?.data || 'action'}`);
      return next();
    });

    // Error handling
    this.bot.catch((err, ctx) => {
      console.error('❌ Bot error:', err);
      ctx.reply('❌ Ocurrió un error inesperado. Intenta nuevamente.');
    });
  }

  setupCommands() {
    // Comando de inicio
    this.bot.command('start', (ctx) => {
      const welcomeMessage = `
🤖 **Telegram Task Agent** - ¡Bienvenido!

Sistema de agentes atomizados que descompone proyectos complejos en tareas ejecutables.

**Comandos disponibles:**

**🔗 Integraciones:**
/linear - Ver equipos y proyectos Linear
/tasks [team_key] - Ver tareas de un equipo
/project_tasks [project_name] - Ver tareas de proyecto
/atomize [issue_id] - Atomizar tarea Linear específica

/repos - Ver repositorios GitHub disponibles
/select_repo [owner/repo] - Seleccionar repositorio
/repo_structure [owner/repo] - Ver estructura del repo
/my_repos - Ver repositorios seleccionados

**⚙️ Core:**
/project - Atomizar un proyecto nuevo
/list - Ver proyectos y tareas
/status - Estado del sistema
/help - Ayuda detallada

**¿Cómo empezar?**
1. Usa \`/project "Descripción de tu proyecto"\`
2. Sigue las instrucciones para atomizar con Claude CLI
3. Ejecuta las tareas resultantes

💡 **Ejemplo:**
\`/project "Crear una API REST para manejo de tareas con autenticación JWT"\`
      `;
      
      ctx.replyWithMarkdown(welcomeMessage);
    });

    // Comando principal: atomizar proyecto
    this.bot.command('project', async (ctx) => {
      const projectDescription = ctx.message.text.replace('/project', '').trim();
      
      if (!projectDescription) {
        return ctx.replyWithMarkdown(`
❌ **Descripción requerida**

**Uso:** \`/project "descripción completa del proyecto"\`

**Ejemplo:**
\`/project "Desarrollar un sistema de chat en tiempo real con React, Node.js, Socket.io y MongoDB"\`
        `);
      }

      await this.handleProjectAtomization(ctx, projectDescription);
    });

    // Listar proyectos y tareas
    this.bot.command('list', (ctx) => {
      if (this.projects.size === 0) {
        return ctx.replyWithMarkdown(`
📋 **No hay proyectos activos**

Crea tu primer proyecto con:
\`/project "descripción de tu proyecto"\`
        `);
      }

      this.sendProjectsList(ctx);
    });

    // Estado del sistema
    this.bot.command('status', (ctx) => {
      const status = this.getSystemStatus();
      ctx.replyWithMarkdown(status);
    });

    // Ayuda detallada
    this.bot.command('help', (ctx) => {
      const helpMessage = `
📚 **Telegram Task Agent - Guía Completa**

**🎯 ¿Qué hace?**
Descompone proyectos complejos en tareas atómicas ejecutables por Docker containers independientes.

**🔧 Comandos principales:**

**\`/project "descripción"\`**
- Atomiza tu proyecto en tareas ejecutables
- Integración con Claude CLI (gratis)
- Genera prompt optimizado para atomización

**\`/list\`**
- Muestra todos los proyectos y sus tareas
- Estados: pendiente, en progreso, completado
- Dependencias y orden de ejecución

**\`/status\`**
- Estado general del sistema
- Proyectos activos y estadísticas
- Información de configuración

**💡 Flujo de trabajo:**
1. \`/project "Mi proyecto increíble"\` 
2. Bot genera prompt para Claude CLI
3. Ejecutas: \`claude --file="prompt.md"\`
4. Pegas la respuesta JSON en el chat
5. Bot procesa y muestra tareas listas para ejecutar

**🚀 Ventajas:**
✅ Costo $0 (usa tu suscripción Claude)
✅ Tareas completamente independientes
✅ Orden de ejecución automático
✅ Comandos Docker específicos
      `;
      
      ctx.replyWithMarkdown(helpMessage);
    });

    // Comandos Linear Integration
    this.bot.command('linear', async (ctx) => {
      await this.handleLinearCommand(ctx);
    });

    this.bot.command('tasks', async (ctx) => {
      await this.handleTasksCommand(ctx);
    });

    this.bot.command('project_tasks', async (ctx) => {
      await this.handleProjectTasksCommand(ctx);
    });

    this.bot.command('atomize', async (ctx) => {
      await this.handleAtomizeCommand(ctx);
    });

    // Comandos GitHub Integration
    this.bot.command('repos', async (ctx) => {
      await this.handleReposCommand(ctx);
    });

    this.bot.command('select_repo', async (ctx) => {
      await this.handleSelectRepoCommand(ctx);
    });

    this.bot.command('repo_structure', async (ctx) => {
      await this.handleRepoStructureCommand(ctx);
    });

    this.bot.command('my_repos', async (ctx) => {
      await this.handleMyReposCommand(ctx);
    });

    // Comando para procesar respuesta de Claude CLI
    this.bot.hears(/^\\{[\\s\\S]*\\}$/, async (ctx) => {
      await this.handleClaudeResponse(ctx);
    });
  }

  async handleProjectAtomization(ctx, projectDescription) {
    const userId = ctx.from.id;
    const projectId = `proj_${Date.now()}_${userId}`;

    try {
      // Enviar mensaje de procesamiento
      const processingMsg = await ctx.replyWithMarkdown('⚙️ **Generando prompt para atomización...**');

      // Generar prompt con TaskAtomizer CLI
      const result = this.atomizer.generateAtomizationPrompt(projectDescription, {
        maxTasks: 12,
        complexity: 'medium'
      });

      // Guardar contexto del proyecto
      this.projects.set(projectId, {
        id: projectId,
        userId: userId,
        description: projectDescription,
        status: 'awaiting_claude_response',
        promptFile: result.promptFile,
        createdAt: new Date().toISOString()
      });

      // Eliminar mensaje de procesamiento
      await ctx.deleteMessage(processingMsg.message_id);

      // Enviar instrucciones con el prompt generado
      const instructionsMessage = `
🎯 **Proyecto listo para atomización**

**📋 Proyecto:** ${projectDescription.slice(0, 50)}${projectDescription.length > 50 ? '...' : ''}
**📁 Prompt generado:** \`${path.basename(result.promptFile)}\`

**🚀 SIGUIENTE PASO:**

1️⃣ **Ejecuta Claude CLI:**
\`\`\`bash
claude --file="${result.promptFile}"
\`\`\`

2️⃣ **Copia la respuesta JSON completa** (solo el JSON, sin explicaciones)

3️⃣ **Pégala aquí en el chat** - El bot la procesará automáticamente

**💡 Alternativa:**
\`\`\`bash
claude < "${result.promptFile}"
\`\`\`

**⏱️ Timeout:** Este prompt expira en 30 minutos.
      `;

      await ctx.replyWithMarkdown(instructionsMessage);

      // Programar limpieza del prompt temporal
      setTimeout(() => {
        if (this.projects.has(projectId) && this.projects.get(projectId).status === 'awaiting_claude_response') {
          this.projects.delete(projectId);
        }
      }, 30 * 60 * 1000); // 30 minutos

    } catch (error) {
      console.error('Error in project atomization:', error);
      await ctx.replyWithMarkdown(`
❌ **Error al generar prompt**

${error.message}

Intenta nuevamente con una descripción más específica.
      `);
    }
  }

  async handleClaudeResponse(ctx) {
    const userId = ctx.from.id;
    const jsonResponse = ctx.message.text.trim();

    // Buscar proyecto activo del usuario
    const activeProject = Array.from(this.projects.values())
      .find(p => p.userId === userId && p.status === 'awaiting_claude_response');

    if (!activeProject) {
      return ctx.replyWithMarkdown(`
❌ **No hay proyecto activo esperando respuesta**

Inicia un nuevo proyecto con:
\`/project "descripción de tu proyecto"\`
      `);
    }

    try {
      // Mostrar mensaje de procesamiento
      const processingMsg = await ctx.replyWithMarkdown('🔄 **Procesando respuesta de Claude...**');

      // Parsear respuesta con TaskAtomizer
      const result = this.atomizer.parseAtomizedResponse(jsonResponse);

      // Actualizar proyecto con las tareas atomizadas
      activeProject.status = 'atomized';
      activeProject.atomizedResult = result;
      activeProject.processedAt = new Date().toISOString();

      // Eliminar mensaje de procesamiento
      await ctx.deleteMessage(processingMsg.message_id);

      // Mostrar resumen del proyecto atomizado
      await this.sendAtomizedProjectSummary(ctx, activeProject);

    } catch (error) {
      console.error('Error processing Claude response:', error);
      await ctx.replyWithMarkdown(`
❌ **Error al procesar respuesta de Claude**

**Posibles causas:**
- JSON inválido o incompleto
- Formato de respuesta incorrecto
- Respuesta cortada

**💡 Asegúrate de:**
- Copiar **todo** el JSON generado por Claude
- Incluir desde \`{\` hasta \`}\`
- No agregar texto adicional

**Error detalle:** ${error.message}
      `);
    }
  }

  async sendAtomizedProjectSummary(ctx, project) {
    const result = project.atomizedResult;
    
    const summaryMessage = `
✅ **Proyecto atomizado exitosamente**

**📋 ${result.project.title}**
**🎯 Complejidad:** ${result.project.complexity}
**⏱️ Duración estimada:** ${result.project.estimatedDuration}
**🔧 Tech Stack:** ${result.project.techStack?.join(', ') || 'N/A'}

**📊 Estadísticas:**
• **Tareas generadas:** ${result.tasks.length}
• **Dependencias:** ${result.dependencies.length}
• **Costo:** ${result.costs.note}

**🔗 Orden de ejecución calculado:**
${result.executionOrder.map((task, i) => 
  `${i + 1}. \`${task.id}\` - ${task.title}`
).join('\\n')}

**🚀 Próximos pasos:**
• Usa \`/list\` para ver detalles de cada tarea
• Implementar sistema de ejecución Docker
• Monitoreo en tiempo real

*Proyecto guardado como: ${project.id}*
    `;

    await ctx.replyWithMarkdown(summaryMessage);
  }

  sendProjectsList(ctx) {
    const projects = Array.from(this.projects.values());
    
    let message = '📋 **Proyectos activos:**\\n\\n';
    
    projects.forEach(project => {
      const status = this.getProjectStatusEmoji(project.status);
      const title = project.atomizedResult ? 
        project.atomizedResult.project.title : 
        project.description.slice(0, 40) + '...';
      
      message += `${status} **${title}**\\n`;
      message += `   ID: \`${project.id}\`\\n`;
      message += `   Estado: ${project.status}\\n`;
      
      if (project.atomizedResult) {
        message += `   Tareas: ${project.atomizedResult.tasks.length}\\n`;
      }
      
      message += `\\n`;
    });

    ctx.replyWithMarkdown(message);
  }

  getProjectStatusEmoji(status) {
    const statusEmojis = {
      'awaiting_claude_response': '⏳',
      'atomized': '✅',
      'executing': '🔄',
      'completed': '🎉',
      'failed': '❌'
    };
    return statusEmojis[status] || '❓';
  }

  getSystemStatus() {
    const projectCount = this.projects.size;
    const atomizedCount = Array.from(this.projects.values())
      .filter(p => p.status === 'atomized').length;
    
    return `
🤖 **Estado del Sistema**

**📊 Estadísticas:**
• Proyectos activos: ${projectCount}
• Proyectos atomizados: ${atomizedCount}
• Sistema: Operativo ✅

**⚙️ Configuración:**
• TaskAtomizer: Claude CLI Ready
• Database: ${this.db ? 'Conectado' : 'Desconectado'}
• Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? 'Configurado' : 'Faltante'}

**💾 Memoria:**
• Proyectos en RAM: ${projectCount}
• Uptime: ${Math.floor(process.uptime() / 60)} minutos

*Versión: Telegram Task Agent MVP*
    `;
  }

  // Handlers para comandos Linear
  async handleLinearCommand(ctx) {
    try {
      const processingMsg = await ctx.replyWithMarkdown('🔄 **Cargando datos de Linear...**');

      // Obtener equipos y proyectos en paralelo
      const [teams, projects] = await Promise.all([
        this.linear.getTeams(),
        this.linear.getProjects()
      ]);

      // Cache para uso posterior
      this.linearCache.set('teams', teams);
      this.linearCache.set('projects', projects);

      await ctx.deleteMessage(processingMsg.message_id);

      // Mostrar equipos disponibles
      const teamsMessage = this.linear.formatTeamsForTelegram(teams);
      await ctx.replyWithMarkdown(teamsMessage);

      // Mostrar proyectos disponibles
      const projectsMessage = this.linear.formatProjectsForTelegram(projects);
      await ctx.replyWithMarkdown(projectsMessage);

    } catch (error) {
      console.error('Error in Linear command:', error);
      await ctx.replyWithMarkdown(`
❌ **Error conectando con Linear**

${error.message}

Verifica tu LINEAR_API_KEY en las variables de entorno.
      `);
    }
  }

  async handleTasksCommand(ctx) {
    const teamKey = ctx.message.text.replace('/tasks', '').trim();
    
    if (!teamKey) {
      return ctx.replyWithMarkdown(`
❌ **Team key requerido**

**Uso:** \`/tasks [team_key]\`

**Ejemplo:** \`/tasks DEV\`

Usa \`/linear\` para ver equipos disponibles.
      `);
    }

    try {
      const processingMsg = await ctx.replyWithMarkdown('🔄 **Cargando tareas del equipo...**');

      // Buscar equipo por key
      const teams = this.linearCache.get('teams') || await this.linear.getTeams();
      const team = teams.find(t => t.key.toLowerCase() === teamKey.toLowerCase());

      if (!team) {
        await ctx.deleteMessage(processingMsg.message_id);
        return ctx.replyWithMarkdown(`
❌ **Equipo no encontrado: ${teamKey}**

Equipos disponibles:
${teams.map(t => `• \`${t.key}\` - ${t.name}`).join('\n')}
        `);
      }

      // Obtener tareas del equipo
      const teamWithIssues = await this.linear.getIssuesByTeam(team.id);
      
      await ctx.deleteMessage(processingMsg.message_id);

      const issuesMessage = this.linear.formatIssuesForTelegram(
        teamWithIssues.issues.nodes, 
        `${team.name} (${team.key})`
      );
      
      await ctx.replyWithMarkdown(issuesMessage);

    } catch (error) {
      console.error('Error getting team tasks:', error);
      await ctx.replyWithMarkdown(`
❌ **Error obteniendo tareas del equipo**

${error.message}
      `);
    }
  }

  async handleProjectTasksCommand(ctx) {
    const projectName = ctx.message.text.replace('/project_tasks', '').trim();
    
    if (!projectName) {
      return ctx.replyWithMarkdown(`
❌ **Nombre de proyecto requerido**

**Uso:** \`/project_tasks [project_name]\`

**Ejemplo:** \`/project_tasks "API Development"\`

Usa \`/linear\` para ver proyectos disponibles.
      `);
    }

    try {
      const processingMsg = await ctx.replyWithMarkdown('🔄 **Cargando tareas del proyecto...**');

      // Buscar proyecto por nombre
      const projects = this.linearCache.get('projects') || await this.linear.getProjects();
      const project = projects.find(p => 
        p.name.toLowerCase().includes(projectName.toLowerCase())
      );

      if (!project) {
        await ctx.deleteMessage(processingMsg.message_id);
        return ctx.replyWithMarkdown(`
❌ **Proyecto no encontrado: ${projectName}**

Proyectos disponibles:
${projects.slice(0, 5).map(p => `• ${p.name}`).join('\n')}
        `);
      }

      // Obtener tareas del proyecto
      const projectWithIssues = await this.linear.getIssuesByProject(project.id);
      
      await ctx.deleteMessage(processingMsg.message_id);

      const issuesMessage = this.linear.formatIssuesForTelegram(
        projectWithIssues.issues.nodes, 
        project.name
      );
      
      await ctx.replyWithMarkdown(issuesMessage);

    } catch (error) {
      console.error('Error getting project tasks:', error);
      await ctx.replyWithMarkdown(`
❌ **Error obteniendo tareas del proyecto**

${error.message}
      `);
    }
  }

  async handleAtomizeCommand(ctx) {
    const issueId = ctx.message.text.replace('/atomize', '').trim();
    
    if (!issueId) {
      return ctx.replyWithMarkdown(`
❌ **Issue ID requerido**

**Uso:** \`/atomize [issue_id]\`

**Ejemplo:** \`/atomize 123e4567-e89b-12d3-a456-426614174000\`

Usa \`/tasks [team]\` para ver IDs de tareas disponibles.
      `);
    }

    try {
      const processingMsg = await ctx.replyWithMarkdown('🔄 **Obteniendo tarea de Linear...**');

      // Obtener detalles completos de la tarea
      const issue = await this.linear.getIssueById(issueId);
      
      if (!issue) {
        await ctx.deleteMessage(processingMsg.message_id);
        return ctx.replyWithMarkdown(`
❌ **Tarea no encontrada: ${issueId}**

Verifica que el ID sea correcto y tengas acceso a la tarea.
        `);
      }

      await ctx.deleteMessage(processingMsg.message_id);

      // Mostrar detalles de la tarea antes de atomizar
      const taskDetails = `
🎯 **Tarea Linear Seleccionada**

**${issue.identifier}**: ${issue.title}
**Equipo:** ${issue.team.name} (${issue.team.key})
**Estado:** ${issue.state.name}
**Prioridad:** ${this.linear.getPriorityEmoji(issue.priority)}
**Asignado:** ${issue.assignee ? issue.assignee.name : 'Sin asignar'}

**Descripción:**
${issue.description || 'Sin descripción'}

**¿Quieres atomizar esta tarea?**
Responde \`/confirm_atomize ${issueId}\` para continuar.
      `;

      await ctx.replyWithMarkdown(taskDetails);

    } catch (error) {
      console.error('Error getting issue details:', error);
      await ctx.replyWithMarkdown(`
❌ **Error obteniendo detalles de la tarea**

${error.message}
      `);
    }
  }

  // GitHub Integration Handlers
  async handleReposCommand(ctx) {
    try {
      if (!process.env.GITHUB_TOKEN) {
        return ctx.replyWithMarkdown(`
❌ **GitHub Token no configurado**

Configura GITHUB_TOKEN en tu archivo .env para usar esta funcionalidad.
        `);
      }

      const processingMsg = await ctx.replyWithMarkdown('🔄 **Cargando repositorios GitHub...**');

      // Obtener repositorios accesibles
      const repositories = await this.github.getRepositories('all', 'updated', 50);

      // Cache para uso posterior
      this.githubCache.set('repositories', repositories);

      await ctx.deleteMessage(processingMsg.message_id);

      // Mostrar repositorios disponibles
      const reposMessage = this.github.formatRepositoriesForTelegram(repositories);
      await ctx.replyWithMarkdown(reposMessage);

    } catch (error) {
      console.error('Error in repos command:', error);
      await ctx.replyWithMarkdown(`
❌ **Error obteniendo repositorios**

${error.message}

Verifica tu token de GitHub y permisos.
      `);
    }
  }

  async handleSelectRepoCommand(ctx) {
    const repoPath = ctx.message.text.replace('/select_repo', '').trim();
    
    if (!repoPath || !repoPath.includes('/')) {
      return ctx.replyWithMarkdown(`
❌ **Formato de repositorio inválido**

**Uso:** \`/select_repo owner/repository\`
**Ejemplo:** \`/select_repo facebook/react\`

Usa \`/repos\` para ver repositorios disponibles.
      `);
    }

    try {
      const [owner, repo] = repoPath.split('/');
      const processingMsg = await ctx.replyWithMarkdown('🔄 **Validando acceso al repositorio...**');

      // Validar acceso al repositorio
      const validation = await this.github.validateRepositoryAccess(owner, repo);

      await ctx.deleteMessage(processingMsg.message_id);

      if (!validation.valid) {
        return ctx.replyWithMarkdown(`
❌ **Error de acceso al repositorio**

${validation.error}

Verifica que tengas permisos de escritura en este repositorio.
        `);
      }

      // Guardar repositorio seleccionado para el usuario
      const userId = ctx.from.id;
      if (!this.selectedRepositories.has(userId)) {
        this.selectedRepositories.set(userId, []);
      }

      const userRepos = this.selectedRepositories.get(userId);
      const existingRepo = userRepos.find(r => r.full_name === validation.repository.full_name);

      if (existingRepo) {
        return ctx.replyWithMarkdown(`
✅ **Repositorio ya seleccionado**

**${validation.repository.full_name}** ya está en tu lista de repositorios.

Usa \`/my_repos\` para ver todos tus repositorios seleccionados.
        `);
      }

      userRepos.push({
        ...validation.repository,
        selectedAt: new Date().toISOString()
      });

      const successMessage = `
✅ **Repositorio seleccionado exitosamente**

**📁 ${validation.repository.full_name}**
${validation.repository.description ? `📝 ${validation.repository.description}` : ''}

**Permisos:** ${validation.repository.permissions.admin ? '👑 Admin' : '✍️ Write'}
**Branch principal:** \`${validation.repository.default_branch}\`

**Siguiente paso:**
- \`/repo_structure ${validation.repository.full_name}\` - Ver estructura
- \`/my_repos\` - Ver todos tus repositorios
      `;

      await ctx.replyWithMarkdown(successMessage);

    } catch (error) {
      console.error('Error selecting repository:', error);
      await ctx.replyWithMarkdown(`
❌ **Error seleccionando repositorio**

${error.message}
      `);
    }
  }

  async handleRepoStructureCommand(ctx) {
    const repoPath = ctx.message.text.replace('/repo_structure', '').trim();
    
    if (!repoPath || !repoPath.includes('/')) {
      return ctx.replyWithMarkdown(`
❌ **Formato de repositorio inválido**

**Uso:** \`/repo_structure owner/repository\`
**Ejemplo:** \`/repo_structure facebook/react\`
      `);
    }

    try {
      const [owner, repo] = repoPath.split('/');
      const processingMsg = await ctx.replyWithMarkdown('🔄 **Obteniendo estructura del repositorio...**');

      // Obtener estructura del repositorio
      const structure = await this.github.getRepositoryStructure(owner, repo, '', 3);

      await ctx.deleteMessage(processingMsg.message_id);

      // Formatear y mostrar estructura
      const structureMessage = this.github.formatRepositoryStructureForTelegram(structure, repoPath);
      await ctx.replyWithMarkdown(structureMessage);

    } catch (error) {
      console.error('Error getting repository structure:', error);
      await ctx.replyWithMarkdown(`
❌ **Error obteniendo estructura**

${error.message}

Verifica que tengas acceso a este repositorio.
      `);
    }
  }

  async handleMyReposCommand(ctx) {
    const userId = ctx.from.id;
    const userRepos = this.selectedRepositories.get(userId) || [];

    if (userRepos.length === 0) {
      return ctx.replyWithMarkdown(`
📂 **No tienes repositorios seleccionados**

Usa \`/repos\` para ver repositorios disponibles y \`/select_repo [owner/repo]\` para seleccionar.
      `);
    }

    let message = '📁 **Tus repositorios seleccionados:**\n\n';

    userRepos.forEach((repo, index) => {
      const selectedDate = new Date(repo.selectedAt).toLocaleDateString();
      const visibility = repo.private ? '🔒 Privado' : '🌐 Público';
      
      message += `${index + 1}. **${repo.name}**\n`;
      message += `   ${visibility} • \`${repo.full_name}\`\n`;
      message += `   📅 Seleccionado: ${selectedDate}\n`;
      message += `   🔗 \`/repo_structure ${repo.full_name}\`\n\n`;
    });

    message += '*Estos repositorios serán considerados para la atomización de tareas.*';

    await ctx.replyWithMarkdown(message);
  }

  async start() {
    try {
      // Inicializar base de datos
      await this.db.initialize();
      
      // Iniciar bot
      await this.bot.launch();
      console.log('🤖 Telegram Task Agent iniciado correctamente');
      console.log('🔑 Bot token configurado:', !!process.env.TELEGRAM_BOT_TOKEN);
      console.log('📝 Comandos disponibles: /start, /project, /list, /status, /help');
      
      // Graceful shutdown
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
      
    } catch (error) {
      console.error('❌ Error iniciando bot:', error);
      process.exit(1);
    }
  }
}

// Iniciar bot si se ejecuta directamente
if (require.main === module) {
  const bot = new TelegramTaskBot();
  bot.start();
}

module.exports = TelegramTaskBot;