// ROLE: Tests architectural layer boundary enforcement and validates detection of illegal imports.
// INPUTS: Executes scripts/check-boundaries.mjs directly and against synthetic illegal imports.
// CRITICAL: Must ensure core-to-infra import violations cause immediate test failures.

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

describe('Boundary checker', () => {
  it('passes on valid repository state', () => {
    const output = execSync('node scripts/check-boundaries.mjs', { encoding: 'utf8' });
    expect(output).toContain('Boundary check passed');
  });

  it('fails when core illegally imports from infra', () => {
    const illegalFile = path.resolve('src/core/illegal-test-import.ts');
    fs.mkdirSync(path.dirname(illegalFile), { recursive: true });
    fs.writeFileSync(illegalFile, `import { something } from '../infra/dummy.js';\n`);

    try {
      expect(() => {
        execSync('node scripts/check-boundaries.mjs', { encoding: 'utf8', stdio: 'pipe' });
      }).toThrow();
    } finally {
      if (fs.existsSync(illegalFile)) {
        fs.unlinkSync(illegalFile);
      }
    }
  });
});

