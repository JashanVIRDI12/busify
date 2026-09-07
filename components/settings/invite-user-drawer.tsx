"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { inviteUserAction } from "@/app/(dashboard)/settings/user-actions";
import {
  FormAlert,
  SelectField,
  TextField,
} from "@/components/data/form-fields";
import {
  DrawerBody,
  DrawerFooter,
  DrawerForm,
  SideDrawer,
} from "@/components/shell/side-drawer";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";

const ROLES = ["ADMIN", "DISPATCHER", "STAFF", "ACCOUNTANT", "DRIVER"] as const;

/**
 * Adds someone to the organization by email.
 *
 * Deliberately an invitation rather than "create a user with a password": the
 * person sets their own credentials, and nobody here ever handles them. If they
 * already have an account they are simply added, and the drawer says so.
 */
export function InviteUserDrawer() {
  const [open, setOpen] = useState(false);

  const { state, formAction, reset } = useActionForm(inviteUserAction, {
    onSuccess: (result) => {
      toast.success(result.message ?? "Invitation sent");
      setOpen(false);
    },
  });

  return (
    <>
      <Button
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Plus />
        Create User
      </Button>

      <SideDrawer open={open} onOpenChange={setOpen} title="Create User">
        <DrawerForm action={formAction}>
          <DrawerBody>
            <FormAlert
              message={state.status === "error" ? state.message : undefined}
            />

            <TextField
              name="full_name"
              placeholder="Full Name"
              errors={state.fieldErrors}
            />
            <TextField
              name="email"
              type="email"
              placeholder="Email"
              required
              errors={state.fieldErrors}
            />
            <SelectField
              name="role"
              placeholder="Type"
              defaultValue="DISPATCHER"
              options={ROLES.map((role) => ({
                value: role,
                label: ROLE_LABELS[role],
              }))}
              errors={state.fieldErrors}
            />

            <div className="rounded-md border border-bone bg-mist px-3.5 py-3">
              <p className="mb-1.5 text-[12px] font-medium text-carbon">
                What each role can do
              </p>
              <dl className="space-y-1.5">
                {ROLES.map((role) => (
                  <div key={role} className="text-[11.5px] leading-snug">
                    <dt className="inline font-medium text-ink">
                      {ROLE_LABELS[role]}:{" "}
                    </dt>
                    <dd className="inline text-slate">{ROLE_DESCRIPTIONS[role]}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <p className="text-[12px] text-ash">
              They will get an email invitation and choose their own password.
              Nobody here ever sees it.
            </p>
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton />
          </DrawerFooter>
        </DrawerForm>
      </SideDrawer>
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Create User
    </Button>
  );
}
