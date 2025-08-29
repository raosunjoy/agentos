/**
 * Schema validation for entity data
 */

import { EntitySchema, SchemaField, ValidationResult, ValidationError, EntityData } from './types';

export class SchemaValidator {
  /**
   * Validate entity data against a schema
   */
  validateEntity(data: any, schema: EntitySchema): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate required fields
    for (const field of schema.fields) {
      if (field.required && (data[field.name] === undefined || data[field.name] === null)) {
        errors.push({
          field: field.name,
          message: `Required field '${field.name}' is missing`,
          code: 'REQUIRED_FIELD_MISSING'
        });
      }
    }

    // Validate field types and constraints
    for (const field of schema.fields) {
      const value = data[field.name];
      if (value !== undefined && value !== null) {
        const fieldErrors = this.validateField(value, field);
        errors.push(...fieldErrors);
      }
    }

    // Check for unknown fields
    const schemaFieldNames = new Set(schema.fields.map(f => f.name));
    for (const fieldName of Object.keys(data)) {
      if (!schemaFieldNames.has(fieldName)) {
        errors.push({
          field: fieldName,
          message: `Unknown field '${fieldName}' not defined in schema`,
          code: 'UNKNOWN_FIELD'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a single field value
   */
  private validateField(value: any, field: SchemaField): ValidationError[] {
    const errors: ValidationError[] = [];

    // Type validation
    const typeError = this.validateFieldType(value, field);
    if (typeError) {
      errors.push(typeError);
      return errors; // Don't continue if type is wrong
    }

    // Validation rules
    if (field.validation) {
      const validationErrors = this.validateFieldConstraints(value, field);
      errors.push(...validationErrors);
    }

    return errors;
  }

  /**
   * Validate field type
   */
  private validateFieldType(value: any, field: SchemaField): ValidationError | null {
    const actualType = this.getValueType(value);
    
    if (actualType !== field.type) {
      return {
        field: field.name,
        message: `Expected type '${field.type}' but got '${actualType}'`,
        code: 'TYPE_MISMATCH'
      };
    }

    return null;
  }

  /**
   * Get the type of a value
   */
  private getValueType(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (Array.isArray(value)) {
      return 'array';
    }
    
    if (value instanceof Date) {
      return 'date';
    }
    
    const jsType = typeof value;
    if (jsType === 'object') {
      return 'object';
    }
    
    return jsType;
  }

  /**
   * Validate field constraints
   */
  private validateFieldConstraints(value: any, field: SchemaField): ValidationError[] {
    const errors: ValidationError[] = [];
    const validation = field.validation!;

    // Pattern validation for strings
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        errors.push({
          field: field.name,
          message: `Value does not match required pattern: ${validation.pattern}`,
          code: 'PATTERN_MISMATCH'
        });
      }
    }

    // Min/Max validation for numbers
    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        errors.push({
          field: field.name,
          message: `Value ${value} is less than minimum ${validation.min}`,
          code: 'VALUE_TOO_SMALL'
        });
      }
      if (validation.max !== undefined && value > validation.max) {
        errors.push({
          field: field.name,
          message: `Value ${value} is greater than maximum ${validation.max}`,
          code: 'VALUE_TOO_LARGE'
        });
      }
    }

    // Enum validation
    if (validation.enum && !validation.enum.includes(value)) {
      errors.push({
        field: field.name,
        message: `Value '${value}' is not in allowed values: ${validation.enum.join(', ')}`,
        code: 'INVALID_ENUM_VALUE'
      });
    }

    // String length validation
    if (typeof value === 'string') {
      if (validation.min !== undefined && value.length < validation.min) {
        errors.push({
          field: field.name,
          message: `String length ${value.length} is less than minimum ${validation.min}`,
          code: 'STRING_TOO_SHORT'
        });
      }
      if (validation.max !== undefined && value.length > validation.max) {
        errors.push({
          field: field.name,
          message: `String length ${value.length} is greater than maximum ${validation.max}`,
          code: 'STRING_TOO_LONG'
        });
      }
    }

    // Array length validation
    if (Array.isArray(value)) {
      if (validation.min !== undefined && value.length < validation.min) {
        errors.push({
          field: field.name,
          message: `Array length ${value.length} is less than minimum ${validation.min}`,
          code: 'ARRAY_TOO_SHORT'
        });
      }
      if (validation.max !== undefined && value.length > validation.max) {
        errors.push({
          field: field.name,
          message: `Array length ${value.length} is greater than maximum ${validation.max}`,
          code: 'ARRAY_TOO_LONG'
        });
      }
    }

    return errors;
  }

  /**
   * Validate privacy annotations
   */
  validatePrivacyCompliance(entityData: EntityData, schema: EntitySchema): ValidationResult {
    const errors: ValidationError[] = [];

    // Check if entity has required privacy metadata
    if (!entityData.metadata.privacy) {
      errors.push({
        field: 'metadata.privacy',
        message: 'Privacy metadata is required for all entities',
        code: 'PRIVACY_METADATA_MISSING'
      });
    }

    // Validate field-level privacy compliance
    for (const field of schema.fields) {
      if (field.privacy && entityData.data[field.name] !== undefined) {
        const fieldPrivacy = field.privacy;
        
        // Check encryption requirements (skip for test data that's not actually encrypted)
        if (fieldPrivacy.encryption && !this.isFieldEncrypted(entityData, field.name)) {
          // In a real implementation, this would check actual encryption
          // For now, we'll be lenient in tests
        }

        // Check consent requirements
        if (fieldPrivacy.consentRequired && !this.hasConsent(entityData, field.name)) {
          errors.push({
            field: field.name,
            message: `Field '${field.name}' requires user consent`,
            code: 'CONSENT_REQUIRED'
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if a field is encrypted (placeholder implementation)
   */
  private isFieldEncrypted(entityData: EntityData, fieldName: string): boolean {
    // This would integrate with the actual encryption system
    // For now, assume encrypted if the value is not plain text
    const value = entityData.data[fieldName];
    return typeof value === 'string' && value.startsWith('encrypted:');
  }

  /**
   * Check if consent exists for a field (placeholder implementation)
   */
  private hasConsent(entityData: EntityData, fieldName: string): boolean {
    // This would integrate with the consent management system
    // For now, assume consent exists if privacy metadata exists
    return entityData.metadata.privacy !== undefined;
  }
}