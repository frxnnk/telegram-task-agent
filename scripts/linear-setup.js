const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const LINEAR_API_KEY = 'lin_api_E1qrALE0Rck9h2ZGDoUelyqR8K8BEOwC5bpGJuV5';
const LINEAR_API_URL = 'https://api.linear.app/graphql';

async function makeLinearRequest(query, variables = {}) {
  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY
    },
    body: JSON.stringify({ query, variables })
  });
  
  const data = await response.json();
  if (data.errors) {
    throw new Error(`Linear API Error: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

// Test connection and get user info
async function testConnection() {
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
  
  try {
    const result = await makeLinearRequest(query);
    console.log('✅ Connection successful!');
    console.log('User:', result.viewer.name);
    console.log('Organization:', result.viewer.organization.name);
    return result.viewer;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    throw error;
  }
}

// Get teams
async function getTeams() {
  const query = `
    query {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `;
  
  const result = await makeLinearRequest(query);
  return result.teams.nodes;
}

// Create project
async function createProject(name, description, teamId) {
  const query = `
    mutation ProjectCreate($input: ProjectCreateInput!) {
      projectCreate(input: $input) {
        success
        project {
          id
          name
          description
          url
        }
      }
    }
  `;
  
  const variables = {
    input: {
      name,
      description,
      teamIds: [teamId]
    }
  };
  
  const result = await makeLinearRequest(query, variables);
  return result.projectCreate.project;
}

// Create issue
async function createIssue(title, description, teamId, projectId, priority = 3) {
  const query = `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          title
          identifier
          url
        }
      }
    }
  `;
  
  const variables = {
    input: {
      title,
      description,
      teamId,
      projectId,
      priority
    }
  };
  
  const result = await makeLinearRequest(query, variables);
  return result.issueCreate.issue;
}

module.exports = {
  testConnection,
  getTeams,
  createProject,
  createIssue,
  makeLinearRequest
};