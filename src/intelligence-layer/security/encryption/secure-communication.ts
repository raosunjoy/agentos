import { KeyManager } from './key-manager';
import { 
  SecureCommunicationChannel, 
  KeyExchangeParams, 
  DigitalSignature, 
  CertificateInfo 
} from './types';

/**
 * Secure communication channels for sensitive operations
 * Implements end-to-end encryption and key exchange protocols
 */
export class SecureCommunicationManager {
  private keyManager: KeyManager;
  private channels: Map<string, SecureCommunicationChannel> = new Map();
  private keyPairs: Map<string, CryptoKeyPair> = new Map();

  constructor(keyManager: KeyManager) {
    this.keyManager = keyManager;
  }

  /**
   * Create a new secure communication channel
   */
  async createChannel(
    channelId: string,
    type: 'end-to-end' | 'transport' | 'application',
    remotePublicKey?: ArrayBuffer
  ): Promise<SecureCommunicationChannel> {
    // Generate key pair for this channel
    const keyPair = await this.generateKeyPair();
    this.keyPairs.set(channelId, keyPair);

    let sharedSecret: CryptoKey | null = null;
    
    if (remotePublicKey && type === 'end-to-end') {
      // Perform key exchange
      sharedSecret = await this.performKeyExchange(keyPair.privateKey, remotePublicKey);
    }

    const channel: SecureCommunicationChannel = {
      id: channelId,
      type,
      encryptionAlgorithm: 'AES-GCM',
      keyExchangeMethod: 'ECDH',
      authenticationMethod: 'ECDSA',
      isActive: true,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };

    this.channels.set(channelId, channel);

    // Store shared secret if available
    if (sharedSecret) {
      const keyId = await this.storeSharedSecret(channelId, sharedSecret);
      // Associate key with channel (in metadata or separate mapping)
    }

    return channel;
  }

  /**
   * Encrypt message for secure channel
   */
  async encryptMessage(
    channelId: string, 
    message: string | ArrayBuffer,
    associatedData?: ArrayBuffer
  ): Promise<EncryptedMessage | null> {
    const channel = this.channels.get(channelId);
    if (!channel || !channel.isActive) {
      return null;
    }

    try {
      // Get encryption key for channel
      const encryptionKey = await this.getChannelEncryptionKey(channelId);
      if (!encryptionKey) {
        throw new Error('No encryption key available for channel');
      }

      // Convert message to ArrayBuffer if needed
      let messageBuffer: ArrayBuffer;
      if (typeof message === 'string') {
        messageBuffer = new TextEncoder().encode(message);
      } else {
        messageBuffer = message;
      }

      // Generate IV
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt message
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          additionalData: associatedData
        },
        encryptionKey,
        messageBuffer
      );

      // Create digital signature
      const signature = await this.signMessage(channelId, messageBuffer);

      const encryptedMessage: EncryptedMessage = {
        channelId,
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted)),
        signature: signature ? {
          algorithm: signature.algorithm,
          signature: Array.from(new Uint8Array(signature.signature)),
          publicKey: Array.from(new Uint8Array(signature.publicKey)),
          timestamp: signature.timestamp
        } : undefined,
        timestamp: Date.now(),
        associatedData: associatedData ? Array.from(new Uint8Array(associatedData)) : undefined
      };

      // Update channel usage
      channel.lastUsed = Date.now();

      return encryptedMessage;

    } catch (error) {
      console.error('Failed to encrypt message:', error);
      return null;
    }
  }

  /**
   * Decrypt message from secure channel
   */
  async decryptMessage(encryptedMessage: EncryptedMessage): Promise<DecryptedMessage | null> {
    const channel = this.channels.get(encryptedMessage.channelId);
    if (!channel || !channel.isActive) {
      return null;
    }

    try {
      // Get decryption key
      const decryptionKey = await this.getChannelEncryptionKey(encryptedMessage.channelId);
      if (!decryptionKey) {
        throw new Error('No decryption key available for channel');
      }

      // Verify signature if present
      let signatureValid = true;
      if (encryptedMessage.signature) {
        signatureValid = await this.verifySignature(
          encryptedMessage.channelId,
          new Uint8Array(encryptedMessage.data),
          {
            algorithm: encryptedMessage.signature.algorithm,
            signature: new Uint8Array(encryptedMessage.signature.signature).buffer,
            publicKey: new Uint8Array(encryptedMessage.signature.publicKey).buffer,
            timestamp: encryptedMessage.signature.timestamp
          }
        );
      }

      // Decrypt message
      const iv = new Uint8Array(encryptedMessage.iv);
      const encryptedData = new Uint8Array(encryptedMessage.data);
      const associatedData = encryptedMessage.associatedData ? 
        new Uint8Array(encryptedMessage.associatedData) : undefined;

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          additionalData: associatedData
        },
        decryptionKey,
        encryptedData
      );

      const decryptedMessage: DecryptedMessage = {
        channelId: encryptedMessage.channelId,
        data: decrypted,
        signatureValid,
        timestamp: encryptedMessage.timestamp
      };

      // Update channel usage
      channel.lastUsed = Date.now();

      return decryptedMessage;

    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return null;
    }
  }

  /**
   * Perform ECDH key exchange
   */
  async performKeyExchange(
    privateKey: CryptoKey, 
    remotePublicKey: ArrayBuffer
  ): Promise<CryptoKey> {
    // Import remote public key
    const importedPublicKey = await crypto.subtle.importKey(
      'raw',
      remotePublicKey,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      []
    );

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: importedPublicKey
      },
      privateKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );

    return sharedSecret;
  }

  /**
   * Generate key pair for channel
   */
  private async generateKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveKey']
    );
  }

  /**
   * Generate signing key pair
   */
  private async generateSigningKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    );
  }

  /**
   * Sign message
   */
  private async signMessage(channelId: string, message: ArrayBuffer): Promise<DigitalSignature | null> {
    try {
      // Get or generate signing key pair
      const signingKeyPair = await this.getOrCreateSigningKeyPair(channelId);
      
      const signature = await crypto.subtle.sign(
        {
          name: 'ECDSA',
          hash: 'SHA-256'
        },
        signingKeyPair.privateKey,
        message
      );

      const publicKeyBuffer = await crypto.subtle.exportKey('raw', signingKeyPair.publicKey);

      return {
        algorithm: 'ECDSA',
        signature,
        publicKey: publicKeyBuffer,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Failed to sign message:', error);
      return null;
    }
  }

  /**
   * Verify message signature
   */
  private async verifySignature(
    channelId: string,
    message: ArrayBuffer,
    signature: DigitalSignature
  ): Promise<boolean> {
    try {
      const publicKey = await crypto.subtle.importKey(
        'raw',
        signature.publicKey,
        {
          name: 'ECDSA',
          namedCurve: 'P-256'
        },
        false,
        ['verify']
      );

      const isValid = await crypto.subtle.verify(
        {
          name: 'ECDSA',
          hash: 'SHA-256'
        },
        publicKey,
        signature.signature,
        message
      );

      return isValid;

    } catch (error) {
      console.error('Failed to verify signature:', error);
      return false;
    }
  }

  /**
   * Get or create signing key pair for channel
   */
  private async getOrCreateSigningKeyPair(channelId: string): Promise<CryptoKeyPair> {
    const signingKeyId = `${channelId}_signing`;
    
    // Try to get existing key pair
    let keyPair = this.keyPairs.get(signingKeyId);
    
    if (!keyPair) {
      keyPair = await this.generateSigningKeyPair();
      this.keyPairs.set(signingKeyId, keyPair);
    }

    return keyPair;
  }

  /**
   * Store shared secret as encryption key
   */
  private async storeSharedSecret(channelId: string, sharedSecret: CryptoKey): Promise<string> {
    // Export the shared secret
    const exportedSecret = await crypto.subtle.exportKey('raw', sharedSecret);
    
    // Store it using the key manager
    const keyId = await this.keyManager.generateKey(`channel_${channelId}`, 'AES-GCM');
    
    // In a real implementation, we would replace the generated key with the shared secret
    // This is a simplified approach for demonstration
    
    return keyId;
  }

  /**
   * Get encryption key for channel
   */
  private async getChannelEncryptionKey(channelId: string): Promise<CryptoKey | null> {
    // Try to get shared secret key
    const activeKeys = this.keyManager.getActiveKeys(`channel_${channelId}`);
    
    if (activeKeys.length > 0) {
      return await this.keyManager.getKey(activeKeys[0]);
    }

    // Fallback to generating a new key
    const keyId = await this.keyManager.generateKey(`channel_${channelId}`, 'AES-GCM');
    return await this.keyManager.getKey(keyId);
  }

  /**
   * Close secure channel
   */
  async closeChannel(channelId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return false;
    }

    channel.isActive = false;
    
    // Clean up key pairs
    this.keyPairs.delete(channelId);
    this.keyPairs.delete(`${channelId}_signing`);

    return true;
  }

  /**
   * Get channel information
   */
  getChannel(channelId: string): SecureCommunicationChannel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * List active channels
   */
  getActiveChannels(): SecureCommunicationChannel[] {
    return Array.from(this.channels.values()).filter(channel => channel.isActive);
  }

  /**
   * Export public key for key exchange
   */
  async exportPublicKey(channelId: string): Promise<ArrayBuffer | null> {
    const keyPair = this.keyPairs.get(channelId);
    if (!keyPair) {
      return null;
    }

    try {
      return await crypto.subtle.exportKey('raw', keyPair.publicKey);
    } catch (error) {
      console.error('Failed to export public key:', error);
      return null;
    }
  }

  /**
   * Validate certificate (simplified implementation)
   */
  async validateCertificate(certificate: CertificateInfo): Promise<boolean> {
    // In a real implementation, this would:
    // 1. Check certificate chain
    // 2. Verify signatures
    // 3. Check expiration dates
    // 4. Validate against trusted CAs
    // 5. Check revocation status

    const now = Date.now();
    return now >= certificate.validFrom && now <= certificate.validTo;
  }

  /**
   * Get channel statistics
   */
  getChannelStats(): ChannelStats {
    const channels = Array.from(this.channels.values());
    
    return {
      totalChannels: channels.length,
      activeChannels: channels.filter(c => c.isActive).length,
      channelsByType: {
        'end-to-end': channels.filter(c => c.type === 'end-to-end').length,
        'transport': channels.filter(c => c.type === 'transport').length,
        'application': channels.filter(c => c.type === 'application').length
      },
      oldestChannel: Math.min(...channels.map(c => c.createdAt)),
      newestChannel: Math.max(...channels.map(c => c.createdAt))
    };
  }
}

interface EncryptedMessage {
  channelId: string;
  iv: number[];
  data: number[];
  signature?: {
    algorithm: string;
    signature: number[];
    publicKey: number[];
    timestamp: number;
  };
  timestamp: number;
  associatedData?: number[];
}

interface DecryptedMessage {
  channelId: string;
  data: ArrayBuffer;
  signatureValid: boolean;
  timestamp: number;
}

interface ChannelStats {
  totalChannels: number;
  activeChannels: number;
  channelsByType: Record<string, number>;
  oldestChannel: number;
  newestChannel: number;
}