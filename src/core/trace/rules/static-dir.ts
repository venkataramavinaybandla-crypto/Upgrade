// ROLE: Detects static asset directories (public/ or static/).
// INPUTS: ScanReport file inventory.
// CRITICAL: Matches static asset paths without reading file contents.

import type { ScanReport } from '../../../contracts/index.js';
import type { TraceRule, TraceRuleResult } from './types.js';

export const staticDirRule: TraceRule = {
  id: 'static-dir',
  weight: 1,
  async evaluate(scan: ScanReport): Promise<TraceRuleResult> {
    const regex = /(^|\/)(public|static)\//;
    const matchedPaths = scan.files
      .filter(f => regex.test(f.path))
      .map(f => f.path);

    return {
      fired: matchedPaths.length > 0,
      paths: matchedPaths
    };
  }
};
