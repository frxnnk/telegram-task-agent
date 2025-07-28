const fs = require('fs');
const path = require('path');

class TaskAtomizerCLI {
  constructor() {
    this.promptsDir = path.join(__dirname, 'prompts');
    this.ensurePromptsDir();
  }

  ensurePromptsDir() {
    if (!fs.existsSync(this.promptsDir)) {
      fs.mkdirSync(this.promptsDir, { recursive: true });
    }
  }

  /**
   * Genera prompt optimizado para Claude CLI y guía al usuario
   * @param {string} projectDescription - Descripción completa del proyecto
   * @param {Object} options - Opciones adicionales para la atomización
   * @returns {Object} - Instrucciones y prompt para Claude CLI
   */
  generateAtomizationPrompt(projectDescription, options = {}) {
    const {
      maxTasks = 15,
      complexity = 'medium',
      techStack = 'auto-detect'
    } = options;

    const prompt = this.buildAtomizationPrompt(projectDescription, maxTasks, complexity, techStack);
    const promptFile = this.savePromptToFile(prompt, projectDescription);
    
    return {
      promptFile,
      prompt,
      instructions: this.generateInstructions(promptFile),
      cliCommand: `claude --file="${promptFile}"`,
      nextSteps: [
        '1. Ejecuta el comando Claude CLI mostrado arriba',
        '2. Copia la respuesta JSON completa',
        '3. Llama a parseAtomizedResponse() con la respuesta',
        '4. El sistema validará y procesará las tareas'
      ]
    };
  }

  /**
   * Construye el prompt optimizado para Claude CLI
   */
  buildAtomizationPrompt(projectDescription, maxTasks, complexity, techStack) {
    return `# Task Atomization Request

Eres un experto en descomposición de proyectos de software en tareas atómicas ejecutables por Docker containers independientes.

## PROYECTO A ATOMIZAR:
${projectDescription}

## CONFIGURACIÓN:
- Máximo de tareas: ${maxTasks}
- Complejidad objetivo: ${complexity}
- Tech stack: ${techStack}

## REGLAS CRÍTICAS DE ATOMIZACIÓN:

### 1. INDEPENDENCIA TOTAL
- Cada tarea debe ser 100% independiente
- NO puede depender de archivos generados por otras tareas
- Debe incluir TODOS los archivos/dependencias que necesita
- Si necesita algo de otra tarea, debe ser una dependencia explícita

### 2. EJECUTABILIDAD DOCKER
- Cada tarea debe tener un comando Docker específico y ejecutable
- El comando debe ser completo y funcional
- Debe generar outputs verificables

### 3. ESTRUCTURA DE DEPENDENCIAS
- Las dependencias deben ser mínimas y justificadas
- Priorizar tareas que se puedan ejecutar en paralelo
- Orden de ejecución debe ser lógico y eficiente

## FORMATO DE RESPUESTA (JSON ÚNICAMENTE):

\`\`\`json
{
  "project": {
    "title": "Nombre descriptivo del proyecto",
    "complexity": "low|medium|high",
    "estimatedDuration": "2 hours|1 day|3 days|1 week|2 weeks",
    "techStack": ["Node.js", "Docker", "SQLite"],
    "description": "Resumen de qué hace el proyecto"
  },
  "tasks": [
    {
      "id": "task_1",
      "title": "Título claro y específico",
      "description": "Descripción detallada de QUÉ hacer exactamente",
      "dockerCommand": "comando Docker completo y ejecutable",
      "requiredFiles": ["archivo1.js", "config.json"],
      "outputFiles": ["resultado.js", "build/dist.js"],
      "estimatedTime": "15min|30min|1hour|2hours",
      "complexity": "low|medium|high",
      "category": "setup|development|testing|deployment|documentation",
      "validation": "Como verificar que la tarea se completó correctamente"
    }
  ],
  "dependencies": [
    {
      "taskId": "task_2",
      "dependsOn": ["task_1"],
      "reason": "Explicación clara de por qué necesita task_1"
    }
  ]
}
\`\`\`

## CATEGORÍAS DE TAREAS:
- **setup**: Configuración inicial, dependencias, estructura
- **development**: Implementación de código, features, lógica
- **testing**: Tests unitarios, integración, validación
- **deployment**: Build, containerización, CI/CD
- **documentation**: README, docs, comentarios

## CRITERIOS DE CALIDAD:
1. ✅ Cada tarea es completamente independiente
2. ✅ Los comandos Docker son ejecutables y específicos
3. ✅ Las dependencias están justificadas y son mínimas
4. ✅ El orden de ejecución es óptimo
5. ✅ Los outputs son verificables

**RESPONDE ÚNICAMENTE CON EL JSON. NO AGREGUES EXPLICACIONES ADICIONALES.**`;
  }

  /**
   * Guarda el prompt en un archivo para usar con Claude CLI
   */
  savePromptToFile(prompt, projectDescription) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const projectName = projectDescription.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-');
    const filename = `atomize-${projectName}-${timestamp}.md`;
    const filepath = path.join(this.promptsDir, filename);
    
    fs.writeFileSync(filepath, prompt, 'utf8');
    return filepath;
  }

  /**
   * Genera instrucciones claras para el usuario
   */
  generateInstructions(promptFile) {
    return `
🤖 INSTRUCCIONES PARA ATOMIZACIÓN CON CLAUDE CLI:

1. 📁 Prompt generado en: ${promptFile}

2. 🚀 Ejecuta Claude CLI:
   claude --file="${promptFile}"

   O alternativamente:
   claude < "${promptFile}"

3. 📋 Copia la respuesta JSON completa (solo el JSON, sin explicaciones)

4. 🔄 Llama a parseAtomizedResponse() con la respuesta:
   const result = atomizer.parseAtomizedResponse(claudeResponse);

5. ✅ El sistema validará y procesará automáticamente las tareas

VENTAJAS vs API:
✅ $0 costo (usa tu suscripción Claude)
✅ Mejor calidad y contexto
✅ Control total del proceso
✅ No necesita API keys
`;
  }

  /**
   * Parsea la respuesta de Claude CLI y valida el JSON
   */
  parseAtomizedResponse(claudeResponse) {
    try {
      // Limpiar la respuesta y extraer solo el JSON
      let cleanResponse = claudeResponse.trim();
      
      // Remover markdown code blocks si existen
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\n/, '').replace(/\n```$/, '');
      }
      
      // Extraer JSON del contenido
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in Claude response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validar estructura
      this.validateAtomizedTasks(parsed);
      
      // Procesar y retornar resultado completo
      return this.processAtomizedResult(parsed);
      
    } catch (error) {
      console.error('❌ Failed to parse Claude CLI response');
      console.error('Raw response:', claudeResponse);
      throw new Error(`Invalid Claude CLI response: ${error.message}`);
    }
  }

  /**
   * Procesa el resultado atomizado y calcula orden de ejecución
   */
  processAtomizedResult(atomizedTasks) {
    const executionOrder = this.calculateExecutionOrder(atomizedTasks.tasks, atomizedTasks.dependencies);
    
    return {
      success: true,
      project: atomizedTasks.project,
      tasks: atomizedTasks.tasks,
      dependencies: atomizedTasks.dependencies || [],
      executionOrder: executionOrder,
      costs: {
        tokens: { total: 0 },
        cost: { total: 0 },
        note: 'Using Claude CLI - $0 cost with subscription'
      },
      timestamp: new Date().toISOString(),
      source: 'claude-cli'
    };
  }

  /**
   * Valida la estructura de las tareas atomizadas
   */
  validateAtomizedTasks(atomizedTasks) {
    if (!atomizedTasks.project || !atomizedTasks.tasks) {
      throw new Error('Invalid structure: missing project or tasks');
    }

    if (!Array.isArray(atomizedTasks.tasks) || atomizedTasks.tasks.length === 0) {
      throw new Error('No tasks generated');
    }

    // Validar cada tarea
    atomizedTasks.tasks.forEach((task, index) => {
      const required = ['id', 'title', 'description', 'dockerCommand'];
      required.forEach(field => {
        if (!task[field]) {
          throw new Error(`Task ${index + 1} missing required field: ${field}`);
        }
      });
    });

    // Validar dependencias
    if (atomizedTasks.dependencies) {
      const taskIds = atomizedTasks.tasks.map(t => t.id);
      atomizedTasks.dependencies.forEach(dep => {
        if (!taskIds.includes(dep.taskId)) {
          throw new Error(`Dependency references unknown task: ${dep.taskId}`);
        }
        if (dep.dependsOn) {
          dep.dependsOn.forEach(depId => {
            if (!taskIds.includes(depId)) {
              throw new Error(`Dependency references unknown task: ${depId}`);
            }
          });
        }
      });
    }

    console.log('✅ Task structure validation passed');
  }

  /**
   * Calcula el orden de ejecución basado en dependencias
   */
  calculateExecutionOrder(tasks, dependencies = []) {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const dependencyMap = new Map();
    
    // Construir mapa de dependencias
    dependencies.forEach(dep => {
      dependencyMap.set(dep.taskId, dep.dependsOn || []);
    });
    
    const visited = new Set();
    const visiting = new Set();
    const executionOrder = [];
    
    const visit = (taskId) => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected involving task: ${taskId}`);
      }
      
      visiting.add(taskId);
      const deps = dependencyMap.get(taskId) || [];
      deps.forEach(depId => visit(depId));
      visiting.delete(taskId);
      
      visited.add(taskId);
      executionOrder.push(taskMap.get(taskId));
    };
    
    tasks.forEach(task => visit(task.id));
    
    return executionOrder;
  }

  /**
   * Genera una demo interactiva del flujo completo
   */
  generateDemo(projectDescription = "Crear una API REST para manejo de tareas con autenticación JWT y base de datos SQLite") {
    console.log('🎯 DEMO: Task Atomizer CLI\n');
    
    const result = this.generateAtomizationPrompt(projectDescription, {
      maxTasks: 8,
      complexity: 'medium'
    });
    
    console.log('📝 Prompt generado exitosamente');
    console.log('📁 Archivo:', result.promptFile);
    console.log('\n' + '='.repeat(60));
    console.log(result.instructions);
    console.log('='.repeat(60));
    
    console.log('\n🔍 Vista previa del prompt:');
    console.log(result.prompt.slice(0, 200) + '...\n');
    
    console.log('🚀 SIGUIENTE PASO:');
    console.log(`   Ejecuta: ${result.cliCommand}`);
    console.log('   Luego usa parseAtomizedResponse() con la respuesta\n');
    
    return result;
  }
}

module.exports = TaskAtomizerCLI;