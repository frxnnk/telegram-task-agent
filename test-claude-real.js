// Test real de la integración completa con Claude CLI
require('dotenv').config();

const TaskAtomizerCLIIntegrated = require('./src/atomizer/TaskAtomizerCLIIntegrated');
const LinearManager = require('./src/integrations/LinearManager');
const GitHubManager = require('./src/integrations/GitHubManager');
const ProjectRepoManager = require('./src/integrations/ProjectRepoManager');

async function testRealClaudeIntegration() {
  console.log('🧪 Testing REAL Claude CLI integration...\n');
  
  try {
    // Initialize components (with fake keys for testing)
    const linear = new LinearManager('fake-linear-key');
    const github = new GitHubManager('fake-github-token');
    const projectRepoManager = new ProjectRepoManager({
      linearManager: linear,
      githubManager: github,
      dbPath: './data/test-real-project-mappings.db'
    });
    
    await projectRepoManager.initialize();
    
    const claudeAtomizer = new TaskAtomizerCLIIntegrated({
      linearManager: linear,
      githubManager: github,
      projectRepoManager: projectRepoManager
    });
    
    console.log('✅ Components initialized\n');
    
    // Test a real atomization request
    const projectDescription = `Create a simple REST API for a task management system with the following features:
- User authentication (JWT)
- CRUD operations for tasks
- Task categories and priorities
- Basic error handling
- SQLite database
- Express.js framework`;
    
    console.log('🤖 Executing REAL Claude CLI atomization...');
    console.log('📝 Project:', projectDescription.substring(0, 100) + '...\n');
    
    const result = await claudeAtomizer.atomizeProject(projectDescription, {
      maxTasks: 8,
      complexity: 'medium',
      techStack: 'Node.js + Express + SQLite',
      includeContext: false // Don't include context for this test
    });
    
    console.log('✅ Claude CLI atomization completed!\n');
    
    // Display results
    console.log('📊 ATOMIZATION RESULTS:');
    console.log('=' .repeat(50));
    console.log(`📋 Project: ${result.project.title}`);
    console.log(`⏱️  Duration: ${result.project.estimatedDuration}`);
    console.log(`🎯 Complexity: ${result.project.complexity}`);
    console.log(`🛠️  Tech Stack: ${result.project.techStack}`);
    console.log(`📦 Tasks Generated: ${result.tasks.length}`);
    console.log('=' .repeat(50));
    
    // Show each task
    result.tasks.forEach((task, index) => {
      console.log(`\n${index + 1}. ${task.title || 'Untitled Task'}`);
      console.log(`   ID: ${task.id || 'no-id'}`);
      console.log(`   ⏱️  ${task.estimatedTime || 'Unknown time'}`);
      
      const description = task.description || 'No description';
      console.log(`   📝 ${description.length > 80 ? description.substring(0, 80) + '...' : description}`);
      
      const command = task.command || 'No command';
      console.log(`   💻 Command: ${command.length > 60 ? command.substring(0, 60) + '...' : command}`);
      
      if (task.dependencies && task.dependencies.length > 0) {
        console.log(`   🔗 Dependencies: ${task.dependencies.join(', ')}`);
      }
    });
    
    console.log(`\n💰 COST ANALYSIS:`);
    console.log(`📊 Total tasks: ${result.costs.totalTasks}`);
    console.log(`🎯 Complexity: ${result.costs.complexity}`);
    console.log(`💵 Estimated cost: $${result.costs.estimatedCost} (FREE with Claude Pro)`);
    
    console.log('\n🎉 REAL CLAUDE CLI INTEGRATION TEST PASSED!');
    console.log('✅ Your Claude CLI is working perfectly with the system');
    
  } catch (error) {
    console.error('\n❌ REAL CLAUDE CLI INTEGRATION TEST FAILED');
    console.error('Error:', error.message);
    
    if (error.message.includes('command not found')) {
      console.log('\n💡 SOLUTION: Install Claude CLI:');
      console.log('   npm install -g @anthropic-ai/cli');
    } else if (error.message.includes('authentication') || error.message.includes('auth')) {
      console.log('\n💡 SOLUTION: Authenticate Claude CLI:');
      console.log('   claude auth');
    } else if (error.message.includes('Invalid JSON')) {
      console.log('\n💡 POSSIBLE ISSUE: Claude CLI returned unexpected format');
      console.log('   This might be a prompt tuning issue');
    } else {
      console.log('\n💡 Raw error details:');
      console.log(error.stack);
    }
  }
}

testRealClaudeIntegration();