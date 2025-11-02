/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

// Make this a module
export {};

// Mock console methods to reduce noise during testing
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Global test utilities
(global as any).testUtils = {
  // Create a delay for async tests
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate random test data
  generateId: () => Math.random().toString(36).substring(2, 15),

  // Create mock configuration
  createMockConfig: () => ({
    version: '0.1.0',
    environment: 'test',
    logLevel: 'error',
    enablePlugins: false,
    enableSecurity: false,
    enablePerformanceOptimization: false,
    enableVoiceInterface: false,
    enableCaregiverSystem: false,
    maxMemoryUsage: 128 * 1024 * 1024,
    maxCPUUsage: 50,
    pluginSandbox: false,
    securityLevel: 'low',
    nlp: {
      confidenceThreshold: 0.5,
      cacheSize: 10,
      enableElderlyOptimizations: false,
      supportedLanguages: ['en']
    },
    voice: {
      wakeWord: 'test',
      speechRate: 1.0,
      pitch: 1.0,
      volume: 0.5
    },
    performance: {
      adaptiveScaling: false,
      batteryOptimization: false,
      thermalManagement: false,
      memoryManagement: false
    }
  }),

  // Mock process.memoryUsage
  mockMemoryUsage: () => ({
    rss: 50 * 1024 * 1024,
    heapTotal: 30 * 1024 * 1024,
    heapUsed: 20 * 1024 * 1024,
    external: 5 * 1024 * 1024
  })
};

// Extend Jest matchers if needed
expect.extend({
  toBeValidTimestamp(received: number) {
    const pass = received > 0 && received <= Date.now();
    return {
      message: () => `expected ${received} to be a valid timestamp`,
      pass
    };
  }
});

// Declare global types
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidTimestamp(): R;
    }
  }

  var testUtils: {
    delay: (ms: number) => Promise<void>;
    generateId: () => string;
    createMockConfig: () => any;
    mockMemoryUsage: () => any;
  };
}