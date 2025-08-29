import { KeyManager } from './key-manager';
import { EncryptedData, EncryptionOptions, DecryptionResult, SecureStorageOptions } from './types';

/**
 * Encrypted data storage with secure key management
 * Provides transparent encryption/decryption for sensitive data
 */
export class EncryptedStorage {
  private keyManager: KeyManager;
  private options: SecureStorageOptions;
  private storage: Map<string, EncryptedData> = new Map();

  constructor(keyManager: KeyManager, options: Partial<SecureStorageOptions> = {}) {
    this.keyManager = keyManager;
    this.options = {
      encryptionEnabled: true,
      compressionEnabled: false,
      integrityCheckEnabled: true,
      keyRotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
      ...options
    };
  }

  /**
   * Store encrypted data
   */
  async store(key: string, data: any, options: EncryptionOptions = {}): Promise<boolean> {
    try {
      if (!this.options.encryptionEnabled) {
        // Store unencrypted if encryption is disabled
        this.storage.set(key, {
          algorithm: 'none',
          keyId: '',
          iv: [],
          data: Array.from(new TextEncoder().encode(JSON.stringify(data))),
          metadata: { encrypted: false }
        });
        return true;
      }

      // Serialize data
      let serializedData = JSON.stringify(data);
      let dataBuffer = new TextEncoder().encode(serializedData);

      // Compress if enabled
      if (this.options.compressionEnabled || options.compressionEnabled) {
        dataBuffer = await this.compressData(dataBuffer);
      }

      // Get or generate encryption key
      let keyId = options.keyId;
      if (!keyId) {
        const activeKeys = this.keyManager.getActiveKeys('storage');
        if (activeKeys.length === 0) {
          keyId = await this.keyManager.generateKey('storage', options.algorithm || 'AES-GCM');
        } else {
          keyId = activeKeys[0];
        }
      }

      const cryptoKey = await this.keyManager.getKey(keyId);
      if (!cryptoKey) {
        throw new Error('Failed to retrieve encryption key');
      }

      // Encrypt data
      const encryptedResult = await this.encryptData(dataBuffer, cryptoKey, options);
      
      const encryptedData: EncryptedData = {
        algorithm: options.algorithm || 'AES-GCM',
        keyId: keyId,
        iv: Array.from(encryptedResult.iv),
        data: Array.from(new Uint8Array(encryptedResult.data)),
        authTag: encryptedResult.authTag ? Array.from(encryptedResult.authTag) : undefined,
        metadata: {
          compressed: this.options.compressionEnabled || options.compressionEnabled,
          timestamp: Date.now(),
          originalSize: dataBuffer.byteLength
        }
      };

      this.storage.set(key, encryptedData);
      return true;

    } catch (error) {
      console.error('Failed to store encrypted data:', error);
      return false;
    }
  }

  /**
   * Retrieve and decrypt data
   */
  async retrieve(key: string): Promise<any | null> {
    try {
      const encryptedData = this.storage.get(key);
      if (!encryptedData) {
        return null;
      }

      // Handle unencrypted data
      if (encryptedData.algorithm === 'none') {
        const dataBuffer = new Uint8Array(encryptedData.data);
        const jsonString = new TextDecoder().decode(dataBuffer);
        return JSON.parse(jsonString);
      }

      // Get decryption key
      const cryptoKey = await this.keyManager.getKey(encryptedData.keyId);
      if (!cryptoKey) {
        throw new Error('Decryption key not available');
      }

      // Decrypt data
      const decryptedBuffer = await this.decryptData(encryptedData, cryptoKey);

      // Decompress if needed
      let finalBuffer = decryptedBuffer;
      if (encryptedData.metadata?.compressed) {
        finalBuffer = await this.decompressData(decryptedBuffer);
      }

      // Deserialize
      const jsonString = new TextDecoder().decode(finalBuffer);
      return JSON.parse(jsonString);

    } catch (error) {
      console.error('Failed to retrieve encrypted data:', error);
      return null;
    }
  }

  /**
   * Delete encrypted data
   */
  async delete(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.storage.has(key);
  }

  /**
   * List all stored keys
   */
  keys(): string[] {
    return Array.from(this.storage.keys());
  }

  /**
   * Get storage statistics
   */
  getStats(): StorageStats {
    let totalSize = 0;
    let encryptedCount = 0;
    let compressedCount = 0;

    for (const [key, data] of this.storage.entries()) {
      totalSize += data.data.length;
      if (data.algorithm !== 'none') {
        encryptedCount++;
      }
      if (data.metadata?.compressed) {
        compressedCount++;
      }
    }

    return {
      totalEntries: this.storage.size,
      totalSize,
      encryptedEntries: encryptedCount,
      compressedEntries: compressedCount,
      encryptionEnabled: this.options.encryptionEnabled
    };
  }

  /**
   * Rotate encryption keys for all stored data
   */
  async rotateKeys(): Promise<number> {
    let rotatedCount = 0;
    const keysToRotate = this.keyManager.getKeysNeedingRotation();

    for (const oldKeyId of keysToRotate) {
      try {
        // Generate new key
        const keyMetadata = this.keyManager.getKeyMetadata(oldKeyId);
        if (!keyMetadata) continue;

        const newKeyId = await this.keyManager.rotateKey(oldKeyId);

        // Re-encrypt all data using the old key
        for (const [storageKey, encryptedData] of this.storage.entries()) {
          if (encryptedData.keyId === oldKeyId) {
            // Decrypt with old key
            const oldCryptoKey = await this.keyManager.getKey(oldKeyId);
            if (!oldCryptoKey) continue;

            const decryptedData = await this.decryptData(encryptedData, oldCryptoKey);

            // Encrypt with new key
            const newCryptoKey = await this.keyManager.getKey(newKeyId);
            if (!newCryptoKey) continue;

            const reencryptedResult = await this.encryptData(decryptedData, newCryptoKey, {
              algorithm: encryptedData.algorithm as any
            });

            // Update stored data
            const updatedData: EncryptedData = {
              ...encryptedData,
              keyId: newKeyId,
              iv: Array.from(reencryptedResult.iv),
              data: Array.from(new Uint8Array(reencryptedResult.data)),
              authTag: reencryptedResult.authTag ? Array.from(reencryptedResult.authTag) : undefined
            };

            this.storage.set(storageKey, updatedData);
          }
        }

        rotatedCount++;
      } catch (error) {
        console.error(`Failed to rotate key ${oldKeyId}:`, error);
      }
    }

    return rotatedCount;
  }

  /**
   * Encrypt data buffer
   */
  private async encryptData(
    data: ArrayBuffer, 
    key: CryptoKey, 
    options: EncryptionOptions
  ): Promise<EncryptionResult> {
    const algorithm = options.algorithm || 'AES-GCM';
    const iv = crypto.getRandomValues(new Uint8Array(algorithm === 'AES-GCM' ? 12 : 16));

    let encryptParams: any = {
      name: algorithm,
      iv: iv
    };

    // Add associated data for AEAD
    if (algorithm === 'AES-GCM' && options.associatedData) {
      encryptParams.additionalData = options.associatedData;
    }

    const encrypted = await crypto.subtle.encrypt(encryptParams, key, data);

    const result: EncryptionResult = {
      iv: iv,
      data: encrypted
    };

    // Extract auth tag for GCM mode
    if (algorithm === 'AES-GCM') {
      // In GCM mode, the auth tag is included in the encrypted data
      // For explicit handling, we could separate it, but Web Crypto API handles it internally
    }

    return result;
  }

  /**
   * Decrypt data
   */
  private async decryptData(encryptedData: EncryptedData, key: CryptoKey): Promise<ArrayBuffer> {
    const iv = new Uint8Array(encryptedData.iv);
    const data = new Uint8Array(encryptedData.data);

    let decryptParams: any = {
      name: encryptedData.algorithm,
      iv: iv
    };

    const decrypted = await crypto.subtle.decrypt(decryptParams, key, data);
    return decrypted;
  }

  /**
   * Compress data using gzip (simulated)
   */
  private async compressData(data: ArrayBuffer): Promise<ArrayBuffer> {
    // In a real implementation, this would use actual compression
    // For now, we'll just return the original data
    // In browser environment, you could use CompressionStream API
    return data;
  }

  /**
   * Decompress data
   */
  private async decompressData(data: ArrayBuffer): Promise<ArrayBuffer> {
    // In a real implementation, this would decompress the data
    return data;
  }

  /**
   * Backup encrypted storage
   */
  async createBackup(): Promise<string> {
    const backupData = {
      version: '1.0',
      timestamp: Date.now(),
      options: this.options,
      data: Array.from(this.storage.entries())
    };

    const backupJson = JSON.stringify(backupData);
    const backupBuffer = new TextEncoder().encode(backupJson);

    // Encrypt backup with a storage key
    const backupKeyId = await this.keyManager.generateKey('backup', 'AES-GCM');
    const backupKey = await this.keyManager.getKey(backupKeyId);
    
    if (!backupKey) {
      throw new Error('Failed to generate backup key');
    }

    const encryptedBackup = await this.encryptData(backupBuffer, backupKey, {});
    
    const finalBackup = {
      keyId: backupKeyId,
      iv: Array.from(encryptedBackup.iv),
      data: Array.from(new Uint8Array(encryptedBackup.data))
    };

    return btoa(JSON.stringify(finalBackup));
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupString: string): Promise<boolean> {
    try {
      const backupData = JSON.parse(atob(backupString));
      
      const backupKey = await this.keyManager.getKey(backupData.keyId);
      if (!backupKey) {
        throw new Error('Backup decryption key not available');
      }

      const encryptedData: EncryptedData = {
        algorithm: 'AES-GCM',
        keyId: backupData.keyId,
        iv: backupData.iv,
        data: backupData.data
      };

      const decryptedBuffer = await this.decryptData(encryptedData, backupKey);
      const backupJson = new TextDecoder().decode(decryptedBuffer);
      const backup = JSON.parse(backupJson);

      // Restore storage
      this.storage.clear();
      for (const [key, value] of backup.data) {
        this.storage.set(key, value);
      }

      // Update options
      this.options = { ...this.options, ...backup.options };

      return true;
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return false;
    }
  }
}

interface EncryptionResult {
  iv: Uint8Array;
  data: ArrayBuffer;
  authTag?: Uint8Array;
}

interface StorageStats {
  totalEntries: number;
  totalSize: number;
  encryptedEntries: number;
  compressedEntries: number;
  encryptionEnabled: boolean;
}