/**
 * Schema migration manager for handling schema evolution
 */

import { EntitySchema, SchemaMigration, MigrationOperation, ValidationResult, ValidationError } from './types';

export class MigrationManager {
  private migrations: Map<string, SchemaMigration[]> = new Map();

  /**
   * Register a migration for a schema
   */
  registerMigration(schemaId: string, migration: SchemaMigration): void {
    const validation = this.validateMigration(migration);
    if (!validation.valid) {
      throw new Error(`Invalid migration: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    if (!this.migrations.has(schemaId)) {
      this.migrations.set(schemaId, []);
    }
    
    const schemaMigrations = this.migrations.get(schemaId)!;
    schemaMigrations.push(migration);
    
    // Sort migrations by version
    schemaMigrations.sort((a, b) => this.compareVersions(a.fromVersion, b.fromVersion));
  }

  /**
   * Get migration path from one version to another
   */
  getMigrationPath(schemaId: string, fromVersion: string, toVersion: string): SchemaMigration[] {
    const schemaMigrations = this.migrations.get(schemaId) || [];
    const path: SchemaMigration[] = [];
    
    let currentVersion = fromVersion;
    
    while (currentVersion !== toVersion) {
      const nextMigration = schemaMigrations.find(m => m.fromVersion === currentVersion);
      
      if (!nextMigration) {
        throw new Error(`No migration path found from version ${currentVersion} to ${toVersion}`);
      }
      
      path.push(nextMigration);
      currentVersion = nextMigration.toVersion;
      
      // Prevent infinite loops
      if (path.length > 100) {
        throw new Error('Migration path too long, possible circular dependency');
      }
    }
    
    return path;
  }

  /**
   * Apply migrations to transform data from one schema version to another
   */
  migrateData(data: any, schemaId: string, fromVersion: string, toVersion: string): any {
    if (fromVersion === toVersion) {
      return data;
    }

    const migrationPath = this.getMigrationPath(schemaId, fromVersion, toVersion);
    let migratedData = { ...data };
    
    for (const migration of migrationPath) {
      migratedData = this.applyMigration(migratedData, migration);
    }
    
    return migratedData;
  }

  /**
   * Apply a single migration to data
   */
  private applyMigration(data: any, migration: SchemaMigration): any {
    let result = { ...data };
    
    for (const operation of migration.operations) {
      result = this.applyOperation(result, operation);
    }
    
    return result;
  }

  /**
   * Apply a single migration operation
   */
  private applyOperation(data: any, operation: MigrationOperation): any {
    const result = { ...data };
    
    switch (operation.type) {
      case 'add_field':
        if (operation.field && !result.hasOwnProperty(operation.field)) {
          result[operation.field] = null; // Default value
        }
        break;
        
      case 'remove_field':
        if (operation.field && result.hasOwnProperty(operation.field)) {
          delete result[operation.field];
        }
        break;
        
      case 'rename_field':
        if (operation.field && operation.newField && result.hasOwnProperty(operation.field)) {
          result[operation.newField] = result[operation.field];
          delete result[operation.field];
        }
        break;
        
      case 'change_type':
        if (operation.field && operation.newType && result.hasOwnProperty(operation.field)) {
          result[operation.field] = this.convertType(result[operation.field], operation.newType);
        }
        break;
        
      case 'add_relationship':
        // Relationship changes don't affect data structure directly
        break;
        
      case 'remove_relationship':
        // Relationship changes don't affect data structure directly
        break;
        
      default:
        throw new Error(`Unknown migration operation type: ${operation.type}`);
    }
    
    return result;
  }

  /**
   * Convert a value to a different type
   */
  private convertType(value: any, newType: string): any {
    if (value === null || value === undefined) {
      return value;
    }
    
    switch (newType) {
      case 'string':
        return String(value);
        
      case 'number':
        const num = Number(value);
        return isNaN(num) ? 0 : num;
        
      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return Boolean(value);
        
      case 'date':
        if (value instanceof Date) return value;
        return new Date(value);
        
      case 'array':
        return Array.isArray(value) ? value : [value];
        
      case 'object':
        return typeof value === 'object' ? value : { value };
        
      default:
        return value;
    }
  }

  /**
   * Validate a migration definition
   */
  private validateMigration(migration: SchemaMigration): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate required fields
    if (!migration.fromVersion) {
      errors.push({ field: 'fromVersion', message: 'From version is required', code: 'REQUIRED_FIELD' });
    }
    if (!migration.toVersion) {
      errors.push({ field: 'toVersion', message: 'To version is required', code: 'REQUIRED_FIELD' });
    }
    if (!migration.operations || migration.operations.length === 0) {
      errors.push({ field: 'operations', message: 'At least one operation is required', code: 'REQUIRED_FIELD' });
    }

    // Validate version format
    if (migration.fromVersion && !/^\d+\.\d+\.\d+$/.test(migration.fromVersion)) {
      errors.push({ 
        field: 'fromVersion', 
        message: 'From version must follow semantic versioning', 
        code: 'INVALID_FORMAT' 
      });
    }
    if (migration.toVersion && !/^\d+\.\d+\.\d+$/.test(migration.toVersion)) {
      errors.push({ 
        field: 'toVersion', 
        message: 'To version must follow semantic versioning', 
        code: 'INVALID_FORMAT' 
      });
    }

    // Validate operations
    migration.operations.forEach((operation, index) => {
      if (!operation.type) {
        errors.push({ 
          field: `operations[${index}].type`, 
          message: 'Operation type is required', 
          code: 'REQUIRED_FIELD' 
        });
      }

      const validTypes = ['add_field', 'remove_field', 'rename_field', 'change_type', 'add_relationship', 'remove_relationship'];
      if (operation.type && !validTypes.includes(operation.type)) {
        errors.push({ 
          field: `operations[${index}].type`, 
          message: 'Invalid operation type', 
          code: 'INVALID_VALUE' 
        });
      }

      // Validate operation-specific requirements
      if (['add_field', 'remove_field', 'change_type'].includes(operation.type) && !operation.field) {
        errors.push({ 
          field: `operations[${index}].field`, 
          message: 'Field is required for this operation type', 
          code: 'REQUIRED_FIELD' 
        });
      }

      if (operation.type === 'rename_field' && (!operation.field || !operation.newField)) {
        errors.push({ 
          field: `operations[${index}]`, 
          message: 'Both field and newField are required for rename operation', 
          code: 'REQUIRED_FIELD' 
        });
      }

      if (operation.type === 'change_type' && !operation.newType) {
        errors.push({ 
          field: `operations[${index}].newType`, 
          message: 'New type is required for change_type operation', 
          code: 'REQUIRED_FIELD' 
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (v1Parts[i] < v2Parts[i]) return -1;
      if (v1Parts[i] > v2Parts[i]) return 1;
    }
    
    return 0;
  }

  /**
   * Get all migrations for a schema
   */
  getMigrations(schemaId: string): SchemaMigration[] {
    return this.migrations.get(schemaId) || [];
  }

  /**
   * Check if a migration path exists
   */
  hasMigrationPath(schemaId: string, fromVersion: string, toVersion: string): boolean {
    try {
      this.getMigrationPath(schemaId, fromVersion, toVersion);
      return true;
    } catch {
      return false;
    }
  }
}