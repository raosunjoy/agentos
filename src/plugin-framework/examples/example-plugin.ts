/**
 * Example Plugin - Weather Intent Handler
 * Demonstrates how to create a plugin for AgentOS
 */

import {
  AgentOSPlugin,
  createIntentResult,
  createPluginMetadata,
  IntentHandler,
  RequirePermission
} from '../plugin-interface';

export class WeatherPlugin extends AgentOSPlugin {
  getMetadata() {
    return createPluginMetadata(
      'weather-plugin',
      'Weather Information Plugin',
      '1.0.0',
      'Provides weather information and forecasts',
      'AgentOS Team',
      {
        keywords: ['weather', 'forecast', 'temperature', 'climate'],
        homepage: 'https://github.com/agentos/weather-plugin',
        repository: 'https://github.com/agentos/weather-plugin',
        license: 'MIT',
        permissions: [
          {
            type: 'network',
            resource: 'weather-api',
            access: 'read',
            description: 'Access weather data from external APIs',
            required: true
          },
          {
            type: 'data',
            resource: 'location',
            access: 'read',
            description: 'Read user location for weather queries',
            required: false
          }
        ],
        intents: [
          {
            intentId: 'get_weather',
            name: 'Get Current Weather',
            description: 'Get current weather conditions',
            examples: [
              'What\'s the weather like?',
              'How\'s the weather today?',
              'Is it raining outside?'
            ],
            parameters: [
              {
                name: 'location',
                type: 'string',
                required: false,
                description: 'Location for weather query (defaults to current location)'
              }
            ],
            requiredPermissions: ['network']
          },
          {
            intentId: 'get_forecast',
            name: 'Get Weather Forecast',
            description: 'Get weather forecast for upcoming days',
            examples: [
              'What\'s the forecast for tomorrow?',
              'Will it rain this weekend?',
              'What\'s the weather like next week?'
            ],
            parameters: [
              {
                name: 'days',
                type: 'number',
                required: false,
                description: 'Number of days for forecast (1-7)',
                defaultValue: 3
              },
              {
                name: 'location',
                type: 'string',
                required: false,
                description: 'Location for forecast'
              }
            ],
            requiredPermissions: ['network']
          }
        ]
      }
    );
  }

  getIntents() {
    return this.getMetadata().intents;
  }

  @IntentHandler('get_weather')
  @RequirePermission('network')
  async handleGetWeather(intent: string, parameters: any, context: any) {
    try {
      const location = parameters.location || await this.getCurrentLocation();
      const weatherData = await this.fetchWeatherData(location);

      const response = this.formatWeatherResponse(weatherData);

      return createIntentResult(true, response, {
        location,
        temperature: weatherData.temperature,
        condition: weatherData.condition,
        humidity: weatherData.humidity
      });
    } catch (error) {
      this.log('error', 'Failed to get weather', error);
      return createIntentResult(false, 'Sorry, I couldn\'t get the weather information right now.', undefined, error.message);
    }
  }

  @IntentHandler('get_forecast')
  @RequirePermission('network')
  async handleGetForecast(intent: string, parameters: any, context: any) {
    try {
      const days = Math.min(Math.max(parameters.days || 3, 1), 7);
      const location = parameters.location || await this.getCurrentLocation();
      const forecastData = await this.fetchForecastData(location, days);

      const response = this.formatForecastResponse(forecastData);

      return createIntentResult(true, response, {
        location,
        days,
        forecast: forecastData
      });
    } catch (error) {
      this.log('error', 'Failed to get forecast', error);
      return createIntentResult(false, 'Sorry, I couldn\'t get the weather forecast right now.', undefined, error.message);
    }
  }

  async handle(intent: string, parameters: object, context: any) {
    // This method is required by the interface but the @IntentHandler decorator
    // routes specific intents to the appropriate methods
    throw new Error(`Intent ${intent} not handled by this plugin`);
  }

  /**
   * Get current user location
   */
  private async getCurrentLocation(): Promise<string> {
    try {
      // In a real implementation, this would use the device's location services
      // For now, return a default location
      return 'New York, NY';
    } catch (error) {
      this.log('warn', 'Could not get current location, using default', error);
      return 'New York, NY';
    }
  }

  /**
   * Fetch weather data from external API
   */
  private async fetchWeatherData(location: string) {
    // In a real implementation, this would call a weather API
    // For demonstration, return mock data
    this.log('info', `Fetching weather for ${location}`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      location,
      temperature: 72,
      condition: 'Sunny',
      humidity: 45,
      windSpeed: 8,
      timestamp: new Date()
    };
  }

  /**
   * Fetch forecast data from external API
   */
  private async fetchForecastData(location: string, days: number) {
    // In a real implementation, this would call a weather API
    // For demonstration, return mock data
    this.log('info', `Fetching ${days}-day forecast for ${location}`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const forecast = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      forecast.push({
        date,
        temperature: 70 + Math.random() * 10,
        condition: ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 4)],
        precipitationChance: Math.floor(Math.random() * 100)
      });
    }

    return forecast;
  }

  /**
   * Format weather response for user
   */
  private formatWeatherResponse(weatherData: any): string {
    return `The weather in ${weatherData.location} is ${weatherData.condition} with a temperature of ${weatherData.temperature}°F and ${weatherData.humidity}% humidity.`;
  }

  /**
   * Format forecast response for user
   */
  private formatForecastResponse(forecastData: any[]): string {
    let response = 'Here\'s the weather forecast:\n\n';

    forecastData.forEach((day, index) => {
      const dayName = index === 0 ? 'Today' :
                     index === 1 ? 'Tomorrow' :
                     `Day ${index + 1}`;

      response += `${dayName}: ${day.condition}, ${Math.round(day.temperature)}°F`;
      if (day.precipitationChance > 30) {
        response += ` (${day.precipitationChance}% chance of precipitation)`;
      }
      response += '\n';
    });

    return response;
  }

  /**
   * Plugin lifecycle methods
   */
  async onInstall(context: any): Promise<void> {
    this.log('info', 'Weather plugin installed');
    await this.requestPermission('network');
  }

  async onEnable(context: any): Promise<void> {
    this.log('info', 'Weather plugin enabled');
  }

  async onDisable(context: any): Promise<void> {
    this.log('info', 'Weather plugin disabled');
  }

  async onUninstall(context: any): Promise<void> {
    this.log('info', 'Weather plugin uninstalled');
  }
}

/**
 * Factory function to create plugin instance
 */
export function createWeatherPlugin() {
  return new WeatherPlugin();
}

/**
 * Plugin module export for dynamic loading
 */
export default {
  createPlugin: createWeatherPlugin
};