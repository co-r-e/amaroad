import { loadDeckCached } from "@/lib/deck-loader";
import { NativeSlideStage } from "@/components/slide/NativeSlideStage";
import { getTunnelAccess } from "@/lib/tunnel-access";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface NativeSlidePageProps {
  params: Promise<{ deck: string; index: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseIndex(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  return Number.parseInt(raw, 10);
}

function parseScale(raw: string | string[] | undefined): number {
  if (typeof raw !== "string") return 1;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 4) return 1;
  return value;
}

export async function generateMetadata({
  params,
}: NativeSlidePageProps): Promise<Metadata> {
  const { deck: deckName, index } = await params;
  try {
    const deck = await loadDeckCached(deckName);
    return {
      title: `${deck.config.title} — Slide ${Number.parseInt(index, 10) + 1}`,
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: deckName, robots: { index: false, follow: false } };
  }
}

/**
 * Tooling route: renders exactly one slide at its native 1920x1080 size with
 * no viewer chrome. Used by `pnpm amaroad capture|overflow` and the visual
 * regression suite.
 *
 * Query parameters:
 * - `scale=<n>` shrinks/enlarges the raster (layout is unchanged)
 * - `lines=1` stamps `data-mdx-line` on rendered MDX elements
 */
export default async function NativeSlidePage({
  params,
  searchParams,
}: NativeSlidePageProps) {
  const { deck: deckName, index: rawIndex } = await params;
  const query = await searchParams;

  const { isLocal, sharedDeck } = await getTunnelAccess();
  if (!isLocal && sharedDeck !== deckName) notFound();

  const index = parseIndex(rawIndex);
  if (index === null) notFound();

  let deck;
  try {
    deck = await loadDeckCached(deckName);
  } catch (e) {
    console.error(`[amaroad] Failed to load deck "${deckName}":`, e instanceof Error ? e.message : e);
    notFound();
  }

  const slide = deck.slides[index];
  if (!slide) notFound();

  const scale = parseScale(query.scale);
  const sourceLines = query.lines === "1" || query.lines === "true";

  return (
    <main
      data-native-slide-page=""
      style={{
        margin: 0,
        padding: 0,
        width: "max-content",
        height: "max-content",
        background: "transparent",
      }}
    >
      <NativeSlideStage
        deck={deck}
        slide={slide}
        scale={scale}
        sourceLines={sourceLines}
      />
    </main>
  );
}
