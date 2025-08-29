import { EncryptionKey, KeyDerivationParams, KeyMetadata } from './types';

/**
 * User-controlled encryption key management system
 * Implements secure key generation, storage, and rotation
 */
export class KeyManager {
  private keys: Map<string, EncryptionKey> = new Map();
  private keyMetadata: Map<string, KeyMetadata> = new Map();
  private masterKey: CryptoKey | null = null;

  /**
   * Initialize key manager with user-provided master key or generate new one
   */
  async initialize(userProvidedKey?: string): Promise<void> {
    if (userProvidedKey) {
      this.masterKey = await this.deriveKeyFromPassword(userProvidedKey);
    } else {
      this.masterKey = await this.generateMasterKey();
    }
  }

  /**
   * Generate a new encryption key for specific purpose
   */
  async generateKey(purpose: string, algorithm: string = 'AES-GCM'): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Key manager not initialized');
    }

    const keyId = `${purpose}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let cryptoKey: CryptoKey;
    
    switch (algorithm) {
      case 'AES-GCM':
        cryptoKey = await crypto.subtle.generateKey(
          {
            name: 'AES-GCM',
            length: 256
          },
          true, // extractable
          ['encrypt', 'decrypt']
        );
        break;
      
      case 'AES-CBC':
        cryptoKey = await crypto.subtle.generateKey(
          {
            name: 'AES-CBC',
            length: 256
          },
          true,
          ['encrypt', 'decrypt']
        );
        break;
      
      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }

    // Export and encrypt the key with master key
    const exportedKey = await crypto.subtle.exportKey('raw', cryptoKey);
    const encryptedKey = await this.encryptWithMasterKey(exportedKey);

    const encryptionKey: EncryptionKey = {
      id: keyId,
      purpose,
      algorithm,
      encryptedKey: Array.from(new Uint8Array(encryptedKey)),
      createdAt: Date.now(),
      expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
      rotationCount: 0
    };

    const metadata: KeyMetadata = {
      keyId,
      purpose,
      algorithm,
      createdAt: encryptionKey.createdAt,
      lastUsed: Date.now(),
      usageCount: 0,
      rotationSchedule: 90 * 24 * 60 * 60 * 1000, // 90 days
      isActive: true
    };

    this.keys.set(keyId, encryptionKey);
    this.keyMetadata.set(keyId, metadata);

    return keyId;
  }

  /**
   * Retrieve decrypted key for use
   */
  async getKey(keyId: string): Promise<CryptoKey | null> {
    if (!this.masterKey) {
      throw new Error('Key manager not initialized');
    }

    const encryptionKey = this.keys.get(keyId);
    const metadata = this.keyMetadata.get(keyId);

    if (!encryptionKey || !metadata || !metadata.isActive) {
      return null;
    }

    // Check expiration
    if (Date.now() > encryptionKey.expiresAt) {
      await this.deactivateKey(keyId);
      return null;
    }

    // Update usage statistics
    metadata.lastUsed = Date.now();
    metadata.usageCount++;

    // Decrypt the key
    const encryptedKeyBuffer = new Uint8Array(encryptionKey.encryptedKey);
    const decryptedKey = await this.decryptWithMasterKey(encryptedKeyBuffer);

    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      decryptedKey,
      {
        name: encryptionKey.algorithm,
        length: 256
      },
      false, // not extractable
      ['encrypt', 'decrypt']
    );

    return cryptoKey;
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(keyId: string): Promise<string> {
    const oldKey = this.keys.get(keyId);
    const oldMetadata = this.keyMetadata.get(keyId);

    if (!oldKey || !oldMetadata) {
      throw new Error('Key not found');
    }

    // Generate new key with same purpose
    const newKeyId = await this.generateKey(oldKey.purpose, oldKey.algorithm);
    
    // Update rotation count
    const newKey = this.keys.get(newKeyId)!;
    newKey.rotationCount = oldKey.rotationCount + 1;

    // Deactivate old key but keep for decryption of old data
    oldMetadata.isActive = false;
    oldMetadata.replacedBy = newKeyId;

    return newKeyId;
  }

  /**
   * Derive key from user password using PBKDF2
   */
  async deriveKeyFromPassword(password: string, salt?: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    if (!salt) {
      salt = crypto.getRandomValues(new Uint8Array(16));
    }

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive key using PBKDF2
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000, // OWASP recommended minimum
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256
      },
      false, // not extractable
      ['encrypt', 'decrypt']
    );

    return derivedKey;
  }

  /**
   * Generate secure master key
   */
  private async generateMasterKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      false, // not extractable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data with master key
   */
  private async encryptWithMasterKey(data: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.masterKey) {
      throw new Error('Master key not available');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      this.masterKey,
      data
    );

    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    return result.buffer;
  }

  /**
   * Decrypt data with master key
   */
  private async decryptWithMasterKey(encryptedData: Uint8Array): Promise<ArrayBuffer> {
    if (!this.masterKey) {
      throw new Error('Master key not available');
    }

    // Extract IV and encrypted data
    const iv = encryptedData.slice(0, 12);
    const encrypted = encryptedData.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      this.masterKey,
      encrypted
    );

    return decrypted;
  }

  /**
   * Deactivate key
   */
  private async deactivateKey(keyId: string): Promise<void> {
    const metadata = this.keyMetadata.get(keyId);
    if (metadata) {
      metadata.isActive = false;
    }
  }

  /**
   * Get all active keys for a purpose
   */
  getActiveKeys(purpose: string): string[] {
    const activeKeys: string[] = [];
    
    for (const [keyId, key] of this.keys.entries()) {
      const metadata = this.keyMetadata.get(keyId);
      if (key.purpose === purpose && metadata?.isActive && Date.now() < key.expiresAt) {
        activeKeys.push(keyId);
      }
    }

    return activeKeys;
  }

  /**
   * Get key metadata
   */
  getKeyMetadata(keyId: string): KeyMetadata | undefined {
    return this.keyMetadata.get(keyId);
  }

  /**
   * Check if key rotation is needed
   */
  needsRotation(keyId: string): boolean {
    const metadata = this.keyMetadata.get(keyId);
    if (!metadata) {
      return false;
    }

    const timeSinceCreation = Date.now() - metadata.createdAt;
    return timeSinceCreation > metadata.rotationSchedule;
  }

  /**
   * Get keys that need rotation
   */
  getKeysNeedingRotation(): string[] {
    const keysToRotate: string[] = [];
    
    for (const [keyId, metadata] of this.keyMetadata.entries()) {
      if (metadata.isActive && this.needsRotation(keyId)) {
        keysToRotate.push(keyId);
      }
    }

    return keysToRotate;
  }

  /**
   * Securely delete key
   */
  async deleteKey(keyId: string): Promise<boolean> {
    const deleted = this.keys.delete(keyId) && this.keyMetadata.delete(keyId);
    
    // In a real implementation, we would also securely wipe memory
    // and ensure the key cannot be recovered
    
    return deleted;
  }

  /**
   * Export encrypted key backup
   */
  async exportKeyBackup(keyId: string): Promise<string | null> {
    const key = this.keys.get(keyId);
    if (!key) {
      return null;
    }

    // Return base64 encoded encrypted key for backup
    const keyData = JSON.stringify(key);
    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(keyData);
    
    const encryptedBackup = await this.encryptWithMasterKey(keyBuffer);
    return btoa(String.fromCharCode(...new Uint8Array(encryptedBackup)));
  }

  /**
   * Import key from backup
   */
  async importKeyBackup(backupData: string): Promise<string | null> {
    try {
      const encryptedData = new Uint8Array(
        atob(backupData).split('').map(char => char.charCodeAt(0))
      );
      
      const decryptedData = await this.decryptWithMasterKey(encryptedData);
      const keyData = new TextDecoder().decode(decryptedData);
      const key: EncryptionKey = JSON.parse(keyData);
      
      this.keys.set(key.id, key);
      
      const metadata: KeyMetadata = {
        keyId: key.id,
        purpose: key.purpose,
        algorithm: key.algorithm,
        createdAt: key.createdAt,
        lastUsed: Date.now(),
        usageCount: 0,
        rotationSchedule: 90 * 24 * 60 * 60 * 1000,
        isActive: true
      };
      
      this.keyMetadata.set(key.id, metadata);
      
      return key.id;
    } catch (error) {
      console.error('Failed to import key backup:', error);
      return null;
    }
  }
}