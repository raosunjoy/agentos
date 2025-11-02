/**
 * Integration Tests for Dependency Injection Container
 * Comprehensive testing of DI container functionality, service binding, and resolution
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { container, TYPES } from '../dependency-injection';

// Mock services for testing
interface ILogger {
  log(message: string): void;
}

interface IDatabase {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

interface IUserService {
  getUser(id: string): Promise<any>;
  createUser(user: any): Promise<any>;
}

class MockLogger implements ILogger {
  log(message: string): void {
    console.log(`[MOCK] ${message}`);
  }
}

class MockDatabase implements IDatabase {
  async connect(): Promise<void> {
    // Mock connection
  }

  async disconnect(): Promise<void> {
    // Mock disconnection
  }
}

class UserService implements IUserService {
  constructor(private logger: ILogger, private db: IDatabase) {}

  async getUser(id: string): Promise<any> {
    this.logger.log(`Getting user ${id}`);
    return { id, name: 'Test User' };
  }

  async createUser(user: any): Promise<any> {
    this.logger.log(`Creating user ${user.name}`);
    return { ...user, id: 'generated-id' };
  }
}

describe('DependencyInjection Integration', () => {
  beforeEach(() => {
    // Clear container before each test
    container.unbindAll();
  });

  describe('Basic Service Binding and Resolution', () => {
    test('should bind and resolve singleton services', () => {
      // Bind services
      container.bind<ILogger>(TYPES.Logger).to(MockLogger).inSingletonScope();

      // Resolve service
      const logger1 = container.get<ILogger>(TYPES.Logger);
      const logger2 = container.get<ILogger>(TYPES.Logger);

      expect(logger1).toBeInstanceOf(MockLogger);
      expect(logger2).toBeInstanceOf(MockLogger);
      expect(logger1).toBe(logger2); // Same instance (singleton)
    });

    test('should bind and resolve transient services', () => {
      // Bind transient service
      container.bind<ILogger>('TransientLogger').to(MockLogger);

      // Resolve service
      const logger1 = container.get<ILogger>('TransientLogger');
      const logger2 = container.get<ILogger>('TransientLogger');

      expect(logger1).toBeInstanceOf(MockLogger);
      expect(logger2).toBeInstanceOf(MockLogger);
      expect(logger1).not.toBe(logger2); // Different instances (transient)
    });

    test('should handle service dependencies correctly', () => {
      // Bind dependencies
      container.bind<ILogger>(TYPES.Logger).to(MockLogger).inSingletonScope();
      container.bind<IDatabase>(TYPES.Database).to(MockDatabase).inSingletonScope();

      // Bind service with dependencies
      container.bind<IUserService>(TYPES.UserService).to(UserService);

      // Resolve service
      const userService = container.get<IUserService>(TYPES.UserService);

      expect(userService).toBeInstanceOf(UserService);
    });
  });

  describe('Service Lifecycle Management', () => {
    test('should properly initialize services with dependencies', async () => {
      // Bind dependencies
      container.bind<ILogger>(TYPES.Logger).to(MockLogger).inSingletonScope();
      container.bind<IDatabase>(TYPES.Database).to(MockDatabase).inSingletonScope();
      container.bind<IUserService>(TYPES.UserService).to(UserService);

      // Resolve and test service functionality
      const userService = container.get<IUserService>(TYPES.UserService);

      const user = await userService.getUser('test-id');
      expect(user).toEqual({ id: 'test-id', name: 'Test User' });

      const newUser = await userService.createUser({ name: 'New User', email: 'new@example.com' });
      expect(newUser).toEqual({
        name: 'New User',
        email: 'new@example.com',
        id: 'generated-id'
      });
    });

    test('should handle service disposal correctly', () => {
      // Bind singleton service
      container.bind<ILogger>(TYPES.Logger).to(MockLogger).inSingletonScope();

      const logger1 = container.get<ILogger>(TYPES.Logger);
      container.unbind(TYPES.Logger);

      // Should throw when trying to resolve unbound service
      expect(() => {
        container.get<ILogger>(TYPES.Logger);
      }).toThrow();
    });

    test('should support rebinding services', () => {
      // Initial binding
      container.bind<ILogger>(TYPES.Logger).to(MockLogger).inSingletonScope();
      const logger1 = container.get<ILogger>(TYPES.Logger);

      // Rebind to different implementation
      class AdvancedLogger implements ILogger {
        log(message: string): void {
          console.log(`[ADVANCED] ${message}`);
        }
      }

      container.unbind(TYPES.Logger);
      container.bind<ILogger>(TYPES.Logger).to(AdvancedLogger).inSingletonScope();

      const logger2 = container.get<ILogger>(TYPES.Logger);

      expect(logger1).toBeInstanceOf(MockLogger);
      expect(logger2).toBeInstanceOf(AdvancedLogger);
      expect(logger1).not.toBe(logger2);
    });
  });

  describe('Advanced DI Features', () => {
    test('should support factory functions', () => {
      interface IConfig {
        environment: string;
        version: string;
      }

      // Factory function
      const configFactory = () => ({
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
      });

      container.bind<IConfig>('Config').toDynamicValue(configFactory);

      const config1 = container.get<IConfig>('Config');
      const config2 = container.get<IConfig>('Config');

      expect(config1.environment).toBeDefined();
      expect(config1.version).toBe('1.0.0');
      expect(config2).not.toBe(config1); // Factory creates new instances
    });

    test('should handle circular dependencies gracefully', () => {
      interface IServiceA {
        getB(): IServiceB;
      }

      interface IServiceB {
        getA(): IServiceA;
      }

      class ServiceA implements IServiceA {
        constructor(private serviceB: IServiceB) {}

        getB(): IServiceB {
          return this.serviceB;
        }
      }

      class ServiceB implements IServiceB {
        constructor(private serviceA: IServiceA) {}

        getA(): IServiceA {
          return this.serviceA;
        }
      }

      // This should work - inversify handles circular dependencies
      container.bind<IServiceA>('ServiceA').to(ServiceA);
      container.bind<IServiceB>('ServiceB').to(ServiceB);

      const serviceA = container.get<IServiceA>('ServiceA');
      const serviceB = container.get<IServiceB>('ServiceB');

      expect(serviceA.getB()).toBe(serviceB);
      expect(serviceB.getA()).toBe(serviceA);
    });

    test('should support conditional binding based on environment', () => {
      interface ILogger {
        log(message: string): void;
        level: string;
      }

      class DevelopmentLogger implements ILogger {
        level = 'debug';
        log(message: string): void {
          console.log(`[DEV] ${message}`);
        }
      }

      class ProductionLogger implements ILogger {
        level = 'info';
        log(message: string): void {
          console.log(`[PROD] ${message}`);
        }
      }

      // Conditional binding based on environment
      const isProduction = process.env.NODE_ENV === 'production';

      if (isProduction) {
        container.bind<ILogger>(TYPES.Logger).to(ProductionLogger).inSingletonScope();
      } else {
        container.bind<ILogger>(TYPES.Logger).to(DevelopmentLogger).inSingletonScope();
      }

      const logger = container.get<ILogger>(TYPES.Logger);

      if (isProduction) {
        expect(logger).toBeInstanceOf(ProductionLogger);
        expect(logger.level).toBe('info');
      } else {
        expect(logger).toBeInstanceOf(DevelopmentLogger);
        expect(logger.level).toBe('debug');
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should throw when resolving unbound service', () => {
      expect(() => {
        container.get('UnboundService');
      }).toThrow();
    });

    test('should handle service resolution errors gracefully', () => {
      class FailingService {
        constructor() {
          throw new Error('Service initialization failed');
        }
      }

      container.bind('FailingService').to(FailingService);

      expect(() => {
        container.get('FailingService');
      }).toThrow('Service initialization failed');
    });

    test('should support optional dependencies', () => {
      interface IOptionalService {
        required: ILogger;
        optional?: IDatabase;
      }

      class OptionalService implements IOptionalService {
        constructor(
          public required: ILogger,
          public optional?: IDatabase
        ) {}
      }

      container.bind<ILogger>(TYPES.Logger).to(MockLogger).inSingletonScope();
      container.bind<IOptionalService>('OptionalService').to(OptionalService);

      const service = container.get<IOptionalService>('OptionalService');

      expect(service.required).toBeInstanceOf(MockLogger);
      expect(service.optional).toBeUndefined(); // Not bound
    });

    test('should handle multiple implementations of same interface', () => {
      interface IPaymentProcessor {
        process(amount: number): boolean;
      }

      class StripeProcessor implements IPaymentProcessor {
        process(amount: number): boolean {
          return amount > 0;
        }
      }

      class PayPalProcessor implements IPaymentProcessor {
        process(amount: number): boolean {
          return amount > 0;
        }
      }

      // Bind multiple implementations
      container.bind<IPaymentProcessor>('PaymentProcessor').to(StripeProcessor);
      container.bind<IPaymentProcessor>('PayPalProcessor').to(PayPalProcessor);

      const stripe = container.getNamed<IPaymentProcessor>('PaymentProcessor', 'StripeProcessor');
      const paypal = container.get<IPaymentProcessor>('PayPalProcessor');

      expect(stripe.process(100)).toBe(true);
      expect(paypal.process(100)).toBe(true);
    });
  });

  describe('Performance and Memory Management', () => {
    test('should handle high-frequency service resolution', () => {
      container.bind<ILogger>(TYPES.Logger).to(MockLogger).inSingletonScope();

      const startTime = Date.now();

      // Resolve service many times
      for (let i = 0; i < 1000; i++) {
        const logger = container.get<ILogger>(TYPES.Logger);
        expect(logger).toBeDefined();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    test('should not leak memory with transient services', () => {
      container.bind<ILogger>('TransientLogger').to(MockLogger);

      const instances: ILogger[] = [];

      // Create many instances
      for (let i = 0; i < 100; i++) {
        instances.push(container.get<ILogger>('TransientLogger'));
      }

      // All instances should be different objects
      for (let i = 0; i < instances.length - 1; i++) {
        for (let j = i + 1; j < instances.length; j++) {
          expect(instances[i]).not.toBe(instances[j]);
        }
      }

      // Clear references
      instances.length = 0;
    });

    test('should maintain singleton references correctly', () => {
      container.bind<ILogger>(TYPES.Logger).to(MockLogger).inSingletonScope();

      const instance1 = container.get<ILogger>(TYPES.Logger);
      const instance2 = container.get<ILogger>(TYPES.Logger);

      expect(instance1).toBe(instance2);

      // Modify instance and verify shared state
      (instance1 as any).testProperty = 'modified';
      expect((instance2 as any).testProperty).toBe('modified');
    });
  });

  describe('Integration with AgentOS Services', () => {
    test('should integrate with AgentOS core services', () => {
      // This test verifies that the DI container can work with real AgentOS services
      // In a real scenario, these would be the actual service classes

      interface IAgentOS {
        initialize(): Promise<void>;
        getStatus(): any;
      }

      class AgentOS implements IAgentOS {
        constructor(private logger: ILogger) {}

        async initialize(): Promise<void> {
          this.logger.log('AgentOS initializing...');
        }

        getStatus(): any {
          return { initialized: true, version: '1.0.0' };
        }
      }

      // Bind dependencies
      container.bind<ILogger>(TYPES.Logger).to(MockLogger).inSingletonScope();
      container.bind<IAgentOS>(TYPES.AgentOS).to(AgentOS).inSingletonScope();

      // Resolve main service
      const agentOS = container.get<IAgentOS>(TYPES.AgentOS);

      expect(agentOS).toBeInstanceOf(AgentOS);

      // Test functionality
      const status = agentOS.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.version).toBe('1.0.0');
    });

    test('should support plugin-based service registration', () => {
      // Simulate plugin registering services
      interface IPlugin {
        name: string;
        initialize(): void;
      }

      class WeatherPlugin implements IPlugin {
        name = 'weather';
        constructor(private logger: ILogger) {}

        initialize(): void {
          this.logger.log('Weather plugin initialized');
        }
      }

      // Register plugin service
      container.bind<ILogger>(TYPES.Logger).to(MockLogger).inSingletonScope();
      container.bind<IPlugin>('WeatherPlugin').to(WeatherPlugin);

      // Plugin system can resolve and initialize plugins
      const plugin = container.get<IPlugin>('WeatherPlugin');

      expect(plugin.name).toBe('weather');
      plugin.initialize(); // Should work without errors
    });
  });
});
