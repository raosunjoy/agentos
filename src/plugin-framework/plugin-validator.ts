/**
 * Plugin validation system for security and compatibility checking
 * Validates plugin manifests, code, and dependencies before loading
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import {
  PluginMetadata,
  PluginValidationResult,
  ValidationError,
  ValidationWarning
} from './types';

export class PluginValidator {
  private readonly SUPPORTED_AGENTOS_VERSIONS = ['1.0.0', '1.0.x', '^1.0.0'];
  private readonly MAX_PLUGIN_SIZE_MB = 100;
  private readonly ALLOWED_FILE_EXTENSIONS = ['.js', '.ts', '.json', '.md', '.txt'];
  private readonly FORBIDDEN_MODULES = ['fs', 'child_process', 'cluster', 'os', 'process'];

  /**
   * Validate a plugin before loading
   */
  async validatePlugin(pluginPath: string): Promise<PluginValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Check if plugin directory exists
      const stats = await fs.stat(pluginPath);
      if (!stats.isDirectory()) {
        errors.push({
          code: 'INVALID_PLUGIN_PATH',
          message: 'Plugin path must be a directory',
          severity: 'error'
        });
        return { valid: false, errors, warnings };
      }

      // Validate plugin manifest
      const manifestValidation = await this.validateManifest(pluginPath);
      errors.push(...manifestValidation.errors);
      warnings.push(...manifestValidation.warnings);

      if (manifestValidation.errors.length > 0) {
        return { valid: false, errors, warnings };
      }

      // Read metadata for further validation
      const metadata = await this.readMetadata(pluginPath);

      // Validate plugin structure
      const structureValidation = await this.validateStructure(pluginPath);
      errors.push(...structureValidation.errors);
      warnings.push(...structureValidation.warnings);

      // Validate plugin size
      const sizeValidation = await this.validateSize(pluginPath);
      errors.push(...sizeValidation.errors);
      warnings.push(...sizeValidation.warnings);

      // Validate dependencies
      const dependencyValidation = await this.validateDependencies(pluginPath, metadata);
      errors.push(...dependencyValidation.errors);
      warnings.push(...dependencyValidation.warnings);

      // Validate code security
      const securityValidation = await this.validateSecurity(pluginPath);
      errors.push(...securityValidation.errors);
      warnings.push(...securityValidation.warnings);

      // Validate permissions
      const permissionValidation = this.validatePermissions(metadata);
      errors.push(...permissionValidation.errors);
      warnings.push(...permissionValidation.warnings);

      // Validate version compatibility
      const versionValidation = this.validateVersionCompatibility(metadata);
      errors.push(...versionValidation.errors);
      warnings.push(...versionValidation.warnings);

    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${error.message}`,
        severity: 'error'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate plugin manifest file
   */
  private async validateManifest(pluginPath: string): Promise<PluginValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const manifestPath = path.join(pluginPath, 'plugin.json');

    try {
      // Check if manifest exists
      await fs.access(manifestPath);

      // Read and parse manifest
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      let metadata: PluginMetadata;

      try {
        metadata = JSON.parse(manifestContent);
      } catch (parseError) {
        errors.push({
          code: 'INVALID_MANIFEST_JSON',
          message: 'Plugin manifest is not valid JSON',
          field: 'plugin.json',
          severity: 'error'
        });
        return { valid: false, errors, warnings };
      }

      // Validate required fields
      const requiredFields = ['id', 'name', 'version', 'description', 'author'];
      for (const field of requiredFields) {
        if (!metadata[field as keyof PluginMetadata]) {
          errors.push({
            code: 'MISSING_REQUIRED_FIELD',
            message: `Missing required field: ${field}`,
            field,
            severity: 'error'
          });
        }
      }

      // Validate field formats
      if (metadata.id && !/^[a-z0-9-_.]+$/.test(metadata.id)) {
        errors.push({
          code: 'INVALID_PLUGIN_ID',
          message: 'Plugin ID must contain only lowercase letters, numbers, hyphens, dots, and underscores',
          field: 'id',
          severity: 'error'
        });
      }

      if (metadata.version && !/^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/.test(metadata.version)) {
        errors.push({
          code: 'INVALID_VERSION_FORMAT',
          message: 'Version must follow semantic versioning (e.g., 1.0.0)',
          field: 'version',
          severity: 'error'
        });
      }

      // Validate arrays
      if (metadata.permissions && !Array.isArray(metadata.permissions)) {
        errors.push({
          code: 'INVALID_PERMISSIONS_FORMAT',
          message: 'Permissions must be an array',
          field: 'permissions',
          severity: 'error'
        });
      }

      if (metadata.intents && !Array.isArray(metadata.intents)) {
        errors.push({
          code: 'INVALID_INTENTS_FORMAT',
          message: 'Intents must be an array',
          field: 'intents',
          severity: 'error'
        });
      }

    } catch (error) {
      errors.push({
        code: 'MANIFEST_NOT_FOUND',
        message: 'Plugin manifest (plugin.json) not found',
        severity: 'error'
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate plugin directory structure
   */
  private async validateStructure(pluginPath: string): Promise<PluginValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Check for main entry file
      const hasMainFile = await this.hasMainFile(pluginPath);
      if (!hasMainFile) {
        errors.push({
          code: 'MISSING_MAIN_FILE',
          message: 'Plugin must have a main entry file (index.js, main.js, or specified in package.json)',
          severity: 'error'
        });
      }

      // Check for package.json (optional but recommended)
      const packageJsonPath = path.join(pluginPath, 'package.json');
      try {
        await fs.access(packageJsonPath);
      } catch {
        warnings.push({
          code: 'MISSING_PACKAGE_JSON',
          message: 'package.json not found - recommended for dependency management',
          severity: 'warning',
          recommendation: 'Add package.json for better dependency management'
        });
      }

      // Check for README (optional but recommended)
      const readmeFiles = ['README.md', 'README.txt', 'readme.md', 'readme.txt'];
      const hasReadme = await Promise.all(
        readmeFiles.map(async (file) => {
          try {
            await fs.access(path.join(pluginPath, file));
            return true;
          } catch {
            return false;
          }
        })
      );

      if (!hasReadme.some(exists => exists)) {
        warnings.push({
          code: 'MISSING_README',
          message: 'README file not found',
          severity: 'warning',
          recommendation: 'Add README.md with plugin documentation'
        });
      }

      // Validate file extensions
      const files = await this.getAllFiles(pluginPath);
      for (const file of files) {
        const ext = path.extname(file);
        if (ext && !this.ALLOWED_FILE_EXTENSIONS.includes(ext)) {
          warnings.push({
            code: 'SUSPICIOUS_FILE_EXTENSION',
            message: `Suspicious file extension: ${ext}`,
            field: file,
            severity: 'warning'
          });
        }
      }

    } catch (error) {
      errors.push({
        code: 'STRUCTURE_VALIDATION_ERROR',
        message: `Failed to validate plugin structure: ${error.message}`,
        severity: 'error'
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate plugin size
   */
  private async validateSize(pluginPath: string): Promise<PluginValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const totalSize = await this.calculateDirectorySize(pluginPath);
      const sizeMB = totalSize / (1024 * 1024);

      if (sizeMB > this.MAX_PLUGIN_SIZE_MB) {
        errors.push({
          code: 'PLUGIN_TOO_LARGE',
          message: `Plugin size (${sizeMB.toFixed(2)}MB) exceeds maximum allowed size (${this.MAX_PLUGIN_SIZE_MB}MB)`,
          severity: 'error'
        });
      } else if (sizeMB > this.MAX_PLUGIN_SIZE_MB * 0.8) {
        warnings.push({
          code: 'PLUGIN_SIZE_WARNING',
          message: `Plugin size (${sizeMB.toFixed(2)}MB) is approaching the maximum limit`,
          severity: 'warning',
          recommendation: 'Consider optimizing plugin size'
        });
      }

    } catch (error) {
      errors.push({
        code: 'SIZE_VALIDATION_ERROR',
        message: `Failed to validate plugin size: ${error.message}`,
        severity: 'error'
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate plugin dependencies
   */
  private async validateDependencies(pluginPath: string, metadata: PluginMetadata): Promise<PluginValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Check package.json dependencies
      const packageJsonPath = path.join(pluginPath, 'package.json');
      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        
        if (packageJson.dependencies) {
          for (const [dep, version] of Object.entries(packageJson.dependencies)) {
            // Check for forbidden modules
            if (this.FORBIDDEN_MODULES.includes(dep)) {
              errors.push({
                code: 'FORBIDDEN_DEPENDENCY',
                message: `Forbidden dependency: ${dep}`,
                field: 'dependencies',
                severity: 'error'
              });
            }
          }
        }
      } catch {
        // package.json not found or invalid - already handled in structure validation
      }

      // Validate metadata dependencies
      if (metadata.dependencies) {
        for (const [dep, version] of Object.entries(metadata.dependencies)) {
          if (!version || typeof version !== 'string') {
            errors.push({
              code: 'INVALID_DEPENDENCY_VERSION',
              message: `Invalid version for dependency ${dep}`,
              field: 'dependencies',
              severity: 'error'
            });
          }
        }
      }

    } catch (error) {
      errors.push({
        code: 'DEPENDENCY_VALIDATION_ERROR',
        message: `Failed to validate dependencies: ${error.message}`,
        severity: 'error'
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate plugin code security
   */
  private async validateSecurity(pluginPath: string): Promise<PluginValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const jsFiles = await this.getJavaScriptFiles(pluginPath);
      
      for (const file of jsFiles) {
        const content = await fs.readFile(file, 'utf-8');
        
        // Check for dangerous patterns
        const dangerousPatterns = [
          { pattern: /eval\s*\(/, message: 'Use of eval() is not allowed' },
          { pattern: /Function\s*\(/, message: 'Use of Function constructor is not allowed' },
          { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/, message: 'child_process module is not allowed' },
          { pattern: /require\s*\(\s*['"`]fs['"`]\s*\)/, message: 'Direct fs module access is not allowed' },
          { pattern: /process\.exit/, message: 'process.exit() is not allowed' },
          { pattern: /__dirname|__filename/, message: 'Use of __dirname/__filename may indicate file system access' }
        ];

        for (const { pattern, message } of dangerousPatterns) {
          if (pattern.test(content)) {
            if (message.includes('not allowed')) {
              errors.push({
                code: 'SECURITY_VIOLATION',
                message,
                field: path.relative(pluginPath, file),
                severity: 'error'
              });
            } else {
              warnings.push({
                code: 'SECURITY_WARNING',
                message,
                field: path.relative(pluginPath, file),
                severity: 'warning'
              });
            }
          }
        }
      }

    } catch (error) {
      errors.push({
        code: 'SECURITY_VALIDATION_ERROR',
        message: `Failed to validate security: ${error.message}`,
        severity: 'error'
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate plugin permissions
   */
  private validatePermissions(metadata: PluginMetadata): PluginValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!metadata.permissions || !Array.isArray(metadata.permissions)) {
      return { valid: true, errors, warnings };
    }

    for (let i = 0; i < metadata.permissions.length; i++) {
      const permission = metadata.permissions[i];
      
      if (!permission.type || !permission.resource || !permission.access) {
        errors.push({
          code: 'INVALID_PERMISSION',
          message: `Permission ${i} is missing required fields (type, resource, access)`,
          field: `permissions[${i}]`,
          severity: 'error'
        });
        continue;
      }

      const validTypes = ['data', 'system', 'network', 'hardware'];
      if (!validTypes.includes(permission.type)) {
        errors.push({
          code: 'INVALID_PERMISSION_TYPE',
          message: `Invalid permission type: ${permission.type}`,
          field: `permissions[${i}].type`,
          severity: 'error'
        });
      }

      const validAccess = ['read', 'write', 'execute'];
      if (!validAccess.includes(permission.access)) {
        errors.push({
          code: 'INVALID_PERMISSION_ACCESS',
          message: `Invalid permission access: ${permission.access}`,
          field: `permissions[${i}].access`,
          severity: 'error'
        });
      }

      // Warn about sensitive permissions
      if (permission.type === 'system' && permission.access === 'execute') {
        warnings.push({
          code: 'SENSITIVE_PERMISSION',
          message: 'Plugin requests system execution permissions',
          field: `permissions[${i}]`,
          severity: 'warning',
          recommendation: 'Ensure this permission is necessary for plugin functionality'
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate version compatibility
   */
  private validateVersionCompatibility(metadata: PluginMetadata): PluginValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!metadata.agentOSVersion) {
      errors.push({
        code: 'MISSING_AGENTOS_VERSION',
        message: 'Plugin must specify compatible AgentOS version',
        field: 'agentOSVersion',
        severity: 'error'
      });
      return { valid: false, errors, warnings };
    }

    // Simple version compatibility check
    const isCompatible = this.SUPPORTED_AGENTOS_VERSIONS.some(supportedVersion => {
      if (supportedVersion.includes('x')) {
        const baseVersion = supportedVersion.replace('.x', '');
        return metadata.agentOSVersion.startsWith(baseVersion);
      }
      if (supportedVersion.startsWith('^')) {
        const baseVersion = supportedVersion.substring(1);
        return metadata.agentOSVersion >= baseVersion;
      }
      return metadata.agentOSVersion === supportedVersion;
    });

    if (!isCompatible) {
      errors.push({
        code: 'INCOMPATIBLE_VERSION',
        message: `Plugin requires AgentOS ${metadata.agentOSVersion}, but only ${this.SUPPORTED_AGENTOS_VERSIONS.join(', ')} are supported`,
        field: 'agentOSVersion',
        severity: 'error'
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // Helper methods

  private async readMetadata(pluginPath: string): Promise<PluginMetadata> {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    const content = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  }

  private async hasMainFile(pluginPath: string): Promise<boolean> {
    const commonFiles = ['index.js', 'index.ts', 'main.js', 'main.ts', 'plugin.js', 'plugin.ts'];
    
    // Check package.json main field
    try {
      const packageJsonPath = path.join(pluginPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      if (packageJson.main) {
        try {
          await fs.access(path.join(pluginPath, packageJson.main));
          return true;
        } catch {
          return false;
        }
      }
    } catch {
      // No package.json or invalid
    }

    // Check common entry files
    for (const file of commonFiles) {
      try {
        await fs.access(path.join(pluginPath, file));
        return true;
      } catch {
        // Continue to next file
      }
    }

    return false;
  }

  private async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...await this.getAllFiles(fullPath));
        }
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private async getJavaScriptFiles(dirPath: string): Promise<string[]> {
    const allFiles = await this.getAllFiles(dirPath);
    return allFiles.filter(file => /\.(js|ts)$/.test(file));
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          totalSize += await this.calculateDirectorySize(fullPath);
        }
      } else {
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  }
}