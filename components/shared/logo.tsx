import { cn } from "@/lib/utils";

/**
 * Brand mark. Violet is reserved for identity moments like this one and for
 * badges — it never becomes a CTA fill.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-signal-white",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden role="presentation">
        {/* Route marker: two stops and the leg between them. */}
        <path
          d="M7 6.5h10M7 17.5h10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="7" cy="6.5" r="2.25" fill="currentColor" />
        <circle cx="17" cy="17.5" r="2.25" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-body font-extrabold tracking-[-0.03em] text-ink">
        Busify
      </span>
    </span>
  );
}
