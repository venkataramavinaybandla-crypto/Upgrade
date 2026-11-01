// ROLE: Detects Next.js, Nuxt, or file-based routing page files inside pages/ or app/ directories.
// INPUTS: ScanReport file inventory.
// CRITICAL: Matches page routes without reading file contents.

import type { ScanReport } from '../../../contracts/index.js';
import type { TraceRule, TraceRuleResult } from './types.js';

export const pagesDirRule: TraceRule = {
  id: 'pages-dir',
  weight: 3,
  async evaluate(scan: ScanReport): Promise<TraceRuleResult> {
    const regex = /(^|\/)(pages|app)\/.*page\.[^/]+$/;
    const matchedPaths = scan.files
      .filter(f => regex.test(f.path))
      .map(f => f.path);

    return {
      fired: matchedPaths.length > 0,
      paths: matchedPaths
    };
  }
};
