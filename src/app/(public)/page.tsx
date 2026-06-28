import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { SiMeta } from "react-icons/si";
import { Badge, Button, Card, Container, Section } from "@/components/marketing";
import AdIntelligenceAnimation from "./components/AdIntelligenceAnimation";

const quickWins = [
  { title: "Watch spend", copy: "Waste, fatigue, and lead shifts surface fast.", icon: BellRing },
  { title: "See winners", copy: "Know which ads drive calls, messages, and forms.", icon: BarChart3 },
  { title: "Queue reviews", copy: "Schedule reports and campaign checks anytime.", icon: CalendarCheck },
];

const testStats = [
  { label: "ROI target", value: "3x", tone: "text-emerald-700" },
  { label: "Monitoring", value: "24/7", tone: "text-blue-700" },
  { label: "Ad work", value: "Queued", tone: "text-rose-700" },
];

const flowSteps = ["Connect Meta", "Spot waste", "Review next move", "Approve"];

const ownerMoments = [
  { label: "Morning read", value: "Spend clean", icon: BellRing, tone: "bg-blue-50 text-blue-700" },
  { label: "Creative pulse", value: "+31% leads", icon: BarChart3, tone: "bg-emerald-50 text-emerald-700" },
  { label: "Budget guard", value: "$82 saved", icon: LockKeyhole, tone: "bg-rose-50 text-rose-700" },
  { label: "Next review", value: "Queued", icon: CalendarCheck, tone: "bg-cyan-50 text-cyan-700" },
];

const signalChips = ["Fatigue", "Waste", "Lead shift"];
const queueDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const queueCards = [
  { label: "Creative review", icon: Eye, tone: "bg-blue-50 text-blue-700", floatClass: "dv-queue-float-a" },
  { label: "Owner approval", icon: LockKeyhole, tone: "bg-rose-50 text-rose-700", floatClass: "dv-queue-float-b" },
  { label: "Report ready", icon: FileText, tone: "bg-emerald-50 text-emerald-700", floatClass: "dv-queue-float-c" },
];

const problemAds = [
  {
    page: "Luxe Chair Studio",
    headline: "Color refresh openings",
    image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=640&q=80",
    cta: "Send message",
    floatClass: "dv-meta-ad-float-a",
    heightClass: "md:mt-10",
    imageClass: "h-36 md:h-[22rem]",
  },
  {
    page: "Mirror Room Salon",
    headline: "New client consultation",
    image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=640&q=80",
    cta: "Book now",
    floatClass: "dv-meta-ad-float-b",
    heightClass: "md:-mt-2",
    imageClass: "h-36 md:h-[25rem]",
  },
  {
    page: "Glowline Beauty",
    headline: "Weekend openings",
    image: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=640&q=80",
    cta: "Learn more",
    floatClass: "dv-meta-ad-float-c",
    heightClass: "md:mt-16",
    imageClass: "h-36 md:h-[20rem]",
  },
];

export default function HomePage() {
  return (
    <>
      <SalonHero />
      <ProblemAdFloat />
      <SignalStoryboard />
      <QueueCanvas />
      <QuickValue />
      <MomentumStrip />
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
      className="relative overflow-hidden border-b border-slate-200 bg-[#f7f9fc] py-10 sm:py-14 md:py-16"
      aria-labelledby="salon-hero-title"
    >
      <Container className="relative">
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div className="space-y-6">
            <Badge variant="accent" className="w-fit border-blue-200 bg-white text-blue-700">
              Meta ads for salons
            </Badge>

            <div className="space-y-4">
              <h1
                id="salon-hero-title"
                className="max-w-4xl text-balance text-4xl font-semibold leading-none text-slate-950 sm:text-5xl lg:text-6xl"
              >
                Paid ads made easier.
              </h1>
              <AnimatedGrowthWord />
              <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Connect Meta, catch wasted spend, and approve clearer next steps while working toward 3x ROI.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                asChild
                size="lg"
                variant="primary"
                className="bg-blue-700 text-white shadow-[0_16px_36px_rgba(37,99,235,0.22)]"
              >
                <Link href="/sign-up">
                  Start free test <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="soft" className="bg-white text-slate-900 shadow-sm hover:bg-blue-50">
                <Link href="/features">See how</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-slate-600 hover:bg-white">
                <Link href="/login">Log in</Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {testStats.map((stat, index) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-sm backdrop-blur motion-safe:animate-fade-up"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{stat.label}</p>
                  <p className={`mt-2 text-3xl font-semibold ${stat.tone}`}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <AdIntelligenceAnimation />
        </div>
      </Container>
    </Section>
  );
};

const SignalStoryboard = () => {
  return (
    <Section tone="light" className="overflow-hidden border-b border-blue-100 bg-[#f7fbff] py-8 sm:py-14">
      <Container>
        <div className="grid gap-5 sm:gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div className="space-y-3 sm:space-y-4">
            <Badge variant="accent" className="w-fit border-blue-200 bg-white text-blue-700">
              Signal path
            </Badge>
            <h2 className="max-w-xl text-balance text-2xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              From messy ad motion to one clear queue.
            </h2>
          </div>

          <div className="relative overflow-hidden rounded-[1.5rem] border border-blue-100 bg-white p-3 shadow-[0_18px_48px_rgba(37,99,235,0.1)] sm:min-h-[360px] sm:rounded-[2rem] sm:p-5 sm:shadow-[0_24px_70px_rgba(37,99,235,0.12)]">
            <div className="absolute left-8 right-8 top-1/2 hidden h-1 rounded-full bg-blue-100 md:block" aria-hidden="true" />
            <div className="dv-signal-line absolute left-8 right-8 top-1/2 hidden h-1 origin-left rounded-full bg-blue-600 md:block" aria-hidden="true" />

            <div className="relative grid gap-3 md:grid-cols-3 md:items-center">
              <div className="dv-signal-card rounded-[1.45rem] border border-slate-200 bg-slate-50 p-3 shadow-sm">
                <div className="relative overflow-hidden rounded-[1.1rem]">
                  <img
                    src="https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=90"
                    alt=""
                    className="h-36 w-full object-cover sm:h-52"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-3 top-3 flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
                    <SiMeta className="h-4 w-4 text-blue-700" aria-hidden="true" />
                    <span className="text-xs font-semibold text-slate-950">Meta creative</span>
                  </div>
                </div>
              </div>

              <div className="dv-signal-lens rounded-[1.45rem] border border-blue-100 bg-blue-50 p-3 shadow-sm sm:p-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm sm:h-16 sm:w-16">
                  <Sparkles className="h-5 w-5 sm:h-7 sm:w-7" aria-hidden="true" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-5 sm:grid-cols-1">
                  {signalChips.map((chip) => (
                    <div key={chip} className="rounded-full border border-blue-100 bg-white px-3 py-2 text-center text-xs font-semibold text-blue-700">
                      {chip}
                    </div>
                  ))}
                </div>
                <div className="mt-3 overflow-hidden rounded-full bg-white/80 p-1 shadow-inner sm:mt-4">
                  <div className="dv-signal-lens-progress h-1.5 rounded-full bg-blue-600" />
                </div>
              </div>

              <div className="dv-signal-card-alt rounded-[1.45rem] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="grid gap-2 sm:block sm:space-y-3">
                  {[
                    { label: "Review", icon: Eye },
                    { label: "Report", icon: FileText },
                    { label: "Approve", icon: CheckCircle2 },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className={`dv-signal-action dv-signal-action-${item.label.toLowerCase()} relative flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3`}
                      >
                        <span className="dv-signal-action-icon relative z-10 flex h-9 w-9 items-center justify-center rounded-2xl sm:h-10 sm:w-10">
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                        </span>
                        <span className="relative z-10 text-sm font-semibold text-slate-950">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>

      <style>{`
        .dv-signal-line {
          animation: dv_signal_line 7.6s ease-in-out infinite;
        }

        .dv-signal-card {
          animation: dv_signal_card 6s ease-in-out infinite;
        }

        .dv-signal-lens {
          animation: dv_signal_lens 5.8s ease-in-out infinite;
        }

        .dv-signal-card-alt {
          animation: dv_signal_card_alt 6.2s ease-in-out infinite;
        }

        .dv-signal-lens-progress {
          transform-origin: left;
          animation: dv_signal_lens_progress 7.6s ease-in-out infinite;
        }

        .dv-signal-action::before {
          position: absolute;
          inset: 0;
          z-index: 0;
          content: "";
          background: linear-gradient(90deg, rgba(37, 99, 235, 0.16), rgba(14, 165, 233, 0.08));
          transform: scaleX(0);
          transform-origin: left;
        }

        .dv-signal-action-icon {
          color: #475569;
          background: #e2e8f0;
        }

        .dv-signal-action-review {
          animation: dv_signal_action_state_review 7.6s ease-in-out infinite;
        }

        .dv-signal-action-report {
          animation: dv_signal_action_state_report 7.6s ease-in-out infinite;
        }

        .dv-signal-action-approve {
          animation: dv_signal_action_state_approve 7.6s ease-in-out infinite;
        }

        .dv-signal-action-review::before {
          animation: dv_signal_action_fill_review 7.6s ease-in-out infinite;
        }

        .dv-signal-action-report::before {
          animation: dv_signal_action_fill_report 7.6s ease-in-out infinite;
        }

        .dv-signal-action-approve::before {
          animation: dv_signal_action_fill_approve 7.6s ease-in-out infinite;
        }

        .dv-signal-action-review .dv-signal-action-icon {
          animation: dv_signal_action_icon_review 7.6s ease-in-out infinite;
        }

        .dv-signal-action-report .dv-signal-action-icon {
          animation: dv_signal_action_icon_report 7.6s ease-in-out infinite;
        }

        .dv-signal-action-approve .dv-signal-action-icon {
          animation: dv_signal_action_icon_approve 7.6s ease-in-out infinite;
        }

        @keyframes dv_signal_line {
          0%,
          100% {
            transform: scaleX(0.08);
            opacity: 0.45;
          }

          31% {
            transform: scaleX(0.5);
            opacity: 1;
          }

          74%,
          88% {
            transform: scaleX(1);
            opacity: 1;
          }
        }

        @keyframes dv_signal_lens_progress {
          0%,
          28%,
          100% {
            transform: scaleX(0);
            opacity: 0.45;
          }

          44%,
          88% {
            transform: scaleX(1);
            opacity: 1;
          }
        }

        @keyframes dv_signal_action_fill_review {
          0%,
          42%,
          100% {
            transform: scaleX(0);
          }

          52%,
          88% {
            transform: scaleX(1);
          }
        }

        @keyframes dv_signal_action_fill_report {
          0%,
          54%,
          100% {
            transform: scaleX(0);
          }

          64%,
          88% {
            transform: scaleX(1);
          }
        }

        @keyframes dv_signal_action_fill_approve {
          0%,
          66%,
          100% {
            transform: scaleX(0);
          }

          76%,
          88% {
            transform: scaleX(1);
          }
        }

        @keyframes dv_signal_action_state_review {
          0%,
          47%,
          100% {
            border-color: #e2e8f0;
            background: #f8fafc;
            box-shadow: none;
          }

          52%,
          88% {
            border-color: rgba(37, 99, 235, 0.38);
            background: #eff6ff;
            box-shadow: 0 12px 28px rgba(37, 99, 235, 0.12);
          }
        }

        @keyframes dv_signal_action_state_report {
          0%,
          59%,
          100% {
            border-color: #e2e8f0;
            background: #f8fafc;
            box-shadow: none;
          }

          64%,
          88% {
            border-color: rgba(37, 99, 235, 0.38);
            background: #eff6ff;
            box-shadow: 0 12px 28px rgba(37, 99, 235, 0.12);
          }
        }

        @keyframes dv_signal_action_state_approve {
          0%,
          71%,
          100% {
            border-color: #e2e8f0;
            background: #f8fafc;
            box-shadow: none;
          }

          76%,
          88% {
            border-color: rgba(37, 99, 235, 0.38);
            background: #eff6ff;
            box-shadow: 0 12px 28px rgba(37, 99, 235, 0.12);
          }
        }

        @keyframes dv_signal_action_icon_review {
          0%,
          47%,
          100% {
            color: #475569;
            background: #e2e8f0;
          }

          52%,
          88% {
            color: #ffffff;
            background: #2563eb;
          }
        }

        @keyframes dv_signal_action_icon_report {
          0%,
          59%,
          100% {
            color: #475569;
            background: #e2e8f0;
          }

          64%,
          88% {
            color: #ffffff;
            background: #2563eb;
          }
        }

        @keyframes dv_signal_action_icon_approve {
          0%,
          71%,
          100% {
            color: #475569;
            background: #e2e8f0;
          }

          76%,
          88% {
            color: #ffffff;
            background: #2563eb;
          }
        }

        @keyframes dv_signal_card {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(-0.8deg);
          }

          50% {
            transform: translate3d(0, -8px, 0) rotate(0.4deg);
          }
        }

        @keyframes dv_signal_card_alt {
          0%,
          100% {
            transform: translate3d(0, 4px, 0) rotate(0.6deg);
          }

          50% {
            transform: translate3d(0, -6px, 0) rotate(-0.5deg);
          }
        }

        @keyframes dv_signal_lens {
          0%,
          100% {
            transform: scale(1);
          }

          50% {
            transform: scale(1.035);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dv-signal-line,
          .dv-signal-card,
          .dv-signal-lens,
          .dv-signal-card-alt,
          .dv-signal-lens-progress,
          .dv-signal-action,
          .dv-signal-action::before,
          .dv-signal-action-icon {
            animation: none;
          }

          .dv-signal-lens-progress,
          .dv-signal-action::before {
            transform: scaleX(1);
          }

          .dv-signal-action-icon {
            color: #ffffff;
            background: #2563eb;
          }
        }
      `}</style>
    </Section>
  );
};

const QueueCanvas = () => {
  return (
    <Section tone="light" className="overflow-hidden border-b border-blue-100 bg-white py-8 sm:py-14">
      <Container>
        <div className="grid gap-5 sm:gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-[#f8fbff] p-3 shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:rounded-[2rem] sm:p-5 sm:shadow-[0_24px_70px_rgba(15,23,42,0.1)]">
            <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
              {queueDays.map((day, index) => (
                <div key={day} className="min-h-24 rounded-[1rem] border border-blue-100 bg-white p-1.5 shadow-sm sm:min-h-44 sm:rounded-[1.25rem] sm:p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 sm:text-xs sm:tracking-[0.16em]">{day}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 sm:h-2 sm:w-2" />
                  </div>
                  <div className="mt-3 space-y-1.5 sm:mt-4 sm:space-y-2">
                    <div className="h-8 rounded-xl bg-blue-50 sm:h-14 sm:rounded-2xl" />
                    {index % 2 === 0 ? <div className="h-5 rounded-xl bg-emerald-50 sm:h-10 sm:rounded-2xl" /> : null}
                    {index === 3 ? <div className="h-6 rounded-xl bg-rose-50 sm:h-12 sm:rounded-2xl" /> : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="pointer-events-none absolute inset-4 hidden sm:block">
              {queueCards.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`${item.floatClass} absolute rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_16px_38px_rgba(15,23,42,0.14)] backdrop-blur`}
                    style={{
                      left: `${14 + index * 29}%`,
                      top: `${34 + (index % 2) * 24}%`,
                    }}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.tone}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <Badge variant="accent" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
              Calendar control
            </Badge>
            <h2 className="max-w-xl text-balance text-2xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Reviews land where owners already plan.
            </h2>
          </div>
        </div>
      </Container>

      <style>{`
        .dv-queue-float-a,
        .dv-queue-float-b,
        .dv-queue-float-c {
          animation-duration: 7.4s;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          will-change: transform;
        }

        .dv-queue-float-a {
          animation-name: dv-queue-float-a;
        }

        .dv-queue-float-b {
          animation-name: dv-queue-float-b;
          animation-delay: -1.6s;
        }

        .dv-queue-float-c {
          animation-name: dv-queue-float-c;
          animation-delay: -2.7s;
        }

        @keyframes dv-queue-float-a {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(-1deg);
          }

          50% {
            transform: translate3d(14px, -10px, 0) rotate(0.5deg);
          }
        }

        @keyframes dv-queue-float-b {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(0.5deg);
          }

          50% {
            transform: translate3d(-12px, 12px, 0) rotate(-0.6deg);
          }
        }

        @keyframes dv-queue-float-c {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(0.8deg);
          }

          50% {
            transform: translate3d(10px, -8px, 0) rotate(-0.4deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dv-queue-float-a,
          .dv-queue-float-b,
          .dv-queue-float-c {
            animation: none;
          }
        }
      `}</style>
    </Section>
  );
};

const ProblemAdFloat = () => {
  return (
    <Section tone="light" className="overflow-hidden border-b border-blue-100 bg-white py-8 sm:py-14">
      <Container>
        <div className="grid gap-5 sm:gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div className="space-y-3 sm:space-y-4">
            <Badge variant="accent" className="w-fit border-blue-200 bg-blue-50 text-blue-700">
              Meta creative flow
            </Badge>
            <h2 className="max-w-xl text-balance text-2xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              See what is working before spend drifts.
            </h2>
            <p className="max-w-md text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              Creative, spend, and reviews come into one calmer view.
            </p>
          </div>

          <div className="grid grid-cols-3 items-start gap-2 md:gap-3 lg:gap-5">
            {problemAds.map((ad) => (
              <MetaProblemAd key={ad.page} ad={ad} />
            ))}
          </div>
        </div>
      </Container>

      <style>{`
        .dv-meta-ad-float-a,
        .dv-meta-ad-float-b,
        .dv-meta-ad-float-c {
          animation-duration: 6.8s;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          will-change: transform;
        }

        .dv-meta-ad-float-a {
          animation-name: dv-meta-ad-float-a;
        }

        .dv-meta-ad-float-b {
          animation-name: dv-meta-ad-float-b;
          animation-delay: -1.4s;
        }

        .dv-meta-ad-float-c {
          animation-name: dv-meta-ad-float-c;
          animation-delay: -2.2s;
        }

        @keyframes dv-meta-ad-float-a {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(-1deg);
          }

          50% {
            transform: translate3d(0, -10px, 0) rotate(0.7deg);
          }
        }

        @keyframes dv-meta-ad-float-b {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(0.6deg);
          }

          50% {
            transform: translate3d(0, 12px, 0) rotate(-0.8deg);
          }
        }

        @keyframes dv-meta-ad-float-c {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(1deg);
          }

          50% {
            transform: translate3d(0, -8px, 0) rotate(-0.6deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dv-meta-ad-float-a,
          .dv-meta-ad-float-b,
          .dv-meta-ad-float-c {
            animation: none;
          }
        }
      `}</style>
    </Section>
  );
};

type ProblemAd = (typeof problemAds)[number];

const MetaProblemAd = ({ ad }: { ad: ProblemAd }) => {
  return (
    <article
      className={`${ad.floatClass} ${ad.heightClass} group overflow-hidden rounded-[1rem] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] sm:rounded-[1.6rem] md:shadow-[0_22px_54px_rgba(15,23,42,0.13)]`}
      aria-label={`${ad.page} Meta ad example`}
    >
      <div className="relative">
        <img
          src={ad.image}
          alt=""
          className={`${ad.imageClass} w-full object-cover transition duration-500 group-hover:scale-[1.03]`}
          loading="lazy"
        />
        <div className="absolute left-1.5 top-1.5 flex w-fit items-center justify-between gap-2 rounded-full border border-white/70 bg-white/85 p-1 shadow-sm backdrop-blur sm:inset-x-3 sm:top-3 sm:w-auto sm:rounded-2xl sm:px-3 sm:py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 sm:h-8 sm:w-8">
              <SiMeta className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-xs font-semibold text-slate-950 sm:text-sm">{ad.page}</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-[10px] sm:tracking-[0.14em]">Sponsored</p>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-1.5 bottom-1.5 rounded-xl border border-white/70 bg-white/90 p-1.5 shadow-sm backdrop-blur sm:inset-x-3 sm:bottom-3 sm:rounded-2xl sm:p-3">
          <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-slate-950 sm:text-sm sm:leading-snug">{ad.headline}</p>
          <div className="mt-2 hidden items-center justify-between gap-3 sm:flex">
            <span className="text-[11px] font-semibold text-blue-700 sm:text-xs">{ad.cta}</span>
            <Sparkles className="h-4 w-4 text-blue-600" aria-hidden="true" />
          </div>
        </div>
      </div>
    </article>
  );
};

const AnimatedGrowthWord = () => {
  return (
    <div className="dv-public-welcome" aria-label="Booked">
      {"Booked".split("").map((letter, index) => (
        <span key={`${letter}-${index}`} style={{ "--letter-index": index } as CSSProperties}>
          {letter}
        </span>
      ))}

      <style>{`
        .dv-public-welcome {
          display: flex;
          flex-wrap: wrap;
          gap: 1px;
          font-size: clamp(3.1rem, 8vw, 6.6rem);
          font-weight: 950;
          line-height: 0.84;
          letter-spacing: 0;
        }

        .dv-public-welcome span {
          display: inline-block;
          color: var(--dv-letter-color);
          animation: dv-public-welcome-wave 2.9s ease-in-out infinite;
          animation-delay: calc(var(--letter-index) * 85ms);
          filter: drop-shadow(0 14px 24px rgba(37, 99, 235, 0.1));
        }

        .dv-public-welcome span:nth-child(1) {
          --dv-letter-color: #2563eb;
        }

        .dv-public-welcome span:nth-child(2) {
          --dv-letter-color: #0891b2;
        }

        .dv-public-welcome span:nth-child(3) {
          --dv-letter-color: #059669;
        }

        .dv-public-welcome span:nth-child(4) {
          --dv-letter-color: #e11d48;
        }

        .dv-public-welcome span:nth-child(5) {
          --dv-letter-color: #7c3aed;
        }

        .dv-public-welcome span:nth-child(6) {
          --dv-letter-color: #0f766e;
        }

        @keyframes dv-public-welcome-wave {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }

          45% {
            transform: translateY(-9px) rotate(-1.4deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dv-public-welcome span {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};

const QuickValue = () => {
  return (
    <Section tone="light" id="product-system" className="border-b border-blue-100 py-8 sm:py-14">
      <Container>
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-[0.62fr_1.38fr] lg:items-end">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">What you see</p>
            <h2 className="text-balance text-2xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Less reading. Faster decisions.
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-3 md:gap-4">
            {quickWins.map((item, index) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.title}
                  className="border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card motion-safe:animate-fade-up sm:p-5"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 sm:h-11 sm:w-11">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-slate-950 sm:mt-5 sm:text-lg">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600 sm:mt-2">{item.copy}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </Container>
    </Section>
  );
};

const MomentumStrip = () => {
  return (
    <Section tone="light" className="border-b border-blue-100 bg-white py-8 sm:py-10">
      <Container>
        <div className="grid gap-4 rounded-[1.5rem] border border-blue-100 bg-[#f6fbff] p-4 shadow-sm sm:gap-5 sm:p-5 lg:grid-cols-[0.68fr_1.32fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Daily rhythm</p>
            <h2 className="mt-2 text-balance text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
              A quick pulse before the day gets busy.
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            {ownerMoments.map((moment, index) => {
              const Icon = moment.icon;
              return (
                <div
                  key={moment.label}
                  className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm motion-safe:animate-fade-up sm:p-4"
                  style={{ animationDelay: `${index * 85}ms` }}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-2xl sm:h-10 sm:w-10 ${moment.tone}`}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:mt-3 sm:text-[10px] sm:tracking-[0.16em]">{moment.label}</p>
                  <p className="mt-1 text-base font-semibold text-slate-950 sm:text-lg">{moment.value}</p>
                </div>
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
    <Section tone="muted" id="how-it-works" className="border-b border-blue-100 py-8 sm:py-14">
      <Container>
        <div className="grid gap-5 sm:gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-3 sm:space-y-4">
            <Badge variant="accent" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
              Simple workflow
            </Badge>
            <h2 className="text-balance text-2xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              DeepVisor watches. You approve.
            </h2>
            <p className="max-w-xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              Reports, reviews, spend checks, and action queues run from the calendar.
            </p>
            <Button asChild variant="soft" className="bg-white text-slate-900 shadow-sm hover:bg-blue-50">
              <Link href="/features">Open feature view</Link>
            </Button>
          </div>

          <WorkflowVisual />
        </div>
      </Container>
    </Section>
  );
};

const WorkflowVisual = () => {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm sm:rounded-[2rem] sm:p-5 sm:shadow-card">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {flowSteps.map((step, index) => (
          <div
            key={step}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 motion-safe:animate-fade-up sm:p-4"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-700 text-xs font-semibold text-white sm:h-9 sm:w-9 sm:text-sm">
              {index + 1}
            </span>
            <p className="mt-3 text-sm font-semibold leading-snug text-slate-950 sm:mt-4 sm:text-base">{step}</p>
            <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-emerald-500 sm:right-4 sm:top-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-blue-100 bg-[#f2fbff] p-3 text-slate-950 sm:mt-4 sm:p-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "Spend", value: "$339", icon: Clock3, tone: "text-blue-700" },
            { label: "Results", value: "96", icon: Sparkles, tone: "text-emerald-700" },
            { label: "Approval", value: "Ready", icon: LockKeyhole, tone: "text-rose-700" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-blue-100 bg-white p-2.5 shadow-sm sm:p-4">
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${item.tone}`} aria-hidden="true" />
                <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:mt-3 sm:text-xs sm:tracking-[0.18em]">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 sm:text-2xl">{item.value}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const TestingCTA = () => {
  return (
    <Section
      tone="light"
      id="support"
      className="overflow-hidden border-t border-blue-100 bg-[#eef6ff] py-8 text-slate-950 sm:py-14"
    >
      <Container>
        <div className="grid gap-5 sm:gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div className="space-y-4 sm:space-y-5">
            <Badge variant="accent" className="w-fit border-blue-200 bg-white text-blue-700">
              Salon owner testing
            </Badge>
            <h2 className="text-balance text-2xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Make ads feel less like a second job.
            </h2>
            <p className="max-w-xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              Join the test and help shape the alerts, reports, and approvals.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" variant="primary" className="bg-blue-700 text-white hover:bg-blue-800">
                <Link href="/sign-up">Join free test</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border border-blue-200 bg-white text-blue-700 hover:bg-blue-50">
                <Link href="/login">Existing login</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {[
              { label: "Approval first", icon: LockKeyhole },
              { label: "Reports", icon: FileText },
              { label: "Reviews", icon: CalendarCheck },
              { label: "Spend alerts", icon: Clock3 },
              { label: "Booking focus", icon: Sparkles },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm motion-safe:animate-fade-up sm:p-4"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <Icon className="h-4 w-4 text-blue-700 sm:h-5 sm:w-5" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-slate-950 sm:mt-3 sm:text-base">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </Section>
  );
};
