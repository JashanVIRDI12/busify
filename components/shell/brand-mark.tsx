import { cn } from "@/lib/utils";

/**
 * The wordmark: a coach seen from the side, trailing two motion lines, beside a
 * lowercase name. Drawn rather than shipped as a file so it inherits currentColor
 * for the word and stays crisp at the 26px the nav bar gives it.
 */
export function BrandMark({
  className,
  showWord = true,
}: {
  className?: string;
  showWord?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 40 24"
        className="h-[22px] w-[36px] shrink-0"
        role="img"
        aria-label="Busify"
      >
        {/* Motion lines */}
        <rect x="0" y="7" width="9" height="2.6" rx="1.3" fill="var(--orange-300)" />
        <rect x="0" y="13.4" width="6" height="2.6" rx="1.3" fill="var(--orange-200)" />
        {/* Coach body */}
        <rect
          x="9"
          y="4"
          width="30"
          height="14.5"
          rx="4.5"
          fill="var(--orange-500)"
        />
        {/* Windows */}
        <rect x="12.5" y="7.2" width="7.5" height="5" rx="1.6" fill="#fff" opacity="0.92" />
        <rect x="21.5" y="7.2" width="7.5" height="5" rx="1.6" fill="#fff" opacity="0.92" />
        {/* Wheels */}
        <circle cx="17" cy="19.4" r="2.6" fill="var(--ink-black)" />
        <circle cx="17" cy="19.4" r="1" fill="#fff" />
        <circle cx="32" cy="19.4" r="2.6" fill="var(--ink-black)" />
        <circle cx="32" cy="19.4" r="1" fill="#fff" />
      </svg>

      {showWord && (
        <span className="text-[19px] font-semibold tracking-[-0.03em] text-ink">
          busify
        </span>
      )}
    </span>
  );
}
