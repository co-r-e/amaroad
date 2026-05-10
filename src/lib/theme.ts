import type { DeckTheme } from "@/types/deck";

export const DEFAULT_SLIDE_THEME: Required<DeckTheme> = {
    colors: {
        primary: "#000000",
        secondary: "#000000",
        accent: "#000000",
        background: "#FFFFFF",
        text: "#1a1a1a",
        textMuted: "#6b7280",
        textSubtle: "#9ca3af",
        surface: "#f8f9fa",
        surfaceAlt: "#f0f2f5",
        border: "#e5e7eb",
        borderLight: "#f3f4f6",
    },
    fonts: {
        heading: "Inter, sans-serif",
        body: "Noto Sans JP, sans-serif",
        mono: "Fira Code, monospace",
        headingWeight: 700,
        headingLetterSpacing: "-0.025em",
        bodyLineHeight: 1.7,
        scale: 1,
    },
    spacing: {
        xs: 8,
        sm: 16,
        md: 24,
        lg: 32,
        xl: 48,
        xxl: 64,
        scale: 1,
    },
    radius: "1rem",
};

export function createThemeVariables(
    theme: DeckTheme,
    backgroundOverride?: string
): React.CSSProperties {
    const colors = { ...DEFAULT_SLIDE_THEME.colors, ...theme.colors };
    const fonts = { ...DEFAULT_SLIDE_THEME.fonts, ...theme.fonts };
    const spacing = { ...DEFAULT_SLIDE_THEME.spacing, ...theme.spacing };
    const radius = theme.radius ?? DEFAULT_SLIDE_THEME.radius;
    const fontScale = fonts.scale ?? 1;
    const derivedSpacingScale = fontScale > 1 ? Math.max(0.82, 1 - (fontScale - 1) * 0.45) : 1;
    const spacingScale = theme.spacing?.scale ?? derivedSpacingScale;
    const spacingValues = {
        xs: spacing.xs ?? 8,
        sm: spacing.sm ?? 16,
        md: spacing.md ?? 24,
        lg: spacing.lg ?? 32,
        xl: spacing.xl ?? 48,
        xxl: spacing.xxl ?? 64,
    };

    return {
        "--slide-primary": colors.primary,
        "--slide-secondary": colors.secondary ?? colors.primary,
        "--slide-accent": colors.accent ?? colors.primary,
        "--slide-heading-gradient": colors.headingGradient ?? colors.primary,
        "--slide-bg": backgroundOverride ?? colors.background,
        "--slide-text": colors.text,
        "--slide-text-muted": colors.textMuted,
        "--slide-text-subtle": colors.textSubtle,
        "--slide-surface": colors.surface,
        "--slide-surface-alt": colors.surfaceAlt,
        "--slide-border": colors.border,
        "--slide-border-light": colors.borderLight,
        "--slide-font-heading": fonts.heading,
        "--slide-font-body": fonts.body,
        "--slide-font-mono": fonts.mono,
        "--slide-heading-weight": String(fonts.headingWeight),
        "--slide-heading-tracking": fonts.headingLetterSpacing,
        "--slide-body-leading": String(fonts.bodyLineHeight),
        "--slide-font-scale": String(fontScale),
        "--slide-space-scale": String(spacingScale),
        "--slide-radius": radius,
        "--slide-space-xs": `${spacingValues.xs * spacingScale}px`,
        "--slide-space-sm": `${spacingValues.sm * spacingScale}px`,
        "--slide-space-md": `${spacingValues.md * spacingScale}px`,
        "--slide-space-lg": `${spacingValues.lg * spacingScale}px`,
        "--slide-space-xl": `${spacingValues.xl * spacingScale}px`,
        "--slide-space-xxl": `${spacingValues.xxl * spacingScale}px`,
    } as React.CSSProperties;
}
