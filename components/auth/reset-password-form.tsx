"use client";

import { useActionState } from "react";

import { resetPasswordAction } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPasswordAction, idleFormState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />

      <Field
        label="New password"
        htmlFor="password"
        hint="At least 8 characters."
        required
        errors={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          required
        />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        required
        errors={state.fieldErrors?.confirmPassword}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          required
        />
      </Field>

      <SubmitButton className="w-full" size="lg">
        Update password
      </SubmitButton>
    </form>
  );
}
