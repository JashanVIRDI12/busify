"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export type PendingAction = {
  name: string;
  args: Record<string, unknown>;
  summary: string;
  caution?: string;
};

/**
 * Nothing has been changed at the point this renders. The model asked; the
 * operator decides. Confirming is what actually runs the write.
 */
export function ActionConfirm({
  action,
  onResolved,
}: {
  action: PendingAction;
  onResolved: (outcome: { ok: boolean; message: string; href?: string }) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");

  async function confirm() {
    setState("running");
    try {
      const response = await fetch("/api/assistant/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: action.name, args: action.args }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        href?: string;
        error?: string;
      };

      setState("done");

      if (!response.ok || !data.ok) {
        onResolved({
          ok: false,
          message: data.error ?? data.message ?? "That change did not go through.",
        });
        return;
      }

      onResolved({ ok: true, message: data.message ?? "Done.", href: data.href });
      // The page behind the panel is now stale.
      router.refresh();
    } catch {
      setState("done");
      onResolved({ ok: false, message: "Could not reach the server." });
    }
  }

  if (state === "done") return null;

  return (
    <div className="rounded-xl border border-interactive/30 bg-interactive/5 p-4">
      <p className="text-xs font-medium tracking-wide text-interactive uppercase">
        Confirm this change
      </p>
      <p className="mt-2 text-sm font-medium text-pretty">{action.summary}</p>

      {action.caution && (
        <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground text-pretty">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {action.caution}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={confirm} disabled={state === "running"}>
          {state === "running" ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Check aria-hidden />
          )}
          Confirm
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={state === "running"}
          onClick={() => onResolved({ ok: false, message: "Cancelled — nothing changed." })}
        >
          <X aria-hidden />
          Cancel
        </Button>
      </div>
    </div>
  );
}
