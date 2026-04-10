import type { FC } from "react";
import Link from "next/link";
import { Badge, Button, Card, Container, Section } from "@/components/marketing";

const CTA: FC = () => {
  return (
    <Section tone="dark" className="overflow-hidden py-12 sm:py-section-sm md:py-section" id="cta">
      <div className="pointer-events-none absolute inset-0 bg-soft-grid opacity-[0.08] [background-size:72px_72px]" aria-hidden="true" />
      <Container className="relative">
        <Card variant="dark" padding="lg" className="border-white/10 bg-ink-80 p-5 shadow-card-strong sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-5">
              <Badge variant="accent" className="w-fit">
                DeepVisor direction
              </Badge>

              <h2 className="text-balance text-3xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-4xl">
                The goal is simple: turn ad account history into decisions a business owner can trust.
              </h2>

              <p className="max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
                DeepVisor is being built as an account intelligence system: sync the account, understand the history, explain the strongest and weakest areas, then queue the next best work for review.
              </p>

              <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button asChild size="lg" variant="primary">
                  <Link href="#support">Request early access</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="#product-system">Review product flow</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Current platform", value: "Meta", hint: "Live foundation for sync and assessment" },
                { label: "Preview platforms", value: "Google + TikTok", hint: "UI-ready account selection shape" },
                { label: "Main surfaces", value: "Dashboard, Calendar, Reports", hint: "Clear daily operation for owners" },
                { label: "Recommendation style", value: "Explainable", hint: "Human review before queued action" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{stat.value}</p>
                  <p className="mt-2 text-xs leading-5 text-white/55">{stat.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </Container>
    </Section>
  );
};

export default CTA;
