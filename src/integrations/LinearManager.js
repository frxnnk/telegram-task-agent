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

  formatIssuesForTelegram(issues, teamOrProject) {
    if (!issues || issues.length === 0) {
      return `📋 No hay tareas en ${teamOrProject}`;
    }

    let message = `📋 **Tareas de ${teamOrProject}:**\n\n`;
    
    issues.slice(0, 10).forEach((issue, index) => {
      const stateEmoji = this.getStateEmoji(issue.state.type);
      const priorityEmoji = this.getPriorityEmoji(issue.priority);
      const assigneeText = issue.assignee ? `👤 ${issue.assignee.name}` : '👤 Sin asignar';
      
      // Remove RELY prefix for telegram project tasks
      let displayTitle = issue.title;
      let displayIdentifier = issue.identifier;
      
      if (issue.project && issue.project.name && issue.project.name.toLowerCase().includes('telegram')) {
        displayTitle = displayTitle.replace(/^RELY-\d+:\s*/, '');
        displayIdentifier = displayIdentifier.replace(/^RELY-/, 'TELEGRAM-');
      }
      
      message += `${index + 1}. ${stateEmoji}${priorityEmoji} **${displayIdentifier}**: ${displayTitle}\n`;
      message += `   ${assigneeText} • Estado: ${issue.state.name}\n`;
      
      if (issue.estimate) {
        message += `   ⏱️ Estimación: ${issue.estimate} puntos\n`;
      }
      
      if (issue.description) {
        message += `   📝 ${issue.description.slice(0, 100)}${issue.description.length > 100 ? '...' : ''}\n`;
      }
      
      message += `   🔗 \`/atomize ${issue.id}\`\n\n`;
    });

    if (issues.length > 10) {
      message += `*... y ${issues.length - 10} tareas más*\n\n`;
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