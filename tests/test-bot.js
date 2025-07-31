require('dotenv').config();
const TelegramTaskBot = require('./src/bot');

async function testBot() {
  console.log('🧪 Testing Telegram Task Bot...\n');
  
  // Verificar configuración
  console.log('🔍 Checking configuration...');
  console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
  
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('\n❌ Cannot test bot without TELEGRAM_BOT_TOKEN');
    console.log('📝 Add your bot token to .env file:');
    console.log('   TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather');
    return;
  }
  
  try {
    // Instanciar bot
    console.log('\n🤖 Creating bot instance...');
    const bot = new TelegramTaskBot();
    
    // Test de base de datos
    console.log('📄 Testing database connection...');
    const dbHealth = await bot.db.healthCheck();
    console.log('Database status:', dbHealth.status);
    console.log('Projects in DB:', dbHealth.projectCount);
    
    // Test del atomizer
    console.log('\n⚗️ Testing TaskAtomizer CLI...');
    const testDescription = 'Crear una simple API REST con Node.js y Express';
    const atomizeResult = bot.atomizer.generateAtomizationPrompt(testDescription);
    console.log('✅ Prompt generated:', atomizeResult.promptFile);
    
    // Simular respuesta de Claude (para testing)
    console.log('\n🎭 Testing Claude response parsing...');
    const mockResponse = `{
  "project": {
    "title": "Simple REST API",
    "complexity": "low",
    "estimatedDuration": "4 hours",
    "techStack": ["Node.js", "Express"],
    "description": "Basic REST API with CRUD operations"
  },
  "tasks": [
    {
      "id": "task_1",
      "title": "Initialize Node.js project",
      "description": "Set up package.json and install dependencies",
      "dockerCommand": "npm init -y && npm install express",
      "requiredFiles": [],
      "outputFiles": ["package.json", "node_modules/"],
      "estimatedTime": "15min",
      "complexity": "low",
      "category": "setup"
    },
    {
      "id": "task_2", 
      "title": "Create basic Express server",
      "description": "Set up Express server with basic routing",
      "dockerCommand": "node server.js",
      "requiredFiles": ["package.json"],
      "outputFiles": ["server.js"],
      "estimatedTime": "30min",
      "complexity": "low",
      "category": "development"
    }
  ],
  "dependencies": [
    {
      "taskId": "task_2",
      "dependsOn": ["task_1"],
      "reason": "Needs package.json and dependencies installed"
    }
  ]
}`;

    const parsedResult = bot.atomizer.parseAtomizedResponse(mockResponse);
    console.log('✅ Response parsed successfully');
    console.log('   Tasks:', parsedResult.tasks.length);
    console.log('   Dependencies:', parsedResult.dependencies.length);
    console.log('   Execution order:', parsedResult.executionOrder.length);
    
    console.log('\n🎉 All tests passed! Bot is ready to use.');
    console.log('\n📱 To use the bot:');
    console.log('   1. Start a chat with your bot in Telegram');
    console.log('   2. Send /start to see available commands');
    console.log('   3. Use /project "your project description"');
    console.log('   4. Follow the instructions to use Claude CLI');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  testBot().catch(console.error);
}

module.exports = { testBot };