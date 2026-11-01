// ROLE: Configures Commander CLI program routes, option parsing, and exits with assigned exit codes.
// INPUTS: CliContext { fsRead, env, prompt, recentStore?, logger?, buildSnapshot }.
// CRITICAL: CLI layer contains no business logic; it delegates directly to application use-cases.

import { Command } from 'commander';
import { runDoctorEnv, runScanPhase1, scanWorkspace, AppError, type ScanDeps, type DoctorDeps } from '../app/index.js';
import { copy } from './copy.js';

export type CliContext = ScanDeps & DoctorDeps;

export function createCli(context: CliContext): Command {
  const program = new Command();

  program
    .name('upgrade')
    .description(copy.appDescription)
    .version('0.1.0')
    .option('--dir <path>', 'Path to target workspace folder')
    .option('--yes', 'Skip confirmation prompts')
    .option('--json', 'Output results in JSON format')
    .option('--no-color', 'Disable colored output');

  program
    .command('doctor')
    .description('Check terminal environment and detected host')
    .option('--env', 'Inspect terminal environment detection')
    .action(async () => {
      const globalOpts = program.opts();
      const isJson = Boolean(globalOpts.json);

      const { hostContext } = runDoctorEnv({
        env: context.env,
        buildSnapshot: context.buildSnapshot
      });

      if (isJson) {
        console.log(
          JSON.stringify(
            {
              host: hostContext.host,
              kind: hostContext.kind,
              confidence: hostContext.confidence,
              signals: hostContext.signals,
              os: hostContext.os,
              isWsl: hostContext.isWsl
            },
            null,
            2
          )
        );
        return;
      }

      console.log(copy.doctorHost(hostContext.host));
      console.log(copy.doctorKind(hostContext.kind));
      console.log(copy.doctorConfidence(hostContext.confidence));
      console.log(copy.doctorSignals(hostContext.signals));
      console.log(copy.doctorOs(hostContext.os));
      console.log(copy.doctorWsl(hostContext.isWsl));
    });

  program
    .command('scan')
    .description('Run host check, workspace resolution, and consent gate')
    .action(async () => {
      const globalOpts = program.opts();
      const isJson = Boolean(globalOpts.json);

      try {
        const { workspaceRef } = await runScanPhase1(
          {
            dir: globalOpts.dir,
            yes: globalOpts.yes,
            json: globalOpts.json,
            noColor: globalOpts.noColor
          },
          context
        );

        if (workspaceRef.verdict === 'refused') {
          if (isJson) {
            console.log(JSON.stringify(workspaceRef, null, 2));
          } else {
            console.error(copy.refusalTitle(workspaceRef.refusalReason));
          }
          process.exitCode = 11;
          return;
        }

        if (!workspaceRef.consentGranted) {
          if (isJson) {
            console.log(JSON.stringify(workspaceRef, null, 2));
          } else {
            console.log(copy.consentDeclined);
          }
          process.exitCode = 10;
          return;
        }

        const scanRes = await scanWorkspace(
          workspaceRef,
          {
            yes: globalOpts.yes,
            nonInteractive: !context.env.isTty()
          },
          {
            fs: context.fsRead,
            prompt: context.prompt,
            logger: context.logger
          }
        );

        if (isJson) {
          console.log(
            JSON.stringify(
              {
                workspace: workspaceRef,
                scan: scanRes.scan,
                trace: scanRes.trace,
                outcome: scanRes.outcome
              },
              null,
              2
            )
          );
        }

        if (scanRes.outcome === 'empty') {
          if (!isJson) {
            console.log(copy.scanEmpty);
          }
          process.exitCode = 12;
          return;
        }

        if (scanRes.outcome === 'blocked') {
          if (!isJson) {
            console.error(copy.scanBlockedHeader);
            for (const hit of scanRes.trace.hits) {
              console.error(copy.scanTraceHit(hit.ruleId, hit.weight, hit.path));
            }
            console.error(copy.scanRemoveFrontend);
          }
          process.exitCode = 13;
          return;
        }

        if (!isJson) {
          console.log(copy.workspaceConfirmed(workspaceRef.root));
          console.log(copy.workspaceSource(workspaceRef.source));
          console.log(copy.projectMarkers(workspaceRef.projectMarkers));
          console.log(
            copy.scanCleanSummary(
              scanRes.scan.fileCount,
              scanRes.scan.totalBytes,
              scanRes.scan.truncated,
              scanRes.scan.secretFilesSkipped
            )
          );
        }
        process.exitCode = 0;
      } catch (err: any) {
        if (err instanceof AppError) {
          console.error(copy.usageError(err.message));
          process.exitCode = err.exitCode;
        } else {
          console.error(copy.unexpectedError(err?.message ?? String(err)));
          process.exitCode = 1;
        }
      }
    });

  return program;
}
