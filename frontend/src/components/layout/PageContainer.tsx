import { cn } from "@/utils/cn";
import * as React from "react";

type Props = {
  /** Big page title. If string, it gets the standard styling */
  title?: React.ReactNode;
  /** Subheading under the title */
  subtitle?: React.ReactNode;
  /** Right-side header actions (buttons, filters, etc.) */
  actions?: React.ReactNode;
  /** Extra classes for the outer wrapper */
  className?: string;
  children: React.ReactNode;
};

export default function PageContainer({
  title,
  subtitle,
  actions,
  className,
  children,
}: Props) {
  return (
    <div className={cn("container mx-auto px-6 py-6 space-y-6", className)}>
      {(title || subtitle || actions) && (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {typeof title === "string" ? (
              <h1 className="text-[22px] font-semibold tracking-[-0.01em]">
                {title}
              </h1>
            ) : (
              title
            )}
            {subtitle ? (
              <p className="text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex items-center gap-2">{actions}</div>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}