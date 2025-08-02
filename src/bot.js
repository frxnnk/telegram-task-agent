const { Telegraf } = require('telegraf');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize modules
const LinearManager = require('./integrations/LinearManager');
const GitHubManager = require('./integrations/GitHubManager');

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

// Start command
bot.start((ctx) => {
  const startMessage = `🤖 *Telegram Task Agent - Chat Directo*

¡Hola! Soy tu asistente con acceso directo a Claude CLI.

*📋 Comandos disponibles:*
• 📨 Envía cualquier mensaje para chat directo con Claude
• 📊 /linear - Ver proyectos y tareas de Linear
• 🐙 /github - Ver repositorios de GitHub
• ❓ /help - Ver ayuda completa

*💬 Chat Directo:*
Simplemente escribe tu pregunta o solicitud y te responderé usando Claude CLI en tiempo real.

*Ejemplo:*
"Explícame qué es React y cómo crear un componente básico"

¡Empecemos! 🚀`;

  ctx.replyWithMarkdown(startMessage);
});

// Help command
bot.help((ctx) => {
  const helpMessage = `📚 *Ayuda - Telegram Task Agent*

*🎯 ¿Qué hago?*
Soy un bot que te permite chatear directamente con Claude CLI y acceder a tus herramientas de desarrollo.

*💬 Chat Directo con Claude:*
• Envía cualquier mensaje para obtener respuestas de Claude
• Análisis de código, explicaciones técnicas, ayuda con programación
• Genera código, revisa implementaciones, sugiere mejoras

*📋 Comandos Linear:*
• /linear - Ver equipos y proyectos
• /linear_teams - Listar todos los equipos
• /linear_projects - Listar todos los proyectos

*🐙 Comandos GitHub:*
• /github - Ver repositorios disponibles
• /github_repos - Listar repositorios con permisos

*⚙️ Sistema:*
• /status - Estado del sistema
• /help - Esta ayuda

*Ejemplos de uso:*
"¿Cómo implementar autenticación JWT en Node.js?"
"Revisa este código y sugiere mejoras: [código]"
"Explícame los hooks de React con ejemplos"`;

  ctx.replyWithMarkdown(helpMessage);
});

// Handle direct messages to Claude
bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;
  
  // Skip if it's a command
  if (userMessage.startsWith('/')) return;
  
  try {
    // Show typing indicator
    await ctx.replyWithChatAction('typing');
    
    // Send message to Claude CLI
    const claudeResponse = await executeClaudeCommand(userMessage);
    
    // Format and send response
    let response = `🤖 *Claude responde:*\n\n${claudeResponse.output}`;
    
    // Split long messages if needed
    if (response.length > 4000) {
      const chunks = response.match(/.{1,4000}/g) || [response];
      for (let i = 0; i < chunks.length; i++) {
        await ctx.reply(chunks[i], { parse_mode: 'Markdown' });
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between chunks
        }
      }
    } else {
      await ctx.replyWithMarkdown(response);
    }
    
  } catch (error) {
    console.error('Error communicating with Claude:', error);
    await ctx.replyWithMarkdown(`❌ *Error:* ${escapeMarkdown(error.message)}`);
  }
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