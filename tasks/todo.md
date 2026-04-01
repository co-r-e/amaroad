# TODO

- [completed] Inspect the PDF export capture path and identify why line wrapping and clipping diverge from the on-screen slide.
- [completed] Update export capture readiness and font handling so PDF rendering matches the live slide more closely.
- [completed] Replace the client-side MDX `evaluate()` path with a CSP-safe runtime so slides render correctly in production and export can be verified end-to-end.
- [completed] Re-run end-to-end PDF export verification after the runtime fix and update the review notes.
- [completed] Stop production clients from calling the disabled `/api/tunnel` endpoint so `next start` no longer logs a 403 in the browser console.
- [completed] Remove the remaining `react-hooks/set-state-in-effect` lint violation in `DeckGrid.tsx` by refactoring pinned deck persistence off the effect path.
- [completed] Remove the React missing-key warning emitted by MDX-rendered `ShowcaseCover` by fixing the custom JSX runtime wrapper used by compiled MDX modules.

# Review

- Added explicit font readiness waits before slide capture and a second post-stabilization font pass to reduce layout drift during export.
- Replaced `skipFonts: true` with `fontEmbedCSS` generation via `html-to-image`, cached by the slide's active font families, so exported SVG/JPEG captures keep the intended web fonts.
- Replaced the client-side `@mdx-js/mdx evaluate()` path with a CSP-safe same-origin module loader: slides are compiled on the server at `/api/mdx/[deck]/[slide]`, and the browser imports those modules without `unsafe-eval`.
- Moved slide-source preprocessing into a shared utility so on-screen rendering and export compile the same transformed MDX source.
- `npm run lint -- src/lib/export.ts`: passed.
- `npm run lint -- src/lib/mdx-runtime.tsx src/components/slide/SlideContent.tsx src/app/api/mdx/[deck]/[slide]/route.ts src/lib/mdx-slide-source.ts`: passed.
- `npm run build`: passed.
- Browser verification on `http://localhost:3851/core-pitch` under `next start`: slide content rendered correctly with CSP enabled.
- Browser verification on `http://localhost:3851/core-pitch` PDF export: all slide module requests `/api/mdx/core-pitch/0..7?...` returned `200`, export progress completed, and the prior MDX compile failures disappeared.
- Added production guards to the tunnel UI/state callers so `DeckGrid`, `Sidebar`, and `useTunnel` no longer fetch `/api/tunnel` when the API is intentionally disabled.
- Browser verification on `http://localhost:3851/` and `http://localhost:3851/core-pitch` under `next start`: no console warnings/errors remained; the previous `/api/tunnel` `403` disappeared.
- Browser verification on `http://localhost:3851/core-pitch` PDF export after the tunnel guard: export still completed and no console warnings/errors were emitted.
- Refactored pinned deck persistence in `DeckGrid` to a `useSyncExternalStore`-backed localStorage store, removing both the initial `setState` effect and the follow-up persistence effect.
- `npm run lint -- src/components/deck-list/DeckGrid.tsx`: passed.
- `npm run lint -- src/hooks/useTunnel.ts src/components/deck-list/DeckGrid.tsx src/components/sidebar/Sidebar.tsx`: passed.
- Browser verification on `http://localhost:3851/` under `next start`: pin toggle still works, and a pinned card updates from `Pin deck` to `Unpin deck` without console warnings/errors.
- Added `Children.toArray` normalization to the custom MDX JSX wrapper so compiled MDX sibling arrays keep React’s key semantics even without the standard `react/jsx-runtime` helper.
- `npm run lint -- src/lib/mdx-runtime.tsx src/app/api/mdx/[deck]/[slide]/route.ts`: passed.
- Browser verification on `http://localhost:3850/sample-deck` under `next dev`: `ShowcaseCover` rendered without the previous missing-key warning in the console.
