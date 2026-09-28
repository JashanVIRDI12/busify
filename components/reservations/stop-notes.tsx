"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { setStopNotesAction } from "@/app/(dashboard)/reservations/actions";
import { Input } from "@/components/ui/input";

/**
 * A note on one stop.
 *
 * Folded away until there is something to say, like every other optional field
 * in this product — a stop with no note should not put an empty box on screen
 * asking a dispatcher whether it needs one.
 *
 * It saves on blur rather than behind a button. A dispatcher writing "use the
 * rear gate, ask for Marek" is mid-thought about the next stop by the time they
 * would reach a Save, and an unsaved note helps nobody.
 */
export function StopNotes({
  stopId,
  notes,
  canEdit,
}: {
  stopId: string;
  notes: string | null;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(setStopNotesAction, {
    status: "idle" as const,
  });
  const [open, setOpen] = useState(Boolean(notes));

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  if (!canEdit && !notes) return null;

  if (!canEdit) {
    return <p className="mt-2 text-[12.5px] text-carbon">{notes}</p>;
  }

  // Quiet until wanted: six stops means six of these, and in teal they read as
  // six calls to action rather than one optional field each.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[12px] font-medium text-slate transition-colors hover:bg-mist hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Add note
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="id" value={stopId} />
      <Input
        name="notes"
        aria-label="Notes for this stop"
        placeholder="Gate, dock, who to ask for"
        defaultValue={notes ?? ""}
        disabled={pending}
        autoFocus={!notes}
        className="h-8 max-w-md text-[12.5px]"
        onBlur={(event) => event.currentTarget.form?.requestSubmit()}
      />
      {pending && (
        <Loader2 className="size-3.5 animate-spin text-ash" aria-hidden="true" />
      )}
    </form>
  );
}
