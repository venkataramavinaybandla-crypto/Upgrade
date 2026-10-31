// ROLE: Defines rule contracts and result structures for host environment detection rules.
// INPUTS: Contract types from src/contracts (EnvSnapshot, HostName, HostKind, Confidence).
// CRITICAL: Keeps host detection rules strictly isolated and interchangeable.

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

