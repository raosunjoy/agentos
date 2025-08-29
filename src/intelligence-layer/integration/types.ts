/**
 * Types for AgentOS Service Integration Framework
 * Unified API gateway with service discovery and management
 */

export interface ServiceDefinition {
  serviceId: string;
  name: string;
  description: string;
  version: string;
  baseUrl: string;
  endpoints: ServiceEndpoint[];
  authentication: AuthenticationConfig;
  rateLimit?: RateLimitConfig;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  healthCheck?: HealthCheckConfig;
}

export interface ServiceEndpoint {
  path: string;
  method: HttpMethod;
  description: string;
  parameters?: ParameterDefinition[];
  requestSchema?: any;
  responseSchema?: any;
  authentication?: boolean;
  rateLimit?: RateLimitConfig;
  timeout?: number;
}

export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
  validation?: ValidationRule[];
}

export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'enum' | 'custom';
  value: any;
  message?: string;
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

export interface AuthenticationConfig {
  type: 'none' | 'api_key' | 'oauth2' | 'jwt' | 'basic';
  config: Record<string, any>;
}

export interface RateLimitConfig {
  requests: number;
  windowMs: number;
  burst?: number;
  skipSuccessfulRequests?: boolean;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  exponential: boolean;
  retryableStatusCodes?: number[];
}

export interface HealthCheckConfig {
  endpoint: string;
  intervalMs: number;
  timeoutMs: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
}

export interface ServiceRequest {
  serviceId: string;
  endpoint: string;
  method: HttpMethod;
  parameters?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface ServiceResponse {
  success: boolean;
  statusCode: number;
  data?: any;
  error?: ServiceError;
  headers?: Record<string, string>;
  duration: number;
}

export interface ServiceError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
}

export interface ServiceRegistry {
  register(service: ServiceDefinition): Promise<void>;
  unregister(serviceId: string): Promise<void>;
  discover(criteria?: ServiceDiscoveryCriteria): Promise<ServiceDefinition[]>;
  getService(serviceId: string): Promise<ServiceDefinition | undefined>;
  updateService(serviceId: string, updates: Partial<ServiceDefinition>): Promise<void>;
}

export interface ServiceDiscoveryCriteria {
  name?: string;
  tags?: string[];
  version?: string;
  healthy?: boolean;
}

export interface RequestTransformer {
  transform(request: ServiceRequest, service: ServiceDefinition): Promise<ServiceRequest>;
}

export interface ResponseTransformer {
  transform(response: ServiceResponse, service: ServiceDefinition): Promise<ServiceResponse>;
}

export interface AuthenticationProvider {
  authenticate(config: AuthenticationConfig, request: ServiceRequest): Promise<ServiceRequest>;
  refreshToken?(config: AuthenticationConfig): Promise<void>;
}

export interface RateLimiter {
  checkLimit(serviceId: string, endpoint: string, config: RateLimitConfig): Promise<boolean>;
  getRemainingRequests(serviceId: string, endpoint: string): Promise<number>;
  resetLimit(serviceId: string, endpoint: string): Promise<void>;
}

export interface ServiceHealth {
  serviceId: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}

export interface ApiGatewayConfig {
  defaultTimeout: number;
  defaultRetryPolicy: RetryPolicy;
  enableMetrics: boolean;
  enableLogging: boolean;
  corsEnabled: boolean;
  corsOrigins?: string[];
}

export interface ServiceMetrics {
  serviceId: string;
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: Date;
  errorRate: number;
}