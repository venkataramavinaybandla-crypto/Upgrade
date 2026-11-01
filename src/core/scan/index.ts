// ROLE: Scans workspace filesystem tree into a ScanReport without reading file contents, applying ignore rules and safety limits.
// INPUTS: WorkspaceRef { root, consentGranted }, deps { fs: FsRead }.
// CRITICAL: Throws if consent not granted; reads NO file contents; never follows symlinks; skips secrets by name only.

import type { ScanReport, WorkspaceRef } from '../../contracts/index.js';
import type { FsRead } from '../../ports/index.js';
import {
  DEFAULT_IGNORED_DIRS,
  DEFAULT_SECRET_PATTERNS,
  CODE_EXTENSIONS,
  MANIFEST_FILES,
  SCAN_LIMITS
} from './config.js';

export * from './config.js';

export function matchSecretPattern(fileName: string, patterns: readonly string[] = DEFAULT_SECRET_PATTERNS): boolean {
  for (const pattern of patterns) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`, 'i');
    if (regex.test(fileName)) {
      return true;
    }
  }
  return false;
}

function getExtension(relPath: string): string {
  const lastSlash = relPath.lastIndexOf('/');
  const fileName = lastSlash === -1 ? relPath : relPath.slice(lastSlash + 1);
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) return '';
  return fileName.slice(dotIndex).toLowerCase();
}

function getBaseName(relPath: string): string {
  const lastSlash = relPath.lastIndexOf('/');
  return lastSlash === -1 ? relPath : relPath.slice(lastSlash + 1);
}

export async function scan(
  workspace: WorkspaceRef,
  deps: { fs: FsRead }
): Promise<ScanReport> {
  if (!workspace.consentGranted) {
    throw new Error(`Consent not granted for workspace: ${workspace.root}`);
  }

  const rootNormalized = workspace.root.replace(/\\/g, '/').replace(/\/+$/, '');
  const files: Array<{ path: string; ext: string; bytes: number }> = [];
  let totalBytes = 0;
  let secretFilesSkipped = 0;
  let truncated = false;

  async function walk(currentDir: string, currentDepth: number): Promise<void> {
    if (currentDepth > SCAN_LIMITS.maxDepth) {
      truncated = true;
      return;
    }

    let entries: string[];
    try {
      entries = await deps.fs.listDir(currentDir);
    } catch {
      return;
    }

    entries.sort((a, b) => a.localeCompare(b));

    for (const entry of entries) {
      if (files.length >= SCAN_LIMITS.maxFiles) {
        truncated = true;
        return;
      }

      const fullPath = `${currentDir}/${entry}`;
      const relPath = fullPath.slice(rootNormalized.length + 1).replace(/\\/g, '/');

      // Check ignore directory rules
      if (DEFAULT_IGNORED_DIRS.includes(entry as any)) {
        continue;
      }

      // Check secret file rules by name only
      if (matchSecretPattern(entry)) {
        secretFilesSkipped++;
        continue;
      }

      let stat;
      try {
        stat = await deps.fs.stat(fullPath);
      } catch {
        continue;
      }

      // Do not follow symlinks
      if (stat.isSymbolicLink?.()) {
        continue;
      }

      if (stat.isDirectory()) {
        await walk(fullPath, currentDepth + 1);
      } else if (stat.isFile()) {
        if (stat.size > SCAN_LIMITS.maxFileBytes) {
          truncated = true;
        }

        const ext = getExtension(relPath);
        files.push({
          path: relPath,
          ext,
          bytes: stat.size
        });
        totalBytes += stat.size;
      }
    }
  }

  await walk(rootNormalized, 0);

  // Deterministic order
  files.sort((a, b) => a.path.localeCompare(b.path));

  // Determine code verdict
  const hasCode = files.some(f => {
    const base = getBaseName(f.path);
    return MANIFEST_FILES.has(base) || CODE_EXTENSIONS.has(f.ext);
  });

  return {
    root: workspace.root,
    files,
    fileCount: files.length,
    totalBytes,
    truncated,
    ignoredDirs: [...DEFAULT_IGNORED_DIRS],
    secretFilesSkipped,
    verdict: hasCode ? 'has-code' : 'empty'
  };
}
