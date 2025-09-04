export interface SecurityContext {
  userId: string;
  sessionId: string;
  deviceId: string;
  timestamp: number;
  location?: GeolocationCoordinates;
  networkInfo: NetworkInfo;
}

export interface NetworkInfo {
  type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  ssid?: string;
  isSecure: boolean;
  ipAddress: string;
}

export interface AccessRequest {
  id: string;
  resource: string;
  action: string;
  context: SecurityContext;
  metadata?: Record<string, any>;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  conditions?: AccessCondition[];
  expiresAt?: number;
}

export interface AccessCondition {
  type: 'time' | 'location' | 'network' | 'user_confirmation';
  value: any;
  description: string;
}

export interface ConsentRequest {
  id: string;
  purpose: string;
  dataTypes: string[];
  duration?: number;
  requester: string;
  context: SecurityContext;
}

export interface ConsentDecision {
  granted: boolean;
  conditions?: ConsentCondition[];
  expiresAt?: number;
  revocable: boolean;
}

export interface ConsentCondition {
  type: 'purpose_limitation' | 'data_minimization' | 'retention_limit';
  value: any;
  description: string;
}

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: number;
  context: SecurityContext;
  details: Record<string, any>;
  resolved: boolean;
}

export enum SecurityEventType {
  ACCESS_GRANTED = 'access_granted',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  SUSPICIOUS_BEHAVIOR = 'suspicious_behavior',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt',
  MALICIOUS_PLUGIN = 'malicious_plugin',
  CONSENT_VIOLATION = 'consent_violation',
  ANOMALOUS_PATTERN = 'anomalous_pattern'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ThreatResponse {
  action: ThreatAction;
  reason: string;
  automatic: boolean;
  timestamp: number;
}

export enum ThreatAction {
  BLOCK = 'block',
  QUARANTINE = 'quarantine',
  ALERT_USER = 'alert_user',
  REVOKE_PERMISSIONS = 'revoke_permissions',
  DISABLE_PLUGIN = 'disable_plugin',
  FORCE_LOGOUT = 'force_logout'
}

export interface AnomalyPattern {
  id: string;
  type: string;
  description: string;
  threshold: number;
  timeWindow: number;
  severity: SecuritySeverity;
}