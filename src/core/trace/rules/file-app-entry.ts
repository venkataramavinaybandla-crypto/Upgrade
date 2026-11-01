// ROLE: Detects standard application frontend entrypoints like src/App.{jsx,tsx,js,ts}.
// INPUTS: ScanReport file inventory.
// CRITICAL: Pattern matches relative paths without reading file contents.

import type { ScanReport } from '../../../contracts/index.js';
import type { TraceRule, TraceRuleResult } from './types.js';

export const fileAppEntryRule: TraceRule = {
  id: 'file-app-entry',
  weight: 5,
  async evaluate(scan: ScanReport): Promise<TraceRuleResult> {
    const regex = /(^|\/)src\/App\.(jsx|tsx|js|ts)$/;
    const matchedPaths = scan.files
      .filter(f => regex.test(f.path))
      .map(f => f.path);

    return {
      fired: matchedPaths.length > 0,
      paths: matchedPaths
    };
  }
};
