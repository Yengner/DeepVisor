import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Megaphone,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge, Button, Card, Container, Section } from "@/components/marketing";
import AdIntelligenceAnimation from "../components/AdIntelligenceAnimation";

export const metadata: Metadata = {
  title: "Salon Meta Ads Reporting and Recommendations | DeepVisor",
  description:
    "See how DeepVisor helps salon owners understand Facebook and Instagram ad performance, identify wasted spend, schedule reviews, and approve clear next steps.",
  alternates: {
    canonical: "/features",
  },
  openGraph: {
    title: "Salon Meta Ads Reporting and Recommendations | DeepVisor",
    description:
      "Understand salon Meta ad performance, identify wasted spend, and review clear next steps before changes are made.",
    url: "/features",
    type: "website",
  },
};

const decisionBenefits = [
  { title: "Spot weak spend", copy: "Catch spend without booking signal.", icon: TrendingDown, tone: "bg-rose-50 text-rose-700" },
  { title: "Find what works", copy: "Surface stronger offers and creatives.", icon: TrendingUp, tone: "bg-emerald-50 text-emerald-700" },
  { title: "Approve changes", copy: "Stay in control before action.", icon: ShieldCheck, tone: "bg-blue-50 text-blue-700" },
];

const featureRows = [
  { label: "Monitoring", icon: BellRing, color: "text-blue-700" },
  { label: "Next steps", icon: Sparkles, color: "text-rose-600" },
  { label: "Reports", icon: FileText, color: "text-emerald-700" },
  { label: "Scheduled reviews", icon: CalendarClock, color: "text-cyan-700" },
  { label: "Meta first", icon: Megaphone, color: "text-indigo-700" },
  { label: "Owner approvals", icon: ClipboardCheck, color: "text-rose-700" },
];

const roadmap = [
  "Lead quality signals",
  "Creative fatigue",
  "Calendar reviews",
  "ROI reports",
  "Action queues",
  "More platforms",
];

export default function FeaturesPage() {
  return (
    <>
      <FeatureHero />
      <DecisionBenefits />
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
      className="overflow-hidden border-b border-slate-200 bg-[#f7f9fc] py-10 sm:py-14 md:py-16"
    >
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <div className="space-y-6">
            <Badge variant="accent" className="w-fit border-blue-200 bg-blue-50 text-blue-700">
              How it works
            </Badge>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-balance text-4xl font-semibold leading-none text-slate-950 sm:text-5xl lg:text-6xl">
                Watch spend. Grow signal.
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                DeepVisor turns Meta ad noise into visual reads, reports, and approval queues.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                asChild
                size="lg"
                variant="primary"
                className="bg-blue-700 text-white shadow-[0_16px_36px_rgba(37,99,235,0.22)]"
              >
                <Link href="/sign-up">
                  Test free <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="soft" className="bg-white text-slate-900 shadow-sm hover:bg-blue-50">
                <Link href="/">Back home</Link>
              </Button>
            </div>
          </div>

          <AdIntelligenceAnimation />
        </div>
      </Container>
    </Section>
  );
};

const DecisionBenefits = () => {
  return (
    <Section tone="light" id="roi" className="border-b border-blue-100 py-10 sm:py-14">
      <Container>
        <div className="mb-6 max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">ROI levers</p>
          <h2 className="text-balance text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
            Fewer guesses. Cleaner action.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {decisionBenefits.map((lever, index) => {
            const Icon = lever.icon;
            return (
              <Card
                key={lever.title}
                className="border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card motion-safe:animate-fade-up"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${lever.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-950">{lever.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{lever.copy}</p>
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
        <div className="grid gap-8 lg:grid-cols-[0.68fr_1.32fr] lg:items-start">
          <div className="space-y-4">
            <Badge variant="accent" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
              Included
            </Badge>
            <h2 className="text-balance text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              A visual control room for salon ads.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureRows.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.label}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm motion-safe:animate-fade-up"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <Icon className={`h-5 w-5 ${feature.color}`} aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-slate-950">{feature.label}</h3>
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
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Calendar queues</p>
            <h2 className="text-balance text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Reports run when you want answers.
            </h2>
            <p className="max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
              Schedule reviews, see the output, approve the next move.
            </p>
          </div>

          <Card className="border-slate-200 bg-white p-0 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Queue</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Report + review</h3>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Ready
              </span>
            </div>
            <div className="grid gap-0 md:grid-cols-2">
              {[
                { label: "Review", value: "Campaign" },
                { label: "Output", value: "Spend + leads" },
                { label: "Approval", value: "Shift 15%" },
                { label: "Control", value: "Adjust anytime" },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className="border-b border-slate-200 p-5 odd:md:border-r md:[&:nth-last-child(-n+2)]:border-b-0 motion-safe:animate-fade-up"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 p-5">
              <div className="flex items-end gap-2">
                {[36, 64, 52, 92, 58, 104, 78].map((height, index) => (
                  <span
                    key={`${height}-${index}`}
                    className="flex-1 rounded-t-lg bg-blue-600 motion-safe:animate-[dv_feature_bar_2.8s_ease-in-out_infinite]"
                    style={{ height: `${height}px`, animationDelay: `${index * 90}ms` }}
                  />
                ))}
              </div>
            </div>
          </Card>
        </div>
      </Container>

      <style>{`
        @keyframes dv_feature_bar {
          0%, 100% {
            transform: scaleY(0.74);
            opacity: 0.78;
          }

          50% {
            transform: scaleY(1);
            opacity: 1;
          }
        }
      `}</style>
    </Section>
  );
};

const RoadmapCTA = () => {
  return (
    <Section
      tone="light"
      className="overflow-hidden border-t border-blue-100 bg-[#eef6ff] py-10 text-slate-950 sm:py-14"
    >
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div className="space-y-5">
            <Badge variant="accent" className="w-fit border-blue-200 bg-white text-blue-700">
              Built with salon feedback
            </Badge>
            <h2 className="text-balance text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Shape the test version.
            </h2>
            <p className="max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
              Help tune the reports, alerts, and approval flow.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" variant="primary" className="bg-blue-700 text-white hover:bg-blue-800">
                <Link href="/sign-up">Create free account</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border border-blue-200 bg-white text-blue-700 hover:bg-blue-50">
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {roadmap.map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm motion-safe:animate-fade-up"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <p className="font-semibold text-slate-950">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
};
