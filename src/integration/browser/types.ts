/**
 * Browser Integration Types
 * 
 * Types for Agent Browser (Comet fallback) integration
 */

export interface BrowserConfig {
  /** Enable browser fallback */
  enabled: boolean;
  
  /** Browser type: 'comet' | 'custom' */
  browserType: 'comet' | 'custom';
  
  /** Privacy settings */
  privacy: BrowserPrivacyConfig;
  
  /** Accessibility settings */
  accessibility: BrowserAccessibilityConfig;
  
  /** AI integration settings */
  ai: BrowserAIConfig;
}

export interface BrowserPrivacyConfig {
  /** Store history locally only */
  localHistoryOnly: boolean;
  
  /** Enable cookie isolation */
  cookieIsolation: boolean;
  
  /** Disable telemetry */
  disableTelemetry: boolean;
  
  /** Clear history on exit */
  clearOnExit: boolean;
}

export interface BrowserAccessibilityConfig {
  /** Enable reader mode by default */
  readerModeEnabled: boolean;
  
  /** Large text scaling factor */
  textScaling: number;
  
  /** Enable screen reader support */
  screenReaderEnabled: boolean;
  
  /** High contrast mode */
  highContrast: boolean;
}

export interface BrowserAIConfig {
  /** Enable voice-driven navigation */
  voiceNavigationEnabled: boolean;
  
  /** Enable intent-to-URL mapping */
  intentToURLMapping: boolean;
  
  /** Enable NLP-to-DOM automation */
  nlpToDOM: boolean;
}

export interface BrowserFallbackRequest {
  /** Intent that triggered fallback */
  intent: string;
  
  /** Parsed search query */
  searchQuery?: string;
  
  /** Suggested URL */
  suggestedURL?: string;
  
  /** User context */
  userContext?: Record<string, any>;
}

export interface BrowserSession {
  /** Session ID */
  sessionId: string;
  
  /** Start time */
  startTime: number;
  
  /** URLs visited */
  urlsVisited: string[];
  
  /** Fallback trigger reason */
  fallbackReason: string;
  
  /** Session metadata */
  metadata?: Record<string, any>;
}

