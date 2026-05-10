# slide-preflight-auditor Rules

This document summarizes the main CLAUDE.md rules used in preflight audits.

## 1. Safe Zone (Inviolable Area)

- Keep slide content inside the `SlideFrame` content area.
- Avoid collisions with overlays (logo/copyright/page number).
- Do not push content outside bounds with negative margins.
- Manual visual verification is required (not fully auto-detectable).

## 2. Minimum Font Size

- Rule: body text should be `1.8rem` or larger.
- Audit: `fontSize` below `1.8rem` is reported as `error`.
- Note: auxiliary text such as dates/badges can be contextual exceptions.

## 3. No One-Sided Accent Borders

- Rule: avoid one-sided emphasis like `border-left` in general.
- Audit: `borderLeft` / `border-left` is reported as `error`.
- Exception: timeline axis lines that carry real structural meaning.

## 4. No Tailwind Utilities in Slide Content

- Rule: do not use Tailwind utility classes in slide MDX or `src/components/mdx`.
- Audit: tailwind-like `className` values are reported as `error`.

## 5. Hard-Coded Color Warning

- Rule: prefer theme variables (`var(--slide-*)`).
- Audit: HEX literals (`#RGB`, `#RRGGBB`, etc.) are reported as `warning`.

## 6. Missing Notes Warning

- Rule: include frontmatter `notes` to preserve presentation context.
- Audit: missing or empty `notes` is reported as `warning`.
