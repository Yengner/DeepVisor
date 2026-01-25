// src/app/option-c-demo/page.tsx
import type { FC } from "react";

const OptionCHeroDemo: FC = () => {
    return (
        <main className="min-h-screen bg-background text-foreground">
            {/* Page shell */}
            <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pb-16 pt-10 md:pt-16">
                {/* Top nav placeholder */}
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">
                            <span className="text-xs font-semibold tracking-tight">
                                DV
                            </span>
                        </div>
                        <span className="text-sm font-medium tracking-tight">
                            DeepVisor
                        </span>
                    </div>

                    <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
                        <button className="hover:text-foreground">Product</button>
                        <button className="hover:text-foreground">For Businesses</button>
                        <button className="hover:text-foreground">For Investors</button>
                        <button className="rounded-full border border-border px-3 py-1 text-xs hover:bg-secondary">
                            Join Early Access
                        </button>
                    </nav>
                </header>

                {/* HERO */}
                <section className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-center">
                    <div className="space-y-6">
                        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                            Early-stage project · Not selling anything yet
                        </p>

                        <div className="space-y-3">
                            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                                Making digital ads less confusing
                                <span className="block text-muted-foreground">
                                    for small businesses.
                                </span>
                            </h1>
                            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
                                DeepVisor is exploring a simpler way to understand and manage
                                ads across platforms like Meta, Instagram, TikTok, and Google.
                                We&apos;re in research mode and looking for honest feedback,
                                not sales.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            <button className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90">
                                Join early access
                            </button>
                            <button className="rounded-full border border-border bg-secondary px-5 py-2.5 text-sm font-medium text-secondary-foreground hover:bg-muted">
                                Share feedback (1–2 min)
                            </button>
                            <p className="text-xs text-muted-foreground">
                                No spam. No sales. Just learning.
                            </p>
                        </div>
                    </div>

                    {/* Right: simple “analytics” style card */}
                    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xs font-medium text-muted-foreground">
                                Example dashboard preview
                            </h2>
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Concept only
                            </span>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5">
                                <div className="space-y-0.5">
                                    <p className="text-xs text-muted-foreground">
                                        Monthly ad spend (all platforms)
                                    </p>
                                    <p className="text-lg font-semibold tracking-tight">
                                        $4,300
                                    </p>
                                </div>
                                <span className="text-xs font-medium text-emerald-600">
                                    +18.2%
                                </span>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Example metrics
                                </p>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    <MetricCard label="Leads" value="126" change="+12.4%" />
                                    <MetricCard label="CTR" value="3.8%" change="+0.6%" />
                                    <MetricCard label="CPA" value="$34.10" change="-9.1%" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Platforms (sample)
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {["Meta", "Instagram", "TikTok", "Google Ads"].map((p) => (
                                        <span
                                            key={p}
                                            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                                        >
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <p className="pt-1 text-[11px] text-muted-foreground">
                                This is a concept preview to show the visual style. Actual data
                                and features will be shaped by feedback from early businesses
                                and supporters.
                            </p>
                        </div>
                    </div>
                </section>

                {/* WHAT WE'RE EXPLORING */}
                <section className="space-y-5 border-t border-border pt-8">
                    <div className="space-y-2">
                        <h2 className="text-lg font-semibold tracking-tight">
                            What DeepVisor is exploring
                        </h2>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            We&apos;re not selling a finished product. We&apos;re talking to
                            business owners to understand what actually makes ads hard, and
                            what would make things meaningfully easier.
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <ExplorationCard
                            title="Clarity across platforms"
                            body="Seeing key numbers from Meta, Instagram, TikTok, and Google Ads in one, organized place instead of bouncing between tabs."
                        />
                        <ExplorationCard
                            title="Guided ad setup"
                            body="Reducing confusing steps and language so setting up a campaign feels like answering normal questions, not a certification exam."
                        />
                        <ExplorationCard
                            title="More transparency"
                            body="Helping small businesses feel in control of their budget and results, whether they run ads themselves or work with an agency."
                        />
                    </div>
                </section>
            </div>
        </main>
    );
};

const MetricCard: FC<{ label: string; value: string; change: string }> = ({
    label,
    value,
    change,
}) => {
    const isNegative = change.trim().startsWith("-");
    return (
        <div className="rounded-xl border border-border bg-secondary px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold">{value}</p>
            <p
                className={`text-[11px] ${isNegative ? "text-red-500" : "text-emerald-600"
                    }`}
            >
                {change}
            </p>
        </div>
    );
};

const ExplorationCard: FC<{ title: string; body: string }> = ({
    title,
    body,
}) => (
    <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
);

export default OptionCHeroDemo;
