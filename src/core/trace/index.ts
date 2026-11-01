// ROLE: Evaluates frontend trace rules against a ScanReport using a safe TraceReader, returning a FrontendTraceReport.
// INPUTS: ScanReport and TraceReader (or FsRead to create a sandboxed reader).
// CRITICAL: TraceReader enforces allowlist (package.json, index.html <= depth 2) and secret denylist; never throws on errors.

import type { FrontendTraceReport, ScanReport } from '../../contracts/index.js';
import type { FsRead } from '../../ports/index.js';
import { matchSecretPattern, SCAN_LIMITS } from '../scan/index.js';
import { FRONTEND_TRACE_RULES, type TraceReader } from './rules/index.js';

export * from './rules/index.js';

export function createTraceReader(workspaceRoot: string, fsRead: FsRead): TraceReader {
  const normRoot = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');

  function isAllowed(relPath: string): boolean {
    const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = norm.split('/');
    if (segments.length > 3) {
      // Depth > 2: e.g. a/b/c/package.json has 3 slashes (depth 3)
      return false;
    }
    const fileName = segments[segments.length - 1];
    if (fileName !== 'package.json' && fileName !== 'index.html') {
      return false;
    }
    if (matchSecretPattern(fileName)) {
      return false;
    }
    return true;
  }

  return {
    async readText(relPath: string): Promise<string | null> {
      if (!isAllowed(relPath)) return null;
      const fullPath = `${normRoot}/${relPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
      try {
        const st = await fsRead.stat(fullPath);
        if (st.size > SCAN_LIMITS.maxFileBytes) {
          return null;
        }
        return await fsRead.readText(fullPath);
      } catch {
        return null;
      }
    },

    async readJson<T = unknown>(relPath: string): Promise<T | null> {
      const text = await this.readText(relPath);
      if (!text) return null;
      try {
        return JSON.parse(text) as T;
      } catch {
        return null;
      }
    }
  };
}

export async function evaluateTrace(
  scan: ScanReport,
  reader: TraceReader
): Promise<FrontendTraceReport> {
  const hits: Array<{ ruleId: string; weight: number; path?: string }> = [];
  let totalScore = 0;

  for (const rule of FRONTEND_TRACE_RULES) {
    let result;
    try {
      result = await rule.evaluate(scan, reader);
    } catch {
      continue;
    }

    if (result.fired) {
      totalScore += rule.weight;
      hits.push({
        ruleId: rule.id,
        weight: rule.weight,
        path: result.paths.slice(0, 5).join(', ')
      });
    }
  }

  let verdict: 'clean' | 'suspect' | 'blocked' = 'clean';
  if (totalScore >= 5) {
    verdict = 'blocked';
  } else if (totalScore >= 2) {
    verdict = 'suspect';
  }

  return {
    score: totalScore,
    verdict,
    hits
  };
}
