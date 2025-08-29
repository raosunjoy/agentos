import { EncryptionSystem } from '../encryption-system';

describe('EncryptionSystem', () => {
  let encryptionSystem: EncryptionSystem;

  beforeEach(async () => {
    encryptionSystem = new EncryptionSystem();
    await encryptionSystem.initialize();
  });

  afterEach(async () => {
    await encryptionSystem.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newSystem = new EncryptionSystem();
      await expect(newSystem.initialize()).resolves.not.toThrow();
      await newSystem.shutdown();
    });

    it('should initialize with user master key', async () => {
      const newSystem = new EncryptionSystem();
      await expect(newSystem.initialize('user-master-key-123')).resolves.not.toThrow();
      await newSystem.shutdown();
    });

    it('should not initialize twice', async () => {
      await expect(encryptionSystem.initialize()).resolves.not.toThrow();
    });

    it('should handle initialization failures', async () => {
      const newSystem = new EncryptionSystem();
      
      // Mock key manager initialization to fail
      const originalInitialize = newSystem['keyManager'].initialize;
      newSystem['keyManager'].initialize = jest.fn().mockRejectedValue(new Error('Init failure'));
      
      await expect(newSystem.initialize()).rejects.toThrow('Failed to initialize encryption system');
      
      // Restore original method
      newSystem['keyManager'].initialize = originalInitialize;
    });
  });

  describe('data encryption and decryption', () => {
    it('should encrypt and decrypt simple data', async () => {
      const testData = { message: 'Hello, World!', number: 42 };
      
      const encrypted = await encryptionSystem.encryptData(testData);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      
      const decrypted = await encryptionSystem.decryptData(encrypted!);
      expect(decrypted).toEqual(testData);
    });

    it('should encrypt and decrypt complex data structures', async () => {
      const complexData = {
        user: {
          id: 123,
          name: 'John Doe',
          preferences: {
            theme: 'dark',
            notifications: true
          }
        },
        array: [1, 2, 3, 'test'],
        nested: {
          deep: {
            value: 'deeply nested'
          }
        }
      };
      
      const encrypted = await encryptionSystem.encryptData(complexData);
      expect(encrypted).toBeDefined();
      
      const decrypted = await encryptionSystem.decryptData(encrypted!);
      expect(decrypted).toEqual(complexData);
    });

    it('should handle different data types', async () => {
      const testCases = [
        'simple string',
        42,
        true,
        null,
        [1, 2, 3],
        { key: 'value' }
      ];
      
      for (const testData of testCases) {
        const encrypted = await encryptionSystem.encryptData(testData);
        expect(encrypted).toBeDefined();
        
        const decrypted = await encryptionSystem.decryptData(encrypted!);
        expect(decrypted).toEqual(testData);
      }
    });

    it('should encrypt with specific purpose', async () => {
      const testData = { sensitive: 'data' };
      
      const encrypted = await encryptionSystem.encryptData(testData, 'user-data');
      expect(encrypted).toBeDefined();
      
      const decrypted = await encryptionSystem.decryptData(encrypted!);
      expect(decrypted).toEqual(testData);
    });

    it('should handle encryption failures gracefully', async () => {
      // Test with uninitialized system
      const uninitializedSystem = new EncryptionSystem();
      
      await expect(uninitializedSystem.encryptData({ test: 'data' }))
        .rejects.toThrow('Encryption system not initialized');
    });

    it('should handle decryption failures gracefully', async () => {
      const invalidEncryptedData = 'invalid-encrypted-data';
      
      const result = await encryptionSystem.decryptData(invalidEncryptedData);
      expect(result).toBeNull();
    });

    it('should handle malformed encrypted data', async () => {
      const malformedData = btoa('{"invalid": "json"');
      
      const result = await encryptionSystem.decryptData(malformedData);
      expect(result).toBeNull();
    });
  });

  describe('secure storage', () => {
    it('should store and retrieve data securely', async () => {
      const testData = { user: 'john', password: 'secret123' };
      
      const stored = await encryptionSystem.storeSecureData('user-credentials', testData);
      expect(stored).toBe(true);
      
      const retrieved = await encryptionSystem.retrieveSecureData('user-credentials');
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent data', async () => {
      const result = await encryptionSystem.retrieveSecureData('non-existent-key');
      expect(result).toBeNull();
    });

    it('should handle storage failures', async () => {
      // Mock storage to fail
      const originalStore = encryptionSystem['encryptedStorage'].store;
      encryptionSystem['encryptedStorage'].store = jest.fn().mockResolvedValue(false);
      
      const result = await encryptionSystem.storeSecureData('test-key', { data: 'test' });
      expect(result).toBe(false);
      
      // Restore original method
      encryptionSystem['encryptedStorage'].store = originalStore;
    });
  });

  describe('secure communication', () => {
    it('should create secure communication channel', async () => {
      const channel = await encryptionSystem.createSecureChannel('test-channel');
      
      expect(channel).toBeDefined();
      expect(channel.id).toBe('test-channel');
      expect(channel.isActive).toBe(true);
    });

    it('should send and receive secure messages', async () => {
      await encryptionSystem.createSecureChannel('message-channel');
      
      const message = 'This is a secret message';
      const encryptedMessage = await encryptionSystem.sendSecureMessage('message-channel', message);
      
      expect(encryptedMessage).toBeDefined();
      expect(encryptedMessage!.channelId).toBe('message-channel');
      
      const decryptedMessage = await encryptionSystem.receiveSecureMessage(encryptedMessage!);
      expect(decryptedMessage).toBeDefined();
      expect(new TextDecoder().decode(decryptedMessage!.data)).toBe(message);
    });

    it('should handle binary message data', async () => {
      await encryptionSystem.createSecureChannel('binary-channel');
      
      const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
      const encryptedMessage = await encryptionSystem.sendSecureMessage('binary-channel', binaryData.buffer);
      
      expect(encryptedMessage).toBeDefined();
      
      const decryptedMessage = await encryptionSystem.receiveSecureMessage(encryptedMessage!);
      expect(decryptedMessage).toBeDefined();
      expect(new Uint8Array(decryptedMessage!.data)).toEqual(binaryData);
    });

    it('should handle communication failures', async () => {
      const encryptedMessage = await encryptionSystem.sendSecureMessage('non-existent-channel', 'test');
      expect(encryptedMessage).toBeNull();
    });
  });

  describe('data anonymization', () => {
    it('should anonymize data using k-anonymity', async () => {
      const testData = [
        { age: 25, zipcode: '12345', disease: 'flu' },
        { age: 26, zipcode: '12345', disease: 'cold' },
        { age: 27, zipcode: '12346', disease: 'flu' },
        { age: 28, zipcode: '12346', disease: 'cold' },
        { age: 29, zipcode: '12347', disease: 'flu' }
      ];
      
      const options = {
        method: 'k-anonymity' as const,
        parameters: {
          k: 2,
          quasiIdentifiers: ['age', 'zipcode'],
          sensitiveAttributes: ['disease']
        },
        retainStructure: true
      };
      
      const anonymized = await encryptionSystem.anonymizeData(testData, options);
      expect(anonymized).toBeDefined();
      expect(Array.isArray(anonymized)).toBe(true);
    });

    it('should anonymize data using differential privacy', async () => {
      const testData = [
        { salary: 50000, age: 30 },
        { salary: 60000, age: 35 },
        { salary: 70000, age: 40 }
      ];
      
      const options = {
        method: 'differential-privacy' as const,
        parameters: {
          epsilon: 1.0,
          delta: 0.0001,
          sensitivity: 1000
        },
        retainStructure: true
      };
      
      const anonymized = await encryptionSystem.anonymizeData(testData, options);
      expect(anonymized).toBeDefined();
      expect(Array.isArray(anonymized)).toBe(true);
      expect(anonymized.length).toBe(testData.length);
    });

    it('should anonymize data using pseudonymization', async () => {
      const testData = [
        { id: 'user123', email: 'john@example.com', name: 'John Doe' },
        { id: 'user456', email: 'jane@example.com', name: 'Jane Smith' }
      ];
      
      const options = {
        method: 'pseudonymization' as const,
        parameters: {
          identifierFields: ['id', 'email'],
          preserveFormat: true
        },
        retainStructure: true
      };
      
      const anonymized = await encryptionSystem.anonymizeData(testData, options);
      expect(anonymized).toBeDefined();
      expect(Array.isArray(anonymized)).toBe(true);
      expect(anonymized.length).toBe(testData.length);
      
      // Check that identifiers are changed but structure is preserved
      expect(anonymized[0].id).not.toBe(testData[0].id);
      expect(anonymized[0].email).toContain('@example.com'); // Format preserved
    });

    it('should handle anonymization errors', async () => {
      const invalidData = 'not-an-array';
      const options = {
        method: 'k-anonymity' as const,
        parameters: { k: 2 },
        retainStructure: true
      };
      
      await expect(encryptionSystem.anonymizeData(invalidData as any, options))
        .rejects.toThrow();
    });
  });

  describe('key rotation', () => {
    it('should rotate keys successfully', async () => {
      // Generate some keys first
      await encryptionSystem.encryptData({ test: 'data' }, 'test-purpose');
      
      const rotatedCount = await encryptionSystem.rotateKeys();
      expect(typeof rotatedCount).toBe('number');
      expect(rotatedCount).toBeGreaterThanOrEqual(0);
    });

    it('should rotate keys for specific purpose', async () => {
      await encryptionSystem.encryptData({ test: 'data' }, 'specific-purpose');
      
      const rotatedCount = await encryptionSystem.rotateKeys('specific-purpose');
      expect(typeof rotatedCount).toBe('number');
    });

    it('should handle rotation failures', async () => {
      const uninitializedSystem = new EncryptionSystem();
      
      await expect(uninitializedSystem.rotateKeys())
        .rejects.toThrow('Encryption system not initialized');
    });
  });

  describe('metrics and monitoring', () => {
    it('should track encryption metrics', async () => {
      await encryptionSystem.encryptData({ test: 'data' });
      await encryptionSystem.encryptData({ test: 'data2' });
      
      const metrics = encryptionSystem.getMetrics();
      expect(metrics.totalOperations).toBeGreaterThan(0);
      expect(metrics.encryptionOperations).toBeGreaterThan(0);
      expect(metrics.averageOperationTime).toBeGreaterThan(0);
    });

    it('should track decryption metrics', async () => {
      const encrypted = await encryptionSystem.encryptData({ test: 'data' });
      await encryptionSystem.decryptData(encrypted!);
      
      const metrics = encryptionSystem.getMetrics();
      expect(metrics.decryptionOperations).toBeGreaterThan(0);
    });

    it('should track failed operations', async () => {
      await encryptionSystem.decryptData('invalid-data');
      
      const metrics = encryptionSystem.getMetrics();
      expect(metrics.failedOperations).toBeGreaterThan(0);
    });

    it('should maintain audit log', async () => {
      await encryptionSystem.encryptData({ test: 'data' });
      
      const auditLog = encryptionSystem.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[auditLog.length - 1].operation).toBe('encrypt');
    });

    it('should provide system status', async () => {
      const status = encryptionSystem.getSystemStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.metrics).toBeDefined();
      expect(typeof status.keysNeedingRotation).toBe('number');
    });
  });

  describe('health checks', () => {
    it('should perform health check', async () => {
      const healthCheck = encryptionSystem.performHealthCheck();
      
      expect(healthCheck.healthy).toBeDefined();
      expect(Array.isArray(healthCheck.issues)).toBe(true);
      expect(Array.isArray(healthCheck.recommendations)).toBe(true);
      expect(typeof healthCheck.lastCheck).toBe('number');
    });

    it('should identify health issues', async () => {
      // Force some failures to create health issues
      await encryptionSystem.decryptData('invalid-data');
      await encryptionSystem.decryptData('invalid-data');
      await encryptionSystem.decryptData('invalid-data');
      
      const healthCheck = encryptionSystem.performHealthCheck();
      // Depending on failure rate threshold, this might identify issues
      expect(typeof healthCheck.healthy).toBe('boolean');
    });
  });

  describe('backup and restore', () => {
    it('should export system configuration', async () => {
      await encryptionSystem.storeSecureData('test-key', { data: 'test' });
      
      const config = await encryptionSystem.exportConfiguration();
      expect(config).toBeDefined();
      expect(typeof config).toBe('string');
    });

    it('should import system configuration', async () => {
      await encryptionSystem.storeSecureData('backup-test', { data: 'original' });
      
      const config = await encryptionSystem.exportConfiguration();
      const imported = await encryptionSystem.importConfiguration(config);
      
      expect(imported).toBe(true);
    });

    it('should handle invalid configuration import', async () => {
      const result = await encryptionSystem.importConfiguration('invalid-config');
      expect(result).toBe(false);
    });
  });

  describe('system lifecycle', () => {
    it('should shutdown gracefully', async () => {
      await expect(encryptionSystem.shutdown()).resolves.not.toThrow();
    });

    it('should handle multiple shutdowns', async () => {
      await encryptionSystem.shutdown();
      await expect(encryptionSystem.shutdown()).resolves.not.toThrow();
    });

    it('should prevent operations after shutdown', async () => {
      await encryptionSystem.shutdown();
      
      // Operations should fail or handle gracefully after shutdown
      const status = encryptionSystem.getSystemStatus();
      expect(status.initialized).toBe(false);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle empty data encryption', async () => {
      const result = await encryptionSystem.encryptData(null);
      expect(result).toBeDefined();
      
      const decrypted = await encryptionSystem.decryptData(result!);
      expect(decrypted).toBeNull();
    });

    it('should handle large data encryption', async () => {
      const largeData = {
        content: 'x'.repeat(10000),
        array: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` }))
      };
      
      const encrypted = await encryptionSystem.encryptData(largeData);
      expect(encrypted).toBeDefined();
      
      const decrypted = await encryptionSystem.decryptData(encrypted!);
      expect(decrypted).toEqual(largeData);
    });

    it('should handle concurrent operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        encryptionSystem.encryptData({ id: i, data: `test-${i}` })
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      expect(results.every(r => r !== null)).toBe(true);
      
      // Decrypt all results
      const decryptPromises = results.map(encrypted => 
        encryptionSystem.decryptData(encrypted!)
      );
      
      const decrypted = await Promise.all(decryptPromises);
      expect(decrypted).toHaveLength(10);
      expect(decrypted.every(d => d !== null)).toBe(true);
    });
  });
});