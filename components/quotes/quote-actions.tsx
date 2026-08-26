"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  sendQuoteAction,
  setQuoteStatusAction,
} from "@/app/(dashboard)/quotes/actions";
import { Button } from "@/components/ui/button";
import { idleFormState } from "@/lib/forms";
import type { QuoteStatus } from "@/types/database";

export function QuoteActions({
  quoteId,
  status,
  publicUrl,
  canEdit,
}: {
  quoteId: string;
  status: QuoteStatus;
  publicUrl: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("Customer link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link and copy manually.");
    }
  }

  function run(action: typeof sendQuoteAction, payload: Record<string, string>, ok: string) {
    startTransition(async () => {
      const formData = new FormData();
      for (const [key, value] of Object.entries(payload)) formData.set(key, value);
      const result = await action(idleFormState, formData);

      if (result.status === "error") toast.error(result.message ?? "That did not work.");
      else {
        toast.success(result.message ?? ok);
        router.refresh();
      }
    });
  }

  const settled = status === "ACCEPTED" || status === "DECLINED";

  return (
    <div className="space-y-3">
      {status === "DRAFT" ? (
        <>
          <p className="text-sm text-muted-foreground text-pretty">
            The customer cannot open this quote until it is sent.
          </p>
          {canEdit && (
            <Button
              className="w-full"
              size="lg"
              loading={pending}
              onClick={() => run(sendQuoteAction, { id: quoteId }, "Quote sent.")}
            >
              <Send />
              Mark as sent
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Customer link
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {publicUrl}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={copyLink}>
                {copied ? <Check /> : <Copy />}
                Copy
              </Button>
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  Open
                </a>
              </Button>
            </div>
          </div>

          {settled ? (
            <p className="border-t border-border pt-3 text-sm text-muted-foreground text-pretty">
              {status === "ACCEPTED"
                ? "The customer accepted. A booking and a trip were created automatically."
                : "The customer declined this quote."}
            </p>
          ) : (
            canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                loading={pending}
                onClick={() =>
                  run(
                    setQuoteStatusAction,
                    { id: quoteId, status: "DECLINED" },
                    "Quote closed.",
                  )
                }
              >
                <XCircle />
                Close as declined
              </Button>
            )
          )}
        </>
      )}

      <p className="border-t border-border pt-3 text-xs text-muted-foreground text-pretty">
        Emailing quotes automatically arrives in a later phase — for now, send
        the link yourself.
      </p>
    </div>
  );
}
