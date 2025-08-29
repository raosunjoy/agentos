/**
 * Plugin SDK - Utilities and helpers for plugin developers
 * Provides convenient methods and tools for building AgentOS plugins
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import {
  PluginMetadata,
  IntentDefinition,
  PluginPermission,
  IntentParameter
} from './types';
import { createPluginMetadata } from './plugin-interface';

export class PluginSDK {
  /**
   * Create a new plugin project structure
   */
  static async createPlugin(options: CreatePluginOptions): Promise<void> {
    const {
      name,
      id,
      version = '1.0.0',
      description,
      author,
      outputPath,
      template = 'basic'
    } = options;

    const pluginPath = path.join(outputPath, id);
    
    // Create plugin directory
    await fs.mkdir(pluginPath, { recursive: true });

    // Create plugin metadata
    const metadata = createPluginMetadata(id, name, version, description, author, {
      license: 'MIT',
      keywords: [],
      agentOSVersion: '1.0.0',
      permissions: [],
      intents: []
    });

    // Write plugin.json
    await fs.writeFile(
      path.join(pluginPath, 'plugin.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    // Create package.json
    const packageJson = {
      name: id,
      version,
      description,
      main: 'index.js',
      scripts: {
        build: 'tsc',
        test: 'jest',
        dev: 'tsc --watch'
      },
      dependencies: {
        '@agentos/plugin-framework': '^1.0.0'
      },
      devDependencies: {
        'typescript': '^4.9.0',
        '@types/node': '^18.0.0',
        'jest': '^29.0.0',
        '@types/jest': '^29.0.0'
      }
    };

    await fs.writeFile(
      path.join(pluginPath, 'package.json'),
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    );

    // Create TypeScript config
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', '**/*.test.ts']
    };

    await fs.writeFile(
      path.join(pluginPath, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2),
      'utf-8'
    );

    // Create source directory and files based on template
    await fs.mkdir(path.join(pluginPath, 'src'), { recursive: true });
    
    switch (template) {
      case 'basic':
        await this.createBasicTemplate(pluginPath, metadata);
        break;
      case 'intent-handler':
        await this.createIntentHandlerTemplate(pluginPath, metadata);
        break;
      case 'data-processor':
        await this.createDataProcessorTemplate(pluginPath, metadata);
        break;
      default:
        await this.createBasicTemplate(pluginPath, metadata);
    }

    // Create README
    await this.createReadme(pluginPath, metadata);

    // Create test files
    await this.createTestFiles(pluginPath, metadata);

    console.log(`Plugin ${name} created successfully at ${pluginPath}`);
  }

  /**
   * Validate plugin structure and configuration
   */
  static async validatePluginProject(pluginPath: string): Promise<ValidationResult> {
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      // Check required files
      const requiredFiles = ['plugin.json', 'package.json', 'src/index.ts'];
      
      for (const file of requiredFiles) {
        const filePath = path.join(pluginPath, file);
        try {
          await fs.access(filePath);
        } catch {
          issues.push(`Missing required file: ${file}`);
        }
      }

      // Validate plugin.json
      try {
        const pluginJsonPath = path.join(pluginPath, 'plugin.json');
        const pluginJson = JSON.parse(await fs.readFile(pluginJsonPath, 'utf-8'));
        
        const requiredFields = ['id', 'name', 'version', 'description', 'author'];
        for (const field of requiredFields) {
          if (!pluginJson[field]) {
            issues.push(`Missing required field in plugin.json: ${field}`);
          }
        }
      } catch (error) {
        issues.push(`Invalid plugin.json: ${error.message}`);
      }

      // Validate package.json
      try {
        const packageJsonPath = path.join(pluginPath, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        
        if (!packageJson.main) {
          warnings.push('package.json missing main field');
        }
        
        if (!packageJson.dependencies?.['@agentos/plugin-framework']) {
          warnings.push('Missing @agentos/plugin-framework dependency');
        }
      } catch (error) {
        issues.push(`Invalid package.json: ${error.message}`);
      }

      // Check TypeScript compilation
      try {
        const tsConfigPath = path.join(pluginPath, 'tsconfig.json');
        await fs.access(tsConfigPath);
      } catch {
        warnings.push('Missing tsconfig.json - TypeScript compilation may fail');
      }

    } catch (error) {
      issues.push(`Validation error: ${error.message}`);
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Build plugin for distribution
   */
  static async buildPlugin(pluginPath: string, outputPath?: string): Promise<string> {
    const distPath = outputPath || path.join(pluginPath, 'dist');
    
    // Ensure dist directory exists
    await fs.mkdir(distPath, { recursive: true });

    // Copy plugin.json
    await fs.copyFile(
      path.join(pluginPath, 'plugin.json'),
      path.join(distPath, 'plugin.json')
    );

    // Copy package.json
    await fs.copyFile(
      path.join(pluginPath, 'package.json'),
      path.join(distPath, 'package.json')
    );

    // Copy README if exists
    try {
      await fs.copyFile(
        path.join(pluginPath, 'README.md'),
        path.join(distPath, 'README.md')
      );
    } catch {
      // README doesn't exist, skip
    }

    // TypeScript compilation would happen here
    // For now, just copy source files
    const srcPath = path.join(pluginPath, 'src');
    const distSrcPath = path.join(distPath, 'src');
    
    try {
      await this.copyDirectory(srcPath, distSrcPath);
    } catch (error) {
      throw new Error(`Failed to copy source files: ${error.message}`);
    }

    return distPath;
  }

  /**
   * Generate intent definition helper
   */
  static createIntent(options: CreateIntentOptions): IntentDefinition {
    return {
      intentId: options.id,
      name: options.name,
      description: options.description,
      examples: options.examples || [],
      parameters: options.parameters || [],
      requiredPermissions: options.requiredPermissions || [],
      handler: options.handler || `handle${options.name.replace(/\s+/g, '')}`
    };
  }

  /**
   * Generate permission definition helper
   */
  static createPermission(options: CreatePermissionOptions): PluginPermission {
    return {
      type: options.type,
      resource: options.resource,
      access: options.access,
      description: options.description,
      required: options.required ?? true
    };
  }

  /**
   * Generate intent parameter helper
   */
  static createParameter(options: CreateParameterOptions): IntentParameter {
    return {
      name: options.name,
      type: options.type,
      required: options.required ?? true,
      description: options.description,
      validation: options.validation,
      defaultValue: options.defaultValue
    };
  }

  // Private helper methods

  private static async createBasicTemplate(pluginPath: string, metadata: PluginMetadata): Promise<void> {
    const indexContent = `import { AgentOSPlugin, PluginMetadata, IntentDefinition, IntentResult, PluginContext, createIntentResult } from '@agentos/plugin-framework';

export default class ${this.toPascalCase(metadata.name)}Plugin extends AgentOSPlugin {
  getMetadata(): PluginMetadata {
    return ${JSON.stringify(metadata, null, 4)};
  }

  getIntents(): IntentDefinition[] {
    return [
      {
        intentId: '${metadata.id}.hello',
        name: 'Say Hello',
        description: 'A simple greeting intent',
        examples: ['say hello', 'greet me'],
        parameters: [],
        requiredPermissions: [],
        handler: 'handleHello'
      }
    ];
  }

  async handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult> {
    switch (intent) {
      case '${metadata.id}.hello':
        return this.handleHello(parameters, context);
      default:
        return createIntentResult(false, undefined, undefined, \`Unknown intent: \${intent}\`);
    }
  }

  private async handleHello(parameters: object, context: PluginContext): Promise<IntentResult> {
    this.log('info', 'Handling hello intent');
    
    return createIntentResult(
      true,
      'Hello from ${metadata.name}!',
      { greeting: 'Hello', timestamp: new Date().toISOString() }
    );
  }
}

export function createPlugin(): ${this.toPascalCase(metadata.name)}Plugin {
  return new ${this.toPascalCase(metadata.name)}Plugin();
}
`;

    await fs.writeFile(path.join(pluginPath, 'src', 'index.ts'), indexContent, 'utf-8');
  }

  private static async createIntentHandlerTemplate(pluginPath: string, metadata: PluginMetadata): Promise<void> {
    // Similar to basic but with more intent examples
    const indexContent = `import { 
  AgentOSPlugin, 
  PluginMetadata, 
  IntentDefinition, 
  IntentResult, 
  PluginContext, 
  createIntentResult,
  IntentHandler,
  RequirePermission
} from '@agentos/plugin-framework';

export default class ${this.toPascalCase(metadata.name)}Plugin extends AgentOSPlugin {
  getMetadata(): PluginMetadata {
    return ${JSON.stringify({
      ...metadata,
      permissions: [
        {
          type: 'data',
          resource: 'user_preferences',
          access: 'read',
          description: 'Read user preferences',
          required: true
        }
      ]
    }, null, 4)};
  }

  getIntents(): IntentDefinition[] {
    return [
      {
        intentId: '${metadata.id}.process',
        name: 'Process Request',
        description: 'Process a user request',
        examples: ['process my request', 'handle this task'],
        parameters: [
          {
            name: 'task',
            type: 'string',
            required: true,
            description: 'The task to process'
          }
        ],
        requiredPermissions: ['data:user_preferences:read'],
        handler: 'handleProcess'
      }
    ];
  }

  async handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult> {
    switch (intent) {
      case '${metadata.id}.process':
        return this.handleProcess(parameters, context);
      default:
        return createIntentResult(false, undefined, undefined, \`Unknown intent: \${intent}\`);
    }
  }

  @RequirePermission('data:user_preferences:read')
  private async handleProcess(parameters: any, context: PluginContext): Promise<IntentResult> {
    this.log('info', 'Processing request', parameters);
    
    try {
      // Read user preferences
      const preferences = await this.readData('user_preferences', { userId: context.userId });
      
      // Process the task
      const result = await this.processTask(parameters.task, preferences);
      
      return createIntentResult(true, \`Task processed: \${result}\`, { result });
    } catch (error) {
      this.log('error', 'Failed to process request', error);
      return createIntentResult(false, undefined, undefined, error.message);
    }
  }

  private async processTask(task: string, preferences: any[]): Promise<string> {
    // Implement your task processing logic here
    return \`Processed: \${task}\`;
  }
}

export function createPlugin(): ${this.toPascalCase(metadata.name)}Plugin {
  return new ${this.toPascalCase(metadata.name)}Plugin();
}
`;

    await fs.writeFile(path.join(pluginPath, 'src', 'index.ts'), indexContent, 'utf-8');
  }

  private static async createDataProcessorTemplate(pluginPath: string, metadata: PluginMetadata): Promise<void> {
    // Template focused on data processing
    const indexContent = `import { 
  AgentOSPlugin, 
  PluginMetadata, 
  IntentDefinition, 
  IntentResult, 
  PluginContext, 
  createIntentResult
} from '@agentos/plugin-framework';

export default class ${this.toPascalCase(metadata.name)}Plugin extends AgentOSPlugin {
  getMetadata(): PluginMetadata {
    return ${JSON.stringify({
      ...metadata,
      permissions: [
        {
          type: 'data',
          resource: 'documents',
          access: 'read',
          description: 'Read documents',
          required: true
        },
        {
          type: 'data',
          resource: 'processed_data',
          access: 'write',
          description: 'Write processed data',
          required: true
        }
      ]
    }, null, 4)};
  }

  getIntents(): IntentDefinition[] {
    return [
      {
        intentId: '${metadata.id}.analyze',
        name: 'Analyze Data',
        description: 'Analyze and process data',
        examples: ['analyze my documents', 'process the data'],
        parameters: [
          {
            name: 'dataType',
            type: 'string',
            required: true,
            description: 'Type of data to analyze'
          }
        ],
        requiredPermissions: ['data:documents:read', 'data:processed_data:write'],
        handler: 'handleAnalyze'
      }
    ];
  }

  async handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult> {
    switch (intent) {
      case '${metadata.id}.analyze':
        return this.handleAnalyze(parameters, context);
      default:
        return createIntentResult(false, undefined, undefined, \`Unknown intent: \${intent}\`);
    }
  }

  private async handleAnalyze(parameters: any, context: PluginContext): Promise<IntentResult> {
    this.log('info', 'Starting data analysis', parameters);
    
    try {
      // Read data to analyze
      const documents = await this.readData('documents', { 
        type: parameters.dataType,
        userId: context.userId 
      });
      
      // Process the data
      const analysisResult = await this.analyzeData(documents);
      
      // Store processed results
      const resultId = await this.writeData('processed_data', {
        userId: context.userId,
        dataType: parameters.dataType,
        result: analysisResult,
        processedAt: new Date().toISOString()
      });
      
      return createIntentResult(
        true, 
        \`Analysis complete. Found \${analysisResult.insights.length} insights.\`,
        { resultId, insights: analysisResult.insights }
      );
    } catch (error) {
      this.log('error', 'Analysis failed', error);
      return createIntentResult(false, undefined, undefined, error.message);
    }
  }

  private async analyzeData(documents: any[]): Promise<AnalysisResult> {
    // Implement your data analysis logic here
    return {
      insights: [
        { type: 'summary', value: \`Processed \${documents.length} documents\` }
      ],
      metadata: {
        processedCount: documents.length,
        timestamp: new Date().toISOString()
      }
    };
  }
}

interface AnalysisResult {
  insights: Array<{ type: string; value: string }>;
  metadata: {
    processedCount: number;
    timestamp: string;
  };
}

export function createPlugin(): ${this.toPascalCase(metadata.name)}Plugin {
  return new ${this.toPascalCase(metadata.name)}Plugin();
}
`;

    await fs.writeFile(path.join(pluginPath, 'src', 'index.ts'), indexContent, 'utf-8');
  }

  private static async createReadme(pluginPath: string, metadata: PluginMetadata): Promise<void> {
    const readmeContent = `# ${metadata.name}

${metadata.description}

## Installation

\`\`\`bash
npm install
npm run build
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`

## Usage

This plugin provides the following intents:

${metadata.intents.map(intent => `- **${intent.name}**: ${intent.description}`).join('\n')}

## Permissions

This plugin requires the following permissions:

${metadata.permissions.map(perm => `- **${perm.type}:${perm.resource}:${perm.access}**: ${perm.description}`).join('\n')}

## Author

${metadata.author}

## License

${metadata.license}
`;

    await fs.writeFile(path.join(pluginPath, 'README.md'), readmeContent, 'utf-8');
  }

  private static async createTestFiles(pluginPath: string, metadata: PluginMetadata): Promise<void> {
    const testContent = `import { ${this.toPascalCase(metadata.name)}Plugin } from '../src/index';
import { PluginContext } from '@agentos/plugin-framework';

describe('${metadata.name}', () => {
  let plugin: ${this.toPascalCase(metadata.name)}Plugin;
  let mockContext: PluginContext;

  beforeEach(() => {
    plugin = new ${this.toPascalCase(metadata.name)}Plugin();
    mockContext = {
      pluginId: '${metadata.id}',
      userId: 'test-user',
      sessionId: 'test-session',
      permissions: new Set(['data:test:read']),
      dataAccess: {
        read: jest.fn().mockResolvedValue([]),
        write: jest.fn().mockResolvedValue('test-id'),
        update: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue(true),
        subscribe: jest.fn().mockReturnValue(() => {})
      },
      systemAccess: {
        sendNotification: jest.fn().mockResolvedValue(undefined),
        requestPermission: jest.fn().mockResolvedValue(true),
        executeWorkflow: jest.fn().mockResolvedValue({ success: true, result: null, executionId: 'test' }),
        registerIntent: jest.fn().mockResolvedValue(true),
        unregisterIntent: jest.fn().mockResolvedValue(true)
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    };
  });

  test('should return correct metadata', () => {
    const metadata = plugin.getMetadata();
    expect(metadata.id).toBe('${metadata.id}');
    expect(metadata.name).toBe('${metadata.name}');
  });

  test('should return intents', () => {
    const intents = plugin.getIntents();
    expect(intents).toHaveLength(${metadata.intents.length});
  });

  test('should handle unknown intent', async () => {
    const result = await plugin.handle('unknown.intent', {}, mockContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown intent');
  });
});
`;

    await fs.mkdir(path.join(pluginPath, '__tests__'), { recursive: true });
    await fs.writeFile(path.join(pluginPath, '__tests__', 'index.test.ts'), testContent, 'utf-8');

    // Jest config
    const jestConfig = {
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src', '<rootDir>/__tests__'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts'
      ]
    };

    await fs.writeFile(
      path.join(pluginPath, 'jest.config.json'),
      JSON.stringify(jestConfig, null, 2),
      'utf-8'
    );
  }

  private static async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private static toPascalCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}

// Interfaces for SDK methods

export interface CreatePluginOptions {
  name: string;
  id: string;
  version?: string;
  description: string;
  author: string;
  outputPath: string;
  template?: 'basic' | 'intent-handler' | 'data-processor';
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
}

export interface CreateIntentOptions {
  id: string;
  name: string;
  description: string;
  examples?: string[];
  parameters?: IntentParameter[];
  requiredPermissions?: string[];
  handler?: string;
}

export interface CreatePermissionOptions {
  type: 'data' | 'system' | 'network' | 'hardware';
  resource: string;
  access: 'read' | 'write' | 'execute';
  description: string;
  required?: boolean;
}

export interface CreateParameterOptions {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  description: string;
  validation?: string;
  defaultValue?: any;
}