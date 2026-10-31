import type { EnvSnapshot } from '../../../contracts/index.js';
import type { HostRule, HostRuleResult } from './types.js';

export const zedRule: HostRule = {
  name: 'zed',
  match(snapshot: EnvSnapshot): HostRuleResult | null {
    const isZed = snapshot.values['TERM_PROGRAM'] === 'zed';
    const hasZedVar = snapshot.names.some(n => n.startsWith('ZED_'));

    if (isZed || hasZedVar) {
      const matchedSignals: string[] = [];
      if (snapshot.names.includes('TERM_PROGRAM') && isZed) {
        matchedSignals.push('TERM_PROGRAM');
      }
      for (const n of snapshot.names) {
        if (n.startsWith('ZED_') && !matchedSignals.includes(n)) {
          matchedSignals.push(n);
        }
      }

      return {
        host: 'zed',
        kind: 'ide-terminal',
        confidence: isZed ? 'high' : 'medium',
        matchedSignals
      };
    }

    return null;
  }
};
