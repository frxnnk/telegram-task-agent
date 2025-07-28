const { BaseMessage } = require('@langchain/core/messages');

class TaskState {
  constructor() {
    this.projectId = null;
    this.projectDescription = '';
    this.atomizedTasks = [];
    this.currentTask = null;
    this.executionGraph = {};
    this.completedTasks = [];
    this.failedTasks = [];
    this.totalCost = 0;
    this.status = 'idle'; // idle, atomizing, executing, paused, completed, failed
    this.messages = [];
    this.dockerContainers = {};
    this.startTime = null;
    this.endTime = null;
  }

  // Métodos para actualizar estado
  setProject(id, description) {
    this.projectId = id;
    this.projectDescription = description;
    this.startTime = new Date();
    this.status = 'atomizing';
  }

  setAtomizedTasks(tasks) {
    this.atomizedTasks = tasks;
    this.executionGraph = this.buildExecutionGraph(tasks);
  }

  buildExecutionGraph(tasks) {
    const graph = {};
    tasks.forEach(task => {
      graph[task.id] = {
        ...task,
        dependencies: task.dependencies || [],
        dependents: [],
        status: 'pending'
      };
    });

    // Construir dependientes
    Object.values(graph).forEach(task => {
      task.dependencies.forEach(depId => {
        if (graph[depId]) {
          graph[depId].dependents.push(task.id);
        }
      });
    });

    return graph;
  }

  getReadyTasks() {
    return Object.values(this.executionGraph).filter(task => 
      task.status === 'pending' && 
      task.dependencies.every(depId => 
        this.executionGraph[depId]?.status === 'completed'
      )
    );
  }

  startTask(taskId) {
    if (this.executionGraph[taskId]) {
      this.executionGraph[taskId].status = 'running';
      this.executionGraph[taskId].startTime = new Date();
      this.currentTask = taskId;
    }
  }

  completeTask(taskId, result = {}) {
    if (this.executionGraph[taskId]) {
      this.executionGraph[taskId].status = 'completed';
      this.executionGraph[taskId].endTime = new Date();
      this.executionGraph[taskId].result = result;
      this.completedTasks.push(taskId);
      
      if (this.currentTask === taskId) {
        this.currentTask = null;
      }
    }
  }

  failTask(taskId, error) {
    if (this.executionGraph[taskId]) {
      this.executionGraph[taskId].status = 'failed';
      this.executionGraph[taskId].endTime = new Date();
      this.executionGraph[taskId].error = error;
      this.failedTasks.push(taskId);
      
      if (this.currentTask === taskId) {
        this.currentTask = null;
      }
    }
  }

  pauseExecution() {
    this.status = 'paused';
    if (this.currentTask) {
      this.executionGraph[this.currentTask].status = 'paused';
    }
  }

  resumeExecution() {
    this.status = 'executing';
    if (this.currentTask) {
      this.executionGraph[this.currentTask].status = 'running';
    }
  }

  addMessage(message) {
    this.messages.push({
      timestamp: new Date(),
      content: message
    });
  }

  updateCost(additionalCost) {
    this.totalCost += additionalCost;
  }

  setDockerContainer(taskId, containerId) {
    this.dockerContainers[taskId] = containerId;
  }

  getProgress() {
    const total = this.atomizedTasks.length;
    const completed = this.completedTasks.length;
    const failed = this.failedTasks.length;
    const running = this.currentTask ? 1 : 0;
    
    return {
      total,
      completed,
      failed,
      running,
      pending: total - completed - failed - running,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  isCompleted() {
    return this.completedTasks.length === this.atomizedTasks.length;
  }

  hasFailed() {
    return this.failedTasks.length > 0;
  }

  // Serialización para checkpoints
  toJSON() {
    return {
      projectId: this.projectId,
      projectDescription: this.projectDescription,
      atomizedTasks: this.atomizedTasks,
      currentTask: this.currentTask,
      executionGraph: this.executionGraph,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      totalCost: this.totalCost,
      status: this.status,
      messages: this.messages,
      dockerContainers: this.dockerContainers,
      startTime: this.startTime,
      endTime: this.endTime
    };
  }

  static fromJSON(data) {
    const state = new TaskState();
    Object.assign(state, data);
    return state;
  }
}

module.exports = { TaskState };