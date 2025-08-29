export interface EncryptionKey {
  id: string;
  purpose: string;
  algorithm: string;
  encryptedKey: number[]; // Encrypted with master key
  createdAt: number;
  expiresAt: number;
  rotationCount: number;
}

export interface KeyMetadata {
  keyId: string;
  purpose: string;
  algorithm: string;
  createdAt: number;
  lastUsed: number;
  usageCount: number;
  rotationSchedule: number; // milliseconds
  isActive: boolean;
  replacedBy?: string; // Key ID that replaced this key
}

export interface KeyDerivationParams {
  algorithm: 'PBKDF2' | 'scrypt' | 'Argon2';
  iterations?: number;
  salt: Uint8Array;
  keyLength: number;
}

export interface EncryptedData {
  algorithm: string;
  keyId: string;
  iv: number[];
  data: number[];
  authTag?: number[]; // For authenticated encryption
  metadata?: Record<string, any>;
}

export interface EncryptionOptions {
  algorithm?: 'AES-GCM' | 'AES-CBC' | 'ChaCha20-Poly1305';
  keyId?: string;
  associatedData?: ArrayBuffer; // For AEAD
  compressionEnabled?: boolean;
}

export interface DecryptionResult {
  data: ArrayBuffer;
  metadata?: Record<string, any>;
  keyId: string;
  verified: boolean; // For authenticated encryption
}

export interface SecureStorageOptions {
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
  integrityCheckEnabled: boolean;
  keyRotationInterval: number; // milliseconds
}

export interface DataAnonymizationOptions {
  method: 'k-anonymity' | 'differential-privacy' | 'pseudonymization';
  parameters: Record<string, any>;
  retainStructure: boolean;
}

export interface PrivacyPreservingOptions {
  noiseLevel: number; // For differential privacy
  epsilon: number; // Privacy budget
  delta: number; // Privacy parameter
  sensitivityBound: number;
}

export interface SecureCommunicationChannel {
  id: string;
  type: 'end-to-end' | 'transport' | 'application';
  encryptionAlgorithm: string;
  keyExchangeMethod: string;
  authenticationMethod: string;
  isActive: boolean;
  createdAt: number;
  lastUsed: number;
}

export interface KeyExchangeParams {
  method: 'ECDH' | 'RSA' | 'DH';
  publicKey: ArrayBuffer;
  parameters?: Record<string, any>;
}

export interface DigitalSignature {
  algorithm: string;
  signature: ArrayBuffer;
  publicKey: ArrayBuffer;
  timestamp: number;
}

export interface CertificateInfo {
  subject: string;
  issuer: string;
  validFrom: number;
  validTo: number;
  fingerprint: string;
  publicKey: ArrayBuffer;
  extensions?: Record<string, any>;
}

export interface EncryptionMetrics {
  totalOperations: number;
  encryptionOperations: number;
  decryptionOperations: number;
  keyRotations: number;
  failedOperations: number;
  averageOperationTime: number;
  lastOperationTime: number;
}

export interface SecurityAuditLog {
  id: string;
  operation: 'encrypt' | 'decrypt' | 'key-generation' | 'key-rotation' | 'key-deletion';
  keyId?: string;
  userId: string;
  timestamp: number;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}