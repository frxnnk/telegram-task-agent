#!/usr/bin/env node

/**
 * Script para crear tareas de TEST en el equipo RELY existente
 */

require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function createTestTasks() {
  console.log('🚀 Creando tareas TEST en equipo RELY...');
  
  const linear = new LinearManager(process.env.LINEAR_API_KEY);
  
  try {
    // Verificar conexión
    console.log('📡 Verificando conexión con Linear...');
    const viewer = await linear.testConnection();
    console.log(`✅ Conectado como: ${viewer.name}`);
    
    // Obtener equipo RELY
    console.log('🔍 Obteniendo equipo RELY...');
    const relyTeam = await linear.getTeamByKey('RELY');
    
    if (!relyTeam) {
      throw new Error('Equipo RELY no encontrado');
    }
    
    console.log(`✅ Equipo RELY encontrado: ${relyTeam.name} (${relyTeam.issueCount} tareas)`);
    
    // Crear tareas de prueba con prefijo TEST
    console.log('📋 Creando tareas de prueba para Simple Webpage Test...');
    
    const testTasks = [
      {
        title: 'TEST: Crear estructura inicial del proyecto web',
        description: `🎯 **TAREA DE PRUEBA PARA TESTING DE AGENTES**

Crear la estructura básica del proyecto web simple "simple-webpage-test":

## Estructura de directorios:
\`\`\`
simple-webpage-test/
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   └── images/
├── package.json
├── README.md
└── .gitignore
\`\`\`

## Criterios de aceptación:
- [x] Directorio public/ creado
- [x] Archivo package.json con scripts básicos
- [x] README.md con descripción del proyecto
- [x] .gitignore configurado para Node.js

**Este es un proyecto de prueba para testing del sistema de agentes background.**`,
        priority: 1 // High
      },
      {
        title: 'TEST: Implementar HTML5 semántico',
        description: `🎯 **TAREA DE PRUEBA PARA TESTING DE AGENTES**

Crear el archivo \`public/index.html\` con estructura HTML5 semántica:

## Requerimientos:
- DOCTYPE HTML5 correcto
- Meta tags esenciales (viewport, charset, description)
- Estructura semántica (header, nav, main, section, footer)
- Título de página apropiado
- Contenido de ejemplo (hero section, about, contact)

## Criterios de aceptación:
- [x] HTML válido (pasa validador W3C)
- [x] Estructura semántica correcta
- [x] Meta tags configurados
- [x] Contenido placeholder apropiado

**Proyecto de prueba para agentes background.**`,
        priority: 2 // Medium
      },
      {
        title: 'TEST: Diseñar CSS responsive moderno',
        description: `🎯 **TAREA DE PRUEBA PARA TESTING DE AGENTES**

Crear \`public/styles.css\` con diseño responsive moderno:

## Features requeridas:
- CSS Reset/Normalize
- Variables CSS (custom properties)
- Flexbox/Grid layout
- Mobile-first responsive design
- Smooth animations/transitions

## Breakpoints:
- Mobile: 320px+
- Tablet: 768px+
- Desktop: 1024px+

## Criterios de aceptación:
- [x] Responsive en todos los breakpoints
- [x] Variables CSS implementadas
- [x] Layout moderno (flexbox/grid)
- [x] Performance optimizado

**Proyecto de prueba para testing de agentes.**`,
        priority: 2 // Medium
      },
      {
        title: 'TEST: JavaScript interactivo ES6+',
        description: `🎯 **TAREA DE PRUEBA PARA TESTING DE AGENTES**

Implementar \`public/script.js\` con funcionalidades modernas:

## Funcionalidades:
- Navigation hamburger menu (mobile)
- Smooth scrolling entre secciones
- Formulario de contacto con validación
- Dark/light mode toggle
- Lazy loading básico

## Tech Stack:
- Vanilla JavaScript ES6+
- No frameworks externos
- Event delegation
- Local Storage para preferencias

## Criterios de aceptación:
- [x] Navegación funciona en mobile/desktop
- [x] Formulario valida correctamente
- [x] Dark mode persiste
- [x] Performance optimizado

**Proyecto de prueba para agentes background.**`,
        priority: 2 // Medium
      },
      {
        title: 'TEST: Setup GitHub deployment automático',
        description: `🎯 **TAREA DE PRUEBA PARA TESTING DE AGENTES**

Configurar deployment automático con GitHub Pages:

## Setup requerido:
1. Crear repositorio \`simple-webpage-test\` en GitHub
2. Configurar GitHub Pages
3. GitHub Actions para build/deploy
4. Branch protection rules

## Workflow CI/CD:
- Lint HTML/CSS/JS en PR
- Deploy automático a GitHub Pages
- Tests básicos de funcionamiento

## Criterios de aceptación:
- [x] Repo GitHub configurado
- [x] GitHub Pages activo
- [x] CI/CD funcionando
- [x] URL pública accesible

**Proyecto de prueba para testing del sistema de agentes.**`,
        priority: 1 // High
      },
      {
        title: 'TEST: Optimización y performance',
        description: `🎯 **TAREA DE PRUEBA PARA TESTING DE AGENTES**

Optimizar el sitio web para performance y SEO:

## Optimizaciones:
- Minificar CSS/JS
- Optimizar imágenes (WebP)
- Lazy loading para imágenes
- Service Worker básico
- Meta tags SEO

## Métricas objetivo:
- Lighthouse Performance: 90+
- Lighthouse SEO: 95+
- First Contentful Paint: <2s
- Cumulative Layout Shift: <0.1

## Criterios de aceptación:
- [x] Lighthouse scores ≥90
- [x] Images optimizadas
- [x] Service Worker activo
- [x] SEO meta tags completos

**Proyecto de prueba final para agentes background.**`,
        priority: 3 // Low
      }
    ];
    
    const createdTasks = [];
    
    for (let i = 0; i < testTasks.length; i++) {
      const task = testTasks[i];
      console.log(`   📝 Creando tarea ${i + 1}: ${task.title}`);
      
      try {
        const issueResult = await linear.createIssue(
          task.title,
          task.description,
          relyTeam.id,
          null, // stateId - usar default
          task.priority
        );
        
        if (issueResult.success) {
          console.log(`   ✅ ${issueResult.issue.identifier}: ${task.title.replace('TEST: ', '')}`);
          createdTasks.push(issueResult.issue);
        } else {
          console.log(`   ❌ Error creando tarea: ${task.title}`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      
      // Delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎉 ¡Tareas TEST creadas exitosamente!');
    console.log('\n📊 Resumen:');
    console.log(`   🏷️  Team: RELY`);
    console.log(`   📝 Tareas creadas: ${createdTasks.length}`);
    console.log(`   🎯 Proyecto: Simple Webpage Test`);
    console.log(`   🔗 GitHub Repo: simple-webpage-test (próximo paso)`);
    
    console.log('\n📋 Tareas creadas:');
    createdTasks.forEach(task => {
      console.log(`   • ${task.identifier}: ${task.title.replace('TEST: ', '')}`);
    });
    
    console.log('\n💡 Próximo paso: Crear repositorio GitHub "simple-webpage-test"');
    
    return createdTasks;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Ejecutar script
if (require.main === module) {
  createTestTasks();
}

module.exports = { createTestTasks };