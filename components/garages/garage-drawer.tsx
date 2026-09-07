"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createGarageAction,
  updateGarageAction,
} from "@/app/(dashboard)/garages/actions";
import {
  FormAlert,
  SelectField,
  TextAreaField,
  TextField,
  ToggleField,
} from "@/components/data/form-fields";
import {
  DrawerBody,
  DrawerFooter,
  DrawerForm,
  DrawerRow,
  SideDrawer,
} from "@/components/shell/side-drawer";
import { Button } from "@/components/ui/button";
import { PROVINCES } from "@/lib/constants";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { useListParams } from "@/lib/hooks/use-list-params";
import type { Tables } from "@/types/database";

type Garage = Tables<"garages">;

export function GarageDrawer({
  trigger,
  garage,
  routed = false,
}: {
  trigger?: ReactNode;
  garage?: Garage;
  routed?: boolean;
}) {
  const { setParams } = useListParams();
  const [open, setOpen] = useState(routed);
  const editing = Boolean(garage);

  function close() {
    setOpen(false);
    if (routed) setParams({ edit: null }, { keepPage: true });
  }

  const { state, formAction, reset } = useActionForm(
    editing ? updateGarageAction : createGarageAction,
    {
      onSuccess: () => {
        toast.success(editing ? "Garage updated" : "Garage added");
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
        title={editing ? "Edit Garage" : "Add Garage"}
      >
        <DrawerForm action={formAction}>
          {editing && <input type="hidden" name="id" value={garage!.id} />}

          <DrawerBody>
            <FormAlert
              message={state.status === "error" ? state.message : undefined}
            />

            <TextField
              name="name"
              placeholder="Garage Name"
              defaultValue={garage?.name ?? ""}
              errors={state.fieldErrors}
              required
            />
            <TextField
              name="address"
              placeholder="Address"
              defaultValue={garage?.address ?? ""}
              errors={state.fieldErrors}
            />
            <TextField
              name="city"
              placeholder="City"
              defaultValue={garage?.city ?? ""}
              errors={state.fieldErrors}
            />

            <DrawerRow>
              <SelectField
                name="province"
                placeholder="Province"
                defaultValue={garage?.province ?? undefined}
                options={PROVINCES.map((province) => ({
                  value: province.code,
                  label: province.name,
                }))}
                errors={state.fieldErrors}
              />
              <TextField
                name="postal_code"
                placeholder="Postal Code"
                defaultValue={garage?.postal_code ?? ""}
                errors={state.fieldErrors}
              />
            </DrawerRow>

            <ToggleField
              name="is_default"
              label="Use as the default departing and returning garage"
              defaultChecked={garage?.is_default ?? false}
            />

            <TextAreaField
              name="notes"
              placeholder="Notes — gate codes, parking, after-hours access"
              defaultValue={garage?.notes ?? ""}
              errors={state.fieldErrors}
            />
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <SubmitButton label={editing ? "Save" : "Add Garage"} />
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
