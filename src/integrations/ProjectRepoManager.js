const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class ProjectRepoManager {
  constructor(options = {}) {
    this.dbPath = options.dbPath || path.join(__dirname, '../../data/project_mappings.db');
    this.db = null;
    this.linearManager = options.linearManager;
    this.githubManager = options.githubManager;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Create tables if they don't exist
        this.db.serialize(() => {
          // Project mappings table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS project_repo_mappings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              linear_project_id TEXT NOT NULL,
              linear_project_name TEXT NOT NULL,
              github_repo_full_name TEXT NOT NULL,
              github_repo_name TEXT NOT NULL,
              repository_type TEXT DEFAULT 'main',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(linear_project_id, github_repo_full_name)
            )
          `, (err) => {
            if (err) {
              reject(err);
              return;
            }
          });
          
          // Project metadata table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS project_metadata (
              linear_project_id TEXT PRIMARY KEY,
              project_description TEXT,
              primary_language TEXT,
              framework TEXT,
              deployment_target TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      });
    });
  }

  async linkRepositoryToProject(linearProjectId, githubRepoFullName, options = {}) {
    try {
      // Validate Linear project exists
      const linearProjects = await this.linearManager.getProjects();
      const linearProject = linearProjects.find(p => p.id === linearProjectId);
      
      if (!linearProject) {
        throw new Error(`Linear project ${linearProjectId} not found`);
      }

      // Validate GitHub repository access
      const [owner, repo] = githubRepoFullName.split('/');
      if (!owner || !repo) {
        throw new Error('Invalid repository format. Use: owner/repository');
      }

      const repoValidation = await this.githubManager.validateRepositoryAccess(owner, repo);
      if (!repoValidation.valid) {
        throw new Error(`GitHub repository access validation failed: ${repoValidation.error}`);
      }

      // Insert or update mapping
      return new Promise((resolve, reject) => {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO project_repo_mappings 
          (linear_project_id, linear_project_name, github_repo_full_name, github_repo_name, repository_type, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        stmt.run([
          linearProjectId,
          linearProject.name,
          githubRepoFullName,
          repo,
          options.repositoryType || 'main'
        ], function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          resolve({
            mappingId: this.lastID,
            linearProject: {
              id: linearProjectId,
              name: linearProject.name
            },
            githubRepo: {
              fullName: githubRepoFullName,
              name: repo,
              owner: owner
            },
            repositoryType: options.repositoryType || 'main',
            success: true
          });
        });
        
        stmt.finalize();
      });
      
    } catch (error) {
      console.error('Error linking repository to project:', error);
      throw error;
    }
  }

  async unlinkRepositoryFromProject(linearProjectId, githubRepoFullName) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        DELETE FROM project_repo_mappings 
        WHERE linear_project_id = ? AND github_repo_full_name = ?
      `);
      
      stmt.run([linearProjectId, githubRepoFullName], function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        resolve({
          deleted: this.changes > 0,
          changes: this.changes
        });
      });
      
      stmt.finalize();
    });
  }

  async getProjectRepositories(linearProjectId) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM project_repo_mappings 
        WHERE linear_project_id = ?
        ORDER BY repository_type, github_repo_name
      `, [linearProjectId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(rows.map(row => ({
          mappingId: row.id,
          linearProjectId: row.linear_project_id,
          linearProjectName: row.linear_project_name,
          githubRepo: {
            fullName: row.github_repo_full_name,
            name: row.github_repo_name,
            owner: row.github_repo_full_name.split('/')[0]
          },
          repositoryType: row.repository_type,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })));
      });
    });
  }

  async getAllProjectMappings() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT linear_project_id, linear_project_name, 
               COUNT(*) as repo_count,
               GROUP_CONCAT(github_repo_full_name) as repositories
        FROM project_repo_mappings 
        GROUP BY linear_project_id, linear_project_name
        ORDER BY linear_project_name
      `, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(rows.map(row => ({
          linearProjectId: row.linear_project_id,
          linearProjectName: row.linear_project_name,
          repositoryCount: row.repo_count,
          repositories: row.repositories ? row.repositories.split(',') : []
        })));
      });
    });
  }

  async getRepositoryProjects(githubRepoFullName) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM project_repo_mappings 
        WHERE github_repo_full_name = ?
        ORDER BY linear_project_name
      `, [githubRepoFullName], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(rows.map(row => ({
          linearProjectId: row.linear_project_id,
          linearProjectName: row.linear_project_name,
          repositoryType: row.repository_type,
          createdAt: row.created_at
        })));
      });
    });
  }

  async updateProjectMetadata(linearProjectId, metadata) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO project_metadata 
        (linear_project_id, project_description, primary_language, framework, deployment_target, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run([
        linearProjectId,
        metadata.description || null,
        metadata.primaryLanguage || null,
        metadata.framework || null,
        metadata.deploymentTarget || null
      ], function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        resolve({
          linearProjectId,
          metadata,
          success: true
        });
      });
      
      stmt.finalize();
    });
  }

  async getProjectMetadata(linearProjectId) {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM project_metadata 
        WHERE linear_project_id = ?
      `, [linearProjectId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(row ? {
          linearProjectId: row.linear_project_id,
          description: row.project_description,
          primaryLanguage: row.primary_language,
          framework: row.framework,
          deploymentTarget: row.deployment_target,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        } : null);
      });
    });
  }

  // Enhanced context for Claude integration
  async getProjectContext(linearProjectId) {
    try {
      const repositories = await this.getProjectRepositories(linearProjectId);
      const metadata = await this.getProjectMetadata(linearProjectId);
      
      // Get repository structures
      const repoStructures = {};
      for (const repoMapping of repositories) {
        const [owner, repo] = repoMapping.githubRepo.fullName.split('/');
        try {
          const structure = await this.githubManager.getRepositoryStructure(owner, repo, '', 2);
          repoStructures[repoMapping.githubRepo.fullName] = {
            structure,
            type: repoMapping.repositoryType,
            name: repoMapping.githubRepo.name
          };
        } catch (error) {
          console.warn(`Could not get structure for ${repoMapping.githubRepo.fullName}:`, error.message);
          repoStructures[repoMapping.githubRepo.fullName] = {
            structure: [],
            type: repoMapping.repositoryType,
            name: repoMapping.githubRepo.name,
            error: error.message
          };
        }
      }

      return {
        linearProjectId,
        repositories: repositories.map(r => r.githubRepo),
        repositoryStructures: repoStructures,
        metadata: metadata || {},
        repositoryCount: repositories.length,
        hasRepositories: repositories.length > 0
      };
      
    } catch (error) {
      console.error('Error getting project context:', error);
      throw error;
    }
  }

  // Format for Telegram display
  formatProjectMappingsForTelegram(mappings, limit = 10) {
    if (!mappings || mappings.length === 0) {
      return '📋 *No hay proyectos con repositorios vinculados*\n\nUsa /link_repo para vincular repositorios a proyectos Linear.';
    }

    let message = `🔗 *Proyectos con Repositorios Vinculados:*\n\n`;
    
    const limitedMappings = mappings.slice(0, limit);
    
    limitedMappings.forEach((mapping, index) => {
      message += `${index + 1}. **${mapping.linearProjectName}**\n`;
      message += `   📊 Repositorios: ${mapping.repositoryCount}\n`;
      
      // Show first 3 repositories
      const repos = mapping.repositories.slice(0, 3);
      repos.forEach(repo => {
        message += `   📂 ${repo}\n`;
      });
      
      if (mapping.repositories.length > 3) {
        message += `   📂 ... y ${mapping.repositories.length - 3} más\n`;
      }
      
      message += `   🔗 /project_repos ${mapping.linearProjectId}\n\n`;
    });
    
    if (mappings.length > limit) {
      message += `... y ${mappings.length - limit} proyectos más\n\n`;
    }
    
    message += `*Total: ${mappings.length} proyecto(s) configurado(s)*`;
    
    return message;
  }

  formatProjectRepositoriesForTelegram(repositories, projectName) {
    if (!repositories || repositories.length === 0) {
      return `📂 *${projectName}*\n\n❌ No hay repositorios vinculados a este proyecto.\n\nUsa /link_repo para agregar repositorios.`;
    }

    let message = `📂 *${projectName}* - Repositorios Vinculados\n\n`;
    
    repositories.forEach((repo, index) => {
      const typeIcon = repo.repositoryType === 'main' ? '🏠' : 
                       repo.repositoryType === 'frontend' ? '🎨' :
                       repo.repositoryType === 'backend' ? '⚙️' : '📦';
      
      message += `${index + 1}. ${typeIcon} **${repo.githubRepo.fullName}**\n`;
      message += `   📝 Tipo: ${repo.repositoryType}\n`;
      message += `   📅 Vinculado: ${new Date(repo.createdAt).toLocaleDateString()}\n`;
      message += `   🔗 /repo_structure ${repo.githubRepo.fullName}\n\n`;
    });
    
    message += `*Total: ${repositories.length} repositorio(s) vinculado(s)*`;
    
    return message;
  }

  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          }
          resolve();
        });
      });
    }
  }
}

module.exports = ProjectRepoManager;