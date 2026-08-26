import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Makes an entire table row clickable without nesting interactive elements.
 *
 * A single real `<Link>` sits in the primary cell and stretches an invisible
 * pseudo-element across the whole row, so the row is one large target for the
 * mouse while keyboard and screen-reader users still get exactly one link with
 * a sensible name. Wrapping the row in an anchor, or putting a click handler on
 * the `<tr>`, would break both.
 *
 * Requirements: the parent `<TableRow>` needs `relative`, and anything else
 * interactive in the row needs `relative z-10` so it stays above the overlay.
 * `RowActions` below does that for you.
 */
export function RowLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "after:absolute after:inset-0 after:content-['']",
        "outline-none focus-visible:underline",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Keeps buttons and menus clickable above a RowLink's stretched overlay. */
export function RowActions({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("relative z-10 flex items-center gap-2", className)}>{children}</div>;
}
