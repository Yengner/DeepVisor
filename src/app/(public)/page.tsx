'use client';

import CTA from "./components/CTA";
import Hero from "./components/Hero";


const highlights = [
    {
        badge: "Unified view",
        title: "One view for every ad platform",
        copy: "Meta, TikTok, Google - brought into a single, calm dashboard so you stop guessing and start deciding.",
        chips: ["Cross-platform performance", "Budget clarity", "Next best actions"],
        gradient: "from-amber-100/80 via-white to-white",
        bars: [28, 46, 64, 78, 58],
    },
    {
        badge: "Guardrails",
        title: "Catch waste before it drains budget",
        copy: "We surface spend drift, tracking gaps, and CPA spikes early - so you fix problems while they're small.",
        chips: ["Spend anomalies", "Tracking health", "Creative fatigue"],
        gradient: "from-orange-100/70 via-amber-50 to-white",
        bars: [16, 34, 52, 70, 92],
    },
    {
        badge: "Automation-ready",
        title: "From insight → action in minutes",
        copy: "We’re building workflows that make optimizing ads feel simple - with guardrails, approvals, and transparency.",
        chips: ["Guided setup", "Smart recommendations", "Human override"],
        gradient: "from-amber-100/70 via-amber-50 to-white",
        bars: [20, 44, 72, 62, 56],
    },
];

const steps = [
    {
        title: "Understand your reality",
        copy: "We learn how you run ads today: platforms, goals, budgets, tracking, and what “good” actually means for you.",
        tag: "Week 0",
    },
    {
        title: "Connect + set guardrails",
        copy: "We configure spend/CPA alerts, tracking checks, and reporting so you're protected before you scale.",
        tag: "Week 1",
    },
    {
        title: "Weekly clarity that compounds",
        copy: "A consistent weekly summary: what changed, what matters, and what we'd adjust next — without the noise.",
        tag: "Week 2+",
    },
];

const updateFeed = [
    {
        channel: "Meta",
        title: "Spend spike flagged on 1 campaign",
        impact: "Guardrail prevented budget bleed",
        tone: "text-emerald-200",
    },
    {
        channel: "TikTok",
        title: "CPA drift detected early",
        impact: "Paused + rotated creative in time",
        tone: "text-amber-200",
    },
    {
        channel: "Google Ads",
        title: "Search terms quality drop spotted",
        impact: "Added negatives + tightened targeting",
        tone: "text-sky-200",
    },
    {
        channel: "All channels",
        title: "Weekly clarity report generated",
        impact: "Top moves + why they matter",
        tone: "text-white/80",
    },
];

export default function HomePage() {
    return (
        <>
            <Hero />
            <HighlightsSection />
            <MomentumSection />
            <CTA />
        </>
    );
}

const HighlightsSection = () => {
    return (
        <section className="relative overflow-hidden bg-gradient-to-b from-[#fdf8ef] via-[#faf7f1] to-[#f6f3ec] py-16 sm:py-20">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[10%] top-[-4rem] h-52 w-52 rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.35),_transparent_55%)] blur-3xl" />
                <div className="absolute right-[8%] top-[10%] h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(113,113,255,0.18),_transparent_60%)] blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.8)_0%,rgba(255,255,255,0.2)_35%,rgba(255,255,255,0)_100%)]" />
            </div>

            <div className="relative mx-auto max-w-6xl px-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-3">
                        <p className="text-xs uppercase tracking-[0.22em] text-amber-700">
                            For businesses running real ads
                        </p>
                        <h2 className="text-balance text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                            What makes DeepVisor different
                        </h2>
                        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                            Less noise, more signal. DeepVisor is built to make cross-platform ads understandable, controllable, and easier to improve.
                        </p>

                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        Alpha includes weekly partner time
                    </div>
                </div>

                <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {highlights.map((card) => (
                        <div
                            key={card.title}
                            className="group relative overflow-hidden rounded-2xl border border-amber-100/80 bg-white/90 p-6 shadow-[0_16px_45px_rgba(0,0,0,0.06)] backdrop-blur"
                        >
                            <div className={`absolute inset-x-0 -top-16 h-32 bg-gradient-to-br ${card.gradient} opacity-0 blur-2xl transition duration-500 group-hover:opacity-80`} />
                            <div className="relative space-y-4">
                                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800">
                                    {card.badge}
                                </div>
                                <h3 className="text-xl font-semibold text-foreground">{card.title}</h3>
                                <p className="text-sm text-muted-foreground">{card.copy}</p>
                                <div className="flex flex-wrap gap-2">
                                    {card.chips.map((chip) => (
                                        <span
                                            key={chip}
                                            className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-semibold text-foreground/80"
                                        >
                                            {chip}
                                        </span>
                                    ))}
                                </div>
                                <div className="mt-2 flex items-end gap-1">
                                    {card.bars.map((height, idx) => (
                                        <span
                                            key={`${card.title}-${idx}`}
                                            className="w-2 rounded-full bg-gradient-to-t from-amber-300 to-orange-400 transition duration-500 group-hover:translate-y-[-4px]"
                                            style={{ height: `${height}%` }}
                                        />
                                    ))}
                                    <span className="ml-3 text-[11px] uppercase tracking-[0.18em] text-amber-700">Health snapshot</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

const MomentumSection = () => {
    return (
        <section className="relative overflow-hidden bg-[#0c1018] py-16 text-white sm:py-20">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[-6rem] top-[-8rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.28),_transparent_55%)] blur-3xl" />
                <div className="absolute right-[-3rem] top-[4rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,_rgba(125,211,252,0.25),_transparent_55%)] blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_50%,rgba(255,255,255,0.05)_100%)]" />
            </div>

            <div className="relative mx-auto max-w-6xl px-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-3">
                        <p className="text-xs uppercase tracking-[0.22em] text-amber-100/80">
                            Your ads, on autopilot (with guardrails)
                        </p>

                        <h2 className="text-balance text-3xl font-semibold leading-tight sm:text-4xl">
                            How we keep the loop calm and honest
                        </h2>
                        <p className="max-w-2xl text-sm text-white/70 sm:text-base">
                            We pair the product with a real cadence: listening first, setting guardrails early, and keeping the weekly board human-readable.
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
                        <span className="h-2 w-2 rounded-full bg-emerald-300" />
                        6 alpha spots open this month
                    </div>
                </div>

                <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="space-y-4">
                        {steps.map((step, index) => (
                            <div
                                key={step.title}
                                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_14px_40px_rgba(0,0,0,0.35)]"
                            >
                                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-amber-300/60 via-transparent to-amber-300/60" />
                                <div className="flex items-start gap-4">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-amber-100">
                                        0{index + 1}
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                                        <p className="text-sm text-white/70">{step.copy}</p>
                                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                                            {step.tag}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.35)]">
                        <div className="absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-emerald-300/50 via-amber-200/60 to-indigo-300/60" />
                        <div className="relative space-y-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.22em] text-white/60">Alpha feed</p>
                                    <p className="text-lg font-semibold text-white">Signals we caught this week</p>
                                </div>
                                <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                                    Low chaos
                                </div>
                            </div>
                            <div className="space-y-3">
                                {updateFeed.map((item) => (
                                    <div
                                        key={item.title}
                                        className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                                    >
                                        <div>
                                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">{item.channel}</p>
                                            <p className="text-sm font-semibold text-white">{item.title}</p>
                                        </div>
                                        <p className={`text-xs font-semibold ${item.tone}`}>{item.impact}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-[0.18em] text-white/60">Operator load</p>
                                    <p className="mt-2 text-2xl font-semibold text-white">12m</p>
                                    <p className="text-xs text-white/60">Time to align per week</p>
                                    <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                                        <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-emerald-300 to-amber-300" />
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-[0.18em] text-white/60">Signal coverage</p>
                                    <p className="mt-2 text-2xl font-semibold text-white">93%</p>
                                    <p className="text-xs text-white/60">Accounts with clean tracking + alerts</p>
                                    <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                                        <div className="h-full w-[74%] rounded-full bg-gradient-to-r from-sky-300 to-indigo-300" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};