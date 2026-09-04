"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addUnavailabilityAction,
  removeUnavailabilityAction,
} from "@/app/driver/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { idleFormState } from "@/lib/forms";
import { useActionForm } from "@/lib/hooks/use-action-form";

export type Window = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  label: string;
};

export function AvailabilityManager({ windows }: { windows: Window[] }) {
  const [open, setOpen] = useState(windows.length === 0);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { state, formAction } = useActionForm(addUnavailabilityAction, {
    onSuccess: () => {
      toast.success("Time blocked off.");
      setOpen(false);
    },
  });

  async function remove(id: string) {
    setRemovingId(id);
    const fd = new FormData();
    fd.set("id", id);
    const result = await removeUnavailabilityAction(idleFormState, fd);
    setRemovingId(null);
    if (result.status === "error") toast.error(result.message ?? "That didn't work.");
    else toast.success("Removed.");
  }

  return (
    <div className="space-y-4">
      {windows.length > 0 && (
        <Card>
          <CardContent className="divide-y divide-bone">
            {windows.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-ink">{w.label}</p>
                  {w.reason && (
                    <p className="text-[12px] text-ash">{w.reason}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove"
                  disabled={removingId === w.id}
                  onClick={() => remove(w.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {open ? (
        <Card>
          <CardContent>
            <form action={formAction} className="space-y-4" noValidate>
              <FormMessage state={state} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="From"
                  htmlFor="starts_at"
                  required
                  errors={state.fieldErrors?.starts_at}
                >
                  <Input
                    id="starts_at"
                    name="starts_at"
                    type="datetime-local"
                    required
                  />
                </Field>
                <Field
                  label="Until"
                  htmlFor="ends_at"
                  required
                  errors={state.fieldErrors?.ends_at}
                >
                  <Input
                    id="ends_at"
                    name="ends_at"
                    type="datetime-local"
                    required
                  />
                </Field>
              </div>
              <Field
                label="Reason"
                htmlFor="reason"
                hint="Optional — only your dispatchers see this."
                errors={state.fieldErrors?.reason}
              >
                <Textarea
                  id="reason"
                  name="reason"
                  rows={2}
                  placeholder="Medical appointment, holiday, training…"
                />
              </Field>
              <div className="flex justify-end gap-2">
                {windows.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                )}
                <SubmitButton>Block off this time</SubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus />
          Block off time
        </Button>
      )}
    </div>
  );
}
