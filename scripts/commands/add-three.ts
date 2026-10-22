import fs from "node:fs/promises";
import { die, getBoolean, getString, rejectUnknownFlags, type ParsedArgs } from "../lib/cli";
import { loadRichDeck, resolveRichDeckDirectory, resolveRichDeckFile } from "../../src/lib/rich-deck-loader";
import { enableThreeInHtml, parseThreeAddons } from "../lib/three-support";

const USAGE = `Usage: pnpm amaroad add-three <deck> [--addons <paths>]

Embeds Three.js, OrbitControls, GLTFLoader, and WebGL capability checks in an HTML deck.
Keeps other HTML and import mappings; refuses conflicting Three.js mappings.
The modules and MIT notice are embedded, so no CDN is required.
--addons accepts comma-separated paths under three/addons/, e.g. renderers/CSS3DRenderer.js.`;

export async function runAddThreeCommand(args: ParsedArgs): Promise<void> {
  if (getBoolean(args, "help") || getBoolean(args, "h")) { process.stdout.write(USAGE + "\n"); return; }
  rejectUnknownFlags(args, ["addons"]);
  if (args.flags.get("addons") === true) die("--addons needs a comma-separated path list");
  const name = args.positionals[0];
  if (!name || args.positionals.length !== 1) die(USAGE);
  await loadRichDeck(name);
  const directory = await resolveRichDeckDirectory(name);
  const file = await resolveRichDeckFile(directory, ["index.html"]);
  const original = await fs.readFile(file, "utf8");
  const result = await enableThreeInHtml(original, parseThreeAddons(getString(args, "addons")));
  // Bundling can take time; never overwrite a concurrent author edit.
  if (await fs.readFile(file, "utf8") !== original) throw new Error("HTML changed while bundling; no changes were written. Run add-three again.");
  if (result.html !== original) await fs.writeFile(file, result.html);
  process.stdout.write(`Three.js ${result.version} enabled in decks/${name}/index.html\n`);
}
