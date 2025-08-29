/**
 * Caregiver Integration System
 * Provides consent management, authentication, and access control for caregivers
 */

export * from './types';
export * from './consent-manager';
export * from './caregiver-auth';
export * from './access-audit-logger';

// Re-export main classes for convenience
export { ConsentManager } from './consent-manager';
export { CaregiverAuthenticator } from './caregiver-auth';
export { AccessAuditLogger } from './access-audit-logger';