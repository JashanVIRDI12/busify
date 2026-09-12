import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import type { AttentionItem } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

const COUNT_STYLE = {
  destructive: "bg-destructive/10 text-destructive",
  warning: "bg-amber/18 text-[#8a4b12]",
  primary: "bg-interactive/10 text-interactive",
} as const;

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <section
      aria-labelledby="needs-attention-heading"
      className="overflow-hidden rounded-lg border border-bone bg-signal-white"
    >
      <div className="flex items-center justify-between gap-4 border-b border-bone px-6 py-5">
        <div>
          <h2
            id="needs-attention-heading"
            className="font-display text-body font-bold tracking-[-0.02em] text-ink"
          >
            Needs attention
          </h2>
          <p className="mt-1 text-body-sm text-slate">
            The work that will cost you money if it waits.
          </p>
        </div>
        {total > 0 && (
          <span className="tabular flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-body-sm font-bold text-signal-white">
            {total}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-4 px-6 py-10">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </span>
          <div>
            <p className="text-body-sm font-semibold text-ink">
              Nothing needs you right now.
            </p>
            <p className="text-body-sm text-slate">
              New requests, unanswered quotes and unstaffed trips surface here.
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-bone">
          {items.map((item) => {
            const body = (
              <>
                <span
                  className={cn(
                    "tabular flex size-10 shrink-0 items-center justify-center rounded-full text-body-sm font-bold",
                    COUNT_STYLE[item.tone],
                  )}
                >
                  {item.count}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body-sm font-semibold text-ink">
                    {item.count} {item.label}
                  </span>
                  <span className="block text-body-sm text-pretty text-slate">
                    {item.detail}
                  </span>
                </span>
                {item.href && (
                  <ArrowRight
                    className="size-4 shrink-0 text-ash transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                )}
              </>
            );

            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="group flex items-center gap-4 px-6 py-4 transition-colors duration-150 outline-none hover:bg-mist"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="group flex items-center gap-4 px-6 py-4">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
