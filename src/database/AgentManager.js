const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Agent Manager - Gestiona agentes background estilo Cursor
 * Cada agente tiene contexto específico (Linear project + GitHub repos)
 */
class AgentManager {
  constructor(dbPath = './data/agents.db') {
    this.dbPath = path.resolve(dbPath);
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Crear tablas para agentes
        this.createTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  async createTables() {
    // Check if we need to migrate existing tables
    await this.migrateTablesIfNeeded();
    const createAgentsTable = `
      CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        linear_project_id TEXT NOT NULL,
        linear_project_name TEXT NOT NULL,
        github_repos TEXT NOT NULL, -- JSON array de repos
        status TEXT DEFAULT 'idle', -- idle, working, completed, error
        current_task_id TEXT NULL,
        current_task_title TEXT NULL,
        progress INTEGER DEFAULT 0, -- 0-100
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createTaskExecutionsTable = `
      CREATE TABLE IF NOT EXISTS task_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id INTEGER NOT NULL,
        linear_task_id TEXT NOT NULL,
        linear_task_title TEXT NOT NULL,
        execution_mode TEXT NOT NULL, -- 'background' or 'interactive'
        user_prompt TEXT NULL, -- Para modo interactive
        status TEXT DEFAULT 'pending', -- pending, running, completed, failed
        docker_instance_id TEXT NULL,
        progress INTEGER DEFAULT 0,
        logs TEXT NULL, -- JSON array de logs
        started_at DATETIME NULL,
        completed_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents (id)
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(createAgentsTable, (err) => {
          if (err) reject(err);
        });
        
        this.db.run(createTaskExecutionsTable, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async migrateTablesIfNeeded() {
    return new Promise((resolve, reject) => {
      // Check if updated_at column exists in task_executions
      this.db.get("PRAGMA table_info(task_executions)", (err, result) => {
        if (err) {
          // Table doesn't exist yet, no migration needed
          resolve();
          return;
        }
        
        // Check if updated_at column exists
        this.db.all("PRAGMA table_info(task_executions)", (err, columns) => {
          if (err) {
            resolve();
            return;
          }
          
          const hasUpdatedAt = columns.some(col => col.name === 'updated_at');
          
          if (!hasUpdatedAt) {
            console.log('🔄 Migrating task_executions table to add updated_at column...');
            this.db.run("ALTER TABLE task_executions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP", (err) => {
              if (err) {
                console.warn('Migration warning:', err.message);
              } else {
                console.log('✅ Migration completed');
              }
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
    });
  }

  // Crear nuevo agente
  async createAgent(userId, name, linearProjectId, linearProjectName, githubRepos) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO agents (user_id, name, linear_project_id, linear_project_name, github_repos)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        userId,
        name,
        linearProjectId,
        linearProjectName,
        JSON.stringify(githubRepos)
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            user_id: userId,
            name: name,
            linear_project_id: linearProjectId,
            linear_project_name: linearProjectName,
            github_repos: githubRepos,
            status: 'idle'
          });
        }
      });
      
      stmt.finalize();
    });
  }

  // Obtener agentes de un usuario
  async getUserAgents(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM agents WHERE user_id = ? ORDER BY updated_at DESC',
        [userId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const agents = rows.map(row => ({
              ...row,
              github_repos: JSON.parse(row.github_repos)
            }));
            resolve(agents);
          }
        }
      );
    });
  }

  // Obtener agente por ID
  async getAgent(agentId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM agents WHERE id = ?',
        [agentId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            resolve({
              ...row,
              github_repos: JSON.parse(row.github_repos)
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  // Actualizar estado del agente
  async updateAgentStatus(agentId, status, currentTaskId = null, currentTaskTitle = null, progress = 0) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        UPDATE agents 
        SET status = ?, current_task_id = ?, current_task_title = ?, progress = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run([status, currentTaskId, currentTaskTitle, progress, agentId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
      
      stmt.finalize();
    });
  }

  // Crear ejecución de tarea
  async createTaskExecution(agentId, linearTaskId, linearTaskTitle, executionMode, userPrompt = null) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO task_executions (agent_id, linear_task_id, linear_task_title, execution_mode, user_prompt)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run([agentId, linearTaskId, linearTaskTitle, executionMode, userPrompt], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            agent_id: agentId,
            linear_task_id: linearTaskId,
            linear_task_title: linearTaskTitle,
            execution_mode: executionMode,
            user_prompt: userPrompt,
            status: 'pending'
          });
        }
      });
      
      stmt.finalize();
    });
  }

  // Actualizar ejecución de tarea
  // Get task execution by ID
  async getTaskExecution(executionId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM task_executions WHERE id = ?',
        [executionId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  async updateTaskExecution(executionId, status, progress = null, logs = null, dockerInstanceId = null) {
    return new Promise((resolve, reject) => {
      let query = 'UPDATE task_executions SET status = ?, updated_at = CURRENT_TIMESTAMP';
      let params = [status];
      
      if (progress !== null) {
        query += ', progress = ?';
        params.push(progress);
      }
      
      if (logs !== null) {
        query += ', logs = ?';
        params.push(typeof logs === 'string' ? logs : JSON.stringify(logs));
      }
      
      if (dockerInstanceId !== null) {
        query += ', docker_instance_id = ?';
        params.push(dockerInstanceId);
      }
      
      if (status === 'running') {
        query += ', started_at = COALESCE(started_at, CURRENT_TIMESTAMP)';
      }
      
      if (status === 'completed' || status === 'failed') {
        query += ', completed_at = CURRENT_TIMESTAMP';
      }
      
      query += ' WHERE id = ?';
      params.push(executionId);
      
      const stmt = this.db.prepare(query);
      
      stmt.run(params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
      
      stmt.finalize();
    });
  }

  // Helper para verificar si ya tiene started_at
  hasStartTime(executionId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT started_at FROM task_executions WHERE id = ?',
        [executionId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row && row.started_at !== null);
        }
      );
    });
  }

  // Obtener ejecuciones activas
  async getActiveExecutions(userId = null) {
    let query = `
      SELECT te.*, a.name as agent_name, a.user_id 
      FROM task_executions te 
      JOIN agents a ON te.agent_id = a.id 
      WHERE te.status IN ('pending', 'running')
    `;
    let params = [];
    
    if (userId) {
      query += ' AND a.user_id = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY te.created_at DESC';
    
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Eliminar agente
  async deleteAgent(agentId) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Eliminar ejecuciones relacionadas
        this.db.run('DELETE FROM task_executions WHERE agent_id = ?', [agentId], (err) => {
          if (err) {
            console.error('Error deleting task executions:', err);
            return resolve({ success: false, error: err.message });
          }
          
          // Eliminar agente
          this.db.run('DELETE FROM agents WHERE id = ?', [agentId], function(err) {
            if (err) {
              console.error('Error deleting agent:', err);
              resolve({ success: false, error: err.message });
            } else if (this.changes === 0) {
              resolve({ success: false, error: 'Agente no encontrado' });
            } else {
              resolve({ success: true });
            }
          });
        });
      });
    });
  }

  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close(() => {
          resolve();
        });
      });
    }
  }
}

module.exports = AgentManager;