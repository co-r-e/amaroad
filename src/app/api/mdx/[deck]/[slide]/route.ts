import { NextRequest, NextResponse } from "next/server";
import { compile, type CompileOptions } from "@mdx-js/mdx";
import rehypeKatex from "rehype-katex";
import rehypeUnwrapImages from "rehype-unwrap-images";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { loadDeck } from "@/lib/deck-loader";
import { processSlideSource } from "@/lib/mdx-slide-source";
import rehypeSourceLines from "@/lib/rehype-source-lines";
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
    "const __react = globalThis.__amaroadReact;",
    'if (!__react?.Children || !__react.createElement || !("Fragment" in __react)) {',
    '  throw new Error("Amaroad React runtime is not ready.");',
    "}",
    "const { Children, createElement, Fragment } = __react;",
    "const normalizeChildren = (children) => {",
    "  if (!Array.isArray(children)) return children;",
    "  return children.map((c, i) => {",
    "    if (c != null && typeof c === 'object' && 'type' in c && c.key == null) {",
    "      return createElement(c.type, { ...c.props, key: 'mdx-' + i });",
    "    }",
    "    return c;",
    "  });",
    "};",
    "const normalizeProps = (props) => {",
    "  if (!props || !Array.isArray(props.children)) return props;",
    "  return { ...props, children: normalizeChildren(props.children) };",
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

async function compileSlideModule(
  deckName: string,
  slideIndex: number,
  options: { sourceLines: boolean },
): Promise<string> {
  const deck = await loadDeck(deckName);
  const slide = deck.slides[slideIndex];

  if (!slide) {
    throw new Error("Slide not found");
  }

  const processedSource = processSlideSource(slide.rawContent, deckName);
  const cacheKey = `${deckName}:${slide.filename}:${options.sourceLines ? "lines:" : ""}${processedSource}`;
  const cached = compiledModuleCache.get(cacheKey);
  if (cached) return cached;

  // `processSlideSource` only rewrites within lines, so hast positions map
  // 1:1 onto the frontmatter-stripped body; add the frontmatter offset here.
  const rehypePlugins: NonNullable<CompileOptions["rehypePlugins"]> = [rehypeKatex, rehypeUnwrapImages];
  if (options.sourceLines) {
    rehypePlugins.push([rehypeSourceLines, { lineOffset: slide.contentStartLine - 1 }]);
  }

  const pending = compile(processedSource, {
    outputFormat: "function-body",
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins,
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
    const linesParam = request.nextUrl.searchParams.get("lines");
    const sourceLines = linesParam === "1" || linesParam === "true";
    const body = await compileSlideModule(deckName, slideIndex, { sourceLines });
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
