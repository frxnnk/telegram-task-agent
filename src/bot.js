const { Telegraf, Markup } = require('telegraf');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize modules
const LinearManager = require('./integrations/LinearManager');
const GitHubManager = require('./integrations/GitHubManager');

// Simple database for projects
const projectsDB = {
  data: {},
  
  save() {
    const dbPath = path.join(__dirname, '..', 'projects.json');
    fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2));
  },
  
  load() {
    const dbPath = path.join(__dirname, '..', 'projects.json');
    if (fs.existsSync(dbPath)) {
      this.data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
  },
  
  createProject(name, repos) {
    this.data[name] = {
      name,
      repos,
      created: new Date().toISOString(),
      path: path.join(__dirname, '..', 'projects', name)
    };
    this.save();
  },
  
  getProjects() {
    return this.data;
  },
  
  getProject(name) {
    return this.data[name];
  }
};

// Load projects database
projectsDB.load();

// User sessions for multi-step flows
const userSessions = new Map();

// Initialize managers
const linear = new LinearManager(process.env.LINEAR_API_KEY);
const github = new GitHubManager(process.env.GITHUB_TOKEN);

// Initialize bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Helper function to escape Markdown
function escapeMarkdown(text) {
  if (!text) return '';
  return text.toString().replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Helper function to execute Claude CLI
async function executeClaudeCommand(prompt, options = {}) {
  return new Promise((resolve, reject) => {
    const command = `echo "${prompt.replace(/"/g, '\\"')}" | claude --print`;
    
    exec(command, { 
      timeout: 60000,
      maxBuffer: 1024 * 1024,
      ...options 
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Claude CLI error: ${error.message}`));
      } else {
        resolve({
          output: stdout.trim(),
          error: stderr.trim()
        });
      }
    });
  });
}

// Helper function to execute Claude CLI with project context
async function executeClaudeCommandWithContext(prompt, projectPath, options = {}) {
  return new Promise((resolve, reject) => {
    const command = `cd "${projectPath}" && echo "${prompt.replace(/"/g, '\\"')}" | claude --print`;
    
    exec(command, { 
      timeout: 60000,
      maxBuffer: 1024 * 1024,
      cwd: projectPath,
      ...options 
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Claude CLI error: ${error.message}`));
      } else {
        resolve({
          output: stdout.trim(),
          error: stderr.trim()
        });
      }
    });
  });
}

// Helper function to clone repository
async function cloneRepository(repoUrl, targetPath, repoName) {
  return new Promise((resolve, reject) => {
    const command = `git clone ${repoUrl} "${path.join(targetPath, repoName)}"`;
    
    exec(command, { 
      timeout: 300000, // 5 minutes for clone
      maxBuffer: 1024 * 1024 
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Git clone error: ${error.message}`));
      } else {
        resolve({
          output: stdout.trim(),
          error: stderr.trim()
        });
      }
    });
  });
}

// Helper function to create project directory structure
async function createProjectStructure(projectPath, repos) {
  return new Promise((resolve, reject) => {
    // Create main project directory
    exec(`mkdir -p "${projectPath}"`, (error) => {
      if (error) {
        reject(new Error(`Failed to create project directory: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
}

// Start command - Main Menu
bot.start((ctx) => {
  const projects = projectsDB.getProjects();
  const projectCount = Object.keys(projects).length;
  
  const startMessage = `🤖 *Telegram Task Agent - Project Manager*

¡Hola! Gestiona tus proyectos de desarrollo con Claude CLI.

*📊 Estado actual:*
• 📁 Proyectos activos: ${projectCount}
• 🤖 Claude CLI: Listo
• 🐙 GitHub: Conectado

*¿Qué quieres hacer?*`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📁 Ver Proyectos', 'view_projects'),
      Markup.button.callback('➕ Crear Proyecto', 'create_project')
    ],
    [
      Markup.button.callback('🐙 Mis Repositorios', 'github_repos'),
      Markup.button.callback('❓ Ayuda', 'help')
    ]
  ]);

  ctx.replyWithMarkdown(startMessage, keyboard);
});

// Help command and callback
bot.help((ctx) => {
  showHelpMessage(ctx);
});

bot.action('help', async (ctx) => {
  showHelpMessage(ctx, true);
});

function showHelpMessage(ctx, isCallback = false) {
  const helpMessage = `📚 *Ayuda - Telegram Task Agent*

*🎯 ¿Qué hago?*
Sistema de gestión de proyectos con Claude CLI. Clona tus repositorios de GitHub y chatea con Claude sobre el código real.

*🔧 Cómo funciona:*
1. *Crear Proyecto:* Elige nombre y repositorios de GitHub
2. *Clonado Automático:* Los repos se clonan en \`projects/tu-proyecto/\`
3. *Chat Contextual:* Claude CLI ejecuta desde el directorio del proyecto
4. *Acceso Completo:* Claude puede leer archivos, analizar código, hacer cambios

*💬 Comandos de Chat en Proyecto:*
"Analiza la estructura del proyecto"
"¿Qué hace este archivo package.json?"
"Encuentra todos los archivos .js y muestra un resumen"
"Sugiere mejoras para el README"
"Busca TODO comments en el código"

*⚙️ Comandos del Sistema:*
• /start - Menú principal
• /status - Estado del sistema
• /help - Esta ayuda

*🚀 ¡Es como SSH desde Telegram!*
Claude ejecuta comandos desde el directorio real de tus repositorios clonados.`;

  if (isCallback) {
    ctx.editMessageText(helpMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Volver al Menú', callback_data: 'main_menu' }]
        ]
      }
    });
  } else {
    ctx.reply(helpMessage, { parse_mode: 'Markdown' });
  }
}

// Callback query handlers
bot.action('view_projects', async (ctx) => {
  const projects = projectsDB.getProjects();
  const projectNames = Object.keys(projects);
  
  if (projectNames.length === 0) {
    await ctx.editMessageText(
      `📁 *Proyectos*\n\nNo tienes proyectos creados aún.\n\n*¿Quieres crear tu primer proyecto?*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Crear Proyecto', callback_data: 'create_project' }],
            [{ text: '🔙 Volver al Menú', callback_data: 'main_menu' }]
          ]
        }
      }
    );
    return;
  }
  
  const buttons = projectNames.map(name => [{
    text: `📁 ${name}`,
    callback_data: `project_${name}`
  }]);
  
  buttons.push([{ text: '➕ Crear Proyecto', callback_data: 'create_project' }]);
  buttons.push([{ text: '🔙 Volver al Menú', callback_data: 'main_menu' }]);
  
  await ctx.editMessageText(
    `📁 *Tus Proyectos*\n\nSelecciona un proyecto para trabajar con Claude CLI:`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    }
  );
});

bot.action('create_project', async (ctx) => {
  const userId = ctx.from.id;
  userSessions.set(userId, { step: 'waiting_project_name' });
  
  await ctx.editMessageText(
    `➕ *Crear Nuevo Proyecto*\n\n*Paso 1:* Envía el nombre del proyecto\n\n*Ejemplo:* mi-proyecto-web`,
    { parse_mode: 'Markdown' }
  );
});

bot.action('main_menu', async (ctx) => {
  const projects = projectsDB.getProjects();
  const projectCount = Object.keys(projects).length;
  
  const startMessage = `🤖 *Telegram Task Agent - Project Manager*

¡Hola! Gestiona tus proyectos de desarrollo con Claude CLI.

*📊 Estado actual:*
• 📁 Proyectos activos: ${projectCount}
• 🤖 Claude CLI: Listo
• 🐙 GitHub: Conectado

*¿Qué quieres hacer?*`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📁 Ver Proyectos', 'view_projects'),
      Markup.button.callback('➕ Crear Proyecto', 'create_project')
    ],
    [
      Markup.button.callback('🐙 Mis Repositorios', 'github_repos'),
      Markup.button.callback('❓ Ayuda', 'help')
    ]
  ]);

  await ctx.editMessageText(startMessage, {
    parse_mode: 'Markdown',
    ...keyboard
  });
});

// Handle project selection
bot.action(/^project_(.+)$/, async (ctx) => {
  const projectName = ctx.match[1];
  const project = projectsDB.getProject(projectName);
  
  if (!project) {
    await ctx.answerCbQuery('❌ Proyecto no encontrado');
    return;
  }
  
  const userId = ctx.from.id;
  userSessions.set(userId, { 
    step: 'in_project', 
    projectName: projectName,
    projectPath: project.path 
  });
  
  const reposList = project.repos.map(repo => `• ${repo.name}`).join('\n');
  
  await ctx.editMessageText(
    `📁 *Proyecto: ${projectName}*\n\n*Repositorios:*\n${reposList}\n\n*💬 Modo Chat Activo*\nEnvía cualquier mensaje para consultar con Claude CLI sobre este proyecto.\n\n*Ejemplo:* "Analiza la estructura del proyecto y sugiere mejoras"`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Volver a Proyectos', callback_data: 'view_projects' }]
        ]
      }
    }
  );
});

// Handle repository selection
bot.action(/^select_repo_(.+)_(.+)$/, async (ctx) => {
  const projectName = ctx.match[1];
  const repoName = ctx.match[2];
  const userId = ctx.from.id;
  const session = userSessions.get(userId);
  
  if (!session || session.step !== 'selecting_repos') {
    await ctx.answerCbQuery('❌ Sesión expirada');
    return;
  }
  
  // Toggle repository selection
  const selectedRepos = session.selectedRepos || [];
  const repoIndex = selectedRepos.findIndex(r => r.name === repoName);
  
  if (repoIndex >= 0) {
    // Remove from selection
    selectedRepos.splice(repoIndex, 1);
    await ctx.answerCbQuery(`➖ ${repoName} removido`);
  } else {
    // Add to selection (get full repo data from GitHub)
    try {
      const repos = await github.getRepositories('all', 'updated', 50);
      const fullRepo = repos.find(r => r.name === repoName);
      
      if (fullRepo) {
        selectedRepos.push({
          name: fullRepo.name,
          clone_url: fullRepo.clone_url,
          private: fullRepo.private,
          full_name: fullRepo.full_name
        });
        await ctx.answerCbQuery(`➕ ${repoName} añadido`);
      }
    } catch (error) {
      await ctx.answerCbQuery('❌ Error al obtener repositorio');
      return;
    }
  }
  
  // Update session
  userSessions.set(userId, { ...session, selectedRepos });
  
  // Update message with current selection
  const selectionText = selectedRepos.length > 0 
    ? `\n\n*✅ Seleccionados (${selectedRepos.length}):*\n${selectedRepos.map(r => `• ${r.name}`).join('\n')}`
    : '\n\n*No hay repositorios seleccionados*';
  
  try {
    const repos = await github.getRepositories('all', 'updated', 20);
    const repoButtons = repos.slice(0, 15).map(repo => {
      const isSelected = selectedRepos.some(r => r.name === repo.name);
      return [{
        text: `${isSelected ? '✅' : (repo.private ? '🔒' : '🌐')} ${repo.name}`,
        callback_data: `select_repo_${projectName}_${repo.name}`
      }];
    });
    
    repoButtons.push([{ text: '✅ Finalizar Selección', callback_data: `finish_project_${projectName}` }]);
    repoButtons.push([{ text: '❌ Cancelar', callback_data: 'main_menu' }]);
    
    await ctx.editMessageText(
      `✅ *Proyecto: ${projectName}*\n\n*Paso 2:* Selecciona los repositorios\n\nToca los repositorios que quieres incluir. Cuando termines, toca "✅ Finalizar Selección"${selectionText}`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: repoButtons }
      }
    );
  } catch (error) {
    console.error('Error updating selection:', error);
  }
});

// Handle project finalization (clone repositories)
bot.action(/^finish_project_(.+)$/, async (ctx) => {
  const projectName = ctx.match[1];
  const userId = ctx.from.id;
  const session = userSessions.get(userId);
  
  if (!session || session.step !== 'selecting_repos') {
    await ctx.answerCbQuery('❌ Sesión expirada');
    return;
  }
  
  const selectedRepos = session.selectedRepos || [];
  
  if (selectedRepos.length === 0) {
    await ctx.answerCbQuery('❌ Selecciona al menos un repositorio');
    return;
  }
  
  await ctx.editMessageText(
    `🚀 *Creando proyecto: ${projectName}*\n\n⏳ Clonando ${selectedRepos.length} repositorio(s)...\n\nEsto puede tomar unos minutos.`,
    { parse_mode: 'Markdown' }
  );
  
  try {
    // Create project in database
    projectsDB.createProject(projectName, selectedRepos);
    const projectPath = path.join(__dirname, '..', 'projects', projectName);
    
    // Create project directory structure
    await createProjectStructure(projectPath, selectedRepos);
    
    // Clone repositories
    const cloneResults = [];
    let successCount = 0;
    
    for (const repo of selectedRepos) {
      try {
        await ctx.editMessageText(
          `🚀 *Creando proyecto: ${projectName}*\n\n⏳ Clonando: ${repo.name}...\n\n${successCount}/${selectedRepos.length} completados`,
          { parse_mode: 'Markdown' }
        );
        
        await cloneRepository(repo.clone_url, projectPath, repo.name);
        cloneResults.push({ repo: repo.name, status: 'success' });
        successCount++;
      } catch (error) {
        console.error(`Error cloning ${repo.name}:`, error);
        cloneResults.push({ repo: repo.name, status: 'error', error: error.message });
      }
    }
    
    // Show final results
    const successRepos = cloneResults.filter(r => r.status === 'success');
    const errorRepos = cloneResults.filter(r => r.status === 'error');
    
    let resultMessage = `✅ *Proyecto creado: ${projectName}*\n\n`;
    resultMessage += `📁 *Ubicación:* projects/${projectName}/\n\n`;
    
    if (successRepos.length > 0) {
      resultMessage += `*✅ Repositorios clonados (${successRepos.length}):*\n`;
      resultMessage += successRepos.map(r => `• ${r.repo}`).join('\n');
    }
    
    if (errorRepos.length > 0) {
      resultMessage += `\n\n*❌ Errores (${errorRepos.length}):*\n`;
      resultMessage += errorRepos.map(r => `• ${r.repo}: ${r.error.substring(0, 50)}...`).join('\n');
    }
    
    resultMessage += `\n\n💬 *¡Ya puedes chatear con Claude sobre este proyecto!*`;
    
    await ctx.editMessageText(resultMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: `💬 Abrir ${projectName}`, callback_data: `project_${projectName}` }],
          [{ text: '🔙 Volver al Menú', callback_data: 'main_menu' }]
        ]
      }
    });
    
    // Clean up session
    userSessions.delete(userId);
    
  } catch (error) {
    console.error('Error creating project:', error);
    await ctx.editMessageText(
      `❌ *Error creando proyecto*\n\n${error.message}\n\nIntenta de nuevo.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Volver al Menú', callback_data: 'main_menu' }]
          ]
        }
      }
    );
    userSessions.delete(userId);
  }
});

// Handle text messages (project creation flow and Claude chat)
bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;
  const userId = ctx.from.id;
  const session = userSessions.get(userId);
  
  // Skip if it's a command
  if (userMessage.startsWith('/')) return;
  
  // Handle project creation flow
  if (session?.step === 'waiting_project_name') {
    const projectName = userMessage.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    if (projectsDB.getProject(projectName)) {
      await ctx.reply(`❌ *Error:* Ya existe un proyecto con el nombre "${projectName}"\n\nPor favor elige otro nombre.`, 
        { parse_mode: 'Markdown' });
      return;
    }
    
    // Get user's repositories
    try {
      await ctx.replyWithChatAction('typing');
      const repos = await github.getRepositories('all', 'updated', 20);
      
      if (repos.length === 0) {
        await ctx.reply(`❌ *Error:* No se encontraron repositorios en tu cuenta de GitHub.\n\nAsegúrate de tener al menos un repositorio.`, 
          { parse_mode: 'Markdown' });
        userSessions.delete(userId);
        return;
      }
      
      // Create buttons for repository selection
      const repoButtons = repos.slice(0, 15).map(repo => [{
        text: `${repo.private ? '🔒' : '🌐'} ${repo.name}`,
        callback_data: `select_repo_${projectName}_${repo.name}`
      }]);
      
      repoButtons.push([{ text: '✅ Finalizar Selección', callback_data: `finish_project_${projectName}` }]);
      repoButtons.push([{ text: '❌ Cancelar', callback_data: 'main_menu' }]);
      
      userSessions.set(userId, { 
        step: 'selecting_repos', 
        projectName, 
        selectedRepos: [] 
      });
      
      await ctx.reply(
        `✅ *Proyecto: ${projectName}*\n\n*Paso 2:* Selecciona los repositorios\n\nToca los repositorios que quieres incluir. Cuando termines, toca "✅ Finalizar Selección"`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: repoButtons }
        }
      );
      
    } catch (error) {
      console.error('Error getting repos:', error);
      await ctx.reply(`❌ *Error:* No se pudieron obtener los repositorios de GitHub.\n\n${error.message}`, 
        { parse_mode: 'Markdown' });
      userSessions.delete(userId);
    }
    return;
  }
  
  // Handle Claude chat in project context
  if (session?.step === 'in_project') {
    try {
      await ctx.replyWithChatAction('typing');
      
      // Build context-aware prompt with actual file system access
      const project = projectsDB.getProject(session.projectName);
      const repoNames = project.repos.map(r => r.name).join(', ');
      
      const contextPrompt = `CONTEXTO DEL PROYECTO:
- Proyecto: "${session.projectName}"
- Repositorios disponibles: ${repoNames}
- Ubicación: ${session.projectPath}
- Tienes acceso completo al sistema de archivos de este workspace

INSTRUCCIONES:
1. Ejecuta desde el directorio del proyecto: ${session.projectPath}
2. Puedes usar comandos como 'ls', 'find', 'cat', etc. para explorar
3. Analiza la estructura de archivos y código cuando sea relevante
4. Responde con contexto específico del proyecto actual

PREGUNTA/SOLICITUD DEL USUARIO:
${userMessage}`;
      
      // Execute Claude with project context (run from project directory)
      const claudeResponse = await executeClaudeCommandWithContext(contextPrompt, session.projectPath);
      
      let response = `🤖 *Claude responde (${session.projectName}):*\n\n${claudeResponse.output}`;
      
      // Split long messages if needed
      if (response.length > 4000) {
        const chunks = response.match(/.{1,4000}/g) || [response];
        for (let i = 0; i < chunks.length; i++) {
          await ctx.reply(chunks[i], { parse_mode: 'Markdown' });
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else {
        await ctx.reply(response, { parse_mode: 'Markdown' });
      }
      
    } catch (error) {
      console.error('Error communicating with Claude:', error);
      await ctx.reply(`❌ *Error:* ${escapeMarkdown(error.message)}`, { parse_mode: 'Markdown' });
    }
    return;
  }
  
  // Default: show help about using the menu
  await ctx.reply(
    `💡 *Tip:* Usa /start para acceder al menú principal y crear/seleccionar un proyecto antes de chatear con Claude.`,
    { parse_mode: 'Markdown' }
  );
});

// Linear commands
bot.command('linear', async (ctx) => {
  try {
    await ctx.replyWithChatAction('typing');
    
    const teams = await linear.getTeams();
    const projects = await linear.getProjects();
    
    let message = `📋 *Linear - Resumen*\n\n`;
    message += `👥 **Equipos:** ${teams.length}\n`;
    message += `📁 **Proyectos:** ${projects.length}\n\n`;
    
    message += `*Comandos disponibles:*\n`;
    message += `• /linear_teams - Ver todos los equipos\n`;
    message += `• /linear_projects - Ver todos los proyectos\n`;
    
    await ctx.replyWithMarkdown(message);
    
  } catch (error) {
    console.error('Error accessing Linear:', error);
    await ctx.replyWithMarkdown(`❌ *Error accediendo a Linear:* ${escapeMarkdown(error.message)}`);
  }
});

bot.command('linear_teams', async (ctx) => {
  try {
    await ctx.replyWithChatAction('typing');
    const teams = await linear.getTeams();
    const formattedTeams = linear.formatTeamsForTelegram(teams);
    await ctx.replyWithMarkdown(formattedTeams);
  } catch (error) {
    console.error('Error getting Linear teams:', error);
    await ctx.replyWithMarkdown(`❌ *Error:* ${escapeMarkdown(error.message)}`);
  }
});

bot.command('linear_projects', async (ctx) => {
  try {
    await ctx.replyWithChatAction('typing');
    const projects = await linear.getProjects();
    const formattedProjects = linear.formatProjectsForTelegram(projects);
    await ctx.replyWithMarkdown(formattedProjects);
  } catch (error) {
    console.error('Error getting Linear projects:', error);
    await ctx.replyWithMarkdown(`❌ *Error:* ${escapeMarkdown(error.message)}`);
  }
});

// GitHub commands
bot.command('github', async (ctx) => {
  try {
    await ctx.replyWithChatAction('typing');
    
    const user = await github.testConnection();
    const repos = await github.getRepositories('all', 'updated', 10);
    
    let message = `🐙 *GitHub - Resumen*\n\n`;
    message += `👤 **Usuario:** ${user.username} (${user.name || 'Sin nombre'})\n`;
    message += `📂 **Repos públicos:** ${user.public_repos}\n`;
    message += `🔒 **Repos privados:** ${user.private_repos}\n\n`;
    
    message += `*Comandos disponibles:*\n`;
    message += `• /github_repos - Ver repositorios disponibles\n`;
    
    await ctx.replyWithMarkdown(message);
    
  } catch (error) {
    console.error('Error accessing GitHub:', error);
    await ctx.replyWithMarkdown(`❌ *Error accediendo a GitHub:* ${escapeMarkdown(error.message)}`);
  }
});

bot.command('github_repos', async (ctx) => {
  try {
    await ctx.replyWithChatAction('typing');
    const repos = await github.getRepositories('all', 'updated', 15);
    const formattedRepos = github.formatRepositoriesForTelegram(repos, 10);
    await ctx.replyWithMarkdown(formattedRepos);
  } catch (error) {
    console.error('Error getting GitHub repos:', error);
    await ctx.replyWithMarkdown(`❌ *Error:* ${escapeMarkdown(error.message)}`);
  }
});

// Status command
bot.command('status', async (ctx) => {
  try {
    let statusMessage = `⚙️ *Estado del Sistema*\n\n`;
    
    // Test Claude CLI
    try {
      await executeClaudeCommand('Hello Claude, respond with just "OK" if you are working');
      statusMessage += `🤖 **Claude CLI:** ✅ Funcionando\n`;
    } catch (error) {
      statusMessage += `🤖 **Claude CLI:** ❌ Error: ${error.message.substring(0, 50)}...\n`;
    }
    
    // Test Linear API
    try {
      await linear.testConnection();
      statusMessage += `📋 **Linear API:** ✅ Conectado\n`;
    } catch (error) {
      statusMessage += `📋 **Linear API:** ❌ Error de conexión\n`;
    }
    
    // Test GitHub API
    try {
      await github.testConnection();
      statusMessage += `🐙 **GitHub API:** ✅ Conectado\n`;
    } catch (error) {
      statusMessage += `🐙 **GitHub API:** ❌ Error de conexión\n`;
    }
    
    statusMessage += `\n🕐 **Tiempo:** ${new Date().toLocaleString()}`;
    
    await ctx.replyWithMarkdown(statusMessage);
    
  } catch (error) {
    console.error('Error checking status:', error);
    await ctx.replyWithMarkdown(`❌ *Error verificando estado:* ${escapeMarkdown(error.message)}`);
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ Ocurrió un error inesperado. Por favor intenta de nuevo.');
});

// Start bot
console.log('🚀 Starting Telegram Task Agent - Direct Chat Mode...');
bot.launch().then(() => {
  console.log('✅ Bot started successfully! Direct chat with Claude CLI enabled.');
}).catch(err => {
  console.error('❌ Failed to start bot:', err);
  process.exit(1);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));