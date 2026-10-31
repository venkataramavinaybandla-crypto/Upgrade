// ROLE: Tests the 3-line file header verification script with passing, failing, and edge-case samples.
// INPUTS: Sample content strings and validateHeader function from scripts/check-headers.mjs.
// CRITICAL: Must detect missing headers, wrong ordering, empty descriptions, and lines exceeding 140 chars.

import { describe, it, expect } from 'vitest';
import { validateHeader, MAX_LINE_LENGTH } from '../scripts/check-headers.mjs';

describe('Header check (scripts/check-headers.mjs)', () => {
  it('passes on valid 3-line header', () => {
    const validContent = [
      '// ROLE: Computes sum of numbers and returns integer.',
      '// INPUTS: Array of numbers a: number[].',
      '// CRITICAL: Must not overflow and must handle empty arrays safely.',
      '',
      'export function sum(a) { return a.reduce((x, y) => x + y, 0); }'
    ].join('\n');

    const errors = validateHeader(validContent, 'sample.ts');
    expect(errors).toHaveLength(0);
  });

  it('passes when shebang precedes the 3-line header', () => {
    const validWithShebang = [
      '#!/usr/bin/env node',
      '// ROLE: CLI entrypoint executing main loop.',
      '// INPUTS: Command line arguments argv: string[].',
      '// CRITICAL: Must handle uncaught errors and return appropriate exit codes.',
      '',
      'console.log("running");'
    ].join('\n');

    const errors = validateHeader(validWithShebang, 'cli.ts');
    expect(errors).toHaveLength(0);
  });

  it('fails when header labels are out of order or missing', () => {
    const outOfOrderContent = [
      '// INPUTS: Some input.',
      '// ROLE: Some role.',
      '// CRITICAL: Some critical invariant.'
    ].join('\n');

    const errors = validateHeader(outOfOrderContent, 'bad-order.ts');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Expected header line starting with \'// ROLE:\'');
  });

  it('fails when header text is empty', () => {
    const emptyContent = [
      '// ROLE:',
      '// INPUTS: ',
      '// CRITICAL: valid invariant'
    ].join('\n');

    const errors = validateHeader(emptyContent, 'empty-label.ts');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('empty content'))).toBe(true);
  });

  it('fails when a line exceeds 140 characters', () => {
    const longRole = '// ROLE: ' + 'A'.repeat(MAX_LINE_LENGTH);
    const longContent = [
      longRole,
      '// INPUTS: valid inputs.',
      '// CRITICAL: valid invariant.'
    ].join('\n');

    const errors = validateHeader(longContent, 'long-line.ts');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes(`Line exceeds ${MAX_LINE_LENGTH} characters`))).toBe(true);
  });
});
