import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  FileText,
  Megaphone,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge, Button, Card, Container, Section } from "@/components/marketing";

export const metadata: Metadata = {
  title: "How DeepVisor Makes Salon Paid Ads Easier",
  description:
    "See how DeepVisor makes running salon paid ads easier by reducing wasted Meta spend, monitoring campaigns, sending reports, and simplifying next-step approvals.",
};

const roiLevers = [
  {
    title: "Make the daily ad work simpler",
    copy: "DeepVisor watches high-cost leads, weak boosted posts, creative fatigue, and campaigns spending without enough booking intent.",
    icon: TrendingDown,
  },
  {
    title: "Make the next move obvious",
    copy: "When a treatment, service, offer, audience, or retargeting campaign starts producing better signal, DeepVisor explains what to do next.",
    icon: TrendingUp,
  },
  {
    title: "Keep approval in your hands",
    copy: "The product is built around recommendations and approval, so running paid ads is easier without losing control.",
    icon: ShieldCheck,
  },
];

const featureRows = [
  { label: "24/7 ad monitoring", detail: "Watch spend, leads, and performance movement even when you are with clients.", icon: BellRing },
  { label: "Plain next steps", detail: "Turn confusing ad performance into simple recommendations you can approve or ignore.", icon: Sparkles },
  { label: "Salon-ready reports", detail: "Get plain-language summaries of what worked, what wasted spend, and what to do next.", icon: FileText },
  { label: "Campaign calendar", detail: "Turn checks, reports, and recommendations into scheduled work instead of scattered notes.", icon: CalendarClock },
  { label: "Meta first", detail: "Testing starts with Facebook and Instagram ads because that is where many salons already spend.", icon: Megaphone },
  { label: "Owner approvals", detail: "Review next steps before any serious ad account action moves forward.", icon: ClipboardCheck },
  { label: "Agency-price alternative", detail: "DeepVisor is being shaped as software support for owners who cannot justify a full agency retainer.", icon: DollarSign },
];

const roadmap = [
  "Better lead-quality signals for calls, forms, and messages",
  "Creative fatigue and offer testing recommendations",
  "Weekly and monthly ROI reporting",
  "Simpler paid-ad approvals and action queues",
  "More ad platform integrations after Meta",
];

export default function FeaturesPage() {
  return (
    <>
      <FeatureHero />
      <RoiLevers />
      <FeatureGrid />
      <ReportDemo />
      <RoadmapCTA />
    </>
  );
}

const FeatureHero = () => {
  return (
    <Section
      tone="light"
      className="overflow-hidden border-b border-blue-100 bg-[linear-gradient(135deg,#ffffff_0%,#f4f8ff_52%,#f4fbf7_100%)] py-10 sm:py-14 md:py-16"
    >
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-6">
            <Badge variant="accent" className="w-fit border-blue-200 bg-blue-50 text-blue-700">
              How DeepVisor makes paid ads easier
            </Badge>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-balance text-4xl font-semibold leading-none text-slate-950 sm:text-5xl lg:text-6xl">
                Running paid ads gets easier when DeepVisor watches the details.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                DeepVisor is being tested with salon owners as a practical way to
                simplify Meta ad management, explain performance, and recommend the
                next move without making you pay agency prices.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                asChild
                size="lg"
                variant="primary"
                className="from-blue-600 via-blue-500 to-emerald-500 text-white shadow-[0_16px_36px_rgba(37,99,235,0.22)]"
              >
                <Link href="/sign-up">
                  Test DeepVisor free <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="soft" className="bg-white text-slate-900 shadow-sm hover:bg-blue-50">
                <Link href="/">Back to overview</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">ROI model</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">3x target path</h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <BarChart3 className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {[
                { label: "Spend protected", value: "Find waste", tone: "bg-amber-500", width: "w-[52%]" },
                { label: "Signal improved", value: "Book stronger leads", tone: "bg-blue-500", width: "w-[74%]" },
                { label: "ROI target", value: "Work toward 3x", tone: "bg-emerald-500", width: "w-[90%]" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="text-slate-950">{item.value}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div className={`h-full rounded-full ${item.tone} ${item.width} motion-safe:animate-[roi-fill_1.9s_ease-out_both]`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
      <style>{`
        @keyframes roi-fill {
          from {
            transform: scaleX(0.24);
            transform-origin: left;
          }

          to {
            transform: scaleX(1);
            transform-origin: left;
          }
        }
      `}</style>
    </Section>
  );
};

const RoiLevers = () => {
  return (
    <Section tone="light" id="roi" className="border-b border-blue-100 py-10 sm:py-14">
      <Container>
        <div className="mb-6 max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">The ROI levers</p>
          <h2 className="text-balance text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
            DeepVisor improves return by making the few things that move salon ads easier to manage.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {roiLevers.map((lever) => {
            const Icon = lever.icon;
            return (
              <Card key={lever.title} className="border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-950">{lever.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{lever.copy}</p>
              </Card>
            );
          })}
        </div>
      </Container>
    </Section>
  );
};

const FeatureGrid = () => {
  return (
    <Section tone="muted" id="features" className="border-b border-blue-100 py-10 sm:py-14">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.74fr_1.26fr] lg:items-start">
          <div className="space-y-4">
            <Badge variant="accent" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
              What is included
            </Badge>
            <h2 className="text-balance text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Everything is built around making paid ads less time-consuming for salon owners.
            </h2>
            <p className="text-sm leading-7 text-slate-600 sm:text-base">
              The testing version focuses on clear reads, useful reporting, and
              approval-based recommendations. The long-term product will expand into
              deeper automation, more platforms, and stronger lead quality context so
              paid ads keep getting easier to run.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {featureRows.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-slate-950">{feature.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{feature.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </Section>
  );
};

const ReportDemo = () => {
  return (
    <Section tone="light" id="reports" className="border-b border-blue-100 py-10 sm:py-14">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reports without the agency meeting</p>
            <h2 className="text-balance text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              The report should tell you where the money went and make the next ad decision easier.
            </h2>
            <p className="text-sm leading-7 text-slate-600 sm:text-base">
              Instead of waiting for a monthly call or digging through Ads Manager,
              salon owners should be able to see which ads created booking signal,
              where spend was wasted, and which next steps need approval.
            </p>
          </div>

          <Card className="border-slate-200 bg-white p-0 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Weekly salon report</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Bookings, spend, and next steps</h3>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Ready
              </span>
            </div>
            <div className="grid gap-0 md:grid-cols-2">
              {[
                { label: "Best signal", value: "Retargeting color clients", note: "Healthier booking intent and lower lead cost." },
                { label: "Waste risk", value: "Boosted broad promo", note: "Spend rose while quality softened." },
                { label: "Next approval", value: "Shift 15% budget", note: "Move budget toward the better signal." },
                { label: "Owner note", value: "Review this week", note: "Clear enough to act without an agency call." },
              ].map((item) => (
                <div key={item.label} className="border-b border-slate-200 p-5 odd:md:border-r md:[&:nth-last-child(-n+2)]:border-b-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{item.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Container>
    </Section>
  );
};

const RoadmapCTA = () => {
  return (
    <Section
      tone="light"
      className="overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#12315f_48%,#0f766e_100%)] py-10 text-white sm:py-14"
    >
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-5">
            <Badge variant="dark" className="w-fit border-white/20 bg-white/10 text-white/80">
              Built in public with salon feedback
            </Badge>
            <h2 className="text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl">
              The testing phase is where salon owners shape the product.
            </h2>
            <p className="text-sm leading-7 text-white/70 sm:text-base">
              DeepVisor is not promising magic. It is building a tighter system for
              protecting spend, explaining performance, and making paid-ad decisions
              easier to understand and approve.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" variant="primary" className="from-signal via-amber-400 to-emerald-400 text-slate-950">
                <Link href="/sign-up">Create free test account</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {roadmap.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" aria-hidden="true" />
                <p className="font-semibold text-white">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
};
