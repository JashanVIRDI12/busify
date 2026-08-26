"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  createTripRequestAction,
  updateTripRequestAction,
} from "@/app/(dashboard)/trip-requests/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { utcToZonedInputValue } from "@/lib/datetime";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { NO_CUSTOMER } from "@/lib/validations/trip-request";
import type { Tables } from "@/types/database";

type CustomerOption = Pick<
  Tables<"customers">,
  "id" | "first_name" | "last_name" | "company"
>;

type TripRequestDialogProps = {
  customers: CustomerOption[];
  timeZone: string;
  request?: Tables<"trip_requests">;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function customerLabel(customer: CustomerOption) {
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ");
  return customer.company ? `${name} · ${customer.company}` : name;
}

export function TripRequestDialog({
  customers,
  timeZone,
  request,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: TripRequestDialogProps) {
  const isEdit = Boolean(request);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const { state, formAction } = useActionForm(
    isEdit ? updateTripRequestAction : createTripRequestAction,
    {
      onSuccess: () => {
        toast.success(isEdit ? "Request updated." : "Trip request created.");
        setOpen(false);
      },
    },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit request" : "New trip request"}</DialogTitle>
          <DialogDescription>
            Times are in your organization&rsquo;s timezone ({timeZone.replace(/_/g, " ")}).
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5" noValidate>
          <FormMessage state={state} />

          {request && <input type="hidden" name="id" value={request.id} />}

          <Field
            label="Customer"
            htmlFor="customer_id"
            hint="Leave unassigned for an enquiry from someone new."
            errors={state.fieldErrors?.customer_id}
          >
            <Select
              name="customer_id"
              defaultValue={request?.customer_id ?? NO_CUSTOMER}
            >
              <SelectTrigger id="customer_id">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CUSTOMER}>Unassigned</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customerLabel(customer)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Pickup"
              htmlFor="pickup_location"
              required
              errors={state.fieldErrors?.pickup_location}
            >
              <Input
                id="pickup_location"
                name="pickup_location"
                defaultValue={request?.pickup_location ?? ""}
                placeholder="Toronto"
                aria-invalid={Boolean(state.fieldErrors?.pickup_location)}
                required
              />
            </Field>

            <Field
              label="Destination"
              htmlFor="destination"
              required
              errors={state.fieldErrors?.destination}
            >
              <Input
                id="destination"
                name="destination"
                defaultValue={request?.destination ?? ""}
                placeholder="Niagara Falls"
                aria-invalid={Boolean(state.fieldErrors?.destination)}
                required
              />
            </Field>

            <Field
              label="Pickup address"
              htmlFor="pickup_address"
              errors={state.fieldErrors?.pickup_address}
            >
              <Input
                id="pickup_address"
                name="pickup_address"
                defaultValue={request?.pickup_address ?? ""}
                placeholder="Northfield School, Vasant Kunj"
              />
            </Field>

            <Field
              label="Destination address"
              htmlFor="destination_address"
              errors={state.fieldErrors?.destination_address}
            >
              <Input
                id="destination_address"
                name="destination_address"
                defaultValue={request?.destination_address ?? ""}
                placeholder="Hotel Rajputana, Palace Road"
              />
            </Field>

            <Field
              label="Departure"
              htmlFor="departure_at"
              required
              errors={state.fieldErrors?.departure_at}
            >
              <Input
                id="departure_at"
                name="departure_at"
                type="datetime-local"
                defaultValue={
                  request ? utcToZonedInputValue(request.departure_at, timeZone) : ""
                }
                aria-invalid={Boolean(state.fieldErrors?.departure_at)}
                required
              />
            </Field>

            <Field
              label="Return"
              htmlFor="return_at"
              hint="Leave blank for a one-way trip."
              errors={state.fieldErrors?.return_at}
            >
              <Input
                id="return_at"
                name="return_at"
                type="datetime-local"
                defaultValue={
                  request?.return_at
                    ? utcToZonedInputValue(request.return_at, timeZone)
                    : ""
                }
                aria-invalid={Boolean(state.fieldErrors?.return_at)}
              />
            </Field>
          </div>

          <Field
            label="Passengers"
            htmlFor="passenger_count"
            required
            errors={state.fieldErrors?.passenger_count}
          >
            <Input
              id="passenger_count"
              name="passenger_count"
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              defaultValue={request?.passenger_count ?? ""}
              placeholder="60"
              aria-invalid={Boolean(state.fieldErrors?.passenger_count)}
              required
            />
          </Field>

          <Field
            label="Special requirements"
            htmlFor="special_requirements"
            hint="One per line — wheelchair access, luggage, catering stops."
            errors={state.fieldErrors?.special_requirements}
          >
            <Textarea
              id="special_requirements"
              name="special_requirements"
              defaultValue={request?.special_requirements ?? ""}
              rows={3}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Contact name"
              htmlFor="contact_name"
              errors={state.fieldErrors?.contact_name}
            >
              <Input
                id="contact_name"
                name="contact_name"
                defaultValue={request?.contact_name ?? ""}
              />
            </Field>
            <Field
              label="Contact email"
              htmlFor="contact_email"
              errors={state.fieldErrors?.contact_email}
            >
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                defaultValue={request?.contact_email ?? ""}
                aria-invalid={Boolean(state.fieldErrors?.contact_email)}
              />
            </Field>
            <Field
              label="Contact phone"
              htmlFor="contact_phone"
              errors={state.fieldErrors?.contact_phone}
            >
              <Input
                id="contact_phone"
                name="contact_phone"
                type="tel"
                defaultValue={request?.contact_phone ?? ""}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>
              {isEdit ? "Save changes" : "Create request"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
