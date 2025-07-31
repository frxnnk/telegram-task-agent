#!/usr/bin/env node

require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function investigateProjects() {
  console.log('🔍 Investigando equipos vs proyectos en Linear...\n');
  
  const linear = new LinearManager(process.env.LINEAR_API_KEY);
  
  try {
    // 1. Ver todos los equipos
    console.log('1️⃣ EQUIPOS (Teams) disponibles:');
    const teams = await linear.getTeams();
    teams.forEach((team, index) => {
      console.log(`   ${index + 1}. 🏷️  ${team.name} (${team.key})`);
      console.log(`      📊 ${team.issueCount} tareas`);
      if (team.description) {
        console.log(`      📝 ${team.description}`);
      }
      console.log('');
    });
    
    // 2. Ver todos los proyectos
    console.log('2️⃣ PROYECTOS (Projects) disponibles:');
    const projects = await linear.getProjects();
    
    if (projects.length === 0) {
      console.log('   ⚠️  No hay proyectos creados');
    } else {
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
        if (project.startDate) {
          console.log(`      📅 Inicio: ${new Date(project.startDate).toLocaleDateString()}`);
        }
        if (project.targetDate) {
          console.log(`      🎯 Meta: ${new Date(project.targetDate).toLocaleDateString()}`);
        }
        console.log('');
      });
    }
    
    // 3. Ver tareas TEST y sus asignaciones a proyectos
    console.log('3️⃣ TAREAS TEST y sus proyectos:');
    const relyTeam = await linear.getTeamByKey('RELY');
    const teamData = await linear.getIssuesByTeam(relyTeam.id, 100);
    
    const testTasks = teamData.issues.nodes.filter(issue => 
      issue.title.startsWith('TEST:') || 
      issue.description.includes('🎯 **TAREA DE PRUEBA PARA TESTING DE AGENTES**')
    );
    
    testTasks.forEach(task => {
      console.log(`   📋 ${task.identifier}: ${task.title.replace('TEST: ', '')}`);
      if (task.project) {
        console.log(`      📁 Proyecto: ${task.project.name}`);
      } else {
        console.log(`      📁 Proyecto: Sin asignar`);
      }
    });
    
    // 4. Análisis del problema
    console.log('\n4️⃣ ANÁLISIS DEL PROBLEMA:');
    console.log('   📋 Equipos encontrados:', teams.length);
    console.log('   📁 Proyectos encontrados:', projects.length);
    console.log('   🧪 Tareas TEST:', testTasks.length);
    
    const testTasksWithProject = testTasks.filter(t => t.project);
    const testTasksWithoutProject = testTasks.filter(t => !t.project);
    
    console.log('   📁 Tareas TEST con proyecto:', testTasksWithProject.length);
    console.log('   ❓ Tareas TEST sin proyecto:', testTasksWithoutProject.length);
    
    console.log('\n💡 SOLUCIÓN RECOMENDADA:');
    if (projects.length > 0) {
      console.log('   1. Asignar tareas TEST a un proyecto existente, o');
      console.log('   2. Crear nuevo proyecto "Simple Webpage Test"');
    } else {
      console.log('   1. Crear proyecto "Simple Webpage Test"');
      console.log('   2. Asignar todas las tareas TEST al nuevo proyecto');
    }
    
    return {
      teams,
      projects,
      testTasks,
      testTasksWithProject: testTasksWithProject.length,
      testTasksWithoutProject: testTasksWithoutProject.length
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

investigateProjects();