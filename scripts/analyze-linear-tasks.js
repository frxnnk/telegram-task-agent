#!/usr/bin/env node

const LinearManager = require('../src/integrations/LinearManager');
require('dotenv').config({ path: '.env.production' });

// Features that are COMPLETELY IMPLEMENTED according to CLAUDE.md
const IMPLEMENTED_FEATURES = {
  // Core System
  'telegram_bot_core': 'Fully functional with agent creation UI',
  'agent_creation': 'Complete flow with Linear project + GitHub repo selection',
  'database_schema': 'SQLite with agents and task_executions tables',
  
  // Execution Modes  
  'background_execution': 'Completely automatic - Claude decides everything',
  'interactive_execution': 'Real conversation with Claude CLI via Telegram',
  'docker_orchestration': 'Containers working with session persistence',
  
  // Integrations
  'linear_integration': 'GraphQL API with full CRUD operations',
  'github_integration': 'REST API + repository cloning',
  'claude_cli_integration': 'Real Claude CLI (v1.0.65) authenticated',
  
  // Infrastructure
  'vps_deployment': 'Hetzner VPS (5.75.171.46) fully configured',
  'process_management': 'PM2 with auto-restart enabled',
  'authentication': 'Claude CLI authenticated without API key',
  
  // UI/UX
  'telegram_ui': 'Complete dashboard with inline keyboards',
  'task_selection': 'Linear tasks displayed with state and priority',
  'agent_management': 'Create, list, and manage agents',
  
  // Advanced Features
  'session_persistence': 'UUID-based sessions for conversations',
  'container_isolation': 'Separate containers per task/session',
  'real_time_monitoring': 'Live status updates during execution'
};

async function analyzeLinearTasks() {
  console.log('🔍 Analyzing Linear Tasks vs Current System State...\n');
  
  const linear = new LinearManager(process.env.LINEAR_API_KEY);
  
  try {
    // Get all projects first
    console.log('📋 Fetching Linear projects...');
    const projects = await linear.getProjects();
    
    // Find telegram-related project(s)
    const telegramProjects = projects.filter(project => 
      project.name.toLowerCase().includes('telegram') || 
      project.description?.toLowerCase().includes('telegram')
    );
    
    console.log(`\n📁 Found ${telegramProjects.length} telegram-related projects:`);
    telegramProjects.forEach(project => {
      console.log(`- ${project.name} (${project.state}) - ${project.progress * 100}% complete`);
    });
    
    // Get all tasks from telegram projects
    let allTasks = [];
    for (const project of telegramProjects) {
      const projectData = await linear.getIssuesByProject(project.id, 100);
      if (projectData && projectData.issues) {
        allTasks = allTasks.concat(
          projectData.issues.nodes.map(task => ({
            ...task,
            projectName: project.name
          }))
        );
      }
    }
    
    // Also check TEL team
    console.log('\n📋 Fetching TEL team tasks...');
    try {
      const telData = await linear.getTelTasks();
      if (telData && telData.issues) {
        allTasks = allTasks.concat(
          telData.issues.map(task => ({
            ...task,
            teamName: telData.team.name
          }))
        );
      }
    } catch (error) {
      console.log('⚠️ TEL team not found or no access');
    }
    
    // Remove duplicates
    const uniqueTasks = allTasks.filter((task, index, self) => 
      index === self.findIndex(t => t.id === task.id)
    );
    
    console.log(`\n📊 Total unique tasks found: ${uniqueTasks.length}\n`);
    
    // Analyze task status
    const taskAnalysis = analyzeTaskStatus(uniqueTasks);
    
    // Generate recommendations
    console.log('=' .repeat(80));
    console.log('📋 LINEAR TASKS ANALYSIS REPORT');
    console.log('=' .repeat(80));
    
    printTaskSummary(taskAnalysis);
    printCompletionRecommendations(taskAnalysis.shouldComplete);
    printObsoleteRecommendations(taskAnalysis.shouldArchive);
    printNewTaskSuggestions();
    
  } catch (error) {
    console.error('❌ Error analyzing Linear tasks:', error.message);
    process.exit(1);
  }
}

function analyzeTaskStatus(tasks) {
  const analysis = {
    total: tasks.length,
    byState: {},
    byPriority: {},
    shouldComplete: [],
    shouldArchive: [],
    current: [],
    blocked: []
  };
  
  tasks.forEach(task => {
    // Count by state
    const state = task.state.type;
    analysis.byState[state] = (analysis.byState[state] || 0) + 1;
    
    // Count by priority
    const priority = task.priority !== null ? task.priority : 4;
    analysis.byPriority[priority] = (analysis.byPriority[priority] || 0) + 1;
    
    // Analyze what should be done with this task
    const recommendation = getTaskRecommendation(task);
    analysis[recommendation.category].push({
      task,
      reason: recommendation.reason,
      action: recommendation.action
    });
  });
  
  return analysis;
}

function getTaskRecommendation(task) {
  const title = task.title.toLowerCase();
  const description = (task.description || '').toLowerCase();
  const identifier = task.identifier;
  const state = task.state.type;
  
  // Tasks that should be marked as COMPLETED
  const completedKeywords = [
    'telegram bot', 'agent creation', 'docker orchestration', 'linear integration',
    'github integration', 'claude cli', 'vps deployment', 'background execution',
    'interactive execution', 'database schema', 'sqlite', 'agent manager',
    'task selection', 'session persistence', 'container isolation'
  ];
  
  // Tasks that are OBSOLETE/should be archived
  const obsoleteKeywords = [
    'api key', 'mock mode', 'simulation', 'prototype', 'research', 'investigation',
    'test setup', 'initial setup', 'basic structure', 'proof of concept'
  ];
  
  // Check for completion
  for (const keyword of completedKeywords) {
    if (title.includes(keyword) || description.includes(keyword)) {
      if (state !== 'completed') {
        return {
          category: 'shouldComplete',
          reason: `Feature fully implemented: ${keyword}`,
          action: 'mark_completed'
        };
      }
    }
  }
  
  // Check for obsolete
  for (const keyword of obsoleteKeywords) {
    if (title.includes(keyword) || description.includes(keyword)) {
      return {
        category: 'shouldArchive',
        reason: `No longer relevant: ${keyword}`,
        action: 'archive_or_delete'
      };
    }
  }
  
  // Current/active tasks
  if (state === 'started' || state === 'unstarted') {
    return {
      category: 'current',
      reason: 'Active task',
      action: 'keep_active'
    };
  }
  
  // Already completed
  if (state === 'completed') {
    return {
      category: 'current',
      reason: 'Already completed',
      action: 'no_action'
    };
  }
  
  // Default
  return {
    category: 'current',
    reason: 'Needs review',
    action: 'manual_review'
  };
}

function printTaskSummary(analysis) {
  console.log('\n📊 CURRENT TASK DISTRIBUTION\n');
  
  console.log('By State:');
  Object.entries(analysis.byState).forEach(([state, count]) => {
    const emoji = getStateEmoji(state);
    console.log(`  ${emoji} ${state.padEnd(12)} ${count} tasks`);
  });
  
  console.log('\nBy Priority:');
  const priorityNames = ['Urgent', 'High', 'Medium', 'Low', 'None'];
  Object.entries(analysis.byPriority).forEach(([priority, count]) => {
    const emoji = getPriorityEmoji(parseInt(priority));
    const name = priorityNames[parseInt(priority)] || 'Unknown';
    console.log(`  ${emoji} ${name.padEnd(12)} ${count} tasks`);
  });
  
  console.log('\nRecommendation Summary:');
  console.log(`  ✅ Should complete: ${analysis.shouldComplete.length} tasks`);
  console.log(`  🗑️  Should archive:  ${analysis.shouldArchive.length} tasks`);
  console.log(`  🔄 Keep current:    ${analysis.current.length} tasks`);
}

function printCompletionRecommendations(shouldComplete) {
  if (shouldComplete.length === 0) {
    console.log('\n✅ No tasks need to be marked as completed.');
    return;
  }
  
  console.log('\n✅ TASKS TO MARK AS COMPLETED');
  console.log('-'.repeat(50));
  
  shouldComplete.forEach(({ task, reason }) => {
    console.log(`\n📌 ${task.identifier}: ${task.title}`);
    console.log(`   Current state: ${task.state.name}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Action: Mark as completed and add completion comment`);
  });
}

function printObsoleteRecommendations(shouldArchive) {
  if (shouldArchive.length === 0) {
    console.log('\n🗑️ No obsolete tasks found.');
    return;
  }
  
  console.log('\n🗑️ OBSOLETE TASKS TO ARCHIVE/DELETE');
  console.log('-'.repeat(50));
  
  shouldArchive.forEach(({ task, reason }) => {
    console.log(`\n📌 ${task.identifier}: ${task.title}`);
    console.log(`   Current state: ${task.state.name}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Action: Archive or delete task`);
  });
}

function printNewTaskSuggestions() {
  console.log('\n🆕 SUGGESTED NEW TASKS FOR CURRENT SYSTEM STATE');
  console.log('-'.repeat(60));
  
  const newTasks = [
    {
      title: 'Production Monitoring Dashboard',
      description: 'Create monitoring dashboard for VPS health, active agents, and execution metrics',
      priority: 'High',
      reasoning: 'System is in production but lacks monitoring tools'
    },
    {
      title: 'Error Recovery and Retry Logic',
      description: 'Implement automatic retry for failed tasks and better error recovery',
      priority: 'High', 
      reasoning: 'Production system needs robust error handling'
    },
    {
      title: 'Agent Execution History and Analytics',
      description: 'Track agent performance, execution times, and success rates',
      priority: 'Medium',
      reasoning: 'Useful for optimizing agent performance'
    },
    {
      title: 'Multi-User Support and Permissions',
      description: 'Allow multiple users to create and manage their own agents',
      priority: 'Medium',
      reasoning: 'Scale beyond single user'
    },
    {
      title: 'Resource Usage Monitoring',
      description: 'Monitor Docker container resource usage and implement limits',
      priority: 'Medium',
      reasoning: 'Prevent resource exhaustion on VPS'
    },
    {
      title: 'Conversation Export and Sharing',
      description: 'Export interactive conversations for documentation and sharing',
      priority: 'Low',
      reasoning: 'Nice-to-have for collaboration'
    }
  ];
  
  newTasks.forEach((task, index) => {
    console.log(`\n${index + 1}. 📋 ${task.title}`);
    console.log(`   Priority: ${getPriorityEmoji(task.priority === 'High' ? 1 : task.priority === 'Medium' ? 2 : 3)} ${task.priority}`);
    console.log(`   Description: ${task.description}`);
    console.log(`   Reasoning: ${task.reasoning}`);
  });
}

function getStateEmoji(state) {
  const emojis = {
    'backlog': '📋',
    'unstarted': '⏳', 
    'started': '🔄',
    'completed': '✅',
    'canceled': '❌',
    'triage': '🔍',
    'planned': '📅'
  };
  return emojis[state] || '📌';
}

function getPriorityEmoji(priority) {
  const emojis = {
    0: '🔴', // Urgent
    1: '🟠', // High
    2: '🟡', // Medium  
    3: '🟢', // Low
    4: '⚪'  // None
  };
  return emojis[priority] || '⚪';
}

// Run analysis
if (require.main === module) {
  analyzeLinearTasks().catch(console.error);
}

module.exports = { analyzeLinearTasks };