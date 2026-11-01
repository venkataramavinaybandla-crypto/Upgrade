// ROLE: Detects JSX/TSX component files within components/ directories.
// INPUTS: ScanReport file inventory.
// CRITICAL: Matches UI component directories without reading file contents.

import type { ScanReport } from '../../../contracts/index.js';
import type { TraceRule, TraceRuleResult } from './types.js';

export const componentsDirRule: TraceRule = {
  id: 'components-dir',
  weight: 3,
  async evaluate(scan: ScanReport): Promise<TraceRuleResult> {
    const regex = /(^|\/)components\/.*\.(jsx|tsx)$/;
    const matchedPaths = scan.files
      .filter(f => regex.test(f.path))
      .map(f => f.path);

    return {
      fired: matchedPaths.length > 0,
      paths: matchedPaths
    };
  }
};
