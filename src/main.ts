#!/usr/bin/env node
// ROLE: CLI composition root that instantiates concrete infra adapters and passes them to the CLI program.
// INPUTS: Process arguments process.argv: string[].
// CRITICAL: Only file in the repository permitted to import directly from src/infra.
import {
  NodeEnv,
  NodeFsRead,
  ReadlinePrompt,
  JsonRecentStore,
  ConsoleLogger,
  NodeHash,
  buildEnvSnapshot
} from './infra/index.js';
import { createCli } from './cli/index.js';

export async function main(argv: string[] = process.argv): Promise<void> {
  const env = new NodeEnv();
  const fsRead = new NodeFsRead();
  const prompt = new ReadlinePrompt();
  const recentStore = new JsonRecentStore();
  const logger = new ConsoleLogger();
  const hash = new NodeHash();

  const cli = createCli({
    env,
    fsRead,
    prompt,
    recentStore,
    logger,
    hash,
    buildSnapshot: buildEnvSnapshot
  });


  await cli.parseAsync(argv);
}

// Execute if run as main script
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
