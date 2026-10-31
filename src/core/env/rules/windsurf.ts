// ROLE: Evaluates presence of Windsurf IDE terminal environment markers.
// INPUTS: EnvSnapshot { names, values, platform, isWsl, isTty, cwd }.
// CRITICAL: Checks CODEIUM_EDITOR_APP_ROOT; signals array must record variable names only, never values.

import type { EnvSnapshot } from '../../../contracts/index.js';
import type { HostRule, HostRuleResult } from './types.js';

export const windsurfRule: HostRule = {
  name: 'windsurf',
  match(snapshot: EnvSnapshot): HostRuleResult | null {
    const signals: string[] = [];
    if (snapshot.names.includes('CODEIUM_EDITOR_APP_ROOT')) {
      signals.push('CODEIUM_EDITOR_APP_ROOT');
    }
    for (const name of snapshot.names) {
      if ((name.startsWith('WINDSURF_') || name.startsWith('CODEIUM_')) && !signals.includes(name)) {
        signals.push(name);
      }
    }
    if (signals.length > 0) {
      return {
        host: 'windsurf',
        kind: 'ide-terminal',
        confidence: 'high',
        matchedSignals: signals
      };
    }
    return null;
  }
};

