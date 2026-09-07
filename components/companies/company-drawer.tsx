"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createCompanyAction,
  updateCompanyAction,
} from "@/app/(dashboard)/companies/actions";
import {
  FormAlert,
  PhoneField,
  SelectField,
  TagsField,
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
import { PROVINCES } from "@/lib/constants";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { useListParams } from "@/lib/hooks/use-list-params";
import { INDUSTRIES, toOptions } from "@/lib/taxonomy";
import type { Tables } from "@/types/database";

type Company = Tables<"companies">;

export function CompanyDrawer({
  trigger,
  company,
  routed = false,
}: {
  trigger?: ReactNode;
  company?: Company;
  routed?: boolean;
}) {
  const { setParams } = useListParams();
  const [open, setOpen] = useState(routed);
  const editing = Boolean(company);

  function close() {
    setOpen(false);
    if (routed) setParams({ edit: null }, { keepPage: true });
  }

  const { state, formAction, reset } = useActionForm(
    editing ? updateCompanyAction : createCompanyAction,
    {
      onSuccess: () => {
        toast.success(editing ? "Company updated" : "Company created");
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
        title={editing ? "Edit Company" : "Create Company"}
      >
        <DrawerForm action={formAction}>
          {editing && <input type="hidden" name="id" value={company!.id} />}

          <DrawerBody>
            <FormAlert
              message={state.status === "error" ? state.message : undefined}
            />

            <TextField
              name="name"
              placeholder="Company Name"
              defaultValue={company?.name ?? ""}
              errors={state.fieldErrors}
              required
            />
            <TextField
              name="website"
              placeholder="Company Website"
              defaultValue={company?.website ?? ""}
              errors={state.fieldErrors}
            />
            <TextField
              name="email"
              type="email"
              placeholder="Email"
              defaultValue={company?.email ?? ""}
              errors={state.fieldErrors}
            />

            <PhoneField
              name="phone"
              defaultCountry={company?.country ?? "CA"}
              defaultValue={company?.phone ?? ""}
              errors={state.fieldErrors}
            />

            <TextField
              name="fax"
              placeholder="Fax Number"
              defaultValue={company?.fax ?? ""}
              errors={state.fieldErrors}
            />
            <TextField
              name="address_line1"
              placeholder="Address 1"
              defaultValue={company?.address_line1 ?? ""}
              errors={state.fieldErrors}
            />
            <TextField
              name="address_line2"
              placeholder="Address 2"
              defaultValue={company?.address_line2 ?? ""}
              errors={state.fieldErrors}
            />
            <TextField
              name="city"
              placeholder="City"
              defaultValue={company?.city ?? ""}
              errors={state.fieldErrors}
            />

            <DrawerRow>
              <SelectField
                name="province"
                placeholder="Province"
                defaultValue={company?.province ?? undefined}
                options={PROVINCES.map((province) => ({
                  value: province.code,
                  label: province.name,
                }))}
                errors={state.fieldErrors}
              />
              <TextField
                name="postal_code"
                placeholder="Postal Code"
                defaultValue={company?.postal_code ?? ""}
                errors={state.fieldErrors}
              />
            </DrawerRow>

            <SelectField
              name="industry"
              placeholder="Industry"
              defaultValue={company?.industry ?? undefined}
              options={toOptions(INDUSTRIES)}
              errors={state.fieldErrors}
            />

            <TagsField
              name="groups"
              label="Groups"
              defaultValue={company?.groups ?? []}
              placeholder="School board, VIP…"
            />
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <SubmitButton label={editing ? "Save Company" : "Create Company"} />
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
