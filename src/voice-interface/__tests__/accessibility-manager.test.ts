import { AccessibilityManager } from '../accessibility-manager';
import { AccessibilitySettings } from '../types';

// Mock DOM methods and APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: query.includes('prefers-contrast: high') ? false : false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

Object.defineProperty(window, 'speechSynthesis', {
  writable: true,
  value: {
    getVoices: jest.fn(() => [
      { name: 'Test Voice', lang: 'en-US', localService: true }
    ]),
    speak: jest.fn(),
    cancel: jest.fn()
  }
});

describe('AccessibilityManager', () => {
  let manager: AccessibilityManager;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <div class="conversation-interface" role="main">
        <button id="test-button">Test Button</button>
        <input id="test-input" type="text" />
        <div class="quick-actions">
          <button class="quick-action">Action 1</button>
          <button class="quick-action">Action 2</button>
          <button class="quick-action">Action 3</button>
        </div>
        <div id="settings-panel" class="hidden">
          <div class="settings-content"></div>
        </div>
      </div>
    `;
    document.body.appendChild(container);
    
    manager = new AccessibilityManager();
  });

  afterEach(() => {
    manager.destroy();
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with default settings', () => {
      const settings = manager.getSettings();
      
      expect(settings.largeText).toBe(false);
      expect(settings.highContrast).toBe(false);
      expect(settings.voiceNavigation).toBe(true);
      expect(settings.fontSize).toBe('large');
    });

    test('should detect system accessibility preferences', () => {
      // Mock high contrast preference
      (window.matchMedia as jest.Mock).mockImplementation(query => ({
        matches: query.includes('prefers-contrast: high'),
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      const newManager = new AccessibilityManager();
      const settings = newManager.getSettings();
      
      expect(settings.highContrast).toBe(true);
      newManager.destroy();
    });

    test('should setup accessibility attributes when initialized', () => {
      manager.initialize(container);

      // Check for skip links
      const skipLinks = container.querySelector('.skip-links');
      expect(skipLinks).toBeTruthy();

      // Check for proper ARIA attributes
      const button = container.querySelector('#test-button');
      expect(button?.getAttribute('tabindex')).toBe('0');
    });

    test('should create live regions for screen reader announcements', () => {
      manager.initialize(container);

      expect(document.getElementById('aria-live-polite')).toBeTruthy();
      expect(document.getElementById('aria-live-assertive')).toBeTruthy();
      expect(document.getElementById('aria-live-status')).toBeTruthy();
    });
  });

  describe('Settings Management', () => {
    beforeEach(() => {
      manager.initialize(container);
    });

    test('should update individual settings', () => {
      manager.updateSetting('largeText', true);
      manager.updateSetting('highContrast', true);

      const settings = manager.getSettings();
      expect(settings.largeText).toBe(true);
      expect(settings.highContrast).toBe(true);
    });

    test('should emit events when settings change', () => {
      const settingChangedHandler = jest.fn();
      manager.on('settingChanged', settingChangedHandler);

      manager.updateSetting('fontSize', 'extra-large');

      expect(settingChangedHandler).toHaveBeenCalledWith({
        key: 'fontSize',
        value: 'extra-large'
      });
    });

    test('should apply settings to DOM elements', () => {
      manager.updateSetting('highContrast', true);
      manager.updateSetting('largeText', true);
      manager.updateSetting('reducedMotion', true);

      expect(document.body.classList.contains('high-contrast')).toBe(true);
      expect(document.body.classList.contains('large-text')).toBe(true);
      expect(document.body.classList.contains('reduced-motion')).toBe(true);
    });
  });

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      manager.initialize(container);
    });

    test('should handle tab navigation', () => {
      const button = container.querySelector('#test-button') as HTMLElement;
      const input = container.querySelector('#test-input') as HTMLElement;
      
      button.focus();
      
      const tabEvent = new KeyboardEvent('keydown', { 
        key: 'Tab',
        bubbles: true 
      });
      document.dispatchEvent(tabEvent);

      // Should move focus to next element
      expect(document.activeElement).toBe(input);
    });

    test('should handle activation keys (Enter/Space)', () => {
      const button = container.querySelector('#test-button') as HTMLButtonElement;
      const clickSpy = jest.spyOn(button, 'click');
      
      button.focus();
      
      const enterEvent = new KeyboardEvent('keydown', { 
        key: 'Enter',
        target: button,
        bubbles: true 
      } as any);
      document.dispatchEvent(enterEvent);

      expect(clickSpy).toHaveBeenCalled();
    });

    test('should handle escape key to close dialogs', () => {
      const escapeHandler = jest.fn();
      manager.on('escapePressed', escapeHandler);

      const escapeEvent = new KeyboardEvent('keydown', { 
        key: 'Escape',
        bubbles: true 
      });
      document.dispatchEvent(escapeEvent);

      expect(escapeHandler).toHaveBeenCalled();
    });

    test('should handle arrow key navigation in grids', () => {
      const quickActions = container.querySelectorAll('.quick-action') as NodeListOf<HTMLElement>;
      quickActions[0].focus();

      const rightArrowEvent = new KeyboardEvent('keydown', { 
        key: 'ArrowRight',
        target: quickActions[0],
        bubbles: true 
      } as any);
      document.dispatchEvent(rightArrowEvent);

      expect(document.activeElement).toBe(quickActions[1]);
    });
  });

  describe('Screen Reader Support', () => {
    beforeEach(() => {
      manager.initialize(container);
    });

    test('should announce text to screen readers', () => {
      manager.announce('Test announcement', 'polite');

      const liveRegion = document.getElementById('aria-live-polite');
      expect(liveRegion?.textContent).toBe('Test announcement');
    });

    test('should handle different announcement priorities', () => {
      manager.announce('Polite message', 'polite');
      manager.announce('Assertive message', 'assertive');
      manager.announce('Status message', 'status');

      expect(document.getElementById('aria-live-polite')?.textContent).toBe('Polite message');
      expect(document.getElementById('aria-live-assertive')?.textContent).toBe('Assertive message');
      expect(document.getElementById('aria-live-status')?.textContent).toBe('Status message');
    });

    test('should emit announcement events', () => {
      const announcedHandler = jest.fn();
      manager.on('announced', announcedHandler);

      manager.announce('Test message', 'polite');

      expect(announcedHandler).toHaveBeenCalledWith({
        text: 'Test message',
        priority: 'polite'
      });
    });
  });

  describe('Focus Management', () => {
    beforeEach(() => {
      manager.initialize(container);
    });

    test('should get all focusable elements', () => {
      const focusableElements = (manager as any).getFocusableElements(container);
      
      expect(focusableElements.length).toBeGreaterThan(0);
      expect(focusableElements).toContain(container.querySelector('#test-button'));
      expect(focusableElements).toContain(container.querySelector('#test-input'));
    });

    test('should identify interactive elements', () => {
      const button = container.querySelector('#test-button') as HTMLElement;
      const div = container.querySelector('.conversation-interface') as HTMLElement;
      
      expect((manager as any).isInteractiveElement(button)).toBe(true);
      expect((manager as any).isInteractiveElement(div)).toBe(false);
    });

    test('should provide element descriptions', () => {
      const button = container.querySelector('#test-button') as HTMLElement;
      button.setAttribute('aria-label', 'Custom label');
      
      const description = (manager as any).getElementDescription(button);
      expect(description).toBe('Custom label');
    });
  });

  describe('Alternative Input Methods', () => {
    beforeEach(() => {
      manager.initialize(container);
    });

    test('should manage input method availability', () => {
      manager.updateInputMethod('switch', true);
      manager.updateInputMethod('gesture', true);

      const inputMethods = manager.getInputMethods();
      expect(inputMethods.get('switch')?.enabled).toBe(true);
      expect(inputMethods.get('gesture')?.enabled).toBe(true);
    });

    test('should emit events when input methods change', () => {
      const inputMethodChangedHandler = jest.fn();
      manager.on('inputMethodChanged', inputMethodChangedHandler);

      manager.updateInputMethod('switch', true);

      expect(inputMethodChangedHandler).toHaveBeenCalledWith({
        method: 'switch',
        enabled: true
      });
    });

    test('should handle gesture input', () => {
      const gestureHandler = jest.fn();
      manager.on('gesture', gestureHandler);

      manager.updateInputMethod('gesture', true);

      // Simulate swipe gesture
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      const touchEnd = new TouchEvent('touchend', {
        changedTouches: [{ clientX: 200, clientY: 100 } as Touch]
      });

      container.dispatchEvent(touchStart);
      container.dispatchEvent(touchEnd);

      expect(gestureHandler).toHaveBeenCalledWith({
        type: 'swipe-right',
        action: 'next'
      });
    });
  });

  describe('Switch Control', () => {
    beforeEach(() => {
      manager.initialize(container);
      manager.updateInputMethod('switch', true);
    });

    test('should handle switch control navigation', () => {
      const switchEvent = new KeyboardEvent('keydown', { 
        code: 'ArrowRight',
        ctrlKey: true,
        bubbles: true 
      });
      document.dispatchEvent(switchEvent);

      // Should highlight next element
      const highlightedElement = container.querySelector('.switch-highlight');
      expect(highlightedElement).toBeTruthy();
    });

    test('should activate elements via switch control', () => {
      const button = container.querySelector('#test-button') as HTMLButtonElement;
      const clickSpy = jest.spyOn(button, 'click');
      
      button.focus();
      
      const activateEvent = new KeyboardEvent('keydown', { 
        code: 'Space',
        ctrlKey: true,
        bubbles: true 
      });
      document.dispatchEvent(activateEvent);

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('Settings Panel', () => {
    beforeEach(() => {
      manager.initialize(container);
    });

    test('should create accessibility settings panel', () => {
      const settingsContent = container.querySelector('.settings-content');
      expect(settingsContent?.querySelector('.accessibility-settings')).toBeTruthy();
      expect(settingsContent?.querySelector('#large-text')).toBeTruthy();
      expect(settingsContent?.querySelector('#high-contrast')).toBeTruthy();
    });

    test('should handle settings panel interactions', () => {
      const largeTextCheckbox = container.querySelector('#large-text') as HTMLInputElement;
      
      largeTextCheckbox.checked = true;
      largeTextCheckbox.dispatchEvent(new Event('change'));

      const settings = manager.getSettings();
      expect(settings.largeText).toBe(true);
    });

    test('should test accessibility settings', () => {
      const announcedHandler = jest.fn();
      manager.on('announced', announcedHandler);

      const testButton = container.querySelector('#test-settings') as HTMLButtonElement;
      testButton.click();

      expect(announcedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Testing accessibility settings')
        })
      );
    });

    test('should reset settings to defaults', () => {
      manager.updateSetting('largeText', true);
      manager.updateSetting('highContrast', true);

      const resetButton = container.querySelector('#reset-settings') as HTMLButtonElement;
      resetButton.click();

      const settings = manager.getSettings();
      expect(settings.largeText).toBe(false);
      expect(settings.highContrast).toBe(false);
    });
  });

  describe('WCAG Compliance', () => {
    beforeEach(() => {
      manager.initialize(container);
    });

    test('should ensure proper focus indicators', () => {
      // Check that focus styles are applied
      const styles = Array.from(document.styleSheets)
        .flatMap(sheet => Array.from(sheet.cssRules))
        .map(rule => rule.cssText)
        .join(' ');

      expect(styles).toContain('focus');
      expect(styles).toContain('outline');
    });

    test('should provide skip navigation links', () => {
      const skipLinks = container.querySelectorAll('.skip-link');
      expect(skipLinks.length).toBeGreaterThan(0);
      
      skipLinks.forEach(link => {
        expect(link.getAttribute('href')).toMatch(/^#/);
      });
    });

    test('should ensure proper heading hierarchy', () => {
      const settingsPanel = container.querySelector('.accessibility-settings');
      const headings = settingsPanel?.querySelectorAll('h1, h2, h3, h4, h5, h6');
      
      if (headings && headings.length > 0) {
        // Check that headings have proper hierarchy
        const headingLevels = Array.from(headings).map(h => 
          parseInt(h.tagName.charAt(1))
        );
        
        for (let i = 1; i < headingLevels.length; i++) {
          expect(headingLevels[i] - headingLevels[i-1]).toBeLessThanOrEqual(1);
        }
      }
    });

    test('should provide proper ARIA labels and descriptions', () => {
      const interactiveElements = container.querySelectorAll('button, input, select, textarea');
      
      interactiveElements.forEach(element => {
        const hasLabel = element.hasAttribute('aria-label') ||
                        element.hasAttribute('aria-labelledby') ||
                        element.textContent?.trim() ||
                        (element as HTMLInputElement).labels?.length > 0;
        
        expect(hasLabel).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle missing DOM elements gracefully', () => {
      const emptyContainer = document.createElement('div');
      
      expect(() => {
        manager.initialize(emptyContainer);
      }).not.toThrow();
    });

    test('should handle invalid settings gracefully', () => {
      expect(() => {
        manager.updateSetting('fontSize', 'invalid' as any);
      }).not.toThrow();
    });

    test('should handle missing live regions', () => {
      // Remove live regions
      document.getElementById('aria-live-polite')?.remove();
      
      expect(() => {
        manager.announce('Test message', 'polite');
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup properly when destroyed', () => {
      manager.initialize(container);
      
      const listenerCount = manager.listenerCount('settingChanged');
      manager.destroy();

      // Live regions should be removed
      expect(document.getElementById('aria-live-polite')).toBeFalsy();
      expect(document.getElementById('aria-live-assertive')).toBeFalsy();
      expect(document.getElementById('aria-live-status')).toBeFalsy();
      
      // Event listeners should be removed
      expect(manager.listenerCount('settingChanged')).toBe(0);
    });
  });
});