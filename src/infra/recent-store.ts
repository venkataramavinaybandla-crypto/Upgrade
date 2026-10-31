// ROLE: Implements RecentStore persisting MRU workspace folders in a user-level configuration directory.
// INPUTS: Workspace paths: string.
// CRITICAL: Writes to user-level config (APPDATA / XDG / home), NEVER inside any project or repo.

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { RecentStore } from '../ports/index.js';

export function getGlobalConfigDir(): string {
  const p = process.platform;
  if (p === 'win32') {
    const appData = process.env['APPDATA'];
    if (appData) {
      return path.join(appData, 'upgrade');
    }
    return path.join(os.homedir(), 'AppData', 'Roaming', 'upgrade');
  } else if (p === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'upgrade');
  } else {
    const xdgConfig = process.env['XDG_CONFIG_HOME'];
    if (xdgConfig) {
      return path.join(xdgConfig, 'upgrade');
    }
    return path.join(os.homedir(), '.config', 'upgrade');
  }
}

export class JsonRecentStore implements RecentStore {
  private filePath: string;
  private maxItems: number;

  constructor(customFilePath?: string, maxItems = 10) {
    this.filePath = customFilePath ?? path.join(getGlobalConfigDir(), 'recent.json');
    this.maxItems = maxItems;
  }

  async getRecent(): Promise<string[]> {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => typeof item === 'string');
      }
      return [];
    } catch {
      return [];
    }
  }

  async addRecent(folderPath: string): Promise<void> {
    const current = await this.getRecent();
    const filtered = current.filter(p => p !== folderPath);
    filtered.unshift(folderPath);
    const updated = filtered.slice(0, this.maxItems);

    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(updated, null, 2), 'utf8');
    } catch {
      // Best-effort storage
    }
  }
}

