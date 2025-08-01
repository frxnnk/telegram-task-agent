#!/usr/bin/env node

const LinearManager = require('../src/integrations/LinearManager');
require('dotenv').config({ path: '.env.production' });

async function getDetailedTaskAnalysis() {
  console.log('🔍 Getting detailed task information...\n');
  
  const linear = new LinearManager(process.env.LINEAR_API_KEY);
  
  try {
    // Get TEL tasks
    const telData = await linear.getTelTasks();
    console.log(`📋 Found ${telData.issues.length} TEL tasks\n`);
    
    console.log('=' .repeat(80));
    console.log('DETAILED TASK ANALYSIS');
    console.log('=' .repeat(80));
    
    // Sort tasks by identifier
    const sortedTasks = telData.issues.sort((a, b) => {
      const numA = parseInt(a.identifier.split('-')[1]);
      const numB = parseInt(b.identifier.split('-')[1]);
      return numA - numB;
    });
    
    for (const task of sortedTasks) {
      console.log(`\n${task.identifier}: ${task.title}`);
      console.log(`State: ${task.state.name} (${task.state.type})`);
      console.log(`Priority: ${getPriorityName(task.priority)}`);
      console.log(`Assignee: ${task.assignee ? task.assignee.name : 'Unassigned'}`);
      console.log(`Created: ${new Date(task.createdAt).toLocaleDateString()}`);
      console.log(`Updated: ${new Date(task.updatedAt).toLocaleDateString()}`);
      
      if (task.description) {
        console.log(`Description: ${task.description.slice(0, 200)}${task.description.length > 200 ? '...' : ''}`);
      }
      
      // Analyze based on current system state
      const analysis = analyzeTaskAgainstSystem(task);
      console.log(`\n🎯 ANALYSIS:`);
      console.log(`   Status: ${analysis.status}`);
      console.log(`   Recommendation: ${analysis.recommendation}`);
      console.log(`   Reason: ${analysis.reason}`);
      
      if (analysis.action) {
        console.log(`   Action: ${analysis.action}`);
      }
      
      console.log('-'.repeat(80));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

function analyzeTaskAgainstSystem(task) {
  const title = task.title.toLowerCase();
  const description = (task.description || '').toLowerCase();
  const state = task.state.type;
  const identifier = task.identifier;
  
  // Based on CLAUDE.md system state
  const systemFeatures = {
    'TEL-1': {
      title: 'Agent System Deployment - Production Setup',
      status: '✅ COMPLETED',
      reason: 'VPS fully deployed with Claude CLI authenticated, PM2 running, system operational 24/7',
      recommendation: 'MARK COMPLETED',
      action: 'Update to Done state with deployment details'
    },
    'TEL-2': {
      title: 'Core Bot Framework - Telegraf.js Implementation',
      status: '✅ COMPLETED', 
      reason: 'Bot fully functional with agent creation UI, inline keyboards, dashboard working',
      recommendation: 'MARK COMPLETED',
      action: 'Update to Done state'
    },
    'TEL-3': {
      title: 'Linear API Integration - GraphQL Task Management',
      status: '✅ COMPLETED',
      reason: 'LinearManager class fully implemented with all CRUD operations, project/task fetching working',
      recommendation: 'MARK COMPLETED', 
      action: 'Update to Done state'
    },
    'TEL-4': {
      title: 'GitHub Repository Integration - Code Access',
      status: '✅ COMPLETED',
      reason: 'GitHub API integration working, repository cloning implemented, agents can access code',
      recommendation: 'MARK COMPLETED',
      action: 'Update to Done state'
    },
    'TEL-5': {
      title: 'Task Atomization Engine - Claude API Integration',
      status: '✅ COMPLETED',
      reason: 'Claude CLI integration working with real conversations, task atomization functional',
      recommendation: 'MARK COMPLETED',
      action: 'Update to Done state'
    },
    'TEL-6': {
      title: 'Agent Runtime Environment - Docker Execution System', 
      status: '✅ COMPLETED',
      reason: 'Docker containers working with session persistence, both background and interactive modes functional',
      recommendation: 'MARK COMPLETED',
      action: 'Update to Done state'
    },
    'TEL-13': {
      title: 'Agent-Project Orchestration - Linear-GitHub Integration',
      status: '✅ COMPLETED',
      reason: 'Agent creation flow connects Linear projects with GitHub repos, orchestration working',
      recommendation: 'MARK COMPLETED',
      action: 'Update to Done state'
    },
    'TEL-14': {
      title: 'Background Agents Manager - Core Agent System',
      status: '✅ COMPLETED',
      reason: 'Agent manager fully implemented with database, UI, both execution modes working',
      recommendation: 'MARK COMPLETED',
      action: 'Update to Done state'
    }
  };
  
  // Check if we have specific analysis for this task
  if (systemFeatures[identifier]) {
    return systemFeatures[identifier];
  }
  
  // Generic analysis based on keywords and current state
  if (state === 'completed') {
    return {
      status: '✅ ALREADY COMPLETED',
      reason: 'Task already marked as completed',
      recommendation: 'NO ACTION NEEDED',
      action: null
    };
  }
  
  if (state === 'started') {
    return {
      status: '🔄 IN PROGRESS',
      reason: 'Task currently being worked on',
      recommendation: 'CONTINUE OR REVIEW',
      action: 'Check if actually completed and update accordingly'
    };
  }
  
  // Check for completed features
  const completedKeywords = [
    'telegram bot', 'agent creation', 'docker', 'linear integration',
    'github integration', 'claude', 'deployment', 'vps', 'production'
  ];
  
  for (const keyword of completedKeywords) {
    if (title.includes(keyword) || description.includes(keyword)) {
      return {
        status: '✅ SHOULD BE COMPLETED',
        reason: `Feature implemented: ${keyword}`,
        recommendation: 'MARK COMPLETED',
        action: 'Update to Done state with implementation notes'
      };
    }
  }
  
  return {
    status: '🔍 NEEDS REVIEW',
    reason: 'Could not determine completion status automatically',
    recommendation: 'MANUAL REVIEW',
    action: 'Review task details and current system implementation'
  };
}

function getPriorityName(priority) {
  const names = {
    0: '🔴 Urgent',
    1: '🟠 High', 
    2: '🟡 Medium',
    3: '🟢 Low',
    4: '⚪ None'
  };
  return names[priority] || '⚪ None';
}

if (require.main === module) {
  getDetailedTaskAnalysis().catch(console.error);
}

module.exports = { getDetailedTaskAnalysis };