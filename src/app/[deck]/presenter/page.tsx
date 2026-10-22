import path from "node:path";
import { loadPresentation } from "@/lib/presentation-loader";
import { RichDeckViewer } from "@/components/rich/RichDeckViewer";
import { computeNarrationStatus, narrationTrackFor, resolveNarrationSettings } from "@/lib/narration";
import { PresenterView } from "@/components/presenter/PresenterView";
import { getTunnelAccess } from "@/lib/tunnel-access";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Deck, PresenterNarration } from "@/types/deck";
import { readRichPosition } from "@/lib/rich-deck-protocol";

export const dynamic = "force-dynamic";

interface PresenterPageProps {
  params: Promise<{ deck: string }>;
  searchParams: Promise<{ slide?: string; step?: string }>;
}

export async function generateMetadata({
  params,
}: PresenterPageProps): Promise<Metadata> {
  const { deck: deckName } = await params;
  const { isLocal, sharedDeck } = await getTunnelAccess();
  if (!isLocal && sharedDeck !== deckName) return { title: "Amaroad" };
  try {
    const { deck } = await loadPresentation(deckName);
    return {
      title: `${deck.config.title} — Presenter`,
      description: `Presenter view for ${deck.config.title}`,
    };
  } catch {
    return { title: deckName };
  }
}

export default async function PresenterPage({ params, searchParams }: PresenterPageProps) {
  const { deck: deckName } = await params;

  const { isLocal, sharedDeck } = await getTunnelAccess();
  if (!isLocal && sharedDeck !== deckName) notFound();

  let presentation;
  try {
    presentation = await loadPresentation(deckName);
  } catch (e) {
    console.error(`[amaroad] Failed to load deck "${deckName}":`, e instanceof Error ? e.message : e);
    notFound();
  }

  if (presentation.format === "html") return <RichDeckViewer deck={presentation.deck} presenter initialPosition={readRichPosition(await searchParams)} />;
  const deck = presentation.deck;
  const narration = await loadPresenterNarration(deck);

  return <PresenterView deck={deck} narration={narration} />;
}

/** Up-to-date narration audio per slide; stale or missing audio is left out (the slide is silent). */
async function loadPresenterNarration(deck: Deck): Promise<PresenterNarration> {
  const settings = resolveNarrationSettings(deck.config);
  const deckDir = path.join(process.cwd(), "decks", deck.name);
  const statuses = await computeNarrationStatus(
    deckDir,
    settings,
    deck.slides.map((slide) => ({ filename: slide.filename, narration: slide.frontmatter.narration })),
  );
  return {
    silentSlideSeconds: settings.silentSlideSeconds,
    pauseSeconds: settings.pauseSeconds,
    tracks: statuses.map((status) => (status.entry ? narrationTrackFor(deck.name, status.entry) : null)),
  };
}
