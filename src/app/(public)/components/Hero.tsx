import type { FC } from "react";
import Link from "next/link";
import { Badge, Button, Card, Container, Section } from "@/components/marketing";

const heroMetrics = [
  {
    label: "Memory",
    value: "Always learning",
    note: "What worked. What failed.",
  },
  {
    label: "Decisions",
    value: "Dashboard + Queue",
    note: "See what matters next.",
  },
  {
    label: "Reports",
    value: "Ready to share",
    note: "Wins, issues, next steps.",
  },
];

const queueItems = [
  { time: "9:00 AM", title: "Approve retargeting budget", tone: "bg-blue-500" },
  { time: "11:30 AM", title: "Refresh prospecting creative", tone: "bg-amber-500" },
  { time: "2:00 PM", title: "Review weak ad set", tone: "bg-rose-500" },
];

const Hero: FC = () => {
  return (
    <Section
      tone="light"
      className="relative overflow-hidden border-b border-border bg-[#f7f9fc] py-12 sm:py-16 md:py-20"
      id="platform"
      aria-labelledby="hero-title"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(37,99,235,0.12),transparent_30%),radial-gradient(circle_at_86%_10%,rgba(52,168,83,0.12),transparent_22%),linear-gradient(180deg,#ffffff_0%,#f7f9fc_72%)]"
        aria-hidden="true"
      />

      <Container className="relative">
        <div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] xl:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-7">
            <Badge variant="accent" className="w-fit">
              Account intelligence system
            </Badge>

            <div className="space-y-5">
              <h1
                id="hero-title"
                className="max-w-4xl text-balance text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-slate-950 sm:text-5xl lg:text-6xl xl:text-[4.25rem]"
              >
                Understand your ad account at a glance
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                DeepVisor studies account history, explains performance, and turns next steps into a clean dashboard, queue, and report flow.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild size="lg" variant="primary">
                <Link href="#support">Request early access</Link>
              </Button>
              <Button asChild size="lg" variant="soft">
                <Link href="#product-system">See the product flow</Link>
              </Button>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Meta today · More platforms next
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {heroMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{metric.value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{metric.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative lg:pl-4">
            <Card className="relative overflow-hidden rounded-[2rem] border-slate-200/80 bg-white/95 p-0 shadow-[0_30px_80px_rgba(15,23,42,0.14)]">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      DeepVisor dashboard
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      My Business · Meta account
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Synced 12 min ago
                  </div>
                </div>
              </div>

              <div className="grid min-h-[540px] gap-0 lg:grid-cols-[0.78fr_1fr]">
                <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r sm:p-6">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Spend", value: "$7.4k", delta: "+9%" },
                      { label: "Leads", value: "248", delta: "+16%" },
                      { label: "Msgs", value: "173", delta: "+15%" },
                      { label: "Issues", value: "3", delta: "Review" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {item.label}
                        </p>
                        <p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                          {item.value}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-emerald-700">{item.delta}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        DeepVisor read
                      </p>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                        Actionable
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-950">
                      Retargeting is strong. Prospecting is soft. One ad set needs new creative.
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-b from-white to-slate-50 p-5 sm:p-6">
                  <div className="h-full rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Queue
                        </p>
                        <p className="text-sm font-semibold text-slate-950">
                          Today
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                        Week
                      </span>
                    </div>

                    <div className="space-y-3 p-4">
                      {queueItems.map((item) => (
                        <div
                          key={item.title}
                          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.tone}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-500">{item.time}</p>
                            <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Best campaign
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">
                          Local Lead Machine
                        </p>
                        <p className="mt-1 text-xs text-slate-500">$25.83 per lead</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Next report
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">
                          Weekly brief
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Wins and next steps</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </Section>
  );
};

export default Hero;