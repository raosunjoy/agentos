declare const originalConsoleError: {
    (...data: any[]): void;
    (message?: any, ...optionalParams: any[]): void;
};
declare const originalConsoleWarn: {
    (...data: any[]): void;
    (message?: any, ...optionalParams: any[]): void;
};
declare const originalConsoleLog: {
    (...data: any[]): void;
    (message?: any, ...optionalParams: any[]): void;
};
declare global {
    namespace jest {
        interface Matchers<R> {
            toBeValidTimestamp(): R;
        }
    }
    var testUtils: {
        delay: (ms: number) => Promise<void>;
        generateId: () => string;
        createMockConfig: () => any;
        mockMemoryUsage: () => any;
    };
}
//# sourceMappingURL=setup.d.ts.map