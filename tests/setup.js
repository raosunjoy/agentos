"use strict";
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;
beforeAll(() => {
    console.error = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
});
afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
});
global.testUtils = {
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    generateId: () => Math.random().toString(36).substring(2, 15),
    createMockConfig: () => ({
        version: '0.1.0',
        environment: 'test',
        logLevel: 'error',
        enablePlugins: false,
        enableSecurity: false,
        enablePerformanceOptimization: false,
        enableVoiceInterface: false,
        enableCaregiverSystem: false,
        maxMemoryUsage: 128 * 1024 * 1024,
        maxCPUUsage: 50,
        pluginSandbox: false,
        securityLevel: 'low',
        nlp: {
            confidenceThreshold: 0.5,
            cacheSize: 10,
            enableElderlyOptimizations: false,
            supportedLanguages: ['en']
        },
        voice: {
            wakeWord: 'test',
            speechRate: 1.0,
            pitch: 1.0,
            volume: 0.5
        },
        performance: {
            adaptiveScaling: false,
            batteryOptimization: false,
            thermalManagement: false,
            memoryManagement: false
        }
    }),
    mockMemoryUsage: () => ({
        rss: 50 * 1024 * 1024,
        heapTotal: 30 * 1024 * 1024,
        heapUsed: 20 * 1024 * 1024,
        external: 5 * 1024 * 1024
    })
};
expect.extend({
    toBeValidTimestamp(received) {
        const pass = received > 0 && received <= Date.now();
        return {
            message: () => `expected ${received} to be a valid timestamp`,
            pass
        };
    }
});
//# sourceMappingURL=setup.js.map