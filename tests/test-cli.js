const TaskAtomizerCLI = require('./TaskAtomizerCLI');

function testCLIAtomizer() {
  console.log('🧪 Testing Task Atomizer CLI...\n');
  
  const atomizer = new TaskAtomizerCLI();
  
  // Test project description
  const projectDescription = `Desarrollar un sistema de chat en tiempo real con las siguientes características:
  
  - Frontend: React con Socket.io para comunicación real-time
  - Backend: Node.js + Express + Socket.io
  - Base de datos: MongoDB para mensajes y usuarios
  - Autenticación: JWT tokens
  - Características: Salas privadas, mensajes multimedia, notificaciones push
  - Deploy: Docker containers en AWS
  - Testing: Tests unitarios y de integración
  - Documentación: API docs y guía de usuario`;

  // Generar prompt para Claude CLI
  const result = atomizer.generateAtomizationPrompt(projectDescription, {
    maxTasks: 10,
    complexity: 'medium',
    techStack: 'React, Node.js, MongoDB'
  });
  
  console.log('✅ Prompt generated successfully!');
  console.log(`📁 Saved to: ${result.promptFile}`);
  console.log('\n' + '='.repeat(80));
  console.log(result.instructions);
  console.log('='.repeat(80));
  
  // Simular respuesta de Claude CLI para testing
  console.log('\n🎭 SIMULANDO RESPUESTA DE CLAUDE CLI...\n');
  
  const mockClaudeResponse = `\`\`\`json
{
  "project": {
    "title": "Sistema de Chat en Tiempo Real",
    "complexity": "medium",
    "estimatedDuration": "1-2 weeks",
    "techStack": ["React", "Node.js", "Socket.io", "MongoDB", "JWT", "Docker"],
    "description": "Sistema completo de chat con autenticación, salas privadas y comunicación real-time"
  },
  "tasks": [
    {
      "id": "task_1",
      "title": "Setup inicial del proyecto y estructura base",
      "description": "Inicializar repositorios frontend y backend, configurar package.json, estructura de carpetas, y dependencias básicas",
      "dockerCommand": "npm init -y && npm install express socket.io mongoose jsonwebtoken bcryptjs cors",
      "requiredFiles": [],
      "outputFiles": ["package.json", "server.js", "client/package.json", "docker-compose.yml"],
      "estimatedTime": "1hour",
      "complexity": "low",
      "category": "setup",
      "validation": "Verificar que npm start funciona sin errores"
    },
    {
      "id": "task_2",
      "title": "Configurar base de datos MongoDB",
      "description": "Setup de MongoDB, crear esquemas para usuarios y mensajes, configurar conexión",
      "dockerCommand": "node scripts/setup-database.js",
      "requiredFiles": ["package.json"],
      "outputFiles": ["models/User.js", "models/Message.js", "config/database.js"],
      "estimatedTime": "1hour",
      "complexity": "medium",
      "category": "setup",
      "validation": "Conexión exitosa a MongoDB y creación de colecciones"
    },
    {
      "id": "task_3",
      "title": "Implementar sistema de autenticación JWT",
      "description": "Registro, login, middleware de autenticación, hash de passwords",
      "dockerCommand": "node src/auth/setup-auth.js",
      "requiredFiles": ["models/User.js", "config/database.js"],
      "outputFiles": ["routes/auth.js", "middleware/auth.js", "controllers/authController.js"],
      "estimatedTime": "2hours",
      "complexity": "medium",
      "category": "development",
      "validation": "Login/registro funcionando y tokens JWT válidos"
    },
    {
      "id": "task_4",
      "title": "Configurar Socket.io servidor",
      "description": "Setup Socket.io en backend, manejo de conexiones, salas, eventos básicos",
      "dockerCommand": "node src/socket/setup-socket.js",
      "requiredFiles": ["server.js", "middleware/auth.js"],
      "outputFiles": ["socket/socketHandler.js", "socket/roomManager.js"],
      "estimatedTime": "2hours",
      "complexity": "medium",
      "category": "development",
      "validation": "Conexiones WebSocket estables y manejo de eventos"
    },
    {
      "id": "task_5",
      "title": "Desarrollar frontend React base",
      "description": "Componentes React, routing, setup Socket.io cliente, UI básica",
      "dockerCommand": "cd client && npm install react react-dom socket.io-client react-router-dom",
      "requiredFiles": ["client/package.json"],
      "outputFiles": ["client/src/App.js", "client/src/components/Chat.js", "client/src/services/socket.js"],
      "estimatedTime": "2hours",
      "complexity": "medium",
      "category": "development",
      "validation": "Frontend conecta exitosamente con backend via Socket.io"
    },
    {
      "id": "task_6",
      "title": "Implementar funcionalidad de chat en tiempo real",
      "description": "Envío/recepción de mensajes, persistencia en BD, historial de chat",
      "dockerCommand": "node src/chat/implement-messaging.js",
      "requiredFiles": ["models/Message.js", "socket/socketHandler.js", "client/src/services/socket.js"],
      "outputFiles": ["controllers/messageController.js", "client/src/components/MessageList.js"],
      "estimatedTime": "2hours",
      "complexity": "high",
      "category": "development",
      "validation": "Mensajes se envían, reciben y persisten correctamente"
    },
    {
      "id": "task_7",
      "title": "Crear sistema de salas privadas",
      "description": "Creación/unión a salas, permisos, gestión de participantes",
      "dockerCommand": "node src/rooms/implement-rooms.js",
      "requiredFiles": ["socket/roomManager.js", "models/User.js"],
      "outputFiles": ["controllers/roomController.js", "client/src/components/RoomManager.js"],
      "estimatedTime": "2hours",
      "complexity": "high",
      "category": "development",
      "validation": "Usuarios pueden crear/unirse a salas privadas"
    },
    {
      "id": "task_8",
      "title": "Escribir tests unitarios y de integración",
      "description": "Tests para auth, messaging, rooms, Socket.io events",
      "dockerCommand": "npm test",
      "requiredFiles": ["controllers/authController.js", "controllers/messageController.js"],
      "outputFiles": ["tests/auth.test.js", "tests/messaging.test.js", "tests/rooms.test.js"],
      "estimatedTime": "2hours",
      "complexity": "medium",
      "category": "testing",
      "validation": "Todos los tests pasan exitosamente"
    },
    {
      "id": "task_9",
      "title": "Dockerizar aplicación completa",
      "description": "Dockerfiles para frontend/backend, docker-compose, nginx proxy",
      "dockerCommand": "docker-compose build && docker-compose up -d",
      "requiredFiles": ["server.js", "client/build/", "package.json"],
      "outputFiles": ["Dockerfile", "client/Dockerfile", "docker-compose.prod.yml", "nginx.conf"],
      "estimatedTime": "1hour",
      "complexity": "medium",
      "category": "deployment",
      "validation": "Aplicación completa funciona en containers Docker"
    }
  ],
  "dependencies": [
    {
      "taskId": "task_2",
      "dependsOn": ["task_1"],
      "reason": "Necesita package.json y estructura base para configurar MongoDB"
    },
    {
      "taskId": "task_3",
      "dependsOn": ["task_2"],
      "reason": "Requiere modelos de User y conexión a base de datos"
    },
    {
      "taskId": "task_4",
      "dependsOn": ["task_3"],
      "reason": "Socket.io necesita middleware de autenticación para validar usuarios"
    },
    {
      "taskId": "task_5",
      "dependsOn": ["task_1"],
      "reason": "Frontend necesita estructura de proyecto base"
    },
    {
      "taskId": "task_6",
      "dependsOn": ["task_4", "task_5"],
      "reason": "Chat requiere Socket.io servidor y cliente configurados"
    },
    {
      "taskId": "task_7",
      "dependsOn": ["task_6"],
      "reason": "Salas privadas extienden funcionalidad básica de chat"
    },
    {
      "taskId": "task_8",
      "dependsOn": ["task_7"],
      "reason": "Tests validan toda la funcionalidad implementada"
    },
    {
      "taskId": "task_9",
      "dependsOn": ["task_8"],
      "reason": "Dockerización se hace sobre aplicación completa y probada"
    }
  ]
}
\`\`\``;

  try {
    console.log('🔄 Parsing mock Claude CLI response...');
    const parsedResult = atomizer.parseAtomizedResponse(mockClaudeResponse);
    
    console.log('\n✅ Parsing successful!');
    console.log(`\n📊 Project Summary:`);
    console.log(`   Title: ${parsedResult.project.title}`);
    console.log(`   Complexity: ${parsedResult.project.complexity}`);
    console.log(`   Duration: ${parsedResult.project.estimatedDuration}`);
    console.log(`   Tasks: ${parsedResult.tasks.length}`);
    console.log(`   Dependencies: ${parsedResult.dependencies.length}`);
    console.log(`   Source: ${parsedResult.source}`);
    
    console.log(`\n💰 Costs:`);
    console.log(`   ${parsedResult.costs.note}`);
    
    console.log(`\n📝 Generated Tasks:`);
    parsedResult.tasks.forEach((task, i) => {
      console.log(`   ${i + 1}. [${task.category}] ${task.title}`);
      console.log(`      Time: ${task.estimatedTime} | Complexity: ${task.complexity}`);
      console.log(`      Docker: ${task.dockerCommand.slice(0, 60)}...`);
    });
    
    console.log(`\n⚡ Execution Order:`);
    parsedResult.executionOrder.forEach((task, i) => {
      console.log(`   ${i + 1}. ${task.id}: ${task.title}`);
    });
    
    console.log(`\n🎉 CLI Atomizer working perfectly!`);
    console.log(`\n🚀 READY FOR PRODUCTION:`);
    console.log(`   1. Generate prompt: atomizer.generateAtomizationPrompt(description)`);
    console.log(`   2. Run Claude CLI: claude --file="generated_prompt.md"`);
    console.log(`   3. Parse response: atomizer.parseAtomizedResponse(response)`);
    console.log(`   4. Execute tasks in order!`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Demo interactiva
function runDemo() {
  console.log('🎯 INTERACTIVE DEMO\n');
  const atomizer = new TaskAtomizerCLI();
  return atomizer.generateDemo();
}

if (require.main === module) {
  // Ejecutar ambos tests
  testCLIAtomizer();
  console.log('\n' + '='.repeat(80));
  runDemo();
}

module.exports = { testCLIAtomizer, runDemo };