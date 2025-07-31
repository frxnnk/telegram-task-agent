// Test script para verificar la funcionalidad sin Telegram
require('dotenv').config();

const AgentManager = require('./src/database/AgentManager');
const DockerOrchestrator = require('./src/orchestration/DockerOrchestrator');
const TaskAtomizerCLIIntegrated = require('./src/atomizer/TaskAtomizerCLIIntegrated');
const ProjectRepoManager = require('./src/integrations/ProjectRepoManager');
const LinearManager = require('./src/integrations/LinearManager');
const GitHubManager = require('./src/integrations/GitHubManager');

async function testSystem() {
  console.log('🧪 Starting system test...');
  
  try {
    // Initialize managers
    const agentManager = new AgentManager('./data/test-agents.db');
    await agentManager.initialize();
    console.log('✅ AgentManager initialized');
    
    const docker = new DockerOrchestrator({
      workspacePath: './workspace',
      maxInstances: 10,
      mockMode: true // Use mock mode for testing
    });
    console.log('✅ DockerOrchestrator initialized (mock mode)');
    
    // Test agent creation
    const testAgent = await agentManager.createAgent(
      'test-user-123',
      'Test Agent',
      'TEL',
      'Telegram Project',
      [{ name: 'test-repo', fullName: 'user/test-repo' }]
    );
    console.log('✅ Test agent created:', testAgent.id);
    
    // Test task execution creation
    const execution = await agentManager.createTaskExecution(
      testAgent.id,
      'TEL-15',
      'Test task execution',
      'background'
    );
    console.log('✅ Task execution created:', execution.id);
    
    // Test Docker task execution
    const mockTask = {
      id: 'TEL-15',
      title: 'Test Docker Execution',
      description: 'Testing the Docker orchestrator functionality'
    };
    
    const dockerInstance = await docker.playTask(
      'test-atomic-1',
      {
        title: mockTask.title,
        description: mockTask.description,
        command: 'echo "Test successful" && sleep 5',
        linearTaskId: mockTask.id,
        executionId: execution.id
      },
      { interactive: false }
    );
    
    console.log('✅ Docker instance started:', dockerInstance.instanceId);
    
    // Test progress update
    await agentManager.updateTaskExecution(
      execution.id,
      'running',
      50,
      'Test execution in progress'
    );
    console.log('✅ Execution progress updated');
    
    // Test instances retrieval
    const instances = await docker.getInstances();
    console.log('✅ Docker instances:', instances.length);
    
    // Wait a bit and check status
    setTimeout(async () => {
      const updatedInstances = await docker.getInstances();
      console.log('📊 Updated instances status:', updatedInstances.map(i => ({ id: i.id, status: i.status })));
      
      // Mark as completed
      await agentManager.updateTaskExecution(
        execution.id,
        'completed',
        100,
        'Test execution completed successfully'
      );
      
      console.log('✅ All tests passed!');
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testSystem();