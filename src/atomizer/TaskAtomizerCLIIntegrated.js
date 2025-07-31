const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = util.promisify(exec);

class TaskAtomizerCLIIntegrated {
  constructor(options = {}) {
    // Enhanced context providers
    this.linearManager = options.linearManager;
    this.githubManager = options.githubManager;
    this.projectRepoManager = options.projectRepoManager;
    this.projectContext = null;
    this.repositoryContext = null;
    this.tempDir = path.join(__dirname, '../../temp');
  }

  /**
   * Atomiza un proyecto usando Claude CLI (sin costos adicionales)
   * @param {string} projectDescription - Descripción completa del proyecto
   * @param {Object} options - Opciones adicionales para la atomización
   * @returns {Promise<Object>} - Tareas atomizadas con dependencias
   */
  async atomizeProject(projectDescription, options = {}) {
    const {
      maxTasks = 20,
      complexity = 'medium',
      techStack = 'auto-detect',
      linearIssueId = null,
      linearProjectId = null,
      githubRepo = null,
      includeContext = true
    } = options;

    // Enhanced context gathering with ProjectRepoManager
    let enhancedContext = '';
    let projectContext = null;
    let detectedPatterns = null;
    
    if (includeContext) {
      if (linearProjectId && this.projectRepoManager) {
        try {
          projectContext = await this.projectRepoManager.getProjectContext(linearProjectId);
          detectedPatterns = this.detectProjectPatterns(projectContext);
          enhancedContext = await this.gatherProjectContext(projectContext, linearIssueId);
          
          // Add detected patterns to context
          if (detectedPatterns && Object.keys(detectedPatterns).some(key => detectedPatterns[key].length > 0)) {
            enhancedContext += this.formatPatternsForContext(detectedPatterns);
          }
        } catch (error) {
          console.warn('Could not get project context:', error.message);
          enhancedContext = await this.gatherEnhancedContext(linearIssueId, githubRepo);
        }
      } else {
        enhancedContext = await this.gatherEnhancedContext(linearIssueId, githubRepo);
      }
    }

    const systemPrompt = this.buildEnhancedAtomizationPrompt(
      maxTasks, 
      complexity, 
      techStack, 
      enhancedContext
    );
    
    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      
      const fullPrompt = `${systemPrompt}

## PROJECT TO ATOMIZE:
${projectDescription}

${enhancedContext ? `## ADDITIONAL CONTEXT:
${enhancedContext}

` : ''}Return ONLY the JSON response without any markdown formatting or explanations.`;

      console.log('🤖 Executing Claude CLI for atomization...');
      
      // Execute Claude CLI with --print for non-interactive output
      // Using echo to pipe the prompt to claude
      const isRoot = process.getuid && process.getuid() === 0;
      const permissionFlag = isRoot ? '' : '--permission-mode bypassPermissions';
      const claudeCommand = `echo ${JSON.stringify(fullPrompt)} | claude --print ${permissionFlag}`;
      
      const { stdout, stderr } = await execAsync(claudeCommand, {
        shell: true,
        timeout: 120000, // 2 minutes timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      if (stderr) {
        console.warn('Claude CLI stderr:', stderr);
      }
      
      console.log('✅ Claude CLI execution completed');
      
      // Parse Claude CLI response
      const atomizedTasks = this.parseAtomizedResponse(stdout);
      
      // Validate structure and dependencies
      this.validateEnhancedAtomizedTasks(atomizedTasks);
      
      // Calculate costs (CLI usage is free with Pro plan)
      const costs = this.calculateCLICosts(atomizedTasks);
      
      return {
        success: true,
        project: {
          title: atomizedTasks.project.title,
          description: projectDescription,
          estimatedDuration: atomizedTasks.project.estimatedDuration,
          complexity: atomizedTasks.project.complexity,
          techStack: atomizedTasks.project.techStack,
          linearIssue: atomizedTasks.project.linearIssue,
          linearProjectId: linearProjectId,
          repository: atomizedTasks.project.repository
        },
        tasks: atomizedTasks.tasks.map(task => ({
          ...task,
          projectContext: projectContext // Add project context to each task
        })),
        dependencies: atomizedTasks.dependencies,
        executionMatrix: atomizedTasks.executionMatrix,
        executionOrder: this.calculateEnhancedExecutionOrder(atomizedTasks),
        costs: costs,
        context: {
          linear: this.projectContext,
          repository: this.repositoryContext,
          project: projectContext
        },
        detectedPatterns: detectedPatterns,
        cliMethod: true, // Flag to indicate CLI usage
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error atomizing project with Claude CLI:', error);
      throw new Error(`Task atomization failed: ${error.message}`);
    }
  }

  /**
   * Recopila contexto del proyecto usando ProjectRepoManager
   */
  async gatherProjectContext(projectContext, linearIssueId = null) {
    let context = '';
    
    try {
      // Project metadata
      if (projectContext.metadata) {
        context += `PROYECTO LINEAR:
- ID: ${projectContext.linearProjectId}
- Descripción: ${projectContext.metadata.description || 'Sin descripción'}
- Lenguaje: ${projectContext.metadata.primaryLanguage || 'No especificado'}
- Framework: ${projectContext.metadata.framework || 'No especificado'}
- Deploy Target: ${projectContext.metadata.deploymentTarget || 'No especificado'}

`;
      }

      // Repository information
      if (projectContext.repositories && projectContext.repositories.length > 0) {
        context += `REPOSITORIOS VINCULADOS (${projectContext.repositories.length}):
`;
        projectContext.repositories.forEach(repo => {
          context += `- ${repo.fullName} (${repo.owner}/${repo.name})
`;
        });
        context += '\n';

        // Repository structures
        if (projectContext.repositoryStructures) {
          context += `ESTRUCTURA DE REPOSITORIOS:
`;
          Object.entries(projectContext.repositoryStructures).forEach(([repoName, repoData]) => {
            if (repoData.structure && repoData.structure.length > 0) {
              context += `
${repoName} (${repoData.type}):
${repoData.structure.slice(0, 10).map(item => `  - ${item}`).join('\n')}
${repoData.structure.length > 10 ? `  ... y ${repoData.structure.length - 10} archivos más` : ''}
`;
            }
          });
        }
      }

      // Linear issue context if provided
      if (linearIssueId && this.linearManager) {
        const issue = await this.linearManager.getIssueById(linearIssueId);
        if (issue) {
          this.projectContext = issue;
          context += `
TAREA LINEAR ESPECÍFICA:
- ID: ${issue.identifier}
- Título: ${issue.title}
- Descripción: ${issue.description || 'Sin descripción'}
- Prioridad: ${issue.priority}
- Estado: ${issue.state.name}
- Estimación: ${issue.estimate || 'Sin estimar'} puntos
- Asignado: ${issue.assignee?.name || 'Sin asignar'}

`;
        }
      }

    } catch (error) {
      console.warn('Warning: Could not gather complete project context:', error.message);
    }
    
    return context;
  }

  /**
   * Recopila contexto mejorado de Linear y GitHub (método legacy)
   */
  async gatherEnhancedContext(linearIssueId, githubRepo) {
    let context = '';
    
    try {
      // Linear context
      if (linearIssueId && this.linearManager) {
        const issue = await this.linearManager.getIssueById(linearIssueId);
        if (issue) {
          this.projectContext = issue;
          context += `TAREA LINEAR:
- ID: ${issue.identifier}
- Título: ${issue.title}
- Descripción: ${issue.description || 'Sin descripción'}
- Prioridad: ${issue.priority}
- Estado: ${issue.state.name}
- Estimación: ${issue.estimate || 'Sin estimar'} puntos
- Proyecto: ${issue.project?.name || 'Sin proyecto'}
- Equipo: ${issue.team?.name} (${issue.team?.key})
- Asignado: ${issue.assignee?.name || 'Sin asignar'}

`;
          
          if (issue.comments?.nodes?.length > 0) {
            context += `COMENTARIOS:
${issue.comments.nodes.slice(0, 3).map(c => `- ${c.user.name}: ${c.body.slice(0, 200)}`).join('\n')}

`;
          }
        }
      }

      // GitHub repository context
      if (githubRepo && this.githubManager) {
        const repoInfo = await this.githubManager.getRepositoryInfo(githubRepo);
        if (repoInfo) {
          this.repositoryContext = repoInfo;
          context += `REPOSITORIO GITHUB:
- Nombre: ${repoInfo.name}
- Descripción: ${repoInfo.description || 'Sin descripción'}
- Lenguaje principal: ${repoInfo.language}
- Tecnologías: ${repoInfo.topics?.join(', ') || 'No especificadas'}
- Estructura: ${repoInfo.structure?.join(', ') || 'Analizando...'}

`;
        }
      }

    } catch (error) {
      console.warn('Warning: Could not gather enhanced context:', error.message);
    }
    
    return context;
  }

  /**
   * Detecta patrones y dependencias del proyecto automáticamente
   */
  detectProjectPatterns(projectContext) {
    const patterns = {
      languages: new Set(),
      frameworks: new Set(),
      buildTools: new Set(),
      databases: new Set(),
      deploymentTargets: new Set(),
      testingFrameworks: new Set(),
      packageManagers: new Set()
    };

    if (!projectContext || !projectContext.repositoryStructures) {
      return this.formatDetectedPatterns(patterns);
    }

    Object.entries(projectContext.repositoryStructures).forEach(([repoName, repoData]) => {
      if (!repoData.structure) return;

      repoData.structure.forEach(file => {
        const fileName = file.toLowerCase();
        
        // Language detection
        if (fileName.endsWith('.js') || fileName.includes('package.json')) patterns.languages.add('JavaScript');
        if (fileName.endsWith('.ts') || fileName.includes('tsconfig.json')) patterns.languages.add('TypeScript');
        if (fileName.endsWith('.py') || fileName.includes('requirements.txt')) patterns.languages.add('Python');
        if (fileName.endsWith('.java') || fileName.includes('pom.xml')) patterns.languages.add('Java');
        if (fileName.endsWith('.go') || fileName.includes('go.mod')) patterns.languages.add('Go');
        if (fileName.endsWith('.rs') || fileName.includes('cargo.toml')) patterns.languages.add('Rust');
        if (fileName.endsWith('.php') || fileName.includes('composer.json')) patterns.languages.add('PHP');

        // Framework detection
        if (fileName.endsWith('.jsx') || fileName.endsWith('.tsx')) patterns.frameworks.add('React');
        if (fileName.endsWith('.vue')) patterns.frameworks.add('Vue.js');
        if (fileName.includes('angular')) patterns.frameworks.add('Angular');
        if (fileName.includes('package.json') || fileName.includes('node_modules')) {
          if (file.includes('react')) patterns.frameworks.add('React');
          if (file.includes('vue')) patterns.frameworks.add('Vue.js');
          if (file.includes('angular')) patterns.frameworks.add('Angular');
          if (file.includes('express')) patterns.frameworks.add('Express.js');
          if (file.includes('next')) patterns.frameworks.add('Next.js');
          if (file.includes('nuxt')) patterns.frameworks.add('Nuxt.js');
        }
        if (fileName.includes('requirements.txt')) {
          if (file.includes('django')) patterns.frameworks.add('Django');
          if (file.includes('flask')) patterns.frameworks.add('Flask');
          if (file.includes('fastapi')) patterns.frameworks.add('FastAPI');
        }

        // Build tools
        if (fileName.includes('webpack')) patterns.buildTools.add('Webpack');
        if (fileName.includes('vite')) patterns.buildTools.add('Vite');
        if (fileName.includes('rollup')) patterns.buildTools.add('Rollup');
        if (fileName.includes('parcel')) patterns.buildTools.add('Parcel');
        if (fileName.includes('dockerfile')) patterns.buildTools.add('Docker');
        if (fileName.includes('docker-compose')) patterns.buildTools.add('Docker Compose');

        // Package managers
        if (fileName.includes('package-lock.json')) patterns.packageManagers.add('npm');
        if (fileName.includes('yarn.lock')) patterns.packageManagers.add('yarn');
        if (fileName.includes('pnpm-lock.yaml')) patterns.packageManagers.add('pnpm');
        if (fileName.includes('poetry.lock')) patterns.packageManagers.add('poetry');
        if (fileName.includes('pipfile')) patterns.packageManagers.add('pipenv');

        // Testing frameworks
        if (fileName.includes('jest')) patterns.testingFrameworks.add('Jest');
        if (fileName.includes('vitest')) patterns.testingFrameworks.add('Vitest');
        if (fileName.includes('pytest')) patterns.testingFrameworks.add('pytest');
        if (fileName.includes('cypress')) patterns.testingFrameworks.add('Cypress');
        if (fileName.includes('playwright')) patterns.testingFrameworks.add('Playwright');

        // Database detection
        if (fileName.includes('mongo') || fileName.includes('mongodb')) patterns.databases.add('MongoDB');
        if (fileName.includes('postgres') || fileName.includes('pg')) patterns.databases.add('PostgreSQL');
        if (fileName.includes('mysql')) patterns.databases.add('MySQL');
        if (fileName.includes('redis')) patterns.databases.add('Redis');
        if (fileName.includes('sqlite')) patterns.databases.add('SQLite');

        // Deployment targets
        if (fileName.includes('vercel')) patterns.deploymentTargets.add('Vercel');
        if (fileName.includes('netlify')) patterns.deploymentTargets.add('Netlify');
        if (fileName.includes('heroku')) patterns.deploymentTargets.add('Heroku');
        if (fileName.includes('aws') || fileName.includes('cloudformation')) patterns.deploymentTargets.add('AWS');
        if (fileName.includes('gcp') || fileName.includes('cloudbuild')) patterns.deploymentTargets.add('Google Cloud');
        if (fileName.includes('azure')) patterns.deploymentTargets.add('Azure');
      });
    });

    return this.formatDetectedPatterns(patterns);
  }

  formatDetectedPatterns(patterns) {
    const result = {};
    
    Object.entries(patterns).forEach(([key, value]) => {
      result[key] = Array.from(value);
    });

    return result;
  }

  formatPatternsForContext(patterns) {
    let context = '\nPATRONES DETECTADOS AUTOMÁTICAMENTE:\n';
    
    if (patterns.languages.length > 0) {
      context += `- Lenguajes: ${patterns.languages.join(', ')}\n`;
    }
    if (patterns.frameworks.length > 0) {
      context += `- Frameworks: ${patterns.frameworks.join(', ')}\n`;
    }
    if (patterns.buildTools.length > 0) {
      context += `- Herramientas de build: ${patterns.buildTools.join(', ')}\n`;
    }
    if (patterns.packageManagers.length > 0) {
      context += `- Gestores de paquetes: ${patterns.packageManagers.join(', ')}\n`;
    }
    if (patterns.testingFrameworks.length > 0) {
      context += `- Testing: ${patterns.testingFrameworks.join(', ')}\n`;
    }
    if (patterns.databases.length > 0) {
      context += `- Bases de datos: ${patterns.databases.join(', ')}\n`;
    }
    if (patterns.deploymentTargets.length > 0) {
      context += `- Deployment: ${patterns.deploymentTargets.join(', ')}\n`;
    }
    
    context += '\n';
    return context;
  }

  /**
   * Construye el prompt del sistema mejorado para atomización
   */
  buildEnhancedAtomizationPrompt(maxTasks, complexity, techStack, enhancedContext) {
    const contextualGuidance = enhancedContext ? `

CONTEXTO DEL PROYECTO:
${enhancedContext}

INSTRUCCIONES CONTEXTUALES:
- Utiliza la información del contexto para crear tareas más precisas
- Respeta las convenciones y estructura del repositorio existente
- Considera la prioridad y estimación de la tarea Linear
- Mantén coherencia con el stack tecnológico identificado
- Si hay comentarios, úsalos para entender mejor los requisitos` : '';

    return `Eres un experto en descomposición de proyectos de software en tareas atómicas ejecutables.

OBJETIVO: Analizar la descripción del proyecto y atomizarlo en tareas independientes que puedan ser ejecutadas por agentes Docker autónomos.${contextualGuidance}

REGLAS DE ATOMIZACIÓN MEJORADAS:
1. Cada tarea debe ser completamente independiente y ejecutable por separado
2. Una tarea NO puede depender de archivos o estado creado por otra tarea
3. Máximo ${maxTasks} tareas total
4. Cada tarea debe incluir TODOS los archivos/dependencias que necesita
5. Las dependencias deben ser explícitas y verificables
6. Priorizar tareas que se pueden paralelizar
7. Incluir validación y testing específico por tarea
8. Estimar costos computacionales realistas
9. Considerar rollback automático en caso de fallos

FORMATO DE RESPUESTA MEJORADO (JSON estricto):
{
  "project": {
    "title": "Nombre del proyecto",
    "complexity": "low|medium|high",
    "estimatedDuration": "1-2 hours|1-2 days|1-2 weeks",
    "techStack": ["tecnologías", "detectadas"],
    "linearIssue": "${this.projectContext?.identifier || null}",
    "repository": "${this.repositoryContext?.name || null}"
  },
  "tasks": [
    {
      "id": "task_1",
      "title": "Título descriptivo de la tarea",
      "description": "Descripción completa de QUÉ hacer",
      "dockerCommand": "comando específico para ejecutar en container",
      "requiredFiles": ["archivo1.js", "archivo2.json"],
      "outputFiles": ["resultado1.js", "build/app.js"],
      "estimatedTime": "15min|30min|1hour|2hours",
      "estimatedCost": "0.001|0.01|0.1|1.0",
      "complexity": "low|medium|high",
      "category": "setup|development|testing|deployment|documentation",
      "validation": {
        "command": "comando para validar el resultado",
        "expectedOutput": "descripción del resultado esperado"
      },
      "rollback": {
        "command": "comando para revertir cambios",
        "conditions": ["condición1", "condición2"]
      }
    }
  ],
  "dependencies": [
    {
      "taskId": "task_2",
      "dependsOn": ["task_1"],
      "reason": "Necesita los archivos generados por task_1",
      "strictOrder": true,
      "parallelizable": false
    }
  ],
  "executionMatrix": {
    "parallelGroups": [
      ["task_1", "task_3"],
      ["task_2"],
      ["task_4", "task_5"]
    ],
    "criticalPath": ["task_1", "task_2", "task_4"],
    "totalEstimatedTime": "2 hours",
    "totalEstimatedCost": "$0.50"
  }
}

CATEGORÍAS DE TAREAS:
- setup: Configuración inicial, instalación de dependencias
- development: Código, implementación de features
- testing: Pruebas, validación, QA
- deployment: Build, containerización, CI/CD
- documentation: README, docs, comentarios

IMPORTANTE:
- NO generes tareas que dependan de interacción humana
- Cada tarea debe poder ejecutarse completamente sola
- Incluye comandos Docker específicos y ejecutables
- Las dependencias deben ser mínimas y claras
- Incluye validación automática por tarea
- Estima costos realistas basados en complejidad`;
  }

  /**
   * Parsea la respuesta de Claude CLI y valida el JSON
   */
  parseAtomizedResponse(content) {
    try {
      // Limpiar el contenido y extraer solo el JSON
      // Manejar tanto respuestas con ```json como respuestas directas
      let cleanContent = content.trim();
      
      // Si viene con markdown code blocks, extraer el contenido
      if (cleanContent.startsWith('```json')) {
        const start = cleanContent.indexOf('```json') + 7;
        const end = cleanContent.lastIndexOf('```');
        if (end > start) {
          cleanContent = cleanContent.substring(start, end).trim();
        }
      } else if (cleanContent.startsWith('```')) {
        const start = cleanContent.indexOf('```') + 3;
        const end = cleanContent.lastIndexOf('```');
        if (end > start) {
          cleanContent = cleanContent.substring(start, end).trim();
        }
      }
      
      // Buscar el JSON dentro del contenido limpio
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    } catch (error) {
      console.error('Failed to parse atomized response:', content);
      throw new Error(`Invalid JSON response: ${error.message}`);
    }
  }

  /**
   * Valida la estructura mejorada de las tareas atomizadas
   */
  validateEnhancedAtomizedTasks(atomizedTasks) {
    if (!atomizedTasks.project || !atomizedTasks.tasks) {
      throw new Error('Invalid atomized structure: missing project or tasks');
    }

    if (!Array.isArray(atomizedTasks.tasks) || atomizedTasks.tasks.length === 0) {
      throw new Error('No tasks generated');
    }

    // Validar estructura del proyecto mejorada
    const project = atomizedTasks.project;
    if (!project.title || !project.complexity || !project.estimatedDuration) {
      throw new Error('Project missing required fields: title, complexity, estimatedDuration');
    }

    // Validar cada tarea con campos mejorados
    atomizedTasks.tasks.forEach((task, index) => {
      if (!task.id || !task.title || !task.description) {
        throw new Error(`Task ${index} missing required fields`);
      }
      
      if (!task.dockerCommand) {
        throw new Error(`Task ${task.id} missing dockerCommand`);
      }

      if (!task.estimatedTime || !task.category) {
        throw new Error(`Task ${task.id} missing estimatedTime or category`);
      }
    });

    // Validar dependencias mejoradas
    if (atomizedTasks.dependencies) {
      const taskIds = atomizedTasks.tasks.map(t => t.id);
      atomizedTasks.dependencies.forEach(dep => {
        if (!taskIds.includes(dep.taskId)) {
          throw new Error(`Dependency references unknown task: ${dep.taskId}`);
        }
        dep.dependsOn.forEach(depId => {
          if (!taskIds.includes(depId)) {
            throw new Error(`Dependency references unknown task: ${depId}`);
          }
        });
      });
    }
  }

  /**
   * Calcula el orden de ejecución mejorado basado en la matriz de ejecución
   */
  calculateEnhancedExecutionOrder(atomizedTasks) {
    if (atomizedTasks.executionMatrix && atomizedTasks.executionMatrix.parallelGroups) {
      // Usar la matriz de ejecución si está disponible
      return {
        sequential: this.calculateExecutionOrder(atomizedTasks.tasks, atomizedTasks.dependencies),
        parallel: atomizedTasks.executionMatrix.parallelGroups,
        criticalPath: atomizedTasks.executionMatrix.criticalPath,
        optimization: this.calculateOptimizedExecution(atomizedTasks)
      };
    } else {
      // Fallback al método legacy
      return {
        sequential: this.calculateExecutionOrder(atomizedTasks.tasks, atomizedTasks.dependencies),
        parallel: this.detectParallelTasks(atomizedTasks.tasks, atomizedTasks.dependencies),
        criticalPath: this.calculateCriticalPath(atomizedTasks.tasks, atomizedTasks.dependencies),
        optimization: null
      };
    }
  }

  /**
   * Calcula el orden de ejecución basado en dependencias
   */
  calculateExecutionOrder(tasks, dependencies = []) {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const dependencyMap = new Map();
    
    // Construir mapa de dependencias
    dependencies.forEach(dep => {
      dependencyMap.set(dep.taskId, dep.dependsOn);
    });
    
    const visited = new Set();
    const executionOrder = [];
    
    const visit = (taskId) => {
      if (visited.has(taskId)) return;
      
      const deps = dependencyMap.get(taskId) || [];
      deps.forEach(depId => visit(depId));
      
      visited.add(taskId);
      executionOrder.push(taskMap.get(taskId));
    };
    
    tasks.forEach(task => visit(task.id));
    
    return executionOrder;
  }

  /**
   * Detecta tareas que pueden ejecutarse en paralelo
   */
  detectParallelTasks(tasks, dependencies = []) {
    const dependencyMap = new Map();
    dependencies.forEach(dep => {
      dependencyMap.set(dep.taskId, dep.dependsOn);
    });

    const groups = [];
    const processed = new Set();
    
    tasks.forEach(task => {
      if (processed.has(task.id)) return;
      
      const deps = dependencyMap.get(task.id) || [];
      const canRunInParallel = deps.every(depId => processed.has(depId));
      
      if (canRunInParallel) {
        // Buscar otras tareas que puedan ejecutarse en el mismo grupo
        const parallelGroup = [task.id];
        tasks.forEach(otherTask => {
          if (otherTask.id !== task.id && !processed.has(otherTask.id)) {
            const otherDeps = dependencyMap.get(otherTask.id) || [];
            const otherCanRun = otherDeps.every(depId => processed.has(depId));
            if (otherCanRun) {
              parallelGroup.push(otherTask.id);
            }
          }
        });
        
        groups.push(parallelGroup);
        parallelGroup.forEach(id => processed.add(id));
      }
    });
    
    return groups;
  }

  /**
   * Calcula el camino crítico del proyecto
   */
  calculateCriticalPath(tasks, dependencies = []) {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const dependencyMap = new Map();
    
    dependencies.forEach(dep => {
      dependencyMap.set(dep.taskId, dep.dependsOn);
    });

    // Calcular duración en minutos para cada tarea
    const getTaskDuration = (task) => {
      const timeStr = task.estimatedTime || '30min';
      if (timeStr.includes('min')) return parseInt(timeStr);
      if (timeStr.includes('hour')) return parseInt(timeStr) * 60;
      return 30; // default
    };

    // Encontrar el camino más largo
    const calculatePath = (taskId, visited = new Set()) => {
      if (visited.has(taskId)) return { duration: 0, path: [] };
      
      visited.add(taskId);
      const task = taskMap.get(taskId);
      const deps = dependencyMap.get(taskId) || [];
      
      let maxDuration = 0;
      let longestPath = [];
      
      deps.forEach(depId => {
        const result = calculatePath(depId, new Set(visited));
        if (result.duration > maxDuration) {
          maxDuration = result.duration;
          longestPath = result.path;
        }
      });
      
      const currentDuration = getTaskDuration(task);
      return {
        duration: maxDuration + currentDuration,
        path: [...longestPath, taskId]
      };
    };

    let criticalPath = [];
    let maxDuration = 0;
    
    tasks.forEach(task => {
      const result = calculatePath(task.id);
      if (result.duration > maxDuration) {
        maxDuration = result.duration;
        criticalPath = result.path;
      }
    });
    
    return criticalPath;
  }

  /**
   * Calcula la ejecución optimizada
   */
  calculateOptimizedExecution(atomizedTasks) {
    const matrix = atomizedTasks.executionMatrix;
    if (!matrix) return null;

    const totalSequentialTime = this.estimateSequentialTime(atomizedTasks.tasks);
    const totalParallelTime = this.estimateParallelTime(matrix.parallelGroups, atomizedTasks.tasks);
    
    return {
      sequentialTime: totalSequentialTime,
      parallelTime: totalParallelTime,
      speedup: totalSequentialTime / totalParallelTime,
      efficiency: (totalSequentialTime / totalParallelTime) / atomizedTasks.tasks.length
    };
  }

  /**
   * Estima tiempo de ejecución secuencial
   */
  estimateSequentialTime(tasks) {
    return tasks.reduce((total, task) => {
      const timeStr = task.estimatedTime || '30min';
      if (timeStr.includes('min')) return total + parseInt(timeStr);
      if (timeStr.includes('hour')) return total + (parseInt(timeStr) * 60);
      return total + 30;
    }, 0);
  }

  /**
   * Estima tiempo de ejecución paralela
   */
  estimateParallelTime(parallelGroups, tasks) {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    
    return parallelGroups.reduce((total, group) => {
      const groupTime = Math.max(...group.map(taskId => {
        const task = taskMap.get(taskId);
        const timeStr = task?.estimatedTime || '30min';
        if (timeStr.includes('min')) return parseInt(timeStr);
        if (timeStr.includes('hour')) return parseInt(timeStr) * 60;
        return 30;
      }));
      return total + groupTime;
    }, 0);
  }

  /**
   * Calcula los costos para Claude CLI (gratis con Pro plan)
   */
  calculateCLICosts(atomizedTasks) {
    // Claude CLI usage is free with Pro plan
    const taskCosts = atomizedTasks.tasks.map(task => {
      const estimatedCost = 0; // Free with Pro plan
      return {
        taskId: task.id,
        estimatedCost: estimatedCost,
        category: task.category,
        complexity: task.complexity
      };
    });

    return {
      atomization: {
        tokens: { input: 0, output: 0, total: 0 },
        cost: { input: 0, output: 0, total: 0 },
        method: 'Claude CLI (Pro Plan - Free)'
      },
      tasks: {
        individual: taskCosts,
        total: 0, // Free with Pro plan
        byCategory: this.groupCostsByCategory(taskCosts),
        byComplexity: this.groupCostsByComplexity(taskCosts)
      },
      project: {
        totalEstimated: 0, // Free with Pro plan
        breakdown: {
          planning: 0,
          execution: 0
        },
        savings: 'Using Claude CLI with Pro plan - No API costs!'
      }
    };
  }

  /**
   * Agrupa costos por categoría
   */
  groupCostsByCategory(taskCosts) {
    return taskCosts.reduce((groups, task) => {
      const category = task.category || 'unknown';
      if (!groups[category]) {
        groups[category] = { count: 0, cost: 0 };
      }
      groups[category].count++;
      groups[category].cost += task.estimatedCost;
      return groups;
    }, {});
  }

  /**
   * Agrupa costos por complejidad
   */
  groupCostsByComplexity(taskCosts) {
    return taskCosts.reduce((groups, task) => {
      const complexity = task.complexity || 'medium';
      if (!groups[complexity]) {
        groups[complexity] = { count: 0, cost: 0 };
      }
      groups[complexity].count++;
      groups[complexity].cost += task.estimatedCost;
      return groups;
    }, {});
  }

  /**
   * Re-atomiza una tarea específica si es demasiado compleja
   */
  async reAtomizeTask(task, reason = 'Task too complex') {
    const prompt = `Re-atomiza esta tarea en subtareas más pequeñas:

TAREA ORIGINAL:
${JSON.stringify(task, null, 2)}

RAZÓN: ${reason}

Devuelve 2-4 subtareas más específicas que mantengan la misma funcionalidad.`;

    try {
      // Execute Claude CLI with --print for non-interactive output
      const claudeCommand = `echo ${JSON.stringify(prompt)} | claude --print --permission-mode bypassPermissions`;
      const { stdout } = await execAsync(claudeCommand, {
        shell: true,
        timeout: 60000 // 1 minute timeout
      });
      
      return this.parseAtomizedResponse(stdout);
    } catch (error) {
      throw new Error(`Re-atomization failed: ${error.message}`);
    }
  }

  /**
   * API fallback for VPS where CLI auth is problematic
   */
  async executeViaAPI(prompt) {
    const Anthropic = require('@anthropic-ai/sdk');
    
    const anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY
    });

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return response.content[0].text;
      
    } catch (error) {
      throw new Error(`Claude API failed: ${error.message}`);
    }
  }
}

module.exports = TaskAtomizerCLIIntegrated;