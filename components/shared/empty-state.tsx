import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-20 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-mist text-ash">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="space-y-1.5">
        <p className="font-display text-body font-bold tracking-[-0.02em] text-ink">
          {title}
        </p>
        <p className="mx-auto max-w-md text-body-sm text-pretty text-slate">
          {description}
        </p>
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export { EmptyState };
