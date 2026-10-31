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

## Phase 2: Scan and Classify
- **Status**: Not started (next)
