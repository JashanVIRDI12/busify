"use client";

import { Textarea } from "@/components/ui/textarea";
import type { QuoteTripInput } from "@/lib/validations/quote-builder";

import { useBuilder } from "./builder-context";

export function TripNotes({ trip }: { trip: QuoteTripInput }) {
  const { setTrip, canEdit } = useBuilder();
  return (
    <div className="max-w-2xl space-y-2">
      <p className="text-body-sm font-semibold text-ink">Trip notes</p>
      <p className="text-[12px] text-ash">
        Internal by default. What the customer sees is controlled per quote on the
        Pricing tab.
      </p>
      <Textarea
        rows={8}
        value={trip.notes ?? ""}
        disabled={!canEdit}
        placeholder="Routing constraints, driver instructions, equipment, anything the dispatcher needs."
        onChange={(event) =>
          setTrip(trip.id, { notes: event.target.value || null })
        }
      />
    </div>
  );
}
