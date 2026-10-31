// ROLE: End-to-end verification of all Phase 1 exit criteria defined in architecture.json.
// INPUTS: Mock environments simulating IDE and plain terminals with fake recording FsRead.
// CRITICAL: Proves refused folders are never opened and plain terminals never scan cwd.

import { describe, it, expect, vi } from 'vitest';
import { runScanPhase1 } from '../src/app/scan.js';
import { runDoctorEnv } from '../src/app/doctor.js';
import type { FsRead, Env, Prompt, FileStat } from '../src/ports/index.js';
import type { EnvSnapshot } from '../src/contracts/index.js';

describe('Phase 1 Exit Criteria Verification', () => {
  // Exit Criterion 1: Table-driven tests over env maps for every host
  // (Full coverage is in test/env.test.ts, and verified here with doctor)
  it('Exit 1: Doctor correctly identifies Antigravity host and signals without values', () => {
    const mockEnv: Env = {
      names: vi.fn().mockReturnValue([
        'TERM_PROGRAM',
        'ANTIGRAVITY_CLI_ALIAS',
        'VSCODE_INJECTION',
        'SECRET_TOKEN'
      ]),
      get: vi.fn((key: string) => {
        if (key === 'TERM_PROGRAM') return 'vscode';
        if (key === 'SECRET_TOKEN') return 'secret123';
        return undefined;
      }),
      platform: vi.fn().mockReturnValue('win32'),
      cwd: vi.fn().mockReturnValue('C:\\projects\\demo'),
      homedir: vi.fn().mockReturnValue('C:\\Users\\alice'),
      isTty: vi.fn().mockReturnValue(true)
    };

    const buildSnapshot = (env: Env): EnvSnapshot => ({
      names: env.names(),
      values: { TERM_PROGRAM: env.get('TERM_PROGRAM')! },
      platform: env.platform(),
      isWsl: false,
      isTty: env.isTty(),
      cwd: env.cwd()
    });

    const result = runDoctorEnv({ env: mockEnv, buildSnapshot });
    expect(result.hostContext.host).toBe('antigravity');
    expect(result.hostContext.kind).toBe('ide-terminal');
    expect(result.hostContext.confidence).toBe('high');
    expect(result.hostContext.signals).toContain('ANTIGRAVITY_CLI_ALIAS');
    // Ensure no values exist in signals
    for (const sig of result.hostContext.signals) {
      expect(sig).not.toBe('vscode');
      expect(sig).not.toBe('secret123');
    }
  });

  // Exit Criterion 2: Plain terminal asks for a folder, never scans cwd
  it('Exit 2: Plain terminal asks for a folder and never scans cwd', async () => {
    const mockEnv: Env = {
      names: vi.fn().mockReturnValue(['PSModulePath']),
      get: vi.fn().mockReturnValue(undefined),
      platform: vi.fn().mockReturnValue('win32'),
      cwd: vi.fn().mockReturnValue('C:\\Users\\alice'),
      homedir: vi.fn().mockReturnValue('C:\\Users\\alice'),
      isTty: vi.fn().mockReturnValue(true)
    };

    const targetProject = 'C:/projects/user-selected-project';
    const fsRead: FsRead = {
      exists: vi.fn(async (p: string) => p.replace(/\\/g, '/') === targetProject),
      realpath: vi.fn(async (p: string) => p),
      stat: vi.fn(async () => ({ isFile: () => false, isDirectory: () => true, size: 0 } as FileStat)),
      readText: vi.fn(async () => ''),
      listDir: vi.fn(async () => [])
    };

    const prompt: Prompt = {
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn().mockResolvedValue(''),
      text: vi.fn().mockResolvedValue('C:\\projects\\user-selected-project'),
      pickFolder: vi.fn().mockResolvedValue(undefined)
    };

    const buildSnapshot = (env: Env): EnvSnapshot => ({
      names: env.names(),
      values: {},
      platform: env.platform(),
      isWsl: false,
      isTty: env.isTty(),
      cwd: env.cwd()
    });

    const result = await runScanPhase1({}, { fsRead, env: mockEnv, prompt, buildSnapshot });

    // Must prompt the user for input and NOT use mockEnv.cwd ('C:\Users\alice')
    expect(prompt.text).toHaveBeenCalled();
    expect(result.workspaceRef.root).toBe('C:\\projects\\user-selected-project');
    expect(result.workspaceRef.source).toBe('picked');
    expect(result.workspaceRef.root).not.toBe(mockEnv.cwd());
  });

  // Exit Criterion 3: IDE terminal confirms workspace
  it('Exit 3: IDE terminal confirms workspace with user before proceeding', async () => {
    const mockEnv: Env = {
      names: vi.fn().mockReturnValue(['ANTIGRAVITY_CLI_ALIAS', 'TERM_PROGRAM']),
      get: vi.fn((k: string) => (k === 'TERM_PROGRAM' ? 'vscode' : undefined)),
      platform: vi.fn().mockReturnValue('win32'),
      cwd: vi.fn().mockReturnValue('C:\\ide\\my-backend'),
      homedir: vi.fn().mockReturnValue('C:\\Users\\alice'),
      isTty: vi.fn().mockReturnValue(true)
    };

    const fsRead: FsRead = {
      exists: vi.fn(async () => true),
      realpath: vi.fn(async (p: string) => p),
      stat: vi.fn(async () => ({ isFile: () => false, isDirectory: () => true, size: 0 } as FileStat)),
      readText: vi.fn(async () => ''),
      listDir: vi.fn(async () => [])
    };

    const prompt: Prompt = {
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn().mockResolvedValue(''),
      text: vi.fn().mockResolvedValue(''),
      pickFolder: vi.fn().mockResolvedValue(undefined)
    };

    const buildSnapshot = (env: Env): EnvSnapshot => ({
      names: env.names(),
      values: { TERM_PROGRAM: 'vscode' },
      platform: env.platform(),
      isWsl: false,
      isTty: env.isTty(),
      cwd: env.cwd()
    });

    const result = await runScanPhase1({}, { fsRead, env: mockEnv, prompt, buildSnapshot });

    // Must prompt confirmation for the cwd
    expect(prompt.confirm).toHaveBeenCalledWith(expect.stringContaining('Working in C:\\ide\\my-backend. Right folder?'));
    expect(result.workspaceRef.root).toBe('C:\\ide\\my-backend');
    expect(result.workspaceRef.source).toBe('cwd');
  });

  // Exit Criterion 4: Refused folders are never read (assert with a fake FsRead that records opened paths)
  it('Exit 4: Refused folders are NEVER read', async () => {
    const openedPaths: string[] = [];

    const recordingFsRead: FsRead = {
      readText: vi.fn(async (p: string) => {
        openedPaths.push(p);
        return 'file content';
      }),
      exists: vi.fn(async () => true),
      realpath: vi.fn(async (p: string) => p),
      stat: vi.fn(async () => ({ isFile: () => false, isDirectory: () => true, size: 0 } as FileStat)),
      listDir: vi.fn(async () => [])
    };

    const mockEnv: Env = {
      names: vi.fn().mockReturnValue([]),
      get: vi.fn().mockReturnValue(undefined),
      platform: vi.fn().mockReturnValue('win32'),
      cwd: vi.fn().mockReturnValue('C:\\Windows'),
      homedir: vi.fn().mockReturnValue('C:\\Users\\alice'),
      isTty: vi.fn().mockReturnValue(true)
    };

    const prompt: Prompt = {
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn().mockResolvedValue(''),
      text: vi.fn().mockResolvedValue(''),
      pickFolder: vi.fn().mockResolvedValue(undefined)
    };

    const buildSnapshot = (env: Env): EnvSnapshot => ({
      names: env.names(),
      values: {},
      platform: env.platform(),
      isWsl: false,
      isTty: env.isTty(),
      cwd: env.cwd()
    });

    // Provide C:\Windows (an OS directory)
    const result = await runScanPhase1(
      { dir: 'C:\\Windows', yes: true },
      { fsRead: recordingFsRead, env: mockEnv, prompt, buildSnapshot }
    );

    expect(result.workspaceRef.verdict).toBe('refused');
    expect(result.workspaceRef.refusalReason).toBe('system-dir');
    expect(result.workspaceRef.consentGranted).toBe(false);

    // CRUCIAL: Zero files opened/read
    expect(recordingFsRead.readText).not.toHaveBeenCalled();
    expect(openedPaths).toHaveLength(0);
  });
});

