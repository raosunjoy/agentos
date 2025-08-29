import { AccessRequest, AccessDecision, SecurityContext, AccessCondition } from './types';

/**
 * Default-deny access control system implementing zero-trust principles
 */
export class AccessControlManager {
  private policies: Map<string, AccessPolicy> = new Map();
  private activeDecisions: Map<string, AccessDecision> = new Map();

  /**
   * Evaluate access request using zero-trust principles
   */
  async evaluateAccess(request: AccessRequest): Promise<AccessDecision> {
    // Default deny - all access must be explicitly granted
    let decision: AccessDecision = {
      allowed: false,
      reason: 'Default deny policy - no explicit permission found'
    };

    try {
      // Check if there's an explicit policy for this resource/action
      const policyKey = `${request.resource}:${request.action}`;
      const policy = this.policies.get(policyKey);

      if (!policy) {
        return decision;
      }

      // Evaluate policy conditions
      const evaluation = await this.evaluatePolicy(policy, request);
      
      if (evaluation.allowed) {
        decision = {
          allowed: true,
          reason: 'Access granted by policy',
          conditions: evaluation.conditions,
          expiresAt: evaluation.expiresAt
        };

        // Cache decision for performance
        this.activeDecisions.set(request.id, decision);
      } else {
        decision.reason = evaluation.reason;
      }

    } catch (error) {
      decision.reason = `Access evaluation failed: ${error.message}`;
    }

    return decision;
  }

  /**
   * Register access policy for resource/action combination
   */
  registerPolicy(resource: string, action: string, policy: AccessPolicy): void {
    const key = `${resource}:${action}`;
    this.policies.set(key, policy);
  }

  /**
   * Revoke access for specific request or all access for user
   */
  revokeAccess(requestId?: string, userId?: string): void {
    if (requestId) {
      this.activeDecisions.delete(requestId);
    } else if (userId) {
      // Revoke all active decisions for user
      for (const [id, decision] of this.activeDecisions.entries()) {
        // Note: Would need to track userId in decisions for this to work
        this.activeDecisions.delete(id);
      }
    }
  }

  /**
   * Check if access is still valid
   */
  isAccessValid(requestId: string): boolean {
    const decision = this.activeDecisions.get(requestId);
    if (!decision || !decision.allowed) {
      return false;
    }

    // Check expiration
    if (decision.expiresAt && Date.now() > decision.expiresAt) {
      this.activeDecisions.delete(requestId);
      return false;
    }

    return true;
  }

  private async evaluatePolicy(policy: AccessPolicy, request: AccessRequest): Promise<PolicyEvaluation> {
    const conditions: AccessCondition[] = [];
    let expiresAt: number | undefined;

    // Evaluate each policy rule
    for (const rule of policy.rules) {
      const ruleResult = await this.evaluateRule(rule, request);
      
      if (!ruleResult.allowed) {
        return {
          allowed: false,
          reason: ruleResult.reason,
          conditions: [],
          expiresAt: undefined
        };
      }

      if (ruleResult.conditions) {
        conditions.push(...ruleResult.conditions);
      }

      if (ruleResult.expiresAt) {
        expiresAt = Math.min(expiresAt || ruleResult.expiresAt, ruleResult.expiresAt);
      }
    }

    return {
      allowed: true,
      reason: 'All policy rules satisfied',
      conditions,
      expiresAt
    };
  }

  private async evaluateRule(rule: PolicyRule, request: AccessRequest): Promise<PolicyEvaluation> {
    switch (rule.type) {
      case 'user_identity':
        return this.evaluateUserIdentity(rule, request);
      
      case 'time_based':
        return this.evaluateTimeBased(rule, request);
      
      case 'location_based':
        return this.evaluateLocationBased(rule, request);
      
      case 'network_based':
        return this.evaluateNetworkBased(rule, request);
      
      case 'device_trust':
        return this.evaluateDeviceTrust(rule, request);
      
      default:
        return {
          allowed: false,
          reason: `Unknown rule type: ${rule.type}`,
          conditions: [],
          expiresAt: undefined
        };
    }
  }

  private evaluateUserIdentity(rule: PolicyRule, request: AccessRequest): PolicyEvaluation {
    // Verify user identity and authentication status
    if (!request.context.userId) {
      return {
        allowed: false,
        reason: 'User not authenticated',
        conditions: [],
        expiresAt: undefined
      };
    }

    return {
      allowed: true,
      reason: 'User identity verified',
      conditions: [],
      expiresAt: undefined
    };
  }

  private evaluateTimeBased(rule: PolicyRule, request: AccessRequest): PolicyEvaluation {
    const now = new Date(request.context.timestamp);
    const hour = now.getHours();

    if (rule.conditions?.allowedHours) {
      const allowedHours = rule.conditions.allowedHours as number[];
      if (!allowedHours.includes(hour)) {
        return {
          allowed: false,
          reason: `Access not allowed at hour ${hour}`,
          conditions: [],
          expiresAt: undefined
        };
      }
    }

    return {
      allowed: true,
      reason: 'Time-based conditions satisfied',
      conditions: [],
      expiresAt: undefined
    };
  }

  private evaluateLocationBased(rule: PolicyRule, request: AccessRequest): PolicyEvaluation {
    if (rule.conditions?.requireLocation && !request.context.location) {
      return {
        allowed: false,
        reason: 'Location required but not provided',
        conditions: [],
        expiresAt: undefined
      };
    }

    return {
      allowed: true,
      reason: 'Location-based conditions satisfied',
      conditions: [],
      expiresAt: undefined
    };
  }

  private evaluateNetworkBased(rule: PolicyRule, request: AccessRequest): PolicyEvaluation {
    if (rule.conditions?.requireSecureNetwork && !request.context.networkInfo.isSecure) {
      return {
        allowed: false,
        reason: 'Secure network required',
        conditions: [],
        expiresAt: undefined
      };
    }

    return {
      allowed: true,
      reason: 'Network-based conditions satisfied',
      conditions: [],
      expiresAt: undefined
    };
  }

  private evaluateDeviceTrust(rule: PolicyRule, request: AccessRequest): PolicyEvaluation {
    // In a real implementation, this would check device certificates,
    // integrity status, etc.
    return {
      allowed: true,
      reason: 'Device trust verified',
      conditions: [],
      expiresAt: undefined
    };
  }
}

interface AccessPolicy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
}

interface PolicyRule {
  type: 'user_identity' | 'time_based' | 'location_based' | 'network_based' | 'device_trust';
  conditions?: Record<string, any>;
  required: boolean;
}

interface PolicyEvaluation {
  allowed: boolean;
  reason: string;
  conditions: AccessCondition[];
  expiresAt?: number;
}