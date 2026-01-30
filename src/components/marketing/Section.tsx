import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/shared/utils/format";

const sectionVariants = cva("relative", {
  variants: {
    tone: {
      light: "bg-background text-foreground",
      muted: "bg-cloud text-foreground",
      dark: "bg-ink text-white",
      gradient: "bg-gradient-to-b from-white via-cloud to-white text-foreground",
    },
    spacing: {
      default: "py-section-sm md:py-section",
      tight: "py-12 md:py-16",
      loose: "py-section md:py-[9rem]",
    },
  },
  defaultVariants: {
    tone: "light",
    spacing: "default",
  },
});

export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {}

const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, tone, spacing, ...props }, ref) => (
    <section
      ref={ref}
      className={cn(sectionVariants({ tone, spacing }), className)}
      {...props}
    />
  )
);

Section.displayName = "Section";

export { Section, sectionVariants };
