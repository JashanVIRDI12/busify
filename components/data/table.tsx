import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The white panel every list lives in. `overflow-x-auto` is on the inner scroll
 * region rather than the card so the footer (page size, pagination) stays put
 * while a 14-column reservations table scrolls sideways under it.
 */
export function TableCard({
  children,
  footer,
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("panel overflow-hidden", className)}>
      <div className="scrollbar-slim overflow-x-auto">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}

export function DataTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <table
      className={cn("w-full border-collapse text-left text-body-sm", className)}
    >
      {children}
    </table>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-bone">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  className,
  align = "left",
  width,
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  width?: string;
}) {
  return (
    <th
      scope="col"
      style={width ? { width } : undefined}
      className={cn(
        "px-3.5 py-3 text-[12.5px] font-medium whitespace-nowrap text-slate",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  children,
  className,
  selected = false,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  selected?: boolean;
  /** The whole row opens a record. Pair with one <RowLink> inside it. */
  interactive?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-bone/80 transition-colors last:border-0",
        selected ? "bg-orange-50/70" : "hover:bg-mist",
        // `relative` is what lets RowLink's overlay cover the row, and
        // focus-within carries the keyboard ring from that one real link out to
        // the whole row so tabbing still shows where you are.
        interactive &&
          "relative cursor-pointer focus-within:bg-mist focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-orange-400",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  className,
  align = "left",
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "px-3.5 py-[11px] align-middle text-body-sm text-ink",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

/**
 * The one link in a row, stretched to cover the whole row.
 *
 * A row is not allowed to *be* a link — an anchor cannot wrap `<td>`s without
 * breaking table semantics, and screen readers would read every cell as part of
 * one enormous link label. So exactly one real link carries the destination and
 * an absolutely-positioned pseudo-element extends its hit area over the row.
 * Assistive technology still announces a single, sensibly-labelled link.
 *
 * Anything else clickable in the row — a checkbox, a row menu — must sit above
 * that overlay: give its cell `className="relative z-10"`.
 *
 * Text stays selectable everywhere the overlay is not, and the browser's own
 * "open in new tab" works because this is a genuine anchor.
 */
export function RowLink({
  href,
  children,
  className,
  label,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  /** Spoken label, when the visible text is just a reference number. */
  label?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "after:absolute after:inset-0 after:content-[''] hover:text-teal-600 hover:underline focus:outline-none",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** The dash Busify shows for an empty cell, so blanks read as "known empty". */
export function Blank() {
  return <span className="text-fog">--</span>;
}

export function EmptyRow({
  colSpan,
  message = "No data found",
}: {
  colSpan: number;
  message?: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-10 text-center text-body-sm text-ash"
      >
        {message}
      </td>
    </tr>
  );
}
