import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Accent = "brand" | "success" | "warning" | "neutral";

const ICON_STYLES: Record<Accent, string> = {
  brand: "bg-brand/10 text-brand",
  success: "bg-emerald/12 text-emerald",
  warning: "bg-amber/18 text-[#8a4b12]",
  neutral: "bg-mist text-slate",
};

type StatCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  accent?: Accent;
  href?: string;
  className?: string;
};

/**
 * Stat callout: monospaced meta label, then the number at display weight with
 * tight tracking — the brand's "spec sheet at exhibition scale" move.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "neutral",
  href,
  className,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="meta-label">{label}</p>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            ICON_STYLES[accent],
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>

      <p className="tabular mt-5 font-display text-[34px] leading-none font-extrabold tracking-[-0.04em] text-onyx">
        {value}
      </p>

      {hint && <p className="mt-2 text-[12px] text-pretty text-ash">{hint}</p>}
    </>
  );

  const shell = cn(
    "flex flex-col rounded-lg border border-bone bg-signal-white p-6",
    href && "transition-colors duration-150 hover:border-cloud hover:bg-mist",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}
