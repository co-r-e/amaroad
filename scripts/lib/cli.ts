/**
 * Minimal argument parsing shared by `pnpm amaroad` subcommands.
 * Supports `--flag`, `--key value`, `--key=value`, and positionals.
 */
export interface ParsedArgs {
  positionals: string[];
  flags: Map<string, string | true>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      flags.set(body.slice(0, eq), body.slice(eq + 1));
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--") && !BOOLEAN_FLAGS.has(body)) {
      flags.set(body, next);
      i++;
    } else {
      flags.set(body, true);
    }
  }

  return { positionals, flags };
}

/** Flags that never take a value, so a following positional stays positional. */
const BOOLEAN_FLAGS = new Set([
  "help",
  "h",
  "all",
  "check",
  "json",
  "quiet",
  "verbose",
  "dry-run",
  "write",
]);

export function getString(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

export function getBoolean(args: ParsedArgs, name: string): boolean {
  return args.flags.has(name);
}

export function getNumber(args: ParsedArgs, name: string): number | undefined {
  const value = getString(args, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) die(`--${name} must be a number (got "${value}")`);
  return parsed;
}

export function die(message: string, code = 1): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(code);
}

export function rejectUnknownFlags(args: ParsedArgs, allowed: string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of args.flags.keys()) {
    if (!allowedSet.has(key)) die(`Unknown option: --${key}`);
  }
}
