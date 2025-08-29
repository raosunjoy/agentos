import { KeyManager } from './key-manager';
import { EncryptedStorage } from './encrypted-storage';
import { SecureCommunicationManager } from './secure-communication';
import { PrivacyPreservingProcessor } from './privacy-preserving';
import { EncryptionMetrics, SecurityAuditLog } from './types';

/**
 * Main encryption system orchestrating all encryption components
 * Provides unified interface for all encryption and privacy operations
 */
export class EncryptionSystem {
  private keyManager: KeyManager;
  private encryptedStorage: EncryptedStorage;
  private communicationManager: SecureCommunicationManager;
  private privacyProcessor: PrivacyPreservingProcessor;
  private metrics: EncryptionMetrics;
  private auditLog: SecurityAuditLog[] = [];
  private isInitialized: boolean = false;

  constructor() {
    this.keyManager = new KeyManager();
    this.encryptedStorage = new EncryptedStorage(this.keyManager);
    this.communicationManager = new SecureCommunicationManager(this.keyManager);
    this.privacyProcessor = new PrivacyPreservingProcessor();
    
    this.metrics = {
      totalOperations: 0,
      encryptionOperations: 0,
      decryptionOperations: 0,
      keyRotations: 0,
      failedOperations: 0,
      averageOperationTime: 0,
      lastOperationTime: 0
    };
  }

  /**
   * Initialize the encryption system
   */
  async initialize(userMasterKey?: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const startTime = Date.now();
      
      // Initialize key manager
      await this.keyManager.initialize(userMasterKey);
      
      // Generate initial system keys
      await this.generateSystemKeys();
      
      this.isInitialized = true;
      
      const operationTime = Date.now() - startTime;
      this.updateMetrics('initialization', operationTime, true);
      
      this.logOperation('system-initialization', undefined, 'system', true);
      
      console.log('Encryption system initialized successfully');
    } catch (error) {
      this.updateMetrics('initialization', 0, false);
      this.logOperation('system-initialization', undefined, 'system', false, error.message);
      throw new Error(`Failed to initialize encryption system: ${error.message}`);
    }
  }

  /**
   * Encrypt data with specified options
   */
  async encryptData(
    data: any, 
    purpose: string = 'general',
    options: EncryptionOptions = {}
  ): Promise<string | null> {
    if (!this.isInitialized) {
      throw new Error('Encryption system not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Generate or get encryption key for purpose
      let keyId = options.keyId;
      if (!keyId) {
        const activeKeys = this.keyManager.getActiveKeys(purpose);
        if (activeKeys.length === 0) {
          keyId = await this.keyManager.generateKey(purpose, options.algorithm || 'AES-GCM');
        } else {
          keyId = activeKeys[0];
        }
      }

      // Serialize and encrypt data
      const serializedData = JSON.stringify(data);
      const dataBuffer = new TextEncoder().encode(serializedData);
      
      const cryptoKey = await this.keyManager.getKey(keyId);
      if (!cryptoKey) {
        throw new Error('Failed to retrieve encryption key');
      }

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        {
          name: options.algorithm || 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        dataBuffer
      );

      // Create encrypted data package
      const encryptedPackage = {
        keyId,
        algorithm: options.algorithm || 'AES-GCM',
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted)),
        timestamp: Date.now()
      };

      const result = btoa(JSON.stringify(encryptedPackage));
      
      const operationTime = Date.now() - startTime;
      this.updateMetrics('encrypt', operationTime, true);
      this.logOperation('encrypt', keyId, 'user', true);
      
      return result;

    } catch (error) {
      const operationTime = Date.now() - startTime;
      this.updateMetrics('encrypt', operationTime, false);
      this.logOperation('encrypt', undefined, 'user', false, error.message);
      
      console.error('Encryption failed:', error);
      return null;
    }
  }

  /**
   * Decrypt data
   */
  async decryptData(encryptedData: string): Promise<any | null> {
    if (!this.isInitialized) {
      throw new Error('Encryption system not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Parse encrypted package
      const encryptedPackage = JSON.parse(atob(encryptedData));
      
      // Get decryption key
      const cryptoKey = await this.keyManager.getKey(encryptedPackage.keyId);
      if (!cryptoKey) {
        throw new Error('Decryption key not available');
      }

      // Decrypt data
      const iv = new Uint8Array(encryptedPackage.iv);
      const data = new Uint8Array(encryptedPackage.data);
      
      const decrypted = await crypto.subtle.decrypt(
        {
          name: encryptedPackage.algorithm,
          iv: iv
        },
        cryptoKey,
        data
      );

      // Deserialize
      const jsonString = new TextDecoder().decode(decrypted);
      const result = JSON.parse(jsonString);
      
      const operationTime = Date.now() - startTime;
      this.updateMetrics('decrypt', operationTime, true);
      this.logOperation('decrypt', encryptedPackage.keyId, 'user', true);
      
      return result;

    } catch (error) {
      const operationTime = Date.now() - startTime;
      this.updateMetrics('decrypt', operationTime, false);
      this.logOperation('decrypt', undefined, 'user', false, error.message);
      
      console.error('Decryption failed:', error);
      return null;
    }
  }

  /**
   * Store encrypted data
   */
  async storeSecureData(key: string, data: any, options: any = {}): Promise<boolean> {
    return await this.encryptedStorage.store(key, data, options);
  }

  /**
   * Retrieve encrypted data
   */
  async retrieveSecureData(key: string): Promise<any | null> {
    return await this.encryptedStorage.retrieve(key);
  }

  /**
   * Create secure communication channel
   */
  async createSecureChannel(
    channelId: string, 
    type: 'end-to-end' | 'transport' | 'application' = 'end-to-end',
    remotePublicKey?: ArrayBuffer
  ) {
    return await this.communicationManager.createChannel(channelId, type, remotePublicKey);
  }

  /**
   * Send encrypted message
   */
  async sendSecureMessage(
    channelId: string, 
    message: string | ArrayBuffer,
    associatedData?: ArrayBuffer
  ) {
    return await this.communicationManager.encryptMessage(channelId, message, associatedData);
  }

  /**
   * Receive and decrypt message
   */
  async receiveSecureMessage(encryptedMessage: any) {
    return await this.communicationManager.decryptMessage(encryptedMessage);
  }

  /**
   * Anonymize data for privacy
   */
  async anonymizeData(data: any[], options: any) {
    const startTime = Date.now();
    
    try {
      const result = await this.privacyProcessor.anonymizeData(data, options);
      
      const operationTime = Date.now() - startTime;
      this.updateMetrics('anonymization', operationTime, true);
      this.logOperation('anonymization', undefined, 'user', true);
      
      return result;
    } catch (error) {
      const operationTime = Date.now() - startTime;
      this.updateMetrics('anonymization', operationTime, false);
      this.logOperation('anonymization', undefined, 'user', false, error.message);
      
      throw error;
    }
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(purpose?: string): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('Encryption system not initialized');
    }

    const startTime = Date.now();
    
    try {
      let rotatedCount = 0;
      
      if (purpose) {
        // Rotate keys for specific purpose
        const activeKeys = this.keyManager.getActiveKeys(purpose);
        for (const keyId of activeKeys) {
          if (this.keyManager.needsRotation(keyId)) {
            await this.keyManager.rotateKey(keyId);
            rotatedCount++;
          }
        }
      } else {
        // Rotate all keys that need rotation
        const keysToRotate = this.keyManager.getKeysNeedingRotation();
        for (const keyId of keysToRotate) {
          await this.keyManager.rotateKey(keyId);
          rotatedCount++;
        }
      }

      // Rotate storage keys
      const storageRotated = await this.encryptedStorage.rotateKeys();
      rotatedCount += storageRotated;

      const operationTime = Date.now() - startTime;
      this.metrics.keyRotations += rotatedCount;
      this.updateMetrics('key-rotation', operationTime, true);
      this.logOperation('key-rotation', undefined, 'system', true, undefined, { rotatedCount });

      return rotatedCount;

    } catch (error) {
      const operationTime = Date.now() - startTime;
      this.updateMetrics('key-rotation', operationTime, false);
      this.logOperation('key-rotation', undefined, 'system', false, error.message);
      
      throw new Error(`Key rotation failed: ${error.message}`);
    }
  }

  /**
   * Generate system keys
   */
  private async generateSystemKeys(): Promise<void> {
    // Generate keys for different purposes
    const purposes = ['storage', 'communication', 'backup', 'audit'];
    
    for (const purpose of purposes) {
      const activeKeys = this.keyManager.getActiveKeys(purpose);
      if (activeKeys.length === 0) {
        await this.keyManager.generateKey(purpose, 'AES-GCM');
      }
    }
  }

  /**
   * Update operation metrics
   */
  private updateMetrics(operation: string, operationTime: number, success: boolean): void {
    this.metrics.totalOperations++;
    this.metrics.lastOperationTime = operationTime;
    
    if (success) {
      if (operation === 'encrypt') {
        this.metrics.encryptionOperations++;
      } else if (operation === 'decrypt') {
        this.metrics.decryptionOperations++;
      }
      
      // Update average operation time
      const totalSuccessfulOps = this.metrics.totalOperations - this.metrics.failedOperations;
      this.metrics.averageOperationTime = 
        (this.metrics.averageOperationTime * (totalSuccessfulOps - 1) + operationTime) / totalSuccessfulOps;
    } else {
      this.metrics.failedOperations++;
    }
  }

  /**
   * Log security operation
   */
  private logOperation(
    operation: string,
    keyId: string | undefined,
    userId: string,
    success: boolean,
    errorMessage?: string,
    metadata?: any
  ): void {
    const logEntry: SecurityAuditLog = {
      id: `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation: operation as any,
      keyId,
      userId,
      timestamp: Date.now(),
      success,
      errorMessage,
      metadata
    };

    this.auditLog.push(logEntry);

    // Keep only recent logs (last 1000 entries)
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  /**
   * Get encryption metrics
   */
  getMetrics(): EncryptionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get security audit log
   */
  getAuditLog(limit: number = 100): SecurityAuditLog[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get system status
   */
  getSystemStatus(): EncryptionSystemStatus {
    const storageStats = this.encryptedStorage.getStats();
    const channelStats = this.communicationManager.getChannelStats();
    
    return {
      initialized: this.isInitialized,
      metrics: this.metrics,
      storage: storageStats,
      communication: channelStats,
      keysNeedingRotation: this.keyManager.getKeysNeedingRotation().length,
      lastAuditEntry: this.auditLog[this.auditLog.length - 1]?.timestamp || 0
    };
  }

  /**
   * Export system configuration for backup
   */
  async exportConfiguration(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Encryption system not initialized');
    }

    const config = {
      version: '1.0',
      timestamp: Date.now(),
      metrics: this.metrics,
      auditLog: this.auditLog.slice(-100), // Last 100 entries
      storageBackup: await this.encryptedStorage.createBackup()
    };

    return btoa(JSON.stringify(config));
  }

  /**
   * Import system configuration from backup
   */
  async importConfiguration(configString: string): Promise<boolean> {
    try {
      const config = JSON.parse(atob(configString));
      
      // Restore storage
      if (config.storageBackup) {
        await this.encryptedStorage.restoreFromBackup(config.storageBackup);
      }

      // Restore audit log
      if (config.auditLog) {
        this.auditLog = [...this.auditLog, ...config.auditLog];
      }

      return true;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  }

  /**
   * Perform security health check
   */
  performHealthCheck(): EncryptionHealthCheck {
    const keysNeedingRotation = this.keyManager.getKeysNeedingRotation();
    const failureRate = this.metrics.totalOperations > 0 ? 
      this.metrics.failedOperations / this.metrics.totalOperations : 0;
    
    const issues: string[] = [];
    
    if (keysNeedingRotation.length > 0) {
      issues.push(`${keysNeedingRotation.length} keys need rotation`);
    }
    
    if (failureRate > 0.05) { // More than 5% failure rate
      issues.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`);
    }
    
    if (this.auditLog.length === 0) {
      issues.push('No audit log entries found');
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations: this.generateHealthRecommendations(issues),
      lastCheck: Date.now()
    };
  }

  /**
   * Generate health recommendations
   */
  private generateHealthRecommendations(issues: string[]): string[] {
    const recommendations: string[] = [];
    
    for (const issue of issues) {
      if (issue.includes('keys need rotation')) {
        recommendations.push('Run key rotation process to maintain security');
      } else if (issue.includes('failure rate')) {
        recommendations.push('Investigate encryption failures and system performance');
      } else if (issue.includes('audit log')) {
        recommendations.push('Ensure audit logging is properly configured');
      }
    }
    
    return recommendations;
  }

  /**
   * Shutdown encryption system
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    // Close all communication channels
    const activeChannels = this.communicationManager.getActiveChannels();
    for (const channel of activeChannels) {
      await this.communicationManager.closeChannel(channel.id);
    }

    // Clear sensitive data from memory
    this.privacyProcessor.clearCache();

    this.isInitialized = false;
    this.logOperation('system-shutdown', undefined, 'system', true);
    
    console.log('Encryption system shutdown complete');
  }
}

interface EncryptionOptions {
  algorithm?: 'AES-GCM' | 'AES-CBC';
  keyId?: string;
  associatedData?: ArrayBuffer;
}

interface EncryptionSystemStatus {
  initialized: boolean;
  metrics: EncryptionMetrics;
  storage: any;
  communication: any;
  keysNeedingRotation: number;
  lastAuditEntry: number;
}

interface EncryptionHealthCheck {
  healthy: boolean;
  issues: string[];
  recommendations: string[];
  lastCheck: number;
}