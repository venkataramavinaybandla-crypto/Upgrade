// ROLE: Tests frontend trace rule evaluation, sandboxed TraceReader allowlists, and expected fixture scores.
// INPUTS: Real fixture ScanReports, mock ScanReports, and recording FsRead ports.
// CRITICAL: Proves readText only accesses package.json or index.html at depth <= 2, with zero reads on secrets or ignored dirs.

import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { scan } from '../src/core/scan/index.js';
import { evaluateTrace, createTraceReader } from '../src/core/trace/index.js';
import { NodeFsRead } from '../src/infra/fs-read.js';
import type { WorkspaceRef } from '../src/contracts/index.js';
import type { FsRead } from '../src/ports/index.js';

describe('evaluateTrace (src/core/trace)', () => {
  const realFs = new NodeFsRead();

  function makeWorkspaceRef(root: string): WorkspaceRef {
    return {
      root,
      source: 'argument',
      verdict: 'ok',
      projectMarkers: [],
      consentGranted: true
    };
  }

  describe('TraceReader sandbox invariants', () => {
    it('only reads package.json and index.html at depth <= 2', async () => {
      const readPaths: string[] = [];
      const recordingFs: FsRead = {
        readText: vi.fn(async (p: string) => {
          readPaths.push(p);
          return '{}';
        }),
        stat: vi.fn(async () => ({ isFile: () => true, isDirectory: () => false, size: 50 })),
        exists: vi.fn(async () => true),
        realpath: vi.fn(async p => p),
        listDir: vi.fn(async () => [])
      };

      const reader = createTraceReader('/test/root', recordingFs);

      // Allowed
      expect(await reader.readText('package.json')).toBe('{}');
      expect(await reader.readText('client/package.json')).toBe('{}');
      expect(await reader.readText('index.html')).toBe('{}');

      // Disallowed: wrong filename
      expect(await reader.readText('server.js')).toBeNull();
      expect(await reader.readText('secret.env')).toBeNull();

      // Disallowed: depth > 2
      expect(await reader.readText('a/b/c/package.json')).toBeNull();

      for (const p of readPaths) {
        expect(p.endsWith('package.json') || p.endsWith('index.html')).toBe(true);
      }
    });

    it('returns null on invalid JSON without throwing', async () => {
      const fakeFs: FsRead = {
        readText: vi.fn(async () => '{ broken json'),
        stat: vi.fn(async () => ({ isFile: () => true, isDirectory: () => false, size: 50 })),
        exists: vi.fn(async () => true),
        realpath: vi.fn(async p => p),
        listDir: vi.fn(async () => [])
      };
      const reader = createTraceReader('/root', fakeFs);
      const res = await reader.readJson('package.json');
      expect(res).toBeNull();
    });
  });

  describe('Fixture verdicts and trace scoring', () => {
    async function scanAndTrace(fixtureName: string) {
      const wsRoot = path.resolve(`test/fixtures/${fixtureName}`);
      const ws = makeWorkspaceRef(wsRoot);
      const scanReport = await scan(ws, { fs: realFs });
      const reader = createTraceReader(wsRoot, realFs);
      const traceReport = await evaluateTrace(scanReport, reader);
      return { scanReport, traceReport };
    }

    it('empty fixture -> clean (score 0)', async () => {
      const { traceReport } = await scanAndTrace('empty');
      expect(traceReport.verdict).toBe('clean');
      expect(traceReport.score).toBe(0);
      expect(traceReport.hits).toEqual([]);
    });

    it('docs-only fixture -> clean (score 0)', async () => {
      const { traceReport } = await scanAndTrace('docs-only');
      expect(traceReport.verdict).toBe('clean');
      expect(traceReport.score).toBe(0);
    });

    it('clean-express fixture -> clean (score 1)', async () => {
      const { traceReport } = await scanAndTrace('clean-express');
      expect(traceReport.verdict).toBe('clean');
      expect(traceReport.score).toBe(1);
      expect(traceReport.hits.map(h => h.ruleId)).toContain('static-dir');
    });

    it('react-mixed fixture -> blocked (score >= 5)', async () => {
      const { traceReport } = await scanAndTrace('react-mixed');
      expect(traceReport.verdict).toBe('blocked');
      expect(traceReport.score).toBeGreaterThanOrEqual(5);
      const ruleIds = traceReport.hits.map(h => h.ruleId);
      expect(ruleIds).toContain('dep-frontend-framework');
      expect(ruleIds).toContain('file-app-entry');
      expect(ruleIds).toContain('root-index-html-script');
    });

    it('nested-frontend fixture -> blocked (score >= 5)', async () => {
      const { traceReport } = await scanAndTrace('nested-frontend');
      expect(traceReport.verdict).toBe('blocked');
      expect(traceReport.score).toBeGreaterThanOrEqual(5);
      const ruleIds = traceReport.hits.map(h => h.ruleId);
      expect(ruleIds).toContain('dep-frontend-framework');
      expect(ruleIds).toContain('component-files');
    });

    it('flask-templates fixture -> suspect (score 4)', async () => {
      const { traceReport } = await scanAndTrace('flask-templates');
      expect(traceReport.verdict).toBe('suspect');
      expect(traceReport.score).toBe(4);
      const ruleIds = traceReport.hits.map(h => h.ruleId);
      expect(ruleIds).toContain('static-dir');
      expect(ruleIds).toContain('templates-dir');
      expect(ruleIds).toContain('html-files');
      expect(ruleIds).toContain('css-files');
    });

    it('ignored-noise fixture -> clean (score 0)', async () => {
      const { traceReport } = await scanAndTrace('ignored-noise');
      expect(traceReport.verdict).toBe('clean');
      expect(traceReport.score).toBe(0);
    });
  });
});
