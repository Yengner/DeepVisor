"use client";

import type { FC } from "react";

const CTA: FC = () => {
    return (
        <section className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#191b20] via-[#0c1018]/70 to-transparent" />
            <div className="mx-auto max-w-6xl px-4 pb-16">
                <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-r from-[#0f111a] via-[#0c1016] to-[#0d0f17] text-white shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
                    <div className="pointer-events-none absolute inset-0">
                        <div className="absolute -left-10 top-[-4rem] h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.35),_transparent_55%)] blur-2xl" />
                        <div className="absolute right-0 top-10 h-44 w-44 rounded-full bg-[radial-gradient(circle,_rgba(96,165,250,0.22),_transparent_50%)] blur-2xl" />
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_45%,rgba(255,255,255,0.08)_100%)] opacity-80" />
                    </div>

                    <div className="relative grid gap-10 px-6 py-10 md:px-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-12">
                        <div className="space-y-6">
                            <p className="text-xs uppercase tracking-[0.22em] text-amber-100/70">
                                Private alpha · shipping weekly
                            </p>

                            <h2 className="text-balance text-3xl font-semibold leading-tight sm:text-4xl">
                                If you run ads and hate chaos, help shape DeepVisor.
                            </h2>

                            <p className="max-w-xl text-sm text-white/75 sm:text-base">
                                We’re building a calm ads operating system: unified reporting, guardrails, and an AI campaign builder
                                that drafts campaigns for approval. Meta-first today, TikTok + Google next. We’re early-stage — funding
                                accelerates development and integrations.
                            </p>

                            <div className="flex flex-wrap items-center gap-3">
                                <button className="rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 px-5 py-3 text-sm font-semibold text-[#1f1305] shadow-[0_12px_35px_rgba(251,191,36,0.35)] transition hover:translate-y-[1px]">
                                    Request alpha access
                                </button>

                                <button className="rounded-full border border-white/30 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/60 hover:bg-white/10">
                                    View roadmap / one-pager
                                </button>

                                <span className="text-xs text-white/70">
                                    Limited spots · hands-on onboarding
                                </span>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {[
                                    "Meta-first dashboard with clean campaign → ad set → ad views.",
                                    "Guardrails: spend drift, CPA spikes, tracking health checks.",
                                    "Draft-first AI campaigns (auto / semi / manual) with approvals.",
                                    "Weekly clarity summary: what changed, what matters, what to do next.",
                                ].map((item) => (
                                    <div
                                        key={item}
                                        className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/80"
                                    >
                                        <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            {[
                                {
                                    label: "Current focus",
                                    value: "Meta",
                                    hint: "Campaign clarity + guardrails",
                                    accent: "from-emerald-300/70 to-sky-200/70",
                                },
                                {
                                    label: "Next integrations",
                                    value: "TikTok + Google",
                                    hint: "Multi-platform roll-out",
                                    accent: "from-amber-300/70 to-orange-500/70",
                                },
                                {
                                    label: "Automation layer",
                                    value: "Draft-first",
                                    hint: "Approvals + human override",
                                    accent: "from-blue-300/70 to-indigo-300/70",
                                },
                                {
                                    label: "Build cadence",
                                    value: "Weekly",
                                    hint: "Transparent roadmap updates",
                                    accent: "from-emerald-200/70 to-amber-200/70",
                                },
                            ].map((stat) => (
                                <div
                                    key={stat.label}
                                    className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.25)]"
                                >
                                    <div
                                        className={`absolute inset-x-0 -top-10 h-24 bg-gradient-to-br ${stat.accent} opacity-50 blur-2xl`}
                                    />
                                    <div className="relative space-y-2">
                                        <p className="text-xs uppercase tracking-[0.18em] text-white/60">{stat.label}</p>
                                        <p className="text-3xl font-semibold text-white">{stat.value}</p>
                                        <p className="text-xs text-white/70">{stat.hint}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};

export default CTA;
