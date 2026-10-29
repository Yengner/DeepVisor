import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/shared/utils/format";

const badgeVariants = cva(
  "inline-flex items-center gap-2 rounded border px-2.5 py-1 text-[11px] font-bold uppercase",
  {
    variants: {
      variant: {
        neutral: "border-[#d9e3ef] bg-white text-[#53677d]",
        dark: "border-white/15 bg-white/5 text-white/70",
        accent: "border-[#d9e3ef] bg-[#eaf2ff] text-[#004fc7]",
        success: "border-[#bde1cc] bg-[#e8f4ec] text-[#226443]",
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
