// ROLE: Verifies ExtractorReader jail security, secret blocking, size limit enforcement, and Hash port.
// INPUTS: Mock FsRead implementations with in-bounds, out-of-bounds, secret, and oversized files.
// CRITICAL: ExtractorReader must prevent directory traversal, refuse secrets, and enforce maxFileBytes.

import { describe, it, expect } from 'vitest';
import { createExtractorReader } from '../src/core/extract-reader.js';
import { NodeHash } from '../src/infra/hash.js';
import type { FsRead, FileStat } from '../src/ports/index.js';

function makeMockFs(files: Record<string, { content: string; size?: number }>): FsRead {
  return {
    async readText(p: string): Promise<string> {
      const norm = p.replace(/\\/g, '/');
      if (files[norm]) return files[norm].content;
      throw new Error(`ENOENT: ${p}`);
    },
    async exists(p: string): Promise<boolean> {
      const norm = p.replace(/\\/g, '/');
      return Boolean(files[norm]);
    },
    async listDir(): Promise<string[]> {
      return [];
    },
    async stat(p: string): Promise<FileStat> {
      const norm = p.replace(/\\/g, '/');
      const f = files[norm];
      if (!f) throw new Error(`ENOENT: ${p}`);
      return {
        isFile: () => true,
        isDirectory: () => false,
        size: f.size ?? f.content.length
      };
    },
    async realpath(p: string): Promise<string> {
      return p.replace(/\\/g, '/');
    }
  };
}

describe('ExtractorReader & Hash', () => {
  it('reads normal file within workspace root', async () => {
    const root = 'C:/projects/myapp';
    const fs = makeMockFs({
      'C:/projects/myapp/package.json': { content: '{"name": "test"}' }
    });
    const reader = createExtractorReader(fs, root);
    const content = await reader.readText('package.json');
    expect(content).toBe('{"name": "test"}');
  });

  it('refuses secret file matching pattern', async () => {
    const root = 'C:/projects/myapp';
    const fs = makeMockFs({
      'C:/projects/myapp/.env': { content: 'SECRET=123' }
    });
    const reader = createExtractorReader(fs, root);
    await expect(reader.readText('.env')).rejects.toThrow(/Access denied/);
  });

  it('refuses path escaping workspace jail', async () => {
    const root = 'C:/projects/myapp';
    const fs = makeMockFs({
      'C:/projects/other/secret.txt': { content: 'outside' }
    });
    const reader = createExtractorReader(fs, root);
    await expect(reader.readText('../other/secret.txt')).rejects.toThrow(/Path jail violation/);
  });

  it('refuses file exceeding maxFileBytes', async () => {
    const root = 'C:/projects/myapp';
    const fs = makeMockFs({
      'C:/projects/myapp/big.txt': { content: 'huge', size: 2 * 1024 * 1024 }
    });
    const reader = createExtractorReader(fs, root);
    await expect(reader.readText('big.txt')).rejects.toThrow(/exceeds max allowed file size/);
  });

  it('NodeHash produces correct sha256', () => {
    const hash = new NodeHash();
    expect(hash.sha256('hello world')).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });
});
