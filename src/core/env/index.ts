import type { EnvSnapshot, HostContext } from '../../contracts/index.js';
import { HOST_RULES_REGISTRY } from './rules/index.js';
import type { HostRuleResult } from './rules/types.js';

export function classifyHost(snapshot: EnvSnapshot): HostContext {
  let matched: HostRuleResult | null = null;

  for (const rule of HOST_RULES_REGISTRY) {
    const result = rule.match(snapshot);
    if (result) {
      matched = result;
      break;
    }
  }

  if (!matched) {
    matched = {
      host: 'unknown',
      kind: 'plain-terminal',
      confidence: 'low',
      matchedSignals: []
    };
  }

  const kind = snapshot.isTty ? matched.kind : 'non-interactive';

  return {
    kind,
    host: matched.host,
    signals: [...matched.matchedSignals],
    confidence: matched.confidence,
    os: snapshot.platform,
    isWsl: snapshot.isWsl,
    cwd: snapshot.cwd
  };
}
