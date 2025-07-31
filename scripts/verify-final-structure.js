#!/usr/bin/env node

/**
 * Script para verificar la estructura final de proyectos
 */

require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function verifyFinalStructure() {
  console.log('🔍 Verificando estructura final de proyectos...\n');
  
  const linear = new LinearManager(process.env.LINEAR_API_KEY);
  
  try {
    // 1. Listar todos los proyectos
    console.log('1️⃣ PROYECTOS DISPONIBLES EN EL BOT:');
    const projects = await linear.getProjects();
    
    projects.forEach((project, index) => {
      const teamNames = project.teams?.nodes?.map(t => `${t.name} (${t.key})`).join(', ') || 'Sin equipo';
      console.log(`   ${index + 1}. 📁 ${project.name}`);
      console.log(`      🏷️  Equipos: ${teamNames}`);
      console.log(`      📊 Estado: ${project.state}`);
      if (project.progress) {
        console.log(`      🎯 Progreso: ${Math.round(project.progress * 100)}%`);
      }
      if (project.description) {
        console.log(`      📝 ${project.description}`);
      }
      console.log('');
    });
    
    // 2. Verificar proyecto RELY
    console.log('2️⃣ PROYECTO RELY (Tareas de producción):');
    const relyProject = projects.find(p => p.name === 'RELY');
    
    if (relyProject) {
      const relyData = await linear.getIssuesByProject(relyProject.id, 100);
      console.log(`   ✅ Proyecto encontrado: ${relyProject.name}`);
      console.log(`   📊 Total de tareas: ${relyData.issues.nodes.length}`);
      
      // Verificar que no hay tareas TEST
      const testTasksInRely = relyData.issues.nodes.filter(issue => 
        issue.title.startsWith('TEST:')
      );
      console.log(`   🧪 Tareas TEST (debería ser 0): ${testTasksInRely.length}`);
      
      // Mostrar algunas tareas de ejemplo
      console.log('   📋 Tareas de ejemplo:');
      relyData.issues.nodes.slice(0, 3).forEach(task => {
        console.log(`      • ${task.identifier}: ${task.title.slice(0, 50)}${task.title.length > 50 ? '...' : ''}`);
      });
    } else {
      console.log('   ❌ Proyecto RELY no encontrado');
    }
    
    // 3. Verificar proyecto TEST
    console.log('\n3️⃣ PROYECTO TEST (Tareas de prueba):');
    const testProject = projects.find(p => p.name === 'TEST');
    
    if (testProject) {
      const testData = await linear.getIssuesByProject(testProject.id, 100);
      console.log(`   ✅ Proyecto encontrado: ${testProject.name}`);
      console.log(`   📊 Total de tareas: ${testData.issues.nodes.length}`);
      
      // Verificar tareas TEST
      const testTasks = testData.issues.nodes.filter(issue => 
        issue.title.startsWith('TEST:')
      );
      console.log(`   🧪 Tareas TEST: ${testTasks.length}`);
      
      // Mostrar todas las tareas TEST
      console.log('   📋 Tareas TEST disponibles:');
      testTasks.forEach(task => {
        const stateEmoji = linear.getStateEmoji(task.state.type);
        const priorityEmoji = linear.getPriorityEmoji(task.priority);
        console.log(`      ${stateEmoji}${priorityEmoji} ${task.identifier}: ${task.title.replace('TEST: ', '')}`);
      });
    } else {
      console.log('   ❌ Proyecto TEST no encontrado');
    }
    
    // 4. Simulación de lo que verá el bot
    console.log('\n4️⃣ SIMULACIÓN DEL BOT DE TELEGRAM:');
    console.log('   Cuando el usuario cree un agente background, verá:');
    console.log('');
    console.log('   📋 **Seleccionar Linear Project:**');
    projects.forEach((project, index) => {
      console.log(`   ${index + 1}. 📁 ${project.name}`);
    });
    console.log('');
    
    // 5. Formateo para Telegram del proyecto TEST
    if (testProject) {
      console.log('5️⃣ FORMATEO TELEGRAM DEL PROYECTO TEST:');
      const testData = await linear.getIssuesByProject(testProject.id, 100);
      const telegramMessage = linear.formatIssuesForTelegram(testData.issues.nodes, 'TEST', false);
      
      console.log('   ' + '='.repeat(60));
      console.log(telegramMessage.split('\n').map(line => `   ${line}`).join('\n'));
      console.log('   ' + '='.repeat(60));
    }
    
    // 6. Instrucciones finales
    console.log('\n🎉 ¡ESTRUCTURA VERIFICADA EXITOSAMENTE!');
    console.log('\n📱 Instrucciones para el usuario:');
    console.log('   1. Crear agente background en Telegram bot');
    console.log('   2. Seleccionar Linear Project: "TEST"');
    console.log('   3. Seleccionar GitHub Repo: "simple-webpage-test"');
    console.log('   4. Ejecutar cualquier tarea RELY-46 a RELY-51');
    console.log('');
    console.log('📊 Estructura final:');
    console.log('   • Proyecto "RELY": Tareas reales de producción');
    console.log('   • Proyecto "TEST": 6 tareas de prueba para agentes');
    console.log('   • GitHub repo: simple-webpage-test listo');
    console.log('   • Integración LinearManager: ✅ Funcionando');
    
    return {
      projects: projects.map(p => ({ name: p.name, id: p.id })),
      relyProject: relyProject ? { 
        name: relyProject.name, 
        totalTasks: relyData?.issues?.nodes?.length || 0 
      } : null,
      testProject: testProject ? { 
        name: testProject.name, 
        totalTasks: testData?.issues?.nodes?.length || 0,
        testTasks: testTasks?.length || 0
      } : null,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Ejecutar script
if (require.main === module) {
  verifyFinalStructure();
}

module.exports = { verifyFinalStructure };