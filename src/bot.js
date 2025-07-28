require('dotenv').config();
const { Telegraf } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const { TaskWorkflow } = require('./workflows/TaskWorkflow');

class TaskBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.db = new sqlite3.Database('./data/tasks.db');
    this.workflow = new TaskWorkflow(this.bot);
    this.activeProjects = new Map(); // chatId -> projectState
    
    this.initDatabase();
    this.setupCommands();
  }

  initDatabase() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        atomized_tasks TEXT,
        total_cost REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME
      )
    `);
  }

  setupCommands() {
    // Comando de inicio
    this.bot.start((ctx) => {
      ctx.reply(`
🤖 *Task Agent v2.0 + LangGraph*

Comandos disponibles:
/project "descripción completa del proyecto" - Crear y atomizar proyecto
/status - Ver estado del proyecto actual
/start_execution - Iniciar ejecución de tareas atomizadas
/pause - Pausar ejecución
/resume - Reanudar ejecución
/stop - Detener proyecto actual
/progress - Ver progreso detallado

*Powered by LangGraph workflow orchestration* 🚀
      `, { parse_mode: 'Markdown' });
    });

    // Crear nuevo proyecto
    this.bot.command('project', async (ctx) => {
      const description = ctx.message.text.split(' ').slice(1).join(' ');
      
      if (!description) {
        return ctx.reply('❌ Necesitas proporcionar una descripción del proyecto\n\nEjemplo: /project "Crear API REST con autenticación y CRUD de usuarios"');
      }

      const chatId = ctx.chat.id;
      
      if (this.activeProjects.has(chatId)) {
        return ctx.reply('⚠️ Ya tienes un proyecto activo. Usa /stop para terminarlo primero.');
      }

      await this.createProject(description, chatId, ctx);
    });

    // Iniciar ejecución
    this.bot.command('start_execution', async (ctx) => {
      const chatId = ctx.chat.id;
      const project = this.activeProjects.get(chatId);
      
      if (!project || project.status !== 'atomized') {
        return ctx.reply('❌ No tienes un proyecto listo para ejecutar. Usa /project primero.');
      }

      await this.startExecution(chatId, ctx);
    });

    // Ver estado
    this.bot.command('status', async (ctx) => {
      await this.showStatus(ctx);
    });

    // Ver progreso detallado
    this.bot.command('progress', async (ctx) => {
      await this.showProgress(ctx);
    });

    // Pausar ejecución
    this.bot.command('pause', async (ctx) => {
      await this.pauseExecution(ctx);
    });

    // Reanudar ejecución
    this.bot.command('resume', async (ctx) => {
      await this.resumeExecution(ctx);
    });

    // Detener proyecto
    this.bot.command('stop', async (ctx) => {
      await this.stopProject(ctx);
    });
  }

  async createProject(description, chatId, ctx) {
    try {
      ctx.reply('🔬 Atomizando proyecto con IA...');
      
      // Ejecutar workflow de LangGraph
      const result = await this.workflow.executeWorkflow(description, chatId);
      
      // Guardar proyecto en base de datos
      const projectId = await new Promise((resolve, reject) => {
        this.db.run(
          'INSERT INTO projects (chat_id, description, status, atomized_tasks) VALUES (?, ?, ?, ?)',
          [chatId, description, 'atomized', JSON.stringify(result.atomizedTasks)],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      // Almacenar en memoria
      this.activeProjects.set(chatId, {
        id: projectId,
        description,
        status: 'atomized',
        workflow: result
      });

    } catch (error) {
      console.error('Error creando proyecto:', error);
      ctx.reply('❌ Error atomizando proyecto: ' + error.message);
    }
  }

  async startExecution(chatId, ctx) {
    const project = this.activeProjects.get(chatId);
    
    try {
      ctx.reply('🚀 Iniciando ejecución del proyecto...');
      
      // Continuar workflow desde donde se quedó
      const config = { configurable: { thread_id: `project-${chatId}` } };
      project.workflow.status = 'executing';
      
      await this.workflow.app.invoke(project.workflow, config);
      
      project.status = 'executing';
      
    } catch (error) {
      console.error('Error iniciando ejecución:', error);
      ctx.reply('❌ Error iniciando ejecución: ' + error.message);
    }
  }

  async showStatus(ctx) {
    const chatId = ctx.chat.id;
    const project = this.activeProjects.get(chatId);
    
    if (!project) {
      return ctx.reply('📭 No tienes proyectos activos\n\nUsa /project "descripción" para crear uno');
    }

    const progress = project.workflow.getProgress();
    
    ctx.reply(`
📊 *Estado del Proyecto*

📝 ${project.description}
🔄 Estado: ${project.status}
📈 Progreso: ${progress.percentage}%
✅ Completadas: ${progress.completed}
🔥 Fallidas: ${progress.failed}
⏳ Pendientes: ${progress.pending}
💰 Costo: $${project.workflow.totalCost.toFixed(3)}
    `, { parse_mode: 'Markdown' });
  }

  async showProgress(ctx) {
    const chatId = ctx.chat.id;
    const project = this.activeProjects.get(chatId);
    
    if (!project) {
      return ctx.reply('❌ No hay proyecto activo');
    }

    const tasks = Object.values(project.workflow.executionGraph);
    const statusEmoji = {
      'pending': '⚪',
      'running': '🔵',
      'completed': '✅',
      'failed': '❌',
      'paused': '⏸️'
    };

    const taskList = tasks.slice(0, 8).map(task => 
      `${statusEmoji[task.status]} ${task.title} (${task.estimated_tokens} tokens)`
    ).join('\n');

    ctx.reply(`
📋 *Progreso Detallado*

${taskList}
${tasks.length > 8 ? `\n... y ${tasks.length - 8} tareas más` : ''}

📊 Resumen:
• Total: ${tasks.length} tareas
• Completadas: ${project.workflow.completedTasks.length}
• Activa: ${project.workflow.currentTask || 'ninguna'}
    `, { parse_mode: 'Markdown' });
  }

  async pauseExecution(ctx) {
    const chatId = ctx.chat.id;
    const project = this.activeProjects.get(chatId);
    
    if (!project || project.status !== 'executing') {
      return ctx.reply('❌ No hay ejecución activa para pausar');
    }

    try {
      project.workflow.pauseExecution();
      project.status = 'paused';
      
      ctx.reply('⏸️ Proyecto pausado exitosamente');
    } catch (error) {
      ctx.reply('❌ Error pausando proyecto: ' + error.message);
    }
  }

  async resumeExecution(ctx) {
    const chatId = ctx.chat.id;
    const project = this.activeProjects.get(chatId);
    
    if (!project || project.status !== 'paused') {
      return ctx.reply('❌ No hay proyecto pausado para reanudar');
    }

    try {
      project.workflow.resumeExecution();
      project.status = 'executing';
      
      // Continuar workflow
      const config = { configurable: { thread_id: `project-${chatId}` } };
      await this.workflow.app.invoke(project.workflow, config);
      
      ctx.reply('▶️ Proyecto reanudado exitosamente');
    } catch (error) {
      ctx.reply('❌ Error reanudando proyecto: ' + error.message);
    }
  }

  async stopProject(ctx) {
    const chatId = ctx.chat.id;
    const project = this.activeProjects.get(chatId);
    
    if (!project) {
      return ctx.reply('❌ No hay proyecto activo para detener');
    }

    try {
      // Detener contenedores activos
      const dockerContainers = Object.values(project.workflow.dockerContainers);
      for (const containerId of dockerContainers) {
        try {
          const container = this.workflow.docker.getContainer(containerId);
          await container.stop();
          await container.remove();
        } catch (error) {
          console.log(`Container ${containerId} ya no existe`);
        }
      }
      
      // Limpiar estado
      this.activeProjects.delete(chatId);
      
      // Actualizar base de datos
      this.db.run(
        'UPDATE projects SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['stopped', project.id]
      );
      
      ctx.reply('🛑 Proyecto detenido y limpiado');
    } catch (error) {
      ctx.reply('❌ Error deteniendo proyecto: ' + error.message);
    }
  }

  start() {
    console.log('🤖 Task Agent Bot iniciando...');
    this.bot.launch();
    
    // Cleanup al salir
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }
}

// Inicializar y arrancar el bot
const bot = new TaskBot();
bot.start();