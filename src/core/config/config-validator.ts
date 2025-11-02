/**
 * Configuration Validator
 * Validates and sanitizes configuration for production environments
 */

import { systemLogger } from '../logging';
import { ConfigurationError } from '../errors';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitizedConfig: any;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

export interface ValidationWarning extends ValidationError {
  severity: 'warning';
}

export interface ConfigSchema {
  [key: string]: ConfigField;
}

export interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  default?: any;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
  validate?: (value: any) => boolean | string;
  description?: string;
}

export class ConfigValidator {
  private logger = systemLogger('config-validator');

  /**
   * Validate configuration against schema
   */
  validate(config: any, schema: ConfigSchema): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const sanitizedConfig = { ...config };

    // Validate each field in schema
    for (const [field, fieldSchema] of Object.entries(schema)) {
      const result = this.validateField(field, config[field], fieldSchema);
      sanitizedConfig[field] = result.sanitizedValue;

      if (result.error) {
        errors.push(result.error);
      }

      if (result.warning) {
        warnings.push(result.warning);
      }
    }

    // Check for extra fields not in schema
    for (const field of Object.keys(config)) {
      if (!schema[field]) {
        warnings.push({
          field,
          message: `Unknown configuration field: ${field}`,
          severity: 'warning',
          suggestion: 'Remove this field or add it to the configuration schema'
        });
      }
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      this.logger.error('Configuration validation failed', {
        errorCount: errors.length,
        warningCount: warnings.length
      });
    } else if (warnings.length > 0) {
      this.logger.warn('Configuration validation passed with warnings', {
        warningCount: warnings.length
      });
    } else {
      this.logger.info('Configuration validation passed');
    }

    return {
      isValid,
      errors,
      warnings,
      sanitizedConfig
    };
  }

  /**
   * Validate a single field
   */
  private validateField(
    field: string,
    value: any,
    schema: ConfigField
  ): {
    sanitizedValue: any;
    error?: ValidationError;
    warning?: ValidationWarning;
  } {
    // Handle required fields
    if (schema.required && (value === undefined || value === null || value === '')) {
      return {
        sanitizedValue: schema.default,
        error: {
          field,
          message: `Required field is missing`,
          severity: 'error',
          suggestion: `Provide a value for ${field} or set default: ${schema.default}`
        }
      };
    }

    // Use default value if not provided
    if (value === undefined || value === null || value === '') {
      return {
        sanitizedValue: schema.default
      };
    }

    // Type validation
    const typeResult = this.validateType(field, value, schema.type);
    if (!typeResult.isValid) {
      return {
        sanitizedValue: schema.default || value,
        error: typeResult.error
      };
    }

    // Range validation for numbers
    if (schema.type === 'number') {
      const rangeResult = this.validateNumberRange(field, value, schema);
      if (rangeResult.error) {
        return {
          sanitizedValue: Math.max(schema.min || 0, Math.min(schema.max || value, value)),
          error: rangeResult.error
        };
      }
    }

    // Pattern validation for strings
    if (schema.type === 'string' && schema.pattern) {
      const patternResult = this.validatePattern(field, value, schema.pattern);
      if (!patternResult.isValid) {
        return {
          sanitizedValue: value,
          error: patternResult.error
        };
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      return {
        sanitizedValue: schema.default || schema.enum[0],
        error: {
          field,
          message: `Value must be one of: ${schema.enum.join(', ')}`,
          severity: 'error',
          suggestion: `Use one of: ${schema.enum.join(', ')}`
        }
      };
    }

    // Custom validation
    if (schema.validate) {
      const validationResult = schema.validate(value);
      if (validationResult !== true) {
        const message = typeof validationResult === 'string'
          ? validationResult
          : 'Custom validation failed';

        return {
          sanitizedValue: value,
          error: {
            field,
            message,
            severity: 'error'
          }
        };
      }
    }

    return {
      sanitizedValue: value
    };
  }

  /**
   * Validate field type
   */
  private validateType(field: string, value: any, expectedType: string): {
    isValid: boolean;
    error?: ValidationError;
  } {
    let isValid = false;

    switch (expectedType) {
      case 'string':
        isValid = typeof value === 'string';
        break;
      case 'number':
        isValid = typeof value === 'number' && !isNaN(value);
        break;
      case 'boolean':
        isValid = typeof value === 'boolean';
        break;
      case 'object':
        isValid = typeof value === 'object' && value !== null && !Array.isArray(value);
        break;
      case 'array':
        isValid = Array.isArray(value);
        break;
      default:
        isValid = true; // Unknown types pass through
    }

    if (!isValid) {
      return {
        isValid: false,
        error: {
          field,
          message: `Expected type ${expectedType}, got ${typeof value}`,
          severity: 'error',
          suggestion: `Convert value to ${expectedType}`
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate number range
   */
  private validateNumberRange(field: string, value: number, schema: ConfigField): {
    error?: ValidationError;
  } {
    if (schema.min !== undefined && value < schema.min) {
      return {
        error: {
          field,
          message: `Value ${value} is below minimum ${schema.min}`,
          severity: 'error',
          suggestion: `Use a value >= ${schema.min}`
        }
      };
    }

    if (schema.max !== undefined && value > schema.max) {
      return {
        error: {
          field,
          message: `Value ${value} is above maximum ${schema.max}`,
          severity: 'error',
          suggestion: `Use a value <= ${schema.max}`
        }
      };
    }

    return {};
  }

  /**
   * Validate string pattern
   */
  private validatePattern(field: string, value: string, pattern: RegExp): {
    isValid: boolean;
    error?: ValidationError;
  } {
    if (!pattern.test(value)) {
      return {
        isValid: false,
        error: {
          field,
          message: `Value does not match required pattern: ${pattern}`,
          severity: 'error',
          suggestion: `Ensure value matches pattern: ${pattern}`
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Get AgentOS configuration schema
   */
  getAgentOSConfigSchema(): ConfigSchema {
    return {
      version: {
        type: 'string',
        required: true,
        pattern: /^\d+\.\d+\.\d+$/,
        description: 'AgentOS version'
      },
      environment: {
        type: 'string',
        required: true,
        enum: ['development', 'staging', 'production'],
        default: 'development',
        description: 'Runtime environment'
      },
      logLevel: {
        type: 'string',
        required: false,
        enum: ['debug', 'info', 'warn', 'error'],
        default: 'info',
        description: 'Logging level'
      },
      enablePlugins: {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Enable plugin system'
      },
      enableSecurity: {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Enable security features'
      },
      enablePerformanceOptimization: {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Enable performance optimizations'
      },
      enableVoiceInterface: {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Enable voice interface'
      },
      enableCaregiverSystem: {
        type: 'boolean',
        required: false,
        default: false,
        description: 'Enable caregiver features'
      },
      maxMemoryUsage: {
        type: 'number',
        required: false,
        min: 1024 * 1024 * 1024, // 1GB
        max: 8 * 1024 * 1024 * 1024, // 8GB
        default: 2 * 1024 * 1024 * 1024, // 2GB
        description: 'Maximum memory usage in bytes'
      },
      maxCPUUsage: {
        type: 'number',
        required: false,
        min: 10,
        max: 100,
        default: 80,
        description: 'Maximum CPU usage percentage'
      },
      pluginSandbox: {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Enable plugin sandboxing'
      },
      securityLevel: {
        type: 'string',
        required: false,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'high',
        description: 'Security level'
      }
    };
  }

  /**
   * Validate environment variables
   */
  validateEnvironment(): ValidationResult {
    const envConfig = {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      LOG_LEVEL: process.env.LOG_LEVEL,
      DATABASE_URL: process.env.DATABASE_URL,
      REDIS_URL: process.env.REDIS_URL,
      JWT_SECRET: process.env.JWT_SECRET,
      AGENTOS_ENV: process.env.AGENTOS_ENV
    };

    const schema: ConfigSchema = {
      NODE_ENV: {
        type: 'string',
        required: false,
        enum: ['development', 'test', 'staging', 'production'],
        default: 'development'
      },
      PORT: {
        type: 'string',
        required: false,
        pattern: /^\d+$/,
        validate: (value) => {
          const port = parseInt(value);
          return port >= 1000 && port <= 65535;
        },
        default: '3000'
      },
      LOG_LEVEL: {
        type: 'string',
        required: false,
        enum: ['debug', 'info', 'warn', 'error'],
        default: 'info'
      },
      DATABASE_URL: {
        type: 'string',
        required: false,
        pattern: /^postgresql:\/\/.+/,
        default: 'postgresql://localhost:5432/agentos'
      },
      REDIS_URL: {
        type: 'string',
        required: false,
        pattern: /^redis:\/\/.+/,
        default: 'redis://localhost:6379'
      },
      JWT_SECRET: {
        type: 'string',
        required: false,
        validate: (value) => value && value.length >= 32,
        default: 'development-secret-key-change-in-production'
      },
      AGENTOS_ENV: {
        type: 'string',
        required: false,
        enum: ['development', 'staging', 'production'],
        default: 'development'
      }
    };

    return this.validate(envConfig, schema);
  }

  /**
   * Validate production configuration
   */
  validateProductionConfig(config: any): ValidationResult {
    const schema = this.getAgentOSConfigSchema();

    // Add production-specific validations
    schema.environment.enum = ['production']; // Must be production
    schema.logLevel.default = 'warn'; // More conservative logging
    schema.enableSecurity.default = true; // Security must be enabled
    schema.pluginSandbox.default = true; // Sandboxing must be enabled

    return this.validate(config, schema);
  }

  /**
   * Generate configuration template
   */
  generateConfigTemplate(schema: ConfigSchema): string {
    const template: any = {};

    for (const [field, fieldSchema] of Object.entries(schema)) {
      if (fieldSchema.default !== undefined) {
        template[field] = fieldSchema.default;
      } else if (fieldSchema.required) {
        template[field] = `<${fieldSchema.type.toUpperCase()}_REQUIRED>`;
      } else {
        template[field] = `<${fieldSchema.type.toUpperCase()}_OPTIONAL>`;
      }
    }

    return JSON.stringify(template, null, 2);
  }

  /**
   * Load and validate configuration from file
   */
  async loadAndValidateConfig(configPath: string): Promise<ValidationResult> {
    try {
      const fs = require('fs');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const schema = this.getAgentOSConfigSchema();

      return this.validate(config, schema);
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'config',
          message: `Failed to load config from ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'error',
          suggestion: 'Ensure config file exists and is valid JSON'
        }],
        warnings: [],
        sanitizedConfig: {}
      };
    }
  }
}
