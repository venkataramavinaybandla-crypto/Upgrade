// ROLE: Provides UI-IR canonical JSON serialization, structural and relational validation, normalization, and hashing.
// INPUTS: UIIR contract objects and Hash port.
// CRITICAL: Validation enforces relational cross-checks; hashIR excludes extractorVersion and warnings for shape stability.

import { UIIRSchema, type UIIR } from '../../contracts/index.js';
import type { Hash } from '../../ports/index.js';

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter(k => obj[k] !== undefined)
    .sort();

  const entries = keys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${entries.join(',')}}`;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateIR(raw: unknown): ValidationResult {
  const errors: string[] = [];

  const parseResult = UIIRSchema.safeParse(raw);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      const pathStr = issue.path.length > 0 ? issue.path.join('.') : 'root';
      errors.push(`${pathStr}: ${issue.message}`);
    }
  }

  if (raw && typeof raw === 'object') {
    const candidate = raw as Partial<UIIR>;

    const entities = Array.isArray(candidate.entities) ? candidate.entities : [];
    const routes = Array.isArray(candidate.routes) ? candidate.routes : [];

    if (entities.length === 0 && routes.length === 0) {
      errors.push('root: IR must contain at least one entity or route');
    }

    const entityNames = new Set<string>();
    for (const entity of entities) {
      if (entity && typeof entity.name === 'string') {
        if (entityNames.has(entity.name)) {
          errors.push(`entities.${entity.name}: duplicate entity name '${entity.name}'`);
        }
        entityNames.add(entity.name);

        const fieldNames = new Set<string>();
        if (Array.isArray(entity.fields)) {
          for (const field of entity.fields) {
            if (field && typeof field.name === 'string') {
              if (fieldNames.has(field.name)) {
                errors.push(`entities.${entity.name}.fields.${field.name}: duplicate field name '${field.name}'`);
              }
              fieldNames.add(field.name);
            }
          }
        }
      }
    }

    for (const entity of entities) {
      if (entity && Array.isArray(entity.fields)) {
        for (const field of entity.fields) {
          if (field?.relationTo && !entityNames.has(field.relationTo)) {
            errors.push(`entities.${entity.name}.fields.${field.name}.relationTo: referenced entity '${field.relationTo}' does not exist`);
          }
        }
      }
    }

    for (const route of routes) {
      if (route) {
        if (route.entity && !entityNames.has(route.entity)) {
          errors.push(`routes.${route.id}.entity: referenced entity '${route.entity}' does not exist`);
        }

        if (typeof route.path === 'string') {
          const paramMatches = [...route.path.matchAll(/:([a-zA-Z0-9_]+)/g)].map(m => m[1]);
          for (const param of paramMatches) {
            if (!Array.isArray(route.params) || !route.params.includes(param)) {
              errors.push(`routes.${route.id}.params: path parameter ':${param}' missing from params list`);
            }
          }
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function normalizeIR(ir: UIIR): UIIR {
  const sortedEntities = [...ir.entities]
    .map(entity => ({
      ...entity,
      fields: [...entity.fields].sort((a, b) => a.name.localeCompare(b.name))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const sortedRoutes = [...ir.routes].sort((a, b) => {
    const keyA = `${a.method} ${a.path}`;
    const keyB = `${b.method} ${b.path}`;
    return keyA.localeCompare(keyB);
  });

  const dedupedWarnings = Array.from(new Set(ir.warnings)).sort();

  return {
    ...ir,
    entities: sortedEntities,
    routes: sortedRoutes,
    warnings: dedupedWarnings
  };
}

export function hashIR(ir: UIIR, hash: Hash): string {
  const normalized = normalizeIR(ir);
  const forHash = {
    irVersion: normalized.irVersion,
    source: {
      stackId: normalized.source.stackId
    },
    entities: normalized.entities,
    routes: normalized.routes,
    auth: normalized.auth,
    realtime: normalized.realtime,
    baseUrl: normalized.baseUrl,
    openapiUrl: normalized.openapiUrl
  };
  return hash.sha256(canonicalJson(forHash));
}
