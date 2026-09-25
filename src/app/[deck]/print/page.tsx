import { loadDeckCached } from "@/lib/deck-loader";
import { PrintDeck } from "@/components/print/PrintDeck";
import { getTunnelAccess } from "@/lib/tunnel-access";
import { normalizePdfImageScale, parseSlideRange } from "@/lib/pdf/shared";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface PrintPageProps {
  params: Promise<{ deck: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseImageScale(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string" || raw === "") return null;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return normalizePdfImageScale(value);
}

export async function generateMetadata({ params }: PrintPageProps): Promise<Metadata> {
  const { deck: deckName } = await params;
  try {
    const deck = await loadDeckCached(deckName);
    // Chromium copies the document title into the PDF's Title metadata.
    return { title: deck.config.title, robots: { index: false, follow: false } };
  } catch {
    return { title: deckName, robots: { index: false, follow: false } };
  }
}

/**
 * Print route used by vector PDF export (`pnpm amaroad pdf`, Export > PDF
 * (vector)): every selected slide at native 1920x1080, one per printed page.
 * Opening it in a browser and printing to PDF also works.
 *
 * Query parameters:
 * - `slides=1-5,8` 1-based selection (default: every slide)
 * - `images=<n>` swap raster images for copies sized to n x their on-slide
 *   size once rendered (the renderer serves those copies; default: off)
 */
export default async function PrintPage({ params, searchParams }: PrintPageProps) {
  const { deck: deckName } = await params;
  const query = await searchParams;

  const { isLocal, sharedDeck } = await getTunnelAccess();
  if (!isLocal && sharedDeck !== deckName) notFound();

  let deck;
  try {
    deck = await loadDeckCached(deckName);
  } catch (e) {
    console.error(`[amaroad] Failed to load deck "${deckName}":`, e instanceof Error ? e.message : e);
    notFound();
  }

  const range = parseSlideRange(
    typeof query.slides === "string" ? query.slides : undefined,
    deck.slides.length,
  );
  if (!range.ok || range.indexes.length === 0) notFound();

  const slides = range.indexes.map((index) => deck.slides[index]);

  return (
    <PrintDeck
      deck={{ name: deck.name, config: deck.config }}
      slides={slides}
      imageScale={parseImageScale(query.images)}
    />
  );
}
