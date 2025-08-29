/**
 * Core types for the semantic data layer
 */

export interface PrivacyAnnotation {
  level: 'public' | 'private' | 'sensitive' | 'restricted';
  retention?: number; // days
  encryption?: boolean;
  auditRequired?: boolean;
  consentRequired?: boolean;
}

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required?: boolean;
  privacy?: PrivacyAnnotation;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: string[];
  };
  relationships?: EntityRelationship[];
}

export interface EntityRelationship {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many' | 'many-to-one';
  targetEntity: string;
  field: string;
  cascadeDelete?: boolean;
}

export interface EntitySchema {
  id: string;
  name: string;
  version: string;
  description: string;
  fields: SchemaField[];
  relationships: EntityRelationship[];
  privacy: PrivacyAnnotation;
  created: Date;
  updated: Date;
}

export interface SchemaMigration {
  fromVersion: string;
  toVersion: string;
  operations: MigrationOperation[];
}

export interface MigrationOperation {
  type: 'add_field' | 'remove_field' | 'rename_field' | 'change_type' | 'add_relationship' | 'remove_relationship';
  field?: string;
  newField?: string;
  newType?: string;
  relationship?: EntityRelationship;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface EntityData {
  id: string;
  entityType: string;
  data: Record<string, any>;
  metadata: {
    created: Date;
    updated: Date;
    version: string;
    privacy: PrivacyAnnotation;
  };
}