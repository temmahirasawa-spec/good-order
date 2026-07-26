import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50:  "#FDFAF4",
          100: "#FAF4E8",
          200: "#F3E8D0",
          300: "#EAD9B8",
          400: "#DFCA9E",
        },
        warm: {
          100: "#FFF8E0",
          200: "#FEEDB3",
          300: "#FDE08A",
          400: "#FCD465",
          500: "#FBCA4E",
          600: "#FAC547",
          700: "#FAC03D",   // メインアクセント
          800: "#E0A820",   // active / hover
          900: "#B88400",
        },
        brand: {
          bg:      "#FDFBF0",
          surface: "#FFF8E7",
          border:  "#F0E0A0",
          muted:   "#9A8850",
          text:    "#3D2800",
          primary: "#FAC547",
          accent:  "#FAC03D",
        },
        // ─── 新デザイントークン（/order 刷新用。既存の cream/warm/brand とは別名前空間） ───
        accent: {
          primary: "var(--color-accent-primary)",
          pressed: "var(--color-accent-pressed)",
          deep: "var(--color-accent-deep)",
          subtle: "var(--color-accent-subtle)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          disabled: "var(--color-text-disabled)",
          inverse: "var(--color-text-inverse)",
        },
        border: {
          divider: "var(--color-border-divider)",
          DEFAULT: "var(--color-border-default)",
        },
        bg: {
          primary: "var(--color-bg-primary)",
          secondary: "var(--color-bg-secondary)",
          tertiary: "var(--color-bg-tertiary)",
          warm: "var(--color-bg-warm)",
        },
        surface: {
          white: "var(--color-surface-white)",
          ink: "var(--color-surface-ink)",
        },
        tag: {
          yellow: "var(--color-tag-yellow)",
          orange: "var(--color-tag-orange)",
          pink: "var(--color-tag-pink)",
          red: "var(--color-tag-red)",
          green: "var(--color-tag-green)",
          teal: "var(--color-tag-teal)",
          blue: "var(--color-tag-blue)",
          purple: "var(--color-tag-purple)",
          brown: "var(--color-tag-brown)",
          gray: "var(--color-tag-gray)",
        },
        status: {
          urgent:  { DEFAULT: "var(--color-status-urgent)",  subtle: "var(--color-status-urgent-subtle)" },
          warning: { DEFAULT: "var(--color-status-warning)", subtle: "var(--color-status-warning-subtle)" },
          success: { DEFAULT: "var(--color-status-success)", subtle: "var(--color-status-success-subtle)" },
          info:    { DEFAULT: "var(--color-status-info)",    subtle: "var(--color-status-info-subtle)" },
        },
      },
      fontFamily: {
        halis: ["HalisR", "sans-serif"],
        sans:  ["var(--font-noto)", "sans-serif"],
        // 新デザイントークン（/order 刷新用）。CSS変数は next/font（lib/fonts.ts）が定義
        jp: ["var(--font-jp)", "Noto Sans JP", "sans-serif"],
        en: ["var(--font-en)", "Barlow", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
        // 新デザイントークンのうち Tailwind デフォルト(sm/md/lg/xl)と衝突しないものだけ追加。
        // sm/md/lg/xl は既存全画面のロールに影響するため意図的に含めていない
        // （/order の新規JSXでは rounded-[var(--radius-xl)] 等の任意値記法を使うこと）
        xs: "var(--radius-xs)",
      },
      boxShadow: {
        soft:  "0 2px 12px rgba(61, 40, 0, 0.08)",
        card:  "0 4px 24px rgba(61, 40, 0, 0.10)",
        float: "0 8px 32px rgba(61, 40, 0, 0.14)",
        // 新デザイントークン。card/float は既存キーと衝突するため保留
        // （/order の新規JSXでは shadow-[var(--shadow-card)] 等の任意値記法を使うこと）
        "bottom-bar": "var(--shadow-bottom-bar)",
      },
      screens: {
        tablet: "1180px", // 新デザイントークン（Figma tablet-landscape テンプレート）
      },
      keyframes: {
        "heart-pop": {
          "0%":   { transform: "scale(1)" },
          "30%":  { transform: "scale(1.45)" },
          "60%":  { transform: "scale(0.88)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "heart-pop": "heart-pop 320ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
