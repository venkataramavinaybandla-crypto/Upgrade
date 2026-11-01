// ROLE: Defines shared Zod schemas and TypeScript types for domain entities, snapshots, and reports.
// INPUTS: None (pure contract definitions).
// CRITICAL: May import nothing else in src/; serves as the single schema source of truth.

import { z } from 'zod';

export const EnvSnapshotSchema = z.object({
  names: z.array(z.string()),
  values: z.record(z.string()),
  platform: z.enum(['win32', 'darwin', 'linux']),
  isWsl: z.boolean(),
  isTty: z.boolean(),
  cwd: z.string()
});
export type EnvSnapshot = z.infer<typeof EnvSnapshotSchema>;

export const HostKindSchema = z.enum([
  'ide-terminal',
  'agent-shell',
  'plain-terminal',
  'non-interactive'
]);
export type HostKind = z.infer<typeof HostKindSchema>;

export const HostNameSchema = z.enum([
  'vscode',
  'antigravity',
  'cursor',
  'windsurf',
  'jetbrains',
  'zed',
  'windows-terminal',
  'powershell',
  'cmd',
  'bash',
  'zsh',
  'unknown'
]);
export type HostName = z.infer<typeof HostNameSchema>;

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const HostContextSchema = z.object({
  kind: HostKindSchema,
  host: HostNameSchema,
  signals: z.array(z.string()),
  confidence: ConfidenceSchema,
  os: z.enum(['win32', 'darwin', 'linux']),
  isWsl: z.boolean(),
  cwd: z.string()
});
export type HostContext = z.infer<typeof HostContextSchema>;

export const WorkspaceSourceSchema = z.enum(['cwd', 'argument', 'picked', 'recent']);
export type WorkspaceSource = z.infer<typeof WorkspaceSourceSchema>;

export const WorkspaceVerdictSchema = z.enum(['ok', 'refused']);
export type WorkspaceVerdict = z.infer<typeof WorkspaceVerdictSchema>;

export const WorkspaceRefusalReasonSchema = z.enum([
  'fs-root',
  'home-dir',
  'system-dir',
  'user-folder-root',
  'not-a-directory',
  'not-found',
  'no-permission',
  'undefined'
]);
export type WorkspaceRefusalReason = z.infer<typeof WorkspaceRefusalReasonSchema>;

export const WorkspaceRefSchema = z.object({
  root: z.string(),
  source: WorkspaceSourceSchema,
  verdict: WorkspaceVerdictSchema,
  refusalReason: WorkspaceRefusalReasonSchema.optional(),
  projectMarkers: z.array(z.string()),
  consentGranted: z.boolean()
});
export type WorkspaceRef = z.infer<typeof WorkspaceRefSchema>;

export const ScanReportSchema = z.object({
  root: z.string(),
  files: z.array(z.object({
    path: z.string(),
    ext: z.string(),
    bytes: z.number()
  })),
  fileCount: z.number(),
  totalBytes: z.number(),
  truncated: z.boolean(),
  ignoredDirs: z.array(z.string()),
  secretFilesSkipped: z.number(),
  verdict: z.enum(['empty', 'has-code'])
});
export type ScanReport = z.infer<typeof ScanReportSchema>;

export const FrontendTraceReportSchema = z.object({
  score: z.number(),
  verdict: z.enum(['clean', 'suspect', 'blocked']),
  hits: z.array(z.object({
    ruleId: z.string(),
    weight: z.number(),
    path: z.string().optional()
  }))
});
export type FrontendTraceReport = z.infer<typeof FrontendTraceReportSchema>;

export const StackFingerprintSchema = z.object({
  status: z.enum(['matched', 'ambiguous', 'unknown']),
  chosen: z.string().optional(),
  candidates: z.array(z.object({
    stackId: z.string(),
    confidence: z.number(),
    evidence: z.array(z.string())
  }))
});
export type StackFingerprint = z.infer<typeof StackFingerprintSchema>;

export const FieldSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'integer', 'number', 'boolean', 'datetime', 'enum', 'json', 'unknown']),
  required: z.boolean(),
  isId: z.boolean(),
  relationTo: z.string().optional(),
  enumValues: z.array(z.string()).optional(),
  format: z.enum(['email', 'url', 'image', 'money', 'richtext']).optional()
});
export type Field = z.infer<typeof FieldSchema>;

export const RouteSchema = z.object({
  id: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string(),
  kind: z.enum(['list', 'detail', 'create', 'update', 'delete', 'auth', 'action', 'stream']),
  entity: z.string().optional(),
  params: z.array(z.string()),
  requestFields: z.array(FieldSchema).optional(),
  responseEntity: z.string().optional(),
  requiresAuth: z.boolean()
});
export type Route = z.infer<typeof RouteSchema>;

export const UIIRSchema = z.object({
  irVersion: z.number(),
  source: z.object({
    stackId: z.string(),
    extractorVersion: z.string()
  }),
  entities: z.array(z.object({
    name: z.string(),
    fields: z.array(FieldSchema),
    sourcePath: z.string().optional()
  })),
  routes: z.array(RouteSchema),
  auth: z.object({
    style: z.enum(['none', 'jwt', 'session', 'apikey', 'oauth', 'unknown']),
    loginRoute: z.string().optional(),
    registerRoute: z.string().optional()
  }),
  realtime: z.array(z.object({
    kind: z.enum(['websocket', 'sse']),
    path: z.string()
  })),
  baseUrl: z.string().optional(),
  openapiUrl: z.string().optional(),
  warnings: z.array(z.string())
});
export type UIIR = z.infer<typeof UIIRSchema>;

export const ReadinessReportSchema = z.object({
  ready: z.boolean(),
  checks: z.array(z.object({
    id: z.string(),
    level: z.enum(['blocker', 'warning']),
    passed: z.boolean(),
    detail: z.string()
  })),
  humanConfirmed: z.boolean().optional()
});
export type ReadinessReport = z.infer<typeof ReadinessReportSchema>;

export const TemplateManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['business', 'student-friendly', 'portfolio', 'store', 'content', 'dashboard']),
  description: z.string(),
  palette: z.object({
    name: z.string(),
    colors: z.record(z.string())
  }),
  stack: z.object({
    framework: z.enum(['html', 'react']),
    styling: z.enum(['css', 'tailwind'])
  }),
  requires: z.object({
    slots: z.array(z.object({
      id: z.string(),
      needs: z.any(),
      optional: z.boolean()
    }))
  }),
  version: z.string(),
  license: z.string()
});
export type TemplateManifest = z.infer<typeof TemplateManifestSchema>;

export const TemplateRecommendationSchema = z.object({
  templateId: z.string(),
  score: z.number(),
  reasons: z.array(z.string())
});
export type TemplateRecommendation = z.infer<typeof TemplateRecommendationSchema>;

export const SessionManifestSchema = z.object({
  contractVersion: z.number(),
  token: z.string(),
  kind: z.enum(['apply', 'sync']),
  parentToken: z.string().optional(),
  status: z.enum(['active', 'undone', 'finalized']),
  createdAt: z.string(),
  workspaceRoot: z.string(),
  templateId: z.string().optional(),
  irHash: z.string(),
  files: z.array(z.object({
    path: z.string(),
    action: z.enum(['created', 'modified']),
    hashAfter: z.string(),
    backup: z.string().optional()
  }))
});
export type SessionManifest = z.infer<typeof SessionManifestSchema>;

export const JournalEntrySchema = z.object({
  seq: z.number(),
  at: z.string(),
  op: z.enum(['create', 'modify', 'remove']),
  path: z.string(),
  hashBefore: z.string().optional(),
  hashAfter: z.string().optional(),
  backup: z.string().optional()
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const SyncDiffSchema = z.object({
  entities: z.object({
    added: z.array(z.string()),
    removed: z.array(z.string())
  }),
  fields: z.object({
    added: z.array(z.object({ entity: z.string(), field: z.string() })),
    removed: z.array(z.object({ entity: z.string(), field: z.string() })),
    changed: z.array(z.object({ entity: z.string(), field: z.string(), from: z.any(), to: z.any() }))
  }),
  routes: z.object({
    added: z.array(z.string()),
    removed: z.array(z.string()),
    changed: z.array(z.string())
  }),
  renameCandidates: z.array(z.object({
    kind: z.enum(['field', 'entity']),
    from: z.string(),
    to: z.string(),
    score: z.number()
  })),
  affectedFiles: z.array(z.object({
    path: z.string(),
    state: z.enum(['regenerate', 'conflict', 'skip-custom'])
  }))
});
export type SyncDiff = z.infer<typeof SyncDiffSchema>;

export interface ExtractorReader {
  readText(relPath: string): Promise<string>;
}

export interface Extractor {
  stackId: string;
  version: string;
  supports(fp: StackFingerprint): boolean;
  extract(ctx: { root: string; scan: ScanReport; read: ExtractorReader }): Promise<UIIR>;
}


