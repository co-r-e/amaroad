import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { getDeckPublicationStatuses } from "../../src/lib/deck-publication";

let root: string;

async function file(relativePath: string) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, "fixture");
}

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "amaroad-publication-test-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  await writeFile(path.join(root, ".gitignore"), [
    "/decks/*", "!/decks/sample-deck/", "!/decks/sample-rich-deck/", "!/decks/共有 日本語/", "",
  ].join("\n"));
  for (const name of ["sample-deck", "sample-rich-deck", "共有 日本語", "private-deck", "private-rich", "partial-track"]) {
    await file(`decks/${name}/deck.config.ts`);
  }
  await file("decks/private-deck/slide.mdx");
  await file("decks/private-rich/index.html");
  await file("decks/partial-track/assets/photo.jpg");
  execFileSync("git", ["add", "--", "decks/sample-deck/deck.config.ts"], { cwd: root });
  // Reproduce the privacy bug: only one ignored deck asset was force-added.
  execFileSync("git", ["add", "-f", "--", "decks/partial-track/assets/photo.jpg"], { cwd: root });
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

test("both tracked samples and untracked non-ignored rich samples are publication targets", async () => {
  const statuses = await getDeckPublicationStatuses(["sample-deck", "sample-rich-deck", "共有 日本語"], root);
  assert.deepEqual(statuses, {
    "sample-deck": "public", "sample-rich-deck": "public", "共有 日本語": "public",
  });
});

test("ignored MDX and rich decks are excluded", async () => {
  assert.deepEqual(await getDeckPublicationStatuses(["private-deck", "private-rich"], root), {
    "private-deck": "excluded", "private-rich": "excluded",
  });
});

test("even one tracked asset makes an otherwise ignored deck a publication target", async () => {
  assert.equal((await getDeckPublicationStatuses(["partial-track"], root))["partial-track"], "public");
  execFileSync("git", ["rm", "--cached", "--", "decks/partial-track/assets/photo.jpg"], { cwd: root });
  // No cached status: removing tracking takes effect on the next listing.
  assert.equal((await getDeckPublicationStatuses(["partial-track"], root))["partial-track"], "excluded");
});

test("ignore rule edits take effect without restarting the server", async () => {
  await writeFile(path.join(root, ".gitignore"), "/decks/*\n");
  assert.equal((await getDeckPublicationStatuses(["sample-rich-deck"], root))["sample-rich-deck"], "excluded");
});

test("unavailable Git state is unknown rather than falsely excluded", async () => {
  const outside = await mkdtemp(path.join(os.tmpdir(), "amaroad-no-git-test-"));
  try {
    assert.deepEqual(await getDeckPublicationStatuses(["private-deck"], outside), { "private-deck": "unknown" });
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});
