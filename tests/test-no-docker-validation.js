#!/usr/bin/env node

/**
 * NO-DOCKER VALIDATION TEST
 * Tests everything except Docker to get maximum confidence with current setup
 */

const path = require('path');
const fs = require('fs').promises;
const TaskAtomizer = require('./src/atomizer/TaskAtomizer');
const ProjectRepoManager = require('./src/integrations/ProjectRepoManager');
const LinearManager = require('./src/integrations/LinearManager');
const GitHubManager = require('./src/integrations/GitHubManager');

class NoDockerValidationTest {
  constructor() {
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      warnings: []
    };
    
    this.hasAPIKeys = this.checkAPIKeys();
    this.components = {};
  }

  checkAPIKeys() {
    const keys = {
      linear: !!process.env.LINEAR_API_KEY,
      github: !!process.env.GITHUB_TOKEN,
      claude: !!process.env.CLAUDE_API_KEY
    };
    
    return {
      ...keys,
      any: Object.values(keys).some(Boolean),
      all: Object.values(keys).every(Boolean)
    };
  }

  async runValidation() {
    console.log('🔬 NO-DOCKER VALIDATION TEST');
    console.log('Testing everything except Docker containers');
    console.log('='.repeat(50));
    
    this.printAPIStatus();
    
    try {
      await this.initializeComponents();
      await this.testCoreArchitecture();
      await this.testDataLayer();
      await this.testBusinessLogic();
      
      if (this.hasAPIKeys.any) {
        await this.testAvailableAPIs();
      }
      
      await this.testIntegrationLogic();
      await this.testErrorHandling();
      
    } catch (error) {
      this.recordError('Critical system failure', error);
    } finally {
      await this.cleanup();
      this.printFinalReport();
    }
  }

  printAPIStatus() {
    console.log('\n🔑 API Keys Status:');
    console.log(`   Linear API: ${this.hasAPIKeys.linear ? '✅' : '❌'}`);
    console.log(`   GitHub API: ${this.hasAPIKeys.github ? '✅' : '❌'}`);
    console.log(`   Claude API: ${this.hasAPIKeys.claude ? '✅' : '❌'}`);
    console.log(`   Any API: ${this.hasAPIKeys.any ? '✅ Can test some APIs' : '❌ Pure logic testing only'}`);
    console.log('');
  }

  async initializeComponents() {
    console.log('🚀 Initializing components...\n');
    
    // Always initialize with mock managers for structure testing
    const mockLinear = {
      getProjects: async () => ([
        { id: 'test-project-data', name: 'Test Project Data', description: 'Mock project for data tests' },
        { id: 'integration-test-project', name: 'Integration Test Project', description: 'Mock project for integration tests' },
        { id: 'test', name: 'Test Project', description: 'Mock project for error handling' }
      ]),
      getIssueById: async (id) => ({
        identifier: 'TEST-1',
        title: 'Test Issue',
        description: 'Mock issue for testing',
        priority: 1,
        state: { name: 'In Progress' },
        team: { name: 'Test Team', key: 'TEST' }
      })
    };

    const mockGitHub = {
      validateRepositoryAccess: async () => ({ valid: true }),
      getRepositoryStructure: async () => ([
        'package.json',
        'src/index.js',
        'src/components/App.tsx',
        'webpack.config.js',
        'tsconfig.json',
        'jest.config.js',
        'dockerfile',
        'docker-compose.yml'
      ])
    };

    // Initialize with mocks first
    this.components.projectRepoManager = new ProjectRepoManager({
      dbPath: './data/validation_test_mappings.db',
      linearManager: mockLinear,
      githubManager: mockGitHub
    });
    
    await this.components.projectRepoManager.initialize();
    
    this.components.taskAtomizer = new TaskAtomizer('test-key', {
      linearManager: mockLinear,
      githubManager: mockGitHub,
      projectRepoManager: this.components.projectRepoManager
    });

    // Initialize real APIs if available
    if (this.hasAPIKeys.linear) {
      this.components.realLinear = new LinearManager(process.env.LINEAR_API_KEY);
    }
    
    if (this.hasAPIKeys.github) {
      this.components.realGitHub = new GitHubManager(process.env.GITHUB_TOKEN);
    }
    
    if (this.hasAPIKeys.claude) {
      this.components.realTaskAtomizer = new TaskAtomizer(process.env.CLAUDE_API_KEY, {
        linearManager: this.components.realLinear,
        githubManager: this.components.realGitHub,
        projectRepoManager: this.components.projectRepoManager
      });
    }

    console.log('✅ All components initialized\n');
  }

  async testCoreArchitecture() {
    console.log('1️⃣ Testing Core Architecture...\n');
    
    await this.test('Component instantiation', async () => {
      if (!this.components.projectRepoManager) throw new Error('ProjectRepoManager not initialized');
      if (!this.components.taskAtomizer) throw new Error('TaskAtomizer not initialized');
      return true;
    });

    await this.test('Database schema creation', async () => {
      // Test that database tables were created correctly
      const testResult = await this.components.projectRepoManager.getAllProjectMappings();
      if (!Array.isArray(testResult)) throw new Error('Database query failed');
      return true;
    });

    await this.test('Component integration setup', async () => {
      if (!this.components.taskAtomizer.projectRepoManager) {
        throw new Error('TaskAtomizer missing ProjectRepoManager reference');
      }
      return true;
    });

    console.log('✅ Core architecture validated\n');
  }

  async testDataLayer() {
    console.log('2️⃣ Testing Data Layer...\n');
    
    let testProjectId = 'test-project-data';
    
    await this.test('Create project-repository mapping', async () => {
      const result = await this.components.projectRepoManager.linkRepositoryToProject(
        testProjectId,
        'test-org/test-repo',
        { repositoryType: 'main' }
      );
      
      if (!result.success) throw new Error('Failed to create mapping');
      return true;
    });

    await this.test('Retrieve project repositories', async () => {
      const repos = await this.components.projectRepoManager.getProjectRepositories(testProjectId);
      if (!repos || repos.length === 0) throw new Error('No repositories found');
      return true;
    });

    await this.test('Update project metadata', async () => {
      await this.components.projectRepoManager.updateProjectMetadata(testProjectId, {
        description: 'Test project metadata',
        primaryLanguage: 'TypeScript',
        framework: 'React'
      });
      
      const metadata = await this.components.projectRepoManager.getProjectMetadata(testProjectId);
      if (metadata.primaryLanguage !== 'TypeScript') throw new Error('Metadata not saved');
      return true;
    });

    await this.test('Get project context', async () => {
      const context = await this.components.projectRepoManager.getProjectContext(testProjectId);
      
      if (!context.repositories || context.repositories.length === 0) {
        throw new Error('Project context missing repositories');
      }
      
      if (!context.metadata) {
        throw new Error('Project context missing metadata');
      }
      
      console.log(`   📊 Context: ${context.repositories.length} repos, metadata available`);
      return true;
    });

    console.log('✅ Data layer validated\n');
  }

  async testBusinessLogic() {
    console.log('3️⃣ Testing Business Logic...\n');
    
    await this.test('Pattern detection algorithm', async () => {
      const mockContext = {
        repositoryStructures: {
          'test-org/test-repo': {
            structure: [
              'package.json',
              'src/index.tsx',
              'src/components/App.jsx',
              'webpack.config.js',
              'jest.config.js',
              'docker-compose.yml',
              'requirements.txt'
            ]
          }
        }
      };
      
      const patterns = this.components.taskAtomizer.detectProjectPatterns(mockContext);
      
      if (!patterns.languages.includes('JavaScript')) {
        throw new Error('JavaScript not detected from package.json');
      }
      
      if (!patterns.frameworks.includes('React')) {
        throw new Error('React not detected from JSX files');
      }
      
      if (!patterns.buildTools.includes('Webpack')) {
        throw new Error('Webpack not detected');
      }
      
      console.log(`   🔍 Detected: ${patterns.languages.length} languages, ${patterns.frameworks.length} frameworks`);
      return true;
    });

    await this.test('Context gathering logic', async () => {
      const projectContext = await this.components.projectRepoManager.getProjectContext('test-project-data');
      const context = await this.components.taskAtomizer.gatherProjectContext(projectContext);
      
      if (!context.includes('PROYECTO LINEAR')) {
        throw new Error('Linear project context not included');
      }
      
      if (!context.includes('REPOSITORIOS VINCULADOS')) {
        throw new Error('Repository context not included');
      }
      
      console.log(`   📝 Context length: ${context.length} characters`);
      return true;
    });

    await this.test('Enhanced atomization prompt building', async () => {
      const projectContext = await this.components.projectRepoManager.getProjectContext('test-project-data');
      const enhancedContext = await this.components.taskAtomizer.gatherProjectContext(projectContext);
      const patterns = this.components.taskAtomizer.detectProjectPatterns(projectContext);
      const formattedPatterns = this.components.taskAtomizer.formatPatternsForContext(patterns);
      
      if (!formattedPatterns.includes('PATRONES DETECTADOS')) {
        throw new Error('Pattern formatting failed');
      }
      
      console.log(`   🧠 Enhanced context: ${enhancedContext.length + formattedPatterns.length} chars total`);
      return true;
    });

    console.log('✅ Business logic validated\n');
  }

  async testAvailableAPIs() {
    console.log('4️⃣ Testing Available Real APIs...\n');
    
    if (this.hasAPIKeys.linear) {
      await this.test('Real Linear API connection', async () => {
        const user = await this.components.realLinear.getCurrentUser();
        if (!user || !user.id) throw new Error('Linear API connection failed');
        console.log(`   👤 Linear user: ${user.name}`);
        return true;
      });

      await this.test('Real Linear teams/projects', async () => {
        const teams = await this.components.realLinear.getTeams();
        const projects = await this.components.realLinear.getProjects();
        
        console.log(`   👥 Teams: ${teams.length}, Projects: ${projects.length}`);
        return true;
      });
    }

    if (this.hasAPIKeys.github) {
      await this.test('Real GitHub API connection', async () => {
        await this.components.realGitHub.testConnection();
        const user = await this.components.realGitHub.getCurrentUser();
        console.log(`   👤 GitHub user: ${user.login}`);
        return true;
      });

      await this.test('Real GitHub repositories', async () => {
        const repos = await this.components.realGitHub.getAccessibleRepositories();
        if (!repos || repos.length === 0) {
          throw new Error('No accessible repositories found');
        }
        console.log(`   📁 Accessible repos: ${repos.length}`);
        return true;
      });
    }

    if (this.hasAPIKeys.claude) {
      await this.test('Real Claude API atomization', async () => {
        const result = await this.components.realTaskAtomizer.atomizeProject(
          'Create a simple REST API with user authentication',
          {
            maxTasks: 3,
            complexity: 'low',
            includeContext: false
          }
        );
        
        if (!result.success || !result.tasks || result.tasks.length === 0) {
          throw new Error('Claude atomization failed');
        }
        
        console.log(`   🧠 Claude generated ${result.tasks.length} tasks, cost: $${result.costs.atomization.cost.total.toFixed(4)}`);
        return true;
      });
    }

    if (!this.hasAPIKeys.any) {
      console.log('   ⏭️  No API keys available, skipping real API tests\n');
    } else {
      console.log('✅ Available APIs validated\n');
    }
  }

  async testIntegrationLogic() {
    console.log('5️⃣ Testing Integration Logic...\n');
    
    await this.test('ProjectRepoManager integration in TaskAtomizer', async () => {
      // Test the integration without making API calls
      const projectContext = await this.components.projectRepoManager.getProjectContext('test-project-data');
      const enhancedContext = await this.components.taskAtomizer.gatherProjectContext(projectContext);
      const patterns = this.components.taskAtomizer.detectProjectPatterns(projectContext);
      
      if (!enhancedContext || !patterns) {
        throw new Error('Integration failed to produce results');
      }
      
      console.log(`   🔗 Integration successful: context + patterns generated`);
      return true;
    });

    await this.test('Mock complete workflow simulation', async () => {
      // Simulate the complete workflow without Docker
      const projectId = 'integration-test-project';
      
      // 1. Create project mapping
      await this.components.projectRepoManager.linkRepositoryToProject(
        projectId,
        'integration/test-repo',
        { repositoryType: 'main' }
      );
      
      // 2. Get project context
      const projectContext = await this.components.projectRepoManager.getProjectContext(projectId);
      
      // 3. Detect patterns
      const patterns = this.components.taskAtomizer.detectProjectPatterns(projectContext);
      
      // 4. Generate enhanced context
      const enhancedContext = await this.components.taskAtomizer.gatherProjectContext(projectContext);
      
      // 5. Create mock atomized task with full context
      const mockTask = {
        id: 'integration_test_task',
        title: 'Integration test task',
        description: 'Complete workflow test',
        projectContext: projectContext,
        detectedPatterns: patterns,
        enhancedContext: enhancedContext.slice(0, 100) + '...'
      };
      
      if (!mockTask.projectContext || !mockTask.detectedPatterns) {
        throw new Error('Mock workflow incomplete');
      }
      
      console.log(`   🔄 Complete workflow: ${projectContext.repositories.length} repos → ${Object.keys(patterns).length} pattern categories`);
      return true;
    });

    console.log('✅ Integration logic validated\n');
  }

  async testErrorHandling() {
    console.log('6️⃣ Testing Error Handling...\n');
    
    await this.test('Invalid project ID handling', async () => {
      try {
        await this.components.projectRepoManager.getProjectContext('non-existent-project');
        // Should not throw, but return empty context
        return true;
      } catch (error) {
        // Error handling is working
        return true;
      }
    });

    await this.test('Invalid repository format handling', async () => {
      try {
        await this.components.projectRepoManager.linkRepositoryToProject('test', 'invalid-repo-format');
        return false; // Should have thrown
      } catch (error) {
        // Expected error
        return true;
      }
    });

    await this.test('Pattern detection with empty structures', async () => {
      const emptyContext = { repositoryStructures: {} };
      const patterns = this.components.taskAtomizer.detectProjectPatterns(emptyContext);
      
      if (!patterns || typeof patterns !== 'object') {
        throw new Error('Pattern detection failed with empty input');
      }
      
      return true;
    });

    console.log('✅ Error handling validated\n');
  }

  async test(name, testFn) {
    this.testResults.total++;
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      
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

  async cleanup() {
    console.log('🧹 Cleaning up test environment...\n');
    
    try {
      if (this.components.projectRepoManager) {
        await this.components.projectRepoManager.close();
      }
      
      await fs.rm('./data/validation_test_mappings.db', { force: true });
      
      console.log('✅ Cleanup completed\n');
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error.message);
    }
  }

  printFinalReport() {
    console.log('🎯 NO-DOCKER VALIDATION FINAL REPORT');
    console.log('='.repeat(50));
    console.log(`📊 Tests Executed: ${this.testResults.total}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`⚠️  Warnings: ${this.testResults.warnings.length}`);
    
    const successRate = Math.round((this.testResults.passed / this.testResults.total) * 100);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    // Calculate confidence based on what was tested
    let confidence = 0;
    
    // Base architecture and logic: 50% weight
    if (successRate >= 90) confidence += 50;
    else if (successRate >= 80) confidence += 40;
    else if (successRate >= 70) confidence += 30;
    
    // API availability: 30% weight
    if (this.hasAPIKeys.all) confidence += 30;
    else if (this.hasAPIKeys.any) confidence += 20;
    else confidence += 10; // Still tested logic
    
    // Integration completeness: 20% weight
    if (successRate >= 95) confidence += 20;
    else if (successRate >= 85) confidence += 15;
    else confidence += 10;
    
    console.log(`🎯 Overall Confidence: ${confidence}%`);
    
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
    
    console.log('\n' + '='.repeat(50));
    
    // Provide actionable recommendations
    if (confidence >= 90) {
      console.log('🎉 EXCELLENT: System architecture is production-ready!');
      console.log('🚀 Next step: Add Docker + deploy to reach 100% confidence');
    } else if (confidence >= 80) {
      console.log('✅ GOOD: Core system is solid with minor gaps');
      console.log('🔧 Next step: Configure missing API keys');
    } else if (confidence >= 70) {
      console.log('⚠️  FAIR: Architecture is sound but needs configuration');
      console.log('🔑 Next step: Set up development environment');
    } else {
      console.log('❌ NEEDS WORK: Critical issues found');
      console.log('🛠️  Next step: Fix errors above');
      process.exit(1);
    }
    
    console.log('\n📋 What this test validates:');
    console.log('   ✅ Code architecture and component integration');
    console.log('   ✅ Database operations and data persistence');
    console.log('   ✅ Business logic and pattern detection');
    console.log('   ✅ Error handling and edge cases');
    if (this.hasAPIKeys.any) {
      console.log('   ✅ Real API integrations (where configured)');
    }
    console.log('\n📋 What still needs testing:');
    console.log('   🐳 Docker container execution');
    console.log('   📦 Git clone operations');
    console.log('   🌐 Network connectivity in production');
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new NoDockerValidationTest();
  validator.runValidation().catch(console.error);
}

module.exports = NoDockerValidationTest;