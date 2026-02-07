import type { FC } from "react";
import Link from "next/link";
import { Badge, Button, Card, Container, Section } from "@/components/marketing";

const metrics = [
    {
        label: "Time saved",
        value: "10+ hrs",
        note: "From automated analysis & insights",
    },
    {
        label: "Channels unified",
        value: "Meta • Google +",
        note: "All ad data in one dashboard",
    },
    {
        label: "Auto insights",
        value: "100% automated",
        note: "AI-drafted, human-verified insights",
    },
];


const Hero: FC = () => {
    return (
        <Section tone="dark" className="overflow-hidden" id="platform" aria-labelledby="hero-title">
            <div className="pointer-events-none absolute inset-0 bg-mesh-glow opacity-80" aria-hidden="true" />
            <div
                className="pointer-events-none absolute inset-0 bg-soft-grid opacity-[0.15] [background-size:80px_80px]"
                aria-hidden="true"
            />
            <div className="pointer-events-none absolute -left-32 top-[-10rem] h-96 w-96 rounded-full bg-signal/20 blur-3xl motion-safe:animate-glow-pulse" aria-hidden="true" />
            <div className="pointer-events-none absolute right-[-8rem] top-[-6rem] h-80 w-80 rounded-full bg-aurora/20 blur-3xl motion-safe:animate-glow-pulse" aria-hidden="true" />

            <Container className="relative">
                <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-8">
                        <Badge
                            variant="dark"
                            className="w-fit motion-safe:animate-fade-up"
                            style={{ animationDelay: "60ms" }}
                        >
                            Supporters · 2026
                        </Badge>

                        <div className="space-y-5">
                            <h1
                                id="hero-title"
                                className="text-balance text-4xl font-semibold leading-tight motion-safe:animate-fade-up sm:text-5xl lg:text-6xl"
                                style={{ animationDelay: "120ms" }}
                            >
                                DeepVisor:
                                <span className="block bg-gradient-to-r from-signal/80 via-amber-200 to-orange-400 bg-clip-text text-transparent">
                                    AI-Powered Ad Performance & Automation
                                </span>
                            </h1>

                            <p
                                className="max-w-xl text-base text-white/70 motion-safe:animate-fade-up sm:text-lg"
                                style={{ animationDelay: "180ms" }}
                            >
                                Unify your ad data, cut noise, and automate actionable insights.
                            </p>

                        </div>

                        <div className="flex flex-wrap items-center gap-4 motion-safe:animate-fade-up" style={{ animationDelay: "240ms" }}>
                            <Button asChild size="lg" variant="primary">
                                <Link href="#support">Share support</Link>
                            </Button>
                            <Button asChild size="lg" variant="outline">
                                <Link href="#how-it-works">See how it works</Link>
                            </Button>
                            <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                                3–5 minute form · No pressure
                            </span>
                        </div>

                        <div className="grid gap-4 motion-safe:animate-fade-up sm:grid-cols-3" style={{ animationDelay: "300ms" }}>
                            {metrics.map((metric) => (
                                <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
                                    <p className="uppercase tracking-[0.2em] text-white/40">{metric.label}</p>
                                    <p className="mt-2 text-lg font-semibold text-white">{metric.value}</p>
                                    <p className="text-[11px] text-white/50">{metric.note}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative motion-safe:animate-fade-up" style={{ animationDelay: "180ms" }}>
                        <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-gradient-to-tr from-signal/20 via-white/5 to-white/0 blur-2xl" aria-hidden="true" />
                        <Card variant="glass" padding="lg" className="relative">
                            <div className="flex items-start justify-between gap-6 border-b border-white/10 pb-5">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.22em] text-white/50"> Unified performance board
                                    </p>
                                    <p className="mt-2 text-lg font-semibold text-white">Weekly clarity report</p>
                                </div>
                                <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                                    Guardrails green
                                </div>
                            </div>

                            <div className="mt-6 space-y-4 text-sm text-white/70">
                                {[
                                    { title: "Spend drift", detail: "3 ad sets flagged · paused suggestions ready", tone: "text-amber-200" },
                                    { title: "Tracking health", detail: "Event coverage stable · 2 warnings resolved", tone: "text-emerald-200" },
                                    { title: "Creative fatigue", detail: "Top 5 assets refreshed · new draft queued", tone: "text-sky-200" },
                                ].map((item) => (
                                    <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/50">
                                            <span>{item.title}</span>
                                            <span className={item.tone}>Active</span>
                                        </div>
                                        <p className="mt-2 text-sm font-semibold text-white">{item.detail}</p>
                                        <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
                                            <div className="h-full w-[70%] rounded-full bg-gradient-to-r from-emerald-300/70 via-sky-300/70 to-amber-300/70" />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                {[
                                    { label: "Operator focus", value: "High", accent: "from-emerald-300/70 to-sky-200/70" },
                                    { label: "Risk exposure", value: "Low", accent: "from-amber-300/70 to-orange-400/70" },
                                ].map((stat) => (
                                    <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs uppercase tracking-[0.2em] text-white/50">{stat.label}</p>
                                        <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
                                        <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                                            <div className={`h-full w-[65%] rounded-full bg-gradient-to-r ${stat.accent}`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            </Container>
        </Section>
    );
};

export default Hero;
