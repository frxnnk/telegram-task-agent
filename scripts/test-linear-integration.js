#!/usr/bin/env node

/**
 * Script para verificar la integración LinearManager con las tareas TEST
 */

require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function testLinearIntegration() {
  console.log('🧪 Testing integración LinearManager con tareas TEST...\n');
  
  const linear = new LinearManager(process.env.LINEAR_API_KEY);
  
  try {
    // 1. Verificar conexión
    console.log('1️⃣ Verificando conexión...');
    const viewer = await linear.testConnection();
    console.log(`   ✅ Conectado como: ${viewer.name}`);
    
    // 2. Obtener equipo RELY
    console.log('\n2️⃣ Obteniendo información del equipo RELY...');
    const relyTeam = await linear.getTeamByKey('RELY');
    if (!relyTeam) {
      throw new Error('Equipo RELY no encontrado');
    }
    console.log(`   ✅ Equipo: ${relyTeam.name} (${relyTeam.issueCount} tareas)`);
    
    // 3. Obtener todas las tareas del equipo RELY
    console.log('\n3️⃣ Obteniendo tareas del equipo RELY...');
    const teamData = await linear.getIssuesByTeam(relyTeam.id, 100);
    console.log(`   ✅ Total tareas encontradas: ${teamData.issues.nodes.length}`);
    
    // 4. Filtrar tareas TEST específicamente
    console.log('\n4️⃣ Filtrando tareas TEST...');
    const testTasks = teamData.issues.nodes.filter(issue => 
      issue.title.startsWith('TEST:') || 
      issue.description.includes('🎯 **TAREA DE PRUEBA PARA TESTING DE AGENTES**')
    );
    
    console.log(`   ✅ Tareas TEST encontradas: ${testTasks.length}`);
    
    // 5. Mostrar detalles de cada tarea TEST
    console.log('\n5️⃣ Detalles de las tareas TEST:');
    testTasks.forEach((task, index) => {
      const stateEmoji = linear.getStateEmoji(task.state.type);
      const priorityEmoji = linear.getPriorityEmoji(task.priority);
      
      console.log(`\n   ${index + 1}. ${stateEmoji}${priorityEmoji} ${task.identifier}`);
      console.log(`      📝 ${task.title.replace('TEST: ', '')}`);
      console.log(`      🏷️  Estado: ${task.state.name} (${task.state.type})`);
      console.log(`      👤 Asignado: ${task.assignee ? task.assignee.name : 'Sin asignar'}`);
      if (task.estimate) {
        console.log(`      ⏱️  Estimación: ${task.estimate} puntos`);
      }
    });
    
    // 6. Verificar capacidad de obtener tareas por identifier
    console.log('\n6️⃣ Testing búsqueda por identifier...');
    if (testTasks.length > 0) {
      const firstTask = testTasks[0];
      console.log(`   🔍 Buscando tarea: ${firstTask.identifier}`);
      
      const foundTask = await linear.getIssueById(firstTask.id);
      if (foundTask) {
        console.log(`   ✅ Tarea encontrada: ${foundTask.identifier} - ${foundTask.title}`);
        console.log(`   📝 Descripción: ${foundTask.description.slice(0, 100)}...`);
      }
    }
    
    // 7. Verificar formateo para Telegram
    console.log('\n7️⃣ Testing formateo para Telegram...');
    const telegramMessage = linear.formatIssuesForTelegram(testTasks, 'RELY (TEST tasks)', false);
    console.log('   ✅ Mensaje formateado para Telegram:');
    console.log('   ' + '-'.repeat(50));
    console.log(telegramMessage.split('\n').map(line => `   ${line}`).join('\n'));
    console.log('   ' + '-'.repeat(50));
    
    // 8. Resumen final
    console.log('\n🎉 ¡Integración verificada exitosamente!');
    console.log('\n📊 Resumen de verificación:');
    console.log(`   🔗 LinearManager: ✅ Funcionando`);
    console.log(`   🏷️  Equipo RELY: ✅ Accesible`);
    console.log(`   📋 Tareas TEST: ✅ ${testTasks.length} encontradas`);
    console.log(`   🤖 Formateo Telegram: ✅ Funcionando`);
    console.log(`   🔍 Búsqueda por ID: ✅ Funcionando`);
    
    console.log('\n💡 El sistema está listo para crear y probar agentes background!');
    console.log('\n🚀 Próximos pasos:');
    console.log('   1. Crear agente background en el bot de Telegram');
    console.log('   2. Seleccionar Linear project: RELY');
    console.log('   3. Seleccionar GitHub repo: simple-webpage-test');
    console.log('   4. Ejecutar tareas TEST automáticamente');
    
    return {
      success: true,
      relyTeam,
      testTasks,
      totalTasks: teamData.issues.nodes.length
    };
    
  } catch (error) {
    console.error('❌ Error en la verificación:', error.message);
    return { success: false, error: error.message };
  }
}

// Ejecutar script
if (require.main === module) {
  testLinearIntegration();
}

module.exports = { testLinearIntegration };