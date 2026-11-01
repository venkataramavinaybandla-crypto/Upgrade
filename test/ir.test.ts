// ROLE: Verifies UI-IR canonical serialization, Zod validation, relational cross-checks, normalization, and hashing.
// INPUTS: Valid UIIR objects and deliberate edge-case invalid variants.
// CRITICAL: Asserts deterministic normalization, hash stability across metadata/extractor updates, and schema integrity.

import { describe, it, expect } from 'vitest';
import type { UIIR } from '../src/contracts/index.js';
import { canonicalJson, validateIR, normalizeIR, hashIR } from '../src/core/ir/index.js';
import { NodeHash } from '../src/infra/hash.js';

const hash = new NodeHash();

function createSampleIR(): UIIR {
  return {
    irVersion: 1,
    source: {
      stackId: 'express',
      extractorVersion: '1.0.0'
    },
    entities: [
      {
        name: 'User',
        fields: [
          { name: 'id', type: 'string', required: true, isId: true },
          { name: 'email', type: 'string', required: true, isId: false, format: 'email' }
        ],
        sourcePath: 'models/User.js'
      },
      {
        name: 'Post',
        fields: [
          { name: 'id', type: 'string', required: true, isId: true },
          { name: 'title', type: 'string', required: true, isId: false },
          { name: 'authorId', type: 'string', required: true, isId: false, relationTo: 'User' }
        ],
        sourcePath: 'models/Post.js'
      }
    ],
    routes: [
      {
        id: 'get-users',
        method: 'GET',
        path: '/users',
        kind: 'list',
        entity: 'User',
        params: [],
        requiresAuth: false
      },
      {
        id: 'get-post',
        method: 'GET',
        path: '/posts/:id',
        kind: 'detail',
        entity: 'Post',
        params: ['id'],
        requiresAuth: false
      }
    ],
    auth: {
      style: 'jwt',
      loginRoute: '/login'
    },
    realtime: [],
    baseUrl: 'http://localhost:3000',
    warnings: ['Deprecated auth route']
  };
}

describe('canonicalJson', () => {
  it('sorts keys and omits whitespace', () => {
    const raw = { b: 2, a: 1, nested: { z: true, y: false } };
    expect(canonicalJson(raw)).toBe('{"a":1,"b":2,"nested":{"y":false,"z":true}}');
  });

  it('preserves array order', () => {
    const raw = { list: [3, 1, 2] };
    expect(canonicalJson(raw)).toBe('{"list":[3,1,2]}');
  });
});

describe('validateIR', () => {
  it('passes for a valid complete UIIR', () => {
    const ir = createSampleIR();
    const result = validateIR(ir);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects duplicate entity names', () => {
    const ir = createSampleIR();
    ir.entities.push({
      name: 'User',
      fields: [{ name: 'id', type: 'string', required: true, isId: true }]
    });
    const result = validateIR(ir);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes("duplicate entity name 'User'"))).toBe(true);
  });

  it('rejects duplicate field names within an entity', () => {
    const ir = createSampleIR();
    ir.entities[0].fields.push({
      name: 'email',
      type: 'string',
      required: false,
      isId: false
    });
    const result = validateIR(ir);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes("duplicate field name 'email'"))).toBe(true);
  });

  it('rejects relationTo targeting non-existent entity', () => {
    const ir = createSampleIR();
    ir.entities[1].fields[2].relationTo = 'NonExistent';
    const result = validateIR(ir);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes("referenced entity 'NonExistent' does not exist"))).toBe(true);
  });

  it('rejects route.entity targeting non-existent entity', () => {
    const ir = createSampleIR();
    ir.routes[0].entity = 'UnknownEntity';
    const result = validateIR(ir);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes("referenced entity 'UnknownEntity' does not exist"))).toBe(true);
  });

  it('rejects route path parameter missing from params array', () => {
    const ir = createSampleIR();
    ir.routes[1].params = []; // :id missing
    const result = validateIR(ir);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes("path parameter ':id' missing from params list"))).toBe(true);
  });

  it('rejects empty IR having no entities and no routes', () => {
    const ir = createSampleIR();
    ir.entities = [];
    ir.routes = [];
    const result = validateIR(ir);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('IR must contain at least one entity or route'))).toBe(true);
  });

  it('rejects invalid schema structure via Zod parse', () => {
    const ir = createSampleIR() as any;
    ir.routes[0].method = 'INVALID_METHOD';
    const result = validateIR(ir);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('routes.0.method'))).toBe(true);
  });
});

describe('normalizeIR and hashIR', () => {
  it('produces identical hash for shuffled entities, fields, and routes', () => {
    const ir1 = createSampleIR();
    const ir2: UIIR = {
      ...createSampleIR(),
      entities: [createSampleIR().entities[1], {
        ...createSampleIR().entities[0],
        fields: [createSampleIR().entities[0].fields[1], createSampleIR().entities[0].fields[0]]
      }],
      routes: [createSampleIR().routes[1], createSampleIR().routes[0]]
    };

    const hash1 = hashIR(ir1, hash);
    const hash2 = hashIR(ir2, hash);
    expect(hash1).toBe(hash2);
  });

  it('keeps identical hash when extractorVersion changes', () => {
    const ir1 = createSampleIR();
    const ir2 = { ...createSampleIR(), source: { stackId: 'express', extractorVersion: '2.5.0' } };

    expect(hashIR(ir1, hash)).toBe(hashIR(ir2, hash));
  });

  it('keeps identical hash when warnings change', () => {
    const ir1 = createSampleIR();
    const ir2 = { ...createSampleIR(), warnings: ['New warning', 'Another warning'] };

    expect(hashIR(ir1, hash)).toBe(hashIR(ir2, hash));
  });

  it('changes hash when a field is added', () => {
    const ir1 = createSampleIR();
    const ir2 = createSampleIR();
    ir2.entities[0].fields.push({
      name: 'createdAt',
      type: 'datetime',
      required: true,
      isId: false
    });

    expect(hashIR(ir1, hash)).not.toBe(hashIR(ir2, hash));
  });
});
