# Color Mapping

`decks/<deck>/deck.config.ts` の `theme.colors` を次の CSS 変数へ変換する。

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

## 注意点

- 同一 HEX が複数キーに定義されている場合、スクリプトは優先順（上表の上から）で採用する。
- `headingGradient` は HEX 単体値ではないため対象外。
- テーマ定義と一致しない HEX は置換しない。
