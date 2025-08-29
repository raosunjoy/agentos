/**
 * Schema registry for managing entity schemas and their relationships
 */

import { EntitySchema, EntityRelationship, ValidationResult, ValidationError } from './types';
import { STANDARD_SCHEMAS } from './schemas';

export class SchemaRegistry {
  private schemas: Map<string, EntitySchema> = new Map();
  private relationships: Map<string, EntityRelationship[]> = new Map();

  constructor() {
    // Register standard schemas
    Object.values(STANDARD_SCHEMAS).forEach(schema => {
      this.registerSchema(schema);
    });
  }

  /**
   * Register a new schema or update an existing one
   */
  registerSchema(schema: EntitySchema): void {
    // Validate schema before registration
    const validation = this.validateSchema(schema);
    if (!validation.valid) {
      throw new Error(`Invalid schema: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.schemas.set(schema.id, schema);
    this.relationships.set(schema.id, schema.relationships);
  }

  /**
   * Get a schema by ID
   */
  getSchema(schemaId: string): EntitySchema | undefined {
    return this.schemas.get(schemaId);
  }

  /**
   * Get all registered schemas
   */
  getAllSchemas(): EntitySchema[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Get schemas by version
   */
  getSchemasByVersion(version: string): EntitySchema[] {
    return Array.from(this.schemas.values()).filter(schema => schema.version === version);
  }

  /**
   * Get relationships for a schema
   */
  getRelationships(schemaId: string): EntityRelationship[] {
    return this.relationships.get(schemaId) || [];
  }

  /**
   * Find schemas that reference a given schema
   */
  findReferencingSchemas(targetSchemaId: string): EntitySchema[] {
    const referencingSchemas: EntitySchema[] = [];
    
    for (const [schemaId, relationships] of this.relationships) {
      const hasReference = relationships.some(rel => rel.targetEntity === targetSchemaId);
      if (hasReference) {
        const schema = this.schemas.get(schemaId);
        if (schema) {
          referencingSchemas.push(schema);
        }
      }
    }
    
    return referencingSchemas;
  }

  /**
   * Validate a schema definition
   */
  private validateSchema(schema: EntitySchema): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate required fields
    if (!schema.id) {
      errors.push({ field: 'id', message: 'Schema ID is required', code: 'REQUIRED_FIELD' });
    }
    if (!schema.name) {
      errors.push({ field: 'name', message: 'Schema name is required', code: 'REQUIRED_FIELD' });
    }
    if (!schema.version) {
      errors.push({ field: 'version', message: 'Schema version is required', code: 'REQUIRED_FIELD' });
    }

    // Validate version format (semantic versioning)
    if (schema.version && !/^\d+\.\d+\.\d+$/.test(schema.version)) {
      errors.push({ 
        field: 'version', 
        message: 'Version must follow semantic versioning (x.y.z)', 
        code: 'INVALID_FORMAT' 
      });
    }

    // Validate fields
    if (!schema.fields || schema.fields.length === 0) {
      errors.push({ field: 'fields', message: 'Schema must have at least one field', code: 'REQUIRED_FIELD' });
    } else {
      schema.fields.forEach((field, index) => {
        if (!field.name) {
          errors.push({ 
            field: `fields[${index}].name`, 
            message: 'Field name is required', 
            code: 'REQUIRED_FIELD' 
          });
        }
        if (!field.type) {
          errors.push({ 
            field: `fields[${index}].type`, 
            message: 'Field type is required', 
            code: 'REQUIRED_FIELD' 
          });
        }
        if (field.type && !['string', 'number', 'boolean', 'date', 'object', 'array'].includes(field.type)) {
          errors.push({ 
            field: `fields[${index}].type`, 
            message: 'Invalid field type', 
            code: 'INVALID_VALUE' 
          });
        }
      });
    }

    // Validate relationships
    if (schema.relationships) {
      schema.relationships.forEach((relationship, index) => {
      if (!relationship.targetEntity) {
        errors.push({ 
          field: `relationships[${index}].targetEntity`, 
          message: 'Target entity is required for relationships', 
          code: 'REQUIRED_FIELD' 
        });
      }
      if (!relationship.field) {
        errors.push({ 
          field: `relationships[${index}].field`, 
          message: 'Field is required for relationships', 
          code: 'REQUIRED_FIELD' 
        });
      }
      if (!['one-to-one', 'one-to-many', 'many-to-many', 'many-to-one'].includes(relationship.type)) {
        errors.push({ 
          field: `relationships[${index}].type`, 
          message: 'Invalid relationship type', 
          code: 'INVALID_VALUE' 
        });
      }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if a schema exists
   */
  hasSchema(schemaId: string): boolean {
    return this.schemas.has(schemaId);
  }

  /**
   * Remove a schema (with safety checks)
   */
  removeSchema(schemaId: string): boolean {
    // Check if other schemas reference this one
    const referencingSchemas = this.findReferencingSchemas(schemaId);
    if (referencingSchemas.length > 0) {
      throw new Error(`Cannot remove schema ${schemaId}: referenced by ${referencingSchemas.map(s => s.id).join(', ')}`);
    }

    const removed = this.schemas.delete(schemaId);
    if (removed) {
      this.relationships.delete(schemaId);
    }
    return removed;
  }

  /**
   * Get schema statistics
   */
  getStats(): {
    totalSchemas: number;
    schemasByVersion: Record<string, number>;
    relationshipCount: number;
  } {
    const schemasByVersion: Record<string, number> = {};
    let relationshipCount = 0;

    for (const schema of this.schemas.values()) {
      schemasByVersion[schema.version] = (schemasByVersion[schema.version] || 0) + 1;
      relationshipCount += schema.relationships.length;
    }

    return {
      totalSchemas: this.schemas.size,
      schemasByVersion,
      relationshipCount
    };
  }
}