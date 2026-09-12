"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateCompanyProfileAction } from "@/app/(dashboard)/settings/company-actions";
import { FormAlert } from "@/components/data/form-fields";
import { Button } from "@/components/ui/button";
import { StackedInput } from "@/components/ui/input";
import { PROVINCES } from "@/lib/constants";
import { useActionForm } from "@/lib/hooks/use-action-form";
import type { Tables } from "@/types/database";

type Organization = Tables<"organizations">;

/**
 * The company as the customer sees it: what goes on a quote, an invoice and the
 * bottom of an email. Two columns because the postal address is one idea and
 * everything else is another — interleaving them makes both harder to check.
 */
export function CompanyProfileForm({
  organization,
  canEdit,
}: {
  organization: Organization;
  canEdit: boolean;
}) {
  const { state, formAction } = useActionForm(updateCompanyProfileAction, {
    onSuccess: (result) => toast.success(result.message ?? "Saved"),
  });

  const error = (name: string) => state.fieldErrors?.[name]?.[0];

  return (
    <form action={formAction} className="panel p-5 sm:p-6">
      <div className="mb-4">
        <FormAlert message={state.status === "error" ? state.message : undefined} />
      </div>

      <fieldset disabled={!canEdit} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-3.5">
          <Field
            name="name"
            label="Company Name"
            defaultValue={organization.name}
            error={error("name")}
            required
          />
          <Field
            name="website"
            label="Company Website"
            defaultValue={organization.website}
            error={error("website")}
          />
          <Field
            name="email_sender_name"
            label="Email Sender Name"
            defaultValue={organization.email_sender_name}
            error={error("email_sender_name")}
          />
          <Field
            name="email"
            label="Primary Email Address"
            type="email"
            defaultValue={organization.email}
            error={error("email")}
          />
          <Field
            name="bcc_email"
            label="BCC Email Address"
            type="email"
            defaultValue={organization.bcc_email}
            error={error("bcc_email")}
          />
          <Field
            name="sales_phone"
            label="Sales Phone Number"
            defaultValue={organization.sales_phone}
            error={error("sales_phone")}
          />
          <Field
            name="operations_phone"
            label="Operations Phone"
            defaultValue={organization.operations_phone}
            error={error("operations_phone")}
          />
          <Field
            name="fax"
            label="Fax"
            defaultValue={organization.fax}
            error={error("fax")}
          />
          <Field
            name="dot_number"
            label="DOT Number"
            defaultValue={organization.dot_number}
            error={error("dot_number")}
          />
          <Field
            name="gst_hst_number"
            label="GST / HST Number"
            defaultValue={organization.gst_hst_number}
            error={error("gst_hst_number")}
          />
          <Field
            name="facebook_url"
            label="Facebook Link"
            defaultValue={organization.facebook_url}
            error={error("facebook_url")}
          />
          <Field
            name="instagram_url"
            label="Instagram Link"
            defaultValue={organization.instagram_url}
            error={error("instagram_url")}
          />
          <Field
            name="twitter_url"
            label="Twitter Link"
            defaultValue={organization.twitter_url}
            error={error("twitter_url")}
          />
        </div>

        <div className="space-y-3.5">
          <Field
            name="address"
            label="Operations Address"
            defaultValue={organization.address}
            error={error("address")}
          />
          <Field
            name="address_line2"
            label="Operations Address 2"
            defaultValue={organization.address_line2}
            error={error("address_line2")}
          />
          <Field
            name="city"
            label="City"
            defaultValue={organization.city}
            error={error("city")}
          />

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex min-h-[46px] flex-col justify-center rounded-md border border-cloud bg-signal-white px-3 py-1 transition-colors focus-within:border-orange-400 hover:border-fog">
              <label htmlFor="province" className="field-stack-label">
                Province
              </label>
              <select
                id="province"
                name="state"
                defaultValue={organization.state ?? ""}
                className="w-full cursor-pointer border-0 bg-transparent p-0 text-body-sm font-medium text-ink outline-none"
              >
                <option value="">Not set</option>
                {PROVINCES.map((province) => (
                  <option key={province.code} value={province.code}>
                    {province.code}
                  </option>
                ))}
              </select>
            </div>

            <Field
              name="postal_code"
              label="Postal Code"
              defaultValue={organization.postal_code}
              error={error("postal_code")}
            />
          </div>
        </div>

        {canEdit && (
          <div className="lg:pl-4">
            <SaveButton />
          </div>
        )}
      </fieldset>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  error,
  type,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  error?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <StackedInput
        name={name}
        label={label}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        containerClassName={error ? "border-destructive" : undefined}
      />
      {error && (
        <p className="mt-1 text-[12px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full lg:w-auto">
      {pending && <Loader2 className="size-4 animate-spin" />}
      Save
    </Button>
  );
}
