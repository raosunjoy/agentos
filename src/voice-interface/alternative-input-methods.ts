import { EventEmitter } from 'events';
import { InputMethod } from './types';

export interface GestureEvent {
  type: 'swipe' | 'tap' | 'pinch' | 'rotate';
  direction?: 'up' | 'down' | 'left' | 'right';
  fingers?: number;
  distance?: number;
  angle?: number;
  target: HTMLElement;
}

export interface SwitchControlConfig {
  enabled: boolean;
  scanRate: number; // milliseconds
  activationKey: string;
  nextKey: string;
  previousKey: string;
  autoScan: boolean;
}

export interface EyeTrackingConfig {
  enabled: boolean;
  dwellTime: number; // milliseconds
  calibrationRequired: boolean;
}

export class AlternativeInputMethods extends EventEmitter {
  private inputMethods: Map<string, InputMethod>;
  private switchConfig: SwitchControlConfig;
  private eyeTrackingConfig: EyeTrackingConfig;
  private currentSwitchIndex: number = 0;
  private switchElements: HTMLElement[] = [];
  private scanTimer?: NodeJS.Timeout;
  private gestureStartPos: { x: number; y: number } = { x: 0, y: 0 };
  private gestureStartTime: number = 0;

  constructor() {
    super();
    
    this.inputMethods = new Map([
      ['voice', { type: 'voice', enabled: true }],
      ['text', { type: 'text', enabled: true }],
      ['gesture', { type: 'gesture', enabled: false }],
      ['switch', { type: 'switch', enabled: false }],
      ['eye-tracking', { type: 'eye-tracking', enabled: false }]
    ]);

    this.switchConfig = {
      enabled: false,
      scanRate: 1000,
      activationKey: 'Space',
      nextKey: 'ArrowRight',
      previousKey: 'ArrowLeft',
      autoScan: false
    };

    this.eyeTrackingConfig = {
      enabled: false,
      dwellTime: 1000,
      calibrationRequired: true
    };

    this.setupEventListeners();
  }

  /**
   * Initialize alternative input methods for a container
   */
  public initialize(container: HTMLElement): void {
    this.setupGestureInput(container);
    this.setupSwitchControl(container);
    this.setupEyeTracking(container);
    this.updateFocusableElements(container);
  }

  /**
   * Setup gesture input recognition
   */
  private setupGestureInput(container: HTMLElement): void {
    if (!this.inputMethods.get('gesture')?.enabled) return;

    // Touch events for mobile gestures
    container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });

    // Mouse events for desktop gesture simulation
    container.addEventListener('mousedown', this.handleMouseDown.bind(this));
    container.addEventListener('mousemove', this.handleMouseMove.bind(this));
    container.addEventListener('mouseup', this.handleMouseUp.bind(this));

    // Keyboard shortcuts for gesture alternatives
    document.addEventListener('keydown', this.handleGestureKeyboard.bind(this));
  }

  /**
   * Handle touch start for gesture recognition
   */
  private handleTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      if (touch) {
        this.gestureStartPos = { x: touch.clientX, y: touch.clientY };
        this.gestureStartTime = Date.now();
      }
    }
  }

  /**
   * Handle touch move for gesture recognition
   */
  private handleTouchMove(event: TouchEvent): void {
    // Prevent default scrolling during gesture recognition
    if (this.inputMethods.get('gesture')?.enabled) {
      event.preventDefault();
    }
  }

  /**
   * Handle touch end for gesture recognition
   */
  private handleTouchEnd(event: TouchEvent): void {
    if (event.changedTouches.length === 1) {
      const touch = event.changedTouches[0];
      if (touch) {
        const endPos = { x: touch.clientX, y: touch.clientY };
        const duration = Date.now() - this.gestureStartTime;

        this.recognizeGesture(this.gestureStartPos, endPos, duration, event.target as HTMLElement);
      }
    }
  }

  /**
   * Handle mouse down for desktop gesture simulation
   */
  private handleMouseDown(event: MouseEvent): void {
    if (event.ctrlKey) { // Ctrl+mouse for gesture simulation
      this.gestureStartPos = { x: event.clientX, y: event.clientY };
      this.gestureStartTime = Date.now();
    }
  }

  /**
   * Handle mouse move for desktop gesture simulation
   */
  private handleMouseMove(_event: MouseEvent): void {
    // Could add visual feedback for gesture in progress
  }

  /**
   * Handle mouse up for desktop gesture simulation
   */
  private handleMouseUp(event: MouseEvent): void {
    if (event.ctrlKey && this.gestureStartTime > 0) {
      const endPos = { x: event.clientX, y: event.clientY };
      const duration = Date.now() - this.gestureStartTime;
      
      this.recognizeGesture(this.gestureStartPos, endPos, duration, event.target as HTMLElement);
      this.gestureStartTime = 0;
    }
  }

  /**
   * Recognize gesture from start and end positions
   */
  private recognizeGesture(
    start: { x: number; y: number },
    end: { x: number; y: number },
    _duration: number,
    target: HTMLElement
  ): void {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Minimum distance for gesture recognition
    if (distance < 30) {
      // Tap gesture
      this.emitGesture({
        type: 'tap',
        target,
        distance
      });
      return;
    }

    // Determine swipe direction
    let direction: 'up' | 'down' | 'left' | 'right';
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      direction = deltaX > 0 ? 'right' : 'left';
    } else {
      direction = deltaY > 0 ? 'down' : 'up';
    }

    this.emitGesture({
      type: 'swipe',
      direction,
      target,
      distance
    });
  }

  /**
   * Handle keyboard shortcuts for gesture alternatives
   */
  private handleGestureKeyboard(event: KeyboardEvent): void {
    if (!this.inputMethods.get('gesture')?.enabled) return;

    const gestureKeys: Record<string, GestureEvent> = {
      'ArrowUp': { type: 'swipe', direction: 'up', target: document.activeElement as HTMLElement },
      'ArrowDown': { type: 'swipe', direction: 'down', target: document.activeElement as HTMLElement },
      'ArrowLeft': { type: 'swipe', direction: 'left', target: document.activeElement as HTMLElement },
      'ArrowRight': { type: 'swipe', direction: 'right', target: document.activeElement as HTMLElement },
      'Enter': { type: 'tap', target: document.activeElement as HTMLElement }
    };

    if (event.altKey) {
      const gestureKey = gestureKeys[event.key];
      if (gestureKey) {
        event.preventDefault();
        this.emitGesture(gestureKey);
      }
    }
  }

  /**
   * Setup switch control for motor disabilities
   */
  private setupSwitchControl(_container: HTMLElement): void {
    if (!this.inputMethods.get('switch')?.enabled) return;

    document.addEventListener('keydown', this.handleSwitchKeyboard.bind(this));
    
    if (this.switchConfig.autoScan) {
      this.startAutoScan();
    }
  }

  /**
   * Handle switch control keyboard input
   */
  private handleSwitchKeyboard(event: KeyboardEvent): void {
    if (!this.switchConfig.enabled) return;

    switch (event.code) {
      case this.switchConfig.activationKey:
        event.preventDefault();
        this.activateCurrentSwitchElement();
        break;
      
      case this.switchConfig.nextKey:
        if (!this.switchConfig.autoScan) {
          event.preventDefault();
          this.moveToNextSwitchElement();
        }
        break;
      
      case this.switchConfig.previousKey:
        if (!this.switchConfig.autoScan) {
          event.preventDefault();
          this.moveToPreviousSwitchElement();
        }
        break;
    }
  }

  /**
   * Start automatic scanning for switch control
   */
  private startAutoScan(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
    }

    this.scanTimer = setInterval(() => {
      this.moveToNextSwitchElement();
    }, this.switchConfig.scanRate);
  }

  /**
   * Stop automatic scanning
   */
  private stopAutoScan(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }

  /**
   * Move to next switch element
   */
  private moveToNextSwitchElement(): void {
    if (this.switchElements.length === 0) return;

    this.currentSwitchIndex = (this.currentSwitchIndex + 1) % this.switchElements.length;
    const nextElement = this.switchElements[this.currentSwitchIndex];
    if (nextElement) {
      this.highlightSwitchElement(nextElement);
    }
  }

  /**
   * Move to previous switch element
   */
  private moveToPreviousSwitchElement(): void {
    if (this.switchElements.length === 0) return;

    this.currentSwitchIndex = this.currentSwitchIndex === 0
      ? this.switchElements.length - 1
      : this.currentSwitchIndex - 1;

    const prevElement = this.switchElements[this.currentSwitchIndex];
    if (prevElement) {
      this.highlightSwitchElement(prevElement);
    }
  }

  /**
   * Highlight current switch element
   */
  private highlightSwitchElement(element: HTMLElement): void {
    // Remove previous highlights
    this.switchElements.forEach(el => {
      el.classList.remove('switch-highlight');
      el.setAttribute('aria-describedby', '');
    });

    // Add highlight to current element
    element.classList.add('switch-highlight');
    element.focus();
    
    // Scroll into view if supported
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    this.emit('switchElementHighlighted', {
      element,
      index: this.currentSwitchIndex,
      total: this.switchElements.length
    });
  }

  /**
   * Activate current switch element
   */
  private activateCurrentSwitchElement(): void {
    if (this.switchElements.length === 0) return;

    const element = this.switchElements[this.currentSwitchIndex];
    if (element) {
      element.click();
    }
    
    this.emit('switchElementActivated', {
      element,
      index: this.currentSwitchIndex
    });
  }

  /**
   * Setup eye tracking (placeholder for future implementation)
   */
  private setupEyeTracking(container: HTMLElement): void {
    if (!this.inputMethods.get('eye-tracking')?.enabled) return;

    // This would integrate with eye tracking hardware/software APIs
    // For now, we'll simulate with mouse hover + dwell time
    this.setupEyeTrackingSimulation(container);
  }

  /**
   * Setup eye tracking simulation using mouse hover
   */
  private setupEyeTrackingSimulation(container: HTMLElement): void {
    let dwellTimer: NodeJS.Timeout;
    let currentTarget: HTMLElement | null = null;

    const handleMouseEnter = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (this.isInteractiveElement(target)) {
        currentTarget = target;
        target.classList.add('eye-tracking-focus');
        
        dwellTimer = setTimeout(() => {
          if (currentTarget === target) {
            this.activateEyeTrackingTarget(target);
          }
        }, this.eyeTrackingConfig.dwellTime);
      }
    };

    const handleMouseLeave = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (currentTarget === target) {
        target.classList.remove('eye-tracking-focus');
        clearTimeout(dwellTimer);
        currentTarget = null;
      }
    };

    container.addEventListener('mouseenter', handleMouseEnter, true);
    container.addEventListener('mouseleave', handleMouseLeave, true);
  }

  /**
   * Activate eye tracking target
   */
  private activateEyeTrackingTarget(element: HTMLElement): void {
    element.classList.remove('eye-tracking-focus');
    element.click();
    
    this.emit('eyeTrackingActivation', { element });
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
   * Update focusable elements for switch control
   */
  private updateFocusableElements(container: HTMLElement): void {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    this.switchElements = Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
    this.currentSwitchIndex = 0;
  }

  /**
   * Emit gesture event
   */
  private emitGesture(gesture: GestureEvent): void {
    this.emit('gesture', gesture);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for window resize to update elements
    window.addEventListener('resize', () => {
      // Re-scan for focusable elements after layout changes
      const container = document.body;
      this.updateFocusableElements(container);
    });
  }

  /**
   * Enable/disable input method
   */
  public setInputMethodEnabled(method: string, enabled: boolean): void {
    const inputMethod = this.inputMethods.get(method);
    if (inputMethod) {
      inputMethod.enabled = enabled;
      
      if (method === 'switch') {
        this.switchConfig.enabled = enabled;
        if (enabled && this.switchConfig.autoScan) {
          this.startAutoScan();
        } else {
          this.stopAutoScan();
        }
      }
      
      if (method === 'eye-tracking') {
        this.eyeTrackingConfig.enabled = enabled;
      }
      
      this.emit('inputMethodChanged', { method, enabled });
    }
  }

  /**
   * Configure switch control
   */
  public configureSwitchControl(config: Partial<SwitchControlConfig>): void {
    this.switchConfig = { ...this.switchConfig, ...config };
    
    if (this.switchConfig.enabled && this.switchConfig.autoScan) {
      this.startAutoScan();
    } else {
      this.stopAutoScan();
    }
    
    this.emit('switchConfigChanged', this.switchConfig);
  }

  /**
   * Configure eye tracking
   */
  public configureEyeTracking(config: Partial<EyeTrackingConfig>): void {
    this.eyeTrackingConfig = { ...this.eyeTrackingConfig, ...config };
    this.emit('eyeTrackingConfigChanged', this.eyeTrackingConfig);
  }

  /**
   * Get input method status
   */
  public getInputMethods(): Map<string, InputMethod> {
    return new Map(this.inputMethods);
  }

  /**
   * Get switch control configuration
   */
  public getSwitchConfig(): SwitchControlConfig {
    return { ...this.switchConfig };
  }

  /**
   * Get eye tracking configuration
   */
  public getEyeTrackingConfig(): EyeTrackingConfig {
    return { ...this.eyeTrackingConfig };
  }

  /**
   * Get current switch element index
   */
  public getCurrentSwitchIndex(): number {
    return this.currentSwitchIndex;
  }

  /**
   * Get total switch elements count
   */
  public getSwitchElementsCount(): number {
    return this.switchElements.length;
  }

  /**
   * Cleanup and destroy
   */
  public destroy(): void {
    this.stopAutoScan();
    
    // Remove all event listeners
    document.removeEventListener('keydown', this.handleSwitchKeyboard);
    document.removeEventListener('keydown', this.handleGestureKeyboard);
    
    // Clear highlights
    this.switchElements.forEach(el => {
      el.classList.remove('switch-highlight', 'eye-tracking-focus');
    });
    
    this.removeAllListeners();
  }
}