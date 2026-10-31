// ROLE: Tests terminal host classification across 13 distinct environment configurations.
// INPUTS: Table of plain-object EnvSnapshot mocks.
// CRITICAL: Asserts variable names only are recorded in signals and never env values.

import { describe, it, expect } from 'vitest';
import { classifyHost } from '../src/core/env/index.js';
import type { EnvSnapshot } from '../src/contracts/index.js';

describe('classifyHost (src/core/env)', () => {
  const baseSnapshot = (overrides: Partial<EnvSnapshot> = {}): EnvSnapshot => ({
    names: [],
    values: {},
    platform: 'win32',
    isWsl: false,
    isTty: true,
    cwd: 'C:\\test\\workspace',
    ...overrides
  });

  const testCases: Array<{
    name: string;
    snapshot: EnvSnapshot;
    expectedHost: string;
    expectedKind: string;
    expectedConfidence?: string;
    expectedSignal?: string;
  }> = [
    {
      name: 'authoritative Antigravity IDE terminal',
      snapshot: baseSnapshot({
        names: [
          'VSCODE_PYTHON_AUTOACTIVATE_GUARD',
          'TERM_PROGRAM',
          'TERM_PROGRAM_VERSION',
          'COLORTERM',
          'ANTIGRAVITY_CLI_ALIAS',
          'VSCODE_GIT_ASKPASS_NODE',
          'VSCODE_GIT_ASKPASS_EXTRA_ARGS',
          'VSCODE_GIT_ASKPASS_MAIN',
          'VSCODE_GIT_IPC_HANDLE',
          'VSCODE_INJECTION'
        ],
        values: { TERM_PROGRAM: 'vscode' }
      }),
      expectedHost: 'antigravity',
      expectedKind: 'ide-terminal',
      expectedConfidence: 'high',
      expectedSignal: 'ANTIGRAVITY_CLI_ALIAS'
    },
    {
      name: 'Antigravity agent shell',
      snapshot: baseSnapshot({
        names: ['ANTIGRAVITY_AGENT', 'ANTIGRAVITY_CLI_ALIAS'],
        values: {}
      }),
      expectedHost: 'antigravity',
      expectedKind: 'agent-shell',
      expectedConfidence: 'medium',
      expectedSignal: 'ANTIGRAVITY_AGENT'
    },
    {
      name: 'vanilla VS Code',
      snapshot: baseSnapshot({
        names: ['TERM_PROGRAM', 'VSCODE_PID'],
        values: { TERM_PROGRAM: 'vscode' }
      }),
      expectedHost: 'vscode',
      expectedKind: 'ide-terminal',
      expectedConfidence: 'high',
      expectedSignal: 'TERM_PROGRAM'
    },
    {
      name: 'Cursor',
      snapshot: baseSnapshot({
        names: ['CURSOR_TRACE_ID', 'TERM_PROGRAM'],
        values: { TERM_PROGRAM: 'vscode' }
      }),
      expectedHost: 'cursor',
      expectedKind: 'ide-terminal',
      expectedConfidence: 'high',
      expectedSignal: 'CURSOR_TRACE_ID'
    },
    {
      name: 'Windsurf',
      snapshot: baseSnapshot({
        names: ['CODEIUM_EDITOR_APP_ROOT', 'TERM_PROGRAM'],
        values: { TERM_PROGRAM: 'vscode' }
      }),
      expectedHost: 'windsurf',
      expectedKind: 'ide-terminal',
      expectedConfidence: 'high',
      expectedSignal: 'CODEIUM_EDITOR_APP_ROOT'
    },
    {
      name: 'JetBrains',
      snapshot: baseSnapshot({
        names: ['TERMINAL_EMULATOR'],
        values: { TERMINAL_EMULATOR: 'JetBrains-JediTerm' }
      }),
      expectedHost: 'jetbrains',
      expectedKind: 'ide-terminal',
      expectedConfidence: 'high',
      expectedSignal: 'TERMINAL_EMULATOR'
    },
    {
      name: 'Zed',
      snapshot: baseSnapshot({
        names: ['TERM_PROGRAM'],
        values: { TERM_PROGRAM: 'zed' }
      }),
      expectedHost: 'zed',
      expectedKind: 'ide-terminal',
      expectedConfidence: 'high',
      expectedSignal: 'TERM_PROGRAM'
    },
    {
      name: 'Windows Terminal',
      snapshot: baseSnapshot({
        names: ['WT_SESSION', 'PSModulePath'],
        values: {}
      }),
      expectedHost: 'windows-terminal',
      expectedKind: 'plain-terminal',
      expectedConfidence: 'high',
      expectedSignal: 'WT_SESSION'
    },
    {
      name: 'Bare PowerShell',
      snapshot: baseSnapshot({
        names: ['PSModulePath'],
        values: {}
      }),
      expectedHost: 'powershell',
      expectedKind: 'plain-terminal'
    },
    {
      name: 'Bare cmd',
      snapshot: baseSnapshot({
        names: ['PROMPT', 'COMSPEC'],
        values: {}
      }),
      expectedHost: 'cmd',
      expectedKind: 'plain-terminal'
    },
    {
      name: 'WSL bash',
      snapshot: baseSnapshot({
        names: ['BASH_VERSION'],
        values: {},
        platform: 'linux',
        isWsl: true
      }),
      expectedHost: 'bash',
      expectedKind: 'plain-terminal'
    },
    {
      name: 'Non-TTY pipe',
      snapshot: baseSnapshot({
        names: ['PSModulePath'],
        values: {},
        isTty: false
      }),
      expectedHost: 'powershell',
      expectedKind: 'non-interactive'
    },
    {
      name: 'Plain terminal launched from an IDE (leaked IDE vars)',
      snapshot: baseSnapshot({
        names: ['VSCODE_INJECTION', 'VSCODE_GIT_IPC_HANDLE'],
        values: {}
      }),
      expectedHost: 'vscode',
      expectedKind: 'ide-terminal',
      expectedConfidence: 'medium'
    }
  ];

  testCases.forEach(({ name, snapshot, expectedHost, expectedKind, expectedConfidence, expectedSignal }) => {
    it(`classifies ${name}`, () => {
      const result = classifyHost(snapshot);
      expect(result.host).toBe(expectedHost);
      expect(result.kind).toBe(expectedKind);
      if (expectedConfidence) {
        expect(result.confidence).toBe(expectedConfidence);
      }
      if (expectedSignal) {
        expect(result.signals).toContain(expectedSignal);
      }
      // Ensure signals contains ONLY names, never values
      for (const sig of result.signals) {
        expect(snapshot.names).toContain(sig);
      }
    });
  });
});

