import { WCAGCompliance } from '../wcag-compliance';

describe('WCAGCompliance', () => {
  let wcag: WCAGCompliance;
  let container: HTMLElement;

  beforeEach(() => {
    wcag = new WCAGCompliance('AA');
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    wcag.destroy();
    document.body.removeChild(container);
  });

  describe('Initialization', () => {
    test('should initialize with target level', () => {
      expect(wcag.getTargetLevel()).toBe('AA');
    });

    test('should allow changing target level', () => {
      wcag.setTargetLevel('AAA');
      expect(wcag.getTargetLevel()).toBe('AAA');
    });
  });

  describe('ARIA Labels Audit', () => {
    test('should detect missing labels on buttons', async () => {
      container.innerHTML = '<button></button>';
      
      const results = await wcag.auditContainer(container);
      
      const labelViolations = results.violations.filter(v => 
        v.criterion === '4.1.2 Name, Role, Value'
      );
      
      expect(labelViolations.length).toBeGreaterThan(0);
      expect(labelViolations[0].description).toContain('lacks accessible name');
    });

    test('should pass for properly labeled buttons', async () => {
      container.innerHTML = '<button aria-label="Submit form">Submit</button>';
      
      const results = await wcag.auditContainer(container);
      
      const labelViolations = results.violations.filter(v => 
        v.criterion === '4.1.2 Name, Role, Value'
      );
      
      expect(labelViolations.length).toBe(0);
    });

    test('should detect invalid ARIA roles', async () => {
      container.innerHTML = '<div role="invalid-role">Content</div>';
      
      const results = await wcag.auditContainer(container);
      
      const roleViolations = results.violations.filter(v => 
        v.description.includes('Invalid ARIA role')
      );
      
      expect(roleViolations.length).toBeGreaterThan(0);
    });
  });

  describe('Heading Structure Audit', () => {
    test('should detect skipped heading levels', async () => {
      container.innerHTML = `
        <h1>Main Title</h1>
        <h3>Skipped H2</h3>
      `;
      
      const results = await wcag.auditContainer(container);
      
      const headingViolations = results.warnings.filter(v => 
        v.description.includes('skipping levels')
      );
      
      expect(headingViolations.length).toBeGreaterThan(0);
    });

    test('should detect empty headings', async () => {
      container.innerHTML = '<h1></h1>';
      
      const results = await wcag.auditContainer(container);
      
      const emptyHeadingViolations = results.violations.filter(v => 
        v.description.includes('empty')
      );
      
      expect(emptyHeadingViolations.length).toBeGreaterThan(0);
    });

    test('should pass for proper heading structure', async () => {
      container.innerHTML = `
        <h1>Main Title</h1>
        <h2>Section Title</h2>
        <h3>Subsection Title</h3>
      `;
      
      const results = await wcag.auditContainer(container);
      
      const headingViolations = results.violations.filter(v => 
        v.guideline === '1.3 Adaptable'
      );
      
      expect(headingViolations.length).toBe(0);
    });
  });

  describe('Form Labels Audit', () => {
    test('should detect unlabeled form controls', async () => {
      container.innerHTML = '<input type="text">';
      
      const results = await wcag.auditContainer(container);
      
      const formViolations = results.violations.filter(v => 
        v.criterion === '3.3.2 Labels or Instructions'
      );
      
      expect(formViolations.length).toBeGreaterThan(0);
    });

    test('should pass for properly labeled form controls', async () => {
      container.innerHTML = `
        <label for="email">Email:</label>
        <input type="email" id="email">
      `;
      
      const results = await wcag.auditContainer(container);
      
      const formViolations = results.violations.filter(v => 
        v.criterion === '3.3.2 Labels or Instructions'
      );
      
      expect(formViolations.length).toBe(0);
    });

    test('should detect missing required field indicators', async () => {
      container.innerHTML = '<input type="text" required>';
      
      const results = await wcag.auditContainer(container);
      
      const requiredViolations = results.warnings.filter(v => 
        v.description.includes('Required field not properly indicated')
      );
      
      expect(requiredViolations.length).toBeGreaterThan(0);
    });
  });

  describe('Image Alt Text Audit', () => {
    test('should detect images without alt text', async () => {
      container.innerHTML = '<img src="test.jpg">';
      
      const results = await wcag.auditContainer(container);
      
      const altViolations = results.violations.filter(v => 
        v.criterion === '1.1.1 Non-text Content'
      );
      
      expect(altViolations.length).toBeGreaterThan(0);
    });

    test('should pass for images with alt text', async () => {
      container.innerHTML = '<img src="test.jpg" alt="Test image">';
      
      const results = await wcag.auditContainer(container);
      
      const altViolations = results.violations.filter(v => 
        v.criterion === '1.1.1 Non-text Content'
      );
      
      expect(altViolations.length).toBe(0);
    });
  });

  describe('Keyboard Navigation Audit', () => {
    test('should detect non-keyboard accessible elements', async () => {
      container.innerHTML = '<div onclick="doSomething()">Clickable</div>';
      
      const results = await wcag.auditContainer(container);
      
      const keyboardViolations = results.violations.filter(v => 
        v.criterion === '2.1.1 Keyboard'
      );
      
      expect(keyboardViolations.length).toBeGreaterThan(0);
    });

    test('should pass for keyboard accessible elements', async () => {
      container.innerHTML = '<button onclick="doSomething()">Clickable</button>';
      
      const results = await wcag.auditContainer(container);
      
      const keyboardViolations = results.violations.filter(v => 
        v.criterion === '2.1.1 Keyboard'
      );
      
      expect(keyboardViolations.length).toBe(0);
    });
  });

  describe('Focus Management Audit', () => {
    test('should detect modals without focusable elements', async () => {
      container.innerHTML = '<div role="dialog"><p>No focusable content</p></div>';
      
      const results = await wcag.auditContainer(container);
      
      const focusViolations = results.violations.filter(v => 
        v.description.includes('no focusable elements')
      );
      
      expect(focusViolations.length).toBeGreaterThan(0);
    });

    test('should pass for modals with focusable elements', async () => {
      container.innerHTML = `
        <div role="dialog">
          <button>Close</button>
          <p>Modal content</p>
        </div>
      `;
      
      const results = await wcag.auditContainer(container);
      
      const focusViolations = results.violations.filter(v => 
        v.description.includes('no focusable elements')
      );
      
      expect(focusViolations.length).toBe(0);
    });
  });

  describe('Landmark Audit', () => {
    test('should detect missing main landmark', async () => {
      container.innerHTML = '<div>Content without main</div>';
      
      const results = await wcag.auditContainer(container);
      
      const landmarkViolations = results.warnings.filter(v => 
        v.description.includes('lacks main landmark')
      );
      
      expect(landmarkViolations.length).toBeGreaterThan(0);
    });

    test('should detect multiple main landmarks', async () => {
      container.innerHTML = `
        <main>First main</main>
        <main>Second main</main>
      `;
      
      const results = await wcag.auditContainer(container);
      
      const landmarkViolations = results.warnings.filter(v => 
        v.description.includes('Multiple main landmarks')
      );
      
      expect(landmarkViolations.length).toBeGreaterThan(0);
    });

    test('should pass for single main landmark', async () => {
      container.innerHTML = '<main>Main content</main>';
      
      const results = await wcag.auditContainer(container);
      
      const landmarkViolations = results.warnings.filter(v => 
        v.description.includes('main landmark')
      );
      
      expect(landmarkViolations.length).toBe(0);
    });
  });

  describe('Error Identification Audit', () => {
    test('should detect invalid fields without error messages', async () => {
      container.innerHTML = '<input type="email" aria-invalid="true">';
      
      const results = await wcag.auditContainer(container);
      
      const errorViolations = results.violations.filter(v => 
        v.criterion === '3.3.1 Error Identification'
      );
      
      expect(errorViolations.length).toBeGreaterThan(0);
    });

    test('should pass for invalid fields with error messages', async () => {
      container.innerHTML = `
        <input type="email" aria-invalid="true" aria-describedby="email-error">
        <div id="email-error">Please enter a valid email</div>
      `;
      
      const results = await wcag.auditContainer(container);
      
      const errorViolations = results.violations.filter(v => 
        v.criterion === '3.3.1 Error Identification'
      );
      
      expect(errorViolations.length).toBe(0);
    });
  });

  describe('Audit Results', () => {
    test('should calculate compliance score', async () => {
      container.innerHTML = `
        <main>
          <h1>Title</h1>
          <button aria-label="Submit">Submit</button>
          <img src="test.jpg" alt="Test">
        </main>
      `;
      
      const results = await wcag.auditContainer(container);
      
      expect(results.score).toBeGreaterThan(0);
      expect(results.score).toBeLessThanOrEqual(100);
      expect(results.testedElements).toBeGreaterThan(0);
    });

    test('should emit audit completed event', async () => {
      const auditCompletedHandler = jest.fn();
      wcag.on('auditCompleted', auditCompletedHandler);
      
      await wcag.auditContainer(container);
      
      expect(auditCompletedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          passed: expect.any(Boolean),
          violations: expect.any(Array),
          warnings: expect.any(Array),
          score: expect.any(Number)
        })
      );
    });

    test('should store last audit results', async () => {
      await wcag.auditContainer(container);
      
      const results = wcag.getLastAuditResults();
      expect(results).toBeTruthy();
      expect(results?.violations).toBeDefined();
      expect(results?.warnings).toBeDefined();
    });
  });

  describe('Report Generation', () => {
    test('should generate accessibility report', async () => {
      container.innerHTML = `
        <button></button>
        <img src="test.jpg">
      `;
      
      await wcag.auditContainer(container);
      const report = wcag.generateReport();
      
      expect(report).toContain('WCAG AA Compliance Report');
      expect(report).toContain('Overall Score:');
      expect(report).toContain('VIOLATIONS:');
    });

    test('should handle no audit results', () => {
      const report = wcag.generateReport();
      expect(report).toContain('No audit results available');
    });
  });

  describe('Different Compliance Levels', () => {
    test('should audit for AAA level', async () => {
      const wcagAAA = new WCAGCompliance('AAA');
      container.innerHTML = '<button aria-label="Test">Test</button>';
      
      const results = await wcagAAA.auditContainer(container);
      
      expect(results).toBeDefined();
      wcagAAA.destroy();
    });

    test('should audit for A level', async () => {
      const wcagA = new WCAGCompliance('A');
      container.innerHTML = '<button aria-label="Test">Test</button>';
      
      const results = await wcagA.auditContainer(container);
      
      expect(results).toBeDefined();
      wcagA.destroy();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup properly when destroyed', () => {
      const listenerCount = wcag.listenerCount('auditCompleted');
      wcag.destroy();
      
      expect(wcag.getLastAuditResults()).toBeNull();
      expect(wcag.listenerCount('auditCompleted')).toBe(0);
    });
  });
});