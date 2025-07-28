const Anthropic = require('@anthropic-ai/sdk');

class TaskAtomizer {
  constructor(apiKey) {
    this.anthropic = new Anthropic({
      apiKey: apiKey
    });
  }

  /**
   * Atomiza un proyecto complejo en tareas ejecutables independientes
   * @param {string} projectDescription - Descripción completa del proyecto
   * @param {Object} options - Opciones adicionales para la atomización
   * @returns {Promise<Object>} - Tareas atomizadas con dependencias
   */
  async atomizeProject(projectDescription, options = {}) {
    const {
      maxTasks = 20,
      complexity = 'medium',
      techStack = 'auto-detect'
    } = options;

    const systemPrompt = this.buildAtomizationPrompt(maxTasks, complexity, techStack);
    
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.1,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Atomiza este proyecto en tareas ejecutables independientes:

${projectDescription}

Devuelve ÚNICAMENTE el JSON sin explicaciones adicionales.`
          }
        ]
      });

      const content = response.content[0].text;
      const atomizedTasks = this.parseAtomizedResponse(content);
      
      // Validar estructura y dependencias
      this.validateAtomizedTasks(atomizedTasks);
      
      // Calcular costos de la operación
      const costs = this.calculateCosts(response.usage);
      
      return {
        success: true,
        project: {
          title: atomizedTasks.project.title,
          description: projectDescription,
          estimatedDuration: atomizedTasks.project.estimatedDuration,
          complexity: atomizedTasks.project.complexity
        },
        tasks: atomizedTasks.tasks,
        dependencies: atomizedTasks.dependencies,
        executionOrder: this.calculateExecutionOrder(atomizedTasks.tasks, atomizedTasks.dependencies),
        costs: costs,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error atomizing project:', error);
      throw new Error(`Task atomization failed: ${error.message}`);
    }
  }

  /**
   * Construye el prompt del sistema para atomización
   */
  buildAtomizationPrompt(maxTasks, complexity, techStack) {
    return `Eres un experto en descomposición de proyectos de software en tareas atómicas ejecutables.

OBJETIVO: Analizar la descripción del proyecto y atomizarlo en tareas independientes que puedan ser ejecutadas por agentes Docker autónomos.

REGLAS DE ATOMIZACIÓN:
1. Cada tarea debe ser completamente independiente y ejecutable por separado
2. Una tarea NO puede depender de archivos o estado creado por otra tarea
3. Máximo ${maxTasks} tareas total
4. Cada tarea debe incluir TODOS los archivos/dependencias que necesita
5. Las dependencias deben ser explícitas y verificables
6. Priorizar tareas que se pueden paralelizar

FORMATO DE RESPUESTA (JSON estricto):
{
  "project": {
    "title": "Nombre del proyecto",
    "complexity": "low|medium|high",
    "estimatedDuration": "1-2 hours|1-2 days|1-2 weeks",
    "techStack": ["tecnologías", "detectadas"]
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
      "complexity": "low|medium|high",
      "category": "setup|development|testing|deployment|documentation"
    }
  ],
  "dependencies": [
    {
      "taskId": "task_2",
      "dependsOn": ["task_1"],
      "reason": "Necesita los archivos generados por task_1"
    }
  ]
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
- Las dependencias deben ser mínimas y claras`;
  }

  /**
   * Parsea la respuesta de Claude y valida el JSON
   */
  parseAtomizedResponse(content) {
    try {
      // Limpiar el contenido y extraer solo el JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
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
   * Valida la estructura de las tareas atomizadas
   */
  validateAtomizedTasks(atomizedTasks) {
    if (!atomizedTasks.project || !atomizedTasks.tasks) {
      throw new Error('Invalid atomized structure: missing project or tasks');
    }

    if (!Array.isArray(atomizedTasks.tasks) || atomizedTasks.tasks.length === 0) {
      throw new Error('No tasks generated');
    }

    // Validar cada tarea
    atomizedTasks.tasks.forEach((task, index) => {
      if (!task.id || !task.title || !task.description) {
        throw new Error(`Task ${index} missing required fields`);
      }
      
      if (!task.dockerCommand) {
        throw new Error(`Task ${task.id} missing dockerCommand`);
      }
    });

    // Validar dependencias
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
   * Calcula los costos de la operación de atomización
   */
  calculateCosts(usage) {
    if (!usage) return { tokens: 0, cost: 0 };
    
    // Precios aproximados de Claude 3.5 Sonnet (por 1K tokens)
    const inputCostPer1K = 0.003;  // $0.003 per 1K input tokens
    const outputCostPer1K = 0.015; // $0.015 per 1K output tokens
    
    const inputCost = (usage.input_tokens / 1000) * inputCostPer1K;
    const outputCost = (usage.output_tokens / 1000) * outputCostPer1K;
    
    return {
      tokens: {
        input: usage.input_tokens,
        output: usage.output_tokens,
        total: usage.input_tokens + usage.output_tokens
      },
      cost: {
        input: inputCost,
        output: outputCost,
        total: inputCost + outputCost
      }
    };
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
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }]
      });

      return this.parseAtomizedResponse(response.content[0].text);
    } catch (error) {
      throw new Error(`Re-atomization failed: ${error.message}`);
    }
  }
}

module.exports = TaskAtomizer;