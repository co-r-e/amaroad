import { loadDeckCached } from "@/lib/deck-loader";
import { PresenterView } from "@/components/presenter/PresenterView";
import { getTunnelAccess } from "@/lib/tunnel-access";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

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
    console.error(`[dexcode] Failed to load deck "${deckName}":`, e instanceof Error ? e.message : e);
    notFound();
  }

  return <PresenterView deck={deck} />;
}
