import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A one-line hint about how a screen works.
 *
 * Quiet on purpose. These sit above dense tables and forms that an operator
 * will read past within a week, so they are sized and coloured to be findable
 * when wanted and ignorable once learned — never a banner competing with the
 * data underneath.
 *
 * Keep the text to a single sentence that says what to *do*, not what the
 * screen is. "Click any row to open the quote" earns its place; "This is the
 * quotes list" does not.
 */
export function Tip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-[12.5px] leading-snug text-ash",
        className,
      )}
    >
      <Lightbulb className="size-3.5 shrink-0 text-orange-400" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
