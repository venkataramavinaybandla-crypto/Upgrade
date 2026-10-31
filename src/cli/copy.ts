// ROLE: Centralizes all user-facing terminal copy, error messages, and refusal explanations.
// INPUTS: Refusal reasons and interpolated string variables.
// CRITICAL: Tone must be clear and direct without decorative wavy banners or styling artifacts.

import type { WorkspaceRefusalReason } from '../contracts/index.js';

export const refusalReasonMessages: Record<WorkspaceRefusalReason, string> = {
  'fs-root': 'Refusing filesystem or drive root. Upgrade must run inside a specific project folder.',
  'home-dir': 'Refusing user home directory. Upgrade must run inside a specific project folder.',
  'system-dir': 'Refusing operating system directory. Upgrade must run inside a project folder.',
  'user-folder-root': 'Refusing top-level Desktop, Documents, or Downloads folder. Projects inside them are fine.',
  'not-a-directory': 'The specified path is a file, not a directory.',
  'not-found': 'The specified path does not exist.',
  'no-permission': 'Permission denied accessing the specified folder.',
  'undefined': 'The specified folder could not be validated.'
};

export const copy = {
  appDescription: 'Upgrade - terminal-only CLI for generating web frontends from backend shapes',
  
  // Doctor output
  doctorTitle: 'Upgrade Environment Doctor',
  doctorHost: (host: string) => `Host: ${host}`,
  doctorKind: (kind: string) => `Kind: ${kind}`,
  doctorConfidence: (conf: string) => `Confidence: ${conf}`,
  doctorSignals: (signals: string[]) => `Signals: ${signals.length > 0 ? signals.join(', ') : 'none'}`,
  doctorOs: (os: string) => `OS: ${os}`,
  doctorWsl: (isWsl: boolean) => `WSL: ${isWsl ? 'yes' : 'no'}`,

  // Scan output
  scanPhase1Header: 'Workspace Resolution and Consent (Phase 1)',
  workspaceConfirmed: (root: string) => `Workspace confirmed: ${root}`,
  workspaceSource: (source: string) => `Source: ${source}`,
  projectMarkers: (markers: string[]) => `Project markers: ${markers.length > 0 ? markers.join(', ') : 'none detected'}`,
  consentGranted: 'Consent granted: yes',
  consentDeclined: 'Consent declined. Scanning cancelled.',

  // Errors
  refusalTitle: (reason?: WorkspaceRefusalReason) =>
    `Refused workspace: ${reason ? refusalReasonMessages[reason] : 'Unsafe or invalid folder.'}`,
  usageError: (msg: string) => `Usage error: ${msg}`,
  unexpectedError: (msg: string) => `Unexpected error: ${msg}`
};
