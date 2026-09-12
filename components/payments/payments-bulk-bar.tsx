"use client";

import { Mail, Send } from "lucide-react";

import {
  emailInvoicesAction,
  markInvoicesSentAction,
} from "@/app/(dashboard)/payments/actions";
import { BulkActionBar } from "@/components/data/selection";

/**
 * The Payments selection bar.
 *
 * Lives in its own client component because the actions wrap server actions in
 * result-shaping closures, and a Server Component cannot hand a closure to a
 * Client Component — only a bare server action crosses that boundary. Defining
 * the closures here, on the client, is what makes them legal.
 */
export function PaymentsBulkBar({ canEdit }: { canEdit: boolean }) {
  return (
    <BulkActionBar
      noun="reservation"
      actions={
        canEdit
          ? [
              {
                label: "Email invoice",
                icon: <Mail className="size-3.5" />,
                run: async (ids: string[]) => {
                  const result = await emailInvoicesAction(ids);
                  if (!result.ok) return { ok: false, message: result.message };

                  const { sent, delivered, skipped } = result.data;
                  const base = delivered
                    ? `Emailed ${sent} invoice${sent === 1 ? "" : "s"}`
                    : `Marked ${sent} sent — no mail provider is configured, so nothing was delivered`;

                  return {
                    ok: true,
                    message: skipped.length
                      ? `${base}. Skipped: ${skipped.join("; ")}`
                      : base,
                  };
                },
              },
              {
                label: "Mark sent",
                icon: <Send className="size-3.5" />,
                run: async (ids: string[]) => {
                  const result = await markInvoicesSentAction(ids);
                  return result.ok
                    ? { ok: true, message: "Invoices marked as sent" }
                    : { ok: false, message: result.message };
                },
              },
            ]
          : []
      }
    />
  );
}
