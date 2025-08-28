/**
 * Jest setup file for AgentOS tests
 */

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock timers for consistent testing
jest.useFakeTimers();

// Set test timeout
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Add any global test utilities here
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Setup global mocks
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});