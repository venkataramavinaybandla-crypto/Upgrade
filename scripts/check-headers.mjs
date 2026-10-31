// ROLE: Verifies the mandatory 3-line comment header on all source, script, and test files; exits 1 on violations.
// INPUTS: Scans filesystem under src/, test/ (excl. fixtures/golden), scripts/, and root config files.
// CRITICAL: Enforces ROLE, INPUTS, CRITICAL order, non-empty content, and max 140 characters per line.

import fs from 'node:fs';
import path from 'node:path';

export const MAX_LINE_LENGTH = 140;

export function validateHeader(content, fileName = 'unknown') {
  const lines = content.split(/\r?\n/);
  let startIndex = 0;

  if (lines.length > 0 && lines[0].startsWith('#!')) {
    startIndex = 1;
  }

  const errors = [];
  const requiredLabels = ['ROLE:', 'INPUTS:', 'CRITICAL:'];

  if (lines.length < startIndex + 3) {
    errors.push(`${fileName}: File has fewer than 3 lines after optional shebang.`);
    return errors;
  }

  for (let i = 0; i < 3; i++) {
    const lineIndex = startIndex + i;
    const line = lines[lineIndex];
    const expectedLabel = requiredLabels[i];

    if (line.length > MAX_LINE_LENGTH) {
      errors.push(`${fileName}:${lineIndex + 1}: Line exceeds ${MAX_LINE_LENGTH} characters (${line.length}).`);
    }

    const prefix = `// ${expectedLabel}`;
    if (!line.startsWith(prefix)) {
      errors.push(
        `${fileName}:${lineIndex + 1}: Expected header line starting with '${prefix}', got '${line.slice(0, 30)}...'`
      );
      continue;
    }

    const textAfter = line.slice(prefix.length).trim();
    if (!textAfter) {
      errors.push(`${fileName}:${lineIndex + 1}: Header line '${expectedLabel}' has empty content.`);
    }
  }

  return errors;
}

export function collectFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(collectFiles(fullPath, predicate));
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

export function getAllCoveredFiles(projectRoot = process.cwd()) {
  const isCodeFile = (p) => /\.(ts|mjs|js|cjs)$/.test(p);
  const isExcluded = (p) => {
    const norm = p.replace(/\\/g, '/');
    return (
      norm.includes('/node_modules/') ||
      norm.includes('/dist/') ||
      norm.includes('/test/fixtures/') ||
      norm.includes('/test/golden/')
    );
  };

  const targets = ['src', 'scripts', 'test'].map((d) => path.join(projectRoot, d));
  let files = [];

  for (const target of targets) {
    files = files.concat(collectFiles(target, (p) => isCodeFile(p) && !isExcluded(p)));
  }

  // Root config files that allow comments (e.g. vitest.config.ts)
  const rootEntries = fs.readdirSync(projectRoot, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (!entry.isDirectory() && isCodeFile(entry.name)) {
      files.push(path.join(projectRoot, entry.name));
    }
  }

  return files;
}

export function runCheck(projectRoot = process.cwd()) {
  const files = getAllCoveredFiles(projectRoot);
  const allErrors = [];

  for (const file of files) {
    const rel = path.relative(projectRoot, file);
    const content = fs.readFileSync(file, 'utf8');
    const errors = validateHeader(content, rel);
    allErrors.push(...errors);
  }

  return allErrors;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const errors = runCheck();
  if (errors.length > 0) {
    console.error(`Header check failed (${errors.length} errors):`);
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  } else {
    console.log('Header check passed.');
  }
}
