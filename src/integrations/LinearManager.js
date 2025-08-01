const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

class LinearManager {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.apiUrl = 'https://api.linear.app/graphql';
  }

  async makeRequest(query, variables = {}) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.apiKey
        },
        body: JSON.stringify({ query, variables })
      });
      
      const data = await response.json();
      if (data.errors) {
        throw new Error(`Linear API Error: ${JSON.stringify(data.errors)}`);
      }
      return data.data;
    } catch (error) {
      console.error('Linear API request failed:', error);
      throw error;
    }
  }

  async testConnection() {
    const query = `
      query {
        viewer {
          id
          name
          email
          organization {
            id
            name
          }
        }
      }
    `;
    
    const result = await this.makeRequest(query);
    return result.viewer;
  }

  async getTeams() {
    const query = `
      query {
        teams {
          nodes {
            id
            name
            key
            description
            issueCount
          }
        }
      }
    `;
    
    const result = await this.makeRequest(query);
    return result.teams.nodes;
  }

  async getProjects() {
    const query = `
      query {
        projects {
          nodes {
            id
            name
            description
            state
            progress
            startDate
            targetDate
            creator {
              name
            }
            teams {
              nodes {
                id
                name
                key
              }
            }
          }
        }
      }
    `;
    
    const result = await this.makeRequest(query);
    return result.projects.nodes;
  }

  async getIssuesByTeam(teamId, limit = 50) {
    const query = `
      query GetIssuesByTeam($teamId: String!, $first: Int!) {
        team(id: $teamId) {
          id
          name
          issues(first: $first, orderBy: updatedAt) {
            nodes {
              id
              identifier
              title
              description
              priority
              estimate
              createdAt
              updatedAt
              state {
                id
                name
                type
                color
              }
              assignee {
                id
                name
                email
              }
              creator {
                id
                name
              }
              project {
                id
                name
              }
              labels {
                nodes {
                  id
                  name
                  color
                }
              }
              url
            }
          }
        }
      }
    `;
    
    const result = await this.makeRequest(query, { teamId, first: limit });
    return result.team;
  }

  async getIssuesByProject(projectId, limit = 50) {
    const query = `
      query GetIssuesByProject($projectId: String!, $first: Int!) {
        project(id: $projectId) {
          id
          name
          description
          issues(first: $first, orderBy: updatedAt) {
            nodes {
              id
              identifier
              title
              description
              priority
              estimate
              createdAt
              updatedAt
              state {
                id
                name
                type
                color
              }
              assignee {
                id
                name
                email
              }
              creator {
                id
                name
              }
              labels {
                nodes {
                  id
                  name
                  color
                }
              }
              url
            }
          }
        }
      }
    `;
    
    const result = await this.makeRequest(query, { projectId, first: limit });
    return result.project;
  }

  async getIssueById(issueId) {
    const query = `
      query GetIssue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          priority
          estimate
          createdAt
          updatedAt
          state {
            id
            name
            type
            color
          }
          assignee {
            id
            name
            email
          }
          creator {
            id
            name
          }
          project {
            id
            name
          }
          team {
            id
            name
            key
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          url
          comments {
            nodes {
              id
              body
              createdAt
              user {
                name
              }
            }
          }
        }
      }
    `;
    
    const result = await this.makeRequest(query, { id: issueId });
    return result.issue;
  }

  // Formateo para Telegram
  formatTeamsForTelegram(teams) {
    if (!teams || teams.length === 0) {
      return '📋 No hay equipos disponibles';
    }

    let message = '👥 **Equipos Linear Disponibles:**\n\n';
    
    teams.forEach((team, index) => {
      const projectCount = team.projects?.nodes?.length || 0;
      message += `${index + 1}. **${team.name}** \`(${team.key})\`\n`;
      message += `   📊 ${team.issueCount} tareas • ${projectCount} proyectos\n`;
      if (team.description) {
        message += `   📝 ${team.description.slice(0, 60)}${team.description.length > 60 ? '...' : ''}\n`;
      }
      message += '\n';
    });

    message += '*Usa /tasks [team_key] para ver tareas del equipo*';
    return message;
  }

  formatProjectsForTelegram(projects) {
    if (!projects || projects.length === 0) {
      return '📋 No hay proyectos disponibles';
    }

    let message = '📁 **Proyectos Linear Disponibles:**\n\n';
    
    projects.forEach((project, index) => {
      const teamNames = project.teams?.nodes?.map(t => t.name).join(', ') || 'Sin equipo';
      const stateEmoji = this.getStateEmoji(project.state);
      
      message += `${index + 1}. ${stateEmoji} **${project.name}**\n`;
      message += `   🏷️ ${teamNames}\n`;
      
      if (project.progress) {
        message += `   📊 ${Math.round(project.progress * 100)}% completado\n`;
      }
      
      if (project.description) {
        message += `   📝 ${project.description.slice(0, 80)}${project.description.length > 80 ? '...' : ''}\n`;
      }
      message += '\n';
    });

    message += '*Usa /project_tasks [project_name] para ver tareas específicas*';
    return message;
  }

  formatIssuesForTelegram(issues, teamOrProject, includeCompleted = false) {
    if (!issues || issues.length === 0) {
      return `📋 No hay tareas en ${teamOrProject}`;
    }

    // Filter tasks based on state (exclude completed/canceled unless explicitly requested)
    const filteredIssues = includeCompleted 
      ? issues 
      : issues.filter(issue => 
          issue.state.type !== 'completed' && 
          issue.state.type !== 'canceled'
        );

    if (filteredIssues.length === 0) {
      return `📋 Todas las tareas están completadas en ${teamOrProject}`;
    }

    // Sort tasks: suggested first, then by priority and state
    const sortedIssues = this.sortTasksByPriority(filteredIssues);
    const suggestedTask = this.getSuggestedTask(sortedIssues);

    let message = `📋 **Tareas de ${teamOrProject}:**\n\n`;
    
    // Add suggested task indicator
    if (suggestedTask) {
      message += `💡 **SUGERIDA:** ${this.getStateEmoji(suggestedTask.state.type)}${this.getPriorityEmoji(suggestedTask.priority)} **${suggestedTask.identifier}**\n`;
      message += `   📝 ${suggestedTask.title}\n`;
      message += `   🎯 *Esta tarea debería hacerse primero*\n\n`;
      message += `──────────────────────\n\n`;
    }
    
    sortedIssues.slice(0, 10).forEach((issue, index) => {
      const stateEmoji = this.getStateEmoji(issue.state.type);
      const priorityEmoji = this.getPriorityEmoji(issue.priority);
      const assigneeText = issue.assignee ? `👤 ${issue.assignee.name}` : '👤 Sin asignar';
      const isSuggested = suggestedTask && issue.id === suggestedTask.id;
      
      // Remove RELY prefix for telegram project tasks
      let displayTitle = issue.title;
      let displayIdentifier = issue.identifier;
      
      // Check if this is a telegram-related project (by name or identifier pattern)
      const isTegramProject = (issue.project && issue.project.name && 
        (issue.project.name.toLowerCase().includes('telegram') || 
         issue.project.name.toLowerCase().includes('test'))) ||
        issue.identifier.startsWith('TEL-');
      
      if (isTegramProject) {
        displayTitle = displayTitle.replace(/^RELY-\d+:\s*/, '');
        
        // Replace based on actual identifier pattern
        if (issue.identifier.startsWith('TEL-')) {
          // Keep TEL- prefix as is
          displayIdentifier = issue.identifier;
        } else if (issue.identifier.startsWith('RELY-')) {
          // Convert RELY- to TEL- for telegram projects
          displayIdentifier = issue.identifier.replace(/^RELY-/, 'TEL-');
        }
      }
      
      const suggestionIndicator = isSuggested ? '💡 ' : '';
      
      message += `${index + 1}. ${suggestionIndicator}${stateEmoji}${priorityEmoji} **${displayIdentifier}**: ${displayTitle}\n`;
      message += `   ${assigneeText} • Estado: ${issue.state.name}\n`;
      
      if (issue.estimate) {
        message += `   ⏱️ Estimación: ${issue.estimate} puntos\n`;
      }
      
      if (issue.description) {
        message += `   📝 ${issue.description.slice(0, 100)}${issue.description.length > 100 ? '...' : ''}\n`;
      }
      
      message += `   🔗 \`/atomize ${issue.id}\`\n\n`;
    });

    if (sortedIssues.length > 10) {
      message += `*... y ${sortedIssues.length - 10} tareas más*\n\n`;
    }

    const completedCount = issues.length - filteredIssues.length;
    if (completedCount > 0) {
      message += `✅ ${completedCount} tareas completadas (usa /all_tasks para verlas)\n\n`;
    }

    message += '*Usa /atomize [issue_id] para atomizar una tarea específica*';
    return message;
  }

  getStateEmoji(stateType) {
    const stateEmojis = {
      'backlog': '📋',
      'unstarted': '⏳',
      'started': '🔄',
      'completed': '✅',
      'canceled': '❌',
      'triage': '🔍',
      'planned': '📅'
    };
    return stateEmojis[stateType?.toLowerCase()] || '📌';
  }

  getPriorityEmoji(priority) {
    const priorityEmojis = {
      0: '🔴', // Urgent
      1: '🟠', // High  
      2: '🟡', // Medium
      3: '🟢', // Low
      4: '⚪'  // No priority
    };
    return priorityEmojis[priority] || '⚪';
  }

  // Buscar issues por texto
  async searchIssues(searchText, limit = 20) {
    const query = `
      query SearchIssues($filter: IssueFilter!, $first: Int!) {
        issues(filter: $filter, first: $first, orderBy: updatedAt) {
          nodes {
            id
            identifier
            title
            description
            priority
            state {
              name
              type
            }
            assignee {
              name
            }
            team {
              name
              key
            }
            project {
              name
            }
            url
          }
        }
      }
    `;
    
    const result = await this.makeRequest(query, {
      filter: {
        title: { contains: searchText }
      },
      first: limit
    });
    
    return result.issues.nodes;
  }

  // Buscar issue por identifier específico (TEL-15, etc.)
  async getIssueByIdentifier(identifier) {
    // Linear API doesn't support filtering by identifier directly
    // We need to search across all teams or use the number part
    const teams = await this.getTeams();
    
    for (const team of teams) {
      const teamData = await this.getIssuesByTeam(team.id, 100);
      const issue = teamData.issues.nodes.find(issue => 
        issue.identifier === identifier
      );
      
      if (issue) {
        // Get full details
        return await this.getIssueById(issue.id);
      }
    }
    
    return null;
  }

  // Alternative: Search for issue by number within a team
  async getIssueByNumber(teamKey, number) {
    const query = `
      query GetIssueByNumber($teamKey: String!, $number: Int!) {
        issue(teamKey: $teamKey, number: $number) {
          id
          identifier
          title
          description
          priority
          estimate
          createdAt
          updatedAt
          state {
            id
            name
            type
            color
          }
          assignee {
            id
            name
            email
          }
          creator {
            id
            name
          }
          project {
            id
            name
          }
          team {
            id
            name
            key
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          url
          comments {
            nodes {
              id
              body
              createdAt
              user {
                name
              }
            }
          }
        }
      }
    `;
    
    const result = await this.makeRequest(query, {
      teamKey,
      number: parseInt(number)
    });
    
    return result.issue;
  }

  // Create new team
  async createTeam(name, key, description) {
    const query = `
      mutation CreateTeam($input: TeamCreateInput!) {
        teamCreate(input: $input) {
          success
          team {
            id
            name
            key
            description
          }
        }
      }
    `;
    
    const result = await this.makeRequest(query, {
      input: {
        name,
        key,
        description
      }
    });
    
    return result.teamCreate;
  }

  // Update issue team
  async updateIssueTeam(issueId, teamId) {
    const query = `
      mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            identifier
            title
            team {
              id
              name
              key
            }
          }
        }
      }
    `;
    
    const result = await this.makeRequest(query, {
      id: issueId,
      input: {
        teamId
      }
    });
    
    return result.issueUpdate;
  }

  // Get all issues from a team (for migration)
  async getAllIssuesFromTeam(teamId) {
    const query = `
      query GetAllTeamIssues($teamId: String!, $first: Int!, $after: String) {
        team(id: $teamId) {
          id
          name
          issues(first: $first, after: $after, orderBy: createdAt) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              identifier
              title
              description
              project {
                id
                name
              }
            }
          }
        }
      }
    `;
    
    let allIssues = [];
    let hasNextPage = true;
    let after = null;
    
    while (hasNextPage) {
      const result = await this.makeRequest(query, { 
        teamId, 
        first: 100,
        after 
      });
      
      const issues = result.team.issues;
      allIssues = allIssues.concat(issues.nodes);
      
      hasNextPage = issues.pageInfo.hasNextPage;
      after = issues.pageInfo.endCursor;
    }
    
    return allIssues;
  }

  // Get workflow states for a team
  async getWorkflowStates(teamId) {
    const query = `
      query GetTeamWorkflowStates($teamId: String!) {
        team(id: $teamId) {
          id
          name
          states {
            nodes {
              id
              name
              type
              color
              position
            }
          }
        }
      }
    `;
    
    const result = await this.makeRequest(query, { teamId });
    return result.team.states.nodes;
  }

  // Update issue state
  async updateIssueState(issueId, stateId) {
    const query = `
      mutation UpdateIssueState($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            identifier
            title
            state {
              id
              name
              type
            }
          }
        }
      }
    `;
    
    const result = await this.makeRequest(query, {
      id: issueId,
      input: {
        stateId
      }
    });
    
    return result.issueUpdate;
  }

  // Create new issue
  async createIssue(title, description, teamId, stateId = null, priority = 2) {
    const query = `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            description
            state {
              id
              name
              type
            }
            team {
              id
              name
              key
            }
          }
        }
      }
    `;
    
    const input = {
      title,
      description,
      teamId,
      priority
    };
    
    if (stateId) {
      input.stateId = stateId;
    }
    
    const result = await this.makeRequest(query, { input });
    return result.issueCreate;
  }

  // Get team by key (TEL, etc.)
  async getTeamByKey(teamKey) {
    const teams = await this.getTeams();
    return teams.find(team => team.key === teamKey);
  }

  // Get all TEL tasks specifically
  async getTelTasks() {
    const telTeam = await this.getTeamByKey('TEL');
    if (!telTeam) {
      throw new Error('TEL team not found');
    }
    
    const teamData = await this.getIssuesByTeam(telTeam.id, 100);
    return {
      team: telTeam,
      issues: teamData.issues.nodes
    };
  }

  // Sort tasks by priority and suggested order
  sortTasksByPriority(issues) {
    return issues.sort((a, b) => {
      // Priority order: urgent (0), high (1), medium (2), low (3), no priority (4)
      const priorityA = a.priority !== null ? a.priority : 4;
      const priorityB = b.priority !== null ? b.priority : 4;
      
      // State priority: started > unstarted > backlog > triage > planned
      const stateOrder = {
        'started': 0,
        'unstarted': 1, 
        'backlog': 2,
        'triage': 3,
        'planned': 4
      };
      
      const stateA = stateOrder[a.state.type] || 5;
      const stateB = stateOrder[b.state.type] || 5;
      
      // Special case: always put started tasks first regardless of priority
      if (a.state.type === 'started' && b.state.type !== 'started') {
        return -1;
      }
      if (b.state.type === 'started' && a.state.type !== 'started') {
        return 1;
      }
      
      // For non-started tasks, sort by priority first
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Then by state
      if (stateA !== stateB) {
        return stateA - stateB;
      }
      
      // Finally by creation date (older first)
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }

  // Get suggested task to work on next
  getSuggestedTask(sortedIssues) {
    if (!sortedIssues || sortedIssues.length === 0) {
      return null;
    }
    
    // Look for started tasks first (highest priority)
    const startedTask = sortedIssues.find(issue => issue.state.type === 'started');
    if (startedTask) {
      return startedTask;
    }
    
    // Then look for urgent unstarted tasks
    const urgentTask = sortedIssues.find(issue => 
      issue.state.type === 'unstarted' && issue.priority === 0
    );
    if (urgentTask) {
      return urgentTask;
    }
    
    // Finally, return the first task in the sorted list
    return sortedIssues[0];
  }

  // Get "Done" state ID for a specific issue
  async getDoneStateForIssue(issueId) {
    try {
      const issue = await this.getIssueById(issueId);
      if (!issue || !issue.team) {
        return null;
      }
      
      const workflowStates = await this.getWorkflowStates(issue.team.id);
      const doneState = workflowStates.find(state => 
        state.type === 'completed' || 
        state.name.toLowerCase() === 'done' ||
        state.name.toLowerCase() === 'completed'
      );
      
      return doneState;
    } catch (error) {
      console.error('Error getting done state for issue:', error);
      return null;
    }
  }

  // Validate if task meets completion criteria
  async validateTaskCompletion(issueId, executionResults) {
    try {
      const task = await this.getIssueById(issueId);
      if (!task) {
        return { valid: false, error: 'Task not found' };
      }

      // Extract acceptance criteria from description
      const acceptanceCriteria = this.extractAcceptanceCriteria(task.description);
      
      // Check if we have tangible results
      if (!executionResults.filesChanged || executionResults.filesChanged.length === 0) {
        return { 
          valid: false, 
          error: 'No files were created or modified',
          criteria: acceptanceCriteria
        };
      }

      // Check if we have a git commit
      if (!executionResults.commitHash || !executionResults.commitUrl) {
        return { 
          valid: false, 
          error: 'No git commit was created',
          criteria: acceptanceCriteria
        };
      }

      // Basic validation passed
      return { 
        valid: true, 
        criteria: acceptanceCriteria,
        results: executionResults
      };

    } catch (error) {
      console.error('Error validating task completion:', error);
      return { valid: false, error: error.message };
    }
  }

  // Extract acceptance criteria from task description
  extractAcceptanceCriteria(description) {
    if (!description) return [];
    
    const criteriaRegex = /- \[([x\s])\] (.+)/gi;
    const criteria = [];
    let match;
    
    while ((match = criteriaRegex.exec(description)) !== null) {
      criteria.push({
        completed: match[1].toLowerCase() === 'x',
        text: match[2].trim()
      });
    }
    
    return criteria;
  }

  // Mark task as completed in Linear with validation
  async markTaskAsCompleted(issueId, executionResults = null) {
    try {
      // Validate completion if execution results provided
      if (executionResults) {
        const validation = await this.validateTaskCompletion(issueId, executionResults);
        if (!validation.valid) {
          console.warn(`⚠️ Task ${issueId} validation failed: ${validation.error}`);
          return { 
            success: false, 
            error: validation.error,
            criteria: validation.criteria,
            requiresValidation: true
          };
        }
      }

      const doneState = await this.getDoneStateForIssue(issueId);
      
      if (!doneState) {
        console.warn(`No "Done" state found for issue ${issueId}`);
        return { success: false, error: 'No "Done" state found' };
      }
      
      const result = await this.updateIssueState(issueId, doneState.id);
      
      if (result.success) {
        console.log(`✅ Task ${issueId} marked as completed in Linear`);
        return { 
          success: true, 
          newState: doneState.name,
          validation: executionResults ? 'passed' : 'skipped'
        };
      } else {
        console.error(`❌ Failed to update task ${issueId} in Linear`);
        return { success: false, error: 'Failed to update state' };
      }
      
    } catch (error) {
      console.error('Error marking task as completed:', error);
      return { success: false, error: error.message };
    }
  }

  // Update multiple task states based on real implementation status
  async updateTaskStates(updates) {
    const results = [];
    
    for (const update of updates) {
      try {
        const result = await this.updateIssueState(update.issueId, update.stateId);
        results.push({
          success: true,
          identifier: update.identifier,
          newState: update.stateName,
          result
        });
      } catch (error) {
        results.push({
          success: false,
          identifier: update.identifier,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = LinearManager;