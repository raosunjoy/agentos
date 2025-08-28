/**
 * Global teardown for Jest tests
 */

export default async (): Promise<void> => {
  // Global cleanup tasks
  console.log('Tearing down AgentOS test environment...');
  
  // Clean up any global test resources
  // (databases, external services, etc.)
  
  console.log('Test environment teardown complete.');
};