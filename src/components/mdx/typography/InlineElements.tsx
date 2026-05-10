import type { ComponentPropsWithoutRef, KeyboardEvent } from "react";
import styles from "./InlineElements.module.css";

export function SlideHr(props: ComponentPropsWithoutRef<"hr">) {
  return <hr className={styles.hr} {...props} />;
}

/**
 * Renders a styled link inside slides.
 *
 * Uses <span> instead of <a> to avoid invalid <a>-inside-<a> nesting
 * when MDX authors wrap markdown links inside raw JSX <a> tags.
 * Navigation is handled via onClick so links remain interactive.
 */
export function SlideAnchor({
  href,
  children,
  target: _target,
  rel: _rel,
  download: _download,
  referrerPolicy: _referrerPolicy,
  ...rest
}: ComponentPropsWithoutRef<"a">) {
  const handleClick = href
    ? () => window.open(href, "_blank", "noopener")
    : undefined;

  const handleKeyDown = href
    ? (e: KeyboardEvent) => {
        if (e.key === "Enter") window.open(href, "_blank", "noopener");
      }
    : undefined;

  return (
    <span
      className={styles.a}
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{ cursor: href ? "pointer" : undefined }}
      {...rest}
    >
      {children}
    </span>
  );
}
