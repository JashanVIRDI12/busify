"use client";

import { useTransition } from "react";
import { Download, Eye, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { generatePayDraftsAction } from "@/app/(dashboard)/driver-pay/actions";
import { Button } from "@/components/ui/button";

/**
 * "Review Drafts" is the button that turns dispatch data into payroll: it walks
 * every driver assignment and creates a pay row for any that does not have one.
 * It is idempotent, so a dispatcher who clicks it twice gets told nothing
 * changed rather than paying anyone twice.
 */
export function DriverPayActions({ canEdit }: { canEdit: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="outline" size="sm" className="h-9" asChild>
        <a href="/driver-pay/export">
          <Send className="size-3.5" />
          Pay Report
        </a>
      </Button>

      <Button variant="outline" size="sm" className="h-9" asChild>
        <a href="/driver-pay/export" download>
          <Download className="size-3.5" />
          Download
        </a>
      </Button>

      {canEdit && (
        <Button
          size="sm"
          className="h-9"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await generatePayDraftsAction();
              if (!result.ok) {
                toast.error(result.message);
              } else if (result.data.created === 0) {
                toast.success("Every assignment already has a pay row");
              } else {
                toast.success(
                  `Created ${result.data.created} draft pay ${
                    result.data.created === 1 ? "row" : "rows"
                  }`,
                );
              }
            })
          }
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Eye className="size-3.5" />
          )}
          Review Drafts
        </Button>
      )}
    </>
  );
}

export function PayStubActions() {
  return (
    <Button variant="outline" size="sm" className="h-9" asChild>
      <a href="/driver-pay/export?tab=stubs" download>
        <Download className="size-3.5" />
        Download
      </a>
    </Button>
  );
}
