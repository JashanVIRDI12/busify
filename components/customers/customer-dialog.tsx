"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  createCustomerAction,
  updateCustomerAction,
} from "@/app/(dashboard)/customers/actions";
import { FormMessage } from "@/components/auth/form-message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/lib/hooks/use-action-form";
import type { Tables } from "@/types/database";

type CustomerDialogProps = {
  customer?: Tables<"customers">;
  /** Uncontrolled usage: render your own trigger. */
  trigger?: ReactNode;
  /** Controlled usage — required when opening from inside a dropdown menu,
   *  which unmounts its children on close. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function CustomerDialog({
  customer,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: CustomerDialogProps) {
  const isEdit = Boolean(customer);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const { state, formAction } = useActionForm(
    isEdit ? updateCustomerAction : createCustomerAction,
    {
      onSuccess: () => {
        toast.success(isEdit ? "Customer updated." : "Customer added.");
        setOpen(false);
      },
    },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the contact details your team quotes and dispatches against."
              : "Customers are who you quote, book and invoice. Only a first name is required."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5" noValidate>
          <FormMessage state={state} />

          {customer && <input type="hidden" name="id" value={customer.id} />}

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
                defaultValue={customer?.first_name ?? ""}
                autoComplete="off"
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
                defaultValue={customer?.last_name ?? ""}
                autoComplete="off"
              />
            </Field>

            <Field label="Email" htmlFor="email" errors={state.fieldErrors?.email}>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={customer?.email ?? ""}
                placeholder="sarah@example.com"
                aria-invalid={Boolean(state.fieldErrors?.email)}
              />
            </Field>

            <Field label="Phone" htmlFor="phone" errors={state.fieldErrors?.phone}>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={customer?.phone ?? ""}
                placeholder="+1 416 555 0134"
              />
            </Field>
          </div>

          <Field
            label="Company"
            htmlFor="company"
            hint="Schools, corporates and agencies book most charters."
            errors={state.fieldErrors?.company}
          >
            <Input
              id="company"
              name="company"
              defaultValue={customer?.company ?? ""}
              placeholder="Northfield School"
            />
          </Field>

          <Field label="Notes" htmlFor="notes" errors={state.fieldErrors?.notes}>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={customer?.notes ?? ""}
              placeholder="Preferences, invoicing requirements, anything your dispatchers should know."
              rows={3}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>{isEdit ? "Save changes" : "Add customer"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
