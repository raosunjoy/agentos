"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = async () => {
    console.log('Setting up AgentOS test environment...');
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    console.log('Test environment setup complete.');
};
//# sourceMappingURL=global-setup.js.map