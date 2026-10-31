import type { EnvSnapshot, HostName, HostKind, Confidence } from '../../../contracts/index.js';

export interface HostRuleResult {
  host: HostName;
  kind: HostKind;
  confidence: Confidence;
  matchedSignals: string[];
}

export interface HostRule {
  name: string;
  match(snapshot: EnvSnapshot): HostRuleResult | null;
}
