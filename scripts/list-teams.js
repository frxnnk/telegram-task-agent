#!/usr/bin/env node

require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function listTeams() {
  const linear = new LinearManager(process.env.LINEAR_API_KEY);
  
  try {
    console.log('📋 Listando equipos disponibles en Linear...\n');
    
    const teams = await linear.getTeams();
    
    teams.forEach((team, index) => {
      console.log(`${index + 1}. 🏷️  ${team.name} (${team.key})`);
      console.log(`   📊 ${team.issueCount} tareas`);
      if (team.description) {
        console.log(`   📝 ${team.description}`);
      }
      console.log('');
    });
    
    console.log(`Total: ${teams.length} equipos encontrados`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listTeams();