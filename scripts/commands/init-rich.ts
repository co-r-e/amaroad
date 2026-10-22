import * as fs from "node:fs/promises";
import path from "node:path";
import { die, getBoolean, getString, rejectUnknownFlags, type ParsedArgs } from "../lib/cli";
import { findProjectRoot } from "../lib/decks";
import { isUnsafeDeckName } from "../../src/lib/deck-paths";
import { richAssetReferences } from "../../src/lib/rich-deck-assets";
import { enableThreeInHtml, parseThreeAddons } from "../lib/three-support";

const USAGE = `Usage: pnpm amaroad init-rich <deck> [--title <title>] [--from <file.html>] [--three] [--addons <paths>]

Creates an HTML deck without overwriting an existing directory.
Without --from, writes a standalone three-slide template with reveal steps.
With --from, copies the HTML exactly; separate assets must be copied into the deck.
The source file is never changed.
--three embeds Three.js and supported addons in the new deck.`;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function runInitRichCommand(args: ParsedArgs): Promise<void> {
  if (getBoolean(args, "help") || getBoolean(args, "h")) { process.stdout.write(USAGE + "\n"); return; }
  rejectUnknownFlags(args, ["title", "from", "three", "addons"]);
  if (args.flags.has("three") && args.flags.get("three") !== true) die("--three does not take a value");
  if (args.flags.has("addons") && !getBoolean(args, "three")) die("--addons requires --three");
  for (const flag of ["title", "from", "addons"]) {
    if (args.flags.get(flag) === true) die(`--${flag} needs a value`);
  }
  const name = args.positionals[0];
  if (!name || isUnsafeDeckName(name) || args.positionals.length !== 1) die(USAGE);
  const title = getString(args, "title") ?? name;
  if (!title.trim()) die("--title cannot be empty");
  const root = findProjectRoot();
  const source = getString(args, "from");
  let html = source
    ? await fs.readFile(path.resolve(source), "utf8")
    : (await fs.readFile(path.join(root, "templates/rich-deck/index.html"), "utf8")).replaceAll("{{TITLE}}", escapeHtml(title));
  if (!html.trim()) die("The HTML file is empty");
  if (getBoolean(args, "three")) html = (await enableThreeInHtml(html, parseThreeAddons(getString(args, "addons")))).html;
  const directory = path.join(root, "decks", name);
  try { await fs.mkdir(directory); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") die(`decks/${name} already exists; nothing was overwritten`);
    throw error;
  }
  const config = { format: "html", title, createdAt: new Date().toISOString().slice(0, 10), standalone: richAssetReferences(html).length === 0 };
  await fs.writeFile(path.join(directory, "deck.config.ts"), `export default ${JSON.stringify(config, null, 2)};\n`, { flag: "wx" });
  await fs.writeFile(path.join(directory, "index.html"), html, { flag: "wx" });
  process.stdout.write(`Created decks/${name}/index.html\nOpen http://127.0.0.1:3850/${encodeURIComponent(name)}\n`);
}
