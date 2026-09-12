import type { ReactNode } from "react";

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
}: {
  children: ReactNode;
  className?: string;
  selected?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-bone/80 transition-colors last:border-0",
        selected ? "bg-orange-50/70" : "hover:bg-mist",
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
