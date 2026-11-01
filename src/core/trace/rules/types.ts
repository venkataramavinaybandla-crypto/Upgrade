// ROLE: Defines types and interfaces for frontend trace detection rules and the safe trace reader.
// INPUTS: ScanReport from src/contracts.
// CRITICAL: TraceReader enforces strict allowlist (package.json, index.html at depth <= 2) and skips secrets.

import type { ScanReport } from '../../../contracts/index.js';

export interface TraceReader {
  readText(relPath: string): Promise<string | null>;
  readJson<T = unknown>(relPath: string): Promise<T | null>;
}

export interface TraceRuleResult {
  fired: boolean;
  paths: string[];
}

export interface TraceRule {
  readonly id: string;
  readonly weight: number;
  evaluate(scan: ScanReport, reader: TraceReader): Promise<TraceRuleResult>;
}
