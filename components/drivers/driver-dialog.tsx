"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  createDriverAction,
  updateDriverAction,
} from "@/app/(dashboard)/drivers/actions";
import { FormMessage } from "@/components/auth/form-message";
import { DRIVER_STATUS_LABELS } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { DRIVER_LICENCE_CLASSES } from "@/lib/constants";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { DRIVER_STATUSES, NO_LICENCE_CLASS } from "@/lib/validations/driver";
import type { Tables } from "@/types/database";

type DriverDialogProps = {
  driver?: Tables<"drivers">;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function DriverDialog({
  driver,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: DriverDialogProps) {
  const isEdit = Boolean(driver);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const { state, formAction } = useActionForm(
    isEdit ? updateDriverAction : createDriverAction,
    {
      onSuccess: () => {
        toast.success(isEdit ? "Driver updated." : "Driver added.");
        setOpen(false);
      },
    },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit driver" : "Add driver"}</DialogTitle>
          <DialogDescription>
            Licence class and expiry feed the compliance warnings on your
            dashboard. A coach needs Class 2 in most provinces, B or C in
            Ontario, and an air brake endorsement if it has air brakes.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5" noValidate>
          <FormMessage state={state} />

          {driver && <input type="hidden" name="id" value={driver.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="First name"
              htmlFor="first_name"
              required
              errors={state.fieldErrors?.first_name}
            >
              <Input
                id="first_name"
                name="first_name"
                defaultValue={driver?.first_name ?? ""}
                aria-invalid={Boolean(state.fieldErrors?.first_name)}
                required
              />
            </Field>

            <Field
              label="Last name"
              htmlFor="last_name"
              errors={state.fieldErrors?.last_name}
            >
              <Input
                id="last_name"
                name="last_name"
                defaultValue={driver?.last_name ?? ""}
              />
            </Field>

            <Field label="Email" htmlFor="email" errors={state.fieldErrors?.email}>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={driver?.email ?? ""}
                aria-invalid={Boolean(state.fieldErrors?.email)}
              />
            </Field>

            <Field label="Phone" htmlFor="phone" errors={state.fieldErrors?.phone}>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={driver?.phone ?? ""}
                placeholder="+1 416 555 0134"
              />
            </Field>

            <Field
              label="Licence number"
              htmlFor="license_number"
              errors={state.fieldErrors?.license_number}
            >
              <Input
                id="license_number"
                name="license_number"
                defaultValue={driver?.license_number ?? ""}
                placeholder="A1234-56789-01234"
              />
            </Field>

            <Field
              label="Licence class"
              htmlFor="license_class"
              hint="Class 2 carries a bus over 24 passengers in most provinces."
              errors={state.fieldErrors?.license_class}
            >
              <Select
                name="license_class"
                defaultValue={driver?.license_class ?? NO_LICENCE_CLASS}
              >
                <SelectTrigger id="license_class">
                  <SelectValue placeholder="Not recorded" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LICENCE_CLASS}>Not recorded</SelectItem>
                  {DRIVER_LICENCE_CLASSES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Licence expires"
              htmlFor="license_expires_on"
              hint="You will be warned 30 days out."
              errors={state.fieldErrors?.license_expires_on}
            >
              <Input
                id="license_expires_on"
                name="license_expires_on"
                type="date"
                defaultValue={driver?.license_expires_on ?? ""}
              />
            </Field>
          </div>

          {/* Air brakes are an endorsement, not a class - a driver can hold a
              valid Class 2 and still not be permitted on most highway coaches. */}
          <label
            htmlFor="air_brake_endorsement"
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-bone bg-mist p-4"
          >
            <input
              id="air_brake_endorsement"
              name="air_brake_endorsement"
              type="checkbox"
              defaultChecked={driver?.air_brake_endorsement ?? false}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-ink)]"
            />
            <span className="min-w-0">
              <span className="block text-body-sm font-semibold text-ink">
                Air brake endorsement
              </span>
              <span className="mt-0.5 block text-body-sm text-pretty text-slate">
                Class Z in Ontario. Required for almost every highway coach -
                driving one without it is a violation.
              </span>
            </span>
          </label>

          <Field label="Status" htmlFor="status" errors={state.fieldErrors?.status}>
            <Select name="status" defaultValue={driver?.status ?? "ACTIVE"}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DRIVER_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {DRIVER_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Notes" htmlFor="notes" errors={state.fieldErrors?.notes}>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={driver?.notes ?? ""}
              placeholder="Preferred routes, cross-border experience, languages spoken."
              rows={3}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>{isEdit ? "Save changes" : "Add driver"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
