import { EventEmitter } from 'events';
import { VoiceSettings, AccessibilitySettings, ConversationState, ConversationTurn, VoicePrompt, VisualFeedback } from './types';

export class ConversationalInterface extends EventEmitter {
  private conversationState: ConversationState;
  private voiceSettings: VoiceSettings;
  private accessibilitySettings: AccessibilitySettings;
  private currentPrompt?: VoicePrompt;
  private conversationContainer?: HTMLElement;
  private visualFeedbackElement?: HTMLElement;

  constructor() {
    super();
    this.conversationState = {
      isListening: false,
      isProcessing: false,
      isResponding: false,
      awaitingConfirmation: false,
      conversationHistory: []
    };

    this.voiceSettings = {
      speed: 1.0,
      volume: 0.8,
      language: 'en-US',
      pitch: 1.0
    };

    this.accessibilitySettings = {
      largeText: false,
      highContrast: false,
      screenReader: false,
      voiceNavigation: true,
      reducedMotion: false,
      fontSize: 'large',
      contrastLevel: 'normal'
    };
  }

  /**
   * Initialize the conversational interface
   */
  public initialize(container: HTMLElement): void {
    this.conversationContainer = container;
    this.setupHomeScreen();
    this.setupEventListeners();
    this.applyAccessibilitySettings();
  }

  /**
   * Create minimal, conversation-focused home screen
   */
  private setupHomeScreen(): void {
    if (!this.conversationContainer) return;

    this.conversationContainer.innerHTML = `
      <div class="conversation-interface" role="main" aria-label="Voice Assistant Interface">
        <!-- Main conversation area -->
        <div class="conversation-area" role="log" aria-live="polite" aria-label="Conversation history">
          <div class="welcome-message" role="banner">
            <h1 class="welcome-title">Hello! How can I help you today?</h1>
            <p class="welcome-subtitle">Speak naturally or tap to type</p>
          </div>
          <div class="conversation-history" id="conversation-history"></div>
        </div>

        <!-- Visual feedback area -->
        <div class="visual-feedback" id="visual-feedback" role="status" aria-live="assertive">
          <div class="listening-indicator" aria-hidden="true">
            <div class="pulse-animation"></div>
          </div>
          <div class="status-text" id="status-text">Ready to listen</div>
        </div>

        <!-- Voice interaction controls -->
        <div class="voice-controls" role="toolbar" aria-label="Voice controls">
          <button 
            class="voice-button primary" 
            id="voice-button"
            aria-label="Start voice input"
            aria-describedby="voice-button-help"
          >
            <span class="voice-icon" aria-hidden="true">🎤</span>
            <span class="voice-text">Tap to speak</span>
          </button>
          <div id="voice-button-help" class="sr-only">
            Press and hold to speak, or tap once to start continuous listening
          </div>
        </div>

        <!-- Alternative input methods -->
        <div class="alternative-inputs" role="group" aria-label="Alternative input methods">
          <button 
            class="text-input-button" 
            id="text-input-button"
            aria-label="Switch to text input"
          >
            <span class="text-icon" aria-hidden="true">⌨️</span>
            <span class="text-label">Type instead</span>
          </button>
          
          <textarea 
            class="text-input hidden" 
            id="text-input"
            placeholder="Type your message here..."
            aria-label="Text input for voice alternative"
            rows="3"
          ></textarea>
          
          <button 
            class="send-text-button hidden" 
            id="send-text-button"
            aria-label="Send text message"
          >
            Send
          </button>
        </div>

        <!-- Quick actions for elderly users -->
        <div class="quick-actions" role="group" aria-label="Quick actions">
          <button class="quick-action" data-intent="emergency" aria-label="Emergency help">
            <span class="action-icon" aria-hidden="true">🚨</span>
            <span class="action-text">Emergency</span>
          </button>
          <button class="quick-action" data-intent="call-family" aria-label="Call family">
            <span class="action-icon" aria-hidden="true">👨‍👩‍👧‍👦</span>
            <span class="action-text">Call Family</span>
          </button>
          <button class="quick-action" data-intent="medication-reminder" aria-label="Medication reminder">
            <span class="action-icon" aria-hidden="true">💊</span>
            <span class="action-text">Medications</span>
          </button>
        </div>

        <!-- Settings and accessibility -->
        <div class="interface-settings" role="group" aria-label="Interface settings">
          <button 
            class="settings-button" 
            id="settings-button"
            aria-label="Open accessibility settings"
            aria-expanded="false"
            aria-controls="settings-panel"
          >
            <span class="settings-icon" aria-hidden="true">⚙️</span>
            <span class="settings-text">Settings</span>
          </button>
        </div>

        <!-- Hidden settings panel -->
        <div class="settings-panel hidden" id="settings-panel" role="dialog" aria-labelledby="settings-title">
          <h2 id="settings-title">Accessibility Settings</h2>
          <div class="settings-content">
            <!-- Settings content will be populated by accessibility manager -->
          </div>
        </div>
      </div>
    `;

    this.visualFeedbackElement = this.conversationContainer.querySelector('#visual-feedback') as HTMLElement;
    this.setupStyles();
  }

  /**
   * Setup CSS styles for the interface
   */
  private setupStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .conversation-interface {
        display: flex;
        flex-direction: column;
        height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--bg-primary, #ffffff);
        color: var(--text-primary, #333333);
        padding: 1rem;
        box-sizing: border-box;
      }

      .conversation-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        margin-bottom: 2rem;
      }

      .welcome-message {
        text-align: center;
        padding: 2rem 1rem;
        margin-bottom: 2rem;
      }

      .welcome-title {
        font-size: var(--font-size-xl, 2rem);
        font-weight: 600;
        margin: 0 0 1rem 0;
        line-height: 1.3;
      }

      .welcome-subtitle {
        font-size: var(--font-size-lg, 1.25rem);
        color: var(--text-secondary, #666666);
        margin: 0;
      }

      .conversation-history {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .conversation-turn {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
        border-radius: 0.5rem;
        background: var(--bg-secondary, #f5f5f5);
      }

      .user-message {
        align-self: flex-end;
        background: var(--accent-primary, #007AFF);
        color: white;
        max-width: 80%;
      }

      .system-message {
        align-self: flex-start;
        background: var(--bg-tertiary, #e5e5e5);
        max-width: 80%;
      }

      .visual-feedback {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1rem;
        margin-bottom: 1rem;
        min-height: 4rem;
      }

      .listening-indicator {
        width: 4rem;
        height: 4rem;
        border-radius: 50%;
        background: var(--accent-primary, #007AFF);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 0.5rem;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .listening-indicator.active {
        opacity: 1;
      }

      .pulse-animation {
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        background: white;
        animation: pulse 1.5s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.7; }
      }

      .status-text {
        font-size: var(--font-size-md, 1rem);
        color: var(--text-secondary, #666666);
        text-align: center;
      }

      .voice-controls {
        display: flex;
        justify-content: center;
        margin-bottom: 2rem;
      }

      .voice-button {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1.5rem 2rem;
        border: none;
        border-radius: 1rem;
        background: var(--accent-primary, #007AFF);
        color: white;
        font-size: var(--font-size-lg, 1.25rem);
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 8rem;
        min-height: 6rem;
      }

      .voice-button:hover {
        background: var(--accent-primary-hover, #0056CC);
        transform: translateY(-2px);
      }

      .voice-button:active {
        transform: translateY(0);
      }

      .voice-button.listening {
        background: var(--accent-secondary, #FF3B30);
        animation: pulse-button 1s ease-in-out infinite;
      }

      @keyframes pulse-button {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      .voice-icon {
        font-size: 2rem;
      }

      .alternative-inputs {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .text-input-button {
        align-self: center;
        padding: 0.75rem 1.5rem;
        border: 2px solid var(--border-primary, #cccccc);
        border-radius: 0.5rem;
        background: transparent;
        color: var(--text-primary, #333333);
        font-size: var(--font-size-md, 1rem);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .text-input {
        width: 100%;
        padding: 1rem;
        border: 2px solid var(--border-primary, #cccccc);
        border-radius: 0.5rem;
        font-size: var(--font-size-lg, 1.25rem);
        resize: vertical;
        min-height: 3rem;
      }

      .text-input:focus {
        outline: none;
        border-color: var(--accent-primary, #007AFF);
      }

      .send-text-button {
        align-self: flex-end;
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 0.5rem;
        background: var(--accent-primary, #007AFF);
        color: white;
        font-size: var(--font-size-md, 1rem);
        cursor: pointer;
      }

      .quick-actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .quick-action {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem;
        border: 2px solid var(--border-primary, #cccccc);
        border-radius: 0.75rem;
        background: var(--bg-secondary, #f5f5f5);
        color: var(--text-primary, #333333);
        font-size: var(--font-size-sm, 0.875rem);
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .quick-action:hover {
        background: var(--bg-tertiary, #e5e5e5);
        transform: translateY(-1px);
      }

      .action-icon {
        font-size: 1.5rem;
      }

      .interface-settings {
        display: flex;
        justify-content: center;
      }

      .settings-button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        border: 1px solid var(--border-primary, #cccccc);
        border-radius: 0.5rem;
        background: transparent;
        color: var(--text-secondary, #666666);
        font-size: var(--font-size-sm, 0.875rem);
        cursor: pointer;
      }

      .settings-panel {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--bg-primary, #ffffff);
        z-index: 1000;
        padding: 2rem;
        overflow-y: auto;
      }

      .hidden {
        display: none !important;
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      /* High contrast mode */
      .high-contrast {
        --bg-primary: #000000;
        --bg-secondary: #1a1a1a;
        --bg-tertiary: #333333;
        --text-primary: #ffffff;
        --text-secondary: #cccccc;
        --border-primary: #ffffff;
        --accent-primary: #ffff00;
        --accent-primary-hover: #cccc00;
      }

      /* Large text mode */
      .large-text {
        --font-size-sm: 1.125rem;
        --font-size-md: 1.5rem;
        --font-size-lg: 1.875rem;
        --font-size-xl: 2.5rem;
      }

      /* Extra large text mode */
      .extra-large-text {
        --font-size-sm: 1.375rem;
        --font-size-md: 1.75rem;
        --font-size-lg: 2.25rem;
        --font-size-xl: 3rem;
      }

      /* Reduced motion */
      .reduced-motion * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup event listeners for user interactions
   */
  private setupEventListeners(): void {
    if (!this.conversationContainer) return;

    // Voice button interactions
    const voiceButton = this.conversationContainer.querySelector('#voice-button') as HTMLButtonElement;
    if (voiceButton) {
      voiceButton.addEventListener('click', () => this.handleVoiceButtonClick());
      voiceButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleVoiceButtonClick();
        }
      });
    }

    // Text input toggle
    const textInputButton = this.conversationContainer.querySelector('#text-input-button') as HTMLButtonElement;
    const textInput = this.conversationContainer.querySelector('#text-input') as HTMLTextAreaElement;
    const sendTextButton = this.conversationContainer.querySelector('#send-text-button') as HTMLButtonElement;

    if (textInputButton && textInput && sendTextButton) {
      textInputButton.addEventListener('click', () => this.toggleTextInput());
      sendTextButton.addEventListener('click', () => this.handleTextSubmit());
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleTextSubmit();
        }
      });
    }

    // Quick actions
    const quickActions = this.conversationContainer.querySelectorAll('.quick-action');
    quickActions.forEach(action => {
      action.addEventListener('click', (e) => {
        const intent = (e.currentTarget as HTMLElement).dataset.intent;
        if (intent) {
          this.handleQuickAction(intent);
        }
      });
    });

    // Settings button
    const settingsButton = this.conversationContainer.querySelector('#settings-button') as HTMLButtonElement;
    if (settingsButton) {
      settingsButton.addEventListener('click', () => this.toggleSettings());
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
  }

  /**
   * Handle voice button click/activation
   */
  private handleVoiceButtonClick(): void {
    if (this.conversationState.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  /**
   * Start voice listening
   */
  public startListening(): void {
    this.conversationState.isListening = true;
    this.updateVisualFeedback({
      type: 'listening',
      message: 'Listening... Speak now',
      animated: true
    });

    const voiceButton = this.conversationContainer?.querySelector('#voice-button') as HTMLButtonElement;
    if (voiceButton) {
      voiceButton.classList.add('listening');
      voiceButton.querySelector('.voice-text')!.textContent = 'Listening...';
      voiceButton.setAttribute('aria-label', 'Stop listening');
    }

    this.emit('startListening');
  }

  /**
   * Stop voice listening
   */
  public stopListening(): void {
    this.conversationState.isListening = false;
    this.updateVisualFeedback({
      type: 'processing',
      message: 'Processing your request...',
      animated: true
    });

    const voiceButton = this.conversationContainer?.querySelector('#voice-button') as HTMLButtonElement;
    if (voiceButton) {
      voiceButton.classList.remove('listening');
      voiceButton.querySelector('.voice-text')!.textContent = 'Tap to speak';
      voiceButton.setAttribute('aria-label', 'Start voice input');
    }

    this.emit('stopListening');
  }

  /**
   * Toggle text input visibility
   */
  private toggleTextInput(): void {
    const textInput = this.conversationContainer?.querySelector('#text-input') as HTMLTextAreaElement;
    const sendButton = this.conversationContainer?.querySelector('#send-text-button') as HTMLButtonElement;
    const toggleButton = this.conversationContainer?.querySelector('#text-input-button') as HTMLButtonElement;

    if (textInput && sendButton && toggleButton) {
      const isHidden = textInput.classList.contains('hidden');
      
      if (isHidden) {
        textInput.classList.remove('hidden');
        sendButton.classList.remove('hidden');
        toggleButton.textContent = 'Use voice instead';
        textInput.focus();
      } else {
        textInput.classList.add('hidden');
        sendButton.classList.add('hidden');
        toggleButton.innerHTML = `
          <span class="text-icon" aria-hidden="true">⌨️</span>
          <span class="text-label">Type instead</span>
        `;
      }
    }
  }

  /**
   * Handle text input submission
   */
  private handleTextSubmit(): void {
    const textInput = this.conversationContainer?.querySelector('#text-input') as HTMLTextAreaElement;
    if (textInput && textInput.value.trim()) {
      const message = textInput.value.trim();
      textInput.value = '';
      this.processUserInput(message, 'text');
    }
  }

  /**
   * Handle quick action selection
   */
  private handleQuickAction(intent: string): void {
    this.emit('quickAction', { intent });
    this.addConversationTurn(`Quick action: ${intent}`, 'Processing your request...', intent, 1.0);
  }

  /**
   * Process user input (voice or text)
   */
  public processUserInput(input: string, method: 'voice' | 'text'): void {
    this.conversationState.isProcessing = true;
    this.updateVisualFeedback({
      type: 'processing',
      message: 'Understanding your request...',
      animated: true
    });

    this.emit('userInput', { input, method });
  }

  /**
   * Add a conversation turn to the history
   */
  public addConversationTurn(userInput: string, systemResponse: string, intent?: string, confidence?: number): void {
    const turn: ConversationTurn = {
      id: Date.now().toString(),
      timestamp: new Date(),
      userInput,
      systemResponse,
      intent,
      confidence,
      success: true
    };

    this.conversationState.conversationHistory.push(turn);
    this.renderConversationTurn(turn);
  }

  /**
   * Render a conversation turn in the UI
   */
  private renderConversationTurn(turn: ConversationTurn): void {
    const historyContainer = this.conversationContainer?.querySelector('#conversation-history');
    if (!historyContainer) return;

    const turnElement = document.createElement('div');
    turnElement.className = 'conversation-turn';
    turnElement.innerHTML = `
      <div class="user-message" role="log">
        <strong>You:</strong> ${this.escapeHtml(turn.userInput)}
      </div>
      <div class="system-message" role="log">
        <strong>Assistant:</strong> ${this.escapeHtml(turn.systemResponse)}
        ${turn.confidence ? `<span class="confidence">(${Math.round(turn.confidence * 100)}% confident)</span>` : ''}
      </div>
    `;

    historyContainer.appendChild(turnElement);
    turnElement.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Update visual feedback display
   */
  public updateVisualFeedback(feedback: VisualFeedback): void {
    if (!this.visualFeedbackElement) return;

    const indicator = this.visualFeedbackElement.querySelector('.listening-indicator') as HTMLElement;
    const statusText = this.visualFeedbackElement.querySelector('#status-text') as HTMLElement;

    // Update indicator visibility and animation
    if (feedback.animated) {
      indicator.classList.add('active');
    } else {
      indicator.classList.remove('active');
    }

    // Update status text
    if (statusText && feedback.message) {
      statusText.textContent = feedback.message;
    }

    // Update state
    this.conversationState.isListening = feedback.type === 'listening';
    this.conversationState.isProcessing = feedback.type === 'processing';
    this.conversationState.isResponding = feedback.type === 'speaking';
  }

  /**
   * Show voice prompt for confirmation or clarification
   */
  public showVoicePrompt(prompt: VoicePrompt): void {
    this.currentPrompt = prompt;
    this.conversationState.awaitingConfirmation = true;

    // Add prompt to conversation
    this.addConversationTurn('', prompt.text, prompt.id);

    // Emit prompt event for voice synthesis
    this.emit('voicePrompt', prompt);
  }

  /**
   * Handle keyboard navigation for accessibility
   */
  private handleKeyboardNavigation(event: KeyboardEvent): void {
    // Space bar to activate voice input
    if (event.code === 'Space' && event.target === document.body) {
      event.preventDefault();
      this.handleVoiceButtonClick();
    }

    // Escape to cancel current operation
    if (event.key === 'Escape') {
      if (this.conversationState.isListening) {
        this.stopListening();
      }
      if (this.conversationState.awaitingConfirmation) {
        this.cancelPrompt();
      }
    }
  }

  /**
   * Cancel current voice prompt
   */
  private cancelPrompt(): void {
    this.currentPrompt = undefined;
    this.conversationState.awaitingConfirmation = false;
    this.updateVisualFeedback({
      type: 'success',
      message: 'Ready to listen',
      animated: false
    });
  }

  /**
   * Toggle settings panel
   */
  private toggleSettings(): void {
    const settingsPanel = this.conversationContainer?.querySelector('#settings-panel') as HTMLElement;
    const settingsButton = this.conversationContainer?.querySelector('#settings-button') as HTMLButtonElement;
    
    if (settingsPanel && settingsButton) {
      const isHidden = settingsPanel.classList.contains('hidden');
      
      if (isHidden) {
        settingsPanel.classList.remove('hidden');
        settingsButton.setAttribute('aria-expanded', 'true');
        this.emit('settingsOpened');
      } else {
        settingsPanel.classList.add('hidden');
        settingsButton.setAttribute('aria-expanded', 'false');
      }
    }
  }

  /**
   * Apply accessibility settings to the interface
   */
  public applyAccessibilitySettings(): void {
    if (!this.conversationContainer) return;

    const container = this.conversationContainer;

    // Remove existing accessibility classes
    container.classList.remove('high-contrast', 'large-text', 'extra-large-text', 'reduced-motion');

    // Apply current settings
    if (this.accessibilitySettings.highContrast) {
      container.classList.add('high-contrast');
    }

    if (this.accessibilitySettings.fontSize === 'large') {
      container.classList.add('large-text');
    } else if (this.accessibilitySettings.fontSize === 'extra-large') {
      container.classList.add('extra-large-text');
    }

    if (this.accessibilitySettings.reducedMotion) {
      container.classList.add('reduced-motion');
    }
  }

  /**
   * Update accessibility settings
   */
  public updateAccessibilitySettings(settings: Partial<AccessibilitySettings>): void {
    this.accessibilitySettings = { ...this.accessibilitySettings, ...settings };
    this.applyAccessibilitySettings();
    this.emit('accessibilitySettingsChanged', this.accessibilitySettings);
  }

  /**
   * Update voice settings
   */
  public updateVoiceSettings(settings: Partial<VoiceSettings>): void {
    this.voiceSettings = { ...this.voiceSettings, ...settings };
    this.emit('voiceSettingsChanged', this.voiceSettings);
  }

  /**
   * Get current conversation state
   */
  public getConversationState(): ConversationState {
    return { ...this.conversationState };
  }

  /**
   * Get current accessibility settings
   */
  public getAccessibilitySettings(): AccessibilitySettings {
    return { ...this.accessibilitySettings };
  }

  /**
   * Get current voice settings
   */
  public getVoiceSettings(): VoiceSettings {
    return { ...this.voiceSettings };
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Cleanup and destroy the interface
   */
  public destroy(): void {
    if (this.conversationContainer) {
      this.conversationContainer.innerHTML = '';
    }
    this.removeAllListeners();
  }
}