import { cn } from "@/utils/cn";
import * as React from "react";

type CardProps = React.HTMLAttributes<HTMLElement>;

export function SectionCard({ className, ...rest }: CardProps) {
  return (
    <section
      className={cn(
        "bg-card text-card-foreground rounded-2xl border border-border shadow-sm p-5",
        className
      )}
      {...rest}
    />
  );
}