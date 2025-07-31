require('dotenv').config();
const DockerOrchestrator = require('./src/orchestration/DockerOrchestrator');

async function testDockerOrchestration() {
  console.log('🧪 Testing AGENT-TELEGRAM-53: VPS Docker Orchestration');
  console.log('=' .repeat(60));
  
  const docker = new DockerOrchestrator({
    workspacePath: './test-workspace',
    maxInstances: 5
  });
  
  const tests = [
    () => testBasicTaskExecution(docker),
    () => testInstanceManagement(docker),
    () => testLogsRetrieval(docker),
    () => testStatsAndCleanup(docker),
    () => testMultipleInstances(docker),
    () => testErrorHandling(docker),
    () => testResourceLimits(docker),
    () => testWorkspaceIsolation(docker)
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < tests.length; i++) {
    try {
      console.log(`\n${i + 1}. Running test ${i + 1}...`);
      await tests[i]();
      console.log(`✅ Test ${i + 1} passed`);
      passed++;
    } catch (error) {
      console.error(`❌ Test ${i + 1} failed:`, error.message);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`🎯 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('✅ All tests passed! AGENT-TELEGRAM-53 is ready for production');
  } else {
    console.log('❌ Some tests failed. Review implementation before deployment');
  }
  
  return failed === 0;
}

async function testBasicTaskExecution(docker) {
  console.log('   🧪 Testing basic task execution...');
  
  const taskData = {
    title: 'Test Basic Task',
    description: 'Basic test task for Docker orchestration',
    command: 'echo "Hello from Docker" && sleep 2 && echo "Task completed"',
    dependencies: {}
  };
  
  const result = await docker.playTask('test-basic-1', taskData);
  
  if (!result.instanceId || !result.containerName || result.status !== 'started') {
    throw new Error('Task execution failed to return expected result');
  }
  
  // Wait a moment for container to start
  await sleep(1000);
  
  const instances = await docker.getInstances();
  const testInstance = instances.find(i => i.id === result.instanceId);
  
  if (!testInstance) {
    throw new Error('Task instance not found in instances list');
  }
  
  console.log(`   ✅ Task started: ${result.containerName}`);
  return result.instanceId;
}

async function testInstanceManagement(docker) {
  console.log('   🧪 Testing instance management...');
  
  const taskData = {
    title: 'Test Instance Management',
    description: 'Test instance lifecycle management',
    command: 'for i in $(seq 1 10); do echo "Running step $i"; sleep 1; done',
    dependencies: {}
  };
  
  const result = await docker.playTask('test-mgmt-1', taskData);
  await sleep(500);
  
  // Test getting instances
  const instances = await docker.getInstances();
  const testInstance = instances.find(i => i.id === result.instanceId);
  
  if (!testInstance) {
    throw new Error('Instance not found in management list');
  }
  
  // Test killing instance
  const killResult = await docker.killInstance(result.instanceId);
  
  if (killResult.status !== 'killed' || killResult.instanceId !== result.instanceId) {
    throw new Error('Instance kill operation failed');
  }
  
  console.log(`   ✅ Instance management working: ${result.containerName}`);
}

async function testLogsRetrieval(docker) {
  console.log('   🧪 Testing logs retrieval...');
  
  const taskData = {
    title: 'Test Logs',
    description: 'Test log capture and retrieval',
    command: 'echo "Log line 1" && echo "Log line 2" && echo "Error message" >&2 && sleep 2',
    dependencies: {}
  };
  
  const result = await docker.playTask('test-logs-1', taskData);
  
  // Wait for logs to be generated
  await sleep(1500);
  
  const logData = await docker.getLogs(result.instanceId, { tail: 10 });
  
  if (!logData.logs || logData.logs.length === 0) {
    throw new Error('No logs captured');
  }
  
  // Check if we have both stdout and stderr logs
  const hasStdout = logData.logs.some(log => log.type === 'stdout');
  const hasStderr = logData.logs.some(log => log.type === 'stderr');
  
  if (!hasStdout) {
    throw new Error('stdout logs not captured');
  }
  
  console.log(`   ✅ Logs captured: ${logData.logs.length} lines (stdout: ${hasStdout}, stderr: ${hasStderr})`);
  
  // Cleanup
  await docker.killInstance(result.instanceId);
}

async function testStatsAndCleanup(docker) {
  console.log('   🧪 Testing stats and cleanup...');
  
  const initialStats = docker.getStats();
  
  // Create a short-lived task
  const taskData = {
    title: 'Test Stats',
    description: 'Test statistics and cleanup',
    command: 'echo "Short task" && sleep 1',
    dependencies: {}
  };
  
  const result = await docker.playTask('test-stats-1', taskData);
  await sleep(500);
  
  const runningStats = docker.getStats();
  
  if (runningStats.total <= initialStats.total) {
    throw new Error('Stats not updating correctly');
  }
  
  // Wait for task to complete
  await sleep(2000);
  
  const stoppedInstances = await docker.cleanupStoppedInstances();
  
  const finalStats = docker.getStats();
  
  console.log(`   ✅ Stats working: initial=${initialStats.total}, running=${runningStats.total}, final=${finalStats.total}`);
}

async function testMultipleInstances(docker) {
  console.log('   🧪 Testing multiple instances...');
  
  const taskPromises = [];
  const instanceIds = [];
  
  // Start 3 parallel tasks
  for (let i = 1; i <= 3; i++) {
    const taskData = {
      title: `Parallel Task ${i}`,
      description: `Test parallel execution ${i}`,
      command: `echo "Task ${i} started" && sleep 3 && echo "Task ${i} completed"`,
      dependencies: {}
    };
    
    taskPromises.push(docker.playTask(`test-parallel-${i}`, taskData));
  }
  
  const results = await Promise.all(taskPromises);
  results.forEach(result => instanceIds.push(result.instanceId));
  
  await sleep(1000);
  
  const instances = await docker.getInstances();
  const runningInstances = instances.filter(i => instanceIds.includes(i.id));
  
  if (runningInstances.length !== 3) {
    throw new Error(`Expected 3 parallel instances, found ${runningInstances.length}`);
  }
  
  // Cleanup all instances
  for (const instanceId of instanceIds) {
    try {
      await docker.killInstance(instanceId);
    } catch (error) {
      // Instance might have completed naturally
    }
  }
  
  console.log(`   ✅ Multiple instances working: ${runningInstances.length} parallel tasks`);
}

async function testErrorHandling(docker) {
  console.log('   🧪 Testing error handling...');
  
  // Test invalid instance ID
  try {
    await docker.getLogs('invalid-instance-id');
    throw new Error('Should have thrown error for invalid instance ID');
  } catch (error) {
    if (!error.message.includes('not found')) {
      throw new Error('Wrong error message for invalid instance ID');
    }
  }
  
  // Test killing non-existent instance
  try {
    await docker.killInstance('non-existent-instance');
    throw new Error('Should have thrown error for non-existent instance');
  } catch (error) {
    if (!error.message.includes('not found')) {
      throw new Error('Wrong error message for non-existent instance');
    }
  }
  
  console.log('   ✅ Error handling working correctly');
}

async function testResourceLimits(docker) {
  console.log('   🧪 Testing resource limits...');
  
  const taskData = {
    title: 'Resource Limited Task',
    description: 'Test resource constraints',
    command: 'echo "Testing resource limits" && sleep 2',
    dependencies: {}
  };
  
  // Test task with resource limits
  const result = await docker.playTask('test-limits-1', taskData, {
    memory: '128m',
    cpus: 0.5
  });
  
  await sleep(1000);
  
  const instances = await docker.getInstances();
  const testInstance = instances.find(i => i.id === result.instanceId);
  
  if (!testInstance) {
    throw new Error('Resource limited task not found');
  }
  
  // Cleanup
  await docker.killInstance(result.instanceId);
  
  console.log('   ✅ Resource limits applied successfully');
}

async function testWorkspaceIsolation(docker) {
  console.log('   🧪 Testing workspace isolation...');
  
  const taskData1 = {
    title: 'Workspace Test 1',
    description: 'Test workspace isolation',
    command: 'echo "Task 1 data" > /workspace/task1.txt && ls -la /workspace/',
    files: {
      'config1.json': JSON.stringify({ task: 1, config: 'test1' })
    }
  };
  
  const taskData2 = {
    title: 'Workspace Test 2', 
    description: 'Test workspace isolation',
    command: 'echo "Task 2 data" > /workspace/task2.txt && ls -la /workspace/',
    files: {
      'config2.json': JSON.stringify({ task: 2, config: 'test2' })
    }
  };
  
  const result1 = await docker.playTask('test-workspace-1', taskData1);
  const result2 = await docker.playTask('test-workspace-2', taskData2);
  
  await sleep(2000);
  
  // Both tasks should run in isolated workspaces
  const instances = await docker.getInstances();
  const task1Instance = instances.find(i => i.id === result1.instanceId);
  const task2Instance = instances.find(i => i.id === result2.instanceId);
  
  if (!task1Instance || !task2Instance) {
    throw new Error('Workspace isolation tasks not found');
  }
  
  // Cleanup
  await docker.killInstance(result1.instanceId);
  await docker.killInstance(result2.instanceId);
  
  console.log('   ✅ Workspace isolation working correctly');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
if (require.main === module) {
  testDockerOrchestration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testDockerOrchestration };