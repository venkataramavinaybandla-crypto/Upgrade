import type { EnvSnapshot, HostContext } from '../contracts/index.js';
import type { Env } from '../ports/index.js';
import { classifyHost } from '../core/env/index.js';

export interface DoctorDeps {
  env: Env;
  buildSnapshot: (env: Env) => EnvSnapshot;
}

export interface DoctorResult {
  snapshot: EnvSnapshot;
  hostContext: HostContext;
}

export function runDoctorEnv(deps: DoctorDeps): DoctorResult {
  const snapshot = deps.buildSnapshot(deps.env);
  const hostContext = classifyHost(snapshot);
  return {
    snapshot,
    hostContext
  };
}
