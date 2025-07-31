const LinearManager = require('./src/integrations/LinearManager.js');

async function migrateTelegramTasks() {
  const linear = new LinearManager(process.env.LINEAR_API_KEY);
  
  try {
    console.log('🚀 Iniciando migración de tareas de Telegram...\n');
    
    // Step 1: Create Telegram team
    console.log('📋 Paso 1: Creando equipo Telegram...');
    const teamCreation = await linear.createTeam(
      'Telegram Task Agent',
      'TEL',
      'Sistema de agentes atomizados - Telegram Task Manager'
    );
    
    if (!teamCreation.success) {
      throw new Error('Error creando equipo Telegram');
    }
    
    const telegramTeam = teamCreation.team;
    console.log(`✅ Equipo creado: ${telegramTeam.name} (${telegramTeam.key}) - ID: ${telegramTeam.id}\n`);
    
    // Step 2: Get RELY team ID
    console.log('📋 Paso 2: Obteniendo ID del equipo RELY...');
    const teams = await linear.getTeams();
    const relyTeam = teams.find(team => team.key === 'RELY');
    
    if (!relyTeam) {
      throw new Error('Equipo RELY no encontrado');
    }
    
    console.log(`✅ Equipo RELY encontrado - ID: ${relyTeam.id}\n`);
    
    // Step 3: Get all issues from RELY team
    console.log('📋 Paso 3: Obteniendo todas las tareas del equipo RELY...');
    const allRelyIssues = await linear.getAllIssuesFromTeam(relyTeam.id);
    console.log(`✅ Total tareas en RELY: ${allRelyIssues.length}\n`);
    
    // Step 4: Filter Telegram tasks
    console.log('📋 Paso 4: Filtrando tareas de Telegram...');
    const telegramTasks = allRelyIssues.filter(issue => 
      issue.title.toLowerCase().includes('telegram') ||
      issue.description?.toLowerCase().includes('telegram') ||
      issue.identifier.includes('AGENT-TELEGRAM') ||
      (issue.project && issue.project.name && issue.project.name.toLowerCase().includes('telegram'))
    );
    
    console.log(`✅ Tareas de Telegram encontradas: ${telegramTasks.length}\n`);
    
    // Show tasks to be moved
    console.log('🤖 Tareas que serán movidas:');
    telegramTasks.forEach((task, index) => {
      console.log(`  ${index + 1}. ${task.identifier}: ${task.title}`);
      if (task.project) console.log(`     📁 Proyecto: ${task.project.name}`);
    });
    console.log('');
    
    // Step 5: Move tasks to Telegram team
    console.log('📋 Paso 5: Moviendo tareas al equipo Telegram...');
    
    let movedCount = 0;
    let errorCount = 0;
    
    for (const task of telegramTasks) {
      try {
        console.log(`🔄 Moviendo ${task.identifier}...`);
        
        const updateResult = await linear.updateIssueTeam(task.id, telegramTeam.id);
        
        if (updateResult.success) {
          console.log(`✅ ${task.identifier} movido exitosamente`);
          movedCount++;
        } else {
          console.log(`❌ Error moviendo ${task.identifier}`);
          errorCount++;
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log(`❌ Error moviendo ${task.identifier}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Resumen de migración:`);
    console.log(`✅ Tareas movidas exitosamente: ${movedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📋 Total procesadas: ${telegramTasks.length}`);
    
    if (movedCount === telegramTasks.length) {
      console.log('\n🎉 ¡Migración completada exitosamente!');
      console.log(`🤖 Todas las tareas de Telegram ahora están en el equipo "${telegramTeam.name}" (${telegramTeam.key})`);
    }
    
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    process.exit(1);
  }
}

// Execute migration
if (require.main === module) {
  migrateTelegramTasks().catch(console.error);
}

module.exports = migrateTelegramTasks;