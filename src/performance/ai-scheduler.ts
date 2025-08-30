/**
 * Power-Efficient AI Operations Scheduler
 * Optimizes AI workload scheduling for battery life and performance
 */

import { 
  ResourceMetrics, 
  PerformanceMode, 
  ThermalState,
  SchedulingPolicy 
} from './types';

export interface AITask {
  id: string;
  type: 'inference' | 'training' | 'preprocessing' | 'postprocessing';
  priority: number; // 1-10
  estimatedDuration: number; // ms
  resourceRequirements: {
    cpu: number;
    memory: number;
    gpu?: number;
  };
  deadline?: number; // timestamp
  canPreempt: boolean;
  powerSensitive: boolean;
}

export interface ScheduledTask extends AITask {
  scheduledTime: number;
  estimatedCompletion: number;
  actualStartTime?: number;
  actualDuration?: number;
  preemptionCount: number;
}

export interface SchedulingStats {
  tasksCompleted: number;
  averageLatency: number;
  powerEfficiency: number;
  deadlinesMissed: number;
  preemptions: number;
}

export class AIScheduler {
  private taskQueue: ScheduledTask[] = [];
  private runningTasks: Map<string, ScheduledTask> = new Map();
  private completedTasks: ScheduledTask[] = [];
  private schedulingPolicy: SchedulingPolicy;
  private currentMetrics: ResourceMetrics;
  private performanceMode: PerformanceMode = PerformanceMode.ADAPTIVE;
  private schedulingInterval: NodeJS.Timeout | null = null;
  private stats: SchedulingStats;

  constructor(policy: SchedulingPolicy) {
    this.schedulingPolicy = policy;
    this.currentMetrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      batteryLevel: 100,
      thermalState: ThermalState.NORMAL,
      networkLatency: 50
    };
    this.stats = {
      tasksCompleted: 0,
      averageLatency: 0,
      powerEfficiency: 1.0,
      deadlinesMissed: 0,
      preemptions: 0
    };
    this.startScheduler();
  }

  /**
   * Schedule an AI task
   */
  scheduleTask(task: AITask): string {
    const scheduledTask: ScheduledTask = {
      ...task,
      scheduledTime: this.calculateScheduleTime(task),
      estimatedCompletion: 0,
      preemptionCount: 0
    };

    scheduledTask.estimatedCompletion = scheduledTask.scheduledTime + task.estimatedDuration;

    this.insertTaskInQueue(scheduledTask);
    return task.id;
  }

  /**
   * Cancel a scheduled task
   */
  cancelTask(taskId: string): boolean {
    // Remove from queue
    const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
      return true;
    }

    // Preempt running task
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      this.preemptTask(taskId);
      return true;
    }

    return false;
  }

  /**
   * Update system metrics for scheduling decisions
   */
  updateMetrics(metrics: ResourceMetrics): void {
    this.currentMetrics = metrics;
    this.adjustSchedulingForMetrics();
  }

  /**
   * Update performance mode
   */
  updatePerformanceMode(mode: PerformanceMode): void {
    this.performanceMode = mode;
    this.rebalanceSchedule();
  }

  /**
   * Get scheduling statistics
   */
  getStats(): SchedulingStats {
    return { ...this.stats };
  }

  /**
   * Calculate optimal schedule time for a task
   */
  private calculateScheduleTime(task: AITask): number {
    const now = Date.now();
    
    // Immediate scheduling for high priority tasks
    if (task.priority >= 8) {
      return now;
    }

    // Power-sensitive tasks scheduled during optimal times
    if (task.powerSensitive) {
      return this.findOptimalPowerWindow(task, now);
    }

    // Deadline-driven scheduling
    if (task.deadline) {
      const latestStart = task.deadline - task.estimatedDuration;
      return Math.max(now, latestStart - (task.estimatedDuration * 0.5));
    }

    // Default scheduling based on queue and resources
    return this.findNextAvailableSlot(task, now);
  }

  /**
   * Find optimal power window for power-sensitive tasks
   */
  private findOptimalPowerWindow(task: AITask, startTime: number): number {
    const windowSize = 30 * 60 * 1000; // 30 minutes
    const windows = 8; // Check next 4 hours
    
    let bestWindow = startTime;
    let bestScore = this.calculatePowerScore(startTime);

    for (let i = 1; i < windows; i++) {
      const windowStart = startTime + (i * windowSize);
      const score = this.calculatePowerScore(windowStart);
      
      if (score > bestScore) {
        bestScore = score;
        bestWindow = windowStart;
      }
    }

    return bestWindow;
  }

  /**
   * Calculate power efficiency score for a time window
   */
  private calculatePowerScore(timestamp: number): number {
    let score = 1.0;

    // Prefer times when battery is higher
    if (this.currentMetrics.batteryLevel > 50) {
      score += 0.3;
    } else if (this.currentMetrics.batteryLevel < 20) {
      score -= 0.5;
    }

    // Avoid high thermal states
    switch (this.currentMetrics.thermalState) {
      case ThermalState.HOT:
        score -= 0.4;
        break;
      case ThermalState.CRITICAL:
        score -= 0.8;
        break;
    }

    // Prefer lower CPU usage times
    if (this.currentMetrics.cpuUsage < 30) {
      score += 0.2;
    } else if (this.currentMetrics.cpuUsage > 70) {
      score -= 0.3;
    }

    // Time-based preferences (avoid peak usage hours)
    const hour = new Date(timestamp).getHours();
    if (hour >= 2 && hour <= 6) { // Night hours
      score += 0.2;
    } else if (hour >= 9 && hour <= 17) { // Work hours
      score -= 0.1;
    }

    return Math.max(0, score);
  }

  /**
   * Find next available slot for task execution
   */
  private findNextAvailableSlot(task: AITask, startTime: number): number {
    const sortedTasks = [...this.taskQueue, ...this.runningTasks.values()]
      .sort((a, b) => a.scheduledTime - b.scheduledTime);

    let currentTime = startTime;

    for (const scheduledTask of sortedTasks) {
      if (currentTime + task.estimatedDuration <= scheduledTask.scheduledTime) {
        return currentTime;
      }
      currentTime = Math.max(currentTime, scheduledTask.estimatedCompletion);
    }

    return currentTime;
  }

  /**
   * Insert task in queue maintaining priority order
   */
  private insertTaskInQueue(task: ScheduledTask): void {
    let insertIndex = 0;
    
    for (let i = 0; i < this.taskQueue.length; i++) {
      const queuedTask = this.taskQueue[i];
      
      if (this.shouldInsertBefore(task, queuedTask)) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    this.taskQueue.splice(insertIndex, 0, task);
  }

  /**
   * Determine if task should be inserted before another task
   */
  private shouldInsertBefore(newTask: ScheduledTask, existingTask: ScheduledTask): boolean {
    // Priority-based comparison
    if (newTask.priority !== existingTask.priority) {
      return newTask.priority > existingTask.priority;
    }

    // Deadline-based comparison
    if (newTask.deadline && existingTask.deadline) {
      return newTask.deadline < existingTask.deadline;
    }

    if (newTask.deadline && !existingTask.deadline) {
      return true;
    }

    // Schedule time comparison
    return newTask.scheduledTime < existingTask.scheduledTime;
  }

  /**
   * Start the scheduler
   */
  private startScheduler(): void {
    this.schedulingInterval = setInterval(() => {
      this.processSchedule();
    }, 100); // Check every 100ms
  }

  /**
   * Process the current schedule
   */
  private processSchedule(): void {
    const now = Date.now();

    // Start ready tasks
    while (this.taskQueue.length > 0 && this.canStartTask(this.taskQueue[0], now)) {
      const task = this.taskQueue.shift()!;
      this.startTask(task, now);
    }

    // Check for completed tasks
    for (const [taskId, task] of this.runningTasks.entries()) {
      if (task.actualStartTime && 
          now - task.actualStartTime >= task.estimatedDuration) {
        this.completeTask(taskId, now);
      }
    }

    // Handle preemption if needed
    this.handlePreemption(now);
  }

  /**
   * Check if a task can be started
   */
  private canStartTask(task: ScheduledTask, currentTime: number): boolean {
    if (task.scheduledTime > currentTime) {
      return false;
    }

    // Check resource availability
    const availableResources = this.getAvailableResources();
    
    return (
      availableResources.cpu >= task.resourceRequirements.cpu &&
      availableResources.memory >= task.resourceRequirements.memory &&
      (!task.resourceRequirements.gpu || availableResources.gpu >= task.resourceRequirements.gpu)
    );
  }

  /**
   * Start executing a task
   */
  private startTask(task: ScheduledTask, startTime: number): void {
    task.actualStartTime = startTime;
    this.runningTasks.set(task.id, task);
    
    // Simulate task execution
    setTimeout(() => {
      if (this.runningTasks.has(task.id)) {
        this.completeTask(task.id, startTime + task.estimatedDuration);
      }
    }, task.estimatedDuration);
  }

  /**
   * Complete a task
   */
  private completeTask(taskId: string, completionTime: number): void {
    const task = this.runningTasks.get(taskId);
    if (!task) return;

    task.actualDuration = completionTime - (task.actualStartTime || completionTime);
    this.runningTasks.delete(taskId);
    this.completedTasks.push(task);

    // Update statistics
    this.updateStats(task);
  }

  /**
   * Preempt a running task
   */
  private preemptTask(taskId: string): void {
    const task = this.runningTasks.get(taskId);
    if (!task || !task.canPreempt) return;

    this.runningTasks.delete(taskId);
    task.preemptionCount++;
    task.actualStartTime = undefined;
    
    // Reschedule the task
    task.scheduledTime = this.calculateScheduleTime(task);
    this.insertTaskInQueue(task);
    
    this.stats.preemptions++;
  }

  /**
   * Handle preemption logic
   */
  private handlePreemption(currentTime: number): void {
    if (!this.schedulingPolicy.preemptionEnabled) return;

    // Find high-priority tasks waiting
    const waitingHighPriority = this.taskQueue.filter(task => 
      task.priority >= 8 && task.scheduledTime <= currentTime
    );

    if (waitingHighPriority.length === 0) return;

    // Find preemptable running tasks with lower priority
    const preemptableTasks = Array.from(this.runningTasks.values())
      .filter(task => task.canPreempt && task.priority < waitingHighPriority[0].priority)
      .sort((a, b) => a.priority - b.priority);

    if (preemptableTasks.length > 0) {
      this.preemptTask(preemptableTasks[0].id);
    }
  }

  /**
   * Get currently available resources
   */
  private getAvailableResources(): { cpu: number; memory: number; gpu: number } {
    const totalResources = {
      cpu: 100, // percentage
      memory: 8 * 1024 * 1024 * 1024, // 8GB
      gpu: 4 * 1024 * 1024 * 1024 // 4GB
    };

    let usedResources = {
      cpu: this.currentMetrics.cpuUsage,
      memory: this.currentMetrics.memoryUsage,
      gpu: 0
    };

    // Add resources used by running tasks
    for (const task of this.runningTasks.values()) {
      usedResources.cpu += task.resourceRequirements.cpu;
      usedResources.memory += task.resourceRequirements.memory;
      usedResources.gpu += task.resourceRequirements.gpu || 0;
    }

    return {
      cpu: Math.max(0, totalResources.cpu - usedResources.cpu),
      memory: Math.max(0, totalResources.memory - usedResources.memory),
      gpu: Math.max(0, totalResources.gpu - usedResources.gpu)
    };
  }

  /**
   * Adjust scheduling based on current metrics
   */
  private adjustSchedulingForMetrics(): void {
    // Delay power-sensitive tasks if battery is low
    if (this.currentMetrics.batteryLevel < 20) {
      this.delayPowerSensitiveTasks();
    }

    // Reduce task priorities if thermal state is high
    if (this.currentMetrics.thermalState === ThermalState.HOT) {
      this.reduceLowPriorityTasks();
    }

    // Cancel non-critical tasks if thermal state is critical
    if (this.currentMetrics.thermalState === ThermalState.CRITICAL) {
      this.cancelNonCriticalTasks();
    }
  }

  /**
   * Delay power-sensitive tasks
   */
  private delayPowerSensitiveTasks(): void {
    const delayAmount = 30 * 60 * 1000; // 30 minutes
    
    for (const task of this.taskQueue) {
      if (task.powerSensitive && task.priority < 7) {
        task.scheduledTime += delayAmount;
        task.estimatedCompletion += delayAmount;
      }
    }
  }

  /**
   * Reduce priority of low-priority tasks
   */
  private reduceLowPriorityTasks(): void {
    for (const task of this.taskQueue) {
      if (task.priority <= 3) {
        task.priority = Math.max(1, task.priority - 1);
      }
    }
    
    // Re-sort queue
    this.taskQueue.sort((a, b) => this.shouldInsertBefore(b, a) ? 1 : -1);
  }

  /**
   * Cancel non-critical tasks
   */
  private cancelNonCriticalTasks(): void {
    this.taskQueue = this.taskQueue.filter(task => task.priority >= 5);
    
    // Preempt non-critical running tasks
    for (const [taskId, task] of this.runningTasks.entries()) {
      if (task.priority < 5 && task.canPreempt) {
        this.preemptTask(taskId);
      }
    }
  }

  /**
   * Rebalance schedule based on performance mode
   */
  private rebalanceSchedule(): void {
    const modeAdjustments = {
      [PerformanceMode.POWER_SAVE]: { priorityBoost: -1, delayMultiplier: 2 },
      [PerformanceMode.BALANCED]: { priorityBoost: 0, delayMultiplier: 1 },
      [PerformanceMode.PERFORMANCE]: { priorityBoost: 1, delayMultiplier: 0.5 },
      [PerformanceMode.ADAPTIVE]: { priorityBoost: 0, delayMultiplier: 1 }
    };

    const adjustment = modeAdjustments[this.performanceMode];

    for (const task of this.taskQueue) {
      task.priority = Math.max(1, Math.min(10, task.priority + adjustment.priorityBoost));
      
      if (task.powerSensitive) {
        const delay = (task.scheduledTime - Date.now()) * adjustment.delayMultiplier;
        task.scheduledTime = Date.now() + delay;
        task.estimatedCompletion = task.scheduledTime + task.estimatedDuration;
      }
    }

    // Re-sort queue
    this.taskQueue.sort((a, b) => this.shouldInsertBefore(b, a) ? 1 : -1);
  }

  /**
   * Update scheduling statistics
   */
  private updateStats(completedTask: ScheduledTask): void {
    this.stats.tasksCompleted++;
    
    const latency = (completedTask.actualStartTime || 0) - completedTask.scheduledTime;
    this.stats.averageLatency = (this.stats.averageLatency * (this.stats.tasksCompleted - 1) + latency) / this.stats.tasksCompleted;
    
    if (completedTask.deadline && (completedTask.actualStartTime || 0) + (completedTask.actualDuration || 0) > completedTask.deadline) {
      this.stats.deadlinesMissed++;
    }

    // Update power efficiency based on task completion vs resource usage
    const efficiency = completedTask.estimatedDuration / (completedTask.actualDuration || completedTask.estimatedDuration);
    this.stats.powerEfficiency = (this.stats.powerEfficiency * 0.9) + (efficiency * 0.1);
  }

  /**
   * Cleanup scheduler
   */
  destroy(): void {
    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
      this.schedulingInterval = null;
    }
    
    this.taskQueue = [];
    this.runningTasks.clear();
    this.completedTasks = [];
  }
}