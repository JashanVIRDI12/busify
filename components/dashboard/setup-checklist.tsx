import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import type { SetupState } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

/**
 * A list, not a grid.
 *
 * Five steps in a 3-across grid leaves two orphan cells and a ragged bottom
 * edge, and completed steps become empty grey boxes taking as much room as
 * live ones. Stacked rows keep the order legible, let finished steps collapse
 * to a quiet line, and give the next action somewhere obvious to sit.
 *
 * This carries the rotating conic border — the brand's one expressive moment,
 * and the brief allows exactly one per viewport.
 */
export function SetupChecklist({ setup }: { setup: SetupState }) {
  const percent = Math.round((setup.completed / setup.total) * 100);
  const next = setup.steps.find((step) => !step.done);

  return (
    <section
      aria-labelledby="setup-heading"
      className="conic-ring overflow-hidden rounded-2xl"
    >
      <div className="rounded-2xl bg-signal-white p-7">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="meta-label">Getting started</p>
            <h2
              id="setup-heading"
              className="mt-2 font-display text-[26px] leading-tight font-extrabold tracking-[-0.035em] text-balance text-onyx"
            >
              {next ? next.label : "Everything is in place"}
            </h2>
            {next && (
              <p className="mt-1.5 max-w-md text-body-sm text-pretty text-slate">
                {next.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <div className="text-right">
              <p className="tabular font-display text-[32px] leading-none font-extrabold tracking-[-0.04em] text-onyx">
                {setup.completed}
                <span className="text-fog">/{setup.total}</span>
              </p>
              <p className="meta-label mt-1.5">done</p>
            </div>
            {next && (
              <Link
                href={next.href}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-display text-body-sm font-bold text-signal-white transition-colors duration-150 hover:bg-carbon"
              >
                Continue
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        </div>

        <div
          className="mt-6 h-1 overflow-hidden rounded-full bg-plaster"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup progress"
        >
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-[450ms] ease-[cubic-bezier(0.33,1,0.68,1)]"
            style={{ width: `${percent}%` }}
          />
        </div>

        <ol className="mt-6 divide-y divide-bone border-t border-bone">
          {setup.steps.map((step, index) => (
            <li key={step.id}>
              <Link
                href={step.href}
                className="group flex items-center gap-3.5 py-3 transition-colors duration-150"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                    step.done
                      ? "bg-emerald text-signal-white"
                      : "border border-cloud text-ash group-hover:border-ink group-hover:text-ink",
                  )}
                >
                  {step.done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                </span>

                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-body-sm",
                    step.done
                      ? "text-ash line-through"
                      : "font-semibold text-ink group-hover:text-interactive",
                  )}
                >
                  {step.label}
                </span>

                {!step.done && (
                  <ArrowRight
                    className="size-3.5 shrink-0 text-cloud transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-interactive"
                    aria-hidden
                  />
                )}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
