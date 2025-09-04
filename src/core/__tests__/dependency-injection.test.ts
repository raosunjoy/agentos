/**
 * Dependency Injection Container Tests
 * Tests for the DI container functionality
 */

import {
  DependencyInjectionContainer,
  createToken,
  TOKENS,
  initializeServices,
  getContainer
} from '../dependency-injection';

describe('DependencyInjectionContainer', () => {
  let container: DependencyInjectionContainer;

  beforeEach(() => {
    container = new DependencyInjectionContainer();
  });

  afterEach(() => {
    container.clear();
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = DependencyInjectionContainer.getInstance();
      const instance2 = DependencyInjectionContainer.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Service Registration', () => {
    test('should register and resolve a class', () => {
      class TestService {
        getValue() {
          return 'test';
        }
      }

      const token = createToken<TestService>('testService');
      container.register(token, TestService);

      const instance = container.resolve(token);
      expect(instance).toBeInstanceOf(TestService);
      expect(instance.getValue()).toBe('test');
    });

    test('should register and resolve a factory function', () => {
      const token = createToken<string>('testValue');
      container.register(token, () => 'factory-value');

      const value = container.resolve(token);
      expect(value).toBe('factory-value');
    });

    test('should register instance directly', () => {
      const token = createToken<number>('testNumber');
      container.registerInstance(token, 42);

      const value = container.resolve(token);
      expect(value).toBe(42);
    });

    test('should handle singleton registration', () => {
      class TestService {
        constructor() {
          this.id = Math.random();
        }
        id: number;
      }

      const token = createToken<TestService>('singletonService');
      container.register(token, TestService, true);

      const instance1 = container.resolve(token);
      const instance2 = container.resolve(token);

      expect(instance1).toBe(instance2);
      expect(instance1.id).toBe(instance2.id);
    });

    test('should handle transient registration', () => {
      class TestService {
        constructor() {
          this.id = Math.random();
        }
        id: number;
      }

      const token = createToken<TestService>('transientService');
      container.register(token, TestService, false);

      const instance1 = container.resolve(token);
      const instance2 = container.resolve(token);

      expect(instance1).not.toBe(instance2);
      expect(instance1.id).not.toBe(instance2.id);
    });
  });

  describe('Service Resolution', () => {
    test('should throw error for unregistered service', () => {
      const token = createToken<string>('unregistered');

      expect(() => {
        container.resolve(token);
      }).toThrow('Service not registered for token: unregistered');
    });

    test('should check if service is registered', () => {
      const token = createToken<string>('testService');

      expect(container.has(token)).toBe(false);

      container.registerInstance(token, 'test');
      expect(container.has(token)).toBe(true);
    });
  });

  describe('Service Management', () => {
    test('should remove service registration', () => {
      const token = createToken<string>('removableService');
      container.registerInstance(token, 'test');

      expect(container.has(token)).toBe(true);

      container.remove(token);
      expect(container.has(token)).toBe(false);
    });

    test('should clear all registrations', () => {
      const token1 = createToken<string>('service1');
      const token2 = createToken<string>('service2');

      container.registerInstance(token1, 'value1');
      container.registerInstance(token2, 'value2');

      expect(container.has(token1)).toBe(true);
      expect(container.has(token2)).toBe(true);

      container.clear();

      expect(container.has(token1)).toBe(false);
      expect(container.has(token2)).toBe(false);
    });

    test('should return registered service names', () => {
      const token1 = createToken<string>('service1');
      const token2 = createToken<string>('service2');

      container.registerInstance(token1, 'value1');
      container.registerInstance(token2, 'value2');

      const services = container.getRegisteredServices();
      expect(services.length).toBe(2);
      expect(services).toContain(token1.name);
      expect(services).toContain(token2.name);
    });
  });
});

describe('TOKENS', () => {
  test('should have all required tokens defined', () => {
    expect(TOKENS.CONFIG).toBeDefined();
    expect(TOKENS.LOGGER).toBeDefined();
    expect(TOKENS.NLP_ENGINE).toBeDefined();
    expect(TOKENS.PLUGIN_MANAGER).toBeDefined();
    expect(TOKENS.ZERO_TRUST_FRAMEWORK).toBeDefined();
    expect(TOKENS.RESOURCE_MANAGER).toBeDefined();
  });

  test('should create unique symbols for each token', () => {
    const token1 = createToken<string>('token1');
    const token2 = createToken<string>('token2');

    expect(token1.symbol).not.toBe(token2.symbol);
    expect(token1.name).toBe('token1');
    expect(token2.name).toBe('token2');
  });
});

describe('Service Initialization', () => {
  let container: DependencyInjectionContainer;

  beforeEach(() => {
    container = DependencyInjectionContainer.getInstance();
    container.clear();
  });

  afterEach(() => {
    container.clear();
  });

  test('should initialize services with config', () => {
    const config = { version: '1.0.0', environment: 'test' };

    initializeServices(config);

    expect(container.has(TOKENS.CONFIG)).toBe(true);
    expect(container.resolve(TOKENS.CONFIG)).toBe(config);
  });

  test('should provide container instance', () => {
    const containerInstance = getContainer();
    expect(containerInstance).toBeInstanceOf(DependencyInjectionContainer);
  });
});
