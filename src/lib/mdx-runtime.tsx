"use client";

import {
  useState,
  useEffect,
  Component,
  createElement,
  Children,
  Fragment,
  type ComponentType,
  type ReactNode,
  type ErrorInfo,
} from "react";
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
    console.error("[dexcode] MDX render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <MDXErrorDisplay title="MDX Render Error" message={this.state.error} />;
    }
    return this.props.children;
  }
}

interface MDXRendererProps {
  moduleUrl: string;
  components?: MDXComponents;
}

interface CompiledMDX {
  moduleUrl: string;
  content: ComponentType<{ components?: MDXComponents }> | null;
  error: string | null;
}

interface DexcodeReactRuntime {
  Children: typeof Children;
  createElement: typeof createElement;
  Fragment: typeof Fragment;
}

declare global {
  var __dexcodeReact: DexcodeReactRuntime | undefined;
}

function ensureDexcodeReactRuntime(): void {
  globalThis.__dexcodeReact = {
    Children,
    createElement,
    Fragment,
  };
}

export function MDXRenderer({ moduleUrl, components = {} }: MDXRendererProps): React.JSX.Element {
  const [compiled, setCompiled] = useState<CompiledMDX>({
    moduleUrl: "",
    content: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function render(): Promise<void> {
      try {
        ensureDexcodeReactRuntime();
        const imported = await import(/* webpackIgnore: true */ moduleUrl);
        const MDXContent = imported.default as ComponentType<{ components?: MDXComponents }>;

        if (!cancelled) {
          setCompiled({
            moduleUrl,
            content: MDXContent,
            error: null,
          });
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "MDX compile error";
          console.error("[dexcode] MDX module load error:", e);
          setCompiled({
            moduleUrl,
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
  }, [moduleUrl]);

  const isCurrentModule = compiled.moduleUrl === moduleUrl;
  const error = isCurrentModule ? compiled.error : null;
  const Content = isCurrentModule ? compiled.content : null;
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
