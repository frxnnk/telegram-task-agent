#!/usr/bin/env node

require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function analyzeLinearTasks() {
  console.log('🔍 Analyzing current Linear tasks for Background Agents alignment...\n');
  
  try {
    const linearManager = new LinearManager(process.env.LINEAR_API_KEY);
    
    // Test connection
    console.log('📡 Testing Linear connection...');
    const viewer = await linearManager.testConnection();
    console.log(`✅ Connected as: ${viewer.name} (${viewer.email})`);
    console.log(`🏢 Organization: ${viewer.organization.name}\n`);
    
    // Get current TEL tasks
    console.log('📋 Fetching current TEL tasks...');
    const telData = await linearManager.getTelTasks();
    
    console.log(`📊 Found ${telData.issues.length} TEL tasks in team: ${telData.team.name}\n`);
    
    // Analyze each task
    console.log('📑 CURRENT TEL TASKS ANALYSIS:\n');
    console.log('=' .repeat(80));
    
    telData.issues.sort((a, b) => {
      const aNum = parseInt(a.identifier.split('-')[1]);
      const bNum = parseInt(b.identifier.split('-')[1]);
      return aNum - bNum;
    }).forEach((issue, index) => {
      const stateEmoji = getStateEmoji(issue.state.type);
      const priorityEmoji = getPriorityEmoji(issue.priority);
      
      console.log(`${issue.identifier}: ${stateEmoji}${priorityEmoji} ${issue.title}`);
      console.log(`   State: ${issue.state.name} | Priority: ${getPriorityText(issue.priority)}`);
      
      if (issue.description) {
        const desc = issue.description.length > 100 
          ? issue.description.substring(0, 100) + '...' 
          : issue.description;
        console.log(`   Description: ${desc}`);
      }
      
      console.log(`   URL: ${issue.url}`);
      console.log('');
    });
    
    console.log('=' .repeat(80));
    console.log('\n🎯 BACKGROUND AGENTS CONCEPT ANALYSIS:\n');
    
    // Analyze alignment with new concept
    const conceptAlignment = analyzeConceptAlignment(telData.issues);
    
    console.log('📈 CONCEPT ALIGNMENT RESULTS:');
    console.log(`✅ Aligned tasks: ${conceptAlignment.aligned.length}`);
    console.log(`🔄 Tasks needing updates: ${conceptAlignment.needsUpdate.length}`);
    console.log(`➕ Missing functionality: ${conceptAlignment.missing.length}`);
    console.log(`❌ Tasks to deprioritize: ${conceptAlignment.deprioritize.length}\n`);
    
    // Show detailed analysis
    if (conceptAlignment.aligned.length > 0) {
      console.log('✅ ALIGNED TASKS:');
      conceptAlignment.aligned.forEach(task => {
        console.log(`   - ${task.identifier}: ${task.title}`);
        console.log(`     Reason: ${task.reason}\n`);
      });
    }
    
    if (conceptAlignment.needsUpdate.length > 0) {
      console.log('🔄 TASKS NEEDING UPDATES:');
      conceptAlignment.needsUpdate.forEach(task => {
        console.log(`   - ${task.identifier}: ${task.title}`);
        console.log(`     Suggested: ${task.suggestion}`);
        console.log(`     Priority: ${task.newPriority}\n`);
      });
    }
    
    if (conceptAlignment.missing.length > 0) {
      console.log('➕ MISSING FUNCTIONALITY:');
      conceptAlignment.missing.forEach(missing => {
        console.log(`   - ${missing.title}`);
        console.log(`     Description: ${missing.description}`);
        console.log(`     Priority: ${missing.priority}\n`);
      });
    }
    
    if (conceptAlignment.deprioritize.length > 0) {
      console.log('❌ TASKS TO DEPRIORITIZE:');
      conceptAlignment.deprioritize.forEach(task => {
        console.log(`   - ${task.identifier}: ${task.title}`);
        console.log(`     Reason: ${task.reason}\n`);
      });
    }
    
    return {
      telData,
      conceptAlignment,
      linearManager
    };
    
  } catch (error) {
    console.error('❌ Error analyzing Linear tasks:', error.message);
    if (error.message.includes('Linear API Error')) {
      console.error('💡 Check your LINEAR_API_KEY in .env file');
    }
    throw error;
  }
}

function analyzeConceptAlignment(issues) {
  const aligned = [];
  const needsUpdate = [];
  const deprioritize = [];
  
  // Define core Background Agents functionality
  const coreAgentFeatures = [
    'agent creation',
    'background execution', 
    'interactive execution',
    'linear-github integration',
    'agent dashboard',
    'agent management',
    'repository selection',
    'project linking'
  ];
  
  issues.forEach(issue => {
    const title = issue.title.toLowerCase();
    const description = (issue.description || '').toLowerCase();
    const content = title + ' ' + description;
    
    // Check if task is aligned with Background Agents concept
    if (content.includes('agent') || content.includes('background') || 
        content.includes('linear') && content.includes('github') ||
        content.includes('manager') || content.includes('dashboard')) {
      
      // Check if it's specifically about background agents manager
      if (content.includes('background') && content.includes('agent')) {
        aligned.push({
          identifier: issue.identifier,
          title: issue.title,
          reason: 'Core Background Agents functionality'
        });
      } else if (content.includes('linear') && content.includes('github')) {
        aligned.push({
          identifier: issue.identifier,
          title: issue.title,
          reason: 'Essential Linear-GitHub integration'
        });
      } else {
        needsUpdate.push({
          identifier: issue.identifier,
          title: issue.title,
          suggestion: 'Update to focus on Background Agents concept',
          newPriority: 'High'
        });
      }
    } 
    // Check for tasks that should be deprioritized
    else if (content.includes('cost') || content.includes('monitoring') && !content.includes('agent') ||
             content.includes('token') || content.includes('atomizer') && !content.includes('agent')) {
      deprioritize.push({
        identifier: issue.identifier,
        title: issue.title,
        reason: 'Not core to Background Agents concept - should be lower priority'
      });
    }
    // Tasks that need concept alignment
    else {
      needsUpdate.push({
        identifier: issue.identifier,
        title: issue.title,
        suggestion: 'Align with Background Agents concept or integrate into agent workflow',
        newPriority: 'Medium'
      });
    }
  });
  
  // Define missing functionality
  const missing = [
    {
      title: 'Agent Execution Modes (Background vs Interactive)',
      description: 'System to run agents either in background or with user interaction',
      priority: 'High'
    },
    {
      title: 'Agent-Repository Architecture Analysis',
      description: 'Claude intelligence to understand and work with user\'s specific code architecture',
      priority: 'High'
    },
    {
      title: 'Agent State Persistence',
      description: 'Save and restore agent execution state across sessions',
      priority: 'Medium'
    },
    {
      title: 'Multi-Agent Coordination',
      description: 'System for multiple agents working on related tasks',
      priority: 'Medium'
    }
  ];
  
  return {
    aligned,
    needsUpdate,
    missing,
    deprioritize
  };
}

function getStateEmoji(stateType) {
  const stateEmojis = {
    'backlog': '📋',
    'unstarted': '⏳',
    'started': '🔄',
    'completed': '✅',
    'canceled': '❌',
    'triage': '🔍',
    'planned': '📅'
  };
  return stateEmojis[stateType?.toLowerCase()] || '📌';
}

function getPriorityEmoji(priority) {
  const priorityEmojis = {
    0: '🔴', // Urgent
    1: '🟠', // High  
    2: '🟡', // Medium
    3: '🟢', // Low
    4: '⚪'  // No priority
  };
  return priorityEmojis[priority] || '⚪';
}

function getPriorityText(priority) {
  const priorityText = {
    0: 'Urgent',
    1: 'High',
    2: 'Medium', 
    3: 'Low',
    4: 'No Priority'
  };
  return priorityText[priority] || 'Unknown';
}

if (require.main === module) {
  analyzeLinearTasks()
    .then(() => {
      console.log('✅ Analysis complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { analyzeLinearTasks };