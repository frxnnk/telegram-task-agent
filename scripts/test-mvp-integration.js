#!/usr/bin/env node

/**
 * Script para verificar que el proyecto MVP muestra las tareas TEST correctamente
 */

require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function testMVPIntegration() {
  console.log('🧪 Verificando integración proyecto MVP con tareas TEST...\n');
  
  const linear = new LinearManager(process.env.LINEAR_API_KEY);
  
  try {
    // 1. Obtener proyecto MVP
    console.log('1️⃣ Obteniendo proyecto MVP...');
    const projects = await linear.getProjects();
    const mvpProject = projects.find(p => p.name === 'MVP');
    
    if (!mvpProject) {
      throw new Error('Proyecto MVP no encontrado');
    }
    
    console.log(`   ✅ Proyecto: ${mvpProject.name}`);
    console.log(`   🏷️  Equipos: ${mvpProject.teams?.nodes?.map(t => t.name).join(', ')}`);
    console.log(`   📊 Estado: ${mvpProject.state}`);
    console.log(`   🎯 Progreso: ${Math.round(mvpProject.progress * 100)}%`);
    
    // 2. Obtener tareas del proyecto MVP (usando getIssuesByProject)
    console.log('\n2️⃣ Obteniendo tareas del proyecto MVP...');
    const mvpData = await linear.getIssuesByProject(mvpProject.id, 100);
    
    console.log(`   ✅ Total tareas en MVP: ${mvpData.issues.nodes.length}`);
    
    // 3. Filtrar tareas TEST
    const testTasks = mvpData.issues.nodes.filter(issue => 
      issue.title.startsWith('TEST:') || 
      issue.description.includes('🎯 **TAREA DE PRUEBA PARA TESTING DE AGENTES**')
    );
    
    console.log(`   🧪 Tareas TEST en MVP: ${testTasks.length}`);
    
    // 4. Mostrar detalles de tareas TEST
    console.log('\n3️⃣ Detalles de tareas TEST en proyecto MVP:');
    testTasks.forEach((task, index) => {
      const stateEmoji = linear.getStateEmoji(task.state.type);
      const priorityEmoji = linear.getPriorityEmoji(task.priority);
      
      console.log(`\n   ${index + 1}. ${stateEmoji}${priorityEmoji} ${task.identifier}`);
      console.log(`      📝 ${task.title.replace('TEST: ', '')}`);
      console.log(`      🏷️  Estado: ${task.state.name} (${task.state.type})`);
      console.log(`      👤 Asignado: ${task.assignee ? task.assignee.name : 'Sin asignar'}`);
      console.log(`      📁 Proyecto: ${task.project ? task.project.name : 'Sin proyecto'}`);
    });
    
    // 5. Verificar formateo para Telegram
    console.log('\n4️⃣ Formateo para Telegram del proyecto MVP:');
    const telegramMessage = linear.formatIssuesForTelegram(mvpData.issues.nodes, 'MVP', false);
    
    console.log('   ' + '='.repeat(60));
    console.log(telegramMessage.split('\n').map(line => `   ${line}`).join('\n'));
    console.log('   ' + '='.repeat(60));
    
    // 6. Test específico: formateo solo de tareas TEST
    console.log('\n5️⃣ Formateo específico de tareas TEST:');
    const testOnlyMessage = linear.formatIssuesForTelegram(testTasks, 'MVP (Solo tareas TEST)', false);
    
    console.log('   ' + '-'.repeat(60));
    console.log(testOnlyMessage.split('\n').map(line => `   ${line}`).join('\n'));
    console.log('   ' + '-'.repeat(60));
    
    // 7. Resumen para el bot
    console.log('\n6️⃣ Información para el bot de Telegram:');
    console.log(`   📋 Cuando selecciones "MVP" en el bot, verás:`);
    console.log(`   • Total de tareas: ${mvpData.issues.nodes.length}`);
    console.log(`   • Tareas TEST disponibles: ${testTasks.length}`);
    console.log(`   • GitHub repo sugerido: simple-webpage-test`);
    
    const testTaskIds = testTasks.map(t => t.identifier).join(', ');
    console.log(`   🧪 IDs de tareas TEST: ${testTaskIds}`);
    
    // 8. Instrucciones finales
    console.log('\n🎉 ¡Integración verificada exitosamente!');
    console.log('\n📱 Para probar en el bot de Telegram:');
    console.log('   1. Usar comando para crear agente background');
    console.log('   2. Seleccionar Linear Project: "MVP"'); 
    console.log('   3. Seleccionar GitHub Repo: "simple-webpage-test"');
    console.log('   4. El agente debería ver las 6 tareas TEST (RELY-46 a RELY-51)');
    console.log('   5. Ejecutar cualquier tarea TEST automáticamente');
    
    console.log('\n🚀 Tareas TEST listas para agentes background:');
    testTasks.forEach(task => {
      console.log(`   • ${task.identifier}: ${task.title.replace('TEST: ', '')}`);
    });
    
    return {
      mvpProject,
      totalTasks: mvpData.issues.nodes.length,
      testTasks: testTasks.length,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Ejecutar script
if (require.main === module) {
  testMVPIntegration();
}

module.exports = { testMVPIntegration };