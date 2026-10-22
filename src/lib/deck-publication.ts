import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DeckPublicationStatuses } from "@/types/deck-publication";

const run = promisify(execFile);

/**
 * Read the Git index and non-ignored files together: an ignored deck can still
 * contain tracked assets, while an untracked sample can be ready to commit.
 * This describes future ordinary commits/pushes, not past GitHub exposure.
 * Query on every listing request so edits to the index or ignore rules show up
 * on reload. Git is only inspected locally; nothing is fetched or published.
 */
export async function getDeckPublicationStatuses(
  names: readonly string[],
  projectRoot = process.cwd(),
): Promise<DeckPublicationStatuses> {
  if (names.length === 0) return {};
  try {
    const { stdout } = await run("git", [
      "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "decks/",
    ], { cwd: projectRoot, encoding: "utf8", timeout: 3000, maxBuffer: 4 * 1024 * 1024 });

    const included = new Set<string>();
    for (const file of stdout.split("\0")) {
      const [directory, name] = file.split("/");
      if (directory === "decks" && name) included.add(name);
    }
    return Object.fromEntries(names.map((name) => [name, included.has(name) ? "public" : "excluded"]));
  } catch {
    // A checkout without .git, missing Git, or a failed query must not imply privacy.
    return Object.fromEntries(names.map((name) => [name, "unknown"]));
  }
}
