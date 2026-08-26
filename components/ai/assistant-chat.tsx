"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Check, Loader2, Sparkles, TriangleAlert, Wrench } from "lucide-react";

import { ActionConfirm, type PendingAction } from "@/components/ai/action-confirm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Turn = {
  role: "user" | "assistant";
  content: string;
  steps?: { tool: string; summary: string }[];
  failed?: boolean;
  pendingAction?: PendingAction;
  outcome?: { ok: boolean; message: string; href?: string };
};

export function AssistantChat({
  suggestions,
  tripRequestId,
  pageContext,
  placeholder = "Ask about your fleet, trips or customers…",
  emptyTitle = "Ask me anything about your operation",
  emptyBody = "I read your live data and can make changes once you confirm them.",
  className,
  compact = false,
}: {
  suggestions: readonly string[];
  tripRequestId?: string;
  /** Where the operator is, so "this trip" resolves sensibly. */
  pageContext?: string;
  placeholder?: string;
  emptyTitle?: string;
  emptyBody?: string;
  className?: string;
  compact?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, pending]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    const history = turns
      .filter((turn) => !turn.failed)
      .map(({ role, content }) => ({ role, content }));

    setTurns((current) => [...current, { role: "user", content: trimmed }]);
    setInput("");
    setPending(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history,
          tripRequestId,
          pageContext,
        }),
      });

      const data = (await response.json()) as {
        reply?: string;
        steps?: { tool: string; summary: string }[];
        pendingAction?: PendingAction;
        error?: string;
      };

      if (!response.ok) {
        setTurns((current) => [
          ...current,
          { role: "assistant", content: data.error ?? "Something went wrong.", failed: true },
        ]);
        return;
      }

      setTurns((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply ?? "",
          steps: data.steps,
          pendingAction: data.pendingAction,
        },
      ]);
    } catch {
      setTurns((current) => [
        ...current,
        {
          role: "assistant",
          content: "Could not reach the assistant. Check your connection.",
          failed: true,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function resolveAction(index: number, outcome: Turn["outcome"]) {
    setTurns((current) =>
      current.map((turn, i) =>
        i === index ? { ...turn, pendingAction: undefined, outcome } : turn,
      ),
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {turns.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold">{emptyTitle}</p>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground text-pretty">
                {emptyBody}
              </p>
            </div>
          </div>
        )}

        {turns.map((turn, index) =>
          turn.role === "user" ? (
            <div key={index} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-body-sm text-signal-white text-pretty">
                {turn.content}
              </p>
            </div>
          ) : (
            <div key={index} className="space-y-2">
              {turn.steps && turn.steps.length > 0 && (
                <ul className="space-y-1">
                  {turn.steps.map((step, stepIndex) => (
                    <li
                      key={stepIndex}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <Wrench className="size-3 shrink-0" aria-hidden />
                      <span className="truncate font-mono">{step.summary}</span>
                    </li>
                  ))}
                </ul>
              )}

              {turn.content && (
                <div
                  className={cn(
                    "max-w-[92%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm whitespace-pre-wrap text-pretty",
                    turn.failed
                      ? "border border-destructive/25 bg-destructive/8"
                      : "bg-muted",
                  )}
                >
                  {turn.failed && (
                    <TriangleAlert
                      className="mr-1.5 inline size-3.5 -translate-y-px text-destructive"
                      aria-hidden
                    />
                  )}
                  {turn.content}
                </div>
              )}

              {turn.pendingAction && (
                <ActionConfirm
                  action={turn.pendingAction}
                  onResolved={(outcome) => resolveAction(index, outcome)}
                />
              )}

              {turn.outcome && (
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm",
                    turn.outcome.ok
                      ? "border-success/25 bg-success/8"
                      : "border-border bg-muted/40",
                  )}
                >
                  {turn.outcome.ok ? (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                  ) : (
                    <TriangleAlert
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <span className="min-w-0 flex-1 text-pretty">
                    {turn.outcome.message}
                    {turn.outcome.href && (
                      <>
                        {" "}
                        <Link
                          href={turn.outcome.href}
                          className="font-medium text-interactive hover:underline"
                        >
                          Open it
                        </Link>
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          ),
        )}

        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Looking that up…
          </div>
        )}

        <div ref={endRef} />
      </div>

      {turns.length === 0 && (
        <div className="mt-3 mb-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => ask(suggestion)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-interactive/30 hover:text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(input);
        }}
        className="relative mt-3 shrink-0"
      >
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is a newline. Dispatchers type fast.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void ask(input);
            }
          }}
          placeholder={placeholder}
          rows={compact ? 2 : 3}
          className="resize-none pr-12"
          aria-label="Message the assistant"
        />
        <Button
          type="submit"
          size="icon-sm"
          className="absolute right-2 bottom-2"
          disabled={!input.trim() || pending}
          aria-label="Send"
        >
          <ArrowUp />
        </Button>
      </form>
    </div>
  );
}
