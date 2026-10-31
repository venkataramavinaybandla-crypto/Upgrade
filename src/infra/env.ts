import os from 'node:os';
import fs from 'node:fs';
import type { Env } from '../ports/index.js';
import type { EnvSnapshot } from '../contracts/index.js';

export const ALLOWED_ENV_VALUE_KEYS = [
  'TERM_PROGRAM',
  'TERMINAL_EMULATOR',
  'WT_SESSION',
  'TERM'
] as const;

export class NodeEnv implements Env {
  get(name: string): string | undefined {
    return process.env[name];
  }

  names(): string[] {
    return Object.keys(process.env);
  }

  platform(): 'win32' | 'darwin' | 'linux' {
    const p = process.platform;
    if (p === 'win32' || p === 'darwin' || p === 'linux') {
      return p;
    }
    return 'linux';
  }

  cwd(): string {
    return process.cwd();
  }

  homedir(): string {
    return os.homedir();
  }

  isTty(): boolean {
    return Boolean(process.stdout.isTTY && process.stdin.isTTY);
  }
}

export function isWslEnvironment(platform: string): boolean {
  if (platform !== 'linux') return false;
  if (process.env['WSL_DISTRO_NAME'] || process.env['WSL_INTEROP']) return true;
  try {
    const versionText = fs.readFileSync('/proc/version', 'utf8');
    return /microsoft/i.test(versionText);
  } catch {
    return false;
  }
}

export function buildEnvSnapshot(envPort: Env = new NodeEnv()): EnvSnapshot {
  const names = envPort.names();
  const values: Record<string, string> = {};

  for (const key of ALLOWED_ENV_VALUE_KEYS) {
    const val = envPort.get(key);
    if (val !== undefined) {
      values[key] = val;
    }
  }

  const platform = envPort.platform();
  const isWsl = isWslEnvironment(platform);
  const isTty = envPort.isTty();
  const cwd = envPort.cwd();

  return {
    names,
    values,
    platform,
    isWsl,
    isTty,
    cwd
  };
}
