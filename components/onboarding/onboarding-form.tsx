"use client";

import { useActionState, useState } from "react";

import { createOrganizationAction } from "@/app/onboarding/actions";
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
import {
  COUNTRIES,
  CURRENCIES,
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  DEFAULT_PROVINCE,
  DEFAULT_TIMEZONE,
  PROVINCES,
  TIMEZONES,
} from "@/lib/constants";
import { idleFormState } from "@/lib/forms";
import { taxForOrigin } from "@/lib/tax/canada";

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction] = useActionState(
    createOrganizationAction,
    idleFormState,
  );

  // Province drives two things an operator should not have to think about: the
  // time zone their departures are read in, and the sales tax their quotes
  // default to. Both are set here rather than in an effect, so the value is
  // only ever overwritten by a deliberate choice.
  const [province, setProvince] = useState<string>(DEFAULT_PROVINCE);
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);

  const tax = taxForOrigin(province);

  function chooseProvince(code: string) {
    setProvince(code);
    const suggestion = PROVINCES.find((entry) => entry.code === code);
    if (suggestion) setTimezone(suggestion.timezone);
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage state={state} />

      <Field
        label="Company name"
        htmlFor="name"
        hint="Shown to customers on quotes and booking pages."
        required
        errors={state.fieldErrors?.name}
      >
        <Input
          id="name"
          name="name"
          placeholder="Maple Leaf Coach Lines"
          autoComplete="organization"
          aria-invalid={Boolean(state.fieldErrors?.name)}
          required
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Contact email"
          htmlFor="email"
          errors={state.fieldErrors?.email}
        >
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultEmail}
            placeholder="bookings@company.ca"
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
        </Field>

        <Field label="Phone" htmlFor="phone" errors={state.fieldErrors?.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+1 416 555 0134"
            aria-invalid={Boolean(state.fieldErrors?.phone)}
          />
        </Field>

        <Field label="City" htmlFor="city" errors={state.fieldErrors?.city}>
          <Input id="city" name="city" placeholder="Toronto" />
        </Field>

        <Field
          label="Postal code"
          htmlFor="postal_code"
          errors={state.fieldErrors?.postal_code}
        >
          <Input
            id="postal_code"
            name="postal_code"
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
              ? `Charters starting here are taxed at ${tax.combined}% ${tax.label}.`
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
          <Select name="country" defaultValue={DEFAULT_COUNTRY}>
            <SelectTrigger id="country">
              <SelectValue placeholder="Select a country" />
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

        <Field
          label="Currency"
          htmlFor="currency"
          errors={state.fieldErrors?.currency}
        >
          <Select name="currency" defaultValue={DEFAULT_CURRENCY}>
            <SelectTrigger id="currency">
              <SelectValue placeholder="Select a currency" />
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
      </div>

      <Field
        label="Time zone"
        htmlFor="timezone"
        hint="Departure and return times are shown in this zone. Saskatchewan and Yukon do not change their clocks."
        errors={state.fieldErrors?.timezone}
      >
        <Select name="timezone" value={timezone} onValueChange={setTimezone}>
          <SelectTrigger id="timezone">
            <SelectValue placeholder="Select a time zone" />
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

      <SubmitButton size="lg" className="w-full sm:w-auto">
        Create organization
      </SubmitButton>
    </form>
  );
}
