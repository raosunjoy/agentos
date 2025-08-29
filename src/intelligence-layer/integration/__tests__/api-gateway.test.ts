/**
 * Integration tests for API Gateway
 * Tests service integration, authentication, rate limiting, and transformations
 */

import { ApiGateway } from '../api-gateway';
import { DefaultServiceRegistry } from '../service-registry';
import { DefaultRateLimiter } from '../rate-limiter';
import { AuthProviderFactory } from '../auth-providers';
import { ParameterValidationTransformer, HeaderInjectionTransformer } from '../transformers';
import {
  ServiceDefinition,
  ServiceRequest,
  HttpMethod,
  AuthenticationConfig,
  RateLimitConfig
} from '../types';

// Mock fetch for testing
global.fetch = jest.fn();

describe('API Gateway Integration Tests', () => {
  let gateway: ApiGateway;
  let registry: DefaultServiceRegistry;
  let rateLimiter: DefaultRateLimiter;

  beforeEach(() => {
    registry = new DefaultServiceRegistry();
    rateLimiter = new DefaultRateLimiter();
    gateway = new ApiGateway(registry);
    gateway.setRateLimiter(rateLimiter);

    // Reset fetch mock
    (fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    registry.clear();
    rateLimiter.destroy();
  });

  const createTestService = (): ServiceDefinition => ({
    serviceId: 'test-service',
    name: 'Test Service',
    description: 'A test service',
    version: '1.0.0',
    baseUrl: 'https://api.test.com',
    endpoints: [
      {
        path: '/users',
        method: HttpMethod.GET,
        description: 'Get users',
        parameters: [
          {
            name: 'limit',
            type: 'number',
            required: false,
            validation: [{ type: 'min', value: 1 }, { type: 'max', value: 100 }]
          }
        ]
      },
      {
        path: '/users',
        method: HttpMethod.POST,
        description: 'Create user',
        authentication: true,
        parameters: [
          {
            name: 'name',
            type: 'string',
            required: true
          },
          {
            name: 'email',
            type: 'string',
            required: true,
            validation: [{ type: 'pattern', value: '^[^@]+@[^@]+\\.[^@]+$' }]
          }
        ]
      }
    ],
    authentication: {
      type: 'api_key',
      config: {
        apiKey: 'test-api-key',
        headerName: 'X-API-Key'
      }
    },
    timeout: 5000
  });

  describe('Basic Service Integration', () => {
    it('should execute successful GET request', async () => {
      const service = createTestService();
      await registry.register(service);

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ users: [{ id: 1, name: 'John' }] })
      });

      const request: ServiceRequest = {
        serviceId: 'test-service',
        endpoint: '/users',
        method: HttpMethod.GET,
        parameters: { limit: 10 }
      };

      const response = await gateway.executeRequest(request);

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.data).toEqual({ users: [{ id: 1, name: 'John' }] });
      expect(fetch).toHaveBeenCalledWith(
        'https://api.test.com/users?limit=10',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle service not found error', async () => {
      const request: ServiceRequest = {
        serviceId: 'non-existent-service',
        endpoint: '/users',
        method: HttpMethod.GET
      };

      const response = await gateway.executeRequest(request);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('GATEWAY_ERROR');
      expect(response.error?.message).toContain('Service not found');
    });

    it('should handle endpoint not found error', async () => {
      const service = createTestService();
      await registry.register(service);

      const request: ServiceRequest = {
        serviceId: 'test-service',
        endpoint: '/non-existent',
        method: HttpMethod.GET
      };

      const response = await gateway.executeRequest(request);

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('Endpoint not found');
    });
  });

  describe('Authentication Integration', () => {
    it('should add API key authentication to requests', async () => {
      const service = createTestService();
      await registry.register(service);

      // Register API key auth provider
      gateway.registerAuthProvider('api_key', AuthProviderFactory.createProvider('api_key'));

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ id: 1, name: 'John', email: 'john@test.com' })
      });

      const request: ServiceRequest = {
        serviceId: 'test-service',
        endpoint: '/users',
        method: HttpMethod.POST,
        body: { name: 'John', email: 'john@test.com' }
      };

      const response = await gateway.executeRequest(request);

      expect(response.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.test.com/users',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key'
          })
        })
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const service: ServiceDefinition = {
        ...createTestService(),
        rateLimit: {
          requests: 2,
          windowMs: 1000
        }
      };
      await registry.register(service);

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ success: true })
      });

      const request: ServiceRequest = {
        serviceId: 'test-service',
        endpoint: '/users',
        method: HttpMethod.GET
      };

      // First two requests should succeed
      const response1 = await gateway.executeRequest(request);
      const response2 = await gateway.executeRequest(request);
      
      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);

      // Third request should be rate limited
      const response3 = await gateway.executeRequest(request);
      
      expect(response3.success).toBe(false);
      expect(response3.statusCode).toBe(429);
      expect(response3.error?.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Request Transformations', () => {
    it('should validate request parameters', async () => {
      const service = createTestService();
      await registry.register(service);

      // Add parameter validation transformer
      gateway.addRequestTransformer(new ParameterValidationTransformer());

      const request: ServiceRequest = {
        serviceId: 'test-service',
        endpoint: '/users',
        method: HttpMethod.POST,
        body: { name: 'John', email: 'invalid-email' } // Invalid email format
      };

      const response = await gateway.executeRequest(request);

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('Parameter validation failed');
    });

    it('should inject default headers', async () => {
      const service = createTestService();
      await registry.register(service);

      // Add header injection transformer
      const headerTransformer = new HeaderInjectionTransformer({
        'X-Custom-Header': 'custom-value'
      });
      gateway.addRequestTransformer(headerTransformer);

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ users: [] })
      });

      const request: ServiceRequest = {
        serviceId: 'test-service',
        endpoint: '/users',
        method: HttpMethod.GET
      };

      await gateway.executeRequest(request);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'AgentOS/1.0',
            'X-Custom-Header': 'custom-value'
          })
        })
      );
    });
  });

  describe('Error Handling and Retry', () => {
    it('should retry failed requests according to retry policy', async () => {
      const service: ServiceDefinition = {
        ...createTestService(),
        retryPolicy: {
          maxAttempts: 3,
          backoffMs: 100,
          exponential: false,
          retryableStatusCodes: [500, 502, 503]
        }
      };
      await registry.register(service);

      // Mock first two calls to fail, third to succeed
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ error: 'Server error' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ error: 'Gateway error' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ success: true })
        });

      const request: ServiceRequest = {
        serviceId: 'test-service',
        endpoint: '/users',
        method: HttpMethod.GET
      };

      const response = await gateway.executeRequest(request);

      expect(response.success).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle timeout errors', async () => {
      const service: ServiceDefinition = {
        ...createTestService(),
        timeout: 100 // Very short timeout
      };
      await registry.register(service);

      // Mock a slow response
      (fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const request: ServiceRequest = {
        serviceId: 'test-service',
        endpoint: '/users',
        method: HttpMethod.GET
      };

      const response = await gateway.executeRequest(request);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('NETWORK_ERROR');
    });
  });

  describe('Metrics Collection', () => {
    it('should collect request metrics', async () => {
      const service = createTestService();
      await registry.register(service);

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ users: [] })
      });

      const request: ServiceRequest = {
        serviceId: 'test-service',
        endpoint: '/users',
        method: HttpMethod.GET
      };

      await gateway.executeRequest(request);

      const metrics = gateway.getMetrics('test-service');
      
      expect(metrics).toHaveLength(1);
      expect(metrics[0].serviceId).toBe('test-service');
      expect(metrics[0].endpoint).toBe('/users');
      expect(metrics[0].totalRequests).toBe(1);
      expect(metrics[0].successfulRequests).toBe(1);
      expect(metrics[0].failedRequests).toBe(0);
    });
  });

  describe('Complex Multi-Service Workflow', () => {
    it('should handle requests to multiple services', async () => {
      // Register multiple services
      const userService: ServiceDefinition = {
        serviceId: 'user-service',
        name: 'User Service',
        description: 'Manages users',
        version: '1.0.0',
        baseUrl: 'https://users.api.com',
        endpoints: [
          {
            path: '/users/{id}',
            method: HttpMethod.GET,
            description: 'Get user by ID'
          }
        ],
        authentication: { type: 'none', config: {} }
      };

      const orderService: ServiceDefinition = {
        serviceId: 'order-service',
        name: 'Order Service',
        description: 'Manages orders',
        version: '1.0.0',
        baseUrl: 'https://orders.api.com',
        endpoints: [
          {
            path: '/orders',
            method: HttpMethod.GET,
            description: 'Get orders'
          }
        ],
        authentication: { type: 'none', config: {} }
      };

      await registry.register(userService);
      await registry.register(orderService);

      // Mock responses for both services
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ id: 1, name: 'John' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ orders: [{ id: 1, userId: 1, total: 100 }] })
        });

      // Execute requests to both services
      const userRequest: ServiceRequest = {
        serviceId: 'user-service',
        endpoint: '/users/{id}',
        method: HttpMethod.GET
      };

      const orderRequest: ServiceRequest = {
        serviceId: 'order-service',
        endpoint: '/orders',
        method: HttpMethod.GET
      };

      const [userResponse, orderResponse] = await Promise.all([
        gateway.executeRequest(userRequest),
        gateway.executeRequest(orderRequest)
      ]);

      expect(userResponse.success).toBe(true);
      expect(userResponse.data).toEqual({ id: 1, name: 'John' });
      
      expect(orderResponse.success).toBe(true);
      expect(orderResponse.data).toEqual({ orders: [{ id: 1, userId: 1, total: 100 }] });

      // Verify metrics for both services
      const userMetrics = gateway.getMetrics('user-service');
      const orderMetrics = gateway.getMetrics('order-service');
      
      expect(userMetrics).toHaveLength(1);
      expect(orderMetrics).toHaveLength(1);
    });
  });
});