/**
 * Tests for SchemaRegistry
 */

import { SchemaRegistry } from '../schema-registry';
import { EntitySchema, EntityRelationship } from '../types';
import { CONTACT_SCHEMA, EVENT_SCHEMA } from '../schemas';

describe('SchemaRegistry', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry();
  });

  describe('Schema Registration', () => {
    it('should register standard schemas on initialization', () => {
      expect(registry.hasSchema('contact')).toBe(true);
      expect(registry.hasSchema('event')).toBe(true);
      expect(registry.hasSchema('location')).toBe(true);
      expect(registry.hasSchema('health_data')).toBe(true);
      expect(registry.hasSchema('user_preference')).toBe(true);
    });

    it('should register a valid schema', () => {
      const testSchema: EntitySchema = {
        id: 'test_entity',
        name: 'Test Entity',
        version: '1.0.0',
        description: 'Test schema',
        fields: [
          {
            name: 'testField',
            type: 'string',
            required: true,
            privacy: { level: 'private', encryption: true, auditRequired: true, consentRequired: true }
          }
        ],
        relationships: [],
        privacy: { level: 'private', encryption: true, auditRequired: true, consentRequired: true },
        created: new Date(),
        updated: new Date()
      };

      registry.registerSchema(testSchema);
      expect(registry.hasSchema('test_entity')).toBe(true);
      expect(registry.getSchema('test_entity')).toEqual(testSchema);
    });

    it('should reject invalid schema with missing required fields', () => {
      const invalidSchema = {
        name: 'Invalid Schema',
        version: '1.0.0'
      } as EntitySchema;

      expect(() => registry.registerSchema(invalidSchema)).toThrow('Invalid schema');
    });

    it('should reject schema with invalid version format', () => {
      const invalidSchema: EntitySchema = {
        id: 'invalid',
        name: 'Invalid Schema',
        version: 'invalid-version',
        description: 'Test',
        fields: [{ name: 'test', type: 'string' }],
        relationships: [],
        privacy: { level: 'private', encryption: true, auditRequired: true, consentRequired: true },
        created: new Date(),
        updated: new Date()
      };

      expect(() => registry.registerSchema(invalidSchema)).toThrow('Version must follow semantic versioning');
    });
  });

  describe('Schema Retrieval', () => {
    it('should retrieve schema by ID', () => {
      const schema = registry.getSchema('contact');
      expect(schema).toBeDefined();
      expect(schema?.id).toBe('contact');
    });

    it('should return undefined for non-existent schema', () => {
      const schema = registry.getSchema('non_existent');
      expect(schema).toBeUndefined();
    });

    it('should get all schemas', () => {
      const schemas = registry.getAllSchemas();
      expect(schemas.length).toBeGreaterThan(0);
      expect(schemas.some(s => s.id === 'contact')).toBe(true);
    });

    it('should get schemas by version', () => {
      const schemas = registry.getSchemasByVersion('1.0.0');
      expect(schemas.length).toBeGreaterThan(0);
      expect(schemas.every(s => s.version === '1.0.0')).toBe(true);
    });
  });

  describe('Relationship Management', () => {
    it('should get relationships for a schema', () => {
      const relationships = registry.getRelationships('contact');
      expect(Array.isArray(relationships)).toBe(true);
    });

    it('should find schemas that reference a target schema', () => {
      const referencingSchemas = registry.findReferencingSchemas('contact');
      expect(Array.isArray(referencingSchemas)).toBe(true);
    });

    it('should prevent removal of referenced schema', () => {
      expect(() => registry.removeSchema('contact')).toThrow('Cannot remove schema contact: referenced by');
    });
  });

  describe('Schema Statistics', () => {
    it('should provide accurate statistics', () => {
      const stats = registry.getStats();
      expect(stats.totalSchemas).toBeGreaterThan(0);
      expect(typeof stats.schemasByVersion).toBe('object');
      expect(typeof stats.relationshipCount).toBe('number');
    });
  });

  describe('Schema Removal', () => {
    it('should remove schema without references', () => {
      const testSchema: EntitySchema = {
        id: 'removable',
        name: 'Removable Schema',
        version: '1.0.0',
        description: 'Test schema for removal',
        fields: [{ name: 'test', type: 'string' }],
        relationships: [],
        privacy: { level: 'private', encryption: true, auditRequired: true, consentRequired: true },
        created: new Date(),
        updated: new Date()
      };

      registry.registerSchema(testSchema);
      expect(registry.hasSchema('removable')).toBe(true);

      const removed = registry.removeSchema('removable');
      expect(removed).toBe(true);
      expect(registry.hasSchema('removable')).toBe(false);
    });

    it('should return false when removing non-existent schema', () => {
      const removed = registry.removeSchema('non_existent');
      expect(removed).toBe(false);
    });
  });
});