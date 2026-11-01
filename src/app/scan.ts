// ROLE: Coordinates workspace resolution, consent, filesystem scanning, and frontend trace scoring use-cases.
// INPUTS: ScanFlags, ScanWorkspaceDeps, and WorkspaceRef.
// CRITICAL: Throws if consent missing; suspect outcomes require interactive confirmation or default to blocked.

import type { EnvSnapshot, HostContext, WorkspaceRef, ScanReport, FrontendTraceReport } from '../contracts/index.js';
import type { FsRead, Env, Prompt, RecentStore, Logger } from '../ports/index.js';
import { classifyHost } from '../core/env/index.js';
import { scan } from '../core/scan/index.js';
import { evaluateTrace, createTraceReader } from '../core/trace/index.js';
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

export interface ScanWorkspaceFlags {
  yes?: boolean;
  nonInteractive?: boolean;
}

export interface ScanWorkspaceDeps {
  fs: FsRead;
  prompt: Prompt;
  logger?: Logger | undefined;
}

export type ScanOutcome = 'empty' | 'blocked' | 'suspect' | 'clean';

export interface ScanWorkspaceResult {
  scan: ScanReport;
  trace: FrontendTraceReport;
  outcome: ScanOutcome;
}

export async function scanWorkspace(
  workspace: WorkspaceRef,
  flags: ScanWorkspaceFlags,
  deps: ScanWorkspaceDeps
): Promise<ScanWorkspaceResult> {
  if (!workspace.consentGranted) {
    throw new Error(`Consent not granted for workspace: ${workspace.root}`);
  }

  const scanReport = await scan(workspace, { fs: deps.fs });

  if (scanReport.verdict === 'empty') {
    const emptyTrace: FrontendTraceReport = {
      score: 0,
      verdict: 'clean',
      hits: []
    };
    return {
      scan: scanReport,
      trace: emptyTrace,
      outcome: 'empty'
    };
  }

  const reader = createTraceReader(workspace.root, deps.fs);
  const traceReport = await evaluateTrace(scanReport, reader);

  if (traceReport.verdict === 'blocked') {
    return {
      scan: scanReport,
      trace: traceReport,
      outcome: 'blocked'
    };
  }

  if (traceReport.verdict === 'clean') {
    return {
      scan: scanReport,
      trace: traceReport,
      outcome: 'clean'
    };
  }

  // Suspect handling: score is 2 to 4
  if (flags.yes || flags.nonInteractive) {
    return {
      scan: scanReport,
      trace: traceReport,
      outcome: 'blocked'
    };
  }

  // Interactive suspect confirmation
  const confirmed = await deps.prompt.confirm('Confirm these are not a frontend?');
  return {
    scan: scanReport,
    trace: traceReport,
    outcome: confirmed ? 'clean' : 'blocked'
  };
}

