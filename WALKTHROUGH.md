# Upgrade - Implementation Walkthrough

## Phase 0: Foundation and Contracts
- **Status**: Completed
- **Deliverables**:
  - Strict TypeScript scaffolding (`tsconfig.json`, `package.json`).
  - Contracts in `src/contracts/index.ts` with Zod schemas and TypeScript types (`EnvSnapshot`, `HostContext`, `WorkspaceRef`, etc.).
  - Port interfaces in `src/ports/index.ts` (`FsRead`, `FsWrite`, `Env`, `Clock`, `Prompt`, `Logger`, `Random`).
  - Layer boundary enforcement in `scripts/check-boundaries.mjs`.
  - Unified check script: `npm run check`.
  - Test suite with contract validation and boundary violation prevention.

---

## Phase 1: Host and Workspace Gate
- **Status**: In Progress
- **Tasks**:
  1. `src/core/env`: Terminal host classifier & rule registry.
  2. `src/core/workspace`: Folder resolver, safety guards, and workspace path jail.
  3. `src/app`: Consent and workspace resolution use-cases.
  4. `src/infra`: Port adapters (Env, FsRead, Prompt) and user-level `recent.json` store.
  5. `src/cli`: Minimal CLI shell (`upgrade doctor --env`, `upgrade scan`).
