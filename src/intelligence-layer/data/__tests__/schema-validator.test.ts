/**
 * Tests for SchemaValidator
 */

import { SchemaValidator } from '../schema-validator';
import { EntitySchema, EntityData } from '../types';
import { CONTACT_SCHEMA, EVENT_SCHEMA } from '../schemas';

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  describe('Entity Validation', () => {
    it('should validate valid contact data', () => {
      const validContactData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890'
      };

      const result = validator.validateEntity(validContactData, CONTACT_SCHEMA);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject data with missing required fields', () => {
      const invalidContactData = {
        email: 'john.doe@example.com'
        // Missing required firstName and lastName
      };

      const result = validator.validateEntity(invalidContactData, CONTACT_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'firstName')).toBe(true);
      expect(result.errors.some(e => e.field === 'lastName')).toBe(true);
    });

    it('should reject data with wrong field types', () => {
      const invalidContactData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 123, // Should be string
        phone: '+1234567890'
      };

      const result = validator.validateEntity(invalidContactData, CONTACT_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'email' && e.code === 'TYPE_MISMATCH')).toBe(true);
    });

    it('should reject data with unknown fields', () => {
      const invalidContactData = {
        firstName: 'John',
        lastName: 'Doe',
        unknownField: 'value'
      };

      const result = validator.validateEntity(invalidContactData, CONTACT_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'unknownField' && e.code === 'UNKNOWN_FIELD')).toBe(true);
    });
  });

  describe('Field Validation', () => {
    it('should validate email pattern', () => {
      const invalidEmailData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email'
      };

      const result = validator.validateEntity(invalidEmailData, CONTACT_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'email' && e.code === 'PATTERN_MISMATCH')).toBe(true);
    });

    it('should validate phone pattern', () => {
      const invalidPhoneData = {
        firstName: 'John',
        lastName: 'Doe',
        phone: 'invalid-phone'
      };

      const result = validator.validateEntity(invalidPhoneData, CONTACT_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'phone' && e.code === 'PATTERN_MISMATCH')).toBe(true);
    });

    it('should validate numeric ranges', () => {
      const testSchema: EntitySchema = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test schema',
        fields: [
          {
            name: 'score',
            type: 'number',
            validation: { min: 0, max: 100 }
          }
        ],
        relationships: [],
        privacy: { level: 'private', encryption: true, auditRequired: true, consentRequired: true },
        created: new Date(),
        updated: new Date()
      };

      const invalidData = { score: 150 };
      const result = validator.validateEntity(invalidData, testSchema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'score' && e.code === 'VALUE_TOO_LARGE')).toBe(true);
    });

    it('should validate enum values', () => {
      const testSchema: EntitySchema = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test schema',
        fields: [
          {
            name: 'status',
            type: 'string',
            validation: { enum: ['active', 'inactive', 'pending'] }
          }
        ],
        relationships: [],
        privacy: { level: 'private', encryption: true, auditRequired: true, consentRequired: true },
        created: new Date(),
        updated: new Date()
      };

      const invalidData = { status: 'invalid' };
      const result = validator.validateEntity(invalidData, testSchema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'status' && e.code === 'INVALID_ENUM_VALUE')).toBe(true);
    });

    it('should validate string length', () => {
      const testSchema: EntitySchema = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test schema',
        fields: [
          {
            name: 'shortString',
            type: 'string',
            validation: { min: 5, max: 10 }
          }
        ],
        relationships: [],
        privacy: { level: 'private', encryption: true, auditRequired: true, consentRequired: true },
        created: new Date(),
        updated: new Date()
      };

      const shortData = { shortString: 'abc' };
      const shortResult = validator.validateEntity(shortData, testSchema);
      expect(shortResult.valid).toBe(false);
      expect(shortResult.errors.some(e => e.code === 'STRING_TOO_SHORT')).toBe(true);

      const longData = { shortString: 'this is too long' };
      const longResult = validator.validateEntity(longData, testSchema);
      expect(longResult.valid).toBe(false);
      expect(longResult.errors.some(e => e.code === 'STRING_TOO_LONG')).toBe(true);
    });

    it('should validate array length', () => {
      const testSchema: EntitySchema = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test schema',
        fields: [
          {
            name: 'items',
            type: 'array',
            validation: { min: 2, max: 5 }
          }
        ],
        relationships: [],
        privacy: { level: 'private', encryption: true, auditRequired: true, consentRequired: true },
        created: new Date(),
        updated: new Date()
      };

      const shortData = { items: ['one'] };
      const shortResult = validator.validateEntity(shortData, testSchema);
      expect(shortResult.valid).toBe(false);
      expect(shortResult.errors.some(e => e.code === 'ARRAY_TOO_SHORT')).toBe(true);

      const longData = { items: ['one', 'two', 'three', 'four', 'five', 'six'] };
      const longResult = validator.validateEntity(longData, testSchema);
      expect(longResult.valid).toBe(false);
      expect(longResult.errors.some(e => e.code === 'ARRAY_TOO_LONG')).toBe(true);
    });
  });

  describe('Privacy Compliance Validation', () => {
    it('should validate privacy metadata presence', () => {
      const entityData: EntityData = {
        id: 'test-1',
        entityType: 'contact',
        data: { firstName: 'John', lastName: 'Doe' },
        metadata: {
          created: new Date(),
          updated: new Date(),
          version: '1.0.0',
          privacy: {
            level: 'private',
            encryption: true,
            auditRequired: true,
            consentRequired: true
          }
        }
      };

      const result = validator.validatePrivacyCompliance(entityData, CONTACT_SCHEMA);
      expect(result.valid).toBe(true);
    });

    it('should reject entity without privacy metadata', () => {
      const entityData = {
        id: 'test-1',
        entityType: 'contact',
        data: { firstName: 'John', lastName: 'Doe' },
        metadata: {
          created: new Date(),
          updated: new Date(),
          version: '1.0.0'
          // Missing privacy metadata
        }
      } as EntityData;

      const result = validator.validatePrivacyCompliance(entityData, CONTACT_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PRIVACY_METADATA_MISSING')).toBe(true);
    });
  });

  describe('Type Detection', () => {
    it('should correctly identify value types', () => {
      const testSchema: EntitySchema = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test schema',
        fields: [
          { name: 'stringField', type: 'string' },
          { name: 'numberField', type: 'number' },
          { name: 'booleanField', type: 'boolean' },
          { name: 'dateField', type: 'date' },
          { name: 'arrayField', type: 'array' },
          { name: 'objectField', type: 'object' }
        ],
        relationships: [],
        privacy: { level: 'private', encryption: true, auditRequired: true, consentRequired: true },
        created: new Date(),
        updated: new Date()
      };

      const validData = {
        stringField: 'test',
        numberField: 42,
        booleanField: true,
        dateField: new Date(),
        arrayField: [1, 2, 3],
        objectField: { key: 'value' }
      };

      const result = validator.validateEntity(validData, testSchema);
      expect(result.valid).toBe(true);
    });
  });
});