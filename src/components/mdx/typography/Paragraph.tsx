import type { ComponentPropsWithoutRef } from "react";

// Renders as <span display:block> to avoid HTML nesting violations.
// MDX wraps text inside JSX elements with the `p` component, so:
//   <p> → invalid <p><p> nesting
//   <div> → invalid <p><div> nesting
// <span> is phrasing content (valid inside <p>) and with display:block
// behaves visually identical to a block element.
export function SlideParagraph(props: ComponentPropsWithoutRef<"span">) {
  return <span className="mb-6 block text-4xl leading-relaxed" {...props} />;
}
