import { Activity, BellRing, ChartLine, Radar, ShieldCheck, Sparkles } from "lucide-react";
import CTA from "./components/CTA";
import Hero from "./components/Hero";
import { Badge, Button, Card, Container, Section } from "@/components/marketing";

const SUPPORT_FORM_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSdxmbkyvBibl1imDI5SNooRLFlPhEEwqq-yJ-H23MJESZSbpw/viewform?usp=dialog";

const logos = ["Northwind Labs", "Helios Group", "Vector Studios", "Signalworks", "Apex Commerce", "Juniper Health"];

const features = [
    {
        title: "Unified signal view",
        description: "Bring Meta, TikTok, and Google into one calm command board with consistent KPIs.",
        icon: Radar,
    },
    {
        title: "Guardrails that hold",
        description: "Auto-detect spend drift, CPA spikes, and tracking gaps before they derail performance.",
        icon: ShieldCheck,
    },
    {
        title: "Draft-first automation",
        description: "AI drafts campaigns and optimizations for review, with approvals baked in.",
        icon: Sparkles,
    },
    {
        title: "Executive-ready reporting",
        description: "One summary view that keeps leadership aligned without endless slide decks.",
        icon: ChartLine,
    },
    {
        title: "Operational calm",
        description: "Weekly clarity reports highlight what changed and what actions matter most.",
        icon: Activity,
    },
    {
        title: "Real-time alerts",
        description: "Signal feed surfaces urgent changes with context, not noise.",
        icon: BellRing,
    },
];

const outcomes = [
    { label: "Hours saved weekly", value: "6–10", note: "Fewer dashboards + auto summaries" },
    { label: "Guardrail coverage", value: "90%+", note: "Spend, CPA, tracking health" },
    { label: "Actionable insights", value: "3x", note: "Cleaner prioritization" },
];

const steps = [
    {
        title: "Connect your channels",
        copy: "Securely link Meta today, with TikTok + Google next. We normalize data into a single baseline.",
        tag: "Day 1",
    },
    {
        title: "Set guardrails + goals",
        copy: "Define CPA, budget, and pacing thresholds. DeepVisor keeps performance inside your boundaries.",
        tag: "Week 1",
    },
    {
        title: "Approve the automation",
        copy: "Review AI-generated optimizations before they ship. Keep human oversight by default.",
        tag: "Week 2+",
    },
];

const useCases = [
    {
        title: "Multi-location brands",
        description: "See performance across regions without drowning in ad account noise.",
        bullets: ["Location rollups", "Region guardrails", "Unified scorecards"],
    },
    {
        title: "Performance agencies",
        description: "Monitor client health at scale with consistent reporting and alerting.",
        bullets: ["Client dashboards", "Approval workflows", "Signal-based alerts"],
    },
    {
        title: "DTC growth teams",
        description: "Track creative fatigue, budget shifts, and ROAS in one place.",
        bullets: ["Creative insights", "Spend drift alerts", "A/B test tracking"],
    },
    {
        title: "Lead-gen operators",
        description: "Tie campaigns to pipeline outcomes and guardrail CPA changes.",
        bullets: ["CPA tracking", "Lead quality tags", "Rapid adjustments"],
    },
    {
        title: "Founder-led marketing",
        description: "Make fast decisions without hiring an analyst first.",
        bullets: ["Simple summaries", "Priority cues", "Weekly report"],
    },
    {
        title: "Enterprise pilots",
        description: "Run controlled experiments with approvals and audit trails.",
        bullets: ["Approval logs", "Change history", "Role-based access"],
    },
];


export default function HomePage() {
    return (
        <>
            <Hero />
            <SocialProof />
            <FeatureGrid />
            <OutcomesSection />
            <HowItWorks />
            <UseCases />
            <SupportSection />
            <CTA />
        </>
    );
}

const SocialProof = () => {
    return (
        <Section tone="light" spacing="tight" className="border-b border-border">
            <Container className="flex flex-col gap-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Trusted by teams that run real spend
                        </p>
                        <h2 className="text-2xl font-semibold text-foreground">Supporters across growth, agency, and enterprise pilots</h2>
                    </div>
                    <Badge>Support cohort · 2026</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm font-semibold uppercase tracking-[0.2em] text-foreground/60 sm:grid-cols-3 lg:grid-cols-6">
                    {logos.map((logo) => (
                        <div key={logo} className="rounded-2xl border border-border bg-white px-4 py-3 text-center">
                            {logo}
                        </div>
                    ))}
                </div>
            </Container>
        </Section>
    );
};

const FeatureGrid = () => {
    return (
        <Section tone="gradient">
            <Container>
                <div className="flex flex-col gap-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Platform capabilities
                    </p>
                    <h2 className="text-balance text-3xl font-semibold text-foreground sm:text-4xl">
                        Enterprise clarity without enterprise chaos
                    </h2>
                    <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
                        A modern operating layer for ad teams: clean data, visible risk, and automation that respects approvals.
                    </p>
                </div>

                <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature) => {
                        const Icon = feature.icon;
                        return (
                            <Card key={feature.title} className="group border-border bg-white/80 p-6 shadow-card transition hover:-translate-y-1">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal/10 text-signal">
                                    <Icon className="h-6 w-6" aria-hidden="true" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-foreground">{feature.title}</h3>
                                <p className="mt-3 text-sm text-muted-foreground">{feature.description}</p>
                            </Card>
                        );
                    })}
                </div>
            </Container>
        </Section>
    );
};

const OutcomesSection = () => {
    return (
        <Section tone="light" id="outcomes">
            <Container>
                <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                    <div className="space-y-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Outcomes that leadership understands
                        </p>
                        <h2 className="text-balance text-3xl font-semibold text-foreground sm:text-4xl">
                            Get to clarity fast, then protect it with guardrails.
                        </h2>
                        <p className="text-sm text-muted-foreground sm:text-base">
                            DeepVisor prioritizes signal over noise. Every week, the system highlights what changed, what it means, and what to do next — before spend slips or tracking breaks.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-3">
                            {outcomes.map((outcome) => (
                                <Card key={outcome.label} className="border-border bg-white p-5">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{outcome.label}</p>
                                    <p className="mt-3 text-3xl font-semibold text-foreground">{outcome.value}</p>
                                    <p className="mt-2 text-xs text-muted-foreground">{outcome.note}</p>
                                </Card>
                            ))}
                        </div>
                    </div>

                    <Card className="border-border bg-white p-6">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Signal digest</p>
                            <Badge variant="accent">Low chaos</Badge>
                        </div>
                        <div className="mt-5 space-y-4 text-sm">
                            {[
                                { title: "Spend drift detected", detail: "Paused auto-suggested reallocations for 2 ad sets." },
                                { title: "Tracking stabilized", detail: "Event coverage back to 98% after pixel repair." },
                                { title: "Creative fatigue fading", detail: "3 refreshed assets now outperforming by 14%." },
                            ].map((item) => (
                                <div key={item.title} className="rounded-2xl border border-border bg-cloud/80 p-4">
                                    <p className="font-semibold text-foreground">{item.title}</p>
                                    <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </Container>
        </Section>
    );
};

const HowItWorks = () => {
    return (
        <Section tone="dark" id="how-it-works">
            <Container>
                <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                    <div className="space-y-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">How it works</p>
                        <h2 className="text-balance text-3xl font-semibold text-white sm:text-4xl">
                            A guided flow from connection to confident action.
                        </h2>
                        <p className="text-sm text-white/70 sm:text-base">
                            DeepVisor starts with trust: we ingest data safely, define guardrails, and then unlock draft-first automation with approvals.
                        </p>
                        <div className="space-y-4">
                            {steps.map((step, index) => (
                                <div key={step.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                    <div className="flex items-start gap-4">
                                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white">
                                            0{index + 1}
                                        </span>
                                        <div className="space-y-2">
                                            <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                                            <p className="text-sm text-white/70">{step.copy}</p>
                                            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                                                {step.tag}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Card variant="glass" padding="lg" className="relative">
                        <div className="absolute inset-0 bg-sheen opacity-50" aria-hidden="true" />
                        <div className="relative space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">Product mock</p>
                                    <p className="text-lg font-semibold text-white">Execution cockpit</p>
                                </div>
                                <Badge variant="success">Live preview</Badge>
                            </div>
                            <div className="grid gap-3">
                                {[
                                    { title: "Performance guardrails", value: "Stable", tone: "text-emerald-200" },
                                    { title: "Automation drafts", value: "3 pending", tone: "text-amber-200" },
                                    { title: "Tracking health", value: "98% clean", tone: "text-sky-200" },
                                ].map((item) => (
                                    <div key={item.title} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                        <p className="text-sm text-white/70">{item.title}</p>
                                        <p className={`text-sm font-semibold ${item.tone}`}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Campaign pacing</p>
                                <div className="mt-4 h-2 w-full rounded-full bg-white/10">
                                    <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-emerald-300/70 via-sky-300/70 to-amber-300/70" />
                                </div>
                                <p className="mt-3 text-xs text-white/60">Across 18 active campaigns</p>
                            </div>
                        </div>
                    </Card>
                </div>
            </Container>
        </Section>
    );
};

const UseCases = () => {
    return (
        <Section tone="light" id="use-cases">
            <Container>
                <div className="flex flex-col gap-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Use cases</p>
                    <h2 className="text-balance text-3xl font-semibold text-foreground sm:text-4xl">
                        Built for teams who need fast answers and calm execution.
                    </h2>
                    <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
                        Whether you&apos;re an agency or a founder-led team, DeepVisor keeps performance visible without the noise.
                    </p>
                </div>

                <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {useCases.map((useCase) => (
                        <Card key={useCase.title} className="border-border bg-white p-6">
                            <h3 className="text-lg font-semibold text-foreground">{useCase.title}</h3>
                            <p className="mt-2 text-sm text-muted-foreground">{useCase.description}</p>
                            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                                {useCase.bullets.map((bullet) => (
                                    <div key={bullet} className="flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                                        <span>{bullet}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            </Container>
        </Section>
    );
};

const SupportSection = () => {
    return (
        <Section tone="gradient" id="support">
            <Container>
                <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Support DeepVisor
                    </p>
                    <h2 className="text-balance text-3xl font-semibold text-foreground sm:text-4xl">
                        Share your perspective or interest in supporting the build.
                    </h2>
                    <p className="text-sm text-muted-foreground sm:text-base">
                        We&apos;re gathering feedback from business owners, operators, and investors. If you want to support, advise, or
                        explore a pilot, we&apos;d love to learn from you.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Button asChild size="lg" variant="primary">
                            <a href={SUPPORT_FORM_URL} target="_blank" rel="noreferrer">
                                Submit support form
                            </a>
                        </Button>
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            3–5 minutes · no pressure
                        </span>
                    </div>
                </div>
            </Container>
        </Section>
    );
};
