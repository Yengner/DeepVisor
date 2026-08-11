import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/shared/utils/format";

const buttonVariants = cva(
  "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-md border font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "border-[#151714] bg-[#151714] text-white shadow-none hover:border-[#0b7a4b] hover:bg-[#0b7a4b]",
        secondary:
          "border-[#0b7a4b] bg-[#0b7a4b] text-white shadow-none hover:border-[#075f3b] hover:bg-[#075f3b]",
        outline:
          "border-white/25 bg-transparent text-white hover:border-[#c8ff56] hover:text-[#c8ff56]",
        ghost:
          "border-transparent text-foreground hover:bg-[#e8ebe3]",
        soft:
          "border-[#dfe2da] bg-white text-foreground hover:border-[#bdc4b9] hover:bg-[#eef0e9]",
      },
      size: {
        sm: "min-h-9 px-3.5 py-2 text-xs",
        md: "min-h-10 px-4 py-2.5 text-sm",
        lg: "min-h-11 px-5 py-3 text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
