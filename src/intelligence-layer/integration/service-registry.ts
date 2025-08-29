/**
 * Service Registry for AgentOS Integration Framework
 * Manages service discovery and registration
 */

import {
  ServiceDefinition,
  ServiceRegistry,
  ServiceDiscoveryCriteria,
  ServiceHealth,
  HealthCheckConfig
} from './types';

export class DefaultServiceRegistry implements ServiceRegistry {
  private services = new Map<string, ServiceDefinition>();
  private serviceHealth = new Map<string, ServiceHealth>();
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * Register a service in the registry
   */
  async register(service: ServiceDefinition): Promise<void> {
    this.validateService(service);
    
    this.services.set(service.serviceId, service);
    
    // Initialize health status
    this.serviceHealth.set(service.serviceId, {
      serviceId: service.serviceId,
      status: 'unknown',
      lastCheck: new Date()
    });

    // Start health checks if configured
    if (service.healthCheck) {
      this.startHealthCheck(service);
    }

    console.log(`Service registered: ${service.serviceId} (${service.name})`);
  }

  /**
   * Unregister a service from the registry
   */
  async unregister(serviceId: string): Promise<void> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    // Stop health checks
    const interval = this.healthCheckIntervals.get(serviceId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serviceId);
    }

    this.services.delete(serviceId);
    this.serviceHealth.delete(serviceId);

    console.log(`Service unregistered: ${serviceId}`);
  }

  /**
   * Discover services based on criteria
   */
  async discover(criteria?: ServiceDiscoveryCriteria): Promise<ServiceDefinition[]> {
    let services = Array.from(this.services.values());

    if (!criteria) {
      return services;
    }

    // Filter by name
    if (criteria.name) {
      services = services.filter(s => 
        s.name.toLowerCase().includes(criteria.name!.toLowerCase())
      );
    }

    // Filter by version
    if (criteria.version) {
      services = services.filter(s => s.version === criteria.version);
    }

    // Filter by health status
    if (criteria.healthy !== undefined) {
      services = services.filter(s => {
        const health = this.serviceHealth.get(s.serviceId);
        const isHealthy = health?.status === 'healthy';
        return criteria.healthy ? isHealthy : !isHealthy;
      });
    }

    return services;
  }

  /**
   * Get a specific service by ID
   */
  async getService(serviceId: string): Promise<ServiceDefinition | undefined> {
    return this.services.get(serviceId);
  }

  /**
   * Update service configuration
   */
  async updateService(serviceId: string, updates: Partial<ServiceDefinition>): Promise<void> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    const updatedService = { ...service, ...updates };
    this.validateService(updatedService);
    
    this.services.set(serviceId, updatedService);

    // Restart health checks if configuration changed
    if (updates.healthCheck) {
      const interval = this.healthCheckIntervals.get(serviceId);
      if (interval) {
        clearInterval(interval);
      }
      this.startHealthCheck(updatedService);
    }
  }

  /**
   * Get service health status
   */
  getServiceHealth(serviceId: string): ServiceHealth | undefined {
    return this.serviceHealth.get(serviceId);
  }

  /**
   * Get all service health statuses
   */
  getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  /**
   * Manually trigger health check for a service
   */
  async checkServiceHealth(serviceId: string): Promise<ServiceHealth> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    return this.performHealthCheck(service);
  }

  /**
   * Validate service definition
   */
  private validateService(service: ServiceDefinition): void {
    if (!service.serviceId) {
      throw new Error('Service must have an ID');
    }

    if (!service.name) {
      throw new Error('Service must have a name');
    }

    if (!service.version) {
      throw new Error('Service must have a version');
    }

    if (!service.baseUrl) {
      throw new Error('Service must have a base URL');
    }

    if (!service.endpoints || service.endpoints.length === 0) {
      throw new Error('Service must have at least one endpoint');
    }

    // Validate endpoint paths are unique
    const paths = new Set<string>();
    for (const endpoint of service.endpoints) {
      const key = `${endpoint.method}:${endpoint.path}`;
      if (paths.has(key)) {
        throw new Error(`Duplicate endpoint: ${key}`);
      }
      paths.add(key);
    }
  }

  /**
   * Start health check monitoring for a service
   */
  private startHealthCheck(service: ServiceDefinition): void {
    if (!service.healthCheck) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        await this.performHealthCheck(service);
      } catch (error) {
        console.error(`Health check failed for ${service.serviceId}:`, error);
      }
    }, service.healthCheck.intervalMs);

    this.healthCheckIntervals.set(service.serviceId, interval);

    // Perform initial health check
    this.performHealthCheck(service).catch(error => {
      console.error(`Initial health check failed for ${service.serviceId}:`, error);
    });
  }

  /**
   * Perform health check for a service
   */
  private async performHealthCheck(service: ServiceDefinition): Promise<ServiceHealth> {
    const health = this.serviceHealth.get(service.serviceId)!;
    const startTime = Date.now();

    try {
      if (!service.healthCheck) {
        health.status = 'unknown';
        health.lastCheck = new Date();
        return health;
      }

      const response = await fetch(
        `${service.baseUrl}${service.healthCheck.endpoint}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(service.healthCheck.timeoutMs)
        }
      );

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        health.status = 'healthy';
        health.responseTime = responseTime;
        health.error = undefined;
      } else {
        health.status = 'unhealthy';
        health.error = `HTTP ${response.status}: ${response.statusText}`;
      }

    } catch (error) {
      health.status = 'unhealthy';
      health.error = error instanceof Error ? error.message : 'Unknown error';
      health.responseTime = Date.now() - startTime;
    }

    health.lastCheck = new Date();
    return health;
  }

  /**
   * List all registered services
   */
  listServices(): ServiceDefinition[] {
    return Array.from(this.services.values());
  }

  /**
   * Get service count
   */
  getServiceCount(): number {
    return this.services.size;
  }

  /**
   * Clear all services (for testing)
   */
  clear(): void {
    // Stop all health check intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }

    this.services.clear();
    this.serviceHealth.clear();
    this.healthCheckIntervals.clear();
  }
}