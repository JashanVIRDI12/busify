import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type Metric = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  href?: string;
  /** Raises the figure to full display weight when it is the one to read. */
  lead?: boolean;
};

/**
 * One panel divided by hairlines rather than six floating cards.
 *
 * Six separate cards each holding a single zero is mostly empty space with no
 * hierarchy — every figure shouts equally, so none of them lands. A divided
 * strip reads as one instrument cluster: dense, scannable, and it degrades
 * gracefully when every number is zero on a new account.
 *
 * The grid is pulled a pixel right and down inside an overflow-hidden shell, so
 * each cell can carry a plain right/bottom border and the trailing edges are
 * simply clipped. That works at every breakpoint without nth-child arithmetic
 * that has to be rewritten whenever the column count changes.
 */
export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <section
      aria-label="Key figures"
      className="overflow-hidden rounded-lg border border-bone bg-signal-white"
    >
      <div className="-mr-px -mb-px grid sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(({ label, value, hint, icon: Icon, href, lead }) => {
          const body = (
            <>
              <div className="flex items-center gap-2">
                <Icon className="size-3.5 shrink-0 text-ash" aria-hidden />
                <p className="meta-label">{label}</p>
              </div>

              <p
                className={cn(
                  "tabular mt-4 font-display leading-none font-extrabold tracking-[-0.04em]",
                  lead ? "text-[40px] text-onyx" : "text-[30px] text-ink",
                )}
              >
                {value}
              </p>

              <p className="mt-2 text-[12px] text-pretty text-ash">{hint}</p>
            </>
          );

          const cell = cn(
            "flex flex-col border-r border-b border-bone p-6",
            href && "transition-colors duration-150 hover:bg-mist",
          );

          return href ? (
            <Link key={label} href={href} className={cell}>
              {body}
            </Link>
          ) : (
            <div key={label} className={cell}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
