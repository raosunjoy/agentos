/**
 * Workflow Registry for AgentOS
 * Manages workflow definitions and validation
 */

import { WorkflowDefinition, WorkflowStep } from './types';

export class WorkflowRegistry {
  private workflows = new Map<string, WorkflowDefinition>();
  private workflowVersions = new Map<string, Map<string, WorkflowDefinition>>();

  /**
   * Register a workflow definition
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.validateWorkflow(workflow);
    
    this.workflows.set(workflow.workflowId, workflow);
    
    // Store versioned workflow
    if (!this.workflowVersions.has(workflow.workflowId)) {
      this.workflowVersions.set(workflow.workflowId, new Map());
    }
    this.workflowVersions.get(workflow.workflowId)!.set(workflow.version, workflow);
  }

  /**
   * Get workflow by ID (latest version)
   */
  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get specific workflow version
   */
  getWorkflowVersion(workflowId: string, version: string): WorkflowDefinition | undefined {
    return this.workflowVersions.get(workflowId)?.get(version);
  }

  /**
   * List all registered workflows
   */
  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Remove workflow
   */
  removeWorkflow(workflowId: string): boolean {
    const removed = this.workflows.delete(workflowId);
    this.workflowVersions.delete(workflowId);
    return removed;
  }

  /**
   * Validate workflow definition
   */
  private validateWorkflow(workflow: WorkflowDefinition): void {
    if (!workflow.workflowId) {
      throw new Error('Workflow must have an ID');
    }

    if (!workflow.name) {
      throw new Error('Workflow must have a name');
    }

    if (!workflow.version) {
      throw new Error('Workflow must have a version');
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    // Validate step IDs are unique
    const stepIds = new Set<string>();
    for (const step of workflow.steps) {
      if (stepIds.has(step.stepId)) {
        throw new Error(`Duplicate step ID: ${step.stepId}`);
      }
      stepIds.add(step.stepId);
    }

    // Validate dependencies exist
    for (const step of workflow.steps) {
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          if (!stepIds.has(depId)) {
            throw new Error(`Step ${step.stepId} depends on non-existent step: ${depId}`);
          }
        }
      }
    }

    // Check for circular dependencies
    this.validateNoCycles(workflow.steps);
  }

  /**
   * Validate no circular dependencies using DFS
   */
  private validateNoCycles(steps: WorkflowStep[]): void {
    const stepMap = new Map(steps.map(step => [step.stepId, step]));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (recursionStack.has(stepId)) {
        return true; // Cycle detected
      }

      if (visited.has(stepId)) {
        return false; // Already processed
      }

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = stepMap.get(stepId);
      if (step?.dependencies) {
        for (const depId of step.dependencies) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of steps) {
      if (!visited.has(step.stepId)) {
        if (hasCycle(step.stepId)) {
          throw new Error('Circular dependency detected in workflow');
        }
      }
    }
  }

  /**
   * Create workflow from JSON
   */
  static fromJSON(json: string): WorkflowDefinition {
    try {
      const workflow = JSON.parse(json) as WorkflowDefinition;
      return workflow;
    } catch (error) {
      throw new Error(`Invalid workflow JSON: ${error.message}`);
    }
  }

  /**
   * Convert workflow to JSON
   */
  static toJSON(workflow: WorkflowDefinition): string {
    return JSON.stringify(workflow, null, 2);
  }
}