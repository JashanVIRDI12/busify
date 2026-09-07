"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The right-hand editor panel every "create" and "edit" flow uses.
 *
 * There is deliberately no dimming scrim: an operator filling this in is
 * reading the table behind it — copying a company name off a row, checking a
 * duplicate — and greying that out would make the panel harder to use, not more
 * focused. The overlay is still there and still closes on click; it just has no
 * colour of its own.
 */
function SideDrawer({
  open,
  onOpenChange,
  title,
  description,
  footer,
  width = "sm:w-[29rem]",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  width?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/5 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />

        <DialogPrimitive.Content
          className={cn(
            "fixed top-14 right-0 bottom-0 z-50 flex w-full flex-col bg-signal-white shadow-(--shadow-drawer)",
            "data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "duration-200",
            width,
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-5 pb-3">
            <DialogPrimitive.Title className="text-subheading font-semibold text-ink">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="flex size-8 items-center justify-center rounded-full text-slate transition-colors hover:bg-mist hover:text-ink"
              aria-label="Close"
            >
              <X className="size-[18px]" />
            </DialogPrimitive.Close>
          </div>

          {description ? (
            <DialogPrimitive.Description className="shrink-0 px-5 pb-2 text-body-sm text-slate">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">
              {title}
            </DialogPrimitive.Description>
          )}

          {children}

          {footer && (
            <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-bone px-5 py-4">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Scrolling body region. Kept separate so the footer never scrolls away. */
function DrawerBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "scrollbar-slim flex-1 space-y-3.5 overflow-y-auto px-5 pt-1 pb-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Two fields on one line, the layout most of these forms open with. */
function DrawerRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3.5">{children}</div>;
}

/**
 * Pinned action row. Lives inside the caller's `<form>` rather than being a
 * prop on the drawer, so the submit button is a real submit button and the
 * form still works with the keyboard and without JavaScript running yet.
 */
function DrawerFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-bone px-5 py-4">
      {children}
    </div>
  );
}

/** The flex column a drawer form needs so its footer stays pinned. */
function DrawerForm({
  action,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col">
      {children}
    </form>
  );
}

export { SideDrawer, DrawerBody, DrawerRow, DrawerFooter, DrawerForm };
