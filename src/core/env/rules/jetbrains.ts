import type { EnvSnapshot } from '../../../contracts/index.js';
import type { HostRule, HostRuleResult } from './types.js';

export const jetbrainsRule: HostRule = {
  name: 'jetbrains',
  match(snapshot: EnvSnapshot): HostRuleResult | null {
    const isJediTerm = snapshot.values['TERMINAL_EMULATOR'] === 'JetBrains-JediTerm';
    const hasJetBrainsVar = snapshot.names.some(n => n.startsWith('JETBRAINS_') || n.startsWith('IDEA_'));

    if (isJediTerm || hasJetBrainsVar) {
      const matchedSignals: string[] = [];
      if (snapshot.names.includes('TERMINAL_EMULATOR') && isJediTerm) {
        matchedSignals.push('TERMINAL_EMULATOR');
      }
      for (const n of snapshot.names) {
        if ((n.startsWith('JETBRAINS_') || n.startsWith('IDEA_')) && !matchedSignals.includes(n)) {
          matchedSignals.push(n);
        }
      }

      return {
        host: 'jetbrains',
        kind: 'ide-terminal',
        confidence: isJediTerm ? 'high' : 'medium',
        matchedSignals
      };
    }

    return null;
  }
};
