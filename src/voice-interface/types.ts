export interface VoiceSettings {
  speed: number;
  volume: number;
  language: string;
  pitch: number;
}

export interface AccessibilitySettings {
  largeText: boolean;
  highContrast: boolean;
  screenReader: boolean;
  voiceNavigation: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  contrastLevel: 'normal' | 'high' | 'maximum';
}

export interface ConversationState {
  isListening: boolean;
  isProcessing: boolean;
  isResponding: boolean;
  currentIntent?: string;
  confidence?: number;
  awaitingConfirmation: boolean;
  conversationHistory: ConversationTurn[];
}

export interface ConversationTurn {
  id: string;
  timestamp: Date;
  userInput: string;
  systemResponse: string;
  intent?: string;
  confidence?: number;
  success: boolean;
}

export interface VoicePrompt {
  id: string;
  text: string;
  type: 'confirmation' | 'clarification' | 'information' | 'error';
  options?: string[];
  timeout?: number;
  retryCount?: number;
}

export interface VisualFeedback {
  type: 'listening' | 'processing' | 'speaking' | 'error' | 'success';
  message?: string;
  progress?: number;
  animated: boolean;
}

export interface InputMethod {
  type: 'voice' | 'text' | 'gesture' | 'switch' | 'eye-tracking';
  enabled: boolean;
  sensitivity?: number;
  customization?: Record<string, any>;
}