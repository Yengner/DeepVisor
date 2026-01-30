import type { Config } from "tailwindcss";
const defaultTheme = require("tailwindcss/defaultTheme");

export default {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		animation: {
  			"bounce-up": "bounce-up 0.5s ease-in-out",
  			"float-slow": "float-slow 12s ease-in-out infinite",
  			"glow-pulse": "glow-pulse 10s ease-in-out infinite",
  			"fade-up": "fade-up 0.6s ease-out both",
  			"shine": "shine 2.2s ease-in-out infinite"
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			ink: {
  				DEFAULT: "#0b111a",
  				80: "#111827",
  				70: "#1f2937",
  				60: "#374151"
  			},
  			steel: {
  				DEFAULT: "#5b6b80",
  				40: "#9aa6b2",
  				20: "#c7d0da"
  			},
  			cloud: {
  				DEFAULT: "#f5f7fb",
  				80: "#eef2f7"
  			},
  			signal: {
  				DEFAULT: "#f59e0b",
  				soft: "#fcd34d",
  				muted: "#fef3c7"
  			},
  			aurora: {
  				DEFAULT: "#60a5fa",
  				soft: "#a5b4fc"
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			sans: ["var(--font-body)", ...defaultTheme.fontFamily.sans],
  			display: ["var(--font-display)", ...defaultTheme.fontFamily.sans],
  			manrope: ["Manrope", ...defaultTheme.fontFamily.sans]
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			xl: "1.25rem",
  			"2xl": "1.75rem",
  			"3xl": "2.5rem"
  		},
  		boxShadow: {
  			"card": "0 18px 50px rgba(10, 14, 20, 0.12)",
  			"card-strong": "0 25px 60px rgba(10, 14, 20, 0.18)",
  			"glow-amber": "0 0 45px rgba(245, 158, 11, 0.35)",
  			"glow-blue": "0 0 55px rgba(96, 165, 250, 0.3)",
  			"inner-glow": "inset 0 1px 0 rgba(255, 255, 255, 0.35)"
  		},
  		backgroundImage: {
  			"mesh-glow": "radial-gradient(circle at 20% 10%, rgba(245, 158, 11, 0.22), transparent 55%), radial-gradient(circle at 80% 0%, rgba(96, 165, 250, 0.18), transparent 60%), radial-gradient(circle at 60% 80%, rgba(16, 185, 129, 0.16), transparent 55%)",
  			"soft-grid": "linear-gradient(90deg, rgba(15, 23, 42, 0.08) 1px, transparent 1px), linear-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px)",
  			"sheen": "linear-gradient(120deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02) 45%, rgba(255, 255, 255, 0.12))"
  		},
  		keyframes: {
  			"float-slow": {
  				"0%, 100%": { transform: "translateY(0px)" },
  				"50%": { transform: "translateY(-12px)" }
  			},
  			"glow-pulse": {
  				"0%, 100%": { opacity: "0.4" },
  				"50%": { opacity: "0.85" }
  			},
  			"fade-up": {
  				"0%": { opacity: "0", transform: "translateY(14px)" },
  				"100%": { opacity: "1", transform: "translateY(0)" }
  			},
  			"shine": {
  				"0%": { backgroundPosition: "0% 50%" },
  				"100%": { backgroundPosition: "200% 50%" }
  			}
  		},
  		spacing: {
  			"section": "7.5rem",
  			"section-sm": "5rem"
  		},
  		maxWidth: {
  			"content": "72rem",
  			"content-lg": "78rem"
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
