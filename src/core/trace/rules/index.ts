// ROLE: Consolidates and exports all 11 frontend trace scoring rules in a registry.
// INPUTS: Individual trace rules imported from ./rules/*.ts.
// CRITICAL: Order and IDs must correspond to architecture.json config.frontendTrace.rules.

import type { TraceRule } from './types.js';
import { depFrontendFrameworkRule } from './dep-frontend-framework.js';
import { fileAppEntryRule } from './file-app-entry.js';
import { rootIndexHtmlScriptRule } from './root-index-html-script.js';
import { componentFilesRule } from './component-files.js';
import { tailwindConfigRule } from './tailwind-config.js';
import { pagesDirRule } from './pages-dir.js';
import { componentsDirRule } from './components-dir.js';
import { staticDirRule } from './static-dir.js';
import { templatesDirRule } from './templates-dir.js';
import { htmlFilesRule } from './html-files.js';
import { cssFilesRule } from './css-files.js';

export * from './types.js';

export const FRONTEND_TRACE_RULES: readonly TraceRule[] = [
  depFrontendFrameworkRule,
  fileAppEntryRule,
  rootIndexHtmlScriptRule,
  componentFilesRule,
  tailwindConfigRule,
  pagesDirRule,
  componentsDirRule,
  staticDirRule,
  templatesDirRule,
  htmlFilesRule,
  cssFilesRule
] as const;
