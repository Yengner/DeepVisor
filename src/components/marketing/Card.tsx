import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/shared/utils/format";

const cardVariants = cva(
  "relative overflow-hidden rounded-lg border",
  {
    variants: {
      variant: {
        default: "border-[#dfe2da] bg-white text-foreground shadow-card",
        elevated: "border-[#c9cec4] bg-white text-foreground shadow-card-strong",
        glass: "border-white/15 bg-white/5 text-white shadow-card backdrop-blur",
        dark: "border-white/15 bg-[#151714] text-white shadow-card",
      },
      padding: {
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

export { Card, cardVariants };
