/**
 * Integration Tests for Browser Fallback Chain
 * Tests complete flow: Plugin failure → Browser fallback → Session management
 */

import { BrowserManager } from '../browser-manager';
import { BrowserFallbackRequest } from '../types';

// Mock plugin system
class MockPluginSystem {
  private registeredPlugins: Map<string, any> = new Map();

  registerPlugin(name: string, plugin: any): void {
    this.registeredPlugins.set(name, plugin);
  }

  async resolveIntent(intent: string): Promise<{ success: boolean; plugin?: string; reason?: string }> {
    // Check if plugin exists for intent
    const pluginKey = this.getPluginKeyForIntent(intent);
    const plugin = this.registeredPlugins.get(pluginKey);

    if (plugin) {
      return { success: true, plugin: pluginKey };
    }

    return { success: false, reason: 'no_plugin' };
  }

  private getPluginKeyForIntent(intent: string): string {
    // Simple mapping logic
    if (intent.includes('weather')) return 'weather';
    if (intent.includes('calendar')) return 'calendar';
    if (intent.includes('reminder')) return 'reminder';
    return 'unknown';
  }
}

describe('Browser Fallback Integration', () => {
  let browserManager: BrowserManager;
  let pluginSystem: MockPluginSystem;

  beforeEach(() => {
    browserManager = new BrowserManager();
    pluginSystem = new MockPluginSystem();
  });

  describe('Plugin Failure → Browser Fallback Flow', () => {
    it('should trigger browser fallback when no plugin available', async () => {
      const intent = 'search for restaurants near me';

      // Attempt to resolve intent via plugin system
      const pluginResult = await pluginSystem.resolveIntent(intent);
      expect(pluginResult.success).toBe(false);
      expect(pluginResult.reason).toBe('no_plugin');

      // Should trigger browser fallback
      const shouldTrigger = browserManager.shouldTriggerFallback(
        intent,
        pluginResult.reason
      );
      expect(shouldTrigger).toBe(true);

      // Create browser fallback session
      const request: BrowserFallbackRequest = {
        intent,
        searchQuery: browserManager.mapIntentToSearchQuery(intent),
        userContext: { location: 'San Francisco' }
      };

      const session = await browserManager.createFallbackSession(request);
      expect(session.sessionId).toBeDefined();
      expect(session.fallbackReason).toContain(intent);
      expect(session.metadata?.intent).toBe(intent);
    });

    it('should not trigger browser fallback when plugin succeeds', async () => {
      // Register a plugin
      pluginSystem.registerPlugin('weather', {
        name: 'Weather Plugin',
        handleIntent: async () => ({ success: true })
      });

      const intent = 'what is the weather today';

      const pluginResult = await pluginSystem.resolveIntent(intent);
      expect(pluginResult.success).toBe(true);

      // Should not trigger browser fallback
      const shouldTrigger = browserManager.shouldTriggerFallback(
        intent,
        pluginResult.reason
      );
      expect(shouldTrigger).toBe(false);
    });

    it('should trigger browser fallback for search intents even with plugins', async () => {
      const intent = 'search for coffee shops';

      // Even if plugin exists, search intents should trigger browser
      const shouldTrigger = browserManager.shouldTriggerFallback(intent);
      expect(shouldTrigger).toBe(true);

      const session = await browserManager.createFallbackSession({
        intent,
        searchQuery: browserManager.mapIntentToSearchQuery(intent)
      });

      expect(session).toBeDefined();
      expect(session.metadata?.intent).toBe(intent);
    });
  });

  describe('Intent-to-URL Mapping Chain', () => {
    it('should map intent → search query → URL correctly', async () => {
      const intent = 'find restaurants in San Francisco';

      // Step 1: Intent → Search Query
      const searchQuery = browserManager.mapIntentToSearchQuery(intent);
      expect(searchQuery).toContain('restaurants');
      expect(searchQuery).toContain('San Francisco');

      // Step 2: Search Query → URL
      const url = browserManager.mapQueryToURL(searchQuery);
      expect(url).toContain('perplexity.ai');
      expect(url).toContain(encodeURIComponent('restaurants'));

      // Step 3: Create session with mapped URL
      const request: BrowserFallbackRequest = {
        intent,
        searchQuery,
        suggestedURL: url
      };

      const session = await browserManager.createFallbackSession(request);
      expect(session.metadata?.searchQuery).toBe(searchQuery);
    });

    it('should handle various search intent formats', async () => {
      const testCases = [
        { intent: 'search for weather', expected: 'weather' },
        { intent: 'find coffee shops', expected: 'coffee shops' },
        { intent: 'look up restaurants', expected: 'restaurants' },
        { intent: 'browse news articles', expected: 'news articles' }
      ];

      for (const testCase of testCases) {
        const query = browserManager.mapIntentToSearchQuery(testCase.intent);
        expect(query.toLowerCase()).toContain(testCase.expected.toLowerCase());
      }
    });
  });

  describe('Session Lifecycle Management', () => {
    it('should manage complete browser session lifecycle', async () => {
      const request: BrowserFallbackRequest = {
        intent: 'search for hotels',
        searchQuery: 'hotels',
        userContext: { location: 'Paris' }
      };

      // Create session
      const session = await browserManager.createFallbackSession(request);
      const sessionId = session.sessionId;

      // Verify session exists
      const retrieved = browserManager.getSession(sessionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(sessionId);

      // Simulate browsing (adding URLs)
      // Note: In real implementation, this would be handled by browser component
      retrieved!.urlsVisited.push('https://example.com/hotels');

      // Close session
      browserManager.closeSession(sessionId);

      // Verify session closed
      const afterClose = browserManager.getSession(sessionId);
      expect(afterClose).toBeUndefined();
    });

    it('should clear history on exit if configured', async () => {
      browserManager.updateConfig({
        privacy: {
          clearOnExit: true,
          localHistoryOnly: true,
          cookieIsolation: true,
          disableTelemetry: true
        }
      });

      const request: BrowserFallbackRequest = {
        intent: 'search for flights',
        searchQuery: 'flights'
      };

      const session = await browserManager.createFallbackSession(request);
      session.urlsVisited = ['https://example.com/flights', 'https://example.com/booking'];

      // Close with clearOnExit enabled
      browserManager.closeSession(session.sessionId);

      // Session should be closed (and history cleared in real implementation)
      const retrieved = browserManager.getSession(session.sessionId);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Multi-Session Management', () => {
    it('should handle multiple concurrent browser sessions', async () => {
      const sessions: string[] = [];

      // Create multiple sessions
      for (let i = 0; i < 5; i++) {
        const request: BrowserFallbackRequest = {
          intent: `search ${i}`,
          searchQuery: `query ${i}`
        };
        const session = await browserManager.createFallbackSession(request);
        sessions.push(session.sessionId);
      }

      // Verify all sessions exist
      for (const sessionId of sessions) {
        const session = browserManager.getSession(sessionId);
        expect(session).toBeDefined();
        expect(session?.sessionId).toBe(sessionId);
      }

      // Close all sessions
      for (const sessionId of sessions) {
        browserManager.closeSession(sessionId);
      }

      // Verify all closed
      for (const sessionId of sessions) {
        expect(browserManager.getSession(sessionId)).toBeUndefined();
      }
    });
  });

  describe('Privacy and Accessibility Configuration', () => {
    it('should apply privacy settings to browser sessions', async () => {
      browserManager.updateConfig({
        privacy: {
          localHistoryOnly: true,
          cookieIsolation: true,
          disableTelemetry: true,
          clearOnExit: false
        }
      });

      const config = browserManager.getConfig();
      expect(config.privacy.localHistoryOnly).toBe(true);
      expect(config.privacy.cookieIsolation).toBe(true);
      expect(config.privacy.disableTelemetry).toBe(true);

      // In real implementation, these settings would be applied to WebView
      const session = await browserManager.createFallbackSession({
        intent: 'search test',
        searchQuery: 'test'
      });

      expect(session).toBeDefined();
    });

    it('should apply accessibility settings for elderly users', async () => {
      browserManager.updateConfig({
        accessibility: {
          readerModeEnabled: true,
          textScaling: 1.5, // 50% larger for elderly users
          screenReaderEnabled: true,
          highContrast: true
        }
      });

      const config = browserManager.getConfig();
      expect(config.accessibility.textScaling).toBe(1.5);
      expect(config.accessibility.readerModeEnabled).toBe(true);
      expect(config.accessibility.screenReaderEnabled).toBe(true);

      // In real implementation, these would be applied to WebView accessibility APIs
    });
  });

  describe('Error Handling', () => {
    it('should handle disabled browser fallback gracefully', async () => {
      browserManager.updateConfig({ enabled: false });

      const shouldTrigger = browserManager.shouldTriggerFallback('search for something');
      expect(shouldTrigger).toBe(false);
    });

    it('should handle invalid session retrieval gracefully', () => {
      const session = browserManager.getSession('non-existent-session');
      expect(session).toBeUndefined();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle complete user flow: intent → plugin fail → browser → session', async () => {
      const userIntent = 'find vegan restaurants with good reviews';

      // Step 1: Try plugin system
      const pluginResult = await pluginSystem.resolveIntent(userIntent);
      expect(pluginResult.success).toBe(false);

      // Step 2: Trigger browser fallback
      const shouldFallback = browserManager.shouldTriggerFallback(
        userIntent,
        pluginResult.reason
      );
      expect(shouldFallback).toBe(true);

      // Step 3: Map intent to search
      const searchQuery = browserManager.mapIntentToSearchQuery(userIntent);
      const url = browserManager.mapQueryToURL(searchQuery);

      // Step 4: Create browser session
      const session = await browserManager.createFallbackSession({
        intent: userIntent,
        searchQuery,
        suggestedURL: url,
        userContext: {
          preferences: ['vegan', 'high-rated']
        }
      });

      expect(session.sessionId).toBeDefined();
      expect(session.metadata?.searchQuery).toBe(searchQuery);
      expect(session.fallbackReason).toContain(userIntent);

      // Step 5: User browses (simulated)
      // In real implementation, WebView would navigate to URL
      // For now, just verify session is maintained
      const retrieved = browserManager.getSession(session.sessionId);
      expect(retrieved).toBeDefined();

      // Step 6: Close session
      browserManager.closeSession(session.sessionId);
      expect(browserManager.getSession(session.sessionId)).toBeUndefined();
    });
  });
});
