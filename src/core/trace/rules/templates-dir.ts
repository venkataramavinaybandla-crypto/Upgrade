// ROLE: Detects server-side template directories like Flask or Django templates/.
// INPUTS: ScanReport file inventory.
// CRITICAL: Matches template folder paths without reading file contents.

import type { ScanReport } from '../../../contracts/index.js';
import type { TraceRule, TraceRuleResult } from './types.js';

export const templatesDirRule: TraceRule = {
  id: 'templates-dir',
  weight: 1,
  async evaluate(scan: ScanReport): Promise<TraceRuleResult> {
    const regex = /(^|\/)templates\//;
    const matchedPaths = scan.files
      .filter(f => regex.test(f.path))
      .map(f => f.path);

    return {
      fired: matchedPaths.length > 0,
      paths: matchedPaths
    };
  }
};
