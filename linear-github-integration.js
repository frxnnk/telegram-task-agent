const { makeLinearRequest } = require('./linear-setup');

// Test if GitHub integration is available and configured
async function checkGitHubIntegration() {
  const query = `
    query {
      organization {
        id
        name
        gitHubIntegrationSettings {
          id
          enabled
        }
      }
      integrationResources {
        nodes {
          id
          resourceType
          service
        }
      }
    }
  `;
  
  try {
    const result = await makeLinearRequest(query);
    console.log('📋 Linear Organization:', result.organization.name);
    
    if (result.organization.gitHubIntegrationSettings) {
      console.log('✅ GitHub integration is available');
      console.log('   Enabled:', result.organization.gitHubIntegrationSettings.enabled);
    } else {
      console.log('❌ GitHub integration not configured');
    }
    
    if (result.integrationResources.nodes.length > 0) {
      console.log('\n🔗 Connected integrations:');
      result.integrationResources.nodes.forEach(resource => {
        console.log(`   - ${resource.service}: ${resource.resourceType}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error checking GitHub integration:', error.message);
    throw error;
  }
}

// Link repository to Linear project
async function linkRepositoryToProject(repositoryUrl, projectId) {
  const query = `
    mutation GitHubIntegrationConnect($input: GitHubConnectInput!) {
      gitHubConnect(input: $input) {
        success
        integration {
          id
          service
        }
      }
    }
  `;
  
  const variables = {
    input: {
      repositoryUrl,
      projectId
    }
  };
  
  try {
    const result = await makeLinearRequest(query, variables);
    if (result.gitHubConnect.success) {
      console.log('✅ Repository linked successfully');
      return result.gitHubConnect.integration;
    } else {
      console.log('❌ Failed to link repository');
      return null;
    }
  } catch (error) {
    console.error('❌ Error linking repository:', error.message);
    throw error;
  }
}

// Configure team automations for GitHub integration
async function configureTeamAutomations(teamId) {
  const query = `
    query GetTeam($id: String!) {
      team(id: $id) {
        id
        name
        gitHubIntegrationSettings {
          id
          orgAvatarUrl
          orgLogin
        }
      }
    }
  `;
  
  try {
    const result = await makeLinearRequest(query, { id: teamId });
    console.log(`📋 Team: ${result.team.name}`);
    
    if (result.team.gitHubIntegrationSettings) {
      console.log('✅ GitHub integration configured for team');
      console.log('   Organization:', result.team.gitHubIntegrationSettings.orgLogin);
    } else {
      console.log('❌ GitHub integration not configured for this team');
    }
    
    return result.team;
  } catch (error) {
    console.error('❌ Error checking team automations:', error.message);
    throw error;
  }
}

async function setupGitHubIntegration() {
  console.log('🔗 Setting up GitHub integration with Linear...\n');
  
  try {
    // Check current integration status
    console.log('1. Checking GitHub integration status...');
    const integrationStatus = await checkGitHubIntegration();
    
    if (!integrationStatus.organization.gitHubIntegrationSettings?.enabled) {
      console.log('\n⚠️  GitHub integration needs to be enabled in Linear settings');
      console.log('   Go to: https://linear.app/rely-llc/settings/integrations');
      console.log('   1. Find GitHub integration');
      console.log('   2. Click "Install GitHub Integration"');
      console.log('   3. Authorize with your GitHub account');
      console.log('   4. Select repositories to connect');
      return;
    }
    
    // For now, we'll provide instructions since the GraphQL mutations might not be available
    console.log('\n📝 Manual setup steps:');
    console.log('1. Go to: https://linear.app/rely-llc/settings/integrations/github');
    console.log('2. Connect repository: https://github.com/frxnnk/telegram-task-agent');
    console.log('3. Configure repository settings:');
    console.log('   - Enable issue linking');
    console.log('   - Enable PR status sync');
    console.log('   - Set up branch naming patterns');
    
    console.log('\n✅ Once configured, you can use:');
    console.log('   - Branch: git checkout -b RELY-36/setup-inicial');
    console.log('   - Commit: git commit -m "RELY-36: Complete initial project setup"');
    console.log('   - Close: git commit -m "Closes RELY-36: Setup completed"');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

if (require.main === module) {
  setupGitHubIntegration();
}

module.exports = {
  checkGitHubIntegration,
  linkRepositoryToProject,
  configureTeamAutomations,
  setupGitHubIntegration
};