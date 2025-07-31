// Test real de Claude CLI integration
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function testClaudeCLI() {
  console.log('🧪 Testing real Claude CLI integration...');
  
  const testPrompt = `You are a task atomizer. Break down this project into atomic tasks:

PROJECT: Create a simple Hello World web server

Return ONLY a JSON response in this format:
{
  "projectTitle": "Simple Hello World Server",
  "tasks": [
    {
      "id": "task-1",
      "title": "Setup Node.js project",
      "description": "Initialize package.json and install dependencies",
      "command": "npm init -y && npm install express",
      "estimatedTime": "2 minutes",
      "dependencies": []
    }
  ]
}`;

  try {
    console.log('🤖 Executing Claude CLI...');
    
    // Test the actual command that the system uses
    const claudeCommand = `echo ${JSON.stringify(testPrompt)} | claude --print --permission-mode bypassPermissions`;
    
    console.log('Command:', claudeCommand.substring(0, 100) + '...');
    
    const { stdout, stderr } = await execAsync(claudeCommand, {
      shell: true,
      timeout: 30000, // 30 seconds timeout
      maxBuffer: 1024 * 1024 // 1MB buffer
    });
    
    if (stderr) {
      console.warn('Claude CLI stderr:', stderr);
    }
    
    console.log('✅ Claude CLI execution completed');
    console.log('📄 Raw output length:', stdout.length);
    console.log('📄 Raw output preview:', stdout.substring(0, 200) + '...');
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(stdout.trim());
      console.log('✅ Successfully parsed JSON response');
      console.log('📋 Project:', parsed.projectTitle);
      console.log('📋 Tasks:', parsed.tasks?.length || 0);
      
      if (parsed.tasks && parsed.tasks.length > 0) {
        console.log('📝 First task:', parsed.tasks[0].title);
      }
      
    } catch (parseError) {
      console.warn('⚠️ Could not parse as JSON:', parseError.message);
      console.log('Raw output:', stdout);
    }
    
  } catch (error) {
    console.error('❌ Claude CLI execution failed:', error.message);
    
    if (error.message.includes('command not found')) {
      console.log('💡 Tip: Install Claude CLI with: npm install -g @anthropic-ai/cli');
    } else if (error.message.includes('authentication')) {
      console.log('💡 Tip: Run: claude auth');
    } else if (error.message.includes('timeout')) {
      console.log('💡 Claude CLI took too long to respond');
    }
  }
}

testClaudeCLI();