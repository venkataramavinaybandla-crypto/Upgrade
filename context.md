# Upgrade: System Map

Read order for any agent: `AGENTS.md` -> `context.md` (this file) -> `architecture.json` -> `memory.md` -> `workflows.md`.

- This file: WHAT we are building and WHERE things live.
- `architecture.json`: exact contracts and boundaries.
- `memory.md`: decisions, findings, open questions.
- `workflows.md`: HOW tasks are executed.

Last updated: 2026-10-31. Status: planning, Phase 0 not started.

## 1. One-liner

Upgrade is a terminal-only CLI. It reads a finished backend folder, works out its shape with deterministic pattern rules (no AI), and generates a matching website frontend from a template. It then keeps the frontend in sync as the backend evolves.

Name reference: Ben 10's Upgrade, who merges with a machine and adapts it.

## 2. Scope

**In scope**
- Websites only.
- Frontend tech: HTML, CSS, Tailwind CSS, React. Plain JS only when needed.
- CRUD-shaped backends produced by AI coding agents (Antigravity, Freebuff, etc.).
- Fully local: no network, no telemetry, no AI.
- Public claim: covers roughly 70-80% of a site. Never claim 100%.

**Out of scope**
- Mobile apps, desktop apps, terminal apps.
- Custom business flows (multi-step checkout, bespoke workflows).
- Backends with no recognizable shape.
- LLMs anywhere in detection or matching.
- Templates (crafted later, after the engine works).
- Building on top of an existing frontend. Clean slate only.

## 3. Core idea

AI coding agents repeat the same backend shapes: same stacks, same folder layouts, same route styles. So Upgrade does not need to understand any backend. It needs to recognize about 5-8 known shapes (fingerprints), read each with a dedicated extractor, and convert everything into one common format, the **UI-IR**. Everything after the IR (matching, generation, sync) never knows which stack it came from.

```
folder -> [host check] -> [workspace gate + consent] -> [scan] -> [frontend-trace check]
       -> [fingerprint] -> [extractor] -> UI-IR -> [readiness gate]
       -> [template match] -> [gallery Y/N/P] -> [session + generate] -> [sync later]
```

## 4. Target user journey

1. User runs `upgrade`.
2. **Host check.** Inside an IDE terminal (VS Code, Antigravity, Cursor, ...): work with the opened workspace. Inside a plain terminal (cmd, PowerShell, ...): ask the user to open a folder first.
3. **Consent.** Ask permission to read the code. No read before a yes.
4. **Scan.**
   - Nothing found: print `There's ntg here Bruhhh...` and exit.
   - Frontend traces found: refuse, tell the user to remove them and retry.
   - Clean backend: continue.
5. **Fingerprint and extract** to UI-IR, then run the **readiness gate** (backend must be finished, not half-built).
6. **Recommend templates** by rules. Gallery shows name, category, palette, then `[Y/N/P]`. Y starts a session, N returns to the list, P opens a preview.
7. Each run is a **session** with a unique token. Sessions are undoable while active.
8. Later: `upgrade sync` re-reads the backend and updates only the affected generated frontend files.

## 5. Layers (dependencies only point downward)

| Layer | Folder | What lives here | May import |
|---|---|---|---|
| L0 contracts | `src/contracts` | Types, Zod schemas, version numbers | nothing |
| L1 core | `src/core/*` | Pure logic: env classification, trace scoring, fingerprint rules, IR build/diff, readiness rules, matcher, session planning | contracts, ports |
| L1 ports | `src/ports` | Interfaces: FsRead, FsWrite, Env, Clock, Prompt, Logger | contracts |
| L2 extractors | `src/extractors/<stackId>` | One folder per stack, stack source in, UI-IR out | contracts, ports |
| L3 infra | `src/infra` | Real implementations of ports (node fs, process.env, console) | contracts, ports |
| L4 app | `src/app` | Use-cases that wire core, extractors, ports | everything below |
| L5 cli | `src/cli` | Commander routes, prompts, rendering, copy text. No logic | app, contracts |

Hard rules:
- `core` never touches `fs`, `process`, or `console`. Side effects only through ports.
- Extractors never import each other or `core` internals.
- `cli` never contains decisions. It calls a use-case and renders the result.
- Adding a stack, trace rule, readiness check, or template = adding a file and one registry line. No edits to existing modules.

## 6. Module map

| Id | Layer | Job | Phase |
|---|---|---|---|
| `contracts` | L0 | All shared shapes | 0 |
| `env` | core | Classify terminal host from an env map (pure) | 1 |
| `workspace` | core | Resolve and validate the working folder, safety guards, path jail | 1 |
| `consent` | app | Permission gate before any read | 1 |
| `scan` | core | Inventory files (ignore rules, size limits, skip secrets) | 2 |
| `trace` | core | Frontend-trace scoring | 2 |
| `fingerprint` | core | Stack detection with confidence | 3 |
| `extractors/*` | L2 | Per-stack extraction into UI-IR | 3 |
| `ir` | core | Build, validate, hash, snapshot UI-IR | 3 |
| `readiness` | core | Is the backend finished? Registry of checks | 4 |
| `session` | core + infra | Token, journal, backups, undo, history | 5 |
| `sync` | core | IR diff, rename candidates, ownership zones, conflicts | 6 |
| `match` | core | Template scoring against the IR | 7 |
| `templates` | L2 | Manifest schema and loader (no templates shipped yet) | 7 |
| `cli` | L5 | Terminal experience and styling | 8 |
| `generate` | core + infra | Template + IR to file plan to journaled writes | 9 |
| `preview` | infra | Temp-dir render with mock data and bundled sample images | 9 |

## 7. Runtime layout

Inside the user's project (never inside Upgrade's own repo):

```
.upgrade/
  sessions/<token>/
    manifest.json     what was created or modified, with hashes
    ir.json           UI-IR snapshot for this session
    journal.jsonl     append-only log of every write
    backup/           originals of any modified file
```

User-level configuration (OS-appropriate config directory, e.g. `~/.config/upgrade/recent.json` or `%APPDATA%/upgrade/recent.json`):
```
recent.json           recently opened workspaces (plain-terminal flow)
```

Generated frontend files carry an ownership marker. `generated/` belongs to Upgrade; `custom/` belongs to the user and is never touched.

## 8. Phases

| # | Name | Track |
|---|---|---|
| 0 | Foundation and contracts | Backend |
| 1 | Host and workspace gate | Backend |
| 2 | Scan and classify | Backend |
| 3 | Fingerprint, first extractor, UI-IR | Backend |
| 4 | Readiness gate | Backend |
| 5 | Session engine (token, journal, undo, history) | Backend |
| 6 | Snapshot and sync | Backend |
| 7 | Template contract and matcher | Backend |
| 8 | CLI experience and styling | Frontend (terminal) |
| 9 | Generator and preview | Blocked until templates exist |
| 10 | Template crafting | Separate track |

Exit criteria per phase live in `architecture.json`. A phase is done only when every exit criterion passes.

## 9. Glossary

- **UI-IR**: the stack-independent description of a backend (entities, fields, routes, auth, realtime).
- **Fingerprint**: the evidence that says "this is Express + Mongoose".
- **Extractor**: the module that turns one stack's source into UI-IR.
- **Frontend trace**: any sign a frontend already exists in the folder.
- **Readiness gate**: checks that the backend is finished.
- **Session / token**: one run of Upgrade, identified by a never-reused code like `carbon-otter-4821`.
- **Journal**: append-only record of writes, the basis for undo.
- **Workspace jail**: every write path must resolve inside the workspace root.
- **Zones**: `generated/` (Upgrade owns) vs `custom/` (user owns).
