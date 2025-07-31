// Test para verificar Claude en VPS (con y sin API key)
require('dotenv').config();

const TaskAtomizerCLIIntegrated = require('./src/atomizer/TaskAtomizerCLIIntegrated');
const LinearManager = require('./src/integrations/LinearManager');
const GitHubManager = require('./src/integrations/GitHubManager');
const ProjectRepoManager = require('./src/integrations/ProjectRepoManager');

async function testVPSClaude() {
  console.log('🧪 Testing Claude integration for VPS deployment...\n');
  
  try {
    // Mock managers
    const linear = new LinearManager('fake-key');
    const github = new GitHubManager('fake-token');
    const projectRepoManager = new ProjectRepoManager({
      linearManager: linear,
      githubManager: github,
      dbPath: './data/vps-test-mappings.db'
    });
    
    await projectRepoManager.initialize();
    
    const claudeAtomizer = new TaskAtomizerCLIIntegrated({
      linearManager: linear,
      githubManager: github,
      projectRepoManager: projectRepoManager
    });
    
    console.log('✅ Components initialized');
    
    // Test simple project
    const testProject = `Create a simple Express.js API with:
- GET /health endpoint
- POST /users endpoint
- Basic error handling
- Port 3000`;
    
    console.log('🤖 Testing Claude atomization...');
    console.log(`📝 Project: ${testProject.substring(0, 60)}...`);
    
    // First test - should use CLI if available
    console.log('\n1️⃣ Testing CLI mode (local)...');
    process.env.CLAUDE_USE_API = 'false';
    
    try {
      const result1 = await claudeAtomizer.atomizeProject(testProject, {
        maxTasks: 4,
        complexity: 'simple',
        includeContext: false
      });
      
      console.log('✅ CLI mode successful');
      console.log(`📋 Generated ${result1.tasks.length} tasks`);
      console.log(`🎯 Project: ${result1.project.title}`);
      
    } catch (error) {
      console.log('❌ CLI mode failed:', error.message);
      if (error.message.includes('Invalid API key') || error.message.includes('command not found')) {
        console.log('💡 This is expected on VPS without proper CLI auth');
      }
    }
    
    // Second test - force API mode (VPS simulation)
    console.log('\n2️⃣ Testing API fallback mode (VPS simulation)...');
    
    if (!process.env.CLAUDE_API_KEY) {
      console.log('⚠️ CLAUDE_API_KEY not set - skipping API test');
      console.log('💡 To test API fallback, set CLAUDE_API_KEY in .env');
      console.log('💡 Get your API key from: https://console.anthropic.com/');
    } else {
      process.env.CLAUDE_USE_API = 'true';
      
      try {
        const result2 = await claudeAtomizer.atomizeProject(testProject, {
          maxTasks: 4,
          complexity: 'simple',
          includeContext: false
        });
        
        console.log('✅ API fallback mode successful');
        console.log(`📋 Generated ${result2.tasks.length} tasks`);
        console.log(`🎯 Project: ${result2.project.title}`);
        
        // Show first task as example
        if (result2.tasks.length > 0) {
          const firstTask = result2.tasks[0];
          console.log(`\n📝 Example task:`);
          console.log(`   Title: ${firstTask.title}`);
          console.log(`   Description: ${firstTask.description?.substring(0, 100)}...`);
        }
        
      } catch (error) {
        console.log('❌ API fallback failed:', error.message);
        if (error.message.includes('API key')) {
          console.log('💡 Check your CLAUDE_API_KEY is valid');
        }
      }
    }
    
    console.log('\n🏁 VPS Claude Test Summary:');
    console.log('=' .repeat(40));
    console.log('📋 Local (CLI): Uses your Claude Code authentication');
    console.log('🌐 VPS (API): Falls back to API key when CLI fails');  
    console.log('💰 Cost: CLI = Free (Pro plan), API = Pay per token');
    console.log('🚀 Ready for VPS deployment with hybrid approach');
    
  } catch (error) {
    console.error('\n❌ VPS Claude test failed:', error);
    console.error('Stack:', error.stack);
  }
}

testVPSClaude();