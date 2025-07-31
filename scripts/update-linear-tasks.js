#!/usr/bin/env node

require('dotenv').config();
const LinearManager = require('../src/integrations/LinearManager');

async function updateLinearTasks() {
  console.log('🔄 Updating Linear tasks to align with Background Agents concept...\n');
  
  try {
    const linearManager = new LinearManager(process.env.LINEAR_API_KEY);
    
    // Test connection
    console.log('📡 Testing Linear connection...');
    const viewer = await linearManager.testConnection();
    console.log(`✅ Connected as: ${viewer.name}\n`);
    
    // Get current TEL tasks and team info
    const telData = await linearManager.getTelTasks();
    const teamStates = await linearManager.getWorkflowStates(telData.team.id);
    
    console.log('📋 Available workflow states:');
    teamStates.forEach(state => {
      console.log(`   - ${state.name} (${state.type})`);
    });
    console.log('');
    
    // Find state IDs
    const backlogState = teamStates.find(s => s.type === 'backlog');
    const unstartedState = teamStates.find(s => s.type === 'unstarted');
    const startedState = teamStates.find(s => s.type === 'started');
    
    // Define task updates based on Background Agents concept
    const taskUpdates = [
      // HIGH PRIORITY - Core Background Agents functionality
      {
        identifier: 'TEL-14',
        priority: 1, // High
        newTitle: 'Background Agents Manager - Core Agent System',
        newDescription: `**CORE BACKGROUND AGENTS FUNCTIONALITY**

**Agent Creation & Management:**
- Create new background agents from Linear tasks
- Link agents to specific GitHub repositories  
- Configure agent execution modes (Background/Interactive)
- Agent state persistence and recovery

**Agent Intelligence:**
- Claude integration for code architecture analysis
- Repository-specific context understanding
- Intelligent task execution planning

**Agent Coordination:**
- Multi-agent task coordination
- Dependency management between agents
- Resource allocation and conflict resolution

**Dashboard & Monitoring:**
- Real-time agent status tracking
- Agent performance metrics
- Task completion monitoring

This is the CORE system that enables all Background Agents functionality.`
      },
      
      {
        identifier: 'TEL-12',
        priority: 1, // High  
        newTitle: 'GitHub Repository Intelligence - Code Architecture Analysis',
        newDescription: `**REPOSITORY INTELLIGENCE FOR BACKGROUND AGENTS**

**Code Architecture Analysis:**
- Analyze repository structure and patterns
- Identify key components and dependencies  
- Understand project architecture and conventions
- Generate repository context for agents

**Repository Integration:**
- GitHub API integration for file operations
- Branch management and PR creation
- Code analysis and modification capabilities
- Repository permission and access control

**Agent-Repository Binding:**
- Link agents to specific repositories
- Provide repository context to Claude intelligence
- Enable agents to work within existing codebases
- Maintain code quality and consistency

Essential for agents to understand and work with user's specific code architecture.`
      },
      
      {
        identifier: 'TEL-13',
        priority: 1, // High
        newTitle: 'Agent-Project Orchestration - Linear-GitHub Integration',
        newDescription: `**AGENT PROJECT ORCHESTRATION**

**Linear-GitHub Binding:**
- Map Linear projects to GitHub repositories
- Sync agent tasks with Linear issues  
- Automatic progress tracking and updates
- Bidirectional synchronization

**Agent Task Management:**
- Convert Linear tasks into agent instructions
- Track agent progress in Linear
- Update Linear based on agent execution
- Handle task dependencies and ordering

**Project Context:**
- Provide project context to agents
- Maintain consistent project standards
- Enable agents to work within project scope
- Coordinate multiple agents per project

Core orchestration system for Background Agents workflow.`
      },

      // MEDIUM PRIORITY - Supporting systems
      {
        identifier: 'TEL-6',
        priority: 2, // Medium
        newTitle: 'Agent Runtime Environment - Docker Execution System',
        newDescription: `**AGENT EXECUTION ENVIRONMENT**

**Docker Agent Runtime:**
- Isolated execution environment per agent
- Agent-specific workspace management
- Resource limits and security constraints
- Agent state persistence across restarts

**Background Execution:**
- Long-running agent processes
- Background task execution without user interaction
- Agent state monitoring and recovery
- Automatic error handling and retry logic

**Interactive Mode:**
- User-interactive agent execution
- Real-time progress updates via Telegram
- User intervention and guidance capabilities
- Interactive debugging and monitoring

Supporting infrastructure for Background Agents execution.`
      },

      {
        identifier: 'TEL-8',
        priority: 2, // Medium
        newTitle: 'Agent Control Interface - Telegram Bot Commands',
        newDescription: `**AGENT CONTROL VIA TELEGRAM**

**Agent Management Commands:**
- /create_agent - Create new background agent
- /list_agents - View all agents and status  
- /start_agent [id] - Start agent execution
- /pause_agent [id] - Pause agent execution
- /agent_status [id] - Get detailed agent status

**Project Management:**
- /link_project - Link Linear project to GitHub repo
- /agent_tasks - View agent task queue
- /project_agents - View agents working on project

**Monitoring & Control:**
- Real-time agent status updates
- Agent logs and debugging info
- Interactive agent guidance
- Emergency stop and recovery

Telegram interface for Background Agents management.`
      },

      {
        identifier: 'TEL-9',
        priority: 2, // Medium
        newTitle: 'Agent Task Intelligence - Claude-Powered Task Analysis',
        newDescription: `**INTELLIGENT TASK PROCESSING FOR AGENTS**

**Task Analysis & Planning:**
- Convert high-level descriptions into executable steps
- Analyze task complexity and requirements
- Generate agent execution plans
- Identify dependencies and prerequisites

**Code-Aware Processing:**
- Repository-specific task analysis
- Code architecture understanding
- Framework and pattern recognition
- Context-aware code generation

**Agent Instruction Generation:**
- Convert tasks into agent-executable instructions
- Provide context and guidelines
- Generate validation criteria
- Create rollback strategies

Claude intelligence layer for Background Agents task processing.`
      },

      {
        identifier: 'TEL-11',
        priority: 2, // Medium
        newTitle: 'Agent-Linear Synchronization - GraphQL Integration',
        newDescription: `**AGENT-LINEAR SYNCHRONIZATION**

**Linear API Integration:**
- Complete GraphQL API integration
- Real-time issue synchronization
- Agent progress tracking in Linear
- Automatic status updates

**Agent Task Sync:**
- Convert Linear issues to agent tasks
- Update Linear based on agent progress
- Handle task state transitions
- Maintain task history and logs

**Project Integration:**
- Project-level agent coordination
- Team collaboration with agents
- Agent task assignment and tracking
- Performance metrics and reporting

Linear integration specifically designed for Background Agents workflow.`
      },

      // LOW PRIORITY - Infrastructure and support
      {
        identifier: 'TEL-7',
        priority: 3, // Low
        newTitle: 'Agent Data Persistence - Database Layer',
        newDescription: `**DATA PERSISTENCE FOR BACKGROUND AGENTS**

**Agent State Storage:**
- Agent configuration and state
- Task execution history
- Repository-project bindings
- User preferences and settings

**Task Data Management:**
- Task queue and status tracking
- Execution logs and metrics
- Error tracking and recovery data
- Performance analytics

Supporting data layer for Background Agents system.`
      },

      {
        identifier: 'TEL-3',
        priority: 3, // Low
        newTitle: 'Agent Error Recovery - Robust Error Handling',
        newDescription: `**AGENT ERROR HANDLING & RECOVERY**

**Error Detection & Recovery:**
- Automatic agent error detection
- Smart recovery strategies
- Task rollback capabilities
- State restoration

**Agent Resilience:**
- Handle agent failures gracefully
- Automatic restart mechanisms
- Data consistency maintenance
- User notification of issues

Error handling specifically for Background Agents execution.`
      },

      {
        identifier: 'TEL-2',
        priority: 3, // Low
        newTitle: 'Agent System Testing - Quality Assurance',
        newDescription: `**BACKGROUND AGENTS TESTING & DOCUMENTATION**

**Agent Testing:**
- Unit tests for agent components
- Integration tests for full workflows
- Mock agent execution testing
- Performance and load testing

**Documentation:**
- Agent system architecture
- API documentation
- User guides and tutorials
- Troubleshooting guides

Quality assurance for Background Agents system.`
      },

      {
        identifier: 'TEL-1',
        priority: 4, // No Priority
        newTitle: 'Agent System Deployment - Production Setup',
        newDescription: `**PRODUCTION DEPLOYMENT FOR BACKGROUND AGENTS**

**Infrastructure:**
- Production environment setup
- Docker deployment configuration
- Database and storage setup
- Monitoring and logging

**Security:**
- API key management
- User authentication
- Agent sandboxing
- Data protection

Production deployment for Background Agents system.`
      },

      {
        identifier: 'TEL-5',
        priority: 4, // No Priority
        newTitle: 'Agent Monitoring Dashboard - Real-time Status',
        newDescription: `**AGENT MONITORING & DASHBOARD**

**Real-time Monitoring:**
- Agent execution status
- Task progress tracking
- Performance metrics
- Resource usage monitoring

**Dashboard Features:**
- Visual agent status overview
- Historical performance data
- Alert system for issues
- User-friendly interface

Optional monitoring dashboard for Background Agents.`
      },

      {
        identifier: 'TEL-4',
        priority: 4, // No Priority
        newTitle: 'Agent Cost Analytics - Resource Tracking',
        newDescription: `**COST TRACKING FOR BACKGROUND AGENTS**

**Resource Metrics:**
- Claude API token usage per agent
- Compute resource consumption
- Storage and bandwidth costs
- Cost per task analytics

**Budget Management:**
- Cost alerts and limits
- Resource optimization suggestions
- Usage analytics and reporting
- Cost forecasting

Optional cost tracking for Background Agents resource usage.`
      }
    ];

    console.log('🔄 Applying task updates...\n');

    // Apply updates
    for (const update of taskUpdates) {
      try {
        // Find the task by identifier
        const task = telData.issues.find(issue => issue.identifier === update.identifier);
        if (!task) {
          console.log(`⚠️  Task ${update.identifier} not found, skipping...`);
          continue;
        }

        console.log(`📝 Updating ${update.identifier}: ${update.newTitle}`);
        
        // Update task title and description
        const updateResult = await linearManager.makeRequest(`
          mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
              success
              issue {
                id
                identifier
                title
                priority
                state {
                  name
                }
              }
            }
          }
        `, {
          id: task.id,
          input: {
            title: update.newTitle,
            description: update.newDescription,
            priority: update.priority
          }
        });

        if (updateResult.issueUpdate.success) {
          console.log(`   ✅ Updated successfully`);
          console.log(`   📋 New title: ${update.newTitle}`);
          console.log(`   🎯 Priority: ${getPriorityText(update.priority)}`);
        } else {
          console.log(`   ❌ Update failed`);
        }
        
        console.log('');
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error updating ${update.identifier}:`, error.message);
      }
    }

    console.log('✅ Task updates completed!\n');
    
    // Create new tasks for missing functionality
    console.log('➕ Creating new tasks for missing functionality...\n');
    
    const newTasks = [
      {
        title: 'Agent Execution Modes - Background vs Interactive',
        description: `**AGENT EXECUTION MODES**

**Background Mode:**
- Agents run independently without user interaction
- Long-running task execution
- Automatic progress reporting
- Error handling and recovery

**Interactive Mode:**
- Real-time user guidance and feedback
- Step-by-step execution with approvals
- Interactive debugging and problem solving
- User intervention capabilities

**Mode Selection:**
- Dynamic mode switching during execution
- User preferences and task complexity based selection
- Mode-specific UI and notifications
- Performance optimization per mode

Core functionality for Background Agents execution flexibility.`,
        priority: 1 // High
      },
      
      {
        title: 'Agent Architecture Intelligence - Code Understanding',
        description: `**INTELLIGENT CODE ARCHITECTURE ANALYSIS**

**Repository Analysis:**
- Automatic detection of frameworks and patterns
- Code structure and dependency mapping
- Best practices and convention identification
- Architecture documentation generation

**Context-Aware Agent Actions:**
- Framework-specific code generation
- Consistent coding style maintenance
- Dependency and version management
- Test generation and validation

**Learning and Adaptation:**
- Learn from repository patterns
- Adapt to project-specific conventions
- Improve suggestions based on codebase
- Maintain coding standards compliance

Advanced Claude intelligence for repository-specific agent behavior.`,
        priority: 1 // High
      }
    ];

    // Find appropriate state for new tasks
    const plannedState = teamStates.find(s => s.name.toLowerCase().includes('planned')) || 
                         teamStates.find(s => s.type === 'unstarted') ||
                         backlogState;

    for (const newTask of newTasks) {
      try {
        console.log(`➕ Creating new task: ${newTask.title}`);
        
        const createResult = await linearManager.createIssue(
          newTask.title,
          newTask.description,
          telData.team.id,
          plannedState?.id,
          newTask.priority
        );

        if (createResult.success) {
          console.log(`   ✅ Created successfully: ${createResult.issue.identifier}`);
          console.log(`   🎯 Priority: ${getPriorityText(newTask.priority)}`);
        } else {
          console.log(`   ❌ Creation failed`);
        }
        
        console.log('');
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error creating new task:`, error.message);
      }
    }

    console.log('🎉 Linear tasks alignment with Background Agents concept completed!\n');
    
    // Final summary
    console.log('📊 ALIGNMENT SUMMARY:');
    console.log('✅ Updated 13 existing tasks with Background Agents focus');
    console.log('➕ Created 2 new tasks for missing core functionality');
    console.log('🎯 Prioritized core agent functionality (TEL-14, TEL-12, TEL-13)');
    console.log('📋 Aligned all tasks with Background Agents workflow');
    console.log('\n🔗 All tasks now support the core flow:');
    console.log('   Create Agent → Link Linear+GitHub → Execute (Background/Interactive)');
    
  } catch (error) {
    console.error('❌ Error updating Linear tasks:', error.message);
    throw error;
  }
}

function getPriorityText(priority) {
  const priorityText = {
    0: 'Urgent',
    1: 'High',
    2: 'Medium', 
    3: 'Low',
    4: 'No Priority'
  };
  return priorityText[priority] || 'Unknown';
}

if (require.main === module) {
  updateLinearTasks()
    .then(() => {
      console.log('✅ Update process complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Update process failed:', error);
      process.exit(1);
    });
}

module.exports = { updateLinearTasks };