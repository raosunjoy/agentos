import { EventEmitter } from 'events';

export interface ScreenReaderAnnouncement {
  text: string;
  priority: 'polite' | 'assertive' | 'status';
  interrupt?: boolean;
}

export class ScreenReaderSupport extends EventEmitter {
  private liveRegions: Map<string, HTMLElement>;
  private isActive: boolean = false;
  private announcementQueue: ScreenReaderAnnouncement[] = [];
  private isProcessingQueue: boolean = false;

  constructor() {
    super();
    this.liveRegions = new Map();
    this.detectScreenReader();
    this.createLiveRegions();
  }

  /**
   * Detect if screen reader is active
   */
  private detectScreenReader(): void {
    // Check for common screen reader indicators
    const userAgent = navigator.userAgent.toLowerCase();
    const hasScreenReaderUA = userAgent.includes('nvda') || 
                             userAgent.includes('jaws') || 
                             userAgent.includes('voiceover');

    // Check for screen reader specific APIs
    const hasScreenReaderAPI = 'speechSynthesis' in window && 
                              window.speechSynthesis.getVoices().length > 0;

    // Check for accessibility preferences
    const prefersScreenReader = window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
                               window.matchMedia('(prefers-contrast: high)').matches;

    this.isActive = hasScreenReaderUA || hasScreenReaderAPI || prefersScreenReader;

    if (this.isActive) {
      this.emit('screenReaderDetected');
    }
  }

  /**
   * Create ARIA live regions for announcements
   */
  private createLiveRegions(): void {
    const regions = [
      { id: 'aria-live-polite', priority: 'polite' },
      { id: 'aria-live-assertive', priority: 'assertive' },
      { id: 'aria-live-status', priority: 'status' }
    ];

    regions.forEach(({ id, priority }) => {
      let region = document.getElementById(id);
      
      if (!region) {
        region = document.createElement('div');
        region.id = id;
        region.setAttribute('aria-live', priority === 'status' ? 'polite' : priority);
        region.setAttribute('aria-atomic', 'true');
        region.className = 'sr-only';
        region.style.cssText = `
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        `;
        
        if (priority === 'status') {
          region.setAttribute('role', 'status');
        }
        
        document.body.appendChild(region);
      }
      
      this.liveRegions.set(priority, region);
    });
  }

  /**
   * Announce text to screen readers
   */
  public announce(text: string, priority: 'polite' | 'assertive' | 'status' = 'polite', interrupt: boolean = false): void {
    if (!this.isActive || !text.trim()) {
      return;
    }

    const announcement: ScreenReaderAnnouncement = {
      text: text.trim(),
      priority,
      interrupt
    };

    if (interrupt) {
      // Clear queue and announce immediately
      this.announcementQueue = [announcement];
      this.processAnnouncementQueue();
    } else {
      // Add to queue
      this.announcementQueue.push(announcement);
      if (!this.isProcessingQueue) {
        this.processAnnouncementQueue();
      }
    }

    this.emit('announced', announcement);
  }

  /**
   * Process announcement queue
   */
  private async processAnnouncementQueue(): Promise<void> {
    if (this.isProcessingQueue || this.announcementQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.announcementQueue.length > 0) {
      const announcement = this.announcementQueue.shift()!;
      await this.performAnnouncement(announcement);
      
      // Small delay between announcements
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;
  }

  /**
   * Perform individual announcement
   */
  private async performAnnouncement(announcement: ScreenReaderAnnouncement): Promise<void> {
    const region = this.liveRegions.get(announcement.priority);
    
    if (!region) {
      return;
    }

    // Clear region first
    region.textContent = '';
    
    // Wait a moment then set the text
    await new Promise(resolve => setTimeout(resolve, 50));
    region.textContent = announcement.text;

    this.emit('announcementPerformed', announcement);
  }

  /**
   * Announce navigation changes
   */
  public announceNavigation(from: string, to: string): void {
    const text = `Navigated from ${from} to ${to}`;
    this.announce(text, 'polite');
  }

  /**
   * Announce focus changes
   */
  public announceFocus(element: HTMLElement): void {
    const description = this.getElementDescription(element);
    const role = this.getElementRole(element);
    const state = this.getElementState(element);
    
    let announcement = `${description}`;
    
    if (role) {
      announcement += `, ${role}`;
    }
    
    if (state) {
      announcement += `, ${state}`;
    }

    this.announce(announcement, 'polite');
  }

  /**
   * Announce form validation errors
   */
  public announceFormError(field: string, error: string): void {
    const text = `Error in ${field}: ${error}`;
    this.announce(text, 'assertive', true);
  }

  /**
   * Announce loading states
   */
  public announceLoading(isLoading: boolean, context?: string): void {
    const text = isLoading 
      ? `Loading${context ? ` ${context}` : ''}...`
      : `Finished loading${context ? ` ${context}` : ''}`;
    
    this.announce(text, 'status');
  }

  /**
   * Announce progress updates
   */
  public announceProgress(current: number, total: number, context?: string): void {
    const percentage = Math.round((current / total) * 100);
    const text = `Progress${context ? ` for ${context}` : ''}: ${percentage}% complete, ${current} of ${total}`;
    
    this.announce(text, 'status');
  }

  /**
   * Get element description for screen readers
   */
  private getElementDescription(element: HTMLElement): string {
    // Priority order for element description
    const description = 
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') && 
        document.getElementById(element.getAttribute('aria-labelledby')!)?.textContent ||
      element.getAttribute('title') ||
      element.textContent?.trim() ||
      element.getAttribute('alt') ||
      element.getAttribute('placeholder') ||
      'Unlabeled element';

    return description.trim();
  }

  /**
   * Get element role for screen readers
   */
  private getElementRole(element: HTMLElement): string {
    const explicitRole = element.getAttribute('role');
    if (explicitRole) {
      return explicitRole;
    }

    // Implicit roles based on tag names
    const tagRoles: Record<string, string> = {
      'BUTTON': 'button',
      'INPUT': this.getInputRole(element as HTMLInputElement),
      'SELECT': 'combobox',
      'TEXTAREA': 'textbox',
      'A': 'link',
      'H1': 'heading level 1',
      'H2': 'heading level 2',
      'H3': 'heading level 3',
      'H4': 'heading level 4',
      'H5': 'heading level 5',
      'H6': 'heading level 6',
      'NAV': 'navigation',
      'MAIN': 'main',
      'ASIDE': 'complementary',
      'HEADER': 'banner',
      'FOOTER': 'contentinfo'
    };

    return tagRoles[element.tagName] || '';
  }

  /**
   * Get specific role for input elements
   */
  private getInputRole(input: HTMLInputElement): string {
    const typeRoles: Record<string, string> = {
      'text': 'textbox',
      'password': 'textbox',
      'email': 'textbox',
      'tel': 'textbox',
      'url': 'textbox',
      'search': 'searchbox',
      'number': 'spinbutton',
      'range': 'slider',
      'checkbox': 'checkbox',
      'radio': 'radio',
      'button': 'button',
      'submit': 'button',
      'reset': 'button',
      'file': 'button'
    };

    return typeRoles[input.type] || 'textbox';
  }

  /**
   * Get element state information
   */
  private getElementState(element: HTMLElement): string {
    const states: string[] = [];

    // Check various ARIA states
    if (element.getAttribute('aria-expanded') === 'true') {
      states.push('expanded');
    } else if (element.getAttribute('aria-expanded') === 'false') {
      states.push('collapsed');
    }

    if (element.getAttribute('aria-selected') === 'true') {
      states.push('selected');
    }

    if (element.getAttribute('aria-checked') === 'true') {
      states.push('checked');
    } else if (element.getAttribute('aria-checked') === 'false') {
      states.push('unchecked');
    }

    if (element.getAttribute('aria-pressed') === 'true') {
      states.push('pressed');
    }

    if (element.getAttribute('aria-disabled') === 'true' || 
        (element as HTMLInputElement).disabled) {
      states.push('disabled');
    }

    if (element.getAttribute('aria-required') === 'true' ||
        (element as HTMLInputElement).required) {
      states.push('required');
    }

    if (element.getAttribute('aria-invalid') === 'true') {
      states.push('invalid');
    }

    // Check for focus
    if (document.activeElement === element) {
      states.push('focused');
    }

    return states.join(', ');
  }

  /**
   * Clear all announcements
   */
  public clearAnnouncements(): void {
    this.announcementQueue = [];
    this.liveRegions.forEach(region => {
      region.textContent = '';
    });
  }

  /**
   * Set screen reader active state
   */
  public setActive(active: boolean): void {
    this.isActive = active;
    this.emit('activeStateChanged', active);
  }

  /**
   * Check if screen reader is active
   */
  public isScreenReaderActive(): boolean {
    return this.isActive;
  }

  /**
   * Get announcement queue length
   */
  public getQueueLength(): number {
    return this.announcementQueue.length;
  }

  /**
   * Cleanup and destroy
   */
  public destroy(): void {
    this.clearAnnouncements();
    
    // Remove live regions
    this.liveRegions.forEach(region => {
      if (region.parentNode) {
        region.parentNode.removeChild(region);
      }
    });
    
    this.liveRegions.clear();
    this.removeAllListeners();
  }
}