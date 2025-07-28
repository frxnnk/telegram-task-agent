require('dotenv').config();
const { Telegraf } = require('telegraf');
const TaskAtomizerCLI = require('./atomizer/TaskAtomizerCLI');
const DatabaseManager = require('./database/DatabaseManager');
const path = require('path');

class TelegramTaskBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.atomizer = new TaskAtomizerCLI();
    this.db = new DatabaseManager();
    this.projects = new Map(); // En memoria para el MVP
    
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