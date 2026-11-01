# Upgrade - Implementation Walkthrough

## Phase 0: Foundation and Contracts
- **Status**: Completed
- **Deliverables**:
  - Strict TypeScript scaffolding (`tsconfig.json`, `package.json`).
  - Contracts in `src/contracts/index.ts` with Zod schemas and TypeScript types (`EnvSnapshot`, `HostContext`, `WorkspaceRef`, `ScanReport`, `FrontendTraceReport`, `StackFingerprint`, `UIIR`, etc.).
  - Port interfaces in `src/ports/index.ts` (`FsRead`, `FsWrite`, `Env`, `Clock`, `Prompt`, `Logger`, `Random`, `RecentStore`).
  - Layer boundary enforcement script in `scripts/check-boundaries.mjs` (ensuring core has no infra or process access, and cli only touches contracts and app).
  - Unified check script: `npm run check` (typecheck + boundaries + vitest).
  - Test fixtures folder: `test/fixtures/`.

---

## Phase 1: Host and Workspace Gate
- **Status**: Completed
- **Deliverables**:
  - **Task 1: `src/core/env`**: Pure host classification (`classifyHost`) over plain-object snapshots. Host rules for Cursor, Windsurf, Antigravity, JetBrains, Zed, VS Code, Windows Terminal, and fallback shell detection. Leaked IDE vars classified with medium/low confidence. Signals contain variable names only, never values.
  - **Task 2: `src/core/workspace`**: `validateWorkspace` with realpath resolution, safety refusals (filesystem root, drive root, home dir, OS dirs, Desktop/Documents/Downloads roots), WSL `/mnt/<drive>` warning, project marker detection (`package.json`, `.git`, etc.), and `assertInsideJail` (traversal rejection, symlink escape detection, Windows drive and case normalization).
  - **Task 3: `src/app`**: Use-cases `resolveWorkspace` (handling `--dir`, IDE terminal confirmation, plain terminal path prompt / recent selection, non-interactive validation with exit code 2) and `askConsent` (requiring permission before any file reading, honoring `--yes`).
  - **Task 4: `src/infra`**: Port adapters (`NodeEnv`, `buildEnvSnapshot` with allowlist filtering for values, `NodeFsRead`, `ReadlinePrompt`, `JsonRecentStore` in user-level config directory, `ConsoleLogger`). Composition root in `src/main.ts` is the only file importing infra.
  - **Task 5: `src/cli`**: Minimal CLI shell with `upgrade doctor --env` and `upgrade scan`, supporting `--dir`, `--yes`, `--json`, `--no-color`, with copy strings extracted to `src/cli/copy.ts` and exit codes conforming to `architecture.json` (0 = ok, 2 = usage error, 10 = consent declined, 11 = unsafe or invalid folder).

### Phase 1 Exit Criteria Results
| Exit Criterion | Status | Evidence / Verification |
|---|---|---|
| Table-driven tests over env maps for every host | **PASS** | 13 test cases in `test/env.test.ts` passing (Antigravity, vanilla VS Code, Cursor, Windsurf, JetBrains, Zed, Windows Terminal, bare PowerShell, bare cmd, WSL bash, non-TTY pipe, leaked IDE vars). |
| Plain terminal asks for a folder, never scans cwd | **PASS** | Automated test in `test/phase1-exit.test.ts` ("Exit 2: Plain terminal asks for a folder and never scans cwd") confirms plain terminals invoke prompt and do not use cwd. |
| IDE terminal confirms workspace | **PASS** | Automated test in `test/phase1-exit.test.ts` ("Exit 3: IDE terminal confirms workspace") confirms "Working in <path>. Right folder?" prompt. |
| Refused folders are never read | **PASS** | Automated test in `test/phase1-exit.test.ts` ("Exit 4: Refused folders are NEVER read") asserts with a recording `FsRead` fake that 0 files are opened or read when a path is refused. |

---

## Housekeeping: Header Convention & Doc Alignment
- **Status**: Completed
- **Deliverables**:
  - Three-line file header convention (`ROLE`, `INPUTS`, `CRITICAL`, max 140 chars) across all code files in `src/`, `scripts/`, `test/`.
  - Header validator: `scripts/check-headers.mjs` and test suite `test/headers.test.ts`.
  - Integrated into `npm run check`.
  - Logged decisions D-019, D-020, marked D-013, Q-005, Q-006 resolved, added Q-008 in `memory.md`.
  - Updated `architecture.json` and `workflows.md`.

---

## Phase 2: Scan and Classify
- **Status**: Completed
- **Deliverables**:
  - **Task 1: Fixtures**: Tiny committed fixture folders under `test/fixtures/` (`empty/`, `docs-only/`, `clean-express/`, `react-mixed/`, `nested-frontend/`, `flask-templates/`, `ignored-noise/`).
  - **Task 2: `src/core/scan`**: `scan(workspace, deps)` with deterministic POSIX relative paths, ignore directory handling at any depth, secret skipping by name without opening (`secretFilesSkipped`), safety limits (`maxFiles`, `maxDepth`, `maxFileBytes` setting `truncated = true`), symlink avoidance, and manifest/code-extension based `has-code` / `empty` verdict.
  - **Task 3: `src/core/trace`**: 11 frontend trace rules under `src/core/trace/rules/` (`dep-frontend-framework`, `file-app-entry`, `root-index-html-script`, `component-files`, `tailwind-config`, `pages-dir`, `components-dir`, `static-dir`, `templates-dir`, `html-files`, `css-files`). Sandboxed `createTraceReader` enforcing allowlist (`package.json`, `index.html` at depth <= 2) and secret denylist. `evaluateTrace` pure function calculating score and thresholds (>= 5 blocked, 2-4 suspect, <= 1 clean).
  - **Task 4: `src/app`**: `scanWorkspace(workspace, flags, deps)` use-case returning `{ scan, trace, outcome }`. Handles suspect traces: interactively prompts confirmation, or treats as blocked with `--yes` or in non-interactive mode (decision D-023).
  - **Task 5: `src/cli`**: Wired `upgrade scan`: empty prints `There's ntg here Bruhhh...` (exit 12), blocked lists hits with paths and guidance (exit 13), clean displays summary (exit 0), `--json` prints full report object. Centralized copy in `src/cli/copy.ts`.

### Phase 2 Exit Criteria Results
| Exit Criterion | Status | Evidence / Verification |
|---|---|---|
| Fixtures produce expected verdicts (empty, clean-backend, react-mixed, flask-templates) | **PASS** | Automated tests in `test/phase2-exit.test.ts` and `test/trace.test.ts` verify all fixtures produce expected outcomes: `empty` -> empty, `docs-only` -> empty, `clean-express` -> clean (score 1), `react-mixed` -> blocked (score >= 5), `nested-frontend` -> blocked (score >= 5), `flask-templates` -> suspect (score 4), `ignored-noise` -> clean (score 0). |
| Secret files are never opened | **PASS** | Verified via recording `FsRead` fake in `test/phase2-exit.test.ts` and `test/scan.test.ts` that `readText` is called 0 times on secret files and skipped files. |

---

## Phase 3: Fingerprint, First Extractor, UI-IR
- **Status**: Not started (next)
