import type { EnvSnapshot } from '../../../contracts/index.js';
import type { HostRule, HostRuleResult } from './types.js';

export const vscodeRule: HostRule = {
  name: 'vscode',
  match(snapshot: EnvSnapshot): HostRuleResult | null {
    const isTermVscode = snapshot.values['TERM_PROGRAM'] === 'vscode';
    const hasVscodePid = snapshot.names.includes('VSCODE_PID');
    const vscodeVars = snapshot.names.filter(n => n.startsWith('VSCODE_'));

    if (isTermVscode || hasVscodePid) {
      const matchedSignals: string[] = [];
      if (snapshot.names.includes('TERM_PROGRAM') && isTermVscode) {
        matchedSignals.push('TERM_PROGRAM');
      }
      for (const n of vscodeVars) {
        if (!matchedSignals.includes(n)) {
          matchedSignals.push(n);
        }
      }
      return {
        host: 'vscode',
        kind: 'ide-terminal',
        confidence: 'high',
        matchedSignals
      };
    }

    if (vscodeVars.length > 0) {
      return {
        host: 'vscode',
        kind: 'ide-terminal',
        confidence: vscodeVars.length >= 2 ? 'medium' : 'low',
        matchedSignals: vscodeVars
      };
    }

    return null;
  }
};
