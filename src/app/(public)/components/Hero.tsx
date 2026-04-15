import type { FC } from "react";
import Link from "next/link";
import { Badge, Button, Container, Section } from "@/components/marketing";
import HeroCalendarShowcase from "./HeroCalendarShowcase";

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
            <HeroCalendarShowcase />
          </div>
        </div>
      </Container>
    </Section>
  );
};

export default Hero;
