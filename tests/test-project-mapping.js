require('dotenv').config();
const path = require('path');
const fs = require('fs');
const ProjectRepoManager = require('./src/integrations/ProjectRepoManager');

// Mock Linear and GitHub managers for testing
class MockLinearManager {
  async getProjects() {
    return [
      {
        id: 'project-123',
        name: 'E-commerce Frontend',
        description: 'React-based e-commerce frontend'
      },
      {
        id: 'project-456',
        name: 'API Gateway',
        description: 'Node.js API gateway service'
      },
      {
        id: 'project-789',
        name: 'Mobile App',
        description: 'React Native mobile application'
      }
    ];
  }
}

class MockGitHubManager {
  async validateRepositoryAccess(owner, repo) {
    // Simulate successful validation for test repos
    const validRepos = [
      'facebook/react',
      'nodejs/node',
      'microsoft/vscode',
      'test-user/frontend-repo',
      'test-user/backend-repo',
      'test-user/api-repo'
    ];
    
    const fullName = `${owner}/${repo}`;
    if (validRepos.includes(fullName)) {
      return {
        valid: true,
        repository: {
          full_name: fullName,
          name: repo,
          owner: { login: owner },
          private: false,
          default_branch: 'main'
        }
      };
    }
    
    return {
      valid: false,
      error: 'Repository not found or access denied'
    };
  }
  
  async getRepositoryStructure(owner, repo, path = '', maxDepth = 2) {
    // Mock repository structure
    const structures = {
      'facebook/react': [
        { name: 'src', type: 'dir', path: 'src' },
        { name: 'package.json', type: 'file', path: 'package.json' },
        { name: 'README.md', type: 'file', path: 'README.md' }
      ],
      'test-user/frontend-repo': [
        { name: 'src', type: 'dir', path: 'src' },
        { name: 'public', type: 'dir', path: 'public' },
        { name: 'package.json', type: 'file', path: 'package.json' }
      ],
      'test-user/backend-repo': [
        { name: 'api', type: 'dir', path: 'api' },
        { name: 'models', type: 'dir', path: 'models' },
        { name: 'server.js', type: 'file', path: 'server.js' }
      ]
    };
    
    return structures[`${owner}/${repo}`] || [];
  }
}

async function testProjectRepoMapping() {
  console.log('🧪 Testing AGENT-TELEGRAM-54: Project-Repository Mapping');
  console.log('=' .repeat(60));
  
  // Setup test database
  const testDbPath = path.join(__dirname, 'test_project_mappings.db');
  
  // Remove existing test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  const linearManager = new MockLinearManager();
  const githubManager = new MockGitHubManager();
  
  const projectRepoManager = new ProjectRepoManager({
    linearManager,
    githubManager,
    dbPath: testDbPath
  });
  
  await projectRepoManager.initialize();
  
  const tests = [
    () => testDatabaseInitialization(projectRepoManager),
    () => testLinkRepositoryToProject(projectRepoManager),
    () => testGetProjectRepositories(projectRepoManager),
    () => testGetAllProjectMappings(projectRepoManager),
    () => testUnlinkRepository(projectRepoManager),
    () => testMultipleRepositoriesPerProject(projectRepoManager),
    () => testProjectContext(projectRepoManager),
    () => testErrorHandling(projectRepoManager),
    () => testFormattingForTelegram(projectRepoManager),
    () => testProjectMetadata(projectRepoManager)
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < tests.length; i++) {
    try {
      console.log(`\n${i + 1}. Running test ${i + 1}...`);
      await tests[i]();
      console.log(`✅ Test ${i + 1} passed`);
      passed++;
    } catch (error) {
      console.error(`❌ Test ${i + 1} failed:`, error.message);
      failed++;
    }
  }
  
  // Cleanup
  await projectRepoManager.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`🎯 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('✅ All tests passed! AGENT-TELEGRAM-54 is ready for production');
  } else {
    console.log('❌ Some tests failed. Review implementation before deployment');
  }
  
  return failed === 0;
}

async function testDatabaseInitialization(projectRepoManager) {
  console.log('   🧪 Testing database initialization...');
  
  // Database should be initialized and accessible
  const mappings = await projectRepoManager.getAllProjectMappings();
  
  if (!Array.isArray(mappings)) {
    throw new Error('Database not properly initialized');
  }
  
  console.log('   ✅ Database initialized successfully');
}

async function testLinkRepositoryToProject(projectRepoManager) {
  console.log('   🧪 Testing repository linking...');
  
  const result = await projectRepoManager.linkRepositoryToProject(
    'project-123',
    'test-user/frontend-repo',
    { repositoryType: 'frontend' }
  );
  
  if (!result.success || !result.linearProject || !result.githubRepo) {
    throw new Error('Repository linking failed');
  }
  
  if (result.linearProject.name !== 'E-commerce Frontend') {
    throw new Error('Linear project name not matched correctly');
  }
  
  if (result.githubRepo.fullName !== 'test-user/frontend-repo') {
    throw new Error('GitHub repository not linked correctly');
  }
  
  console.log(`   ✅ Repository linked: ${result.githubRepo.fullName} → ${result.linearProject.name}`);
}

async function testGetProjectRepositories(projectRepoManager) {
  console.log('   🧪 Testing get project repositories...');
  
  const repositories = await projectRepoManager.getProjectRepositories('project-123');
  
  if (!Array.isArray(repositories) || repositories.length === 0) {
    throw new Error('Project repositories not retrieved correctly');
  }
  
  const repo = repositories[0];
  if (repo.githubRepo.fullName !== 'test-user/frontend-repo') {
    throw new Error('Repository data not correct');
  }
  
  console.log(`   ✅ Retrieved ${repositories.length} repository(ies) for project`);
}

async function testGetAllProjectMappings(projectRepoManager) {
  console.log('   🧪 Testing get all project mappings...');
  
  const mappings = await projectRepoManager.getAllProjectMappings();
  
  if (!Array.isArray(mappings) || mappings.length === 0) {
    throw new Error('Project mappings not retrieved correctly');
  }
  
  const mapping = mappings[0];
  if (!mapping.linearProjectName || !mapping.repositories) {
    throw new Error('Mapping structure not correct');
  }
  
  console.log(`   ✅ Retrieved ${mappings.length} project mapping(s)`);
}

async function testUnlinkRepository(projectRepoManager) {
  console.log('   🧪 Testing repository unlinking...');
  
  // First link another repository
  await projectRepoManager.linkRepositoryToProject(
    'project-123',
    'test-user/backend-repo',
    { repositoryType: 'backend' }
  );
  
  // Then unlink it
  const result = await projectRepoManager.unlinkRepositoryFromProject(
    'project-123',
    'test-user/backend-repo'
  );
  
  if (!result.deleted || result.changes !== 1) {
    throw new Error('Repository unlinking failed');
  }
  
  // Verify it's gone
  const repositories = await projectRepoManager.getProjectRepositories('project-123');
  const backendRepo = repositories.find(r => r.githubRepo.fullName === 'test-user/backend-repo');
  
  if (backendRepo) {
    throw new Error('Repository not properly unlinked');
  }
  
  console.log('   ✅ Repository unlinked successfully');
}

async function testMultipleRepositoriesPerProject(projectRepoManager) {
  console.log('   🧪 Testing multiple repositories per project...');
  
  // Link multiple repositories to the same project
  await projectRepoManager.linkRepositoryToProject('project-456', 'test-user/api-repo', { repositoryType: 'api' });
  await projectRepoManager.linkRepositoryToProject('project-456', 'test-user/frontend-repo', { repositoryType: 'frontend' });
  await projectRepoManager.linkRepositoryToProject('project-456', 'test-user/backend-repo', { repositoryType: 'backend' });
  
  const repositories = await projectRepoManager.getProjectRepositories('project-456');
  
  if (repositories.length !== 3) {
    throw new Error(`Expected 3 repositories, got ${repositories.length}`);
  }
  
  // Check different repository types
  const types = repositories.map(r => r.repositoryType).sort();
  const expectedTypes = ['api', 'backend', 'frontend'];
  
  if (JSON.stringify(types) !== JSON.stringify(expectedTypes)) {
    throw new Error('Repository types not correct');
  }
  
  console.log(`   ✅ Multiple repositories (${repositories.length}) linked correctly`);
}

async function testProjectContext(projectRepoManager) {
  console.log('   🧪 Testing project context generation...');
  
  const context = await projectRepoManager.getProjectContext('project-456');
  
  if (!context.hasRepositories || context.repositoryCount !== 3) {
    throw new Error('Project context not generated correctly');
  }
  
  if (!context.repositoryStructures || Object.keys(context.repositoryStructures).length === 0) {
    throw new Error('Repository structures not included in context');
  }
  
  console.log(`   ✅ Project context generated with ${context.repositoryCount} repositories`);
}

async function testErrorHandling(projectRepoManager) {
  console.log('   🧪 Testing error handling...');
  
  // Test invalid project ID
  try {
    await projectRepoManager.linkRepositoryToProject('invalid-project', 'test-user/frontend-repo');
    throw new Error('Should have thrown error for invalid project');
  } catch (error) {
    if (!error.message.includes('not found')) {
      throw new Error('Wrong error message for invalid project');
    }
  }
  
  // Test invalid repository
  try {
    await projectRepoManager.linkRepositoryToProject('project-123', 'invalid/repo');
    throw new Error('Should have thrown error for invalid repository');
  } catch (error) {
    if (!error.message.includes('access validation failed')) {
      throw new Error('Wrong error message for invalid repository');
    }
  }
  
  console.log('   ✅ Error handling working correctly');
}

async function testFormattingForTelegram(projectRepoManager) {
  console.log('   🧪 Testing Telegram formatting...');
  
  const mappings = await projectRepoManager.getAllProjectMappings();
  const formattedMappings = projectRepoManager.formatProjectMappingsForTelegram(mappings);
  
  if (!formattedMappings.includes('*Proyectos con Repositorios Vinculados:*')) {
    throw new Error('Mappings formatting not correct');
  }
  
  const repositories = await projectRepoManager.getProjectRepositories('project-456');
  const formattedRepos = projectRepoManager.formatProjectRepositoriesForTelegram(repositories, 'Test Project');
  
  if (!formattedRepos.includes('*Test Project*')) {
    throw new Error('Repositories formatting not correct');
  }
  
  console.log('   ✅ Telegram formatting working correctly');
}

async function testProjectMetadata(projectRepoManager) {
  console.log('   🧪 Testing project metadata...');
  
  // Update metadata
  const metadata = {
    description: 'API Gateway for microservices',
    primaryLanguage: 'Node.js',
    framework: 'Express.js',
    deploymentTarget: 'Hetzner VPS'
  };
  
  const result = await projectRepoManager.updateProjectMetadata('project-456', metadata);
  
  if (!result.success) {
    throw new Error('Metadata update failed');
  }
  
  // Retrieve metadata
  const retrievedMetadata = await projectRepoManager.getProjectMetadata('project-456');
  
  if (!retrievedMetadata || retrievedMetadata.primaryLanguage !== 'Node.js') {
    throw new Error('Metadata retrieval failed');
  }
  
  console.log('   ✅ Project metadata handling working correctly');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
if (require.main === module) {
  testProjectRepoMapping()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testProjectRepoMapping };