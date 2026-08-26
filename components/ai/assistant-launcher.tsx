"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Sparkles, X } from "lucide-react";

import { AssistantChat } from "@/components/ai/assistant-chat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Human-readable page context, so "this page" and "these" resolve sensibly. */
function describePage(pathname: string): string {
  if (pathname.startsWith("/trip-requests/")) return "a trip request detail page";
  if (pathname.startsWith("/trip-requests")) return "the trip requests list";
  if (pathname.startsWith("/trips/")) return "a trip detail page";
  if (pathname.startsWith("/trips")) return "the trips list";
  if (pathname.startsWith("/quotes/")) return "a quote detail page";
  if (pathname.startsWith("/quotes")) return "the quotes list";
  if (pathname.startsWith("/bookings")) return "the bookings list";
  if (pathname.startsWith("/vehicles/types")) return "the vehicle types page";
  if (pathname.startsWith("/vehicles")) return "the fleet list";
  if (pathname.startsWith("/drivers")) return "the drivers list";
  if (pathname.startsWith("/customers")) return "the customers list";
  if (pathname.startsWith("/settings")) return "the settings pages";
  return "the dashboard overview";
}

const SUGGESTIONS = [
  "Brief me on today",
  "What needs my attention?",
  "Which coaches are free this Friday?",
  "Show trips without a driver",
] as const;

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {!open && (
        // The label is never hidden. A bare black lozenge in the corner reads
        // as a rendering fault, not an affordance.
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the AI assistant"
          className={cn(
            "group fixed right-5 bottom-5 z-40 flex items-center gap-2.5 rounded-full",
            "bg-ink py-3 pr-5 pl-3.5 text-signal-white",
            "shadow-(--shadow-layered) transition-transform duration-150 hover:-translate-y-0.5",
            "sm:right-8 sm:bottom-8",
          )}
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-signal-white/12">
            <Sparkles className="size-3.5" aria-hidden />
          </span>
          <span className="font-display text-body-sm font-bold tracking-[-0.01em]">
            Ask AI
          </span>
          <ArrowUpRight
            className="size-3.5 text-signal-white/50 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-signal-white"
            aria-hidden
          />
        </button>
      )}

      {open && (
        <>
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-onyx/25 sm:hidden"
          />

          <aside
            role="dialog"
            aria-label="AI assistant"
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden border border-bone bg-signal-white",
              "inset-x-0 top-16 bottom-0 rounded-t-2xl",
              "sm:inset-auto sm:right-6 sm:bottom-6 sm:top-auto sm:h-[min(38rem,calc(100dvh-6rem))] sm:w-[27rem] sm:rounded-2xl",
              "shadow-(--shadow-layered)",
            )}
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-bone px-5 py-4">
              <span className="flex size-9 items-center justify-center rounded-full bg-ink text-signal-white">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-body-sm font-bold tracking-[-0.02em] text-ink">
                  Assistant
                </p>
                <p className="truncate text-[12px] text-ash">
                  Reading {describePage(pathname)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </header>

            <div className="min-h-0 flex-1 px-5 pb-5">
              <AssistantChat
                compact
                className="h-full"
                suggestions={SUGGESTIONS}
                pageContext={describePage(pathname)}
                placeholder="Ask, or tell me what to change…"
                emptyTitle="What do you need?"
                emptyBody="I read your live data, and I can make changes once you confirm them."
              />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
