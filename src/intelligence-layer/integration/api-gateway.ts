/**
 * Unified API Gateway for AgentOS Service Integration
 * Handles routing, authentication, rate limiting, and request/response transformation
 */

import {
  ServiceRequest,
  ServiceResponse,
  ServiceDefinition,
  ServiceError,
  ApiGatewayConfig,
  RequestTransformer,
  ResponseTransformer,
  AuthenticationProvider,
  RateLimiter,
  ServiceMetrics,
  HttpMethod
} from './types';
import { ServiceRegistry } from './service-registry';

export class ApiGateway {
  private config: ApiGatewayConfig;
  private requestTransformers: RequestTransformer[] = [];
  private responseTransformers: ResponseTransformer[] = [];
  private authProviders = new Map<string, AuthenticationProvider>();
  private rateLimiter?: RateLimiter;
  private metrics = new Map<string, ServiceMetrics>();

  constructor(
    private serviceRegistry: ServiceRegistry,
    config?: Partial<ApiGatewayConfig>
  ) {
    this.config = {
      defaultTimeout: 30000,
      defaultRetryPolicy: {
        maxAttempts: 3,
        backoffMs: 1000,
        exponential: true,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504]
      },
      enableMetrics: true,
      enableLogging: true,
      corsEnabled: true,
      corsOrigins: ['*'],
      ...config
    };
  }

  /**
   * Execute a service request through the gateway
   */
  async executeRequest(request: ServiceRequest): Promise<ServiceResponse> {
    const startTime = Date.now();
    
    try {
      // Get service definition
      const service = await this.serviceRegistry.getService(request.serviceId);
      if (!service) {
        throw new Error(`Service not found: ${request.serviceId}`);
      }

      // Validate endpoint exists
      const endpoint = service.endpoints.find(
        e => e.path === request.endpoint && e.method === request.method
      );
      if (!endpoint) {
        throw new Error(`Endpoint not found: ${request.method} ${request.endpoint}`);
      }

      // Check rate limits
      if (this.rateLimiter && (endpoint.rateLimit || service.rateLimit)) {
        const rateLimitConfig = endpoint.rateLimit || service.rateLimit!;
        const allowed = await this.rateLimiter.checkLimit(
          request.serviceId,
          request.endpoint,
          rateLimitConfig
        );
        
        if (!allowed) {
          return this.createErrorResponse(
            429,
            'RATE_LIMIT_EXCEEDED',
            'Rate limit exceeded',
            Date.now() - startTime
          );
        }
      }

      // Apply request transformations
      let transformedRequest = request;
      for (const transformer of this.requestTransformers) {
        transformedRequest = await transformer.transform(transformedRequest, service);
      }

      // Handle authentication
      if (endpoint.authentication !== false && service.authentication.type !== 'none') {
        const authProvider = this.authProviders.get(service.authentication.type);
        if (authProvider) {
          transformedRequest = await authProvider.authenticate(
            service.authentication,
            transformedRequest
          );
        }
      }

      // Execute request with retry logic
      const response = await this.executeWithRetry(transformedRequest, service, endpoint);

      // Apply response transformations
      let transformedResponse = response;
      for (const transformer of this.responseTransformers) {
        transformedResponse = await transformer.transform(transformedResponse, service);
      }

      // Update metrics
      if (this.config.enableMetrics) {
        this.updateMetrics(request, transformedResponse);
      }

      // Log request if enabled
      if (this.config.enableLogging) {
        this.logRequest(request, transformedResponse);
      }

      return transformedResponse;

    } catch (error) {
      const errorResponse = this.createErrorResponse(
        500,
        'GATEWAY_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );

      // Update metrics for failed request
      if (this.config.enableMetrics) {
        this.updateMetrics(request, errorResponse);
      }

      return errorResponse;
    }
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry(
    request: ServiceRequest,
    service: ServiceDefinition,
    endpoint: any
  ): Promise<ServiceResponse> {
    const retryPolicy = request.retryPolicy || service.retryPolicy || this.config.defaultRetryPolicy;
    const timeout = request.timeout || endpoint.timeout || service.timeout || this.config.defaultTimeout;
    
    let lastError: any;

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        const response = await this.executeHttpRequest(request, service, timeout);
        
        // Check if response indicates success
        if (response.success || !this.isRetryableError(response, retryPolicy)) {
          return response;
        }

        lastError = response.error;

      } catch (error) {
        lastError = error;
      }

      // Wait before retry (except on last attempt)
      if (attempt < retryPolicy.maxAttempts) {
        const delay = retryPolicy.exponential 
          ? retryPolicy.backoffMs * Math.pow(2, attempt - 1)
          : retryPolicy.backoffMs;
        await this.sleep(delay);
      }
    }

    // All retries failed
    return this.createErrorResponse(
      500,
      'MAX_RETRIES_EXCEEDED',
      `Request failed after ${retryPolicy.maxAttempts} attempts: ${lastError?.message || 'Unknown error'}`,
      0
    );
  }

  /**
   * Execute HTTP request
   */
  private async executeHttpRequest(
    request: ServiceRequest,
    service: ServiceDefinition,
    timeout: number
  ): Promise<ServiceResponse> {
    const startTime = Date.now();
    const url = `${service.baseUrl}${request.endpoint}`;
    
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...request.headers
      },
      signal: AbortSignal.timeout(timeout)
    };

    // Add body for non-GET requests
    if (request.method !== HttpMethod.GET && request.body) {
      fetchOptions.body = JSON.stringify(request.body);
    }

    // Add query parameters for GET requests
    let finalUrl = url;
    if (request.method === HttpMethod.GET && request.parameters) {
      const params = new URLSearchParams();
      Object.entries(request.parameters).forEach(([key, value]) => {
        params.append(key, String(value));
      });
      finalUrl = `${url}?${params.toString()}`;
    }

    try {
      const response = await fetch(finalUrl, fetchOptions);
      const duration = Date.now() - startTime;
      
      let data: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        success: response.ok,
        statusCode: response.status,
        data,
        headers,
        duration,
        error: response.ok ? undefined : {
          code: `HTTP_${response.status}`,
          message: response.statusText || 'Request failed',
          details: data,
          retryable: this.isRetryableStatusCode(response.status)
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        statusCode: 0,
        duration,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
          details: error,
          retryable: true
        }
      };
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(response: ServiceResponse, retryPolicy: any): boolean {
    if (!response.error) {
      return false;
    }

    if (response.error.retryable === false) {
      return false;
    }

    if (retryPolicy.retryableStatusCodes) {
      return retryPolicy.retryableStatusCodes.includes(response.statusCode);
    }

    // Default retryable status codes
    return [408, 429, 500, 502, 503, 504].includes(response.statusCode);
  }

  /**
   * Check if status code is retryable
   */
  private isRetryableStatusCode(statusCode: number): boolean {
    return [408, 429, 500, 502, 503, 504].includes(statusCode);
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    statusCode: number,
    code: string,
    message: string,
    duration: number
  ): ServiceResponse {
    return {
      success: false,
      statusCode,
      duration,
      error: {
        code,
        message,
        retryable: this.isRetryableStatusCode(statusCode)
      }
    };
  }

  /**
   * Update request metrics
   */
  private updateMetrics(request: ServiceRequest, response: ServiceResponse): void {
    const key = `${request.serviceId}:${request.endpoint}`;
    let metrics = this.metrics.get(key);

    if (!metrics) {
      metrics = {
        serviceId: request.serviceId,
        endpoint: request.endpoint,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastRequestTime: new Date(),
        errorRate: 0
      };
      this.metrics.set(key, metrics);
    }

    metrics.totalRequests++;
    metrics.lastRequestTime = new Date();

    if (response.success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    // Update average response time
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (metrics.totalRequests - 1) + response.duration) / 
      metrics.totalRequests;

    // Update error rate
    metrics.errorRate = (metrics.failedRequests / metrics.totalRequests) * 100;
  }

  /**
   * Log request
   */
  private logRequest(request: ServiceRequest, response: ServiceResponse): void {
    const logLevel = response.success ? 'info' : 'error';
    const message = `${request.method} ${request.serviceId}${request.endpoint} - ${response.statusCode} (${response.duration}ms)`;
    
    console.log(`[API Gateway] [${logLevel.toUpperCase()}] ${message}`);
    
    if (!response.success && response.error) {
      console.error(`[API Gateway] Error details:`, response.error);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Configuration methods

  /**
   * Add request transformer
   */
  addRequestTransformer(transformer: RequestTransformer): void {
    this.requestTransformers.push(transformer);
  }

  /**
   * Add response transformer
   */
  addResponseTransformer(transformer: ResponseTransformer): void {
    this.responseTransformers.push(transformer);
  }

  /**
   * Register authentication provider
   */
  registerAuthProvider(type: string, provider: AuthenticationProvider): void {
    this.authProviders.set(type, provider);
  }

  /**
   * Set rate limiter
   */
  setRateLimiter(rateLimiter: RateLimiter): void {
    this.rateLimiter = rateLimiter;
  }

  /**
   * Get service metrics
   */
  getMetrics(serviceId?: string): ServiceMetrics[] {
    const allMetrics = Array.from(this.metrics.values());
    
    if (serviceId) {
      return allMetrics.filter(m => m.serviceId === serviceId);
    }
    
    return allMetrics;
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Get gateway configuration
   */
  getConfig(): ApiGatewayConfig {
    return { ...this.config };
  }

  /**
   * Update gateway configuration
   */
  updateConfig(updates: Partial<ApiGatewayConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}