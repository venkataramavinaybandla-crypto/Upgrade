import type { EnvSnapshot } from '../../../contracts/index.js';
import type { HostRule, HostRuleResult } from './types.js';

export const cursorRule: HostRule = {
  name: 'cursor',
  match(snapshot: EnvSnapshot): HostRuleResult | null {
    const signals: string[] = [];
    if (snapshot.names.includes('CURSOR_TRACE_ID')) {
      signals.push('CURSOR_TRACE_ID');
    }
    for (const name of snapshot.names) {
      if (name.startsWith('CURSOR_') && !signals.includes(name)) {
        signals.push(name);
      }
    }
    if (signals.length > 0) {
      return {
        host: 'cursor',
        kind: 'ide-terminal',
        confidence: 'high',
        matchedSignals: signals
      };
    }
    return null;
  }
};
