import { loadPresentation } from "@/lib/presentation-loader";
import { RichDeckViewer } from "@/components/rich/RichDeckViewer";
import { SlideViewer } from "@/components/viewer/SlideViewer";
import { getTunnelAccess } from "@/lib/tunnel-access";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { readRichPosition } from "@/lib/rich-deck-protocol";

export const dynamic = "force-dynamic";

interface DeckPageProps {
  params: Promise<{ deck: string }>;
  searchParams: Promise<{ slide?: string; step?: string }>;
}

export async function generateMetadata({
  params,
}: DeckPageProps): Promise<Metadata> {
  const { deck: deckName } = await params;
  const { isLocal, sharedDeck } = await getTunnelAccess();
  if (!isLocal && sharedDeck !== deckName) return { title: "Amaroad" };
  try {
    const presentation = await loadPresentation(deckName);
    return {
      title: presentation.deck.config.title,
      description: presentation.format === "html" ? `${presentation.deck.config.title} · HTML presentation` :
        `${presentation.deck.config.title} — ${presentation.deck.slides.length} slides`,
    };
  } catch {
    return { title: deckName };
  }
}

export default async function DeckPage({ params, searchParams }: DeckPageProps) {
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

  return presentation.format === "html" ? <RichDeckViewer deck={presentation.deck} initialPosition={readRichPosition(await searchParams)} /> : <SlideViewer deck={presentation.deck} />;
}
