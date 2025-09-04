# AgentOS Error Handling System

A comprehensive, production-ready error handling system for AgentOS that provides structured error management, automatic retry mechanisms, circuit breakers, and graceful failure recovery.

## Features

- 🏷️ **Structured Error Types**: Categorized error classes with consistent metadata
- 🔄 **Automatic Retry**: Exponential backoff retry with configurable policies
- ⚡ **Circuit Breaker**: Prevents cascade failures with intelligent circuit breaking
- 🛡️ **Graceful Degradation**: Fallback mechanisms for resilient operation
- 📊 **Comprehensive Logging**: Integrated error logging with correlation IDs
- 🎯 **HTTP Error Handling**: Express middleware for API error responses
- 🔍 **Error Context**: Rich contextual information for debugging
- 📈 **Performance Monitoring**: Error rate tracking and alerting

## Core Components

### Error Types (`error-types.ts`)

```typescript
import {
  AgentOSError,
  AuthenticationError,
  ValidationError,
  NetworkError,
  DatabaseError,
  VoiceError,
} from './core/errors';

// Throw structured errors
throw new ValidationError('Invalid email format', 'email', 'invalid-email');

// Handle with context
try {
  await riskyOperation();
} catch (error) {
  throw new NetworkError('API call failed', 'https://api.example.com', 500, {
    userId: 'user123',
    operation: 'fetch_user_data',
  });
}
```

### Error Handler (`error-handler.ts`)

```typescript
import { handleError, createErrorHandler } from './core/errors';

// Handle errors with recovery
try {
  await riskyOperation();
} catch (error) {
  await handleError(
    error,
    {
      userId: 'user123',
      component: 'user-service',
      operation: 'update_profile',
    },
    {
      retry: { maxAttempts: 3 },
      fallback: () => defaultResponse(),
    }
  );
}

// Create component-specific handler
const apiHandler = createErrorHandler({
  component: 'api-gateway',
  operation: 'proxy_request',
});

const result = await apiHandler(() => makeHttpRequest());
```

### Retry Mechanism (`retry-mechanism.ts`)

```typescript
import {
  withRetry,
  retryHttpRequest,
  retryDatabaseOperation,
} from './core/errors';

// Automatic retry with exponential backoff
const result = await withRetry(
  () => unstableApiCall(),
  {
    maxAttempts: 3,
    baseDelay: 1000,
    retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR'],
  },
  { component: 'api-client', operation: 'fetch_data' }
);

// HTTP-specific retry
const data = await retryHttpRequest(
  () => fetch('https://api.example.com/data'),
  { maxAttempts: 5 },
  { component: 'data-service' }
);

// Database retry
const users = await retryDatabaseOperation(
  () => db.query('SELECT * FROM users'),
  { maxAttempts: 3 },
  { component: 'user-repository' }
);
```

### HTTP Middleware (`error-middleware.ts`)

```typescript
import express from 'express';
import { setupErrorHandling, globalErrorHandler } from './core/errors';

const app = express();

// Automatic error handling setup
setupErrorHandling(app, {
  timeout: 30000,
  enableRateLimit: true,
  enableSecurity: true,
});

// Or manual setup
app.use(globalErrorHandler());

// Routes automatically get error handling
app.get('/api/users', async (req, res) => {
  const users = await getUsers(); // Errors automatically handled
  res.json(users);
});
```

## Error Types

### Core Error Classes

| Error Class              | Code                        | Severity     | Description                 |
| ------------------------ | --------------------------- | ------------ | --------------------------- |
| `AgentOSError`           | Various                     | Configurable | Base error class            |
| `AuthenticationError`    | `AUTHENTICATION_FAILED`     | High         | Login/credential issues     |
| `AuthorizationError`     | `AUTHORIZATION_FAILED`      | High         | Permission/access issues    |
| `ValidationError`        | `VALIDATION_ERROR`          | Medium       | Input validation failures   |
| `NetworkError`           | `NETWORK_ERROR`             | Medium       | HTTP/network issues         |
| `DatabaseError`          | `DATABASE_QUERY_FAILED`     | High         | Database operation failures |
| `VoiceError`             | `SPEECH_RECOGNITION_FAILED` | Medium       | Voice processing errors     |
| `ConfigurationError`     | `CONFIGURATION_ERROR`       | High         | Configuration issues        |
| `TimeoutError`           | `TIMEOUT_ERROR`             | Medium       | Operation timeouts          |
| `ResourceExhaustedError` | `RESOURCE_EXHAUSTED`        | High         | Resource limits exceeded    |

### Error Context

```typescript
interface ErrorContext {
  userId?: string; // User identifier
  sessionId?: string; // Session identifier
  component?: string; // System component
  operation?: string; // Operation name
  requestId?: string; // HTTP request ID
  correlationId?: string; // Request correlation ID
  ipAddress?: string; // Client IP address
  userAgent?: string; // User agent string
  timestamp?: Date; // Error timestamp
  duration?: number; // Operation duration
  retryCount?: number; // Number of retries attempted
  metadata?: Record<string, any>; // Additional context
}
```

## Usage Patterns

### 1. Synchronous Error Handling

```typescript
function validateUser(userData: any): User {
  if (!userData.email) {
    throw new ValidationError('Email is required', 'email');
  }

  if (!isValidEmail(userData.email)) {
    throw new ValidationError('Invalid email format', 'email', userData.email);
  }

  return userData;
}
```

### 2. Asynchronous Error Handling

```typescript
async function createUser(userData: any): Promise<User> {
  try {
    // Validate input
    const validatedData = validateUser(userData);

    // Check if user exists
    const existingUser = await userRepository.findByEmail(validatedData.email);
    if (existingUser) {
      throw new ValidationError(
        'User already exists',
        'email',
        validatedData.email
      );
    }

    // Create user
    const user = await userRepository.create(validatedData);

    return user;
  } catch (error) {
    await handleError(error, {
      component: 'user-service',
      operation: 'create_user',
      userId: userData.id,
    });
    throw error;
  }
}
```

### 3. HTTP Route Error Handling

```typescript
app.post('/api/users', async (req, res) => {
  try {
    const userData = req.body;
    const user = await createUser(userData);

    res.status(201).json({
      success: true,
      data: user,
      requestId: req.id,
    });
  } catch (error) {
    // Error automatically handled by middleware
    // Response sent by globalErrorHandler
  }
});
```

### 4. Retry with Circuit Breaker

```typescript
import { withRetry } from './core/errors';

class PaymentService {
  async processPayment(paymentData: any): Promise<PaymentResult> {
    return withRetry(
      () => this.paymentGateway.charge(paymentData),
      {
        maxAttempts: 3,
        baseDelay: 1000,
        retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR'],
      },
      {
        component: 'payment-service',
        operation: 'process_payment',
        userId: paymentData.userId,
      }
    );
  }
}
```

### 5. Fallback Mechanisms

```typescript
async function getUserData(userId: string): Promise<UserData> {
  try {
    // Primary data source
    return await primaryDatabase.getUser(userId);
  } catch (error) {
    // Fallback to cache
    try {
      return await cache.getUser(userId);
    } catch (cacheError) {
      // Final fallback to default data
      return getDefaultUserData(userId);
    }
  }
}

// Or using the error handler
const userData = await handleError(
  () => primaryDatabase.getUser(userId),
  { component: 'user-service', operation: 'get_user_data' },
  {
    fallback: async () => {
      console.log('Using cache fallback');
      return cache.getUser(userId);
    },
  }
);
```

## Configuration

### Error Handler Configuration

```typescript
import { errorHandler } from './core/errors';

// Configure global error handling
errorHandler.updateConfig({
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  enableFallback: true,
  logAllErrors: true,
});
```

### Retry Configuration

```typescript
const retryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  retryableErrors: [
    'NETWORK_ERROR',
    'NETWORK_TIMEOUT',
    'DATABASE_CONNECTION_FAILED',
    'EXTERNAL_SERVICE_ERROR',
  ],
  retryCondition: (error: AgentOSError, attempt: number) => {
    // Custom retry logic
    return attempt < 3 && error.severity !== 'critical';
  },
  onRetry: (error: AgentOSError, attempt: number, delay: number) => {
    console.log(`Retrying attempt ${attempt} after ${delay}ms`);
  },
};
```

## Error Responses

### HTTP Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "errorId": "err_1234567890_abc123def456",
    "timestamp": "2025-01-04T10:30:45.123Z",
    "severity": "medium",
    "context": {
      "field": "email",
      "component": "user-service",
      "operation": "create_user"
    }
  }
}
```

### Development vs Production

```typescript
// Development: Full error details
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email format is invalid",
    "errorId": "err_1234567890_abc123def456",
    "timestamp": "2025-01-04T10:30:45.123Z",
    "severity": "medium",
    "stack": "...full stack trace...",
    "context": {
      "field": "email",
      "value": "invalid-email",
      "component": "user-service",
      "operation": "validate_email"
    },
    "cause": {
      "name": "ValidationError",
      "message": "Invalid email format",
      "stack": "...cause stack trace..."
    }
  }
}

// Production: User-friendly message
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The provided data is invalid. Please check your input.",
    "errorId": "err_1234567890_abc123def456",
    "timestamp": "2025-01-04T10:30:45.123Z"
  }
}
```

## Circuit Breaker

### Automatic Circuit Breaking

```typescript
// Circuit breaker automatically opens after threshold failures
const result = await withRetry(
  () => externalApi.call(),
  { maxAttempts: 3 },
  { component: 'external-api', operation: 'get_data' }
);

// After 5 failures, circuit breaker opens
// Subsequent calls fail fast without making the actual request
```

### Circuit Breaker Stats

```typescript
import { errorHandler } from './core/errors';

// Get circuit breaker statistics
const stats = errorHandler.getCircuitBreakerStats();
console.log(stats);
// {
//   "external-api:get_data": {
//     failures: 3,
//     lastFailure: 1640995200000,
//     state: "half-open",
//     nextAttemptTime: 1640995260000
//   }
// }

// Reset circuit breaker
errorHandler.resetCircuitBreaker('external-api:get_data');
```

## Monitoring and Alerting

### Error Metrics

```typescript
import { errorHandler } from './core/errors';

// Listen for error events
errorHandler.on('error', (error: AgentOSError) => {
  // Send to monitoring system
  monitoring.recordError({
    code: error.code,
    severity: error.severity,
    component: error.context.component,
    operation: error.context.operation,
  });
});

errorHandler.on('circuitBreakerOpened', ({ key, state }) => {
  // Alert on critical failures
  alerting.sendAlert('Circuit Breaker Opened', {
    service: key,
    failures: state.failures,
  });
});
```

### Health Checks

```typescript
// Circuit breaker health
app.get('/health/circuit-breakers', (req, res) => {
  const stats = errorHandler.getCircuitBreakerStats();
  const unhealthy = Object.entries(stats)
    .filter(([, state]) => state.state === 'open')
    .map(([key]) => key);

  res.json({
    status: unhealthy.length === 0 ? 'healthy' : 'degraded',
    circuitBreakers: stats,
    unhealthy,
  });
});
```

## Best Practices

### 1. Use Specific Error Types

```typescript
// ✅ Good: Specific error types
if (!user) {
  throw new AuthenticationError('User not found');
}

// ❌ Bad: Generic errors
throw new Error('User not found');
```

### 2. Include Context

```typescript
// ✅ Good: Rich context
throw new ValidationError('Invalid age', 'age', userInput.age, {
  userId: user.id,
  operation: 'update_profile',
});

// ❌ Bad: Minimal context
throw new ValidationError('Invalid age');
```

### 3. Handle Errors at Appropriate Level

```typescript
// ✅ Good: Handle at service level
class UserService {
  async createUser(data: any) {
    try {
      return await this.userRepository.create(data);
    } catch (error) {
      await handleError(error, {
        component: 'user-service',
        operation: 'create_user',
      });
      throw error;
    }
  }
}

// ✅ Good: Let middleware handle HTTP errors
app.post('/users', async (req, res) => {
  const user = await userService.createUser(req.body);
  res.json(user); // Errors handled by middleware
});
```

### 4. Use Retry for Transient Failures

```typescript
// ✅ Good: Retry transient failures
const result = await withRetry(
  () => externalApi.getData(),
  { maxAttempts: 3 },
  { component: 'api-client' }
);

// ❌ Bad: No retry for network errors
try {
  return await externalApi.getData();
} catch (error) {
  throw error;
}
```

### 5. Implement Fallbacks

```typescript
// ✅ Good: Graceful degradation
async function getUserPreferences(userId: string) {
  try {
    return await database.getPreferences(userId);
  } catch (error) {
    // Fallback to cache
    return cache.getPreferences(userId);
  } catch (cacheError) {
    // Fallback to defaults
    return getDefaultPreferences();
  }
}
```

### 6. Log Appropriately

```typescript
// ✅ Good: Structured logging
logger.error(
  'Database connection failed',
  {
    component: 'database',
    operation: 'connect',
    host: dbConfig.host,
    port: dbConfig.port,
  },
  error
);

// ❌ Bad: Unstructured logging
console.error('DB Error:', error.message);
```

### 7. Test Error Scenarios

```typescript
describe('UserService', () => {
  it('should handle database connection errors', async () => {
    // Mock database failure
    mockDatabase.rejects(new DatabaseError('Connection failed'));

    await expect(userService.getUser('123')).rejects.toThrow(DatabaseError);
  });

  it('should retry on network errors', async () => {
    // Mock network failure then success
    mockApi
      .rejects(new NetworkError('Timeout'))
      .onSecondCall.resolves({ data: 'success' });

    const result = await userService.callExternalApi();
    expect(result.data).toBe('success');
  });
});
```

## Integration with AgentOS

### Voice Interface Error Handling

```typescript
import { VoiceError, handleError } from '../core/errors';

class SpeechToText {
  async transcribe(audioData: ArrayBuffer): Promise<string> {
    try {
      const result = await this.recognitionService.transcribe(audioData);
      return result.text;
    } catch (error) {
      await handleError(error, {
        component: 'speech-to-text',
        operation: 'transcribe',
        audioSize: audioData.byteLength,
      });

      // Provide user-friendly fallback
      return "Sorry, I couldn't understand that. Could you please try again?";
    }
  }
}
```

### Plugin Error Handling

```typescript
import { PluginError, withErrorHandling } from '../core/errors';

class WeatherPlugin {
  @withErrorHandling({
    component: 'weather-plugin',
    operation: 'get_weather',
    retry: { maxAttempts: 2 },
  })
  async getWeather(location: string) {
    const response = await fetch(`https://api.weather.com/${location}`);

    if (!response.ok) {
      throw new PluginError(
        `Weather API error: ${response.status}`,
        'weather-plugin',
        { location, statusCode: response.status }
      );
    }

    return response.json();
  }
}
```

This error handling system provides AgentOS with enterprise-grade error management, ensuring reliable operation, comprehensive monitoring, and excellent user experience even under failure conditions.
