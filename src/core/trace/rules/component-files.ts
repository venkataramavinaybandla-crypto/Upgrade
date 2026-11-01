// ROLE: Detects dedicated frontend Single File Components (*.vue, *.svelte).
// INPUTS: ScanReport file inventory.
// CRITICAL: Pattern matches extensions without reading file contents.

import type { ScanReport } from '../../../contracts/index.js';
import type { TraceRule, TraceRuleResult } from './types.js';

export const componentFilesRule: TraceRule = {
  id: 'component-files',
  weight: 5,
  async evaluate(scan: ScanReport): Promise<TraceRuleResult> {
    const matchedPaths = scan.files
      .filter(f => f.ext === '.vue' || f.ext === '.svelte')
      .map(f => f.path);

    return {
      fired: matchedPaths.length > 0,
      paths: matchedPaths
    };
  }
};
