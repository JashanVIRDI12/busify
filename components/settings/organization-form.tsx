"use client";

import { useState } from "react";
import { toast } from "sonner";

import { updateOrganizationAction } from "@/app/(dashboard)/settings/actions";
import { FormMessage } from "@/components/auth/form-message";
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
import {
  COUNTRIES,
  CURRENCIES,
  DEFAULT_PROVINCE,
  PROVINCES,
  TIMEZONES,
} from "@/lib/constants";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { taxForOrigin } from "@/lib/tax/canada";
import type { Tables } from "@/types/database";

export function OrganizationForm({
  organization,
  disabled,
}: {
  organization: Tables<"organizations">;
  disabled: boolean;
}) {
  const { state, formAction } = useActionForm(updateOrganizationAction, {
    onSuccess: (result) => toast.success(result.message ?? "Organization updated."),
  });

  const [province, setProvince] = useState(organization.state ?? DEFAULT_PROVINCE);
  const [timezone, setTimezone] = useState(organization.timezone);

  const tax = taxForOrigin(province);

  function chooseProvince(code: string) {
    setProvince(code);
    const suggestion = PROVINCES.find((entry) => entry.code === code);
    if (suggestion) setTimezone(suggestion.timezone);
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && <FormMessage state={state} />}

      <fieldset disabled={disabled} className="space-y-5">
        <Field
          label="Company name"
          htmlFor="name"
          required
          errors={state.fieldErrors?.name}
        >
          <Input
            id="name"
            name="name"
            defaultValue={organization.name}
            aria-invalid={Boolean(state.fieldErrors?.name)}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact email" htmlFor="email" errors={state.fieldErrors?.email}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={organization.email ?? ""}
              aria-invalid={Boolean(state.fieldErrors?.email)}
            />
          </Field>

          <Field label="Phone" htmlFor="phone" errors={state.fieldErrors?.phone}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={organization.phone ?? ""}
              placeholder="+1 416 555 0134"
            />
          </Field>
        </div>

        <Field label="Address" htmlFor="address" errors={state.fieldErrors?.address}>
          <Textarea
            id="address"
            name="address"
            defaultValue={organization.address ?? ""}
            rows={2}
            placeholder="120 Adelaide Street West, Suite 2500"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" htmlFor="city" errors={state.fieldErrors?.city}>
            <Input id="city" name="city" defaultValue={organization.city ?? ""} />
          </Field>

          <Field
            label="Postal code"
            htmlFor="postal_code"
            errors={state.fieldErrors?.postal_code}
          >
            <Input
              id="postal_code"
              name="postal_code"
              defaultValue={organization.postal_code ?? ""}
              placeholder="M5V 2T6"
              autoComplete="postal-code"
              aria-invalid={Boolean(state.fieldErrors?.postal_code)}
            />
          </Field>

          <Field
            label="Province or territory"
            htmlFor="state"
            hint={
              tax
                ? `New quotes default to ${tax.combined}% ${tax.label}.`
                : undefined
            }
            errors={state.fieldErrors?.state}
          >
            <Select name="state" value={province} onValueChange={chooseProvince}>
              <SelectTrigger id="state">
                <SelectValue placeholder="Select a province" />
              </SelectTrigger>
              <SelectContent>
                {PROVINCES.map((entry) => (
                  <SelectItem key={entry.code} value={entry.code}>
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Country" htmlFor="country" errors={state.fieldErrors?.country}>
            <Select name="country" defaultValue={organization.country}>
              <SelectTrigger id="country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" htmlFor="currency" errors={state.fieldErrors?.currency}>
            <Select name="currency" defaultValue={organization.currency}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="GST/HST number"
            htmlFor="gst_hst_number"
            hint="Printed on every quote. The CRA requires it on invoices of $30 or more, and business customers need it to claim their input tax credit."
            errors={state.fieldErrors?.gst_hst_number}
          >
            <Input
              id="gst_hst_number"
              name="gst_hst_number"
              defaultValue={organization.gst_hst_number ?? ""}
              placeholder="123456789 RT 0001"
              aria-invalid={Boolean(state.fieldErrors?.gst_hst_number)}
            />
          </Field>
        </div>

        <Field
          label="Time zone"
          htmlFor="timezone"
          hint="Saskatchewan and Yukon do not observe daylight time."
          errors={state.fieldErrors?.timezone}
        >
          <Select name="timezone" value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((zone) => (
                <SelectItem key={zone.value} value={zone.value}>
                  {zone.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {!disabled && <SubmitButton>Save changes</SubmitButton>}
      </fieldset>
    </form>
  );
}
