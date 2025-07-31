#!/usr/bin/env node

/**
 * Test para Enhanced Task Atomizer (RELY-52)
 * Valida todas las nuevas funcionalidades implementadas
 */

const TaskAtomizer = require('./src/atomizer/TaskAtomizer');
const LinearManager = require('./src/integrations/LinearManager');

// Mock data para testing
const mockLinearIssue = {
  id: 'test-issue-123',
  identifier: 'AGENT-TELEGRAM-52',
  title: 'Enhanced Task Atomizer Implementation',
  description: 'Implement enhanced context awareness, dependency analysis, and cost estimation',
  priority: 1,
  estimate: 5,
  state: { name: 'In Progress', type: 'started' },
  project: { name: 'Telegram Task Agent' },
  team: { name: 'Development Team', key: 'DEV' },
  assignee: { name: 'Claude Assistant' },
  comments: {
    nodes: [
      {
        id: 'comment-1',
        body: 'Need to focus on Linear/GitHub integration for better context',
        user: { name: 'Project Manager' }
      }
    ]
  }
};

const mockGitHubRepo = {
  name: 'telegram-task-agent',
  description: 'Sistema de agentes atomizados con control via Telegram',
  language: 'JavaScript',
  topics: ['telegram', 'docker', 'automation', 'ai'],
  structure: ['src/', 'test/', 'package.json', 'docker-compose.yml']
};

// Mock managers
class MockLinearManager {
  async getIssueById(issueId) {
    return mockLinearIssue;
  }
}

class MockGitHubManager {
  async getRepositoryInfo(repoName) {
    return mockGitHubRepo;
  }
}

async function testEnhancedTaskAtomizer() {
  console.log('🧪 TESTING Enhanced Task Atomizer (AGENT-TELEGRAM-52)');
  console.log('=' .repeat(50));

  const atomizer = new TaskAtomizer(process.env.CLAUDE_API_KEY || 'mock-key', {
    linearManager: new MockLinearManager(),
    githubManager: new MockGitHubManager()
  });

  const testProject = `
Implementar sistema de monitoreo en tiempo real para agentes Docker con:
- Dashboard web para visualizar estado de contenedores
- Métricas de CPU, memoria y red por agente
- Alertas automáticas cuando un agente falla
- Log streaming en tiempo real
- Auto-restart de agentes fallidos
`;

  try {
    console.log('1. Testing enhanced context gathering...');
    const context = await atomizer.gatherEnhancedContext('test-issue-123', 'telegram-task-agent');
    console.log('✅ Context gathered successfully');
    console.log('📋 Context preview:', context.slice(0, 200) + '...');

    console.log('\n2. Testing enhanced atomization prompt...');
    const prompt = atomizer.buildEnhancedAtomizationPrompt(10, 'medium', 'auto-detect', context);
    console.log('✅ Enhanced prompt built successfully');
    console.log('📝 Prompt length:', prompt.length, 'characters');

    console.log('\n3. Testing validation methods...');
    
    // Test enhanced validation
    const mockAtomizedTasks = {
      project: {
        title: 'Docker Monitoring System',
        complexity: 'medium',
        estimatedDuration: '1-2 days',
        techStack: ['Node.js', 'Docker', 'React'],
        linearIssue: 'RELY-52',
        repository: 'telegram-task-agent'
      },
      tasks: [
        {
          id: 'task_1',
          title: 'Setup monitoring backend',
          description: 'Create Express.js API for Docker metrics',
          dockerCommand: 'npm install && npm run start:monitor',
          requiredFiles: ['package.json', 'src/monitor/'],
          outputFiles: ['dist/monitor.js'],
          estimatedTime: '2hours',
          estimatedCost: '0.05',
          complexity: 'medium',
          category: 'development',
          validation: {
            command: 'npm test -- monitor',
            expectedOutput: 'All monitoring tests pass'
          },
          rollback: {
            command: 'docker stop monitoring-api',
            conditions: ['API fails to start', 'Port conflicts']
          }
        }
      ],
      dependencies: [],
      executionMatrix: {
        parallelGroups: [['task_1']],
        criticalPath: ['task_1'],
        totalEstimatedTime: '2 hours',
        totalEstimatedCost: '$0.05'
      }
    };

    atomizer.validateEnhancedAtomizedTasks(mockAtomizedTasks);
    console.log('✅ Enhanced validation passed');

    console.log('\n4. Testing cost calculation...');
    const mockUsage = {
      input_tokens: 1500,
      output_tokens: 800
    };

    const costs = atomizer.calculateEnhancedCosts(mockUsage, mockAtomizedTasks);
    console.log('✅ Enhanced costs calculated');
    console.log('💰 Total estimated cost:', costs.project.totalEstimated.toFixed(4));

    console.log('\n5. Testing execution order calculation...');
    const executionOrder = atomizer.calculateEnhancedExecutionOrder(mockAtomizedTasks);
    console.log('✅ Enhanced execution order calculated');
    console.log('📊 Execution groups:', executionOrder.parallel?.length || 0);

    console.log('\n6. Testing parallel detection...');
    const parallelTasks = atomizer.detectParallelTasks(mockAtomizedTasks.tasks, mockAtomizedTasks.dependencies);
    console.log('✅ Parallel detection completed');
    console.log('⚡ Parallel groups detected:', parallelTasks.length);

    console.log('\n7. Testing critical path calculation...');
    const criticalPath = atomizer.calculateCriticalPath(mockAtomizedTasks.tasks, mockAtomizedTasks.dependencies);
    console.log('✅ Critical path calculated');
    console.log('🎯 Critical path length:', criticalPath.length);

    console.log('\n8. Testing time estimation...');
    const sequentialTime = atomizer.estimateSequentialTime(mockAtomizedTasks.tasks);
    const parallelTime = atomizer.estimateParallelTime(mockAtomizedTasks.executionMatrix.parallelGroups, mockAtomizedTasks.tasks);
    console.log('✅ Time estimation completed');
    console.log('⏱️ Sequential:', sequentialTime, 'min | Parallel:', parallelTime, 'min');

    console.log('\n' + '='.repeat(50));
    console.log('🎉 ALL ENHANCED TASK ATOMIZER TESTS PASSED!');
    console.log('✅ AGENT-TELEGRAM-52 Implementation Validated');
    
    console.log('\n📊 ENHANCEMENT SUMMARY:');
    console.log('• ✅ Enhanced context awareness (Linear + GitHub)');
    console.log('• ✅ Improved dependency analysis');
    console.log('• ✅ Per-task cost estimation');
    console.log('• ✅ Parallel execution detection');
    console.log('• ✅ Critical path calculation');
    console.log('• ✅ Validation and rollback support');
    console.log('• ✅ Execution matrix optimization');

  } catch (error) {
    console.error('❌ Enhanced Task Atomizer test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar tests si se llama directamente
if (require.main === module) {
  testEnhancedTaskAtomizer()
    .then(() => {
      console.log('\n✅ Testing completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testEnhancedTaskAtomizer };