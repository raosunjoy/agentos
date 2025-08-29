/**
 * Tests for MigrationManager
 */

import { MigrationManager } from '../migration-manager';
import { SchemaMigration, MigrationOperation } from '../types';

describe('MigrationManager', () => {
  let migrationManager: MigrationManager;

  beforeEach(() => {
    migrationManager = new MigrationManager();
  });

  describe('Migration Registration', () => {
    it('should register a valid migration', () => {
      const migration: SchemaMigration = {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        operations: [
          {
            type: 'add_field',
            field: 'newField'
          }
        ]
      };

      expect(() => migrationManager.registerMigration('test_schema', migration)).not.toThrow();
    });

    it('should reject migration with invalid version format', () => {
      const migration: SchemaMigration = {
        fromVersion: 'invalid',
        toVersion: '1.1.0',
        operations: [
          {
            type: 'add_field',
            field: 'newField'
          }
        ]
      };

      expect(() => migrationManager.registerMigration('test_schema', migration)).toThrow('Invalid migration');
    });

    it('should reject migration without operations', () => {
      const migration: SchemaMigration = {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        operations: []
      };

      expect(() => migrationManager.registerMigration('test_schema', migration)).toThrow('At least one operation is required');
    });
  });

  describe('Migration Path Finding', () => {
    beforeEach(() => {
      // Set up a migration chain: 1.0.0 -> 1.1.0 -> 1.2.0
      const migration1: SchemaMigration = {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        operations: [{ type: 'add_field', field: 'field1' }]
      };

      const migration2: SchemaMigration = {
        fromVersion: '1.1.0',
        toVersion: '1.2.0',
        operations: [{ type: 'add_field', field: 'field2' }]
      };

      migrationManager.registerMigration('test_schema', migration1);
      migrationManager.registerMigration('test_schema', migration2);
    });

    it('should find direct migration path', () => {
      const path = migrationManager.getMigrationPath('test_schema', '1.0.0', '1.1.0');
      expect(path).toHaveLength(1);
      expect(path[0].fromVersion).toBe('1.0.0');
      expect(path[0].toVersion).toBe('1.1.0');
    });

    it('should find multi-step migration path', () => {
      const path = migrationManager.getMigrationPath('test_schema', '1.0.0', '1.2.0');
      expect(path).toHaveLength(2);
      expect(path[0].fromVersion).toBe('1.0.0');
      expect(path[0].toVersion).toBe('1.1.0');
      expect(path[1].fromVersion).toBe('1.1.0');
      expect(path[1].toVersion).toBe('1.2.0');
    });

    it('should return empty path for same version', () => {
      const path = migrationManager.getMigrationPath('test_schema', '1.0.0', '1.0.0');
      expect(path).toHaveLength(0);
    });

    it('should throw error for non-existent migration path', () => {
      expect(() => migrationManager.getMigrationPath('test_schema', '2.0.0', '3.0.0')).toThrow('No migration path found');
    });

    it('should check if migration path exists', () => {
      expect(migrationManager.hasMigrationPath('test_schema', '1.0.0', '1.2.0')).toBe(true);
      expect(migrationManager.hasMigrationPath('test_schema', '2.0.0', '3.0.0')).toBe(false);
    });
  });

  describe('Data Migration', () => {
    beforeEach(() => {
      const migration: SchemaMigration = {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        operations: [
          { type: 'add_field', field: 'newField' },
          { type: 'remove_field', field: 'oldField' },
          { type: 'rename_field', field: 'oldName', newField: 'newName' },
          { type: 'change_type', field: 'numberField', newType: 'string' }
        ]
      };

      migrationManager.registerMigration('test_schema', migration);
    });

    it('should migrate data with add_field operation', () => {
      const originalData = { existingField: 'value' };
      const migratedData = migrationManager.migrateData(originalData, 'test_schema', '1.0.0', '1.1.0');
      
      expect(migratedData.newField).toBe(null);
      expect(migratedData.existingField).toBe('value');
    });

    it('should migrate data with remove_field operation', () => {
      const originalData = { existingField: 'value', oldField: 'remove me' };
      const migratedData = migrationManager.migrateData(originalData, 'test_schema', '1.0.0', '1.1.0');
      
      expect(migratedData.oldField).toBeUndefined();
      expect(migratedData.existingField).toBe('value');
    });

    it('should migrate data with rename_field operation', () => {
      const originalData = { oldName: 'value', otherField: 'keep' };
      const migratedData = migrationManager.migrateData(originalData, 'test_schema', '1.0.0', '1.1.0');
      
      expect(migratedData.oldName).toBeUndefined();
      expect(migratedData.newName).toBe('value');
      expect(migratedData.otherField).toBe('keep');
    });

    it('should migrate data with change_type operation', () => {
      const originalData = { numberField: 42, otherField: 'keep' };
      const migratedData = migrationManager.migrateData(originalData, 'test_schema', '1.0.0', '1.1.0');
      
      expect(migratedData.numberField).toBe('42');
      expect(migratedData.otherField).toBe('keep');
    });

    it('should return original data for same version', () => {
      const originalData = { field: 'value' };
      const migratedData = migrationManager.migrateData(originalData, 'test_schema', '1.0.0', '1.0.0');
      
      expect(migratedData).toEqual(originalData);
    });
  });

  describe('Type Conversion', () => {
    beforeEach(() => {
      const migration: SchemaMigration = {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        operations: [
          { type: 'change_type', field: 'toString', newType: 'string' },
          { type: 'change_type', field: 'toNumber', newType: 'number' },
          { type: 'change_type', field: 'toBoolean', newType: 'boolean' },
          { type: 'change_type', field: 'toArray', newType: 'array' },
          { type: 'change_type', field: 'toObject', newType: 'object' }
        ]
      };

      migrationManager.registerMigration('test_schema', migration);
    });

    it('should convert values to string', () => {
      const originalData = { toString: 42 };
      const migratedData = migrationManager.migrateData(originalData, 'test_schema', '1.0.0', '1.1.0');
      
      expect(migratedData.toString).toBe('42');
      expect(typeof migratedData.toString).toBe('string');
    });

    it('should convert values to number', () => {
      const originalData = { toNumber: '42' };
      const migratedData = migrationManager.migrateData(originalData, 'test_schema', '1.0.0', '1.1.0');
      
      expect(migratedData.toNumber).toBe(42);
      expect(typeof migratedData.toNumber).toBe('number');
    });

    it('should convert values to boolean', () => {
      const originalData = { toBoolean: 'true' };
      const migratedData = migrationManager.migrateData(originalData, 'test_schema', '1.0.0', '1.1.0');
      
      expect(migratedData.toBoolean).toBe(true);
      expect(typeof migratedData.toBoolean).toBe('boolean');
    });

    it('should convert values to array', () => {
      const originalData = { toArray: 'single value' };
      const migratedData = migrationManager.migrateData(originalData, 'test_schema', '1.0.0', '1.1.0');
      
      expect(Array.isArray(migratedData.toArray)).toBe(true);
      expect(migratedData.toArray).toEqual(['single value']);
    });

    it('should convert values to object', () => {
      const originalData = { toObject: 'value' };
      const migratedData = migrationManager.migrateData(originalData, 'test_schema', '1.0.0', '1.1.0');
      
      expect(typeof migratedData.toObject).toBe('object');
      expect(migratedData.toObject).toEqual({ value: 'value' });
    });

    it('should handle null and undefined values', () => {
      const originalData = { toString: null, toNumber: undefined };
      const migratedData = migrationManager.migrateData(originalData, 'test_schema', '1.0.0', '1.1.0');
      
      expect(migratedData.toString).toBe(null);
      expect(migratedData.toNumber).toBeUndefined();
    });
  });

  describe('Migration Management', () => {
    it('should get all migrations for a schema', () => {
      const migration1: SchemaMigration = {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        operations: [{ type: 'add_field', field: 'field1' }]
      };

      const migration2: SchemaMigration = {
        fromVersion: '1.1.0',
        toVersion: '1.2.0',
        operations: [{ type: 'add_field', field: 'field2' }]
      };

      migrationManager.registerMigration('test_schema', migration1);
      migrationManager.registerMigration('test_schema', migration2);

      const migrations = migrationManager.getMigrations('test_schema');
      expect(migrations).toHaveLength(2);
    });

    it('should return empty array for schema without migrations', () => {
      const migrations = migrationManager.getMigrations('non_existent');
      expect(migrations).toHaveLength(0);
    });
  });
});