import type { FC } from "react";
import Link from "next/link";
import { Badge, Button, Card, Container, Section } from "@/components/marketing";

const heroMetrics = [
  {
    label: "Account memory",
    value: "Always building",
    note: "DeepVisor remembers what has worked and what has failed.",
  },
  {
    label: "Decision surface",
    value: "Dashboard + Calendar",
    note: "Know what matters now and what is queued next.",
  },
  {
    label: "Reports",
    value: "Owner-ready",
    note: "Clear wins, weak spots, timelines, and recommendations.",
  },
];

const queueItems = [
  { time: "9:00 AM", title: "Approve retargeting budget hold", tone: "bg-blue-500" },
  { time: "11:30 AM", title: "Refresh broad prospecting creative", tone: "bg-amber-500" },
  { time: "2:00 PM", title: "Review weak ad set recommendation", tone: "bg-rose-500" },
];

const Hero: FC = () => {
  return (
    <Section
      tone="light"
      className="overflow-hidden border-b border-border bg-[#f7f9fc] py-10 sm:py-14 md:py-16"
      id="platform"
      aria-labelledby="hero-title"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(37,99,235,0.10),transparent_30%),radial-gradient(circle_at_86%_10%,rgba(52,168,83,0.10),transparent_22%),linear-gradient(180deg,#ffffff_0%,#f7f9fc_72%)]"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute left-8 top-24 hidden h-40 w-40 rounded-full border border-blue-200/70 md:block" aria-hidden="true" />
      <div className="pointer-events-none absolute right-10 top-28 hidden h-28 w-28 rounded-full border border-emerald-200/80 md:block" aria-hidden="true" />

      <Container className="relative">
        <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <Badge variant="accent" className="w-fit">
              Account intelligence system
            </Badge>

            <div className="space-y-4">
              <h1
                id="hero-title"
                className="max-w-4xl text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl"
              >
                Understand your ad account without living in ad dashboards.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                DeepVisor connects to your ad accounts, studies the history, explains what is strong or weak, and turns the next best moves into a simple dashboard, calendar queue, and reports.
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
                Meta today · Google and TikTok ready for UI preview
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {heroMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{metric.label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{metric.value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{metric.note}</p>
                </div>
              ))}
            </div>
          </div>

          <Card className="border-slate-200 bg-white p-0 shadow-card-strong">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">DeepVisor dashboard</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">My Business · Meta account</p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Synced 12 min ago
                </div>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[0.72fr_1fr]">
              <div className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r sm:p-5">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Spend", value: "$7.4k", delta: "+9%" },
                    { label: "Leads", value: "248", delta: "+16%" },
                    { label: "Messages", value: "173", delta: "+15%" },
                    { label: "Weak spots", value: "3", delta: "Review" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{item.value}</p>
                      <p className="mt-1 text-xs font-semibold text-emerald-700">{item.delta}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">DeepVisor read</p>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                      Actionable
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-950">
                    Retargeting is strong, broad prospecting is softening, and one ad set needs creative rotation.
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Calendar queue</p>
                      <p className="text-sm font-semibold text-slate-950">Today&apos;s planned work</p>
                    </div>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                      Week
                    </span>
                  </div>
                  <div className="space-y-2 p-3">
                    {queueItems.map((item) => (
                      <div key={item.title} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.tone}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-500">{item.time}</p>
                          <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Strongest campaign</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">Local Lead Machine</p>
                    <p className="mt-1 text-xs text-slate-500">$25.83 per lead</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Next report</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">Weekly brief ready</p>
                    <p className="mt-1 text-xs text-slate-500">Wins, misses, timeline</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </Container>
    </Section>
  );
};

export default Hero;
