# Changelog

All notable changes to Amaroad will be documented in this file.

## [0.1.5] - 2026-05-25

### Added

- `codex-image` / `codex-image-edit` / `image-provider` skills for routing AI
  image generation between GPT/Codex and Gemini/Nanobanana providers
- IrukaDark banner above the sidebar About Us footer
- Sidebar-driven deck browser layout for the home page
- GitHub and Website links in the home sidebar; arrow-style deck back button
- MDX components and export runtime stabilization
- `no_markdown_bold` and `bullet_points_as_cards` slide authoring rules
- `AMAROAD_CLOUD_SPEC` and Durable Objects PoC client scaffolding

### Changed

- Rebrand DexCode → Amaroad across the codebase and docs
- Migrate package manager from npm to pnpm
- Increase slide logo height from `3rem` to `3.5rem` in `SlideOverlay`
- Bump Next.js to 16.2.6, `@google/genai` to 1.51.0, `actions/checkout` to 6,
  `actions/setup-node` to 6, and Wrangler 3 → 4 (patches undici + esbuild
  advisories)
- Revert May 10–11 dependency updates that introduced regressions
- Broaden `.gitignore` patterns for workers, logs, and nested builds

### Fixed

- PDF export image rendering
- `third-party-notices` script now runs cross-platform (regenerated on Linux
  to match CI)
- Vendor `xlsx` as an extracted directory instead of a tarball for reliable
  CI installs
- Resolve 11 Dependabot security alerts
- Allow horizontal scroll for long deck names in the sidebar

### Removed

- Stray debug PNGs left over from the DexCode → Amaroad rename

## [0.1.4] - 2026-03-25

### Performance

- Memoize MDX normalization and asset path resolution in `SlideContent` to
  avoid redundant regex work on every re-render
- Deduplicate deck loading with React `cache()` — `generateMetadata` and the
  page component no longer load the same deck twice per request
- Optimize slide export capture by disabling `cacheBust` and skipping font
  re-serialization in `html-to-image`
- Hoist `Intl.Collator` to module scope in `DeckGrid` to avoid per-sort
  instantiation
- Wrap `DeckCard` in `React.memo` to prevent unnecessary re-renders on
  filter/sort changes
- Change `SlideThumbnail` from `onClick` closure to `onSelect(index)` callback
  so the parent passes a stable reference, preserving memo effectiveness

### Refactored

- Extract `useIntersectionVisibility` hook — replaces identical
  `IntersectionObserver` boilerplate in `SlideThumbnail`, `ThumbnailGridView`,
  and `SlideViewer`/`LazySlide`
- Extract `ProsConsColumn` component in `ShowcaseComparison` — eliminates
  duplicated left/right column rendering logic

### Fixed

- Fix dead ternary in `ShowcaseMatrix` where both branches returned `undefined`
- Add `white-space: nowrap` to `SlideOverlay` text to prevent line wrapping
- Change Export button icon from Download to Share for semantic clarity

### Removed

- Remove `macnica-ai-seminar` and `sample2` demo decks from the repository

## [0.1.3] - 2026-03-20

### Added

- Manifest-based slide ordering with `slide-order.ts`
- 20 Kasumigaseki-style government slide templates to `sample-deck`

### Changed

- Harden share tunnel feature — security, reliability, and UX improvements
- Allow Cloudflare share origins in development
- Update dependencies (Next.js 16.2.1, Recharts 3.8.0, and others)

## [0.1.2] - 2026-03-13

### Added

- Initial share tunnel feature for remote slide viewing
- Screenshot placeholder and duplicate slide workflow rules

## [0.1.0] - 2026-03-06

### Added

- Initial release of Amaroad
- MDX-based slide authoring with live preview
- PDF and PPTX export
- Presenter mode with speaker notes
- Theme system with CSS custom properties
- Sidebar thumbnail navigation
