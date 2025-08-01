class GitHubManager {
  constructor(token) {
    this.token = token;
    this.octokit = null;
    this.repositoryCache = new Map(); // Cache para estructura de repos
    this.initializeOctokit();
  }

  async initializeOctokit() {
    try {
      const { Octokit } = await import('@octokit/rest');
      this.octokit = new Octokit({
        auth: this.token
      });
    } catch (error) {
      console.error('Error initializing Octokit:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      if (!this.octokit) await this.initializeOctokit();
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      return {
        username: user.login,
        name: user.name,
        email: user.email,
        company: user.company,
        public_repos: user.public_repos,
        private_repos: user.total_private_repos
      };
    } catch (error) {
      console.error('GitHub API connection failed:', error);
      throw new Error(`GitHub API Error: ${error.message}`);
    }
  }

  async getRepositories(type = 'all', sort = 'updated', per_page = 100) {
    try {
      if (!this.octokit) await this.initializeOctokit();
      const { data: repos } = await this.octokit.rest.repos.listForAuthenticatedUser({
        type, // 'all', 'public', 'private'
        sort, // 'created', 'updated', 'pushed', 'full_name'
        direction: 'desc',
        per_page
      });

      // Filtrar repos con permisos de escritura
      const writableRepos = repos.filter(repo => 
        repo.permissions && (repo.permissions.push || repo.permissions.admin)
      );

      return writableRepos.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        language: repo.language,
        size: repo.size,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        permissions: repo.permissions,
        topics: repo.topics,
        default_branch: repo.default_branch,
        open_issues_count: repo.open_issues_count,
        stargazers_count: repo.stargazers_count,
        watchers_count: repo.watchers_count,
        forks_count: repo.forks_count
      }));
    } catch (error) {
      console.error('Error fetching repositories:', error);
      throw new Error(`Failed to fetch repositories: ${error.message}`);
    }
  }

  async getRepositoryStructure(owner, repo, path = '', maxDepth = 3, currentDepth = 0) {
    const cacheKey = `${owner}/${repo}:${path}`;
    
    // Verificar cache
    if (this.repositoryCache.has(cacheKey)) {
      return this.repositoryCache.get(cacheKey);
    }

    try {
      if (currentDepth >= maxDepth) {
        return { type: 'truncated', message: 'Max depth reached' };
      }

      const { data: contents } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path
      });

      // Si es un archivo individual
      if (!Array.isArray(contents)) {
        const fileInfo = {
          name: contents.name,
          path: contents.path,
          type: contents.type,
          size: contents.size,
          sha: contents.sha,
          download_url: contents.download_url
        };
        this.repositoryCache.set(cacheKey, fileInfo);
        return fileInfo;
      }

      // Si es un directorio
      const structure = {
        type: 'directory',
        path: path || 'root',
        contents: []
      };

      for (const item of contents) {
        const itemInfo = {
          name: item.name,
          path: item.path,
          type: item.type,
          size: item.size,
          sha: item.sha
        };

        // Si es un directorio y no hemos alcanzado la profundidad máxima, obtener contenido
        if (item.type === 'dir' && currentDepth < maxDepth - 1) {
          try {
            itemInfo.contents = await this.getRepositoryStructure(
              owner, 
              repo, 
              item.path, 
              maxDepth, 
              currentDepth + 1
            );
          } catch (err) {
            itemInfo.contents = { type: 'error', message: err.message };
          }
        }

        structure.contents.push(itemInfo);
      }

      this.repositoryCache.set(cacheKey, structure);
      return structure;
    } catch (error) {
      console.error('Error fetching repository structure:', error);
      throw new Error(`Failed to get repository structure: ${error.message}`);
    }
  }

  async getRepositoryLanguages(owner, repo) {
    try {
      const { data: languages } = await this.octokit.rest.repos.listLanguages({
        owner,
        repo
      });
      return languages;
    } catch (error) {
      console.error('Error fetching repository languages:', error);
      return {};
    }
  }

  async getRepositoryTopics(owner, repo) {
    try {
      const { data: topics } = await this.octokit.rest.repos.getAllTopics({
        owner,
        repo
      });
      return topics.names;
    } catch (error) {
      console.error('Error fetching repository topics:', error);
      return [];
    }
  }

  // Formateo para Telegram
  formatRepositoriesForTelegram(repositories, limit = 15) {
    if (!repositories || repositories.length === 0) {
      return '📂 No hay repositorios con permisos de escritura disponibles';
    }

    let message = '📂 **Repositorios GitHub Disponibles:**\n\n';
    
    repositories.slice(0, limit).forEach((repo, index) => {
      const visibility = repo.private ? '🔒 Privado' : '🌐 Público';
      const language = repo.language ? `💻 ${repo.language}` : '';
      const lastUpdate = new Date(repo.updated_at).toLocaleDateString();
      
      message += `${index + 1}. **${repo.name}**\n`;
      message += `   ${visibility} ${language}\n`;
      message += `   📊 ⭐${repo.stargazers_count} • 🍴${repo.forks_count} • 📝${repo.open_issues_count} issues\n`;
      message += `   📅 Actualizado: ${lastUpdate}\n`;
      
      if (repo.description) {
        message += `   📝 ${repo.description.slice(0, 80)}${repo.description.length > 80 ? '...' : ''}\n`;
      }
      
      message += `   🔗 \`/select_repo ${repo.full_name}\`\n\n`;
    });

    if (repositories.length > limit) {
      message += `*... y ${repositories.length - limit} repositorios más*\n\n`;
    }

    message += '*Usa /select_repo [owner/repo] para seleccionar un repositorio*';
    return message;
  }

  formatRepositoryStructureForTelegram(structure, repoName, maxItems = 20) {
    if (!structure || structure.type === 'error') {
      return `❌ Error obteniendo estructura de ${repoName}`;
    }

    if (structure.type !== 'directory') {
      return `📄 **${repoName}** - Archivo individual: ${structure.name}`;
    }

    let message = `📁 **Estructura de ${repoName}:**\n\n`;
    
    const formatItem = (item, indent = '') => {
      const icon = item.type === 'dir' ? '📁' : '📄';
      let text = `${indent}${icon} ${item.name}`;
      
      if (item.type === 'file' && item.size) {
        text += ` (${this.formatFileSize(item.size)})`;
      }
      
      return text + '\n';
    };

    const addContents = (contents, indent = '', itemCount = { count: 0 }) => {
      if (!contents || !Array.isArray(contents.contents)) return '';
      
      let result = '';
      for (const item of contents.contents) {
        if (itemCount.count >= maxItems) {
          result += `${indent}... (más archivos)\n`;
          break;
        }
        
        result += formatItem(item, indent);
        itemCount.count++;
        
        if (item.type === 'dir' && item.contents && indent.length < 6) {
          result += addContents(item.contents, indent + '  ', itemCount);
        }
      }
      return result;
    };

    message += addContents(structure);
    message += `\n*Estructura limitada a ${maxItems} elementos*`;
    
    return message;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Utilidades para selección de repositorios
  async validateRepositoryAccess(owner, repo) {
    try {
      const { data: repository } = await this.octokit.rest.repos.get({
        owner,
        repo
      });
      
      // Verificar permisos de escritura
      if (!repository.permissions || (!repository.permissions.push && !repository.permissions.admin)) {
        throw new Error('Sin permisos de escritura en este repositorio');
      }
      
      return {
        valid: true,
        repository: {
          id: repository.id,
          name: repository.name,
          full_name: repository.full_name,
          description: repository.description,
          private: repository.private,
          permissions: repository.permissions,
          default_branch: repository.default_branch,
          clone_url: repository.clone_url,
          ssh_url: repository.ssh_url
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  clearCache() {
    this.repositoryCache.clear();
  }

  getCacheStats() {
    return {
      totalEntries: this.repositoryCache.size,
      keys: Array.from(this.repositoryCache.keys())
    };
  }
}

module.exports = GitHubManager;