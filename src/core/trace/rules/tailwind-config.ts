// ROLE: Detects Tailwind CSS and PostCSS configuration files.
// INPUTS: ScanReport file inventory.
// CRITICAL: Pattern matches configuration filenames without opening files.

import type { ScanReport } from '../../../contracts/index.js';
import type { TraceRule, TraceRuleResult } from './types.js';

export const tailwindConfigRule: TraceRule = {
  id: 'tailwind-config',
  weight: 3,
  async evaluate(scan: ScanReport): Promise<TraceRuleResult> {
    const regex = /(^|\/)(tailwind|postcss)\.config\.[^/]+$/;
    const matchedPaths = scan.files
      .filter(f => regex.test(f.path))
      .map(f => f.path);

    return {
      fired: matchedPaths.length > 0,
      paths: matchedPaths
    };
  }
};
