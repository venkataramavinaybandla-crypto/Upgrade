// ROLE: Tests workspace folder safety guards, OS folder refusals, and path jail bounds.
// INPUTS: Mock FsRead and Env instances with varied directory trees.
// CRITICAL: Verifies assertInsideJail prevents escaping parent roots and traversal attacks.

import { describe, it, expect, vi } from 'vitest';
import { validateWorkspace, assertInsideJail, PROJECT_MARKERS } from '../src/core/workspace/index.js';
import type { FsRead, Env, FileStat } from '../src/ports/index.js';
import type { HostContext } from '../src/contracts/index.js';

describe('validateWorkspace (src/core/workspace)', () => {
  const dummyHostContext: HostContext = {
    kind: 'ide-terminal',
    host: 'vscode',
    signals: ['VSCODE_PID'],
    confidence: 'high',
    os: 'win32',
    isWsl: false,
    cwd: 'C:\\projects\\app'
  };

  const createMockEnv = (overrides: Partial<Env> = {}): Env => ({
    get: vi.fn(),
    names: vi.fn().mockReturnValue([]),
    platform: vi.fn().mockReturnValue('win32'),
    cwd: vi.fn().mockReturnValue('C:\\projects\\app'),
    homedir: vi.fn().mockReturnValue('C:\\Users\\alice'),
    isTty: vi.fn().mockReturnValue(true),
    ...overrides
  });

  const createMockFsRead = (opts: {
    existingDirs?: string[];
    existingFiles?: string[];
    realpaths?: Record<string, string>;
  } = {}): FsRead => {
    const existingDirs = new Set(opts.existingDirs?.map(p => p.replace(/\\/g, '/')) ?? []);
    const existingFiles = new Set(opts.existingFiles?.map(p => p.replace(/\\/g, '/')) ?? []);
    const realpaths = opts.realpaths ?? {};

    return {
      exists: vi.fn(async (p: string) => {
        const norm = p.replace(/\\/g, '/');
        return existingDirs.has(norm) || existingFiles.has(norm);
      }),
      realpath: vi.fn(async (p: string) => {
        const norm = p.replace(/\\/g, '/');
        return realpaths[norm] ?? realpaths[p] ?? p;
      }),
      stat: vi.fn(async (p: string) => {
        const norm = p.replace(/\\/g, '/');
        const isDir = existingDirs.has(norm);
        const isFile = existingFiles.has(norm);
        if (!isDir && !isFile) {
          throw new Error(`ENOENT: ${p}`);
        }
        return {
          isFile: () => isFile,
          isDirectory: () => isDir,
          size: 100
        } as FileStat;
      }),
      readText: vi.fn(async () => ''),
      listDir: vi.fn(async () => [])
    };
  };

  it('refuses non-existent directory with not-found', async () => {
    const fsRead = createMockFsRead();
    const env = createMockEnv();
    const res = await validateWorkspace('C:\\nonexistent', dummyHostContext, { fsRead, env });
    expect(res.verdict).toBe('refused');
    expect(res.refusalReason).toBe('not-found');
  });

  it('refuses file path with not-a-directory', async () => {
    const fsRead = createMockFsRead({ existingFiles: ['C:/projects/app/package.json'] });
    const env = createMockEnv();
    const res = await validateWorkspace('C:\\projects\\app\\package.json', dummyHostContext, { fsRead, env });
    expect(res.verdict).toBe('refused');
    expect(res.refusalReason).toBe('not-a-directory');
  });

  it('refuses drive root (C:\\) with fs-root', async () => {
    const fsRead = createMockFsRead({ existingDirs: ['C:/'] });
    const env = createMockEnv();
    const res = await validateWorkspace('C:\\', dummyHostContext, { fsRead, env });
    expect(res.verdict).toBe('refused');
    expect(res.refusalReason).toBe('fs-root');
  });

  it('refuses home directory itself with home-dir', async () => {
    const fsRead = createMockFsRead({ existingDirs: ['C:/Users/alice'] });
    const env = createMockEnv({ homedir: vi.fn().mockReturnValue('C:\\Users\\alice') });
    const res = await validateWorkspace('C:\\Users\\alice', dummyHostContext, { fsRead, env });
    expect(res.verdict).toBe('refused');
    expect(res.refusalReason).toBe('home-dir');
  });

  it('refuses Desktop root itself with user-folder-root', async () => {
    const fsRead = createMockFsRead({ existingDirs: ['C:/Users/alice/Desktop'] });
    const env = createMockEnv({ homedir: vi.fn().mockReturnValue('C:\\Users\\alice') });
    const res = await validateWorkspace('C:\\Users\\alice\\Desktop', dummyHostContext, { fsRead, env });
    expect(res.verdict).toBe('refused');
    expect(res.refusalReason).toBe('user-folder-root');
  });

  it('allows projects inside Desktop', async () => {
    const projectDir = 'C:/Users/alice/Desktop/my-project';
    const fsRead = createMockFsRead({
      existingDirs: [projectDir],
      existingFiles: [`${projectDir}/package.json`, `${projectDir}/.git`]
    });
    const env = createMockEnv({ homedir: vi.fn().mockReturnValue('C:\\Users\\alice') });
    const res = await validateWorkspace('C:\\Users\\alice\\Desktop\\my-project', dummyHostContext, { fsRead, env });
    expect(res.verdict).toBe('ok');
    expect(res.projectMarkers).toEqual(['package.json', '.git']);
  });

  it('refuses OS directories (C:\\Windows) with system-dir', async () => {
    const fsRead = createMockFsRead({ existingDirs: ['C:/Windows'] });
    const env = createMockEnv();
    const res = await validateWorkspace('C:\\Windows', dummyHostContext, { fsRead, env });
    expect(res.verdict).toBe('refused');
    expect(res.refusalReason).toBe('system-dir');
  });

  it('refuses Linux system directory (/usr) with system-dir', async () => {
    const fsRead = createMockFsRead({ existingDirs: ['/usr'] });
    const env = createMockEnv({ platform: vi.fn().mockReturnValue('linux'), homedir: vi.fn().mockReturnValue('/home/alice') });
    const res = await validateWorkspace('/usr', { ...dummyHostContext, os: 'linux' }, { fsRead, env });
    expect(res.verdict).toBe('refused');
    expect(res.refusalReason).toBe('system-dir');
  });

  it('warns on WSL when folder is under /mnt/<drive>', async () => {
    const fsRead = createMockFsRead({ existingDirs: ['/mnt/c/projects/demo'] });
    const env = createMockEnv({ platform: vi.fn().mockReturnValue('linux') });
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const res = await validateWorkspace('/mnt/c/projects/demo', { ...dummyHostContext, isWsl: true, os: 'linux' }, { fsRead, env, logger });
    expect(res.verdict).toBe('ok');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('is under /mnt/'));
  });
});

describe('assertInsideJail', () => {
  it('accepts exact root match', async () => {
    const result = await assertInsideJail('C:\\project', 'C:\\project', { platform: 'win32' });
    expect(result).toBe('C:\\project');
  });

  it('accepts files inside workspace root', async () => {
    const result = await assertInsideJail('C:\\project', 'C:\\project\\src\\index.ts', { platform: 'win32' });
    expect(result).toBe('C:\\project\\src\\index.ts');
  });

  it('handles case-insensitivity on Windows', async () => {
    const result = await assertInsideJail('c:\\Project', 'C:\\project\\file.txt', { platform: 'win32' });
    expect(result).toBe('C:\\project\\file.txt');
  });

  it('rejects ../ traversal out of root', async () => {
    // Normalizing resolved target outside root
    await expect(
      assertInsideJail('C:\\project', 'C:\\other\\secret.txt', { platform: 'win32' })
    ).rejects.toThrow('Path jail violation');
  });

  it('rejects different Windows drive letters', async () => {
    await expect(
      assertInsideJail('C:\\project', 'D:\\project\\file.txt', { platform: 'win32' })
    ).rejects.toThrow('Path jail violation');
  });

  it('rejects symlinks that escape root', async () => {
    const fsRead: FsRead = {
      realpath: vi.fn(async (p: string) => {
        if (p.includes('symlink-out')) {
          return 'C:/secret/outside.txt';
        }
        return p;
      }),
      exists: vi.fn(async () => true),
      readText: vi.fn(async () => ''),
      listDir: vi.fn(async () => []),
      stat: vi.fn(async () => ({} as any))
    };

    await expect(
      assertInsideJail('C:\\project', 'C:\\project\\symlink-out', { fsRead, platform: 'win32' })
    ).rejects.toThrow('Path jail violation');
  });
});

