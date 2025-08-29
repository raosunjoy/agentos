/**
 * AgentOS Service Integration Framework
 * Unified API gateway with service discovery, authentication, and rate limiting
 */

export * from './types';
export * from './service-registry';
export * from './api-gateway';
export * from './rate-limiter';
export * from './auth-providers';
export * from './transformers';

// Re-export commonly used types for convenience
export type {
  ServiceDefinition,
  ServiceRequest,
  ServiceResponse,
  ServiceRegistry,
  AuthenticationProvider,
  RateLimiter,
  RequestTransformer,
  ResponseTransformer,
  ApiGatewayConfig,
  ServiceMetrics
} from './types';