"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  createVehicleAction,
  updateVehicleAction,
} from "@/app/(dashboard)/vehicles/actions";
import { FormMessage } from "@/components/auth/form-message";
import { VEHICLE_STATUS_LABELS } from "@/components/shared/status-badge";
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
import { useActionForm } from "@/lib/hooks/use-action-form";
import { NO_VEHICLE_TYPE, VEHICLE_STATUSES } from "@/lib/validations/vehicle";
import type { Tables } from "@/types/database";

type VehicleDialogProps = {
  vehicleTypes: Pick<Tables<"vehicle_types">, "id" | "name" | "default_capacity">[];
  vehicle?: Tables<"vehicles">;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function VehicleDialog({
  vehicleTypes,
  vehicle,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: VehicleDialogProps) {
  const isEdit = Boolean(vehicle);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const { state, formAction } = useActionForm(
    isEdit ? updateVehicleAction : createVehicleAction,
    {
      onSuccess: () => {
        toast.success(isEdit ? "Vehicle updated." : "Vehicle added.");
        setOpen(false);
      },
    },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
          <DialogDescription>
            Capacity and status drive what your dispatchers can offer, so keep them
            accurate.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5" noValidate>
          <FormMessage state={state} />

          {vehicle && <input type="hidden" name="id" value={vehicle.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Name"
              htmlFor="name"
              hint="What your team calls it on the radio."
              required
              errors={state.fieldErrors?.name}
            >
              <Input
                id="name"
                name="name"
                defaultValue={vehicle?.name ?? ""}
                placeholder="Coach 17"
                aria-invalid={Boolean(state.fieldErrors?.name)}
                required
              />
            </Field>

            <Field
              label="Registration number"
              htmlFor="registration_number"
              required
              errors={state.fieldErrors?.registration_number}
            >
              <Input
                id="registration_number"
                name="registration_number"
                defaultValue={vehicle?.registration_number ?? ""}
                placeholder="DL 01 AB 1017"
                aria-invalid={Boolean(state.fieldErrors?.registration_number)}
                required
              />
            </Field>

            <Field
              label="Vehicle type"
              htmlFor="vehicle_type_id"
              hint={
                vehicleTypes.length === 0
                  ? "No types defined yet — create one under Fleet › Vehicle types and it will appear here."
                  : undefined
              }
              errors={state.fieldErrors?.vehicle_type_id}
            >
              <Select
                name="vehicle_type_id"
                defaultValue={vehicle?.vehicle_type_id ?? NO_VEHICLE_TYPE}
              >
                <SelectTrigger id="vehicle_type_id">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VEHICLE_TYPE}>
                    {vehicleTypes.length === 0
                      ? "Unassigned — no types created yet"
                      : "Unassigned"}
                  </SelectItem>
                  {vehicleTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                      {type.default_capacity ? ` · ${type.default_capacity} seats` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Capacity"
              htmlFor="capacity"
              hint="Seated passengers, excluding the driver."
              required
              errors={state.fieldErrors?.capacity}
            >
              <Input
                id="capacity"
                name="capacity"
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                defaultValue={vehicle?.capacity ?? ""}
                placeholder="56"
                aria-invalid={Boolean(state.fieldErrors?.capacity)}
                required
              />
            </Field>

            <Field label="Status" htmlFor="status" errors={state.fieldErrors?.status}>
              <Select name="status" defaultValue={vehicle?.status ?? "AVAILABLE"}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {VEHICLE_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Current location"
              htmlFor="location"
              errors={state.fieldErrors?.location}
            >
              <Input
                id="location"
                name="location"
                defaultValue={vehicle?.location ?? ""}
                placeholder="Etobicoke Garage"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Year" htmlFor="year" errors={state.fieldErrors?.year}>
              <Input
                id="year"
                name="year"
                type="number"
                inputMode="numeric"
                min={1950}
                max={2100}
                defaultValue={vehicle?.year ?? ""}
                placeholder="2022"
              />
            </Field>

            <Field label="Make" htmlFor="make" errors={state.fieldErrors?.make}>
              <Input
                id="make"
                name="make"
                defaultValue={vehicle?.make ?? ""}
                placeholder="Volvo"
              />
            </Field>

            <Field label="Model" htmlFor="model" errors={state.fieldErrors?.model}>
              <Input
                id="model"
                name="model"
                defaultValue={vehicle?.model ?? ""}
                placeholder="9600 B11R"
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor="notes" errors={state.fieldErrors?.notes}>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={vehicle?.notes ?? ""}
              placeholder="Accessibility equipment, luggage capacity, quirks worth knowing."
              rows={3}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>{isEdit ? "Save changes" : "Add vehicle"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
