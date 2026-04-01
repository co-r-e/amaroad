import { NextRequest, NextResponse } from "next/server";
import { compile } from "@mdx-js/mdx";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { loadDeck } from "@/lib/deck-loader";
import { processSlideSource } from "@/lib/mdx-slide-source";
import { getSharedDeckName, isLocalRequest } from "@/lib/tunnel-access";

const compiledModuleCache = new Map<string, Promise<string>>();

function formatModuleError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function createThrowingModule(message: string): string {
  return `throw new Error(${JSON.stringify(message)});\nexport default function MDXError() { return null; }\n`;
}

function wrapCompiledModule(code: string): string {
  return [
    "const __react = globalThis.__dexcodeReact;",
    'if (!__react?.Children || !__react.createElement || !("Fragment" in __react)) {',
    '  throw new Error("DexCode React runtime is not ready.");',
    "}",
    "const { Children, createElement, Fragment } = __react;",
    "const normalizeProps = (props) => {",
    "  if (!props || !Array.isArray(props.children)) return props;",
    "  return { ...props, children: Children.toArray(props.children) };",
    "};",
    "const jsx = (type, props, key) => {",
    "  const normalizedProps = normalizeProps(props);",
    "  if (key === undefined) return createElement(type, normalizedProps);",
    "  return createElement(type, { ...normalizedProps, key });",
    "};",
    "const jsxs = jsx;",
    "const __mdxModule = (function () {",
    code,
    "})({ jsx, jsxs, Fragment });",
    "export default __mdxModule.default;",
    "",
  ].join("\n");
}

async function compileSlideModule(deckName: string, slideIndex: number): Promise<string> {
  const deck = await loadDeck(deckName);
  const slide = deck.slides[slideIndex];

  if (!slide) {
    throw new Error("Slide not found");
  }

  const processedSource = processSlideSource(slide.rawContent, deckName);
  const cacheKey = `${deckName}:${slide.filename}:${processedSource}`;
  const cached = compiledModuleCache.get(cacheKey);
  if (cached) return cached;

  const pending = compile(processedSource, {
    outputFormat: "function-body",
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [rehypeKatex],
  })
    .then((file) => wrapCompiledModule(String(file)))
    .catch((error) => {
      compiledModuleCache.delete(cacheKey);
      throw error;
    });

  compiledModuleCache.set(cacheKey, pending);
  return pending;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deck: string; slide: string }> },
) {
  const { deck: deckName, slide: slideStr } = await params;

  if (!isLocalRequest(request) && getSharedDeckName() !== deckName) {
    return new NextResponse("Not found", { status: 404 });
  }

  const slideIndex = Number.parseInt(slideStr, 10);
  if (Number.isNaN(slideIndex) || slideIndex < 0) {
    return new NextResponse("Invalid slide index", { status: 400 });
  }

  try {
    const body = await compileSlideModule(deckName, slideIndex);
    const version = request.nextUrl.searchParams.get("v");

    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control":
          process.env.NODE_ENV === "production" && version
            ? "public, max-age=31536000, immutable"
            : "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    const message = formatModuleError(error, "Failed to compile slide");
    return new NextResponse(createThrowingModule(message), {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  }
}
