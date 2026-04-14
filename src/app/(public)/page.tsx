import {
  Activity,
  CalendarDays,
  Database,
  FileText,
  Layers,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import CTA from "./components/CTA";
import Hero from "./components/Hero";
import IntegrationsSection from "./components/IntegrationsSection";
import { Badge, Button, Card, Container, Section } from "@/components/marketing";

const SUPPORT_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdxmbkyvBibl1imDI5SNooRLFlPhEEwqq-yJ-H23MJESZSbpw/viewform?usp=dialog";

const productSurfaces = [
  {
    title: "Dashboard",
    description: "A daily account read with spend, outcomes, strongest campaigns, weak spots, and the next thing to review.",
    icon: Activity,
    meta: "Today view",
  },
  {
    title: "Calendar",
    description: "DeepVisor turns recommendations into queued work so owners can approve, modify, delete, or schedule changes.",
    icon: CalendarDays,
    meta: "Week + month",
  },
  {
    title: "Reports",
    description: "Owner-ready reporting that combines platform, campaign, ad set, timeline, what worked, what failed, and recommendations.",
    icon: FileText,
    meta: "Decision brief",
  },
  {
    title: "Campaigns",
    description: "A fuller table view for scanning campaign health without losing the important context behind each metric.",
    icon: Layers,
    meta: "Performance table",
  },
];

const intelligenceAnswers = [
  "Which platform or ad account is strongest right now?",
  "Which campaign and ad set are carrying the best result signal?",
  "What changed during the selected timeline?",
  "What worked, what did not work, and why?",
  "What should be approved, modified, paused, or watched next?",
];

const systemSteps = [
  {
    title: "Connect the account",
    copy: "Meta is the current foundation. The product UI already supports the shape for Google Ads and TikTok as one selected account per platform.",
    icon: Radar,
  },
  {
    title: "Build account memory",
    copy: "DeepVisor syncs account structure and performance history so future reads are based on what has actually happened.",
    icon: Database,
  },
  {
    title: "Classify and explain",
    copy: "The system identifies whether the account is new, weak-history, or mature, then explains the right recommendation style for that context.",
    icon: ShieldCheck,
  },
  {
    title: "Queue the work",
    copy: "Recommendations become visible calendar work instead of vague advice. The owner can review before anything moves forward.",
    icon: Sparkles,
  },
];

const reportHighlights = [
  { label: "Strongest account", value: "Meta · My Business", note: "Best cost per result and cleanest tracking this period." },
  { label: "Strongest campaign", value: "Local Lead Machine", note: "96 leads at $25.83 with stable conversion quality." },
  { label: "Needs attention", value: "Broad Prospecting", note: "CTR is softening and creative rotation is recommended." },
  { label: "Next move", value: "Approve 3 queued items", note: "Budget hold, creative refresh, and weak ad set review." },
];

const useCases = [
  {
    title: "Business owners",
    description: "Know what is happening in the ad account without decoding every ad platform screen.",
    bullets: ["Plain-language reports", "Calendar queue", "Strong and weak spots"],
  },
  {
    title: "Founder-led marketing",
    description: "Move faster with a clear daily read and fewer manual spreadsheet checks.",
    bullets: ["Daily account pulse", "Simple recommendations", "Setup guidance"],
  },
  {
    title: "Lead-gen operators",
    description: "Track campaigns, ad sets, CPA movement, and lead volume in one operating surface.",
    bullets: ["Cost per result", "Timeline context", "Approval workflow"],
  },
  {
    title: "Ecommerce businesses",
    description: "See what products, creatives, and campaigns are driving performance without checking every ad platform screen.",
    bullets: ["ROAS trends", "Creative insights", "Account visibility"],
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProductSystem />
      <IntegrationsSection />
      <IntelligenceLoop />
      <ReportPreview />
      <HowItWorks />
      <UseCases />
      <SupportSection />
      <CTA />
    </>
  );
}

const ProductSystem = () => {
  return (
    <Section tone="light" id="product-system" className="border-b border-border py-12 sm:py-section-sm md:py-section">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
          <div className="space-y-4">
            <Badge variant="accent" className="w-fit">
              Product system
            </Badge>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              One place to understand, plan, and report on ad performance.
            </h2>
            <p className="text-sm leading-7 text-slate-600 sm:text-base">
              DeepVisor is not meant to be another analytics wall. The app is built around the few surfaces a business owner actually needs: a dashboard for now, a calendar for next, reports for explanation, and campaign tables for deeper inspection.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {productSurfaces.map((surface) => {
              const Icon = surface.icon;
              return (
                <Card key={surface.title} className="border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {surface.meta}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-slate-950">{surface.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{surface.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </Container>
    </Section>
  );
};

const IntelligenceLoop = () => {
  return (
    <Section tone="muted" id="intelligence" className="border-b border-border py-12 sm:py-section-sm md:py-section">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Account intelligence
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              DeepVisor should answer the questions business owners keep asking.
            </h2>
            <p className="text-sm leading-7 text-slate-600 sm:text-base">
              The backend direction is simple: every selected ad account becomes a long-lived intelligence object. As more syncs happen, DeepVisor should preserve memory, improve context, and make recommendations easier to trust.
            </p>

            <div className="grid gap-3">
              {intelligenceAnswers.map((answer) => (
                <div key={answer} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <p className="text-sm font-semibold text-slate-800">{answer}</p>
                </div>
              ))}
            </div>
          </div>

          <Card className="border-slate-200 bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Maturity model</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Recommendations change with the account.</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Target className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[
                { title: "New account", detail: "Focus on setup, tracking confidence, controlled experiments, and clean first tests." },
                { title: "Weak-history account", detail: "Tighten inputs, improve signal quality, and avoid scaling until the pattern is stable." },
                { title: "Mature account", detail: "Scale winners, refresh tired creative, reuse proven audiences, and protect efficiency." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Container>
    </Section>
  );
};

const ReportPreview = () => {
  return (
    <Section tone="light" id="outcomes" className="border-b border-border py-12 sm:py-section-sm md:py-section">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-4">
            <Badge variant="accent" className="w-fit">
              Reports that explain
            </Badge>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Reports should combine the story, not split it into random sections.
            </h2>
            <p className="text-sm leading-7 text-slate-600 sm:text-base">
              A useful report should make the account obvious: where performance is strongest, what changed over time, which campaign or ad set deserves attention, and what DeepVisor recommends next.
            </p>
            <Button asChild variant="soft">
              <a href="#how-it-works">See how the flow works</a>
            </Button>
          </div>

          <Card className="border-slate-200 bg-white p-0 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Weekly report</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">April 4 - April 10</h3>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Ready for owner review
              </span>
            </div>

            <div className="grid gap-0 md:grid-cols-2">
              {reportHighlights.map((item) => (
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

const HowItWorks = () => {
  return (
    <Section tone="dark" id="how-it-works" className="overflow-hidden py-12 sm:py-section-sm md:py-section">
      <div className="pointer-events-none absolute inset-0 bg-soft-grid opacity-[0.08] [background-size:72px_72px]" aria-hidden="true" />
      <Container className="relative">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">How it works</p>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              From connected ad account to queued decisions.
            </h2>
            <p className="text-sm leading-7 text-white/70 sm:text-base">
              DeepVisor should keep the path clear: connect, sync, analyze, recommend, and keep improving as the account changes.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {systemSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/65">{step.copy}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </Section>
  );
};

const UseCases = () => {
  return (
    <Section tone="light" id="use-cases" className="border-b border-border py-12 sm:py-section-sm md:py-section">
      <Container>
        <div className="flex flex-col gap-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Who it helps</p>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Built for people who need ad answers, not another noisy tool.
          </h2>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            The interface should be calm enough for business owners and useful enough for operators who need the underlying detail.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {useCases.map((useCase) => (
            <Card key={useCase.title} className="border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">{useCase.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{useCase.description}</p>
              <div className="mt-5 space-y-2">
                {useCase.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
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
    <Section tone="muted" id="support" className="border-b border-border py-12 sm:py-section-sm md:py-section">
      <Container>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <Badge variant="accent" className="w-fit">
            Early access
          </Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Help shape the account intelligence product business owners actually need.
          </h2>
          <p className="text-sm leading-7 text-slate-600 sm:text-base">
            We&apos;re gathering feedback from owners, operators, agencies, and investors. If you run ads and want cleaner decisions, share what would make DeepVisor valuable for you.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="primary">
              <a href={SUPPORT_FORM_URL} target="_blank" rel="noreferrer">
                Submit support form
              </a>
            </Button>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              3-5 minutes · product feedback welcome
            </span>
          </div>
        </div>
      </Container>
    </Section>
  );
};
