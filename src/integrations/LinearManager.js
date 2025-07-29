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
            projects {
              nodes {
                id
                name
                description
                state
              }
            }
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
            issues {
              nodes {
                id
                title
                state {
                  name
                  type
                }
                priority
                assignee {
                  name
                }
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
      const issueCount = project.issues?.nodes?.length || 0;
      const teamNames = project.teams?.nodes?.map(t => t.name).join(', ') || 'Sin equipo';
      const stateEmoji = this.getStateEmoji(project.state);
      
      message += `${index + 1}. ${stateEmoji} **${project.name}**\n`;
      message += `   🏷️ ${teamNames}\n`;
      message += `   📊 ${issueCount} tareas`;
      
      if (project.progress) {
        message += ` • ${Math.round(project.progress * 100)}% completado`;
      }
      
      message += '\n';
      
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
      
      message += `${index + 1}. ${stateEmoji}${priorityEmoji} **${issue.identifier}**: ${issue.title}\n`;
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
}

module.exports = LinearManager;