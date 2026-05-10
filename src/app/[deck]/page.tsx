import { loadDeckCached } from "@/lib/deck-loader";
import { SlideViewer } from "@/components/viewer/SlideViewer";
import { getTunnelAccess } from "@/lib/tunnel-access";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface DeckPageProps {
  params: Promise<{ deck: string }>;
}

export async function generateMetadata({
  params,
}: DeckPageProps): Promise<Metadata> {
  const { deck: deckName } = await params;
  try {
    const deck = await loadDeckCached(deckName);
    return {
      title: deck.config.title,
      description: `${deck.config.title} — ${deck.slides.length} slides`,
    };
  } catch {
    return { title: deckName };
  }
}

export default async function DeckPage({ params }: DeckPageProps) {
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

  return <SlideViewer deck={deck} />;
}
