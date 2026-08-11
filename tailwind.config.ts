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
				DEFAULT: "#0d0f0d",
				80: "#151714",
				70: "#242823",
				60: "#343a33"
  			},
  			steel: {
  				DEFAULT: "#5b6b80",
  				40: "#9aa6b2",
  				20: "#c7d0da"
  			},
			cloud: {
				DEFAULT: "#f4f5ef",
				80: "#eef0e9"
			},
			signal: {
				DEFAULT: "#14a866",
				soft: "#c8ff56",
				muted: "#e9f7ef"
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
			xl: "0.5rem",
			"2xl": "0.5rem",
			"3xl": "0.5rem"
  		},
  		boxShadow: {
			"card": "0 1px 2px rgba(21, 23, 20, 0.05)",
			"card-strong": "0 8px 24px rgba(21, 23, 20, 0.08)",
			"glow-amber": "0 0 0 rgba(0, 0, 0, 0)",
			"glow-blue": "0 0 0 rgba(0, 0, 0, 0)",
  			"inner-glow": "inset 0 1px 0 rgba(255, 255, 255, 0.35)"
  		},
  		backgroundImage: {
			"mesh-glow": "none",
  			"soft-grid": "linear-gradient(90deg, rgba(15, 23, 42, 0.08) 1px, transparent 1px), linear-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px)",
			"sheen": "none"
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
