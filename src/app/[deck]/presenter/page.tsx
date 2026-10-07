import path from "node:path";
import { loadDeckCached } from "@/lib/deck-loader";
import { computeNarrationStatus, narrationTrackFor, resolveNarrationSettings } from "@/lib/narration";
import { PresenterView } from "@/components/presenter/PresenterView";
import { getTunnelAccess } from "@/lib/tunnel-access";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Deck, PresenterNarration } from "@/types/deck";

export const dynamic = "force-dynamic";

interface PresenterPageProps {
  params: Promise<{ deck: string }>;
}

export async function generateMetadata({
  params,
}: PresenterPageProps): Promise<Metadata> {
  const { deck: deckName } = await params;
  try {
    const deck = await loadDeckCached(deckName);
    return {
      title: `${deck.config.title} — Presenter`,
      description: `Presenter view for ${deck.config.title}`,
    };
  } catch {
    return { title: deckName };
  }
}

export default async function PresenterPage({ params }: PresenterPageProps) {
  const { deck: deckName } = await params;

  const { isLocal, sharedDeck } = await getTunnelAccess();
  if (!isLocal && sharedDeck !== deckName) notFound();

  let deck;
  try {
    deck = await loadDeckCached(deckName);
  } catch (e) {
    console.error(`[amaroad] Failed to load deck "${deckName}":`, e instanceof Error ? e.message : e);
    notFound();
  }

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
