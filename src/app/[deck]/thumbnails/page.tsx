import { loadPresentation } from "@/lib/presentation-loader";
import { ThumbnailGridView } from "@/components/thumbnails/ThumbnailGridView";
import { RichThumbnailOverview } from "@/components/rich/RichThumbnailOverview";
import { getTunnelAccess } from "@/lib/tunnel-access";
import { notFound } from "next/navigation";
import type { Metadata } from "next";


export const dynamic = "force-dynamic";

interface ThumbnailsPageProps {
  params: Promise<{ deck: string }>;
}

export async function generateMetadata({
  params,
}: ThumbnailsPageProps): Promise<Metadata> {
  const { deck: deckName } = await params;
  const { isLocal, sharedDeck } = await getTunnelAccess();
  if (!isLocal && sharedDeck !== deckName) return { title: "Amaroad" };
  try {
    const { deck } = await loadPresentation(deckName);
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

  let presentation;
  try {
    presentation = await loadPresentation(deckName);
  } catch (e) {
    console.error(`[amaroad] Failed to load deck "${deckName}":`, e instanceof Error ? e.message : e);
    notFound();
  }

  return presentation.format === "html" ? <RichThumbnailOverview deck={presentation.deck} /> : <ThumbnailGridView deck={presentation.deck} />;
}
