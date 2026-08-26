"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  createVehicleTypeAction,
  updateVehicleTypeAction,
} from "@/app/(dashboard)/vehicles/actions";
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
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/lib/hooks/use-action-form";
import type { Tables } from "@/types/database";

type VehicleTypeDialogProps = {
  vehicleType?: Tables<"vehicle_types">;
  currency: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function VehicleTypeDialog({
  vehicleType,
  currency,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: VehicleTypeDialogProps) {
  const isEdit = Boolean(vehicleType);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const { state, formAction } = useActionForm(
    isEdit ? updateVehicleTypeAction : createVehicleTypeAction,
    {
      onSuccess: () => {
        toast.success(isEdit ? "Vehicle type updated." : "Vehicle type added.");
        setOpen(false);
      },
    },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit vehicle type" : "Add vehicle type"}
          </DialogTitle>
          <DialogDescription>
            Types group your fleet and carry the rates quoting will use. Rates are
            in {currency}.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5" noValidate>
          <FormMessage state={state} />

          {vehicleType && <input type="hidden" name="id" value={vehicleType.id} />}

          <Field
            label="Name"
            htmlFor="type_name"
            required
            errors={state.fieldErrors?.name}
          >
            <Input
              id="type_name"
              name="name"
              defaultValue={vehicleType?.name ?? ""}
              placeholder="Luxury Coach"
              aria-invalid={Boolean(state.fieldErrors?.name)}
              required
            />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            errors={state.fieldErrors?.description}
          >
            <Textarea
              id="description"
              name="description"
              defaultValue={vehicleType?.description ?? ""}
              placeholder="Air-conditioned 2x2 seating, reclining seats, onboard restroom."
              rows={2}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Default capacity"
              htmlFor="default_capacity"
              hint="Used as the suggested seat count."
              errors={state.fieldErrors?.default_capacity}
            >
              <Input
                id="default_capacity"
                name="default_capacity"
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                defaultValue={vehicleType?.default_capacity ?? ""}
                placeholder="56"
              />
            </Field>

            <Field
              label="Base rate"
              htmlFor="base_rate"
              hint="Flat charge before distance and time."
              errors={state.fieldErrors?.base_rate}
            >
              <Input
                id="base_rate"
                name="base_rate"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                defaultValue={vehicleType?.base_rate ?? 0}
              />
            </Field>

            <Field
              label="Rate per km"
              htmlFor="per_km_rate"
              errors={state.fieldErrors?.per_km_rate}
            >
              <Input
                id="per_km_rate"
                name="per_km_rate"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                defaultValue={vehicleType?.per_km_rate ?? 0}
              />
            </Field>

            <Field
              label="Rate per hour"
              htmlFor="per_hour_rate"
              errors={state.fieldErrors?.per_hour_rate}
            >
              <Input
                id="per_hour_rate"
                name="per_hour_rate"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                defaultValue={vehicleType?.per_hour_rate ?? 0}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>{isEdit ? "Save changes" : "Add type"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
