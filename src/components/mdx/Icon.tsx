"use client";

import * as icons from "lucide-react";
import type { LucideProps } from "lucide-react";
import styles from "./Media.module.css";

interface IconProps extends Omit<LucideProps, "ref"> {
  name: string;
}

// lucide 1.0 dropped brand icons. Decks still reference these two by name, so
// keep the last lucide 0.577 paths locally and render them with the same
// SVG attributes lucide uses, so existing size / color / style props apply.
const LEGACY_ICON_PATHS: Record<string, React.ReactNode> = {
  github: (
    <>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </>
  ),
  chrome: (
    <>
      <path d="M10.88 21.94 15.46 14" />
      <path d="M21.17 8H12" />
      <path d="M3.95 6.06 8.54 14" />
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
};

function LegacyIcon({
  name,
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  absoluteStrokeWidth,
  className,
  ...rest
}: IconProps) {
  const resolvedStrokeWidth =
    absoluteStrokeWidth && typeof size === "number" && size !== 0
      ? (Number(strokeWidth) * 24) / size
      : strokeWidth;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={resolvedStrokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["lucide", `lucide-${name}`, className].filter(Boolean).join(" ")}
      aria-hidden="true"
      {...rest}
    >
      {LEGACY_ICON_PATHS[name]}
    </svg>
  );
}

export function Icon({ name, ...props }: IconProps) {
  const pascalName = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("") as keyof typeof icons;

  const LucideIcon = icons[pascalName] as React.ComponentType<LucideProps> | undefined;

  if (!LucideIcon) {
    if (LEGACY_ICON_PATHS[name]) {
      return <LegacyIcon name={name} {...props} />;
    }
    return <span className={styles.iconError}>[Icon: {name}]</span>;
  }

  return <LucideIcon {...props} />;
}
