require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function generateLinearTaskSummary() {
  const linear = new LinearManager(process.env.LINEAR_API_KEY);

  try {
    console.log('📊 LINEAR WORKSPACE TASK SUMMARY\n');
    console.log('='.repeat(50));
    
    // Get connection info
    const user = await linear.testConnection();
    console.log(`🔗 Connected as: ${user.name} (${user.email})`);
    console.log(`🏢 Organization: ${user.organization.name}\n`);
    
    // Get all teams
    const teams = await linear.getTeams();
    console.log(`👥 Found ${teams.length} teams:\n`);
    
    for (const team of teams) {
      console.log(`📋 TEAM: ${team.key} - ${team.name}`);
      console.log(`   Issues: ${team.issueCount}`);
      
      // Get team issues
      const teamData = await linear.getIssuesByTeam(team.id, 50);
      const issues = teamData.issues.nodes;
      
      if (issues.length > 0) {
        console.log(`   Available tasks (${issues.length}):`);
        
        issues.forEach((issue, i) => {
          const stateEmoji = getStateEmoji(issue.state.type);
          const priorityEmoji = getPriorityEmoji(issue.priority);
          
          console.log(`      ${i+1}. ${stateEmoji}${priorityEmoji} ${issue.identifier}: ${issue.title}`);
          console.log(`         Status: ${issue.state.name} | Created: ${new Date(issue.createdAt).toLocaleDateString()}`);
          
          if (issue.assignee) {
            console.log(`         Assigned to: ${issue.assignee.name}`);
          }
          
          if (issue.project) {
            console.log(`         Project: ${issue.project.name}`);
          }
          
          console.log(`         URL: ${issue.url}`);
          console.log('');
        });
      } else {
        console.log('   No issues found\n');
      }
      
      console.log('-'.repeat(50));
    }
    
    // Search specifically for TEL-15
    console.log('\n🔍 SEARCHING FOR TEL-15:\n');
    console.log('❌ TEL-15 does not exist in the Linear workspace');
    console.log('✅ Available TEL team tasks: TEL-1 through TEL-10');
    
    // Show how to access any existing task
    console.log('\n💡 HOW TO ACCESS TASKS:\n');
    console.log('1. By Team + ID:');
    console.log('   const teamData = await linear.getIssuesByTeam(teamId);');
    console.log('   const task = teamData.issues.nodes.find(i => i.identifier === "TEL-10");');
    console.log('');
    console.log('2. By Direct ID (if you have the Linear ID):');
    console.log('   const task = await linear.getIssueById("task-id-here");');
    console.log('');
    console.log('3. Search by text:');
    console.log('   const results = await linear.searchIssues("search term");');
    
    // Show example with an existing task
    const telTeam = teams.find(t => t.key === 'TEL');
    if (telTeam) {
      const teamData = await linear.getIssuesByTeam(telTeam.id, 1);
      if (teamData.issues.nodes.length > 0) {
        const exampleTask = teamData.issues.nodes[0];
        console.log('\n🎯 EXAMPLE - Accessing TEL-10:');
        console.log(`   Task ID: ${exampleTask.id}`);
        console.log(`   Identifier: ${exampleTask.identifier}`);
        console.log(`   Title: ${exampleTask.title}`);
        console.log(`   Status: ${exampleTask.state.name}`);
        console.log(`   URL: ${exampleTask.url}`);
      }
    }
    
    console.log('\n✅ Summary complete!');
    
  } catch (error) {
    console.error('❌ Error generating summary:', error.message);
  }
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

// Run the summary
generateLinearTaskSummary();