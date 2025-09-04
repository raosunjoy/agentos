import { EventEmitter } from 'events';

export interface WCAGViolation {
  level: 'A' | 'AA' | 'AAA';
  guideline: string;
  criterion: string;
  element: HTMLElement;
  description: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
}

export interface WCAGAuditResult {
  passed: boolean;
  violations: WCAGViolation[];
  warnings: WCAGViolation[];
  score: number; // 0-100
  testedElements: number;
}

export class WCAGCompliance extends EventEmitter {
  private auditResults: WCAGAuditResult | null = null;
  private targetLevel: 'A' | 'AA' | 'AAA' = 'AA';

  constructor(targetLevel: 'A' | 'AA' | 'AAA' = 'AA') {
    super();
    this.targetLevel = targetLevel;
  }

  /**
   * Perform comprehensive WCAG audit
   */
  public async auditContainer(container: HTMLElement): Promise<WCAGAuditResult> {
    const violations: WCAGViolation[] = [];
    const warnings: WCAGViolation[] = [];
    
    // Get all elements to test
    const allElements = container.querySelectorAll('*');
    const testedElements = allElements.length;

    // Run all audit checks
    violations.push(...this.checkColorContrast(container));
    violations.push(...this.checkKeyboardNavigation(container));
    violations.push(...this.checkAriaLabels(container));
    violations.push(...this.checkHeadingStructure(container));
    violations.push(...this.checkFormLabels(container));
    violations.push(...this.checkImageAltText(container));
    violations.push(...this.checkFocusManagement(container));
    violations.push(...this.checkLandmarks(container));
    violations.push(...this.checkTextAlternatives(container));
    violations.push(...this.checkErrorIdentification(container));

    // Separate violations by severity
    const errors = violations.filter(v => v.severity === 'error');
    const warns = violations.filter(v => v.severity === 'warning');
    warnings.push(...warns);

    // Calculate score
    const totalChecks = testedElements * 10; // Approximate number of checks per element
    const errorWeight = 3;
    const warningWeight = 1;
    const deductions = (errors.length * errorWeight) + (warnings.length * warningWeight);
    const score = Math.max(0, Math.round(((totalChecks - deductions) / totalChecks) * 100));

    this.auditResults = {
      passed: errors.length === 0,
      violations: errors,
      warnings,
      score,
      testedElements
    };

    this.emit('auditCompleted', this.auditResults);
    return this.auditResults;
  }

  /**
   * Check color contrast compliance
   */
  private checkColorContrast(container: HTMLElement): WCAGViolation[] {
    const violations: WCAGViolation[] = [];
    const textElements = container.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button, label');

    textElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      const styles = window.getComputedStyle(htmlElement);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;
      
      // Skip if no background color is set (transparent)
      if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
        return;
      }

      const contrast = this.calculateContrastRatio(color, backgroundColor);
      const fontSize = parseFloat(styles.fontSize);
      const fontWeight = styles.fontWeight;
      
      // Determine required contrast ratio
      const isLargeText = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
      const requiredRatio = this.targetLevel === 'AAA' 
        ? (isLargeText ? 4.5 : 7) 
        : (isLargeText ? 3 : 4.5);

      if (contrast < requiredRatio) {
        violations.push({
          level: this.targetLevel,
          guideline: '1.4 Distinguishable',
          criterion: '1.4.3 Contrast (Minimum)',
          element: htmlElement,
          description: `Text has insufficient color contrast ratio of ${contrast.toFixed(2)}:1`,
          suggestion: `Increase contrast to at least ${requiredRatio}:1`,
          severity: 'error'
        });
      }
    });

    return violations;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  private calculateContrastRatio(color1: string, color2: string): number {
    const rgb1 = this.parseColor(color1);
    const rgb2 = this.parseColor(color2);
    
    if (!rgb1 || !rgb2) return 21; // Assume maximum contrast if parsing fails
    
    const l1 = this.getRelativeLuminance(rgb1);
    const l2 = this.getRelativeLuminance(rgb2);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Parse color string to RGB values
   */
  private parseColor(color: string): { r: number; g: number; b: number } | null {
    // Create a temporary element to parse color
    const div = document.createElement('div');
    div.style.color = color;
    document.body.appendChild(div);
    
    const computedColor = window.getComputedStyle(div).color;
    document.body.removeChild(div);
    
    const match = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match && match[1] && match[2] && match[3]) {
      return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10)
      };
    }
    
    return null;
  }

  /**
   * Calculate relative luminance
   */
  private getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
    const { r, g, b } = rgb;
    
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * (rs || 0) + 0.7152 * (gs || 0) + 0.0722 * (bs || 0);
  }

  /**
   * Check keyboard navigation compliance
   */
  private checkKeyboardNavigation(container: HTMLElement): WCAGViolation[] {
    const violations: WCAGViolation[] = [];
    const interactiveElements = container.querySelectorAll('button, input, select, textarea, a, [tabindex], [onclick]');

    interactiveElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      
      // Check if element is keyboard accessible
      const tabIndex = htmlElement.getAttribute('tabindex');
      const isKeyboardAccessible = tabIndex !== '-1' && 
        (htmlElement.tagName === 'BUTTON' || 
         htmlElement.tagName === 'INPUT' || 
         htmlElement.tagName === 'SELECT' || 
         htmlElement.tagName === 'TEXTAREA' || 
         htmlElement.tagName === 'A' || 
         tabIndex !== null);

      if (!isKeyboardAccessible) {
        violations.push({
          level: 'A',
          guideline: '2.1 Keyboard Accessible',
          criterion: '2.1.1 Keyboard',
          element: htmlElement,
          description: 'Interactive element is not keyboard accessible',
          suggestion: 'Add tabindex="0" or ensure element is naturally focusable',
          severity: 'error'
        });
      }

      // Check for visible focus indicator
      const styles = window.getComputedStyle(htmlElement, ':focus');
      const hasVisibleFocus = styles.outline !== 'none' && styles.outline !== '0px';
      
      if (!hasVisibleFocus) {
        violations.push({
          level: 'AA',
          guideline: '2.4 Navigable',
          criterion: '2.4.7 Focus Visible',
          element: htmlElement,
          description: 'Interactive element lacks visible focus indicator',
          suggestion: 'Add CSS :focus styles with visible outline or border',
          severity: 'warning'
        });
      }
    });

    return violations;
  }

  /**
   * Check ARIA labels and descriptions
   */
  private checkAriaLabels(container: HTMLElement): WCAGViolation[] {
    const violations: WCAGViolation[] = [];
    const elementsNeedingLabels = container.querySelectorAll('input, button, select, textarea, [role="button"], [role="checkbox"], [role="radio"]');

    elementsNeedingLabels.forEach(element => {
      const htmlElement = element as HTMLElement;
      
      const hasLabel = 
        htmlElement.getAttribute('aria-label') ||
        htmlElement.getAttribute('aria-labelledby') ||
        htmlElement.getAttribute('title') ||
        ((htmlElement as HTMLInputElement).labels?.length || 0) > 0 ||
        htmlElement.textContent?.trim();

      if (!hasLabel) {
        violations.push({
          level: 'A',
          guideline: '4.1 Compatible',
          criterion: '4.1.2 Name, Role, Value',
          element: htmlElement,
          description: 'Interactive element lacks accessible name',
          suggestion: 'Add aria-label, aria-labelledby, or associate with a label element',
          severity: 'error'
        });
      }

      // Check for proper ARIA usage
      const role = htmlElement.getAttribute('role');
      if (role && !this.isValidAriaRole(role)) {
        violations.push({
          level: 'A',
          guideline: '4.1 Compatible',
          criterion: '4.1.2 Name, Role, Value',
          element: htmlElement,
          description: `Invalid ARIA role: ${role}`,
          suggestion: 'Use a valid ARIA role or remove the role attribute',
          severity: 'error'
        });
      }
    });

    return violations;
  }

  /**
   * Check heading structure
   */
  private checkHeadingStructure(container: HTMLElement): WCAGViolation[] {
    const violations: WCAGViolation[] = [];
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
    
    let previousLevel = 0;
    
    headings.forEach(heading => {
      const htmlElement = heading as HTMLElement;
      let currentLevel: number;
      
      if (htmlElement.hasAttribute('role')) {
        const ariaLevel = htmlElement.getAttribute('aria-level');
        currentLevel = ariaLevel ? parseInt(ariaLevel) : 1;
      } else {
        currentLevel = parseInt(htmlElement.tagName.charAt(1));
      }
      
      // Check for skipped heading levels
      if (previousLevel > 0 && currentLevel > previousLevel + 1) {
        violations.push({
          level: 'AA',
          guideline: '1.3 Adaptable',
          criterion: '1.3.1 Info and Relationships',
          element: htmlElement,
          description: `Heading level ${currentLevel} follows level ${previousLevel}, skipping levels`,
          suggestion: 'Use sequential heading levels without skipping',
          severity: 'warning'
        });
      }
      
      // Check for empty headings
      if (!htmlElement.textContent?.trim()) {
        violations.push({
          level: 'A',
          guideline: '2.4 Navigable',
          criterion: '2.4.6 Headings and Labels',
          element: htmlElement,
          description: 'Heading element is empty',
          suggestion: 'Provide descriptive heading text',
          severity: 'error'
        });
      }
      
      previousLevel = currentLevel;
    });

    return violations;
  }

  /**
   * Check form labels
   */
  private checkFormLabels(container: HTMLElement): WCAGViolation[] {
    const violations: WCAGViolation[] = [];
    const formControls = container.querySelectorAll('input:not([type="hidden"]), select, textarea');

    formControls.forEach(control => {
      const htmlElement = control as HTMLInputElement;
      
      const hasLabel =
        (htmlElement.labels?.length || 0) > 0 ||
        htmlElement.getAttribute('aria-label') ||
        htmlElement.getAttribute('aria-labelledby') ||
        htmlElement.getAttribute('title');

      if (!hasLabel) {
        violations.push({
          level: 'A',
          guideline: '3.3 Input Assistance',
          criterion: '3.3.2 Labels or Instructions',
          element: htmlElement,
          description: 'Form control lacks associated label',
          suggestion: 'Associate with a label element or add aria-label',
          severity: 'error'
        });
      }

      // Check for required field indication
      if (htmlElement.required && !htmlElement.getAttribute('aria-required')) {
        violations.push({
          level: 'A',
          guideline: '3.3 Input Assistance',
          criterion: '3.3.2 Labels or Instructions',
          element: htmlElement,
          description: 'Required field not properly indicated',
          suggestion: 'Add aria-required="true" or visual required indicator',
          severity: 'warning'
        });
      }
    });

    return violations;
  }

  /**
   * Check image alt text
   */
  private checkImageAltText(container: HTMLElement): WCAGViolation[] {
    const violations: WCAGViolation[] = [];
    const images = container.querySelectorAll('img, [role="img"]');

    images.forEach(image => {
      const htmlElement = image as HTMLImageElement;
      
      const hasAltText = 
        htmlElement.getAttribute('alt') !== null ||
        htmlElement.getAttribute('aria-label') ||
        htmlElement.getAttribute('aria-labelledby');

      if (!hasAltText) {
        violations.push({
          level: 'A',
          guideline: '1.1 Text Alternatives',
          criterion: '1.1.1 Non-text Content',
          element: htmlElement,
          description: 'Image lacks alternative text',
          suggestion: 'Add alt attribute with descriptive text or alt="" for decorative images',
          severity: 'error'
        });
      }
    });

    return violations;
  }

  /**
   * Check focus management
   */
  private checkFocusManagement(container: HTMLElement): WCAGViolation[] {
    const violations: WCAGViolation[] = [];

    // Check for focus traps in modals
    const modals = container.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    modals.forEach(modal => {
      const modalElement = modal as HTMLElement;
      const modalFocusableElements = modalElement.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])');
      
      if (modalFocusableElements.length === 0) {
        violations.push({
          level: 'AA',
          guideline: '2.4 Navigable',
          criterion: '2.4.3 Focus Order',
          element: modalElement,
          description: 'Modal dialog contains no focusable elements',
          suggestion: 'Ensure modal has at least one focusable element',
          severity: 'error'
        });
      }
    });

    return violations;
  }

  /**
   * Check landmark regions
   */
  private checkLandmarks(container: HTMLElement): WCAGViolation[] {
    const violations: WCAGViolation[] = [];
    
    // Check for main landmark
    const mainLandmarks = container.querySelectorAll('main, [role="main"]');
    if (mainLandmarks.length === 0) {
      violations.push({
        level: 'AA',
        guideline: '1.3 Adaptable',
        criterion: '1.3.1 Info and Relationships',
        element: container,
        description: 'Page lacks main landmark',
        suggestion: 'Add <main> element or role="main"',
        severity: 'warning'
      });
    } else if (mainLandmarks.length > 1) {
      violations.push({
        level: 'AA',
        guideline: '1.3 Adaptable',
        criterion: '1.3.1 Info and Relationships',
        element: container,
        description: 'Multiple main landmarks found',
        suggestion: 'Use only one main landmark per page',
        severity: 'warning'
      });
    }

    return violations;
  }

  /**
   * Check text alternatives
   */
  private checkTextAlternatives(container: HTMLElement): WCAGViolation[] {
    const violations: WCAGViolation[] = [];
    
    // Check for text that might be too small
    const textElements = container.querySelectorAll('p, span, div, li');
    textElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      const styles = window.getComputedStyle(htmlElement);
      const fontSize = parseFloat(styles.fontSize);
      
      if (fontSize < 12) {
        violations.push({
          level: 'AA',
          guideline: '1.4 Distinguishable',
          criterion: '1.4.4 Resize text',
          element: htmlElement,
          description: `Text size ${fontSize}px may be too small`,
          suggestion: 'Use minimum 12px font size for better readability',
          severity: 'warning'
        });
      }
    });

    return violations;
  }

  /**
   * Check error identification
   */
  private checkErrorIdentification(container: HTMLElement): WCAGViolation[] {
    const violations: WCAGViolation[] = [];
    const invalidElements = container.querySelectorAll('[aria-invalid="true"]');

    invalidElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      
      const hasErrorMessage = 
        htmlElement.getAttribute('aria-describedby') ||
        htmlElement.getAttribute('aria-errormessage') ||
        htmlElement.parentElement?.querySelector('.error-message');

      if (!hasErrorMessage) {
        violations.push({
          level: 'A',
          guideline: '3.3 Input Assistance',
          criterion: '3.3.1 Error Identification',
          element: htmlElement,
          description: 'Invalid field lacks error description',
          suggestion: 'Add aria-describedby pointing to error message',
          severity: 'error'
        });
      }
    });

    return violations;
  }

  /**
   * Check if ARIA role is valid
   */
  private isValidAriaRole(role: string): boolean {
    const validRoles = [
      'alert', 'alertdialog', 'application', 'article', 'banner', 'button',
      'cell', 'checkbox', 'columnheader', 'combobox', 'complementary',
      'contentinfo', 'definition', 'dialog', 'directory', 'document',
      'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading',
      'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main',
      'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox',
      'menuitemradio', 'navigation', 'none', 'note', 'option', 'presentation',
      'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
      'rowheader', 'scrollbar', 'search', 'searchbox', 'separator',
      'slider', 'spinbutton', 'status', 'switch', 'tab', 'table',
      'tablist', 'tabpanel', 'term', 'textbox', 'timer', 'toolbar',
      'tooltip', 'tree', 'treegrid', 'treeitem'
    ];
    
    return validRoles.includes(role);
  }

  /**
   * Get last audit results
   */
  public getLastAuditResults(): WCAGAuditResult | null {
    return this.auditResults;
  }

  /**
   * Set target compliance level
   */
  public setTargetLevel(level: 'A' | 'AA' | 'AAA'): void {
    this.targetLevel = level;
  }

  /**
   * Get current target level
   */
  public getTargetLevel(): 'A' | 'AA' | 'AAA' {
    return this.targetLevel;
  }

  /**
   * Generate accessibility report
   */
  public generateReport(): string {
    if (!this.auditResults) {
      return 'No audit results available. Run audit first.';
    }

    const { passed, violations, warnings, score, testedElements } = this.auditResults;
    
    let report = `WCAG ${this.targetLevel} Compliance Report\n`;
    report += `================================\n\n`;
    report += `Overall Score: ${score}/100\n`;
    report += `Status: ${passed ? 'PASSED' : 'FAILED'}\n`;
    report += `Elements Tested: ${testedElements}\n`;
    report += `Violations: ${violations.length}\n`;
    report += `Warnings: ${warnings.length}\n\n`;

    if (violations.length > 0) {
      report += `VIOLATIONS:\n`;
      report += `-----------\n`;
      violations.forEach((violation, index) => {
        report += `${index + 1}. ${violation.criterion}\n`;
        report += `   Description: ${violation.description}\n`;
        report += `   Suggestion: ${violation.suggestion}\n`;
        report += `   Element: ${violation.element.tagName}\n\n`;
      });
    }

    if (warnings.length > 0) {
      report += `WARNINGS:\n`;
      report += `---------\n`;
      warnings.forEach((warning, index) => {
        report += `${index + 1}. ${warning.criterion}\n`;
        report += `   Description: ${warning.description}\n`;
        report += `   Suggestion: ${warning.suggestion}\n\n`;
      });
    }

    return report;
  }

  /**
   * Cleanup and destroy
   */
  public destroy(): void {
    this.auditResults = null;
    this.removeAllListeners();
  }
}