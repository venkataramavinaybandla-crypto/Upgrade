# Upgrade: The Playbook

How tasks execute. Follow these in order. If a workflow here conflicts with `AGENTS.md`, `AGENTS.md` wins for agent behavior and this file wins for project mechanics. Report the conflict in `memory.md`.

## 0. Read order and update duties

1. `AGENTS.md`
2. `context.md` for the map
3. `architecture.json` for contracts and the current phase
4. `memory.md` for decisions, open questions, and rejected ideas
5. this file

Duties after every task: update `memory.md` (log line, new decisions or questions), and update phase `status` in `architecture.json` if it changed. Keep `AGENTS.md` short, because agents auto-load it and some silently truncate combined context around 32 KiB. The four planning files are read on demand, so keep each under about 25 KB and split a file by topic if it grows past that.

## 1. The task loop (every task)

1. **Locate.** Find the module in `architecture.json` and confirm its phase is the active one. If it is not, stop and say so.
2. **Contract check.** Read the input and output contracts for that module. If the task needs a contract change, switch to workflow 5.
3. **Test first.** Write or extend a fixture and a failing test that expresses the expected behavior.
4. **Implement inside one module.** Touch only that module's folder plus its registry line. Anything else needs a new task.
5. **Run the check script.** Types, lint, boundary check, tests. All green or the task is not done.
6. **Update the ledger.** Log entry in `memory.md`, status in `architecture.json`.
7. **Report.** What changed, which contract or decision it relies on, what is next.

## 2. Ground rules

- Three-line header convention (ROLE, INPUTS, CRITICAL, max 140 chars per line) on every code file (.ts, .mjs, .js, .cjs under src/, scripts/, test/, and root config files). Update header in the same commit whenever behavior, inputs, or invariants change.
- One module per task. Cross-module work goes through contracts, never through internals.
- `core` has no `fs`, `process`, or `console`. Use ports.
- Side effects at the edge. Wiring happens only in `src/main.ts`.
- No AI, no network, no telemetry. Ever.
- Never read secret files (`.env*`, keys, credentials). The scanner skips them and a test proves it.
- Never write outside the workspace jail. Every write goes through the journal.
- Pure functions return data. They do not print.
- Prefer the simplest rule that passes the fixtures. No cleverness without a failing fixture that demands it.

## 3. Workflow: add a stack extractor

1. Collect a real sample folder tree of that stack. Reduce it to a tiny fixture under `test/fixtures/<stackId>/`.
2. Add a fingerprint rule (evidence list and confidence weights) in `src/core/fingerprint/rules/<stackId>.ts` and register it.
3. Create `src/extractors/<stackId>/` implementing the `Extractor` interface. Input: workspace files through `FsRead`. Output: UI-IR.
4. Write the golden file `test/golden/<stackId>.ir.json` by hand-reviewing the first output.
5. Add one registry line in `src/extractors/index.ts`.
6. Run the check script. No existing module should have changed. If one did, the boundaries are wrong: fix them first.
7. Log in `memory.md`.

## 4. Workflow: add a rule to a registry

Applies to frontend-trace rules, readiness checks, and host detection rules.

1. Add a fixture that should trigger it, and one that should not.
2. Add the rule file with an id, weight or level, and a one-line human reason.
3. Register it. Update the matching list in `architecture.json` config.
4. Confirm the existing fixtures still give the same verdicts.

## 5. Workflow: change a contract

1. Open a `memory.md` entry first: what changes, why, who is affected.
2. Update `architecture.json`, then the Zod schema and types in `src/contracts`, in that order.
3. Bump `contractVersion` if any existing field changes meaning or disappears. Adding an optional field does not need a bump.
4. If persisted data is affected (manifest, IR snapshot), add a migration with a test over an old sample file.
5. Fix every compile error. Do not use `any` or casts to make them go away.

## 6. Workflow: add a CLI command

1. Define the use-case in `src/app` first, returning a plain result object.
2. Add the route in `src/cli`. It parses flags, calls the use-case, renders the result. No decisions.
3. Support `--json` and non-interactive mode from day one.
4. Put every user-facing string in `src/cli/copy.ts`.
5. Assign exit codes from the table in `architecture.json`. Add a new code only through workflow 5.

## 7. Workflow: close a phase

1. Walk the phase's `exit` list in `architecture.json`. Each item needs a passing test or a recorded manual check.
2. Run the boundary check and the full test suite.
3. Re-read the Phase's open questions in `memory.md`. Anything still open must have a recorded default.
4. Set the phase `status` to `done`, log it, and name the next phase.
5. Do not start the next phase in the same task.

## 8. Workflow: any write to the user's project (Phase 5 onward)

1. Compute the full file plan first. Nothing is written during planning.
2. Verify every target path is inside the workspace jail.
3. Open the session: create the token and manifest with status `active`.
4. For each file: write the journal entry, back up the original if it exists, perform the operation, record the hash.
5. On any error: stop, run undo over the journal, report what was rolled back.
6. Undo: walk the journal backwards. If a file's current hash differs from `hashAfter`, ask before touching it.

## 9. Workflow: add a template (Phase 10, not before)

1. Write the manifest to the `TemplateManifest` contract: name, category, palette, slots.
2. Declare slots, not entities. A template says "I need a collection with title, image, price", never "I need Product".
3. Prove it against at least two different fixture IRs.
4. Design taste: simple, classy, premium. Not overly stylish. No wavy banner artifacts.

## 10. Testing strategy

- **Fixtures:** tiny, hand-made backends in `test/fixtures/`. Include nasty cases: empty folder, half-built backend, React mixed in, Flask `templates/`, secrets present.
- **Golden files:** UI-IR output compared to reviewed JSON.
- **Table-driven env tests:** pass env maps straight into the classifier, as plain objects.
- **Fakes for ports:** a fake `FsRead` that records every path opened, to assert secrets are never read. A fake `FsWrite` that can fail on write N, to test rollback.
- **Crash test:** abort mid-session, then undo, then compare the tree to the original.
- **Property test (Phase 5):** 10,000 token generations never collide.

## 11. Errors and messages

- Every refusal names the reason and the next step. Example: which folder was refused and why, which trace rules fired and which paths.
- Stack traces only with `--debug`.
- Empty folder message is exactly: `There's ntg here Bruhhh...`
- Tone: casual and friendly, never rude. Roast the situation, never the user.
- All strings live in `src/cli/copy.ts`.

## 12. Git and commits

- Branch per task: `phase-<n>/<module>-<short-name>`.
- Commit format: `<module>: <what changed>`. Example: `trace: add tailwind-config rule`.
- One module per commit where possible. Contract changes get their own commit.
- Never commit anything under a fixture's fake `.env` that looks like a real secret.

## 13. Definition of done

- Check script is green (`npm run check`: check-headers, types, boundaries, tests).
- Header convention verified (check-headers green), and file header updated in the same commit whenever behavior, inputs, or invariants change.
- New behavior has a fixture and a test.
- No contract drift between `architecture.json` and `src/contracts`.
- `memory.md` log updated. Phase status updated if it changed.
- No file outside the task's module was edited, except the registry line and docs.

## 14. Never

- Never put logic in `src/cli`.
- Never import `infra` anywhere except `src/main.ts`.
- Never use `process.cwd()` after the workspace is resolved. Use `workspaceRoot`.
- Never overwrite a user-edited generated file.
- Never touch `custom/`.
- Never start an auto-watcher before the readiness gate is wired in.
- Never mark an assumption as verified without a recorded check.

## 15. When stuck

1. Re-read the relevant contract and the `memory.md` open questions.
2. If the answer needs a user decision, add a `Q-xxx` entry with a proposed default, then continue with the default.
3. If two decisions conflict, stop and ask. Do not pick silently.

## 16. Check script (created in Phase 0)

One command runs everything: headers, type check, boundary check, tests.
Command: `npm run check` (executes `npm run check:headers && npm run typecheck && npm run check:boundaries && npm run test`).
