"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { recordPaymentAction } from "@/app/(dashboard)/payments/actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatMoney } from "@/lib/utils";

/**
 * Inline amount editor on the payments row. The full amount is one click away
 * because "they paid the invoice" is the overwhelmingly common case, and making
 * the operator retype 6,102.00 to say so is where errors come from.
 */
export function RecordPayment({
  tripId,
  totalDue,
  amountPaid,
  currency,
}: {
  tripId: string;
  totalDue: number;
  amountPaid: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(amountPaid));
  const [pending, startTransition] = useTransition();

  function submit(amount: number) {
    startTransition(async () => {
      const result = await recordPaymentAction({ trip_id: tripId, amount });
      if (result.ok) {
        toast.success("Payment recorded");
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="tabular rounded px-1 text-body-sm text-teal-600 hover:underline">
        {formatMoney(amountPaid, currency, { precise: true })}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-3">
        <label
          htmlFor={`paid-${tripId}`}
          className="mb-1.5 block text-[12px] font-medium text-carbon"
        >
          Amount collected
        </label>
        <input
          id={`paid-${tripId}`}
          value={value}
          inputMode="decimal"
          onChange={(event) => setValue(event.target.value)}
          className="tabular h-10 w-full rounded-md border border-cloud px-3 text-body-sm text-ink outline-none focus-visible:border-orange-400"
        />
        <p className="mt-1.5 text-[11.5px] text-ash">
          Invoiced {formatMoney(totalDue, currency, { precise: true })}
        </p>

        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={pending}
            onClick={() => {
              setValue(String(totalDue));
              submit(totalDue);
            }}
          >
            Paid in full
          </Button>
          <Button
            size="sm"
            className="flex-1"
            disabled={pending}
            onClick={() => {
              const amount = Number(value);
              if (!Number.isFinite(amount) || amount < 0) {
                toast.error("Enter a valid amount.");
                return;
              }
              submit(amount);
            }}
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
