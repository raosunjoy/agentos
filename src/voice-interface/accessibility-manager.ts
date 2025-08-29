import { EventEmitter } from 'events';
import { AccessibilitySettings, InputMethod } from './types';

export class AccessibilityManager extends EventEmitter {
  private settings: AccessibilitySettings;
  private inputMethods: Map<string, InputMethod>;
  private screenReaderActive: boolean = false;
  private keyboardNavigationEnabled: boolean = true;
  private focusTracker: HTMLElement | null = null;

  constructor() {
    super();
    
    this.settings = {
      largeText: false,
      highContrast: false,
      screenReader: false,
      voiceNavigation: true,
      reducedMotion: false,
      fontSize: 'large',
      contrastLevel: 'normal'
    };

    this.inputMethods = new Map([
      ['voice', { type: 'voice', enabled: true }],
      ['text', { type: 'text', enabled: true }],
      ['gesture', { type: 'gesture', enabled: false }],
      ['switch', { type: 'switch', enabled: false }],
      ['eye-tracking', { type: 'eye-tracking', enabled: false }]
    ]);

    this.detectSystemAccessibilitySettings();
    this.setupKeyboardNavigation();
    this.setupScreenReaderSupport();
  }

  /**
   * Initialize accessibility features for a container
   */
  public initialize(container: HTMLElement): void {
    this.setupAccessibilityAttributes(container);
    this.setupFocusManagement(container);
    this.setupAlternativeInputs(container);
    this.createAccessibilityPanel(container);
    this.applySettings(container);
  }

  /**
   * Detect system-level accessibility settings
   */
  private detectSystemAccessibilitySettings(): void {
    // Detect high contrast preference
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      this.settings.highContrast = true;
      this.settings.contrastLevel = 'high';
    }

    // Detect reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.settings.reducedMotion = true;
    }

    // Detect large text preference
    if (window.matchMedia('(min-resolution: 2dppx)').matches) {
      this.settings.largeText = true;
    }

    // Listen for changes
    window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
      this.updateSetting('highContrast', e.matches);
    });

    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.updateSetting('reducedMotion', e.matches);
    });
  }

  /**
   * Setup comprehensive accessibility attributes
   */
  private setupAccessibilityAttributes(container: HTMLElement): void {
    // Ensure proper ARIA landmarks
    const elements = container.querySelectorAll('*');
    elements.forEach(element => {
      const htmlElement = element as HTMLElement;
      
      // Add missing labels
      if (htmlElement.tagName === 'BUTTON' && !htmlElement.getAttribute('aria-label') && !htmlElement.textContent?.trim()) {
        htmlElement.setAttribute('aria-label', 'Button');
      }

      // Ensure interactive elements are keyboard accessible
      if (this.isInteractiveElement(htmlElement) && !htmlElement.hasAttribute('tabindex')) {
        htmlElement.setAttribute('tabindex', '0');
      }

      // Add role descriptions for complex elements
      if (htmlElement.classList.contains('voice-button')) {
        htmlElement.setAttribute('role', 'button');
        htmlElement.setAttribute('aria-describedby', 'voice-button-help');
      }
    });

    // Add skip links for keyboard navigation
    this.addSkipLinks(container);
  }

  /**
   * Add skip navigation links
   */
  private addSkipLinks(container: HTMLElement): void {
    const skipLinks = document.createElement('div');
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <a href="#voice-controls" class="skip-link">Skip to voice controls</a>
      <a href="#settings" class="skip-link">Skip to settings</a>
    `;

    // Add skip link styles
    const style = document.createElement('style');
    style.textContent = `
      .skip-links {
        position: absolute;
        top: -100px;
        left: 0;
        z-index: 9999;
      }
      
      .skip-link {
        position: absolute;
        top: -100px;
        left: 0;
        background: var(--accent-primary, #007AFF);
        color: white;
        padding: 0.5rem 1rem;
        text-decoration: none;
        border-radius: 0 0 0.25rem 0;
        font-weight: bold;
      }
      
      .skip-link:focus {
        top: 0;
      }
    `;
    
    document.head.appendChild(style);
    container.insertBefore(skipLinks, container.firstChild);
  }

  /**
   * Setup keyboard navigation
   */
  private setupKeyboardNavigation(): void {
    document.addEventListener('keydown', (event) => {
      if (!this.keyboardNavigationEnabled) return;

      switch (event.key) {
        case 'Tab':
          this.handleTabNavigation(event);
          break;
        case 'Enter':
        case ' ':
          this.handleActivation(event);
          break;
        case 'Escape':
          this.handleEscape(event);
          break;
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          this.handleArrowNavigation(event);
          break;
      }
    });

    // Track focus for screen reader announcements
    document.addEventListener('focusin', (event) => {
      this.focusTracker = event.target as HTMLElement;
      this.announceFocusChange(this.focusTracker);
    });
  }

  /**
   * Handle tab navigation with proper focus management
   */
  private handleTabNavigation(event: KeyboardEvent): void {
    const focusableElements = this.getFocusableElements();
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
    
    if (event.shiftKey) {
      // Shift+Tab - go backwards
      if (currentIndex <= 0) {
        event.preventDefault();
        focusableElements[focusableElements.length - 1]?.focus();
      }
    } else {
      // Tab - go forwards
      if (currentIndex >= focusableElements.length - 1) {
        event.preventDefault();
        focusableElements[0]?.focus();
      }
    }
  }

  /**
   * Handle activation keys (Enter/Space)
   */
  private handleActivation(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    
    if (this.isInteractiveElement(target)) {
      event.preventDefault();
      target.click();
    }
  }

  /**
   * Handle escape key
   */
  private handleEscape(event: KeyboardEvent): void {
    // Close any open dialogs or panels
    const openDialogs = document.querySelectorAll('[role="dialog"]:not(.hidden)');
    openDialogs.forEach(dialog => {
      (dialog as HTMLElement).classList.add('hidden');
    });

    // Return focus to main content
    const mainContent = document.querySelector('[role="main"]') as HTMLElement;
    if (mainContent) {
      mainContent.focus();
    }

    this.emit('escapePressed');
  }

  /**
   * Handle arrow key navigation
   */
  private handleArrowNavigation(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    
    // Handle grid navigation for quick actions
    if (target && typeof target.closest === 'function' && target.closest('.quick-actions')) {
      event.preventDefault();
      this.navigateGrid(event.key, target);
    }
  }

  /**
   * Navigate grid layouts with arrow keys
   */
  private navigateGrid(direction: string, currentElement: HTMLElement): void {
    const grid = currentElement.closest('.quick-actions');
    if (!grid) return;

    const items = Array.from(grid.querySelectorAll('.quick-action')) as HTMLElement[];
    const currentIndex = items.indexOf(currentElement);
    const columns = 3; // Assuming 3 columns in grid
    
    let newIndex = currentIndex;
    
    switch (direction) {
      case 'ArrowLeft':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowRight':
        newIndex = Math.min(items.length - 1, currentIndex + 1);
        break;
      case 'ArrowUp':
        newIndex = Math.max(0, currentIndex - columns);
        break;
      case 'ArrowDown':
        newIndex = Math.min(items.length - 1, currentIndex + columns);
        break;
    }
    
    if (newIndex !== currentIndex && items[newIndex]) {
      items[newIndex].focus();
    }
  }

  /**
   * Setup screen reader support
   */
  private setupScreenReaderSupport(): void {
    // Detect if screen reader is active
    this.detectScreenReader();

    // Create live regions for announcements
    this.createLiveRegions();

    // Setup ARIA live announcements
    this.setupLiveAnnouncements();
  }

  /**
   * Detect screen reader presence
   */
  private detectScreenReader(): void {
    // Check for common screen reader indicators
    const hasScreenReader = 
      navigator.userAgent.includes('NVDA') ||
      navigator.userAgent.includes('JAWS') ||
      navigator.userAgent.includes('VoiceOver') ||
      window.speechSynthesis?.getVoices().length > 0;

    if (hasScreenReader) {
      this.screenReaderActive = true;
      this.settings.screenReader = true;
      this.emit('screenReaderDetected');
    }
  }

  /**
   * Create ARIA live regions for announcements
   */
  private createLiveRegions(): void {
    // Polite announcements (don't interrupt)
    const politeRegion = document.createElement('div');
    politeRegion.id = 'aria-live-polite';
    politeRegion.setAttribute('aria-live', 'polite');
    politeRegion.setAttribute('aria-atomic', 'true');
    politeRegion.className = 'sr-only';
    document.body.appendChild(politeRegion);

    // Assertive announcements (interrupt current speech)
    const assertiveRegion = document.createElement('div');
    assertiveRegion.id = 'aria-live-assertive';
    assertiveRegion.setAttribute('aria-live', 'assertive');
    assertiveRegion.setAttribute('aria-atomic', 'true');
    assertiveRegion.className = 'sr-only';
    document.body.appendChild(assertiveRegion);

    // Status announcements
    const statusRegion = document.createElement('div');
    statusRegion.id = 'aria-live-status';
    statusRegion.setAttribute('role', 'status');
    statusRegion.setAttribute('aria-live', 'polite');
    statusRegion.className = 'sr-only';
    document.body.appendChild(statusRegion);
  }

  /**
   * Setup live announcements for screen readers
   */
  private setupLiveAnnouncements(): void {
    // Announce page changes
    this.on('pageChanged', (page: string) => {
      this.announce(`Navigated to ${page}`, 'polite');
    });

    // Announce status changes
    this.on('statusChanged', (status: string) => {
      this.announce(status, 'status');
    });

    // Announce errors
    this.on('error', (error: string) => {
      this.announce(`Error: ${error}`, 'assertive');
    });
  }

  /**
   * Announce text to screen readers
   */
  public announce(text: string, priority: 'polite' | 'assertive' | 'status' = 'polite'): void {
    const regionId = `aria-live-${priority}`;
    const region = document.getElementById(regionId);
    
    if (region) {
      // Clear and set new text
      region.textContent = '';
      setTimeout(() => {
        region.textContent = text;
      }, 100);
    }

    this.emit('announced', { text, priority });
  }

  /**
   * Setup focus management
   */
  private setupFocusManagement(container: HTMLElement): void {
    // Ensure proper focus indicators
    const style = document.createElement('style');
    style.textContent = `
      *:focus {
        outline: 3px solid var(--accent-primary, #007AFF);
        outline-offset: 2px;
      }
      
      .high-contrast *:focus {
        outline: 4px solid #ffff00;
        outline-offset: 3px;
      }
      
      .focus-visible {
        outline: 3px solid var(--accent-primary, #007AFF);
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);

    // Setup focus trapping for modals
    this.setupFocusTrapping(container);
  }

  /**
   * Setup focus trapping for modal dialogs
   */
  private setupFocusTrapping(container: HTMLElement): void {
    const dialogs = container.querySelectorAll('[role="dialog"]');
    
    dialogs.forEach(dialog => {
      dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
          this.trapFocus(event, dialog as HTMLElement);
        }
      });
    });
  }

  /**
   * Trap focus within a container
   */
  private trapFocus(event: KeyboardEvent, container: HTMLElement): void {
    const focusableElements = this.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }

  /**
   * Setup alternative input methods
   */
  private setupAlternativeInputs(container: HTMLElement): void {
    // Switch control support
    this.setupSwitchControl(container);
    
    // Gesture support
    this.setupGestureControl(container);
    
    // Eye tracking support (if available)
    this.setupEyeTracking(container);
  }

  /**
   * Setup switch control for motor disabilities
   */
  private setupSwitchControl(container: HTMLElement): void {
    let switchIndex = 0;
    const switchElements = this.getFocusableElements(container);

    // Listen for switch inputs (space bar or custom switch)
    document.addEventListener('keydown', (event) => {
      if (!this.inputMethods.get('switch')?.enabled) return;

      if (event.code === 'Space' && event.ctrlKey) {
        event.preventDefault();
        this.activateSwitchElement(switchElements[switchIndex]);
      } else if (event.code === 'ArrowRight' && event.ctrlKey) {
        event.preventDefault();
        switchIndex = (switchIndex + 1) % switchElements.length;
        this.highlightSwitchElement(switchElements[switchIndex]);
      }
    });
  }

  /**
   * Activate element via switch control
   */
  private activateSwitchElement(element: HTMLElement): void {
    element.focus();
    element.click();
    this.announce(`Activated ${this.getElementDescription(element)}`, 'assertive');
  }

  /**
   * Highlight element for switch control
   */
  private highlightSwitchElement(element: HTMLElement): void {
    // Remove previous highlights
    document.querySelectorAll('.switch-highlight').forEach(el => {
      el.classList.remove('switch-highlight');
    });

    // Add highlight to current element
    element.classList.add('switch-highlight');
    
    // Only call scrollIntoView if it exists (not in all test environments)
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    this.announce(`Focused on ${this.getElementDescription(element)}`, 'polite');
  }

  /**
   * Setup gesture control
   */
  private setupGestureControl(container: HTMLElement): void {
    if (!this.inputMethods.get('gesture')?.enabled) return;

    let touchStartX = 0;
    let touchStartY = 0;

    container.addEventListener('touchstart', (event) => {
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    });

    container.addEventListener('touchend', (event) => {
      const touchEndX = event.changedTouches[0].clientX;
      const touchEndY = event.changedTouches[0].clientY;
      
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      
      // Detect swipe gestures
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (Math.abs(deltaX) > 50) {
          if (deltaX > 0) {
            this.handleGesture('swipe-right');
          } else {
            this.handleGesture('swipe-left');
          }
        }
      } else {
        if (Math.abs(deltaY) > 50) {
          if (deltaY > 0) {
            this.handleGesture('swipe-down');
          } else {
            this.handleGesture('swipe-up');
          }
        }
      }
    });
  }

  /**
   * Handle gesture input
   */
  private handleGesture(gesture: string): void {
    switch (gesture) {
      case 'swipe-right':
        this.emit('gesture', { type: 'swipe-right', action: 'next' });
        break;
      case 'swipe-left':
        this.emit('gesture', { type: 'swipe-left', action: 'previous' });
        break;
      case 'swipe-up':
        this.emit('gesture', { type: 'swipe-up', action: 'scroll-up' });
        break;
      case 'swipe-down':
        this.emit('gesture', { type: 'swipe-down', action: 'scroll-down' });
        break;
    }
  }

  /**
   * Setup eye tracking (placeholder for future implementation)
   */
  private setupEyeTracking(container: HTMLElement): void {
    // Placeholder for eye tracking integration
    // This would integrate with eye tracking hardware/software
    if (this.inputMethods.get('eye-tracking')?.enabled) {
      this.emit('eyeTrackingSetup', container);
    }
  }

  /**
   * Create accessibility settings panel
   */
  private createAccessibilityPanel(container: HTMLElement): void {
    const settingsPanel = container.querySelector('#settings-panel .settings-content');
    if (!settingsPanel) return;

    settingsPanel.innerHTML = `
      <div class="accessibility-settings" role="group" aria-labelledby="accessibility-title">
        <h3 id="accessibility-title">Accessibility Settings</h3>
        
        <div class="setting-group" role="group" aria-labelledby="visual-title">
          <h4 id="visual-title">Visual Settings</h4>
          
          <label class="setting-item">
            <input type="checkbox" id="large-text" ${this.settings.largeText ? 'checked' : ''}>
            <span>Large text</span>
          </label>
          
          <label class="setting-item">
            <input type="checkbox" id="high-contrast" ${this.settings.highContrast ? 'checked' : ''}>
            <span>High contrast</span>
          </label>
          
          <label class="setting-item">
            <span>Font size:</span>
            <select id="font-size" aria-label="Font size">
              <option value="medium" ${this.settings.fontSize === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="large" ${this.settings.fontSize === 'large' ? 'selected' : ''}>Large</option>
              <option value="extra-large" ${this.settings.fontSize === 'extra-large' ? 'selected' : ''}>Extra Large</option>
            </select>
          </label>
        </div>
        
        <div class="setting-group" role="group" aria-labelledby="motion-title">
          <h4 id="motion-title">Motion Settings</h4>
          
          <label class="setting-item">
            <input type="checkbox" id="reduced-motion" ${this.settings.reducedMotion ? 'checked' : ''}>
            <span>Reduce motion</span>
          </label>
        </div>
        
        <div class="setting-group" role="group" aria-labelledby="input-title">
          <h4 id="input-title">Input Methods</h4>
          
          <label class="setting-item">
            <input type="checkbox" id="voice-navigation" ${this.settings.voiceNavigation ? 'checked' : ''}>
            <span>Voice navigation</span>
          </label>
          
          <label class="setting-item">
            <input type="checkbox" id="switch-control" ${this.inputMethods.get('switch')?.enabled ? 'checked' : ''}>
            <span>Switch control</span>
          </label>
          
          <label class="setting-item">
            <input type="checkbox" id="gesture-control" ${this.inputMethods.get('gesture')?.enabled ? 'checked' : ''}>
            <span>Gesture control</span>
          </label>
        </div>
        
        <div class="setting-actions">
          <button type="button" id="test-settings" class="test-button">
            Test Settings
          </button>
          <button type="button" id="reset-settings" class="reset-button">
            Reset to Defaults
          </button>
        </div>
      </div>
    `;

    this.setupSettingsEventListeners(settingsPanel as HTMLElement);
  }

  /**
   * Setup event listeners for settings panel
   */
  private setupSettingsEventListeners(panel: HTMLElement): void {
    // Visual settings
    panel.querySelector('#large-text')?.addEventListener('change', (e) => {
      this.updateSetting('largeText', (e.target as HTMLInputElement).checked);
    });

    panel.querySelector('#high-contrast')?.addEventListener('change', (e) => {
      this.updateSetting('highContrast', (e.target as HTMLInputElement).checked);
    });

    panel.querySelector('#font-size')?.addEventListener('change', (e) => {
      this.updateSetting('fontSize', (e.target as HTMLSelectElement).value as any);
    });

    panel.querySelector('#reduced-motion')?.addEventListener('change', (e) => {
      this.updateSetting('reducedMotion', (e.target as HTMLInputElement).checked);
    });

    // Input method settings
    panel.querySelector('#voice-navigation')?.addEventListener('change', (e) => {
      this.updateSetting('voiceNavigation', (e.target as HTMLInputElement).checked);
    });

    panel.querySelector('#switch-control')?.addEventListener('change', (e) => {
      this.updateInputMethod('switch', (e.target as HTMLInputElement).checked);
    });

    panel.querySelector('#gesture-control')?.addEventListener('change', (e) => {
      this.updateInputMethod('gesture', (e.target as HTMLInputElement).checked);
    });

    // Action buttons
    panel.querySelector('#test-settings')?.addEventListener('click', () => {
      this.testAccessibilitySettings();
    });

    panel.querySelector('#reset-settings')?.addEventListener('click', () => {
      this.resetToDefaults();
    });
  }

  /**
   * Update a specific accessibility setting
   */
  public updateSetting<K extends keyof AccessibilitySettings>(
    key: K, 
    value: AccessibilitySettings[K]
  ): void {
    this.settings[key] = value;
    this.emit('settingChanged', { key, value });
    this.applySettings();
  }

  /**
   * Update input method availability
   */
  public updateInputMethod(method: string, enabled: boolean): void {
    const inputMethod = this.inputMethods.get(method);
    if (inputMethod) {
      inputMethod.enabled = enabled;
      this.emit('inputMethodChanged', { method, enabled });
    }
  }

  /**
   * Apply current accessibility settings
   */
  public applySettings(container?: HTMLElement): void {
    const target = container || document.body;
    
    // Apply visual settings
    target.classList.toggle('large-text', this.settings.largeText);
    target.classList.toggle('high-contrast', this.settings.highContrast);
    target.classList.toggle('reduced-motion', this.settings.reducedMotion);
    
    // Apply font size
    target.classList.remove('medium-text', 'large-text', 'extra-large-text');
    target.classList.add(`${this.settings.fontSize}-text`);

    this.emit('settingsApplied', this.settings);
  }

  /**
   * Test accessibility settings
   */
  private testAccessibilitySettings(): void {
    this.announce('Testing accessibility settings. You should hear this announcement.', 'assertive');
    
    // Test visual feedback
    const testElement = document.createElement('div');
    testElement.textContent = 'Test element for visual settings';
    testElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--accent-primary);
      color: white;
      padding: 1rem;
      border-radius: 0.5rem;
      z-index: 9999;
    `;
    
    document.body.appendChild(testElement);
    
    setTimeout(() => {
      document.body.removeChild(testElement);
      this.announce('Accessibility test completed', 'polite');
    }, 3000);
  }

  /**
   * Reset settings to defaults
   */
  private resetToDefaults(): void {
    this.settings = {
      largeText: false,
      highContrast: false,
      screenReader: this.screenReaderActive,
      voiceNavigation: true,
      reducedMotion: false,
      fontSize: 'large',
      contrastLevel: 'normal'
    };

    this.inputMethods.forEach(method => {
      if (method.type !== 'voice' && method.type !== 'text') {
        method.enabled = false;
      }
    });

    this.applySettings();
    this.emit('settingsReset');
    this.announce('Settings reset to defaults', 'polite');
  }

  /**
   * Get all focusable elements
   */
  private getFocusableElements(container: HTMLElement = document.body): HTMLElement[] {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
  }

  /**
   * Check if element is interactive
   */
  private isInteractiveElement(element: HTMLElement): boolean {
    if (!element || typeof element.hasAttribute !== 'function') {
      return false;
    }
    
    const interactiveTags = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'];
    return interactiveTags.includes(element.tagName) || 
           element.hasAttribute('tabindex') ||
           element.hasAttribute('role');
  }

  /**
   * Get description of element for announcements
   */
  private getElementDescription(element: HTMLElement): string {
    return element.getAttribute('aria-label') ||
           element.getAttribute('title') ||
           element.textContent?.trim() ||
           element.tagName.toLowerCase();
  }

  /**
   * Announce focus changes to screen readers
   */
  private announceFocusChange(element: HTMLElement): void {
    if (!this.screenReaderActive) return;

    const description = this.getElementDescription(element);
    const role = element.getAttribute('role') || element.tagName.toLowerCase();
    
    this.announce(`${description}, ${role}`, 'polite');
  }

  /**
   * Get current accessibility settings
   */
  public getSettings(): AccessibilitySettings {
    return { ...this.settings };
  }

  /**
   * Get available input methods
   */
  public getInputMethods(): Map<string, InputMethod> {
    return new Map(this.inputMethods);
  }

  /**
   * Check if screen reader is active
   */
  public isScreenReaderActive(): boolean {
    return this.screenReaderActive;
  }

  /**
   * Cleanup and destroy
   */
  public destroy(): void {
    this.removeAllListeners();
    
    // Remove live regions
    document.getElementById('aria-live-polite')?.remove();
    document.getElementById('aria-live-assertive')?.remove();
    document.getElementById('aria-live-status')?.remove();
  }
}