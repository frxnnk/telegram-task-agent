#!/usr/bin/env node

/**
 * Script para asignar las tareas TEST al proyecto MVP existente
 */

require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function assignTestTasksToMVP() {
  console.log('🔧 Asignando tareas TEST al proyecto MVP...\n');
  
  const linear = new LinearManager(process.env.LINEAR_API_KEY);
  
  try {
    // 1. Obtener proyecto MVP
    console.log('1️⃣ Obteniendo proyecto MVP...');
    const projects = await linear.getProjects();
    const mvpProject = projects.find(p => p.name === 'MVP');
    
    if (!mvpProject) {
      throw new Error('Proyecto MVP no encontrado');
    }
    
    console.log(`   ✅ Proyecto MVP encontrado: ${mvpProject.name}`);
    console.log(`   📊 Estado: ${mvpProject.state}`);
    console.log(`   🎯 Progreso: ${Math.round(mvpProject.progress * 100)}%`);
    
    // 2. Obtener tareas TEST del equipo RELY  
    console.log('\n2️⃣ Obteniendo tareas TEST...');
    const relyTeam = await linear.getTeamByKey('RELY');
    const teamData = await linear.getIssuesByTeam(relyTeam.id, 100);
    
    const testTasks = teamData.issues.nodes.filter(issue => 
      issue.title.startsWith('TEST:') || 
      issue.description.includes('🎯 **TAREA DE PRUEBA PARA TESTING DE AGENTES**')
    );
    
    console.log(`   ✅ Tareas TEST encontradas: ${testTasks.length}`);
    
    // 3. Asignar cada tarea TEST al proyecto MVP
    console.log('\n3️⃣ Asignando tareas al proyecto MVP...');
    
    const results = [];
    
    // Note: Linear API doesn't have a direct mutation to assign issues to projects
    // We need to use the issueUpdate mutation with projectId
    
    for (const task of testTasks) {
      console.log(`   🔄 Procesando: ${task.identifier} - ${task.title.replace('TEST: ', '')}`);
      
      try {
        const query = `
          mutation UpdateIssueProject($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
              success
              issue {
                id
                identifier
                title
                project {
                  id
                  name
                }
              }
            }
          }
        `;
        
        const result = await linear.makeRequest(query, {
          id: task.id,
          input: {
            projectId: mvpProject.id
          }
        });
        
        if (result.issueUpdate.success) {
          console.log(`   ✅ ${task.identifier}: Asignado al proyecto MVP`);
          results.push({
            success: true,
            identifier: task.identifier,
            title: task.title
          });
        } else {
          console.log(`   ❌ ${task.identifier}: Error en asignación`);
          results.push({
            success: false,
            identifier: task.identifier,
            error: 'Update failed'
          });
        }
        
      } catch (error) {
        console.log(`   ❌ ${task.identifier}: ${error.message}`);
        results.push({
          success: false,
          identifier: task.identifier,
          error: error.message
        });
      }
      
      // Delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 4. Verificar asignaciones
    console.log('\n4️⃣ Verificando asignaciones...');
    const updatedTeamData = await linear.getIssuesByTeam(relyTeam.id, 100);
    const updatedTestTasks = updatedTeamData.issues.nodes.filter(issue => 
      issue.title.startsWith('TEST:') || 
      issue.description.includes('🎯 **TAREA DE PRUEBA PARA TESTING DE AGENTES**')
    );
    
    const tasksWithProject = updatedTestTasks.filter(t => t.project);
    
    console.log(`   📊 Tareas TEST con proyecto asignado: ${tasksWithProject.length}/${testTasks.length}`);
    
    tasksWithProject.forEach(task => {
      console.log(`   ✅ ${task.identifier}: ${task.project.name}`);
    });
    
    // 5. Verificar proyecto MVP
    console.log('\n5️⃣ Verificando proyecto MVP actualizado...');
    const mvpIssues = await linear.getIssuesByProject(mvpProject.id, 100);
    const mvpTestTasks = mvpIssues.issues.nodes.filter(issue => 
      issue.title.startsWith('TEST:')
    );
    
    console.log(`   📋 Tareas TEST en proyecto MVP: ${mvpTestTasks.length}`);
    
    // 6. Resumen final
    console.log('\n🎉 ¡Asignación completada!');
    console.log('\n📊 Resumen:');
    console.log(`   🎯 Proyecto: MVP`);
    console.log(`   📋 Tareas procesadas: ${testTasks.length}`);
    console.log(`   ✅ Asignaciones exitosas: ${results.filter(r => r.success).length}`);
    console.log(`   ❌ Errores: ${results.filter(r => !r.success).length}`);
    
    console.log('\n💡 Ahora el bot debería mostrar las tareas TEST cuando selecciones el proyecto MVP!');
    
    return {
      mvpProject,
      results,
      successCount: results.filter(r => r.success).length
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Ejecutar script
if (require.main === module) {
  assignTestTasksToMVP();
}

module.exports = { assignTestTasksToMVP };