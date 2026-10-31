import type { HostContext, WorkspaceRef, WorkspaceRefusalReason, WorkspaceSource } from '../../contracts/index.js';
import type { FsRead, Env, Logger } from '../../ports/index.js';

export const PROJECT_MARKERS = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'Pipfile',
  '.git',
  'go.mod',
  'pom.xml',
  'composer.json',
  'schema.prisma',
  'Cargo.toml'
] as const;

export interface WorkspaceDeps {
  fsRead: FsRead;
  env: Env;
  logger?: Logger;
}

function normalizePath(p: string, platform: 'win32' | 'darwin' | 'linux'): string {
  let normalized = p.replace(/\\/g, '/');
  // Collapse duplicate slashes except at the very beginning
  normalized = normalized.replace(/\/{2,}/g, '/');
  // Remove trailing slash unless it's root '/' or 'C:/'
  if (normalized.length > 1 && normalized.endsWith('/')) {
    if (!/^[a-zA-Z]:\/$/.test(normalized)) {
      normalized = normalized.slice(0, -1);
    }
  }
  if (platform === 'win32') {
    // Normalize drive letter to uppercase
    if (/^[a-zA-Z]:/.test(normalized)) {
      normalized = normalized[0].toUpperCase() + normalized.slice(1);
    }
  }
  return normalized;
}

function isFsOrDriveRoot(p: string): boolean {
  // '/' or 'C:' or 'C:/'
  return p === '/' || /^[a-zA-Z]:\/?$/.test(p);
}

function isHomeDir(p: string, homedir: string, platform: 'win32' | 'darwin' | 'linux'): boolean {
  const normP = normalizePath(p, platform);
  const normHome = normalizePath(homedir, platform);
  if (platform === 'win32') {
    return normP.toLowerCase() === normHome.toLowerCase();
  }
  return normP === normHome;
}

function isUserFolderRoot(p: string, homedir: string, platform: 'win32' | 'darwin' | 'linux'): boolean {
  const normP = normalizePath(p, platform);
  const normHome = normalizePath(homedir, platform);
  const targets = ['desktop', 'documents', 'downloads'];
  for (const t of targets) {
    const userFolder = `${normHome}/${t}`;
    if (platform === 'win32') {
      if (normP.toLowerCase() === userFolder.toLowerCase()) return true;
    } else {
      if (normP.toLowerCase() === userFolder.toLowerCase()) return true;
    }
  }
  return false;
}

function isSystemDir(p: string, platform: 'win32' | 'darwin' | 'linux'): boolean {
  const normP = normalizePath(p, platform);
  if (platform === 'win32') {
    const lower = normP.toLowerCase();
    // Drive roots like C:/Windows, C:/Program Files, C:/Program Files (x86)
    if (/^[a-zA-Z]:\/(windows|program files|program files \(x86\)|system32)($|\/)/i.test(lower)) {
      // Check if it's the OS dir itself, or subfolder of Windows/Program Files
      if (
        /^[a-zA-Z]:\/windows$/i.test(lower) ||
        /^[a-zA-Z]:\/program files$/i.test(lower) ||
        /^[a-zA-Z]:\/program files \(x86\)$/i.test(lower) ||
        /^[a-zA-Z]:\/system32$/i.test(lower)
      ) {
        return true;
      }
    }
  } else {
    const sysDirs = ['/usr', '/etc', '/bin', '/var', '/system', '/sbin', '/lib', '/dev', '/proc', '/sys'];
    const lower = normP.toLowerCase();
    if (sysDirs.includes(lower)) {
      return true;
    }
  }
  return false;
}

export function checkWslMountWarning(root: string, isWsl: boolean): string | null {
  if (isWsl && /^\/mnt\/[a-zA-Z](\/|$)/.test(root)) {
    return `Workspace ${root} is under /mnt/. Operations may be slower than native Linux filesystems.`;
  }
  return null;
}

export async function validateWorkspace(
  candidate: string,
  hostContext: HostContext,
  deps: WorkspaceDeps,
  source: WorkspaceSource = 'argument'
): Promise<WorkspaceRef> {
  const platform = deps.env.platform();

  let realRoot: string;
  try {
    const exists = await deps.fsRead.exists(candidate);
    if (!exists) {
      return {
        root: candidate,
        source,
        verdict: 'refused',
        refusalReason: 'not-found',
        projectMarkers: [],
        consentGranted: false
      };
    }
    realRoot = await deps.fsRead.realpath(candidate);
  } catch (err: any) {
    if (err?.code === 'EACCES' || err?.code === 'EPERM') {
      return {
        root: candidate,
        source,
        verdict: 'refused',
        refusalReason: 'no-permission',
        projectMarkers: [],
        consentGranted: false
      };
    }
    return {
      root: candidate,
      source,
      verdict: 'refused',
      refusalReason: 'not-found',
      projectMarkers: [],
      consentGranted: false
    };
  }

  try {
    const st = await deps.fsRead.stat(realRoot);
    if (!st.isDirectory()) {
      return {
        root: realRoot,
        source,
        verdict: 'refused',
        refusalReason: 'not-a-directory',
        projectMarkers: [],
        consentGranted: false
      };
    }
  } catch (err: any) {
    if (err?.code === 'EACCES' || err?.code === 'EPERM') {
      return {
        root: realRoot,
        source,
        verdict: 'refused',
        refusalReason: 'no-permission',
        projectMarkers: [],
        consentGranted: false
      };
    }
    return {
      root: realRoot,
      source,
      verdict: 'refused',
      refusalReason: 'not-found',
      projectMarkers: [],
      consentGranted: false
    };
  }

  // Refusal checks
  let refusalReason: WorkspaceRefusalReason | undefined;
  const normRoot = normalizePath(realRoot, platform);

  if (isFsOrDriveRoot(normRoot)) {
    refusalReason = 'fs-root';
  } else if (isHomeDir(normRoot, deps.env.homedir(), platform)) {
    refusalReason = 'home-dir';
  } else if (isUserFolderRoot(normRoot, deps.env.homedir(), platform)) {
    refusalReason = 'user-folder-root';
  } else if (isSystemDir(normRoot, platform)) {
    refusalReason = 'system-dir';
  }

  if (refusalReason) {
    return {
      root: realRoot,
      source,
      verdict: 'refused',
      refusalReason,
      projectMarkers: [],
      consentGranted: false
    };
  }

  // WSL warning
  const wslWarning = checkWslMountWarning(normRoot, hostContext.isWsl);
  if (wslWarning && deps.logger) {
    deps.logger.warn(wslWarning);
  }

  // Collect project markers
  const foundMarkers: string[] = [];
  for (const marker of PROJECT_MARKERS) {
    const markerPath = `${realRoot}/${marker}`.replace(/\\/g, '/');
    try {
      if (await deps.fsRead.exists(markerPath)) {
        foundMarkers.push(marker);
      }
    } catch {
      // Ignore stat errors for individual markers
    }
  }

  return {
    root: realRoot,
    source,
    verdict: 'ok',
    projectMarkers: foundMarkers,
    consentGranted: false
  };
}

export async function assertInsideJail(
  root: string,
  target: string,
  deps?: { fsRead?: FsRead; env?: Env; platform?: 'win32' | 'darwin' | 'linux' }
): Promise<string> {
  const platform = deps?.platform ?? deps?.env?.platform() ?? 'win32';
  
  let resolvedRoot = root;
  let resolvedTarget = target;

  if (deps?.fsRead) {
    try {
      resolvedRoot = await deps.fsRead.realpath(root);
    } catch {
      resolvedRoot = root;
    }
    try {
      resolvedTarget = await deps.fsRead.realpath(target);
    } catch {
      resolvedTarget = target;
    }
  }

  const normRoot = normalizePath(resolvedRoot, platform);
  const normTarget = normalizePath(resolvedTarget, platform);

  const compareRoot = platform === 'win32' ? normRoot.toLowerCase() : normRoot;
  const compareTarget = platform === 'win32' ? normTarget.toLowerCase() : normTarget;

  // Root should match or target should be a subpath: compareTarget === compareRoot || compareTarget.startsWith(compareRoot + '/')
  const isInside =
    compareTarget === compareRoot ||
    compareTarget.startsWith(compareRoot.endsWith('/') ? compareRoot : compareRoot + '/');

  if (!isInside) {
    throw new Error(`Path jail violation: target '${target}' (resolved: '${resolvedTarget}') is outside root '${root}' (resolved: '${resolvedRoot}')`);
  }

  return resolvedTarget;
}
