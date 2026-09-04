"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { inviteMemberAction } from "@/app/(dashboard)/settings/actions";
import { FormMessage } from "@/components/auth/form-message";
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
import { useActionForm } from "@/lib/hooks/use-action-form";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ASSIGNABLE_ROLES } from "@/lib/permissions";
import { NEW_DRIVER } from "@/lib/validations/invitation";
import type { OrgRole } from "@/types/database";

type UnlinkedDriver = { id: string; first_name: string; last_name: string | null };

export function InviteDialog({
  drivers,
  trigger,
}: {
  drivers: UnlinkedDriver[];
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<OrgRole>("DISPATCHER");
  const [driverChoice, setDriverChoice] = useState<string>(
    drivers[0]?.id ?? NEW_DRIVER,
  );

  const { state, formAction } = useActionForm(inviteMemberAction, {
    onSuccess: (result) => {
      toast.success(result.message ?? "Invitation sent.");
      setOpen(false);
    },
    onError: (result) => toast.error(result.message ?? "Could not send that invitation."),
  });

  const isDriver = role === "DRIVER";
  const isNewDriver = driverChoice === NEW_DRIVER;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>
            They get an email to set a password and join {""}
            {ROLE_LABELS[role].toLowerCase()} access. A Driver signs in to the
            driver portal, not this dashboard.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5" noValidate>
          <FormMessage state={state} />

          <Field
            label="Email"
            htmlFor="email"
            required
            errors={state.fieldErrors?.email}
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="off"
              placeholder="name@company.com"
              aria-invalid={Boolean(state.fieldErrors?.email)}
              required
            />
          </Field>

          <Field
            label="Role"
            htmlFor="role"
            hint={ROLE_DESCRIPTIONS[role]}
            errors={state.fieldErrors?.role}
          >
            <Select
              name="role"
              value={role}
              onValueChange={(value) => setRole(value as OrgRole)}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {isDriver && (
            <Field
              label="Driver record"
              htmlFor="driver_id"
              hint="The login is attached to this driver, so their assigned trips show up in the portal."
              errors={state.fieldErrors?.driver_id}
            >
              <Select
                name="driver_id"
                value={driverChoice}
                onValueChange={setDriverChoice}
              >
                <SelectTrigger id="driver_id">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {[driver.first_name, driver.last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_DRIVER}>
                    Create a new driver record
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {isDriver && isNewDriver && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                htmlFor="driver_first_name"
                required
                errors={state.fieldErrors?.driver_first_name}
              >
                <Input
                  id="driver_first_name"
                  name="driver_first_name"
                  aria-invalid={Boolean(state.fieldErrors?.driver_first_name)}
                  required
                />
              </Field>
              <Field
                label="Last name"
                htmlFor="driver_last_name"
                errors={state.fieldErrors?.driver_last_name}
              >
                <Input id="driver_last_name" name="driver_last_name" />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>Send invitation</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
