import { listDecks } from "@/lib/deck-loader";
import { listRichDecks } from "@/lib/rich-deck-loader";
import { HomeShell } from "@/components/home/HomeShell";
import { getTunnelAccess } from "@/lib/tunnel-access";
import { getDeckPublicationStatuses } from "@/lib/deck-publication";
import { redirect, notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { isLocal, sharedDeck } = await getTunnelAccess();
  if (!isLocal) {
    if (sharedDeck) redirect(`/${sharedDeck}`);
    notFound();
  }

  const [decks, richDecks, query] = await Promise.all([listDecks(), listRichDecks(), searchParams]);
  const publicationStatuses = await getDeckPublicationStatuses([...decks, ...richDecks].map((deck) => deck.name));

  return <HomeShell decks={decks} richDecks={richDecks} publicationStatuses={publicationStatuses} initialMode={query.mode === "rich" ? "rich" : "simple"} />;
}
