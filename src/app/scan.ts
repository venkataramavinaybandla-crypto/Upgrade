// ROLE: Coordinates Phase 1 scan use-case (host classification, workspace resolution, and consent gate).
// INPUTS: ScanFlags, ScanDeps { fsRead, env, prompt, recentStore?, logger?, buildSnapshot }.
// CRITICAL: Pure orchestration use-case; reads no files beyond directory verification and project markers.

import type { EnvSnapshot, HostContext, WorkspaceRef } from '../contracts/index.js';
import type { FsRead, Env, Prompt, RecentStore, Logger } from '../ports/index.js';
import { classifyHost } from '../core/env/index.js';
import { resolveWorkspace, type ResolveWorkspaceFlags } from './resolve-workspace.js';
import { askConsent } from './consent.js';

export interface ScanFlags extends ResolveWorkspaceFlags {
  json?: boolean;
  noColor?: boolean;
}

export interface ScanDeps {
  fsRead: FsRead;
  env: Env;
  prompt: Prompt;
  recentStore?: RecentStore;
  logger?: Logger;
  buildSnapshot: (env: Env) => EnvSnapshot;
}

export interface ScanPhase1Result {
  hostContext: HostContext;
  workspaceRef: WorkspaceRef;
}

export async function runScanPhase1(
  flags: ScanFlags,
  deps: ScanDeps
): Promise<ScanPhase1Result> {
  const snapshot = deps.buildSnapshot(deps.env);
  const hostContext = classifyHost(snapshot);

  const workspaceRef = await resolveWorkspace(hostContext, flags, deps);

  if (workspaceRef.verdict === 'refused') {
    return {
      hostContext,
      workspaceRef
    };
  }

  const consentRef = await askConsent(workspaceRef, { yes: flags.yes }, deps.prompt);

  return {
    hostContext,
    workspaceRef: consentRef
  };
}

