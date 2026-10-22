import fs from "../../../src/lib/runtime-fs";
import { loadRichDeck, resolveRichDeckDirectory, resolveRichDeckFile } from "../../../src/lib/rich-deck-loader";
import { richAssetReferences } from "../../../src/lib/rich-deck-assets";
import { ensureServer, launchBrowser, resolveBaseUrl } from "../../lib/browser";
import type { DeckEntry } from "../../lib/decks";
import type { Finding } from "../../lib/findings";
import type { CheckName, CheckRunOptions } from "../context";

export async function checkHtmlDeck(entry: DeckEntry, checks: CheckName[], options: CheckRunOptions): Promise<Finding[]> {
  const findings: Finding[] = [];
  const add = (check: string, rule: string, severity: Finding["severity"], message: string, file?: string) => {
    findings.push({ deck: entry.name, check, rule, severity, message, file });
  };
  let deck;
  let directory: string;
  try {
    deck = await loadRichDeck(entry.name);
    directory = await resolveRichDeckDirectory(entry.name);
  } catch (error) {
    add("config", "invalid-html-deck", "error", error instanceof Error ? error.message : String(error));
    return findings;
  }

  if (checks.includes("assets")) {
    const queue = ["index.html"];
    const visited = new Set<string>();
    for (const relative of queue) {
      if (visited.has(relative)) continue;
      visited.add(relative);
      const file = await resolveRichDeckFile(directory, relative.split("/"));
      const source = await fs.readFile(file, "utf8");
      const references = richAssetReferences(source);
      if (deck.config.standalone && references.length) {
        add("assets", "standalone-has-dependencies", "error", "standalone: true requires embedded assets", `decks/${entry.name}/${relative}`);
      }
      for (const reference of references) {
        try {
          if (/^(?:[a-z]+:|\/\/|\/)/i.test(reference)) throw new Error("Use a relative local asset; external assets are blocked in the HTML viewer");
          const base = new URL(relative, "https://rich.invalid/deck/");
          const url = new URL(reference, base);
          if (!url.pathname.startsWith("/deck/")) throw new Error("Asset escapes the deck directory");
          const asset = url.pathname.slice("/deck/".length).split("/").map(decodeURIComponent);
          await resolveRichDeckFile(directory, asset);
          if (/\.(?:css|js|mjs)$/i.test(asset.at(-1) ?? "")) queue.push(asset.join("/"));
        } catch (error) {
          add("assets", "invalid-html-asset", "error", `${reference}: ${error instanceof Error ? error.message : String(error)}`, `decks/${entry.name}/${relative}`);
        }
      }
    }
  }

  if (checks.includes("html")) {
    const baseUrl = resolveBaseUrl(options.baseUrl);
    try { await ensureServer(baseUrl); }
    catch {
      add("html", "server-unavailable", "warning", "HTML runtime check needs pnpm dev (or use --skip html)");
      return findings;
    }
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
      const errors = new Set<string>();
      page.on("pageerror", (error) => errors.add(error.message));
      const response = await page.goto(`${baseUrl}/${encodeURIComponent(entry.name)}`, { waitUntil: "domcontentloaded" });
      if (!response?.ok()) throw new Error(`HTML viewer returned HTTP ${response?.status()}`);
      await page.waitForSelector('[data-rich-status="ready"], [data-rich-status="error"]', { timeout: 25000 });
      if (await page.locator('[data-rich-status="error"]').count()) {
        errors.add(await page.locator('[data-rich-status] [role="alert"]').innerText());
      }
      for (const error of errors) add("html", "runtime-error", "error", error);
      if (!errors.size) add("html", "runtime-ready", "info", "HTML loaded and initialized in its sandboxed viewer");
    } catch (error) {
      add("html", "runtime-error", "error", error instanceof Error ? error.message : String(error));
    } finally { await browser.close(); }
  }
  return findings;
}
