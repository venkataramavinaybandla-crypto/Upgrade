// ROLE: Tests concrete infrastructure adapters including allowlist env filtering and recent store.
// INPUTS: Real filesystem temporary folders and mocked process environments.
// CRITICAL: Proves non-allowlisted environment variables are stripped and user configs persist globally.

import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { buildEnvSnapshot, ALLOWED_ENV_VALUE_KEYS } from '../src/infra/env.js';
import { NodeFsRead } from '../src/infra/fs-read.js';
import { JsonRecentStore, getGlobalConfigDir } from '../src/infra/recent-store.js';
import type { Env } from '../src/ports/index.js';

describe('src/infra', () => {
  describe('buildEnvSnapshot', () => {
    it('collects all variable names, but values ONLY for allowlisted keys', () => {
      const mockEnv: Env = {
        names: vi.fn().mockReturnValue([
          'TERM_PROGRAM',
          'SECRET_API_KEY',
          'DB_PASSWORD',
          'WT_SESSION',
          'PATH'
        ]),
        get: vi.fn((key: string) => {
          const map: Record<string, string> = {
            TERM_PROGRAM: 'vscode',
            SECRET_API_KEY: 'supersecret',
            DB_PASSWORD: 'password123',
            WT_SESSION: 'wt-12345',
            PATH: '/usr/bin'
          };
          return map[key];
        }),
        platform: vi.fn().mockReturnValue('win32'),
        cwd: vi.fn().mockReturnValue('C:\\test'),
        homedir: vi.fn().mockReturnValue('C:\\Users\\test'),
        isTty: vi.fn().mockReturnValue(true)
      };

      const snapshot = buildEnvSnapshot(mockEnv);

      // All names are preserved
      expect(snapshot.names).toContain('SECRET_API_KEY');
      expect(snapshot.names).toContain('DB_PASSWORD');
      expect(snapshot.names).toContain('TERM_PROGRAM');

      // But values MUST ONLY contain allowlisted keys
      expect(Object.keys(snapshot.values)).toEqual(
        expect.arrayContaining(['TERM_PROGRAM', 'WT_SESSION'])
      );
      expect(snapshot.values['TERM_PROGRAM']).toBe('vscode');
      expect(snapshot.values['WT_SESSION']).toBe('wt-12345');

      // Crucial security check: never retain non-allowlist values
      expect(snapshot.values['SECRET_API_KEY']).toBeUndefined();
      expect(snapshot.values['DB_PASSWORD']).toBeUndefined();
      expect(snapshot.values['PATH']).toBeUndefined();
    });
  });

  describe('JsonRecentStore', () => {
    it('persists and retrieves recent directories in MRU order', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upgrade-recent-test-'));
      const recentFile = path.join(tempDir, 'recent.json');

      try {
        const store = new JsonRecentStore(recentFile, 3);
        expect(await store.getRecent()).toEqual([]);

        await store.addRecent('/path/one');
        await store.addRecent('/path/two');
        await store.addRecent('/path/three');
        expect(await store.getRecent()).toEqual(['/path/three', '/path/two', '/path/one']);

        // Adding an existing path moves it to top
        await store.addRecent('/path/two');
        expect(await store.getRecent()).toEqual(['/path/two', '/path/three', '/path/one']);

        // Respects maxItems
        await store.addRecent('/path/four');
        expect(await store.getRecent()).toEqual(['/path/four', '/path/two', '/path/three']);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('returns a user-level directory, not inside project directory', () => {
      const configDir = getGlobalConfigDir();
      expect(configDir).not.toContain('.upgrade');
      expect(path.isAbsolute(configDir)).toBe(true);
    });
  });

  describe('NodeFsRead', () => {
    it('reads real files and directories on disk', async () => {
      const fsRead = new NodeFsRead();
      const thisFile = path.resolve('test/infra.test.ts');
      
      expect(await fsRead.exists(thisFile)).toBe(true);
      expect(await fsRead.exists('nonexistent_xyz_123.txt')).toBe(false);

      const content = await fsRead.readText(thisFile);
      expect(content).toContain('buildEnvSnapshot');

      const stat = await fsRead.stat(thisFile);
      expect(stat.isFile()).toBe(true);
      expect(stat.isDirectory()).toBe(false);

      const real = await fsRead.realpath(thisFile);
      expect(path.isAbsolute(real)).toBe(true);
    });
  });
});

