"use client";

import { useActionState } from "react";

import { forgotPasswordAction } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, idleFormState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />

      {state.status !== "success" && (
        <>
          <Field
            label="Work email"
            htmlFor="email"
            required
            errors={state.fieldErrors?.email}
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={Boolean(state.fieldErrors?.email)}
              required
            />
          </Field>

          <SubmitButton className="w-full" size="lg">
            Send reset link
          </SubmitButton>
        </>
      )}
    </form>
  );
}
