// ROLE: Verifies Zod schema validation and type parsing for core data contracts.
// INPUTS: Sample valid and invalid contract objects.
// CRITICAL: Ensures contract schemas reject malformed objects before runtime execution.

import { describe, it, expect } from 'vitest';
import {
  EnvSnapshotSchema,
  HostContextSchema,
  WorkspaceRefSchema,
  ScanReportSchema
} from '../src/contracts/index.js';

describe('Contracts validation', () => {
  it('validates a correct EnvSnapshot', () => {
    const sample = {
      names: ['TERM_PROGRAM', 'TERM'],
      values: { TERM_PROGRAM: 'vscode' },
      platform: 'win32' as const,
      isWsl: false,
      isTty: true,
      cwd: 'C:\\projects\\demo'
    };
    const parsed = EnvSnapshotSchema.parse(sample);
    expect(parsed.platform).toBe('win32');
  });

  it('validates a correct HostContext', () => {
    const sample = {
      kind: 'ide-terminal' as const,
      host: 'antigravity' as const,
      signals: ['ANTIGRAVITY_CLI_ALIAS'],
      confidence: 'high' as const,
      os: 'win32' as const,
      isWsl: false,
      cwd: 'C:\\projects\\demo'
    };
    const parsed = HostContextSchema.parse(sample);
    expect(parsed.host).toBe('antigravity');
  });

  it('validates a correct WorkspaceRef', () => {
    const sample = {
      root: 'C:\\projects\\demo',
      source: 'cwd' as const,
      verdict: 'ok' as const,
      projectMarkers: ['package.json'],
      consentGranted: false
    };
    const parsed = WorkspaceRefSchema.parse(sample);
    expect(parsed.verdict).toBe('ok');
  });

  it('validates a refused WorkspaceRef', () => {
    const sample = {
      root: 'C:\\Windows',
      source: 'cwd' as const,
      verdict: 'refused' as const,
      refusalReason: 'system-dir' as const,
      projectMarkers: [],
      consentGranted: false
    };
    const parsed = WorkspaceRefSchema.parse(sample);
    expect(parsed.refusalReason).toBe('system-dir');
  });
});

