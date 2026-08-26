import type { ReactNode } from "react";

/** White panel, 12px radius, hairline border. No shadow. */
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
    <div className="overflow-hidden rounded-lg border border-bone bg-signal-white">
      {toolbar && (
        <div className="flex flex-col gap-4 border-b border-bone px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {toolbar}
        </div>
      )}
      {children}
      {footer && (
        <div className="border-t border-bone bg-mist px-5 py-3.5">
          <p className="text-[12px] text-ash">{footer}</p>
        </div>
      )}
    </div>
  );
}
