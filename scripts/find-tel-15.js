require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function findTEL15() {
  const linear = new LinearManager(process.env.LINEAR_API_KEY);

  try {
    console.log('🔍 Searching for TEL-15 task...\n');
    
    // First, let's get all teams to find TEL team
    console.log('1️⃣ Getting all teams...');
    const teams = await linear.getTeams();
    
    console.log(`📊 Found ${teams.length} teams:`);
    teams.forEach(team => {
      console.log(`   • ${team.key}: ${team.name} (${team.issueCount} issues)`);
    });
    console.log('');
    
    // Look for TEL team
    const telTeam = teams.find(t => t.key === 'TEL');
    
    if (!telTeam) {
      console.log('❌ TEL team not found. Available teams:');
      teams.forEach(team => console.log(`   • ${team.key}: ${team.name}`));
      console.log('\n🔍 Searching across all teams for TEL-15...\n');
      
      // Search across all teams
      for (const team of teams) {
        console.log(`🔍 Checking team ${team.key} (${team.name})...`);
        const teamData = await linear.getIssuesByTeam(team.id, 100);
        
        const tel15Task = teamData.issues.nodes.find(issue => 
          issue.identifier === 'TEL-15' || 
          issue.identifier.includes('TEL-15') ||
          issue.title.toLowerCase().includes('tel-15')
        );
        
        if (tel15Task) {
          console.log(`✅ Found TEL-15 in team ${team.key}!\n`);
          displayTaskDetails(tel15Task);
          return tel15Task;
        }
      }
      
      console.log('❌ TEL-15 not found in any team.');
      return null;
    }
    
    // If TEL team exists, search there
    console.log(`2️⃣ Searching in TEL team (${telTeam.name})...`);
    const telTeamData = await linear.getIssuesByTeam(telTeam.id, 100);
    
    console.log(`📊 Found ${telTeamData.issues.nodes.length} issues in TEL team\n`);
    
    // Look for TEL-15 specifically
    const tel15Task = telTeamData.issues.nodes.find(issue => 
      issue.identifier === 'TEL-15'
    );
    
    if (tel15Task) {
      console.log('✅ Found TEL-15!\n');
      displayTaskDetails(tel15Task);
      
      // Get full details
      console.log('📋 Getting full task details...\n');
      const fullTask = await linear.getIssueById(tel15Task.id);
      displayFullTaskDetails(fullTask);
      
      return fullTask;
    } else {
      console.log('❌ TEL-15 not found in TEL team.');
      console.log('\n📋 Available tasks in TEL team:');
      telTeamData.issues.nodes.forEach((issue, i) => {
        console.log(`${i+1}. ${issue.identifier}: ${issue.title} [${issue.state.name}]`);
      });
      
      // Try broader search
      console.log('\n🔍 Trying broader search for "15" or "TEL"...');
      const searchResults = await linear.searchIssues('TEL-15', 50);
      
      if (searchResults.length > 0) {
        console.log(`✅ Found ${searchResults.length} results:`);
        searchResults.forEach((issue, i) => {
          console.log(`${i+1}. ${issue.identifier}: ${issue.title} [${issue.state.name}]`);
          if (issue.team) {
            console.log(`   Team: ${issue.team.key} (${issue.team.name})`);
          }
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error searching for TEL-15:', error.message);
    
    if (error.message.includes('Linear API Error')) {
      console.log('\n💡 Possible solutions:');
      console.log('• Check if LINEAR_API_KEY is correctly set in .env');
      console.log('• Verify the API key has access to the Linear workspace');
      console.log('• Make sure the API key hasn\'t expired');
    }
  }
}

function displayTaskDetails(task) {
  console.log('📋 Task Summary:');
  console.log(`   ID: ${task.id}`);
  console.log(`   Identifier: ${task.identifier}`);
  console.log(`   Title: ${task.title}`);
  console.log(`   Status: ${task.state.name} (${task.state.type})`);
  console.log(`   Priority: ${getPriorityText(task.priority)}`);
  
  if (task.assignee) {
    console.log(`   Assignee: ${task.assignee.name} (${task.assignee.email})`);
  } else {
    console.log(`   Assignee: Unassigned`);
  }
  
  if (task.project) {
    console.log(`   Project: ${task.project.name}`);
  }
  
  if (task.team) {
    console.log(`   Team: ${task.team.key} (${task.team.name})`);
  }
  
  if (task.estimate) {
    console.log(`   Estimate: ${task.estimate} points`);
  }
  
  console.log(`   URL: ${task.url}`);
  console.log('');
}

function displayFullTaskDetails(task) {
  console.log('📋 Full Task Details:');
  console.log(`   Description: ${task.description || 'No description'}`);
  console.log(`   Created: ${new Date(task.createdAt).toLocaleString()}`);
  console.log(`   Updated: ${new Date(task.updatedAt).toLocaleString()}`);
  
  if (task.labels && task.labels.nodes.length > 0) {
    console.log(`   Labels: ${task.labels.nodes.map(l => l.name).join(', ')}`);
  }
  
  if (task.comments && task.comments.nodes.length > 0) {
    console.log(`\n💬 Comments (${task.comments.nodes.length}):`);
    task.comments.nodes.forEach((comment, i) => {
      console.log(`   ${i+1}. ${comment.user.name} (${new Date(comment.createdAt).toLocaleString()}):`);
      console.log(`      ${comment.body.slice(0, 100)}${comment.body.length > 100 ? '...' : ''}`);
    });
  }
  console.log('');
}

function getPriorityText(priority) {
  const priorities = {
    0: '🔴 Urgent',
    1: '🟠 High', 
    2: '🟡 Medium',
    3: '🟢 Low',
    4: '⚪ No priority'
  };
  return priorities[priority] || '⚪ No priority';
}

// Export for use in other scripts
module.exports = { findTEL15 };

// Run if called directly
if (require.main === module) {
  findTEL15();
}