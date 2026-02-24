"use client";

import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import {
  useState,
  useEffect,
  Component,
  type ComponentType,
  type ReactNode,
  type ErrorInfo,
} from "react";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { MDXComponents } from "mdx/types";

interface MDXErrorDisplayProps {
  title: string;
  message: string;
}

function MDXErrorDisplay({ title, message }: MDXErrorDisplayProps): React.JSX.Element {
  return (
    <div className="p-4 text-red-600 bg-red-50 rounded text-xl font-mono">
      <p className="font-bold">{title}</p>
      <pre className="mt-2 whitespace-pre-wrap text-base">{message}</pre>
    </div>
  );
}

class MDXErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[nipry] MDX render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <MDXErrorDisplay title="MDX Render Error" message={this.state.error} />;
    }
    return this.props.children;
  }
}

interface MDXRendererProps {
  source: string;
  components?: MDXComponents;
}

interface CompiledMDX {
  source: string;
  content: ComponentType<{ components?: MDXComponents }> | null;
  error: string | null;
}

export function MDXRenderer({ source, components = {} }: MDXRendererProps): React.JSX.Element {
  const [compiled, setCompiled] = useState<CompiledMDX>({
    source: "",
    content: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function render(): Promise<void> {
      try {
        const { default: MDXContent } = await evaluate(source, {
          ...(runtime as Parameters<typeof evaluate>[1]),
          remarkPlugins: [remarkGfm, remarkMath],
          rehypePlugins: [rehypeKatex],
        });

        if (!cancelled) {
          setCompiled({
            source,
            content: MDXContent as ComponentType<{ components?: MDXComponents }>,
            error: null,
          });
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "MDX compile error";
          console.error("[nipry] MDX compile error:", e);
          setCompiled({
            source,
            content: null,
            error: msg,
          });
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [source]);

  const isCurrentSource = compiled.source === source;
  const error = isCurrentSource ? compiled.error : null;
  const Content = isCurrentSource ? compiled.content : null;
  const status = error ? "error" : Content === null ? "loading" : "ready";

  return (
    <div data-mdx-status={status} className="flex h-full flex-col">
      {error ? (
        <MDXErrorDisplay title="MDX Error" message={error} />
      ) : (
        <MDXErrorBoundary>{Content ? <Content components={components} /> : null}</MDXErrorBoundary>
      )}
    </div>
  );
}
