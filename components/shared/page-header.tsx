import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
};

/**
 * Display type: heavy Plus Jakarta with tight negative tracking. That weight
 * plus tracking combination is what makes the headings read as confident rather
 * than shy, and it is the brand's typographic signature.
 */
function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="space-y-2">
        {eyebrow && <p className="meta-label">{eyebrow}</p>}
        <h1 className="font-display text-heading-sm font-extrabold text-balance text-onyx">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-body text-pretty text-slate">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      )}
    </header>
  );
}

export { PageHeader };
