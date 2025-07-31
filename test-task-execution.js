// Test específico para las funciones de ejecución de tareas
require('dotenv').config();

const AgentManager = require('./src/database/AgentManager');
const DockerOrchestrator = require('./src/orchestration/DockerOrchestrator');
const TaskAtomizerCLIIntegrated = require('./src/atomizer/TaskAtomizerCLIIntegrated');
const ProjectRepoManager = require('./src/integrations/ProjectRepoManager');
const LinearManager = require('./src/integrations/LinearManager');
const GitHubManager = require('./src/integrations/GitHubManager');

// Mock the task execution functions from bot.js
async function testStartBackgroundTaskExecution() {
  console.log('🧪 Testing background task execution...');
  
  try {
    // Initialize components
    const agentManager = new AgentManager('./data/test-execution.db');
    await agentManager.initialize();
    
    const docker = new DockerOrchestrator({
      workspacePath: './workspace',
      maxInstances: 10,
      mockMode: true
    });
    
    // Mock managers for testing
    const linear = new LinearManager('fake-key');
    const github = new GitHubManager('fake-token');
    const projectRepoManager = new ProjectRepoManager({
      linearManager: linear,
      githubManager: github,
      dbPath: './data/test-project-mappings.db'
    });
    
    // Initialize project repo manager
    await projectRepoManager.initialize();
    
    const claudeAtomizer = new TaskAtomizerCLIIntegrated({
      linearManager: linear,
      githubManager: github,
      projectRepoManager: projectRepoManager
    });
    
    // Create test agent
    const agent = await agentManager.createAgent(
      'test-user-456',
      'Background Test Agent',
      'TEL',
      'Telegram Project',
      [{ name: 'telegram-task-agent', fullName: 'user/telegram-task-agent' }]
    );
    
    // Create mock task
    const task = {
      id: 'TEL-15',
      title: 'Deploy to Production',
      description: 'Deploy the telegram task agent to production VPS'
    };
    
    // Create task execution
    const execution = await agentManager.createTaskExecution(
      agent.id,
      task.id,
      task.title,
      'background'
    );
    
    console.log('✅ Test setup completed');
    
    // Test the actual function logic (simplified version)
    try {
      // Get project context (will return empty for test)
      let projectContext = null;
      try {
        projectContext = await projectRepoManager.getProjectContext(agent.linear_project_id);
      } catch (error) {
        console.log('ℹ️ Project context not available (expected for test)');
        projectContext = { repositories: [], metadata: {} };
      }
      
      // Mock atomized tasks since Claude CLI might not be available
      const mockAtomizedTasks = {
        tasks: [{
          id: 'atomic-1',
          title: 'Setup deployment environment',
          description: 'Prepare the VPS environment for deployment',
          command: 'echo "Setting up deployment..." && sleep 5'
        }]
      };
      
      console.log(`📋 Generated ${mockAtomizedTasks.tasks.length} atomic tasks`);
      
      const firstAtomicTask = mockAtomizedTasks.tasks[0];
      
      const taskData = {
        title: firstAtomicTask.title,
        description: firstAtomicTask.description,
        command: firstAtomicTask.command,
        projectContext: projectContext,
        linearTaskId: task.id,
        executionId: execution.id
      };
      
      // Start Docker container
      const dockerInstance = await docker.playTask(
        firstAtomicTask.id,
        taskData,
        { 
          interactive: false,
          env: {
            LINEAR_TASK_ID: task.id,
            EXECUTION_ID: execution.id.toString(),
            AGENT_ID: agent.id.toString()
          }
        }
      );
      
      console.log(`🐳 Docker instance started: ${dockerInstance.instanceId}`);
      
      // Update execution
      await agentManager.updateTaskExecution(
        execution.id,
        'running',
        10,
        `Docker container started: ${dockerInstance.containerName}`
      );
      
      console.log('✅ Background execution test successful!');
      
      // Simulate monitoring
      setTimeout(async () => {
        try {
          const instances = await docker.getInstances();
          const instance = instances.find(i => i.id === dockerInstance.instanceId);
          
          if (instance) {
            console.log(`📊 Instance status: ${instance.status}`);
            
            // Mark as completed
            await agentManager.updateTaskExecution(
              execution.id,
              'completed',
              100,
              'Task completed successfully'
            );
            
            await agentManager.updateAgentStatus(agent.id, 'idle', null, null, 0);
            
            console.log('✅ Background task execution completed!');
          }
        } catch (error) {
          console.error('❌ Monitoring error:', error.message);
        }
      }, 3000);
      
    } catch (error) {
      console.error('❌ Background execution failed:', error.message);
      await agentManager.updateTaskExecution(execution.id, 'failed', 0, error.message);
      await agentManager.updateAgentStatus(agent.id, 'idle', null, null, 0);
    }
    
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    console.error('Stack:', error.stack);
  }
}

async function testStartInteractiveTaskExecution() {
  console.log('🧪 Testing interactive task execution...');
  
  try {
    const agentManager = new AgentManager('./data/test-execution.db');
    await agentManager.initialize();
    
    const docker = new DockerOrchestrator({
      workspacePath: './workspace',
      maxInstances: 10,
      mockMode: true
    });
    
    // Get existing agent
    const agents = await agentManager.getUserAgents('test-user-456');
    const agent = agents[0];
    
    if (!agent) {
      console.log('❌ No agent found for interactive test');
      return;
    }
    
    const task = {
      id: 'TEL-16',
      title: 'Update Configuration',
      description: 'Update the bot configuration with new features'
    };
    
    const userPrompt = 'Only update the production config, skip development settings';
    
    const execution = await agentManager.createTaskExecution(
      agent.id,
      task.id,
      task.title,
      'interactive',
      userPrompt
    );
    
    console.log('✅ Interactive test setup completed');
    
    // Mock the interactive execution
    const mockAtomizedTasks = {
      tasks: [{
        id: 'atomic-interactive-1',
        title: 'Update production configuration only',
        description: `${task.description}\n\nUser Instructions: ${userPrompt}`,
        command: 'echo "Updating production config only..." && sleep 3'
      }]
    };
    
    const firstAtomicTask = mockAtomizedTasks.tasks[0];
    
    const taskData = {
      title: firstAtomicTask.title,
      description: firstAtomicTask.description,
      command: firstAtomicTask.command,
      projectContext: { repositories: [], metadata: {} },
      linearTaskId: task.id,
      executionId: execution.id,
      userPrompt: userPrompt
    };
    
    const dockerInstance = await docker.playTask(
      firstAtomicTask.id,
      taskData,
      { 
        interactive: true,
        env: {
          LINEAR_TASK_ID: task.id,
          EXECUTION_ID: execution.id.toString(),
          AGENT_ID: agent.id.toString(),
          USER_PROMPT: userPrompt
        }
      }
    );
    
    console.log(`🐳 Interactive Docker instance started: ${dockerInstance.instanceId}`);
    
    await agentManager.updateTaskExecution(
      execution.id,
      'running',
      15,
      `Interactive container started with prompt: ${userPrompt}`
    );
    
    console.log('✅ Interactive execution test successful!');
    
  } catch (error) {
    console.error('❌ Interactive execution test failed:', error);
    console.error('Stack:', error.stack);
  }
}

async function runTests() {
  console.log('🚀 Starting task execution tests...\n');
  
  await testStartBackgroundTaskExecution();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  setTimeout(async () => {
    await testStartInteractiveTaskExecution();
    
    setTimeout(() => {
      console.log('\n✅ All execution tests completed!');
      process.exit(0);
    }, 5000);
  }, 6000);
}

runTests();