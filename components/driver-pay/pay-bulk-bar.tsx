"use client";

import { Receipt } from "lucide-react";

import { issuePayStubsAction } from "@/app/(dashboard)/driver-pay/actions";
import { BulkActionBar } from "@/components/data/selection";

/**
 * The Driver Pay selection bar. A client component for the same reason as the
 * Payments one: the action is a closure around a server action, and only the
 * client side of the boundary is allowed to create closures.
 */
export function PayBulkBar({ canEdit }: { canEdit: boolean }) {
  return (
    <BulkActionBar
      noun="pay row"
      actions={
        canEdit
          ? [
              {
                label: "Issue pay stubs",
                icon: <Receipt className="size-3.5" />,
                run: async (ids: string[]) => {
                  const result = await issuePayStubsAction(ids);
                  return result.ok
                    ? {
                        ok: true,
                        message: `Issued ${result.data.stubs} pay ${
                          result.data.stubs === 1 ? "stub" : "stubs"
                        }`,
                      }
                    : { ok: false, message: result.message };
                },
              },
            ]
          : []
      }
    />
  );
}
