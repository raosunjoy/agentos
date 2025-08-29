/**
 * Example plugin demonstrating AgentOS plugin development
 * This serves as a reference implementation and tutorial
 */

import {
  AgentOSPlugin,
  PluginMetadata,
  IntentDefinition,
  IntentResult,
  PluginContext,
  createIntentResult,
  createPluginMetadata,
  IntentHandler,
  RequirePermission
} from '../plugin-interface';

export class ExamplePlugin extends AgentOSPlugin {
  private userPreferences = new Map<string, any>();

  getMetadata(): PluginMetadata {
    return createPluginMetadata(
      'com.agentos.example',
      'Example Plugin',
      '1.0.0',
      'A comprehensive example plugin demonstrating AgentOS capabilities',
      'AgentOS Team',
      {
        license: 'MIT',
        keywords: ['example', 'tutorial', 'demo'],
        agentOSVersion: '1.0.0',
        permissions: [
          {
            type: 'data',
            resource: 'user_preferences',
            access: 'read',
            description: 'Read user preferences for personalization',
            required: false
          },
          {
            type: 'data',
            resource: 'user_preferences',
            access: 'write',
            description: 'Save user preferences',
            required: false
          },
          {
            type: 'system',
            resource: 'notifications',
            access: 'write',
            description: 'Send notifications to user',
            required: false
          }
        ],
        intents: [] // Will be populated by getIntents()
      }
    );
  }

  getIntents(): IntentDefinition[] {
    return [
      {
        intentId: 'com.agentos.example.greet',
        name: 'Greet User',
        description: 'Provide a personalized greeting',
        examples: [
          'say hello',
          'greet me',
          'good morning',
          'hello there'
        ],
        parameters: [
          {
            name: 'timeOfDay',
            type: 'string',
            required: false,
            description: 'Time of day for contextual greeting',
            validation: '^(morning|afternoon|evening|night)$'
          }
        ],
        requiredPermissions: [],
        handler: 'handleGreeting'
      },
      {
        intentId: 'com.agentos.example.setPreference',
        name: 'Set User Preference',
        description: 'Save a user preference setting',
        examples: [
          'set my preference for theme to dark',
          'remember that I like coffee',
          'save my favorite color as blue'
        ],
        parameters: [
          {
            name: 'key',
            type: 'string',
            required: true,
            description: 'Preference key/name'
          },
          {
            name: 'value',
            type: 'string',
            required: true,
            description: 'Preference value'
          }
        ],
        requiredPermissions: ['data:user_preferences:write'],
        handler: 'handleSetPreference'
      },
      {
        intentId: 'com.agentos.example.getPreference',
        name: 'Get User Preference',
        description: 'Retrieve a saved user preference',
        examples: [
          'what is my theme preference',
          'get my favorite color',
          'show my preferences'
        ],
        parameters: [
          {
            name: 'key',
            type: 'string',
            required: false,
            description: 'Specific preference key to retrieve'
          }
        ],
        requiredPermissions: ['data:user_preferences:read'],
        handler: 'handleGetPreference'
      },
      {
        intentId: 'com.agentos.example.remind',
        name: 'Set Reminder',
        description: 'Create a reminder notification',
        examples: [
          'remind me to call mom in 1 hour',
          'set a reminder for my meeting',
          'notify me about lunch'
        ],
        parameters: [
          {
            name: 'message',
            type: 'string',
            required: true,
            description: 'Reminder message'
          },
          {
            name: 'delay',
            type: 'number',
            required: false,
            description: 'Delay in minutes',
            defaultValue: 60
          }
        ],
        requiredPermissions: ['system:notifications:write'],
        handler: 'handleReminder'
      }
    ];
  }

  async handle(intent: string, parameters: object, context: PluginContext): Promise<IntentResult> {
    this.log('info', `Handling intent: ${intent}`, parameters);

    try {
      switch (intent) {
        case 'com.agentos.example.greet':
          return await this.handleGreeting(parameters, context);
        case 'com.agentos.example.setPreference':
          return await this.handleSetPreference(parameters, context);
        case 'com.agentos.example.getPreference':
          return await this.handleGetPreference(parameters, context);
        case 'com.agentos.example.remind':
          return await this.handleReminder(parameters, context);
        default:
          return createIntentResult(
            false,
            undefined,
            undefined,
            `Unknown intent: ${intent}`
          );
      }
    } catch (error) {
      this.log('error', 'Intent handling failed', error);
      return createIntentResult(
        false,
        undefined,
        undefined,
        `Intent handling failed: ${error.message}`
      );
    }
  }

  // Lifecycle hooks

  async onInstall(context: PluginContext): Promise<void> {
    this.log('info', 'Plugin installed successfully');
    await this.sendNotification(
      'Plugin Installed',
      'Example plugin has been installed and is ready to use!'
    );
  }

  async onEnable(context: PluginContext): Promise<void> {
    this.log('info', 'Plugin enabled');
    // Load user preferences from storage
    await this.loadUserPreferences(context);
  }

  async onDisable(context: PluginContext): Promise<void> {
    this.log('info', 'Plugin disabled');
    // Save any pending data
    await this.saveUserPreferences(context);
  }

  async onUninstall(context: PluginContext): Promise<void> {
    this.log('info', 'Plugin uninstalled');
    // Cleanup any stored data if user requests it
    this.userPreferences.clear();
  }

  // Intent handlers

  private async handleGreeting(parameters: any, context: PluginContext): Promise<IntentResult> {
    const timeOfDay = parameters.timeOfDay || this.getCurrentTimeOfDay();
    
    // Try to get user's name preference
    const userName = this.userPreferences.get(`${context.userId}:name`) || 'there';
    
    let greeting: string;
    switch (timeOfDay) {
      case 'morning':
        greeting = `Good morning, ${userName}! Hope you have a wonderful day ahead.`;
        break;
      case 'afternoon':
        greeting = `Good afternoon, ${userName}! How's your day going?`;
        break;
      case 'evening':
        greeting = `Good evening, ${userName}! Hope you had a great day.`;
        break;
      case 'night':
        greeting = `Good night, ${userName}! Sweet dreams.`;
        break;
      default:
        greeting = `Hello, ${userName}! Nice to see you.`;
    }

    return createIntentResult(
      true,
      greeting,
      {
        timeOfDay,
        userName,
        timestamp: new Date().toISOString()
      }
    );
  }

  @RequirePermission('data:user_preferences:write')
  private async handleSetPreference(parameters: any, context: PluginContext): Promise<IntentResult> {
    const { key, value } = parameters;
    
    if (!key || !value) {
      return createIntentResult(
        false,
        undefined,
        undefined,
        'Both key and value are required for setting preferences'
      );
    }

    // Store preference with user context
    const prefKey = `${context.userId}:${key}`;
    this.userPreferences.set(prefKey, value);
    
    // Persist to data layer
    try {
      await this.writeData('user_preferences', {
        userId: context.userId,
        key,
        value,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      this.log('warn', 'Failed to persist preference to data layer', error);
      // Continue anyway - we have it in memory
    }

    return createIntentResult(
      true,
      `Preference saved: ${key} = ${value}`,
      { key, value, saved: true }
    );
  }

  @RequirePermission('data:user_preferences:read')
  private async handleGetPreference(parameters: any, context: PluginContext): Promise<IntentResult> {
    const { key } = parameters;

    if (key) {
      // Get specific preference
      const prefKey = `${context.userId}:${key}`;
      const value = this.userPreferences.get(prefKey);
      
      if (value === undefined) {
        return createIntentResult(
          false,
          `No preference found for: ${key}`,
          undefined,
          `Preference '${key}' not found`
        );
      }

      return createIntentResult(
        true,
        `${key}: ${value}`,
        { key, value }
      );
    } else {
      // Get all preferences for user
      const userPrefs: Record<string, any> = {};
      const userPrefix = `${context.userId}:`;
      
      for (const [prefKey, value] of this.userPreferences) {
        if (prefKey.startsWith(userPrefix)) {
          const key = prefKey.substring(userPrefix.length);
          userPrefs[key] = value;
        }
      }

      const prefCount = Object.keys(userPrefs).length;
      
      return createIntentResult(
        true,
        `Found ${prefCount} preferences`,
        { preferences: userPrefs, count: prefCount }
      );
    }
  }

  @RequirePermission('system:notifications:write')
  private async handleReminder(parameters: any, context: PluginContext): Promise<IntentResult> {
    const { message, delay = 60 } = parameters;
    
    if (!message) {
      return createIntentResult(
        false,
        undefined,
        undefined,
        'Reminder message is required'
      );
    }

    // Schedule the reminder (simplified - in real implementation would use proper scheduling)
    setTimeout(async () => {
      try {
        await this.sendNotification(
          'Reminder',
          message,
          {
            priority: 'normal',
            actions: [
              { id: 'dismiss', title: 'Dismiss' },
              { id: 'snooze', title: 'Snooze 10 min' }
            ]
          }
        );
      } catch (error) {
        this.log('error', 'Failed to send reminder notification', error);
      }
    }, delay * 60 * 1000);

    return createIntentResult(
      true,
      `Reminder set for ${delay} minutes: "${message}"`,
      {
        message,
        delay,
        scheduledFor: new Date(Date.now() + delay * 60 * 1000).toISOString()
      }
    );
  }

  // Helper methods

  private getCurrentTimeOfDay(): string {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  private async loadUserPreferences(context: PluginContext): Promise<void> {
    try {
      const preferences = await this.readData('user_preferences', {
        userId: context.userId
      });
      
      for (const pref of preferences) {
        const prefKey = `${context.userId}:${pref.key}`;
        this.userPreferences.set(prefKey, pref.value);
      }
      
      this.log('info', `Loaded ${preferences.length} user preferences`);
    } catch (error) {
      this.log('warn', 'Failed to load user preferences', error);
    }
  }

  private async saveUserPreferences(context: PluginContext): Promise<void> {
    try {
      const userPrefix = `${context.userId}:`;
      const prefsToSave: Array<{ key: string; value: any }> = [];
      
      for (const [prefKey, value] of this.userPreferences) {
        if (prefKey.startsWith(userPrefix)) {
          const key = prefKey.substring(userPrefix.length);
          prefsToSave.push({ key, value });
        }
      }
      
      // In a real implementation, this would batch update the data layer
      for (const pref of prefsToSave) {
        await this.writeData('user_preferences', {
          userId: context.userId,
          key: pref.key,
          value: pref.value,
          updatedAt: new Date().toISOString()
        });
      }
      
      this.log('info', `Saved ${prefsToSave.length} user preferences`);
    } catch (error) {
      this.log('error', 'Failed to save user preferences', error);
    }
  }
}

/**
 * Factory function to create the example plugin
 */
export function createExamplePlugin(): ExamplePlugin {
  return new ExamplePlugin();
}

/**
 * Default export for plugin loading
 */
export default {
  createPlugin: createExamplePlugin
};