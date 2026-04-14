import { cache } from "react";
import { loadDeck } from "@/lib/deck-loader";
import { ThumbnailGridView } from "@/components/thumbnails/ThumbnailGridView";
import { getTunnelAccess } from "@/lib/tunnel-access";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const getCachedDeck = cache((deckName: string) => loadDeck(deckName));

export const dynamic = "force-dynamic";

interface ThumbnailsPageProps {
  params: Promise<{ deck: string }>;
}

export async function generateMetadata({
  params,
}: ThumbnailsPageProps): Promise<Metadata> {
  const { deck: deckName } = await params;
  try {
    const deck = await getCachedDeck(deckName);
    return {
      title: `${deck.config.title} — Thumbnails`,
      description: `Thumbnail overview for ${deck.config.title}`,
    };
  } catch {
    return { title: deckName };
  }
}

export default async function ThumbnailsPage({ params }: ThumbnailsPageProps) {
  const { deck: deckName } = await params;

  const { isLocal, sharedDeck } = await getTunnelAccess();
  if (!isLocal && sharedDeck !== deckName) notFound();

  let deck;
  try {
    deck = await loadDeck(deckName);
  } catch (e) {
    console.error(`[amaroad] Failed to load deck "${deckName}":`, e instanceof Error ? e.message : e);
    notFound();
  }

  return <ThumbnailGridView deck={deck} />;
}
