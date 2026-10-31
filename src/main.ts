#!/usr/bin/env node
import { NodeEnv, NodeFsRead, ReadlinePrompt, JsonRecentStore, ConsoleLogger, buildEnvSnapshot } from './infra/index.js';
import { createCli } from './cli/index.js';

export async function main(argv: string[] = process.argv): Promise<void> {
  const env = new NodeEnv();
  const fsRead = new NodeFsRead();
  const prompt = new ReadlinePrompt();
  const recentStore = new JsonRecentStore();
  const logger = new ConsoleLogger();

  const cli = createCli({
    env,
    fsRead,
    prompt,
    recentStore,
    logger,
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
