#!/usr/bin/env -S pnpm exec tsx
/**
 * Amaroad tooling CLI.
 *
 *   pnpm amaroad doctor   <deck|--all> [--format md|json] [--fail-on error|warning] [--skip a,b]
 *   pnpm amaroad overflow <deck> [--slide N] [--format md|json] [--fail-on error|warning]
 *   pnpm amaroad capture  <deck> (--slide N --output file.png | --all --out-dir dir) [--scale 0.5]
 *   pnpm amaroad catalog  [--check]
 *
 * Browser-backed commands (doctor's overflow check, overflow, capture) need a
 * running Amaroad server: `pnpm dev` (http://127.0.0.1:3850) or --base-url.
 */
import { parseArgs, die } from "./lib/cli";

const USAGE = `Usage: pnpm amaroad <command> [options]

Commands:
  doctor    Run every check for a deck (config, preflight, manifest, assets, fonts, overflow)
  overflow  Detect content leaking outside the slide safe area (needs running server)
  capture   Screenshot slides at native 1920x1080 (needs running server)
  catalog   Generate docs/components.md and docs/components.json from the MDX registry

Run "pnpm amaroad <command> --help" for command options.`;

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  switch (command) {
    case "doctor": {
      const { runDoctorCommand } = await import("./doctor/index");
      await runDoctorCommand(args);
      return;
    }
    case "overflow": {
      const { runOverflowCommand } = await import("./commands/overflow");
      await runOverflowCommand(args);
      return;
    }
    case "capture": {
      const { runCaptureCommand } = await import("./commands/capture");
      await runCaptureCommand(args);
      return;
    }
    case "catalog": {
      const { runCatalogCommand } = await import("./catalog/generate");
      await runCatalogCommand(args);
      return;
    }
    case undefined:
    case "--help":
    case "-h":
    case "help":
      process.stdout.write(USAGE + "\n");
      return;
    default:
      die(`Unknown command "${command}".\n\n${USAGE}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
