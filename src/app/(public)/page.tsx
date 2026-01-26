'use client';

import CTA from "./components/CTA";
import Hero from "./components/Hero";


const highlights = [
    {
        badge: "Control center",
        title: "Your marketing OS across platforms",
        copy: "DeepVisor pulls Meta first, then TikTok + Google, into one calm dashboard — so you see what’s working, what’s wasting spend, and what to do next.",
        chips: ["Unified reporting", "Goal-based views", "Clear next steps"],
        gradient: "from-amber-100/80 via-white to-white",
        bars: [24, 40, 66, 82, 60],
    },
    {
        badge: "AI campaigns (in progress)",
        title: "Launch campaigns with guardrails + approvals",
        copy: "We’re building a guided flow where you answer a few questions (budget, location, goal) and DeepVisor handles setup — while you stay in control with approvals and overrides.",
        chips: ["AI Auto / Semi / Manual", "Draft-first publishing", "Human override"],
        gradient: "from-orange-100/70 via-amber-50 to-white",
        bars: [18, 38, 58, 72, 88],
    },
    {
        badge: "Waste detection",
        title: "Catch tracking gaps + spend drift early",
        copy: "We flag CPA spikes, broken tracking, creative fatigue, and spend drift before they become expensive — with simple explanations, not charts for the sake of charts.",
        chips: ["Spend drift", "Tracking health", "Creative fatigue"],
        gradient: "from-amber-100/70 via-amber-50 to-white",
        bars: [14, 32, 55, 74, 92],
    },
];


const steps = [
    {
        title: "Connect your platform",
        copy: "Start with Meta. We pull ad accounts, campaigns, ad sets, ads, and performance — then organize it into a dashboard that’s actually readable.",
        tag: "Day 1",
    },
    {
        title: "Define your goal + guardrails",
        copy: "Tell us what success looks like (leads, calls, WhatsApp, etc.). We set guardrails like CPA and budget alerts so you’re protected while scaling.",
        tag: "Week 1",
    },
    {
        title: "Automate what you trust",
        copy: "Enable AI automation per campaign: draft-first creation, approvals, A/B testing on top creatives, and monthly re-ranking — all with transparency.",
        tag: "Week 2+",
    },
];


const updateFeed = [
    {
        channel: "Meta",
        title: "Creative fatigue detected on lead campaign",
        impact: "Suggested 2 replacements + kept budget stable",
        tone: "text-amber-200",
    },
    {
        channel: "Meta",
        title: "Tracking health check flagged missing events",
        impact: "Prevented false 'low performance' conclusions",
        tone: "text-sky-200",
    },
    {
        channel: "AI Campaign Builder",
        title: "Draft campaign generated from top post",
        impact: "Ready for approval (objective + budget applied)",
        tone: "text-emerald-200",
    },
    {
        channel: "All channels",
        title: "Weekly clarity report generated",
        impact: "Top moves + why they matter (no fluff)",
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
                            DeepVisor is an early-stage product building a calm, cross-platform ads operating system — starting with Meta, expanding to TikTok and Google.
                            We’re actively developing AI-assisted campaign automation with approvals and guardrails, and we’re open to funding to accelerate development.
                        </p>

                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        Alpha includes weekly optimization review + product feedback loop
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
                            Guided automation · draft-first · approvals built-in
                        </p>

                        <h2 className="text-balance text-3xl font-semibold leading-tight sm:text-4xl">
                            Calm clarity, then automation you actually trust
                        </h2>

                        <p className="max-w-2xl text-sm text-white/70 sm:text-base">
                            DeepVisor starts by making performance readable (Meta-first), then layers in guardrails and a guided campaign builder that drafts changes for approval — not surprise automation.
                        </p>

                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
                        <span className="h-2 w-2 rounded-full bg-emerald-300" />
                        Limited alpha spots · hands-on onboarding
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
                                    <p className="text-xs uppercase tracking-[0.22em] text-white/60">Signal feed</p>
                                    <p className="text-lg font-semibold text-white">What changed this week</p>
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
                                    <p className="mt-2 text-2xl font-semibold text-white">~15m</p>
                                    <p className="text-xs text-white/60">Weekly alignment time (target)</p>
                                    <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                                        <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-emerald-300 to-amber-300" />
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-[0.18em] text-white/60">Signal coverage</p>
                                    <p className="mt-2 text-2xl font-semibold text-white">Guardrails</p>
                                    <p className="text-xs text-white/60">Spend drift + tracking checks + CPA spikes</p>
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