import * as React from "react";
import { cn } from "@/lib/shared/utils/format";

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "default" | "lg" | "full";
}

const sizeStyles: Record<NonNullable<ContainerProps["size"]>, string> = {
  default: "max-w-content",
  lg: "max-w-content-lg",
  full: "max-w-none",
};

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, size = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", sizeStyles[size], className)}
      {...props}
    />
  )
);

Container.displayName = "Container";

export { Container };
