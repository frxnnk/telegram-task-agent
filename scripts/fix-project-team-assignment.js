require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function fixProjectTeamAssignment() {
  const linear = new LinearManager(process.env.LINEAR_API_KEY);

  try {
    console.log('🔧 Solucionando asignación de equipo del proyecto...\n');
    
    // 1. Obtener equipos y proyectos
    const teams = await linear.getTeams();
    const projects = await linear.getProjects();
    
    const telTeam = teams.find(t => t.key === 'TEL');
    const relyTeam = teams.find(t => t.key === 'RELY');
    const telProject = projects.find(p => p.name === 'Telegram Task Agent MVP');
    
    console.log('📋 Estado actual:');
    console.log(`  • Equipo TEL: ${telTeam.name} (${telTeam.issueCount} tareas)`);
    console.log(`  • Equipo RELY: ${relyTeam.name} (${relyTeam.issueCount} tareas)`);
    console.log(`  • Proyecto: ${telProject.name}`);
    console.log(`  • Proyecto asignado a equipos: ${telProject.teams.nodes.map(t => t.name).join(', ')}`);
    
    console.log('\n💡 PROBLEMA IDENTIFICADO:');
    console.log('  • El proyecto "Telegram Task Agent MVP" está asignado al equipo RELY');
    console.log('  • Las tareas TEL-1 a TEL-16 están en el equipo TEL');  
    console.log('  • Linear no permite tareas de un equipo en proyectos de otro equipo');
    
    console.log('\n🎯 SOLUCIONES POSIBLES:');
    console.log('  1. ✅ RECOMENDADA: Mover proyecto al equipo TEL');
    console.log('  2. ❌ NO RECOMENDADA: Mover tareas TEL al equipo RELY');
    console.log('  3. ❌ COMPLEJA: Crear nuevo proyecto en equipo TEL');
    
    console.log('\n🔄 Intentando Solución 1: Actualizar teams del proyecto...');
    
    try {
      // Intentar actualizar el proyecto para incluir el equipo TEL
      const updateResult = await linear.makeRequest(`
        mutation UpdateProject($id: String!, $input: ProjectUpdateInput!) {
          projectUpdate(id: $id, input: $input) {
            success
            project {
              id
              name
              teams {
                nodes {
                  id
                  name
                  key
                }
              }
            }
          }
        }
      `, {
        id: telProject.id,
        input: {
          teamIds: [telTeam.id] // Solo equipo TEL
        }
      });
      
      if (updateResult.projectUpdate.success) {
        console.log('✅ Proyecto actualizado exitosamente');
        console.log('📋 Nuevos equipos del proyecto:');
        updateResult.projectUpdate.project.teams.nodes.forEach(team => {
          console.log(`  • ${team.name} (${team.key})`);
        });
        
        // Ahora intentar asignar las tareas TEL al proyecto
        console.log('\n🔄 Ahora asignando tareas TEL al proyecto...');
        
        const teamData = await linear.getIssuesByTeam(telTeam.id, 100);
        const telTasks = teamData.issues.nodes;
        
        let successful = 0;
        let failed = 0;
        
        for (const task of telTasks) {
          try {
            const taskUpdateResult = await linear.makeRequest(`
              mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
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
            `, {
              id: task.id,
              input: {
                projectId: telProject.id
              }
            });
            
            if (taskUpdateResult.issueUpdate.success) {
              console.log(`✅ ${task.identifier} asignado al proyecto`);
              successful++;
            } else {
              console.log(`❌ Error asignando ${task.identifier}`);
              failed++;
            }
            
            // Pausa para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.log(`❌ Error asignando ${task.identifier}:`, error.message.slice(0, 100));
            failed++;
          }
        }
        
        console.log(`\n📊 RESULTADO FINAL:`);
        console.log(`✅ Tareas asignadas exitosamente: ${successful}`);
        console.log(`❌ Tareas que fallaron: ${failed}`);
        
        // Verificar resultado final
        console.log('\n🔍 Verificando proyecto final...');
        const finalProjectData = await linear.getIssuesByProject(telProject.id, 50);
        console.log(`📋 Tareas en proyecto "${telProject.name}": ${finalProjectData.issues.nodes.length}`);
        
        if (finalProjectData.issues.nodes.length > 0) {
          console.log('\n🎉 ¡PROBLEMA SOLUCIONADO!');
          console.log('📋 Tareas en el proyecto:');
          finalProjectData.issues.nodes.slice(0, 10).forEach(issue => {
            console.log(`  • ${issue.identifier}: ${issue.title}`);
          });
        } else {
          console.log('\n⚠️ El proyecto sigue vacío. Revisar permisos o configuración.');
        }
        
      } else {
        console.log('❌ No se pudo actualizar el proyecto');
      }
      
    } catch (projectError) {
      console.log('❌ Error actualizando proyecto:', projectError.message);
      
      console.log('\n🔄 Intentando Solución 3: Crear nuevo proyecto para equipo TEL...');
      
      try {
        const newProjectResult = await linear.makeRequest(`
          mutation CreateProject($input: ProjectCreateInput!) {
            projectCreate(input: $input) {
              success
              project {
                id
                name
                url
                teams {
                  nodes {
                    name
                    key
                  }
                }
              }
            }
          }
        `, {
          input: {
            name: "TEL Background Agents",
            description: "Background Agents Manager - Sistema de agentes inteligentes que ejecutan tareas Linear en repositorios GitHub automáticamente",
            teamIds: [telTeam.id]
          }
        });
        
        if (newProjectResult.projectCreate.success) {
          const newProject = newProjectResult.projectCreate.project;
          console.log('✅ Nuevo proyecto creado:', newProject.name);
          console.log('🔗 URL:', newProject.url);
          
          // Asignar tareas al nuevo proyecto
          console.log('\n🔄 Asignando tareas TEL al nuevo proyecto...');
          
          const teamData = await linear.getIssuesByTeam(telTeam.id, 100);
          const telTasks = teamData.issues.nodes;
          
          let successful = 0;
          
          for (const task of telTasks) {
            try {
              const taskUpdateResult = await linear.makeRequest(`
                mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
                  issueUpdate(id: $id, input: $input) {
                    success
                    issue {
                      identifier
                      project {
                        name
                      }
                    }
                  }
                }
              `, {
                id: task.id,
                input: {
                  projectId: newProject.id
                }
              });
              
              if (taskUpdateResult.issueUpdate.success) {
                console.log(`✅ ${task.identifier} asignado al nuevo proyecto`);
                successful++;
              }
              
              await new Promise(resolve => setTimeout(resolve, 100));
              
            } catch (error) {
              console.log(`❌ Error asignando ${task.identifier}`);
            }
          }
          
          console.log(`\n🎉 ¡SOLUCIÓN IMPLEMENTADA!`);
          console.log(`📊 ${successful} tareas asignadas al nuevo proyecto "${newProject.name}"`);
          console.log(`🔗 Proyecto URL: ${newProject.url}`);
          
        }
        
      } catch (createError) {
        console.log('❌ Error creando nuevo proyecto:', createError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

if (require.main === module) {
  fixProjectTeamAssignment();
}

module.exports = { fixProjectTeamAssignment };