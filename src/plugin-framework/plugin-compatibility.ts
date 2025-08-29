/**
 * Plugin compatibility checking and validation system
 * Ensures plugins are compatible with the current system and other plugins
 */

import { PluginMetadata, PluginRegistryEntry } from './types';
import { PluginRegistry } from './plugin-registry';

export class PluginCompatibilityChecker {
  private registry: PluginRegistry;
  private systemVersion: string;
  private supportedApiVersions: string[];

  constructor(registry: PluginRegistry, systemVersion: string = '1.0.0') {
    this.registry = registry;
    this.systemVersion = systemVersion;
    this.supportedApiVersions = ['1.0.0', '1.0.x', '^1.0.0'];
  }

  /**
   * Check if a plugin is compatible with the current system
   */
  checkCompatibility(metadata: PluginMetadata): CompatibilityResult {
    const issues: CompatibilityIssue[] = [];
    const warnings: CompatibilityWarning[] = [];

    // Check AgentOS version compatibility
    const versionCheck = this.checkAgentOSVersion(metadata.agentOSVersion);
    if (!versionCheck.compatible) {
      issues.push({
        type: 'version_incompatible',
        severity: 'error',
        message: `Plugin requires AgentOS ${metadata.agentOSVersion}, but system is running ${this.systemVersion}`,
        details: { required: metadata.agentOSVersion, current: this.systemVersion }
      });
    }

    // Check for dependency conflicts
    const dependencyCheck = this.checkDependencies(metadata);
    issues.push(...dependencyCheck.issues);
    warnings.push(...dependencyCheck.warnings);

    // Check for intent conflicts
    const intentCheck = this.checkIntentConflicts(metadata);
    issues.push(...intentCheck.issues);
    warnings.push(...intentCheck.warnings);

    // Check for resource conflicts
    const resourceCheck = this.checkResourceConflicts(metadata);
    warnings.push(...resourceCheck.warnings);

    // Check plugin size and complexity
    const complexityCheck = this.checkComplexity(metadata);
    warnings.push(...complexityCheck.warnings);

    return {
      compatible: issues.length === 0,
      issues,
      warnings,
      score: this.calculateCompatibilityScore(issues, warnings)
    };
  }

  /**
   * Check if a plugin update is compatible
   */
  checkUpdateCompatibility(
    currentMetadata: PluginMetadata,
    newMetadata: PluginMetadata
  ): UpdateCompatibilityResult {
    const issues: CompatibilityIssue[] = [];
    const warnings: CompatibilityWarning[] = [];

    // Check version progression
    if (!this.isValidVersionUpdate(currentMetadata.version, newMetadata.version)) {
      issues.push({
        type: 'invalid_version_update',
        severity: 'error',
        message: `Invalid version update from ${currentMetadata.version} to ${newMetadata.version}`,
        details: { from: currentMetadata.version, to: newMetadata.version }
      });
    }

    // Check for breaking changes
    const breakingChanges = this.detectBreakingChanges(currentMetadata, newMetadata);
    issues.push(...breakingChanges.issues);
    warnings.push(...breakingChanges.warnings);

    // Check new compatibility
    const newCompatibility = this.checkCompatibility(newMetadata);
    issues.push(...newCompatibility.issues);
    warnings.push(...newCompatibility.warnings);

    return {
      compatible: issues.length === 0,
      issues,
      warnings,
      breakingChanges: breakingChanges.issues.length > 0,
      requiresRestart: this.requiresRestart(currentMetadata, newMetadata)
    };
  }

  /**
   * Get compatibility report for all installed plugins
   */
  getSystemCompatibilityReport(): SystemCompatibilityReport {
    const plugins = Array.from(this.registry.getAllPlugins().values());
    const results: PluginCompatibilityReport[] = [];
    const conflicts: ConflictReport[] = [];

    // Check each plugin individually
    for (const plugin of plugins) {
      const compatibility = this.checkCompatibility(plugin.metadata);
      results.push({
        pluginId: plugin.metadata.id,
        pluginName: plugin.metadata.name,
        version: plugin.metadata.version,
        compatibility
      });
    }

    // Check for cross-plugin conflicts
    conflicts.push(...this.findCrossPluginConflicts(plugins));

    return {
      systemVersion: this.systemVersion,
      totalPlugins: plugins.length,
      compatiblePlugins: results.filter(r => r.compatibility.compatible).length,
      incompatiblePlugins: results.filter(r => !r.compatibility.compatible).length,
      totalConflicts: conflicts.length,
      results,
      conflicts,
      overallScore: this.calculateOverallScore(results)
    };
  }

  /**
   * Suggest compatibility fixes
   */
  suggestFixes(metadata: PluginMetadata): CompatibilityFix[] {
    const fixes: CompatibilityFix[] = [];
    const compatibility = this.checkCompatibility(metadata);

    for (const issue of compatibility.issues) {
      switch (issue.type) {
        case 'version_incompatible':
          fixes.push({
            type: 'update_system',
            description: `Update AgentOS to version ${metadata.agentOSVersion} or later`,
            priority: 'high',
            automated: false
          });
          break;

        case 'intent_conflict':
          fixes.push({
            type: 'resolve_conflict',
            description: `Resolve intent conflict with ${issue.details?.conflictingPlugin}`,
            priority: 'medium',
            automated: false,
            details: {
              conflictingIntent: issue.details?.intentId,
              conflictingPlugin: issue.details?.conflictingPlugin
            }
          });
          break;

        case 'dependency_missing':
          fixes.push({
            type: 'install_dependency',
            description: `Install missing dependency: ${issue.details?.dependency}`,
            priority: 'high',
            automated: true,
            details: {
              dependency: issue.details?.dependency,
              version: issue.details?.version
            }
          });
          break;
      }
    }

    return fixes;
  }

  // Private methods

  private checkAgentOSVersion(requiredVersion: string): { compatible: boolean; reason?: string } {
    try {
      // Handle version ranges
      if (requiredVersion.startsWith('^')) {
        const baseVersion = requiredVersion.substring(1);
        return {
          compatible: this.isVersionCompatible(this.systemVersion, baseVersion, 'caret'),
          reason: !this.isVersionCompatible(this.systemVersion, baseVersion, 'caret') 
            ? `System version ${this.systemVersion} is not compatible with ^${baseVersion}`
            : undefined
        };
      }

      if (requiredVersion.includes('x')) {
        const baseVersion = requiredVersion.replace(/\.x/g, '');
        return {
          compatible: this.systemVersion.startsWith(baseVersion),
          reason: !this.systemVersion.startsWith(baseVersion)
            ? `System version ${this.systemVersion} does not match pattern ${requiredVersion}`
            : undefined
        };
      }

      // Exact version match
      return {
        compatible: this.systemVersion === requiredVersion,
        reason: this.systemVersion !== requiredVersion
          ? `System version ${this.systemVersion} does not match required ${requiredVersion}`
          : undefined
      };
    } catch (error) {
      return {
        compatible: false,
        reason: `Invalid version format: ${requiredVersion}`
      };
    }
  }

  private checkDependencies(metadata: PluginMetadata): {
    issues: CompatibilityIssue[];
    warnings: CompatibilityWarning[];
  } {
    const issues: CompatibilityIssue[] = [];
    const warnings: CompatibilityWarning[] = [];

    if (!metadata.dependencies) {
      return { issues, warnings };
    }

    for (const [depId, depVersion] of Object.entries(metadata.dependencies)) {
      const depPlugin = this.registry.getPlugin(depId);
      
      if (!depPlugin) {
        issues.push({
          type: 'dependency_missing',
          severity: 'error',
          message: `Required dependency not found: ${depId}`,
          details: { dependency: depId, version: depVersion }
        });
        continue;
      }

      if (!this.isVersionCompatible(depPlugin.metadata.version, depVersion, 'exact')) {
        issues.push({
          type: 'dependency_version_mismatch',
          severity: 'error',
          message: `Dependency version mismatch: ${depId} requires ${depVersion}, but ${depPlugin.metadata.version} is installed`,
          details: {
            dependency: depId,
            required: depVersion,
            installed: depPlugin.metadata.version
          }
        });
      }

      if (depPlugin.status !== 'enabled') {
        warnings.push({
          type: 'dependency_disabled',
          severity: 'warning',
          message: `Dependency is not enabled: ${depId}`,
          details: { dependency: depId, status: depPlugin.status }
        });
      }
    }

    return { issues, warnings };
  }

  private checkIntentConflicts(metadata: PluginMetadata): {
    issues: CompatibilityIssue[];
    warnings: CompatibilityWarning[];
  } {
    const issues: CompatibilityIssue[] = [];
    const warnings: CompatibilityWarning[] = [];

    for (const intent of metadata.intents) {
      // Check for exact intent ID conflicts
      for (const [pluginId, plugin] of this.registry.getAllPlugins()) {
        if (pluginId === metadata.id) continue;

        const conflictingIntent = plugin.metadata.intents.find(
          existingIntent => existingIntent.intentId === intent.intentId
        );

        if (conflictingIntent) {
          issues.push({
            type: 'intent_conflict',
            severity: 'error',
            message: `Intent ID conflict: ${intent.intentId} is already registered by ${plugin.metadata.name}`,
            details: {
              intentId: intent.intentId,
              conflictingPlugin: plugin.metadata.name,
              conflictingPluginId: pluginId
            }
          });
        }

        // Check for similar intent names (potential confusion)
        const similarIntent = plugin.metadata.intents.find(
          existingIntent => this.calculateStringSimilarity(existingIntent.name, intent.name) > 0.8
        );

        if (similarIntent && similarIntent.intentId !== intent.intentId) {
          warnings.push({
            type: 'similar_intent_names',
            severity: 'warning',
            message: `Similar intent names may cause confusion: "${intent.name}" vs "${similarIntent.name}" from ${plugin.metadata.name}`,
            details: {
              intentName: intent.name,
              similarIntentName: similarIntent.name,
              conflictingPlugin: plugin.metadata.name
            }
          });
        }
      }
    }

    return { issues, warnings };
  }

  private checkResourceConflicts(metadata: PluginMetadata): {
    warnings: CompatibilityWarning[];
  } {
    const warnings: CompatibilityWarning[] = [];

    // Check for excessive resource requirements
    const totalPermissions = metadata.permissions.length;
    if (totalPermissions > 10) {
      warnings.push({
        type: 'excessive_permissions',
        severity: 'warning',
        message: `Plugin requests many permissions (${totalPermissions}), which may impact user trust`,
        details: { permissionCount: totalPermissions }
      });
    }

    // Check for sensitive permissions
    const sensitivePermissions = metadata.permissions.filter(p => 
      (p.type === 'system' && p.access === 'execute') ||
      (p.type === 'network' && p.resource === '*') ||
      (p.type === 'data' && p.resource === '*')
    );

    if (sensitivePermissions.length > 0) {
      warnings.push({
        type: 'sensitive_permissions',
        severity: 'warning',
        message: `Plugin requests sensitive permissions that require careful review`,
        details: { sensitivePermissions: sensitivePermissions.map(p => `${p.type}:${p.resource}:${p.access}`) }
      });
    }

    return { warnings };
  }

  private checkComplexity(metadata: PluginMetadata): {
    warnings: CompatibilityWarning[];
  } {
    const warnings: CompatibilityWarning[] = [];

    // Check intent complexity
    const totalIntents = metadata.intents.length;
    if (totalIntents > 20) {
      warnings.push({
        type: 'high_complexity',
        severity: 'warning',
        message: `Plugin defines many intents (${totalIntents}), which may impact performance`,
        details: { intentCount: totalIntents }
      });
    }

    // Check parameter complexity
    const totalParameters = metadata.intents.reduce((sum, intent) => sum + intent.parameters.length, 0);
    if (totalParameters > 50) {
      warnings.push({
        type: 'complex_parameters',
        severity: 'warning',
        message: `Plugin has complex parameter structure (${totalParameters} total parameters)`,
        details: { parameterCount: totalParameters }
      });
    }

    return { warnings };
  }

  private detectBreakingChanges(
    oldMetadata: PluginMetadata,
    newMetadata: PluginMetadata
  ): {
    issues: CompatibilityIssue[];
    warnings: CompatibilityWarning[];
  } {
    const issues: CompatibilityIssue[] = [];
    const warnings: CompatibilityWarning[] = [];

    // Check for removed intents
    const removedIntents = oldMetadata.intents.filter(
      oldIntent => !newMetadata.intents.some(newIntent => newIntent.intentId === oldIntent.intentId)
    );

    for (const removedIntent of removedIntents) {
      issues.push({
        type: 'breaking_change',
        severity: 'error',
        message: `Breaking change: Intent ${removedIntent.intentId} was removed`,
        details: { removedIntent: removedIntent.intentId }
      });
    }

    // Check for modified intent signatures
    for (const newIntent of newMetadata.intents) {
      const oldIntent = oldMetadata.intents.find(i => i.intentId === newIntent.intentId);
      if (oldIntent) {
        // Check for removed required parameters
        const removedRequiredParams = oldIntent.parameters
          .filter(p => p.required)
          .filter(oldParam => !newIntent.parameters.some(newParam => 
            newParam.name === oldParam.name && newParam.required
          ));

        if (removedRequiredParams.length > 0) {
          issues.push({
            type: 'breaking_change',
            severity: 'error',
            message: `Breaking change: Required parameters removed from ${newIntent.intentId}`,
            details: { 
              intentId: newIntent.intentId,
              removedParameters: removedRequiredParams.map(p => p.name)
            }
          });
        }

        // Check for changed parameter types
        for (const newParam of newIntent.parameters) {
          const oldParam = oldIntent.parameters.find(p => p.name === newParam.name);
          if (oldParam && oldParam.type !== newParam.type) {
            issues.push({
              type: 'breaking_change',
              severity: 'error',
              message: `Breaking change: Parameter type changed for ${newParam.name} in ${newIntent.intentId}`,
              details: {
                intentId: newIntent.intentId,
                parameter: newParam.name,
                oldType: oldParam.type,
                newType: newParam.type
              }
            });
          }
        }
      }
    }

    // Check for new required permissions
    const newRequiredPermissions = newMetadata.permissions
      .filter(p => p.required)
      .filter(newPerm => !oldMetadata.permissions.some(oldPerm => 
        oldPerm.type === newPerm.type && 
        oldPerm.resource === newPerm.resource && 
        oldPerm.access === newPerm.access
      ));

    if (newRequiredPermissions.length > 0) {
      warnings.push({
        type: 'new_permissions',
        severity: 'warning',
        message: `Update requires new permissions`,
        details: { 
          newPermissions: newRequiredPermissions.map(p => `${p.type}:${p.resource}:${p.access}`)
        }
      });
    }

    return { issues, warnings };
  }

  private findCrossPluginConflicts(plugins: PluginRegistryEntry[]): ConflictReport[] {
    const conflicts: ConflictReport[] = [];

    // Check for circular dependencies
    const dependencyGraph = this.buildDependencyGraph(plugins);
    const cycles = this.findCycles(dependencyGraph);
    
    for (const cycle of cycles) {
      conflicts.push({
        type: 'circular_dependency',
        severity: 'error',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        affectedPlugins: cycle,
        details: { cycle }
      });
    }

    // Check for resource contention
    const resourceConflicts = this.findResourceConflicts(plugins);
    conflicts.push(...resourceConflicts);

    return conflicts;
  }

  private buildDependencyGraph(plugins: PluginRegistryEntry[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const plugin of plugins) {
      const dependencies = Object.keys(plugin.metadata.dependencies || {});
      graph.set(plugin.metadata.id, dependencies);
    }

    return graph;
  }

  private findCycles(graph: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart).concat(node));
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      recursionStack.add(node);

      const dependencies = graph.get(node) || [];
      for (const dep of dependencies) {
        dfs(dep, path.concat(node));
      }

      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  private findResourceConflicts(plugins: PluginRegistryEntry[]): ConflictReport[] {
    const conflicts: ConflictReport[] = [];
    
    // Group plugins by resource access
    const resourceAccess = new Map<string, string[]>();
    
    for (const plugin of plugins) {
      for (const permission of plugin.metadata.permissions) {
        const resourceKey = `${permission.type}:${permission.resource}:${permission.access}`;
        
        if (!resourceAccess.has(resourceKey)) {
          resourceAccess.set(resourceKey, []);
        }
        resourceAccess.get(resourceKey)!.push(plugin.metadata.id);
      }
    }

    // Check for exclusive resource conflicts
    const exclusiveResources = ['system:audio:exclusive', 'system:camera:exclusive'];
    
    for (const resource of exclusiveResources) {
      const accessors = resourceAccess.get(resource);
      if (accessors && accessors.length > 1) {
        conflicts.push({
          type: 'resource_conflict',
          severity: 'error',
          message: `Multiple plugins requesting exclusive access to ${resource}`,
          affectedPlugins: accessors,
          details: { resource, accessors }
        });
      }
    }

    return conflicts;
  }

  private isVersionCompatible(version: string, requirement: string, type: 'exact' | 'caret' | 'tilde' = 'exact'): boolean {
    // Simplified version comparison
    const versionParts = version.split('.').map(Number);
    const requirementParts = requirement.split('.').map(Number);

    switch (type) {
      case 'exact':
        return version === requirement;
      case 'caret':
        return versionParts[0] === requirementParts[0] && 
               (versionParts[1] > requirementParts[1] || 
                (versionParts[1] === requirementParts[1] && versionParts[2] >= requirementParts[2]));
      case 'tilde':
        return versionParts[0] === requirementParts[0] && 
               versionParts[1] === requirementParts[1] && 
               versionParts[2] >= requirementParts[2];
      default:
        return false;
    }
  }

  private isValidVersionUpdate(currentVersion: string, newVersion: string): boolean {
    const current = currentVersion.split('.').map(Number);
    const newVer = newVersion.split('.').map(Number);

    // New version should be greater than current
    for (let i = 0; i < Math.max(current.length, newVer.length); i++) {
      const currentPart = current[i] || 0;
      const newPart = newVer[i] || 0;

      if (newPart > currentPart) return true;
      if (newPart < currentPart) return false;
    }

    return false; // Versions are equal
  }

  private requiresRestart(oldMetadata: PluginMetadata, newMetadata: PluginMetadata): boolean {
    // Check if update requires system restart
    const criticalChanges = [
      // Permission changes
      oldMetadata.permissions.length !== newMetadata.permissions.length,
      // AgentOS version changes
      oldMetadata.agentOSVersion !== newMetadata.agentOSVersion,
      // Major version changes
      oldMetadata.version.split('.')[0] !== newMetadata.version.split('.')[0]
    ];

    return criticalChanges.some(change => change);
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateCompatibilityScore(issues: CompatibilityIssue[], warnings: CompatibilityWarning[]): number {
    let score = 100;
    
    // Deduct points for issues
    score -= issues.length * 25;
    
    // Deduct points for warnings
    score -= warnings.length * 5;
    
    return Math.max(0, score);
  }

  private calculateOverallScore(results: PluginCompatibilityReport[]): number {
    if (results.length === 0) return 100;
    
    const totalScore = results.reduce((sum, result) => sum + result.compatibility.score, 0);
    return totalScore / results.length;
  }
}

// Supporting interfaces

export interface CompatibilityResult {
  compatible: boolean;
  issues: CompatibilityIssue[];
  warnings: CompatibilityWarning[];
  score: number;
}

export interface UpdateCompatibilityResult extends CompatibilityResult {
  breakingChanges: boolean;
  requiresRestart: boolean;
}

export interface CompatibilityIssue {
  type: string;
  severity: 'error' | 'warning';
  message: string;
  details?: any;
}

export interface CompatibilityWarning {
  type: string;
  severity: 'warning';
  message: string;
  details?: any;
}

export interface SystemCompatibilityReport {
  systemVersion: string;
  totalPlugins: number;
  compatiblePlugins: number;
  incompatiblePlugins: number;
  totalConflicts: number;
  results: PluginCompatibilityReport[];
  conflicts: ConflictReport[];
  overallScore: number;
}

export interface PluginCompatibilityReport {
  pluginId: string;
  pluginName: string;
  version: string;
  compatibility: CompatibilityResult;
}

export interface ConflictReport {
  type: string;
  severity: 'error' | 'warning';
  message: string;
  affectedPlugins: string[];
  details?: any;
}

export interface CompatibilityFix {
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  automated: boolean;
  details?: any;
}