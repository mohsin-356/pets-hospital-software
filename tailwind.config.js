/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--pm-border))",
        input: "hsl(var(--pm-border))",
        ring: "hsl(var(--pm-primary))",
        background: "hsl(var(--pm-bg))",
        foreground: "hsl(var(--pm-text))",
        pm: {
          primary: "hsl(var(--pm-primary))",
          secondary: "hsl(var(--pm-secondary))",
          accent: "hsl(var(--pm-accent))",
          bg: "hsl(var(--pm-bg))",
          surface: "hsl(var(--pm-surface))",
          text: {
            DEFAULT: "hsl(var(--pm-text))",
            muted: "hsl(var(--pm-text-muted))",
          },
          border: "hsl(var(--pm-border))",
          success: "hsl(var(--pm-success))",
          warning: "hsl(var(--pm-warning))",
          error: "hsl(var(--pm-error))",
          info: "hsl(var(--pm-info))",
        },
        hospital: { // Keeping legacy for backward compatibility during transition
          blue: "#e6f0ff",
          green: "#e9f9ef",
          teal: "#0ea5a6",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        xl: "var(--radius-xl)",
        '2xl': "var(--radius-2xl)",
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate")
  ],
};
