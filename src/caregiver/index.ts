/**
 * Caregiver Integration System
 * Provides consent management, authentication, access control, monitoring, and communication for caregivers
 */

export * from './types';
export * from './consent-manager';
export * from './caregiver-auth';
export * from './access-audit-logger';
export * from './monitoring-service';
export * from './communication-service';

// Re-export main classes for convenience
export { ConsentManager } from './consent-manager';
export { CaregiverAuthenticator } from './caregiver-auth';
export { AccessAuditLogger } from './access-audit-logger';
export { MonitoringService } from './monitoring-service';
export { CommunicationService } from './communication-service';