#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔐 Testing Authentication Configuration...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

console.log(`📁 .env file: ${envExists ? '✅' : '❌'}`);

if (!envExists) {
  console.log('❌ No .env file found. Copy .env.example to .env and configure your tokens.');
  process.exit(1);
}

// Load environment variables
require('dotenv').config();

const tokens = {
  'Telegram Bot Token': process.env.TELEGRAM_BOT_TOKEN,
  'Linear API Key': process.env.LINEAR_API_KEY,
  'GitHub Token': process.env.GITHUB_TOKEN,
  'Claude API Key': process.env.CLAUDE_API_KEY
};

console.log('\n🔑 Token Configuration:');
Object.entries(tokens).forEach(([name, token]) => {
  if (token) {
    const masked = token.substring(0, 8) + '***' + token.substring(token.length - 4);
    console.log(`  ${name}: ✅ ${masked}`);
  } else {
    console.log(`  ${name}: ❌ Not configured`);
  }
});

// Test each authentication
async function testAuth() {
  console.log('\n🧪 Testing Authentication...\n');
  
  // Test Telegram Bot
  if (tokens['Telegram Bot Token']) {
    console.log('📱 Testing Telegram Bot...');
    try {
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
      const data = await response.json();
      
      if (data.ok) {
        console.log(`✅ Telegram Bot: @${data.result.username}`);
      } else {
        console.log('❌ Telegram Bot: Invalid token');
      }
    } catch (error) {
      console.log('❌ Telegram Bot: Connection failed');
    }
  }

  // Test Linear API
  if (tokens['Linear API Key']) {
    console.log('\n📊 Testing Linear API...');
    try {
      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.LINEAR_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'query { viewer { id name email } }'
        })
      });
      
      const data = await response.json();
      
      if (data.data && data.data.viewer) {
        console.log(`✅ Linear API: ${data.data.viewer.name} (${data.data.viewer.email})`);
      } else {
        console.log('❌ Linear API: Invalid token or access denied');
      }
    } catch (error) {
      console.log('❌ Linear API: Connection failed');
    }
  }

  // Test GitHub API
  if (tokens['GitHub Token']) {
    console.log('\n🐙 Testing GitHub API...');
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'User-Agent': 'telegram-task-agent'
        }
      });
      
      const data = await response.json();
      
      if (data.login) {
        console.log(`✅ GitHub API: @${data.login}`);
      } else {
        console.log('❌ GitHub API: Invalid token');
      }
    } catch (error) {
      console.log('❌ GitHub API: Connection failed');
    }
  }

  // Test Claude API
  if (tokens['Claude API Key']) {
    console.log('\n🤖 Testing Claude API...');
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CLAUDE_API_KEY}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 10,
          messages: [
            {
              role: 'user',
              content: 'Test'
            }
          ]
        })
      });
      
      if (response.status === 200) {
        console.log('✅ Claude API: Connected successfully');
      } else {
        console.log(`❌ Claude API: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log('❌ Claude API: Connection failed');
    }
  }

  console.log('\n✨ Authentication test completed!');
}

testAuth().catch(console.error);