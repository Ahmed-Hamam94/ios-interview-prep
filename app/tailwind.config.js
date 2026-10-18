import animate from "tailwindcss-animate"

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Apple's own serif (New York) for reading; falls back gracefully elsewhere
        serif: ["ui-serif", '"New York"', '"Iowan Old Style"', "Georgia", "serif"],
        mono: ["ui-monospace", '"SF Mono"', "Menlo", "Consolas", "monospace"],
      },
      // type scale for the app's serif reading UI (replaces one-off text-[…] values)
      fontSize: {
        "2xs": "11px",
        code: ["13px", { lineHeight: "1.65" }],
        recall: "1.05rem",
        question: ["1.65rem", { lineHeight: "1.28" }],
        "question-lg": ["1.95rem", { lineHeight: "1.28" }],
        display: "2.6rem",
      },
      lineHeight: { reading: "1.72" },
      maxWidth: { page: "46rem", question: "30ch", measure: "64ch", "measure-sm": "60ch" },
      spacing: { 4.5: "1.125rem" },
      borderWidth: { 1.5: "1.5px", 3: "3px" },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        success: { DEFAULT: "var(--success)", bg: "var(--success-bg)" },
        danger: { DEFAULT: "var(--danger)", bg: "var(--danger-bg)" },
        info: { DEFAULT: "var(--info)", bg: "var(--info-bg)" },
        warning: { DEFAULT: "var(--warning)", bg: "var(--warning-bg)" },
        topic: "var(--accent-topic)",
        editor: { DEFAULT: "var(--code-bg)", foreground: "var(--code-fg)" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        panel: "1.75rem", // hero card on Home
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        rise: "rise .28s ease-out",
      },
    },
  },
  plugins: [animate],
}
