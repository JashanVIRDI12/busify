"use client";

import { useActionState } from "react";

import { resendVerificationAction } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";

export function ResendVerificationForm({ email }: { email?: string }) {
  const [state, formAction] = useActionState(
    resendVerificationAction,
    idleFormState,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <Field label="Email" htmlFor="email" errors={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email}
          placeholder="you@company.com"
          aria-invalid={Boolean(state.fieldErrors?.email)}
          required
        />
      </Field>

      <SubmitButton variant="outline" className="w-full">
        Resend confirmation email
      </SubmitButton>
    </form>
  );
}
