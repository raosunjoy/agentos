# AgentOS Logging System

A comprehensive, production-ready logging system built on Winston for structured logging, performance monitoring, and debugging across the AgentOS platform.

## Features

- 🏷️ **Structured Logging**: JSON-formatted logs with consistent metadata
- 📊 **Multiple Transports**: Console, file, and daily rotation support
- 🎯 **Categorized Logging**: Separate loggers for different system components
- ⏱️ **Performance Timing**: Built-in operation timing utilities
- 🔒 **Security Logging**: Specialized logging for security events
- 📈 **Business Metrics**: Track business events and KPIs
- 🔍 **Correlation IDs**: Request tracing across distributed operations
- 🎨 **Multiple Log Levels**: ERROR, WARN, INFO, DEBUG, TRACE

## Quick Start

### Basic Usage

```typescript
import { systemLogger, voiceLogger, createTimer } from './core/logging';

// Get a logger for your component
const logger = systemLogger('my-component');

// Log messages at different levels
logger.info('Component initialized', { version: '1.0.0' });
logger.warn('Configuration warning', { setting: 'timeout', value: 1000 });
logger.error('Failed to process request', { error: 'Invalid input' }, error);

// Performance timing
const timer = createTimer('database_query');
try {
  // Your operation here
  await performDatabaseQuery();
  timer.end({ recordsProcessed: 150 });
} catch (error) {
  timer.log('error', 'Database query failed', { error: error.message });
}
```

### Component-Specific Loggers

```typescript
import {
  systemLogger,
  securityLogger,
  performanceLogger,
  businessLogger,
  auditLogger,
  pluginLogger,
  voiceLogger,
  nlpLogger,
  apiLogger,
  dbLogger,
} from './core/logging';

// Use appropriate logger for each component type
const systemLog = systemLogger('bootstrap');
const securityLog = securityLogger('authentication');
const perfLog = performanceLogger('cache');
const businessLog = businessLogger('user-engagement');
const auditLog = auditLogger('data-access');
const pluginLog = pluginLogger('weather-plugin');
const voiceLog = voiceLogger('speech-recognition');
const nlpLog = nlpLogger('intent-classification');
const apiLog = apiLogger('rest-endpoint');
const dbLog = dbLogger('connection-pool');
```

## Log Categories

### System Logs (`system`)

General application logs, initialization, shutdown, and system events.

```typescript
const logger = systemLogger('bootstrap');
logger.info('AgentOS starting', {
  version: '1.0.0',
  environment: 'production',
});
```

### Security Logs (`security`)

Authentication, authorization, access control, and security events.

```typescript
const logger = securityLogger('authentication');
logger.warn('Failed login attempt', {
  userId: 'user123',
  ipAddress: '192.168.1.100',
  reason: 'invalid_password',
});
```

### Performance Logs (`performance`)

Operation timing, resource usage, bottlenecks, and optimization metrics.

```typescript
const logger = performanceLogger('cache');
logger.info('Cache hit ratio', {
  hitRatio: 0.85,
  totalRequests: 1000,
  cacheSize: 1024,
});
```

### Business Logs (`business`)

Business metrics, user interactions, feature usage, and KPIs.

```typescript
const logger = businessLogger('user-engagement');
logger.info('Feature used', {
  feature: 'voice_command',
  userId: 'user123',
  duration: 2500,
  success: true,
});
```

### Audit Logs (`audit`)

Compliance and audit trails for sensitive operations.

```typescript
const logger = auditLogger('data-export');
logger.info('Data export initiated', {
  userId: 'admin123',
  dataType: 'user_profiles',
  recordCount: 5000,
  ipAddress: '10.0.0.1',
});
```

## Log Context

Add structured context to your logs for better debugging and monitoring:

```typescript
const logger = apiLogger('user-service');

logger.info('User profile updated', {
  userId: 'user123',
  sessionId: 'sess_abc123',
  operation: 'profile_update',
  duration: 150,
  changes: ['email', 'phone'],
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  correlationId: 'corr_123456',
});
```

## Performance Monitoring

### Automatic Timing

```typescript
import { createTimer } from './core/logging';

const timer = createTimer('api_call');
try {
  const result = await apiCall();
  timer.end({ statusCode: 200, responseSize: 2048 });
} catch (error) {
  timer.log('error', 'API call failed', { error: error.message });
}
```

### Manual Performance Logging

```typescript
const logger = performanceLogger('database');

const startTime = Date.now();
// ... database operation
const duration = Date.now() - startTime;

logger.performance('user_query', duration, {
  queryType: 'SELECT',
  tableName: 'users',
  recordCount: 150,
});
```

## HTTP Request Logging

Automatic logging for HTTP requests with correlation IDs:

```typescript
import express from 'express';
import {
  httpRequestLogger,
  httpErrorLogger,
  correlationIdMiddleware,
} from './core/logging';

const app = express();

// Add correlation ID middleware first
app.use(correlationIdMiddleware());

// Add request logging
app.use(httpRequestLogger());

// Your routes here
app.get('/api/users', (req, res) => {
  // Request ID and correlation ID are automatically logged
  res.json({ users: [] });
});

// Add error logging
app.use(httpErrorLogger());
```

## Configuration

### Environment Variables

```bash
# Set log level
LOG_LEVEL=debug

# Disable console logging in production
NODE_ENV=production
```

### Programmatic Configuration

```typescript
import { initializeLogging, LogLevel } from './core/logging';

// Initialize with custom configuration
initializeLogging({
  logLevel: LogLevel.DEBUG,
  enableConsole: true,
  enableFile: true,
  logDirectory: './logs',
});
```

## Log Format

All logs are formatted as structured JSON:

```json
{
  "timestamp": "2025-01-04T10:30:45.123Z",
  "level": "info",
  "category": "system",
  "component": "bootstrap",
  "message": "AgentOS initialized successfully",
  "context": {
    "version": "1.0.0",
    "environment": "production",
    "duration": 2500
  }
}
```

## Log Files

### Development

- **Console**: Colorized output with all log levels
- **Files**: Combined log file with all messages

### Production

- **error.log**: Only error and warning messages
- **combined.log**: All log messages
- **security.log**: Security-related events

### Daily Rotation

Logs are automatically rotated daily with configurable retention:

```
logs/
├── error-2025-01-04.log
├── combined-2025-01-04.log
├── security-2025-01-04.log
├── error-2025-01-03.log
└── combined-2025-01-03.log
```

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
// ERROR: System errors that require immediate attention
logger.error('Database connection failed', { error: err.message }, err);

// WARN: Potential issues or unusual conditions
logger.warn('High memory usage detected', { usagePercent: 85 });

// INFO: Important business logic events
logger.info('User registered', { userId: '123', email: 'user@example.com' });

// DEBUG: Detailed information for troubleshooting
logger.debug('Processing payment', { amount: 99.99, currency: 'USD' });

// TRACE: Very detailed execution flow (usually disabled)
logger.trace('Entering method calculateTax', { input: 100 });
```

### 2. Include Relevant Context

```typescript
// ✅ Good: Include relevant context
logger.info('Order processed', {
  orderId: 'ord_123',
  userId: 'user_456',
  amount: 99.99,
  items: 3,
  paymentMethod: 'credit_card',
});

// ❌ Bad: Missing context
logger.info('Order processed');
```

### 3. Use Performance Timing

```typescript
// ✅ Good: Time critical operations
const timer = createTimer('user_authentication');
const user = await authenticateUser(credentials);
timer.end({ userId: user.id, success: true });

// ❌ Bad: No timing information
await authenticateUser(credentials);
logger.info('User authenticated');
```

### 4. Handle Errors Properly

```typescript
// ✅ Good: Include error context and stack trace
try {
  await riskyOperation();
} catch (error) {
  logger.error('Risky operation failed', {
    operation: 'riskyOperation',
    userId: 'user123',
    input: 'invalid-input'
  }, error);
}

// ❌ Bad: Missing error details
catch (error) {
  logger.error('Something went wrong');
}
```

### 5. Use Correlation IDs

```typescript
// ✅ Good: Trace requests across services
logger.info('Processing payment', {
  correlationId: req.headers['x-correlation-id'],
  userId: 'user123',
  amount: 99.99,
});

// ❌ Bad: No correlation information
logger.info('Processing payment');
```

## Integration Examples

### Express.js Middleware

```typescript
import express from 'express';
import {
  httpRequestLogger,
  httpErrorLogger,
  correlationIdMiddleware,
} from './core/logging';

const app = express();

// Request correlation and logging
app.use(correlationIdMiddleware());
app.use(httpRequestLogger());

// API routes
app.get('/api/health', (req, res) => {
  const logger = apiLogger('health');
  logger.info('Health check requested', {
    correlationId: req.headers['x-correlation-id'],
    userAgent: req.get('User-Agent'),
  });
  res.json({ status: 'healthy' });
});

// Error handling
app.use(httpErrorLogger());
```

### Plugin Logging

```typescript
import { pluginLogger } from './core/logging';

export class WeatherPlugin {
  private logger = pluginLogger('weather-plugin');

  async getWeather(location: string): Promise<WeatherData> {
    const timer = this.logger.createTimer('weather_api_call');

    try {
      this.logger.info('Fetching weather data', { location });
      const weather = await this.weatherAPI.getWeather(location);

      timer.end({ location, success: true });
      this.logger.info('Weather data retrieved', {
        location,
        temperature: weather.temperature,
        condition: weather.condition,
      });

      return weather;
    } catch (error) {
      timer.log('error', 'Weather API call failed', { location });
      throw error;
    }
  }
}
```

### Voice Interface Logging

```typescript
import { voiceLogger } from './core/logging';

export class SpeechToText {
  private logger = voiceLogger('speech-to-text');

  async transcribe(audioData: ArrayBuffer): Promise<string> {
    const timer = this.logger.createTimer('speech_transcription');

    try {
      this.logger.debug('Starting speech transcription', {
        audioSize: audioData.byteLength,
        sampleRate: 16000,
      });

      const transcription = await this.recognitionService.transcribe(audioData);

      timer.end({
        transcriptionLength: transcription.length,
        confidence: transcription.confidence,
      });

      this.logger.info('Speech transcribed successfully', {
        text: transcription.text.substring(0, 100) + '...',
        confidence: transcription.confidence,
        duration: timer.duration,
      });

      return transcription.text;
    } catch (error) {
      timer.log('error', 'Speech transcription failed', {
        audioSize: audioData.byteLength,
      });
      throw error;
    }
  }
}
```

## Monitoring and Alerting

### Log Aggregation

Use tools like ELK Stack, Splunk, or CloudWatch to aggregate and analyze logs:

```typescript
// Structured logs are perfect for aggregation
logger.info('API Request', {
  method: 'GET',
  url: '/api/users',
  statusCode: 200,
  responseTime: 150,
  userId: 'user123',
});
```

### Alerting Rules

Set up alerts based on log patterns:

```typescript
// High error rate alert
logger.error('High error rate detected', {
  service: 'payment-service',
  errorRate: 0.15,
  timeWindow: '5m',
});

// Performance degradation
logger.warn('Response time increased', {
  endpoint: '/api/checkout',
  avgResponseTime: 2500, // 2.5 seconds
  previousAvg: 800,
});
```

## Migration from Console Logging

Replace console.log statements with structured logging:

```typescript
// Before
console.log('User login:', user.email);
console.error('Database error:', err);

// After
logger.info('User login successful', {
  userId: user.id,
  email: user.email,
  ipAddress: req.ip,
});
logger.error(
  'Database connection failed',
  {
    operation: 'user_login',
    error: err.message,
  },
  err
);
```

## Configuration Files

### Development Configuration

```typescript
// config/development.ts
export const loggingConfig = {
  logLevel: LogLevel.DEBUG,
  enableConsole: true,
  enableFile: false,
  consoleFormat: 'colored',
};
```

### Production Configuration

```typescript
// config/production.ts
export const loggingConfig = {
  logLevel: LogLevel.INFO,
  enableConsole: false,
  enableFile: true,
  logDirectory: '/var/log/agentos',
  maxFiles: '30d',
  maxSize: '100m',
};
```

This logging system provides comprehensive observability for AgentOS, enabling effective debugging, performance monitoring, and operational insights across all components of the platform.
