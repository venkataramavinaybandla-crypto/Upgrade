# Upgrade: The Ledger

What we have learned and decided. Append only. Never silently edit an old entry: add a new one that supersedes it and mark the old one `superseded by D-0xx`.

Format: `ID | date | decision | why | status`

## 1. Decisions

Status values: `decided` (user said so), `proposed` (agent suggestion awaiting the user), `superseded`.

| ID | Date | Decision | Why | Status |
|---|---|---|---|---|
| D-001 | 2026-10-31 | Tool is named **Upgrade** | Ben 10 reference: adapts to any device | decided |
| D-002 | 2026-10-31 | Terminal CLI only. Websites only (not apps, not terminal apps) | Keeps the claim honest and the scope finishable | decided |
| D-003 | 2026-10-31 | No AI in detection or template matching. Deterministic pattern rules only | Predictable, testable, offline | decided |
| D-004 | 2026-10-31 | Build order: backend first, then terminal styling. Templates come later, crafted to fit the adaptability design | User rule | decided |
| D-005 | 2026-10-31 | Clean slate only. If frontend traces exist, refuse and ask the user to remove them | No half-merged codebases | decided |
| D-006 | 2026-10-31 | Claim 70-80% coverage, never 100% | Custom flows cannot be inferred | decided |
| D-007 | 2026-10-31 | Every run is a session with a unique never-reused token. Sessions are undoable while active | User feature | decided |
| D-008 | 2026-10-31 | Preview uses sample images and must not touch the user's project | User feature | decided |
| D-009 | 2026-10-31 | Sync re-reads the backend and updates the frontend. Tool only runs on a finished backend, not a half-built one | User rule | decided |
| D-010 | 2026-10-31 | Snapshot the UI-IR (schema), not raw code | Small meaningful diffs instead of line noise | proposed |
| D-011 | 2026-10-31 | Undo = snapshot before write, journal before operation, hash check before touching a file | Crash-safe, protects user edits | proposed |
| D-012 | 2026-10-31 | Ownership zones: `generated/` is Upgrade's, `custom/` is the user's. Edited generated file gets a `.upgrade-new` sibling instead of an overwrite | Sync must never destroy user work | proposed |
| D-013 | 2026-10-31 | Stack: TypeScript strict, Node >= 20 ESM, commander, zod, vitest. Built with npm, check command is `npm run check` | Tested in Phase 0 | decided |
| D-014 | 2026-10-31 | Layered architecture with one-way dependencies, ports for all side effects, registries for extension | User rule: connected pieces, easy to replace | proposed |
| D-015 | 2026-10-31 | Host handling: IDE terminal uses the workspace; plain terminal asks to open a folder. After resolving, pass `workspaceRoot` explicitly and never rely on `process.cwd()` | A child process cannot change the parent shell's directory | decided (behavior), proposed (mechanics) |
| D-016 | 2026-10-31 | Consent before any read. Never read secret files (`.env*`, keys). No network, no telemetry | Trust: user explicitly approves a peek | decided (consent), proposed (rest) |
| D-017 | 2026-10-31 | Manual `upgrade sync` first. No file watcher in MVP | A watcher fires mid-edit, which is the half-built state D-009 bans | proposed |
| D-018 | 2026-10-31 | Planning files: `context.md`, `architecture.json`, `memory.md`, `workflows.md` beside the existing `AGENTS.md` | User request | decided |
| D-019 | 2026-10-31 | Three-line file header convention (ROLE, INPUTS, CRITICAL, max 140 chars) on all code files, verified by scripts/check-headers.mjs | Reader comprehension without opening files | decided |
| D-020 | 2026-10-31 | Planning files (context.md, architecture.json, memory.md, workflows.md) stay tracked in git; the gitignore idea was dropped | Central source of truth across agent sessions | decided |
| D-021 | 2026-10-31 | In-terminal folder browsing deferred to Phase 8 | Plain-terminal offers recent folders and typed/pasted path in Phase 1 minimal shell | decided |
| D-022 | 2026-10-31 | User-level storage for recent.json | Recent workspaces are global to the user, not per-project | decided |
| D-023 | 2026-11-01 | Suspect frontends treated as blocked in non-interactive mode and with --yes | Avoids generating over potential existing frontends without explicit interactive confirmation | decided |

## 2. Research findings (2026-10-31)

Sources are summarized, not quoted. Re-verify anything marked UNVERIFIED before relying on it.

- **F-001 VS Code terminal detection.** Terminal detector libraries identify VS Code by `TERM_PROGRAM=vscode`, and some also use `VSCODE_PID`. Source: detect-terminal package docs.
- **F-002 Other IDEs and agents.** A coding-agent detector keys on tool-specific variables: Cursor via `CURSOR_TRACE_ID`, Windsurf via `CODEIUM_EDITOR_APP_ROOT`, Zed via `TERM_PROGRAM=zed`. It also has an Antigravity matcher, but the exact variable was not visible in the part I read. A community post about agent shells uses `ANTIGRAVITY_AGENT`. **UNVERIFIED**: run `upgrade doctor --env` inside the real Antigravity terminal (Q-005).
- **F-003 Detection ordering.** detect-terminal's changelog says tool-specific variables are checked before `TERM_PROGRAM`, because forks of VS Code inherit `TERM_PROGRAM=vscode`. Our priority list follows that.
- **F-004 CLI stack.** Commander is the dominant argument parser. `@clack/prompts` is the 2026 default for polished prompts. oclif adds a plugin system and costs roughly 200-500 ms startup, which we do not need. Ink is a rendering layer, not a CLI framework. Choice: commander + clack, with Ink as an optional later upgrade.
- **F-005 Parsing.** Native tree-sitter needs per-platform builds and has had failures on newer Node versions and Apple Silicon. `web-tree-sitter` (WASM) avoids node-gyp, at the cost of being single-threaded and slightly slower. For a Windows + WSL2 user, WASM is the safer pick. An Express route parsing example with tree-sitter exists and confirms the approach works for method, path, and middleware extraction.
- **F-006 Agent context files.** AGENTS.md guidance in 2026: keep it short (around 150 lines), put important rules first, and watch total size because some agents silently truncate combined context (Codex CLI around 32 KiB). Decision logs stop agents from re-suggesting rejected approaches, which is why this ledger exists. Avoid duplicating the same rules across several config files, since copies drift.
- **F-007 Env var inheritance (reasoning, not sourced).** A plain terminal launched from inside an IDE can inherit the IDE's env vars. So host detection is a heuristic, and the workspace confirmation plus safety guards run in every mode.

## 3. Open questions

| ID | Question | Blocks | Default until answered |
|---|---|---|---|
| Q-001 | Which stack do Antigravity and Freebuff backends usually produce? Need one real folder tree | Phase 3 | Phases 0-2 are stack-independent, so no block yet |
| Q-002 | When a backend field disappears, should sync auto-remove the UI or flag and ask? | Phase 6 | Flag and ask |
| Q-003 | Undo granularity: all-or-nothing per session, or step-level too? | Phase 5 | All-or-nothing |
| Q-004 | Remember consent per folder, or ask every run? | Phase 1 | Ask every run |
| Q-005 | Which env vars does the real Antigravity terminal set? | Phase 1 | Resolved: ANTIGRAVITY_CLI_ALIAS observed in real Antigravity terminal |
| Q-006 | Confirm the proposed stack in D-013 | Phase 0 | Resolved: confirmed TypeScript strict, ESM, vitest, zod |
| Q-007 | Does Freebuff's terminal expose its own env markers? | Phase 1 | Fallback to plain-terminal rules |
| Q-008 | Should generated frontend files shipped to users carry a header and an ownership marker? | Phase 9 | Ownership marker only, decide in Phase 9 |

## 4. Rejected ideas (do not revisit without new evidence)

- **Snapshotting raw code for sync.** Too noisy. Snapshot UI-IR instead (D-010).
- **File watcher auto-sync in MVP.** Triggers on half-built code (D-017).
- **Blind delete on undo.** Would destroy user edits to generated files (D-011).
- **Regex-only route extraction as the main method.** Brittle across formatting styles. Use syntax trees, keep regex for cheap fingerprint signals only (reasoning, not sourced).
- **One-tripwire frontend detection.** A lone `public/` or Flask `templates/` is legitimate backend content. Use weighted scoring.

## 5. Assumptions to verify

- A-001: Most agent-built backends are CRUD-shaped. Check against the first real folder tree.
- A-002: Slot-based templates can reach the 70-80% claim. Check in Phase 10 against at least two different fixture backends.
- A-003: WASM parsing speed is fine for backends under 20,000 files. Benchmark in Phase 3.

## 6. Log

| Date | Entry |
|---|---|
| 2026-10-31 | Brainstorm completed. Planning files created. Phase 0 not started. |
| 2026-10-31 | Phase 0 completed: TypeScript scaffold, contracts, ports, boundary checker, test runner, check script. |
| 2026-10-31 | Corrected context.md runtime layout: recent.json moved from project .upgrade/ to user-level config (D-020). Deferred folder browsing to Phase 8 (D-019). |
| 2026-10-31 | Phase 1 completed: host classifier, workspace guards & path jail, consent & workspace resolution use-cases, infra adapters, minimal CLI shell (doctor --env, scan). All exit criteria verified. |
| 2026-11-01 | Phase 2 completed: filesystem scanner (ignore rules, secret skipping, code verdict), 11-rule frontend trace scorer with sandboxed TraceReader, scanWorkspace use-case (suspect handling, D-023), CLI wiring for scan verdicts and exit codes (12 empty, 13 blocked). All Phase 2 exit criteria passed. |
