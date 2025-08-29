/**
 * Request/Response Transformers for AgentOS Service Integration
 * Handles data transformation and routing logic
 */

import {
  RequestTransformer,
  ResponseTransformer,
  ServiceRequest,
  ServiceResponse,
  ServiceDefinition,
  ParameterDefinition,
  ValidationRule
} from './types';

/**
 * Parameter Validation Transformer
 * Validates request parameters against service definitions
 */
export class ParameterValidationTransformer implements RequestTransformer {
  async transform(request: ServiceRequest, service: ServiceDefinition): Promise<ServiceRequest> {
    const endpoint = service.endpoints.find(
      e => e.path === request.endpoint && e.method === request.method
    );

    if (!endpoint || !endpoint.parameters) {
      return request;
    }

    const validatedRequest = { ...request };
    const errors: string[] = [];

    // Validate each parameter
    for (const paramDef of endpoint.parameters) {
      const value = request.parameters?.[paramDef.name];

      // Check required parameters
      if (paramDef.required && (value === undefined || value === null)) {
        errors.push(`Required parameter missing: ${paramDef.name}`);
        continue;
      }

      // Skip validation if parameter is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!this.validateType(value, paramDef.type)) {
        errors.push(`Invalid type for parameter ${paramDef.name}: expected ${paramDef.type}`);
        continue;
      }

      // Custom validation rules
      if (paramDef.validation) {
        for (const rule of paramDef.validation) {
          if (!this.validateRule(value, rule)) {
            errors.push(rule.message || `Validation failed for parameter ${paramDef.name}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Parameter validation failed: ${errors.join(', ')}`);
    }

    return validatedRequest;
  }

  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true; // Unknown type, skip validation
    }
  }

  private validateRule(value: any, rule: ValidationRule): boolean {
    switch (rule.type) {
      case 'min':
        return typeof value === 'number' ? value >= rule.value : value.length >= rule.value;
      case 'max':
        return typeof value === 'number' ? value <= rule.value : value.length <= rule.value;
      case 'pattern':
        return typeof value === 'string' && new RegExp(rule.value).test(value);
      case 'enum':
        return Array.isArray(rule.value) && rule.value.includes(value);
      case 'custom':
        return typeof rule.value === 'function' ? rule.value(value) : true;
      default:
        return true;
    }
  }
}

/**
 * Data Format Transformer
 * Converts data between different formats (JSON, XML, etc.)
 */
export class DataFormatTransformer implements RequestTransformer, ResponseTransformer {
  async transform(request: ServiceRequest, service: ServiceDefinition): Promise<ServiceRequest>;
  async transform(response: ServiceResponse, service: ServiceDefinition): Promise<ServiceResponse>;
  async transform(
    requestOrResponse: ServiceRequest | ServiceResponse,
    service: ServiceDefinition
  ): Promise<ServiceRequest | ServiceResponse> {
    
    if ('method' in requestOrResponse) {
      // It's a request
      return this.transformRequest(requestOrResponse, service);
    } else {
      // It's a response
      return this.transformResponse(requestOrResponse, service);
    }
  }

  private async transformRequest(request: ServiceRequest, service: ServiceDefinition): Promise<ServiceRequest> {
    // Example: Convert request body to XML if service expects XML
    const endpoint = service.endpoints.find(
      e => e.path === request.endpoint && e.method === request.method
    );

    if (endpoint?.requestSchema?.format === 'xml' && request.body) {
      const transformedRequest = { ...request };
      transformedRequest.body = this.jsonToXml(request.body);
      transformedRequest.headers = {
        ...transformedRequest.headers,
        'Content-Type': 'application/xml'
      };
      return transformedRequest;
    }

    return request;
  }

  private async transformResponse(response: ServiceResponse, service: ServiceDefinition): Promise<ServiceResponse> {
    // Example: Convert XML response to JSON
    const contentType = response.headers?.['content-type'] || '';
    
    if (contentType.includes('xml') && typeof response.data === 'string') {
      const transformedResponse = { ...response };
      try {
        transformedResponse.data = this.xmlToJson(response.data);
      } catch (error) {
        console.warn('Failed to convert XML to JSON:', error);
      }
      return transformedResponse;
    }

    return response;
  }

  private jsonToXml(obj: any): string {
    // Simple JSON to XML conversion (for demonstration)
    const convertObject = (obj: any, rootName = 'root'): string => {
      if (typeof obj !== 'object' || obj === null) {
        return `<${rootName}>${obj}</${rootName}>`;
      }

      let xml = `<${rootName}>`;
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            xml += convertObject(item, key);
          }
        } else {
          xml += convertObject(value, key);
        }
      }
      xml += `</${rootName}>`;
      return xml;
    };

    return convertObject(obj);
  }

  private xmlToJson(xml: string): any {
    // Simple XML to JSON conversion (for demonstration)
    // In a real implementation, you'd use a proper XML parser
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      return this.xmlNodeToJson(doc.documentElement);
    } catch (error) {
      throw new Error(`Failed to parse XML: ${error.message}`);
    }
  }

  private xmlNodeToJson(node: Element): any {
    const result: any = {};

    // Handle attributes
    if (node.attributes.length > 0) {
      result['@attributes'] = {};
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        result['@attributes'][attr.name] = attr.value;
      }
    }

    // Handle child nodes
    if (node.children.length === 0) {
      return node.textContent;
    }

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childName = child.tagName;
      const childValue = this.xmlNodeToJson(child);

      if (result[childName]) {
        if (!Array.isArray(result[childName])) {
          result[childName] = [result[childName]];
        }
        result[childName].push(childValue);
      } else {
        result[childName] = childValue;
      }
    }

    return result;
  }
}

/**
 * Header Injection Transformer
 * Adds standard headers to requests
 */
export class HeaderInjectionTransformer implements RequestTransformer {
  constructor(private defaultHeaders: Record<string, string> = {}) {}

  async transform(request: ServiceRequest, service: ServiceDefinition): Promise<ServiceRequest> {
    const transformedRequest = { ...request };
    
    transformedRequest.headers = {
      'User-Agent': 'AgentOS/1.0',
      'Accept': 'application/json',
      ...this.defaultHeaders,
      ...transformedRequest.headers
    };

    return transformedRequest;
  }

  addDefaultHeader(name: string, value: string): void {
    this.defaultHeaders[name] = value;
  }

  removeDefaultHeader(name: string): void {
    delete this.defaultHeaders[name];
  }
}

/**
 * Response Normalization Transformer
 * Normalizes response format across different services
 */
export class ResponseNormalizationTransformer implements ResponseTransformer {
  async transform(response: ServiceResponse, service: ServiceDefinition): Promise<ServiceResponse> {
    const transformedResponse = { ...response };

    // Normalize error format
    if (!response.success && response.data) {
      const normalizedError = this.normalizeError(response.data);
      if (normalizedError) {
        transformedResponse.error = {
          ...transformedResponse.error,
          ...normalizedError
        };
      }
    }

    // Add service metadata
    transformedResponse.data = {
      ...transformedResponse.data,
      _metadata: {
        serviceId: service.serviceId,
        serviceName: service.name,
        version: service.version,
        timestamp: new Date().toISOString()
      }
    };

    return transformedResponse;
  }

  private normalizeError(errorData: any): Partial<{ code: string; message: string; details: any }> | null {
    // Try to extract error information from common formats
    if (typeof errorData === 'string') {
      return { message: errorData };
    }

    if (typeof errorData === 'object') {
      // Common error formats
      const code = errorData.code || errorData.error_code || errorData.errorCode;
      const message = errorData.message || errorData.error_message || errorData.errorMessage || errorData.error;
      
      if (code || message) {
        return {
          code: code ? String(code) : undefined,
          message: message ? String(message) : undefined,
          details: errorData
        };
      }
    }

    return null;
  }
}

/**
 * Caching Transformer
 * Implements response caching for GET requests
 */
export class CachingTransformer implements RequestTransformer, ResponseTransformer {
  private cache = new Map<string, { response: ServiceResponse; expiresAt: number }>();
  private defaultTtl = 5 * 60 * 1000; // 5 minutes

  constructor(private ttl: number = 5 * 60 * 1000) {
    this.defaultTtl = ttl;
    
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  async transform(request: ServiceRequest, service: ServiceDefinition): Promise<ServiceRequest>;
  async transform(response: ServiceResponse, service: ServiceDefinition): Promise<ServiceResponse>;
  async transform(
    requestOrResponse: ServiceRequest | ServiceResponse,
    service: ServiceDefinition
  ): Promise<ServiceRequest | ServiceResponse> {
    
    if ('method' in requestOrResponse) {
      // It's a request - check cache
      return this.handleRequest(requestOrResponse, service);
    } else {
      // It's a response - store in cache
      return this.handleResponse(requestOrResponse, service);
    }
  }

  private async handleRequest(request: ServiceRequest, service: ServiceDefinition): Promise<ServiceRequest> {
    // Only cache GET requests
    if (request.method !== 'GET') {
      return request;
    }

    const cacheKey = this.getCacheKey(request, service);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      // Return cached response by throwing it (will be caught by the gateway)
      throw new CachedResponseError(cached.response);
    }

    return request;
  }

  private async handleResponse(response: ServiceResponse, service: ServiceDefinition): Promise<ServiceResponse> {
    // Only cache successful GET responses
    if (response.success) {
      const cacheKey = `${service.serviceId}:GET`; // Simplified for this example
      this.cache.set(cacheKey, {
        response,
        expiresAt: Date.now() + this.defaultTtl
      });
    }

    return response;
  }

  private getCacheKey(request: ServiceRequest, service: ServiceDefinition): string {
    const params = request.parameters ? JSON.stringify(request.parameters) : '';
    return `${service.serviceId}:${request.method}:${request.endpoint}:${params}`;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * Custom error for cached responses
 */
export class CachedResponseError extends Error {
  constructor(public response: ServiceResponse) {
    super('Cached response available');
    this.name = 'CachedResponseError';
  }
}