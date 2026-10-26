/** Builds `rgb(var(--foo) / <alpha-value>)` — Tailwind substitutes
 *  `<alpha-value>` with the opacity modifier (e.g. the `60` in `/60`), or
 *  `1` when no modifier is used. The CSS variable itself must hold a plain
 *  "R G B" triplet (no `rgb()` wrapper) — see globals.css. */
function withOpacity(cssVar) {
  return `rgb(var(${cssVar}) / <alpha-value>)`;
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Every custom token below resolves through a CSS variable (defined
        // as an "R G B" triplet in globals.css, one block per color scheme —
        // see the `[data-theme]` rules there) rather than a static hex
        // value, so the whole app re-themes by swapping those variables
        // instead of needing dark: variants sprinkled through every
        // component. The `rgb(var(...) / <alpha-value>)` wrapper is
        // Tailwind's documented pattern for keeping opacity modifiers
        // (e.g. `bg-brand-50/60`, `border-danger-500/30`) working with
        // CSS-variable-backed colors.
        paper: withOpacity("--color-paper"),
        surface: withOpacity("--color-surface"),
        ink: {
          DEFAULT: withOpacity("--color-ink"),
          muted: withOpacity("--color-ink-muted"),
          faint: withOpacity("--color-ink-faint"),
        },
        brand: {
          50: withOpacity("--color-brand-50"),
          100: withOpacity("--color-brand-100"),
          300: withOpacity("--color-brand-300"),
          500: withOpacity("--color-brand-500"),
          600: withOpacity("--color-brand-600"),
          700: withOpacity("--color-brand-700"),
        },
        cyan: {
          50: withOpacity("--color-cyan-50"),
          100: withOpacity("--color-cyan-100"),
          300: withOpacity("--color-cyan-300"),
          500: withOpacity("--color-cyan-500"),
          600: withOpacity("--color-cyan-600"),
        },
        accent: {
          100: withOpacity("--color-accent-100"),
          300: withOpacity("--color-accent-300"),
          500: withOpacity("--color-accent-500"),
          600: withOpacity("--color-accent-600"),
        },
        line: withOpacity("--color-line"),
        danger: {
          50: withOpacity("--color-danger-50"),
          500: withOpacity("--color-danger-500"),
          600: withOpacity("--color-danger-600"),
        },
      },
      fontFamily: {
        display: [
          "var(--font-fraunces)",
          "PingFang HK",
          "PingFang TC",
          "Noto Sans TC",
          "Microsoft JhengHei",
          "Georgia",
          "serif",
        ],
        sans: [
          "var(--font-inter)",
          "PingFang HK",
          "PingFang TC",
          "Noto Sans TC",
          "Microsoft JhengHei",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        signature: ["var(--font-signature)", "cursive"],
        reading: [
          "var(--font-lora)",
          "PingFang HK",
          "PingFang TC",
          "Noto Serif TC",
          "serif",
        ],
        art: [
          "var(--font-syne)",
          "PingFang HK",
          "PingFang TC",
          "Noto Sans TC",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(41,58,110,0.04), 0 8px 24px rgba(41,58,110,0.07)",
        soft: "0 12px 32px rgba(79,124,255,0.12)",
        stamp: "0 0 0 1.5px currentColor inset",
      },
      borderRadius: {
        card: "16px",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #4F7CFF 0%, #7F9BFA 45%, #9B6BEA 100%)",
        "app-gradient":
          "radial-gradient(circle at 0% 0%, rgba(79,124,255,0.10), transparent 45%), radial-gradient(circle at 100% 0%, rgba(155,107,234,0.10), transparent 45%), radial-gradient(circle at 50% 100%, rgba(34,211,238,0.08), transparent 50%)",
      },
    },
  },
  plugins: [],
};
