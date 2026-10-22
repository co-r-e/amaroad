import type { NextRequest } from "next/server";
import { isLocalRequest, getSharedDeckName } from "@/lib/tunnel-access";
import { richDeckFileResponse } from "@/lib/rich-deck-files";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ deck: string; path: string[] }> }) {
  const { deck, path } = await params;
  if (!isLocalRequest(request) && getSharedDeckName() !== deck) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return richDeckFileResponse(request, deck, path);
}
