// ROLE: Creates sandboxed ExtractorReader enforcing workspace jail bounds, secret denylist, and file size limits.
// INPUTS: FsRead port and workspace root path string.
// CRITICAL: Asserts target stays inside jail, rejects secret patterns, and enforces maxFileBytes cap.

import type { ExtractorReader } from '../contracts/index.js';
import type { FsRead } from '../ports/index.js';
import { assertInsideJail } from './workspace/index.js';
import { matchSecretPattern, SCAN_LIMITS } from './scan/index.js';

export function createExtractorReader(fsRead: FsRead, root: string): ExtractorReader {
  const normRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');

  return {
    async readText(relPath: string): Promise<string> {
      const cleanRel = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
      const fullPath = `${normRoot}/${cleanRel}`;

      await assertInsideJail(root, fullPath, { fsRead });

      const fileName = cleanRel.split('/').pop() || '';
      if (matchSecretPattern(fileName)) {
        throw new Error(`Access denied: '${cleanRel}' matches secret pattern and cannot be read`);
      }

      const st = await fsRead.stat(fullPath);
      if (st.size > SCAN_LIMITS.maxFileBytes) {
        throw new Error(`File '${cleanRel}' exceeds max allowed file size of ${SCAN_LIMITS.maxFileBytes} bytes`);
      }

      return await fsRead.readText(fullPath);
    }
  };
}
