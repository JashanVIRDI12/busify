import type { ReactNode } from "react";

/**
 * White panel for the lists that have not moved to `TableCard` yet — trip
 * requests, bookings and vehicle types. Same surface treatment as the console
 * tables so the two do not read as different products while the migration
 * finishes.
 */
export function ListShell({
  toolbar,
  children,
  footer,
}: {
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="panel overflow-hidden">
      {toolbar && (
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          {toolbar}
        </div>
      )}
      <div className="scrollbar-slim overflow-x-auto">{children}</div>
      {footer && (
        <div className="px-4 py-3">
          <p className="text-[12px] text-ash">{footer}</p>
        </div>
      )}
    </div>
  );
}
