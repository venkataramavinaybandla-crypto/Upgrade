import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve('src');

const ALLOWED_IMPORTS = {
  contracts: [],
  ports: ['contracts'],
  core: ['contracts', 'ports', 'core'],
  extractors: ['contracts', 'ports'],
  templates: ['contracts', 'ports'],
  infra: ['contracts', 'ports'],
  app: ['contracts', 'ports', 'core', 'extractors', 'templates'],
  cli: ['contracts', 'app']
};

function getFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function resolveImportTargetLayer(filePath, importPath) {
  if (importPath.startsWith('.')) {
    const targetPath = path.resolve(path.dirname(filePath), importPath);
    const relToSrc = path.relative(SRC_DIR, targetPath);
    if (relToSrc.startsWith('..')) {
      return 'outside-src';
    }
    const parts = relToSrc.split(path.sep);
    return parts[0];
  }
  return null; // External package
}

let errors = [];
const allSrcFiles = getFiles(SRC_DIR);

for (const file of allSrcFiles) {
  const rel = path.relative(SRC_DIR, file);
  const parts = rel.split(path.sep);
  
  if (parts.length === 1 && parts[0] === 'main.ts') {
    // Composition root: allowed to import infra, app, etc.
    continue;
  }
  
  const layer = parts[0];
  const allowed = ALLOWED_IMPORTS[layer];
  if (!allowed) {
    continue;
  }
  
  const content = fs.readFileSync(file, 'utf8');
  // Match import statements: import ... from '...' or import('...')
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    const targetLayer = resolveImportTargetLayer(file, importPath);
    if (targetLayer && targetLayer !== 'outside-src') {
      if (targetLayer !== layer && !allowed.includes(targetLayer)) {
        errors.push(
          `Boundary violation in ${rel}: layer '${layer}' is not allowed to import from layer '${targetLayer}' (${importPath})`
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error('Boundary check failed:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
} else {
  console.log('Boundary check passed.');
}
