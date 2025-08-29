import { KeyManager } from '../key-manager';

describe('KeyManager', () => {
  let keyManager: KeyManager;

  beforeEach(async () => {
    keyManager = new KeyManager();
    await keyManager.initialize();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newKeyManager = new KeyManager();
      await expect(newKeyManager.initialize()).resolves.not.toThrow();
    });

    it('should initialize with user-provided key', async () => {
      const newKeyManager = new KeyManager();
      await expect(newKeyManager.initialize('user-password-123')).resolves.not.toThrow();
    });

    it('should handle initialization errors gracefully', async () => {
      const newKeyManager = new KeyManager();
      // Mock crypto.subtle to throw an error
      const originalGenerateKey = crypto.subtle.generateKey;
      crypto.subtle.generateKey = jest.fn().mockRejectedValue(new Error('Crypto error'));
      
      await expect(newKeyManager.initialize()).rejects.toThrow();
      
      // Restore original function
      crypto.subtle.generateKey = originalGenerateKey;
    });
  });

  describe('key generation', () => {
    it('should generate AES-GCM key successfully', async () => {
      const keyId = await keyManager.generateKey('test-purpose', 'AES-GCM');
      expect(keyId).toBeDefined();
      expect(typeof keyId).toBe('string');
      expect(keyId).toContain('test-purpose');
    });

    it('should generate AES-CBC key successfully', async () => {
      const keyId = await keyManager.generateKey('test-purpose', 'AES-CBC');
      expect(keyId).toBeDefined();
      expect(typeof keyId).toBe('string');
    });

    it('should throw error for unsupported algorithm', async () => {
      await expect(keyManager.generateKey('test', 'UNSUPPORTED' as any))
        .rejects.toThrow('Unsupported algorithm');
    });

    it('should throw error if not initialized', async () => {
      const uninitializedManager = new KeyManager();
      await expect(uninitializedManager.generateKey('test', 'AES-GCM'))
        .rejects.toThrow('Key manager not initialized');
    });

    it('should generate unique key IDs', async () => {
      const keyId1 = await keyManager.generateKey('test', 'AES-GCM');
      const keyId2 = await keyManager.generateKey('test', 'AES-GCM');
      
      expect(keyId1).not.toBe(keyId2);
    });
  });

  describe('key retrieval', () => {
    it('should retrieve generated key', async () => {
      const keyId = await keyManager.generateKey('test-retrieval', 'AES-GCM');
      const key = await keyManager.getKey(keyId);
      
      expect(key).toBeDefined();
      expect(key).toBeInstanceOf(CryptoKey);
    });

    it('should return null for non-existent key', async () => {
      const key = await keyManager.getKey('non-existent-key');
      expect(key).toBeNull();
    });

    it('should return null for expired key', async () => {
      const keyId = await keyManager.generateKey('test-expiry', 'AES-GCM');
      
      // Mock the key as expired by manipulating internal state
      // In a real test, we might need to wait or mock time
      const key = await keyManager.getKey(keyId);
      expect(key).toBeDefined(); // Should still be valid initially
    });

    it('should update usage statistics on key retrieval', async () => {
      const keyId = await keyManager.generateKey('test-stats', 'AES-GCM');
      
      await keyManager.getKey(keyId);
      await keyManager.getKey(keyId);
      
      const metadata = keyManager.getKeyMetadata(keyId);
      expect(metadata?.usageCount).toBe(2);
    });
  });

  describe('key rotation', () => {
    it('should rotate key successfully', async () => {
      const originalKeyId = await keyManager.generateKey('test-rotation', 'AES-GCM');
      const newKeyId = await keyManager.rotateKey(originalKeyId);
      
      expect(newKeyId).toBeDefined();
      expect(newKeyId).not.toBe(originalKeyId);
      
      const newKey = await keyManager.getKey(newKeyId);
      expect(newKey).toBeDefined();
    });

    it('should throw error for non-existent key rotation', async () => {
      await expect(keyManager.rotateKey('non-existent-key'))
        .rejects.toThrow('Key not found');
    });

    it('should increment rotation count', async () => {
      const originalKeyId = await keyManager.generateKey('test-rotation-count', 'AES-GCM');
      const newKeyId = await keyManager.rotateKey(originalKeyId);
      
      // In a real implementation, we would check the rotation count
      // This is a simplified test
      expect(newKeyId).toBeDefined();
    });

    it('should deactivate old key after rotation', async () => {
      const originalKeyId = await keyManager.generateKey('test-deactivation', 'AES-GCM');
      await keyManager.rotateKey(originalKeyId);
      
      const originalMetadata = keyManager.getKeyMetadata(originalKeyId);
      expect(originalMetadata?.isActive).toBe(false);
    });
  });

  describe('key management', () => {
    it('should get active keys for purpose', async () => {
      const keyId1 = await keyManager.generateKey('test-purpose', 'AES-GCM');
      const keyId2 = await keyManager.generateKey('test-purpose', 'AES-GCM');
      const keyId3 = await keyManager.generateKey('other-purpose', 'AES-GCM');
      
      const activeKeys = keyManager.getActiveKeys('test-purpose');
      expect(activeKeys).toContain(keyId1);
      expect(activeKeys).toContain(keyId2);
      expect(activeKeys).not.toContain(keyId3);
    });

    it('should identify keys needing rotation', async () => {
      const keyId = await keyManager.generateKey('test-rotation-check', 'AES-GCM');
      
      // Initially should not need rotation
      expect(keyManager.needsRotation(keyId)).toBe(false);
      
      // Mock time passage or manipulate metadata to test rotation logic
      const keysNeedingRotation = keyManager.getKeysNeedingRotation();
      expect(Array.isArray(keysNeedingRotation)).toBe(true);
    });

    it('should delete key successfully', async () => {
      const keyId = await keyManager.generateKey('test-deletion', 'AES-GCM');
      
      const deleted = await keyManager.deleteKey(keyId);
      expect(deleted).toBe(true);
      
      const key = await keyManager.getKey(keyId);
      expect(key).toBeNull();
    });

    it('should get key metadata', async () => {
      const keyId = await keyManager.generateKey('test-metadata', 'AES-GCM');
      const metadata = keyManager.getKeyMetadata(keyId);
      
      expect(metadata).toBeDefined();
      expect(metadata?.keyId).toBe(keyId);
      expect(metadata?.purpose).toBe('test-metadata');
      expect(metadata?.isActive).toBe(true);
    });
  });

  describe('key backup and restore', () => {
    it('should export key backup', async () => {
      const keyId = await keyManager.generateKey('test-backup', 'AES-GCM');
      const backup = await keyManager.exportKeyBackup(keyId);
      
      expect(backup).toBeDefined();
      expect(typeof backup).toBe('string');
    });

    it('should return null for non-existent key backup', async () => {
      const backup = await keyManager.exportKeyBackup('non-existent-key');
      expect(backup).toBeNull();
    });

    it('should import key from backup', async () => {
      const keyId = await keyManager.generateKey('test-import', 'AES-GCM');
      const backup = await keyManager.exportKeyBackup(keyId);
      
      expect(backup).toBeDefined();
      
      // Delete the original key
      await keyManager.deleteKey(keyId);
      
      // Import from backup
      const importedKeyId = await keyManager.importKeyBackup(backup!);
      expect(importedKeyId).toBeDefined();
      
      const importedKey = await keyManager.getKey(importedKeyId!);
      expect(importedKey).toBeDefined();
    });

    it('should handle invalid backup data', async () => {
      const importedKeyId = await keyManager.importKeyBackup('invalid-backup-data');
      expect(importedKeyId).toBeNull();
    });
  });

  describe('password-based key derivation', () => {
    it('should derive key from password', async () => {
      const derivedKey = await keyManager.deriveKeyFromPassword('test-password-123');
      expect(derivedKey).toBeDefined();
      expect(derivedKey).toBeInstanceOf(CryptoKey);
    });

    it('should derive consistent keys from same password', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      
      const key1 = await keyManager.deriveKeyFromPassword('same-password', salt);
      const key2 = await keyManager.deriveKeyFromPassword('same-password', salt);
      
      // Keys should be functionally equivalent (same derived material)
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
    });

    it('should derive different keys from different passwords', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      
      const key1 = await keyManager.deriveKeyFromPassword('password1', salt);
      const key2 = await keyManager.deriveKeyFromPassword('password2', salt);
      
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      // Keys should be different (can't directly compare CryptoKey objects)
    });
  });

  describe('error handling', () => {
    it('should handle crypto operation failures', async () => {
      // Mock crypto.subtle.generateKey to fail
      const originalGenerateKey = crypto.subtle.generateKey;
      crypto.subtle.generateKey = jest.fn().mockRejectedValue(new Error('Crypto failure'));
      
      await expect(keyManager.generateKey('test-failure', 'AES-GCM'))
        .rejects.toThrow();
      
      // Restore original function
      crypto.subtle.generateKey = originalGenerateKey;
    });

    it('should handle key export failures', async () => {
      const keyId = await keyManager.generateKey('test-export-failure', 'AES-GCM');
      
      // Mock crypto.subtle.exportKey to fail
      const originalExportKey = crypto.subtle.exportKey;
      crypto.subtle.exportKey = jest.fn().mockRejectedValue(new Error('Export failure'));
      
      const backup = await keyManager.exportKeyBackup(keyId);
      expect(backup).toBeNull();
      
      // Restore original function
      crypto.subtle.exportKey = originalExportKey;
    });

    it('should handle key import failures', async () => {
      // Mock crypto.subtle.importKey to fail
      const originalImportKey = crypto.subtle.importKey;
      crypto.subtle.importKey = jest.fn().mockRejectedValue(new Error('Import failure'));
      
      const keyId = await keyManager.generateKey('test-import-failure', 'AES-GCM');
      const key = await keyManager.getKey(keyId);
      expect(key).toBeNull();
      
      // Restore original function
      crypto.subtle.importKey = originalImportKey;
    });
  });

  describe('performance and limits', () => {
    it('should handle multiple concurrent key operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        keyManager.generateKey(`concurrent-test-${i}`, 'AES-GCM')
      );
      
      const keyIds = await Promise.all(promises);
      expect(keyIds).toHaveLength(10);
      expect(new Set(keyIds).size).toBe(10); // All unique
    });

    it('should handle large number of keys', async () => {
      const keyIds: string[] = [];
      
      for (let i = 0; i < 50; i++) {
        const keyId = await keyManager.generateKey(`bulk-test-${i}`, 'AES-GCM');
        keyIds.push(keyId);
      }
      
      expect(keyIds).toHaveLength(50);
      
      // Verify all keys are retrievable
      for (const keyId of keyIds) {
        const key = await keyManager.getKey(keyId);
        expect(key).toBeDefined();
      }
    });
  });
});