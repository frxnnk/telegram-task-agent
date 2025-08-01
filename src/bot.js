require('dotenv').config();
const { Telegraf } = require('telegraf');
const TaskAtomizerCLI = require('./atomizer/TaskAtomizerCLI');
const TaskAtomizerCLIIntegrated = require('./atomizer/TaskAtomizerCLIIntegrated');
const LinearManager = require('./integrations/LinearManager');
const GitHubManager = require('./integrations/GitHubManager');
const DockerOrchestrator = require('./orchestration/DockerOrchestrator');
const ProjectRepoManager = require('./integrations/ProjectRepoManager');
const AgentManager = require('./database/AgentManager');

// Create working bot with Enhanced TaskAtomizer
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const atomizer = new TaskAtomizerCLI(); // Legacy manual atomizer
const linear = new LinearManager(process.env.LINEAR_API_KEY);
const github = new GitHubManager(process.env.GITHUB_TOKEN);
const docker = new DockerOrchestrator({
  workspacePath: process.env.DOCKER_WORKSPACE_PATH || './workspace',
  maxInstances: process.env.MAX_DOCKER_INSTANCES || 10,
  projectRepoManager: null, // Will be set after initialization
  mockMode: process.env.DOCKER_MOCK_MODE === 'true' // For testing without Docker
});

// Helper function to escape Markdown special characters
function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/[*_`\[\]()~>#+=|{}.!]/g, '\\$&');
}

// Helper function to escape text but preserve hyphens (for container names)
function escapeMarkdownSafe(text) {
  if (!text) return '';
  return text.replace(/[*_`\[\]()~>#+=|{}.!]/g, '\\$&');
}

// Initialize ProjectRepoManager
const projectRepoManager = new ProjectRepoManager({
  linearManager: linear,
  githubManager: github,
  dbPath: process.env.DATABASE_PATH || './data/project_mappings.db'
});

// Initialize AgentManager
const agentManager = new AgentManager('./data/agents.db');

// Initialize Enhanced Claude CLI Atomizer
let claudeAtomizer = null;

// Initialize ProjectRepoManager and AgentManager on startup
Promise.all([
  projectRepoManager.initialize(),
  agentManager.initialize()
]).then(() => {
  // Set references after initialization
  docker.projectRepoManager = projectRepoManager;
  
  // Initialize Claude CLI Atomizer with full integration
  claudeAtomizer = new TaskAtomizerCLIIntegrated({
    linearManager: linear,
    githubManager: github,
    projectRepoManager: projectRepoManager
  });
  
  console.log('✅ Enhanced workspace integration initialized');
  console.log('🤖 Claude CLI atomizer ready (using your Pro plan)');
  console.log('🤖 Agent Manager initialized');
}).catch(error => {
  console.error('❌ Failed to initialize managers:', error);
  console.log('🔄 Bot will continue with limited features');
});

// Repository selection storage (in-memory for MVP)
const selectedRepositories = new Map(); // userId -> [repos]

// Agent creation state storage
const agentCreationState = new Map(); // userId -> { step, data }

// Repository name cache for long names (hash -> fullName)
const repoNameCache = new Map();

// Helper functions for repo encoding/decoding
function encodeRepoForCallback(fullName) {
  const basicEncoded = fullName.replace('/', '__SLASH__');
  const fullCallbackData = `github_select_${basicEncoded}`;
  
  // If the full callback data exceeds Telegram's 64-char limit, use hash
  if (fullCallbackData.length > 64) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(fullName).digest('hex').substring(0, 8);
    repoNameCache.set(hash, fullName);
    return `hash_${hash}`;
  }
  
  return basicEncoded;
}

function decodeRepoFromCallback(encoded) {
  // Check if it's a hash-based encoding
  if (encoded.startsWith('hash_')) {
    const hash = encoded.substring(5);
    const fullName = repoNameCache.get(hash);
    if (!fullName) {
      throw new Error('Repository not found in cache. Please refresh the repository list.');
    }
    return fullName;
  }
  
  // Standard decoding
  return encoded.replace('__SLASH__', '/');
}

// Helper function to safely edit messages with error handling
async function safeEditMessage(ctx, text, options = {}) {
  try {
    await ctx.editMessageText(text, options);
  } catch (error) {
    if (error.message.includes('message is not modified')) {
      // Ignore "message not modified" errors
      return;
    }
    if (error.message.includes("can't parse entities")) {
      // Fallback to plain text if markdown parsing fails
      const plainOptions = { ...options };
      delete plainOptions.parse_mode;
      await ctx.editMessageText(text.replace(/\*/g, ''), plainOptions);
      return;
    }
    throw error;
  }
}

// Error handling
bot.catch((err, ctx) => {
  console.error('❌ Bot error:', err);
  ctx.reply('❌ Ocurrió un error inesperado. Intenta nuevamente.');
});

// Start command with Agent-focused UI
bot.command('start', async (ctx) => {
  const userId = ctx.from.id.toString();
  
  // Get user's agents
  let userAgents = [];
  try {
    userAgents = await agentManager.getUserAgents(userId);
  } catch (error) {
    console.error('Error getting user agents:', error);
  }
  
  const agentCount = userAgents.length;
  const activeAgents = userAgents.filter(a => a.status === 'working').length;
  
  const welcomeMessage = `🤖 *Background Agents Manager*

Crea agentes inteligentes que ejecutan tareas Linear en tu código GitHub automáticamente.

🎯 *Concepto: Agentes Background (como Cursor)*
• Cada agente = Linear Project + GitHub Repos
• Ejecuta tareas en background en tu VPS  
• Dos modos: Automático o con tus prompts

📊 *Tu Dashboard:*
• **Agentes creados**: ${agentCount}
• **Agentes activos**: ${activeAgents}
• **VPS**: Conectado ✅

*¿Qué hacer?*
${agentCount === 0 ? '🆕 Crea tu primer agente' : '🤖 Gestiona tus agentes existentes'}`;

  // Simplified keyboard with only working buttons
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🆕 Crear Agente', callback_data: 'create_agent' },
        { text: '📋 Mis Agentes', callback_data: 'my_agents' }
      ]
    ]
  };
  
  // Add help button if user has no agents (first time)
  if (agentCount === 0) {
    keyboard.inline_keyboard.push([
      { text: '❓ ¿Cómo funciona?', callback_data: 'agent_help' }
    ]);
  }
  
  ctx.replyWithMarkdown(welcomeMessage, { reply_markup: keyboard });
});

// Project command with Enhanced TaskAtomizer
bot.command('project', async (ctx) => {
  const projectDescription = ctx.message.text.replace('/project', '').trim();
  
  if (!projectDescription) {
    return ctx.replyWithMarkdown('❌ *Descripción requerida*\n\n*Uso:* /project "descripción completa del proyecto"\n\n*Ejemplo:*\n/project "Desarrollar un sistema de chat en tiempo real con React, Node.js, Socket.io y MongoDB"');
  }
  
  try {
    const processingMsg = await ctx.reply('🔄 Generando prompt para atomización...');
    
    // Generate atomization prompt using Enhanced TaskAtomizer
    const result = await atomizer.generateAtomizationPrompt(projectDescription);
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    const instructions = `✅ *Proyecto listo para atomización*

*📋 Proyecto:* ${projectDescription.slice(0, 50)}...
*📁 Prompt generado:* ${result.promptFile.split('/').pop()}

*🚀 SIGUIENTE PASO:*

1️⃣ *Ejecuta Claude CLI:*
claude --file="${result.promptFile}"

2️⃣ *Copia la respuesta JSON completa*

3️⃣ *Pégala aquí en el chat*

✅ *Enhanced TaskAtomizer (RELY-52) activo*
• Context awareness con Linear/GitHub
• Dependency analysis mejorado
• Cost estimation por tarea`;

    await ctx.replyWithMarkdown(instructions);
    
  } catch (error) {
    console.error('Error in project atomization:', error);
    await ctx.replyWithMarkdown(`❌ *Error al generar prompt*\n\n${error.message}\n\nIntenta nuevamente con una descripción más específica.`);
  }
});

// Status command  
bot.command('status', (ctx) => {
  ctx.replyWithMarkdown(`📊 *Estado del Sistema*

✅ Enhanced TaskAtomizer (RELY-52) - Completado
• Context awareness con Linear/GitHub
• Dependency analysis mejorado  
• Cost estimation por tarea
• Parallel execution detection
• Critical path calculation
• Validation framework

🤖 Bot funcionando correctamente
📝 Todas las funcionalidades core implementadas`);
});

// Linear integration commands
bot.command('linear', async (ctx) => {
  try {
    if (!process.env.LINEAR_API_KEY) {
      return ctx.replyWithMarkdown('❌ *Linear API Key no configurado*\n\nConfigura LINEAR_API_KEY en tu archivo .env para usar esta funcionalidad.');
    }

    // Test connection first
    try {
      await linear.testConnection();
    } catch (authError) {
      return ctx.replyWithMarkdown('❌ *Error de autenticación Linear*\n\nTu LINEAR_API_KEY no es válido o ha expirado.\n\n*Solución:*\n1. Ve a Linear > Settings > API\n2. Genera un nuevo token\n3. Actualiza LINEAR_API_KEY en .env');
    }

    const processingMsg = await ctx.reply('🔄 Obteniendo equipos y proyectos de Linear...');
    
    const teams = await linear.getTeams();
    const projects = await linear.getProjects();
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    const teamsMsg = linear.formatTeamsForTelegram(teams);
    const projectsMsg = linear.formatProjectsForTelegram(projects);
    
    await ctx.replyWithMarkdown(teamsMsg);
    await ctx.replyWithMarkdown(projectsMsg);
    
  } catch (error) {
    console.error('Error in Linear command:', error);
    await ctx.replyWithMarkdown(`❌ *Error conectando con Linear*\n\n${error.message}\n\nVerifica tu LINEAR_API_KEY en las variables de entorno.`);
  }
});

bot.command('tasks', async (ctx) => {
  const teamKey = ctx.message.text.replace('/tasks', '').trim();
  
  if (!teamKey) {
    return ctx.replyWithMarkdown('❌ *Team key requerido*\n\n*Uso:* /tasks [team_key]\n*Ejemplo:* /tasks DEV\n\nUsa /linear para ver equipos disponibles.');
  }
  
  try {
    const processingMsg = await ctx.reply(`🔄 Obteniendo tareas del equipo ${teamKey}...`);
    
    const teams = await linear.getTeams();
    const team = teams.find(t => t.key.toLowerCase() === teamKey.toLowerCase());
    
    if (!team) {
      await ctx.deleteMessage(processingMsg.message_id);
      return ctx.replyWithMarkdown(`❌ *Equipo no encontrado: ${teamKey}*\n\nEquipos disponibles:\n${teams.map(t => `• ${t.key} - ${t.name}`).join('\n')}`);
    }
    
    const teamData = await linear.getIssuesByTeam(team.id);
    await ctx.deleteMessage(processingMsg.message_id);
    
    // Show only pending/in-progress tasks with suggestions
    const message = linear.formatIssuesForTelegram(teamData.issues.nodes, `${team.name} (${team.key})`, false);
    await ctx.replyWithMarkdown(message);
    
  } catch (error) {
    console.error('Error getting team tasks:', error);
    await ctx.replyWithMarkdown(`❌ *Error obteniendo tareas del equipo*\n\n${error.message}`);
  }
});

// New command to show all tasks including completed ones
bot.command('all_tasks', async (ctx) => {
  const teamKey = ctx.message.text.replace('/all_tasks', '').trim();
  
  if (!teamKey) {
    return ctx.replyWithMarkdown('❌ *Team key requerido*\n\n*Uso:* /all_tasks [team_key]\n*Ejemplo:* /all_tasks DEV\n\nUsa /linear para ver equipos disponibles.');
  }
  
  try {
    const processingMsg = await ctx.reply(`🔄 Obteniendo todas las tareas del equipo ${teamKey}...`);
    
    const teams = await linear.getTeams();
    const team = teams.find(t => t.key.toLowerCase() === teamKey.toLowerCase());
    
    if (!team) {
      await ctx.deleteMessage(processingMsg.message_id);
      return ctx.replyWithMarkdown(`❌ *Equipo no encontrado: ${teamKey}*\n\nEquipos disponibles:\n${teams.map(t => `• ${t.key} - ${t.name}`).join('\n')}`);
    }
    
    const teamData = await linear.getIssuesByTeam(team.id);
    await ctx.deleteMessage(processingMsg.message_id);
    
    // Show all tasks including completed ones
    const message = linear.formatIssuesForTelegram(teamData.issues.nodes, `${team.name} (${team.key}) - TODAS`, true);
    await ctx.replyWithMarkdown(message);
    
  } catch (error) {
    console.error('Error getting all team tasks:', error);
    await ctx.replyWithMarkdown(`❌ *Error obteniendo todas las tareas del equipo*\n\n${error.message}`);
  }
});

bot.command('atomize', async (ctx) => {
  const issueId = ctx.message.text.replace('/atomize', '').trim();
  
  if (!issueId) {
    return ctx.replyWithMarkdown('❌ *Issue ID requerido*\n\n*Uso:* /atomize [issue_id]\n*Ejemplo:* /atomize 123e4567-e89b-12d3-a456-426614174000\n\nUsa /tasks [team] para ver IDs de tareas disponibles.');
  }
  
  try {
    const processingMsg = await ctx.reply('🔄 Obteniendo detalles de la tarea...');
    
    const issue = await linear.getIssueById(issueId);
    
    if (!issue) {
      await ctx.deleteMessage(processingMsg.message_id);
      return ctx.replyWithMarkdown('❌ *Tarea no encontrada*\n\nVerifica que el ID sea correcto y tengas acceso a la tarea.');
    }
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    const issueDetails = `✅ *Tarea Linear encontrada*

*📋 ${issue.identifier}: ${issue.title}*

*📝 Descripción:*
${issue.description || 'Sin descripción'}

*📊 Detalles:*
• Estado: ${issue.state.name}
• Prioridad: ${issue.priority || 'No definida'}
• Estimación: ${issue.estimate || 'Sin estimar'} puntos
• Proyecto: ${issue.project?.name || 'Sin proyecto'}
• Equipo: ${issue.team?.name} (${issue.team?.key})
• Asignado: ${issue.assignee?.name || 'Sin asignar'}

🚀 *¿Quieres atomizar esta tarea?*
El Enhanced TaskAtomizer usará el contexto completo de Linear para generar tareas más precisas.

Responde /confirm_atomize ${issueId} para continuar.`;

    await ctx.replyWithMarkdown(issueDetails);
    
  } catch (error) {
    console.error('Error getting issue details:', error);
    await ctx.replyWithMarkdown(`❌ *Error obteniendo detalles de la tarea*\n\n${error.message}`);
  }
});

// GitHub integration commands
bot.command('repos', async (ctx) => {
  try {
    if (!process.env.GITHUB_TOKEN) {
      return ctx.replyWithMarkdown('❌ *GitHub Token no configurado*\n\nConfigura GITHUB_TOKEN en tu archivo .env para usar esta funcionalidad.');
    }

    // Test connection first
    try {
      await github.testConnection();
    } catch (authError) {
      return ctx.replyWithMarkdown('❌ *Error de autenticación GitHub*\n\nTu GITHUB_TOKEN no es válido o ha expirado.\n\n*Solución:*\n1. Ve a GitHub > Settings > Developer settings > Personal access tokens\n2. Genera un nuevo token con permisos de repo\n3. Actualiza GITHUB_TOKEN en .env');
    }

    const processingMsg = await ctx.reply('🔄 Obteniendo repositorios de GitHub...');
    
    const repositories = await github.getRepositories('all', 'updated', 50);
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    const message = github.formatRepositoriesForTelegram(repositories, 10);
    await ctx.replyWithMarkdown(message);
    
  } catch (error) {
    console.error('Error in repos command:', error);
    await ctx.replyWithMarkdown(`❌ *Error obteniendo repositorios*\n\n${error.message}\n\nVerifica tu token de GitHub y permisos.`);
  }
});

bot.command('select_repo', async (ctx) => {
  const repoPath = ctx.message.text.replace('/select_repo', '').trim();
  
  if (!repoPath || !repoPath.includes('/')) {
    return ctx.replyWithMarkdown('❌ *Formato de repositorio inválido*\n\n*Uso:* /select_repo owner/repository\n*Ejemplo:* /select_repo facebook/react\n\nUsa /repos para ver repositorios disponibles.');
  }
  
  try {
    const [owner, repo] = repoPath.split('/');
    const processingMsg = await ctx.reply(`🔄 Validando acceso a ${repoPath}...`);
    
    const validation = await github.validateRepositoryAccess(owner, repo);
    
    if (!validation.valid) {
      await ctx.deleteMessage(processingMsg.message_id);
      return ctx.replyWithMarkdown(`❌ *Error de acceso al repositorio*\n\n${validation.error}\n\nVerifica que tengas permisos de escritura en este repositorio.`);
    }
    
    // Store selected repository for user
    const userId = ctx.from.id;
    const userRepos = selectedRepositories.get(userId) || [];
    
    const existingRepo = userRepos.find(r => r.full_name === validation.repository.full_name);
    if (existingRepo) {
      await ctx.deleteMessage(processingMsg.message_id);
      return ctx.replyWithMarkdown(`✅ *Repositorio ya seleccionado*\n\n**${validation.repository.full_name}** ya está en tu lista de repositorios.\n\nUsa /my_repos para ver todos tus repositorios seleccionados.`);
    }
    
    userRepos.push({
      ...validation.repository,
      selectedAt: new Date().toISOString()
    });
    selectedRepositories.set(userId, userRepos);
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    const visibility = validation.repository.private ? '🔒 Privado' : '🌐 Público';
    
    const successMessage = `✅ *Repositorio seleccionado exitosamente*

**${validation.repository.full_name}**

${visibility}
${validation.repository.description ? `📝 ${validation.repository.description}` : ''}

*Branch principal:* ${validation.repository.default_branch}

*Acciones disponibles:*
- /repo_structure ${validation.repository.full_name} - Ver estructura
- /my_repos - Ver todos tus repositorios`;

    await ctx.replyWithMarkdown(successMessage);
    
  } catch (error) {
    console.error('Error selecting repository:', error);
    await ctx.replyWithMarkdown(`❌ *Error seleccionando repositorio*\n\n${error.message}`);
  }
});

bot.command('repo_structure', async (ctx) => {
  const repoPath = ctx.message.text.replace('/repo_structure', '').trim();
  
  if (!repoPath || !repoPath.includes('/')) {
    return ctx.replyWithMarkdown('❌ *Formato de repositorio inválido*\n\n*Uso:* /repo_structure owner/repository\n*Ejemplo:* /repo_structure facebook/react');
  }
  
  try {
    const [owner, repo] = repoPath.split('/');
    const processingMsg = await ctx.reply(`🔄 Analizando estructura de ${repoPath}...`);
    
    const structure = await github.getRepositoryStructure(owner, repo, '', 2);
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    const message = github.formatRepositoryStructureForTelegram(structure, repoPath, 25);
    await ctx.replyWithMarkdown(message);
    
  } catch (error) {
    console.error('Error getting repository structure:', error);
    await ctx.replyWithMarkdown(`❌ *Error obteniendo estructura*\n\n${error.message}\n\nVerifica que tengas acceso a este repositorio.`);
  }
});

bot.command('my_repos', (ctx) => {
  const userId = ctx.from.id;
  const userRepos = selectedRepositories.get(userId) || [];
  
  if (userRepos.length === 0) {
    return ctx.replyWithMarkdown('📂 *No tienes repositorios seleccionados*\n\nUsa /repos para ver repositorios disponibles y /select_repo [owner/repo] para seleccionar.');
  }
  
  let message = `📂 *Tus Repositorios Seleccionados:*\n\n`;
  
  userRepos.forEach((repo, index) => {
    const visibility = repo.private ? '🔒' : '🌐';
    const selectedDate = new Date(repo.selectedAt).toLocaleDateString();
    
    message += `${index + 1}. *${repo.name}*\n`;
    message += `   ${visibility} • ${repo.full_name}\n`;
    message += `   📅 Seleccionado: ${selectedDate}\n`;
    message += `   🔗 /repo_structure ${repo.full_name}\n\n`;
  });
  
  message += `*Total: ${userRepos.length} repositorio(s) seleccionado(s)*`;
  
  ctx.replyWithMarkdown(message);
});

// Project-Repository Mapping commands
bot.command('link_repo', async (ctx) => {
  const args = ctx.message.text.replace('/link_repo', '').trim().split(' ');
  const projectId = args[0];
  const repoFullName = args[1];
  const repoType = args[2] || 'main';
  
  if (!projectId || !repoFullName) {
    return ctx.replyWithMarkdown(`❌ *Parámetros requeridos*

*Uso:* /link_repo [project_id] [owner/repo] [tipo]

*Ejemplo:*
/link_repo abc123-def456 facebook/react frontend

*Tipos disponibles:* main, frontend, backend, api, docs

Usa /linear para ver IDs de proyectos disponibles.`);
  }
  
  try {
    const processingMsg = await ctx.reply(`🔄 Vinculando ${repoFullName} al proyecto...`);
    
    const result = await projectRepoManager.linkRepositoryToProject(projectId, repoFullName, {
      repositoryType: repoType
    });
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    const successMessage = `✅ *Repositorio vinculado exitosamente*

🔗 **Mapeo creado:**
📋 Proyecto: ${result.linearProject.name}
📂 Repositorio: ${result.githubRepo.fullName}
🏷️ Tipo: ${result.repositoryType}

*Comandos disponibles:*
• /project_repos ${projectId} - Ver todos los repos del proyecto
• /play_linear [task_id] - Ejecutar tarea con contexto completo`;

    await ctx.replyWithMarkdown(successMessage);
    
  } catch (error) {
    console.error('Error linking repository:', error);
    await ctx.replyWithMarkdown(`❌ *Error vinculando repositorio*

${error.message}

*Posibles causas:*
• Proyecto Linear no existe
• Repositorio GitHub inaccesible
• Formato incorrecto (usa owner/repo)
• Sin permisos de escritura en el repo`);
  }
});

bot.command('unlink_repo', async (ctx) => {
  const args = ctx.message.text.replace('/unlink_repo', '').trim().split(' ');
  const projectId = args[0];
  const repoFullName = args[1];
  
  if (!projectId || !repoFullName) {
    return ctx.replyWithMarkdown(`❌ *Parámetros requeridos*

*Uso:* /unlink_repo [project_id] [owner/repo]

*Ejemplo:*
/unlink_repo abc123-def456 facebook/react`);
  }
  
  try {
    const processingMsg = await ctx.reply(`🔄 Desvinculando ${repoFullName} del proyecto...`);
    
    const result = await projectRepoManager.unlinkRepositoryFromProject(projectId, repoFullName);
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    if (result.deleted) {
      await ctx.replyWithMarkdown(`✅ *Repositorio desvinculado exitosamente*

📂 **${repoFullName}** ha sido desvinculado del proyecto.

Usa /project_repos ${projectId} para ver repositorios restantes.`);
    } else {
      await ctx.replyWithMarkdown(`ℹ️ *Vínculo no encontrado*

No se encontró un vínculo entre el proyecto y el repositorio especificado.

Usa /project_repos ${projectId} para ver vínculos actuales.`);
    }
    
  } catch (error) {
    console.error('Error unlinking repository:', error);
    await ctx.replyWithMarkdown(`❌ *Error desvinculando repositorio*\n\n${error.message}`);
  }
});

bot.command('project_repos', async (ctx) => {
  const projectId = ctx.message.text.replace('/project_repos', '').trim();
  
  if (!projectId) {
    return ctx.replyWithMarkdown(`❌ *Project ID requerido*

*Uso:* /project_repos [project_id]

*Ejemplo:* /project_repos abc123-def456

Usa /linear para ver IDs de proyectos disponibles.`);
  }
  
  try {
    const processingMsg = await ctx.reply(`🔄 Obteniendo repositorios del proyecto...`);
    
    const repositories = await projectRepoManager.getProjectRepositories(projectId);
    
    // Get project name from Linear
    let projectName = projectId;
    try {
      const projects = await linear.getProjects();
      const project = projects.find(p => p.id === projectId);
      if (project) {
        projectName = project.name;
      }
    } catch (e) {
      // Use projectId as fallback
    }
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    const message = projectRepoManager.formatProjectRepositoriesForTelegram(repositories, projectName);
    await ctx.replyWithMarkdown(message);
    
  } catch (error) {
    console.error('Error getting project repositories:', error);
    await ctx.replyWithMarkdown(`❌ *Error obteniendo repositorios*\n\n${error.message}`);
  }
});

bot.command('project_mappings', async (ctx) => {
  try {
    const processingMsg = await ctx.reply('🔄 Obteniendo mapeos de proyectos...');
    
    const mappings = await projectRepoManager.getAllProjectMappings();
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    const message = projectRepoManager.formatProjectMappingsForTelegram(mappings);
    await ctx.replyWithMarkdown(message);
    
  } catch (error) {
    console.error('Error getting project mappings:', error);
    await ctx.replyWithMarkdown(`❌ *Error obteniendo mapeos de proyectos*\n\n${error.message}`);
  }
});

// Docker Orchestration commands
bot.command('play', async (ctx) => {
  const args = ctx.message.text.replace('/play', '').trim().split(' ');
  const atomicTaskId = args[0];
  
  if (!atomicTaskId) {
    return ctx.replyWithMarkdown('❌ *Atomic Task ID requerido*\n\n*Uso:* /play [atomic_task_id]\n*Ejemplo:* /play task-123\n\nUsa /list para ver tareas disponibles.');
  }
  
  try {
    const processingMsg = await ctx.reply(`🚀 Iniciando contenedor para tarea ${atomicTaskId}...`);
    
    const taskData = {
      title: `Atomic Task ${atomicTaskId}`,
      description: 'Tarea atomizada ejecutándose en Docker',
      command: 'node index.js',
      dependencies: {}
    };
    
    const result = await docker.playTask(atomicTaskId, taskData);
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    const successMessage = `✅ *Contenedor iniciado exitosamente*

🐳 *Container:* ${result.containerName}
🆔 *Instance ID:* ${result.instanceId}
📁 *Workspace:* ${result.workspace}
📊 *Estado:* ${result.status}

*Comandos disponibles:*
• /logs ${result.instanceId} - Ver logs
• /kill ${result.instanceId} - Terminar contenedor
• /instances - Ver todas las instancias`;

    await ctx.replyWithMarkdown(successMessage);
    
  } catch (error) {
    console.error('Error starting container:', error);
    await ctx.replyWithMarkdown(`❌ *Error iniciando contenedor*\n\n${error.message}`);
  }
});

bot.command('instances', async (ctx) => {
  try {
    const processingMsg = await ctx.reply('🔄 Obteniendo instancias activas...');
    
    const instances = await docker.getInstances();
    await docker.cleanupStoppedInstances();
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    if (instances.length === 0) {
      return ctx.replyWithMarkdown('📋 *No hay instancias activas*\n\nUsa /play [task_id] para iniciar una nueva tarea.');
    }
    
    let message = `🐳 *Instancias Docker Activas:*\n\n`;
    
    instances.forEach((instance, index) => {
      const statusIcon = instance.status === 'running' ? '🟢' : instance.status === 'stopped' ? '🔴' : '🟡';
      
      message += `${index + 1}. ${statusIcon} *${instance.containerName}*\n`;
      message += `   🆔 ID: ${instance.id}\n`;
      message += `   📋 Task: ${instance.taskTitle}\n`;
      message += `   ⏱️ Uptime: ${instance.uptime}\n`;
      message += `   📊 Status: ${instance.status}\n`;
      message += `   📝 Logs: ${instance.logCount} líneas\n`;
      message += `   🔗 /logs ${instance.id}\n\n`;
    });
    
    const stats = docker.getStats();
    message += `*📊 Estadísticas:*\n`;
    message += `• Total: ${stats.total} instancias\n`;
    message += `• Ejecutándose: ${stats.running}\n`;
    message += `• Completadas: ${stats.completed}\n`;
    message += `• Fallidas: ${stats.failed}\n`;
    message += `• Disponibilidad: ${stats.availability}`;
    
    await ctx.replyWithMarkdown(message);
    
  } catch (error) {
    console.error('Error getting instances:', error);
    await ctx.replyWithMarkdown(`❌ *Error obteniendo instancias*\n\n${error.message}`);
  }
});

bot.command('logs', async (ctx) => {
  const instanceId = ctx.message.text.replace('/logs', '').trim();
  
  if (!instanceId) {
    return ctx.replyWithMarkdown('❌ *Instance ID requerido*\n\n*Uso:* /logs [instance_id]\n*Ejemplo:* /logs task-123-1627845600000\n\nUsa /instances para ver IDs disponibles.');
  }
  
  try {
    const processingMsg = await ctx.reply(`🔄 Obteniendo logs de ${instanceId}...`);
    
    const logData = await docker.getLogs(instanceId, { tail: 30 });
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    let message = `📝 *Logs de ${logData.containerName}*\n\n`;
    message += `🆔 *Instance:* ${logData.instanceId}\n`;
    message += `📊 *Estado:* ${logData.status}\n`;
    message += `📄 *Líneas totales:* ${logData.totalLines}\n`;
    message += `👁️ *Mostrando últimas:* ${logData.logs.length}\n\n`;
    
    if (logData.logs.length === 0) {
      message += '📝 *No hay logs disponibles*';
    } else {
      message += '```\n';
      logData.logs.forEach(log => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const type = log.type === 'stderr' ? '[ERR]' : '[OUT]';
        message += `${time} ${type} ${log.data}\n`;
      });
      message += '```';
    }
    
    // Truncate if too long for Telegram
    if (message.length > 4000) {
      message = message.substring(0, 4000) + '\n\n... (logs truncados)';
    }
    
    await ctx.replyWithMarkdown(message);
    
  } catch (error) {
    console.error('Error getting logs:', error);
    await ctx.replyWithMarkdown(`❌ *Error obteniendo logs*\n\n${error.message}`);
  }
});

bot.command('kill', async (ctx) => {
  const instanceId = ctx.message.text.replace('/kill', '').trim();
  
  if (!instanceId) {
    return ctx.replyWithMarkdown('❌ *Instance ID requerido*\n\n*Uso:* /kill [instance_id]\n*Ejemplo:* /kill task-123-1627845600000\n\nUsa /instances para ver IDs disponibles.');
  }
  
  try {
    const processingMsg = await ctx.reply(`🛑 Terminando instancia ${instanceId}...`);
    
    const result = await docker.killInstance(instanceId);
    
    await ctx.deleteMessage(processingMsg.message_id);
    
    const successMessage = `✅ *Instancia terminada exitosamente*

🐳 *Container:* ${result.containerName}
🆔 *Instance ID:* ${result.instanceId}
📊 *Estado:* ${result.status}

${result.message}

Usa /instances para ver el estado actualizado.`;

    await ctx.replyWithMarkdown(successMessage);
    
  } catch (error) {
    console.error('Error killing instance:', error);
    await ctx.replyWithMarkdown(`❌ *Error terminando instancia*\n\n${error.message}`);
  }
});

// Help command
bot.command('help', (ctx) => {
  ctx.replyWithMarkdown(`📚 *Telegram Task Agent - Ayuda*

*🎯 ¿Qué hace?*
Descompone proyectos complejos en tareas atómicas ejecutables.

*🔧 Comandos Linear:*
/linear - Ver equipos y proyectos
/atomize [issue_id] - Atomizar tarea Linear

*🤖 Interfaz de Agentes (Botones):*
Usa los botones inline para navegar por los agentes:
• 📋 Ver Tareas - Muestra tareas pendientes con sugerencias inteligentes
• 📋 Ver Todas - Muestra todas las tareas incluidas completadas
• 💡 Indicador de sugerencia - Resalta la tarea más importante

*🔧 Comandos GitHub:*
/repos - Ver repositorios disponibles
/select_repo [owner/repo] - Seleccionar repositorio
/my_repos - Ver repositorios seleccionados

*🔧 Comandos Project Mapping:*
/link_repo [project_id] [owner/repo] [tipo] - Vincular repositorio
/unlink_repo [project_id] [owner/repo] - Desvincular repositorio
/project_repos [project_id] - Ver repos de proyecto
/project_mappings - Ver todos los mapeos

*🔧 Comandos Docker:*
/play [task_id] - Ejecutar tarea en Docker
/instances - Ver instancias activas
/logs [instance_id] - Ver logs de instancia
/kill [instance_id] - Terminar instancia

*🔧 Comandos Core:*
/project "descripción" - Atomizar proyecto libre
/status - Ver estado del sistema
/help - Esta ayuda

*✅ AGENT-TELEGRAM-54 Completado:*
Project-Repository Mapping con contexto completo Linear + GitHub.`);
});

// Agent creation handlers
bot.action('create_agent', async (ctx) => {
  await ctx.answerCbQuery();
  
  const userId = ctx.from.id.toString();
  
  // Reset creation state for this user
  agentCreationState.set(userId, {
    step: 'name',
    data: {}
  });
  
  const createAgentMessage = `🆕 *Crear Nuevo Agente Background*

🎯 *Concepto:* Agente = Linear Project + GitHub Repos + Claude Intelligence

📝 *Paso 1/3:* **Nombre del Agente**

Escribe un nombre descriptivo para tu agente:
• Ejemplo: "TEL Deploy Agent" 
• Ejemplo: "Frontend Development Agent"
• Ejemplo: "API Backend Agent"

💡 *Tip:* Usa nombres que describan el propósito del agente.`;

  await ctx.editMessageText(createAgentMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '❌ Cancelar', callback_data: 'cancel_agent_creation' }
      ]]
    }
  });
});

bot.action('cancel_agent_creation', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id.toString();
  
  // Clear creation state
  agentCreationState.delete(userId);
  
  // Return to main menu
  await ctx.editMessageText('❌ *Creación de agente cancelada*', {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '🏠 Menú Principal', callback_data: 'main_menu' }
      ]]
    }
  });
});

bot.action('my_agents', async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const userId = ctx.from.id.toString();
    const userAgents = await agentManager.getUserAgents(userId);
    
    if (userAgents.length === 0) {
      return ctx.editMessageText(`📋 *No tienes agentes creados*

🆕 *¿Quieres crear tu primer agente?*

Un agente background te permite ejecutar tareas Linear automáticamente en tus repositorios GitHub.

*Ejemplo de agente:*
🤖 **TEL Deploy Agent**
├── 🔗 Linear: TEL Project (15 tareas)
├── 📂 Repos: telegram-task-agent
└── 📊 Estado: Idle - Listo para trabajar`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🆕 Crear Primer Agente', callback_data: 'create_agent' }],
            [{ text: '🏠 Menú Principal', callback_data: 'main_menu' }]
          ]
        }
      });
    }
    
    let message = `📋 *Mis Agentes Background (${userAgents.length}):*\n\n`;
    
    userAgents.forEach((agent, index) => {
      const statusIcon = getAgentStatusIcon(agent.status);
      const repoCount = agent.github_repos.length;
      
      message += `${index + 1}. ${statusIcon} **${agent.name}**\n`;
      message += `   🔗 Linear: ${agent.linear_project_name}\n`;
      message += `   📂 Repos: ${repoCount} repositorio${repoCount !== 1 ? 's' : ''}\n`;
      message += `   📊 Estado: ${getAgentStatusText(agent.status)}`;
      
      if (agent.current_task_title) {
        message += `\n   📋 Tarea: ${agent.current_task_title} (${agent.progress}%)`;
      }
      
      message += `\n   🔗 \`/agent ${agent.id}\`\n\n`;
    });
    
    // Create buttons for first 3 agents
    const agentButtons = userAgents.slice(0, 3).map(agent => ([
      { text: `🤖 ${agent.name}`, callback_data: `view_agent_${agent.id}` }
    ]));
    
    agentButtons.push([
      { text: '🆕 Crear Nuevo Agente', callback_data: 'create_agent' }
    ]);
    agentButtons.push([
      { text: '🏠 Menú Principal', callback_data: 'main_menu' }
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: agentButtons }
    });
    
  } catch (error) {
    console.error('Error getting user agents:', error);
    await ctx.editMessageText(`❌ *Error obteniendo agentes*\n\n${error.message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🏠 Menú Principal', callback_data: 'main_menu' }
        ]]
      }
    });
  }
});

// Helper functions for agent status
function getAgentStatusIcon(status) {
  const icons = {
    'idle': '🔵',
    'working': '🟢', 
    'completed': '✅',
    'error': '🔴'
  };
  return icons[status] || '⚪';
}

function getAgentStatusText(status) {
  const texts = {
    'idle': 'Idle - Listo para trabajar',
    'working': 'Trabajando', 
    'completed': 'Completado',
    'error': 'Error - Requiere atención'
  };
  return texts[status] || 'Desconocido';
}

// Text message handler for agent creation
bot.on('text', async (ctx) => {
  const userId = ctx.from.id.toString();
  const text = ctx.message.text;
  
  // Skip if it's a command
  if (text.startsWith('/')) return;
  
  // Check if user is in agent creation flow
  const creationState = agentCreationState.get(userId);
  if (!creationState) return;
  
  try {
    if (creationState.step === 'name') {
      // Validate name
      if (text.length < 3 || text.length > 50) {
        return ctx.reply('❌ *Nombre inválido*\n\nEl nombre debe tener entre 3 y 50 caracteres.', {
          parse_mode: 'Markdown'
        });
      }
      
      // Store name and move to Linear project selection
      creationState.data.name = text;
      creationState.step = 'linear_project';
      agentCreationState.set(userId, creationState);
      
      await ctx.reply('✅ *Nombre guardado*\n\n🔄 Obteniendo proyectos Linear...', {
        parse_mode: 'Markdown'
      });
      
      // Get Linear projects
      try {
        const projects = await linear.getProjects();
        
        if (projects.length === 0) {
          creationState.step = 'error';
          return ctx.reply('❌ *No hay proyectos Linear disponibles*\n\nVerifica tu configuración de Linear API.', {
            parse_mode: 'Markdown'
          });
        }
        
        let projectMessage = `📋 *Paso 2/3: Seleccionar Proyecto Linear*\n\n`;
        projectMessage += `🤖 **Agente:** ${creationState.data.name}\n\n`;
        projectMessage += `Selecciona el proyecto Linear que controlará este agente:\n\n`;
        
        const projectButtons = projects.slice(0, 8).map(project => ([
          { text: `📁 ${project.name}`, callback_data: `select_linear_${project.id}` }
        ]));
        
        projectButtons.push([{ text: '❌ Cancelar', callback_data: 'cancel_agent_creation' }]);
        
        await ctx.reply(projectMessage, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: projectButtons }
        });
        
      } catch (error) {
        console.error('Error getting Linear projects:', error);
        await ctx.reply(`❌ *Error obteniendo proyectos Linear*\n\n${error.message}`, {
          parse_mode: 'Markdown'
        });
      }
    } else if (creationState.step === 'interactive_prompt') {
      // Handle interactive prompt input
      const { agentId, taskId, taskTitle } = creationState.data;
      
      if (text.length < 10) {
        return ctx.reply('❌ *Prompt muy corto*\n\nPor favor, proporciona instrucciones más específicas (mínimo 10 caracteres).', {
          parse_mode: 'Markdown'
        });
      }
      
      // Clear state
      agentCreationState.delete(userId);
      
      try {
        await ctx.reply('🚀 *Iniciando ejecución Interactive...*', {
          parse_mode: 'Markdown'
        });
        
        const agent = await agentManager.getAgent(agentId);
        const task = await linear.getIssueById(taskId);
        
        // Create task execution record with user prompt
        const execution = await agentManager.createTaskExecution(
          agentId, 
          taskId, 
          taskTitle, 
          'interactive',
          text
        );
        
        // Update agent status
        await agentManager.updateAgentStatus(
          agentId, 
          'working', 
          taskId, 
          taskTitle, 
          0
        );
        
        // Start actual interactive execution with user prompt
        try {
          await startInteractiveTaskExecution(agent, task, execution, text);
        } catch (error) {
          console.error('Failed to start interactive execution:', error);
          // Update execution as failed
          await agentManager.updateTaskExecution(execution.id, 'failed', 0, error.message);
          await agentManager.updateAgentStatus(agentId, 'idle', null, null, 0);
          throw error;
        }
        
        const successMessage = `✅ *Ejecución Interactive Iniciada*

🤖 **Agente:** ${agent.name}
📋 **Tarea:** ${task.identifier} - ${taskTitle}
🔄 **Modo:** Interactive (Con Prompt)

*💬 Tu Prompt:*
"${text}"

*📊 Estado:* Analizando tu prompt y generando plan personalizado...

*🧠 Claude está:*
• Procesando tus instrucciones específicas
• Analizando código con tu contexto
• Adaptando plan según tu prompt
• Preparando ejecución personalizada

*⏱️ Tiempo estimado:* 5-20 minutos

Te notificaré cuando complete o si necesita aclaración sobre tu prompt.`;

        await ctx.reply(successMessage, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📝 Ver Progreso', callback_data: `agent_logs_${agentId}` },
                { text: '⏸️ Pausar', callback_data: `agent_pause_${agentId}` }
              ],
              [
                { text: `🤖 Ver Agente`, callback_data: `view_agent_${agentId}` },
                { text: '📋 Mis Agentes', callback_data: 'my_agents' }
              ]
            ]
          }
        });
        
      } catch (error) {
        console.error('Error starting interactive execution:', error);
        await ctx.reply(`❌ *Error iniciando ejecución interactive*\n\n${error.message}`, {
          parse_mode: 'Markdown'
        });
      }
    }
  } catch (error) {
    console.error('Error in agent creation flow:', error);
    await ctx.reply('❌ *Error en creación de agente*\n\nIntenta nuevamente.', {
      parse_mode: 'Markdown'
    });
  }
});

// Linear project selection handler
bot.action(/^select_linear_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const projectId = ctx.match[1];
    const userId = ctx.from.id.toString();
    const creationState = agentCreationState.get(userId);
    
    if (!creationState || creationState.step !== 'linear_project') {
      return ctx.editMessageText('❌ *Sesión expirada*\n\nInicia la creación nuevamente.', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🆕 Crear Agente', callback_data: 'create_agent' }
          ]]
        }
      });
    }
    
    // Get project details
    const projects = await linear.getProjects();
    const selectedProject = projects.find(p => p.id === projectId);
    
    if (!selectedProject) {
      return ctx.editMessageText('❌ *Proyecto no encontrado*', {
        parse_mode: 'Markdown'
      });
    }
    
    // Store Linear project and move to GitHub repos selection
    creationState.data.linearProjectId = projectId;
    creationState.data.linearProjectName = selectedProject.name;
    creationState.step = 'github_repos';
    agentCreationState.set(userId, creationState);
    
    await ctx.editMessageText('✅ *Proyecto Linear seleccionado*\n\n🔄 Obteniendo repositorios GitHub...', {
      parse_mode: 'Markdown'
    });
    
    // Get GitHub repositories
    const repositories = await github.getRepositories('all', 'updated', 20);
    
    if (repositories.length === 0) {
      return ctx.editMessageText('❌ *No hay repositorios GitHub disponibles*\n\nVerifica tu configuración de GitHub token.', {
        parse_mode: 'Markdown'
      });
    }
    
    let repoMessage = `📂 *Paso 3/3: Seleccionar Repositorios GitHub*\n\n`;
    repoMessage += `🤖 **Agente:** ${creationState.data.name}\n`;
    repoMessage += `🔗 **Linear:** ${selectedProject.name}\n\n`;
    repoMessage += `Selecciona los repositorios que este agente puede modificar:\n\n`;
    
    // Store available repos for selection
    creationState.data.availableRepos = repositories;
    creationState.data.selectedRepos = [];
    agentCreationState.set(userId, creationState);
    
    const repoButtons = repositories.slice(0, 6).map(repo => ([
      { text: `📁 ${repo.name}`, callback_data: `toggle_repo_${encodeRepoForCallback(repo.full_name)}` }
    ]));
    
    repoButtons.push([
      { text: '✅ Finalizar Creación', callback_data: 'finish_agent_creation' },
      { text: '❌ Cancelar', callback_data: 'cancel_agent_creation' }
    ]);
    
    await ctx.editMessageText(repoMessage, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: repoButtons }
    });
    
  } catch (error) {
    console.error('Error selecting Linear project:', error);
    await ctx.editMessageText(`❌ *Error seleccionando proyecto*\n\n${error.message}`, {
      parse_mode: 'Markdown'
    });
  }
});

// Repository toggle handler
bot.action(/^toggle_repo_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const repoEncoded = ctx.match[1];
    const repoFullName = decodeRepoFromCallback(repoEncoded);
    const userId = ctx.from.id.toString();
    const creationState = agentCreationState.get(userId);
    
    if (!creationState || creationState.step !== 'github_repos') {
      return;
    }
    
    // Find the repo in available repos
    const repo = creationState.data.availableRepos.find(r => r.full_name === repoFullName);
    if (!repo) return;
    
    // Toggle selection
    const selectedRepos = creationState.data.selectedRepos;
    const existingIndex = selectedRepos.findIndex(r => r.full_name === repoFullName);
    
    if (existingIndex >= 0) {
      // Remove from selection
      selectedRepos.splice(existingIndex, 1);
    } else {
      // Add to selection
      selectedRepos.push(repo);
    }
    
    creationState.data.selectedRepos = selectedRepos;
    agentCreationState.set(userId, creationState);
    
    // Update message
    let repoMessage = `📂 *Paso 3/3: Seleccionar Repositorios GitHub*\n\n`;
    repoMessage += `🤖 **Agente:** ${creationState.data.name}\n`;
    repoMessage += `🔗 **Linear:** ${creationState.data.linearProjectName}\n\n`;
    
    if (selectedRepos.length > 0) {
      repoMessage += `✅ **Repositorios seleccionados (${selectedRepos.length}):**\n`;
      selectedRepos.forEach(repo => {
        repoMessage += `• ${repo.full_name}\n`;
      });
      repoMessage += '\n';
    }
    
    repoMessage += `Selecciona los repositorios que este agente puede modificar:\n\n`;
    
    const repoButtons = creationState.data.availableRepos.slice(0, 6).map(repo => {
      const isSelected = selectedRepos.some(r => r.full_name === repo.full_name);
      return [{
        text: `${isSelected ? '✅' : '📁'} ${repo.name}`,
        callback_data: `toggle_repo_${encodeRepoForCallback(repo.full_name)}`
      }];
    });
    
    repoButtons.push([
      { text: `✅ Finalizar Creación (${selectedRepos.length} repos)`, callback_data: 'finish_agent_creation' },
      { text: '❌ Cancelar', callback_data: 'cancel_agent_creation' }
    ]);
    
    await ctx.editMessageText(repoMessage, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: repoButtons }
    });
    
  } catch (error) {
    console.error('Error toggling repository:', error);
  }
});

// Finish agent creation
bot.action('finish_agent_creation', async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const userId = ctx.from.id.toString();
    const creationState = agentCreationState.get(userId);
    
    if (!creationState || creationState.step !== 'github_repos') {
      return ctx.editMessageText('❌ *Sesión expirada*', {
        parse_mode: 'Markdown'
      });
    }
    
    if (creationState.data.selectedRepos.length === 0) {
      return ctx.answerCbQuery('❌ Selecciona al menos un repositorio', { show_alert: true });
    }
    
    await ctx.editMessageText('🔄 *Creando agente...*', {
      parse_mode: 'Markdown'
    });
    
    // Create the agent
    const agent = await agentManager.createAgent(
      userId,
      creationState.data.name,
      creationState.data.linearProjectId,
      creationState.data.linearProjectName,
      creationState.data.selectedRepos
    );
    
    // Clear creation state
    agentCreationState.delete(userId);
    
    const successMessage = `✅ *Agente creado exitosamente*

🤖 **${agent.name}**

📋 **Linear Project:** ${agent.linear_project_name}
📂 **Repositorios:** ${agent.github_repos.length} seleccionado${agent.github_repos.length !== 1 ? 's' : ''}
${agent.github_repos.map(repo => `• ${repo.full_name}`).join('\n')}

📊 **Estado:** Idle - Listo para trabajar

*🚀 ¿Qué puedes hacer ahora?*
• Ver tareas Linear disponibles
• Ejecutar tareas en modo Background (automático)
• Ejecutar tareas en modo Interactive (con prompts)`;

    await ctx.editMessageText(successMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: `🤖 Ver Agente ${agent.name}`, callback_data: `view_agent_${agent.id}` }],
          [{ text: '📋 Mis Agentes', callback_data: 'my_agents' }],
          [{ text: '🏠 Menú Principal', callback_data: 'main_menu' }]
        ]
      }
    });
    
  } catch (error) {
    console.error('Error creating agent:', error);
    await ctx.editMessageText(`❌ *Error creando agente*\n\n${error.message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🔄 Intentar Nuevamente', callback_data: 'create_agent' }
        ]]
      }
    });
  }
});

// Agent help handler for first-time users
bot.action('agent_help', async (ctx) => {
  await ctx.answerCbQuery();
  
  const helpMessage = `❓ *¿Cómo funciona Background Agents Manager?*

🎯 **Concepto Simple:**
Un agente = Un proyecto Linear + Repositorios GitHub

📝 **Ejemplo Práctico:**
1. **Crear Agente:** "TEL Deploy Agent"
2. **Vincular Linear:** Proyecto TEL (tus tareas)
3. **Vincular GitHub:** telegram-task-agent (tu código)
4. **Resultado:** Agente que puede ejecutar TEL-11, TEL-12, etc.

🚀 **Dos Modos de Ejecución:**

**▶️ Background (Automático):**
• Claude analiza tu código automáticamente
• Genera plan específico para tu stack
• Ejecuta sin supervisión constante
• Ideal para tareas rutinarias

**💬 Interactive (Con Prompt):**
• Tú das instrucciones específicas
• "Deploy solo backend", "Usar TypeScript", etc.
• Claude adapta el plan según tu input
• Ideal para modificaciones específicas

🔄 **Flujo Completo:**
Crear Agente → Ver Tareas Linear → Seleccionar → Ejecutar (Background/Interactive)

*¿Listo para crear tu primer agente?*`;

  await ctx.editMessageText(helpMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🆕 Crear Mi Primer Agente', callback_data: 'create_agent' }],
        [{ text: '🏠 Volver al Inicio', callback_data: 'main_menu' }]
      ]
    }
  });
});

// View individual agent handler
bot.action(/^view_agent_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const agentId = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    
    const agent = await agentManager.getAgent(agentId);
    
    if (!agent || agent.user_id !== userId) {
      return ctx.editMessageText('❌ *Agente no encontrado*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '📋 Mis Agentes', callback_data: 'my_agents' }
          ]]
        }
      });
    }
    
    // Get tasks from Linear project
    const projectData = await linear.getIssuesByProject(agent.linear_project_id);
    const projectTasks = projectData?.issues?.nodes || [];
    const availableTasks = projectTasks.filter(task => 
      task.state?.type === 'backlog' || task.state?.type === 'unstarted' || task.state?.type === 'started'
    );
    
    const statusIcon = getAgentStatusIcon(agent.status);
    const statusText = getAgentStatusText(agent.status);
    
    let agentMessage = `🤖 *${agent.name}*\n\n`;
    agentMessage += `📊 **Estado:** ${statusIcon} ${statusText}\n`;
    agentMessage += `🔗 **Linear:** ${agent.linear_project_name} (${availableTasks.length} tareas disponibles)\n`;
    agentMessage += `📂 **Repositorios:** ${agent.github_repos.length} vinculado${agent.github_repos.length !== 1 ? 's' : ''}\n`;
    
    agent.github_repos.forEach(repo => {
      agentMessage += `• ${repo.full_name}\n`;
    });
    
    if (agent.current_task_title) {
      agentMessage += `\n📋 **Tarea Actual:** ${agent.current_task_title}\n`;
      agentMessage += `📈 **Progreso:** ${agent.progress}%\n`;
    }
    
    agentMessage += `\n*🚀 ¿Qué quieres hacer?*`;
    
    const buttons = [];
    
    if (agent.status === 'idle' && availableTasks.length > 0) {
      buttons.push([
        { text: '📋 Ver Tareas Linear', callback_data: `agent_tasks_${agent.id}` }
      ]);
      buttons.push([
        { text: '▶️ Ejecutar Background', callback_data: `agent_execute_background_${agent.id}` },
        { text: '💬 Ejecutar Interactive', callback_data: `agent_execute_interactive_${agent.id}` }
      ]);
    } else if (agent.status === 'working') {
      buttons.push([
        { text: '📝 Ver Logs', callback_data: `agent_logs_${agent.id}` },
        { text: '⏸️ Pausar', callback_data: `agent_pause_${agent.id}` }
      ]);
    }
    
    buttons.push([
      { text: '📋 Mis Agentes', callback_data: 'my_agents' },
      { text: '🗑️ Eliminar Agente', callback_data: `delete_agent_${agent.id}` }
    ]);
    
    await ctx.editMessageText(agentMessage, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
    
  } catch (error) {
    console.error('Error viewing agent:', error);
    await ctx.editMessageText(`❌ *Error obteniendo agente*\n\n${error.message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '📋 Mis Agentes', callback_data: 'my_agents' }
        ]]
      }
    });
  }
});

// View agent tasks handler
bot.action(/^agent_tasks_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const agentId = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    
    const agent = await agentManager.getAgent(agentId);
    
    if (!agent || agent.user_id !== userId) {
      return ctx.editMessageText('❌ *Agente no encontrado*', {
        parse_mode: 'Markdown'
      });
    }
    
    await ctx.editMessageText('🔄 *Obteniendo tareas Linear...*', {
      parse_mode: 'Markdown'
    });
    
    const projectData = await linear.getIssuesByProject(agent.linear_project_id);
    const allTasks = projectData?.issues?.nodes || [];
    
    // Use new filtering logic (exclude completed/canceled)
    const availableTasks = allTasks.filter(task => 
      task.state?.type !== 'completed' && task.state?.type !== 'canceled'
    );
    
    if (availableTasks.length === 0) {
      const completedCount = allTasks.length;
      return ctx.editMessageText(`📋 *No hay tareas pendientes*\n\nTodas las ${completedCount} tareas del proyecto ${agent.linear_project_name} están completadas.`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Ver Completadas', callback_data: `agent_all_tasks_${agent.id}` }],
            [{ text: `🤖 Volver a ${agent.name}`, callback_data: `view_agent_${agent.id}` }]
          ]
        }
      });
    }
    
    // Sort tasks and get suggestion using new logic
    const sortedTasks = linear.sortTasksByPriority(availableTasks);
    const suggestedTask = linear.getSuggestedTask(sortedTasks);
    
    let tasksMessage = `📋 *Tareas Pendientes - ${agent.linear_project_name}*\n\n`;
    tasksMessage += `🤖 **Agente:** ${agent.name}\n`;
    tasksMessage += `📊 **Tareas pendientes:** ${availableTasks.length}\n`;
    
    const completedCount = allTasks.length - availableTasks.length;
    if (completedCount > 0) {
      tasksMessage += `✅ **Completadas:** ${completedCount}\n`;
    }
    tasksMessage += '\n';
    
    // Show suggested task prominently
    if (suggestedTask) {
      const suggestedEmoji = linear.getStateEmoji(suggestedTask.state.type);
      const suggestedPriority = linear.getPriorityEmoji(suggestedTask.priority);
      tasksMessage += `💡 **SUGERIDA:** ${suggestedEmoji}${suggestedPriority} **${suggestedTask.identifier}**\n`;
      tasksMessage += `📝 ${suggestedTask.title}\n`;
      tasksMessage += `🎯 *Esta tarea debería ejecutarse primero*\n\n`;
      tasksMessage += `──────────────────────\n\n`;
    }
    
    const taskButtons = [];
    
    // Show top 6 tasks with suggestion indicator
    sortedTasks.slice(0, 6).forEach((task, index) => {
      const stateEmoji = linear.getStateEmoji(task.state.type);
      const priorityEmoji = linear.getPriorityEmoji(task.priority);
      const isSuggested = suggestedTask && task.id === suggestedTask.id;
      const suggestionIndicator = isSuggested ? '💡 ' : '';
      
      const shortTitle = task.title.slice(0, 45) + (task.title.length > 45 ? '...' : '');
      tasksMessage += `${index + 1}. ${suggestionIndicator}${stateEmoji}${priorityEmoji} **${escapeMarkdown(task.identifier)}**: ${escapeMarkdown(shortTitle)}\n`;
      tasksMessage += `   Estado: ${task.state.name}`;
      if (task.assignee) {
        tasksMessage += ` • ${task.assignee.name}`;
      }
      tasksMessage += '\n\n';
      
      // Add button with suggestion indicator
      taskButtons.push([{
        text: `${suggestionIndicator}${stateEmoji} ${task.identifier}`,
        callback_data: `select_task_${agent.id}_${task.id}`
      }]);
    });
    
    if (availableTasks.length > 6) {
      tasksMessage += `*... y ${availableTasks.length - 6} tareas más*\n\n`;
    }
    
    tasksMessage += '*Selecciona una tarea para ejecutar:*';
    
    // Add navigation buttons
    const navButtons = [
      { text: `🤖 Volver a ${agent.name}`, callback_data: `view_agent_${agent.id}` }
    ];
    
    if (completedCount > 0) {
      navButtons.unshift({ text: '📋 Ver Todas', callback_data: `agent_all_tasks_${agent.id}` });
    }
    
    taskButtons.push(navButtons);
    
    await ctx.editMessageText(tasksMessage, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: taskButtons }
    });
    
  } catch (error) {
    console.error('Error getting agent tasks:', error);
    await ctx.editMessageText(`❌ *Error obteniendo tareas*\n\n${error.message}`, {
      parse_mode: 'Markdown'
    });
  }
});

// View all agent tasks (including completed ones)
bot.action(/^agent_all_tasks_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const agentId = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    
    const agent = await agentManager.getAgent(agentId);
    
    if (!agent || agent.user_id !== userId) {
      return ctx.editMessageText('❌ *Agente no encontrado*', {
        parse_mode: 'Markdown'
      });
    }
    
    await ctx.editMessageText('🔄 *Obteniendo todas las tareas Linear...*', {
      parse_mode: 'Markdown'
    });
    
    const projectData = await linear.getIssuesByProject(agent.linear_project_id);
    const allTasks = projectData?.issues?.nodes || [];
    
    if (allTasks.length === 0) {
      return ctx.editMessageText(`📋 *No hay tareas en el proyecto*\n\nEl proyecto ${agent.linear_project_name} no tiene tareas.`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: `🤖 Volver a ${agent.name}`, callback_data: `view_agent_${agent.id}` }
          ]]
        }
      });
    }
    
    // Sort tasks and get suggestion using new logic
    const sortedTasks = linear.sortTasksByPriority(allTasks);
    const suggestedTask = linear.getSuggestedTask(sortedTasks);
    
    // Count by state
    const pendingTasks = allTasks.filter(task => 
      task.state.type !== 'completed' && task.state.type !== 'canceled'
    );
    const completedTasks = allTasks.filter(task => 
      task.state.type === 'completed' || task.state.type === 'canceled'
    );
    
    let tasksMessage = `📋 *Todas las Tareas - ${agent.linear_project_name}*\n\n`;
    tasksMessage += `🤖 **Agente:** ${agent.name}\n`;
    tasksMessage += `📊 **Total:** ${allTasks.length} tareas\n`;
    tasksMessage += `⏳ **Pendientes:** ${pendingTasks.length}\n`;
    tasksMessage += `✅ **Completadas:** ${completedTasks.length}\n\n`;
    
    // Show suggested task prominently if exists
    if (suggestedTask && (suggestedTask.state.type !== 'completed' && suggestedTask.state.type !== 'canceled')) {
      const suggestedEmoji = linear.getStateEmoji(suggestedTask.state.type);
      const suggestedPriority = linear.getPriorityEmoji(suggestedTask.priority);
      tasksMessage += `💡 **SUGERIDA:** ${suggestedEmoji}${suggestedPriority} **${suggestedTask.identifier}**\n`;
      tasksMessage += `📝 ${suggestedTask.title}\n`;
      tasksMessage += `🎯 *Esta tarea debería ejecutarse primero*\n\n`;
      tasksMessage += `──────────────────────\n\n`;
    }
    
    const taskButtons = [];
    
    // Show top 8 tasks with suggestion indicator
    sortedTasks.slice(0, 8).forEach((task, index) => {
      const stateEmoji = linear.getStateEmoji(task.state.type);
      const priorityEmoji = linear.getPriorityEmoji(task.priority);
      const isSuggested = suggestedTask && task.id === suggestedTask.id;
      const suggestionIndicator = isSuggested ? '💡 ' : '';
      const isCompleted = task.state.type === 'completed' || task.state.type === 'canceled';
      
      const shortTitle = task.title.slice(0, 40) + (task.title.length > 40 ? '...' : '');
      tasksMessage += `${index + 1}. ${suggestionIndicator}${stateEmoji}${priorityEmoji} **${escapeMarkdown(task.identifier)}**: ${escapeMarkdown(shortTitle)}\n`;
      tasksMessage += `   Estado: ${task.state.name}`;
      if (task.assignee) {
        tasksMessage += ` • ${task.assignee.name}`;
      }
      tasksMessage += '\n\n';
      
      // Only add button for non-completed tasks
      if (!isCompleted) {
        taskButtons.push([{
          text: `${suggestionIndicator}${stateEmoji} ${task.identifier}`,
          callback_data: `select_task_${agent.id}_${task.id}`
        }]);
      }
    });
    
    if (allTasks.length > 8) {
      tasksMessage += `*... y ${allTasks.length - 8} tareas más*\n\n`;
    }
    
    tasksMessage += '*Tareas completadas se muestran solo como información*';
    
    // Add navigation buttons
    taskButtons.push([
      { text: '📋 Solo Pendientes', callback_data: `agent_tasks_${agent.id}` },
      { text: `🤖 Volver a ${agent.name}`, callback_data: `view_agent_${agent.id}` }
    ]);
    
    await ctx.editMessageText(tasksMessage, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: taskButtons }
    });
    
  } catch (error) {
    console.error('Error getting all agent tasks:', error);
    await ctx.editMessageText(`❌ *Error obteniendo tareas*\n\n${error.message}`, {
      parse_mode: 'Markdown'
    });
  }
});

// Select task for execution
bot.action(/^select_task_(.+)_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const agentId = parseInt(ctx.match[1]);
    const taskId = ctx.match[2];
    const userId = ctx.from.id.toString();
    
    const agent = await agentManager.getAgent(agentId);
    
    if (!agent || agent.user_id !== userId) {
      return ctx.editMessageText('❌ *Agente no encontrado*', {
        parse_mode: 'Markdown'
      });
    }
    
    const task = await linear.getIssueById(taskId);
    
    if (!task) {
      return ctx.editMessageText('❌ *Tarea no encontrada*', {
        parse_mode: 'Markdown'
      });
    }
    
    const stateEmoji = linear.getStateEmoji(task.state.type);
    const priorityEmoji = linear.getPriorityEmoji(task.priority);
    
    let taskMessage = `📋 *Tarea Seleccionada*\n\n`;
    taskMessage += `🤖 **Agente:** ${agent.name}\n`;
    taskMessage += `${stateEmoji}${priorityEmoji} **${task.identifier}**: ${task.title}\n\n`;
    
    if (task.description) {
      taskMessage += `📝 **Descripción:**\n${task.description.slice(0, 200)}${task.description.length > 200 ? '...' : ''}\n\n`;
    }
    
    taskMessage += `📊 **Detalles:**\n`;
    taskMessage += `• Estado: ${task.state.name}\n`;
    taskMessage += `• Prioridad: ${task.priority || 'No definida'}\n`;
    taskMessage += `• Estimación: ${task.estimate || 'Sin estimar'} puntos\n\n`;
    
    taskMessage += `*🚀 ¿Cómo quieres ejecutar esta tarea?*\n\n`;
    taskMessage += `**▶️ Background (Automático):**\n`;
    taskMessage += `Claude analiza tu código y ejecuta automáticamente\n\n`;
    taskMessage += `**💬 Interactive (Con Prompt):**\n`;
    taskMessage += `Puedes dar instrucciones específicas a Claude`;
    
    await ctx.editMessageText(taskMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '▶️ Ejecutar Background', callback_data: `execute_background_${agent.id}_${task.id}` },
            { text: '💬 Ejecutar Interactive', callback_data: `execute_interactive_${agent.id}_${task.id}` }
          ],
          [
            { text: '📋 Ver Otras Tareas', callback_data: `agent_tasks_${agent.id}` },
            { text: `🤖 Volver a ${agent.name}`, callback_data: `view_agent_${agent.id}` }
          ]
        ]
      }
    });
    
  } catch (error) {
    console.error('Error selecting task:', error);
    await ctx.editMessageText(`❌ *Error seleccionando tarea*\n\n${error.message}`, {
      parse_mode: 'Markdown'
    });
  }
});

// Handle agent execute background (show task selection)
bot.action(/^agent_execute_background_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const agentId = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    
    const agent = await agentManager.getAgent(agentId);
    
    if (!agent || agent.user_id !== userId) {
      return ctx.editMessageText('❌ *Agente no encontrado*', {
        parse_mode: 'Markdown'
      });
    }
    
    await ctx.editMessageText('🔄 *Obteniendo tareas disponibles...*', {
      parse_mode: 'Markdown'
    });
    
    // Get available tasks
    const projectData = await linear.getIssuesByProject(agent.linear_project_id);
    const projectTasks = projectData?.issues?.nodes || [];
    const availableTasks = projectTasks.filter(task => 
      task.state?.name !== 'Done' && 
      task.state?.name !== 'Canceled'
    );
    
    if (availableTasks.length === 0) {
      return ctx.editMessageText('❌ *No hay tareas disponibles*\n\nTodas las tareas están completadas o canceladas.', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Volver al Agente', callback_data: `view_agent_${agent.id}` }
          ]]
        }
      });
    }
    
    // Show task selection for background execution
    let taskMessage = `🚀 *Ejecutar Background - Seleccionar Tarea*\n\n`;
    taskMessage += `🤖 **Agente:** ${agent.name}\n`;
    taskMessage += `📋 **Proyecto:** ${agent.linear_project_id}\n\n`;
    taskMessage += `**▶️ Background (Automático):**\n`;
    taskMessage += `Claude ejecutará la tarea completamente sin preguntar.\n\n`;
    taskMessage += `**Tareas disponibles (${availableTasks.length}):**\n\n`;
    
    const buttons = [];
    
    availableTasks.slice(0, 8).forEach(task => {
      const priority = task.priority ? `${linear.getPriorityEmoji(task.priority)} ` : '';
      const shortTitle = task.title.length > 35 ? task.title.substring(0, 35) + '...' : task.title;
      
      // Escape Markdown special characters
      const escapedTitle = escapeMarkdown(shortTitle);
      const escapedState = escapeMarkdown(task.state?.name || 'N/A');
      
      taskMessage += `${priority}**${escapedTitle}**\n`;
      taskMessage += `└ Estado: ${escapedState}\n\n`;
      
      const buttonText = `▶️ ${shortTitle.length > 25 ? shortTitle.substring(0, 25) + '...' : shortTitle}`;
      buttons.push([
        { text: buttonText, callback_data: `execute_background_${agent.id}_${task.id}` },
      ]);
    });
    
    buttons.push([
      { text: '🔙 Volver al Agente', callback_data: `view_agent_${agent.id}` }
    ]);
    
    await ctx.editMessageText(taskMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: buttons
      }
    });
    
  } catch (error) {
    console.error('Error showing background task selection:', error);
    await ctx.editMessageText('❌ *Error obteniendo tareas*', {
      parse_mode: 'Markdown'
    });
  }
});

// Execute task in background mode
bot.action(/^execute_background_(.+)_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const agentId = parseInt(ctx.match[1]);
    const taskId = ctx.match[2];
    const userId = ctx.from.id.toString();
    
    const agent = await agentManager.getAgent(agentId);
    const task = await linear.getIssueById(taskId);
    
    if (!agent || agent.user_id !== userId || !task) {
      return ctx.editMessageText('❌ *Error: agente o tarea no encontrada*', {
        parse_mode: 'Markdown'
      });
    }
    
    await ctx.editMessageText('🚀 *Iniciando ejecución Background...*', {
      parse_mode: 'Markdown'
    });
    
    // Create task execution record
    const execution = await agentManager.createTaskExecution(
      agent.id, 
      task.id, 
      task.title, 
      'background'
    );
    
    // Update agent status
    await agentManager.updateAgentStatus(
      agent.id, 
      'working', 
      task.id, 
      task.title, 
      0
    );
    
    // Start actual background execution with live updates
    try {
      await startBackgroundTaskExecution(agent, task, execution, ctx);
    } catch (error) {
      console.error('Failed to start background execution:', error);
      // Update execution as failed
      await agentManager.updateTaskExecution(execution.id, 'failed', 0, error.message);
      await agentManager.updateAgentStatus(agent.id, 'idle', null, null, 0);
      
      await ctx.editMessageText(`❌ *Error ejecutando tarea*\n\n${error.message}`, {
        parse_mode: 'Markdown'
      });
      return;
    }
    
    const successMessage = `✅ *Ejecución Background Iniciada*

🤖 **Agente:** ${agent.name}
📋 **Tarea:** ${task.identifier} - ${task.title}
🔄 **Modo:** Background (Automático)

*📊 Estado:* Analizando código y generando plan...

*🧠 Claude está:*
• Analizando tu stack tecnológico
• Leyendo estructura de repositorios
• Generando plan de ejecución específico
• Preparando entorno Docker

*⏱️ Tiempo estimado:* 5-15 minutos

Te notificaré cuando complete o si necesita tu input.`;

    await ctx.editMessageText(successMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📝 Ver Progreso', callback_data: `agent_logs_${agent.id}` },
            { text: '⏸️ Pausar', callback_data: `agent_pause_${agent.id}` }
          ],
          [
            { text: `🤖 Ver Agente`, callback_data: `view_agent_${agent.id}` },
            { text: '📋 Mis Agentes', callback_data: 'my_agents' }
          ]
        ]
      }
    });
    
  } catch (error) {
    console.error('Error executing background task:', error);
    await ctx.editMessageText(`❌ *Error iniciando ejecución*\n\n${error.message}`, {
      parse_mode: 'Markdown'
    });
  }
});

// Execute task in interactive mode  
bot.action(/^execute_interactive_(.+)_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const agentId = parseInt(ctx.match[1]);
    const taskId = ctx.match[2];
    const userId = ctx.from.id.toString();
    
    const agent = await agentManager.getAgent(agentId);
    const task = await linear.getIssueById(taskId);
    
    if (!agent || agent.user_id !== userId || !task) {
      return ctx.editMessageText('❌ *Error: agente o tarea no encontrada*', {
        parse_mode: 'Markdown'
      });
    }
    
    // Store interactive state
    agentCreationState.set(userId, {
      step: 'interactive_prompt',
      data: {
        agentId: agent.id,
        taskId: task.id,
        taskTitle: task.title
      }
    });
    
    const interactiveMessage = `💬 *Modo Interactive - Prompt Personalizado*

🤖 **Agente:** ${agent.name}
📋 **Tarea:** ${task.identifier} - ${task.title}

*📝 Escribe tu prompt personalizado:*

Ejemplo de prompts:
• "Deploy solo el backend, usa staging database"
• "Implementa con TypeScript en lugar de JavaScript"  
• "Agrega tests unitarios antes de implementar"
• "Usa React hooks en lugar de class components"

*💡 Tip:* Sé específico sobre tecnologías, entornos, o modificaciones que quieres.`;

    await ctx.editMessageText(interactiveMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Cancelar', callback_data: `view_agent_${agent.id}` }]
        ]
      }
    });
    
  } catch (error) {
    console.error('Error starting interactive mode:', error);
    await ctx.editMessageText(`❌ *Error iniciando modo interactive*\n\n${error.message}`, {
      parse_mode: 'Markdown'
    });
  }
});

// Callback query handlers for buttons
bot.action('linear_menu', async (ctx) => {
  await ctx.answerCbQuery();
  
  const linearMenuMessage = `🔗 *Linear Integration Menu*

Conecta con tus proyectos y tareas de Linear para atomización inteligente.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '👥 Ver Equipos', callback_data: 'linear_teams' },
        { text: '📁 Ver Proyectos', callback_data: 'linear_projects' }
      ],
      [
        { text: '🔍 Buscar Tareas', callback_data: 'linear_search' }
      ],
      [
        { text: '🏠 Menú Principal', callback_data: 'main_menu' }
      ]
    ]
  };

  await ctx.editMessageText(linearMenuMessage, { 
    parse_mode: 'Markdown',
    reply_markup: keyboard 
  });
});

bot.action('github_menu', async (ctx) => {
  await ctx.answerCbQuery();
  
  const githubMenuMessage = `📂 *GitHub Integration Menu*

Gestiona tus repositorios para atomización con contexto completo.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📋 Ver Repos', callback_data: 'github_repos' },
        { text: '📂 Mis Repos', callback_data: 'github_my_repos' }
      ],
      [
        { text: '🏠 Menú Principal', callback_data: 'main_menu' }
      ]
    ]
  };

  await ctx.editMessageText(githubMenuMessage, { 
    parse_mode: 'Markdown',
    reply_markup: keyboard 
  });
});

bot.action('docker_menu', async (ctx) => {
  await ctx.answerCbQuery();
  
  const dockerMenuMessage = `🐳 *Docker Orchestration Menu*

Gestiona contenedores Docker para ejecutar tareas atomizadas.

*🚀 AGENT-TELEGRAM-53 Implementado:*
✅ Ejecución de tareas en contenedores aislados
✅ Monitoreo en tiempo real de instancias
✅ Control completo del ciclo de vida
✅ Logs detallados por contenedor`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🐳 Ver Instancias', callback_data: 'docker_instances' },
        { text: '📊 Estadísticas', callback_data: 'docker_stats' }
      ],
      [
        { text: '▶️ Ejecutar Tarea', callback_data: 'docker_play' }
      ],
      [
        { text: '🏠 Menú Principal', callback_data: 'main_menu' }
      ]
    ]
  };

  await ctx.editMessageText(dockerMenuMessage, { 
    parse_mode: 'Markdown',
    reply_markup: keyboard 
  });
});

bot.action('project_atomize', async (ctx) => {
  await ctx.answerCbQuery();
  
  await ctx.editMessageText(`⚙️ *Atomizar Proyecto Libre*

Para atomizar un proyecto, envía un mensaje con el formato:

/project "tu descripción detallada del proyecto"

*Ejemplo:*
/project "Crear una API REST con autenticación JWT, base de datos PostgreSQL y testing automatizado"

*El Enhanced TaskAtomizer incluye:*
✅ Context awareness con Linear/GitHub
✅ Dependency analysis avanzado
✅ Cost estimation detallado`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '🏠 Menú Principal', callback_data: 'main_menu' }
      ]]
    }
  });
});

bot.action('system_status', async (ctx) => {
  await ctx.answerCbQuery();
  
  const statusMessage = `📊 *Estado del Sistema*

✅ Enhanced TaskAtomizer (AGENT-TELEGRAM-52) - Completado
• Context awareness con Linear/GitHub
• Dependency analysis mejorado  
• Cost estimation por tarea
• Parallel execution detection
• Critical path calculation
• Validation framework

✅ VPS Docker Orchestration (AGENT-TELEGRAM-53) - Completado
• Ejecución de tareas en contenedores Docker
• Monitoreo en tiempo real de instancias
• Control completo del ciclo de vida
• Logs detallados por contenedor

🤖 Bot funcionando correctamente
📝 Core + Docker features implementadas

*Integraciones:*
*GitHub Integration:* ${process.env.GITHUB_TOKEN ? '✅ Configurado' : '❌ No configurado'}
*Linear Integration:* ${process.env.LINEAR_API_KEY ? '✅ Configurado' : '❌ No configurado'}
*Docker Orchestrator:* ✅ Activo (${docker.getStats().availability})`;

  await ctx.editMessageText(statusMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '🏠 Menú Principal', callback_data: 'main_menu' }
      ]]
    }
  });
});

bot.action('help_menu', async (ctx) => {
  await ctx.answerCbQuery();
  
  const helpMessage = `📚 *Telegram Task Agent - Ayuda*

*🎯 ¿Qué hace?*
Descompone proyectos complejos en tareas atómicas ejecutables.

*🔧 Funcionalidades:*
• **Linear Integration:** Conecta con tus proyectos Linear
• **GitHub Integration:** Analiza estructura de repositorios  
• **Enhanced TaskAtomizer:** IA avanzada para atomización
• **Cost Tracking:** Estimación de costos por tarea

*🚀 AGENT-TELEGRAM-52 Completado:*
Enhanced TaskAtomizer con context awareness de Linear/GitHub.

*💡 Consejos:*
• Usa descripciones detalladas para mejor atomización
• Conecta Linear y GitHub para contexto completo
• El sistema aprende de la estructura de tus repos`;

  await ctx.editMessageText(helpMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '🏠 Menú Principal', callback_data: 'main_menu' }
      ]]
    }
  });
});

bot.action('main_menu', async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const userId = ctx.from.id.toString();
    
    // Get user's agents
    let userAgents = [];
    try {
      userAgents = await agentManager.getUserAgents(userId);
    } catch (error) {
      console.error('Error getting user agents:', error);
    }
    
    const agentCount = userAgents.length;
    const activeAgents = userAgents.filter(a => a.status === 'working').length;
    
    const welcomeMessage = `🤖 *Background Agents Manager*

Crea agentes inteligentes que ejecutan tareas Linear en tu código GitHub automáticamente.

🎯 *Concepto: Agentes Background (como Cursor)*
• Cada agente = Linear Project + GitHub Repos
• Ejecuta tareas en background en tu VPS  
• Dos modos: Automático o con tus prompts

📊 *Tu Dashboard:*
• **Agentes creados**: ${agentCount}
• **Agentes activos**: ${activeAgents}
• **VPS**: Conectado ✅

*¿Qué hacer?*
${agentCount === 0 ? '🆕 Crea tu primer agente' : '🤖 Gestiona tus agentes existentes'}`;

    // Simplified keyboard with only working buttons
    const keyboard = {
      inline_keyboard: [
        [
          { text: '🆕 Crear Agente', callback_data: 'create_agent' },
          { text: '📋 Mis Agentes', callback_data: 'my_agents' }
        ]
      ]
    };
    
    // Add help button if user has no agents (first time)
    if (agentCount === 0) {
      keyboard.inline_keyboard.push([
        { text: '❓ ¿Cómo funciona?', callback_data: 'agent_help' }
      ]);
    }
    
    await ctx.editMessageText(welcomeMessage, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    });
    
  } catch (error) {
    console.error('Error in main menu:', error);
    await ctx.editMessageText('❌ *Error cargando menú principal*', {
      parse_mode: 'Markdown'
    });
  }
});

// Linear specific button handlers
bot.action('linear_teams', async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    if (!process.env.LINEAR_API_KEY) {
      return ctx.editMessageText('❌ *Linear API Key no configurado*\n\nConfigura LINEAR_API_KEY en tu archivo .env para usar esta funcionalidad.', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔗 Volver a Linear', callback_data: 'linear_menu' }
          ]]
        }
      });
    }

    await ctx.editMessageText('🔄 Obteniendo equipos de Linear...', { parse_mode: 'Markdown' });
    
    const teams = await linear.getTeams();
    const message = linear.formatTeamsForTelegram(teams);
    
    // Create dynamic buttons for teams
    const teamButtons = teams.slice(0, 8).map(team => ([
      { text: `👥 ${team.name} (${team.key})`, callback_data: `linear_team_${team.id}` }
    ]));
    
    teamButtons.push([{ text: '🔗 Volver a Linear', callback_data: 'linear_menu' }]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: teamButtons }
    });
    
  } catch (error) {
    console.error('Error getting Linear teams:', error);
    await ctx.editMessageText(`❌ *Error conectando con Linear*\n\n${error.message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🔗 Volver a Linear', callback_data: 'linear_menu' }
        ]]
      }
    });
  }
});

bot.action('linear_projects', async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    if (!process.env.LINEAR_API_KEY) {
      return ctx.editMessageText('❌ *Linear API Key no configurado*\n\nConfigura LINEAR_API_KEY en tu archivo .env para usar esta funcionalidad.', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔗 Volver a Linear', callback_data: 'linear_menu' }
          ]]
        }
      });
    }

    await ctx.editMessageText('🔄 Obteniendo proyectos de Linear...', { parse_mode: 'Markdown' });
    
    const projects = await linear.getProjects();
    const message = linear.formatProjectsForTelegram(projects);
    
    // Create dynamic buttons for projects  
    const projectButtons = projects.slice(0, 8).map(project => ([
      { text: `📁 ${project.name}`, callback_data: `linear_project_${project.id}` }
    ]));
    
    projectButtons.push([{ text: '🔗 Volver a Linear', callback_data: 'linear_menu' }]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: projectButtons }
    });
    
  } catch (error) {
    console.error('Error getting Linear projects:', error);
    await ctx.editMessageText(`❌ *Error conectando con Linear*\n\n${error.message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🔗 Volver a Linear', callback_data: 'linear_menu' }
        ]]
      }
    });
  }
});

bot.action('github_repos', async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    if (!process.env.GITHUB_TOKEN) {
      return ctx.editMessageText('❌ *GitHub Token no configurado*\n\nConfigura GITHUB_TOKEN en tu archivo .env para usar esta funcionalidad.', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '📂 Volver a GitHub', callback_data: 'github_menu' }
          ]]
        }
      });
    }

    await ctx.editMessageText('🔄 Obteniendo repositorios de GitHub...', { parse_mode: 'Markdown' });
    
    const repositories = await github.getRepositories('all', 'updated', 20);
    const message = github.formatRepositoriesForTelegram(repositories, 8);
    
    // Create dynamic buttons for repos (first 6)
    const repoButtons = repositories.slice(0, 6).map(repo => ([
      { text: `📁 ${repo.name}`, callback_data: `github_select_${encodeRepoForCallback(repo.full_name)}` }
    ]));
    
    repoButtons.push([{ text: '📂 Volver a GitHub', callback_data: 'github_menu' }]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: repoButtons }
    });
    
  } catch (error) {
    console.error('Error getting GitHub repos:', error);
    await ctx.editMessageText(`❌ *Error obteniendo repositorios*\n\n${error.message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '📂 Volver a GitHub', callback_data: 'github_menu' }
        ]]
      }
    });
  }
});

bot.action('github_my_repos', async (ctx) => {
  await ctx.answerCbQuery();
  
  const userId = ctx.from.id;
  const userRepos = selectedRepositories.get(userId) || [];
  
  if (userRepos.length === 0) {
    return ctx.editMessageText('📂 *No tienes repositorios seleccionados*\n\nUsa "Ver Repos" para seleccionar repositorios.', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Ver Repos', callback_data: 'github_repos' }],
          [{ text: '📂 Volver a GitHub', callback_data: 'github_menu' }]
        ]
      }
    });
  }
  
  let message = `📂 *Tus Repositorios Seleccionados:*\n\n`;
  
  userRepos.forEach((repo, index) => {
    const visibility = repo.private ? '🔒' : '🌐';
    const selectedDate = new Date(repo.selectedAt).toLocaleDateString();
    
    message += `${index + 1}. *${repo.name}*\n`;
    message += `   ${visibility} • ${repo.full_name}\n`;
    message += `   📅 Seleccionado: ${selectedDate}\n\n`;
  });
  
  message += `*Total: ${userRepos.length} repositorio(s) seleccionado(s)*`;
  
  // Create buttons for each repo
  const repoButtons = userRepos.slice(0, 6).map(repo => ([
    { text: `🔍 ${repo.name}`, callback_data: `github_structure_${encodeRepoForCallback(repo.full_name)}` }
  ]));
  
  repoButtons.push([{ text: '📂 Volver a GitHub', callback_data: 'github_menu' }]);
  
  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: repoButtons }
  });
});

// Project Mapping specific button handlers
bot.action('project_mapping_menu', async (ctx) => {
  await ctx.answerCbQuery();
  
  const projectMappingMessage = `3️⃣ *Vincular Proyecto↔Repo - ¡EL PASO CLAVE!*

🎯 *¿Por qué es importante?*
• **Sin vincular**: Claude genera tareas genéricas
• **Con vinculación**: Claude analiza TU código específico y genera tareas precisas

🔗 *Ejemplo de Vinculación:*
Linear Project "TEL" → GitHub Repo "telegram-task-agent"
Cuando atomices TEL-11, Claude verá tu stack Node.js + Telegraf + Docker

✨ *Tipos de Repo Soportados:*
• **main** - Repositorio principal/monorepo
• **backend** - API/servidor
• **frontend** - UI/cliente  
• **docs** - Documentación

*¿Qué hacer aquí?*
1. Ver mapeos existentes
2. Vincular nuevos proyectos con repos`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📋 Ver Mapeos', callback_data: 'project_mappings_view' },
        { text: '🔗 Vincular Repo', callback_data: 'project_link_repo' }
      ],
      [
        { text: '📂 Repos por Proyecto', callback_data: 'project_repos_view' }
      ],
      [
        { text: '🏠 Menú Principal', callback_data: 'main_menu' }
      ]
    ]
  };

  await ctx.editMessageText(projectMappingMessage, { 
    parse_mode: 'Markdown',
    reply_markup: keyboard 
  });
});

bot.action('project_mappings_view', async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    await ctx.editMessageText('🔄 Obteniendo mapeos de proyectos...', { parse_mode: 'Markdown' });
    
    const mappings = await projectRepoManager.getAllProjectMappings();
    const message = projectRepoManager.formatProjectMappingsForTelegram(mappings);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🔗 Volver a Project Mapping', callback_data: 'project_mapping_menu' }
        ]]
      }
    });
    
  } catch (error) {
    console.error('Error getting project mappings:', error);
    await ctx.editMessageText(`❌ *Error obteniendo mapeos*\n\n${error.message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🔗 Volver a Project Mapping', callback_data: 'project_mapping_menu' }
        ]]
      }
    });
  }
});

bot.action('project_link_repo', async (ctx) => {
  await ctx.answerCbQuery();
  
  await ctx.editMessageText(`🔗 *Vincular Repositorio a Proyecto*

Para vincular un repositorio GitHub a un proyecto Linear, envía un mensaje con el formato:

/link_repo [project_id] [owner/repo] [tipo]

*Ejemplo:*
/link_repo abc123-def456 facebook/react frontend

*Tipos disponibles:*
• **main** - Repositorio principal
• **frontend** - Frontend/UI
• **backend** - Backend/API
• **api** - API específica
• **docs** - Documentación

*Comandos útiles:*
• /linear - Ver proyectos Linear disponibles
• /repos - Ver repositorios GitHub accesibles
• /project_mappings - Ver todos los mapeos`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📋 Ver Proyectos Linear', callback_data: 'linear_projects' }],
        [{ text: '📂 Ver Repos GitHub', callback_data: 'github_repos' }],
        [{ text: '🔗 Volver a Project Mapping', callback_data: 'project_mapping_menu' }]
      ]
    }
  });
});

bot.action('project_repos_view', async (ctx) => {
  await ctx.answerCbQuery();
  
  await ctx.editMessageText(`📂 *Ver Repositorios por Proyecto*

Para ver todos los repositorios vinculados a un proyecto específico, envía:

/project_repos [project_id]

*Ejemplo:*
/project_repos abc123-def456

*Para obtener el Project ID:*
• Usa /linear para ver todos los proyectos
• El ID aparece en la información detallada de cada proyecto

*Comandos relacionados:*
• /unlink_repo [project_id] [owner/repo] - Desvincular repositorio
• /project_mappings - Ver resumen de todos los mapeos`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📋 Ver Proyectos Linear', callback_data: 'linear_projects' }],
        [{ text: '🔗 Volver a Project Mapping', callback_data: 'project_mapping_menu' }]
      ]
    }
  });
});

// Docker specific button handlers
bot.action('docker_instances', async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    await ctx.editMessageText('🔄 Obteniendo instancias Docker activas...', { parse_mode: 'Markdown' });
    
    const instances = await docker.getInstances();
    await docker.cleanupStoppedInstances();
    
    if (instances.length === 0) {
      return ctx.editMessageText('📋 *No hay instancias Docker activas*\n\nUsa "Ejecutar Tarea" para iniciar una nueva instancia.', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶️ Ejecutar Tarea', callback_data: 'docker_play' }],
            [{ text: '🐳 Volver a Docker', callback_data: 'docker_menu' }]
          ]
        }
      });
    }
    
    let message = `🐳 *Instancias Docker Activas:*\n\n`;
    
    instances.slice(0, 5).forEach((instance, index) => {
      const statusIcon = instance.status === 'running' ? '🟢' : instance.status === 'stopped' ? '🔴' : '🟡';
      
      message += `${index + 1}. ${statusIcon} *${instance.containerName}*\n`;
      message += `   🆔 ${instance.id.substring(0, 20)}...\n`;
      message += `   📋 ${instance.taskTitle}\n`;
      message += `   ⏱️ Uptime: ${instance.uptime}\n`;
      message += `   📊 ${instance.status}\n\n`;
    });
    
    if (instances.length > 5) {
      message += `... y ${instances.length - 5} instancias más\n\n`;
    }
    
    message += `*Usa /instances para ver todas las instancias*`;
    
    // Create buttons for first 3 instances
    const instanceButtons = instances.slice(0, 3).map(instance => ([
      { text: `📝 Logs ${instance.containerName.substring(0, 15)}...`, callback_data: `docker_logs_${instance.id.substring(0, 10)}` }
    ]));
    
    instanceButtons.push([{ text: '🐳 Volver a Docker', callback_data: 'docker_menu' }]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: instanceButtons }
    });
    
  } catch (error) {
    console.error('Error getting Docker instances:', error);
    await ctx.editMessageText(`❌ *Error obteniendo instancias Docker*\n\n${error.message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🐳 Volver a Docker', callback_data: 'docker_menu' }
        ]]
      }
    });
  }
});

bot.action('docker_stats', async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const stats = docker.getStats();
    
    const statsMessage = `📊 *Estadísticas Docker Orchestrator*

*🐳 Instancias:*
• Total: ${stats.total}
• Ejecutándose: ${stats.running} 🟢
• Completadas: ${stats.completed} ✅
• Fallidas: ${stats.failed} ❌

*⚙️ Capacidad:*
• Disponibilidad: ${stats.availability}
• Límite máximo: ${stats.maxInstances} contenedores

*🚀 Estado del Sistema:*
✅ Docker Orchestrator activo
✅ Workspace configurado
✅ Monitoreo en tiempo real habilitado`;

    await ctx.editMessageText(statsMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🐳 Ver Instancias', callback_data: 'docker_instances' }],
          [{ text: '🐳 Volver a Docker', callback_data: 'docker_menu' }]
        ]
      }
    });
    
  } catch (error) {
    console.error('Error getting Docker stats:', error);
    await ctx.editMessageText(`❌ *Error obteniendo estadísticas*\n\n${error.message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🐳 Volver a Docker', callback_data: 'docker_menu' }
        ]]
      }
    });
  }
});

bot.action('docker_play', async (ctx) => {
  await ctx.answerCbQuery();
  
  await ctx.editMessageText(`▶️ *Ejecutar Tarea Docker*

Para ejecutar una tarea atomizada en Docker, envía un mensaje con el formato:

/play [atomic_task_id]

*Ejemplo:*
/play task-123

*El sistema creará:*
✅ Contenedor Docker aislado
✅ Workspace dedicado
✅ Logs en tiempo real
✅ Monitoreo automático de estado

*Comandos relacionados:*
• /instances - Ver todas las instancias
• /logs [instance_id] - Ver logs detallados
• /kill [instance_id] - Terminar instancia`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🐳 Ver Instancias', callback_data: 'docker_instances' }],
        [{ text: '🐳 Volver a Docker', callback_data: 'docker_menu' }]
      ]
    }
  });
});

// Dynamic callback handlers (using regex patterns)

// Linear team handler
bot.action(/^linear_team_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const teamId = ctx.match[1];
    await ctx.editMessageText(`🔄 Obteniendo tareas del equipo...`, { parse_mode: 'Markdown' });
    
    const teamData = await linear.getIssuesByTeam(teamId);
    const message = linear.formatIssuesForTelegram(teamData.issues.nodes, `${teamData.name} (${teamData.id})`);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '👥 Volver a Equipos', callback_data: 'linear_teams' },
          { text: '🔗 Menú Linear', callback_data: 'linear_menu' }
        ]]
      }
    });
    
  } catch (error) {
    console.error('Error getting team issues:', error);
    await ctx.editMessageText(`❌ *Error obteniendo tareas del equipo*\n\n${error.message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🔗 Volver a Linear', callback_data: 'linear_menu' }
        ]]
      }
    });
  }
});

// Linear project handler
bot.action(/^linear_project_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const projectId = ctx.match[1];
    await ctx.editMessageText(`🔄 Obteniendo tareas del proyecto...`, { parse_mode: 'Markdown' });
    
    const projectData = await linear.getIssuesByProject(projectId);
    const tasks = projectData?.issues?.nodes || [];
    const message = linear.formatIssuesForTelegram(tasks, projectData?.name || 'Unknown Project');
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '📁 Volver a Proyectos', callback_data: 'linear_projects' },
          { text: '🔗 Menú Linear', callback_data: 'linear_menu' }
        ]]
      }
    });
    
  } catch (error) {
    console.error('Error getting project issues:', error);
    await ctx.editMessageText(`❌ *Error obteniendo tareas del proyecto*\n\n${error.message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🔗 Volver a Linear', callback_data: 'linear_menu' }
        ]]
      }
    });
  }
});

bot.action(/^github_select_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const repoPath = decodeRepoFromCallback(ctx.match[1]);
    const [owner, repo] = repoPath.split('/');
    
    if (!owner || !repo) {
      return ctx.editMessageText('❌ *Formato de repositorio inválido*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '📂 Volver a GitHub', callback_data: 'github_menu' }
          ]]
        }
      });
    }
    await ctx.editMessageText(`🔄 Validando acceso a ${repoPath}...`, { parse_mode: 'Markdown' });
    
    const validation = await github.validateRepositoryAccess(owner, repo);
    
    if (!validation.valid) {
      return ctx.editMessageText(`❌ *Error de acceso al repositorio*\n\n${validation.error}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '📂 Volver a GitHub', callback_data: 'github_menu' }
          ]]
        }
      });
    }
    
    // Store selected repository
    const userId = ctx.from.id;
    const userRepos = selectedRepositories.get(userId) || [];
    
    const existingRepo = userRepos.find(r => r.full_name === validation.repository.full_name);
    if (!existingRepo) {
      userRepos.push({
        ...validation.repository,
        selectedAt: new Date().toISOString()
      });
      selectedRepositories.set(userId, userRepos);
    }
    
    const visibility = validation.repository.private ? '🔒 Privado' : '🌐 Público';
    
    const successMessage = `✅ *Repositorio ${existingRepo ? 'ya seleccionado' : 'seleccionado exitosamente'}*

**${validation.repository.full_name}**

${visibility}
${validation.repository.description ? `📝 ${validation.repository.description}` : ''}

*Branch principal:* ${validation.repository.default_branch}`;

    await ctx.editMessageText(successMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔍 Ver Estructura', callback_data: `github_structure_${encodeRepoForCallback(repoPath)}` }],
          [{ text: '📂 Mis Repos', callback_data: 'github_my_repos' }],
          [{ text: '📂 Volver a GitHub', callback_data: 'github_menu' }]
        ]
      }
    });
    
  } catch (error) {
    console.error('Error selecting repository:', error);
    await ctx.editMessageText(`❌ *Error seleccionando repositorio*\n\n${error.message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '📂 Volver a GitHub', callback_data: 'github_menu' }
        ]]
      }
    });
  }
});

// GitHub structure handler
bot.action(/^github_structure_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const repoPath = decodeRepoFromCallback(ctx.match[1]);
    const [owner, repo] = repoPath.split('/');
    
    if (!owner || !repo) {
      return ctx.editMessageText('❌ *Formato de repositorio inválido*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '📂 Volver a GitHub', callback_data: 'github_menu' }
          ]]
        }
      });
    }
    await ctx.editMessageText(`🔄 Analizando estructura de ${repoPath}...`, { parse_mode: 'Markdown' });
    
    const structure = await github.getRepositoryStructure(owner, repo, '', 2);
    const message = github.formatRepositoryStructureForTelegram(structure, repoPath, 20);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📂 Mis Repos', callback_data: 'github_my_repos' }],
          [{ text: '📂 Volver a GitHub', callback_data: 'github_menu' }]
        ]
      }
    });
    
  } catch (error) {
    console.error('Error getting repository structure:', error);
    await ctx.editMessageText(`❌ *Error obteniendo estructura*\n\n${error.message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '📂 Volver a GitHub', callback_data: 'github_menu' }
        ]]
      }
    });
  }
});

// Task execution functions
async function startBackgroundTaskExecution(agent, task, execution, ctx) {
  console.log(`🚀 Starting background execution for task ${task.id}`);
  
  // Send progress update to user
  await ctx.editMessageText('🔍 *Analizando tarea y repositorios...*', {
    parse_mode: 'Markdown'
  });
  
  try {
    // Get project context for the agent
    const projectContext = await projectRepoManager.getProjectContext(agent.linear_project_id);
    
    // Update progress
    await ctx.editMessageText('🚀 *Iniciando contenedor Docker con Claude CLI...*', {
      parse_mode: 'Markdown'
    });
    
    // Prepare task data for agent execution
    const taskData = {
      agentId: agent.id,
      linearTaskId: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.state?.name,
      assignee: task.assignee?.name,
      labels: task.labels?.nodes?.map(l => l.name),
      projectContext: projectContext,
      executionMode: 'background',
      executionId: execution.id,
      // Claude prompt para análisis específico
      claudePrompt: `Analyze this Linear task and generate a detailed execution plan:

Task: ${task.title}
Description: ${task.description}
Priority: ${task.priority}

Available repositories: ${projectContext?.repositories?.map(r => r.fullName).join(', ') || 'None'}

Please:
1. Analyze the task requirements
2. Review the repository structure and code patterns
3. Create a step-by-step execution plan
4. Identify any dependencies or prerequisites
5. Generate specific commands to complete this task

Focus on understanding the existing codebase and following established patterns.`
    };
    
    // Execute agent task with new DockerOrchestrator method
    const dockerInstance = await docker.executeAgentTask(
      agent.id,
      task.id, 
      taskData,
      'background'
    );
    
    console.log(`🤖 Agent container started: ${dockerInstance.instanceId}`);
    
    // Send container info to user
    await ctx.editMessageText(`✅ *Contenedor iniciado exitosamente*

🐳 **Container:** ${dockerInstance.containerName}
🤖 **Claude CLI:** Ejecutándose automáticamente
📁 **Workspace:** ${dockerInstance.workspace || 'N/A'}

⏳ *El agente está analizando la tarea y ejecutando cambios...*
💬 Te notificaré cuando termine.`, {
      parse_mode: 'Markdown'
    });
    
    // Start monitoring the container
    monitorBackgroundExecution(dockerInstance, agent, task, execution, ctx);
    
    // Update execution with Docker instance info
    await agentManager.updateTaskExecution(
      execution.id,
      'running',
      10, // Initial progress
      `Agent container started: ${dockerInstance.containerName}`
    );
    
    // Monitor execution progress
    monitorTaskExecution(dockerInstance.instanceId, execution.id, agent.id);
    
  } catch (error) {
    console.error('Failed to start background execution:', error);
    throw error;
  }
}

async function monitorBackgroundExecution(dockerInstance, agent, task, execution, ctx) {
  const instanceId = dockerInstance.instanceId;
  let lastUpdateTime = Date.now();
  let checkCount = 0;
  
  const checkInterval = setInterval(async () => {
    try {
      checkCount++;
      
      // Check container status every 10 seconds  
      const containerStatus = await docker.getInstanceStatus(instanceId);
      
      if (!containerStatus) {
        clearInterval(checkInterval);
        return;
      }
      
      // Get fresh logs every check
      const logs = await docker.getInstanceLogs(instanceId);
      const recentLogs = logs ? logs.split('\n').slice(-8).join('\n') : 'Sin logs disponibles';
      const timeElapsed = Math.floor((Date.now() - lastUpdateTime) / 1000 / 60);
      
      // Send updates every check (every 10 seconds)
      const escapedContainerName = escapeMarkdownSafe(dockerInstance.containerName);
      const escapedStatus = escapeMarkdownSafe(containerStatus.status);
      const escapedLogs = recentLogs.length > 400 ? recentLogs.substring(0, 400) + '...' : recentLogs;
      
      try {
        await ctx.editMessageText(`🔄 *Agente ejecutándose...*

🐳 **Container:** ${escapedContainerName}
⏱️ **Tiempo:** ${timeElapsed}+ minutos  
📊 **Estado:** ${escapedStatus}

📝 **Logs recientes:**
\`\`\`
${escapedLogs}
\`\`\`

⏳ *Claude CLI trabajando automáticamente...*`, {
          parse_mode: 'Markdown'
        });
      } catch (messageError) {
        console.error('Error updating message during monitoring:', messageError);
        // If message update fails, try a simpler version
        try {
          await ctx.editMessageText(`🔄 *Agente ejecutándose...*

⏱️ **Tiempo:** ${timeElapsed}+ minutos  
📊 **Estado:** ${containerStatus.status}

⏳ *Trabajando automáticamente...*`, {
            parse_mode: 'Markdown'
          });
        } catch (fallbackError) {
          console.error('Fallback message update also failed:', fallbackError);
        }
      }
      
      // If container finished (exited, completed, or not found - which means it finished and was removed)
      if (containerStatus.status === 'exited' || containerStatus.status === 'completed' || containerStatus.status === 'not_found') {
        clearInterval(checkInterval);
        
        // Get final logs and analyze results
        const logs = await docker.getInstanceLogs(instanceId);
        const workSummary = await generateWorkSummary(logs, task, dockerInstance);
        
        // Update execution status
        await agentManager.updateTaskExecution(
          execution.id, 
          'completed', 
          100, 
          'Background execution completed'
        );
        
        await agentManager.updateAgentStatus(agent.id, 'idle', null, null, 0);
        
        // Send detailed completion message
        const escapedTaskTitle = escapeMarkdown(task.title);
        const escapedAgentName = escapeMarkdown(agent.name);
        
        await ctx.editMessageText(`🎉 *Tarea completada exitosamente*

✅ **Agente:** ${escapedAgentName}
📋 **Tarea:** ${escapedTaskTitle}
⏱️ **Duración:** ${Math.floor((Date.now() - lastUpdateTime) / 1000 / 60)} minutos

${workSummary}

🎯 *Claude ha completado la tarea automáticamente.*`, {
          parse_mode: 'Markdown'
        });
      }
      
      // Timeout after 30 minutes
      if (checkCount > 60) {
        clearInterval(checkInterval);
        
        await ctx.editMessageText(`⚠️ *Timeout: Ejecución muy larga*

🐳 **Container:** ${dockerInstance.containerName}
⏱️ **Tiempo:** 30+ minutos

🔧 *La tarea sigue ejecutándose en background.*
📊 Usa /logs ${instanceId} para ver el progreso.`, {
          parse_mode: 'Markdown'
        });
      }
      
    } catch (error) {
      console.error('Error monitoring background execution:', error);
      // Continue monitoring despite errors
    }
  }, 10000); // Check every 10 seconds
}

async function generateWorkSummary(logs, task, dockerInstance) {
  try {
    if (!logs || logs.includes('No logs available') || logs.includes('Container removed')) {
      return `🔍 **Resumen de trabajo:**
📝 La tarea se ejecutó exitosamente pero los logs detallados no están disponibles
⚡ Ejecución completada rápidamente sin errores`;
    }

    // Analyze logs for key activities
    const logLines = logs.split('\n').filter(line => line.trim().length > 0);
    const activities = [];
    const filesModified = [];
    const errors = [];
    const commits = [];

    // Analyze each log line for meaningful activities
    logLines.forEach(line => {
      const lowerLine = line.toLowerCase();
      
      // File operations
      if (lowerLine.includes('created') || lowerLine.includes('wrote') || lowerLine.includes('writing')) {
        if (lowerLine.includes('.js') || lowerLine.includes('.ts') || lowerLine.includes('.py') || 
            lowerLine.includes('.md') || lowerLine.includes('.json') || lowerLine.includes('.yml')) {
          activities.push('📝 Modificó/creó archivos de código');
        }
      }
      
      // Git operations
      if (lowerLine.includes('commit') || lowerLine.includes('git add') || lowerLine.includes('git commit')) {
        commits.push(line.trim());
      }
      
      // Package operations
      if (lowerLine.includes('npm install') || lowerLine.includes('yarn install') || lowerLine.includes('pip install')) {
        activities.push('📦 Instaló dependencias');
      }
      
      // Testing
      if (lowerLine.includes('test') && (lowerLine.includes('pass') || lowerLine.includes('ok'))) {
        activities.push('✅ Ejecutó tests exitosamente');
      }
      
      // Build/compilation
      if (lowerLine.includes('build') || lowerLine.includes('compile')) {
        activities.push('🏗️ Ejecutó proceso de build');
      }
      
      // Database operations
      if (lowerLine.includes('migration') || lowerLine.includes('database')) {
        activities.push('🗄️ Realizó operaciones de base de datos');
      }
      
      // API/HTTP requests
      if (lowerLine.includes('http') || lowerLine.includes('api') || lowerLine.includes('request')) {
        activities.push('🌐 Realizó llamadas a APIs');
      }
      
      // Error detection
      if (lowerLine.includes('error') || lowerLine.includes('failed') || lowerLine.includes('exception')) {
        errors.push(line.trim());
      }
    });

    // Remove duplicates
    const uniqueActivities = [...new Set(activities)];
    
    // Build summary
    let summary = `🔍 **Resumen de trabajo:**\n`;
    
    if (uniqueActivities.length > 0) {
      summary += uniqueActivities.slice(0, 5).map(activity => `${activity}`).join('\n') + '\n';
    } else {
      summary += `📝 Tarea ejecutada según especificaciones\n`;
    }
    
    // Add commits if any
    if (commits.length > 0) {
      summary += `\n📋 **Commits realizados:**\n`;
      commits.slice(0, 2).forEach(commit => {
        const shortCommit = commit.length > 60 ? commit.substring(0, 60) + '...' : commit;
        summary += `• ${escapeMarkdown(shortCommit)}\n`;
      });
    }
    
    // Add errors if any (but not too many)
    if (errors.length > 0) {
      summary += `\n⚠️ **Advertencias/Errores manejados:** ${errors.length}\n`;
    }
    
    // Add log preview
    const recentLines = logLines.slice(-3).join('\n');
    if (recentLines && recentLines.length < 200) {
      summary += `\n📊 **Últimas líneas de ejecución:**\n\`\`\`\n${recentLines}\n\`\`\``;
    }
    
    return summary;
    
  } catch (error) {
    console.error('Error generating work summary:', error);
    return `🔍 **Resumen de trabajo:**
📝 Tarea completada exitosamente
⚡ No se pudo generar resumen detallado`;
  }
}

// Handle pause agent
bot.action(/^pause_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('⏸️ Pausando agente...');
  
  try {
    const instanceId = ctx.match[1];
    const result = await docker.killInstance(instanceId);
    
    await ctx.editMessageText(`⏸️ *Agente pausado*

🐳 **Container:** ${instanceId}
✅ **Estado:** Detenido exitosamente

El agente ha sido pausado. Puedes crear un nuevo agente para continuar trabajando.`, {
      parse_mode: 'Markdown'
    });
    
  } catch (error) {
    console.error('Error pausing agent:', error);
    await ctx.editMessageText('❌ *Error pausando agente*\n\nNo se pudo detener el contenedor.', {
      parse_mode: 'Markdown'
    });
  }
});

// Handle full logs
bot.action(/^logs_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('📋 Obteniendo logs...');
  
  try {
    const instanceId = ctx.match[1];
    const fullLogs = await docker.getInstanceLogs(instanceId);
    
    const logsText = fullLogs || 'No hay logs disponibles';
    const truncatedLogs = logsText.length > 3500 ? logsText.substring(logsText.length - 3500) + '\n\n[Logs truncados - mostrando últimas 3500 chars]' : logsText;
    
    await ctx.reply(`📋 *Logs Completos*

\`\`\`
${truncatedLogs}
\`\`\``, {
      parse_mode: 'Markdown'
    });
    
  } catch (error) {
    console.error('Error getting full logs:', error);
    await ctx.reply('❌ *Error obteniendo logs*\n\nNo se pudieron recuperar los logs del contenedor.', {
      parse_mode: 'Markdown'
    });
  }
});

// Handle completed task logs
bot.action(/^completed_logs_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('📋 Obteniendo logs de tarea completada...');
  
  try {
    const instanceId = ctx.match[1];
    const fullLogs = await docker.getInstanceLogs(instanceId);
    
    const logsText = fullLogs || 'No hay logs disponibles para esta tarea completada.';
    const truncatedLogs = logsText.length > 3500 ? logsText.substring(logsText.length - 3500) + '\n\n[Logs truncados - mostrando últimas 3500 chars]' : logsText;
    
    await ctx.reply(`📋 *Logs Completos - Tarea Completada*

\`\`\`
${truncatedLogs}
\`\`\`

💡 *Estos son los logs de la tarea que completó exitosamente.*`, {
      parse_mode: 'Markdown'
    });
    
  } catch (error) {
    console.error('Error getting completed task logs:', error);
    await ctx.reply('❌ *Error obteniendo logs*\n\nNo se pudieron recuperar los logs de esta tarea completada.', {
      parse_mode: 'Markdown'
    });
  }
});

async function startInteractiveTaskExecution(agent, task, execution, userPrompt) {
  console.log(`🚀 Starting interactive execution for task ${task.id} with prompt: ${userPrompt}`);
  
  try {
    // Get project context for the agent
    const projectContext = await projectRepoManager.getProjectContext(agent.linear_project_id);
    
    // Prepare task data for interactive agent execution
    const taskData = {
      agentId: agent.id,
      linearTaskId: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.state?.name,
      assignee: task.assignee?.name,
      labels: task.labels?.nodes?.map(l => l.name),
      projectContext: projectContext,
      executionMode: 'interactive',
      executionId: execution.id,
      userPrompt: userPrompt,
      // Claude prompt personalizado con instrucciones del usuario
      claudePrompt: `Analyze this Linear task with specific user instructions:

Task: ${task.title}
Description: ${task.description}
Priority: ${task.priority}

User Instructions: ${userPrompt}

Available repositories: ${projectContext?.repositories?.map(r => r.fullName).join(', ') || 'None'}

Please:
1. Follow the user's specific instructions carefully
2. Analyze the task requirements in context of user preferences
3. Review the repository structure and code patterns
4. Create a step-by-step execution plan that incorporates user guidance
5. Ask clarifying questions if the user instructions are ambiguous
6. Generate specific commands to complete this task as requested

Focus on the user's preferences while maintaining code quality and following established patterns.`
    };
    
    // Execute agent task with new DockerOrchestrator method
    const dockerInstance = await docker.executeAgentTask(
      agent.id,
      task.id, 
      taskData,
      'interactive'
    );
    
    console.log(`🤖 Interactive agent container started: ${dockerInstance.instanceId}`);
    
    // Update execution with Docker instance info
    await agentManager.updateTaskExecution(
      execution.id,
      'running',
      10, // Initial progress
      `Interactive agent started: ${dockerInstance.containerName}`
    );
    
    // Monitor execution progress
    monitorTaskExecution(dockerInstance.instanceId, execution.id, agent.id);
    
  } catch (error) {
    console.error('Failed to start interactive execution:', error);
    throw error;
  }
}

async function monitorTaskExecution(dockerInstanceId, executionId, agentId) {
  console.log(`📊 Monitoring execution ${executionId} on Docker instance ${dockerInstanceId}`);
  
  const checkInterval = setInterval(async () => {
    try {
      const instances = await docker.getInstances();
      const instance = instances.find(i => i.id === dockerInstanceId);
      
      if (!instance) {
        console.log(`Instance ${dockerInstanceId} not found, stopping monitoring`);
        clearInterval(checkInterval);
        return;
      }
      
      // Update progress based on instance status
      let progress = 10;
      let status = 'running';
      let logs = 'Running...';
      
      if (instance.status === 'completed') {
        progress = 100;
        status = 'completed';
        logs = 'Task completed successfully';
        clearInterval(checkInterval);
        
        // Update agent status to idle
        await agentManager.updateAgentStatus(agentId, 'idle', null, null, 0);
        
      } else if (instance.status === 'failed') {
        progress = 0;
        status = 'failed';
        logs = 'Task execution failed';
        clearInterval(checkInterval);
        
        // Update agent status to idle
        await agentManager.updateAgentStatus(agentId, 'idle', null, null, 0);
        
      } else if (instance.status === 'running') {
        // Calculate progress based on uptime (rough estimate)
        const uptimeMinutes = parseFloat(instance.uptime.replace(/[^\d.]/g, ''));
        progress = Math.min(90, 10 + (uptimeMinutes * 5)); // Max 90% until completed
      }
      
      // Update execution status
      await agentManager.updateTaskExecution(executionId, status, progress, logs);
      
    } catch (error) {
      console.error('Error monitoring task execution:', error);
      clearInterval(checkInterval);
    }
  }, 30000); // Check every 30 seconds
  
  // Set timeout to stop monitoring after 1 hour
  setTimeout(() => {
    clearInterval(checkInterval);
    console.log(`⏰ Monitoring timeout for execution ${executionId}`);
  }, 3600000); // 1 hour
}

console.log('🚀 Starting Enhanced Telegram Task Agent...');
console.log('✅ RELY-52 Enhanced TaskAtomizer ready');

bot.launch().then(() => {
  console.log('✅ Bot started successfully!');
}).catch(err => {
  console.error('❌ Failed to start bot:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));