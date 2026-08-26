"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";

import { submitPublicRequestAction } from "@/app/book/[slug]/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/lib/hooks/use-action-form";

export function PublicRequestForm({
  slug,
  companyName,
  timeZone,
}: {
  slug: string;
  companyName: string;
  timeZone: string;
}) {
  const [sent, setSent] = useState(false);

  const { state, formAction } = useActionForm(submitPublicRequestAction, {
    onSuccess: () => setSent(true),
  });

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-success/12 text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">Request received</h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground text-pretty">
            {companyName} has your enquiry and will come back to you with a price.
            Check your email — including spam — for their reply.
          </p>
        </div>
        <Button variant="outline" onClick={() => setSent(false)}>
          Send another request
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage state={state} />

      <input type="hidden" name="slug" value={slug} />

      {/* Honeypot. Hidden from people, irresistible to bots. */}
      <div aria-hidden className="hidden">
        <label htmlFor="company_website">Company website</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Your details
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Your name"
            htmlFor="contact_name"
            required
            errors={state.fieldErrors?.contact_name}
          >
            <Input
              id="contact_name"
              name="contact_name"
              autoComplete="name"
              placeholder="Sarah Johnson"
              aria-invalid={Boolean(state.fieldErrors?.contact_name)}
              required
            />
          </Field>

          <Field
            label="Email"
            htmlFor="contact_email"
            hint="We reply here with your quote."
            required
            errors={state.fieldErrors?.contact_email}
          >
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              autoComplete="email"
              placeholder="sarah@example.com"
              aria-invalid={Boolean(state.fieldErrors?.contact_email)}
              required
            />
          </Field>
        </div>

        <Field
          label="Phone"
          htmlFor="contact_phone"
          errors={state.fieldErrors?.contact_phone}
        >
          <Input
            id="contact_phone"
            name="contact_phone"
            type="tel"
            autoComplete="tel"
            placeholder="+1 416 555 0134"
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4 border-t border-border pt-6">
        <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Your journey
        </legend>

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
              placeholder="Northfield Secondary School, 240 Bloor St W"
            />
          </Field>

          <Field
            label="Drop-off address"
            htmlFor="destination_address"
            errors={state.fieldErrors?.destination_address}
          >
            <Input
              id="destination_address"
              name="destination_address"
              placeholder="Table Rock Centre, 6650 Niagara Pkwy"
            />
          </Field>

          <Field
            label="Departure"
            htmlFor="departure_at"
            hint={`Times are ${timeZone.replace(/_/g, " ")}.`}
            required
            errors={state.fieldErrors?.departure_at}
          >
            <Input
              id="departure_at"
              name="departure_at"
              type="datetime-local"
              aria-invalid={Boolean(state.fieldErrors?.departure_at)}
              required
            />
          </Field>

          <Field
            label="Return"
            htmlFor="return_at"
            hint="Leave blank for one way."
            errors={state.fieldErrors?.return_at}
          >
            <Input
              id="return_at"
              name="return_at"
              type="datetime-local"
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
            placeholder="60"
            aria-invalid={Boolean(state.fieldErrors?.passenger_count)}
            required
          />
        </Field>

        <Field
          label="Anything we should know?"
          htmlFor="special_requirements"
          hint="Accessibility, luggage, rest stops, winter tires, border crossing."
          errors={state.fieldErrors?.special_requirements}
        >
          <Textarea
            id="special_requirements"
            name="special_requirements"
            rows={3}
            placeholder="Two wheelchair users, ski equipment, and a stop in Barrie."
          />
        </Field>
      </fieldset>

      <SubmitButton size="lg" className="w-full">
        <Send />
        Request a quote
      </SubmitButton>

      <p className="text-center text-xs text-muted-foreground text-pretty">
        Sending this does not book anything. {companyName} will review your dates
        and reply with a price.
      </p>
    </form>
  );
}
