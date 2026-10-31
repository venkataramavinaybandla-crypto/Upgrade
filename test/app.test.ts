import { describe, it, expect, vi } from 'vitest';
import { askConsent, resolveWorkspace, cleanCandidatePath, AppError } from '../src/app/index.js';
import type { HostContext, WorkspaceRef } from '../src/contracts/index.js';
import type { FsRead, Env, Prompt, RecentStore, FileStat } from '../src/ports/index.js';

describe('src/app Use-Cases', () => {
  const createMockEnv = (overrides: Partial<Env> = {}): Env => ({
    get: vi.fn(),
    names: vi.fn().mockReturnValue([]),
    platform: vi.fn().mockReturnValue('win32'),
    cwd: vi.fn().mockReturnValue('C:\\current\\working\\dir'),
    homedir: vi.fn().mockReturnValue('C:\\Users\\alice'),
    isTty: vi.fn().mockReturnValue(true),
    ...overrides
  });

  const createMockFsRead = (existing: string[] = []): FsRead => {
    const set = new Set(existing.map(p => p.replace(/\\/g, '/')));
    return {
      exists: vi.fn(async (p: string) => set.has(p.replace(/\\/g, '/'))),
      realpath: vi.fn(async (p: string) => p),
      stat: vi.fn(async (p: string) => ({
        isFile: () => false,
        isDirectory: () => true,
        size: 0
      } as FileStat)),
      readText: vi.fn(async () => ''),
      listDir: vi.fn(async () => [])
    };
  };

  const createMockPrompt = (overrides: Partial<Prompt> = {}): Prompt => ({
    confirm: vi.fn().mockResolvedValue(true),
    select: vi.fn().mockResolvedValue(''),
    text: vi.fn().mockResolvedValue(''),
    pickFolder: vi.fn().mockResolvedValue(undefined),
    ...overrides
  });

  const createMockRecentStore = (recent: string[] = []): RecentStore => {
    const list = [...recent];
    return {
      getRecent: vi.fn(async () => list),
      addRecent: vi.fn(async (p: string) => {
        if (!list.includes(p)) list.unshift(p);
      })
    };
  };

  describe('cleanCandidatePath', () => {
    it('strips double and single quotes', () => {
      expect(cleanCandidatePath('"C:\\my project"', 'C:\\Users\\alice')).toBe('C:\\my project');
      expect(cleanCandidatePath("'C:\\my project'", 'C:\\Users\\alice')).toBe('C:\\my project');
    });

    it('strips Windows drag & drop & prefix', () => {
      expect(cleanCandidatePath('& "C:\\my project"', 'C:\\Users\\alice')).toBe('C:\\my project');
    });

    it('expands tilde', () => {
      expect(cleanCandidatePath('~', 'C:\\Users\\alice')).toBe('C:\\Users\\alice');
      expect(cleanCandidatePath('~/projects/demo', '/home/alice')).toBe('/home/alice/projects/demo');
      expect(cleanCandidatePath('~\\projects\\demo', 'C:\\Users\\alice')).toBe('C:\\Users\\alice\\projects\\demo');
    });
  });

  describe('askConsent', () => {
    const okWorkspace: WorkspaceRef = {
      root: 'C:\\projects\\demo',
      source: 'cwd',
      verdict: 'ok',
      projectMarkers: ['package.json'],
      consentGranted: false
    };

    it('honors --yes without calling prompt.confirm', async () => {
      const prompt = createMockPrompt();
      const res = await askConsent(okWorkspace, { yes: true }, prompt);
      expect(res.consentGranted).toBe(true);
      expect(prompt.confirm).not.toHaveBeenCalled();
    });

    it('asks user when --yes is not provided and user approves', async () => {
      const prompt = createMockPrompt({ confirm: vi.fn().mockResolvedValue(true) });
      const res = await askConsent(okWorkspace, {}, prompt);
      expect(prompt.confirm).toHaveBeenCalledWith(expect.stringContaining(okWorkspace.root));
      expect(res.consentGranted).toBe(true);
    });

    it('records consentGranted=false when user declines', async () => {
      const prompt = createMockPrompt({ confirm: vi.fn().mockResolvedValue(false) });
      const res = await askConsent(okWorkspace, {}, prompt);
      expect(res.consentGranted).toBe(false);
    });

    it('never grants consent if workspace was refused', async () => {
      const prompt = createMockPrompt();
      const refusedWs: WorkspaceRef = {
        ...okWorkspace,
        verdict: 'refused',
        refusalReason: 'system-dir'
      };
      const res = await askConsent(refusedWs, { yes: true }, prompt);
      expect(res.consentGranted).toBe(false);
      expect(prompt.confirm).not.toHaveBeenCalled();
    });
  });

  describe('resolveWorkspace', () => {
    const ideHost: HostContext = {
      kind: 'ide-terminal',
      host: 'antigravity',
      signals: ['ANTIGRAVITY_CLI_ALIAS'],
      confidence: 'high',
      os: 'win32',
      isWsl: false,
      cwd: 'C:\\ide\\workspace'
    };

    const plainHost: HostContext = {
      kind: 'plain-terminal',
      host: 'powershell',
      signals: ['PSModulePath'],
      confidence: 'high',
      os: 'win32',
      isWsl: false,
      cwd: 'C:\\Users\\alice'
    };

    const nonInteractiveHost: HostContext = {
      kind: 'non-interactive',
      host: 'powershell',
      signals: ['PSModulePath'],
      confidence: 'high',
      os: 'win32',
      isWsl: false,
      cwd: 'C:\\Users\\alice'
    };

    it('in non-interactive mode: requires --dir and --yes, throws exit code 2 if missing', async () => {
      const fsRead = createMockFsRead(['C:/projects/demo']);
      const env = createMockEnv();
      const prompt = createMockPrompt();

      await expect(
        resolveWorkspace(nonInteractiveHost, {}, { fsRead, env, prompt })
      ).rejects.toThrowError(AppError);

      try {
        await resolveWorkspace(nonInteractiveHost, { dir: 'C:\\projects\\demo' }, { fsRead, env, prompt });
      } catch (err: any) {
        expect(err.exitCode).toBe(2);
      }
    });

    it('in non-interactive mode: accepts valid --dir and --yes', async () => {
      const fsRead = createMockFsRead(['C:/projects/demo']);
      const env = createMockEnv();
      const prompt = createMockPrompt();

      const ws = await resolveWorkspace(
        nonInteractiveHost,
        { dir: 'C:\\projects\\demo', yes: true },
        { fsRead, env, prompt }
      );
      expect(ws.verdict).toBe('ok');
      expect(ws.source).toBe('argument');
    });

    it('in ide-terminal: confirms working folder with prompt', async () => {
      const fsRead = createMockFsRead(['C:/ide/workspace']);
      const env = createMockEnv();
      const prompt = createMockPrompt({ confirm: vi.fn().mockResolvedValue(true) });

      const ws = await resolveWorkspace(ideHost, {}, { fsRead, env, prompt });
      expect(prompt.confirm).toHaveBeenCalledWith(expect.stringContaining('Working in C:\\ide\\workspace. Right folder?'));
      expect(ws.root).toBe('C:\\ide\\workspace');
      expect(ws.source).toBe('cwd');
    });

    it('in ide-terminal with --yes: uses cwd without confirmation', async () => {
      const fsRead = createMockFsRead(['C:/ide/workspace']);
      const env = createMockEnv();
      const prompt = createMockPrompt();

      const ws = await resolveWorkspace(ideHost, { yes: true }, { fsRead, env, prompt });
      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(ws.root).toBe('C:\\ide\\workspace');
    });

    it('in plain-terminal: NEVER uses cwd, prompts for folder path and stores in recent', async () => {
      const target = 'C:/projects/my-plain-app';
      const fsRead = createMockFsRead([target]);
      const env = createMockEnv({ cwd: vi.fn().mockReturnValue('C:\\Users\\alice') });
      const prompt = createMockPrompt({ text: vi.fn().mockResolvedValue('C:\\projects\\my-plain-app') });
      const recentStore = createMockRecentStore();

      const ws = await resolveWorkspace(plainHost, {}, { fsRead, env, prompt, recentStore });
      expect(prompt.text).toHaveBeenCalled();
      expect(ws.root).toBe('C:\\projects\\my-plain-app');
      expect(ws.source).toBe('picked');
      expect(recentStore.addRecent).toHaveBeenCalledWith('C:\\projects\\my-plain-app');
    });

    it('in plain-terminal: offers recent folders if present', async () => {
      const recentPath = 'C:\\projects\\recent-one';
      const fsRead = createMockFsRead(['C:/projects/recent-one']);
      const env = createMockEnv();
      const prompt = createMockPrompt({ select: vi.fn().mockResolvedValue(recentPath) });
      const recentStore = createMockRecentStore([recentPath]);

      const ws = await resolveWorkspace(plainHost, {}, { fsRead, env, prompt, recentStore });
      expect(prompt.select).toHaveBeenCalled();
      expect(ws.root).toBe(recentPath);
      expect(ws.source).toBe('recent');
    });
  });
});
