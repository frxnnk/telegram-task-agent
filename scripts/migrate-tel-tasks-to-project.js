require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function migrateTelTasksToProject() {
  const linear = new LinearManager(process.env.LINEAR_API_KEY);

  try {
    console.log('🔄 Migrando tareas TEL al proyecto "Telegram Task Agent MVP"...\n');
    
    // 1. Obtener proyectos
    const projects = await linear.getProjects();
    const telProject = projects.find(p => p.name === 'Telegram Task Agent MVP');
    
    if (!telProject) {
      throw new Error('Proyecto "Telegram Task Agent MVP" no encontrado');
    }
    
    console.log('✅ Proyecto encontrado:', telProject.name);
    console.log('📁 ID del proyecto:', telProject.id);
    
    // 2. Obtener equipo TEL
    const teams = await linear.getTeams();
    const telTeam = teams.find(t => t.key === 'TEL');
    
    if (!telTeam) {
      throw new Error('Equipo TEL no encontrado');
    }
    
    // 3. Obtener todas las tareas TEL
    const teamData = await linear.getIssuesByTeam(telTeam.id, 100);
    const telTasks = teamData.issues.nodes;
    
    console.log(`📋 Tareas TEL a migrar: ${telTasks.length}\n`);
    
    // 4. Migrar cada tarea al proyecto
    const results = [];
    
    for (const task of telTasks) {
      try {
        console.log(`🔄 Migrando ${task.identifier}: ${task.title}...`);
        
        // Update issue to assign to project
        const updateResult = await linear.makeRequest(`
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
        
        if (updateResult.issueUpdate.success) {
          console.log(`✅ ${task.identifier} migrado exitosamente`);
          results.push({
            success: true,
            identifier: task.identifier,
            title: task.title
          });
        } else {
          console.log(`❌ Error migrando ${task.identifier}`);
          results.push({
            success: false,
            identifier: task.identifier,
            title: task.title,
            error: 'Update failed'
          });
        }
        
        // Pausa para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`❌ Error migrando ${task.identifier}:`, error.message);
        results.push({
          success: false,
          identifier: task.identifier,
          title: task.title,
          error: error.message
        });
      }
    }
    
    // 5. Resumen de resultados
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log('\n📊 RESUMEN DE MIGRACIÓN:');
    console.log(`✅ Exitosas: ${successful.length}`);
    console.log(`❌ Fallidas: ${failed.length}`);
    
    if (failed.length > 0) {
      console.log('\n❌ Tareas que fallaron:');
      failed.forEach(f => {
        console.log(`  • ${f.identifier}: ${f.error}`);
      });
    }
    
    // 6. Verificar resultado final
    console.log('\n🔍 Verificando proyecto después de migración...');
    const projectData = await linear.getIssuesByProject(telProject.id, 50);
    console.log(`📋 Tareas en proyecto "${telProject.name}": ${projectData.issues.nodes.length}`);
    
    if (projectData.issues.nodes.length > 0) {
      console.log('\n📋 Primeras 5 tareas en el proyecto:');
      projectData.issues.nodes.slice(0, 5).forEach(issue => {
        console.log(`  • ${issue.identifier}: ${issue.title}`);
      });
    }
    
    console.log('\n🎉 Migración completada!');
    
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  migrateTelTasksToProject();
}

module.exports = { migrateTelTasksToProject };