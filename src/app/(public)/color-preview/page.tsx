// src/app/color-preview/page.tsx
import type { FC } from "react";

type ColorToken = {
    name: string;
    usage: string;
    value: string; // HSL or HEX
};

type Palette = {
    id: string;
    label: string;
    description: string;
    colors: ColorToken[];
};

const palettes: Palette[] = [
    {
        id: "deepvisor-blue",
        label: "Option A – DeepVisor Blue",
        description:
            "Tech-forward, analytics/ads/AI friendly. Great for DeepVisor dashboard + landing.",
        colors: [
            {
                name: "Background",
                usage: "App background",
                value: "hsl(210 40% 98%)",
            },
            {
                name: "Foreground",
                usage: "Main text",
                value: "hsl(220 27% 20%)",
            },
            {
                name: "Primary",
                usage: "Brand / main CTAs",
                value: "hsl(222 70% 50%)",
            },
            {
                name: "Secondary",
                usage: "Secondary sections/cards",
                value: "hsl(220 14% 95%)",
            },
            {
                name: "Accent",
                usage: "Links / highlights",
                value: "hsl(265 80% 60%)",
            },
            {
                name: "Muted",
                usage: "Subtle backgrounds / labels",
                value: "hsl(220 14% 96%)",
            },
            {
                name: "Destructive",
                usage: "Errors / destructive actions",
                value: "hsl(0 70% 55%)",
            },
            {
                name: "Border",
                usage: "Borders / dividers",
                value: "hsl(220 13% 90%)",
            },
        ],
    },
    {
        id: "black-gold",
        label: "Option B – Black & Gold",
        description: "Premium / agency-like feel. Great if you want luxury vibes.",
        colors: [
            {
                name: "Background",
                usage: "App background",
                value: "hsl(50 20% 98%)",
            },
            {
                name: "Foreground",
                usage: "Main text",
                value: "hsl(40 20% 20%)",
            },
            {
                name: "Primary",
                usage: "Brand / main CTAs (gold)",
                value: "hsl(45 90% 55%)",
            },
            {
                name: "Secondary",
                usage: "Secondary surfaces",
                value: "hsl(45 15% 92%)",
            },
            {
                name: "Accent",
                usage: "Highlights / small details",
                value: "hsl(45 95% 65%)",
            },
            {
                name: "Muted",
                usage: "Subtle backgrounds / labels",
                value: "hsl(45 15% 94%)",
            },
            {
                name: "Destructive",
                usage: "Errors / destructive actions",
                value: "hsl(0 70% 55%)",
            },
            {
                name: "Border",
                usage: "Borders / dividers",
                value: "hsl(40 15% 85%)",
            },
        ],
    },
    {
        id: "minimal-gray",
        label: "Option C – Minimal Gray",
        description:
            "Ultra-clean, Linear/Vercel vibe. Very minimal, black + blue accent.",
        colors: [
            {
                name: "Background",
                usage: "App background",
                value: "hsl(0 0% 100%)",
            },
            {
                name: "Foreground",
                usage: "Main text",
                value: "hsl(222 47% 11%)",
            },
            {
                name: "Primary",
                usage: "Brand / main CTAs (black)",
                value: "hsl(222 47% 11%)",
            },
            {
                name: "Secondary",
                usage: "Secondary sections/cards",
                value: "hsl(0 0% 96%)",
            },
            {
                name: "Accent",
                usage: "Links / highlights (blue)",
                value: "hsl(217 80% 55%)",
            },
            {
                name: "Muted",
                usage: "Subtle backgrounds / labels",
                value: "hsl(0 0% 94%)",
            },
            {
                name: "Destructive",
                usage: "Errors / destructive actions",
                value: "hsl(0 70% 55%)",
            },
            {
                name: "Border",
                usage: "Borders / dividers",
                value: "hsl(0 0% 90%)",
            },
        ],
    },
];

const ColorPreviewPage: FC = () => {
    return (
        <main className="min-h-screen bg-neutral-950 text-neutral-50 px-4 py-10">
            <div className="mx-auto max-w-6xl space-y-10">
                <header className="space-y-3">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        DeepVisor Color Scheme Preview
                    </h1>
                    <p className="text-sm text-neutral-300 max-w-2xl">
                        Compare different palette options side by side. Each card shows
                        background, foreground, primary, secondary, accent, muted,
                        destructive, and border tokens, so you can pick what fits DeepVisor
                        best.
                    </p>
                </header>

                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {palettes.map((palette) => (
                        <section
                            key={palette.id}
                            className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm"
                        >
                            <div className="mb-4 space-y-1">
                                <h2 className="text-lg font-semibold">{palette.label}</h2>
                                <p className="text-xs text-neutral-300">
                                    {palette.description}
                                </p>
                            </div>

                            <div className="space-y-3">
                                {palette.colors.map((color) => (
                                    <div
                                        key={color.name}
                                        className="flex items-center gap-3 rounded-xl bg-neutral-900/80 p-2"
                                    >
                                        <div
                                            className="h-10 w-10 flex-shrink-0 rounded-lg border border-neutral-800"
                                            style={{ background: color.value }}
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-medium">
                                                {color.name}
                                                <span className="ml-1 text-[10px] text-neutral-400">
                                                    · {color.usage}
                                                </span>
                                            </span>
                                            <span className="text-[11px] text-neutral-400">
                                                {color.value}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
};

export default ColorPreviewPage;
