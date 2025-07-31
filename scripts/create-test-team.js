#!/usr/bin/env node

/**
 * Script para crear equipo TEST en Linear con tareas de prueba
 */

require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function createTestTeam() {
  console.log('🚀 Creando equipo TEST en Linear...');
  
  const linear = new LinearManager(process.env.LINEAR_API_KEY);
  
  try {
    // Verificar conexión
    console.log('📡 Verificando conexión con Linear...');
    const viewer = await linear.testConnection();
    console.log(`✅ Conectado como: ${viewer.name} (${viewer.email})`);
    
    // Verificar si ya existe el equipo TEST
    console.log('🔍 Verificando si existe equipo TEST...');
    const teams = await linear.getTeams();
    const existingTestTeam = teams.find(team => team.key === 'TEST');
    
    if (existingTestTeam) {
      console.log('⚠️  El equipo TEST ya existe:');
      console.log(`   ID: ${existingTestTeam.id}`);
      console.log(`   Nombre: ${existingTestTeam.name}`);
      console.log(`   Tareas: ${existingTestTeam.issueCount}`);
      return existingTestTeam;
    }
    
    // Crear nuevo equipo TEST
    console.log('🆕 Creando nuevo equipo TEST...');
    const teamResult = await linear.createTeam(
      'Test Project', 
      'TEST', 
      'Equipo de prueba para testing del sistema de agentes background. Proyecto web simple.'
    );
    
    if (!teamResult.success) {
      throw new Error('Error al crear el equipo TEST');
    }
    
    console.log('✅ Equipo TEST creado exitosamente:');
    console.log(`   ID: ${teamResult.team.id}`);
    console.log(`   Nombre: ${teamResult.team.name}`);
    console.log(`   Key: ${teamResult.team.key}`);
    
    // Crear tareas de prueba
    console.log('📋 Creando tareas de prueba...');
    
    const testTasks = [
      {
        title: 'Crear estructura inicial del proyecto',
        description: `Crear la estructura básica del proyecto web simple:
- Crear directorio public/
- Crear index.html básico
- Crear styles.css
- Crear script.js
- Configurar package.json`,
        priority: 1 // High
      },
      {
        title: 'Implementar HTML base',
        description: `Crear el archivo index.html con:
- DOCTYPE y estructura HTML5
- Meta tags básicos (viewport, charset)
- Título de la página
- Header con navegación
- Main content area
- Footer básico`,
        priority: 2 // Medium
      },
      {
        title: 'Diseñar estilos CSS',
        description: `Crear styles.css con:
- Reset CSS básico
- Variables CSS para colores
- Estilos responsive
- Header y navegación
- Layout principal
- Footer`,
        priority: 2 // Medium
      },
      {
        title: 'Agregar funcionalidad JavaScript',
        description: `Implementar script.js con:
- DOM ready handler
- Navegación interactiva
- Formulario de contacto básico
- Validación de campos
- Smooth scrolling`,
        priority: 2 // Medium
      },
      {
        title: 'Optimizar para mobile',
        description: `Hacer el sitio mobile-friendly:
- Media queries responsive
- Hamburger menu
- Touch-friendly buttons
- Optimizar imágenes
- Testing en diferentes devices`,
        priority: 3 // Low
      },
      {
        title: 'Setup deployment automático',
        description: `Configurar deployment:
- GitHub Pages setup
- GitHub Actions workflow
- Automatic deployment on push
- Custom domain (opcional)`,
        priority: 2 // Medium
      }
    ];
    
    for (let i = 0; i < testTasks.length; i++) {
      const task = testTasks[i];
      console.log(`   📝 Creando tarea ${i + 1}: ${task.title}`);
      
      const issueResult = await linear.createIssue(
        task.title,
        task.description,
        teamResult.team.id,
        null, // stateId - usar default
        task.priority
      );
      
      if (issueResult.success) {
        console.log(`   ✅ ${issueResult.issue.identifier}: ${task.title}`);
      } else {
        console.log(`   ❌ Error creando tarea: ${task.title}`);
      }
      
      // Delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n🎉 ¡Equipo TEST creado exitosamente con todas las tareas!');
    console.log('\n📊 Resumen:');
    console.log(`   🏷️  Team Key: TEST`);
    console.log(`   📝 Tareas creadas: ${testTasks.length}`);
    console.log(`   🎯 Proyecto: Página web simple responsive`);
    console.log('\n💡 Próximo paso: Crear repositorio GitHub "simple-webpage-test"');
    
    return teamResult.team;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Ejecutar script
if (require.main === module) {
  createTestTeam();
}

module.exports = { createTestTeam };