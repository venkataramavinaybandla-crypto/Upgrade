// ROLE: Exports the priority-ordered registry of terminal host detection rules.
// INPUTS: Individual host rules from ./rules/*.js.
// CRITICAL: Priority order must match architecture.json hostDetection.priority.

import type { HostRule } from './types.js';
import { cursorRule } from './cursor.js';
import { windsurfRule } from './windsurf.js';
import { antigravityRule } from './antigravity.js';
import { jetbrainsRule } from './jetbrains.js';
import { zedRule } from './zed.js';
import { vscodeRule } from './vscode.js';
import { windowsTerminalRule } from './windows-terminal.js';
import { fallbackPlainRule } from './fallback-plain.js';

export const HOST_RULES_REGISTRY: readonly HostRule[] = [
  cursorRule,
  windsurfRule,
  antigravityRule,
  jetbrainsRule,
  zedRule,
  vscodeRule,
  windowsTerminalRule,
  fallbackPlainRule
] as const;

