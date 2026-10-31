// ROLE: Implements FsRead port using Node fs/promises.
// INPUTS: Filesystem paths: string.
// CRITICAL: Must correctly reflect file existence, directory status, and canonical realpaths.

import fs from 'node:fs/promises';
import type { FsRead, FileStat } from '../ports/index.js';

export class NodeFsRead implements FsRead {
  async readText(path: string): Promise<string> {
    return await fs.readFile(path, 'utf8');
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async listDir(path: string): Promise<string[]> {
    return await fs.readdir(path);
  }

  async stat(path: string): Promise<FileStat> {
    const st = await fs.stat(path);
    return {
      isFile: () => st.isFile(),
      isDirectory: () => st.isDirectory(),
      size: st.size
    };
  }

  async realpath(path: string): Promise<string> {
    return await fs.realpath(path);
  }
}

