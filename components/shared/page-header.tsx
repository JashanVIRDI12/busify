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
 * Heading for the pages that carry an explanation as well as a title — the
 * settings screens and the detail views. Lists use `PageHeading` instead, which
 * puts the result count on the title line and has no room for prose.
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
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1.5">
        {eyebrow && <p className="meta-label">{eyebrow}</p>}
        <h1 className="text-heading-sm font-semibold text-balance text-ink">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-body-sm text-pretty text-slate">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

export { PageHeader };
