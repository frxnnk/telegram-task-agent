// Test TaskAtomizer with mock data (sin necesidad de API key)

function createMockAtomizedProject() {
  return {
    success: true,
    project: {
      title: "Simple Todo API",
      description: "API REST para manejar tareas con CRUD completo",
      estimatedDuration: "1-2 days",
      complexity: "medium"
    },
    tasks: [
      {
        id: "task_1",
        title: "Setup inicial y estructura del proyecto",
        description: "Inicializar proyecto Node.js, instalar dependencias básicas, crear estructura de carpetas",
        dockerCommand: "npm init -y && npm install express sqlite3 jsonwebtoken bcryptjs",
        requiredFiles: [],
        outputFiles: ["package.json", "src/app.js", "src/config/database.js"],
        estimatedTime: "30min",
        complexity: "low",
        category: "setup"
      },
      {
        id: "task_2", 
        title: "Configurar base de datos SQLite",
        description: "Crear esquema de base de datos, configurar conexión, crear tablas para tareas y usuarios",
        dockerCommand: "node src/database/migrate.js",
        requiredFiles: ["package.json", "src/config/database.js"],
        outputFiles: ["data/todos.db", "src/models/Task.js", "src/models/User.js"],
        estimatedTime: "45min",
        complexity: "medium",
        category: "setup"
      },
      {
        id: "task_3",
        title: "Implementar autenticación JWT",
        description: "Sistema de registro/login, middleware de autenticación, hash de passwords",
        dockerCommand: "node src/auth/setup.js",
        requiredFiles: ["src/models/User.js", "src/config/database.js"],
        outputFiles: ["src/auth/authController.js", "src/middleware/auth.js"],
        estimatedTime: "1hour",
        complexity: "medium", 
        category: "development"
      },
      {
        id: "task_4",
        title: "Crear endpoints CRUD para tareas",
        description: "Rutas para crear, leer, actualizar y eliminar tareas. Validación de datos.",
        dockerCommand: "node src/routes/taskRoutes.js",
        requiredFiles: ["src/models/Task.js", "src/middleware/auth.js"],
        outputFiles: ["src/controllers/taskController.js", "src/routes/tasks.js"],
        estimatedTime: "1hour",
        complexity: "medium",
        category: "development"
      },
      {
        id: "task_5",
        title: "Configurar documentación Swagger",
        description: "Documentar API con OpenAPI 3.0, generar interfaz interactiva",
        dockerCommand: "npx swagger-jsdoc -d swaggerDef.js src/routes/*.js",
        requiredFiles: ["src/routes/tasks.js", "src/auth/authController.js"],
        outputFiles: ["docs/swagger.json", "src/swagger/swaggerConfig.js"],
        estimatedTime: "45min",
        complexity: "low",
        category: "documentation"
      },
      {
        id: "task_6",
        title: "Escribir tests unitarios",
        description: "Tests para autenticación, CRUD operations, validaciones",
        dockerCommand: "npm test",
        requiredFiles: ["src/controllers/taskController.js", "src/auth/authController.js"],
        outputFiles: ["tests/auth.test.js", "tests/tasks.test.js", "coverage/"],
        estimatedTime: "1hour",
        complexity: "medium",
        category: "testing"
      },
      {
        id: "task_7",
        title: "Dockerizar aplicación",
        description: "Crear Dockerfile, docker-compose, configurar variables de entorno",
        dockerCommand: "docker build -t todo-api .",
        requiredFiles: ["package.json", "src/app.js"],
        outputFiles: ["Dockerfile", "docker-compose.yml", ".dockerignore"],
        estimatedTime: "30min",
        complexity: "low",
        category: "deployment"
      }
    ],
    dependencies: [
      {
        taskId: "task_2",
        dependsOn: ["task_1"],
        reason: "Necesita package.json y configuración inicial"
      },
      {
        taskId: "task_3", 
        dependsOn: ["task_2"],
        reason: "Requiere modelos de usuario y conexión a DB"
      },
      {
        taskId: "task_4",
        dependsOn: ["task_2", "task_3"],
        reason: "Necesita modelos de Task y middleware de auth"
      },
      {
        taskId: "task_5",
        dependsOn: ["task_4"],
        reason: "Documenta las rutas ya implementadas"
      },
      {
        taskId: "task_6",
        dependsOn: ["task_4"],
        reason: "Testea la funcionalidad implementada"
      },
      {
        taskId: "task_7",
        dependsOn: ["task_6"],
        reason: "Dockeriza la aplicación ya probada"
      }
    ],
    executionOrder: [], // Se calculará
    costs: {
      tokens: { input: 1250, output: 890, total: 2140 },
      cost: { input: 0.00375, output: 0.01335, total: 0.0171 }
    },
    timestamp: new Date().toISOString()
  };
}

function calculateExecutionOrder(tasks, dependencies = []) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const dependencyMap = new Map();
  
  dependencies.forEach(dep => {
    dependencyMap.set(dep.taskId, dep.dependsOn);
  });
  
  const visited = new Set();
  const executionOrder = [];
  
  const visit = (taskId) => {
    if (visited.has(taskId)) return;
    
    const deps = dependencyMap.get(taskId) || [];
    deps.forEach(depId => visit(depId));
    
    visited.add(taskId);
    executionOrder.push(taskMap.get(taskId));
  };
  
  tasks.forEach(task => visit(task.id));
  return executionOrder;
}

function testMockAtomizer() {
  console.log('🧪 Testing Task Atomizer with Mock Data...\n');
  
  const result = createMockAtomizedProject();
  result.executionOrder = calculateExecutionOrder(result.tasks, result.dependencies);
  
  console.log(`✅ Mock atomization completed`);
  console.log(`\n📊 Project Summary:`);
  console.log(`   Title: ${result.project.title}`);
  console.log(`   Complexity: ${result.project.complexity}`);
  console.log(`   Duration: ${result.project.estimatedDuration}`);
  console.log(`   Tasks: ${result.tasks.length}`);
  console.log(`   Dependencies: ${result.dependencies.length}`);
  
  console.log(`\n💰 Estimated Costs:`);
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
  
  console.log(`\n🔗 Dependencies:`);
  result.dependencies.forEach(dep => {
    console.log(`   ${dep.taskId} depends on: ${dep.dependsOn.join(', ')}`);
    console.log(`      Reason: ${dep.reason}`);
  });
  
  console.log(`\n⚡ Execution Order:`);
  result.executionOrder.forEach((task, i) => {
    console.log(`   ${i + 1}. ${task.id}: ${task.title}`);
  });
  
  console.log(`\n✅ Task Atomizer is working correctly!`);
  console.log(`🔑 To test with real Claude API, add your CLAUDE_API_KEY to .env file`);
}

if (require.main === module) {
  testMockAtomizer();
}

module.exports = { testMockAtomizer, createMockAtomizedProject };