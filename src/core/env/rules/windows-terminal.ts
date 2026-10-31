import type { EnvSnapshot } from '../../../contracts/index.js';
import type { HostRule, HostRuleResult } from './types.js';

export const windowsTerminalRule: HostRule = {
  name: 'windows-terminal',
  match(snapshot: EnvSnapshot): HostRuleResult | null {
    if (snapshot.names.includes('WT_SESSION')) {
      return {
        host: 'windows-terminal',
        kind: 'plain-terminal',
        confidence: 'high',
        matchedSignals: ['WT_SESSION']
      };
    }
    return null;
  }
};
