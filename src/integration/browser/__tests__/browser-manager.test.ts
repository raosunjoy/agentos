/**
 * Unit tests for Browser Manager
 */

import { BrowserManager } from '../browser-manager';
import { BrowserFallbackRequest } from '../types';

describe('BrowserManager', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    manager = new BrowserManager();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const config = manager.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.browserType).toBe('comet');
      expect(config.privacy.localHistoryOnly).toBe(true);
      expect(config.privacy.cookieIsolation).toBe(true);
      expect(config.privacy.disableTelemetry).toBe(true);
      expect(config.accessibility.readerModeEnabled).toBe(true);
      expect(config.accessibility.textScaling).toBe(1.2);
      expect(config.ai.voiceNavigationEnabled).toBe(true);
    });

    it('should allow custom configuration', () => {
      const customManager = new BrowserManager({
        enabled: false,
        privacy: {
          localHistoryOnly: false,
          cookieIsolation: false,
          disableTelemetry: false,
          clearOnExit: true
        }
      });

      const config = customManager.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.privacy.localHistoryOnly).toBe(false);
    });
  });

  describe('Fallback Trigger Detection', () => {
    it('should trigger fallback for search intents', () => {
      const shouldTrigger = manager.shouldTriggerFallback('search for restaurants');
      expect(shouldTrigger).toBe(true);
    });

    it('should trigger fallback for "find" intent', () => {
      const shouldTrigger = manager.shouldTriggerFallback('find nearby coffee shops');
      expect(shouldTrigger).toBe(true);
    });

    it('should trigger fallback for "look up" intent', () => {
      const shouldTrigger = manager.shouldTriggerFallback('look up weather forecast');
      expect(shouldTrigger).toBe(true);
    });

    it('should trigger fallback when plugin fails', () => {
      const shouldTrigger = manager.shouldTriggerFallback(
        'some intent',
        'no_plugin'
      );
      expect(shouldTrigger).toBe(true);
    });

    it('should trigger fallback when API unavailable', () => {
      const shouldTrigger = manager.shouldTriggerFallback(
        'some intent',
        'api_unavailable'
      );
      expect(shouldTrigger).toBe(true);
    });

    it('should not trigger fallback for regular intents', () => {
      const shouldTrigger = manager.shouldTriggerFallback('set a reminder');
      expect(shouldTrigger).toBe(false);
    });

    it('should not trigger when disabled', () => {
      manager.updateConfig({ enabled: false });
      const shouldTrigger = manager.shouldTriggerFallback('search for something');
      expect(shouldTrigger).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should create fallback session', async () => {
      const request: BrowserFallbackRequest = {
        intent: 'search for restaurants',
        searchQuery: 'restaurants',
        userContext: { location: 'San Francisco' }
      };

      const session = await manager.createFallbackSession(request);
      expect(session.sessionId).toBeDefined();
      expect(session.startTime).toBeGreaterThan(0);
      expect(session.fallbackReason).toContain('Intent not resolved');
      expect(session.metadata?.intent).toBe('search for restaurants');
    });

    it('should retrieve active session', async () => {
      const request: BrowserFallbackRequest = {
        intent: 'search for coffee',
        searchQuery: 'coffee shops'
      };

      const session = await manager.createFallbackSession(request);
      const retrieved = manager.getSession(session.sessionId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(session.sessionId);
    });

    it('should close session', async () => {
      const request: BrowserFallbackRequest = {
        intent: 'search for something'
      };

      const session = await manager.createFallbackSession(request);
      manager.closeSession(session.sessionId);
      
      const retrieved = manager.getSession(session.sessionId);
      expect(retrieved).toBeUndefined();
    });

    it('should clear history on exit if configured', async () => {
      manager.updateConfig({
        privacy: {
          clearOnExit: true,
          localHistoryOnly: true,
          cookieIsolation: true,
          disableTelemetry: true
        }
      });

      const request: BrowserFallbackRequest = {
        intent: 'search for something'
      };

      const session = await manager.createFallbackSession(request);
      session.urlsVisited = ['https://example.com'];
      
      manager.closeSession(session.sessionId);
      const retrieved = manager.getSession(session.sessionId);
      
      // Session should be closed (undefined)
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Intent Mapping', () => {
    it('should map intent to search query', () => {
      const query = manager.mapIntentToSearchQuery('search for restaurants');
      expect(query).toBe('restaurants');
    });

    it('should remove search keywords', () => {
      const query1 = manager.mapIntentToSearchQuery('find coffee shops');
      expect(query1).toBe('coffee shops');

      const query2 = manager.mapIntentToSearchQuery('look up weather');
      expect(query2).toBe('weather');
    });

    it('should handle intents without search keywords', () => {
      const query = manager.mapIntentToSearchQuery('restaurants in San Francisco');
      expect(query).toBe('restaurants in San Francisco');
    });

    it('should map query to URL', () => {
      const url = manager.mapQueryToURL('restaurants');
      expect(url).toContain('perplexity.ai');
      expect(url).toContain('restaurants');
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      manager.updateConfig({
        privacy: {
          clearOnExit: true
        }
      });

      const config = manager.getConfig();
      expect(config.privacy.clearOnExit).toBe(true);
    });

    it('should merge configuration updates', () => {
      const initialConfig = manager.getConfig();
      
      manager.updateConfig({
        accessibility: {
          textScaling: 1.5
        }
      });

      const updatedConfig = manager.getConfig();
      expect(updatedConfig.accessibility.textScaling).toBe(1.5);
      expect(updatedConfig.accessibility.readerModeEnabled).toBe(
        initialConfig.accessibility.readerModeEnabled
      );
    });
  });
});

