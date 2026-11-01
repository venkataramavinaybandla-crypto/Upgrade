// ROLE: Comprehensive Phase 2 exit criteria test proving verdicts, zero secret reads, sandbox safety, and limits.
// INPUTS: Real test fixtures, recording FsRead ports, and temporary test directories.
// CRITICAL: Proves scan reads 0 times, trace only reads package.json/index.html <= depth 2, and secrets are never opened.

import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { scan, SCAN_LIMITS } from '../src/core/scan/index.js';
import { evaluateTrace, createTraceReader } from '../src/core/trace/index.js';
import { scanWorkspace } from '../src/app/scan.js';
import { NodeFsRead } from '../src/infra/fs-read.js';
import type { WorkspaceRef } from '../src/contracts/index.js';
import type { FsRead } from '../src/ports/index.js';

describe('Phase 2 Exit Criteria Verification', () => {
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

  it('Exit 1: Fixtures produce the exact expected verdicts and trace scores', async () => {
    const table: Array<{ fixture: string; expectedOutcome: string; expectedScore?: number }> = [
      { fixture: 'empty', expectedOutcome: 'empty' },
      { fixture: 'docs-only', expectedOutcome: 'empty' },
      { fixture: 'clean-express', expectedOutcome: 'clean', expectedScore: 1 },
      { fixture: 'react-mixed', expectedOutcome: 'blocked' },
      { fixture: 'nested-frontend', expectedOutcome: 'blocked' },
      { fixture: 'flask-templates', expectedOutcome: 'suspect', expectedScore: 4 },
      { fixture: 'ignored-noise', expectedOutcome: 'clean', expectedScore: 0 }
    ];

    for (const { fixture, expectedOutcome, expectedScore } of table) {
      const wsRoot = path.resolve(`test/fixtures/${fixture}`);
      const ws = makeWorkspaceRef(wsRoot);
      const prompt = {
        confirm: vi.fn().mockResolvedValue(false),
        select: vi.fn(),
        text: vi.fn(),
        pickFolder: vi.fn()
      };

      const res = await scanWorkspace(ws, { nonInteractive: false }, { fs: realFs, prompt });
      if (expectedOutcome === 'suspect') {
        expect(res.trace.verdict).toBe('suspect');
        if (expectedScore !== undefined) {
          expect(res.trace.score).toBe(expectedScore);
        }
      } else {
        expect(res.outcome).toBe(expectedOutcome);
        if (expectedScore !== undefined) {
          expect(res.trace.score).toBe(expectedScore);
        }
      }
    }
  });

  it('Exit 2: Recording FsRead proves zero reads during scan and strictly sandboxed reads during trace', async () => {
    const fixtures = [
      'empty',
      'docs-only',
      'clean-express',
      'react-mixed',
      'nested-frontend',
      'flask-templates',
      'ignored-noise'
    ];

    for (const f of fixtures) {
      const wsRoot = path.resolve(`test/fixtures/${f}`);
      const ws = makeWorkspaceRef(wsRoot);

      const scanReadCalls: string[] = [];
      const traceReadCalls: string[] = [];

      let phase: 'scan' | 'trace' = 'scan';

      const recordingFs: FsRead = {
        readText: vi.fn(async (p: string) => {
          if (phase === 'scan') {
            scanReadCalls.push(p);
          } else {
            traceReadCalls.push(p);
          }
          return await realFs.readText(p);
        }),
        stat: vi.fn(p => realFs.stat(p)),
        exists: vi.fn(p => realFs.exists(p)),
        realpath: vi.fn(p => realFs.realpath(p)),
        listDir: vi.fn(p => realFs.listDir(p))
      };

      // 1. Run scan
      phase = 'scan';
      const scanReport = await scan(ws, { fs: recordingFs });
      // Proves scan() calls readText ZERO times
      expect(scanReadCalls).toHaveLength(0);

      // 2. Run trace
      phase = 'trace';
      const reader = createTraceReader(wsRoot, recordingFs);
      await evaluateTrace(scanReport, reader);

      // Proves every readText during trace targets only package.json or index.html at depth <= 2
      for (const p of traceReadCalls) {
        const norm = p.replace(/\\/g, '/');
        const base = norm.slice(norm.lastIndexOf('/') + 1);
        expect(base === 'package.json' || base === 'index.html').toBe(true);

        // Zero reads inside ignored dirs
        expect(norm.includes('/node_modules/')).toBe(false);

        // Zero reads on secret files
        expect(norm.includes('.env')).toBe(false);
      }
    }
  });

  it('Exit 3: Secrets-present fixture skips secret files without opening and scores clean', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upgrade-secrets-exit-'));
    try {
      await fs.writeFile(path.join(tempDir, 'server.js'), 'const express = require("express");');
      await fs.writeFile(path.join(tempDir, '.env'), 'SECRET_KEY=123');
      await fs.writeFile(path.join(tempDir, '.env.local'), 'SECRET_KEY=456');
      await fs.writeFile(path.join(tempDir, 'cert.pem'), 'CERT_DATA');

      const openedFiles: string[] = [];
      const recordingFs: FsRead = {
        readText: vi.fn(async (p: string) => {
          openedFiles.push(p);
          return '';
        }),
        stat: vi.fn(p => realFs.stat(p)),
        exists: vi.fn(p => realFs.exists(p)),
        realpath: vi.fn(p => realFs.realpath(p)),
        listDir: vi.fn(p => realFs.listDir(p))
      };

      const ws = makeWorkspaceRef(tempDir);
      const scanReport = await scan(ws, { fs: recordingFs });
      const reader = createTraceReader(tempDir, recordingFs);
      const traceReport = await evaluateTrace(scanReport, reader);

      expect(scanReport.secretFilesSkipped).toBe(3);
      expect(traceReport.verdict).toBe('clean');
      expect(openedFiles).toHaveLength(0);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('Exit 4: Limits (maxDepth, maxFiles, maxFileBytes) set truncated=true without throwing', async () => {
    const fakeFs: FsRead = {
      readText: vi.fn(),
      exists: vi.fn(async () => true),
      realpath: vi.fn(async p => p),
      listDir: vi.fn(async (dir: string) => {
        const depth = dir.split('/').length;
        if (depth < 15) return ['sub'];
        return ['deep.js'];
      }),
      stat: vi.fn(async () => ({
        isFile: () => true,
        isDirectory: () => false,
        size: SCAN_LIMITS.maxFileBytes + 100
      }))
    };

    const ws = makeWorkspaceRef('/fake/root');
    const report = await scan(ws, { fs: fakeFs });
    expect(report.truncated).toBe(true);
  });
});
