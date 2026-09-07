/**
 * rehype plugin: stamp `data-mdx-line` (1-based line in the original .mdx
 * file) on every HTML element and MDX JSX element that carries position info.
 *
 * Used only when a slide module is requested with `?lines=1` so tooling such
 * as the overflow detector can point at the MDX source line that produced an
 * offending DOM node. Normal rendering never enables it.
 *
 * Implemented with a local tree walk instead of `unist-util-visit` so the app
 * does not depend on a transitive package being hoisted.
 */

interface Position {
  start?: { line?: number };
}

interface HastElement {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  position?: Position;
}

interface MdxJsxAttribute {
  type: "mdxJsxAttribute";
  name: string;
  value?: unknown;
}

interface MdxJsxElement {
  type: "mdxJsxFlowElement" | "mdxJsxTextElement";
  name: string | null;
  attributes?: Array<MdxJsxAttribute | { type: string }>;
  children?: HastNode[];
  position?: Position;
}

interface GenericNode {
  type: string;
  children?: HastNode[];
  position?: Position;
}

type HastNode = HastElement | MdxJsxElement | GenericNode;

export const MDX_LINE_ATTRIBUTE = "data-mdx-line";

interface Options {
  /** Added to every stamped line so the number matches the file on disk. */
  lineOffset?: number;
}

function stamp(node: HastNode, lineOffset: number): void {
  const line = node.position?.start?.line;
  if (typeof line !== "number") return;
  const fileLine = String(line + lineOffset);

  if (node.type === "element") {
    const el = node as HastElement;
    el.properties = { ...(el.properties ?? {}), dataMdxLine: fileLine };
    return;
  }

  if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
    const el = node as MdxJsxElement;
    // Fragments (`<>…</>`) have no name and cannot take attributes.
    if (!el.name) return;
    const attributes = el.attributes ?? [];
    const alreadyStamped = attributes.some(
      (attr) => attr.type === "mdxJsxAttribute" && (attr as MdxJsxAttribute).name === MDX_LINE_ATTRIBUTE,
    );
    if (alreadyStamped) return;
    el.attributes = [
      ...attributes,
      { type: "mdxJsxAttribute", name: MDX_LINE_ATTRIBUTE, value: fileLine },
    ];
  }
}

function walk(node: HastNode, lineOffset: number): void {
  stamp(node, lineOffset);
  const children = (node as GenericNode).children;
  if (!Array.isArray(children)) return;
  for (const child of children) walk(child, lineOffset);
}

export default function rehypeSourceLines(options: Options = {}) {
  const lineOffset = options.lineOffset ?? 0;
  return (tree: HastNode): void => {
    walk(tree, lineOffset);
  };
}
