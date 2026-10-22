import { cache } from "react";
import { readDeckConfig } from "./deck-config";
import { isUnsafeDeckName } from "./deck-paths";
import { loadDeck } from "./deck-loader";
import { loadRichDeck, resolveRichDeckDirectory } from "./rich-deck-loader";
import type { Deck } from "@/types/deck";
import type { RichDeck } from "@/types/rich-deck";

export type Presentation = { format: "mdx"; deck: Deck } | { format: "html"; deck: RichDeck };

export const loadPresentation = cache(async (name: string): Promise<Presentation> => {
  if (isUnsafeDeckName(name)) throw new Error("Invalid deck name");
  const directory = await resolveRichDeckDirectory(name);
  const config = await readDeckConfig(directory);
  if (config.format === "html") return { format: "html", deck: await loadRichDeck(name) };
  return { format: "mdx", deck: await loadDeck(name) };
});
