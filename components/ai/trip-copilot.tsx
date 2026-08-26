"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";

import { AssistantChat } from "@/components/ai/assistant-chat";
import { cn } from "@/lib/utils";

/**
 * §23 — the copilot pinned to one trip request.
 *
 * Collapsed by default: the operator's job on this page is to decide, and a
 * chat box competing with the Accept button would get in the way.
 */
export function TripCopilot({
  tripRequestId,
  suggestions,
}: {
  tripRequestId: string;
  suggestions: readonly string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold tracking-tight">
            Trip Copilot
          </span>
          <span className="block text-sm text-muted-foreground">
            Ask about capacity, gaps, or how to reply.
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-border p-5">
          <AssistantChat
            compact
            tripRequestId={tripRequestId}
            suggestions={suggestions}
            placeholder="Ask about this request…"
            emptyTitle="Pinned to this request"
            emptyBody="I already know the route, dates and passenger count. I check live availability before answering."
          />
        </div>
      )}
    </div>
  );
}
