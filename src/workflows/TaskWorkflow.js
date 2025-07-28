const { StateGraph, START, END } = require('@langchain/langgraph');
const { MemorySaver } = require('@langchain/langgraph');
const { ChatAnthropic } = require('@langchain/anthropic');
const { TaskState } = require('../state/TaskState');
const Docker = require('dockerode');
const { v4: uuidv4 } = require('uuid');

class TaskWorkflow {
  constructor(telegramBot) {
    this.bot = telegramBot;
    this.docker = new Docker();
    this.llm = new ChatAnthropic({
      apiKey: process.env.CLAUDE_API_KEY,
      model: 'claude-3-5-sonnet-20241022'
    });
    
    // Crear el workflow
    this.workflow = this.createWorkflow();
    this.checkpointer = new MemorySaver();
    this.app = this.workflow.compile({ checkpointer: this.checkpointer });
  }

  createWorkflow() {
    const workflow = new StateGraph(TaskState);

    // Nodos del workflow
    workflow.addNode('atomizer', this.atomizeProject.bind(this));
    workflow.addNode('validator', this.validateTasks.bind(this));
    workflow.addNode('executor', this.executeTask.bind(this));
    workflow.addNode('monitor', this.monitorExecution.bind(this));
    workflow.addNode('finalizer', this.finalizeTasks.bind(this));

    // Edges del grafo
    workflow.addEdge(START, 'atomizer');
    workflow.addEdge('atomizer', 'validator');
    
    workflow.addConditionalEdges(
      'validator',
      this.shouldExecute.bind(this),
      {
        'execute': 'executor',
        'retry': 'atomizer',
        'end': END
      }
    );

    workflow.addEdge('executor', 'monitor');
    
    workflow.addConditionalEdges(
      'monitor',
      this.checkExecutionStatus.bind(this),
      {
        'continue': 'executor',
        'finalize': 'finalizer',
        'pause': END,
        'fail': 'finalizer'
      }
    );

    workflow.addEdge('finalizer', END);

    return workflow;
  }

  // Nodo: Atomizar proyecto en tareas
  async atomizeProject(state) {
    console.log('🔬 Atomizando proyecto...');
    
    const atomizationPrompt = `
Eres un experto PM que atomiza proyectos en tareas ejecutables por agentes de código.

PROYECTO: "${state.projectDescription}"

Tu tarea es descomponer este proyecto en tareas atómicas que cumplan:
1. Cada tarea completable en una sesión (max 5k tokens)
2. Dependencias claras entre tareas
3. Orden de ejecución lógico
4. Estimación de complejidad por tokens

Responde en formato JSON:
{
  "tasks": [
    {
      "id": "task_001",
      "title": "Título descriptivo",
      "description": "Descripción detallada de qué hacer",
      "dependencies": ["task_000"], // IDs de tareas que deben completarse antes
      "estimated_tokens": 1500,
      "type": "setup|backend|frontend|testing|deployment",
      "priority": 1
    }
  ],
  "execution_order": ["task_001", "task_002", ...],
  "estimated_total_cost": 2.40
}
`;

    try {
      const response = await this.llm.invoke([{ 
        role: 'user', 
        content: atomizationPrompt 
      }]);

      const atomizedData = JSON.parse(response.content);
      
      state.setAtomizedTasks(atomizedData.tasks);
      state.addMessage(`✅ Proyecto atomizado en ${atomizedData.tasks.length} tareas`);
      
      // Notificar al usuario via Telegram
      await this.notifyUser(state, `
🔬 *Proyecto Atomizado*

📊 ${atomizedData.tasks.length} tareas creadas
💰 Costo estimado: $${atomizedData.estimated_total_cost}

${atomizedData.tasks.slice(0, 3).map((task, i) => 
  `${i+1}. ${task.title} (${task.estimated_tokens} tokens)`
).join('\n')}

${atomizedData.tasks.length > 3 ? `\n... y ${atomizedData.tasks.length - 3} más` : ''}

/start_execution para comenzar
      `);

      return state;

    } catch (error) {
      console.error('Error atomizando proyecto:', error);
      state.addMessage(`❌ Error en atomización: ${error.message}`);
      state.status = 'failed';
      return state;
    }
  }

  // Nodo: Validar tareas y dependencias
  async validateTasks(state) {
    console.log('✅ Validando tareas...');
    
    // Validar que todas las dependencias existen
    const taskIds = state.atomizedTasks.map(t => t.id);
    let isValid = true;
    
    for (const task of state.atomizedTasks) {
      for (const depId of task.dependencies || []) {
        if (!taskIds.includes(depId)) {
          state.addMessage(`❌ Dependencia inválida: ${task.id} requiere ${depId}`);
          isValid = false;
        }
      }
    }

    if (isValid) {
      state.addMessage('✅ Todas las tareas son válidas');
      state.status = 'validated';
    } else {
      state.status = 'validation_failed';
    }

    return state;
  }

  // Nodo: Ejecutar tarea
  async executeTask(state) {
    const readyTasks = state.getReadyTasks();
    
    if (readyTasks.length === 0) {
      state.addMessage('⏳ No hay tareas listas para ejecutar');
      return state;
    }

    // Ejecutar la primera tarea lista
    const task = readyTasks[0];
    console.log(`🚀 Ejecutando tarea: ${task.title}`);
    
    state.startTask(task.id);
    
    await this.notifyUser(state, `
🚀 *Ejecutando Tarea*

🆔 ID: ${task.id}
📝 ${task.title}
⏱️ Est: ${task.estimated_tokens} tokens
    `);

    try {
      // Crear contenedor Docker para la tarea
      const container = await this.createTaskContainer(task, state);
      state.setDockerContainer(task.id, container.id);
      
      // Iniciar contenedor
      await container.start();
      
      state.addMessage(`🐳 Contenedor iniciado: ${container.id.substring(0, 12)}`);
      
      return state;

    } catch (error) {
      console.error(`Error ejecutando tarea ${task.id}:`, error);
      state.failTask(task.id, error.message);
      return state;
    }
  }

  // Nodo: Monitorear ejecución
  async monitorExecution(state) {
    if (!state.currentTask) {
      return state;
    }

    console.log(`📊 Monitoreando tarea: ${state.currentTask}`);
    
    const containerId = state.dockerContainers[state.currentTask];
    if (!containerId) {
      state.failTask(state.currentTask, 'No se encontró contenedor');
      return state;
    }

    try {
      const container = this.docker.getContainer(containerId);
      const containerInfo = await container.inspect();
      
      if (containerInfo.State.Status === 'exited') {
        if (containerInfo.State.ExitCode === 0) {
          // Tarea completada exitosamente
          state.completeTask(state.currentTask, {
            exitCode: containerInfo.State.ExitCode,
            finishedAt: containerInfo.State.FinishedAt
          });
          
          await this.notifyUser(state, `
✅ *Tarea Completada*

🆔 ${state.currentTask}
✨ Exitosa (código 0)
📊 Progreso: ${state.getProgress().percentage}%
          `);
          
        } else {
          // Tarea falló
          state.failTask(state.currentTask, `Contenedor falló con código ${containerInfo.State.ExitCode}`);
          
          await this.notifyUser(state, `
❌ *Tarea Falló*

🆔 ${state.currentTask}
🔥 Código de salida: ${containerInfo.State.ExitCode}
          `);
        }
        
        // Limpiar contenedor
        await container.remove();
      }
      
      return state;

    } catch (error) {
      console.error('Error monitoreando contenedor:', error);
      state.failTask(state.currentTask, error.message);
      return state;
    }
  }

  // Nodo: Finalizar tareas
  async finalizeTasks(state) {
    console.log('🏁 Finalizando ejecución...');
    
    if (state.isCompleted()) {
      state.status = 'completed';
      state.endTime = new Date();
      
      await this.notifyUser(state, `
🎉 *Proyecto Completado!*

✅ ${state.completedTasks.length}/${state.atomizedTasks.length} tareas
💰 Costo total: $${state.totalCost.toFixed(3)}
⏱️ Tiempo: ${this.getExecutionTime(state)}

¡Excelente trabajo! 🚀
      `);
      
    } else if (state.hasFailed()) {
      state.status = 'failed';
      
      await this.notifyUser(state, `
💥 *Proyecto Falló*

❌ ${state.failedTasks.length} tareas fallaron
✅ ${state.completedTasks.length} completadas
🔄 Usa /retry para intentar de nuevo
      `);
    }
    
    return state;
  }

  // Funciones condicionales
  shouldExecute(state) {
    if (state.status === 'validation_failed') {
      return 'retry';
    }
    if (state.status === 'validated') {
      return 'execute';
    }
    return 'end';
  }

  checkExecutionStatus(state) {
    if (state.status === 'paused') {
      return 'pause';
    }
    if (state.hasFailed()) {
      return 'fail';
    }
    if (state.isCompleted()) {
      return 'finalize';
    }
    if (state.getReadyTasks().length > 0) {
      return 'continue';
    }
    return 'finalize';
  }

  // Métodos auxiliares
  async createTaskContainer(task, state) {
    const container = await this.docker.createContainer({
      Image: 'node:18-alpine',
      Cmd: ['/bin/sh', '-c', `
        echo "=== Iniciando tarea: ${task.title} ===";
        echo "Descripción: ${task.description}";
        echo "Tipo: ${task.type}";
        echo "Tokens estimados: ${task.estimated_tokens}";
        
        # Simular trabajo específico por tipo
        case "${task.type}" in
          "setup")
            echo "Configurando entorno...";
            sleep 3;
            echo "Creando estructura de archivos...";
            sleep 2;
            ;;
          "backend")
            echo "Desarrollando backend...";
            sleep 5;
            echo "Configurando APIs...";
            sleep 3;
            ;;
          "frontend")
            echo "Creando interfaz...";
            sleep 4;
            echo "Aplicando estilos...";
            sleep 2;
            ;;
          *)
            echo "Ejecutando tarea genérica...";
            sleep 3;
            ;;
        esac
        
        echo "=== Tarea ${task.id} completada exitosamente ===";
      `],
      WorkingDir: '/workspace',
      name: `task-${task.id}-${uuidv4().substring(0, 8)}`
    });

    return container;
  }

  async notifyUser(state, message) {
    if (this.bot && state.projectId) {
      try {
        await this.bot.telegram.sendMessage(state.projectId, message, { 
          parse_mode: 'Markdown' 
        });
      } catch (error) {
        console.error('Error enviando notificación:', error);
      }
    }
  }

  getExecutionTime(state) {
    if (state.startTime && state.endTime) {
      const diff = state.endTime - state.startTime;
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
    return 'calculando...';
  }

  // Método principal para ejecutar workflow
  async executeWorkflow(projectDescription, chatId) {
    const state = new TaskState();
    state.setProject(chatId, projectDescription);
    
    try {
      const config = { configurable: { thread_id: `project-${chatId}` } };
      const result = await this.app.invoke(state, config);
      return result;
    } catch (error) {
      console.error('Error ejecutando workflow:', error);
      throw error;
    }
  }
}

module.exports = { TaskWorkflow };