"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createContactAction,
  updateContactAction,
} from "@/app/(dashboard)/contacts/actions";
import {
  FormAlert,
  PhoneField,
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
import { PROVINCES } from "@/lib/constants";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { useListParams } from "@/lib/hooks/use-list-params";
import { toOptions } from "@/lib/taxonomy";
import type { Tables } from "@/types/database";

type Contact = Tables<"customers">;
type CompanyOption = { id: string; name: string };

/**
 * Opens two ways: from a trigger (the "Add Contact" button) or from the URL
 * (`?edit=<id>`, which every row name links to). Routing the edit case keeps
 * one drawer on the page instead of one per row, and makes an open editor
 * survive a refresh.
 */
export function ContactDrawer({
  trigger,
  contact,
  companies,
  industries,
  routed = false,
}: {
  trigger?: ReactNode;
  contact?: Contact;
  companies: CompanyOption[];
  industries: string[];
  routed?: boolean;
}) {
  const { setParams } = useListParams();
  const [open, setOpen] = useState(routed);
  const editing = Boolean(contact);

  function close() {
    setOpen(false);
    if (routed) setParams({ edit: null }, { keepPage: true });
  }

  const { state, formAction, reset } = useActionForm(
    editing ? updateContactAction : createContactAction,
    {
      onSuccess: () => {
        toast.success(editing ? "Contact updated" : "Contact created");
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
        title={editing ? "Edit Contact" : "Create Contact"}
      >
        <DrawerForm action={formAction}>
          {editing && <input type="hidden" name="id" value={contact!.id} />}

          <DrawerBody>
            <FormAlert message={state.status === "error" ? state.message : undefined} />

            <DrawerRow>
              <TextField
                name="first_name"
                placeholder="First Name"
                defaultValue={contact?.first_name ?? ""}
                errors={state.fieldErrors}
                required
              />
              <TextField
                name="last_name"
                placeholder="Last Name"
                defaultValue={contact?.last_name ?? ""}
                errors={state.fieldErrors}
              />
            </DrawerRow>

            <TextField
              name="email"
              type="email"
              placeholder="Email"
              defaultValue={contact?.email ?? ""}
              errors={state.fieldErrors}
            />

            <PhoneField
              name="phone"
              extensionName="phone_extension"
              defaultCountry={contact?.country ?? "CA"}
              defaultValue={contact?.phone ?? ""}
              defaultExtension={contact?.phone_extension ?? ""}
              errors={state.fieldErrors}
            />

            <TextField
              name="address_line1"
              placeholder="Address 1"
              defaultValue={contact?.address_line1 ?? ""}
              errors={state.fieldErrors}
            />
            <TextField
              name="address_line2"
              placeholder="Address 2"
              defaultValue={contact?.address_line2 ?? ""}
              errors={state.fieldErrors}
            />
            <TextField
              name="city"
              placeholder="City"
              defaultValue={contact?.city ?? ""}
              errors={state.fieldErrors}
            />

            <DrawerRow>
              <SelectField
                name="province"
                placeholder="Province"
                defaultValue={contact?.province ?? undefined}
                options={PROVINCES.map((province) => ({
                  value: province.code,
                  label: province.name,
                }))}
                errors={state.fieldErrors}
              />
              <TextField
                name="postal_code"
                placeholder="Postal Code"
                defaultValue={contact?.postal_code ?? ""}
                errors={state.fieldErrors}
              />
            </DrawerRow>

            <TextField
              name="job_title"
              placeholder="Job Title"
              defaultValue={contact?.job_title ?? ""}
              errors={state.fieldErrors}
            />

            <SelectField
              name="company_id"
              placeholder="Company"
              defaultValue={contact?.company_id ?? undefined}
              options={companies.map((company) => ({
                value: company.id,
                label: company.name,
              }))}
              emptyHint={{
                message: "No companies yet. A contact can stand on their own.",
                href: "/companies",
                linkLabel: "Add a company",
              }}
              errors={state.fieldErrors}
            />

            <SelectField
              name="industry"
              placeholder="Industry"
              defaultValue={contact?.industry ?? undefined}
              options={toOptions(industries)}
              errors={state.fieldErrors}
            />
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <SubmitButton label={editing ? "Save Contact" : "Create Contact"} />
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
