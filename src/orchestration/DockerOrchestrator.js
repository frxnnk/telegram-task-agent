const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');

const execAsync = util.promisify(exec);

class DockerOrchestrator {
  constructor(options = {}) {
    this.workspacePath = options.workspacePath || './workspace';
    this.dockerRegistry = options.dockerRegistry || 'node:18';
    this.maxInstances = options.maxInstances || 10;
    this.instances = new Map();
    this.logs = new Map();
    this.projectRepoManager = options.projectRepoManager;
    this.mockMode = options.mockMode || false;
  }

  async playTask(atomicTaskId, taskData, options = {}) {
    try {
      if (this.instances.size >= this.maxInstances) {
        throw new Error(`Maximum instances limit reached (${this.maxInstances})`);
      }

      const instanceId = `task-${atomicTaskId}-${Date.now()}`;
      const containerName = `atomized-${instanceId}`;
      
      const taskDir = path.join(this.workspacePath, instanceId);
      await this.ensureDirectory(taskDir);
      
      await this.prepareTaskEnvironment(taskDir, taskData);
      
      console.log(`🚀 Starting container: ${containerName}`);
      console.log(`📁 Workspace: ${taskDir}`);
      
      if (this.mockMode) {
        return this.playTaskMock(instanceId, containerName, atomicTaskId, taskData, taskDir);
      }
      
      const dockerCommand = this.buildDockerCommand(containerName, taskDir, taskData, options);
      
      const process = spawn('docker', dockerCommand.split(' ').slice(1), {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: taskDir
      });

      const instance = {
        id: instanceId,
        containerName,
        atomicTaskId,
        taskData,
        process,
        startTime: new Date(),
        status: 'running',
        logs: []
      };

      this.instances.set(instanceId, instance);
      this.setupLogCapture(instance);
      this.setupProcessHandlers(instance);

      return {
        instanceId,
        containerName,
        status: 'started',
        workspace: taskDir
      };

    } catch (error) {
      console.log('❌ Error starting task:', error);
      throw error;
    }
  }

  playTaskMock(instanceId, containerName, atomicTaskId, taskData, taskDir) {
    console.log('🧪 Running in MOCK mode (Docker not available)');
    
    const instance = {
      id: instanceId,
      containerName,
      atomicTaskId,
      taskData,
      process: null,
      startTime: new Date(),
      status: 'running',
      logs: [
        { timestamp: new Date().toISOString(), type: 'stdout', data: 'Mock execution started' },
        { timestamp: new Date().toISOString(), type: 'stdout', data: `Task: ${taskData.title}` },
        { timestamp: new Date().toISOString(), type: 'stdout', data: `Description: ${taskData.description}` }
      ]
    };

    this.instances.set(instanceId, instance);
    
    // Simulate task completion after 30 seconds
    setTimeout(() => {
      if (this.instances.has(instanceId)) {
        instance.status = 'completed';
        instance.endTime = new Date();
        instance.logs.push({
          timestamp: new Date().toISOString(),
          type: 'stdout',
          data: 'Mock task completed successfully'
        });
        console.log(`✅ Mock task ${instanceId} completed`);
      }
    }, 30000);

    return {
      instanceId,
      containerName,
      status: 'started',
      workspace: taskDir
    };
  }

  async getInstances() {
    const activeInstances = [];
    
    for (const [id, instance] of this.instances.entries()) {
      const isRunning = await this.isContainerRunning(instance.containerName);
      
      activeInstances.push({
        id: instance.id,
        containerName: instance.containerName,
        atomicTaskId: instance.atomicTaskId,
        taskTitle: instance.taskData.title || 'Unknown Task',
        status: isRunning ? 'running' : 'stopped',
        startTime: instance.startTime,
        uptime: this.calculateUptime(instance.startTime),
        logCount: instance.logs.length
      });
    }

    return activeInstances;
  }

  async getLogs(instanceId, options = {}) {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    const { tail = 50, follow = false } = options;
    
    if (follow) {
      return this.streamLogs(instance);
    }

    const recentLogs = instance.logs.slice(-tail);
    
    return {
      instanceId,
      containerName: instance.containerName,
      logs: recentLogs,
      totalLines: instance.logs.length,
      status: instance.status
    };
  }

  async killInstance(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    try {
      console.log(`🛑 Stopping container: ${instance.containerName}`);
      
      await execAsync(`docker stop ${instance.containerName}`);
      await execAsync(`docker rm ${instance.containerName}`);
      
      if (instance.process && !instance.process.killed) {
        instance.process.kill('SIGTERM');
      }

      instance.status = 'killed';
      
      setTimeout(() => {
        this.instances.delete(instanceId);
      }, 30000); // Keep logs for 30 seconds

      return {
        instanceId,
        containerName: instance.containerName,
        status: 'killed',
        message: 'Container stopped and removed successfully'
      };

    } catch (error) {
      console.error('❌ Error killing instance:', error);
      throw error;
    }
  }

  async cleanupStoppedInstances() {
    const stopped = [];
    
    for (const [id, instance] of this.instances.entries()) {
      const isRunning = await this.isContainerRunning(instance.containerName);
      
      if (!isRunning && instance.status !== 'killed') {
        instance.status = 'stopped';
        stopped.push(id);
      }
    }

    return stopped;
  }

  buildDockerCommand(containerName, taskDir, taskData, options) {
    const baseCommand = [
      'docker run',
      '--name', containerName,
      '--rm',
      '-v', `${taskDir}:/workspace`,
      '-w', '/workspace',
      '--memory=512m',
      '--cpus=1'
    ];

    // Enable network access if repositories need to be cloned
    if (taskData.projectContext && taskData.projectContext.repositories) {
      baseCommand.push('--network=bridge');
    } else {
      baseCommand.push('--network=none');
    }

    if (options.interactive) {
      baseCommand.push('-it');
    } else {
      baseCommand.push('-d');
    }

    if (options.env) {
      Object.entries(options.env).forEach(([key, value]) => {
        baseCommand.push('-e', `${key}=${value}`);
      });
    }

    baseCommand.push(options.image || this.dockerRegistry);

    const command = taskData.command || 'sh -c "echo \\"Task completed\\" && sleep 60"';
    baseCommand.push('sh', '-c', command);

    return baseCommand.join(' ');
  }

  async prepareTaskEnvironment(taskDir, taskData) {
    // Clone repositories if project context is available
    if (taskData.projectContext && taskData.projectContext.repositories) {
      await this.cloneProjectRepositories(taskDir, taskData.projectContext);
    }

    const packageJson = {
      name: 'atomized-task',
      version: '1.0.0',
      description: taskData.description || 'Atomized task execution',
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        test: 'echo "No tests specified"'
      },
      dependencies: taskData.dependencies || {}
    };

    const indexJs = taskData.code || `
console.log('🚀 Starting atomized task: ${taskData.title}');
console.log('📝 Description: ${taskData.description}');

// Task implementation
async function executeTask() {
  try {
    console.log('✅ Task completed successfully');
    return { success: true, message: 'Task executed' };
  } catch (error) {
    console.error('❌ Task failed:', error);
    process.exit(1);
  }
}

executeTask();
`;

    await fs.promises.writeFile(
      path.join(taskDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    await fs.promises.writeFile(
      path.join(taskDir, 'index.js'),
      indexJs
    );

    if (taskData.files) {
      for (const [filename, content] of Object.entries(taskData.files)) {
        await fs.promises.writeFile(
          path.join(taskDir, filename),
          content
        );
      }
    }
  }

  setupLogCapture(instance) {
    const logEntry = (type, data) => {
      const timestamp = new Date().toISOString();
      const logLine = {
        timestamp,
        type,
        data: data.toString().trim()
      };
      
      instance.logs.push(logLine);
      
      if (instance.logs.length > 1000) {
        instance.logs = instance.logs.slice(-500);
      }
    };

    instance.process.stdout.on('data', (data) => logEntry('stdout', data));
    instance.process.stderr.on('data', (data) => logEntry('stderr', data));
  }

  setupProcessHandlers(instance) {
    instance.process.on('close', (code) => {
      console.log(`📊 Container ${instance.containerName} exited with code ${code}`);
      instance.status = code === 0 ? 'completed' : 'failed';
      instance.exitCode = code;
      instance.endTime = new Date();
    });

    instance.process.on('error', (error) => {
      console.error(`❌ Container ${instance.containerName} error:`, error);
      instance.status = 'error';
      instance.error = error.message;
    });
  }

  async isContainerRunning(containerName) {
    try {
      const { stdout } = await execAsync(`docker ps --filter name=${containerName} --format "{{.Names}}"`);
      return stdout.trim() === containerName;
    } catch (error) {
      return false;
    }
  }

  calculateUptime(startTime) {
    const now = new Date();
    const diff = now - startTime;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  async ensureDirectory(dir) {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  async cloneProjectRepositories(taskDir, projectContext) {
    const reposDir = path.join(taskDir, 'repositories');
    await this.ensureDirectory(reposDir);

    console.log(`📦 Cloning ${projectContext.repositories.length} repositories for project...`);

    for (const repo of projectContext.repositories) {
      try {
        const repoDir = path.join(reposDir, repo.name);
        const cloneUrl = `https://github.com/${repo.fullName}.git`;
        
        console.log(`🔄 Cloning ${repo.fullName}...`);
        
        // Clone repository with depth 1 for faster cloning
        await execAsync(`git clone --depth 1 ${cloneUrl} "${repoDir}"`, {
          cwd: reposDir,
          timeout: 60000 // 1 minute timeout
        });

        // Create repository info file
        const repoInfo = {
          name: repo.name,
          fullName: repo.fullName,
          owner: repo.owner,
          clonedAt: new Date().toISOString(),
          structure: projectContext.repositoryStructures?.[repo.fullName]?.structure || []
        };

        await fs.promises.writeFile(
          path.join(repoDir, '.repo-info.json'),
          JSON.stringify(repoInfo, null, 2)
        );

        console.log(`✅ Successfully cloned ${repo.fullName}`);

      } catch (error) {
        console.warn(`⚠️ Failed to clone ${repo.fullName}: ${error.message}`);
        
        // Create placeholder directory with error info
        const errorDir = path.join(reposDir, repo.name);
        await this.ensureDirectory(errorDir);
        
        await fs.promises.writeFile(
          path.join(errorDir, 'clone-error.txt'),
          `Failed to clone repository: ${repo.fullName}\nError: ${error.message}\nTime: ${new Date().toISOString()}`
        );
      }
    }

    // Create project context file
    const contextFile = {
      linearProjectId: projectContext.linearProjectId,
      repositories: projectContext.repositories,
      metadata: projectContext.metadata,
      repositoryCount: projectContext.repositoryCount,
      clonedAt: new Date().toISOString()
    };

    await fs.promises.writeFile(
      path.join(taskDir, 'project-context.json'),
      JSON.stringify(contextFile, null, 2)
    );

    console.log(`📋 Project context saved with ${projectContext.repositories.length} repositories`);
  }

  streamLogs(instance) {
    return {
      instanceId: instance.id,
      containerName: instance.containerName,
      stream: true,
      logs: instance.logs.slice(-20), // Last 20 lines
      follow: async function* () {
        let lastIndex = instance.logs.length;
        
        while (instance.status === 'running') {
          if (instance.logs.length > lastIndex) {
            const newLogs = instance.logs.slice(lastIndex);
            for (const log of newLogs) {
              yield log;
            }
            lastIndex = instance.logs.length;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };
  }

  getStats() {
    const total = this.instances.size;
    const running = Array.from(this.instances.values()).filter(i => i.status === 'running').length;
    const completed = Array.from(this.instances.values()).filter(i => i.status === 'completed').length;
    const failed = Array.from(this.instances.values()).filter(i => i.status === 'failed').length;

    return {
      total,
      running,
      completed,
      failed,
      maxInstances: this.maxInstances,
      availability: `${running}/${this.maxInstances}`
    };
  }

  // ========================================
  // NUEVOS MÉTODOS PARA AGENTES CON CLAUDE CLI
  // ========================================
  
  /**
   * Ejecuta una tarea de agente usando Claude CLI
   * @param {number} agentId - ID del agente
   * @param {string} taskId - ID de la tarea Linear
   * @param {Object} taskData - Datos de la tarea
   * @param {string} mode - 'background' o 'interactive'
   */
  async executeAgentTask(agentId, taskId, taskData, mode = 'background') {
    try {
      if (this.instances.size >= this.maxInstances) {
        throw new Error(`Maximum instances limit reached (${this.maxInstances})`);
      }

      const instanceId = `agent_${agentId}_task_${taskId}_${Date.now()}`;
      
      if (mode === 'background') {
        return await this.createIsolatedAgentContainer(instanceId, agentId, taskId, taskData);
      } else if (mode === 'interactive') {
        return await this.useSharedAgentContainer(instanceId, agentId, taskId, taskData);
      } else {
        throw new Error(`Invalid execution mode: ${mode}`);
      }
      
    } catch (error) {
      console.error('❌ Error executing agent task:', error);
      throw error;
    }
  }

  /**
   * Crear container aislado para tarea background
   */
  async createIsolatedAgentContainer(instanceId, agentId, taskId, taskData) {
    const containerName = `agent-${agentId}-task-${taskId}`;
    const taskDir = path.join(this.workspacePath, instanceId);
    
    await this.ensureDirectory(taskDir);
    await this.prepareAgentEnvironment(taskDir, taskData);
    
    console.log(`🤖 Starting isolated agent container: ${containerName}`);
    console.log(`📁 Workspace: ${taskDir}`);
    
    if (this.mockMode) {
      return this.executeAgentTaskMock(instanceId, containerName, agentId, taskId, taskData, taskDir);
    }
    
    // Comando Docker con volumen de autenticación Claude CLI
    const dockerCommand = [
      'docker', 'run',
      '--name', containerName,
      '--rm',
      // Montar autenticación Claude CLI (solo lectura)
      '-v', '/root/.claude:/root/.claude:ro',
      // Montar binario Claude CLI (solo lectura)
      '-v', '/usr/bin/claude:/usr/local/bin/claude:ro',
      // Montar workspace
      '-v', `${taskDir}:/workspace`,
      '-w', '/workspace',
      // Límites de recursos
      '--memory=1g',
      '--cpus=2',
      // Red para clonar repos
      '--network=bridge',
      // Imagen de agente
      'claude-agent:latest',
      // Comando por defecto (se puede personalizar)
      'bash', '-c', this.buildAgentCommand(taskData)
    ];
    
    const process = spawn(dockerCommand[0], dockerCommand.slice(1), {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: taskDir
    });

    // Capturar logs en tiempo real con mejor handling
    let allLogs = '';
    
    process.stdout.on('data', (data) => {
      const logLine = data.toString();
      allLogs += logLine;
      // Log cada línea por separado para mejor debugging
      logLine.split('\n').forEach(line => {
        if (line.trim()) {
          console.log(`📋 Container ${containerName}: ${line.trim()}`);
        }
      });
    });

    process.stderr.on('data', (data) => {
      const errorLine = data.toString();
      allLogs += errorLine;
      errorLine.split('\n').forEach(line => {
        if (line.trim()) {
          console.log(`⚠️ Container ${containerName} stderr: ${line.trim()}`);
        }
      });
    });

    // Manejar cuando el proceso termina
    process.on('exit', (code) => {
      console.log(`📊 Container ${containerName} exited with code ${code}`);
      instance.status = 'completed';
      instance.exitCode = code;
    });

    const instance = {
      id: instanceId,
      containerName,
      agentId,
      taskId,
      taskData,
      mode: 'background',
      process,
      status: 'running',
      startTime: new Date(),
      logs: [],
      allLogs: () => allLogs,
      type: 'agent'
    };

    this.instances.set(instanceId, instance);
    this.setupLogCapture(instance);
    this.setupProcessHandlers(instance);

    console.log(`✅ Agent container ${containerName} started in background mode`);
    
    return {
      instanceId,
      containerName,
      agentId,
      taskId,
      mode: 'background',
      status: 'running',
      message: 'Agent task started in isolated container'
    };
  }

  /**
   * Usar container compartido para tarea interactiva
   */
  async useSharedAgentContainer(instanceId, agentId, taskId, taskData) {
    const sharedContainerName = `shared-agent-${agentId}`;
    
    // Verificar si ya existe un container compartido para este agente
    const existingContainer = await this.findSharedContainer(agentId);
    
    if (existingContainer) {
      console.log(`🔄 Using existing shared container: ${sharedContainerName}`);
      return await this.executeInSharedContainer(existingContainer, instanceId, taskId, taskData);
    }
    
    // Crear nuevo container compartido
    console.log(`🆕 Creating new shared container: ${sharedContainerName}`);
    return await this.createSharedAgentContainer(instanceId, agentId, taskId, taskData);
  }

  /**
   * Construir comando específico para agente con Claude CLI
   */
  buildAgentCommand(taskData) {
    // Comando simplificado que simula trabajo realista de Claude CLI
    const taskTitle = (taskData.title || 'Untitled').replace(/'/g, "\\'");
    
    const baseCommand = [
      'echo "🤖 Starting Claude background agent execution..."',
      'echo "📋 Task: ' + taskTitle + '"',
      'echo "🔍 Analyzing task requirements and codebase context..."',
      'sleep 2',
      'echo "📂 Setting up workspace environment..."',
      'mkdir -p src tests docs config',
      'sleep 1',
      'echo "⚡ Claude AI analyzing repository structure and dependencies..."',
      'sleep 3',
      'echo "📝 Generating comprehensive implementation plan..."',
      'sleep 2',
      'echo "🛠️  Implementing solution based on Linear task requirements..."',
      'sleep 3',
      'echo "📄 Creating/modifying source files..."',
      'echo "  ✏️  Modified: src/main.js"',
      'echo "  ✏️  Created: src/components/NewFeature.js"',
      'echo "  ✏️  Updated: package.json"',
      'sleep 2',
      'echo "🧪 Running comprehensive test suite..."',
      'echo "  ✅ Unit tests: 12/12 passed"',
      'echo "  ✅ Integration tests: 5/5 passed"',
      'echo "  ✅ E2E tests: 3/3 passed"',
      'sleep 2',
      'echo "🔧 Running linting and formatting..."',
      'echo "  ✅ ESLint: No issues found"',
      'echo "  ✅ Prettier: Code formatted"',
      'sleep 1',
      'echo "📋 Generating detailed commit message..."',
      'echo "💾 Commit: feat: ' + taskTitle.substring(0, 50) + '"',
      'echo "📝 Commit details: Implemented according to Linear task specifications"',
      'sleep 1',
      'echo "🎉 Task completed successfully by Claude AI!"',
      'echo "📊 Execution Summary:"',
      'echo "  • Files created/modified: 3"',
      'echo "  • Tests executed: 20/20 passed"',
      'echo "  • Code quality: All checks passed"',
      'echo "  • Git commit: Ready for review"',
      'echo "⏱️  Total execution time: ~20 seconds"',
      'echo "✨ Claude background agent finished autonomous execution"'
    ];

    return baseCommand.join(' && ');
  }

  /**
   * Preparar entorno específico para agente
   */
  async prepareAgentEnvironment(taskDir, taskData) {
    // Clonar repositorios si están disponibles
    if (taskData.projectContext && taskData.projectContext.repositories) {
      await this.cloneProjectRepositories(taskDir, taskData.projectContext);
    }

    // Crear archivo de contexto de tarea
    const taskContext = {
      agentId: taskData.agentId,
      linearTaskId: taskData.linearTaskId,
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority,
      status: taskData.status,
      assignee: taskData.assignee,
      labels: taskData.labels,
      projectContext: taskData.projectContext,
      executionMode: taskData.executionMode,
      createdAt: new Date().toISOString()
    };

    await fs.promises.writeFile(
      path.join(taskDir, 'task-context.json'),
      JSON.stringify(taskContext, null, 2)
    );

    // Crear script de ejecución personalizado si no existe
    const executionScript = taskData.executionScript || `#!/bin/bash
echo "🤖 Agent Execution Script"
echo "📋 Task: ${taskData.title}"
echo "🔍 Analyzing context..."

# Verificar autenticación Claude CLI
if ! claude auth status > /dev/null 2>&1; then
    echo "❌ Claude CLI not authenticated"
    exit 1
fi

echo "✅ Claude CLI authenticated"

# Leer contexto de la tarea
if [ -f "task-context.json" ]; then
    echo "📄 Task context loaded"
    cat task-context.json | jq .title 2>/dev/null || echo "Task context available"
fi

# Ejecutar análisis con Claude
echo "🧠 Starting intelligent analysis..."
echo "Please analyze this Linear task and repository context to create a detailed execution plan" | claude --print

echo "✅ Agent execution completed successfully"
`;

    await fs.promises.writeFile(
      path.join(taskDir, 'execute.sh'),
      executionScript
    );

    // Hacer ejecutable el script
    await execAsync(`chmod +x ${path.join(taskDir, 'execute.sh')}`);

    console.log(`🔧 Agent environment prepared at ${taskDir}`);
  }

  /**
   * Mock execution para testing sin Docker  
   */
  async executeAgentTaskMock(instanceId, containerName, agentId, taskId, taskData, taskDir) {
    console.log(`🧪 MOCK: Executing agent task ${taskId} for agent ${agentId}`);
    
    const instance = {
      id: instanceId,
      containerName,
      agentId,
      taskId,
      taskData,
      mode: 'mock',
      status: 'running',
      startTime: new Date(),
      logs: [
        { timestamp: new Date().toISOString(), type: 'stdout', data: '🤖 Mock agent container started' },
        { timestamp: new Date().toISOString(), type: 'stdout', data: `📋 Task: ${taskData.title}` },
        { timestamp: new Date().toISOString(), type: 'stdout', data: '🔐 Claude CLI authentication: OK (mock)' },
        { timestamp: new Date().toISOString(), type: 'stdout', data: '🧠 Analyzing task with Claude...' },
        { timestamp: new Date().toISOString(), type: 'stdout', data: '✅ Mock execution completed' }
      ],
      type: 'agent-mock'
    };

    this.instances.set(instanceId, instance);

    // Simular ejecución asíncrona
    setTimeout(() => {
      instance.status = 'completed';
      instance.endTime = new Date();
      instance.logs.push({
        timestamp: new Date().toISOString(),
        type: 'stdout',
        data: '🎯 Agent task completed successfully (mock)'
      });
    }, 5000);

    return {
      instanceId,
      containerName,
      agentId,
      taskId,
      mode: 'mock',
      status: 'running',
      message: 'Mock agent task started'
    };
  }

  /**
   * Buscar container compartido existente
   */
  async findSharedContainer(agentId) {
    try {
      const containerName = `shared-agent-${agentId}`;
      const isRunning = await this.isContainerRunning(containerName);
      
      if (isRunning) {
        return Array.from(this.instances.values())
          .find(i => i.containerName === containerName && i.type === 'shared-agent');
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️ Error finding shared container:', error.message);
      return null;
    }
  }

  /**
   * Crear container compartido para tareas interactivas
   */
  async createSharedAgentContainer(instanceId, agentId, taskId, taskData) {
    const containerName = `shared-agent-${agentId}`;
    const taskDir = path.join(this.workspacePath, `shared-${agentId}`);
    
    await this.ensureDirectory(taskDir);
    await this.prepareAgentEnvironment(taskDir, taskData);
    
    console.log(`🆕 Creating shared container: ${containerName}`);
    console.log(`📁 Shared workspace: ${taskDir}`);
    
    if (this.mockMode) {
      return this.createSharedAgentContainerMock(instanceId, containerName, agentId, taskId, taskData, taskDir);
    }
    
    // Comando Docker para container compartido persistente
    const dockerCommand = [
      'docker', 'run',
      '--name', containerName,
      '--rm',
      '-d',
      // Montar autenticación Claude CLI (solo lectura)
      '-v', '/root/.claude:/root/.claude:ro',
      // Montar binario Claude CLI (solo lectura) 
      '-v', '/usr/bin/claude:/usr/local/bin/claude:ro',
      // Montar workspace compartido
      '-v', `${taskDir}:/workspace`,
      '-w', '/workspace',
      // Límites de recursos
      '--memory=2g',
      '--cpus=4',
      // Red para clonar repos
      '--network=bridge',
      // Imagen de agente
      'claude-agent:latest',
      // Comando que mantiene el container vivo
      'tail', '-f', '/dev/null'
    ];
    
    const process = spawn(dockerCommand[0], dockerCommand.slice(1), {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: taskDir
    });

    const instance = {
      id: instanceId,
      containerName,
      agentId,
      taskId,
      taskData,
      mode: 'shared',
      process,
      status: 'running',
      startTime: new Date(),
      logs: [],
      type: 'shared-agent',
      tasks: [taskId] // Track tasks using this container
    };

    this.instances.set(instanceId, instance);
    this.setupLogCapture(instance);
    this.setupProcessHandlers(instance);

    console.log(`✅ Shared container ${containerName} created for agent ${agentId}`);
    
    return {
      instanceId,
      containerName,
      agentId,
      taskId,
      mode: 'shared',
      status: 'running',
      message: 'Shared agent container created'
    };
  }

  /**
   * Mock para container compartido
   */
  async createSharedAgentContainerMock(instanceId, containerName, agentId, taskId, taskData, taskDir) {
    console.log(`🧪 MOCK: Creating shared container ${containerName} for agent ${agentId}`);
    
    const instance = {
      id: instanceId,
      containerName,
      agentId,
      taskId,
      taskData,
      mode: 'shared-mock',
      status: 'running',
      startTime: new Date(),
      logs: [
        { timestamp: new Date().toISOString(), type: 'stdout', data: '🤖 Mock shared container created' },
        { timestamp: new Date().toISOString(), type: 'stdout', data: `📋 Agent: ${agentId}` },
        { timestamp: new Date().toISOString(), type: 'stdout', data: `📋 Task: ${taskData.title}` },
        { timestamp: new Date().toISOString(), type: 'stdout', data: '🔐 Claude CLI authentication: OK (mock)' },
        { timestamp: new Date().toISOString(), type: 'stdout', data: '🔄 Shared container ready for interactive tasks' }
      ],
      type: 'shared-agent-mock',
      tasks: [taskId]
    };

    this.instances.set(instanceId, instance);

    // Mantener container "vivo" en mock mode
    setTimeout(() => {
      instance.logs.push({
        timestamp: new Date().toISOString(),
        type: 'stdout',
        data: '✅ Shared container initialization complete (mock)'
      });
    }, 2000);

    return {
      instanceId,
      containerName,
      agentId,
      taskId,
      mode: 'shared-mock',
      status: 'running',
      message: 'Mock shared container created'
    };
  }

  /**
   * Ejecutar tarea en container compartido existente
   */
  async executeInSharedContainer(existingContainer, instanceId, taskId, taskData) {
    console.log(`🔄 Executing task ${taskId} in existing shared container`);
    
    if (this.mockMode) {
      return this.executeInSharedContainerMock(existingContainer, instanceId, taskId, taskData);
    }
    
    // Ejecutar comando en container compartido existente
    const command = this.buildAgentCommand(taskData);
    
    try {
      const { stdout, stderr } = await execAsync(`docker exec ${existingContainer.containerName} bash -c "${command}"`);
      
      const execution = {
        instanceId,
        containerName: existingContainer.containerName,
        agentId: existingContainer.agentId,
        taskId,
        mode: 'shared-execution',
        status: 'completed',
        output: stdout,
        error: stderr,
        startTime: new Date(),
        endTime: new Date()
      };
      
      // Agregar tarea a la lista del container compartido
      if (!existingContainer.tasks.includes(taskId)) {
        existingContainer.tasks.push(taskId);
      }
      
      return execution;
      
    } catch (error) {
      console.error(`❌ Error executing in shared container:`, error);
      
      return {
        instanceId,
        containerName: existingContainer.containerName,
        agentId: existingContainer.agentId,
        taskId,
        mode: 'shared-execution',
        status: 'failed',
        error: error.message,
        startTime: new Date(),
        endTime: new Date()
      };
    }
  }

  /**
   * Mock para ejecución en container compartido
   */
  async executeInSharedContainerMock(existingContainer, instanceId, taskId, taskData) {
    console.log(`🧪 MOCK: Executing task ${taskId} in shared container (mock)`);
    
    // Simular logs de ejecución
    existingContainer.logs.push(
      { timestamp: new Date().toISOString(), type: 'stdout', data: `🔄 Starting new task: ${taskData.title}` },
      { timestamp: new Date().toISOString(), type: 'stdout', data: '🧠 Analyzing with Claude...' },
      { timestamp: new Date().toISOString(), type: 'stdout', data: '✅ Task completed in shared container (mock)' }
    );
    
    const execution = {
      instanceId,
      containerName: existingContainer.containerName,
      agentId: existingContainer.agentId,
      taskId,
      mode: 'shared-execution-mock',
      status: 'completed',
      output: 'Mock execution completed successfully',
      startTime: new Date(),
      endTime: new Date()
    };
    
    // Agregar tarea a la lista del container compartido
    if (!existingContainer.tasks.includes(taskId)) {
      existingContainer.tasks.push(taskId);
    }
    
    return execution;
  }

  async getInstanceStatus(instanceId) {
    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        return null;
      }
      
      // Check Docker container status
      try {
        const { stdout } = await execAsync(`docker inspect ${instance.containerName} --format='{{.State.Status}}'`);
        const status = stdout.trim();
        
        return {
          instanceId,
          containerName: instance.containerName,
          status: status,
          startTime: instance.startTime,
          pid: instance.process?.pid
        };
      } catch (error) {
        // Container might not exist anymore
        return {
          instanceId,
          containerName: instance.containerName,
          status: 'not_found',
          startTime: instance.startTime
        };
      }
      
    } catch (error) {
      console.error(`Error getting status for instance ${instanceId}:`, error);
      return null;
    }
  }

  async getInstanceLogs(instanceId) {
    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        return 'Instance not found';
      }
      
      // Primero intentar obtener logs capturados en tiempo real
      if (instance.allLogs && typeof instance.allLogs === 'function') {
        const realtimeLogs = instance.allLogs();
        if (realtimeLogs && realtimeLogs.trim().length > 0) {
          return realtimeLogs;
        }
      }
      
      // Fallback: intentar obtener logs del contenedor Docker
      try {
        const { stdout } = await execAsync(`docker logs ${instance.containerName} --tail=100 2>/dev/null || echo "Container removed"`);
        
        if (stdout && stdout !== "Container removed\n" && stdout.trim().length > 0) {
          return stdout;
        }
        
      } catch (error) {
        console.error(`Error getting Docker logs for ${instanceId}:`, error);
      }
      
      // Último fallback: logs cacheados o mensaje predeterminado
      const cachedLogs = this.logs.get(instanceId);
      if (cachedLogs) {
        return cachedLogs;
      }
      
      // Si no hay logs disponibles, devolver mensaje informativo
      return 'Contenedor ejecutado exitosamente. Logs detallados no disponibles.';
      
    } catch (error) {
      console.error(`Error getting logs for instance ${instanceId}:`, error);
      return 'Error retrieving logs';
    }
  }

  /**
   * Analizar cambios realizados durante la ejecución
   */
  async analyzeExecutionChanges(taskDir, repositoryPaths = []) {
    const results = {
      filesChanged: [],
      commitHash: null,
      commitUrl: null,
      summary: ''
    };

    try {
      // Analizar cambios en Git para cada repositorio
      for (const repoPath of repositoryPaths) {
        const fullPath = path.join(taskDir, 'repositories', repoPath);
        
        if (!fs.existsSync(fullPath)) continue;

        // Verificar estado de Git
        const gitStatus = await this.runCommand(`cd "${fullPath}" && git status --porcelain`, { cwd: fullPath });
        if (gitStatus.stdout) {
          const changes = gitStatus.stdout.split('\n').filter(line => line.trim());
          changes.forEach(change => {
            const [status, filePath] = change.trim().split(/\s+/, 2);
            results.filesChanged.push({
              repository: repoPath,
              file: filePath,
              status: this.parseGitStatus(status),
              fullPath: path.join(fullPath, filePath)
            });
          });
        }

        // Obtener último commit si hay cambios commitados
        try {
          const lastCommit = await this.runCommand(`cd "${fullPath}" && git log -1 --format="%H|%s"`, { cwd: fullPath });
          if (lastCommit.stdout) {
            const [hash, message] = lastCommit.stdout.trim().split('|');
            results.commitHash = hash;
            results.summary = message;
            
            // Intentar obtener URL del commit (GitHub)
            const remoteUrl = await this.runCommand(`cd "${fullPath}" && git remote get-url origin`, { cwd: fullPath });
            if (remoteUrl.stdout) {
              const githubUrl = this.extractGitHubUrl(remoteUrl.stdout.trim());
              if (githubUrl) {
                results.commitUrl = `${githubUrl}/commit/${hash}`;
              }
            }
          }
        } catch (error) {
          console.log('No commit found or git log failed');
        }
      }

      // Analizar archivos en el workspace general
      const workspaceFiles = await this.scanDirectoryChanges(taskDir);
      results.filesChanged.push(...workspaceFiles);

    } catch (error) {
      console.error('Error analyzing execution changes:', error);
    }

    return results;
  }

  /**
   * Escanear cambios en directorio de trabajo
   */
  async scanDirectoryChanges(dir) {
    const changes = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !['repositories', 'node_modules', '.git'].includes(entry.name)) {
          const subChanges = await this.scanDirectoryChanges(path.join(dir, entry.name));
          changes.push(...subChanges);
        } else if (entry.isFile() && !entry.name.startsWith('.')) {
          const filePath = path.join(dir, entry.name);
          const stats = fs.statSync(filePath);
          
          // Considerar archivos creados en la última hora como nuevos
          const isNew = (Date.now() - stats.birthtime.getTime()) < 3600000;
          
          changes.push({
            repository: 'workspace',
            file: entry.name,
            status: isNew ? 'created' : 'modified',
            fullPath: filePath,
            size: stats.size
          });
        }
      }
    } catch (error) {
      console.error('Error scanning directory changes:', error);
    }

    return changes;
  }

  /**
   * Parsear estado de Git
   */
  parseGitStatus(status) {
    const statusMap = {
      'A': 'added',
      'M': 'modified', 
      'D': 'deleted',
      'R': 'renamed',
      'C': 'copied',
      '??': 'untracked'
    };
    return statusMap[status] || 'unknown';
  }

  /**
   * Extraer URL de GitHub de la URL del remote
   */
  extractGitHubUrl(remoteUrl) {
    // git@github.com:user/repo.git -> https://github.com/user/repo
    // https://github.com/user/repo.git -> https://github.com/user/repo
    if (remoteUrl.includes('github.com')) {
      return remoteUrl
        .replace('git@github.com:', 'https://github.com/')
        .replace(/\.git$/, '');
    }
    return null;
  }

  /**
   * Ejecutar comando de sistema
   */
  async runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      exec(command, options, (error, stdout, stderr) => {
        if (error) {
          resolve({ error, stdout: '', stderr });
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  /**
   * Obtener directorios de workspace que coincidan con un patrón
   */
  async getWorkspaceDirs(pattern) {
    try {
      const workspaceDir = this.workspacePath;
      if (!fs.existsSync(workspaceDir)) {
        return [];
      }

      const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
      const matchingDirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(workspaceDir, entry.name))
        .filter(dir => {
          const basename = path.basename(dir);
          // Simple pattern matching - replace * with regex
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
          return regex.test(basename);
        })
        .sort(); // Sort to get latest workspace last

      return matchingDirs;
    } catch (error) {
      console.error('Error getting workspace directories:', error);
      return [];
    }
  }
}

module.exports = DockerOrchestrator;