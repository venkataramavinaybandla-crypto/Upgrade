// ROLE: Detects client-side script tags inside root index.html.
// INPUTS: ScanReport and TraceReader.
// CRITICAL: Inspects root index.html only; requires TraceReader allowlist enforcement and safe handling.

import type { ScanReport } from '../../../contracts/index.js';
import type { TraceRule, TraceRuleResult, TraceReader } from './types.js';

export const rootIndexHtmlScriptRule: TraceRule = {
  id: 'root-index-html-script',
  weight: 5,
  async evaluate(scan: ScanReport, reader: TraceReader): Promise<TraceRuleResult> {
    const hasRootHtml = scan.files.some(f => f.path === 'index.html');
    if (!hasRootHtml) {
      return { fired: false, paths: [] };
    }

    const content = await reader.readText('index.html');
    if (!content) {
      return { fired: false, paths: [] };
    }

    const hasScriptTag = /<script\b[^>]*>/i.test(content);
    return {
      fired: hasScriptTag,
      paths: hasScriptTag ? ['index.html'] : []
    };
  }
};
