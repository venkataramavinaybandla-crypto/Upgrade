// ROLE: Re-exports all application use-cases, error types, and dependency contracts.
// INPUTS: Exports from ./errors.js, ./consent.js, ./resolve-workspace.js, ./doctor.js, ./scan.js.
// CRITICAL: Provides the consolidated interface for the CLI layer without leaking core internals.

export * from './errors.js';
export * from './consent.js';
export * from './resolve-workspace.js';
export * from './doctor.js';
export * from './scan.js';

