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
      
      const dockerCommand = this.buildDockerCommand(containerName, taskDir, taskData, options);
      
      console.log(`🚀 Starting container: ${containerName}`);
      console.log(`📁 Workspace: ${taskDir}`);
      
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
      console.error('❌ Error starting task:', error);
      throw error;
    }
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
}

module.exports = DockerOrchestrator;