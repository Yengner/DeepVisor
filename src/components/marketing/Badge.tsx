import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/shared/utils/format";

const badgeVariants = cva(
  "inline-flex items-center gap-2 rounded border px-2.5 py-1 text-[11px] font-bold uppercase",
  {
    variants: {
      variant: {
        neutral: "border-[#dfe2da] bg-white text-[#596057]",
        dark: "border-white/15 bg-white/5 text-white/70",
        accent: "border-[#bde1cc] bg-[#e9f7ef] text-[#0b7a4b]",
        success: "border-[#bde1cc] bg-[#e9f7ef] text-[#0b7a4b]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
