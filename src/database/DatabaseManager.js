const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor(dbPath = './data/tasks.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  async initialize() {
    try {
      // Asegurar que existe el directorio data
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Conectar a SQLite
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Error conectando a SQLite:', err.message);
          throw err;
        }
        console.log('📄 Conectado a SQLite database:', this.dbPath);
      });

      // Crear tablas
      await this.createTables();
      
      return true;
    } catch (error) {
      console.error('❌ Error inicializando database:', error);
      throw error;
    }
  }

  async createTables() {
    const tables = [
      // Tabla de proyectos
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'created',
        prompt_file TEXT,
        atomized_result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        completed_at DATETIME
      )`,
      
      // Tabla de tareas atomizadas
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        docker_command TEXT,
        required_files TEXT,
        output_files TEXT,
        estimated_time TEXT,
        complexity TEXT,
        category TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (project_id) REFERENCES projects (id)
      )`,
      
      // Tabla de dependencias entre tareas
      `CREATE TABLE IF NOT EXISTS task_dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        depends_on TEXT NOT NULL,
        reason TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks (id),
        FOREIGN KEY (depends_on) REFERENCES tasks (id)
      )`,
      
      // Tabla de logs de ejecución
      `CREATE TABLE IF NOT EXISTS execution_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        log_type TEXT NOT NULL, -- 'info', 'error', 'warning'
        message TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks (id)
      )`,
      
      // Tabla de métricas de costo
      `CREATE TABLE IF NOT EXISTS cost_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        operation_type TEXT NOT NULL, -- 'atomization', 'execution'
        tokens_used INTEGER DEFAULT 0,
        cost_usd REAL DEFAULT 0,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id)
      )`
    ];

    for (const tableSQL of tables) {
      await this.runQuery(tableSQL);
    }

    console.log('✅ Database tables initialized');
  }

  // Wrapper para promisificar sqlite3
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('❌ Database error:', err.message);
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('❌ Database error:', err.message);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('❌ Database error:', err.message);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Métodos específicos para proyectos
  async saveProject(project) {
    const sql = `INSERT INTO projects 
      (id, user_id, description, status, prompt_file, atomized_result, processed_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
      project.id,
      project.userId,
      project.description,
      project.status,
      project.promptFile || null,
      project.atomizedResult ? JSON.stringify(project.atomizedResult) : null,
      project.processedAt || null
    ];

    return await this.runQuery(sql, params);
  }

  async updateProject(projectId, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(projectId);

    const sql = `UPDATE projects SET ${fields} WHERE id = ?`;
    return await this.runQuery(sql, values);
  }

  async getProject(projectId) {
    const sql = 'SELECT * FROM projects WHERE id = ?';
    const project = await this.getQuery(sql, [projectId]);
    
    if (project && project.atomized_result) {
      project.atomized_result = JSON.parse(project.atomized_result);
    }
    
    return project;
  }

  async getUserProjects(userId) {
    const sql = 'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC';
    const projects = await this.allQuery(sql, [userId]);
    
    return projects.map(project => {
      if (project.atomized_result) {
        project.atomized_result = JSON.parse(project.atomized_result);
      }
      return project;
    });
  }

  // Métodos para tareas
  async saveTasks(projectId, tasks) {
    const sql = `INSERT INTO tasks 
      (id, project_id, title, description, docker_command, required_files, output_files, 
       estimated_time, complexity, category) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    for (const task of tasks) {
      const params = [
        task.id,
        projectId,
        task.title,
        task.description,
        task.dockerCommand,
        JSON.stringify(task.requiredFiles || []),
        JSON.stringify(task.outputFiles || []),
        task.estimatedTime,
        task.complexity,
        task.category
      ];

      await this.runQuery(sql, params);
    }
  }

  async getProjectTasks(projectId) {
    const sql = 'SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at';
    const tasks = await this.allQuery(sql, [projectId]);
    
    return tasks.map(task => ({
      ...task,
      requiredFiles: JSON.parse(task.required_files || '[]'),
      outputFiles: JSON.parse(task.output_files || '[]')
    }));
  }

  async updateTaskStatus(taskId, status, details = null) {
    const updates = { status };
    
    if (status === 'running') {
      updates.started_at = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }

    return await this.updateQuery('tasks', taskId, updates);
  }

  // Métodos para dependencias
  async saveDependencies(dependencies) {
    const sql = 'INSERT INTO task_dependencies (task_id, depends_on, reason) VALUES (?, ?, ?)';
    
    for (const dep of dependencies) {
      for (const dependsOn of dep.dependsOn || []) {
        await this.runQuery(sql, [dep.taskId, dependsOn, dep.reason]);
      }
    }
  }

  async getTaskDependencies(taskId) {
    const sql = 'SELECT * FROM task_dependencies WHERE task_id = ?';
    return await this.allQuery(sql, [taskId]);
  }

  // Métodos para logs
  async addLog(taskId, logType, message, details = null) {
    const sql = 'INSERT INTO execution_logs (task_id, log_type, message, details) VALUES (?, ?, ?, ?)';
    return await this.runQuery(sql, [taskId, logType, message, details]);
  }

  async getTaskLogs(taskId) {
    const sql = 'SELECT * FROM execution_logs WHERE task_id = ? ORDER BY timestamp DESC';
    return await this.allQuery(sql, [taskId]);
  }

  // Métodos para métricas de costo
  async addCostMetric(projectId, operationType, tokensUsed = 0, costUsd = 0, details = null) {
    const sql = `INSERT INTO cost_metrics 
      (project_id, operation_type, tokens_used, cost_usd, details) 
      VALUES (?, ?, ?, ?, ?)`;
    
    return await this.runQuery(sql, [projectId, operationType, tokensUsed, costUsd, details]);
  }

  async getProjectCosts(projectId) {
    const sql = 'SELECT * FROM cost_metrics WHERE project_id = ? ORDER BY timestamp DESC';
    return await this.allQuery(sql, [projectId]);
  }

  // Método genérico de actualización
  async updateQuery(table, id, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);

    const sql = `UPDATE ${table} SET ${fields} WHERE id = ?`;
    return await this.runQuery(sql, values);
  }

  // Cerrar conexión
  async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            console.error('❌ Error cerrando database:', err.message);
            reject(err);
          } else {
            console.log('📄 Database connection closed');
            resolve();
          }
        });
      });
    }
  }

  // Método de salud/diagnóstico
  async healthCheck() {
    try {
      const sql = 'SELECT COUNT(*) as count FROM projects';
      const result = await this.getQuery(sql);
      return {
        status: 'healthy',
        projectCount: result.count,
        dbPath: this.dbPath,
        connected: !!this.db
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        connected: false
      };
    }
  }
}

module.exports = DatabaseManager;