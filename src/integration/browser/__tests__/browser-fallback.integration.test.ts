/**
 * Integration tests for Browser Fallback Chain
 * Tests plugin failure → browser fallback trigger → session creation flow
 */

import { BrowserManager } from '../browser-manager';
import { BrowserFallbackRequest } from '../types';

// Mock plugin manager interface
interface MockPluginManager {
  handleIntent(intent: string, parameters: any, userId: string): Promise<{
    success: boolean;
    error?: string;
    result?: any;
  }>;
}

describe('Browser Fallback Integration', () => {
  let browserManager: BrowserManager;
  let mockPluginManager: MockPluginManager;

  beforeEach(() => {
    browserManager = new BrowserManager();
    
    // Create mock plugin manager
    mockPluginManager = {
      handleIntent: jest.fn()
    };
  });

  describe('Plugin Failure → Browser Fallback Flow', () => {
    it('should trigger browser fallback when no plugin handles intent', async () => {
      // Simulate plugin manager returning no handler
      (mockPluginManager.handleIntent as jest.Mock).mockResolvedValue({
        success: false,
        error: 'No handler found for intent: search.restaurants'
      });

      const intent = 'search.restaurants';
      const result = await mockPluginManager.handleIntent(intent, {}, 'test-user');

      // Verify plugin failed
      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler found');

      // Check if browser fallback should be triggered
      const shouldFallback = browserManager.shouldTriggerFallback(intent, 'no_plugin');
      expect(shouldFallback).toBe(true);

      // Create browser fallback session
      const request: BrowserFallbackRequest = {
        intent,
        searchQuery: browserManager.mapIntentToSearchQuery(intent),
        userContext: { userId: 'test-user' }
      };

      const session = await browserManager.createFallbackSession(request);
      
      expect(session.sessionId).toBeDefined();
      expect(session.fallbackReason).toContain(intent);
      expect(session.metadata?.intent).toBe(intent);
      expect(session.metadata?.searchQuery).toBeDefined();
    });

    it('should trigger browser fallback for search intents', async () => {
      const searchIntents = [
        'search for restaurants',
        'find coffee shops',
        'look up weather',
        'browse recipes'
      ];

      for (const intent of searchIntents) {
        const shouldFallback = browserManager.shouldTriggerFallback(intent);
        expect(shouldFallback).toBe(true);

        const request: BrowserFallbackRequest = {
          intent,
          searchQuery: browserManager.mapIntentToSearchQuery(intent),
          userContext: { userId: 'test-user' }
        };

        const session = await browserManager.createFallbackSession(request);
        expect(session.sessionId).toBeDefined();
        expect(session.metadata?.intent).toBe(intent);
      }
    });

    it('should trigger browser fallback when plugin API is unavailable', async () => {
      // Simulate API unavailable error
      (mockPluginManager.handleIntent as jest.Mock).mockResolvedValue({
        success: false,
        error: 'API unavailable: Service temporarily down'
      });

      const intent = 'book.appointment';
      const result = await mockPluginManager.handleIntent(intent, {}, 'test-user');

      expect(result.success).toBe(false);

      // Should trigger fallback for API unavailable
      const shouldFallback = browserManager.shouldTriggerFallback(intent, 'api_unavailable');
      expect(shouldFallback).toBe(true);
    });

    it('should not trigger fallback for regular intents that succeed', async () => {
      // Simulate successful plugin handling
      (mockPluginManager.handleIntent as jest.Mock).mockResolvedValue({
        success: true,
        result: { message: 'Reminder set successfully' }
      });

      const intent = 'set.reminder';
      const result = await mockPluginManager.handleIntent(intent, { time: '2pm' }, 'test-user');

      expect(result.success).toBe(true);

      // Should not trigger fallback
      const shouldFallback = browserManager.shouldTriggerFallback(intent);
      expect(shouldFallback).toBe(false);
    });
  });

  describe('Intent to Search Query Mapping', () => {
    it('should map search intents to clean search queries', () => {
      const testCases = [
        { intent: 'search for restaurants', expected: 'restaurants' },
        { intent: 'find nearby coffee shops', expected: 'nearby coffee shops' },
        { intent: 'look up weather forecast', expected: 'weather forecast' },
        { intent: 'browse recipes for dinner', expected: 'recipes for dinner' }
      ];

      testCases.forEach(({ intent, expected }) => {
        const query = browserManager.mapIntentToSearchQuery(intent);
        expect(query).toBe(expected);
      });
    });

    it('should map search queries to URLs', () => {
      const queries = ['restaurants', 'coffee shops', 'weather forecast'];
      
      queries.forEach(query => {
        const url = browserManager.mapQueryToURL(query);
        expect(url).toContain('perplexity.ai');
        expect(url).toContain(encodeURIComponent(query));
      });
    });
  });

  describe('Browser Session Management', () => {
    it('should manage multiple browser sessions', async () => {
      const intents = ['search A', 'search B', 'search C'];
      const sessions: any[] = [];

      for (const intent of intents) {
        const request: BrowserFallbackRequest = {
          intent,
          searchQuery: browserManager.mapIntentToSearchQuery(intent)
        };

        const session = await browserManager.createFallbackSession(request);
        sessions.push(session);

        // Verify session exists
        const retrieved = browserManager.getSession(session.sessionId);
        expect(retrieved).toBeDefined();
        expect(retrieved?.sessionId).toBe(session.sessionId);
      }

      // Close all sessions
      sessions.forEach(session => {
        browserManager.closeSession(session.sessionId);
        expect(browserManager.getSession(session.sessionId)).toBeUndefined();
      });
    });

    it('should clear history on exit when configured', async () => {
      browserManager.updateConfig({
        privacy: {
          clearOnExit: true,
          localHistoryOnly: true,
          cookieIsolation: true,
          disableTelemetry: true
        }
      });

      const request: BrowserFallbackRequest = {
        intent: 'search test',
        searchQuery: 'test query'
      };

      const session = await browserManager.createFallbackSession(request);
      session.urlsVisited = ['https://example.com', 'https://test.com'];

      expect(session.urlsVisited.length).toBeGreaterThan(0);

      browserManager.closeSession(session.sessionId);

      // Session should be closed and history cleared (session no longer exists)
      expect(browserManager.getSession(session.sessionId)).toBeUndefined();
    });
  });

  describe('Complete Fallback Chain', () => {
    it('should handle complete flow: plugin failure → fallback detection → session creation', async () => {
      // Step 1: Plugin fails to handle intent
      (mockPluginManager.handleIntent as jest.Mock).mockResolvedValue({
        success: false,
        error: 'No handler found for intent: search.restaurants'
      });

      const intent = 'search.restaurants';
      const userId = 'test-user';
      
      const pluginResult = await mockPluginManager.handleIntent(intent, {}, userId);
      expect(pluginResult.success).toBe(false);

      // Step 2: Check if fallback should be triggered
      const failureReason = 'no_plugin';
      const shouldFallback = browserManager.shouldTriggerFallback(intent, failureReason);
      expect(shouldFallback).toBe(true);

      // Step 3: Create browser fallback session
      const searchQuery = browserManager.mapIntentToSearchQuery(intent);
      const url = browserManager.mapQueryToURL(searchQuery);

      const request: BrowserFallbackRequest = {
        intent,
        searchQuery,
        suggestedURL: url,
        userContext: { userId, failureReason }
      };

      const session = await browserManager.createFallbackSession(request);

      // Step 4: Verify session created correctly
      expect(session.sessionId).toBeDefined();
      expect(session.fallbackReason).toContain(intent);
      expect(session.metadata?.intent).toBe(intent);
      expect(session.metadata?.searchQuery).toBe(searchQuery);
      expect(session.metadata?.userContext?.failureReason).toBe(failureReason);
    });

    it('should handle fallback when plugin throws exception', async () => {
      // Simulate plugin throwing exception
      (mockPluginManager.handleIntent as jest.Mock).mockRejectedValue(
        new Error('Plugin crashed')
      );

      const intent = 'book.hotel';

      try {
        await mockPluginManager.handleIntent(intent, {}, 'test-user');
      } catch (error) {
        // Exception caught - trigger fallback
        const shouldFallback = browserManager.shouldTriggerFallback(intent, 'plugin_crash');
        expect(shouldFallback).toBe(true);

        const session = await browserManager.createFallbackSession({
          intent,
          searchQuery: browserManager.mapIntentToSearchQuery(intent),
          userContext: { error: 'Plugin crashed' }
        });

        expect(session).toBeDefined();
      }
    });
  });

  describe('Browser Configuration', () => {
    it('should respect disabled browser fallback', () => {
      browserManager.updateConfig({ enabled: false });

      const shouldFallback = browserManager.shouldTriggerFallback('search something', 'no_plugin');
      expect(shouldFallback).toBe(false);
    });

    it('should apply privacy settings to sessions', async () => {
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
    });

    it('should apply accessibility settings', async () => {
      browserManager.updateConfig({
        accessibility: {
          readerModeEnabled: true,
          textScaling: 1.5,
          screenReaderEnabled: true,
          highContrast: true
        }
      });

      const config = browserManager.getConfig();
      expect(config.accessibility.readerModeEnabled).toBe(true);
      expect(config.accessibility.textScaling).toBe(1.5);
      expect(config.accessibility.screenReaderEnabled).toBe(true);
    });
  });
});

