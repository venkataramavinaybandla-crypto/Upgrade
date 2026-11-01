// ROLE: Tests Commander CLI commands (doctor, scan) with flags, json output, and exit codes.
// INPUTS: Mock CliContext with mocked stdin/stdout.
// CRITICAL: Asserts exit codes 0, 2, 10, and 11 match failure modes precisely.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCli } from '../src/cli/index.js';
import type { FsRead, Env, Prompt, FileStat } from '../src/ports/index.js';
import type { EnvSnapshot } from '../src/contracts/index.js';

describe('CLI (src/cli)', () => {
  let originalExitCode: number | undefined;
  let stdoutLogs: string[] = [];
  let stderrLogs: string[] = [];

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    originalExitCode = process.exitCode;
    process.exitCode = 0;
    stdoutLogs = [];
    stderrLogs = [];
    console.log = vi.fn((...args: any[]) => {
      stdoutLogs.push(args.join(' '));
    });
    console.error = vi.fn((...args: any[]) => {
      stderrLogs.push(args.join(' '));
    });
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  const createMockCliContext = (overrides: {
    isTty?: boolean;
    cwd?: string;
    homedir?: string;
    confirmVal?: boolean;
    textVal?: string;
    existing?: string[];
  } = {}) => {
    const existing = new Set((overrides.existing ?? ['C:/project/app']).map(p => p.replace(/\\/g, '/')));

    const env: Env = {
      names: vi.fn().mockReturnValue(['ANTIGRAVITY_CLI_ALIAS', 'TERM_PROGRAM']),
      get: vi.fn((k: string) => (k === 'TERM_PROGRAM' ? 'vscode' : undefined)),
      platform: vi.fn().mockReturnValue('win32'),
      cwd: vi.fn().mockReturnValue(overrides.cwd ?? 'C:\\project\\app'),
      homedir: vi.fn().mockReturnValue(overrides.homedir ?? 'C:\\Users\\alice'),
      isTty: vi.fn().mockReturnValue(overrides.isTty ?? true)
    };

    const fsRead: FsRead = {
      exists: vi.fn(async (p: string) => existing.has(p.replace(/\\/g, '/'))),
      realpath: vi.fn(async (p: string) => p),
      stat: vi.fn(async () => ({ isFile: () => false, isDirectory: () => true, size: 0 } as FileStat)),
      readText: vi.fn(async () => ''),
      listDir: vi.fn(async () => [])
    };

    const prompt: Prompt = {
      confirm: vi.fn().mockResolvedValue(overrides.confirmVal ?? true),
      select: vi.fn().mockResolvedValue(''),
      text: vi.fn().mockResolvedValue(overrides.textVal ?? ''),
      pickFolder: vi.fn().mockResolvedValue(undefined)
    };

    const buildSnapshot = (e: Env): EnvSnapshot => ({
      names: e.names(),
      values: { TERM_PROGRAM: 'vscode' },
      platform: e.platform(),
      isWsl: false,
      isTty: e.isTty(),
      cwd: e.cwd()
    });

    return { env, fsRead, prompt, buildSnapshot };
  };

  it('upgrade doctor --env prints detected environment info', async () => {
    const ctx = createMockCliContext();
    const cli = createCli(ctx);

    await cli.parseAsync(['node', 'upgrade', 'doctor', '--env']);

    const joined = stdoutLogs.join('\n');
    expect(joined).toContain('Host: antigravity');
    expect(joined).toContain('Kind: ide-terminal');
    expect(joined).toContain('Signals: ANTIGRAVITY_CLI_ALIAS');
    expect(joined).not.toContain('vscode'); // value never printed
  });

  it('upgrade doctor --env --json outputs JSON schema', async () => {
    const ctx = createMockCliContext();
    const cli = createCli(ctx);

    await cli.parseAsync(['node', 'upgrade', '--json', 'doctor', '--env']);

    const outputJson = JSON.parse(stdoutLogs[0]);
    expect(outputJson.host).toBe('antigravity');
    expect(outputJson.kind).toBe('ide-terminal');
    expect(outputJson.signals).toContain('ANTIGRAVITY_CLI_ALIAS');
  });

  it('upgrade scan on clean backend exits 0 with summary', async () => {
    const dir = 'C:\\project\\app';
    const ctx = createMockCliContext({
      existing: ['C:/project/app', 'C:/project/app/server.js', 'C:/project/app/package.json']
    });
    // Ensure listDir and stat return the files
    ctx.fsRead.listDir = vi.fn(async () => ['server.js', 'package.json']);
    ctx.fsRead.stat = vi.fn(async (p: string) => ({
      isFile: () => p.endsWith('.js') || p.endsWith('.json'),
      isDirectory: () => !p.endsWith('.js') && !p.endsWith('.json'),
      size: 100
    }));
    ctx.fsRead.readText = vi.fn(async () => JSON.stringify({ dependencies: { express: '4.18' } }));

    const cli = createCli(ctx);
    await cli.parseAsync(['node', 'upgrade', 'scan', '--dir', dir, '--yes']);

    expect(process.exitCode).toBe(0);
    expect(stdoutLogs.join('\n')).toContain('Backend scanned successfully');
  });

  it('upgrade scan on empty folder exits with code 12 and roasts', async () => {
    const dir = 'C:\\project\\empty';
    const ctx = createMockCliContext({ existing: ['C:/project/empty'] });
    ctx.fsRead.listDir = vi.fn(async () => []);

    const cli = createCli(ctx);
    await cli.parseAsync(['node', 'upgrade', 'scan', '--dir', dir, '--yes']);

    expect(process.exitCode).toBe(12);
    expect(stdoutLogs.join('\n')).toContain("There's ntg here Bruhhh...");
  });

  it('upgrade scan with frontend traces exits with code 13 and blocked message', async () => {
    const dir = 'C:\\project\\react-app';
    const ctx = createMockCliContext({
      existing: ['C:/project/react-app', 'C:/project/react-app/src/App.jsx']
    });
    ctx.fsRead.listDir = vi.fn(async (p: string) => {
      if (p.endsWith('react-app')) return ['src'];
      if (p.endsWith('src')) return ['App.jsx'];
      return [];
    });
    ctx.fsRead.stat = vi.fn(async (p: string) => ({
      isFile: () => p.endsWith('.jsx'),
      isDirectory: () => !p.endsWith('.jsx'),
      size: 100
    }));

    const cli = createCli(ctx);
    await cli.parseAsync(['node', 'upgrade', 'scan', '--dir', dir, '--yes']);

    expect(process.exitCode).toBe(13);
    expect(stderrLogs.join('\n')).toContain('Remove the frontend, then run Upgrade again.');
  });

  it('upgrade scan with refused dir exits with code 11', async () => {
    const ctx = createMockCliContext({ existing: ['C:/Windows'] });
    const cli = createCli(ctx);

    await cli.parseAsync(['node', 'upgrade', 'scan', '--dir', 'C:\\Windows', '--yes']);

    expect(process.exitCode).toBe(11);
    expect(stderrLogs.join('\n')).toContain('Refusing operating system directory');
  });

  it('upgrade scan when user declines consent exits with code 10', async () => {
    const ctx = createMockCliContext({ confirmVal: false });
    const cli = createCli(ctx);

    await cli.parseAsync(['node', 'upgrade', 'scan', '--dir', 'C:\\project\\app']);

    expect(process.exitCode).toBe(10);
    expect(stdoutLogs.join('\n')).toContain('Consent declined');
  });

  it('upgrade scan non-interactive missing flags exits with code 2', async () => {
    const ctx = createMockCliContext({ isTty: false });
    const cli = createCli(ctx);

    await cli.parseAsync(['node', 'upgrade', 'scan']);

    expect(process.exitCode).toBe(2);
    expect(stderrLogs.join('\n')).toContain('Usage error');
  });
});

