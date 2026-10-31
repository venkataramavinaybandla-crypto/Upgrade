// ROLE: Consolidates and re-exports all concrete infrastructure adapters for ports.
// INPUTS: Exports from ./env.js, ./fs-read.js, ./prompt.js, ./recent-store.js, ./logger.js.
// CRITICAL: May only be imported by src/main.ts and test suites.

export * from './env.js';
export * from './fs-read.js';
export * from './prompt.js';
export * from './recent-store.js';
export * from './logger.js';

