/**
 * Authentication Providers for AgentOS Service Integration
 * Supports various authentication methods
 */

import {
  AuthenticationProvider,
  AuthenticationConfig,
  ServiceRequest,
  HttpMethod
} from './types';

/**
 * API Key Authentication Provider
 */
export class ApiKeyAuthProvider implements AuthenticationProvider {
  async authenticate(config: AuthenticationConfig, request: ServiceRequest): Promise<ServiceRequest> {
    const { apiKey, headerName = 'X-API-Key', queryParam } = config.config;
    
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const authenticatedRequest = { ...request };

    if (queryParam) {
      // Add API key as query parameter
      authenticatedRequest.parameters = {
        ...authenticatedRequest.parameters,
        [queryParam]: apiKey
      };
    } else {
      // Add API key as header
      authenticatedRequest.headers = {
        ...authenticatedRequest.headers,
        [headerName]: apiKey
      };
    }

    return authenticatedRequest;
  }
}

/**
 * OAuth2 Authentication Provider
 */
export class OAuth2AuthProvider implements AuthenticationProvider {
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();

  async authenticate(config: AuthenticationConfig, request: ServiceRequest): Promise<ServiceRequest> {
    const { clientId, clientSecret, tokenUrl, scope } = config.config;
    
    if (!clientId || !clientSecret || !tokenUrl) {
      throw new Error('OAuth2 configuration incomplete');
    }

    const cacheKey = `${clientId}:${scope || 'default'}`;
    let cachedToken = this.tokenCache.get(cacheKey);

    // Check if token is expired or doesn't exist
    if (!cachedToken || Date.now() >= cachedToken.expiresAt) {
      cachedToken = await this.getAccessToken(config);
      this.tokenCache.set(cacheKey, cachedToken);
    }

    const authenticatedRequest = { ...request };
    authenticatedRequest.headers = {
      ...authenticatedRequest.headers,
      'Authorization': `Bearer ${cachedToken.token}`
    };

    return authenticatedRequest;
  }

  async refreshToken(config: AuthenticationConfig): Promise<void> {
    const { clientId, scope } = config.config;
    const cacheKey = `${clientId}:${scope || 'default'}`;
    
    // Remove cached token to force refresh
    this.tokenCache.delete(cacheKey);
  }

  private async getAccessToken(config: AuthenticationConfig): Promise<{ token: string; expiresAt: number }> {
    const { clientId, clientSecret, tokenUrl, scope } = config.config;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        ...(scope && { scope })
      })
    });

    if (!response.ok) {
      throw new Error(`OAuth2 token request failed: ${response.statusText}`);
    }

    const tokenData = await response.json();
    
    if (!tokenData.access_token) {
      throw new Error('Invalid OAuth2 token response');
    }

    const expiresIn = tokenData.expires_in || 3600; // Default to 1 hour
    const expiresAt = Date.now() + (expiresIn * 1000) - 60000; // Subtract 1 minute for safety

    return {
      token: tokenData.access_token,
      expiresAt
    };
  }
}

/**
 * JWT Authentication Provider
 */
export class JWTAuthProvider implements AuthenticationProvider {
  async authenticate(config: AuthenticationConfig, request: ServiceRequest): Promise<ServiceRequest> {
    const { token, headerName = 'Authorization', prefix = 'Bearer' } = config.config;
    
    if (!token) {
      throw new Error('JWT token not configured');
    }

    const authenticatedRequest = { ...request };
    const authValue = prefix ? `${prefix} ${token}` : token;
    
    authenticatedRequest.headers = {
      ...authenticatedRequest.headers,
      [headerName]: authValue
    };

    return authenticatedRequest;
  }
}

/**
 * Basic Authentication Provider
 */
export class BasicAuthProvider implements AuthenticationProvider {
  async authenticate(config: AuthenticationConfig, request: ServiceRequest): Promise<ServiceRequest> {
    const { username, password } = config.config;
    
    if (!username || !password) {
      throw new Error('Basic auth credentials not configured');
    }

    const credentials = btoa(`${username}:${password}`);
    
    const authenticatedRequest = { ...request };
    authenticatedRequest.headers = {
      ...authenticatedRequest.headers,
      'Authorization': `Basic ${credentials}`
    };

    return authenticatedRequest;
  }
}

/**
 * Custom Authentication Provider
 * Allows for custom authentication logic
 */
export class CustomAuthProvider implements AuthenticationProvider {
  constructor(
    private customAuthFunction: (config: AuthenticationConfig, request: ServiceRequest) => Promise<ServiceRequest>
  ) {}

  async authenticate(config: AuthenticationConfig, request: ServiceRequest): Promise<ServiceRequest> {
    return this.customAuthFunction(config, request);
  }
}

/**
 * Authentication Provider Factory
 */
export class AuthProviderFactory {
  private static providers = new Map<string, () => AuthenticationProvider>([
    ['api_key', () => new ApiKeyAuthProvider()],
    ['oauth2', () => new OAuth2AuthProvider()],
    ['jwt', () => new JWTAuthProvider()],
    ['basic', () => new BasicAuthProvider()]
  ]);

  static createProvider(type: string): AuthenticationProvider {
    const providerFactory = this.providers.get(type);
    
    if (!providerFactory) {
      throw new Error(`Unknown authentication type: ${type}`);
    }

    return providerFactory();
  }

  static registerProvider(type: string, factory: () => AuthenticationProvider): void {
    this.providers.set(type, factory);
  }

  static getSupportedTypes(): string[] {
    return Array.from(this.providers.keys());
  }
}