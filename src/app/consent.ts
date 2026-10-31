import type { WorkspaceRef } from '../contracts/index.js';
import type { Prompt } from '../ports/index.js';

export interface ConsentOptions {
  yes?: boolean | undefined;
}

export async function askConsent(
  workspace: WorkspaceRef,
  options: ConsentOptions,
  prompt: Prompt
): Promise<WorkspaceRef> {
  if (workspace.verdict === 'refused') {
    return {
      ...workspace,
      consentGranted: false
    };
  }

  if (options.yes) {
    return {
      ...workspace,
      consentGranted: true
    };
  }

  const confirmed = await prompt.confirm(`Allow Upgrade to read and scan '${workspace.root}'?`);
  return {
    ...workspace,
    consentGranted: confirmed
  };
}
