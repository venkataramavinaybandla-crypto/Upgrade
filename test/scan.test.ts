// ROLE: Tests filesystem scanner for ignore rules, secret skipping, safety limits, consent gates, and code verdicts.
// INPUTS: Real fixture folders, temporary test trees, and mocked FsRead ports.
// CRITICAL: Asserts scan() calls readText zero times and skips secret files without opening them.

import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { scan } from '../src/core/scan/index.js';
import { NodeFsRead } from '../src/infra/fs-read.js';
import type { WorkspaceRef } from '../src/contracts/index.js';
import type { FsRead, FileStat } from '../src/ports/index.js';

describe('scan (src/core/scan)', () => {
  const realFs = new NodeFsRead();

  function makeWorkspaceRef(root: string, consentGranted = true): WorkspaceRef {
    return {
      root,
      source: 'argument',
      verdict: 'ok',
      projectMarkers: [],
      consentGranted
    };
  }

  it('throws if workspace.consentGranted is false', async () => {
    const ws = makeWorkspaceRef(path.resolve('test/fixtures/clean-express'), false);
    await expect(scan(ws, { fs: realFs })).rejects.toThrow('Consent not granted');
  });

  it('scans empty fixture producing empty verdict', async () => {
    const ws = makeWorkspaceRef(path.resolve('test/fixtures/empty'));
    const report = await scan(ws, { fs: realFs });
    expect(report.verdict).toBe('empty');
    expect(report.fileCount).toBe(1);
    expect(report.files[0].path).toBe('.gitkeep');
    expect(report.truncated).toBe(false);
  });

  it('scans docs-only fixture producing empty verdict', async () => {
    const ws = makeWorkspaceRef(path.resolve('test/fixtures/docs-only'));
    const report = await scan(ws, { fs: realFs });
    expect(report.verdict).toBe('empty');
    expect(report.fileCount).toBe(3);
    const paths = report.files.map(f => f.path);
    expect(paths).toContain('README.md');
    expect(paths).toContain('LICENSE');
    expect(paths).toContain('.gitignore');
  });

  it('scans clean-express fixture producing has-code verdict with POSIX paths', async () => {
    const ws = makeWorkspaceRef(path.resolve('test/fixtures/clean-express'));
    const report = await scan(ws, { fs: realFs });
    expect(report.verdict).toBe('has-code');
    expect(report.fileCount).toBeGreaterThan(0);
    for (const f of report.files) {
      expect(f.path).not.toContain('\\');
    }
    const paths = report.files.map(f => f.path);
    expect(paths).toContain('package.json');
    expect(paths).toContain('server.js');
    expect(paths).toContain('routes/users.js');
    expect(paths).toContain('models/user.js');
    expect(paths).toContain('public/logo.png');
  });

  it('ignores ignoredDirs like node_modules at any depth', async () => {
    const ws = makeWorkspaceRef(path.resolve('test/fixtures/ignored-noise'));
    const report = await scan(ws, { fs: realFs });
    expect(report.verdict).toBe('has-code');
    const paths = report.files.map(f => f.path);
    expect(paths).toContain('package.json');
    expect(paths).toContain('server.js');
    expect(paths.some(p => p.includes('node_modules'))).toBe(false);
  });

  it('skips secrets by name and never reads them', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upgrade-secrets-test-'));
    try {
      await fs.writeFile(path.join(tempDir, 'server.js'), 'console.log(1);');
      await fs.writeFile(path.join(tempDir, '.env'), 'SECRET=123');
      await fs.writeFile(path.join(tempDir, '.env.local'), 'SECRET=456');
      await fs.writeFile(path.join(tempDir, 'key.pem'), 'FAKE_PEM');

      let readTextCalled = false;
      const recordingFs: FsRead = {
        readText: vi.fn(async () => {
          readTextCalled = true;
          return '';
        }),
        exists: vi.fn(p => realFs.exists(p)),
        listDir: vi.fn(p => realFs.listDir(p)),
        stat: vi.fn(p => realFs.stat(p)),
        realpath: vi.fn(p => realFs.realpath(p))
      };

      const ws = makeWorkspaceRef(tempDir);
      const report = await scan(ws, { fs: recordingFs });

      expect(report.verdict).toBe('has-code');
      expect(report.secretFilesSkipped).toBe(3);
      expect(report.files.map(f => f.path)).toEqual(['server.js']);
      expect(readTextCalled).toBe(false);
      expect(recordingFs.readText).not.toHaveBeenCalled();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('sets truncated=true when maxFileBytes is exceeded', async () => {
    const fakeFs: FsRead = {
      readText: vi.fn(),
      exists: vi.fn(async () => true),
      realpath: vi.fn(async p => p),
      listDir: vi.fn(async () => ['bigfile.js']),
      stat: vi.fn(async () => ({
        isFile: () => true,
        isDirectory: () => false,
        size: 2 * 1024 * 1024 // 2MB > 1MB
      }))
    };

    const ws = makeWorkspaceRef('/fake/root');
    const report = await scan(ws, { fs: fakeFs });
    expect(report.truncated).toBe(true);
    expect(report.files).toHaveLength(1);
    expect(report.files[0].bytes).toBe(2 * 1024 * 1024);
  });

  it('guarantees deterministic output even if listDir order is shuffled', async () => {
    let callCount = 0;
    const fakeFs: FsRead = {
      readText: vi.fn(),
      exists: vi.fn(async () => true),
      realpath: vi.fn(async p => p),
      listDir: vi.fn(async () => {
        callCount++;
        return callCount % 2 === 0
          ? ['b.js', 'a.js', 'c.js']
          : ['c.js', 'a.js', 'b.js'];
      }),
      stat: vi.fn(async () => ({
        isFile: () => true,
        isDirectory: () => false,
        size: 50
      }))
    };

    const ws = makeWorkspaceRef('/fake/root');
    const report1 = await scan(ws, { fs: fakeFs });
    const report2 = await scan(ws, { fs: fakeFs });

    expect(JSON.stringify(report1)).toBe(JSON.stringify(report2));
    expect(report1.files.map(f => f.path)).toEqual(['a.js', 'b.js', 'c.js']);
  });
});
