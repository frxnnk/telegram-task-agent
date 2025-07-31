require('dotenv').config();
const TaskAtomizer = require('./TaskAtomizer');

async function testTaskAtomizer() {
  console.log('🧪 Testing Task Atomizer...\n');
  
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.error('❌ CLAUDE_API_KEY not found in environment');
    process.exit(1);
  }

  const atomizer = new TaskAtomizer(apiKey);

  // Test cases
  const testProjects = [
    {
      name: 'Simple Todo API',
      description: `Crear una API REST simple para manejar tareas (todos) con las siguientes funcionalidades:
      - CRUD completo para tareas (crear, leer, actualizar, eliminar)
      - Base de datos SQLite
      - Autenticación JWT básica
      - Documentación con Swagger
      - Tests unitarios
      - Dockerización para deployment`
    },
    {
      name: 'Telegram Bot',
      description: `Desarrollar un bot de Telegram que funcione como asistente personal:
      - Comandos básicos (/start, /help, /status)
      - Integración con Claude API para respuestas inteligentes
      - Persistencia de conversaciones en base de datos
      - Rate limiting y manejo de errores
      - Deploy automático con GitHub Actions`
    }
  ];

  for (const project of testProjects) {
    console.log(`\n📋 Testing: ${project.name}`);
    console.log('=' .repeat(50));
    
    try {
      const startTime = Date.now();
      
      const result = await atomizer.atomizeProject(project.description, {
        maxTasks: 8,
        complexity: 'medium'
      });
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ Atomization completed in ${duration}ms`);
      console.log(`\n📊 Project Summary:`);
      console.log(`   Title: ${result.project.title}`);
      console.log(`   Complexity: ${result.project.complexity}`);
      console.log(`   Duration: ${result.project.estimatedDuration}`);
      console.log(`   Tasks: ${result.tasks.length}`);
      console.log(`   Dependencies: ${result.dependencies.length}`);
      
      console.log(`\n💰 Costs:`);
      console.log(`   Tokens: ${result.costs.tokens.total} (${result.costs.tokens.input} in, ${result.costs.tokens.output} out)`);
      console.log(`   Cost: $${result.costs.cost.total.toFixed(4)}`);
      
      console.log(`\n📝 Generated Tasks:`);
      result.tasks.forEach((task, i) => {
        console.log(`   ${i + 1}. [${task.category}] ${task.title}`);
        console.log(`      Time: ${task.estimatedTime} | Complexity: ${task.complexity}`);
        console.log(`      Docker: ${task.dockerCommand}`);
        if (task.requiredFiles?.length > 0) {
          console.log(`      Requires: ${task.requiredFiles.join(', ')}`);
        }
        if (task.outputFiles?.length > 0) {
          console.log(`      Outputs: ${task.outputFiles.join(', ')}`);
        }
      });
      
      if (result.dependencies.length > 0) {
        console.log(`\n🔗 Dependencies:`);
        result.dependencies.forEach(dep => {
          console.log(`   ${dep.taskId} depends on: ${dep.dependsOn.join(', ')}`);
          console.log(`      Reason: ${dep.reason}`);
        });
      }
      
      console.log(`\n⚡ Execution Order:`);
      result.executionOrder.forEach((task, i) => {
        console.log(`   ${i + 1}. ${task.id}: ${task.title}`);
      });
      
      // Validar que el orden de ejecución respeta las dependencias
      const isValidOrder = validateExecutionOrder(result.executionOrder, result.dependencies);
      console.log(`\n✅ Execution order valid: ${isValidOrder}`);
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      console.error(error.stack);
    }
    
    console.log('\n' + '='.repeat(50));
  }
}

function validateExecutionOrder(executionOrder, dependencies) {
  const taskPositions = new Map();
  executionOrder.forEach((task, index) => {
    taskPositions.set(task.id, index);
  });
  
  for (const dep of dependencies) {
    const taskPos = taskPositions.get(dep.taskId);
    for (const depId of dep.dependsOn) {
      const depPos = taskPositions.get(depId);
      if (depPos >= taskPos) {
        console.error(`❌ Invalid order: ${dep.taskId} (pos ${taskPos}) should come after ${depId} (pos ${depPos})`);
        return false;
      }
    }
  }
  return true;
}

// Ejecutar tests si se llama directamente
if (require.main === module) {
  testTaskAtomizer().catch(console.error);
}

module.exports = { testTaskAtomizer };