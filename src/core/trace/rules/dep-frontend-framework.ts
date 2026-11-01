// ROLE: Evaluates frontend framework dependencies declared in package.json files at depth <= 2.
// INPUTS: ScanReport and TraceReader.
// CRITICAL: Checks dependencies, devDependencies, and peerDependencies; fails safely without throwing on invalid JSON.

import type { ScanReport } from '../../../contracts/index.js';
import type { TraceRule, TraceRuleResult, TraceReader } from './types.js';

export const FRONTEND_FRAMEWORKS = [
  'react',
  'react-dom',
  'vue',
  'svelte',
  '@angular/core',
  'next',
  'nuxt',
  'vite',
  'astro',
  'solid-js'
] as const;

export const depFrontendFrameworkRule: TraceRule = {
  id: 'dep-frontend-framework',
  weight: 5,
  async evaluate(scan: ScanReport, reader: TraceReader): Promise<TraceRuleResult> {
    const matchedPaths: string[] = [];
    const pkgFiles = scan.files.filter(f => f.path === 'package.json' || f.path.endsWith('/package.json'));

    for (const pkg of pkgFiles) {
      const data = await reader.readJson<Record<string, any>>(pkg.path);
      if (!data) continue;

      const allDeps = {
        ...(data.dependencies || {}),
        ...(data.devDependencies || {}),
        ...(data.peerDependencies || {})
      };

      const hasFramework = FRONTEND_FRAMEWORKS.some(fw => fw in allDeps);
      if (hasFramework) {
        matchedPaths.push(pkg.path);
      }
    }

    return {
      fired: matchedPaths.length > 0,
      paths: matchedPaths
    };
  }
};
