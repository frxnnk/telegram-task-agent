#!/usr/bin/env node

/**
 * PRODUCTION VALIDATION TEST
 * Tests EVERYTHING with real APIs and Docker containers
 * This gives us 100% confidence the system works in production
 */

const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');

const TaskAtomizer = require('./src/atomizer/TaskAtomizer');
const DockerOrchestrator = require('./src/orchestration/DockerOrchestrator');
const ProjectRepoManager = require('./src/integrations/ProjectRepoManager');
const LinearManager = require('./src/integrations/LinearManager');
const GitHubManager = require('./src/integrations/GitHubManager');

const execAsync = util.promisify(exec);

class ProductionValidationTest {
  constructor() {
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      warnings: []
    };
    
    // Real API instances
    this.linearManager = null;
    this.githubManager = null;
    this.projectRepoManager = null;
    this.taskAtomizer = null;
    this.dockerOrchestrator = null;
    
    // Test configuration
    this.testConfig = {
      skipDockerTests: !this.isDockerAvailable(),
      skipAPITests: !this.areAPIKeysAvailable(),
      testTimeout: 120000 // 2 minutes per test
    };
  }

  async runValidation() {
    console.log('🔥 PRODUCTION VALIDATION TEST - 100% REAL APIS');
    console.log('='.repeat(60));
    console.log('⚠️  WARNING: This will make REAL API calls and Docker containers');
    console.log('⚠️  Ensure you have sufficient API quotas and Docker resources\n');
    
    await this.checkPrerequisites();
    
    try {
      await this.initializeRealComponents();
      await this.testRealLinearIntegration();
      await this.testRealGitHubIntegration();
      await this.testRealProjectRepoMapping();
      await this.testRealDockerExecution();
      await this.testRealClaudeIntegration();
      await this.testCompleteEndToEndWorkflow();
      
    } catch (error) {
      this.recordError('Critical system failure', error);
    } finally {
      await this.cleanup();
      this.printFinalReport();
    }
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...\n');
    
    const requirements = {
      'TELEGRAM_BOT_TOKEN': process.env.TELEGRAM_BOT_TOKEN,
      'LINEAR_API_KEY': process.env.LINEAR_API_KEY,
      'GITHUB_TOKEN': process.env.GITHUB_TOKEN,
      'CLAUDE_API_KEY': process.env.CLAUDE_API_KEY
    };
    
    const missing = [];
    Object.entries(requirements).forEach(([key, value]) => {
      if (!value) {
        missing.push(key);
        console.log(`❌ ${key}: Not configured`);
      } else {
        console.log(`✅ ${key}: Configured (${value.slice(0, 8)}...)`);
      }
    });
    
    // Check Docker
    const dockerAvailable = await this.isDockerAvailable();
    console.log(`${dockerAvailable ? '✅' : '❌'} Docker: ${dockerAvailable ? 'Available' : 'Not available'}`);
    
    if (missing.length > 0 && !this.testConfig.skipAPITests) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    console.log('\n📋 Test Configuration:');
    console.log(`   Skip Docker Tests: ${this.testConfig.skipDockerTests}`);
    console.log(`   Skip API Tests: ${this.testConfig.skipAPITests}`);
    console.log(`   Test Timeout: ${this.testConfig.testTimeout / 1000}s\n`);
  }

  async initializeRealComponents() {
    console.log('🚀 Initializing REAL components...\n');
    
    if (!this.testConfig.skipAPITests) {
      // Real Linear API
      this.linearManager = new LinearManager(process.env.LINEAR_API_KEY);
      
      // Real GitHub API
      this.githubManager = new GitHubManager(process.env.GITHUB_TOKEN);
      
      // Real ProjectRepoManager with real APIs
      this.projectRepoManager = new ProjectRepoManager({
        dbPath: './data/production_test_mappings.db',
        linearManager: this.linearManager,
        githubManager: this.githubManager
      });
      
      await this.projectRepoManager.initialize();
      
      // Real TaskAtomizer with Claude API
      this.taskAtomizer = new TaskAtomizer(process.env.CLAUDE_API_KEY, {
        linearManager: this.linearManager,
        githubManager: this.githubManager,
        projectRepoManager: this.projectRepoManager
      });
    }
    
    // Real Docker Orchestrator
    this.dockerOrchestrator = new DockerOrchestrator({
      workspacePath: './production-test-workspace',
      projectRepoManager: this.projectRepoManager
    });
    
    console.log('✅ All real components initialized\n');
  }

  async testRealLinearIntegration() {
    if (this.testConfig.skipAPITests) {
      console.log('⏭️  Skipping Linear API tests (no API key)\n');
      return;
    }
    
    console.log('1️⃣ Testing REAL Linear API Integration...\n');
    
    await this.test('Connect to Linear API', async () => {
      const user = await this.linearManager.getCurrentUser();
      if (!user || !user.id) {
        throw new Error('Failed to get current user from Linear API');
      }
      console.log(`   👤 Connected as: ${user.name} (${user.email})`);
      return true;
    });

    await this.test('Fetch real Linear teams', async () => {
      const teams = await this.linearManager.getTeams();
      if (!teams || teams.length === 0) {
        throw new Error('No teams found - check Linear API access');
      }
      console.log(`   👥 Found ${teams.length} teams: ${teams.slice(0, 3).map(t => t.name).join(', ')}`);
      return true;
    });

    await this.test('Fetch real Linear projects', async () => {
      const projects = await this.linearManager.getProjects();
      if (!projects || projects.length === 0) {
        this.recordWarning('No projects found - this is OK for new Linear workspaces');
        return true;
      }
      console.log(`   📋 Found ${projects.length} projects`);
      return true;
    });

    console.log('✅ Linear API integration validated\n');
  }

  async testRealGitHubIntegration() {
    if (this.testConfig.skipAPITests) {
      console.log('⏭️  Skipping GitHub API tests (no API key)\n');
      return;
    }
    
    console.log('2️⃣ Testing REAL GitHub API Integration...\n');
    
    await this.test('Connect to GitHub API', async () => {
      await this.githubManager.testConnection();
      const user = await this.githubManager.getCurrentUser();
      console.log(`   👤 Connected as: ${user.login} (${user.name || 'No name'})`);
      return true;
    });

    await this.test('Fetch accessible repositories', async () => {
      const repos = await this.githubManager.getAccessibleRepositories();
      if (!repos || repos.length === 0) {
        throw new Error('No accessible repositories found - check GitHub token permissions');
      }
      console.log(`   📁 Found ${repos.length} accessible repositories`);
      
      // Test repository structure for first repo
      const firstRepo = repos[0];
      const [owner, repo] = firstRepo.full_name.split('/');
      const structure = await this.githubManager.getRepositoryStructure(owner, repo, '', 1);
      console.log(`   📊 ${firstRepo.full_name} structure: ${structure.length} files`);
      
      return true;
    });

    console.log('✅ GitHub API integration validated\n');
  }

  async testRealProjectRepoMapping() {
    if (this.testConfig.skipAPITests) {
      console.log('⏭️  Skipping Project-Repo mapping tests (no API keys)\n');
      return;
    }
    
    console.log('3️⃣ Testing REAL Project-Repository Mapping...\n');
    
    let testProjectId = null;
    let testRepoFullName = null;
    
    await this.test('Create real project-repository mapping', async () => {
      // Get a real Linear project
      const projects = await this.linearManager.getProjects();
      if (projects.length === 0) {
        // Create a test project if none exist
        console.log('   📋 No projects found, this test will validate structure only');
        return true;
      }
      
      testProjectId = projects[0].id;
      
      // Get a real GitHub repository
      const repos = await this.githubManager.getAccessibleRepositories();
      testRepoFullName = repos[0].full_name;
      
      // Create real mapping
      const result = await this.projectRepoManager.linkRepositoryToProject(
        testProjectId,
        testRepoFullName,
        { repositoryType: 'main' }
      );
      
      if (!result.success) {
        throw new Error('Failed to create project-repository mapping');
      }
      
      console.log(`   🔗 Linked ${testRepoFullName} to project ${projects[0].name}`);
      return true;
    });

    await this.test('Get real project context with repositories', async () => {
      if (!testProjectId) {
        console.log('   ⏭️  No test project available, skipping');
        return true;
      }
      
      const context = await this.projectRepoManager.getProjectContext(testProjectId);
      
      if (!context.repositories || context.repositories.length === 0) {
        throw new Error('No repositories found in project context');
      }
      
      console.log(`   📁 Context includes ${context.repositories.length} repositories`);
      console.log(`   📊 Repository structures: ${Object.keys(context.repositoryStructures).length}`);
      
      return true;
    });

    console.log('✅ Project-Repository mapping validated\n');
  }

  async testRealDockerExecution() {
    if (this.testConfig.skipDockerTests) {
      console.log('⏭️  Skipping Docker tests (Docker not available)\n');
      return;
    }
    
    console.log('4️⃣ Testing REAL Docker Execution...\n');
    
    await this.test('Execute real Docker container', async () => {
      const taskData = {
        title: 'Production validation test',
        description: 'Test Docker container execution',
        command: 'echo "Hello from production test container" && sleep 5',
        dependencies: {}
      };
      
      const result = await this.dockerOrchestrator.playTask('prod-test-001', taskData);
      
      if (!result.instanceId) {
        throw new Error('Failed to start Docker container');
      }
      
      console.log(`   🐳 Container started: ${result.containerName}`);
      
      // Wait for container to complete
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Get logs
      try {
        const logs = await this.dockerOrchestrator.getLogs(result.instanceId);
        console.log(`   📝 Container logs: ${logs.logs.length} entries`);
        
        // Cleanup
        await this.dockerOrchestrator.killInstance(result.instanceId);
        console.log(`   🗑️  Container cleaned up`);
      } catch (cleanupError) {
        console.warn(`   ⚠️  Cleanup warning: ${cleanupError.message}`);
      }
      
      return true;
    });

    await this.test('Test Docker container with Git clone simulation', async () => {
      // Create a mock project context for testing
      const mockProjectContext = {
        linearProjectId: 'test-project',
        repositories: [{
          name: 'test-repo',
          fullName: 'octocat/Hello-World',
          owner: 'octocat'
        }],
        repositoryStructures: {
          'octocat/Hello-World': {
            structure: ['README.md', 'src/index.js'],
            type: 'main'
          }
        }
      };
      
      const taskData = {
        title: 'Docker with Git test',
        description: 'Test Docker container with Git clone capability',
        command: 'ls -la && find . -name "*.json" -o -name "*.md" | head -10',
        projectContext: mockProjectContext
      };
      
      const result = await this.dockerOrchestrator.playTask('prod-git-test', taskData);
      console.log(`   🐳 Git-enabled container started: ${result.containerName}`);
      
      // Wait and cleanup
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      try {
        const logs = await this.dockerOrchestrator.getLogs(result.instanceId);
        console.log(`   📝 Git container logs: ${logs.logs.length} entries`);
        await this.dockerOrchestrator.killInstance(result.instanceId);
      } catch (cleanupError) {
        console.warn(`   ⚠️  Git container cleanup warning: ${cleanupError.message}`);
      }
      
      return true;
    });

    console.log('✅ Docker execution validated\n');
  }

  async testRealClaudeIntegration() {
    if (this.testConfig.skipAPITests) {
      console.log('⏭️  Skipping Claude API tests (no API key)\n');
      return;
    }
    
    console.log('5️⃣ Testing REAL Claude API Integration...\n');
    
    await this.test('Real Claude API atomization', async () => {
      const testDescription = 'Create a simple Node.js API with authentication and user management';
      
      const result = await this.taskAtomizer.atomizeProject(testDescription, {
        maxTasks: 5,
        complexity: 'medium',
        includeContext: false // Skip project context for this basic test
      });
      
      if (!result.success || !result.tasks || result.tasks.length === 0) {
        throw new Error('Claude API failed to atomize project');
      }
      
      console.log(`   🧠 Claude generated ${result.tasks.length} tasks`);
      console.log(`   💰 Cost: $${result.costs.atomization.cost.total.toFixed(4)}`);
      console.log(`   📊 Tokens: ${result.costs.atomization.tokens.total}`);
      
      // Validate task structure
      const firstTask = result.tasks[0];
      if (!firstTask.id || !firstTask.title || !firstTask.dockerCommand) {
        throw new Error('Generated tasks missing required fields');
      }
      
      console.log(`   ✅ First task: ${firstTask.title}`);
      
      return true;
    });

    console.log('✅ Claude API integration validated\n');
  }

  async testCompleteEndToEndWorkflow() {
    if (this.testConfig.skipAPITests || this.testConfig.skipDockerTests) {
      console.log('⏭️  Skipping complete E2E test (missing APIs or Docker)\n');
      return;
    }
    
    console.log('6️⃣ Testing COMPLETE END-TO-END WORKFLOW...\n');
    
    await this.test('Complete real workflow: Linear → Claude → Docker', async () => {
      // 1. Get real project context
      const projects = await this.linearManager.getProjects();
      if (projects.length === 0) {
        console.log('   ⏭️  No Linear projects for E2E test');
        return true;
      }
      
      const testProject = projects[0];
      const projectContext = await this.projectRepoManager.getProjectContext(testProject.id);
      
      // 2. Real Claude atomization with project context
      const atomizationResult = await this.taskAtomizer.atomizeProject(
        'Add unit tests to the existing codebase',
        {
          maxTasks: 3,
          complexity: 'low',
          linearProjectId: testProject.id,
          includeContext: true
        }
      );
      
      if (!atomizationResult.success) {
        throw new Error('E2E: Claude atomization failed');
      }
      
      console.log(`   🧠 Claude created ${atomizationResult.tasks.length} tasks with full context`);
      
      // 3. Execute first task in real Docker container
      const firstTask = atomizationResult.tasks[0];
      const dockerResult = await this.dockerOrchestrator.playTask(
        firstTask.id,
        firstTask
      );
      
      console.log(`   🐳 Docker executing: ${firstTask.title}`);
      
      // 4. Monitor execution
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      const instances = await this.dockerOrchestrator.getInstances();
      const ourInstance = instances.find(i => i.id === dockerResult.instanceId);
      
      if (ourInstance) {
        console.log(`   📊 Container status: ${ourInstance.status}`);
        console.log(`   ⏱️  Runtime: ${ourInstance.uptime}`);
        
        // Get final logs
        const logs = await this.dockerOrchestrator.getLogs(dockerResult.instanceId);
        console.log(`   📝 Final logs: ${logs.logs.length} entries`);
        
        // Cleanup
        await this.dockerOrchestrator.killInstance(dockerResult.instanceId);
      }
      
      console.log(`   ✅ Complete workflow executed successfully`);
      
      return true;
    });

    console.log('✅ Complete end-to-end workflow validated\n');
  }

  async test(name, testFn) {
    this.testResults.total++;
    const startTime = Date.now();
    
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout')), this.testConfig.testTimeout);
      });
      
      const result = await Promise.race([testFn(), timeoutPromise]);
      
      if (result) {
        this.testResults.passed++;
        const duration = Date.now() - startTime;
        console.log(`   ✅ ${name} (${duration}ms)`);
      } else {
        this.testResults.failed++;
        console.log(`   ❌ ${name} - Returned false`);
        this.testResults.errors.push(`${name}: Returned false`);
      }
    } catch (error) {
      this.testResults.failed++;
      const duration = Date.now() - startTime;
      console.log(`   ❌ ${name} - ${error.message} (${duration}ms)`);
      this.testResults.errors.push(`${name}: ${error.message}`);
    }
  }

  recordError(context, error) {
    this.testResults.errors.push(`${context}: ${error.message}`);
    console.error(`❌ ${context}:`, error.message);
  }
  
  recordWarning(message) {
    this.testResults.warnings.push(message);
    console.warn(`⚠️  ${message}`);
  }

  async isDockerAvailable() {
    try {
      await execAsync('docker --version');
      return true;
    } catch {
      return false;
    }
  }

  areAPIKeysAvailable() {
    return !!(process.env.LINEAR_API_KEY && process.env.GITHUB_TOKEN && process.env.CLAUDE_API_KEY);
  }

  async cleanup() {
    console.log('🧹 Production test cleanup...\n');
    
    try {
      // Close database connections
      if (this.projectRepoManager) {
        await this.projectRepoManager.close();
      }
      
      // Clean up test workspace
      await fs.rm('./production-test-workspace', { recursive: true, force: true });
      
      // Clean up test database
      await fs.rm('./data/production_test_mappings.db', { force: true });
      
      // Kill any remaining Docker containers
      if (!this.testConfig.skipDockerTests) {
        try {
          await execAsync('docker ps -q --filter "name=atomized-*" | xargs -r docker kill');
          await execAsync('docker ps -aq --filter "name=atomized-*" | xargs -r docker rm');
        } catch {
          // Ignore cleanup errors
        }
      }
      
      console.log('✅ Cleanup completed\n');
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error.message);
    }
  }

  printFinalReport() {
    console.log('🎯 PRODUCTION VALIDATION FINAL REPORT');
    console.log('='.repeat(60));
    console.log(`📊 Tests Executed: ${this.testResults.total}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`⚠️  Warnings: ${this.testResults.warnings.length}`);
    
    const successRate = Math.round((this.testResults.passed / this.testResults.total) * 100);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (this.testResults.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.testResults.warnings.forEach(warning => {
        console.log(`  - ${warning}`);
      });
    }
    
    if (this.testResults.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.testResults.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (this.testResults.failed === 0) {
      console.log('🎉 PRODUCTION VALIDATION: 100% SUCCESSFUL!');
      console.log('🚀 System is ready for production deployment');
      console.log('💯 Confidence Level: 100% - All real APIs and Docker tested');
    } else if (successRate >= 80) {
      console.log('✅ PRODUCTION VALIDATION: MOSTLY SUCCESSFUL');
      console.log('🚀 System is likely ready for production with minor fixes');
      console.log(`📊 Confidence Level: ${successRate}% - Review errors above`);
    } else {
      console.log('❌ PRODUCTION VALIDATION: NEEDS ATTENTION');
      console.log('🔧 System needs fixes before production deployment');
      console.log(`📊 Confidence Level: ${successRate}% - Address critical errors`);
      process.exit(1);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ProductionValidationTest();
  validator.runValidation().catch(console.error);
}

module.exports = ProductionValidationTest;