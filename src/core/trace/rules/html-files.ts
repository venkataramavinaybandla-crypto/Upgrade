// ROLE: Detects HTML files present in the scanned workspace outside ignored directories.
// INPUTS: ScanReport file inventory.
// CRITICAL: Matches .html extension without reading file contents.

import type { ScanReport } from '../../../contracts/index.js';
import type { TraceRule, TraceRuleResult } from './types.js';

export const htmlFilesRule: TraceRule = {
  id: 'html-files',
  weight: 1,
  async evaluate(scan: ScanReport): Promise<TraceRuleResult> {
    const matchedPaths = scan.files
      .filter(f => f.ext === '.html')
      .map(f => f.path);

    return {
      fired: matchedPaths.length > 0,
      paths: matchedPaths
    };
  }
};
