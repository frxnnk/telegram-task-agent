require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function checkRelyTasks() {
  const linear = new LinearManager(process.env.LINEAR_API_KEY);

  try {
    console.log('🔄 Getting RELY team tasks...');
    
    const teams = await linear.getTeams();
    const relyTeam = teams.find(t => t.key === 'RELY');
    
    if (!relyTeam) {
      throw new Error('RELY team not found');
    }
    
    const teamData = await linear.getIssuesByTeam(relyTeam.id, 50);
    
    console.log('✅ RELY team tasks:');
    console.log('📊 Total issues:', teamData.issues.nodes.length);
    console.log('');
    
    teamData.issues.nodes.forEach((issue, i) => {
      const status = issue.state.name;
      const priorities = ['🔴', '🟠', '🟡', '🟢', '⚪'];
      const priority = priorities[issue.priority] || '⚪';
      
      console.log(`${i+1}. ${priority} [${status}] ${issue.identifier}: ${issue.title}`);
      
      if (issue.description) {
        console.log(`   📝 ${issue.description.slice(0, 80)}...`);
      }
      
      // Show project if available
      if (issue.project) {
        console.log(`   📁 Project: ${issue.project.name}`);
      }
      
      console.log('');
    });
    
    // Filter tasks related to this project
    const projectTasks = teamData.issues.nodes.filter(issue => 
      issue.title.toLowerCase().includes('telegram') ||
      issue.title.toLowerCase().includes('task') ||
      issue.title.toLowerCase().includes('atomizer') ||
      issue.title.toLowerCase().includes('rely-')
    );
    
    console.log('🎯 Project-related tasks found:', projectTasks.length);
    projectTasks.forEach(task => {
      console.log(`   • ${task.identifier}: ${task.title} [${task.state.name}]`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRelyTasks();