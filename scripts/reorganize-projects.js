#!/usr/bin/env node

/**
 * Script para reorganizar proyectos Linear:
 * 1. Cambiar "MVP" → "RELY" 
 * 2. Crear proyecto "TEST"
 * 3. Mover tareas TEST de RELY al proyecto TEST
 */

require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function reorganizeProjects() {
  console.log('🔄 Reorganizando proyectos Linear...\n');
  
  const linear = new LinearManager(process.env.LINEAR_API_KEY);
  
  try {
    // 1. Cambiar nombre del proyecto MVP → RELY
    console.log('1️⃣ Cambiando nombre del proyecto MVP → RELY...');
    const projects = await linear.getProjects();
    const mvpProject = projects.find(p => p.name === 'MVP');
    
    if (!mvpProject) {
      throw new Error('Proyecto MVP no encontrado');
    }
    
    console.log(`   📁 Proyecto actual: ${mvpProject.name}`);
    
    // Update project name
    const updateProjectQuery = `
      mutation UpdateProject($id: String!, $input: ProjectUpdateInput!) {
        projectUpdate(id: $id, input: $input) {
          success
          project {
            id
            name
            description
          }
        }
      }
    `;
    
    const updateResult = await linear.makeRequest(updateProjectQuery, {
      id: mvpProject.id,
      input: {
        name: 'RELY',
        description: 'Desarrollo del proyecto Rely - Tareas de producción'
      }
    });
    
    if (updateResult.projectUpdate.success) {
      console.log(`   ✅ Proyecto renombrado: ${updateResult.projectUpdate.project.name}`);
    } else {
      throw new Error('Error al renombrar proyecto MVP');
    }
    
    // 2. Crear nuevo proyecto TEST
    console.log('\n2️⃣ Creando nuevo proyecto TEST...');
    
    const createProjectQuery = `
      mutation CreateProject($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          success
          project {
            id
            name
            description
          }
        }
      }
    `;
    
    const relyTeam = await linear.getTeamByKey('RELY');
    
    const createResult = await linear.makeRequest(createProjectQuery, {
      input: {
        name: 'TEST',
        description: '🧪 Proyecto de prueba para testing del sistema de agentes background - Simple Webpage Test',
        teamIds: [relyTeam.id]
      }
    });
    
    if (!createResult.projectCreate.success) {
      throw new Error('Error al crear proyecto TEST');
    }
    
    const testProject = createResult.projectCreate.project;
    console.log(`   ✅ Proyecto TEST creado: ${testProject.name}`);
    console.log(`   📝 ${testProject.description}`);
    
    // 3. Obtener tareas TEST del proyecto RELY (ex-MVP)
    console.log('\n3️⃣ Obteniendo tareas TEST del proyecto RELY...');
    const relyProjectData = await linear.getIssuesByProject(mvpProject.id, 100);
    
    const testTasks = relyProjectData.issues.nodes.filter(issue => 
      issue.title.startsWith('TEST:') || 
      issue.description.includes('🎯 **TAREA DE PRUEBA PARA TESTING DE AGENTES**')
    );
    
    console.log(`   🧪 Tareas TEST encontradas: ${testTasks.length}`);
    
    // 4. Mover tareas TEST al proyecto TEST
    console.log('\n4️⃣ Moviendo tareas TEST al proyecto TEST...');
    
    const moveResults = [];
    
    for (const task of testTasks) {
      console.log(`   🔄 Moviendo: ${task.identifier} - ${task.title.replace('TEST: ', '')}`);
      
      try {
        const moveQuery = `
          mutation MoveIssueToProject($id: String!, $input: IssueUpdateInput!) {
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
        
        const moveResult = await linear.makeRequest(moveQuery, {
          id: task.id,
          input: {
            projectId: testProject.id
          }
        });
        
        if (moveResult.issueUpdate.success) {
          console.log(`   ✅ ${task.identifier}: Movido al proyecto TEST`);
          moveResults.push({
            success: true,
            identifier: task.identifier,
            title: task.title
          });
        } else {
          console.log(`   ❌ ${task.identifier}: Error al mover`);
          moveResults.push({
            success: false,
            identifier: task.identifier,
            error: 'Update failed'
          });
        }
        
      } catch (error) {
        console.log(`   ❌ ${task.identifier}: ${error.message}`);
        moveResults.push({
          success: false,
          identifier: task.identifier,
          error: error.message
        });
      }
      
      // Delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 5. Verificación final
    console.log('\n5️⃣ Verificando reorganización...');
    
    // Verificar proyecto RELY (ex-MVP)
    const updatedRelyData = await linear.getIssuesByProject(mvpProject.id, 100);
    const remainingTestTasksInRely = updatedRelyData.issues.nodes.filter(issue => 
      issue.title.startsWith('TEST:')
    );
    
    console.log(`   📁 Proyecto RELY: ${updatedRelyData.issues.nodes.length} tareas totales`);
    console.log(`   🧪 Tareas TEST restantes en RELY: ${remainingTestTasksInRely.length}`);
    
    // Verificar proyecto TEST
    const testProjectData = await linear.getIssuesByProject(testProject.id, 100);
    const testTasksInTestProject = testProjectData.issues.nodes.filter(issue => 
      issue.title.startsWith('TEST:')
    );
    
    console.log(`   📁 Proyecto TEST: ${testProjectData.issues.nodes.length} tareas totales`);
    console.log(`   🧪 Tareas TEST en proyecto TEST: ${testTasksInTestProject.length}`);
    
    // 6. Resumen final
    console.log('\n🎉 ¡Reorganización completada!');
    console.log('\n📊 Estructura final:');
    console.log(`   📁 Proyecto "RELY": Tareas de producción de Rely`);
    console.log(`   📁 Proyecto "TEST": Tareas de prueba para agentes background`);
    console.log(`   🔄 Tareas movidas: ${moveResults.filter(r => r.success).length}/${testTasks.length}`);
    
    console.log('\n📱 Ahora en el bot verás:');
    console.log('   • Linear Project: "RELY" (tareas reales de Rely)');
    console.log('   • Linear Project: "TEST" (tareas de prueba para agentes)');
    
    console.log('\n🚀 Para testing:');
    console.log('   1. Crear agente background');
    console.log('   2. Seleccionar Linear Project: "TEST"');
    console.log('   3. Seleccionar GitHub Repo: "simple-webpage-test"');
    console.log('   4. Ejecutar tareas RELY-46 a RELY-51');
    
    return {
      relyProject: {
        id: mvpProject.id,
        name: 'RELY',
        totalTasks: updatedRelyData.issues.nodes.length,
        testTasks: remainingTestTasksInRely.length
      },
      testProject: {
        id: testProject.id,
        name: 'TEST',
        totalTasks: testProjectData.issues.nodes.length,
        testTasks: testTasksInTestProject.length
      },
      moveResults,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Ejecutar script
if (require.main === module) {
  reorganizeProjects();
}

module.exports = { reorganizeProjects };