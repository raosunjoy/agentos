#!/usr/bin/env node

/**
 * AgentOS Logging System Demo
 * Demonstrates the structured logging capabilities
 */

const path = require('path');

// Add src to path for imports
require('module').globalPaths.push(path.join(__dirname, '..', 'src'));

// Import logging system
const {
  initializeLogging,
  systemLogger,
  securityLogger,
  performanceLogger,
  businessLogger,
  auditLogger,
  voiceLogger,
  createTimer,
  LogLevel
} = require('../src/core/logging');

async function demoLogging() {
  console.log('🚀 AgentOS Logging System Demo');
  console.log('==============================\n');

  // Initialize logging
  initializeLogging({
    logLevel: LogLevel.DEBUG,
    enableConsole: true,
    enableFile: true
  });

  const systemLog = systemLogger('demo');
  const securityLog = securityLogger('demo');
  const perfLog = performanceLogger('demo');
  const businessLog = businessLogger('demo');
  const auditLog = auditLogger('demo');
  const voiceLog = voiceLogger('demo');

  // Demo system logging
  console.log('📝 System Logging Demo:');
  systemLog.info('AgentOS demo started', { version: '1.0.0', timestamp: new Date() });
  systemLog.debug('Debug information', { debugData: { key: 'value' } });
  systemLog.warn('Warning message', { warningType: 'configuration' });

  // Demo security logging
  console.log('\n🔒 Security Logging Demo:');
  securityLog.info('Security event: User login', {
    userId: 'user123',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0...'
  });
  securityLog.warn('Suspicious activity detected', {
    activity: 'multiple_failed_logins',
    userId: 'user123',
    attempts: 5
  });

  // Demo performance logging
  console.log('\n⚡ Performance Logging Demo:');
  const perfTimer = createTimer('demo_operation');
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
  perfTimer.end({ operation: 'demo_task', recordsProcessed: 150 });

  perfLog.performance('api_call', 250, {
    endpoint: '/api/users',
    method: 'GET',
    statusCode: 200
  });

  // Demo business logging
  console.log('\n💼 Business Logging Demo:');
  businessLog.business('user_registration', {
    userId: 'user456',
    source: 'web_app',
    plan: 'premium'
  });

  businessLog.info('Feature usage', {
    feature: 'voice_command',
    userId: 'user123',
    command: 'weather',
    success: true
  });

  // Demo audit logging
  console.log('\n📋 Audit Logging Demo:');
  auditLog.audit('data_access', {
    userId: 'admin123',
    action: 'export',
    dataType: 'user_profiles',
    recordCount: 500,
    ipAddress: '10.0.0.1'
  });

  // Demo voice logging
  console.log('\n🎤 Voice Logging Demo:');
  voiceLog.info('Speech recognized', {
    text: 'What is the weather like today?',
    confidence: 0.95,
    language: 'en-US',
    duration: 2.5
  });

  voiceLog.error('Speech recognition failed', {
    error: 'network_timeout',
    audioDuration: 3.2,
    retryCount: 2
  });

  // Demo error handling
  console.log('\n❌ Error Handling Demo:');
  try {
    // Simulate an error
    throw new Error('Demo error for logging');
  } catch (error) {
    systemLog.error('Demo error occurred', {
      operation: 'error_demo',
      errorType: error.constructor.name
    }, error);
  }

  // Demo structured context
  console.log('\n📊 Structured Context Demo:');
  const requestContext = {
    requestId: 'req_123456',
    correlationId: 'corr_abcdef',
    userId: 'user789',
    sessionId: 'sess_xyz',
    ipAddress: '192.168.1.200',
    userAgent: 'AgentOS/1.0.0'
  };

  systemLog.info('API request processed', {
    ...requestContext,
    endpoint: '/api/process',
    method: 'POST',
    statusCode: 200,
    responseTime: 150,
    requestSize: 2048,
    responseSize: 1024
  });

  console.log('\n✅ Logging Demo Complete!');
  console.log('Check the logs directory for log files.');
  console.log('Use the following commands to view logs:');
  console.log('  npm run logs:tail    # View combined logs');
  console.log('  npm run logs:errors  # View error logs');
  console.log('  npm run logs:security # View security logs');
}

// Run the demo
demoLogging().catch(error => {
  console.error('Demo failed:', error);
  process.exit(1);
});
