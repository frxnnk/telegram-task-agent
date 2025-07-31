// Test de LinearManager con datos mock para validar funcionalidad
const LinearManager = require('./src/integrations/LinearManager');

// Mock data para testing sin API key
const MOCK_TEAMS = [
  {
    id: 'team_1',
    name: 'Development Team',
    key: 'DEV',
    description: 'Main development team',
    issueCount: 15,
    projects: {
      nodes: [
        { id: 'proj_1', name: 'API Development', state: 'active' },
        { id: 'proj_2', name: 'Mobile App', state: 'planned' }
      ]
    }
  },
  {
    id: 'team_2', 
    name: 'Design Team',
    key: 'DES',
    description: 'UI/UX design team',
    issueCount: 8,
    projects: { nodes: [] }
  }
];

const MOCK_PROJECTS = [
  {
    id: 'proj_1',
    name: 'API Development',
    description: 'REST API for the main application',
    state: 'active',
    progress: 0.6,
    teams: { nodes: [{ id: 'team_1', name: 'Development Team', key: 'DEV' }] },
    issues: {
      nodes: [
        {
          id: 'issue_1',
          identifier: 'DEV-123',
          title: 'Implement user authentication',
          state: { name: 'In Progress', type: 'started' },
          priority: 1,
          assignee: { name: 'John Doe' }
        }
      ]
    }
  }
];

const MOCK_ISSUES = [
  {
    id: 'issue_1',
    identifier: 'DEV-123', 
    title: 'Implement user authentication',
    description: 'Create JWT-based authentication system with login/logout functionality',
    priority: 1,
    estimate: 5,
    createdAt: '2025-01-20T10:00:00Z',
    updatedAt: '2025-01-22T15:30:00Z',
    state: { id: 'state_1', name: 'In Progress', type: 'started', color: '#f39c12' },
    assignee: { id: 'user_1', name: 'John Doe', email: 'john@example.com' },
    creator: { id: 'user_2', name: 'Jane Smith' },
    project: { id: 'proj_1', name: 'API Development' },
    team: { id: 'team_1', name: 'Development Team', key: 'DEV' },
    labels: { nodes: [{ id: 'label_1', name: 'backend', color: '#3498db' }] },
    url: 'https://linear.app/rely-llc/issue/DEV-123'
  },
  {
    id: 'issue_2',
    identifier: 'DEV-124',
    title: 'Create user profile endpoints',
    description: 'Implement CRUD operations for user profiles',
    priority: 2,
    estimate: 3,
    state: { name: 'Todo', type: 'backlog' },
    assignee: null,
    creator: { name: 'Jane Smith' },
    team: { name: 'Development Team', key: 'DEV' }
  }
];

function testLinearManagerFunctionality() {
  console.log('🧪 TESTING RELY-50: LinearManager Functionality (Mock Data)\n');

  const linear = new LinearManager('mock_api_key');
  let passedTests = 0;
  const totalTests = 8;

  // Test 1: formatTeamsForTelegram
  console.log('📋 Test 1: Formateo de equipos para Telegram...');
  try {
    const teamsMessage = linear.formatTeamsForTelegram(MOCK_TEAMS);
    
    if (teamsMessage.includes('👥 **Equipos Linear Disponibles:**') &&
        teamsMessage.includes('Development Team') &&
        teamsMessage.includes('DEV') &&
        teamsMessage.includes('15 tareas')) {
      console.log('✅ Formateo de equipos correcto');
      passedTests++;
    } else {
      console.log('❌ Error en formateo de equipos');
      console.log('Resultado:', teamsMessage.slice(0, 200) + '...');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 2: formatProjectsForTelegram
  console.log('\n📋 Test 2: Formateo de proyectos para Telegram...');
  try {
    const projectsMessage = linear.formatProjectsForTelegram(MOCK_PROJECTS);
    
    if (projectsMessage.includes('📁 **Proyectos Linear Disponibles:**') &&
        projectsMessage.includes('API Development') &&
        projectsMessage.includes('60% completado')) {
      console.log('✅ Formateo de proyectos correcto');
      passedTests++;
    } else {
      console.log('❌ Error en formateo de proyectos');
      console.log('Resultado:', projectsMessage.slice(0, 200) + '...');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 3: formatIssuesForTelegram
  console.log('\n📋 Test 3: Formateo de tareas para Telegram...');
  try {
    const issuesMessage = linear.formatIssuesForTelegram(MOCK_ISSUES, 'Development Team');
    
    if (issuesMessage.includes('📋 **Tareas de Development Team:**') &&
        issuesMessage.includes('DEV-123') &&
        issuesMessage.includes('Implement user authentication') &&
        issuesMessage.includes('/atomize issue_1')) {
      console.log('✅ Formateo de tareas correcto');
      passedTests++;
    } else {
      console.log('❌ Error en formateo de tareas');
      console.log('Resultado:', issuesMessage.slice(0, 300) + '...');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 4: getStateEmoji
  console.log('\n📋 Test 4: Emojis de estado...');
  try {
    const states = [
      { type: 'backlog', expected: '📋' },
      { type: 'started', expected: '🔄' },
      { type: 'completed', expected: '✅' },
      { type: 'canceled', expected: '❌' }
    ];
    
    let stateTestsPassed = 0;
    states.forEach(state => {
      const emoji = linear.getStateEmoji(state.type);
      if (emoji === state.expected) {
        stateTestsPassed++;
      }
    });
    
    if (stateTestsPassed === states.length) {
      console.log('✅ Emojis de estado correctos');
      passedTests++;
    } else {
      console.log(`❌ Emojis de estado: ${stateTestsPassed}/${states.length} correctos`);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 5: getPriorityEmoji
  console.log('\n📋 Test 5: Emojis de prioridad...');
  try {
    const priorities = [
      { priority: 0, expected: '🔴' },
      { priority: 1, expected: '🟠' },
      { priority: 2, expected: '🟡' },
      { priority: 3, expected: '🟢' }
    ];
    
    let priorityTestsPassed = 0;
    priorities.forEach(p => {
      const emoji = linear.getPriorityEmoji(p.priority);
      if (emoji === p.expected) {
        priorityTestsPassed++;
      }
    });
    
    if (priorityTestsPassed === priorities.length) {
      console.log('✅ Emojis de prioridad correctos');
      passedTests++;
    } else {
      console.log(`❌ Emojis de prioridad: ${priorityTestsPassed}/${priorities.length} correctos`);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 6: Casos edge - arrays vacíos
  console.log('\n📋 Test 6: Manejo de arrays vacíos...');
  try {
    const emptyTeamsMsg = linear.formatTeamsForTelegram([]);
    const emptyProjectsMsg = linear.formatProjectsForTelegram([]);
    const emptyIssuesMsg = linear.formatIssuesForTelegram([], 'Test Team');
    
    if (emptyTeamsMsg.includes('No hay equipos disponibles') &&
        emptyProjectsMsg.includes('No hay proyectos disponibles') &&
        emptyIssuesMsg.includes('No hay tareas en Test Team')) {
      console.log('✅ Manejo de arrays vacíos correcto');
      passedTests++;
    } else {
      console.log('❌ Error en manejo de arrays vacíos');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 7: Casos edge - datos nulos
  console.log('\n📋 Test 7: Manejo de datos nulos...');
  try {
    const nullTeamsMsg = linear.formatTeamsForTelegram(null);
    const nullProjectsMsg = linear.formatProjectsForTelegram(null);
    const nullIssuesMsg = linear.formatIssuesForTelegram(null, 'Test Team');
    
    if (nullTeamsMsg.includes('No hay equipos disponibles') &&
        nullProjectsMsg.includes('No hay proyectos disponibles') &&
        nullIssuesMsg.includes('No hay tareas en Test Team')) {
      console.log('✅ Manejo de datos nulos correcto');
      passedTests++;
    } else {
      console.log('❌ Error en manejo de datos nulos');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 8: Verificar estructura de API requests
  console.log('\n📋 Test 8: Estructura de métodos API...');
  try {
    const requiredMethods = [
      'makeRequest', 'testConnection', 'getTeams', 'getProjects',
      'getIssuesByTeam', 'getIssuesByProject', 'getIssueById',
      'formatTeamsForTelegram', 'formatProjectsForTelegram', 
      'formatIssuesForTelegram', 'searchIssues'
    ];
    
    let methodsFound = 0;
    requiredMethods.forEach(method => {
      if (typeof linear[method] === 'function') {
        methodsFound++;
      }
    });
    
    if (methodsFound === requiredMethods.length) {
      console.log('✅ Todos los métodos requeridos están implementados');
      passedTests++;
    } else {
      console.log(`❌ Métodos: ${methodsFound}/${requiredMethods.length} implementados`);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Resumen final
  console.log('\n📊 RESUMEN DE TESTING:');
  console.log('======================');
  console.log(`✅ Tests pasados: ${passedTests}/${totalTests}`);
  console.log(`📈 Porcentaje de éxito: ${Math.round((passedTests/totalTests)*100)}%`);

  if (passedTests === totalTests) {
    console.log('\n🎉 RELY-50: LinearManager - TODOS LOS TESTS PASARON');
    console.log('✅ Funcionalidad core validada completamente');
    return true;
  } else {
    console.log('\n❌ RELY-50: Algunos tests fallaron');
    console.log('🔧 Revisa los tests fallidos antes de continuar');
    return false;
  }
}

// Test de bot integration (simulación)
function testBotIntegration() {
  console.log('\n🤖 TESTING: Integración con Bot');
  console.log('================================');

  try {
    const TelegramTaskBot = require('./src/bot');
    
    // Verificar que el bot puede instanciarse
    const bot = new TelegramTaskBot();
    
    if (bot.linear && typeof bot.linear.formatTeamsForTelegram === 'function') {
      console.log('✅ Bot tiene instancia LinearManager correcta');
    } else {
      console.log('❌ Bot no tiene LinearManager configurado');
      return false;
    }
    
    if (bot.linearCache && bot.linearCache instanceof Map) {
      console.log('✅ Bot tiene cache Linear configurado');
    } else {
      console.log('❌ Bot no tiene cache Linear');
      return false;
    }
    
    console.log('✅ Integración bot-LinearManager verificada');
    return true;
    
  } catch (error) {
    console.log('❌ Error en integración bot:', error.message);
    return false;
  }
}

// Ejecutar todos los tests
if (require.main === module) {
  const functionalityTests = testLinearManagerFunctionality();
  const integrationTests = testBotIntegration();
  
  if (functionalityTests && integrationTests) {
    console.log('\n🏁 RELY-50: Linear Integration - COMPLETAMENTE VALIDADO');
    console.log('✅ Todos los criterios de aceptación cumplidos');
    console.log('🚀 Listo para RELY-51: GitHub Repository Selection');
    process.exit(0);
  } else {
    console.log('\n🚨 RELY-50: Requiere correcciones antes de continuar');
    process.exit(1);
  }
}

module.exports = { testLinearManagerFunctionality, testBotIntegration };