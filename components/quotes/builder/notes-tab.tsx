"use client";

import { Textarea } from "@/components/ui/textarea";

import { useBuilder } from "./builder-context";

export function NotesTab() {
  const { state, setHeader, canEdit } = useBuilder();
  return (
    <div className="max-w-2xl space-y-2">
      <p className="text-body-sm font-semibold text-ink">Quote notes</p>
      <p className="text-[12px] text-ash">
        Internal notes about this deal — how it came in, what the customer wants,
        follow-ups. Not shown to the customer.
      </p>
      <Textarea
        rows={10}
        value={state.header.notes ?? ""}
        disabled={!canEdit}
        placeholder="Called Tuesday, decision expected end of week. Price-sensitive — competitor quoted 4,200."
        onChange={(event) =>
          setHeader({ notes: event.target.value || null })
        }
      />
    </div>
  );
}
