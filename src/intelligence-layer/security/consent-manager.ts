import { ConsentRequest, ConsentDecision, ConsentCondition, SecurityContext } from './types';

/**
 * Explicit user consent management system
 */
export class ConsentManager {
  private activeConsents: Map<string, StoredConsent> = new Map();
  private consentHistory: ConsentRecord[] = [];

  /**
   * Request user consent for data access or operation
   */
  async requestConsent(request: ConsentRequest): Promise<ConsentDecision> {
    // Check if there's already valid consent for this purpose
    const existingConsent = this.findExistingConsent(request);
    if (existingConsent && this.isConsentValid(existingConsent)) {
      return {
        granted: true,
        conditions: existingConsent.conditions,
        expiresAt: existingConsent.expiresAt,
        revocable: true
      };
    }

    // Present consent request to user
    const userDecision = await this.presentConsentRequest(request);
    
    if (userDecision.granted) {
      // Store consent decision
      const storedConsent: StoredConsent = {
        id: request.id,
        purpose: request.purpose,
        dataTypes: request.dataTypes,
        requester: request.requester,
        granted: true,
        grantedAt: Date.now(),
        expiresAt: userDecision.expiresAt,
        conditions: userDecision.conditions || [],
        revocable: userDecision.revocable,
        context: request.context
      };

      this.activeConsents.set(request.id, storedConsent);
      this.recordConsentHistory(storedConsent, 'granted');
    } else {
      this.recordConsentHistory({
        id: request.id,
        purpose: request.purpose,
        dataTypes: request.dataTypes,
        requester: request.requester,
        granted: false,
        grantedAt: Date.now(),
        context: request.context
      }, 'denied');
    }

    return userDecision;
  }

  /**
   * Revoke previously granted consent
   */
  revokeConsent(consentId: string, userId: string): boolean {
    const consent = this.activeConsents.get(consentId);
    if (!consent || consent.context.userId !== userId) {
      return false;
    }

    if (!consent.revocable) {
      return false;
    }

    this.activeConsents.delete(consentId);
    this.recordConsentHistory(consent, 'revoked');
    return true;
  }

  /**
   * Check if consent is valid for a specific operation
   */
  hasValidConsent(purpose: string, dataTypes: string[], userId: string): boolean {
    for (const consent of this.activeConsents.values()) {
      if (consent.context.userId !== userId || !consent.granted) {
        continue;
      }

      if (consent.purpose === purpose && 
          dataTypes.every(type => consent.dataTypes.includes(type))) {
        
        if (this.isConsentValid(consent)) {
          return true;
        } else {
          // Clean up expired consent
          this.activeConsents.delete(consent.id);
          this.recordConsentHistory(consent, 'expired');
        }
      }
    }

    return false;
  }

  /**
   * Get all active consents for a user
   */
  getUserConsents(userId: string): StoredConsent[] {
    return Array.from(this.activeConsents.values())
      .filter(consent => consent.context.userId === userId && consent.granted);
  }

  /**
   * Get consent history for audit purposes
   */
  getConsentHistory(userId: string): ConsentRecord[] {
    return this.consentHistory.filter(record => record.consent.context.userId === userId);
  }

  private findExistingConsent(request: ConsentRequest): StoredConsent | undefined {
    for (const consent of this.activeConsents.values()) {
      if (consent.context.userId === request.context.userId &&
          consent.purpose === request.purpose &&
          consent.requester === request.requester &&
          request.dataTypes.every(type => consent.dataTypes.includes(type))) {
        return consent;
      }
    }
    return undefined;
  }

  private isConsentValid(consent: StoredConsent): boolean {
    if (!consent.granted) {
      return false;
    }

    // Check expiration
    if (consent.expiresAt && Date.now() > consent.expiresAt) {
      return false;
    }

    // Check conditions
    for (const condition of consent.conditions || []) {
      if (!this.evaluateConsentCondition(condition, consent)) {
        return false;
      }
    }

    return true;
  }

  private evaluateConsentCondition(condition: ConsentCondition, consent: StoredConsent): boolean {
    switch (condition.type) {
      case 'purpose_limitation':
        // Ensure data is only used for the specified purpose
        return true; // Would need additional context to evaluate
      
      case 'data_minimization':
        // Ensure only necessary data is accessed
        return true; // Would need additional context to evaluate
      
      case 'retention_limit':
        // Check if retention period has been exceeded
        const retentionLimit = condition.value as number;
        return Date.now() - consent.grantedAt < retentionLimit;
      
      default:
        return false;
    }
  }

  private async presentConsentRequest(request: ConsentRequest): Promise<ConsentDecision> {
    // In a real implementation, this would show a UI dialog to the user
    // For now, we'll simulate user consent based on the request type
    
    // Simulate user decision based on data sensitivity
    const sensitiveDataTypes = ['health', 'financial', 'biometric', 'location'];
    const hasSensitiveData = request.dataTypes.some(type => 
      sensitiveDataTypes.includes(type.toLowerCase())
    );

    if (hasSensitiveData) {
      // Require explicit conditions for sensitive data
      return {
        granted: true, // In reality, this would be user input
        conditions: [
          {
            type: 'purpose_limitation',
            value: request.purpose,
            description: `Data can only be used for: ${request.purpose}`
          },
          {
            type: 'retention_limit',
            value: 24 * 60 * 60 * 1000, // 24 hours
            description: 'Data must be deleted after 24 hours'
          }
        ],
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        revocable: true
      };
    } else {
      // Standard consent for non-sensitive data
      return {
        granted: true,
        conditions: [
          {
            type: 'purpose_limitation',
            value: request.purpose,
            description: `Data can only be used for: ${request.purpose}`
          }
        ],
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        revocable: true
      };
    }
  }

  private recordConsentHistory(consent: StoredConsent, action: ConsentAction): void {
    this.consentHistory.push({
      consent,
      action,
      timestamp: Date.now()
    });
  }
}

interface StoredConsent {
  id: string;
  purpose: string;
  dataTypes: string[];
  requester: string;
  granted: boolean;
  grantedAt: number;
  expiresAt?: number;
  conditions?: ConsentCondition[];
  revocable?: boolean;
  context: SecurityContext;
}

interface ConsentRecord {
  consent: StoredConsent;
  action: ConsentAction;
  timestamp: number;
}

type ConsentAction = 'granted' | 'denied' | 'revoked' | 'expired';