import type { HostContext, WorkspaceRef } from '../contracts/index.js';
import type { FsRead, Env, Prompt, RecentStore, Logger } from '../ports/index.js';
import { validateWorkspace } from '../core/workspace/index.js';
import { AppError } from './errors.js';

export interface ResolveWorkspaceFlags {
  dir?: string;
  yes?: boolean;
}

export interface ResolveWorkspaceDeps {
  fsRead: FsRead;
  env: Env;
  prompt: Prompt;
  recentStore?: RecentStore;
  logger?: Logger;
}

export function cleanCandidatePath(raw: string, homedir: string): string {
  let cleaned = raw.trim();
  // Strip Windows shell drag-and-drop ampersand prefix if present: & 'C:\...'
  if (cleaned.startsWith('& ')) {
    cleaned = cleaned.slice(2).trim();
  }
  // Strip surrounding quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  // Expand tilde
  if (cleaned === '~') {
    cleaned = homedir;
  } else if (cleaned.startsWith('~/') || cleaned.startsWith('~\\')) {
    cleaned = homedir + cleaned.slice(1);
  }
  return cleaned;
}

export async function resolveWorkspace(
  hostContext: HostContext,
  flags: ResolveWorkspaceFlags,
  deps: ResolveWorkspaceDeps
): Promise<WorkspaceRef> {
  const homedir = deps.env.homedir();

  // 1. Non-interactive mode check
  if (hostContext.kind === 'non-interactive') {
    if (!flags.dir || !flags.yes) {
      throw new AppError('Non-interactive mode requires both --dir <path> and --yes.', 2);
    }
    const cleaned = cleanCandidatePath(flags.dir, homedir);
    return await validateWorkspace(cleaned, hostContext, deps, 'argument');
  }

  // 2. Explicit --dir flag given
  if (flags.dir) {
    const cleaned = cleanCandidatePath(flags.dir, homedir);
    const result = await validateWorkspace(cleaned, hostContext, deps, 'argument');
    if (result.verdict === 'ok' && deps.recentStore) {
      await deps.recentStore.addRecent(result.root);
    }
    return result;
  }

  // 3. IDE terminal or Agent shell
  if (hostContext.kind === 'ide-terminal' || hostContext.kind === 'agent-shell') {
    const defaultPath = hostContext.cwd || deps.env.cwd();
    let proceedWithCwd = flags.yes;

    if (!proceedWithCwd) {
      proceedWithCwd = await deps.prompt.confirm(`Working in ${defaultPath}. Right folder?`);
    }

    if (proceedWithCwd) {
      const result = await validateWorkspace(defaultPath, hostContext, deps, 'cwd');
      if (result.verdict === 'ok' && deps.recentStore) {
        await deps.recentStore.addRecent(result.root);
      }
      return result;
    }
  }

  // 4. Plain terminal (or user answered "No" in IDE terminal)
  // NEVER use cwd by default in plain terminal!
  let recentList: string[] = [];
  if (deps.recentStore) {
    try {
      recentList = await deps.recentStore.getRecent();
    } catch {
      recentList = [];
    }
  }

  let selectedPath: string | undefined;
  let source: 'recent' | 'picked' = 'picked';

  if (recentList.length > 0) {
    const ENTER_CUSTOM = '__enter_custom_path__';
    const choices = [
      ...recentList.map(r => ({ label: r, value: r })),
      { label: 'Type or paste a folder path', value: ENTER_CUSTOM }
    ];

    const pick = await deps.prompt.select('Select workspace folder:', choices);
    if (pick === ENTER_CUSTOM) {
      const typed = await deps.prompt.text('Enter folder path:');
      selectedPath = typed;
      source = 'picked';
    } else {
      selectedPath = pick;
      source = 'recent';
    }
  } else {
    const typed = await deps.prompt.text('Enter folder path:');
    selectedPath = typed;
    source = 'picked';
  }

  const cleaned = cleanCandidatePath(selectedPath || '', homedir);
  const result = await validateWorkspace(cleaned, hostContext, deps, source);
  if (result.verdict === 'ok' && deps.recentStore) {
    await deps.recentStore.addRecent(result.root);
  }
  return result;
}
