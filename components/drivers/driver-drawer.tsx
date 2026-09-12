"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createDriverAction,
  updateDriverAction,
} from "@/app/(dashboard)/drivers/actions";
import {
  FormAlert,
  SelectField,
  TextField,
} from "@/components/data/form-fields";
import {
  DrawerBody,
  DrawerFooter,
  DrawerForm,
  DrawerRow,
  SideDrawer,
} from "@/components/shell/side-drawer";
import { Button } from "@/components/ui/button";
import { DRIVER_LICENCE_CLASSES } from "@/lib/constants";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { useListParams } from "@/lib/hooks/use-list-params";
import { DRIVER_STATUSES } from "@/lib/validations/driver";
import type { Tables } from "@/types/database";

type Driver = Tables<"drivers">;
type GarageOption = { id: string; name: string };

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  OFF_DUTY: "Off duty",
  ON_TRIP: "On trip",
  ON_LEAVE: "On leave",
  INACTIVE: "Not active",
};

export function DriverDrawer({
  trigger,
  driver,
  garages,
  routed = false,
}: {
  trigger?: ReactNode;
  driver?: Driver;
  garages: GarageOption[];
  routed?: boolean;
}) {
  const { setParams } = useListParams();
  const [open, setOpen] = useState(routed);
  const editing = Boolean(driver);

  function close() {
    setOpen(false);
    if (routed) setParams({ edit: null }, { keepPage: true });
  }

  const { state, formAction, reset } = useActionForm(
    editing ? updateDriverAction : createDriverAction,
    {
      onSuccess: () => {
        toast.success(editing ? "Driver updated" : "Driver added");
        close();
      },
    },
  );

  return (
    <>
      {trigger && (
        <span
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          {trigger}
        </span>
      )}

      <SideDrawer
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title={editing ? "Edit Driver" : "Add Driver"}
        width="sm:w-[34rem]"
      >
        <DrawerForm action={formAction}>
          {editing && <input type="hidden" name="id" value={driver!.id} />}

          <DrawerBody>
            <FormAlert
              message={state.status === "error" ? state.message : undefined}
            />

            <DrawerRow>
              <TextField
                name="first_name"
                placeholder="First Name"
                defaultValue={driver?.first_name ?? ""}
                errors={state.fieldErrors}
                required
              />
              <TextField
                name="last_name"
                placeholder="Last Name"
                defaultValue={driver?.last_name ?? ""}
                errors={state.fieldErrors}
              />
            </DrawerRow>

            <DrawerRow>
              <TextField
                name="email"
                type="email"
                placeholder="Email"
                defaultValue={driver?.email ?? ""}
                errors={state.fieldErrors}
              />
              <TextField
                name="phone"
                type="tel"
                placeholder="Phone Number"
                defaultValue={driver?.phone ?? ""}
                errors={state.fieldErrors}
              />
            </DrawerRow>

            <DrawerRow>
              <SelectField
                name="garage_id"
                placeholder="Garage"
                defaultValue={driver?.garage_id ?? undefined}
                options={garages.map((garage) => ({
                  value: garage.id,
                  label: garage.name,
                }))}
                emptyHint={{
                  message: "No garages yet.",
                  href: "/settings/garages",
                  linkLabel: "Add a garage",
                }}
                errors={state.fieldErrors}
              />
              <SelectField
                name="status"
                placeholder="Status"
                defaultValue={driver?.status ?? "ACTIVE"}
                options={DRIVER_STATUSES.map((status) => ({
                  value: status,
                  label: STATUS_LABELS[status] ?? status,
                }))}
                errors={state.fieldErrors}
              />
            </DrawerRow>

            {/* Licence details sit below the fold of the create flow: a
                dispatcher adding a driver mid-shift has the phone number to
                hand and the licence class in a filing cabinet. */}
            <DrawerRow>
              <TextField
                name="license_number"
                placeholder="Licence Number"
                defaultValue={driver?.license_number ?? ""}
                errors={state.fieldErrors}
              />
              <TextField
                name="license_expires_on"
                type="date"
                placeholder="Licence Expiry"
                defaultValue={driver?.license_expires_on ?? ""}
                errors={state.fieldErrors}
              />
            </DrawerRow>

            <SelectField
              name="license_class"
              placeholder="Licence Class"
              defaultValue={driver?.license_class ?? undefined}
              options={DRIVER_LICENCE_CLASSES.map((entry) => ({
                value: entry.value,
                label: entry.label,
              }))}
              errors={state.fieldErrors}
            />

            <label className="flex items-center gap-2.5 text-body-sm text-carbon">
              <input
                type="checkbox"
                name="air_brake_endorsement"
                defaultChecked={driver?.air_brake_endorsement ?? false}
                className="size-4 accent-[var(--orange-500)]"
              />
              Air brake endorsement (Class Z in Ontario)
            </label>
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <SubmitButton label={editing ? "Save" : "Apply"} />
          </DrawerFooter>
        </DrawerForm>
      </SideDrawer>
    </>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {label}
    </Button>
  );
}
