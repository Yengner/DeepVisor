import type { FC } from "react";
import Link from "next/link";
import { Badge, Button, Card, Container, Section } from "@/components/marketing";

const CTA: FC = () => {
    return (
        <Section tone="dark" className="overflow-hidden" id="cta">
            <div className="pointer-events-none absolute inset-0 bg-sheen opacity-40" aria-hidden="true" />
            <Container className="relative">
                <Card variant="dark" padding="lg" className="border-white/10 bg-ink-80 shadow-card-strong">
                    <div className="pointer-events-none absolute inset-0 bg-mesh-glow opacity-70" aria-hidden="true" />
                    <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
                        <div className="space-y-6">
                            <Badge variant="accent" className="w-fit">
                                Supporters · feedback open
                            </Badge>

                            <h2 className="text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl">
                                Help shape DeepVisor with feedback, partnerships, or support.
                            </h2>

                            <p className="max-w-xl text-sm text-white/70 sm:text-base">
                                We&apos;re inviting business owners, operators, and investors to share perspective. Whether you want a quick
                                feedback loop, a pilot conversation, or to back the vision, we&apos;d love to hear from you.
                            </p>

                            <div className="flex flex-wrap items-center gap-3">
                                <Button asChild size="lg" variant="primary">
                                    <Link href="#support">Share your support</Link>
                                </Button>
                                <Button asChild size="lg" variant="outline">
                                    <Link href="#platform">View product overview</Link>
                                </Button>
                                <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                                    Meetings + feedback welcomed
                                </span>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {[
                                    "Investor + operator input shapes the roadmap.",
                                    "Pilot programs for teams running active spend.",
                                    "Advisors welcome: product, growth, and marketing.",
                                    "Support the build or just share feedback.",
                                ].map((item) => (
                                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
                                        <span className="mt-1 h-2 w-2 rounded-full bg-signal" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            {[
                                { label: "Current focus", value: "Meta", hint: "Campaign clarity + guardrails" },
                                { label: "Next integrations", value: "TikTok + Google", hint: "Multi-platform roll-out" },
                                { label: "Automation layer", value: "Draft-first", hint: "Approvals + human override" },
                                { label: "Build cadence", value: "Weekly", hint: "Transparent roadmap updates" },
                            ].map((stat) => (
                                <div key={stat.label} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <div className="absolute inset-x-0 -top-10 h-24 bg-gradient-to-br from-signal/40 via-sky-400/30 to-indigo-400/40 blur-2xl" />
                                    <div className="relative space-y-2">
                                        <p className="text-xs uppercase tracking-[0.18em] text-white/50">{stat.label}</p>
                                        <p className="text-3xl font-semibold text-white">{stat.value}</p>
                                        <p className="text-xs text-white/60">{stat.hint}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            </Container>
        </Section>
    );
};

export default CTA;
