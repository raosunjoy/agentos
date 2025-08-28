/**
 * Global setup for Jest tests
 */

export default async (): Promise<void> => {
  // Global setup tasks
  console.log('Setting up AgentOS test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Initialize any global test resources
  // (databases, external services, etc.)
  
  console.log('Test environment setup complete.');
};