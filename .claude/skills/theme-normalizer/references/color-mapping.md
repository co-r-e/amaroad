# Color Mapping

Map `theme.colors` values in `decks/<deck>/deck.config.ts` to slide CSS variables.

| theme.colors key | CSS variable |
|---|---|
| `primary` | `var(--slide-primary)` |
| `secondary` | `var(--slide-secondary)` |
| `accent` | `var(--slide-accent)` |
| `background` | `var(--slide-bg)` |
| `text` | `var(--slide-text)` |
| `textMuted` | `var(--slide-text-muted)` |
| `textSubtle` | `var(--slide-text-subtle)` |
| `surface` | `var(--slide-surface)` |
| `surfaceAlt` | `var(--slide-surface-alt)` |
| `border` | `var(--slide-border)` |
| `borderLight` | `var(--slide-border-light)` |

## Notes

- If the same HEX appears under multiple keys, the script uses the first match by mapping order.
- `headingGradient` is out of scope because it is not a single HEX value.
- HEX values not present in theme definitions are not replaced.
