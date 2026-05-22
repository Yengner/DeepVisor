import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileText,
  LockKeyhole,
  Scissors,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Badge, Button, Card, Container, Section } from "@/components/marketing";

const quickWins = [
  {
    title: "Make paid ads easier",
    copy: "DeepVisor turns the daily ad work into clear alerts, recommendations, and approvals instead of another platform to babysit.",
    icon: BellRing,
  },
  {
    title: "Know what to do next",
    copy: "See which Meta ads are driving bookings, messages, calls, and lead forms, plus the next move to make.",
    icon: BarChart3,
  },
  {
    title: "Use the ad-work calendar",
    copy: "Schedule reports, campaign reviews, spend checks, and other queues whenever you want DeepVisor to run them.",
    icon: CalendarCheck,
  },
];

const testStats = [
  { label: "ROI target", value: "3x", note: "Built to help salons move toward stronger return from ad spend." },
  { label: "Monitoring", value: "24/7", note: "Always-on ad account watch for waste, fatigue, and lead shifts." },
  { label: "Ad calendar", value: "Queued", note: "Schedule reports, campaign reviews, and follow-up checks when you want them." },
];

const flowSteps = [
  "Connect Meta",
  "Schedule reports and reviews",
  "Waste and winners surface",
  "You approve next steps",
];

export default function HomePage() {
  return (
    <>
      <SalonHero />
      <QuickValue />
      <HowItWorks />
      <TestingCTA />
    </>
  );
}

const SalonHero = () => {
  return (
    <Section
      tone="light"
      id="top"
      className="relative overflow-hidden border-b border-blue-100 bg-[#f8fbff] py-10 sm:py-14 md:py-16"
      aria-labelledby="salon-hero-title"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(37,99,235,0.11),transparent_28%),linear-gradient(225deg,rgba(16,185,129,0.10),transparent_24%),linear-gradient(180deg,#ffffff_0%,#f7fbff_70%,#f8fbf7_100%)]"
        aria-hidden="true"
      />

      <Container className="relative">
        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="space-y-6">
            <Badge variant="accent" className="w-fit border-blue-200 bg-blue-50 text-blue-700">
              Testing now with salon owners
            </Badge>

            <div className="space-y-4">
              <h1
                id="salon-hero-title"
                className="max-w-4xl text-balance text-4xl font-semibold leading-none text-slate-950 sm:text-5xl lg:text-6xl"
              >
                Make running salon paid ads easier while working toward 3x ROI.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                DeepVisor connects to your Meta ads, monitors spend around the clock,
                explains what is helping or hurting bookings, and turns paid-ad
                management into calendar queues, reports, and simple next steps you
                can approve.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                asChild
                size="lg"
                variant="primary"
                className="from-blue-600 via-blue-500 to-emerald-500 text-white shadow-[0_16px_36px_rgba(37,99,235,0.22)]"
              >
                <Link href="/sign-up">
                  Start free test <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="soft" className="bg-white text-slate-900 shadow-sm hover:bg-blue-50">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-slate-600 hover:bg-white">
                <Link href="/features">How ROI improves</Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {testStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-sm backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{stat.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{stat.value}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{stat.note}</p>
                </div>
              ))}
            </div>
          </div>

          <SalonSignalBoard />
        </div>
      </Container>
    </Section>
  );
};

const SalonSignalBoard = () => {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="motion-safe:animate-float-slow rounded-[2rem] border border-slate-200 bg-white/95 p-4 shadow-[0_28px_80px_rgba(15,23,42,0.14)] backdrop-blur sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white">
              <Scissors className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">DeepVisor watch</p>
              <h2 className="text-xl font-semibold text-slate-950">Salon Meta account</h2>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
            Live test
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[0.88fr_1.12fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Current read</p>
            <div className="mt-4 space-y-4">
              {[
                { label: "Retargeting bookings", value: "Healthy", width: "w-[86%]", tone: "bg-emerald-500" },
                { label: "Color service leads", value: "Rising", width: "w-[72%]", tone: "bg-blue-500" },
                { label: "Broad boost spend", value: "Waste risk", width: "w-[44%]", tone: "bg-amber-500" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="text-slate-950">{item.value}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                    <div className={`h-full rounded-full ${item.tone} ${item.width} motion-safe:animate-[signal-fill_1.9s_ease-out_both]`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {[
              { title: "Cut weak boosted-post spend", meta: "Potential waste found", icon: ShieldCheck },
              { title: "Move budget toward rebooking offer", meta: "Better booking signal", icon: TrendingUp },
              { title: "Run Friday campaign review", meta: "Calendar queue ready", icon: CalendarCheck },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{item.meta}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes signal-fill {
          from {
            transform: scaleX(0.28);
            transform-origin: left;
          }

          to {
            transform: scaleX(1);
            transform-origin: left;
          }
        }
      `}</style>
    </div>
  );
};

const QuickValue = () => {
  return (
    <Section tone="light" id="product-system" className="border-b border-blue-100 py-10 sm:py-14">
      <Container>
        <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Paid ads, made easier</p>
            <h2 className="text-balance text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Your salon gets a practical paid-ad co-pilot, not another dashboard to manage.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {quickWins.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.copy}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </Container>
    </Section>
  );
};

const HowItWorks = () => {
  return (
    <Section tone="muted" id="how-it-works" className="border-b border-blue-100 py-10 sm:py-14">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-4">
            <Badge variant="accent" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
              Simple salon workflow
            </Badge>
            <h2 className="text-balance text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              DeepVisor makes paid-ad decisions easier, then asks before anything changes.
            </h2>
            <p className="text-sm leading-7 text-slate-600 sm:text-base">
              The product is currently in testing. The goal is to help salon owners
              run paid ads with agency-level visibility and recommendations without
              agency pricing or daily platform babysitting. The calendar is where
              you can schedule reports, campaign reviews, spend checks, and other
              queues whenever you want DeepVisor to work.
            </p>
            <Button asChild variant="soft" className="bg-white text-slate-900 shadow-sm hover:bg-blue-50">
              <Link href="/features">See the full feature plan</Link>
            </Button>
          </div>

          <div className="grid gap-3">
            {flowSteps.map((step, index) => (
              <div
                key={step}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm motion-safe:animate-fade-up"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <p className="font-semibold text-slate-950">{step}</p>
                <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-500" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
};

const TestingCTA = () => {
  return (
    <Section
      tone="light"
      id="support"
      className="overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#12315f_48%,#0f766e_100%)] py-10 text-white sm:py-14"
    >
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div className="space-y-5">
            <Badge variant="dark" className="w-fit border-white/20 bg-white/10 text-white/80">
              Salon owner testing
            </Badge>
            <h2 className="text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Want running your salon ads to feel less like a second job?
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
              Create an account, connect Meta when ready, and help shape the exact
              reports, alerts, and approval flow that makes paid ads easier for salon owners.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" variant="primary" className="from-signal via-amber-400 to-emerald-400 text-slate-950">
                <Link href="/sign-up">Join the free test</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Existing login</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Approval first", icon: LockKeyhole },
              { label: "Reports + reviews", icon: FileText },
              { label: "Calendar queues", icon: CalendarCheck },
              { label: "Spend alerts", icon: Clock3 },
              { label: "Booking focus", icon: Sparkles },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <Icon className="h-5 w-5 text-amber-300" aria-hidden="true" />
                  <p className="mt-3 font-semibold text-white">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </Section>
  );
};
