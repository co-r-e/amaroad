import { listDecks } from "@/lib/deck-loader";
import { DeckGrid } from "@/components/deck-list/DeckGrid";
import { getTunnelAccess } from "@/lib/tunnel-access";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { isLocal, sharedDeck } = await getTunnelAccess();
  if (!isLocal) {
    if (sharedDeck) redirect(`/${sharedDeck}`);
    notFound();
  }

  const decks = await listDecks();

  return (
    <div className="flex min-h-screen flex-col p-8">
      <header className="mb-12 flex items-center gap-4">
        <Image
          src="/dexcode-logo.svg"
          alt="DexCode"
          width={199}
          height={50}
          priority
          className="dark:[filter:invert(1)_hue-rotate(180deg)]"
        />
        <div className="flex-1" />
        <ThemeToggle />
      </header>
      <main className="flex-1">
        {decks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="text-xl text-gray-500 dark:text-gray-400 mb-4">
              No decks found
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Add MDX files to the{" "}
              <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">decks/</code>{" "}
              directory
            </p>
          </div>
        ) : (
          <DeckGrid decks={decks} />
        )}
      </main>
      <footer className="mt-16 border-t border-gray-200 dark:border-gray-800 pt-6 pb-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <a
          href="https://co-r-e.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          About Us
        </a>
        <div className="flex items-center gap-4">
          <a
            href="https://x.com/okuwaki_m"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            aria-label="X (Twitter)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://www.linkedin.com/in/okuwakim/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            aria-label="LinkedIn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
}
