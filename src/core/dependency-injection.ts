/**
 * AgentOS Dependency Injection Container
 * Simple DI container for managing system dependencies
 */

export interface Constructor<T = any> {
  new (...args: any[]): T;
}

export interface Factory<T = any> {
  (): T;
}

export interface DependencyToken<T = any> {
  readonly symbol: symbol;
  readonly name: string;
}

export class DependencyInjectionContainer {
  private static instance: DependencyInjectionContainer;
  private services = new Map<symbol, any>();
  private factories = new Map<symbol, Factory>();
  private singletons = new Map<symbol, any>();

  private constructor() {}

  public static getInstance(): DependencyInjectionContainer {
    if (!DependencyInjectionContainer.instance) {
      DependencyInjectionContainer.instance = new DependencyInjectionContainer();
    }
    return DependencyInjectionContainer.instance;
  }

  /**
   * Register a service with a token
   */
  public register<T>(token: DependencyToken<T>, implementation: Constructor<T> | Factory<T>, singleton = true): void {
    if (implementation.prototype) {
      // It's a constructor
      if (singleton) {
        this.factories.set(token.symbol, () => {
          if (!this.singletons.has(token.symbol)) {
            this.singletons.set(token.symbol, new (implementation as Constructor<T>)());
          }
          return this.singletons.get(token.symbol);
        });
      } else {
        this.factories.set(token.symbol, () => new (implementation as Constructor<T>)());
      }
    } else {
      // It's a factory function
      this.factories.set(token.symbol, implementation as Factory);
    }
  }

  /**
   * Register a service instance directly
   */
  public registerInstance<T>(token: DependencyToken<T>, instance: T): void {
    this.services.set(token.symbol, instance);
  }

  /**
   * Resolve a service
   */
  public resolve<T>(token: DependencyToken<T>): T {
    // Check if instance is already registered
    if (this.services.has(token.symbol)) {
      return this.services.get(token.symbol);
    }

    // Check if factory exists
    if (this.factories.has(token.symbol)) {
      const instance = this.factories.get(token.symbol)!();
      return instance;
    }

    throw new Error(`Service not registered for token: ${token.name}`);
  }

  /**
   * Check if a service is registered
   */
  public has<T>(token: DependencyToken<T>): boolean {
    return this.services.has(token.symbol) || this.factories.has(token.symbol);
  }

  /**
   * Remove a service registration
   */
  public remove<T>(token: DependencyToken<T>): void {
    this.services.delete(token.symbol);
    this.factories.delete(token.symbol);
    this.singletons.delete(token.symbol);
  }

  /**
   * Clear all registrations
   */
  public clear(): void {
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
  }

  /**
   * Get all registered service names
   */
  public getRegisteredServices(): string[] {
    const services = Array.from(this.services.keys()).map(symbol => this.getTokenName(symbol));
    const factories = Array.from(this.factories.keys()).map(symbol => this.getTokenName(symbol));
    return [...new Set([...services, ...factories])];
  }

  private getTokenName(symbol: symbol): string {
    // Try to find the token name by searching through registered tokens
    // This is a simplified implementation - in a real system you'd maintain a reverse map
    return symbol.toString();
  }
}

/**
 * Create a dependency token
 */
export function createToken<T>(name: string): DependencyToken<T> {
  return {
    symbol: Symbol(name),
    name
  };
}

/**
 * AgentOS Service Tokens
 */
export const TOKENS = {
  // Core services
  CONFIG: createToken<any>('config'),
  LOGGER: createToken<any>('logger'),
  EVENT_EMITTER: createToken<any>('eventEmitter'),

  // Intelligence Layer
  NLP_ENGINE: createToken<any>('nlpEngine'),
  INTENT_CLASSIFIER: createToken<any>('intentClassifier'),
  ENTITY_EXTRACTOR: createToken<any>('entityExtractor'),
  CONTEXT_MANAGER: createToken<any>('contextManager'),
  LANGUAGE_DETECTOR: createToken<any>('languageDetector'),

  // Plugin Framework
  PLUGIN_MANAGER: createToken<any>('pluginManager'),
  PLUGIN_REGISTRY: createToken<any>('pluginRegistry'),
  PLUGIN_SANDBOX: createToken<any>('pluginSandbox'),
  PLUGIN_VALIDATOR: createToken<any>('pluginValidator'),

  // Voice Interface
  VOICE_PROCESSOR: createToken<any>('voiceProcessor'),
  SPEECH_TO_TEXT: createToken<any>('speechToText'),
  TEXT_TO_SPEECH: createToken<any>('textToSpeech'),
  VOICE_ACTIVITY_DETECTOR: createToken<any>('voiceActivityDetector'),

  // Security
  ZERO_TRUST_FRAMEWORK: createToken<any>('zeroTrustFramework'),
  ACCESS_CONTROL: createToken<any>('accessControl'),
  ANOMALY_DETECTOR: createToken<any>('anomalyDetector'),
  CONSENT_MANAGER: createToken<any>('consentManager'),

  // Performance
  RESOURCE_MANAGER: createToken<any>('resourceManager'),
  BATTERY_OPTIMIZER: createToken<any>('batteryOptimizer'),
  AI_SCHEDULER: createToken<any>('aiScheduler'),
  MODEL_QUANTIZER: createToken<any>('modelQuantizer'),

  // Caregiver
  CAREGIVER_AUTH: createToken<any>('caregiverAuth'),
  MONITORING_SERVICE: createToken<any>('monitoringService'),
  COMMUNICATION_SERVICE: createToken<any>('communicationService'),
  ACCESS_AUDIT_LOGGER: createToken<any>('accessAuditLogger')
};

/**
 * Initialize core services in the DI container
 */
export function initializeServices(config: any): void {
  const container = DependencyInjectionContainer.getInstance();

  // Register configuration
  container.registerInstance(TOKENS.CONFIG, config);

  // Register core services - these will be implemented as we build them
  // For now, we'll register placeholder services

  console.log('Dependency injection container initialized with services:', container.getRegisteredServices());
}

/**
 * Get the DI container instance
 */
export function getContainer(): DependencyInjectionContainer {
  return DependencyInjectionContainer.getInstance();
}
