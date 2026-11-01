// ROLE: Configuration constants for filesystem scanning, ignore lists, secret patterns, and code manifests.
// INPUTS: None (pure configuration exports).
// CRITICAL: Secrets patterns must match sensitive files without reading them; code extensions define empty verdict.

export const DEFAULT_IGNORED_DIRS = [
  'node_modules',
  '.git',
  '.venv',
  'venv',
  'env',
  '__pycache__',
  'dist',
  'build',
  '.next',
  '.cache',
  '.upgrade',
  'coverage',
  '.idea',
  '.vscode',
  'target'
] as const;

export const DEFAULT_SECRET_PATTERNS = [
  '.env',
  '.env.*',
  '*.pem',
  '*.key',
  '*.p12',
  'id_rsa*',
  'credentials*',
  'secrets*'
] as const;

export const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.php',
  '.rb',
  '.cs',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.scala',
  '.swift',
  '.dart',
  '.lua',
  '.sh',
  '.bash',
  '.zsh',
  '.sql',
  '.html',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.vue',
  '.svelte'
]);

export const MANIFEST_FILES = new Set([
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'Pipfile',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'composer.json',
  'Gemfile',
  'mix.exs',
  'schema.prisma'
]);

export const SCAN_LIMITS = {
  maxFiles: 20000,
  maxFileBytes: 1048576, // 1 MB
  maxDepth: 12
} as const;
