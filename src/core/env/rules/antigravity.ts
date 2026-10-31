// ROLE: Evaluates Antigravity IDE terminal and agent shell environment markers.
// INPUTS: EnvSnapshot { names, values, platform, isWsl, isTty, cwd }.
// CRITICAL: Distinguishes ide-terminal (ANTIGRAVITY_CLI_ALIAS) from agent-shell (ANTIGRAVITY_AGENT); names only.

import type { EnvSnapshot } from '../../../contracts/index.js';
import type { HostRule, HostRuleResult } from './types.js';

export const antigravityRule: HostRule = {
  name: 'antigravity',
  match(snapshot: EnvSnapshot): HostRuleResult | null {
    const hasAgent = snapshot.names.includes('ANTIGRAVITY_AGENT');
    const hasAlias = snapshot.names.includes('ANTIGRAVITY_CLI_ALIAS');
    const otherAntigravity = snapshot.names.filter(n => n.startsWith('ANTIGRAVITY_'));

    if (!hasAgent && !hasAlias && otherAntigravity.length === 0) {
      return null;
    }

    const matchedSignals = snapshot.names.filter(
      n => n.startsWith('ANTIGRAVITY_') || (n === 'TERM_PROGRAM' && snapshot.values['TERM_PROGRAM'] === 'vscode') || n.startsWith('VSCODE_')
    );

    if (hasAgent) {
      return {
        host: 'antigravity',
        kind: 'agent-shell',
        confidence: 'medium',
        matchedSignals
      };
    }

    if (hasAlias) {
      return {
        host: 'antigravity',
        kind: 'ide-terminal',
        confidence: 'high',
        matchedSignals
      };
    }

    return {
      host: 'antigravity',
      kind: 'ide-terminal',
      confidence: 'medium',
      matchedSignals
    };
  }
};

