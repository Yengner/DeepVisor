"use client";

import type { FC } from "react";

const channels = [
    { name: "Meta + Instagram (live)", spend: "$18.4k", trend: "+18%", fill: "w-[78%]" },
    { name: "TikTok (planned)", spend: "—", trend: "next", fill: "w-[40%]" },
    { name: "Google Ads (planned)", spend: "—", trend: "next", fill: "w-[32%]" },
];

const quickSignals = [
    { label: "ROAS guardrail", value: "Holding", tone: "text-emerald-200", dot: "bg-emerald-400" },
    { label: "Tracking health", value: "98% clean", tone: "text-amber-200", dot: "bg-amber-300" },
    { label: "Team mood", value: "Calm", tone: "text-sky-200", dot: "bg-sky-300" },
];

const Hero: FC = () => {
    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-[#0b0d12] via-[#0d111a] to-[#090b12] text-white">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-24 top-[-12rem] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,_rgba(255,207,122,0.18),_transparent_60%)] blur-3xl" />
                <div className="absolute right-[-8rem] top-[-8rem] h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.15),_transparent_65%)] blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_35%,rgba(255,255,255,0.02)_65%,rgba(255,255,255,0.04)_100%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.09),_transparent_50%)]" />
            </div>

            <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-24 md:pb-24 md:pt-28">
                <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="space-y-8">
                        <div className="inline-flex max-w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-amber-100/90 backdrop-blur">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_0_6px_rgba(251,191,36,0.15)]" />
                            Private alpha · 2026
                        </div>

                        <div className="space-y-5">
                            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
                                A calm command center for every ad dollar.
                                <span className="block bg-gradient-to-r from-amber-200 via-amber-300 to-orange-400 bg-clip-text text-transparent">
                                    Human, transparent, and ruthless about clarity.
                                </span>
                            </h1>
                            <p className="max-w-2xl text-base text-white/70 sm:text-lg">
                                DeepVisor keeps small teams aligned on performance without drowning in dashboards.
                                We aggregate signal, flag risk, and give you one clean page to act from — not a maze of tabs.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <button className="group relative overflow-hidden rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 px-5 py-3 text-sm font-semibold text-[#1f1305] shadow-[0_14px_45px_rgba(251,191,36,0.35)] transition hover:translate-y-[1px]">
                                <span className="absolute inset-0 bg-white/20 opacity-0 transition group-hover:opacity-20" />
                                <span className="relative">Join early access</span>
                            </button>
                            <button className="rounded-full border border-white/25 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/50 hover:bg-white/10">
                                See the product direction
                            </button>
                            <p className="text-xs text-white/60">
                                2-minute intake · No sales pressure
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-6 text-sm text-white/70">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                Early access is limited (hands-on onboarding)
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-amber-300" />
                                Built for Meta first · TikTok + Google next
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-blue-300" />
                                Draft-first automation with approvals
                            </div>
                        </div>

                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 rounded-[28px] bg-gradient-to-tr from-amber-200/10 via-white/5 to-white/0 blur-2xl" />
                        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur">
                            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.25em] text-white/60">Unified signal board</p>
                                    <p className="text-lg font-semibold text-white">Today’s clarity</p>
                                </div>
                                <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                                    Guardrails OK
                                </div>
                            </div>

                            <div className="grid gap-2 px-6 py-5">
                                {channels.map((channel) => (
                                    <div key={channel.name} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
                                        <div className="flex items-center justify-between text-sm font-semibold">
                                            <span className="text-white">{channel.name}</span>
                                            <span className="text-emerald-200">{channel.trend}</span>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between text-xs text-white/60">
                                            <span>Spend</span>
                                            <span>{channel.spend}</span>
                                        </div>
                                        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                                            <div className={`h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-orange-500 ${channel.fill}`} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid gap-3 border-t border-white/10 px-6 py-4 sm:grid-cols-3">
                                {quickSignals.map((signal) => (
                                    <div key={signal.label} className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
                                        <div className="flex items-center gap-2">
                                            <span className={`h-1.5 w-1.5 rounded-full ${signal.dot}`} />
                                            <span className="uppercase tracking-[0.18em] text-white/50">{signal.label}</span>
                                        </div>
                                        <span className={`text-sm font-semibold ${signal.tone}`}>{signal.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="absolute -left-6 -bottom-10 w-[18rem] rounded-2xl border border-white/10 bg-white/10 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.28)] backdrop-blur">
                            <div className="flex items-center justify-between text-xs text-white/70">
                                <span className="uppercase tracking-[0.22em]">Weekly focus</span>
                                <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                                    Fresh
                                </span>
                            </div>
                            <div className="mt-3 space-y-2">
                                {[
                                    { title: "Trim wasted spend", detail: "7 flagged ad sets across Meta", color: "from-red-400/70 to-amber-200/60" },
                                    { title: "Push TikTok winners", detail: "3 creatives above 1.5 ROAS", color: "from-emerald-300/70 to-sky-200/70" },
                                    { title: "Rebuild Google tracking", detail: "2 accounts need clarity", color: "from-blue-300/60 to-indigo-200/60" },
                                ].map((item) => (
                                    <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                        <p className="text-sm font-semibold text-white">{item.title}</p>
                                        <p className="mt-1 text-xs text-white/70">{item.detail}</p>
                                        <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                                            <div className={`h-full w-[68%] rounded-full bg-gradient-to-r ${item.color}`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
