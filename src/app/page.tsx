import { listDecks } from "@/lib/deck-loader";
import { HomeShell } from "@/components/home/HomeShell";
import { getTunnelAccess } from "@/lib/tunnel-access";
import { redirect, notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { isLocal, sharedDeck } = await getTunnelAccess();
  if (!isLocal) {
    if (sharedDeck) redirect(`/${sharedDeck}`);
    notFound();
  }

  const decks = await listDecks();

  return <HomeShell decks={decks} />;
}
