import { ScreenReaderSupport } from '../screen-reader-support';

describe('ScreenReaderSupport', () => {
  let screenReader: ScreenReaderSupport;

  beforeEach(() => {
    screenReader = new ScreenReaderSupport();
  });

  afterEach(() => {
    screenReader.destroy();
  });

  describe('Initialization', () => {
    test('should create live regions on initialization', () => {
      expect(document.getElementById('aria-live-polite')).toBeTruthy();
      expect(document.getElementById('aria-live-assertive')).toBeTruthy();
      expect(document.getElementById('aria-live-status')).toBeTruthy();
    });

    test('should detect screen reader presence', () => {
      expect(screenReader.isScreenReaderActive()).toBeDefined();
    });
  });

  describe('Announcements', () => {
    test('should announce text to appropriate live region', async () => {
      screenReader.setActive(true);
      screenReader.announce('Test message', 'polite');

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('aria-live-polite');
      expect(politeRegion?.textContent).toBe('Test message');
    });

    test('should handle different announcement priorities', async () => {
      screenReader.setActive(true);
      
      screenReader.announce('Polite message', 'polite');
      screenReader.announce('Assertive message', 'assertive');
      screenReader.announce('Status message', 'status');

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(document.getElementById('aria-live-polite')?.textContent).toBe('Polite message');
      expect(document.getElementById('aria-live-assertive')?.textContent).toBe('Assertive message');
      expect(document.getElementById('aria-live-status')?.textContent).toBe('Status message');
    });

    test('should emit announced events', () => {
      const announcedHandler = jest.fn();
      screenReader.on('announced', announcedHandler);

      screenReader.announce('Test message', 'polite');

      expect(announcedHandler).toHaveBeenCalledWith({
        text: 'Test message',
        priority: 'polite',
        interrupt: false
      });
    });

    test('should handle interrupt announcements', async () => {
      screenReader.setActive(true);
      
      screenReader.announce('First message', 'polite');
      screenReader.announce('Interrupt message', 'assertive', true);

      await new Promise(resolve => setTimeout(resolve, 200));

      const assertiveRegion = document.getElementById('aria-live-assertive');
      expect(assertiveRegion?.textContent).toBe('Interrupt message');
    });

    test('should not announce when inactive', () => {
      screenReader.setActive(false);
      screenReader.announce('Test message', 'polite');

      const politeRegion = document.getElementById('aria-live-polite');
      expect(politeRegion?.textContent).toBe('');
    });
  });

  describe('Specialized Announcements', () => {
    beforeEach(() => {
      screenReader.setActive(true);
    });

    test('should announce navigation changes', () => {
      const announcedHandler = jest.fn();
      screenReader.on('announced', announcedHandler);

      screenReader.announceNavigation('Home', 'Settings');

      expect(announcedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Navigated from Home to Settings'
        })
      );
    });

    test('should announce focus changes with element details', () => {
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Submit form');
      button.textContent = 'Submit';

      const announcedHandler = jest.fn();
      screenReader.on('announced', announcedHandler);

      screenReader.announceFocus(button);

      expect(announcedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Submit form')
        })
      );
    });

    test('should announce form errors with high priority', () => {
      const announcedHandler = jest.fn();
      screenReader.on('announced', announcedHandler);

      screenReader.announceFormError('Email', 'Invalid email format');

      expect(announcedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Error in Email: Invalid email format',
          priority: 'assertive',
          interrupt: true
        })
      );
    });

    test('should announce loading states', () => {
      const announcedHandler = jest.fn();
      screenReader.on('announced', announcedHandler);

      screenReader.announceLoading(true, 'user data');
      expect(announcedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Loading user data...',
          priority: 'status'
        })
      );

      screenReader.announceLoading(false, 'user data');
      expect(announcedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Finished loading user data'
        })
      );
    });

    test('should announce progress updates', () => {
      const announcedHandler = jest.fn();
      screenReader.on('announced', announcedHandler);

      screenReader.announceProgress(3, 10, 'file upload');

      expect(announcedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Progress for file upload: 30% complete, 3 of 10',
          priority: 'status'
        })
      );
    });
  });

  describe('Element Description', () => {
    test('should get element description from aria-label', () => {
      const element = document.createElement('button');
      element.setAttribute('aria-label', 'Close dialog');

      screenReader.announceFocus(element);

      const announcedHandler = jest.fn();
      screenReader.on('announced', announcedHandler);
      screenReader.announceFocus(element);

      expect(announcedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Close dialog')
        })
      );
    });

    test('should get element description from text content', () => {
      const element = document.createElement('button');
      element.textContent = 'Save Changes';

      const announcedHandler = jest.fn();
      screenReader.on('announced', announcedHandler);
      screenReader.announceFocus(element);

      expect(announcedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Save Changes')
        })
      );
    });

    test('should identify element roles correctly', () => {
      const button = document.createElement('button');
      const input = document.createElement('input');
      input.type = 'text';

      const announcedHandler = jest.fn();
      screenReader.on('announced', announcedHandler);

      screenReader.announceFocus(button);
      expect(announcedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('button')
        })
      );

      screenReader.announceFocus(input);
      expect(announcedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('textbox')
        })
      );
    });

    test('should announce element states', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.setAttribute('aria-checked', 'true');
      checkbox.setAttribute('aria-label', 'Enable notifications');

      const announcedHandler = jest.fn();
      screenReader.on('announced', announcedHandler);
      screenReader.announceFocus(checkbox);

      expect(announcedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('checked')
        })
      );
    });
  });

  describe('Queue Management', () => {
    test('should process announcement queue in order', async () => {
      screenReader.setActive(true);
      
      const performedHandler = jest.fn();
      screenReader.on('announcementPerformed', performedHandler);

      screenReader.announce('First message', 'polite');
      screenReader.announce('Second message', 'polite');
      screenReader.announce('Third message', 'polite');

      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(performedHandler).toHaveBeenCalledTimes(3);
    });

    test('should clear announcements', () => {
      screenReader.announce('Test message', 'polite');
      expect(screenReader.getQueueLength()).toBeGreaterThan(0);

      screenReader.clearAnnouncements();
      expect(screenReader.getQueueLength()).toBe(0);

      const politeRegion = document.getElementById('aria-live-polite');
      expect(politeRegion?.textContent).toBe('');
    });
  });

  describe('State Management', () => {
    test('should toggle active state', () => {
      const stateChangedHandler = jest.fn();
      screenReader.on('activeStateChanged', stateChangedHandler);

      screenReader.setActive(false);
      expect(screenReader.isScreenReaderActive()).toBe(false);
      expect(stateChangedHandler).toHaveBeenCalledWith(false);

      screenReader.setActive(true);
      expect(screenReader.isScreenReaderActive()).toBe(true);
      expect(stateChangedHandler).toHaveBeenCalledWith(true);
    });

    test('should report queue length', () => {
      screenReader.announce('Message 1', 'polite');
      screenReader.announce('Message 2', 'polite');
      
      expect(screenReader.getQueueLength()).toBe(2);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup properly when destroyed', () => {
      const politeRegion = document.getElementById('aria-live-polite');
      const assertiveRegion = document.getElementById('aria-live-assertive');
      const statusRegion = document.getElementById('aria-live-status');

      expect(politeRegion).toBeTruthy();
      expect(assertiveRegion).toBeTruthy();
      expect(statusRegion).toBeTruthy();

      screenReader.destroy();

      expect(document.getElementById('aria-live-polite')).toBeFalsy();
      expect(document.getElementById('aria-live-assertive')).toBeFalsy();
      expect(document.getElementById('aria-live-status')).toBeFalsy();
      expect(screenReader.listenerCount('announced')).toBe(0);
    });
  });
});