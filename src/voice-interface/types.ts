/**
 * Core Types for AgentOS Voice Interface
 * Defines interfaces and types for voice interaction components
 */

// Voice Settings and Configuration
export interface VoiceSettings {
  language: string;
  voice: string;
  pitch: number;
  rate: number;
  volume: number;
  autoStart: boolean;
  continuousListening: boolean;
  wakeWord: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
}

export interface SpeechRecognitionSettings {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  confidenceThreshold: number;
}

export interface SpeechSynthesisSettings {
  voice: string;
  pitch: number;
  rate: number;
  volume: number;
  language: string;
}

// Voice Activity Detection
export interface VoiceActivityData {
  isActive: boolean;
  confidence: number;
  timestamp: number;
  duration: number;
  amplitude: number;
}

export interface VADSettings {
  threshold: number;
  sampleRate: number;
  frameSize: number;
  sensitivity: 'low' | 'medium' | 'high';
}

// Conversational Interface
export interface ConversationState {
  isActive: boolean;
  currentContext: string;
  awaitingConfirmation: boolean;
  conversationHistory: ConversationTurn[];
  sessionId: string;
  userId: string;
}

export interface ConversationTurn {
  id: string;
  timestamp: Date;
  userInput: string;
  systemResponse: string;
  intent?: string;
  confidence?: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface ConversationalSettings {
  maxHistoryLength: number;
  responseTimeout: number;
  contextWindowSize: number;
  personality: 'friendly' | 'professional' | 'casual';
}

// Accessibility Settings
export interface AccessibilitySettings {
  largeText: boolean;
  highContrast: boolean;
  screenReader: boolean;
  voiceNavigation: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  contrastLevel: 'normal' | 'high' | 'extra-high';
  colorScheme: 'default' | 'dark' | 'light' | 'high-contrast';
}

export interface InputMethod {
  type: 'voice' | 'text' | 'gesture' | 'switch' | 'eye-tracking';
  enabled: boolean;
  priority: number;
  settings?: Record<string, any>;
}

// Alternative Input Methods
export interface GestureData {
  type: 'tap' | 'swipe' | 'pinch' | 'rotate' | 'long-press';
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  speed?: number;
  fingers: number;
  target: HTMLElement;
  timestamp: Date;
}

export interface SwitchConfig {
  autoScan: boolean;
  scanSpeed: number;
  switchType: 'single' | 'dual';
  dwellTime: number;
  acceptKey: string;
  nextKey: string;
}

export interface EyeTrackingData {
  x: number;
  y: number;
  confidence: number;
  timestamp: Date;
  gazeDuration: number;
}

// Voice Feedback
export interface FeedbackOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  message?: string;
  duration?: number;
  priority?: 'low' | 'normal' | 'high';
  interrupt?: boolean;
}

export interface AudioFeedbackSettings {
  enabled: boolean;
  volume: number;
  successSound: string;
  errorSound: string;
  warningSound: string;
  infoSound: string;
}

// WCAG Compliance
export interface WCAGViolation {
  level: 'A' | 'AA' | 'AAA';
  guideline: string;
  description: string;
  element?: HTMLElement;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  suggestion: string;
}

export interface WCAGComplianceReport {
  score: number;
  level: 'A' | 'AA' | 'AAA' | 'Fail';
  violations: WCAGViolation[];
  passedChecks: string[];
  recommendations: string[];
  timestamp: Date;
}

// Voice Prompt System
export interface VoicePrompt {
  id: string;
  type: 'confirmation' | 'input' | 'selection' | 'error';
  message: string;
  options?: string[];
  timeout?: number;
  retries?: number;
  context?: Record<string, any>;
}

// Speech Processing
export interface SpeechProcessingResult {
  text: string;
  confidence: number;
  timestamp: Date;
  language: string;
  isFinal: boolean;
  alternatives?: SpeechAlternative[];
  metadata?: Record<string, any>;
}

export interface SpeechAlternative {
  text: string;
  confidence: number;
}

export interface AudioProcessingOptions {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  normalize: boolean;
  removeSilence: boolean;
  noiseReduction: boolean;
}

// Component Status
export interface ComponentStatus {
  initialized: boolean;
  active: boolean;
  error?: string;
  lastActivity?: Date;
  metrics?: Record<string, any>;
}

// Voice Interface Events
export interface VoiceInterfaceEvents {
  initialized: () => void;
  destroyed: () => void;
  listeningStarted: () => void;
  listeningStopped: () => void;
  speechStarted: (text: string) => void;
  speechEnded: (text: string) => void;
  speechError: (error: any) => void;
  transcription: (text: string) => void;
  sttError: (error: any) => void;
  ttsStarted: (text: string) => void;
  ttsEnded: (text: string) => void;
  ttsError: (error: any) => void;
  voiceActivity: (data: VoiceActivityData) => void;
  silenceDetected: () => void;
  inputProcessed: (result: any) => void;
  responseGenerated: (response: string) => void;
  accessibilityChanged: (settings: AccessibilitySettings) => void;
  alternativeInputUsed: (method: string) => void;
  gestureDetected: (gesture: GestureData) => void;
  switchActivated: (element: HTMLElement) => void;
  feedbackProvided: (data: FeedbackOptions) => void;
}

// Integration with AgentOS Core
export interface VoiceInterfaceConfig {
  enabled: boolean;
  defaultLanguage: string;
  supportedLanguages: string[];
  wakeWords: string[];
  autoStart: boolean;
  accessibility: AccessibilitySettings;
  performance: {
    maxProcessingTime: number;
    cacheSize: number;
    offlineMode: boolean;
  };
}

// Error Types
export class VoiceInterfaceError extends Error {
  constructor(
    message: string,
    public code: string,
    public component: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'VoiceInterfaceError';
  }
}

export class SpeechRecognitionError extends VoiceInterfaceError {
  constructor(message: string, public recognitionError?: any) {
    super(message, 'SPEECH_RECOGNITION_ERROR', 'speech-to-text', true);
    this.name = 'SpeechRecognitionError';
  }
}

export class SpeechSynthesisError extends VoiceInterfaceError {
  constructor(message: string, public synthesisError?: any) {
    super(message, 'SPEECH_SYNTHESIS_ERROR', 'text-to-speech', true);
    this.name = 'SpeechSynthesisError';
  }
}

export class AccessibilityError extends VoiceInterfaceError {
  constructor(message: string, public element?: HTMLElement) {
    super(message, 'ACCESSIBILITY_ERROR', 'accessibility-manager', true);
    this.name = 'AccessibilityError';
  }
}