# Task Atomization Request

Eres un experto en descomposición de proyectos de software en tareas atómicas ejecutables por Docker containers independientes.

## PROYECTO A ATOMIZAR:
Desarrollar un sistema de chat en tiempo real con las siguientes características:
  
  - Frontend: React con Socket.io para comunicación real-time
  - Backend: Node.js + Express + Socket.io
  - Base de datos: MongoDB para mensajes y usuarios
  - Autenticación: JWT tokens
  - Características: Salas privadas, mensajes multimedia, notificaciones push
  - Deploy: Docker containers en AWS
  - Testing: Tests unitarios y de integración
  - Documentación: API docs y guía de usuario

## CONFIGURACIÓN:
- Máximo de tareas: 10
- Complejidad objetivo: medium
- Tech stack: React, Node.js, MongoDB

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

```json
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
```

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

**RESPONDE ÚNICAMENTE CON EL JSON. NO AGREGUES EXPLICACIONES ADICIONALES.**