/**
 * Conversational Interface Module
 * Manages natural language conversations with AgentOS
 */

import { EventEmitter } from 'events';
import {
  ConversationState,
  ConversationTurn,
  ConversationalSettings,
  VoicePrompt,
  VoiceInterfaceError
} from './types';

export class ConversationalInterface extends EventEmitter {
  private conversationState: ConversationState;
  private settings: ConversationalSettings;
  private container: HTMLElement | null = null;
  private visualFeedbackElement: HTMLElement | null = null;
  private conversationHistoryElement: HTMLElement | null = null;
  private inputIndicatorElement: HTMLElement | null = null;

  private isInitialized = false;
  private isProcessing = false;
  private currentPrompt: VoicePrompt | null = null;
  private responseTimeout: NodeJS.Timeout | null = null;

  constructor(settings?: Partial<ConversationalSettings>) {
    super();

    this.settings = {
      maxHistoryLength: 50,
      responseTimeout: 30000, // 30 seconds
      contextWindowSize: 10,
      personality: 'friendly',
      ...settings
    };

    this.conversationState = {
      isActive: false,
      currentContext: 'general',
      awaitingConfirmation: false,
      conversationHistory: [],
      sessionId: this.generateSessionId(),
      userId: 'default-user'
    };
  }

  /**
   * Initialize the conversational interface
   */
  async initialize(container?: HTMLElement): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing Conversational Interface...');

      if (container) {
        this.container = container;
        this.setupUI(container);
      }

      this.isInitialized = true;
      this.emit('initialized');
      console.log('Conversational Interface initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Conversational Interface:', error);
      throw new VoiceInterfaceError(
        'Failed to initialize conversational interface',
        'INITIALIZATION_FAILED',
        'conversational-interface',
        false
      );
    }
  }

  /**
   * Setup user interface elements
   */
  private setupUI(container: HTMLElement): void {
    // Create main conversation container
    const conversationContainer = document.createElement('div');
    conversationContainer.className = 'agentos-conversation';
    conversationContainer.setAttribute('role', 'log');
    conversationContainer.setAttribute('aria-live', 'polite');
    conversationContainer.setAttribute('aria-label', 'AgentOS Conversation');

    // Create conversation history
    const historyElement = document.createElement('div');
    historyElement.className = 'conversation-history';
    conversationContainer.appendChild(historyElement);
    this.conversationHistoryElement = historyElement;

    // Create visual feedback element
    const feedbackElement = document.createElement('div');
    feedbackElement.className = 'visual-feedback';
    feedbackElement.setAttribute('aria-live', 'assertive');
    conversationContainer.appendChild(feedbackElement);
    this.visualFeedbackElement = feedbackElement;

    // Create input indicator
    const indicatorElement = document.createElement('div');
    indicatorElement.className = 'input-indicator';
    indicatorElement.textContent = 'Ready to listen';
    conversationContainer.appendChild(indicatorElement);
    this.inputIndicatorElement = indicatorElement;

    // Add to container
    container.appendChild(conversationContainer);

    // Apply initial styles
    this.applyStyles();
  }

  /**
   * Apply CSS styles for the conversation interface
   */
  private applyStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .agentos-conversation {
        position: relative;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background: rgba(255, 255, 255, 0.95);
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .conversation-history {
        max-height: 400px;
        overflow-y: auto;
        margin-bottom: 20px;
        padding: 10px;
      }

      .conversation-turn {
        margin-bottom: 16px;
        padding: 12px;
        border-radius: 8px;
        animation: fadeIn 0.3s ease-in;
      }

      .conversation-turn.user {
        background: #007AFF;
        color: white;
        margin-left: 40px;
      }

      .conversation-turn.agent {
        background: #F2F2F7;
        color: #1C1C1E;
        margin-right: 40px;
      }

      .conversation-turn.error {
        background: #FF3B30;
        color: white;
      }

      .conversation-turn.processing {
        background: #FF9500;
        color: white;
        animation: pulse 1.5s infinite;
      }

      .visual-feedback {
        text-align: center;
        padding: 10px;
        font-weight: 500;
        border-radius: 6px;
        margin-bottom: 10px;
        min-height: 24px;
      }

      .input-indicator {
        text-align: center;
        color: #8E8E93;
        font-size: 14px;
        padding: 8px;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      @media (max-width: 768px) {
        .agentos-conversation {
          margin: 10px;
          padding: 15px;
        }

        .conversation-turn.user,
        .conversation-turn.agent {
          margin-left: 20px;
          margin-right: 20px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .conversation-turn,
        .conversation-turn.processing {
          animation: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Process user input and generate response
   */
  async processInput(input: string): Promise<string> {
    if (!this.isInitialized) {
      throw new VoiceInterfaceError(
        'Conversational Interface not initialized',
        'NOT_INITIALIZED',
        'conversational-interface',
        false
      );
    }

    if (this.isProcessing) {
      console.warn('Already processing input, ignoring new input');
      return 'Please wait, I\'m still processing your previous request.';
    }

    try {
      this.isProcessing = true;
      this.emit('inputProcessingStarted', input);

      // Update visual feedback
      this.updateVisualFeedback({
        type: 'info',
        message: 'Processing your request...',
        animated: true
      });

      // Add user input to conversation
      const userTurn: ConversationTurn = {
        id: Date.now().toString(),
        timestamp: new Date(),
        userInput: input,
        systemResponse: '',
        intent: null,
        confidence: null,
        success: false
      };

      this.addConversationTurn(userTurn);

      // Process input through NLP pipeline (would integrate with intelligence layer)
      const response = await this.generateResponse(input);

      // Update user turn with response
      userTurn.systemResponse = response;
      userTurn.success = true;

      // Add response to conversation
      this.addConversationTurn(userTurn);

      // Update visual feedback
      this.updateVisualFeedback({
        type: 'success',
        message: 'Response ready',
        animated: false
      });

      this.emit('inputProcessed', { input, response });
      return response;

    } catch (error) {
      console.error('Failed to process input:', error);

      // Add error turn to conversation
      const errorTurn: ConversationTurn = {
        id: Date.now().toString(),
        timestamp: new Date(),
        userInput: input,
        systemResponse: 'Sorry, I encountered an error processing your request.',
        intent: null,
        confidence: null,
        success: false
      };

      this.addConversationTurn(errorTurn);

      // Update visual feedback
      this.updateVisualFeedback({
        type: 'error',
        message: 'Error occurred',
        animated: false
      });

      this.emit('inputProcessingError', error);
      return 'Sorry, I encountered an error processing your request. Please try again.';
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Generate response based on user input
   */
  private async generateResponse(input: string): Promise<string> {
    // This would integrate with the intelligence layer
    // For now, provide simple responses based on keywords

    const lowerInput = input.toLowerCase();

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // Basic keyword matching for demonstration
    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return this.getPersonalityResponse([
        "Hello! How can I help you today?",
        "Hi there! What can I do for you?",
        "Greetings! How may I assist you?"
      ]);
    }

    if (lowerInput.includes('weather')) {
      return "I'd be happy to help you with weather information. What location are you interested in?";
    }

    if (lowerInput.includes('time') || lowerInput.includes('what time')) {
      const now = new Date();
      return `The current time is ${now.toLocaleTimeString()}.`;
    }

    if (lowerInput.includes('help')) {
      return "I can help you with various tasks like checking the weather, setting reminders, answering questions, and more. What would you like to know?";
    }

    if (lowerInput.includes('thank')) {
      return this.getPersonalityResponse([
        "You're welcome! Is there anything else I can help you with?",
        "Happy to help! Let me know if you need anything else.",
        "My pleasure! What else can I do for you?"
      ]);
    }

    // Default response
    return this.getPersonalityResponse([
      "I'm not sure I understand that request. Could you please rephrase it?",
      "I didn't quite catch that. Could you say that again?",
      "I'm sorry, I don't understand. Can you try asking differently?"
    ]);
  }

  /**
   * Get personality-appropriate response
   */
  private getPersonalityResponse(responses: string[]): string {
    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex];
  }

  /**
   * Add conversation turn to history and UI
   */
  private addConversationTurn(turn: ConversationTurn): void {
    // Add to internal history
    this.conversationState.conversationHistory.push(turn);

    // Trim history if needed
    if (this.conversationState.conversationHistory.length > this.settings.maxHistoryLength) {
      this.conversationState.conversationHistory.shift();
    }

    // Render in UI if available
    if (this.conversationHistoryElement) {
      this.renderConversationTurn(turn);
    }

    this.emit('conversationTurnAdded', turn);
  }

  /**
   * Render conversation turn in UI
   */
  private renderConversationTurn(turn: ConversationTurn): void {
    if (!this.conversationHistoryElement) return;

    const turnElement = document.createElement('div');
    turnElement.className = `conversation-turn ${turn.success ? 'agent' : 'error'}`;
    turnElement.setAttribute('role', 'article');

    const timestamp = turn.timestamp.toLocaleTimeString();
    const userInput = document.createElement('div');
    userInput.className = 'user-input';
    userInput.textContent = `You: ${turn.userInput}`;

    const response = document.createElement('div');
    response.className = 'agent-response';
    response.textContent = `AgentOS: ${turn.systemResponse}`;

    const timeElement = document.createElement('div');
    timeElement.className = 'timestamp';
    timeElement.textContent = timestamp;

    turnElement.appendChild(userInput);
    turnElement.appendChild(response);
    turnElement.appendChild(timeElement);

    this.conversationHistoryElement.appendChild(turnElement);
    this.conversationHistoryElement.scrollTop = this.conversationHistoryElement.scrollHeight;
  }

  /**
   * Update visual feedback
   */
  private updateVisualFeedback(feedback: {
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    animated?: boolean;
  }): void {
    if (!this.visualFeedbackElement) return;

    // Clear existing classes
    this.visualFeedbackElement.className = 'visual-feedback';

    // Add type class
    this.visualFeedbackElement.classList.add(feedback.type);

    // Add animation class if needed
    if (feedback.animated) {
      this.visualFeedbackElement.classList.add('animated');
    }

    // Update content
    this.visualFeedbackElement.textContent = feedback.message;
  }

  /**
   * Update input indicator
   */
  private updateInputIndicator(message: string): void {
    if (this.inputIndicatorElement) {
      this.inputIndicatorElement.textContent = message;
    }
  }

  /**
   * Start listening for input
   */
  startListening(): void {
    this.conversationState.isActive = true;
    this.updateInputIndicator('Listening...');
    this.updateVisualFeedback({
      type: 'info',
      message: 'Listening for your voice',
      animated: true
    });
    this.emit('listeningStarted');
  }

  /**
   * Stop listening for input
   */
  stopListening(): void {
    this.conversationState.isActive = false;
    this.updateInputIndicator('Ready to listen');
    this.updateVisualFeedback({
      type: 'success',
      message: 'Ready to listen',
      animated: false
    });
    this.emit('listeningStopped');
  }

  /**
   * Show voice prompt to user
   */
  showPrompt(prompt: VoicePrompt): void {
    this.currentPrompt = prompt;

    this.updateVisualFeedback({
      type: 'info',
      message: prompt.message,
      animated: true
    });

    // Set timeout if specified
    if (prompt.timeout) {
      this.responseTimeout = setTimeout(() => {
        this.cancelPrompt();
        this.emit('promptTimeout', prompt);
      }, prompt.timeout);
    }

    this.emit('promptShown', prompt);
  }

  /**
   * Cancel current voice prompt
   */
  private cancelPrompt(): void {
    if (this.currentPrompt) {
      this.emit('promptCancelled', this.currentPrompt);
      this.currentPrompt = null;
    }

    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }

    this.updateVisualFeedback({
      type: 'info',
      message: 'Ready to listen',
      animated: false
    });
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationTurn[] {
    return [...this.conversationState.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearConversationHistory(): void {
    this.conversationState.conversationHistory = [];
    this.emit('conversationCleared');

    if (this.conversationHistoryElement) {
      this.conversationHistoryElement.innerHTML = '';
    }
  }

  /**
   * Update conversation settings
   */
  updateSettings(newSettings: Partial<ConversationalSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.emit('settingsUpdated', this.settings);
  }

  /**
   * Get current settings
   */
  getSettings(): ConversationalSettings {
    return { ...this.settings };
  }

  /**
   * Get current status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      active: this.conversationState.isActive,
      processing: this.isProcessing,
      historyLength: this.conversationState.conversationHistory.length,
      currentContext: this.conversationState.currentContext,
      awaitingConfirmation: this.conversationState.awaitingConfirmation,
      hasPrompt: this.currentPrompt !== null
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    try {
      this.cancelPrompt();

      if (this.responseTimeout) {
        clearTimeout(this.responseTimeout);
        this.responseTimeout = null;
      }

      this.isInitialized = false;
      this.isProcessing = false;
      this.conversationState.isActive = false;

      console.log('Conversational Interface destroyed');
    } catch (error) {
      console.error('Failed to destroy Conversational Interface:', error);
      throw error;
    }
  }
}