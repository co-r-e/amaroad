/**
 * Load `.env.local` then `.env` from the project root into process.env for
 * CLI commands (Next loads them for the app; tsx does not). Variables that
 * are already set win, matching Next's precedence.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { parseEnv } from "node:util";

const ENV_FILES = [".env.local", ".env"];

export function loadProjectEnv(projectRoot: string): void {
  for (const name of ENV_FILES) {
    const file = path.join(projectRoot, name);
    let text: string;
    try {
      text = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    for (const [key, value] of Object.entries(parseEnv(text))) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}
